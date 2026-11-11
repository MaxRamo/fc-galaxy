'use strict';

/* ================= FC Galaxy — vistas: panel, plantilla, jugador, inbox ================= */

const ATTR_LABELS = {
  pace: 'Velocidad', shooting: 'Finalizaci\u00f3n', passing: 'Pase', dribbling: 'Regate',
  defending: 'Defensa', physical: 'F\u00edsico',
  reflexes: 'Reflejos', handling: 'Manos', positioning: 'Colocaci\u00f3n', kicking: 'Saque'
};

function statusOf(p) {
  if (p.injury) return '<span class="status-tag injury">\ud83e\ude79 ' + p.injury.weeks + ' sem</span>';
  if (p.ban > 0) return '<span class="status-tag ban">\ud83d\udfa8 ' + p.ban + ' part.</span>';
  return '<span class="status-tag ok">OK</span>';
}

function rowHtml(p, opts) {
  const o = opts || {};
  return '<tr class="player-row" data-player="' + p.id + '">' +
    '<td>' + posTag(p.pos) + '</td>' +
    '<td class="name-cell">' + (p.nationality ? '<span class="nat-flag" title="Nacionalidad">' + flagOf(p.nationality) + '</span> ' : '') + esc(p.name) + (p.origin === 'cantera' ? ' <span class="youth-star">\ud83c\udf31</span>' : '') + '</td>' +
    '<td>' + p.age + '</td>' +
    '<td>' + ovrBadge(p.overall) + '</td>' +
    '<td>' + potentialText(p) + '</td>' +
    '<td>' + moraleEmoji(p.morale) + ' ' + p.morale + '</td>' +
    '<td><div class="bar mini"><div class="fill ' + (p.fatigue > 70 ? 'danger' : p.fatigue > 40 ? 'warn' : 'ok') + '" style="width:' + Math.round(p.fatigue) + '%"></div></div></td>' +
    '<td>' + (p.form > 1 ? '\u2191' : p.form < -1 ? '\u2193' : '\u2014') + '</td>' +
    '<td>' + fmtMoney(p.contract.wage) + '</td>' +
    '<td>T' + p.contract.until + '</td>' +
    '<td>' + statusOf(p) + '</td>' +
    '<td>' + fmtMoney(p.value) + '</td>' +
    '</tr>';
}

function squadTopScorer(club) {
  let best = null;
  for (const id of club.squad) {
    const p = S.players[id];
    if (p && (!best || p.stats.goals > best.stats.goals)) best = p;
  }
  return best;
}

function viewDashboard(root) {
  const club = userClub();
  const nf = S.nextFixture;
  const table = S.table;
  const myPos = table.findIndex(r => r.clubId === club.id) + 1;
  const wages = club.squad.reduce((sum, id) => sum + (S.players[id] ? S.players[id].contract.wage : 0), 0);
  const scorer = squadTopScorer(club);
  const msgs = (S.inbox || []).slice(0, 4);

  let html = '<h1 class="view-title">Panel del club</h1>';

  if (S.phase === 'seasonEnd') {
    const aw = S.seasonAwards || {};
    html += '<div class="card season-end-card">' +
      '<h2>\ud83c\udfc6 Temporada ' + S.season + ' finalizada</h2>' +
      (aw.champion ? '<p class="champ-line">Campe\u00f3n: <strong style="color:var(--accent)">' + esc(aw.champion) + '</strong></p>' : '') +
      (aw.topScorer ? '<p>M\u00e1ximo goleador: <strong>' + esc(aw.topScorer.name) + '</strong> (' + aw.topScorer.goals + ' goles)</p>' : '') +
      (aw.bestRated ? '<p>Mejor valoraci\u00f3n: <strong>' + esc(aw.bestRated.name) + '</strong> (' + aw.bestRated.rating.toFixed(2) + ')</p>' : '') +
      '<p style="margin-top:10px;color:var(--text-dim)">Usa el bot\u00f3n \u201cNueva temporada\u201d en la barra superior para continuar: los jugadores envejecer\u00e1n, algunos se retirar\u00e1n y los contratos vencidos expirar\u00e1n.</p>' +
      '</div>';
  }

  if (nf) {
    html += '<div class="card next-match-card">' +
      '<div class="nm-header"><span class="nm-label">Jornada ' + (S.round + 1) + ' de ' + S.totalRounds + '</span>' +
      '<span>' + (nf.isHome ? 'Local \ud83c\udfdf\ufe0f' : 'Visitante \u2708\ufe0f') + '</span></div>' +
      '<div class="nm-teams">' + badge(S.clubs[nf.homeId], 44) + '<strong>' + esc(nf.home) + '</strong>' +
      '<span class="vs">VS</span><strong>' + esc(nf.away) + '</strong>' + badge(S.clubs[nf.awayId], 44) + '</div>' +
      '<div class="nm-actions">' +
      '<button class="btn" id="btn-play-live">\u25b6\ufe0f Jugar en vivo</button>' +
      '<button class="btn secondary" id="btn-play-sim">\u23e9 Simular resultado</button>' +
      '</div></div>';
  } else if (S.phase === 'season') {
    html += '<div class="card"><p style="color:var(--text-dim)">No hay partido pendiente. Avanza la semana para continuar.</p></div>';
  }

  html += '<div class="grid grid-2">';

  html += '<div class="card"><h2>\ud83c\udfc6 Clasificaci\u00f3n</h2><table class="table compact"><thead><tr>' +
    '<th>#</th><th>Club</th><th>PJ</th><th>DG</th><th>Pts</th></tr></thead><tbody>';
  table.slice(0, 5).forEach((r, i) => {
    const cls = r.clubId === club.id ? ' class="me-row"' : '';
    html += '<tr' + cls + '><td>' + (i + 1) + '</td><td>' + esc(r.name) + '</td><td>' + r.played + '</td><td>' +
      (r.gd > 0 ? '+' : '') + r.gd + '</td><td><strong>' + r.pts + '</strong></td></tr>';
  });
  html += '</tbody></table>' +
    (myPos ? '<p class="hint-line">Tu posici\u00f3n: <strong>' + myPos + '\u00ba</strong> de ' + table.length + '</p>' : '') +
    '<button class="btn secondary small" data-nav="league">Ver liga completa</button></div>';

  html += '<div class="card"><h2>\ud83d\udcc5 \u00daltimas jornadas</h2>';
  if (S.lastResults.length) {
    html += '<div class="result-list">';
    for (const r of S.lastResults.slice(0, 6)) {
      const mine = r.homeId === club.id || r.awayId === club.id;
      html += '<div class="result-item' + (mine ? ' mine' : '') + '"><span class="rr">J' + (r.round + 1) + '</span>' +
        esc(S.clubs[r.homeId] ? S.clubs[r.homeId].shortName : '?') + ' <strong>' + r.score[0] + '-' + r.score[1] + '</strong> ' +
        esc(S.clubs[r.awayId] ? S.clubs[r.awayId].shortName : '?') + '</div>';
    }
    html += '</div>';
  } else {
    html += '<p class="empty-state">A\u00fan no se ha jugado ning\u00fan partido.</p>';
  }
  html += '</div></div>';

  html += '<div class="grid grid-3">' +
    '<div class="card stat-card"><h3>Tesorer\u00eda</h3><p class="big-num" style="color:var(--accent)">' + fmtMoney(club.budget) + ' FCG</p><p class="hint-line">Salarios semanales: ' + fmtMoney(wages) + ' FCG</p></div>' +
    '<div class="card stat-card"><h3>Plantilla</h3><p class="big-num">' + club.squad.length + ' jugadores</p><p class="hint-line">' +
    (scorer ? 'M\u00e1ximo goleador: ' + esc(scorer.name) + ' (' + scorer.stats.goals + ')' : 'Sin datos a\u00fan') + '</p></div>' +
    '<div class="card stat-card"><h3>Afici\u00f3n</h3><p class="big-num">' + (club.fanbase / 1000000).toFixed(2) + 'M</p><p class="hint-line">' + esc(club.stadium.name) + ' \u00b7 ' + club.stadium.capacity.toLocaleString('es-ES') + ' asientos</p></div>' +
    '</div>';

  html += '<div class="card"><h2>\ud83d\udcec Bandeja de entrada <button class="btn secondary small" data-nav="inbox" style="float:right">Ver todas (' + unreadCount() + ' sin leer)</button></h2>';
  if (msgs.length) {
    for (const m of msgs) {
      html += '<div class="inbox-item' + (m.read ? '' : ' unread') + '"><div class="inbox-title">' + (m.read ? '' : '<span class="dot"></span>') + esc(m.title) + '</div>' +
        '<p>' + esc(m.body.length > 140 ? m.body.slice(0, 140) + '\u2026' : m.body) + '</p></div>';
    }
  } else {
    html += '<p class="empty-state">Sin mensajes.</p>';
  }
  html += '</div>';

  root.innerHTML = html;

  const live = document.getElementById('btn-play-live');
  if (live) live.addEventListener('click', () => playMatch('live'));
  const sim = document.getElementById('btn-play-sim');
  if (sim) sim.addEventListener('click', () => playMatch('sim'));
  bindNav(root);
  root.querySelectorAll('.player-row').forEach(el =>
    el.addEventListener('click', () => openPlayerModal(S.players[el.dataset.player])));
}

function viewSquad(root) {
  const club = userClub();
  const players = club.squad.map(id => S.players[id]).filter(Boolean)
    .sort((a, b) => b.overall - a.overall);

  let html = '<h1 class="view-title">Plantilla <span class="count-chip">' + players.length + ' jugadores</span></h1>' +
    '<div class="card"><div class="table-scroll"><table class="table"><thead><tr>' +
    '<th>Pos</th><th>Jugador</th><th>Edad</th><th>Med</th><th>Pot</th><th>Moral</th><th>Fatiga</th><th>Forma</th><th>Salario</th><th>Contrato</th><th>Estado</th><th>Valor</th>' +
    '</tr></thead><tbody>';
  if (players.length) {
    for (const p of players) html += rowHtml(p);
  } else {
    html += '<tr><td colspan="12" class="empty-state">No hay jugadores en la plantilla. Firma agentes libres desde el Mercado.</td></tr>';
  }
  html += '</tbody></table></div>' +
    '<p class="hint-line">Haz clic en un jugador para ver su perfil, atributos, contrato y acciones. \ud83c\udf31 = jugador de la cantera.</p></div>';

  root.innerHTML = html;
  root.querySelectorAll('.player-row').forEach(el =>
    el.addEventListener('click', () => openPlayerModal(S.players[el.dataset.player])));
  bindNav(root);
}

function attrBars(p) {
  const keys = p.pos === 'GK' ? ['reflexes', 'handling', 'positioning', 'kicking'] :
    ['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical'];
  return keys.map(k => {
    const v = p.attrs[k] || 0;
    const cls = v >= 80 ? 'ok' : v >= 60 ? 'mid' : 'low';
    return '<div class="attr-row"><span class="attr-label">' + (ATTR_LABELS[k] || k) + '</span>' +
      '<div class="bar"><div class="fill ' + cls + '" style="width:' + v + '%"></div></div>' +
      '<span class="attr-val">' + v + '</span></div>';
  }).join('');
}

function openPlayerModal(p) {
  if (!p) return;
  const club = userClub();
  const mine = club.squad.includes(p.id);
  const s = p.stats;
  const avg = s.ratedApps ? (s.ratingSum / s.ratedApps).toFixed(2) : '\u2014';
  const listing = (S.market.listings || []).find(l => l.playerId === p.id);

  let actions = '';
  if (mine) {
    actions =
      '<div class="modal-actions">' +
      '<button class="btn secondary" id="pm-renew">\ud83d\udcc4 Renovar contrato</button>' +
      '<button class="btn secondary" id="pm-list">\ud83d\udcb0 Poner en el mercado</button>' +
      '</div>' +
      '<div class="modal-actions"><label class="field inline"><span>Entrenamiento individual</span>' +
      '<select id="pm-train">' +
      ['balanced', 'attack', 'defense', 'technique', 'fitness'].map(f =>
        '<option value="' + f + '"' + ((club.playerTraining[p.id] || club.trainingFocus) === f ? ' selected' : '') + '>' +
        ({ balanced: 'Equilibrado', attack: 'Ataque', defense: 'Defensa', technique: 'T\u00e9cnica', fitness: 'F\u00edsico' }[f]) + '</option>').join('') +
      '</select></label></div>';
  }

  openModal(
    '<div class="player-modal-head">' +
      posTag(p.pos) + '<h2>' + (p.nationality ? flagOf(p.nationality) + ' ' : '') + esc(p.name) + '</h2>' + ovrBadge(p.overall) + statusOf(p) +
    '</div>' +
    '<div class="grid grid-2">' +
      '<div>' + attrBars(p) + '</div>' +
      '<div class="player-info">' +
        '<p><span>Edad</span><strong>' + p.age + ' a\u00f1os</strong></p>' +
        '<p><span>Potencial</span><strong>' + potentialText(p) + '</strong></p>' +
        '<p><span>Moral</span><strong>' + moraleEmoji(p.morale) + ' ' + moraleLabel(p.morale) + ' (' + p.morale + ')</strong></p>' +
        '<p><span>Fatiga</span><strong>' + Math.round(p.fatigue) + '%</strong></p>' +
        '<p><span>Valor de mercado</span><strong style="color:var(--accent)">' + fmtMoney(p.value) + ' FCG</strong></p>' +
        '<p><span>Salario</span><strong>' + fmtMoney(p.contract.wage) + ' / semana</strong></p>' +
        '<p><span>Contrato hasta</span><strong>Temporada ' + p.contract.until + '</strong></p>' +
        '<p><span>Activo digital</span><strong class="mono">NFT #' + (p.tokenId || '\u2014') + '</strong></p>' +
        '<hr>' +
        '<p><span>Partidos</span><strong>' + s.apps + '</strong></p>' +
        '<p><span>Goles / Asist.</span><strong>' + s.goals + ' / ' + s.assists + '</strong></p>' +
        '<p><span>Valoraci\u00f3n media</span><strong>' + avg + '</strong></p>' +
        '<p><span>Tarjetas</span><strong>\ud83d\udfe8 ' + s.yellow + ' \u00b7 \ud83d\udfe5 ' + s.red + '</strong></p>' +
      '</div>' +
    '</div>' +
    (listing ? '<p class="sim-note">Este jugador est\u00e1 publicado en el mercado por ' + fmtMoney(listing.price) + ' FCG.</p>' : '') +
    actions
  );

  if (!mine) return;
  document.getElementById('pm-renew').addEventListener('click', () => renewContractModal(p));
  document.getElementById('pm-list').addEventListener('click', () => listPlayerModal(p));
  document.getElementById('pm-train').addEventListener('change', async e => {
    try {
      await API.post('/api/training', { playerTraining: { [p.id]: e.target.value } });
      club.playerTraining[p.id] = e.target.value;
      toast('Entrenamiento individual actualizado para ' + p.name + '.');
    } catch (err) { toast(err.message, 'error'); }
  });
}

function renewContractModal(p) {
  const club = userClub();
  const cur = p.contract;
  const htmlYears = [1, 2, 3, 4, 5].map(y =>
    '<option value="' + y + '"' + (y === 2 ? ' selected' : '') + '>' + y + ' a\u00f1o' + (y > 1 ? 's' : '') + '</option>').join('');
  openModal(
    '<h2>Renovar: ' + esc(p.name) + '</h2>' +
    '<p style="color:var(--text-dim)">Contrato actual: ' + fmtMoney(cur.wage) + '/sem hasta T' + cur.until + '.</p>' +
    '<label class="field"><span>A\u00f1os de contrato</span><select id="rc-years">' + htmlYears + '</select></label>' +
    '<p id="rc-cost" class="sim-note"></p>' +
    '<div class="close-row"><button class="btn secondary" id="rc-cancel">Cancelar</button>' +
    '<button class="btn" id="rc-ok">Renovar</button></div>'
  );
  const yearsSel = document.getElementById('rc-years');
  const cost = () => {
    const y = Number(yearsSel.value);
    const bonus = Math.round(p.value * 0.04 * y);
    document.getElementById('rc-cost').textContent =
      'Prima de fichaje estimada: ' + fmtMoney(bonus) + ' FCG + nuevo salario semanal.';
  };
  cost();
  yearsSel.addEventListener('change', cost);
  document.getElementById('rc-cancel').addEventListener('click', closeModal);
  document.getElementById('rc-ok').addEventListener('click', async () => {
    try {
      const r = await API.post('/api/contracts/renew', { playerId: p.id, years: Number(yearsSel.value) });
      p.contract = { wage: r.wage, until: r.until };
      closeModal();
      openPlayerModal(p);
      toast('Contrato renovado. Prima pagada: ' + fmtMoney(r.bonus || 0) + ' FCG.');
      render();
    } catch (err) { toast(err.message, 'error'); }
  });
}

function listPlayerModal(p) {
  const min = Math.round(p.value * 0.4), max = Math.round(p.value * 4);
  openModal(
    '<h2>Publicar en el mercado</h2>' +
    '<p style="color:var(--text-dim)">' + esc(p.name) + ' \u00b7 valoraci\u00f3n: ' + fmtMoney(p.value) + ' FCG.</p>' +
    '<label class="field"><span>Precio pedido (FCG) \u2014 entre ' + fmtMoney(min) + ' y ' + fmtMoney(max) + '</span>' +
    '<input type="number" id="lp-price" min="' + min + '" max="' + max + '" step="10000" value="' + Math.round(p.value) + '"></label>' +
    '<p class="sim-note">Al venderse, la transferencia se ejecuta como contrato inteligente simulado en la SIMCHAIN (4% de comisi\u00f3n de mercado, quemado).</p>' +
    '<div class="close-row"><button class="btn secondary" id="lp-cancel">Cancelar</button>' +
    '<button class="btn" id="lp-ok">Publicar</button></div>'
  );
  document.getElementById('lp-cancel').addEventListener('click', closeModal);
  document.getElementById('lp-ok').addEventListener('click', async () => {
    try {
      const price = Math.round(Number(document.getElementById('lp-price').value));
      const r = await API.post('/api/market/list', { playerId: p.id, price });
      S.market.listings.push(r.listing);
      closeModal();
      toast(p.name + ' publicado en el mercado por ' + fmtMoney(price) + ' FCG.');
      render();
    } catch (err) { toast(err.message, 'error'); }
  });
}

function viewInbox(root) {
  let html = '<h1 class="view-title">Bandeja de entrada</h1><div class="card">';
  const msgs = (S.inbox || []).slice().reverse();
  if (msgs.length) {
    for (const m of msgs) {
      html += '<div class="inbox-item' + (m.read ? '' : ' unread') + '">' +
        '<div class="inbox-title">' + (m.read ? '' : '<span class="dot"></span>') + esc(m.title) +
        '<span class="inbox-meta">T' + m.season + ' \u00b7 S' + m.week + '</span></div>' +
        '<p>' + esc(m.body) + '</p></div>';
    }
  } else {
    html += '<p class="empty-state">No tienes mensajes. Las noticias de partidos, ofertas y la cantera llegar\u00e1n aqu\u00ed.</p>';
  }
  html += '</div>';
  root.innerHTML = html;
  bindNav(root);
}
