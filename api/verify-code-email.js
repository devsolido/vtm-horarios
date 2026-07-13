// api/verify-code-email.js – usando fetch (sem dependência)
export default async function handler(req, res) {
  try {
    console.log('🔵 verify-code-email chamada');

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Método não permitido' });
    }

    const { code } = req.body;
    console.log('🔵 Código recebido:', code);

    if (!code) {
      return res.status(400).json({ error: 'Código não fornecido' });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error('❌ Variáveis do Supabase não configuradas');
      return res.status(500).json({ error: 'Configuração do servidor incompleta' });
    }

    const email = process.env.EMAIL_TO || 'igorifcmi@gmail.com';

    // Buscar código no Supabase via REST
    const apiUrl = `${SUPABASE_URL}/rest/v1/admin_codes?code=eq.${encodeURIComponent(code)}&email=eq.${encodeURIComponent(email)}&used=eq.false&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=id`;

    const response = await fetch(apiUrl, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erro ao consultar Supabase:', response.status, errorText);
      return res.status(500).json({ error: 'Erro ao verificar código', details: errorText });
    }

    const data = await response.json();

    if (!data || data.length === 0) {
      console.warn('⚠️ Código não encontrado ou expirado:', code);
      return res.status(400).json({ error: 'Código inválido ou expirado' });
    }

    const record = data[0];
    console.log('✅ Código válido, marcando como usado...');

    // Atualizar para used = true
    const updateUrl = `${SUPABASE_URL}/rest/v1/admin_codes?id=eq.${record.id}`;
    const updateResponse = await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ used: true }),
    });

    if (!updateResponse.ok) {
      console.error('❌ Erro ao marcar como usado:', updateResponse.status);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('❌ Erro inesperado:', error);
    return res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
}