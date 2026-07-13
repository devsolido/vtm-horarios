// api/manutencao.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

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
      const { data, error } = await supabase
        .from('config')
        .select('value')
        .eq('key', 'manutencao')
        .single();

      if (error) throw error;
      return res.status(200).json({ ativo: data.value === 'true' });
    }

    if (req.method === 'POST') {
      const { ativo } = req.body;
      if (typeof ativo !== 'boolean') {
        return res.status(400).json({ error: 'Campo "ativo" deve ser booleano' });
      }

      const { error } = await supabase
        .from('config')
        .update({ value: String(ativo) })
        .eq('key', 'manutencao');

      if (error) throw error;
      return res.status(200).json({ success: true, ativo });
    }

    return res.status(405).json({ error: 'Método não permitido' });
  } catch (error) {
    console.error('Erro na API de manutenção:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}