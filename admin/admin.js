// admin/admin.js – Painel redesenho

document.addEventListener('DOMContentLoaded', function() {

  // ===== ELEMENTOS =====
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

  const STORAGE_KEY = 'vtm_admin_password';
  let storedPassword = localStorage.getItem(STORAGE_KEY) || 'admin123';

  const newPasswordInput = document.getElementById('newPassword');
  const confirmPasswordInput = document.getElementById('confirmPassword');
  const changePasswordBtn = document.getElementById('changePasswordBtn');
  const changePasswordMsg = document.getElementById('changePasswordMsg');

  const logoutBtn = document.getElementById('logoutBtn');

  let timerInterval = null;
  let timeLeft = 60;
  const TOTAL_TIME = 60;
  const CIRCUMFERENCE = 339.292;

  let manutencaoAtiva = false;

  // ===== TOAST =====
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle', warning: 'fa-triangle-exclamation' };
    toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 400);
    }, 4000);
  }

  // ===== ATUALIZA RELÓGIO E CLIMA =====
  function atualizarAdmin() {
    if (typeof updateClock === 'function') updateClock();
    if (typeof updateDateAndGreeting === 'function') updateDateAndGreeting();
    if (typeof fetchWeather === 'function') fetchWeather();
  }
  atualizarAdmin();
  setInterval(atualizarAdmin, 1000);
  setInterval(() => { if (typeof fetchWeather === 'function') fetchWeather(); }, 600000);

  // ===== MOSTRAR MENSAGEM =====
  function showMessage(el, text, type = 'info') {
    if (!el) return;
    el.textContent = text;
    el.className = 'msg ' + type;
    el.style.display = 'block';
    clearTimeout(el._timeout);
    el._timeout = setTimeout(() => { el.style.display = 'none'; }, 5000);
  }

  // ===== TIMER =====
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

  // ===== GERAR CÓDIGO =====
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

  // ===== VERIFICAR CÓDIGO =====
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

  // ===== AUTENTICAÇÃO SUCESSO =====
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
      if (logoutBtn) logoutBtn.style.display = 'flex';
      carregarStatusManutencao();
      atualizarStats();
    }, 600);
  }

  // ===== PASSO 1: SENHA =====
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

  // ===== PASSO 2: CÓDIGO =====
  if (verifyCodeBtn) verifyCodeBtn.addEventListener('click', verifyCode);
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

  // ===== LOGOUT =====
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function() {
      sessionStorage.removeItem('adminAuthenticated');
      location.reload();
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

  // ===== SWITCH DE MANUTENÇÃO =====
  const maintenanceToggle = document.getElementById('maintenanceToggle');
  const maintenanceStatusLabel = document.getElementById('maintenanceStatus');
  const statManutencao = document.getElementById('statManutencao');

  async function carregarStatusManutencao() {
    try {
      const res = await fetch('/api/manutencao');
      if (!res.ok) throw new Error('Erro ao carregar status');
      const data = await res.json();
      manutencaoAtiva = data.ativo;
      atualizarSwitchManutencao(manutencaoAtiva);
    } catch (e) {
      console.warn('Erro ao carregar status de manutenção:', e);
    }
  }

  function atualizarSwitchManutencao(ativo) {
    if (maintenanceToggle) {
      maintenanceToggle.checked = ativo;
    }
    if (maintenanceStatusLabel) {
      maintenanceStatusLabel.textContent = ativo ? 'ATIVA' : 'DESATIVADA';
      maintenanceStatusLabel.className = 'status-label ' + (ativo ? 'ativa' : 'desativada');
    }
    if (statManutencao) {
      statManutencao.textContent = ativo ? 'Ativa' : 'Desativada';
      statManutencao.style.color = ativo ? '#ff6b6b' : '#00c864';
    }
  }

  if (maintenanceToggle) {
    maintenanceToggle.addEventListener('change', async function() {
      const novoStatus = this.checked;
      try {
        this.disabled = true;
        const res = await fetch('/api/manutencao', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ativo: novoStatus })
        });
        if (!res.ok) throw new Error('Erro ao alternar manutenção');
        const data = await res.json();
        if (data.success) {
          manutencaoAtiva = data.ativo;
          atualizarSwitchManutencao(manutencaoAtiva);
          showToast(manutencaoAtiva ? '⚠️ Manutenção ativada!' : '✅ Manutenção desativada!', manutencaoAtiva ? 'warning' : 'success');
        } else {
          throw new Error('Resposta inválida');
        }
      } catch (e) {
        console.error('Erro ao alternar manutenção:', e);
        showToast('❌ Erro ao alternar manutenção', 'error');
        // Reverte o estado
        this.checked = !this.checked;
      } finally {
        this.disabled = false;
      }
    });
  }

  // ===== STATS =====
  function atualizarStats() {
    const total = allHorarios ? allHorarios.length : 0;
    const destinos = allHorarios ? [...new Set(allHorarios.map(h => h.destino))].length : 0;
    document.getElementById('statTotalHorarios').textContent = total;
    document.getElementById('statDestinos').textContent = destinos;
    document.getElementById('statStatus').textContent = 'Online';
    document.getElementById('statStatus').style.color = '#00c864';
  }

  // ===== PESQUISA E FILTROS =====
  const searchInput = document.getElementById('searchInput');
  const filterChips = document.querySelectorAll('.filter-chip');

  let searchTerm = '';
  let activeFilter = 'all';

  function filtrarTabela() {
    const rows = document.querySelectorAll('#adminTableBody tr');
    const term = searchTerm.toLowerCase().trim();
    rows.forEach(row => {
      const destino = (row.querySelector('td:first-child input')?.value || '').toLowerCase();
      const horario = (row.querySelector('td:nth-child(2) input')?.value || '').toLowerCase();
      const embarque = (row.querySelector('td:nth-child(3) input')?.value || '').toLowerCase();
      const dias = row.querySelectorAll('.dias-checkboxes input[type="checkbox"]');
      const diasSelecionados = [];
      dias.forEach(cb => { if (cb.checked) diasSelecionados.push(cb.value); });

      const matchSearch = !term || destino.includes(term) || horario.includes(term) || embarque.includes(term);
      let matchFilter = true;
      if (activeFilter !== 'all') {
        matchFilter = diasSelecionados.includes(activeFilter);
      }
      row.style.display = (matchSearch && matchFilter) ? '' : 'none';
    });
    const visiveis = document.querySelectorAll('#adminTableBody tr[style*="display: none;"]');
    const totalVisiveis = document.querySelectorAll('#adminTableBody tr:not([style*="display: none;"])').length;
    document.getElementById('adminRowCount').textContent = totalVisiveis + ' horários';
  }

  if (searchInput) {
    searchInput.addEventListener('input', function() {
      searchTerm = this.value;
      filtrarTabela();
    });
  }

  filterChips.forEach(chip => {
    chip.addEventListener('click', function() {
      filterChips.forEach(c => c.classList.remove('active'));
      this.classList.add('active');
      activeFilter = this.dataset.filter;
      filtrarTabela();
    });
  });

  // ===== BOTÕES DO ADMIN (delegação) =====
  if (adminContent) {
    adminContent.addEventListener('click', function(e) {
      const btnAdd = e.target.closest('#adminAddRowBtn');
      if (btnAdd) {
        if (typeof window.adicionarHorarioAdmin === 'function') {
          window.adicionarHorarioAdmin();
          setTimeout(() => filtrarTabela(), 100);
        }
      }
      const btnSave = e.target.closest('#adminSaveBtn');
      if (btnSave) {
        if (typeof window.salvarHorariosAdmin === 'function') {
          window.salvarHorariosAdmin();
        }
      }
    });
  }

  // ===== CARREGAR HORÁRIOS =====
  if (typeof carregarHorariosDoBanco === 'function') {
    carregarHorariosDoBanco();
  }

  // ===== INIT =====
  carregarStatusManutencao();

  // ===== RECARREGAR STATS APÓS ALTERAÇÕES =====
  const origLoad = window.loadAdminTable;
  if (origLoad) {
    window.loadAdminTable = function() {
      origLoad.apply(this, arguments);
      atualizarStats();
      setTimeout(() => filtrarTabela(), 200);
    };
  }

  // ===== VERIFICA SESSÃO =====
  if (sessionStorage.getItem('adminAuthenticated') === 'true') {
    if (stepPassword) stepPassword.style.display = 'none';
    if (stepCode) stepCode.style.display = 'none';
    if (adminContent) adminContent.style.display = 'block';
    if (logoutBtn) logoutBtn.style.display = 'flex';
    if (typeof loadAdminTable === 'function') {
      loadAdminTable();
      setTimeout(() => {
        atualizarStats();
        filtrarTabela();
      }, 300);
    }
    carregarStatusManutencao();
  }

  // ===== TOGGLE SENHA =====
  document.querySelectorAll('.toggle-password').forEach(btn => {
    btn.addEventListener('click', function() {
      const targetId = this.dataset.target;
      const input = document.getElementById(targetId);
      if (input) {
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        this.innerHTML = isPassword ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
      }
    });
  });

  // ===== CONFIRMAÇÃO DE EXCLUSÃO (delegação) =====
  const confirmModal = document.getElementById('confirmModal');
  const confirmMessage = document.getElementById('confirmMessage');
  const confirmCancelBtn = document.getElementById('confirmCancelBtn');
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
  let pendingDeleteIdx = null;

  window.confirmarExclusao = function(idx, destino) {
    pendingDeleteIdx = idx;
    confirmMessage.textContent = `Tem certeza que deseja excluir o horário para ${destino}?`;
    confirmModal.classList.add('active');
  };

  if (confirmCancelBtn) {
    confirmCancelBtn.addEventListener('click', function() {
      confirmModal.classList.remove('active');
      pendingDeleteIdx = null;
    });
  }
  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', function() {
      if (pendingDeleteIdx !== null && typeof window.removerHorarioAdmin === 'function') {
        window.removerHorarioAdmin(pendingDeleteIdx);
      }
      confirmModal.classList.remove('active');
      pendingDeleteIdx = null;
    });
  }
  if (confirmModal) {
    confirmModal.addEventListener('click', function(e) {
      if (e.target === this) {
        confirmModal.classList.remove('active');
        pendingDeleteIdx = null;
      }
    });
  }

  // Sobrescreve a exclusão para usar o modal
  const origRemover = window.removerHorarioAdmin;
  if (origRemover) {
    window.removerHorarioAdmin = function(idx) {
      if (allHorarios && allHorarios[idx]) {
        window.confirmarExclusao(idx, allHorarios[idx].destino);
      }
    };
  }

  // ===== EXPOR FUNÇÕES GLOBAIS =====
  window.removerHorarioAdmin = window.removerHorarioAdmin || function(idx) {
    if (allHorarios && allHorarios[idx]) {
      window.confirmarExclusao(idx, allHorarios[idx].destino);
    }
  };

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
    setTimeout(() => atualizarStats(), 200);
  };

  window.salvarHorariosAdmin = function() {
    const novasLinhas = [];
    let temErro = false;
    document.querySelectorAll('#adminTableBody tr').forEach(tr => {
      const inputs = tr.querySelectorAll('.admin-input');
      const checkboxes = tr.querySelectorAll('.dias-checkboxes input[type="checkbox"]');
      if (inputs.length >= 3) {
        const destino = inputs[0].value.trim();
        const horario = inputs[1].value.trim();
        const embarque = inputs[2].value.trim();
        if (!destino || !horario) {
          temErro = true;
          tr.style.border = '2px solid #ff6b6b';
          return;
        }
        tr.style.border = '';
        const dias = [];
        checkboxes.forEach(cb => { if (cb.checked) dias.push(cb.value); });
        if (destino && horario && embarque && dias.length) {
          novasLinhas.push({ destino, horario, embarque, dias });
        }
      }
    });
    if (temErro) {
      showAdminMsg('⚠️ Preencha todos os campos (Destino e Horário são obrigatórios).', 'error');
      return;
    }
    if (!novasLinhas.length) {
      showAdminMsg('Nenhum horário válido para salvar.', 'error');
      return;
    }
    allHorarios = novasLinhas;
    allHorarios.sort((a, b) => a.horario.localeCompare(b.horario));
    salvarHorariosNoBanco();
    loadAdminTable();
    renderCards();
    setTimeout(() => {
      atualizarStats();
      filtrarTabela();
    }, 300);
  };
});