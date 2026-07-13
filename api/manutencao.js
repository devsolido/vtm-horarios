// api/manutencao.js – versão com arquivo JSON (sem Supabase)
import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'manutencao-status.json');

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    if (req.method === 'GET') {
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify({ ativo: false }, null, 2));
      }
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return res.status(200).json({ ativo: data.ativo });
    }

    if (req.method === 'POST') {
      const { ativo } = req.body;
      if (typeof ativo !== 'boolean') {
        return res.status(400).json({ error: 'Campo "ativo" deve ser booleano' });
      }
      fs.writeFileSync(filePath, JSON.stringify({ ativo }, null, 2));
      return res.status(200).json({ success: true, ativo });
    }

    return res.status(405).json({ error: 'Método não permitido' });
  } catch (error) {
    console.error('❌ Erro na API de manutenção:', error);
    return res.status(500).json({ error: error.message });
  }
}