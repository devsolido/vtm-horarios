// admin/admin.js - Painel Administrativo Aprimorado

document.addEventListener('DOMContentLoaded', function() {

  // ===== ATUALIZA RELÓGIO, DATA E CLIMA (com verificação de elementos) =====
  function atualizarAdmin() {
    if (typeof updateClock === 'function') {
      updateClock();
    } else {
      console.warn('updateClock não definida');
    }
    if (typeof updateDateAndGreeting === 'function') {
      updateDateAndGreeting();
    } else {
      console.warn('updateDateAndGreeting não definida');
    }
    if (typeof fetchWeather === 'function') {
      fetchWeather();
    } else {
      console.warn('fetchWeather não definida');
    }
  }

  // Executa agora
  atualizarAdmin();

  // Agenda atualizações automáticas
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

  // Evento de login com feedback visual
  adminLoginBtn.addEventListener('click', function() {
    const pass = adminPassword.value.trim();
    adminMsg.className = 'msg';
    adminMsg.textContent = '';

    if (pass === 'admin123') {
      adminMsg.className = 'msg success';
      adminMsg.textContent = '✅ Acesso concedido!';

      setTimeout(() => {
        loginArea.style.display = 'none';
        adminContent.style.display = 'block';
        if (typeof loadAdminTable === 'function') loadAdminTable();
        if (typeof showAdminMsg === 'function') {
          showAdminMsg('Painel aberto com sucesso.', 'success');
        }
        // Reforça a atualização de clima e relógio após login
        atualizarAdmin();
      }, 600);
    } else {
      adminMsg.className = 'msg error';
      adminMsg.textContent = '❌ Senha incorreta. Tente novamente.';
      adminPassword.value = '';
      adminPassword.focus();
      loginArea.style.animation = 'shake 0.4s ease';
      setTimeout(() => {
        loginArea.style.animation = '';
      }, 500);
    }
  });

  adminPassword.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      adminLoginBtn.click();
    }
  });

  // Carrega os horários do banco
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

// Animação de shake (garantida)
const styleShake = document.createElement('style');
styleShake.textContent = `
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-10px); }
  40% { transform: translateX(10px); }
  60% { transform: translateX(-6px); }
  80% { transform: translateX(6px); }
}
`;
document.head.appendChild(styleShake);

// Funções globais (já existentes)
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