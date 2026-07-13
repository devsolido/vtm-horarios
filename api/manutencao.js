// api/manutencao.js – com logs detalhados
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  console.log('🔵 API /api/manutencao chamada - Método:', req.method);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Lê variáveis de ambiente
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

  console.log('🔵 SUPABASE_URL:', SUPABASE_URL ? '✅ configurado' : '❌ faltando');
  console.log('🔵 SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? '✅ configurada' : '❌ faltando');

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('❌ Variáveis do Supabase não configuradas');
    return res.status(500).json({ error: 'Variáveis do Supabase não configuradas' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  try {
    if (req.method === 'GET') {
      console.log('🔵 GET - Buscando status...');
      const { data, error } = await supabase
        .from('config')
        .select('value')
        .eq('key', 'manutencao')
        .single();

      if (error) {
        console.error('❌ Erro na consulta:', error);
        throw error;
      }
      console.log('🔵 Dados retornados:', data);
      return res.status(200).json({ ativo: data?.value === 'true' });
    }

    if (req.method === 'POST') {
      console.log('🔵 POST - Body recebido:', req.body);
      const { ativo } = req.body;
      if (typeof ativo !== 'boolean') {
        console.error('❌ Campo "ativo" inválido:', ativo);
        return res.status(400).json({ error: 'Campo "ativo" deve ser booleano' });
      }

      console.log('🔵 Atualizando para:', ativo);
      const { data, error } = await supabase
        .from('config')
        .update({ value: String(ativo) })
        .eq('key', 'manutencao')
        .select();

      if (error) {
        console.error('❌ Erro ao atualizar:', error);
        throw error;
      }
      console.log('✅ Atualizado com sucesso:', data);
      return res.status(200).json({ success: true, ativo });
    }

    return res.status(405).json({ error: 'Método não permitido' });
  } catch (error) {
    console.error('❌ Erro inesperado:', error);
    // Retorna o erro detalhado para o front-end
    return res.status(500).json({ 
      error: 'Erro interno do servidor', 
      details: error.message,
      stack: error.stack 
    });
  }
}