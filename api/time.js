const SERVICE_TIME_ZONE = 'America/Belem';

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return res.status(405).json({ error: 'Método não permitido' });
  }

  return res.status(200).json({
    server_time: new Date().toISOString(),
    time_zone: SERVICE_TIME_ZONE,
  });
}
