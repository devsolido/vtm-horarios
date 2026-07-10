// api/horarios.js
export default async function handler(req, res) {
  // Log para depuração
  console.log('🔵 API /api/horarios chamada - Método:', req.method);

  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

    console.log('🔵 SUPABASE_URL:', SUPABASE_URL);
    console.log('🔵 SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? '✅ Definida' : '❌ Não definida');

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error('❌ Variáveis de ambiente não configuradas');
      return res.status(500).json({ error: 'Variáveis de ambiente não configuradas' });
    }

    // Monta a URL corretamente
    const apiUrl = `${SUPABASE_URL}/rest/v1/horarios`;
    console.log('🔵 URL do Supabase:', apiUrl);

    // GET - buscar todos os horários
    if (req.method === 'GET') {
      const response = await fetch(apiUrl, {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      });

      console.log('🔵 Status da resposta do Supabase:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Erro do Supabase:', response.status, errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log('🔵 Dados retornados:', data);
      return res.status(200).json(data);
    }

    // POST, PUT, DELETE... (mantenha o restante igual, mas com logs)
    // Se não for GET, retorna 405
    return res.status(405).json({ error: 'Método não permitido' });
  } catch (error) {
    console.error('❌ Erro na API:', error);
    return res.status(500).json({ error: error.message });
  }
}