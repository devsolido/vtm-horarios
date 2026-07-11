// api/verify-code-email.js
import { verifyEmailCode } from './send-code-email.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { code } = req.body;
  const email = process.env.EMAIL_TO;

  if (!code) {
    return res.status(400).json({ error: 'Código não fornecido' });
  }

  const result = verifyEmailCode(email, code);
  if (result.valid) {
    return res.status(200).json({ success: true });
  } else {
    return res.status(400).json({ error: result.reason });
  }
}