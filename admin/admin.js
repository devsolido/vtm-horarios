// admin/admin.js – Login em 2 passos (senha + código de 22 dígitos enviado por e-mail)

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
  const CIRCUMFERENCE = 339.292; // 2 * PI * 54

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
    el.textContent = text;
    el.className = 'msg ' + type;
    el.style.display = 'block';
    // Limpa timeout anterior para não acumular
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
        generatedCodeSpan.textContent = '⌛ Código expirado';
        showMessage(codeMsg, '⏰ O código expirou. Clique em "Reenviar".', 'error');
      }
    }, 1000);
  }

  function updateTimerDisplay() {
    const progress = (timeLeft / TOTAL_TIME) * CIRCUMFERENCE;
    progressCircle.style.strokeDashoffset = CIRCUMFERENCE - progress;
    timerText.textContent = timeLeft + 's';
    timerText.style.color = timeLeft <= 10 ? '#ff6b6b' : '#00c6fb';
  }

  // ===== Gerar e enviar código por e-mail =====
  function generateNewCode() {
    const btn = resendCodeBtn;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';

    fetch('/api/send-code-email', { method: 'POST' })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          showMessage(codeMsg, '📧 Código enviado para seu e-mail!', 'success');
          generatedCodeSpan.textContent = '📧 Enviado para seu e-mail';
          adminCode22.value = '';
          adminCode22.focus();
          startTimer();
        } else {
          showMessage(codeMsg, '❌ Erro ao enviar e-mail: ' + (data.error || 'tente novamente.'), 'error');
        }
      })
      .catch(() => {
        showMessage(codeMsg, '❌ Falha na comunicação com o servidor.', 'error');
      })
      .finally(() => {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-paper-plane"></i> Reenviar';
      });
  }

  // ===== Verificar código via API =====
  function verifyCode() {
    const input = adminCode22.value.trim();
    if (!input) {
      showMessage(codeMsg, 'Digite o código recebido por e-mail.', 'error');
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
          clearInterval(timerInterval);
          showMessage(codeMsg, '✅ Autenticação completa!', 'success');
          setTimeout(() => {
            stepCode.style.display = 'none';
            adminContent.style.display = 'block';
            if (typeof loadAdminTable === 'function') loadAdminTable();
            if (typeof showAdminMsg === 'function') {
              showAdminMsg('Bem-vindo ao painel!', 'success');
            }
            // Sessão mantida apenas para esta guia – mas não pula mais a autenticação
            sessionStorage.setItem('adminAuthenticated', 'true');
          }, 600);
        } else {
          showMessage(codeMsg, '❌ ' + (data.error || 'Código incorreto.'), 'error');
          adminCode22.value = '';
          adminCode22.focus();
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

  // ===== PASSO 1: Verificar senha =====
  passwordBtn.addEventListener('click', function() {
    const pass = adminPassword.value.trim();
    if (pass === 'admin123') {
      stepPassword.style.display = 'none';
      stepCode.style.display = 'block';
      generateNewCode(); // envia o código automaticamente
    } else {
      showMessage(passwordMsg, '❌ Senha incorreta.', 'error');
      adminPassword.value = '';
      adminPassword.focus();
    }
  });

  adminPassword.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') passwordBtn.click();
  });

  // ===== PASSO 2: Eventos =====
  verifyCodeBtn.addEventListener('click', verifyCode);
  adminCode22.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') verifyCode();
  });

  resendCodeBtn.addEventListener('click', function() {
    if (timeLeft > 0) {
      if (confirm('Gerar um novo código? O atual será invalidado.')) {
        generateNewCode();
      }
    } else {
      generateNewCode();
    }
  });

  // ===== REMOVIDO: verificação de sessão – sempre exige autenticação completa =====
  // Agora, mesmo que sessionStorage tenha 'adminAuthenticated', a página sempre pedirá senha + código.
  // Isso garante que o segundo fator seja exigido a cada acesso.

  // ===== Carregar horários =====
  if (typeof carregarHorariosDoBanco === 'function') {
    carregarHorariosDoBanco();
  }

  // ===== Botões do admin =====
  document.getElementById('adminAddRowBtn').addEventListener('click', function() {
    if (typeof window.adicionarHorarioAdmin === 'function') {
      window.adicionarHorarioAdmin();
    }
  });

  document.getElementById('adminSaveBtn').addEventListener('click', function() {
    if (typeof window.salvarHorariosAdmin === 'function') {
      window.salvarHorariosAdmin();
    }
  });
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