// api/check-login.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { senha } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

  const MAX_ATTEMPTS = 5;
  const BLOCK_TIME = 60000; // 60 segundos

  try {
    // Busca ou cria registro para o IP
    let { data, error } = await supabase
      .from('login_attempts')
      .select('attempts, blocked_until')
      .eq('ip', ip)
      .maybeSingle();

    if (error) throw error;

    // Se não existir, cria
    if (!data) {
      const { error: insertError } = await supabase
        .from('login_attempts')
        .insert({ ip, attempts: 0 });
      if (insertError) throw insertError;
      data = { attempts: 0, blocked_until: null };
    }

    // Verifica se está bloqueado
    if (data.blocked_until && new Date(data.blocked_until) > new Date()) {
      const blockedUntil = new Date(data.blocked_until);
      const segundosRestantes = Math.ceil((blockedUntil - Date.now()) / 1000);
      return res.status(429).json({
        error: `Muitas tentativas. Aguarde ${segundosRestantes} segundos.`,
        blocked: true,
        remaining: segundosRestantes
      });
    }

    // 🔑 VERIFICAÇÃO DA SENHA
    // A senha correta está no front-end (localStorage). Para segurança,
    // vamos manter a lógica: a senha correta é a que está armazenada no localStorage.
    // Como a API não tem acesso ao localStorage, precisamos que o front-end
    // envie a senha correta junto com a tentativa? Não, isso é inseguro.
    // Melhor: mover a senha para o servidor (variável de ambiente).
    // Por enquanto, vamos usar uma variável de ambiente ADMIN_PASSWORD.
    // Configure na Vercel: ADMIN_PASSWORD = admin123
    const storedPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const isCorrect = senha === storedPassword;

    if (isCorrect) {
      // Resetar tentativas
      await supabase
        .from('login_attempts')
        .update({ attempts: 0, blocked_until: null })
        .eq('ip', ip);
      return res.status(200).json({ success: true });
    }

    // Senha incorreta – incrementa tentativas
    const newAttempts = (data.attempts || 0) + 1;
    let blockedUntil = null;
    if (newAttempts >= MAX_ATTEMPTS) {
      blockedUntil = new Date(Date.now() + BLOCK_TIME);
    }

    await supabase
      .from('login_attempts')
      .update({ attempts: newAttempts, blocked_until: blockedUntil })
      .eq('ip', ip);

    return res.status(401).json({
      error: 'Senha incorreta.',
      attempts: newAttempts,
      maxAttempts: MAX_ATTEMPTS,
      blocked: !!blockedUntil,
      remaining: blockedUntil ? Math.ceil((new Date(blockedUntil) - Date.now()) / 1000) : 0
    });
  } catch (err) {
    console.error('Erro no check-login:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}