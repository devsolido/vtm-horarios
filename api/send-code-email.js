import nodemailer from 'nodemailer';

const codeStore = new Map();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const toEmail = process.env.EMAIL_TO;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!user || !pass || !toEmail) {
    return res.status(500).json({
      error: 'Configuração de e-mail incompleta. Verifique EMAIL_USER, EMAIL_PASS e EMAIL_TO.'
    });
  }

  // Gerar código de 22 dígitos
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 22; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  const expiresAt = Date.now() + 60000;
  codeStore.set(toEmail, { code, expiresAt });

  // ⚡ ENVIO DIRETO PELO GMAIL (não via Brevo)
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });

  try {
    await transporter.sendMail({
      from: `"VTM Integração" <${user}>`,
      to: toEmail,
      subject: '🔐 Seu código de acesso ao painel VTM',
      text: `Seu código de acesso é:\n\n${code}\n\nEste código é válido por 1 minuto.\n\nCaso não tenha solicitado, ignore este e-mail.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; background: #f8fafc; border-radius: 12px;">
          <h2 style="color: #005bea; text-align: center;">🚌 VTM Integração</h2>
          <p style="text-align: center; font-size: 16px;">Seu código de acesso ao painel administrativo:</p>
          <div style="background: #ffffff; padding: 20px; border-radius: 8px; font-size: 28px; letter-spacing: 4px; text-align: center; font-weight: bold; border: 2px solid #005bea; color: #005bea;">
            ${code}
          </div>
          <p style="text-align: center; color: #666; font-size: 14px;">⏱️ Válido por <strong>1 minuto</strong>.</p>
          <p style="text-align: center; color: #999; font-size: 12px;">Se não solicitou, ignore este e-mail.</p>
        </div>
      `,
    });

    setTimeout(() => codeStore.delete(toEmail), 60000);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Erro ao enviar e-mail:', error);
    return res.status(500).json({ error: 'Falha ao enviar e-mail', details: error.message });
  }
}