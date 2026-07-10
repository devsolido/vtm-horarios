// ================================================================
//  CONTROLE DE MANUTENÇÃO (caminho absoluto)
// ================================================================
fetch('/manutencao-status.json?' + new Date().getTime())
  .then((res) => res.json())
  .then((data) => {
    if (data.ativo) {
      localStorage.setItem('manutencao_ativa', 'true');
      window.location.href = 'manutencao.html';
    } else {
      localStorage.removeItem('manutencao_ativa');
    }
  })
  .catch(() => {
    localStorage.removeItem('manutencao_ativa');
  });

// ================================================================
//  RATE LIMIT E SANITIZAÇÃO
// ================================================================
const rateLimit = (() => {
  const timestamps = {};
  return (action, limit = 3, windowMs = 5000) => {
    const now = Date.now();
    if (!timestamps[action]) timestamps[action] = [];
    timestamps[action] = timestamps[action].filter((t) => now - t < windowMs);
    if (timestamps[action].length >= limit) {
      console.warn('⛔ Rate limit excedido para:', action);
      return false;
    }
    timestamps[action].push(now);
    return true;
  };
})();

function sanitize(str) {
  if (!str) return '';
  const el = document.createElement('div');
  el.textContent = str;
  return el.innerHTML;
}

let weatherFetchInProgress = false;
let weatherCache = null;
let weatherCacheTime = 0;
const WEATHER_CACHE_TTL = 600000;

// ================================================================
//  VARIÁVEIS GLOBAIS
// ================================================================
let currentFilter = 'all';
let allHorarios = [];
let alertaDisparado = {};

// ================================================================
//  TEMA – com verificação
// ================================================================
const themeToggle = document.getElementById('themeToggle');
const iconTheme = themeToggle ? themeToggle.querySelector('i') : null;

function setTheme(theme) {
  if (theme === 'light') {
    document.body.classList.add('light-mode');
    if (iconTheme) iconTheme.className = 'fas fa-sun';
    localStorage.setItem('vtm_theme', 'light');
  } else {
    document.body.classList.remove('light-mode');
    if (iconTheme) iconTheme.className = 'fas fa-moon';
    localStorage.setItem('vtm_theme', 'dark');
  }
}

function toggleTheme() {
  const current = document.body.classList.contains('light-mode') ? 'light' : 'dark';
  setTheme(current === 'light' ? 'dark' : 'light');
}

const savedTheme = localStorage.getItem('vtm_theme') || 'dark';
setTheme(savedTheme);

if (themeToggle) {
  themeToggle.addEventListener('click', toggleTheme);
}

// ================================================================
//  SERVICE WORKER
// ================================================================
if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('/sw.js')
    .then(() => console.log('✅ Service Worker registrado com sucesso.'))
    .catch((err) => console.warn('⚠️ SW falhou:', err));
}

// ================================================================
//  HORÁRIOS INICIAIS (fallback)
// ================================================================
const horariosFallback = [
  { destino: 'Morada Nova', horario: '11:35', embarque: 'Antônio Vilhena', dias: ['Sábado'] },
  { destino: 'Morada Nova', horario: '16:48', embarque: 'Antônio Vilhena', dias: ['Domingo'] },
  { destino: 'Morada Nova', horario: '17:42', embarque: 'Antônio Vilhena', dias: ['Domingo'] },
  { destino: 'Liberdade', horario: '07:15', embarque: 'Terminal de Integração', dias: ['Segunda a Sexta'] },
  { destino: 'Bela Vista', horario: '13:40', embarque: 'Terminal', dias: ['Segunda a Sexta'] },
  { destino: 'Liberdade', horario: '13:09', embarque: 'Praça São Francisco', dias: ['Sábado'] },
  { destino: 'Liberdade', horario: '12:41', embarque: 'Terminal', dias: ['Sábado'] },
  { destino: 'São Félix', horario: '06:10', embarque: 'Antônio Vilhena', dias: ['Segunda a Sexta'] },
  { destino: 'Liberdade', horario: '12:18', embarque: 'Cidade Nova - Praça', dias: ['Segunda a Sexta'] },
  { destino: 'Liberdade', horario: '16:00', embarque: 'Praça', dias: ['Segunda a Sexta'] },
  { destino: 'Liberdade', horario: '18:30', embarque: 'Praça São Francisco', dias: ['Segunda a Sexta'] },
];
horariosFallback.sort((a, b) => a.horario.localeCompare(b.horario));

// ================================================================
//  DOM REFS (com verificação para páginas que não têm esses elementos)
// ================================================================
const container = document.getElementById('cardsContainer');
const nextBusInfo = document.getElementById('nextBusInfo');
const fullDateSpan = document.getElementById('fullDate');
const alertModal = document.getElementById('alertModal');
const alertMessage = document.getElementById('alertMessage');
const alertSubMsg = document.getElementById('alertSubMsg');
const closeAlertBtn = document.getElementById('closeAlertBtn');
const filterIndicator = document.getElementById('filterIndicator');

// ================================================================
//  UTILITÁRIOS
// ================================================================
function getCurrentDay() {
  const days = [
    'Domingo', 'Segunda a Sexta', 'Segunda a Sexta',
    'Segunda a Sexta', 'Segunda a Sexta', 'Segunda a Sexta',
    'Sábado'
  ];
  return days[new Date().getDay()];
}

function getDiaLabel(dia) {
  const map = {
    'Segunda a Sexta': 'dias úteis',
    Sábado: 'sábados',
    Domingo: 'domingos',
  };
  return map[dia] || dia;
}

function getMinutesFromTime(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function getCurrentMinutes() {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
}

function formatDateFull(d) {
  return d
    .toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
    .replace(/^(\d+)\s+de\s+(\w+)/, (_, day, month) => day + ' de ' + month.charAt(0).toUpperCase() + month.slice(1));
}

function formatCountdown(minDiff) {
  if (minDiff < 0) return 'Já passou';
  if (minDiff < 1) return 'Agora!';
  const h = Math.floor(minDiff / 60);
  const m = Math.round(minDiff % 60);
  return h > 0 ? h + 'h ' + m + 'min' : m + ' min';
}

function speak(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(sanitize(text));
  utter.lang = 'pt-BR';
  utter.rate = 0.9;
  utter.pitch = 1.0;
  const voices = window.speechSynthesis.getVoices();
  const brVoice = voices.find((v) => v.lang === 'pt-BR');
  if (brVoice) utter.voice = brVoice;
  window.speechSynthesis.speak(utter);
}

function playBeep() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 880;
    gainNode.gain.value = 0.3;
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start();
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
    oscillator.stop(audioCtx.currentTime + 0.2);
    setTimeout(() => audioCtx.close(), 300);
  } catch (e) {
    console.warn('Erro ao tocar beep:', e);
  }
}

// ================================================================
//  RELÓGIO, DATA, SAUDAÇÃO
// ================================================================
function updateClock() {
  const n = new Date();
  const timeStr =
    String(n.getHours()).padStart(2, '0') +
    ':' +
    String(n.getMinutes()).padStart(2, '0') +
    ':' +
    String(n.getSeconds()).padStart(2, '0');

  const clockEl = document.getElementById('clockValue');
  if (clockEl) clockEl.textContent = timeStr;

  const adminClock = document.getElementById('adminClockValue');
  if (adminClock) adminClock.textContent = timeStr;
}

function updateDateAndGreeting() {
  const n = new Date();
  const dateStr = formatDateFull(n);

  const dateEl = document.getElementById('fullDate');
  if (dateEl) dateEl.textContent = dateStr;

  const adminDate = document.getElementById('adminDateValue');
  if (adminDate) adminDate.textContent = dateStr;

  const h = n.getHours();
  let g = h < 12 ? 'Bom dia!' : h < 18 ? 'Boa tarde!' : 'Boa noite!';
  const greetingEl = document.getElementById('greetingValue');
  if (greetingEl) greetingEl.textContent = g;
}

// ================================================================
//  CLIMA (proxy local)
// ================================================================
async function fetchWeather() {
  const el = document.getElementById('weatherValue');
  if (!el) return;
  const now = Date.now();

  if (weatherCache && now - weatherCacheTime < WEATHER_CACHE_TTL) {
    el.textContent = weatherCache;
    const adminWeather = document.getElementById('adminWeatherValue');
    if (adminWeather) adminWeather.textContent = weatherCache;
    return;
  }

  if (weatherFetchInProgress) return;
  weatherFetchInProgress = true;
  el.textContent = '⏳ Carregando...';

  try {
    const res = await fetch('/api/weather');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (!data || data.temp === undefined) throw new Error('Dados incompletos');

    const temp = Math.round(data.temp);
    const slug = data.condition_slug || '';
    const emojiMap = {
      clear_day: '☀️',
      clear_night: '🌙',
      cloud: '☁️',
      cloudly_day: '⛅',
      cloudly_night: '☁️',
      rain: '🌧️',
      storm: '⛈️',
      snow: '❄️',
      fog: '🌫️',
    };
    const emoji = emojiMap[slug] || '🌤️';
    const result = emoji + ' ' + temp + ' °C';

    el.textContent = result;
    weatherCache = result;
    weatherCacheTime = now;

    const adminWeather = document.getElementById('adminWeatherValue');
    if (adminWeather) adminWeather.textContent = result;
  } catch (e) {
    console.warn('Clima:', e);
    el.textContent = '⚠️ Sem dados';
    const adminWeather = document.getElementById('adminWeatherValue');
    if (adminWeather) adminWeather.textContent = '⚠️ Sem dados';
  } finally {
    weatherFetchInProgress = false;
  }
}

// ================================================================
//  API DE HORÁRIOS (SUPABASE)
// ================================================================
async function carregarHorariosDoBanco() {
  try {
    const res = await fetch('/api/horarios');
    if (!res.ok) throw new Error('Erro ao carregar horários: ' + res.status);
    const data = await res.json();

    allHorarios = data.map(({ id, created_at, horario, ...rest }) => ({
      ...rest,
      horario: horario.substring(0, 5)
    }));
    allHorarios.sort((a, b) => a.horario.localeCompare(b.horario));
    renderCards();

    const adminContent = document.getElementById('adminContent');
    if (adminContent && adminContent.style.display === 'block') {
      loadAdminTable();
    }
  } catch (e) {
    console.error('Erro ao carregar horários do banco:', e);
    if (allHorarios.length === 0) {
      allHorarios = [...horariosFallback];
      renderCards();
    }
  }
}

// ================================================================
//  RENDER CARDS (com verificações de existência)
// ================================================================
function renderCards() {
  if (!container) return;

  const nowMin = getCurrentMinutes();
  const diaAtual = getCurrentDay();

  if (filterIndicator) {
    filterIndicator.textContent = 'Filtro: ' + (currentFilter === 'all' ? 'Todos' : currentFilter);
  }

  const filtered =
    currentFilter === 'all'
      ? [...allHorarios]
      : allHorarios.filter((h) => h.dias.includes(currentFilter));

  const disponiveisHoje = filtered.filter((h) => h.dias.includes(diaAtual));
  const futurosHoje = disponiveisHoje
    .filter((h) => getMinutesFromTime(h.horario) >= nowMin)
    .sort((a, b) => a.horario.localeCompare(b.horario));

  const futurosTodos = filtered
    .filter((h) => getMinutesFromTime(h.horario) >= nowMin)
    .sort((a, b) => a.horario.localeCompare(b.horario));
  const passadosTodos = filtered
    .filter((h) => getMinutesFromTime(h.horario) < nowMin)
    .sort((a, b) => a.horario.localeCompare(b.horario));

  const sorted = [...futurosTodos, ...passadosTodos];

  if (sorted.length === 0) {
    container.innerHTML = '<div class="empty"><i class="far fa-calendar-times"></i> Nenhum horário para este dia.</div>';
  } else {
    let html = '';
    sorted.forEach((h, idx) => {
      const passed = getMinutesFromTime(h.horario) < nowMin;
      const operaHoje = h.dias.includes(diaAtual);
      const isOutroDia = currentFilter === 'all' && !operaHoje;
      let isNext = false;
      if (currentFilter === 'all') {
        isNext = idx === 0 && !passed && operaHoje;
      } else {
        isNext = idx === 0 && !passed;
      }
      const cls =
        'card' +
        (passed ? ' passed' : '') +
        (isNext ? ' next' : '') +
        (isOutroDia ? ' outro-dia' : '');

      let diaBadge = '';
      if (isOutroDia) {
        const dia = h.dias[0];
        const label = getDiaLabel(dia);
        diaBadge = '<div class="dia-badge"><i class="fas fa-calendar-day"></i> Apenas ' + label + '</div>';
      }

      html +=
        '<div class="' +
        cls +
        '" style="animation-delay:' +
        idx * 0.04 +
        's">' +
        '<div class="destino"><i class="fas fa-map-pin"></i> ' +
        sanitize(h.destino) +
        '</div>' +
        '<div class="horario">' +
        sanitize(h.horario) +
        '</div>' +
        '<div class="embarque"><i class="fas fa-location-dot"></i> ' +
        sanitize(h.embarque) +
        '</div>' +
        '<div class="dias">' +
        h.dias.map((d) => '<span>' + sanitize(d) + '</span>').join('') +
        '</div>' +
        diaBadge +
        '<button class="share-btn" data-destino="' +
        sanitize(h.destino) +
        '" data-horario="' +
        sanitize(h.horario) +
        '" data-embarque="' +
        sanitize(h.embarque) +
        '" title="Compartilhar"><i class="fas fa-share-alt"></i></button>' +
        '</div>';
    });
    container.innerHTML = html;

    document.querySelectorAll('.share-btn').forEach((btn) => {
      btn.removeEventListener('click', handleShare);
      btn.addEventListener('click', handleShare);
    });
  }

  if (nextBusInfo) {
    if (futurosHoje.length > 0) {
      const nxt = futurosHoje[0];
      const diff = getMinutesFromTime(nxt.horario) - nowMin;
      const txt = formatCountdown(diff);
      const cls = diff < 0 ? 'passed' : '';
      nextBusInfo.innerHTML =
        '<span class="destino">' +
        sanitize(nxt.destino) +
        '</span>' +
        '<span class="horario">' +
        sanitize(nxt.horario) +
        '</span>' +
        '<span class="countdown ' +
        cls +
        '">' +
        txt +
        '</span>';
    } else {
      const amanha = findNextTomorrow();
      if (amanha) {
        nextBusInfo.innerHTML =
          '<span class="destino">' +
          sanitize(amanha.destino) +
          '</span>' +
          '<span class="horario">' +
          sanitize(amanha.horario) +
          '</span>' +
          '<span class="countdown" style="color:#ffaa00;">Amanhã</span>';
      } else {
        nextBusInfo.innerHTML = '<span class="empty-msg">Nenhum ônibus programado para hoje</span>';
      }
    }
  }
}

function handleShare(e) {
  e.stopPropagation();
  const btn = e.currentTarget;
  const destino = btn.dataset.destino;
  const horario = btn.dataset.horario;
  const embarque = btn.dataset.embarque;
  const msg =
    '🚌 Ônibus para ' + destino + ' às ' + horario + ' - Embarque: ' + embarque + '. Emitido via Help VTM';

  if (!rateLimit('share', 3, 10000)) {
    alert('Aguarde alguns segundos antes de compartilhar novamente.');
    return;
  }

  if (navigator.share) {
    navigator.share({ title: 'VTM Integração - Horário', text: msg }).catch(() => {});
  } else {
    const url = 'https://api.whatsapp.com/send?text=' + encodeURIComponent(msg);
    window.open(url, '_blank');
  }
}

function findNextTomorrow() {
  const today = new Date().getDay();
  const tomorrow = (today + 1) % 7;
  const map = {
    0: 'Domingo',
    1: 'Segunda a Sexta',
    2: 'Segunda a Sexta',
    3: 'Segunda a Sexta',
    4: 'Segunda a Sexta',
    5: 'Segunda a Sexta',
    6: 'Sábado',
  };
  const label = map[tomorrow];
  const list = allHorarios.filter((h) => h.dias.includes(label));
  if (!list.length) return null;
  list.sort((a, b) => a.horario.localeCompare(b.horario));
  return list[0];
}

// ================================================================
//  VERIFICAÇÃO DE ALERTAS (com verificação)
// ================================================================
function verificarAlertas() {
  const agora = getCurrentMinutes();
  const filtered =
    currentFilter === 'all'
      ? [...allHorarios]
      : allHorarios.filter((h) => h.dias.includes(currentFilter));
  const futuros = filtered
    .filter((h) => getMinutesFromTime(h.horario) >= agora)
    .sort((a, b) => a.horario.localeCompare(b.horario));

  if (futuros.length === 0) return;

  const proximo = futuros[0];
  const hm = getMinutesFromTime(proximo.horario);
  const diff = hm - agora;
  const key = proximo.destino + '|' + proximo.horario;

  if (alertaDisparado[key]) return;

  if (diff <= 30 && diff >= -2) {
    alertaDisparado[key] = true;
    const minutos = Math.round(diff);

    playBeep();

    if (alertMessage) {
      alertMessage.innerHTML =
        '📢 <strong>Atenção!</strong> Faltam <strong>' +
        minutos +
        ' minutos</strong> para o <strong>VTM "' +
        sanitize(proximo.destino) +
        '"</strong> passar na parada <strong>' +
        sanitize(proximo.embarque) +
        '</strong>.';
    }
    if (alertSubMsg) {
      alertSubMsg.textContent =
        '⏰ Alerta às ' +
        new Date().toLocaleTimeString() +
        ' - ' +
        proximo.destino +
        ' às ' +
        proximo.horario;
    }
    if (alertModal) {
      alertModal.classList.add('active');
    }

    const msg =
      'Olá! Faltam ' +
      minutos +
      ' minutos para o VTM da linha ' +
      proximo.destino +
      ' passar na parada ' +
      proximo.embarque +
      '. Programa-se!';
    speak(msg);
  }
}

// ================================================================
//  FILTROS (com verificação)
// ================================================================
function initFilters() {
  const btns = document.querySelectorAll('.filter-btn');
  if (!btns || btns.length === 0) {
    console.log('🔍 Filtros não encontrados (página admin?) – ignorando.');
    return;
  }

  const hoje = getCurrentDay();
  btns.forEach((btn) => btn.classList.remove('active'));
  let found = false;
  btns.forEach((btn) => {
    if (btn.dataset.filter === hoje) {
      btn.classList.add('active');
      currentFilter = hoje;
      found = true;
    }
  });
  if (!found) {
    const allBtn = document.querySelector('.filter-btn[data-filter="all"]');
    if (allBtn) allBtn.classList.add('active');
    currentFilter = 'all';
  }

  btns.forEach((btn) => {
    btn.addEventListener('click', function (e) {
      if (!rateLimit('filter-click', 2, 2000)) return;
      btns.forEach((b) => b.classList.remove('active'));
      this.classList.add('active');
      currentFilter = this.dataset.filter;
      renderCards();
    });
  });
}

// ================================================================
//  FUNÇÕES COMPARTILHADAS DO ADMIN
// ================================================================
function showAdminMsg(text, type = 'info') {
  const msgDiv = document.getElementById('adminMsg');
  if (!msgDiv) return;
  msgDiv.textContent = text;
  msgDiv.className = 'admin-msg ' + type;
  msgDiv.style.display = 'block';
  clearTimeout(msgDiv._timer);
  msgDiv._timer = setTimeout(() => {
    msgDiv.style.display = 'none';
  }, 4000);
}

function loadAdminTable() {
  const tbody = document.getElementById('adminTableBody');
  if (!tbody) {
    console.error('❌ adminTableBody não encontrado no DOM');
    return;
  }

  tbody.innerHTML = '';

  if (!allHorarios || allHorarios.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text-muted);">Nenhum horário cadastrado.</td></tr>';
    const rowCount = document.getElementById('adminRowCount');
    if (rowCount) rowCount.textContent = '0 horários';
    return;
  }

  allHorarios.forEach((h, idx) => {
    const tr = document.createElement('tr');
    tr.dataset.idx = idx;

    const tdDestino = document.createElement('td');
    const inpDestino = document.createElement('input');
    inpDestino.type = 'text';
    inpDestino.className = 'admin-input';
    inpDestino.value = h.destino || '';
    inpDestino.readOnly = true;
    inpDestino.dataset.field = 'destino';
    tdDestino.appendChild(inpDestino);
    tr.appendChild(tdDestino);

    const tdHorario = document.createElement('td');
    const inpHorario = document.createElement('input');
    inpHorario.type = 'time';
    inpHorario.className = 'admin-input';
    inpHorario.value = h.horario || '';
    inpHorario.readOnly = true;
    inpHorario.dataset.field = 'horario';
    tdHorario.appendChild(inpHorario);
    tr.appendChild(tdHorario);

    const tdEmbarque = document.createElement('td');
    const inpEmbarque = document.createElement('input');
    inpEmbarque.type = 'text';
    inpEmbarque.className = 'admin-input';
    inpEmbarque.value = h.embarque || '';
    inpEmbarque.readOnly = true;
    inpEmbarque.dataset.field = 'embarque';
    tdEmbarque.appendChild(inpEmbarque);
    tr.appendChild(tdEmbarque);

    const tdDias = document.createElement('td');
    const divDias = document.createElement('div');
    divDias.className = 'dias-checkboxes';
    const diasOptions = ['Segunda a Sexta', 'Sábado', 'Domingo'];
    diasOptions.forEach((dia) => {
      const label = document.createElement('label');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = dia;
      cb.checked = (h.dias || []).includes(dia);
      cb.disabled = true;
      cb.dataset.field = 'dias';
      label.appendChild(cb);
      label.appendChild(document.createTextNode(dia.replace(' a ', '-')));
      divDias.appendChild(label);
    });
    tdDias.appendChild(divDias);
    tr.appendChild(tdDias);

    const tdAcoes = document.createElement('td');
    const btnEdit = document.createElement('button');
    btnEdit.className = 'btn-action';
    btnEdit.innerHTML = '<i class="fas fa-edit"></i>';
    btnEdit.title = 'Editar';
    btnEdit.dataset.idx = idx;
    btnEdit.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleEditRow(idx);
    });

    const btnDelete = document.createElement('button');
    btnDelete.className = 'btn-action danger';
    btnDelete.innerHTML = '<i class="fas fa-trash-alt"></i>';
    btnDelete.title = 'Excluir';
    btnDelete.dataset.idx = idx;
    btnDelete.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('Tem certeza que deseja excluir este horário?')) {
        allHorarios.splice(idx, 1);
        loadAdminTable();
        showAdminMsg('Horário removido com sucesso.', 'info');
        salvarHorariosNoBanco();
      }
    });

    tdAcoes.appendChild(btnEdit);
    tdAcoes.appendChild(btnDelete);
    tr.appendChild(tdAcoes);

    tbody.appendChild(tr);
  });

  const rowCount = document.getElementById('adminRowCount');
  if (rowCount) rowCount.textContent = allHorarios.length + ' horários';
}

function toggleEditRow(idx) {
  const tr = document.querySelector('#adminTableBody tr[data-idx="' + idx + '"]');
  if (!tr) return;
  const inputs = tr.querySelectorAll('.admin-input');
  const checkboxes = tr.querySelectorAll('.dias-checkboxes input[type="checkbox"]');
  const btnEdit = tr.querySelector('.btn-action:first-child');

  const isEditing = !inputs[0].readOnly;

  if (isEditing) {
    const destino = inputs[0].value.trim();
    const horario = inputs[1].value.trim();
    const embarque = inputs[2].value.trim();
    const selectedDias = [];
    checkboxes.forEach((cb) => {
      if (cb.checked) selectedDias.push(cb.value);
    });

    if (!destino || !horario || !embarque || selectedDias.length === 0) {
      showAdminMsg('Preencha todos os campos e selecione pelo menos um dia.', 'error');
      return;
    }
    if (!/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(horario)) {
      showAdminMsg('Horário inválido (use HH:MM).', 'error');
      return;
    }

    allHorarios[idx].destino = destino;
    allHorarios[idx].horario = horario;
    allHorarios[idx].embarque = embarque;
    allHorarios[idx].dias = selectedDias;

    loadAdminTable();
    showAdminMsg('Horário atualizado com sucesso!', 'success');
    salvarHorariosNoBanco();
  } else {
    inputs.forEach((inp) => (inp.readOnly = false));
    checkboxes.forEach((cb) => (cb.disabled = false));
    btnEdit.innerHTML = '<i class="fas fa-save"></i>';
    btnEdit.classList.add('edit-mode');
    inputs[0].focus();
  }
}

// ================================================================
//  SALVAR HORÁRIOS NO SUPABASE
// ================================================================
async function salvarHorariosNoBanco() {
  try {
    const res = await fetch('/api/horarios', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(allHorarios)
    });
    if (!res.ok) throw new Error('Erro ao salvar: ' + res.status);
    const data = await res.json();
    console.log('Horários salvos no Supabase:', data);
    showAdminMsg('✅ Horários salvos com sucesso no servidor!', 'success');
  } catch (e) {
    console.error('Erro ao salvar horários:', e);
    showAdminMsg('❌ Erro ao salvar no servidor. Tente novamente.', 'error');
  }
}

// ================================================================
//  INICIALIZAÇÃO
// ================================================================
function init() {
  updateDateAndGreeting();
  updateClock();
  setInterval(updateClock, 1000);

  fetchWeather();
  setInterval(fetchWeather, 600000);

  initFilters();

  carregarHorariosDoBanco();

  const welcomeModal = document.getElementById('welcomeModal');
  if (welcomeModal) {
    const closeModalBtn = document.getElementById('closeModalBtn');
    window.addEventListener('load', () => welcomeModal.classList.add('active'));
    if (closeModalBtn) {
      closeModalBtn.addEventListener('click', () => welcomeModal.classList.remove('active'));
    }
    welcomeModal.addEventListener('click', (e) => {
      if (e.target === welcomeModal) welcomeModal.classList.remove('active');
    });
  }

  if (closeAlertBtn) {
    closeAlertBtn.addEventListener('click', () => {
      if (alertModal) alertModal.classList.remove('active');
      window.speechSynthesis.cancel();
    });
  }
  if (alertModal) {
    alertModal.addEventListener('click', (e) => {
      if (e.target === alertModal) {
        alertModal.classList.remove('active');
        window.speechSynthesis.cancel();
      }
    });
  }

  setInterval(() => {
    verificarAlertas();
    renderCards();
  }, 30000);

  setInterval(() => {
    updateDateAndGreeting();
    renderCards();
  }, 60000);
}

document.addEventListener('DOMContentLoaded', init);