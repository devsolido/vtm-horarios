// api/log-error.js
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const EMAIL_TO = process.env.EMAIL_TO || 'projetovtmmba@gmail.com';
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { tipo, mensagem, stack, url } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';

  // Validação básica
  if (!tipo || !mensagem) {
    return res.status(400).json({ error: 'Campos tipo e mensagem são obrigatórios' });
  }

  try {
    // 1. Salva no Supabase
    const { data, error } = await supabase
      .from('error_logs')
      .insert({
        tipo,
        mensagem,
        stack: stack || null,
        url: url || null,
        ip,
        user_agent: userAgent
      })
      .select();

    if (error) throw error;

    // 2. Envia e-mail (se as credenciais estiverem configuradas)
    if (EMAIL_USER && EMAIL_PASS) {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: EMAIL_USER, pass: EMAIL_PASS },
      });

      const assunto = `🚨 ERRO: ${tipo}`;
      const corpo = `
🚨 Erro no sistema VTM Integração

📌 Tipo: ${tipo}
📝 Mensagem: ${mensagem}
📅 Data/Hora: ${new Date().toLocaleString('pt-BR')}
🌐 IP: ${ip}
🔗 URL: ${url || 'Não informado'}
📱 User Agent: ${userAgent}

${stack ? `📚 Stack Trace:\n${stack}` : ''}

🔍 Verifique os logs no Supabase para mais detalhes.
      `;

      await transporter.sendMail({
        from: `"VTM Sistema" <${EMAIL_USER}>`,
        to: EMAIL_TO,
        subject: assunto,
        text: corpo,
      });
    }

    return res.status(200).json({ success: true, id: data[0]?.id });
  } catch (err) {
    console.error('Erro ao registrar erro:', err);
    return res.status(500).json({ error: 'Erro ao registrar erro' });
  }
}