// admin/admin.js – Login em 2 passos (senha + código de verificação)

document.addEventListener('DOMContentLoaded', function() {

  // ===== Elementos =====
  const stepPassword = document.getElementById('stepPassword');
  const stepCode = document.getElementById('stepCode');
  const adminPassword = document.getElementById('adminPassword');
  const passwordBtn = document.getElementById('passwordBtn');
  const passwordMsg = document.getElementById('passwordMsg');

  const adminCode22 = document.getElementById('adminCode22');
  const verifyCodeBtn = document.getElementById('verifyCodeBtn');
  const resendCodeBtn = document.getElementById('resendCodeBtn');
  const codeMsg = document.getElementById('codeMsg');
  const generatedCodeSpan = document.getElementById('generatedCode');

  const progressCircle = document.getElementById('progressCircle');
  const timerText = document.getElementById('timerText');

  const adminContent = document.getElementById('adminContent');
  const loginArea = document.getElementById('adminLoginArea');

  // ===== Senha armazenada no localStorage =====
  const STORAGE_KEY = 'vtm_admin_password';
  let storedPassword = localStorage.getItem(STORAGE_KEY) || 'admin123';

  // ===== Elementos para alterar senha =====
  const newPasswordInput = document.getElementById('newPassword');
  const confirmPasswordInput = document.getElementById('confirmPassword');
  const changePasswordBtn = document.getElementById('changePasswordBtn');
  const changePasswordMsg = document.getElementById('changePasswordMsg');

  // ===== Elementos de manutenção =====
  const maintenanceBtn = document.getElementById('maintenanceBtn');
  const maintenanceStatus = document.getElementById('maintenanceStatus');

  let timerInterval = null;
  let timeLeft = 60;
  const TOTAL_TIME = 60;
  const CIRCUMFERENCE = 339.292;

  // ===== Atualiza relógio e clima =====
  function atualizarAdmin() {
    if (typeof updateClock === 'function') updateClock();
    if (typeof updateDateAndGreeting === 'function') updateDateAndGreeting();
    if (typeof fetchWeather === 'function') fetchWeather();
  }
  atualizarAdmin();
  setInterval(atualizarAdmin, 1000);
  setInterval(() => { if (typeof fetchWeather === 'function') fetchWeather(); }, 600000);

  // ===== Mostrar mensagem =====
  function showMessage(el, text, type = 'info') {
    if (!el) return;
    el.textContent = text;
    el.className = 'msg ' + type;
    el.style.display = 'block';
    clearTimeout(el._timeout);
    el._timeout = setTimeout(() => { el.style.display = 'none'; }, 5000);
  }

  // ===== Iniciar temporizador =====
  function startTimer() {
    clearInterval(timerInterval);
    timeLeft = TOTAL_TIME;
    updateTimerDisplay();
    timerInterval = setInterval(() => {
      timeLeft--;
      updateTimerDisplay();
      if (timeLeft <= 0) {
        clearInterval(timerInterval);
        if (generatedCodeSpan) generatedCodeSpan.textContent = '⌛ Código expirado';
        showMessage(codeMsg, '⏰ O código expirou. Clique em "Reenviar".', 'error');
      }
    }, 1000);
  }

  function updateTimerDisplay() {
    if (!progressCircle || !timerText) return;
    const progress = (timeLeft / TOTAL_TIME) * CIRCUMFERENCE;
    progressCircle.style.strokeDashoffset = CIRCUMFERENCE - progress;
    timerText.textContent = timeLeft + 's';
    timerText.style.color = timeLeft <= 10 ? '#ff6b6b' : '#00c6fb';
  }

  // ===== Gerar e enviar código =====
  function generateNewCode() {
    if (!resendCodeBtn) return;
    const btn = resendCodeBtn;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';

    if (generatedCodeSpan) generatedCodeSpan.textContent = '⏳ Enviando...';
    if (adminCode22) adminCode22.value = '';

    fetch('/api/send-code-email', { method: 'POST' })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          showMessage(codeMsg, '✅ Código de verificação enviado.', 'success');
          if (generatedCodeSpan) generatedCodeSpan.textContent = '✅ Código enviado';
          if (adminCode22) adminCode22.focus();
          startTimer();
        } else {
          showMessage(codeMsg, '❌ Erro ao enviar código: ' + (data.error || 'tente novamente.'), 'error');
          if (generatedCodeSpan) generatedCodeSpan.textContent = '❌ Falha no envio';
        }
      })
      .catch(() => {
        showMessage(codeMsg, '❌ Falha na comunicação com o servidor.', 'error');
        if (generatedCodeSpan) generatedCodeSpan.textContent = '❌ Erro de conexão';
      })
      .finally(() => {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-paper-plane"></i> Reenviar';
      });
  }

  // ===== Verificar código via API =====
  function verifyCode() {
    if (!adminCode22) return;
    const input = adminCode22.value.trim();
    if (!input) {
      showMessage(codeMsg, 'Digite o código de verificação recebido.', 'error');
      return;
    }
    if (timeLeft <= 0) {
      showMessage(codeMsg, '⏰ Código expirado. Peça um novo.', 'error');
      return;
    }

    const btn = verifyCodeBtn;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando...';

    fetch('/api/verify-code-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: input })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          autenticarSucesso();
        } else {
          showMessage(codeMsg, '❌ ' + (data.error || 'Código incorreto.'), 'error');
          if (adminCode22) adminCode22.value = '';
          if (adminCode22) adminCode22.focus();
        }
      })
      .catch(() => {
        showMessage(codeMsg, '❌ Erro ao verificar código.', 'error');
      })
      .finally(() => {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-check"></i> Verificar';
      });
  }

  // ===== Autenticação bem-sucedida =====
  function autenticarSucesso() {
    clearInterval(timerInterval);
    showMessage(codeMsg, '✅ Autenticação completa!', 'success');
    setTimeout(() => {
      if (stepCode) stepCode.style.display = 'none';
      if (adminContent) adminContent.style.display = 'block';
      if (typeof loadAdminTable === 'function') loadAdminTable();
      if (typeof showAdminMsg === 'function') {
        showAdminMsg('Bem-vindo ao painel!', 'success');
      }
      sessionStorage.setItem('adminAuthenticated', 'true');
      // Carrega status da manutenção após login
      carregarStatusManutencao();
    }, 600);
  }

  // ===== PASSO 1: Verificar senha =====
  if (passwordBtn) {
    passwordBtn.addEventListener('click', function() {
      if (!adminPassword) return;
      const pass = adminPassword.value.trim();
      if (pass === storedPassword) {
        if (stepPassword) stepPassword.style.display = 'none';
        if (stepCode) stepCode.style.display = 'block';
        generateNewCode();
      } else {
        showMessage(passwordMsg, '❌ Senha incorreta.', 'error');
        if (adminPassword) adminPassword.value = '';
        if (adminPassword) adminPassword.focus();
      }
    });
  }

  if (adminPassword) {
    adminPassword.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && passwordBtn) passwordBtn.click();
    });
  }

  // ===== PASSO 2: Eventos do código =====
  if (verifyCodeBtn) {
    verifyCodeBtn.addEventListener('click', verifyCode);
  }
  if (adminCode22) {
    adminCode22.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') verifyCode();
    });
  }
  if (resendCodeBtn) {
    resendCodeBtn.addEventListener('click', function() {
      if (timeLeft > 0) {
        if (confirm('Gerar um novo código? O atual será invalidado.')) {
          generateNewCode();
        }
      } else {
        generateNewCode();
      }
    });
  }

  // ===== ALTERAR SENHA =====
  if (changePasswordBtn) {
    changePasswordBtn.addEventListener('click', function() {
      const newPass = newPasswordInput ? newPasswordInput.value.trim() : '';
      const confirmPass = confirmPasswordInput ? confirmPasswordInput.value.trim() : '';

      if (!newPass || newPass.length < 4) {
        showMessage(changePasswordMsg, 'A nova senha deve ter pelo menos 4 caracteres.', 'error');
        return;
      }
      if (newPass !== confirmPass) {
        showMessage(changePasswordMsg, 'As senhas não coincidem.', 'error');
        return;
      }

      localStorage.setItem(STORAGE_KEY, newPass);
      storedPassword = newPass;
      showMessage(changePasswordMsg, '✅ Senha alterada com sucesso!', 'success');
      if (newPasswordInput) newPasswordInput.value = '';
      if (confirmPasswordInput) confirmPasswordInput.value = '';
    });
  }

  // ===== MANUTENÇÃO =====
  async function carregarStatusManutencao() {
    try {
      const res = await fetch('/api/manutencao');
      if (!res.ok) throw new Error('Erro ao carregar status');
      const data = await res.json();
      atualizarBotaoManutencao(data.ativo);
    } catch (e) {
      console.warn('Erro ao carregar status de manutenção:', e);
      if (maintenanceStatus) maintenanceStatus.textContent = '⚠️ Erro';
    }
  }

  function atualizarBotaoManutencao(ativo) {
    if (!maintenanceStatus) return;
    if (ativo) {
      maintenanceStatus.textContent = '🔧 Manutenção: ATIVA';
      if (maintenanceBtn) maintenanceBtn.classList.add('active');
    } else {
      maintenanceStatus.textContent = '✅ Manutenção: DESATIVADA';
      if (maintenanceBtn) maintenanceBtn.classList.remove('active');
    }
  }

  if (maintenanceBtn) {
    maintenanceBtn.addEventListener('click', async function() {
      const isAtivo = maintenanceStatus && maintenanceStatus.textContent.includes('ATIVA');
      const novoStatus = !isAtivo;

      try {
        if (maintenanceStatus) maintenanceStatus.textContent = '⏳ Alternando...';
        maintenanceBtn.disabled = true;

        const res = await fetch('/api/manutencao', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ativo: novoStatus })
        });

        if (!res.ok) throw new Error('Erro ao alternar manutenção');
        const data = await res.json();

        if (data.success) {
          atualizarBotaoManutencao(data.ativo);
          alert(data.ativo ? '⚠️ Manutenção ativada!' : '✅ Manutenção desativada!');
        } else {
          throw new Error('Resposta inválida');
        }
      } catch (e) {
        console.error('Erro ao alternar manutenção:', e);
        if (maintenanceStatus) maintenanceStatus.textContent = '❌ Erro ao alternar';
        carregarStatusManutencao(); // recarrega para consistência
      } finally {
        maintenanceBtn.disabled = false;
      }
    });
  }

  // ===== Botões do admin (delegação de eventos) =====
  if (adminContent) {
    adminContent.addEventListener('click', function(e) {
      if (e.target.closest('#adminAddRowBtn')) {
        if (typeof window.adicionarHorarioAdmin === 'function') {
          window.adicionarHorarioAdmin();
        }
      }
      if (e.target.closest('#adminSaveBtn')) {
        if (typeof window.salvarHorariosAdmin === 'function') {
          window.salvarHorariosAdmin();
        }
      }
    });
  }

  // ===== Carregar horários =====
  if (typeof carregarHorariosDoBanco === 'function') {
    carregarHorariosDoBanco();
  }
});

// ===== Funções globais =====
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
  document.querySelectorAll('#adminTableBody tr').forEach(tr => {
    const inputs = tr.querySelectorAll('.admin-input');
    const checkboxes = tr.querySelectorAll('.dias-checkboxes input[type="checkbox"]');
    if (inputs.length >= 3) {
      const destino = inputs[0].value.trim();
      const horario = inputs[1].value.trim();
      const embarque = inputs[2].value.trim();
      const dias = [];
      checkboxes.forEach(cb => { if (cb.checked) dias.push(cb.value); });
      if (destino && horario && embarque && dias.length) {
        novasLinhas.push({ destino, horario, embarque, dias });
      }
    }
  });
  if (!novasLinhas.length) {
    showAdminMsg('Nenhum horário válido para salvar.', 'error');
    return;
  }
  allHorarios = novasLinhas;
  allHorarios.sort((a, b) => a.horario.localeCompare(b.horario));
  salvarHorariosNoBanco();
  loadAdminTable();
  renderCards();
};