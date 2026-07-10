// api/horarios.js - VERSÃO SIMPLIFICADA PARA TESTE
export default async function handler(req, res) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    // SOMENTE GET PARA TESTE
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Método não permitido' });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

    // Validação clara
    if (!SUPABASE_URL) {
      return res.status(500).json({ 
        erro: 'SUPABASE_URL não configurada',
        variavel: 'SUPABASE_URL',
        valor_atual: SUPABASE_URL
      });
    }
    if (!SUPABASE_ANON_KEY) {
      return res.status(500).json({ 
        erro: 'SUPABASE_ANON_KEY não configurada',
        variavel: 'SUPABASE_ANON_KEY',
        valor_atual: SUPABASE_ANON_KEY
      });
    }

    // Monta URL
    const apiUrl = `${SUPABASE_URL}/rest/v1/horarios`;

    // Faz requisição para o Supabase
    const response = await fetch(apiUrl, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error('Erro:', error);
    return res.status(500).json({ 
      erro: error.message,
      stack: error.stack 
    });
  }
}