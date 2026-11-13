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
let User = null;          // cuenta con sesión iniciada
const FLAGS = { es: '🇪🇸', ar: '🇦🇷', br: '🇧🇷', en: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', fr: '🇫🇷', de: '🇩🇪', it: '🇮🇹', pt: '🇵🇹', nl: '🇳🇱', uy: '🇺🇾', mx: '🇲🇽', ng: '🇳🇬' };
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
    el.classList.add('hide');
    setTimeout(() => el.remove(), 300);
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
    const btn = document.getElementById('cm-ok');
    btn.classList.add('loading'); btn.disabled = true;
    try { await onOk(); closeModal(); }
    catch (err) {
      toast(err.message, 'error');
      btn.classList.remove('loading'); btn.disabled = false;
    }
  };
}

function userClub() { return S.clubs[S.userClubId]; }
function unreadCount() { return (S.inbox || []).filter(m => !m.read).length; }

function badge(club, size) {
  if (club && club.crest) return crestSvg(club.crest, size);
  const initials = esc(club.shortName || club.name.slice(0, 3).toUpperCase());
  const style = size ? 'width:' + size + 'px;height:' + size + 'px;font-size:' + Math.round(size / 3) + 'px' : '';
  return '<div class="badge" style="background:linear-gradient(135deg, ' + esc(club.primaryColor) + ', ' + esc(club.secondaryColor) + ');' + style + '">' + initials + '</div>';
}

function flagOf(code) { return FLAGS[code] || '🌍'; }

/* Escudo SVG a partir de la configuración del club (forma, trama, figuras). */
function crestSvg(crest, size) {
  const c = crest || {};
  const c1 = esc(c.c1 || '#c8102e'), c2 = esc(c.c2 || '#ffffff');
  const initials = esc(c.initials || 'FC').slice(0, 4);
  const shape = c.shape || 'shield';
  const clip = shape === 'circle' ? 'M50 4 A46 46 0 1 1 49.9 4 Z'
    : shape === 'hex' ? 'M50 3 L91 26 L91 74 L50 97 L9 74 L9 26 Z'
    : 'M50 3 L92 12 V36 C92 64 80 84 50 97 C20 84 8 64 8 36 V12 Z';
  let pattern = '';
  if (c.pattern === 'stripes') pattern = '<rect x="26" y="0" width="12" height="100" fill="' + c2 + '"/><rect x="50" y="0" width="12" height="100" fill="' + c2 + '"/><rect x="74" y="0" width="12" height="100" fill="' + c2 + '"/>';
  else if (c.pattern === 'halves') pattern = '<rect x="50" y="0" width="50" height="100" fill="' + c2 + '"/>';
  else if (c.pattern === 'sash') pattern = '<polygon points="0,18 24,0 100,82 76,100" fill="' + c2 + '"/>';
  else if (c.pattern === 'hoops') pattern = '<rect x="0" y="18" width="100" height="14" fill="' + c2 + '"/><rect x="0" y="46" width="100" height="14" fill="' + c2 + '"/><rect x="0" y="74" width="100" height="14" fill="' + c2 + '"/>';
  const fig = c.figure === 'star' ? '<text x="50" y="78" text-anchor="middle" font-size="24" fill="#ffd54d">★</text>'
    : c.figure === 'ball' ? '<text x="50" y="80" text-anchor="middle" font-size="24">⚽</text>'
    : c.figure === 'crown' ? '<text x="50" y="78" text-anchor="middle" font-size="22">👑</text>' : '';
  const uid = 'cg' + Math.abs((c1 + c2 + shape + (c.pattern || '')).split('').reduce(function (a, ch) { return ((a * 31 + ch.charCodeAt(0)) | 0); }, 7));
  return '<svg class="crest" width="' + (size || 32) + '" height="' + (size || 32) + '" viewBox="0 0 100 100" role="img" aria-label="Escudo del club">' +
    '<defs><clipPath id="' + uid + '"><path d="' + clip + '"/></clipPath></defs>' +
    '<g clip-path="url(#' + uid + ')">' +
      '<rect x="0" y="0" width="100" height="100" fill="' + c1 + '"/>' + pattern +
    '</g>' +
    '<path d="' + clip + '" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="4"/>' +
    '<text x="50" y="54" text-anchor="middle" font-family="Barlow Condensed, Arial Narrow, sans-serif" font-weight="800" font-size="34" fill="#ffffff" stroke="rgba(0,0,0,0.45)" stroke-width="1.2" paint-order="stroke">' + initials + '</text>' +
    fig + '</svg>';
}

/* Camiseta SVG (diseño del kit del club). */
function kitSvg(kit, w, h) {
  const k = kit || {};
  const c1 = esc(k.c1 || '#c8102e'), c2 = esc(k.c2 || '#ffffff');
  const W = w || 64, H = h || 64;
  const body = 'M20 8 L34 2 Q40 8 50 8 Q60 8 66 2 L80 8 L94 22 L82 34 L80 28 L80 92 L20 92 L20 28 L18 34 L6 22 Z';
  const uid = 'kit' + uidOf(k);
  let pattern = '';
  if (k.pattern === 'stripes') pattern = '<rect x="34" y="0" width="8" height="100" fill="' + c2 + '"/><rect x="50" y="0" width="8" height="100" fill="' + c2 + '"/><rect x="66" y="0" width="8" height="100" fill="' + c2 + '"/>';
  else if (k.pattern === 'hoops') pattern = '<rect x="0" y="26" width="100" height="10" fill="' + c2 + '"/><rect x="0" y="48" width="100" height="10" fill="' + c2 + '"/><rect x="0" y="70" width="100" height="10" fill="' + c2 + '"/>';
  else if (k.pattern === 'sash') pattern = '<polygon points="20,30 34,10 80,70 66,90" fill="' + c2 + '"/>';
  return '<svg class="kit" width="' + W + '" height="' + H + '" viewBox="0 0 100 100" role="img" aria-label="Camiseta del club">' +
    '<defs><clipPath id="' + uid + '"><path d="' + body + '"/></clipPath></defs>' +
    '<path d="' + body + '" fill="' + c1 + '" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>' +
    '<g clip-path="url(#' + uid + ')">' + pattern + '</g>' +
    '</svg>';
}
function uidOf(k) { return Math.abs(JSON.stringify(k || {}).split('').reduce(function (a, ch) { return ((a * 31 + ch.charCodeAt(0)) | 0); }, 7)); }

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
  { id: 'infirmary', icon: '🏥', label: 'Enfermería' },
  { id: 'league', icon: '🏆', label: 'Liga' },
  { id: 'market', icon: '💰', label: 'Mercado' },
  { id: 'youth', icon: '🌱', label: 'Cantera' },
  { id: 'finance', icon: '📊', label: 'Finanzas' },
  { id: 'sponsors', icon: '🤝', label: 'Patrocinios' },
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
  if (!User) return;
  if (!S) return renderSetup();
  if (route === 'match') { renderMatch(); return; }
  renderShell();
}

/* ---------- Inicio de sesión / registro ---------- */

const RECOVERY_QUESTIONS = [
  '¿Cuál es el nombre de tu primera mascota?',
  '¿En qué ciudad naciste?',
  '¿Cuál es el nombre de tu mejor amigo/a de la infancia?',
  '¿Cuál fue tu primer videojuego?',
  '¿Cómo se llama tu equipo favorito?'
];

function recoveryFieldsHtml() {
  const opts = RECOVERY_QUESTIONS.map(q => '<option value="' + esc(q) + '">' + esc(q) + '</option>').join('');
  return '<label class="field"><span>Pregunta de seguridad <em class="req-note">(para recuperar tu contraseña)</em></span>' +
    '<select name="recoveryQuestion" id="recovery-q">' + opts + '<option value="__custom__">Otra (escribir)…</option></select></label>' +
    '<label class="field" id="recovery-q-custom" style="display:none"><span>Tu pregunta</span><input type="text" name="recoveryQuestionCustom" minlength="5" maxlength="200" placeholder="Escribe tu pregunta"></label>' +
    '<label class="field"><span>Respuesta secreta</span><input type="text" name="recoveryAnswer" required minlength="2" maxlength="100" autocomplete="off" placeholder="No la compartas con nadie"></label>';
}

function renderLogin(mode) {
  mode = mode || 'login';
  const isReg = mode === 'register';
  $app.innerHTML =
  '<div class="setup-wrap"><div class="card setup-card auth-card">' +
    '<div class="setup-hero">' +
      '<h1>⚽ FC <span class="accent">GALAXY</span></h1>' +
      '<p>' + (isReg ? 'Crea tu cuenta para empezar tu carrera como mánager.' : 'Inicia sesión para continuar tu carrera.') + '</p>' +
    '</div>' +
    '<div class="tab-bar auth-tabs">' +
      '<button class="tab ' + (!isReg ? 'active' : '') + '" id="tab-login">Iniciar sesión</button>' +
      '<button class="tab ' + (isReg ? 'active' : '') + '" id="tab-register">Crear cuenta</button>' +
    '</div>' +
    '<form id="auth-form">' +
      '<label class="field"><span>Usuario</span><input type="text" name="username" required minlength="3" maxlength="20" autocomplete="username" placeholder="3-20 caracteres"></label>' +
      '<label class="field"><span>Contraseña</span><input type="password" name="password" required minlength="6" maxlength="128" autocomplete="' + (isReg ? 'new-password' : 'current-password') + '" placeholder="mínimo 6 caracteres"></label>' +
      (isReg ? recoveryFieldsHtml() : '') +
      '<button class="btn big" style="width:100%" type="submit">' + (isReg ? '🚀 Crear cuenta y jugar' : '▶️ Entrar') + '</button>' +
      '<p class="hint-line" style="text-align:center">' +
        (!isReg ? '<a href="#" id="link-forgot" class="auth-link">¿Olvidaste tu contraseña?</a> · ' : '') +
        'Cada cuenta tiene su propia partida guardada. En el modo navegador las cuentas viven en este dispositivo.</p>' +
    '</form>' +
  '</div></div>';

  document.getElementById('tab-login').addEventListener('click', () => renderLogin('login'));
  document.getElementById('tab-register').addEventListener('click', () => renderLogin('register'));
  const sel = document.getElementById('recovery-q');
  if (sel) sel.addEventListener('change', () => {
    document.getElementById('recovery-q-custom').style.display = sel.value === '__custom__' ? '' : 'none';
  });
  const forgot = document.getElementById('link-forgot');
  if (forgot) forgot.addEventListener('click', e => { e.preventDefault(); renderRecover(); });
  document.getElementById('auth-form').addEventListener('submit', async e => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target).entries());
    if (isReg) {
      body.recoveryQuestion = body.recoveryQuestion === '__custom__' ? (body.recoveryQuestionCustom || '') : body.recoveryQuestion;
      delete body.recoveryQuestionCustom;
    }
    const btn = e.target.querySelector('button[type=submit]');
    btn.classList.add('loading'); btn.disabled = true;
    try {
      const r = await API.post('/api/auth/' + (isReg ? 'register' : 'login'), body);
      User = r.account;
      toast(isReg ? 'Cuenta creada. ¡Bienvenido, ' + r.account.username + '!' : 'Sesión iniciada. ¡Bienvenido de nuevo, ' + r.account.username + '!');
      await bootLoadState();
    } catch (err) {
      toast(err.message, 'error');
      btn.classList.remove('loading'); btn.disabled = false;
    }
  });
}

function renderRecover(step, data) {
  step = step || 'user';
  data = data || {};
  const form = step === 'user'
    ? '<form id="recover-form">' +
        '<label class="field"><span>Usuario</span><input type="text" name="username" required minlength="3" maxlength="20" autocomplete="username"></label>' +
        '<button class="btn big" style="width:100%" type="submit">Continuar</button>' +
      '</form>'
    : '<p class="hint-line"><strong>Pregunta de seguridad:</strong> ' + esc(data.question) + '</p>' +
      '<form id="recover-form">' +
        '<input type="hidden" name="username" value="' + esc(data.username) + '">' +
        '<label class="field"><span>Tu respuesta</span><input type="text" name="answer" required minlength="2" maxlength="100" autocomplete="off"></label>' +
        '<label class="field"><span>Nueva contraseña</span><input type="password" name="password" required minlength="6" maxlength="128" autocomplete="new-password" placeholder="mínimo 6 caracteres"></label>' +
        '<button class="btn big" style="width:100%" type="submit">🔑 Restablecer contraseña</button>' +
      '</form>';
  $app.innerHTML =
  '<div class="setup-wrap"><div class="card setup-card auth-card">' +
    '<div class="setup-hero">' +
      '<h1>🔑 Recuperar <span class="accent">contraseña</span></h1>' +
      '<p>' + (step === 'user' ? 'Introduce tu usuario para ver tu pregunta de seguridad.' : 'Responde tu pregunta de seguridad para restablecer la contraseña.') + '</p>' +
    '</div>' + form +
    '<p class="hint-line" style="text-align:center"><a href="#" id="link-back" class="auth-link">← Volver a iniciar sesión</a></p>' +
  '</div></div>';

  document.getElementById('link-back').addEventListener('click', e => { e.preventDefault(); renderLogin('login'); });
  document.getElementById('recover-form').addEventListener('submit', async e => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target).entries());
    const btn = e.target.querySelector('button[type=submit]');
    btn.classList.add('loading'); btn.disabled = true;
    try {
      if (step === 'user') {
        const r = await API.post('/api/auth/recover/question', { username: body.username });
        renderRecover('reset', { username: body.username.trim().toLowerCase(), question: r.question });
      } else {
        const r = await API.post('/api/auth/recover/reset', body);
        User = r.account;
        toast('Contraseña restablecida. ¡Bienvenido de nuevo, ' + r.account.username + '!');
        await bootLoadState();
      }
    } catch (err) {
      toast(err.message, 'error');
      btn.classList.remove('loading'); btn.disabled = false;
    }
  });
}

function openRecoveryModal() {
  const wrap = document.createElement('div');
  wrap.className = 'modal-overlay';
  wrap.innerHTML =
    '<div class="modal"><h2>🔑 Recuperación de contraseña</h2>' +
      '<p class="hint-line">Configura (o cambia) tu pregunta de seguridad. Si algún día olvidas la contraseña, podrás restablecerla respondiendo esta pregunta.</p>' +
      '<form id="recovery-modal-form">' +
        '<label class="field"><span>Pregunta</span><input type="text" name="question" required minlength="5" maxlength="200" value=""></label>' +
        '<label class="field"><span>Respuesta secreta</span><input type="text" name="answer" required minlength="2" maxlength="100" autocomplete="off"></label>' +
        '<div class="modal-actions">' +
          '<button type="button" class="btn secondary" id="recovery-cancel">Cancelar</button>' +
          '<button type="submit" class="btn">Guardar</button>' +
        '</div>' +
      '</form></div>';
  document.body.appendChild(wrap);
  wrap.addEventListener('click', e => { if (e.target === wrap) wrap.remove(); });
  wrap.querySelector('#recovery-cancel').addEventListener('click', () => wrap.remove());
  wrap.querySelector('#recovery-modal-form').addEventListener('submit', async e => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target).entries());
    try {
      await API.post('/api/auth/recovery-question', body);
      toast('Pregunta de recuperación guardada.');
      wrap.remove();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

async function logout() {
  try { await API.post('/api/auth/logout', {}); } catch (e) { /* noop */ }
  User = null; S = null; route = 'dashboard'; matchPlayback = null; tacticsDraft = null;
  renderLogin('login');
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
      '<div class="sidebar-footer">Temporada ' + S.season + ' · Semana ' + S.week + '<br>Blockchain: <strong style="color:var(--purple)">SIMULADA</strong>' +
      (User ? '<br>👤 ' + esc(User.username) + ' <button class="btn secondary small" id="btn-recovery" style="margin-top:6px">🔑 Recuperación</button> <button class="btn secondary small" id="btn-logout" style="margin-top:6px">Salir</button>' : '') + '</div>' +
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
  const lo = document.getElementById('btn-logout');
  if (lo) lo.addEventListener('click', logout);
  const rec = document.getElementById('btn-recovery');
  if (rec) rec.addEventListener('click', openRecoveryModal);
  const adv = document.getElementById('btn-advance');
  if (adv) adv.addEventListener('click', advanceWeek);
  const ns = document.getElementById('btn-newseason');
  if (ns) ns.addEventListener('click', startNewSeason);

  const views = {
    dashboard: viewDashboard, squad: viewSquad, tactics: viewTactics, training: viewTraining,
    league: viewLeague, market: viewMarket, youth: viewYouth, finance: viewFinance,
    sponsors: viewSponsors, chain: viewChain, club: viewClub, inbox: viewInbox, infirmary: viewInfirmary
  };
  (views[route] || viewDashboard)(document.getElementById('view'));
}

/* ---------- Pantalla de creación de club ---------- */

const COUNTRY_LIST = [
  { code: 'es', name: 'España' }, { code: 'ar', name: 'Argentina' }, { code: 'br', name: 'Brasil' },
  { code: 'en', name: 'Inglaterra' }, { code: 'fr', name: 'Francia' }, { code: 'de', name: 'Alemania' },
  { code: 'it', name: 'Italia' }, { code: 'pt', name: 'Portugal' }, { code: 'nl', name: 'Países Bajos' },
  { code: 'uy', name: 'Uruguay' }, { code: 'mx', name: 'México' }, { code: 'ng', name: 'Nigeria' }
];

const CREST_SHAPES_UI = [['shield', 'Escudo'], ['circle', 'Círculo'], ['hex', 'Hexágono']];
const CREST_PATTERNS_UI = [['solid', 'Liso'], ['stripes', 'A rayas'], ['halves', 'Mitades'], ['sash', 'Banda'], ['hoops', 'Aros']];
const CREST_FIGURES_UI = [['none', 'Ninguna'], ['star', 'Estrella'], ['ball', 'Balón'], ['crown', 'Corona']];
const KIT_PATTERNS_UI = [['solid', 'Lisa'], ['stripes', 'Rayas'], ['hoops', 'Aros'], ['sash', 'Banda']];

function identityEditorHtml(prefix, club) {
  const d = club || {};
  const crest = d.crest || {};
  const kit = d.kit || {};
  const opts = (pairs, sel) => pairs.map(p => '<option value="' + p[0] + '"' + (p[0] === sel ? ' selected' : '') + '>' + p[1] + '</option>').join('');
  return '<div class="identity-editor">' +
    '<div class="identity-preview">' +
      '<div id="' + prefix + '-crest-preview">' + crestSvg(crest, 96) + '</div>' +
      '<div id="' + prefix + '-kit-preview">' + kitSvg(kit, 72, 72) + '</div>' +
    '</div>' +
    '<div class="identity-controls">' +
      '<label class="field"><span>Forma del escudo</span><select data-idf="shape">' + opts(CREST_SHAPES_UI, crest.shape || 'shield') + '</select></label>' +
      '<label class="field"><span>Trama del escudo</span><select data-idf="pattern">' + opts(CREST_PATTERNS_UI, crest.pattern || 'solid') + '</select></label>' +
      '<label class="field"><span>Figura</span><select data-idf="figure">' + opts(CREST_FIGURES_UI, crest.figure || 'none') + '</select></label>' +
      '<label class="field"><span>Siglas</span><input type="text" data-idf="initials" maxlength="4" value="' + esc(crest.initials || d.shortName || 'FC') + '"></label>' +
      '<label class="field"><span>Diseño de camiseta</span><select data-idf="kitPattern">' + opts(KIT_PATTERNS_UI, kit.pattern || 'solid') + '</select></label>' +
    '</div>' +
  '</div>';
}

function readIdentityDraft(root, prefix, club) {
  const crest = {
    shape: root.querySelector('[data-idf="shape"]').value,
    pattern: root.querySelector('[data-idf="pattern"]').value,
    figure: root.querySelector('[data-idf="figure"]').value,
    initials: (root.querySelector('[data-idf="initials"]').value || 'FC').toUpperCase(),
    c1: club.primaryColor, c2: club.secondaryColor
  };
  const kit = { pattern: root.querySelector('[data-idf="kitPattern"]').value, c1: club.primaryColor, c2: club.secondaryColor };
  return { crest, kit };
}

function bindIdentityPreview(root, prefix, getDraft) {
  const update = () => {
    const d = getDraft();
    document.getElementById(prefix + '-crest-preview').innerHTML = crestSvg(d.crest, 96);
    document.getElementById(prefix + '-kit-preview').innerHTML = kitSvg(d.kit, 72, 72);
  };
  root.querySelectorAll('[data-idf]').forEach(el => el.addEventListener('change', update));
  root.querySelectorAll('[data-idf="initials"]').forEach(el => el.addEventListener('input', update));
  update();
}

let setupCountry = 'es';

function renderSetup() {
  setupCountry = 'es';
  const draftClub = { primaryColor: '#c8102e', secondaryColor: '#ffffff', shortName: 'FC', crest: { shape: 'shield', pattern: 'solid', figure: 'star', initials: 'FC', c1: '#c8102e', c2: '#ffffff' }, kit: { pattern: 'solid', c1: '#c8102e', c2: '#ffffff' } };
  $app.innerHTML =
  '<div class="setup-wrap"><div class="card setup-card setup-wide">' +
    '<div class="setup-hero">' +
      '<h1>⚽ FC <span class="accent">GALAXY</span></h1>' +
      '<p>Manager de fútbol con economía blockchain simulada.<br>Funda tu club, gestiona la plantilla y domina la liga.</p>' +
    '</div>' +
    '<form id="setup-form">' +
      '<label class="field"><span>Nombre del club *</span><input type="text" name="clubName" placeholder="Ej: Estrella Roja" required minlength="3" maxlength="30"></label>' +
      '<div class="grid grid-2">' +
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
        '<label class="field"><span>Siglas (3-4 letras)</span><input type="text" name="shortName" placeholder="Ej: EST" maxlength="4"></label>' +
      '</div>' +
      '<div class="field"><span>País de la liga <small style="color:var(--text-faint)">(da nacionalidad a los jugadores)</small></span>' +
        '<div class="country-grid" id="country-grid">' +
          COUNTRY_LIST.map(c =>
            '<button type="button" class="country-chip' + (c.code === setupCountry ? ' active' : '') + '" data-country="' + c.code + '">' +
            '<span class="cf">' + flagOf(c.code) + '</span>' + esc(c.name) + '</button>').join('') +
        '</div>' +
      '</div>' +
      '<div class="color-row">' +
        '<label class="field"><span>Color principal</span><input type="color" name="primaryColor" value="#c8102e"></label>' +
        '<label class="field"><span>Color secundario</span><input type="color" name="secondaryColor" value="#ffffff"></label>' +
      '</div>' +
      '<p class="section-title">Escudo y camiseta</p>' +
      '<div id="setup-identity">' + identityEditorHtml('setup', draftClub) + '</div>' +
      '<button class="btn big" style="width:100%" type="submit">🚀 Fundar mi club</button>' +
      '<p style="font-size:11.5px;color:var(--text-faint);margin-top:12px;text-align:center">' +
      'Liga de 12 clubes con 300+ jugadores, cada uno como activo digital único en la SIMCHAIN (blockchain simulada, no real).</p>' +
    '</form>' +
  '</div></div>';

  const form = document.getElementById('setup-form');
  const root = document.getElementById('setup-identity');
  let identityDraft = readIdentityDraft(root, 'setup', draftClub);
  bindIdentityPreview(root, 'setup', () => identityDraft);

  document.getElementById('country-grid').addEventListener('click', e => {
    const chip = e.target.closest('.country-chip');
    if (!chip) return;
    setupCountry = chip.dataset.country;
    document.querySelectorAll('.country-chip').forEach(c => c.classList.toggle('active', c === chip));
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target).entries());
    body.country = setupCountry;
    body.crest = identityDraft.crest;
    body.kit = identityDraft.kit;
    const btn = e.target.querySelector('button[type=submit]');
    btn.classList.add('loading'); btn.disabled = true;
    try {
      S = await API.post('/api/game/new', body);
      route = 'dashboard';
      render();
      toast('¡' + body.clubName + ' ha sido fundado! Buena suerte, mánager.');
    } catch (err) {
      toast(err.message, 'error');
      btn.classList.remove('loading'); btn.disabled = false;
    }
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
  const btn = document.getElementById('btn-advance');
  if (btn) { btn.classList.add('loading'); btn.disabled = true; }
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
  } finally {
    if (btn) { btn.classList.remove('loading'); btn.disabled = false; }
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
