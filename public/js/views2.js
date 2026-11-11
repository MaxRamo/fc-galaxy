'use strict';

/* ================= FC Galaxy — vistas: t\u00e1cticas, entrenamiento, liga ================= */

const RELATED_POS = {
  CB: ['DM', 'LB', 'RB'], LB: ['CB', 'DM', 'CM'], RB: ['CB', 'DM', 'CM'],
  DM: ['CM', 'CB'], CM: ['DM', 'AM'], AM: ['CM', 'LW', 'RW', 'ST'],
  LW: ['RW', 'ST', 'AM'], RW: ['LW', 'ST', 'AM'], ST: ['AM', 'LW', 'RW']
};

function positionFitPct(playerPos, slotPos) {
  if (playerPos === slotPos) return 100;
  if (playerPos === 'GK' || slotPos === 'GK') return 40;
  if ((RELATED_POS[playerPos] || []).includes(slotPos)) return 93;
  return 80;
}

const SLOT_COORDS = {
  '4-4-2': [[50,8],[35,22],[65,22],[14,26],[86,26],[38,52],[62,52],[16,72],[84,72],[38,86],[62,86]],
  '4-3-3': [[50,8],[35,22],[65,22],[14,26],[86,26],[50,44],[33,58],[67,58],[16,78],[84,78],[50,88]],
  '4-2-3-1': [[50,8],[35,22],[65,22],[14,26],[86,26],[38,46],[62,46],[50,66],[16,74],[84,74],[50,88]],
  '3-5-2': [[50,8],[30,22],[50,20],[70,22],[50,42],[30,56],[50,56],[70,56],[50,72],[38,86],[62,86]],
  '5-3-2': [[50,8],[30,20],[50,18],[70,20],[12,30],[88,30],[50,44],[33,58],[67,58],[38,84],[62,84]],
  '4-1-4-1': [[50,8],[35,22],[65,22],[14,26],[86,26],[50,42],[28,56],[50,58],[72,56],[16,74],[84,74],[50,88]]
};

function formationSlotsFor(formation) {
  const counts = {
    '4-4-2': { GK:1, CB:2, LB:1, RB:1, CM:2, LW:1, RW:1, ST:2 },
    '4-3-3': { GK:1, CB:2, LB:1, RB:1, DM:1, CM:2, LW:1, RW:1, ST:1 },
    '4-2-3-1': { GK:1, CB:2, LB:1, RB:1, DM:2, AM:1, LW:1, RW:1, ST:1 },
    '3-5-2': { GK:1, CB:3, DM:1, CM:3, AM:1, ST:2 },
    '5-3-2': { GK:1, CB:3, LB:1, RB:1, DM:1, CM:2, ST:2 },
    '4-1-4-1': { GK:1, CB:2, LB:1, RB:1, DM:1, CM:3, LW:1, RW:1, ST:1 }
  }[formation] || { GK:1, CB:2, LB:1, RB:1, DM:1, CM:2, LW:1, RW:1, ST:1 };
  const order = ['GK', 'CB', 'LB', 'RB', 'DM', 'CM', 'AM', 'LW', 'RW', 'ST'];
  const slots = [];
  for (const pos of order) for (let i = 0; i < (counts[pos] || 0); i++) slots.push(pos);
  return slots;
}

function effRatingLocal(p, slotPos) {
  const fit = positionFitPct(p.pos, slotPos) / 100;
  let r = p.overall * fit;
  r *= 1 - Math.max(0, p.fatigue - 40) / 160;
  r += (p.morale - 70) / 22;
  r += (p.form || 0) * 0.5;
  return r;
}

function autoLineupLocal(club, slots) {
  const available = club.squad.map(id => S.players[id])
    .filter(p => p && !p.injury && p.ban <= 0);
  const used = new Set();
  const lineup = [];
  for (const slot of slots) {
    let best = null, bestR = -1;
    for (const p of available) {
      if (used.has(p.id)) continue;
      const r = effRatingLocal(p, slot);
      if (r > bestR) { bestR = r; best = p; }
    }
    if (best) { used.add(best.id); lineup.push(best.id); }
  }
  return lineup;
}

function strengthPreview(club, lineupIds) {
  const slots = formationSlotsFor(club.formation);
  const playersIn = lineupIds.map(id => S.players[id]).filter(Boolean);
  let def = 0, mid = 0, att = 0, dW = 0, mW = 0, aW = 0, chemSum = 0;
  const DEF_POS = ['CB', 'LB', 'RB'], MID_POS = ['DM', 'CM', 'AM'];
  slots.forEach((slot, i) => {
    const p = playersIn[i];
    if (!p) return;
    const r = effRatingLocal(p, slot);
    chemSum += positionFitPct(p.pos, slot) / 100;
    if (p.pos === 'GK') { def += r * 0.9; dW += 0.9; return; }
    if (DEF_POS.includes(p.pos)) { def += r; dW += 1; mid += r * 0.15; mW += 0.15; }
    else if (MID_POS.includes(p.pos)) { mid += r; mW += 1; def += r * 0.22; dW += 0.22; att += r * 0.2; aW += 0.2; }
    else { att += r; aW += 1; mid += r * 0.2; mW += 0.2; }
  });
  const natural = playersIn.filter((p, i) => slots[i] && p.pos === slots[i]).length;
  const chem = playersIn.length ? chemSum / playersIn.length : 0.7;
  const chemBonus = 1 + (chem - 0.85) * 0.25 + (natural / Math.max(1, playersIn.length)) * 0.06;
  const mentMod = { defensive: { att: 0.88, def: 1.12 }, balanced: { att: 1, def: 1 }, attacking: { att: 1.14, def: 0.9 } }[club.mentality || 'balanced'];
  return {
    def: Math.round((dW ? def / dW : 40) * mentMod.def * chemBonus),
    mid: Math.round((mW ? mid / mW : 40) * chemBonus),
    att: Math.round((aW ? att / aW : 40) * mentMod.att * chemBonus),
    chem: Math.round(chem * 100)
  };
}

function renderTacticsView(root) {
  const club = userClub();
  if (!tacticsDraft) {
    tacticsDraft = {
      formation: club.formation,
      mentality: club.mentality,
      pressing: club.tactics.pressing,
      lineup: (club.lineup && club.lineup.length) ? club.lineup.slice() : autoLineupLocal(club, formationSlotsFor(club.formation))
    };
  }
  const d = tacticsDraft;
  const slots = formationSlotsFor(d.formation);
  const coords = SLOT_COORDS[d.formation] || SLOT_COORDS['4-3-3'];

  let pitch = '<div class="pitch">';
  slots.forEach((slotPos, i) => {
    const pid = d.lineup[i];
    const p = pid ? S.players[pid] : null;
    const [x, y] = coords[i] || [50, 50];
    const fit = p ? positionFitPct(p.pos, slotPos) : 100;
    const fitCls = fit === 100 ? '' : fit >= 90 ? ' fit-ok' : ' fit-bad';
    pitch += '<button class="slot' + fitCls + '" style="left:' + x + '%;top:' + (100 - y) + '%" data-slot="' + i + '">' +
      (p ? '<span class="slot-name">' + esc(p.name.split(' ').pop()) + '</span>' +
        '<span class="slot-ovr">' + p.overall + '</span>' +
        '<span class="slot-pos ' + (fit < 100 ? 'warn' : '') + '">' + p.pos + '</span>'
        : '<span class="slot-pos">' + slotPos + '</span><span class="slot-empty">+</span>') +
      '</button>';
  });
  pitch += '</div>';

  const bench = club.squad.map(id => S.players[id]).filter(p => p && !d.lineup.includes(p.id))
    .sort((a, b) => b.overall - a.overall);

  const st = strengthPreview(club, d.lineup);

  root.innerHTML =
    '<h1 class="view-title">T\u00e1cticas y alineaci\u00f3n</h1>' +
    '<div class="tactics-grid">' +
      '<div class="card"><h2>Campo</h2>' + pitch +
        '<p class="hint-line">Toca una posici\u00f3n para asignar jugador. Verde = posici\u00f3n natural, amarillo = desajustado.</p></div>' +
      '<div class="card"><h2>Instrucciones</h2>' +
        '<label class="field"><span>Formaci\u00f3n</span><select id="tac-formation">' +
          Object.keys(SLOT_COORDS).map(f => '<option value="' + f + '"' + (f === d.formation ? ' selected' : '') + '>' + f + '</option>').join('') +
        '</select></label>' +
        '<label class="field"><span>Mentalidad</span><select id="tac-mentality">' +
          '<option value="defensive"' + (d.mentality === 'defensive' ? ' selected' : '') + '>Defensiva</option>' +
          '<option value="balanced"' + (d.mentality === 'balanced' ? ' selected' : '') + '>Equilibrada</option>' +
          '<option value="attacking"' + (d.mentality === 'attacking' ? ' selected' : '') + '>Ofensiva</option>' +
        '</select></label>' +
        '<label class="field"><span>Presi\u00f3n</span><select id="tac-pressing">' +
          '<option value="low"' + (d.pressing === 'low' ? ' selected' : '') + '>Baja</option>' +
          '<option value="medium"' + (d.pressing === 'medium' ? ' selected' : '') + '>Media</option>' +
          '<option value="high"' + (d.pressing === 'high' ? ' selected' : '') + '>Alta</option>' +
        '</select></label>' +
        '<div class="strength-row">' +
          '<div><span>DEF</span><strong>' + st.def + '</strong></div>' +
          '<div><span>MED</span><strong>' + st.mid + '</strong></div>' +
          '<div><span>ATA</span><strong>' + st.att + '</strong></div>' +
          '<div><span>Qu\u00edmica</span><strong>' + st.chem + '%</strong></div>' +
        '</div>' +
        '<div class="modal-actions">' +
          '<button class="btn secondary" id="tac-auto">\u2728 Auto-completar</button>' +
          '<button class="btn" id="tac-save">\ud83d\udcbe Guardar t\u00e1ctica</button>' +
        '</div>' +
        '<p id="tac-msg" class="hint-line"></p>' +
      '</div>' +
      '<div class="card"><h2>Suplentes y libres</h2><div class="bench-list">' +
        (bench.length ? bench.map(p =>
          '<div class="bench-item" data-bench="' + p.id + '">' + posTag(p.pos) + ' <span>' + esc(p.name) + '</span> ' +
          ovrBadge(p.overall) + (p.injury ? ' \ud83e\ude79' : '') + (p.ban > 0 ? ' \ud83d\udfa8' : '') + '</div>').join('')
          : '<p class="empty-state">Toda la plantilla est\u00e1 en el once.</p>') +
      '</div></div>' +
    '</div>';

  root.querySelectorAll('.slot').forEach(el =>
    el.addEventListener('click', () => openSlotPicker(Number(el.dataset.slot), slots[Number(el.dataset.slot)])));

  document.getElementById('tac-formation').addEventListener('change', e => {
    d.formation = e.target.value;
    d.lineup = autoLineupLocal(club, formationSlotsFor(d.formation));
    renderTacticsView(root);
  });
  document.getElementById('tac-mentality').addEventListener('change', e => { d.mentality = e.target.value; renderTacticsView(root); });
  document.getElementById('tac-pressing').addEventListener('change', e => { d.pressing = e.target.value; renderTacticsView(root); });
  document.getElementById('tac-auto').addEventListener('click', () => {
    d.lineup = autoLineupLocal(club, formationSlotsFor(d.formation));
    renderTacticsView(root);
  });
  document.getElementById('tac-save').addEventListener('click', async () => {
    try {
      await API.post('/api/tactics', {
        formation: d.formation, mentality: d.mentality, pressing: d.pressing, lineup: d.lineup
      });
      club.formation = d.formation; club.mentality = d.mentality;
      club.tactics.pressing = d.pressing; club.lineup = d.lineup.slice();
      toast('T\u00e1ctica guardada: ' + d.formation + '.');
    } catch (err) { toast(err.message, 'error'); }
  });
  bindNav(root);
}

function openSlotPicker(slotIdx, slotPos) {
  const club = userClub();
  const d = tacticsDraft;
  const candidates = club.squad.map(id => S.players[id])
    .filter(p => p && !d.lineup.includes(p.id))
    .sort((a, b) => (positionFitPct(b.pos, slotPos) * 100 + b.overall) - (positionFitPct(a.pos, slotPos) * 100 + a.overall));

  let list = candidates.map(p => {
    const fit = positionFitPct(p.pos, slotPos);
    const cls = fit === 100 ? 'ok' : fit >= 90 ? 'mid' : 'low';
    return '<button class="pick-row ' + cls + '" data-pick="' + p.id + '">' +
      posTag(p.pos) + '<span class="pick-name">' + esc(p.name) + '</span>' +
      '<span class="pick-fit">' + fit + '%</span>' + ovrBadge(p.overall) +
      (p.injury ? '<span class="status-tag injury">\ud83e\ude79</span>' : '') +
      (p.ban > 0 ? '<span class="status-tag ban">\ud83d\udfa8</span>' : '') +
      '</button>';
  }).join('');

  openModal(
    '<h2>Asignar a posici\u00f3n ' + slotPos + '</h2>' +
    '<div class="pick-list">' + (list || '<p class="empty-state">No hay jugadores disponibles sin asignar.</p>') + '</div>' +
    (d.lineup[slotIdx] ? '<div class="close-row"><button class="btn secondary" id="sp-clear">Quitar del once</button></div>' : '') +
    '<div class="close-row"><button class="btn secondary" id="sp-close">Cerrar</button></div>'
  );
  document.getElementById('sp-close').addEventListener('click', closeModal);
  const clear = document.getElementById('sp-clear');
  if (clear) clear.addEventListener('click', () => {
    d.lineup[slotIdx] = null;
    closeModal();
    render();
  });
  document.querySelectorAll('.pick-row').forEach(el =>
    el.addEventListener('click', () => {
      const pid = el.dataset.pick;
      const prev = d.lineup.indexOf(pid);
      if (prev !== -1) d.lineup[prev] = null;
      d.lineup[slotIdx] = pid;
      closeModal();
      render();
    }));
}

function viewTraining(root) {
  const club = userClub();
  const players = club.squad.map(id => S.players[id]).filter(Boolean).sort((a, b) => b.overall - a.overall);
  const focuses = ['balanced', 'attack', 'defense', 'technique', 'fitness'];
  const labels = { balanced: 'Equilibrado', attack: 'Ataque', defense: 'Defensa', technique: 'T\u00e9cnica', fitness: 'F\u00edsico' };

  let html = '<h1 class="view-title">Entrenamiento</h1>' +
    '<div class="card"><h2>Enfoque del equipo</h2>' +
    '<div class="focus-tabs">' + focuses.map(f =>
      '<button class="focus-tab' + (club.trainingFocus === f ? ' active' : '') + '" data-focus="' + f + '">' + labels[f] + '</button>').join('') +
    '</div>' +
    '<p class="hint-line">El enfoque del equipo se aplica a los jugadores sin entrenamiento individual. Mejorar la instalaci\u00f3n de entrenamiento (en Mi Club) aumenta el desarrollo semanal.</p></div>' +
    '<div class="card"><h2>Entrenamiento individual</h2><div class="table-scroll"><table class="table"><thead><tr>' +
    '<th>Jugador</th><th>Pos</th><th>Med</th><th>Pot</th><th>Edad</th><th>Enfoque individual</th></tr></thead><tbody>';
  for (const p of players) {
    const cur = club.playerTraining[p.id] || 'balanced';
    html += '<tr><td class="name-cell">' + esc(p.name) + '</td><td>' + posTag(p.pos) + '</td>' +
      '<td>' + ovrBadge(p.overall) + '</td><td>' + potentialText(p) + '</td><td>' + p.age + '</td>' +
      '<td><select data-train="' + p.id + '" class="train-select">' +
      focuses.map(f => '<option value="' + f + '"' + (cur === f ? ' selected' : '') + '>' + labels[f] + '</option>').join('') +
      '</select></td></tr>';
  }
  html += '</tbody></table></div>' +
    '<button class="btn" id="btn-save-training" style="margin-top:12px">\ud83d\udcbe Guardar entrenamientos</button></div>';

  root.innerHTML = html;
  root.querySelectorAll('.focus-tab').forEach(el =>
    el.addEventListener('click', async () => {
      try {
        await API.post('/api/training', { focus: el.dataset.focus });
        club.trainingFocus = el.dataset.focus;
        toast('Enfoque del equipo: ' + labels[el.dataset.focus] + '.');
        viewTraining(root);
      } catch (err) { toast(err.message, 'error'); }
    }));
  document.getElementById('btn-save-training').addEventListener('click', async () => {
    const map = {};
    root.querySelectorAll('.train-select').forEach(sel => { map[sel.dataset.train] = sel.value; });
    try {
      await API.post('/api/training', { playerTraining: map });
      club.playerTraining = Object.assign({}, club.playerTraining, map);
      toast('Entrenamientos individuales guardados.');
    } catch (err) { toast(err.message, 'error'); }
  });
  bindNav(root);
}

function viewLeague(root) {
  const club = userClub();
  let html = '<h1 class="view-title">Liga \u00b7 Temporada ' + S.season + '</h1>' +
    '<div class="card"><h2>Clasificaci\u00f3n</h2><div class="table-scroll"><table class="table"><thead><tr>' +
    '<th>#</th><th>Club</th><th>PJ</th><th>G</th><th>E</th><th>P</th><th>GF</th><th>GC</th><th>DG</th><th>Pts</th>' +
    '</tr></thead><tbody>';
  S.table.forEach((r, i) => {
    const cls = r.clubId === club.id ? ' class="me-row"' : '';
    const zone = i === 0 ? ' style="border-left:3px solid var(--accent)"' : '';
    html += '<tr' + cls + zone + '><td>' + (i + 1) + '</td><td>' + esc(r.name) + '</td><td>' + r.played + '</td>' +
      '<td>' + r.w + '</td><td>' + r.d + '</td><td>' + r.l + '</td><td>' + r.gf + '</td><td>' + r.ga + '</td>' +
      '<td>' + (r.gd > 0 ? '+' : '') + r.gd + '</td><td><strong>' + r.pts + '</strong></td></tr>';
  });
  html += '</tbody></table></div></div>';

  const rounds = S.league.fixtures || [];
  let cal = '<div class="card"><h2>Calendario</h2>';
  if (rounds.length) {
    cal += '<label class="field inline"><span>Jornada</span><select id="cal-round">' +
      rounds.map((r, i) => '<option value="' + i + '"' + (i === Math.min(S.round, rounds.length - 1) ? ' selected' : '') + '>Jornada ' + (i + 1) + '</option>').join('') +
      '</select></label><div id="cal-round-body"></div>';
  } else {
    cal += '<p class="empty-state">No hay calendario disponible.</p>';
  }
  cal += '</div>';
  html += cal;

  root.innerHTML = html;

  const renderRound = () => {
    const idx = Number(document.getElementById('cal-round').value);
    const body = document.getElementById('cal-round-body');
    const matches = rounds[idx] || [];
    body.innerHTML = matches.length ? matches.map(m => {
      const h = S.clubs[m.home], a = S.clubs[m.away];
      if (!h || !a) return '';
      const mine = m.home === club.id || m.away === club.id;
      return '<div class="result-item' + (mine ? ' mine' : '') + '">' + badge(h, 22) + ' ' + esc(h.shortName) +
        ' <strong>' + (m.played ? m.score[0] + ' - ' + m.score[1] : 'vs') + '</strong> ' +
        esc(a.shortName) + ' ' + badge(a, 22) + '</div>';
    }).join('') : '<p class="empty-state">Sin partidos.</p>';
  };
  const sel = document.getElementById('cal-round');
  if (sel) { sel.addEventListener('change', renderRound); renderRound(); }
  bindNav(root);
}

function viewTactics(root) { renderTacticsView(root); }
