import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  try {
    console.log('🔵 verify-code-email chamada - Método:', req.method);

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

    console.log('🔵 SUPABASE_URL:', SUPABASE_URL ? '✅ configurado' : '❌ faltando');
    console.log('🔵 SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? '✅ configurada' : '❌ faltando');

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error('❌ Variáveis do Supabase não configuradas');
      return res.status(500).json({ error: 'Configuração do servidor incompleta' });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const email = process.env.EMAIL_TO || 'igorifcmi@gmail.com';

    console.log('🔵 Buscando código no banco para:', email);

    const { data, error } = await supabase
      .from('admin_codes')
      .select('id')
      .eq('code', code)
      .eq('email', email)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (error) {
      console.error('❌ Erro ao consultar Supabase:', error);
      return res.status(500).json({ error: 'Erro ao verificar código', details: error.message });
    }

    if (!data) {
      console.warn('⚠️ Código não encontrado ou expirado:', code);
      return res.status(400).json({ error: 'Código inválido ou expirado' });
    }

    console.log('✅ Código válido, marcando como usado...');

    const { error: updateError } = await supabase
      .from('admin_codes')
      .update({ used: true })
      .eq('id', data.id);

    if (updateError) {
      console.error('❌ Erro ao marcar código como usado:', updateError);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('❌ Erro inesperado:', error);
    return res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
}