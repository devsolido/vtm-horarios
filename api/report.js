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

  // Formata data para exibição
  const dataFormatada = new Date(safeTimestamp).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

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
    // 1. Envia o e-mail
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

    // ========== HTML DO E-MAIL – VERSÃO BONITA, ORGANIZADA E COM LOGO ==========
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Relatório VTM</title>
</head>
<body style="margin:0; padding:0; background:#eef2f7; font-family:'Segoe UI', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7; padding:20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:20px; box-shadow:0 8px 40px rgba(0,0,0,0.05); overflow:hidden; border:1px solid #e2e8f0;">
          
          <!-- CABEÇALHO COM LOGO E TÍTULO -->
          <tr>
            <td style="background:linear-gradient(135deg, #005bea, #00c6fb); padding:30px 30px 20px; text-align:center;">
              <!-- LOGO (use a URL real da sua logo) -->
              <img src="https://quehoraspassa.vercel.app/logo-nova.png" alt="VTM Integração" width="140" style="display:block; margin:0 auto 12px; border-radius:8px;">
              <h1 style="margin:0; color:#ffffff; font-size:24px; font-weight:700; letter-spacing:0.5px;">
                📋 Novo Relatório de Erro
              </h1>
              <p style="margin:6px 0 0; color:rgba(255,255,255,0.85); font-size:14px;">
                Recebido em ${dataFormatada}
              </p>
            </td>
          </tr>

          <!-- CORPO -->
          <tr>
            <td style="padding:28px 30px 16px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="font-size:15px;">
                <!-- Nome -->
                <tr>
                  <td style="padding:8px 0; border-bottom:1px solid #edf2f7;">
                    <strong style="color:#1a2a4a;">👤 Nome</strong>
                    <span style="display:block; margin-top:2px; color:#2d3748;">${safeNome}</span>
                  </td>
                </tr>
                <!-- Destino -->
                <tr>
                  <td style="padding:8px 0; border-bottom:1px solid #edf2f7;">
                    <strong style="color:#1a2a4a;">📍 Destino</strong>
                    <span style="display:block; margin-top:2px; color:#2d3748;">${safeDestino}</span>
                  </td>
                </tr>
                <!-- Horário -->
                <tr>
                  <td style="padding:8px 0; border-bottom:1px solid #edf2f7;">
                    <strong style="color:#1a2a4a;">🕒 Horário informado</strong>
                    <span style="display:block; margin-top:2px; color:#2d3748;">${safeHorario}</span>
                  </td>
                </tr>
                <!-- Mensagem -->
                <tr>
                  <td style="padding:14px 0 8px;">
                    <strong style="color:#1a2a4a;">💬 Mensagem do usuário</strong>
                    <div style="margin-top:8px; background:#f7fafc; border-left:5px solid #005bea; padding:14px 18px; border-radius:8px; color:#1a2a4a; font-size:15px; line-height:1.7; word-wrap:break-word;">
                      ${safeMensagem}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- METADADOS TÉCNICOS -->
          <tr>
            <td style="padding:0 30px 20px;">
              <hr style="border:0; border-top:1px solid #e2e8f0; margin:8px 0 16px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px; color:#718096;">
                <tr>
                  <td style="padding:4px 0;"><strong>📅 Data/Hora</strong> ${dataFormatada}</td>
                  <td style="padding:4px 0; text-align:right;"><strong>🌐 Página</strong> ${escapeHtml(url || 'Não informado')}</td>
                </tr>
                <tr>
                  <td colspan="2" style="padding:6px 0 0;">
                    <strong>🖥️ Navegador</strong> ${escapeHtml(userAgent || 'Não informado')}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- RODAPÉ -->
          <tr>
            <td style="background:#f7fafc; padding:14px 30px; text-align:center; border-top:1px solid #e2e8f0; font-size:13px; color:#a0aec0;">
              Este relatório foi gerado automaticamente pelo sistema de atendimento VTM.
              <br>Para responder, entre em contato com o usuário diretamente.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
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