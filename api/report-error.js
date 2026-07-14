// api/report-error.js
import nodemailer from 'nodemailer';

const EMAIL_TO = process.env.EMAIL_TO || 'projetovtmmba@gmail.com';
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { nome, mensagem, destino, horario, pagina } = req.body;

  if (!mensagem) {
    return res.status(400).json({ error: 'A mensagem é obrigatória' });
  }

  // Monta o corpo do e-mail
  const assunto = `📢 Novo relatório do usuário - VTM Integração`;
  const corpo = `
📢 Novo relatório enviado por um usuário

📌 Nome: ${nome || 'Não informado'}
🚌 Destino: ${destino || 'Não informado'}
⏰ Horário: ${horario || 'Não informado'}
📝 Mensagem:
${mensagem}

📍 Página: ${pagina || 'Não informado'}
📅 Data/Hora: ${new Date().toLocaleString('pt-BR')}
  `;

  try {
    // Se as credenciais de e-mail estiverem configuradas, envia o e-mail
    if (EMAIL_USER && EMAIL_PASS) {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: EMAIL_USER, pass: EMAIL_PASS },
      });

      await transporter.sendMail({
        from: `"VTM Relatórios" <${EMAIL_USER}>`,
        to: EMAIL_TO,
        subject: assunto,
        text: corpo,
      });
    } else {
      console.warn('Credenciais de e-mail não configuradas – relatório não enviado.');
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Erro ao enviar relatório:', err);
    return res.status(500).json({ error: 'Erro ao enviar relatório' });
  }
}