import { createHash } from 'node:crypto';
import { createSchedulePayload, getScheduleKey } from './schedule.mjs';
import {
  calculateBacktest,
  calculatePassageEstimate,
  createObservationSnapshot,
  getServiceDate,
  getServiceDateTime,
  getServiceDay,
  MIN_OBSERVATIONS,
  PRIOR_MINUTES,
  PRIOR_P10_MINUTES,
  PRIOR_P90_MINUTES,
} from './precision.mjs';

const OBSERVATION_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;
const SERVICE_TIME_ZONE = 'America/Belem';

function responseHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
}

function formatTime(totalMinutes) {
  const minutes = Math.round(totalMinutes);
  const minutesOfDay = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(minutesOfDay / 60)).padStart(2, '0')}:${String(minutesOfDay % 60).padStart(2, '0')}`;
}

function tripKey(gradeHash, scheduleKey, serviceDate) {
  return createHash('sha256')
    .update(`${gradeHash}|${scheduleKey}|${serviceDate}`)
    .digest('hex');
}

async function supabaseRequest(url, key, options = {}) {
  return fetch(url, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(options.headers || {}),
    },
  });
}

async function loadSchedule(supabaseUrl, serviceKey) {
  const response = await supabaseRequest(
    `${supabaseUrl}/rest/v1/horarios?select=destino,horario,embarque,dias&order=horario.asc`,
    serviceKey,
  );
  if (!response.ok) throw new Error(`Falha ao carregar a grade (HTTP ${response.status}).`);
  return createSchedulePayload(await response.json());
}

async function loadObservations(supabaseUrl, serviceKey, gradeHash) {
  const observations = [];
  const cutoff = new Date(Date.now() - OBSERVATION_WINDOW_MS).toISOString();
  const query = new URLSearchParams({
    select: 'observed_at,scheduled_departure,travel_minutes,structural_prediction_minutes,prior_prediction_minutes,adaptive_prediction_minutes,adaptive_ready,schedule_key,service_date',
    grade_hash: `eq.${gradeHash}`,
    observed_at: `gte.${cutoff}`,
    order: 'observed_at.asc',
  });
  const pageSize = 1000;

  for (let offset = 0; ; offset += pageSize) {
    const pageQuery = new URLSearchParams(query);
    pageQuery.set('limit', String(pageSize));
    pageQuery.set('offset', String(offset));
    const response = await supabaseRequest(
      `${supabaseUrl}/rest/v1/passage_observations?${pageQuery}`,
      serviceKey,
    );
    if (!response.ok) throw new Error(`Falha ao carregar observações (HTTP ${response.status}).`);
    const page = await response.json();
    observations.push(...page);
    if (page.length < pageSize) break;
  }

  return observations;
}

function createPredictions(schedule, observations, now) {
  const serviceDate = getServiceDate(now);
  const serviceDay = getServiceDay(now);
  const backtest = calculateBacktest(observations);
  const confirmedTrips = new Set(observations
    .filter((observation) => observation.service_date === serviceDate)
    .map((observation) => observation.schedule_key));
  const estimates = schedule.horarios.map((row) => {
    const scheduleKey = getScheduleKey(row);
    const departureTimestamp = getServiceDateTime(serviceDate, row.horario);
    const candidate = calculatePassageEstimate(observations, departureTimestamp);
    const adaptiveShown = backtest.released && candidate.ready;
    const p10 = adaptiveShown ? candidate.p10_minutes : PRIOR_P10_MINUTES;
    const p50 = adaptiveShown ? candidate.p50_minutes : PRIOR_MINUTES;
    const p90 = adaptiveShown ? candidate.p90_minutes : PRIOR_P90_MINUTES;
    const departureMinutes = Number(row.horario.slice(0, 2)) * 60 + Number(row.horario.slice(3, 5));
    const passageP50Minutes = departureMinutes + p50;
    const terminalMinutes = passageP50Minutes + 19;

    return {
      schedule_key: scheduleKey,
      service_date: serviceDate,
      mode: adaptiveShown ? 'adaptativa' : candidate.ready ? 'sombra' : 'prior',
      n: candidate.n,
      n_min: MIN_OBSERVATIONS,
      ready: candidate.ready,
      p10_minutes: p10,
      p50_minutes: p50,
      p90_minutes: p90,
      horario_parada_p10: formatTime(departureMinutes + p10),
      horario_parada: formatTime(passageP50Minutes),
      horario_parada_p90: formatTime(departureMinutes + p90),
      parada_dia_offset_p10: Number(departureMinutes + p10 >= 1440),
      parada_dia_offset: Number(passageP50Minutes >= 1440),
      parada_dia_offset_p90: Number(departureMinutes + p90 >= 1440),
      horario_terminal: formatTime(terminalMinutes),
      terminal_dia_offset: Number(terminalMinutes >= 1440),
      can_confirm: row.dias.includes(serviceDay) && !confirmedTrips.has(scheduleKey),
    };
  });

  return {
    grade_hash: schedule.grade_hash,
    service_date: serviceDate,
    time_zone: SERVICE_TIME_ZONE,
    mode: backtest.released ? 'adaptativa' : 'sombra',
    n_min: MIN_OBSERVATIONS,
    backtest,
    estimates,
  };
}

function validatePostBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || typeof body.grade_hash !== 'string' || !/^[a-f0-9]{64}$/.test(body.grade_hash)
    || typeof body.schedule_key !== 'string' || !/^[a-f0-9]{64}$/.test(body.schedule_key)
    || typeof body.service_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.service_date)) {
    return 'Informe a viagem e a versão da grade.';
  }
  return null;
}

export default async function handler(req, res) {
  responseHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return res.status(503).json({
      error: 'Confirmação temporariamente indisponível. O administrador precisa configurar o registro adaptativo.',
    });
  }

  try {
    if (req.method === 'GET') {
      const schedule = await loadSchedule(supabaseUrl, serviceKey);
      const observations = await loadObservations(supabaseUrl, serviceKey, schedule.grade_hash);
      res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=60');
      return res.status(200).json(createPredictions(schedule, observations, new Date()));
    }

    const invalidBody = validatePostBody(req.body);
    if (invalidBody) return res.status(400).json({ error: invalidBody });

    const schedule = await loadSchedule(supabaseUrl, serviceKey);
    if (req.body.grade_hash !== schedule.grade_hash) {
      return res.status(409).json({ error: 'A grade mudou. Atualize a página antes de confirmar.' });
    }

    const row = schedule.horarios.find(({ schedule_key }) => schedule_key === req.body.schedule_key);
    if (!row) return res.status(400).json({ error: 'Viagem não encontrada na grade atual.' });

    const now = new Date();
    if (req.body.service_date !== getServiceDate(now) || !row.dias.includes(getServiceDay(now))) {
      return res.status(409).json({ error: 'Esta viagem não está ativa hoje. Atualize a página.' });
    }

    const departureTimestamp = getServiceDateTime(req.body.service_date, row.horario);
    const elapsedMinutes = (now.getTime() - departureTimestamp) / 60_000;
    if (elapsedMinutes < 0 || elapsedMinutes > 120) {
      return res.status(400).json({ error: 'A confirmação só fica disponível após a saída e por até 2 horas.' });
    }

    const observations = await loadObservations(supabaseUrl, serviceKey, schedule.grade_hash);
    const snapshot = createObservationSnapshot(observations, departureTimestamp);
    const key = tripKey(schedule.grade_hash, req.body.schedule_key, req.body.service_date);
    const insert = await supabaseRequest(`${supabaseUrl}/rest/v1/passage_observations`, serviceKey, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        trip_key: key,
        grade_hash: schedule.grade_hash,
        schedule_key: req.body.schedule_key,
        service_date: req.body.service_date,
        scheduled_departure: snapshot.scheduled_departure,
        observed_at: now.toISOString(),
        travel_minutes: Number(elapsedMinutes.toFixed(2)),
        structural_prediction_minutes: snapshot.structural_prediction_minutes,
        prior_prediction_minutes: snapshot.prior_prediction_minutes,
        adaptive_prediction_minutes: snapshot.adaptive_prediction_minutes,
        adaptive_ready: snapshot.adaptive_ready,
      }),
    });

    if (insert.status === 409) {
      return res.status(409).json({ error: 'A passagem desta viagem já foi confirmada.' });
    }
    if (!insert.ok) {
      const details = await insert.text();
      throw new Error(`Falha ao salvar confirmação (HTTP ${insert.status}): ${details}`);
    }

    return res.status(201).json({ success: true, service_date: req.body.service_date });
  } catch (error) {
    console.error('Erro na API de precisão:', error);
    return res.status(500).json({ error: 'Não foi possível carregar ou registrar a precisão dos horários.' });
  }
}
