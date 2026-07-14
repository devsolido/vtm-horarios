// api/report.js
const nodemailer = require('nodemailer');

module.exports = async (req, res) => {
  // Apenas POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { nome, destino, horario, mensagem, timestamp, userAgent, url } = req.body;

  // Validação
  if (!mensagem || mensagem.trim().length < 3) {
    return res.status(400).json({ error: 'Mensagem muito curta.' });
  }

  try {
    // Configurar transporte SMTP usando variáveis de ambiente
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false, // true para 465, false para outras portas
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Montar corpo do e-mail
    const subject = `📢 Novo relatório de erro - VTM Integração`;
    const html = `
      <h2>📋 Relatório de erro enviado pelo usuário</h2>
      <p><strong>Nome:</strong> ${nome || 'Não informado'}</p>
      <p><strong>Destino:</strong> ${destino || 'Não informado'}</p>
      <p><strong>Horário:</strong> ${horario || 'Não informado'}</p>
      <p><strong>Mensagem:</strong></p>
      <blockquote>${mensagem}</blockquote>
      <hr>
      <p><strong>Data/Hora:</strong> ${timestamp || new Date().toISOString()}</p>
      <p><strong>URL:</strong> ${url || 'Não informado'}</p>
      <p><strong>User Agent:</strong> ${userAgent || 'Não informado'}</p>
    `;

    const mailOptions = {
      from: process.env.SMTP_FROM,
      to: process.env.ADMIN_EMAIL,
      subject,
      html,
    };

    // Enviar e-mail
    await transporter.sendMail(mailOptions);

    console.log('✅ Relatório recebido e e-mail enviado:', { nome, destino, horario });

    return res.status(200).json({
      success: true,
      message: 'Relatório enviado com sucesso! Você receberá um e-mail de confirmação em breve.',
    });
  } catch (error) {
    console.error('❌ Erro ao enviar e-mail:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao processar o relatório. Tente novamente mais tarde.',
    });
  }
};