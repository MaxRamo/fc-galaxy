'use strict';

/* ================= FC Galaxy — núcleo del frontend ================= */

const API = {
  local: (typeof window !== 'undefined' && window.FC_LOCAL) || null,
  async call(method, path, body) {
    if (this.local) {
      const res = this.local.handle(method, path, body);
      if (res.status >= 400) throw new Error((res.data && res.data.error) || 'Error (' + res.status + ')');
      return res.data;
    }
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(path, opts);
    let data = null;
    try { data = await res.json(); } catch (e) { /* noop */ }
    if (!res.ok) throw new Error((data && data.error) || 'Error de red (' + res.status + ')');
    return data;
  },
  get(path) { return this.call('GET', path); },
  post(path, body) { return this.call('POST', path, body || {}); }
};

let S = null;             // snapshot del estado del servidor
let route = 'dashboard';
let matchPlayback = null; // estado local de reproducción del partido
let tacticsDraft = null;  // borrador de alineación
const $app = document.getElementById('app');
const $modalRoot = document.getElementById('modal-root');
const $toasts = document.getElementById('toast-container');

function fmtMoney(v) {
  if (v == null || isNaN(v)) return '—';
  const n = Number(v);
  const sign = n < 0 ? '-' : '';
  const a = Math.abs(n);
  if (a >= 1000000) return sign + (a / 1000000).toFixed(a >= 10000000 ? 1 : 2) + 'M';
  if (a >= 10000) return sign + Math.round(a / 1000) + 'K';
  return sign + Math.round(a).toLocaleString('es-ES');
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function ovrClass(o) { return o >= 75 ? 'q-high' : o >= 62 ? 'q-mid' : o >= 50 ? 'q-low' : 'q-vlow'; }
function ovrBadge(o) { return '<span class="ovr ' + ovrClass(o) + '">' + o + '</span>'; }
function posTag(pos) { return '<span class="pos-tag ' + pos + '">' + pos + '</span>'; }
function moraleEmoji(m) { return m >= 80 ? '😄' : m >= 65 ? '🙂' : m >= 50 ? '😐' : m >= 35 ? '😟' : '😠'; }
function moraleLabel(m) { return m >= 80 ? 'Eufórico' : m >= 65 ? 'Contento' : m >= 50 ? 'Normal' : m >= 35 ? 'Desmotivado' : 'Furioso'; }

function toast(msg, type) {
  const el = document.createElement('div');
  el.className = 'toast ' + (type || '');
  el.textContent = msg;
  $toasts.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0'; el.style.transition = 'opacity 0.4s';
    setTimeout(() => el.remove(), 400);
  }, 3400);
}

function openModal(html) {
  $modalRoot.innerHTML = '<div class="modal-overlay"><div class="modal">' + html + '</div></div>';
  $modalRoot.querySelector('.modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });
}
function closeModal() { $modalRoot.innerHTML = ''; }

function confirmModal(title, htmlText, onOk, okLabel) {
  openModal(
    '<h2>' + esc(title) + '</h2>' +
    '<p style="color:var(--text-dim);font-size:14px;line-height:1.5">' + htmlText + '</p>' +
    '<div class="close-row">' +
    '<button class="btn secondary" id="cm-cancel">Cancelar</button>' +
    '<button class="btn" id="cm-ok">' + esc(okLabel || 'Confirmar') + '</button></div>');
  document.getElementById('cm-cancel').onclick = closeModal;
  document.getElementById('cm-ok').onclick = async () => {
    try { await onOk(); closeModal(); }
    catch (err) { toast(err.message, 'error'); }
  };
}

function userClub() { return S.clubs[S.userClubId]; }
function unreadCount() { return (S.inbox || []).filter(m => !m.read).length; }

function badge(club, size) {
  const initials = esc(club.shortName || club.name.slice(0, 3).toUpperCase());
  const style = size ? 'width:' + size + 'px;height:' + size + 'px;font-size:' + Math.round(size / 3) + 'px' : '';
  return '<div class="badge" style="background:linear-gradient(135deg, ' + esc(club.primaryColor) + ', ' + esc(club.secondaryColor) + ');' + style + '">' + initials + '</div>';
}

function potentialText(p) {
  if (p.scouted) return '<strong style="color:var(--accent)">' + p.potential + '</strong>';
  const lo = p.overall, hi = Math.max(lo, Math.min(96, lo + Math.ceil((p.potential - lo) * 0.6)));
  return '<span style="color:var(--text-faint)">' + lo + '–' + hi + '</span>';
}

/* ---------- Navegación ---------- */

const NAV = [
  { id: 'dashboard', icon: '🏠', label: 'Panel' },
  { id: 'squad', icon: '👥', label: 'Plantilla' },
  { id: 'tactics', icon: '📋', label: 'Tácticas' },
  { id: 'training', icon: '💪', label: 'Entrenam.' },
  { id: 'league', icon: '🏆', label: 'Liga' },
  { id: 'market', icon: '💰', label: 'Mercado' },
  { id: 'youth', icon: '🌱', label: 'Cantera' },
  { id: 'finance', icon: '📊', label: 'Finanzas' },
  { id: 'chain', icon: '⛓️', label: 'Blockchain' },
  { id: 'club', icon: '🏟️', label: 'Mi Club' }
];

function setRoute(r) {
  route = r;
  if (r === 'inbox') markInboxRead();
  render();
}

async function markInboxRead() {
  if (unreadCount() > 0) {
    try {
      await API.post('/api/inbox/read');
      for (const m of S.inbox) m.read = true;
    } catch (e) { /* noop */ }
  }
}

function render() {
  if (!S) return renderSetup();
  if (route === 'match') { renderMatch(); return; }
  renderShell();
}

function navHtml() {
  const unread = unreadCount();
  return NAV.map(n =>
    '<button class="nav-item ' + (route === n.id ? 'active' : '') + '" data-nav="' + n.id + '">' +
    '<span class="icon">' + n.icon + '</span><span>' + n.label + '</span>' +
    (n.id === 'dashboard' && unread ? '<span class="nav-badge">' + unread + '</span>' : '') +
    '</button>').join('');
}

function bindNav(root) {
  root.querySelectorAll('[data-nav]').forEach(el =>
    el.addEventListener('click', () => setRoute(el.dataset.nav)));
}

function renderShell() {
  const club = userClub();
  const unread = unreadCount();
  $app.innerHTML =
  '<div class="app-shell">' +
    '<aside class="sidebar">' +
      '<div class="brand"><span class="logo">⚽</span>FC <span class="accent">GALAXY</span></div>' +
      '<nav class="nav">' + navHtml() + '</nav>' +
      '<div class="sidebar-footer">Temporada ' + S.season + ' · Semana ' + S.week + '<br>Blockchain: <strong style="color:var(--purple)">SIMULADA</strong></div>' +
    '</aside>' +
    '<div class="main">' +
      '<header class="topbar">' +
        '<div class="club-chip">' + badge(club) + '<span>' + esc(club.name) + '</span></div>' +
        '<div class="topbar-stat"><span>Tesorería</span><strong style="color:var(--accent)">' + fmtMoney(club.budget) + ' FCG</strong></div>' +
        '<div class="topbar-stat"><span>Tiempo</span><strong>T' + S.season + ' · S' + S.week + '</strong></div>' +
        '<div class="topbar-stat"><span>Reputación</span><strong>' + Math.round(club.reputation) + '/95</strong></div>' +
        '<div class="topbar-spacer"></div>' +
        (unread ? '<button class="btn secondary small" data-nav="inbox">📬 ' + unread + '</button>' : '') +
        (S.phase === 'season'
          ? '<button class="btn" id="btn-advance">⏩ Avanzar semana</button>'
          : '<button class="btn" id="btn-newseason">🎬 Nueva temporada</button>') +
      '</header>' +
      '<main class="content" id="view"></main>' +
      '<nav class="mobile-nav">' + navHtml() + '</nav>' +
    '</div>' +
  '</div>';

  bindNav($app);
  const adv = document.getElementById('btn-advance');
  if (adv) adv.addEventListener('click', advanceWeek);
  const ns = document.getElementById('btn-newseason');
  if (ns) ns.addEventListener('click', startNewSeason);

  const views = {
    dashboard: viewDashboard, squad: viewSquad, tactics: viewTactics, training: viewTraining,
    league: viewLeague, market: viewMarket, youth: viewYouth, finance: viewFinance,
    chain: viewChain, club: viewClub, inbox: viewInbox
  };
  (views[route] || viewDashboard)(document.getElementById('view'));
}

/* ---------- Pantalla de creación de club ---------- */

function renderSetup() {
  $app.innerHTML =
  '<div class="setup-wrap"><div class="card setup-card">' +
    '<div class="setup-hero">' +
      '<h1>⚽ FC <span class="accent">GALAXY</span></h1>' +
      '<p>Manager de fútbol con economía blockchain simulada.<br>Funda tu club, gestiona la plantilla y domina la liga.</p>' +
    '</div>' +
    '<form id="setup-form">' +
      '<div class="grid grid-2">' +
        '<label class="field"><span>Nombre del club *</span><input type="text" name="clubName" placeholder="Ej: Estrella Roja" required minlength="3" maxlength="30"></label>' +
        '<label class="field"><span>Tu nombre de mánager</span><input type="text" name="managerName" placeholder="Ej: Álex Torres" maxlength="30"></label>' +
        '<label class="field"><span>Ciudad</span><input type="text" name="city" placeholder="Ej: Vallebravo" maxlength="30"></label>' +
        '<label class="field"><span>Formación inicial</span>' +
          '<select name="formation">' +
            '<option value="4-3-3">4-3-3 (equilibrada)</option>' +
            '<option value="4-4-2">4-4-2 (clásica)</option>' +
            '<option value="4-2-3-1">4-2-3-1 (control)</option>' +
            '<option value="3-5-2">3-5-2 (mediocampo)</option>' +
            '<option value="5-3-2">5-3-2 (defensiva)</option>' +
            '<option value="4-1-4-1">4-1-4-1 (presión)</option>' +
          '</select>' +
        '</label>' +
      '</div>' +
      '<div class="color-row">' +
        '<label class="field"><span>Color principal</span><input type="color" name="primaryColor" value="#c8102e"></label>' +
        '<label class="field"><span>Color secundario</span><input type="color" name="secondaryColor" value="#ffffff"></label>' +
      '</div>' +
      '<button class="btn big" style="width:100%" type="submit">🚀 Fundar mi club</button>' +
      '<p style="font-size:11.5px;color:var(--text-faint);margin-top:12px;text-align:center">' +
      'Liga de 12 clubes con 300+ jugadores, cada uno como activo digital único en la SIMCHAIN (blockchain simulada, no real).</p>' +
    '</form>' +
  '</div></div>';

  document.getElementById('setup-form').addEventListener('submit', async e => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target).entries());
    try {
      S = await API.post('/api/game/new', body);
      route = 'dashboard';
      render();
      toast('¡' + body.clubName + ' ha sido fundado! Buena suerte, mánager.');
    } catch (err) { toast(err.message, 'error'); }
  });
}

/* ---------- Acciones globales ---------- */

function refreshFrom(r) {
  if (r && r.snapshot) S = r.snapshot;
  else if (r && r.match) S.pendingMatch = r.match;
}

async function refresh() {
  S = await API.get('/api/state');
  tacticsDraft = null;
  render();
}

async function advanceWeek() {
  try {
    const r = await API.post('/api/week/advance', {});
    refreshFrom(r);
    const s = r.summary || {};
    let msg = 'Semana avanzada.';
    if (s.training && s.training.length) msg += ' ' + s.training.length + ' jugador(es) mejoraron.';
    if (s.youth && s.youth.length) msg += ' ¡Nueva promesa en la cantera!';
    if (s.offers && s.offers.length) msg += ' ' + s.offers.length + ' oferta(s) recibida(s).';
    toast(msg);
    setRoute('dashboard');
  } catch (err) {
    if (err.message.indexOf('partido pendiente') !== -1) {
      toast(err.message + ' Usa el panel para jugarlo o simularlo.', 'warn');
      setRoute('dashboard');
    } else {
      toast(err.message, 'error');
    }
  }
}

function startNewSeason() {
  confirmModal('Nueva temporada',
    'Se archivarán las estadísticas, los jugadores envejecerán, algunos se retirarán y los contratos vencidos expirarán (¡renueva antes de acabar la temporada!). El calendario se regenerará.',
    async () => {
      const r = await API.post('/api/season/next');
      S = r.snapshot;
      tacticsDraft = null;
      toast('Temporada ' + S.season + ' iniciada. ' + r.result.retired.length + ' retiradas, ' + r.result.freeAgents + ' agentes libres.');
      setRoute('dashboard');
    }, 'Iniciar temporada');
}
