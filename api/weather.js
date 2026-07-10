// api/weather.js
export default async function handler(req, res) {
  // Permite apenas GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  // Pega a chave da variável de ambiente (configurada no painel da Vercel)
  const apiKey = process.env.WEATHER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Chave de API não configurada' });
  }

  const city = 'Maraba';
  const state = 'PA';
  const url = `https://api.hgbrasil.com/weather?key=${apiKey}&city_name=${city},${state}&locale=pt&format=json`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    if (!data || !data.results || data.results.temp === undefined) {
      throw new Error('Dados inválidos');
    }

    res.status(200).json({
      temp: data.results.temp,
      condition_slug: data.results.condition_slug || ''
    });
  } catch (error) {
    console.error('Erro no proxy:', error);
    res.status(500).json({ error: 'Erro ao obter dados do clima' });
  }
}