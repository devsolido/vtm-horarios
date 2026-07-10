// api/horarios.js
import { createClient } from '@supabase/supabase-js';

// As variáveis de ambiente serão configuradas na Vercel
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default async function handler(req, res) {
  // CORS (opcional)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // GET - buscar todos os horários
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('horarios')
        .select('*')
        .order('horario', { ascending: true });
      if (error) throw error;
      return res.status(200).json(data);
    }

    // POST - adicionar um horário
    if (req.method === 'POST') {
      const { destino, horario, embarque, dias } = req.body;
      if (!destino || !horario || !embarque || !dias) {
        return res.status(400).json({ error: 'Campos obrigatórios' });
      }
      const { data, error } = await supabase
        .from('horarios')
        .insert([{ destino, horario, embarque, dias }])
        .select();
      if (error) throw error;
      return res.status(201).json(data[0]);
    }

    // PUT - substituir todos os horários
    if (req.method === 'PUT') {
      const novosHorarios = req.body;
      if (!Array.isArray(novosHorarios)) {
        return res.status(400).json({ error: 'Dados inválidos' });
      }
      // Deleta todos
      const { error: deleteError } = await supabase.from('horarios').delete().neq('id', 0);
      if (deleteError) throw deleteError;
      // Insere os novos
      const { data, error } = await supabase
        .from('horarios')
        .insert(novosHorarios.map(({ destino, horario, embarque, dias }) => ({ destino, horario, embarque, dias })))
        .select();
      if (error) throw error;
      return res.status(200).json(data);
    }

    // DELETE - remover um horário por id
    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'ID obrigatório' });
      const { error } = await supabase.from('horarios').delete().match({ id });
      if (error) throw error;
      return res.status(204).end();
    }

    return res.status(405).json({ error: 'Método não permitido' });
  } catch (error) {
    console.error('Erro na API de horários:', error);
    return res.status(500).json({ error: error.message });
  }
}