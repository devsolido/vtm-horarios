// ================================================================
//  CONTROLE DE MANUTENÇÃO (via API) – com exceção para o admin
// ================================================================
async function verificarManutencao() {
  // NÃO redireciona se estiver na página admin
  if (window.location.pathname.startsWith('/admin')) {
    console.log('🔵 Página admin – ignorando redirecionamento de manutenção.');
    return;
  }

  console.log('🔵 Verificando manutenção...');
  try {
    const res = await fetch('/api/manutencao');
    if (!res.ok) throw new Error('Erro ao verificar manutenção');
    const data = await res.json();
    console.log('🔵 Status da manutenção:', data);
    if (data.ativo) {
      console.log('🟢 Manutenção ATIVA – redirecionando...');
      localStorage.setItem('manutencao_ativa', 'true');
      window.location.href = '/manutencao.html';
    } else {
      console.log('🔵 Manutenção inativa.');
      localStorage.removeItem('manutencao_ativa');
    }
  } catch (e) {
    console.warn('⚠️ Erro ao verificar manutenção:', e);
    localStorage.removeItem('manutencao_ativa');
  }
}

// ================================================================
//  RATE LIMIT E SANITIZAÇÃO
// ================================================================
const rateLimit = (() => {
  const timestamps = {};
  return (action, limit = 3, windowMs = 5000) => {
    const now = performance.now();
    if (!timestamps[action]) timestamps[action] = [];
    timestamps[action] = timestamps[action].filter((t) => now - t < windowMs);
    if (timestamps[action].length >= limit) {
      console.warn('⛔ Rate limit excedido para:', action);
      return false;
    }
    timestamps[action].push(now);
    return true;
  };
})();

function sanitize(str) {
  if (!str) return '';
  const el = document.createElement('div');
  el.textContent = str;
  return el.innerHTML;
}

let weatherFetchInProgress = false;
let weatherCache = null;
let weatherCacheTime = 0;
const WEATHER_CACHE_TTL = 600000;

// ================================================================
//  VARIÁVEIS GLOBAIS
// ================================================================
let currentFilter = 'all';
let allHorarios = [];
let alertaDisparado = {};
let serverTimeAnchorMs = null;
let serverTimeAnchorPerformance = null;
let serverTimeSyncInProgress = false;
let filterWasManuallySelected = false;
let precisionFetchInProgress = false;
let precisionServiceDate = null;
const SERVICE_TIME_ZONE = 'America/Belem';
const SERVICE_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: SERVICE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});
const SERVICE_WEEKDAY_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: SERVICE_TIME_ZONE,
  weekday: 'short',
});

// ================================================================
//  TEMA – com verificação
// ================================================================
const themeToggle = document.getElementById('themeToggle');
const iconTheme = themeToggle ? themeToggle.querySelector('i') : null;

function setTheme(theme) {
  if (theme === 'light') {
    document.body.classList.add('light-mode');
    if (iconTheme) iconTheme.className = 'fas fa-sun';
    localStorage.setItem('vtm_theme', 'light');
  } else {
    document.body.classList.remove('light-mode');
    if (iconTheme) iconTheme.className = 'fas fa-moon';
    localStorage.setItem('vtm_theme', 'dark');
  }
}

function toggleTheme() {
  const current = document.body.classList.contains('light-mode') ? 'light' : 'dark';
  setTheme(current === 'light' ? 'dark' : 'light');
}

const savedTheme = localStorage.getItem('vtm_theme') || 'dark';
setTheme(savedTheme);

if (themeToggle) {
  themeToggle.addEventListener('click', toggleTheme);
}

// ================================================================
//  SERVICE WORKER
// ================================================================
if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('/sw.js')
    .then(() => console.log('✅ Service Worker registrado com sucesso.'))
    .catch((err) => console.warn('⚠️ SW falhou:', err));
}

// ================================================================
//  HORÁRIOS INICIAIS (fallback)
// ================================================================
const horariosFallback = [
  { destino: 'Terminal (chegada 06:10)', horario: '05:30', horario_parada: '05:43', horario_terminal: '06:02', parada_dia_offset: 0, terminal_dia_offset: 0, embarque: 'Bela Vista | C5 - Jardim União/Bela Vista', dias: ['Segunda a Sexta', 'Sábado', 'Domingo'] },
  { destino: 'Terminal (chegada 07:20)', horario: '05:50', horario_parada: '06:03', horario_terminal: '06:22', parada_dia_offset: 0, terminal_dia_offset: 0, embarque: 'Bela Vista | C5 - Jardim União/Bela Vista', dias: ['Segunda a Sexta', 'Sábado', 'Domingo'] },
  { destino: 'Terminal (chegada 08:40)', horario: '07:10', horario_parada: '07:23', horario_terminal: '07:42', parada_dia_offset: 0, terminal_dia_offset: 0, embarque: 'Bela Vista | C5 - Jardim União/Bela Vista', dias: ['Segunda a Sexta', 'Sábado', 'Domingo'] },
  { destino: 'Terminal (chegada 09:10)', horario: '07:40', horario_parada: '07:53', horario_terminal: '08:12', parada_dia_offset: 0, terminal_dia_offset: 0, embarque: 'Bela Vista | C5 - Jardim União/Bela Vista', dias: ['Segunda a Sexta', 'Sábado', 'Domingo'] },
  { destino: 'Terminal (chegada 10:40)', horario: '09:10', horario_parada: '09:23', horario_terminal: '09:42', parada_dia_offset: 0, terminal_dia_offset: 0, embarque: 'Bela Vista | C5 - Jardim União/Bela Vista', dias: ['Segunda a Sexta', 'Sábado', 'Domingo'] },
  { destino: 'Terminal (chegada 11:10)', horario: '09:40', horario_parada: '09:53', horario_terminal: '10:12', parada_dia_offset: 0, terminal_dia_offset: 0, embarque: 'Bela Vista | C5 - Jardim União/Bela Vista', dias: ['Segunda a Sexta', 'Sábado', 'Domingo'] },
  { destino: 'Terminal (chegada 12:40)', horario: '11:10', horario_parada: '11:23', horario_terminal: '11:42', parada_dia_offset: 0, terminal_dia_offset: 0, embarque: 'Bela Vista | C5 - Jardim União/Bela Vista', dias: ['Segunda a Sexta', 'Sábado', 'Domingo'] },
  { destino: 'Terminal (chegada 12:50)', horario: '11:20', horario_parada: '11:33', horario_terminal: '11:52', parada_dia_offset: 0, terminal_dia_offset: 0, embarque: 'Bela Vista | C5 - Jardim União/Bela Vista', dias: ['Segunda a Sexta', 'Sábado', 'Domingo'] },
  { destino: 'Terminal (chegada 14:40)', horario: '13:10', horario_parada: '13:23', horario_terminal: '13:42', parada_dia_offset: 0, terminal_dia_offset: 0, embarque: 'Bela Vista | C5 - Jardim União/Bela Vista', dias: ['Segunda a Sexta', 'Sábado', 'Domingo'] },
  { destino: 'Terminal (chegada 15:10)', horario: '13:40', horario_parada: '13:53', horario_terminal: '14:12', parada_dia_offset: 0, terminal_dia_offset: 0, embarque: 'Bela Vista | C5 - Jardim União/Bela Vista', dias: ['Segunda a Sexta', 'Sábado', 'Domingo'] },
  { destino: 'Terminal (chegada 16:40)', horario: '15:10', horario_parada: '15:23', horario_terminal: '15:42', parada_dia_offset: 0, terminal_dia_offset: 0, embarque: 'Bela Vista | C5 - Jardim União/Bela Vista', dias: ['Segunda a Sexta', 'Sábado', 'Domingo'] },
  { destino: 'Terminal (chegada 17:10)', horario: '15:40', horario_parada: '15:53', horario_terminal: '16:12', parada_dia_offset: 0, terminal_dia_offset: 0, embarque: 'Bela Vista | C5 - Jardim União/Bela Vista', dias: ['Segunda a Sexta', 'Sábado', 'Domingo'] },
  { destino: 'Terminal (chegada 18:20)', horario: '16:50', horario_parada: '17:03', horario_terminal: '17:22', parada_dia_offset: 0, terminal_dia_offset: 0, embarque: 'Bela Vista | C5 - Jardim União/Bela Vista', dias: ['Segunda a Sexta', 'Sábado', 'Domingo'] },
  { destino: 'Terminal (chegada 19:10)', horario: '17:40', horario_parada: '17:53', horario_terminal: '18:12', parada_dia_offset: 0, terminal_dia_offset: 0, embarque: 'Bela Vista | C5 - Jardim União/Bela Vista', dias: ['Segunda a Sexta', 'Sábado', 'Domingo'] },
  { destino: 'Terminal (chegada 20:30)', horario: '19:00', horario_parada: '19:13', horario_terminal: '19:32', parada_dia_offset: 0, terminal_dia_offset: 0, embarque: 'Bela Vista | C5 - Jardim União/Bela Vista', dias: ['Segunda a Sexta', 'Sábado', 'Domingo'] },
  { destino: 'Terminal (chegada 21:30)', horario: '20:00', horario_parada: '20:13', horario_terminal: '20:32', parada_dia_offset: 0, terminal_dia_offset: 0, embarque: 'Bela Vista | C5 - Jardim União/Bela Vista', dias: ['Segunda a Sexta', 'Sábado', 'Domingo'] },
  { destino: 'Terminal (chegada 22:30)', horario: '21:00', horario_parada: '21:13', horario_terminal: '21:32', parada_dia_offset: 0, terminal_dia_offset: 0, embarque: 'Bela Vista | C5 - Jardim União/Bela Vista', dias: ['Segunda a Sexta', 'Sábado', 'Domingo'] },
  { destino: 'Terminal (chegada 23:30)', horario: '22:40', horario_parada: '22:53', horario_terminal: '23:12', parada_dia_offset: 0, terminal_dia_offset: 0, embarque: 'Bela Vista | C5 - Jardim União/Bela Vista', dias: ['Segunda a Sexta', 'Sábado', 'Domingo'] },
];
horariosFallback.sort((a, b) => a.horario.localeCompare(b.horario));

// ================================================================
//  DOM REFS (com verificação para páginas que não têm esses elementos)
// ================================================================
const container = document.getElementById('cardsContainer');
const alertModal = document.getElementById('alertModal');
const alertMessage = document.getElementById('alertMessage');
const alertSubMsg = document.getElementById('alertSubMsg');
const closeAlertBtn = document.getElementById('closeAlertBtn');
const filterIndicator = document.getElementById('filterIndicator');
const precisionStatus = document.getElementById('precisionStatus');

// ================================================================
//  UTILITÁRIOS
// ================================================================
function getCurrentDay(date) {
  const days = [
    'Domingo', 'Segunda a Sexta', 'Segunda a Sexta',
    'Segunda a Sexta', 'Segunda a Sexta', 'Segunda a Sexta',
    'Sábado'
  ];
  const now = date ? null : getServerNow();
  if (!date && !now) return null;
  const weekday = date ? null : SERVICE_WEEKDAY_FORMATTER.format(now);
  const weekdayIndex = date
    ? date.getUTCDay()
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday);
  return days[weekdayIndex];
}

function getServerNow() {
  if (serverTimeAnchorMs === null || serverTimeAnchorPerformance === null) return null;
  return new Date(serverTimeAnchorMs + performance.now() - serverTimeAnchorPerformance);
}

function getServiceDateParts(date) {
  if (!date) return null;
  const parts = SERVICE_DATE_FORMATTER.formatToParts(date);
  return Object.fromEntries(parts
    .filter(({ type }) => type !== 'literal')
    .map(({ type, value }) => [type, Number(value)]));
}

function getCurrentServiceDate() {
  const parts = getServiceDateParts(getServerNow());
  return parts
    ? `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
    : null;
}

function addCalendarDays(year, month, day, offset) {
  const date = new Date(Date.UTC(year, month - 1, day + offset));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    weekday: date.getUTCDay(),
  };
}

async function synchronizeServerTime() {
  if (serverTimeSyncInProgress) return;
  serverTimeSyncInProgress = true;
  const requestStartedAt = performance.now();

  try {
    const res = await fetch('/api/time', { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const serverTimestamp = Date.parse(data?.server_time);
    if (!Number.isFinite(serverTimestamp) || data?.time_zone !== SERVICE_TIME_ZONE) {
      throw new Error('Resposta inválida da API de hora do servidor.');
    }

    const responseReceivedAt = performance.now();
    serverTimeAnchorMs = serverTimestamp;
    serverTimeAnchorPerformance = (requestStartedAt + responseReceivedAt) / 2;
    updateClock();
    updateDateAndGreeting();
    if (document.body.dataset.gradeHash
      && precisionServiceDate !== getCurrentServiceDate()) {
      await carregarPrecisaoHorarios(document.body.dataset.gradeHash);
    }
    if (!filterWasManuallySelected) applyDefaultFilter();
    renderCards();
  } catch (error) {
    console.error('Erro ao sincronizar a hora do servidor:', error);
    updateClock();
    updateDateAndGreeting();
    renderCards();
  } finally {
    serverTimeSyncInProgress = false;
  }
}

function getDiaLabel(dia) {
  const map = {
    'Segunda a Sexta': 'dias úteis',
    Sábado: 'sábados',
    Domingo: 'domingos',
  };
  return map[dia] || dia;
}

function getMinutesFromTime(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function getCurrentMinutes() {
  const parts = getServiceDateParts(getServerNow());
  return parts ? parts.hour * 60 + parts.minute : null;
}

function getBusMovementStatus() {
  if (allHorarios.length === 0) return null;

  const now = getServiceDateParts(getServerNow());
  if (!now) return null;
  const currentMinutes = now.hour * 60 + now.minute;
  const trips = [];

  for (let dayOffset = -1; dayOffset < 9; dayOffset++) {
    const serviceDate = addCalendarDays(now.year, now.month, now.day, dayOffset);
    const serviceDay = getCurrentDay(new Date(Date.UTC(serviceDate.year, serviceDate.month - 1, serviceDate.day)));

    allHorarios.forEach((horario) => {
      if (!horario.dias.includes(serviceDay)) return;

      const departureMinutes = dayOffset * 1440 + getMinutesFromTime(horario.horario);
      const stopDayOffset = dayOffset + horario.parada_dia_offset;
      const terminalDayOffset = dayOffset + horario.terminal_dia_offset;
      trips.push({
        departure: horario.horario,
        departureMinutes,
        stopPassageMinutes: stopDayOffset * 1440 + getMinutesFromTime(horario.horario_parada),
        stopPassageP10Minutes: horario.passage_prediction
          ? dayOffset * 1440
            + getMinutesFromTime(horario.passage_prediction.horario_parada_p10)
            + horario.passage_prediction.parada_dia_offset_p10 * 1440
          : departureMinutes + 8,
        stopPassageP90Minutes: horario.passage_prediction
          ? dayOffset * 1440
            + getMinutesFromTime(horario.passage_prediction.horario_parada_p90)
            + horario.passage_prediction.parada_dia_offset_p90 * 1440
          : departureMinutes + 18,
        terminalArrivalMinutes: terminalDayOffset * 1440 + getMinutesFromTime(horario.horario_terminal),
      });
    });
  }

  const outboundTrips = trips
    .filter((trip) => trip.departureMinutes <= currentMinutes && trip.stopPassageMinutes > currentMinutes)
    .sort((a, b) => a.stopPassageMinutes - b.stopPassageMinutes);
  const returningTrips = trips
    .filter((trip) => trip.stopPassageMinutes <= currentMinutes && trip.terminalArrivalMinutes > currentMinutes)
    .sort((a, b) => a.terminalArrivalMinutes - b.terminalArrivalMinutes);
  const nextDeparture = trips
    .filter((trip) => trip.departureMinutes > currentMinutes)
    .sort((a, b) => a.departureMinutes - b.departureMinutes)[0] || null;

  return { outboundTrips, returningTrips, nextDeparture };
}

function formatClockTime(totalMinutes) {
  const minutesOfDay = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = String(Math.floor(minutesOfDay / 60)).padStart(2, '0');
  const minutes = String(minutesOfDay % 60).padStart(2, '0');
  return hours + ':' + minutes;
}

function formatRoutePassageTime(totalMinutes) {
  const dayOffset = Math.floor(totalMinutes / 1440);
  const minutesOfDay = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = String(Math.floor(minutesOfDay / 60)).padStart(2, '0');
  const minutes = String(minutesOfDay % 60).padStart(2, '0');
  const now = getServiceDateParts(getServerNow());
  if (!now) return '--';
  const date = addCalendarDays(now.year, now.month, now.day, dayOffset);
  const dateForLabel = new Date(Date.UTC(date.year, date.month - 1, date.day));
  const dayLabel =
    dayOffset === 0
      ? 'hoje'
      : dayOffset === 1
        ? 'amanhã'
        : dayOffset === -1
          ? 'ontem'
          : dateForLabel.toLocaleDateString('pt-BR', {
            timeZone: 'UTC',
            weekday: 'short',
            day: '2-digit',
            month: '2-digit',
          });

  return dayLabel + ' às ' + hours + ':' + minutes;
}

function formatDateFull(d) {
  return d
    .toLocaleDateString('pt-BR', {
      timeZone: SERVICE_TIME_ZONE,
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    .replace(/^(\d+)\s+de\s+(\w+)/, (_, day, month) => day + ' de ' + month.charAt(0).toUpperCase() + month.slice(1));
}

function speak(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(sanitize(text));
  utter.lang = 'pt-BR';
  utter.rate = 0.9;
  utter.pitch = 1.0;
  const voices = window.speechSynthesis.getVoices();
  const brVoice = voices.find((v) => v.lang === 'pt-BR');
  if (brVoice) utter.voice = brVoice;
  window.speechSynthesis.speak(utter);
}

function playBeep() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 880;
    gainNode.gain.value = 0.3;
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start();
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
    oscillator.stop(audioCtx.currentTime + 0.2);
    setTimeout(() => audioCtx.close(), 300);
  } catch (e) {
    console.warn('Erro ao tocar beep:', e);
  }
}

// ================================================================
//  RELÓGIO, DATA, SAUDAÇÃO
// ================================================================
function updateClock() {
  const parts = getServiceDateParts(getServerNow());
  const timeStr =
    String(parts?.hour ?? '--').padStart(2, '0') +
    ':' +
    String(parts?.minute ?? '--').padStart(2, '0') +
    ':' +
    String(parts?.second ?? '--').padStart(2, '0');

  const clockEl = document.getElementById('clockValue');
  if (clockEl) clockEl.textContent = timeStr;

  const adminClock = document.getElementById('adminClockValue');
  if (adminClock) adminClock.textContent = timeStr;
}

function updateDateAndGreeting() {
  const n = getServerNow();
  const dateStr = n ? formatDateFull(n) : 'Hora do servidor indisponível';

  const dateEl = document.getElementById('fullDate');
  if (dateEl) dateEl.textContent = dateStr;

  const adminDate = document.getElementById('adminDateValue');
  if (adminDate) adminDate.textContent = dateStr;

  const hour = getServiceDateParts(n)?.hour;
  const g = hour === undefined ? 'Horário indisponível' : hour < 12 ? 'Bom dia!' : hour < 18 ? 'Boa tarde!' : 'Boa noite!';
  const greetingEl = document.getElementById('greetingValue');
  if (greetingEl) greetingEl.textContent = g;
}

// ================================================================
//  CLIMA (proxy local) – funciona na página principal e no admin
// ================================================================
async function fetchWeather() {
  const el = document.getElementById('weatherValue');
  const adminEl = document.getElementById('adminWeatherValue');

  if (!el && !adminEl) return;

  const now = performance.now();

  if (weatherCache && now - weatherCacheTime < WEATHER_CACHE_TTL) {
    if (el) el.textContent = weatherCache;
    if (adminEl) adminEl.textContent = weatherCache;
    return;
  }

  if (weatherFetchInProgress) return;
  weatherFetchInProgress = true;

  if (el) el.textContent = '⏳ Carregando...';
  if (adminEl) adminEl.textContent = '⏳ Carregando...';

  try {
    const res = await fetch('/api/weather');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (!data || data.temp === undefined) throw new Error('Dados incompletos');

    const temp = Math.round(data.temp);
    const slug = data.condition_slug || '';
    const emojiMap = {
      clear_day: '☀️',
      clear_night: '🌙',
      cloud: '☁️',
      cloudly_day: '⛅',
      cloudly_night: '☁️',
      rain: '🌧️',
      storm: '⛈️',
      snow: '❄️',
      fog: '🌫️'
    };
    const emoji = emojiMap[slug] || '🌤️';
    const result = `${emoji} ${temp} °C`;

    weatherCache = result;
    weatherCacheTime = now;

    if (el) el.textContent = result;
    if (adminEl) adminEl.textContent = result;
  } catch (e) {
    console.warn('Clima:', e);
    if (el) el.textContent = '⚠️ Sem dados';
    if (adminEl) adminEl.textContent = '⚠️ Sem dados';
  } finally {
    weatherFetchInProgress = false;
  }
}

// ================================================================
//  API DE HORÁRIOS (SUPABASE)
// ================================================================
async function carregarHorariosDoBanco() {
  try {
    const res = await fetch('/api/horarios');
    if (!res.ok) throw new Error('Erro ao carregar horários: ' + res.status);
    const data = await res.json();
    if (!data || !Array.isArray(data.horarios) || typeof data.grade_hash !== 'string') {
      throw new Error('Resposta da API de horários inválida.');
    }

    allHorarios = data.horarios.map(({ id, created_at, ...rest }) => ({
      ...rest,
    }));
    document.body.dataset.gradeHash = data.grade_hash;
    allHorarios.sort((a, b) => a.horario.localeCompare(b.horario));
    await carregarPrecisaoHorarios(data.grade_hash);
    renderCards();

    const adminContent = document.getElementById('adminContent');
    if (adminContent && adminContent.style.display === 'block') {
      loadAdminTable();
    }
  } catch (e) {
    console.error('Erro ao carregar horários do banco:', e);
    if (allHorarios.length === 0) {
      allHorarios = [...horariosFallback];
      delete document.body.dataset.gradeHash;
      renderCards();
    }
  }
}

async function carregarPrecisaoHorarios(gradeHash) {
  if (precisionFetchInProgress) return;
  precisionFetchInProgress = true;
  try {
    const response = await fetch('/api/precision');
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const data = await response.json();
    if (data?.grade_hash !== gradeHash || data.time_zone !== SERVICE_TIME_ZONE
      || !Array.isArray(data.estimates)
      || typeof data.service_date !== 'string') {
      throw new Error('Resposta de precisão inválida ou referente a outra grade.');
    }

    precisionServiceDate = data.service_date;
    const estimates = new Map(data.estimates.map((estimate) => [estimate.schedule_key, estimate]));
    allHorarios = allHorarios.map((horario) => {
      const prediction = estimates.get(horario.schedule_key);
      if (!prediction) return horario;
      return {
        ...horario,
        horario_parada: prediction.horario_parada,
        parada_dia_offset: prediction.parada_dia_offset,
        horario_terminal: prediction.horario_terminal,
        terminal_dia_offset: prediction.terminal_dia_offset,
        passage_prediction: prediction,
      };
    });
    document.body.dataset.precisionMode = data.mode;
    document.body.dataset.precisionBacktest = String(data.backtest.evaluated);
    if (precisionStatus) {
      precisionStatus.textContent = data.mode === 'adaptativa'
        ? `Estimativa adaptativa validada: MAE ${data.backtest.adaptive_mae} min, contra ${data.backtest.prior_mae} min do prior, em ${data.backtest.evaluated} previsões.`
        : `Exibindo o prior; modo sombra avaliado em ${data.backtest.evaluated}/${data.backtest.required} previsões. A adaptação longa exige ${data.n_min} confirmações na faixa horária.`;
    }
  } catch (error) {
    precisionServiceDate = null;
    delete document.body.dataset.precisionMode;
    console.error('Erro ao carregar estimativas adaptativas:', error);
    if (precisionStatus) {
      precisionStatus.textContent = 'Dados adaptativos indisponíveis; exibindo o prior. Tente novamente mais tarde.';
    }
  } finally {
    precisionFetchInProgress = false;
  }
}

function formatPassageRange(horario, prediction) {
  if (!prediction) {
    const departure = getMinutesFromTime(horario);
    return `${formatClockTime(departure + 8)}–${formatClockTime(departure + 18)}`;
  }
  return `${prediction.horario_parada_p10}–${prediction.horario_parada_p90}`;
}

function getPassageModeLabel(prediction) {
  if (!prediction) return 'prior';
  if (prediction.mode === 'prior') return `prior · ${prediction.n}/${prediction.n_min} confirmações`;
  if (prediction.mode === 'sombra') return `prior · modo sombra · ${prediction.n} observações`;
  return `adaptativa · ${prediction.n} observações`;
}

function canConfirmPassage(horario, prediction, nowMinutes) {
  const serviceDate = getCurrentServiceDate();
  if (!serviceDate || !document.body.dataset.gradeHash || !horario.schedule_key
    || !horario.dias.includes(getCurrentDay())) return false;
  if (prediction && !prediction.can_confirm) return false;
  const tripKey = `${document.body.dataset.gradeHash}|${horario.schedule_key}|${serviceDate}`;
  if (confirmedPassageTrips.has(tripKey)) return false;
  const departureMinutes = getMinutesFromTime(horario.horario);
  const elapsed = nowMinutes - departureMinutes;
  return elapsed >= 0 && elapsed <= 120;
}

const confirmedPassageTrips = new Set();

async function handlePassageConfirmation(event) {
  const button = event.currentTarget;
  button.disabled = true;
  button.textContent = 'Registrando…';

  try {
    const response = await fetch('/api/precision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grade_hash: document.body.dataset.gradeHash,
        schedule_key: button.dataset.scheduleKey,
        service_date: button.dataset.serviceDate,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(data.error || `HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    confirmedPassageTrips.add(
      `${document.body.dataset.gradeHash}|${button.dataset.scheduleKey}|${button.dataset.serviceDate}`,
    );
    await carregarPrecisaoHorarios(document.body.dataset.gradeHash);
    renderCards();
    alert('Obrigado! Confirmação registrada para esta viagem.');
  } catch (error) {
    console.error('Erro ao registrar passagem:', error);
    if (error.status === 409) {
      await carregarPrecisaoHorarios(document.body.dataset.gradeHash);
      renderCards();
    } else {
      button.disabled = false;
      button.innerHTML = '<i class="fas fa-check"></i> Confirmar passagem';
    }
    alert(error.message || 'Não foi possível registrar a confirmação. Tente novamente.');
  }
}

// ================================================================
//  RENDER CARDS
// ================================================================
function renderCards() {
  if (!container) return;

  const nowMin = getCurrentMinutes();
  const diaAtual = getCurrentDay();
  if (nowMin === null || diaAtual === null) {
    container.innerHTML = '<div class="empty">Hora do servidor indisponível. Tente novamente.</div>';
    renderBusStatus();
    return;
  }

  if (filterIndicator) {
    filterIndicator.textContent = 'Filtro: ' + (currentFilter === 'all' ? 'Todos' : currentFilter);
  }

  const filtered =
    currentFilter === 'all'
      ? [...allHorarios]
      : allHorarios.filter((h) => h.dias.includes(currentFilter));

  const futurosTodos = filtered
    .filter((h) => getMinutesFromTime(h.horario) >= nowMin)
    .sort((a, b) => a.horario.localeCompare(b.horario));
  const passadosTodos = filtered
    .filter((h) => getMinutesFromTime(h.horario) < nowMin)
    .sort((a, b) => a.horario.localeCompare(b.horario));

  const sorted = [...futurosTodos, ...passadosTodos];

  if (sorted.length === 0) {
    container.innerHTML = '<div class="empty"><i class="far fa-calendar-times"></i> Nenhum horário para este dia.</div>';
  } else {
    let html = '';
    sorted.forEach((h, idx) => {
      const departureMinutes = getMinutesFromTime(h.horario);
      const departurePassed = departureMinutes < nowMin;
      const terminalArrivalMinutes =
        getMinutesFromTime(h.horario_terminal) + h.terminal_dia_offset * 1440;
      const passed = departurePassed && terminalArrivalMinutes < nowMin;
      const operaHoje = h.dias.includes(diaAtual);
      const isOutroDia = currentFilter === 'all' && !operaHoje;
      let isNext = false;
      if (currentFilter === 'all') {
        isNext = idx === 0 && !departurePassed && operaHoje;
      } else {
        isNext = idx === 0 && !departurePassed;
      }
      const cls =
        'card' +
        (passed ? ' passed' : '') +
        (isNext ? ' next' : '') +
        (isOutroDia ? ' outro-dia' : '');
      const prediction = h.passage_prediction;
      const terminalArrivalTime = h.horario_terminal;
      const passageRange = formatPassageRange(h.horario, prediction);
      const passageLabel = getPassageModeLabel(prediction);
      const confirmButton = canConfirmPassage(h, prediction, nowMin)
        ? '<button class="passage-confirm-button" data-schedule-key="' + h.schedule_key +
          '" data-service-date="' + getCurrentServiceDate() +
          '" title="Confirme somente no momento em que o ônibus passar pela parada"' +
          '><i class="fas fa-check"></i> Confirmar passagem</button>'
        : '';

      let diaBadge = '';
      if (isOutroDia) {
        const dia = h.dias[0];
        const label = getDiaLabel(dia);
        diaBadge = '<div class="dia-badge"><i class="fas fa-calendar-day"></i> Apenas ' + label + '</div>';
      }

      html +=
        '<div class="' +
        cls +
        '" style="animation-delay:' +
        idx * 0.04 +
        's">' +
        '<div class="destino"><i class="fas fa-map-pin"></i> C5 · Jardim União/Bela Vista' +
        '</div>' +
        '<div class="horario-label">Saída do Terminal</div>' +
        '<div class="horario">' +
        sanitize(h.horario) +
        '</div>' +
        '<div class="embarque"><i class="fas fa-location-dot"></i> ' +
        'Parada Bela Vista ' + passageRange + ' (' + passageLabel + ')' +
        ' · Terminal ≈ ' + terminalArrivalTime +
        '</div>' +
        '<div class="dias">' +
        h.dias.map((d) => '<span>' + sanitize(d) + '</span>').join('') +
        '</div>' +
        diaBadge +
        confirmButton +
        '<button class="share-btn" data-destino="Bela Vista" data-embarque="Terminal" data-parada="' +
        passageRange +
        '" data-horario="' +
        sanitize(h.horario) +
        '" data-terminal-chegada="' +
        terminalArrivalTime +
        '" title="Compartilhar"><i class="fas fa-share-alt"></i></button>' +
        '</div>';
    });
    container.innerHTML = html;

    document.querySelectorAll('.share-btn').forEach((btn) => {
      btn.removeEventListener('click', handleShare);
      btn.addEventListener('click', handleShare);
    });
    document.querySelectorAll('.passage-confirm-button').forEach((btn) => {
      btn.addEventListener('click', handlePassageConfirmation);
    });
  }

  renderBusStatus();
}

function renderBusStatus() {
  const statusContainer = document.getElementById('busStatus');
  if (!statusContainer) return;

  if (!getServerNow()) {
    statusContainer.innerHTML =
      '<div class="bus-status-item bus-status-item--empty"><span class="bus-status-badge">HORA INDISPONÍVEL</span>' +
      '<p>Não foi possível obter a hora do servidor para calcular a situação da viagem.</p></div>';
    return;
  }

  const status = getBusMovementStatus();
  if (!status) {
    statusContainer.innerHTML =
      '<div class="bus-status-item bus-status-item--empty"><span class="bus-status-badge">SEM PREVISÃO</span>' +
      '<p>Não há horários cadastrados para esta linha.</p></div>';
    return;
  }

  const items = [];
  status.outboundTrips.forEach((trip) => {
    items.push(
      '<div class="bus-status-item bus-status-item--outbound">' +
      '<div class="bus-status-heading"><span class="bus-status-badge">EM ROTA PARA A PARADA</span>' +
      '<strong>Terminal → Bela Vista</strong></div>' +
      '<p>Saída do Terminal às ' + formatRoutePassageTime(trip.departureMinutes) +
      '. Vá à parada Bela Vista; janela estimada de passagem entre ' +
      formatRoutePassageTime(trip.stopPassageP10Minutes) + ' e ' +
      formatRoutePassageTime(trip.stopPassageP90Minutes) + '.</p>' +
      '</div>'
    );
  });

  status.returningTrips.forEach((trip) => {
    items.push(
      '<div class="bus-status-item bus-status-item--returning">' +
      '<div class="bus-status-heading"><span class="bus-status-badge">PASSOU NA PARADA · EM ROTA AO TERMINAL</span>' +
      '<strong>Bela Vista → Terminal</strong></div>' +
      '<p>Passagem em Bela Vista entre ' + formatRoutePassageTime(trip.stopPassageP10Minutes) +
      ' e ' + formatRoutePassageTime(trip.stopPassageP90Minutes) +
      '. Chegada estimada ao Terminal às ' + formatRoutePassageTime(trip.terminalArrivalMinutes) + '.</p>' +
      '</div>'
    );
  });

  if (items.length === 0) {
    const nextDeparture = status.nextDeparture;
    const detail = nextDeparture
      ? 'Próxima saída do Terminal: ' + formatRoutePassageTime(nextDeparture.departureMinutes) +
        '. O ônibus aguarda no Terminal.'
      : 'Não há próxima saída prevista na grade cadastrada.';
    items.push(
      '<div class="bus-status-item bus-status-item--terminal">' +
      '<div class="bus-status-heading"><span class="bus-status-badge">NO TERMINAL</span>' +
      '<strong>Aguardando saída</strong></div>' +
      '<p>' + detail + '</p></div>'
    );
  }

  statusContainer.innerHTML = items.join('');
}

function handleShare(e) {
  e.stopPropagation();
  const btn = e.currentTarget;
  const destino = btn.dataset.destino;
  const horario = btn.dataset.horario;
  const embarque = btn.dataset.embarque;
  const parada = btn.dataset.parada;
  const terminalChegada = btn.dataset.terminalChegada;
  const msg =
    '🚌 Linha C5 - Jardim União/Bela Vista: saída do ' + embarque + ' às ' + horario +
    '; parada ' + destino + ' por volta de ' + parada +
    '; retorno ao Terminal estimado às ' + terminalChegada + '. Emitido via Help Que Horas Passa';

  if (!rateLimit('share', 3, 10000)) {
    alert('Aguarde alguns segundos antes de compartilhar novamente.');
    return;
  }

  if (navigator.share) {
    navigator.share({ title: 'Que Horas Passa - Horário', text: msg }).catch(() => {});
  } else {
    const url = 'https://api.whatsapp.com/send?text=' + encodeURIComponent(msg);
    window.open(url, '_blank');
  }
}

// ================================================================
//  VERIFICAÇÃO DE ALERTAS
// ================================================================
function verificarAlertas() {
  const agora = getCurrentMinutes();
  if (agora === null) return;
  const filtered =
    currentFilter === 'all'
      ? [...allHorarios]
      : allHorarios.filter((h) => h.dias.includes(currentFilter));
  const futuros = filtered
    .filter((h) => getMinutesFromTime(h.horario) >= agora)
    .sort((a, b) => a.horario.localeCompare(b.horario));

  if (futuros.length === 0) return;

  const proximo = futuros[0];
  const hm = getMinutesFromTime(proximo.horario);
  const diff = hm - agora;
  const key = proximo.destino + '|' + proximo.horario;

  if (alertaDisparado[key]) return;

  if (diff <= 30 && diff >= -2) {
    alertaDisparado[key] = true;
    const minutos = Math.round(diff);

    playBeep();

    if (alertMessage) {
      alertMessage.innerHTML =
        '📢 <strong>Atenção!</strong> Faltam <strong>' +
        minutos +
        ' minutos</strong> para o <strong>"' +
        sanitize(proximo.destino) +
        '"</strong> passar na parada <strong>' +
        sanitize(proximo.embarque) +
        '</strong>.';
    }
    if (alertSubMsg) {
      alertSubMsg.textContent =
        '⏰ Alerta às ' +
        getServerNow().toLocaleTimeString('pt-BR', { timeZone: SERVICE_TIME_ZONE }) +
        ' - ' +
        proximo.destino +
        ' às ' +
        proximo.horario;
    }
    if (alertModal) {
      alertModal.classList.add('active');
      alertModal.dataset.gradeHash = document.body.dataset.gradeHash || '';
    }

    const msg =
      'Olá! Faltam ' +
      minutos +
      ' minutos para o ônibus da linha ' +
      proximo.destino +
      ' passar na parada ' +
      proximo.embarque +
      '. Programa-se!';
    speak(msg);
  }
}

// ================================================================
//  FILTROS
// ================================================================
function initFilters() {
  const btns = document.querySelectorAll('.filter-btn');
  if (!btns || btns.length === 0) {
    console.log('🔍 Filtros não encontrados (página admin?) – ignorando.');
    return;
  }

  applyDefaultFilter();
  btns.forEach((btn) => {
    btn.addEventListener('click', function (e) {
      if (!rateLimit('filter-click', 2, 2000)) return;
      filterWasManuallySelected = true;
      btns.forEach((b) => b.classList.remove('active'));
      this.classList.add('active');
      currentFilter = this.dataset.filter;
      renderCards();
    });
  });
}

function applyDefaultFilter() {
  const btns = document.querySelectorAll('.filter-btn');
  if (!btns || btns.length === 0) return;
  const hoje = getCurrentDay();
  if (!hoje) {
    currentFilter = 'all';
    const allBtn = document.querySelector('.filter-btn[data-filter="all"]');
    if (allBtn) allBtn.classList.add('active');
    return;
  }

  btns.forEach((btn) => btn.classList.remove('active'));
  let found = false;
  btns.forEach((btn) => {
    if (btn.dataset.filter === hoje) {
      btn.classList.add('active');
      currentFilter = hoje;
      found = true;
    }
  });
  if (!found) {
    const allBtn = document.querySelector('.filter-btn[data-filter="all"]');
    if (allBtn) allBtn.classList.add('active');
    currentFilter = 'all';
  }

}

// ================================================================
//  FUNÇÕES COMPARTILHADAS DO ADMIN
// ================================================================
function showAdminMsg(text, type = 'info') {
  const msgDiv = document.getElementById('adminMsg');
  if (!msgDiv) return;
  msgDiv.textContent = text;
  msgDiv.className = 'admin-msg ' + type;
  msgDiv.style.display = 'block';
  clearTimeout(msgDiv._timer);
  msgDiv._timer = setTimeout(() => {
    msgDiv.style.display = 'none';
  }, 4000);
}

function loadAdminTable() {
  const tbody = document.getElementById('adminTableBody');
  if (!tbody) {
    console.error('❌ adminTableBody não encontrado no DOM');
    return;
  }

  tbody.innerHTML = '';

  if (!allHorarios || allHorarios.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text-muted);">Nenhum horário cadastrado.</td></tr>';
    const rowCount = document.getElementById('adminRowCount');
    if (rowCount) rowCount.textContent = '0 horários';
    return;
  }

  allHorarios.forEach((h, idx) => {
    const tr = document.createElement('tr');
    tr.dataset.idx = idx;

    const tdDestino = document.createElement('td');
    const inpDestino = document.createElement('input');
    inpDestino.type = 'text';
    inpDestino.className = 'admin-input';
    inpDestino.value = h.destino || '';
    inpDestino.readOnly = true;
    inpDestino.dataset.field = 'destino';
    tdDestino.appendChild(inpDestino);
    tr.appendChild(tdDestino);

    const tdHorario = document.createElement('td');
    const inpHorario = document.createElement('input');
    inpHorario.type = 'time';
    inpHorario.className = 'admin-input';
    inpHorario.value = h.horario || '';
    inpHorario.readOnly = true;
    inpHorario.dataset.field = 'horario';
    tdHorario.appendChild(inpHorario);
    tr.appendChild(tdHorario);

    const tdEmbarque = document.createElement('td');
    const inpEmbarque = document.createElement('input');
    inpEmbarque.type = 'text';
    inpEmbarque.className = 'admin-input';
    inpEmbarque.value = h.embarque || '';
    inpEmbarque.readOnly = true;
    inpEmbarque.dataset.field = 'embarque';
    tdEmbarque.appendChild(inpEmbarque);
    tr.appendChild(tdEmbarque);

    const tdDias = document.createElement('td');
    const divDias = document.createElement('div');
    divDias.className = 'dias-checkboxes';
    const diasOptions = ['Segunda a Sexta', 'Sábado', 'Domingo'];
    diasOptions.forEach((dia) => {
      const label = document.createElement('label');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = dia;
      cb.checked = (h.dias || []).includes(dia);
      cb.disabled = true;
      cb.dataset.field = 'dias';
      label.appendChild(cb);
      label.appendChild(document.createTextNode(dia.replace(' a ', '-')));
      divDias.appendChild(label);
    });
    tdDias.appendChild(divDias);
    tr.appendChild(tdDias);

    const tdAcoes = document.createElement('td');
    const btnEdit = document.createElement('button');
    btnEdit.className = 'btn-action';
    btnEdit.innerHTML = '<i class="fas fa-edit"></i>';
    btnEdit.title = 'Editar';
    btnEdit.dataset.idx = idx;
    btnEdit.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleEditRow(idx);
    });

    const btnDelete = document.createElement('button');
    btnDelete.className = 'btn-action danger';
    btnDelete.innerHTML = '<i class="fas fa-trash-alt"></i>';
    btnDelete.title = 'Excluir';
    btnDelete.dataset.idx = idx;
    btnDelete.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('Tem certeza que deseja excluir este horário?')) {
        allHorarios.splice(idx, 1);
        loadAdminTable();
        showAdminMsg('Horário removido com sucesso.', 'info');
        salvarHorariosNoBanco();
      }
    });

    tdAcoes.appendChild(btnEdit);
    tdAcoes.appendChild(btnDelete);
    tr.appendChild(tdAcoes);

    tbody.appendChild(tr);
  });

  const rowCount = document.getElementById('adminRowCount');
  if (rowCount) rowCount.textContent = allHorarios.length + ' horários';
}

function toggleEditRow(idx) {
  const tr = document.querySelector('#adminTableBody tr[data-idx="' + idx + '"]');
  if (!tr) return;
  const inputs = tr.querySelectorAll('.admin-input');
  const checkboxes = tr.querySelectorAll('.dias-checkboxes input[type="checkbox"]');
  const btnEdit = tr.querySelector('.btn-action:first-child');

  const isEditing = !inputs[0].readOnly;

  if (isEditing) {
    const destino = inputs[0].value.trim();
    const horario = inputs[1].value.trim();
    const embarque = inputs[2].value.trim();
    const selectedDias = [];
    checkboxes.forEach((cb) => {
      if (cb.checked) selectedDias.push(cb.value);
    });

    if (!destino || !horario || !embarque || selectedDias.length === 0) {
      showAdminMsg('Preencha todos os campos e selecione pelo menos um dia.', 'error');
      return;
    }
    if (!/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(horario)) {
      showAdminMsg('Horário inválido (use HH:MM).', 'error');
      return;
    }

    allHorarios[idx].destino = destino;
    allHorarios[idx].horario = horario;
    allHorarios[idx].embarque = embarque;
    allHorarios[idx].dias = selectedDias;

    loadAdminTable();
    showAdminMsg('Horário atualizado com sucesso!', 'success');
    salvarHorariosNoBanco();
  } else {
    inputs.forEach((inp) => (inp.readOnly = false));
    checkboxes.forEach((cb) => (cb.disabled = false));
    btnEdit.innerHTML = '<i class="fas fa-save"></i>';
    btnEdit.classList.add('edit-mode');
    inputs[0].focus();
  }
}

// ================================================================
//  SALVAR HORÁRIOS NO SUPABASE
// ================================================================
async function salvarHorariosNoBanco() {
  try {
    const res = await fetch('/api/horarios', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(allHorarios)
    });
    if (!res.ok) throw new Error('Erro ao salvar: ' + res.status);
    const data = await res.json();
    if (!data || !Array.isArray(data.horarios) || typeof data.grade_hash !== 'string') {
      throw new Error('Resposta da API de horários inválida.');
    }
    allHorarios = data.horarios.map(({ id, created_at, ...horario }) => horario);
    document.body.dataset.gradeHash = data.grade_hash;
    await carregarPrecisaoHorarios(data.grade_hash);
    console.log('Horários salvos no Supabase:', data.grade_hash);
    showAdminMsg('✅ Horários salvos com sucesso no servidor!', 'success');
    return data;
  } catch (e) {
    console.error('Erro ao salvar horários:', e);
    showAdminMsg('❌ Erro ao salvar no servidor. Tente novamente.', 'error');
    throw e;
  }
}

// ================================================================
//  INICIALIZAÇÃO
// ================================================================
function init() {
  synchronizeServerTime();
  setInterval(synchronizeServerTime, 300000);
  window.addEventListener('focus', synchronizeServerTime);
  setInterval(() => {
    const gradeHash = document.body.dataset.gradeHash;
    if (gradeHash) carregarPrecisaoHorarios(gradeHash);
  }, 300000);
  updateDateAndGreeting();
  updateClock();
  setInterval(updateClock, 1000);

  fetchWeather();
  setInterval(fetchWeather, 600000);

  initFilters();

  carregarHorariosDoBanco();

    // ===== VERIFICA A MANUTENÇÃO AO CARREGAR A PÁGINA =====
  verificarManutencao().finally(() => {
    const body = document.body;
    body.classList.remove('loading');
    body.style.display = ''; // remove o display: none inline
  });

  const welcomeModal = document.getElementById('welcomeModal');
  if (welcomeModal) {
    const closeModalBtn = document.getElementById('closeModalBtn');
    window.addEventListener('load', () => welcomeModal.classList.add('active'));
    if (closeModalBtn) {
      closeModalBtn.addEventListener('click', () => welcomeModal.classList.remove('active'));
    }
    welcomeModal.addEventListener('click', (e) => {
      if (e.target === welcomeModal) welcomeModal.classList.remove('active');
    });
  }

  if (closeAlertBtn) {
    closeAlertBtn.addEventListener('click', () => {
      if (alertModal) alertModal.classList.remove('active');
      window.speechSynthesis.cancel();
    });
  }
  if (alertModal) {
    alertModal.addEventListener('click', (e) => {
      if (e.target === alertModal) {
        alertModal.classList.remove('active');
        window.speechSynthesis.cancel();
      }
    });
  }

  // ================================================================
  //  BOTÃO DE RELATÓRIO (REPORTE DE ERRO)
  //  INSERIDO AQUI – após os modais existentes
  // ================================================================
  const reportBtn = document.getElementById('reportBtn');
  const reportModal = document.getElementById('reportModal');
  const reportClose = document.querySelector('.report-close');
  const reportForm = document.getElementById('reportForm');
  const reportMsg = document.getElementById('reportMsg');

  if (reportBtn && reportModal) {
    // Abrir modal
    reportBtn.addEventListener('click', () => {
      reportModal.classList.add('active');
      if (reportMsg) reportMsg.textContent = '';
    });

    // Fechar com X
    if (reportClose) {
      reportClose.addEventListener('click', () => {
        reportModal.classList.remove('active');
      });
    }

    // Fechar clicando fora
    reportModal.addEventListener('click', (e) => {
      if (e.target === reportModal) {
        reportModal.classList.remove('active');
      }
    });

    // Enviar formulário
    if (reportForm) {
      reportForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const nome = document.getElementById('reportNome').value.trim();
        const destino = document.getElementById('reportDestino').value.trim();
        const horario = document.getElementById('reportHorario').value.trim();
        const mensagem = document.getElementById('reportMensagem').value.trim();

        if (!mensagem) {
          if (reportMsg) {
            reportMsg.textContent = 'Por favor, preencha a mensagem.';
            reportMsg.style.color = '#ff6b6b';
          }
          return;
        }

        const payload = {
          nome: sanitize(nome),
          destino: sanitize(destino),
          horario: sanitize(horario),
          mensagem: sanitize(mensagem),
          userAgent: navigator.userAgent,
          url: window.location.href
        };

        if (!rateLimit('report', 3, 60000)) {
          if (reportMsg) {
            reportMsg.textContent = '⏳ Muitos relatórios enviados. Aguarde um minuto.';
            reportMsg.style.color = '#ffaa00';
          }
          return;
        }

        try {
          const res = await fetch('/api/report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.error || 'Erro ao enviar relatório. Código: ' + res.status);
          }

          if (reportMsg) {
            reportMsg.textContent = '✅ Relatório enviado com sucesso! Obrigado pela contribuição.';
            reportMsg.style.color = '#00c864';
          }
          reportForm.reset();
          setTimeout(() => {
            reportModal.classList.remove('active');
          }, 2000);
        } catch (err) {
          console.error('Erro ao enviar relatório:', err);
          if (reportMsg) {
            reportMsg.textContent = '❌ Erro ao enviar: ' + err.message;
            reportMsg.style.color = '#ff6b6b';
          }
        }
      });
    }
  }

  setInterval(() => {
    verificarAlertas();
    renderCards();
  }, 30000);

  setInterval(() => {
    updateDateAndGreeting();
    renderCards();
  }, 60000);
}

// ===== VERIFICA A MANUTENÇÃO A CADA 10 SEGUNDOS (detecta mudanças em tempo real) =====
setInterval(verificarManutencao, 10000);

document.addEventListener('DOMContentLoaded', init);