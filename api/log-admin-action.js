// api/log-admin-action.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { acao, detalhes } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';

  if (!acao) {
    return res.status(400).json({ error: 'Campo "acao" é obrigatório' });
  }

  try {
    await supabase
      .from('admin_logs')
      .insert({
        acao,
        detalhes: detalhes || {},
        ip,
        user_agent: userAgent
      });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Erro ao registrar log administrativo:', err);
    return res.status(500).json({ error: 'Erro ao registrar log' });
  }
}