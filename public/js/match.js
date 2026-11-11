'use strict';

/* ================= FC Galaxy — vista y reproducci\u00f3n de partidos ================= */

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
    matchPlayback = { revealed: 0, timer: null, checkpoint: null, subs: [], done: false };
    render();
    startPlayback();
  } catch (err) { toast(err.message, 'error'); }
}

function startPlayback() {
  const mp = matchPlayback;
  if (mp.timer) clearInterval(mp.timer);
  mp.timer = setInterval(() => {
    if (!S.pendingMatch && !mp.done) { clearInterval(mp.timer); mp.timer = null; return; }
    const match = S.pendingMatch;
    if (!match) { clearInterval(mp.timer); mp.timer = null; return; }
    if (mp.revealed >= match.events.length) {
      if (match.finished) { mp.done = true; clearInterval(mp.timer); mp.timer = null; render(); }
      return;
    }
    const ev = match.events[mp.revealed];
    mp.revealed++;
    if (ev.type === 'checkpoint') {
      mp.checkpoint = ev.checkpoint;
      clearInterval(mp.timer); mp.timer = null;
    }
    if (ev.type === 'fulltime') {
      mp.done = true;
      clearInterval(mp.timer); mp.timer = null;
    }
    render();
  }, 550);
}

function userSideOf(match) {
  return match.homeId === S.userClubId ? 'home' : 'away';
}

function renderMatch() {
  const match = S.pendingMatch;
  if (!match) { route = 'dashboard'; renderShell(); return; }
  const mp = matchPlayback || (matchPlayback = { revealed: match.events.length, timer: null, checkpoint: null, subs: [], done: match.finished });

  const home = S.clubs[match.homeId], away = S.clubs[match.awayId];
  const shown = match.events.slice(0, mp.revealed);
  const lastEvent = shown[shown.length - 1];
  const minute = lastEvent ? lastEvent.minute : 0;
  const score = [0, 0];
  for (const ev of shown) if (ev.type === 'goal') score[ev.side]++;
  const scoreChanged = mp.prevScore && (mp.prevScore[0] !== score[0] || mp.prevScore[1] !== score[1]);
  mp.prevScore = score;

  const st = match.stats;
  const statRow = (label, a, b, total) => {
    const sum = Math.max(1, (a || 0) + (b || 0));
    return '<div class="stat-line"><span>' + (a || 0) + '</span>' +
      '<div class="stat-bars"><div class="sb left" style="width:' + Math.round((a || 0) / sum * 100) + '%"></div>' +
      '<div class="sb right" style="width:' + Math.round((b || 0) / sum * 100) + '%"></div></div>' +
      '<span>' + (b || 0) + '</span><span class="stat-label">' + label + '</span></div>';
  };

  let feed = '';
  for (const ev of shown) {
    if (ev.type === 'checkpoint') continue;
    const cls = { goal: 'ev-goal', yellow: 'ev-yellow', red: 'ev-red', injury: 'ev-inj', sub: 'ev-sub', save: 'ev-save', miss: 'ev-miss' }[ev.type] || '';
    feed += '<div class="event ' + cls + '">' +
      '<span class="ev-min">' + ev.minute + "'</span><span>" + esc(ev.text) + '</span></div>';
  }
  if (!feed) feed = '<p class="empty-state">El bal\u00f3n est\u00e1 a punto de rodar\u2026</p>';

  const userSide = userSideOf(match);
  const myScore = userSide === 'home' ? score[0] : score[1];
  const oppScore = userSide === 'home' ? score[1] : score[0];

  let controls = '';
  if (mp.checkpoint && !match.finished) {
    controls = renderTacticalPanel(match, userSide);
  } else if (mp.done && match.finished) {
    const res = myScore > oppScore ? '\ud83c\udfc6 \u00a1Victoria!' : myScore === oppScore ? '\ud83e\udd1d Empate' : '\ud83d\ude1e Derrota';
    controls = '<div class="tactical-panel"><p class="ft-result">' + res + '</p>' +
      '<button class="btn big" id="btn-after-match">Avanzar semana \u23e9</button></div>';
  } else {
    controls = '<div class="tactical-panel"><button class="btn" id="btn-continue">\u25b6\ufe0f Continuar (' + minute + "')</button>" +
      '<button class="btn secondary" id="btn-skip">\u23e9 Ir al final</button></div>';
  }

  const $app = document.getElementById('app');
  $app.innerHTML =
    '<div class="match-wrap">' +
      '<div class="match-top"><button class="btn secondary small" id="btn-exit-match">\u2190 Salir</button></div>' +
      '<div class="scoreboard">' +
        '<div class="sb-team">' + badge(home, 48) + '<strong>' + esc(home.name) + '</strong></div>' +
        '<div class="sb-score"><span id="sb-minute">' + minute + "'</span><strong" + (scoreChanged ? ' class="pop"' : '') + '>' + score[0] + ' - ' + score[1] + '</strong>' +
        '<span class="sb-phase">' + (minute < 45 ? '1\u00aa parte' : minute < 90 ? '2\u00aa parte' : 'Final') + '</span></div>' +
        '<div class="sb-team">' + badge(away, 48) + '<strong>' + esc(away.name) + '</strong></div>' +
      '</div>' +
      '<div class="match-grid">' +
        '<div class="card"><h2>Estad\u00edsticas</h2>' +
          statRow('Posesi\u00f3n %', st.possession[0], st.possession[1]) +
          statRow('Remates', st.shots[0], st.shots[1]) +
          statRow('A puerta', st.onTarget[0], st.onTarget[1]) +
          statRow('C\u00f3rners', st.corners[0], st.corners[1]) +
          statRow('Faltas', st.fouls[0], st.fouls[1]) +
          statRow('Amarillas', st.cardsYellow[0], st.cardsYellow[1]) +
          statRow('Rojas', st.cardsRed[0], st.cardsRed[1]) +
        '</div>' +
        '<div class="card"><h2>Cr\u00f3nica en directo</h2><div class="event-feed" id="event-feed">' + feed + '</div></div>' +
      '</div>' +
      controls +
    '</div>';

  const cont = document.getElementById('btn-continue');
  if (cont) cont.addEventListener('click', () => {
    if (!matchPlayback.timer) startPlayback();
  });
  const skip = document.getElementById('btn-skip');
  if (skip) skip.addEventListener('click', () => {
    matchPlayback.revealed = match.events.length;
    matchPlayback.checkpoint = null;
    if (match.finished) { matchPlayback.done = true; }
    else if (!matchPlayback.timer) startPlayback();
    render();
  });
  const exit = document.getElementById('btn-exit-match');
  exit.addEventListener('click', () => {
    if (matchPlayback.timer) { clearInterval(matchPlayback.timer); matchPlayback.timer = null; }
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
}

function renderTacticalPanel(match, userSide) {
  const mp = matchPlayback;
  const used = match.subsUsed[userSide] || 0;
  const pending = mp.subs;
  const oppSide = userSide === 'home' ? 'away' : 'home';
  const opp = S.clubs[match[oppSide === 'home' ? 'homeId' : 'awayId']];
  const club = userClub();
  return '<div class="tactical-panel">' +
    '<h2>\u23f8\ufe0f ' + (mp.checkpoint === 'HT' ? 'Descanso' : 'Minuto 75') + ' \u2014 decide tu plan</h2>' +
    '<div class="tp-row">' +
    '<label class="field inline"><span>Mentalidad</span><select id="tp-mentality">' +
      ['defensive', 'balanced', 'attacking'].map(m =>
        '<option value="' + m + '"' + (club.mentality === m ? ' selected' : '') + '>' +
        ({ defensive: 'Defensiva', balanced: 'Equilibrada', attacking: 'Ofensiva' }[m]) + '</option>').join('') +
    '</select></label>' +
    '<p class="hint-line">Cambios usados: ' + (used + pending.length) + '/5 \u00b7 Rival: ' + esc(opp ? opp.name : '') + '</p>' +
    '</div>' +
    '<div id="tp-subs">' + pending.map((s, i) =>
      '<div class="sub-row"><span>\ud83d\udd04 Entra <strong>' + esc(S.players[s.inId].name) + '</strong> por <strong>' + esc(S.players[s.outId].name) + '</strong></span>' +
      '<button class="btn secondary small" data-unsub="' + i + '">Quitar</button></div>').join('') + '</div>' +
    '<div class="modal-actions">' +
    '<button class="btn secondary" id="tp-add-sub">A\u00f1adir cambio</button>' +
    '<button class="btn big" id="tp-continue">\u25b6\ufe0f Reanudar partido</button>' +
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
    '<button class="btn" id="sub-ok">A\u00f1adir cambio</button></div>'
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
