'use strict';

/* ================= FC Galaxy — vista y reproducción de partidos ================= */

const MATCH_SPEEDS = [0.5, 1, 2, 4];

function newPlaybackState() {
  return {
    revealed: 0, timer: null, checkpoint: null, subs: [], done: false,
    speed: 1, tick: 0,
    ball: { x: 50, y: 50 }, ballT: { x: 50, y: 50 },
    flag: null, flash: null, crowd: false, mmAnim: null, prevScore: null
  };
}

async function playMatch(mode) {
  try {
    let match;
    if (mode === 'sim') {
      const r = await API.post('/api/match/sim');
      match = r.match;
      S.pendingMatch = null;
      S.lastResults = S.lastResults || [];
      toast('Partido simulado: ' + match.score[0] + '-' + match.score[1] + '. Avanza la semana para continuar.');
      await refresh();
      return;
    }
    if (S.pendingMatch) {
      match = S.pendingMatch;
    } else {
      const r = await API.post('/api/match/start');
      match = r.match;
      S.pendingMatch = match;
    }
    route = 'match';
    matchPlayback = newPlaybackState();
    render();
    startPlayback();
  } catch (err) { toast(err.message, 'error'); }
}

function matchSpeedInterval() {
  return 550 / ((matchPlayback && matchPlayback.speed) || 1);
}

function startPlayback() {
  const mp = matchPlayback;
  if (mp.timer) clearInterval(mp.timer);
  mp.timer = setInterval(playbackTick, matchSpeedInterval());
}

function playbackTick() {
  const mp = matchPlayback;
  if (!S.pendingMatch && !mp.done) { clearInterval(mp.timer); mp.timer = null; return; }
  const match = S.pendingMatch;
  if (!match) { clearInterval(mp.timer); mp.timer = null; return; }
  if (mp.revealed >= match.events.length) {
    if (match.finished) {
      mp.done = true;
      clearInterval(mp.timer); mp.timer = null;
      stopMinimapAnim();
      render();
    }
    return;
  }
  const ev = match.events[mp.revealed];
  mp.revealed++;
  mp.tick++;
  applyEventToMinimap(mp, ev, match);
  if (ev.type === 'checkpoint') {
    mp.checkpoint = ev.checkpoint;
    clearInterval(mp.timer); mp.timer = null;
  }
  if (ev.type === 'fulltime') {
    mp.done = true;
    clearInterval(mp.timer); mp.timer = null;
  }
  render();
}

/* ---------- Minimapa ---------- */

function clampX(v) { return Math.max(8, Math.min(92, v)); }

function minimapDotsFor(match) {
  const cache = (typeof SLOT_COORDS !== 'undefined') ? SLOT_COORDS : {};
  const out = {};
  for (const side of ['home', 'away']) {
    const f = (match._formations || [])[side === 'home' ? 0 : 1] || '4-3-3';
    const coords = cache[f] || cache['4-3-3'] || [];
    out[side] = (match.lineups[side] || []).map((id, i) => {
      const c = coords[i] || [50, 50];
      return side === 'home' ? { x: c[1], y: c[0] } : { x: 100 - c[1], y: 100 - c[0] };
    });
  }
  return out;
}

function applyEventToMinimap(mp, ev, match) {
  if (mp.flag && mp.tick - mp.flag.tick >= 4) mp.flag = null;
  if (mp.flash && mp.tick - mp.flash.tick >= 3) mp.flash = null;
  const st = match.stats;
  switch (ev.type) {
    case 'goal':
      mp.ballT = ev.side === 0 ? { x: 91, y: 50 } : { x: 9, y: 50 };
      mp.flash = { side: ev.side, tick: mp.tick };
      break;
    case 'save':
      mp.ballT = ev.side === 0 ? { x: 85, y: 44 } : { x: 15, y: 56 };
      break;
    case 'miss':
      mp.ballT = ev.side === 0 ? { x: 89, y: 32 } : { x: 11, y: 68 };
      break;
    case 'offside':
      mp.flag = { x: mp.ball.x, y: mp.ball.y, tick: mp.tick };
      mp.ballT = { x: clampX(mp.ball.x + (ev.side === 0 ? -14 : 14)), y: mp.ball.y };
      break;
    case 'crowd':
      mp.crowd = true;
      break;
    default: {
      const dir = st && st.possession && st.possession[0] >= st.possession[1] ? 1 : -1;
      mp.ballT = {
        x: clampX(mp.ball.x + dir * (5 + Math.random() * 8)),
        y: Math.max(14, Math.min(86, mp.ball.y + (Math.random() - 0.5) * 18))
      };
    }
  }
}

function startMinimapAnim() {
  const mp = matchPlayback;
  stopMinimapAnim();
  if (!mp || mp.done) return;
  mp.mmAnim = setInterval(() => {
    const svg = document.getElementById('minimap-svg');
    if (!svg) return;
    mp.ball.x += (mp.ballT.x - mp.ball.x) * 0.18;
    mp.ball.y += (mp.ballT.y - mp.ball.y) * 0.18;
    const ball = document.getElementById('mm-ball');
    if (ball) {
      ball.setAttribute('cx', mp.ball.x.toFixed(1));
      ball.setAttribute('cy', (mp.ball.y * 0.66).toFixed(1));
    }
    const t = Date.now() / 900;
    svg.querySelectorAll('.mm-dot').forEach(el => {
      const bx = Number(el.dataset.bx), by = Number(el.dataset.by) * 0.66, i = Number(el.dataset.i);
      el.setAttribute('cx', (bx + Math.sin(t + i * 1.9) * 1.6).toFixed(1));
      el.setAttribute('cy', (by + Math.cos(t * 0.8 + i * 2.6) * 1.4).toFixed(1));
    });
  }, 120);
}

function stopMinimapAnim() {
  if (matchPlayback && matchPlayback.mmAnim) {
    clearInterval(matchPlayback.mmAnim);
    matchPlayback.mmAnim = null;
  }
}

function minimapHtml(match, mp, home, away) {
  const dots = minimapDotsFor(match);
  const c1 = (home.kit && home.kit.c1) || home.primaryColor || '#e63946';
  const c2 = (away.kit && away.kit.c1) || away.primaryColor || '#1d3557';
  const dot = (p, i, color, side) =>
    '<circle class="mm-dot" data-side="' + side + '" data-i="' + i + '" data-bx="' + p.x.toFixed(1) + '" data-by="' + p.y.toFixed(1) + '" cx="' + p.x.toFixed(1) + '" cy="' + (p.y * 0.66).toFixed(1) + '" r="1.7" fill="' + esc(color) + '" stroke="#ffffff" stroke-width="0.4" stroke-opacity="0.75"/>';
  const svg =
    '<svg id="minimap-svg" class="minimap-canvas" viewBox="0 0 100 66" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Minimapa del partido">' +
      '<rect x="0.8" y="0.8" width="98.4" height="64.4" rx="2" class="mm-grass"/>' +
      '<line x1="50" y1="1.5" x2="50" y2="64.5" class="mm-line"/>' +
      '<circle cx="50" cy="33" r="8" class="mm-line" fill="none"/>' +
      '<rect x="0.8" y="16" width="12" height="34" class="mm-line" fill="none"/>' +
      '<rect x="87.2" y="16" width="12" height="34" class="mm-line" fill="none"/>' +
      dots.home.map((p, i) => dot(p, i, c1, 'home')).join('') +
      dots.away.map((p, i) => dot(p, i, c2, 'away')).join('') +
      '<circle id="mm-ball" class="mm-ball' + (mp.flash ? ' flash' : '') + '" cx="' + mp.ball.x.toFixed(1) + '" cy="' + (mp.ball.y * 0.66).toFixed(1) + '" r="1.2" fill="#ffffff" stroke="#111111" stroke-width="0.3"/>' +
      (mp.flag ? '<text class="mm-flag" x="' + clampX(mp.flag.x).toFixed(1) + '" y="' + (mp.flag.y * 0.66 - 2.5).toFixed(1) + '" text-anchor="middle">🚩</text>' : '') +
    '</svg>';
  return '<div class="card minimap-wrap"><h2>Minimapa en vivo</h2>' + svg +
    '<div class="mm-legend"><span><i class="mm-ld" style="background:' + esc(c1) + '"></i>' + esc(home.shortName || home.name) + '</span>' +
    '<span><i class="mm-ld" style="background:' + esc(c2) + '"></i>' + esc(away.shortName || away.name) + '</span>' +
    '<span><i class="mm-ld ball"></i>Balón</span></div>' +
    passionHtml(mp, match, scoreOfShown(match, mp)) +
    '</div>';
}

function scoreOfShown(match, mp) {
  const score = [0, 0];
  for (const ev of match.events.slice(0, mp.revealed)) if (ev.type === 'goal') score[ev.side]++;
  return score;
}

function passionHtml(mp, match, score) {
  const minute = mp.revealed && match.events[mp.revealed - 1] ? match.events[mp.revealed - 1].minute : 0;
  const homeLosing = score[0] < score[1];
  let p = 12 + minute * 0.6;
  if (homeLosing) p += 30 + (score[1] - score[0]) * 9;
  if (mp.crowd) p = Math.max(p, 88);
  p = Math.max(5, Math.min(100, Math.round(p)));
  const label = p < 35 ? 'Ambiente distendido' : p < 60 ? 'La grada se inquieta' : p < 85 ? '¡Empuje de la grada local!' : '🔥 Presión máxima del público';
  return '<div class="passion-meter' + (p >= 85 ? ' hot' : '') + '">' +
    '<div class="passion-top"><span class="passion-title">Pasión en las gradas</span><span class="passion-label">' + label + '</span></div>' +
    '<div class="passion-track"><div class="passion-fill" style="width:' + p + '%"></div></div></div>';
}

/* ---------- Vista principal ---------- */

function userSideOf(match) {
  return match.homeId === S.userClubId ? 'home' : 'away';
}

function renderMatch() {
  const match = S.pendingMatch;
  if (!match) { route = 'dashboard'; renderShell(); return; }
  const mp = matchPlayback || (matchPlayback = newPlaybackState());
  if (match.finished && !mp.timer) mp.done = true;

  const home = S.clubs[match.homeId], away = S.clubs[match.awayId];
  const shown = match.events.slice(0, mp.revealed);
  const lastEvent = shown[shown.length - 1];
  const minute = lastEvent ? lastEvent.minute : 0;
  const score = scoreOfShown(match, mp);
  const scoreChanged = mp.prevScore && (mp.prevScore[0] !== score[0] || mp.prevScore[1] !== score[1]);
  mp.prevScore = score;

  const st = match.stats;
  const statRow = (label, a, b) => {
    const sum = Math.max(1, (a || 0) + (b || 0));
    return '<div class="stat-line"><span>' + (a || 0) + '</span>' +
      '<div class="stat-bars"><div class="sb left" style="width:' + Math.round((a || 0) / sum * 100) + '%"></div>' +
      '<div class="sb right" style="width:' + Math.round((b || 0) / sum * 100) + '%"></div></div>' +
      '<span>' + (b || 0) + '</span><span class="stat-label">' + label + '</span></div>';
  };

  let feed = '';
  for (const ev of shown) {
    if (ev.type === 'checkpoint') continue;
    const cls = { goal: 'ev-goal', yellow: 'ev-yellow', red: 'ev-red', injury: 'ev-inj', sub: 'ev-sub', save: 'ev-save', miss: 'ev-miss', offside: 'ev-offside', crowd: 'ev-crowd' }[ev.type] || '';
    feed += '<div class="event ' + cls + '">' +
      '<span class="ev-min">' + ev.minute + "'</span><span>" + esc(ev.text) + '</span></div>';
  }
  if (!feed) feed = '<p class="empty-state">El balón está a punto de rodar…</p>';

  const userSide = userSideOf(match);
  const myScore = userSide === 'home' ? score[0] : score[1];
  const oppScore = userSide === 'home' ? score[1] : score[0];

  let controls = '';
  if (mp.checkpoint && !match.finished) {
    controls = renderTacticalPanel(match, userSide);
  } else if (mp.done && match.finished) {
    const res = myScore > oppScore ? '🏆 ¡Victoria!' : myScore === oppScore ? '🤝 Empate' : '😞 Derrota';
    controls = '<div class="tactical-panel"><p class="ft-result">' + res + '</p>' +
      '<button class="btn big" id="btn-after-match">Avanzar semana ⏩</button></div>';
  } else {
    controls = '<div class="tactical-panel"><button class="btn" id="btn-continue">▶️ Continuar (' + minute + "')</button>" +
      '<button class="btn secondary" id="btn-skip">⏩ Ir al final</button></div>';
  }

  const speedBtns = MATCH_SPEEDS.map(s =>
    '<button class="speed-btn' + ((mp.speed || 1) === s ? ' active' : '') + '" data-speed="' + s + '">' +
    (s === 0.5 ? '0.5×' : s + '×') + '</button>').join('');

  const $app = document.getElementById('app');
  stopMinimapAnim();
  $app.innerHTML =
    '<div class="match-wrap">' +
      '<div class="match-top"><button class="btn secondary small" id="btn-exit-match">← Salir</button>' +
        '<div class="speed-controls"><span class="sc-label">Velocidad</span>' + speedBtns + '</div></div>' +
      '<div class="scoreboard">' +
        '<div class="sb-team">' + badge(home, 48) + '<strong>' + esc(home.name) + '</strong></div>' +
        '<div class="sb-score"><span id="sb-minute">' + minute + "'</span><strong" + (scoreChanged ? ' class="pop"' : '') + '>' + score[0] + ' - ' + score[1] + '</strong>' +
        '<span class="sb-phase">' + (minute < 45 ? '1ª parte' : minute < 90 ? '2ª parte' : 'Final') + '</span></div>' +
        '<div class="sb-team">' + badge(away, 48) + '<strong>' + esc(away.name) + '</strong></div>' +
      '</div>' +
      '<div class="match-grid three">' +
        '<div class="card"><h2>Estadísticas</h2>' +
          statRow('Posesión %', st.possession[0], st.possession[1]) +
          statRow('Remates', st.shots[0], st.shots[1]) +
          statRow('A puerta', st.onTarget[0], st.onTarget[1]) +
          statRow('Córners', st.corners[0], st.corners[1]) +
          statRow('Faltas', st.fouls[0], st.fouls[1]) +
          statRow('Amarillas', st.cardsYellow[0], st.cardsYellow[1]) +
          statRow('Rojas', st.cardsRed[0], st.cardsRed[1]) +
        '</div>' +
        minimapHtml(match, mp, home, away) +
        '<div class="card"><h2>Crónica en directo</h2><div class="event-feed" id="event-feed">' + feed + '</div></div>' +
      '</div>' +
      controls +
    '</div>';

  document.querySelectorAll('.speed-btn').forEach(b => b.addEventListener('click', () => {
    mp.speed = Number(b.dataset.speed) || 1;
    document.querySelectorAll('.speed-btn').forEach(x => x.classList.toggle('active', x === b));
    if (mp.timer) startPlayback();
  }));

  const cont = document.getElementById('btn-continue');
  if (cont) cont.addEventListener('click', () => {
    if (!matchPlayback.timer) startPlayback();
  });
  const skip = document.getElementById('btn-skip');
  if (skip) skip.addEventListener('click', () => {
    matchPlayback.revealed = match.events.length;
    matchPlayback.checkpoint = null;
    matchPlayback.flag = null;
    if (match.finished) { matchPlayback.done = true; }
    else if (!matchPlayback.timer) startPlayback();
    render();
  });
  const exit = document.getElementById('btn-exit-match');
  exit.addEventListener('click', () => {
    if (matchPlayback.timer) { clearInterval(matchPlayback.timer); matchPlayback.timer = null; }
    stopMinimapAnim();
    route = 'dashboard';
    if (match.finished) { S.pendingMatch = null; }
    render();
  });
  const after = document.getElementById('btn-after-match');
  if (after) after.addEventListener('click', async () => {
    S.pendingMatch = null;
    route = 'dashboard';
    await advanceWeek();
  });
  bindTacticalPanel(match, userSide);
  bindNav($app);

  const feedEl = document.getElementById('event-feed');
  if (feedEl) feedEl.scrollTop = feedEl.scrollHeight;
  startMinimapAnim();
}

function renderTacticalPanel(match, userSide) {
  const mp = matchPlayback;
  const used = match.subsUsed[userSide] || 0;
  const pending = mp.subs;
  const oppSide = userSide === 'home' ? 'away' : 'home';
  const opp = S.clubs[match[oppSide === 'home' ? 'homeId' : 'awayId']];
  const club = userClub();
  return '<div class="tactical-panel">' +
    '<h2>⏸️ ' + (mp.checkpoint === 'HT' ? 'Descanso' : 'Minuto 75') + ' — decide tu plan</h2>' +
    '<div class="tp-row">' +
    '<label class="field inline"><span>Mentalidad</span><select id="tp-mentality">' +
      ['defensive', 'balanced', 'attacking'].map(m =>
        '<option value="' + m + '"' + (club.mentality === m ? ' selected' : '') + '>' +
        ({ defensive: 'Defensiva', balanced: 'Equilibrada', attacking: 'Ofensiva' }[m]) + '</option>').join('') +
    '</select></label>' +
    '<p class="hint-line">Cambios usados: ' + (used + pending.length) + '/5 · Rival: ' + esc(opp ? opp.name : '') + '</p>' +
    '</div>' +
    '<div id="tp-subs">' + pending.map((s, i) =>
      '<div class="sub-row"><span>🔄 Entra <strong>' + esc(S.players[s.inId].name) + '</strong> por <strong>' + esc(S.players[s.outId].name) + '</strong></span>' +
      '<button class="btn secondary small" data-unsub="' + i + '">Quitar</button></div>').join('') + '</div>' +
    '<div class="modal-actions">' +
    '<button class="btn secondary" id="tp-add-sub">Añadir cambio</button>' +
    '<button class="btn big" id="tp-continue">▶️ Reanudar partido</button>' +
    '</div></div>';
}

function bindTacticalPanel(match, userSide) {
  const mp = matchPlayback;
  const ment = document.getElementById('tp-mentality');
  if (!ment) return;
  const addSub = document.getElementById('tp-add-sub');
  addSub.addEventListener('click', () => openSubModal(match, userSide));
  document.querySelectorAll('[data-unsub]').forEach(el =>
    el.addEventListener('click', () => {
      mp.subs.splice(Number(el.dataset.unsub), 1);
      render();
    }));
  document.getElementById('tp-continue').addEventListener('click', async () => {
    try {
      const body = { mentality: ment.value };
      if (mp.subs.length) body.subs = mp.subs.map(s => ({ outId: s.outId, inId: s.inId }));
      const r = await API.post('/api/match/resume', body);
      S.pendingMatch = r.match;
      mp.checkpoint = null;
      mp.subs = [];
      mp.done = false;
      render();
      if (!r.match.finished) startPlayback();
      else { mp.done = true; render(); }
    } catch (err) {
      toast(err.message, 'error');
      mp.subs = [];
    }
  });
}

function openSubModal(match, userSide) {
  const mp = matchPlayback;
  const lineup = match.lineups[userSide];
  const bench = match.benches[userSide];
  const outIds = lineup.filter(id => !mp.subs.some(s => s.outId === id));
  const inIds = bench.filter(id => !mp.subs.some(s => s.inId === id));

  openModal(
    '<h2>Hacer cambio</h2>' +
    '<label class="field"><span>Jugador que sale</span><select id="sub-out">' +
    outIds.map(id => '<option value="' + id + '">' + esc(S.players[id].name) + ' (' + S.players[id].pos + ', ' + S.players[id].overall + ')</option>').join('') +
    '</select></label>' +
    '<label class="field"><span>Jugador que entra</span><select id="sub-in">' +
    inIds.map(id => '<option value="' + id + '">' + esc(S.players[id].name) + ' (' + S.players[id].pos + ', ' + S.players[id].overall + ')</option>').join('') +
    '</select></label>' +
    '<div class="close-row"><button class="btn secondary" id="sub-cancel">Cancelar</button>' +
    '<button class="btn" id="sub-ok">Añadir cambio</button></div>'
  );
  document.getElementById('sub-cancel').addEventListener('click', closeModal);
  document.getElementById('sub-ok').addEventListener('click', () => {
    const outId = document.getElementById('sub-out').value;
    const inId = document.getElementById('sub-in').value;
    if (!outId || !inId) { toast('Selecciona ambos jugadores', 'error'); return; }
    mp.subs.push({ outId, inId });
    closeModal();
    render();
  });
}
