// api/report.js
const nodemailer = require('nodemailer');

module.exports = async (req, res) => {
  // Apenas POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { nome, destino, horario, mensagem, timestamp, userAgent, url } = req.body;

  // Validação da mensagem
  if (!mensagem || mensagem.trim().length < 3) {
    return res.status(400).json({ error: 'Mensagem muito curta (mínimo 3 caracteres).' });
  }

  // Verifica se as variáveis de ambiente necessárias estão definidas
  const requiredEnv = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM', 'ADMIN_EMAIL'];
  const missing = requiredEnv.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error('❌ Variáveis de ambiente ausentes:', missing.join(', '));
    return res.status(500).json({
      success: false,
      error: 'Configuração de e-mail incompleta. Contate o administrador.'
    });
  }

  // Função de sanitização simples para evitar injeção
  const escapeHtml = (text) => {
    if (!text) return '';
    return text.replace(/[&<>"]/g, function(m) {
      if (m === '&') return '&amp;';
      if (m === '<') return '&lt;';
      if (m === '>') return '&gt;';
      if (m === '"') return '&quot;';
      return m;
    });
  };

  // Sanitiza os campos
  const safeNome = escapeHtml(nome || 'Não informado');
  const safeDestino = escapeHtml(destino || 'Não informado');
  const safeHorario = escapeHtml(horario || 'Não informado');
  const safeMensagem = escapeHtml(mensagem);
  const safeTimestamp = timestamp || new Date().toISOString();

  try {
    // Configura o transporte SMTP
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10) || 587,
      secure: false, // usa STARTTLS na porta 587
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      // Timeouts para evitar travamentos
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 5000,
    });

    // Monta o e-mail
    const subject = `📢 Novo relatório de erro - VTM Integração`;
    const html = `
      <h2>📋 Relatório de erro enviado pelo usuário</h2>
      <p><strong>Nome:</strong> ${safeNome}</p>
      <p><strong>Destino:</strong> ${safeDestino}</p>
      <p><strong>Horário:</strong> ${safeHorario}</p>
      <p><strong>Mensagem:</strong></p>
      <blockquote>${safeMensagem}</blockquote>
      <hr>
      <p><strong>Data/Hora:</strong> ${safeTimestamp}</p>
      <p><strong>URL:</strong> ${escapeHtml(url || 'Não informado')}</p>
      <p><strong>User Agent:</strong> ${escapeHtml(userAgent || 'Não informado')}</p>
    `;

    const mailOptions = {
      from: process.env.SMTP_FROM,
      to: process.env.ADMIN_EMAIL,
      subject,
      html,
      // Texto plano para fallback
      text: `Nome: ${safeNome}\nDestino: ${safeDestino}\nHorário: ${safeHorario}\nMensagem: ${safeMensagem}\n\nData: ${safeTimestamp}`
    };

    // Envia o e-mail
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ E-mail enviado com sucesso:', info.messageId);

    return res.status(200).json({
      success: true,
      message: 'Relatório enviado com sucesso! O administrador receberá sua mensagem.'
    });

  } catch (error) {
    console.error('❌ Erro ao enviar e-mail:', error);

    // Mensagem de erro mais específica
    let errorMessage = 'Erro interno ao processar o relatório. Tente novamente mais tarde.';
    if (error.code === 'EAUTH') {
      errorMessage = 'Falha na autenticação SMTP. Verifique as credenciais.';
    } else if (error.code === 'ECONNECTION') {
      errorMessage = 'Não foi possível conectar ao servidor de e-mail. Verifique as configurações.';
    } else if (error.code === 'ESOCKET' || error.code === 'ECONNREFUSED') {
      errorMessage = 'Servidor de e-mail indisponível. Contate o administrador.';
    } else if (error.responseCode === 550) {
      errorMessage = 'O e-mail de remetente não é autorizado.';
    }

    return res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
};