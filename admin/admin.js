// admin/admin.js - Painel Administrativo Aprimorado

document.addEventListener('DOMContentLoaded', function() {
  // Inicializa relógio, clima e data
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

  // ===== LOGIN =====
  const adminPassword = document.getElementById('adminPassword');
  const adminLoginBtn = document.getElementById('adminLoginBtn');
  const adminMsg = document.getElementById('adminMsg');
  const adminContent = document.getElementById('adminContent');
  const loginArea = document.getElementById('adminLoginArea');

  // Toggle mostrar/ocultar senha
  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.className = 'toggle-password';
  toggleBtn.setAttribute('aria-label', 'Mostrar senha');
  toggleBtn.innerHTML = '<i class="fas fa-eye"></i>';
  
  const passwordWrapper = document.querySelector('.password-wrapper');
  if (passwordWrapper) {
    passwordWrapper.appendChild(toggleBtn);
  }

  let isPasswordVisible = false;
  toggleBtn.addEventListener('click', function(e) {
    e.preventDefault();
    isPasswordVisible = !isPasswordVisible;
    adminPassword.type = isPasswordVisible ? 'text' : 'password';
    toggleBtn.innerHTML = isPasswordVisible 
      ? '<i class="fas fa-eye-slash"></i>' 
      : '<i class="fas fa-eye"></i>';
    toggleBtn.setAttribute('aria-label', isPasswordVisible ? 'Ocultar senha' : 'Mostrar senha');
    adminPassword.focus();
  });

  // Função para mostrar mensagem de erro com shake
  function showLoginError(msg) {
    adminMsg.className = 'msg error';
    adminMsg.textContent = '❌ ' + msg;
    loginArea.classList.add('shake');
    setTimeout(() => {
      loginArea.classList.remove('shake');
    }, 500);
    adminPassword.value = '';
    adminPassword.focus();
  }

  // Evento de login
  adminLoginBtn.addEventListener('click', function() {
    const pass = adminPassword.value.trim();
    
    // Limpa mensagem anterior
    adminMsg.className = 'msg';
    adminMsg.textContent = '';

    if (pass === 'admin123') {
      // Sucesso
      adminMsg.className = 'msg success';
      adminMsg.textContent = '✅ Acesso concedido!';
      
      setTimeout(() => {
        loginArea.style.display = 'none';
        adminContent.style.display = 'block';
        if (typeof loadAdminTable === 'function') loadAdminTable();
        if (typeof showAdminMsg === 'function') {
          showAdminMsg('Painel aberto com sucesso.', 'success');
        }
      }, 600);
    } else {
      showLoginError('Senha incorreta. Tente novamente.');
    }
  });

  // Permitir Enter no campo de senha
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