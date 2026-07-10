// admin/admin.js – Login em 2 passos (senha + código de 22 dígitos)
// FALLBACK: código exibido na tela + tentativa de e-mail em segundo plano

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
        showMessage(codeMsg, '⏰ Código expirado. Clique em "Reenviar".', 'error');
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

  // ===== Gerar código (fallback local + e-mail em segundo plano) =====
  function generateNewCode() {
    // 1. Gera código localmente e exibe na tela
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 22; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    window._tempCode = code;
    if (generatedCodeSpan) generatedCodeSpan.textContent = code;
    if (adminCode22) {
      adminCode22.value = '';
      adminCode22.focus();
    }
    startTimer();
    showMessage(codeMsg, '🔑 Código gerado (copie e cole abaixo). Válido por 1 minuto.', 'info');

    // 2. Tenta enviar por e-mail em segundo plano (não bloqueia)
    if (resendCodeBtn) {
      const btn = resendCodeBtn;
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
      fetch('/api/send-code-email', { method: 'POST' })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            console.log('📧 Código também enviado por e-mail.');
            showMessage(codeMsg, '📧 Código também enviado para seu e-mail!', 'success');
          }
        })
        .catch(() => {})
        .finally(() => {
          btn.disabled = false;
          btn.innerHTML = '<i class="fas fa-paper-plane"></i> Reenviar';
        });
    }
  }

  // ===== Verificar código (local ou e-mail) =====
  function verifyCode() {
    if (!adminCode22) return;
    const input = adminCode22.value.trim();
    if (!input) {
      showMessage(codeMsg, 'Digite o código.', 'error');
      return;
    }
    if (timeLeft <= 0) {
      showMessage(codeMsg, '⏰ Código expirado. Gere um novo.', 'error');
      return;
    }

    // Verifica localmente (fallback)
    if (input === window._tempCode) {
      autenticarSucesso();
      return;
    }

    // Se não for o local, tenta verificar via API (e-mail)
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
    }, 600);
  }

  // ===== PASSO 1: Verificar senha =====
  if (passwordBtn) {
    passwordBtn.addEventListener('click', function() {
      if (!adminPassword) return;
      const pass = adminPassword.value.trim();
      if (pass === 'admin123') {
        if (stepPassword) stepPassword.style.display = 'none';
        if (stepCode) stepCode.style.display = 'block';
        generateNewCode(); // gera código localmente
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

  // ===== PASSO 2: Eventos =====
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

  // ===== Botões do admin (com verificação) =====
  const adminAddRowBtn = document.getElementById('adminAddRowBtn');
  if (adminAddRowBtn) {
    adminAddRowBtn.addEventListener('click', function() {
      if (typeof window.adicionarHorarioAdmin === 'function') {
        window.adicionarHorarioAdmin();
      }
    });
  }

  const adminSaveBtn = document.getElementById('adminSaveBtn');
  if (adminSaveBtn) {
    adminSaveBtn.addEventListener('click', function() {
      if (typeof window.salvarHorariosAdmin === 'function') {
        window.salvarHorariosAdmin();
      }
    });
  }

  // ===== Carregar horários =====
  if (typeof carregarHorariosDoBanco === 'function') {
    carregarHorariosDoBanco();
  }
});

// ===== Funções globais (compatíveis com script.js) =====
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