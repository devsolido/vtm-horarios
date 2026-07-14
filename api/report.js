export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { nome, destino, horario, mensagem, timestamp, userAgent, url } = req.body;

  if (!mensagem || mensagem.trim().length < 3) {
    return res.status(400).json({ error: 'Mensagem muito curta.' });
  }

  // Aqui você pode salvar no Supabase, MongoDB, ou enviar email
  console.log('📝 RELATÓRIO:', { nome, destino, horario, mensagem, timestamp, userAgent, url });

  // Exemplo com Supabase (se já tiver client)
  // const { data, error } = await supabase.from('reports').insert([{ nome, destino, horario, mensagem, timestamp }]);
  // if (error) throw error;

  return res.status(200).json({ success: true, message: 'Relatório recebido' });
}