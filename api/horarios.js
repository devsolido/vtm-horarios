// api/horarios.js
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(500).json({ error: 'Variáveis de ambiente não configuradas' });
  }

  const apiUrl = `${SUPABASE_URL}/rest/v1/horarios`;

  try {
    // ---------- GET (buscar todos) ----------
    if (req.method === 'GET') {
      const response = await fetch(apiUrl, {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return res.status(200).json(data);
    }

    // ---------- POST (inserir um único) ----------
    if (req.method === 'POST') {
      const { destino, horario, embarque, dias } = req.body;
      if (!destino || !horario || !embarque || !dias) {
        return res.status(400).json({ error: 'Campos obrigatórios' });
      }
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({ destino, horario, embarque, dias })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return res.status(201).json(data[0]);
    }

    // ---------- PUT (substituir todos) ----------
    if (req.method === 'PUT') {
      const novosHorarios = req.body;
      if (!Array.isArray(novosHorarios)) {
        return res.status(400).json({ error: 'Dados inválidos' });
      }

      // Busca todos os existentes
      const getResponse = await fetch(apiUrl, {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      });
      const existing = await getResponse.json();

      // Deleta um por um
      for (const item of existing) {
        await fetch(`${apiUrl}?id=eq.${item.id}`, {
          method: 'DELETE',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
          }
        });
      }

      // Insere a nova lista
      const inserts = novosHorarios.map(({ destino, horario, embarque, dias }) => ({ destino, horario, embarque, dias }));
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(inserts)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return res.status(200).json(data);
    }

    // ---------- DELETE (remover um específico) ----------
    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'ID obrigatório' });
      const response = await fetch(`${apiUrl}?id=eq.${id}`, {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return res.status(204).end();
    }

    // Se nenhum método corresponder
    return res.status(405).json({ error: 'Método não permitido' });
  } catch (error) {
    console.error('Erro na API:', error);
    return res.status(500).json({ error: error.message });
  }
} 