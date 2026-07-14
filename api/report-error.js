// api/report.js (para Express)
const fs = require('fs');
const path = require('path');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { nome, destino, horario, mensagem, timestamp, userAgent, url } = req.body;

  if (!mensagem || mensagem.trim().length < 3) {
    return res.status(400).json({ error: 'Mensagem muito curta.' });
  }

  // Salva em um arquivo JSON (ex: reports.json)
  const filePath = path.join(__dirname, '..', 'reports.json');
  let reports = [];
  if (fs.existsSync(filePath)) {
    reports = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }
  reports.push({ nome, destino, horario, mensagem, timestamp, userAgent, url, data: new Date().toISOString() });
  fs.writeFileSync(filePath, JSON.stringify(reports, null, 2));

  return res.status(200).json({ success: true, message: 'Relatório recebido' });
};