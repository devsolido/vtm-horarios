// admin/admin.js

// Aguarda o DOM carregar
document.addEventListener('DOMContentLoaded', function() {
  // Inicializa relógio, clima e data (usando funções do script.js)
  if (typeof updateClock === 'function') updateClock();
  if (typeof updateDateAndGreeting === 'function') updateDateAndGreeting();
  if (typeof fetchWeather === 'function') fetchWeather();

  // Atualiza em tempo real
  setInterval(() => {
    if (typeof updateClock === 'function') updateClock();
  }, 1000);

  setInterval(() => {
    if (typeof fetchWeather === 'function') fetchWeather();
  }, 600000);

  // Elementos do admin
  const adminPassword = document.getElementById('adminPassword');
  const adminLoginBtn = document.getElementById('adminLoginBtn');
  const adminMsg = document.getElementById('adminMsg');
  const adminContent = document.getElementById('adminContent');
  const loginArea = document.getElementById('adminLoginArea');

  // Evento de login
  adminLoginBtn.addEventListener('click', function() {
    const pass = adminPassword.value.trim();
    if (pass === 'admin123') {
      adminMsg.textContent = '✅ Acesso concedido!';
      adminMsg.className = 'msg';
      loginArea.style.display = 'none';
      adminContent.style.display = 'block';
      if (typeof loadAdminTable === 'function') loadAdminTable();
      if (typeof showAdminMsg === 'function') showAdminMsg('Painel aberto com sucesso.', 'success');
    } else {
      adminMsg.textContent = '❌ Senha incorreta. Tente novamente.';
      adminMsg.className = 'msg error';
    }
  });

  // Carrega os horários do banco (global)
  if (typeof carregarHorariosDoBanco === 'function') {
    carregarHorariosDoBanco();
  }

  // Adicionar horário
  const adminAddRowBtn = document.getElementById('adminAddRowBtn');
  if (adminAddRowBtn) {
    adminAddRowBtn.addEventListener('click', function() {
      if (typeof window.adicionarHorarioAdmin === 'function') {
        window.adicionarHorarioAdmin();
      }
    });
  }

  // Salvar alterações
  const adminSaveBtn = document.getElementById('adminSaveBtn');
  if (adminSaveBtn) {
    adminSaveBtn.addEventListener('click', function() {
      if (typeof window.salvarHorariosAdmin === 'function') {
        window.salvarHorariosAdmin();
      }
    });
  }
});

// Funções globais para serem chamadas pelos eventos
window.adicionarHorarioAdmin = function() {
  allHorarios.push({
    destino: 'Novo destino',
    horario: '12:00',
    embarque: 'Local',
    dias: ['Segunda a Sexta']
  });
  loadAdminTable();
  const lastIdx = allHorarios.length - 1;
  toggleEditRow(lastIdx);
  showAdminMsg('Novo horário adicionado. Edite os campos e salve.', 'info');
};

window.salvarHorariosAdmin = function() {
  // Captura os valores atuais
  const novasLinhas = [];
  const linhas = document.querySelectorAll('#adminTableBody tr');
  linhas.forEach(tr => {
    const inputs = tr.querySelectorAll('.admin-input');
    const checkboxes = tr.querySelectorAll('.dias-checkboxes input[type="checkbox"]');
    if (inputs.length >= 3) {
      const destino = inputs[0].value.trim();
      const horario = inputs[1].value.trim();
      const embarque = inputs[2].value.trim();
      const dias = [];
      checkboxes.forEach(cb => { if (cb.checked) dias.push(cb.value); });
      if (destino && horario && embarque && dias.length > 0) {
        novasLinhas.push({ destino, horario, embarque, dias });
      }
    }
  });
  if (novasLinhas.length === 0) {
    showAdminMsg('Nenhum horário válido para salvar.', 'error');
    return;
  }
  allHorarios = novasLinhas;
  allHorarios.sort((a, b) => a.horario.localeCompare(b.horario));
  salvarHorariosNoBanco();
  loadAdminTable();
  renderCards();
};

// Nota: loadAdminTable e toggleEditRow são as mesmas funções do script.js
// Elas são globais e serão chamadas daqui.