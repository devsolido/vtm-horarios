import { createSchedulePayload, normalizeScheduleRows, ScheduleValidationError } from './schedule.mjs';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, If-None-Match');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({ error: 'Variáveis de ambiente não configuradas' });
  }

  const apiUrl = `${supabaseUrl}/rest/v1/horarios`;
  const headers = {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${supabaseAnonKey}`,
  };

  try {
    if (req.method === 'GET') {
      const response = await fetch(apiUrl, { headers });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const payload = createSchedulePayload(await response.json());
      const etag = `"${payload.grade_hash}"`;
      res.setHeader('ETag', etag);
      res.setHeader('Cache-Control', 'public, s-maxage=15, stale-while-revalidate=30');

      if (req.headers?.['if-none-match'] === etag) {
        return res.status(304).end();
      }
      return res.status(200).json(payload);
    }

    if (req.method === 'POST') {
      const [horario] = normalizeScheduleRows([req.body]);
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          destino: horario.destino,
          horario: horario.horario,
          embarque: horario.embarque,
          dias: horario.dias,
        }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const [saved] = await response.json();
      return res.status(201).json(saved);
    }

    if (req.method === 'PUT') {
      const novosHorarios = normalizeScheduleRows(req.body);
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/replace_horarios`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          novos: novosHorarios.map(({ destino, horario, embarque, dias }) => ({
            destino,
            horario,
            embarque,
            dias,
          })),
        }),
      });
      if (!response.ok) {
        const details = await response.text();
        throw new Error(`RPC replace_horarios falhou (HTTP ${response.status}): ${details}`);
      }

      const payload = createSchedulePayload(await response.json());
      res.setHeader('ETag', `"${payload.grade_hash}"`);
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json(payload);
    }

    if (req.method === 'DELETE') {
      const { id } = req.query || {};
      if (!id) return res.status(400).json({ error: 'ID obrigatório' });
      const response = await fetch(`${apiUrl}?id=eq.${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return res.status(204).end();
    }

    return res.status(405).json({ error: 'Método não permitido' });
  } catch (error) {
    if (error instanceof ScheduleValidationError && ['POST', 'PUT'].includes(req.method)) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Erro na API de horários:', error);
    return res.status(500).json({ error: error.message });
  }
}
