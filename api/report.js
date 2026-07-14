// api/report.js
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');

// Inicializa o cliente Supabase (apenas se as variáveis existirem)
let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  console.log('✅ Supabase client inicializado.');
} else {
  console.warn('⚠️ Supabase não configurado – relatórios não serão salvos no banco.');
}

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

  // Verifica variáveis de e-mail
  const requiredEnv = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM', 'ADMIN_EMAIL'];
  const missing = requiredEnv.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error('❌ Variáveis de ambiente ausentes:', missing.join(', '));
    return res.status(500).json({
      success: false,
      error: 'Configuração de e-mail incompleta. Contate o administrador.'
    });
  }

  // Sanitização
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

  const safeNome = escapeHtml(nome || 'Não informado');
  const safeDestino = escapeHtml(destino || 'Não informado');
  const safeHorario = escapeHtml(horario || 'Não informado');
  const safeMensagem = escapeHtml(mensagem);
  const safeTimestamp = timestamp || new Date().toISOString();

  // Objeto com os dados prontos para o banco
  const reportData = {
    nome: nome || null,
    destino: destino || null,
    horario: horario || null,
    mensagem: mensagem,
    timestamp: safeTimestamp,
    user_agent: userAgent || null,
    url: url || null,
  };

  try {
    // 1. Envia o e-mail (como antes)
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 5000,
    });

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

    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: process.env.ADMIN_EMAIL,
      subject,
      html,
      text: `Nome: ${safeNome}\nDestino: ${safeDestino}\nHorário: ${safeHorario}\nMensagem: ${safeMensagem}\n\nData: ${safeTimestamp}`
    });

    console.log('✅ E-mail enviado com sucesso.');

    // 2. Salva no Supabase (se configurado)
    let supabaseError = null;
    if (supabase) {
      const { error } = await supabase.from('reports').insert([reportData]);
      if (error) {
        supabaseError = error;
        console.error('❌ Erro ao salvar no Supabase:', error);
      } else {
        console.log('✅ Relatório salvo no Supabase.');
      }
    }

    // Retorna sucesso mesmo se o Supabase falhar (mas registra o erro)
    return res.status(200).json({
      success: true,
      message: 'Relatório enviado com sucesso! O administrador receberá sua mensagem.',
      supabase: supabaseError ? 'falha ao salvar no banco' : 'salvo no banco'
    });

  } catch (error) {
    console.error('❌ Erro geral:', error);

    let errorMessage = 'Erro interno ao processar o relatório. Tente novamente mais tarde.';
    if (error.code === 'EAUTH') {
      errorMessage = 'Falha na autenticação SMTP. Verifique as credenciais.';
    } else if (error.code === 'ECONNECTION') {
      errorMessage = 'Não foi possível conectar ao servidor de e-mail.';
    } else if (error.code === 'ESOCKET' || error.code === 'ECONNREFUSED') {
      errorMessage = 'Servidor de e-mail indisponível. Contate o administrador.';
    }

    return res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
};