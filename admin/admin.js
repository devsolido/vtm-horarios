// ================================================================
//  ADMIN.JS – Painel Administrativo Que Horas Passa (VERSÃO FINAL)
//  Autenticação 2FA, CRUD, Manutenção, Estatísticas, Pesquisa
// ================================================================

// ================================================================
//  PROTEÇÃO: bloqueia exibição do conteúdo admin sem autenticação
// ================================================================
(function() {
  const content = document.getElementById('adminContent');
  if (content) {
    content.style.setProperty('display', 'none', 'important');
  }
})();

// ================================================================
//  FUNÇÃO PARA REGISTRAR ERROS (global)
// ================================================================
function logError(tipo, mensagem, stack = null, url = null) {
  try {
    fetch('/api/log-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo,
        mensagem,
        stack,
        url: url || window.location.href
      })
    }).catch(() => {});
  } catch (_) {}
}

// ================================================================
//  FUNÇÃO PARA REGISTRAR AÇÕES ADMINISTRATIVAS (global)
// ================================================================
function logAdminAction(acao, detalhes = null) {
  try {
    fetch('/api/log-admin-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        acao,
        detalhes: detalhes || {}
      })
    }).catch(() => {});
  } catch (_) {}
}

// ================================================================
//  CAPTURA DE ERROS GLOBAIS
// ================================================================
window.addEventListener('unhandledrejection', function(event) {
  logError(
    'Promise Rejection',
    event.reason?.message || String(event.reason),
    event.reason?.stack || null
  );
});

window.addEventListener('error', function(event) {
  logError(
    'Runtime Error',
    event.message,
    event.error?.stack || null
  );
});

const originalConsoleError = console.error;
console.error = function(...args) {
  originalConsoleError.apply(console, args);
  const mensagem = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
  logError('Console Error', mensagem);
};

document.addEventListener('DOMContentLoaded', function() {

  // ================================================================
  //  1. ELEMENTOS DO DOM
  // ================================================================

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

  // 🔑 Senha – usada apenas para alteração (localStorage)
  const STORAGE_KEY = 'vtm_admin_password';
  let storedPassword = localStorage.getItem(STORAGE_KEY) || 'admin123';

  const newPasswordInput = document.getElementById('newPassword');
  const confirmPasswordInput = document.getElementById('confirmPassword');
  const changePasswordBtn = document.getElementById('changePasswordBtn');
  const changePasswordMsg = document.getElementById('changePasswordMsg');

  const logoutBtn = document.getElementById('logoutBtn');

  const maintenanceToggle = document.getElementById('maintenanceToggle');
  const maintenanceStatusLabel = document.getElementById('maintenanceStatus');
  const statManutencao = document.getElementById('statManutencao');

  const searchInput = document.getElementById('searchInput');
  const filterChips = document.querySelectorAll('.filter-chip');

  const adminTableBody = document.getElementById('adminTableBody');
  const adminRowCount = document.getElementById('adminRowCount');

  const confirmModal = document.getElementById('confirmModal');
  const confirmMessage = document.getElementById('confirmMessage');
  const confirmCancelBtn = document.getElementById('confirmCancelBtn');
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');

  const toastContainer = document.getElementById('toast-container');

  // ================================================================
  //  2. VARIÁVEIS DE ESTADO
  // ================================================================

  let timerInterval = null;
  let timeLeft = 60;
  const TOTAL_TIME = 60;
  const CIRCUMFERENCE = 339.292;

  let manutencaoAtiva = false;
  let searchTerm = '';
  let activeFilter = 'all';
  let pendingDeleteIdx = null;

  // ================================================================
  //  3. TOAST (feedback visual)
  // ================================================================

  function showToast(message, type = 'info') {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = {
      success: 'fa-check-circle',
      error: 'fa-exclamation-circle',
      info: 'fa-info-circle',
      warning: 'fa-triangle-exclamation'
    };
    toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${message}</span>`;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 400);
    }, 4000);
  }

  // ================================================================
  //  4. RELÓGIO E CLIMA (compartilhados com script.js)
  // ================================================================

  function atualizarAdmin() {
    if (typeof updateClock === 'function') updateClock();
    if (typeof updateDateAndGreeting === 'function') updateDateAndGreeting();
    if (typeof fetchWeather === 'function') fetchWeather();
  }
  atualizarAdmin();
  setInterval(atualizarAdmin, 1000);
  setInterval(() => {
    if (typeof fetchWeather === 'function') fetchWeather();
  }, 600000);

  // ================================================================
  //  5. MENSAGENS
  // ================================================================

  function showMessage(el, text, type = 'info') {
    if (!el) return;
    el.textContent = text;
    el.className = 'msg ' + type;
    el.style.display = 'block';
    clearTimeout(el._timeout);
    el._timeout = setTimeout(() => { el.style.display = 'none'; }, 5000);
  }

  // ================================================================
  //  6. AUTENTICAÇÃO – SENHA + CÓDIGO DE 22 DÍGITOS
  // ================================================================

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
      .catch((err) => {
        showMessage(codeMsg, '❌ Falha na comunicação com o servidor.', 'error');
        if (generatedCodeSpan) generatedCodeSpan.textContent = '❌ Erro de conexão';
        logError('Erro envio código', err.message, err.stack);
      })
      .finally(() => {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-paper-plane"></i> Reenviar';
      });
  }

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
      .catch((err) => {
        showMessage(codeMsg, '❌ Erro ao verificar código.', 'error');
        logError('Erro verificação código', err.message, err.stack);
      })
      .finally(() => {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-check"></i> Verificar';
      });
  }

  // ================================================================
  //  AUTENTICAÇÃO BEM-SUCEDIDA (com !important para exibir)
  // ================================================================
  function autenticarSucesso() {
    clearInterval(timerInterval);
    showMessage(codeMsg, '✅ Autenticação completa!', 'success');
    // Log de login bem-sucedido
    logAdminAction('login', { sucesso: true });
    setTimeout(() => {
      if (stepCode) stepCode.style.display = 'none';
      if (adminContent) {
        adminContent.style.setProperty('display', 'block', 'important');
        adminContent.classList.add('admin-content-visible');
      }
      if (logoutBtn) logoutBtn.style.display = 'flex';
      sessionStorage.setItem('adminAuthenticated', 'true');
      carregarDadosAdmin();
      carregarStatusManutencao();
    }, 600);
  }

  // ================================================================
  //  🔐 VERIFICAÇÃO DE SENHA – VIA API (proteção contra força bruta)
  // ================================================================
  if (passwordBtn) {
    passwordBtn.addEventListener('click', async function() {
      if (!adminPassword) return;
      const pass = adminPassword.value.trim();

      passwordBtn.disabled = true;
      passwordBtn.textContent = 'Verificando...';

      try {
        const res = await fetch('/api/check-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ senha: pass })
        });

        const data = await res.json();

        if (data.success) {
          showMessage(passwordMsg, '✅ Senha correta!', 'success');
          if (stepPassword) stepPassword.style.display = 'none';
          if (stepCode) stepCode.style.display = 'block';
          generateNewCode();
        } else if (data.blocked) {
          showMessage(passwordMsg, `⛔ ${data.error}`, 'error');
          if (adminPassword) adminPassword.value = '';
          if (adminPassword) adminPassword.focus();
        } else {
          const restantes = data.maxAttempts - (data.attempts || 0);
          showMessage(passwordMsg, `❌ Senha incorreta. Tentativas restantes: ${restantes}`, 'error');
          if (adminPassword) adminPassword.value = '';
          if (adminPassword) adminPassword.focus();
        }
      } catch (err) {
        console.error('Erro ao verificar login:', err);
        showMessage(passwordMsg, '❌ Erro ao conectar ao servidor. Tente novamente.', 'error');
        logError('Erro verificação senha', err.message, err.stack);
      } finally {
        passwordBtn.disabled = false;
        passwordBtn.textContent = 'Verificar senha';
      }
    });
  }

  if (adminPassword) {
    adminPassword.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && passwordBtn) passwordBtn.click();
    });
  }

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

  // ================================================================
  //  7. LOGOUT
  // ================================================================

  if (logoutBtn) {
    logoutBtn.addEventListener('click', function() {
      sessionStorage.removeItem('adminAuthenticated');
      location.reload();
    });
  }

  // ================================================================
  //  8. ALTERAR SENHA (ainda usa localStorage – futuramente será migrado)
  // ================================================================

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
      logAdminAction('alterar_senha', { sucesso: true });
      if (newPasswordInput) newPasswordInput.value = '';
      if (confirmPasswordInput) confirmPasswordInput.value = '';
    });
  }

  // ================================================================
  //  9. TOGGLE VISIBILIDADE DA SENHA
  // ================================================================

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

  // ================================================================
  //  10. MANUTENÇÃO – SWITCH E API
  // ================================================================

  async function carregarStatusManutencao() {
    try {
      const res = await fetch('/api/manutencao');
      if (!res.ok) throw new Error('Erro ao carregar status');
      const data = await res.json();
      manutencaoAtiva = data.ativo;
      atualizarSwitchManutencao(manutencaoAtiva);
    } catch (e) {
      console.warn('Erro ao carregar status de manutenção:', e);
      logError('Erro carregar manutenção', e.message, e.stack);
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
          logAdminAction('alternar_manutencao', { ativo: data.ativo });
          showToast(manutencaoAtiva ? '⚠️ Manutenção ativada!' : '✅ Manutenção desativada!', manutencaoAtiva ? 'warning' : 'success');
        } else {
          throw new Error('Resposta inválida');
        }
      } catch (e) {
        console.error('Erro ao alternar manutenção:', e);
        showToast('❌ Erro ao alternar manutenção', 'error');
        logError('Erro alternar manutenção', e.message, e.stack);
        this.checked = !this.checked;
      } finally {
        this.disabled = false;
      }
    });
  }

  // ================================================================
  //  11. ESTATÍSTICAS (CARDS)
  // ================================================================

  function atualizarStats() {
    try {
      const total = allHorarios ? allHorarios.length : 0;
      const destinos = allHorarios ? [...new Set(allHorarios.map(h => h.destino))].length : 0;
      const elTotal = document.getElementById('statTotalHorarios');
      const elDestinos = document.getElementById('statDestinos');
      if (elTotal) elTotal.textContent = total;
      if (elDestinos) elDestinos.textContent = destinos;
      const elStatus = document.getElementById('statStatus');
      if (elStatus) {
        elStatus.textContent = 'Online';
        elStatus.style.color = '#00c864';
      }
    } catch (e) {
      logError('Erro atualizar stats', e.message, e.stack);
    }
  }

  // ================================================================
  //  12. PESQUISA E FILTROS
  // ================================================================

  function filtrarTabela() {
    try {
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
      const totalVisiveis = document.querySelectorAll('#adminTableBody tr:not([style*="display: none;"])').length;
      if (adminRowCount) adminRowCount.textContent = totalVisiveis + ' horários';
    } catch (e) {
      logError('Erro filtrar tabela', e.message, e.stack);
    }
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

  // ================================================================
  //  13. FUNÇÃO PARA CARREGAR DADOS DO ADMIN
  // ================================================================

  function carregarDadosAdmin() {
    try {
      if (typeof allHorarios !== 'undefined' && allHorarios.length > 0) {
        if (typeof loadAdminTable === 'function') {
          loadAdminTable();
          atualizarStats();
          setTimeout(filtrarTabela, 300);
        }
        return;
      }

      if (typeof carregarHorariosDoBanco === 'function') {
        carregarHorariosDoBanco();
        let tentativas = 0;
        const maxTentativas = 10;
        const intervalo = setInterval(() => {
          tentativas++;
          if (typeof allHorarios !== 'undefined' && allHorarios.length > 0) {
            clearInterval(intervalo);
            if (typeof loadAdminTable === 'function') {
              loadAdminTable();
              atualizarStats();
              filtrarTabela();
              console.log('✅ Tabela carregada após dados serem obtidos.');
            }
          } else if (tentativas >= maxTentativas) {
            clearInterval(intervalo);
            console.warn('⚠️ Não foi possível carregar os dados após várias tentativas.');
          }
        }, 300);
      } else {
        if (typeof loadAdminTable === 'function') {
          loadAdminTable();
          atualizarStats();
          setTimeout(filtrarTabela, 300);
        }
      }
    } catch (e) {
      logError('Erro carregar dados admin', e.message, e.stack);
    }
  }

  // ================================================================
  //  14. CRUD DE HORÁRIOS (compartilhado com script.js)
  // ================================================================

  window.adicionarHorarioAdmin = function() {
    try {
      console.log('🔵 Adicionando horário...');
      if (typeof allHorarios === 'undefined') {
        showToast('Erro: dados não carregados.', 'error');
        return;
      }
      allHorarios.push({
        destino: 'Novo destino',
        horario: '12:00',
        embarque: 'Local',
        dias: ['Segunda a Sexta']
      });
      // Log de ação
      logAdminAction('adicionar_horario', { destino: 'Novo destino' });
      if (typeof loadAdminTable === 'function') {
        loadAdminTable();
      } else {
        console.warn('loadAdminTable não definida');
      }
      if (typeof showAdminMsg === 'function') {
        showAdminMsg('Novo horário adicionado. Edite os campos e salve.', 'info');
      }
      setTimeout(() => {
        atualizarStats();
        filtrarTabela();
      }, 200);
    } catch (e) {
      showToast('❌ Erro ao adicionar horário.', 'error');
      logError('Erro adicionar horário', e.message, e.stack);
    }
  };

  window.salvarHorariosAdmin = function() {
    try {
      console.log('🔵 Salvando alterações...');
      if (typeof allHorarios === 'undefined') {
        showToast('Erro: dados não carregados.', 'error');
        return;
      }
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
        if (typeof showAdminMsg === 'function') {
          showAdminMsg('⚠️ Preencha todos os campos (Destino e Horário são obrigatórios).', 'error');
        } else {
          showToast('Preencha todos os campos (Destino e Horário são obrigatórios).', 'error');
        }
        return;
      }
      if (!novasLinhas.length) {
        if (typeof showAdminMsg === 'function') {
          showAdminMsg('Nenhum horário válido para salvar.', 'error');
        } else {
          showToast('Nenhum horário válido para salvar.', 'error');
        }
        return;
      }
      allHorarios = novasLinhas;
      allHorarios.sort((a, b) => a.horario.localeCompare(b.horario));
      if (typeof salvarHorariosNoBanco === 'function') {
        salvarHorariosNoBanco();
      } else {
        console.warn('salvarHorariosNoBanco não definida');
      }
      // Log de ação
      logAdminAction('salvar_horarios', { quantidade: novasLinhas.length });
      if (typeof loadAdminTable === 'function') loadAdminTable();
      if (typeof renderCards === 'function') renderCards();
      setTimeout(() => {
        atualizarStats();
        filtrarTabela();
      }, 300);
      showToast('✅ Horários salvos com sucesso!', 'success');
    } catch (e) {
      showToast('❌ Erro ao salvar horários.', 'error');
      logError('Erro salvar horários', e.message, e.stack);
    }
  };

  window.confirmarExclusao = function(idx, destino) {
    pendingDeleteIdx = idx;
    confirmMessage.textContent = `Tem certeza que deseja excluir o horário para ${destino}?`;
    confirmModal.classList.add('active');
  };

  window.removerHorarioAdmin = function(idx) {
    if (typeof allHorarios !== 'undefined' && allHorarios[idx]) {
      window.confirmarExclusao(idx, allHorarios[idx].destino);
    }
  };

  if (confirmCancelBtn) {
    confirmCancelBtn.addEventListener('click', function() {
      confirmModal.classList.remove('active');
      pendingDeleteIdx = null;
    });
  }
  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', function() {
      try {
        if (pendingDeleteIdx !== null && typeof allHorarios !== 'undefined') {
          const destino = allHorarios[pendingDeleteIdx]?.destino || 'desconhecido';
          allHorarios.splice(pendingDeleteIdx, 1);
          if (typeof loadAdminTable === 'function') loadAdminTable();
          if (typeof salvarHorariosNoBanco === 'function') salvarHorariosNoBanco();
          if (typeof showAdminMsg === 'function') {
            showAdminMsg('Horário removido com sucesso.', 'info');
          } else {
            showToast('Horário removido.', 'info');
          }
          // Log de ação
          logAdminAction('remover_horario', { destino });
          setTimeout(() => {
            atualizarStats();
            filtrarTabela();
          }, 200);
        }
        confirmModal.classList.remove('active');
        pendingDeleteIdx = null;
      } catch (e) {
        logError('Erro remover horário', e.message, e.stack);
        confirmModal.classList.remove('active');
        pendingDeleteIdx = null;
      }
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

  // ================================================================
  //  15. DELEGAÇÃO DE EVENTOS GLOBAL
  // ================================================================

  document.addEventListener('click', function(e) {
    const btnAdd = e.target.closest('#adminAddRowBtn');
    if (btnAdd) {
      console.log('🔵 Clique no Adicionar horário detectado');
      if (typeof window.adicionarHorarioAdmin === 'function') {
        window.adicionarHorarioAdmin();
        setTimeout(() => filtrarTabela(), 100);
      } else {
        console.error('adicionarHorarioAdmin não definida');
      }
      return;
    }

    const btnSave = e.target.closest('#adminSaveBtn');
    if (btnSave) {
      console.log('🔵 Clique no Salvar alterações detectado');
      if (typeof window.salvarHorariosAdmin === 'function') {
        window.salvarHorariosAdmin();
      } else {
        console.error('salvarHorariosAdmin não definida');
      }
      return;
    }
  });

  // ================================================================
  //  16. CARREGAR DADOS E INICIALIZAR
  // ================================================================

  carregarStatusManutencao();

  if (sessionStorage.getItem('adminAuthenticated') === 'true') {
    if (stepPassword) stepPassword.style.display = 'none';
    if (stepCode) stepCode.style.display = 'none';
    if (adminContent) {
      adminContent.style.setProperty('display', 'block', 'important');
      adminContent.classList.add('admin-content-visible');
    }
    if (logoutBtn) logoutBtn.style.display = 'flex';
    carregarDadosAdmin();
  }

  // ================================================================
  //  17. EXPOR FUNÇÕES PARA USO GLOBAL
  // ================================================================

  window.atualizarStats = atualizarStats;
  window.filtrarTabela = filtrarTabela;
  window.atualizarSwitchManutencao = atualizarSwitchManutencao;
  window.carregarStatusManutencao = carregarStatusManutencao;
  window.carregarDadosAdmin = carregarDadosAdmin;

  console.log('✅ Admin.js carregado com sucesso!');
});