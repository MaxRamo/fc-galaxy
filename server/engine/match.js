'use strict';

const { Rng } = require('./rng');
const { FORMATIONS } = require('./club');
const { clamp } = require('./player');

const RELATED = {
  CB: ['DM', 'LB', 'RB'],
  LB: ['CB', 'DM', 'CM'],
  RB: ['CB', 'DM', 'CM'],
  DM: ['CM', 'CB'],
  CM: ['DM', 'AM'],
  AM: ['CM', 'LW', 'RW', 'ST'],
  LW: ['RW', 'ST', 'AM'],
  RW: ['LW', 'ST', 'AM'],
  ST: ['AM', 'LW', 'RW']
};

function positionFit(playerPos, slotPos) {
  if (playerPos === slotPos) return 1.0;
  if (playerPos === 'GK' || slotPos === 'GK') return 0.4;
  if ((RELATED[playerPos] || []).includes(slotPos)) return 0.93;
  return 0.8;
}

function formationSlots(formation) {
  const f = FORMATIONS[formation] || FORMATIONS['4-3-3'];
  const slots = [];
  const order = ['GK', 'CB', 'LB', 'RB', 'DM', 'CM', 'AM', 'LW', 'RW', 'ST'];
  for (const pos of order) {
    for (let i = 0; i < (f[pos] || 0); i++) slots.push(pos);
  }
  return slots;
}

function effectiveRating(player, slotPos) {
  const fit = positionFit(player.pos, slotPos);
  let r = player.overall * fit;
  r *= 1 - Math.max(0, player.fatigue - 40) / 160;
  r += (player.morale - 70) / 22;
  r += player.form * 0.5;
  return r;
}

function autoPickLineup(club, players) {
  const slots = formationSlots(club.formation);
  const available = club.squad
    .map(id => players[id])
    .filter(p => p && !p.injury && p.ban <= 0)
    .sort((a, b) => b.overall - a.overall);
  const used = new Set();
  const lineup = [];
  for (const slot of slots) {
    let best = null, bestR = -1;
    for (const p of available) {
      if (used.has(p.id)) continue;
      const r = effectiveRating(p, slot);
      if (r > bestR) { bestR = r; best = p; }
    }
    if (best) { used.add(best.id); lineup.push(best.id); }
    else lineup.push(null);
  }
  return lineup.filter(Boolean);
}

function resolveLineup(club, players) {
  const slots = formationSlots(club.formation);
  let lineup = (club.lineup || []).map(id => players[id]).filter(p => p && !p.injury && p.ban <= 0).map(p => p.id);
  lineup = lineup.slice(0, slots.length);
  if (lineup.length < slots.length) {
    const picked = autoPickLineup(club, players);
    for (const id of picked) {
      if (lineup.length >= slots.length) break;
      if (!lineup.includes(id)) lineup.push(id);
    }
  }
  const bench = club.squad
    .map(id => players[id])
    .filter(p => p && !lineup.includes(p.id) && !p.injury && p.ban <= 0)
    .sort((a, b) => b.overall - a.overall)
    .slice(0, 7)
    .map(p => p.id);
  return { lineup, bench };
}

function teamStrength(club, lineupIds, players, isHome) {
  const slots = formationSlots(club.formation);
  const playersIn = lineupIds.map(id => players[id]).filter(Boolean);
  let def = 0, mid = 0, att = 0, dW = 0, mW = 0, aW = 0;
  let chemSum = 0;
  const DEF_POS = ['CB', 'LB', 'RB'], MID_POS = ['DM', 'CM', 'AM'], ATT_POS = ['LW', 'RW', 'ST'];
  slots.forEach((slot, i) => {
    const p = playersIn[i];
    if (!p) return;
    const r = effectiveRating(p, slot);
    chemSum += positionFit(p.pos, slot);
    if (p.pos === 'GK') { def += r * 0.9; dW += 0.9; return; }
    if (DEF_POS.includes(p.pos)) { def += r; dW += 1; mid += r * 0.15; mW += 0.15; }
    else if (MID_POS.includes(p.pos)) { mid += r; mW += 1; def += r * 0.22; dW += 0.22; att += r * 0.2; aW += 0.2; }
    else { att += r; aW += 1; mid += r * 0.2; mW += 0.2; }
  });
  def = dW ? def / dW : 40;
  mid = mW ? mid / mW : 40;
  att = aW ? att / aW : 40;

  const naturalCount = playersIn.filter((p, i) => slots[i] && p.pos === slots[i]).length;
  const chem = playersIn.length ? chemSum / playersIn.length : 0.7;
  const chemBonus = 1 + (chem - 0.85) * 0.25 + (naturalCount / Math.max(1, playersIn.length)) * 0.06;

  const m = club.mentality || 'balanced';
  const mentMod = {
    defensive: { att: 0.88, def: 1.12 },
    balanced: { att: 1.0, def: 1.0 },
    attacking: { att: 1.14, def: 0.9 }
  }[m] || { att: 1, def: 1 };

  const press = club.tactics && club.tactics.pressing;
  const pressMod = press === 'high' ? { att: 1.05, def: 0.96, fatigue: 1.25 } : press === 'low' ? { att: 0.95, def: 1.04, fatigue: 0.8 } : { att: 1, def: 1, fatigue: 1 };

  const home = isHome ? 1.045 : 1.0;

  return {
    attack: att * mentMod.att * pressMod.att * chemBonus * home,
    defense: def * mentMod.def * pressMod.def * chemBonus,
    midfield: mid * chemBonus * home,
    chemistry: chem,
    fatigueMod: pressMod.fatigue
  };
}

function createMatch(state, homeClubId, awayClubId) {
  const players = state.players;
  const home = state.clubs[homeClubId], away = state.clubs[awayClubId];
  const h = resolveLineup(home, players);
  const a = resolveLineup(away, players);
  return {
    homeId: homeClubId,
    awayId: awayClubId,
    minute: 0,
    score: [0, 0],
    events: [],
    stats: {
      possession: [50, 50], shots: [0, 0], onTarget: [0, 0],
      corners: [0, 0], fouls: [0, 0], cardsYellow: [0, 0], cardsRed: [0, 0]
    },
    _formations: [home.formation, away.formation],
    lineups: { home: h.lineup, away: a.lineup },
    benches: { home: h.bench, away: a.bench },
    subsUsed: { home: 0, away: 0 },
    matchRatings: {},
    goals: {},
    assists: {},
    finished: false,
    userClubId: state.clubs[homeClubId].isUser ? homeClubId : (state.clubs[awayClubId].isUser ? awayClubId : null)
  };
}

function pushEvent(match, ev) {
  ev.minute = match.minute;
  match.events.push(ev);
  return ev;
}

function pickWeighted(rng, entries) {
  let total = 0;
  for (const e of entries) total += e.w;
  let r = rng.float() * total;
  for (const e of entries) { r -= e.w; if (r <= 0) return e; }
  return entries[entries.length - 1];
}

function attackerWeight(player, slotPos) {
  if (player.pos === 'GK') return 0.02;
  const map = { ST: 10, LW: 7, RW: 7, AM: 6, CM: 3, DM: 1.2, LB: 1.5, RB: 1.5, CB: 0.8 };
  return (map[slotPos] || 2) * (0.4 + player.attrs.shooting / 100);
}

function creatorWeight(player, slotPos) {
  if (player.pos === 'GK') return 0.05;
  const map = { AM: 9, CM: 6, LW: 6, RW: 6, ST: 3, DM: 2.5, LB: 3, RB: 3, CB: 1 };
  return (map[slotPos] || 2) * (0.4 + player.attrs.passing / 100);
}

function runSegment(state, match, untilMinute) {
  const rng = state.rng;
  const players = state.players;
  const home = state.clubs[match.homeId], away = state.clubs[match.awayId];
  const hs = teamStrength(home, match.lineups.home, players, true);
  const as = teamStrength(away, match.lineups.away, players, false);

  const stoppageOf = () => (untilMinute >= 90 ? (match._stoppage || 0) : 0);
  while (match.minute < untilMinute + stoppageOf() && !match.finished) {
    match.minute++;
    const min = match.minute;

    if (min === 90 && untilMinute >= 90 && !match._stoppageAnnounced) {
      match._stoppageAnnounced = true;
      const interruptions = match.events.filter(e =>
        ['goal', 'sub', 'yellow', 'red', 'injury'].includes(e.type) && e.minute > 45).length;
      match._stoppage = Math.max(1, Math.min(6, 1 + Math.ceil(interruptions / 4)));
      pushEvent(match, { type: 'added', text: '\u23f1\ufe0f Se jugar\u00e1n ' + match._stoppage + ' minutos de tiempo a\u00f1adido' });
    }

    const midDiff = hs.midfield - as.midfield;
    const homePoss = clamp(50 + midDiff * 0.35, 30, 70);
    match.stats.possession[0] = Math.round((match.stats.possession[0] * (min - 1) + homePoss) / min);
    match.stats.possession[1] = 100 - match.stats.possession[0];

    const homeAttacking = homePoss / 100 * hs.attack / (hs.attack + as.defense);
    const homeLosing = match.score[0] < match.score[1];
    if (min === 60 && homeLosing && !match._crowdPushed) {
      match._crowdPushed = true;
      pushEvent(match, { type: 'crowd', side: 0, text: '🔥 La grada local se echa el equipo a la espalda y empuja' });
    }
    const crowdBoost = (min >= 60 && homeLosing) ? 1.12 : 1;
    const chanceProb = 0.21 * (homeAttacking * 2) * crowdBoost;
    if (rng.chance(chanceProb)) createChance(state, match, hs, as, 0);
    const awayAttacking = (1 - homePoss / 100) * as.attack / (as.attack + hs.defense);
    if (rng.chance(0.21 * (awayAttacking * 2))) createChance(state, match, as, hs, 1);

    if (rng.chance(0.028)) cardEvent(state, match);
    if (rng.chance(0.006)) injuryEvent(state, match);

    if ((min === 60 || min === 72 || min === 80) && !match.finished) {
      aiSubstitutions(state, match);
    }

    for (const side of [0, 1]) {
      const ids = match.lineups[side === 0 ? 'home' : 'away'];
      const fatigueMod = side === 0 ? hs.fatigueMod : as.fatigueMod;
      for (const id of ids) {
        const p = players[id];
        if (p) p.fatigue = clamp(p.fatigue + 0.45 * fatigueMod, 0, 100);
      }
    }

    if (min === 45 && match.userClubId) {
      pushEvent(match, { type: 'checkpoint', checkpoint: 'HT', text: 'Descanso: ' + home.shortName + ' ' + match.score[0] + '-' + match.score[1] + ' ' + away.shortName });
      return;
    }
  }
  finishMatch(state, match);
}

function createChance(state, match, attS, defS, side) {
  const rng = state.rng;
  const players = state.players;
  const oppSide = side === 0 ? 1 : 0;
  const lineupKey = side === 0 ? 'home' : 'away';
  const oppKey = oppSide === 0 ? 'home' : 'away';
  const attIds = match.lineups[lineupKey];
  const defIds = match.lineups[oppKey];

  const slots = formationSlots(match._formations[side]);
  const creator = pickWeighted(rng, attIds.map((id, i) => ({ id, w: creatorWeight(players[id], slots[i] || 'CM') })));
  const shooter = pickWeighted(rng, attIds.map((id, i) => ({ id, w: attackerWeight(players[id], slots[i] || 'CM') })));

  const gkId = defIds.find(id => players[id] && players[id].pos === 'GK');
  const gk = gkId ? players[gkId] : null;

  const shooterP = players[shooter.id];
  if (rng.chance(0.08)) {
    pushEvent(match, { type: 'offside', side, playerId: shooter.id, playerName: shooterP.name, text: '🚩 Fuera de juego de ' + shooterP.name });
    return;
  }
  const quality = clamp(0.25 + (shooterP.attrs.shooting - 55) / 90 + (attS.attack - defS.defense) / 130 + rng.range(-0.08, 0.08), 0.05, 0.75);
  const gkFactor = gk ? clamp(0.9 + (gk.attrs.reflexes - 60) / 220, 0.75, 1.05) : 1;
  const roll = rng.float();

  match.stats.onTarget[side]++;
  if (roll < quality * gkFactor * 0.95) {
    match.score[side]++;
    const hasAssist = creator.id !== shooter.id && rng.chance(0.75);
    if (hasAssist) match.assists[creator.id] = (match.assists[creator.id] || 0) + 1;
    match.goals[shooter.id] = (match.goals[shooter.id] || 0) + 1;
    const teamName = side === 0 ? state.clubs[match.homeId].shortName : state.clubs[match.awayId].shortName;
    pushEvent(match, {
      type: 'goal', side, team: teamName,
      playerId: shooter.id, playerName: shooterP.name,
      assistId: hasAssist ? creator.id : null,
      assistName: hasAssist ? players[creator.id].name : null,
      text: `¡GOL de ${shooterP.name} (${teamName})!`
    });
  } else if (roll < quality * gkFactor * 0.95 + 0.22) {
    pushEvent(match, {
      type: 'save', side,
      text: gk ? `Gran parada de ${gk.name} tras el disparo de ${shooterP.name}` : `Disparo fuera de ${shooterP.name}`
    });
  } else if (roll < 0.92) {
    match.stats.shots[side]++;
    pushEvent(match, { type: 'miss', side, text: `${shooterP.name} remata fuera` });
  }
}

function cardEvent(state, match) {
  const rng = state.rng;
  const side = rng.chance(0.5) ? 0 : 1;
  const key = side === 0 ? 'home' : 'away';
  const ids = match.lineups[key].filter(id => players_gk(state, id) === false);
  if (!ids.length) return;
  const id = rng.pick(ids);
  const p = state.players[id];
  if (!p) return;
  const red = rng.chance(0.12);
  if (red) {
    match.stats.cardsRed[side]++;
    match.lineups[key] = match.lineups[key].filter(x => x !== id);
    pushEvent(match, { type: 'red', side, playerId: id, playerName: p.name, text: `🟥 Roja directa para ${p.name}! Su equipo se queda con 10` });
    p._matchRed = true;
  } else {
    match.stats.cardsYellow[side]++;
    p._matchYellow = (p._matchYellow || 0) + 1;
    pushEvent(match, { type: 'yellow', side, playerId: id, playerName: p.name, text: `🟨 Amarilla para ${p.name}` });
  }
}

function players_gk(state, id) {
  const p = state.players[id];
  return !p || p.pos === 'GK';
}

function injuryEvent(state, match) {
  const rng = state.rng;
  const side = rng.chance(0.5) ? 0 : 1;
  const key = side === 0 ? 'home' : 'away';
  const ids = match.lineups[key];
  if (!ids.length) return;
  const id = rng.pick(ids);
  const p = state.players[id];
  if (!p || p.injury) return;
  const risk = 0.25 + Math.max(0, p.fatigue - 50) / 120;
  if (!rng.chance(risk)) return;
  const severities = [
    { name: 'golpe leve', weeks: 1 },
    { name: 'distensión muscular', weeks: rng.int(2, 3) },
    { name: 'lesión de tobillo', weeks: rng.int(3, 6) },
    { name: 'rotura fibrilar', weeks: rng.int(6, 10) }
  ];
  const sev = rng.pick(severities);
  p.injury = { type: sev.name, weeks: sev.weeks };
  pushEvent(match, { type: 'injury', side, playerId: id, playerName: p.name, text: `🚑 ${p.name} se lesiona (${sev.name}, ~${sev.weeks} sem.)` });
  const bench = match.benches[key];
  if (bench.length && match.subsUsed[key] < 5) {
    const subId = bench.shift();
    match.lineups[key] = match.lineups[key].map(x => (x === id ? subId : x));
    match.benches[key] = bench;
    match.subsUsed[key]++;
    const subP = state.players[subId];
    pushEvent(match, { type: 'sub', side, outId: id, outName: p.name, inId: subId, inName: subP.name, text: `🔄 Entra ${subP.name} por ${p.name}` });
  }
}

function aiSubstitutions(state, match) {
  const rng = state.rng;
  for (const side of [0, 1]) {
    const key = side === 0 ? 'home' : 'away';
    const club = side === 0 ? state.clubs[match.homeId] : state.clubs[match.awayId];
    if (club.isUser && match.userClubId) continue;
    if (match.subsUsed[key] >= 4) continue;
    const tired = match.lineups[key]
      .map(id => state.players[id])
      .filter(p => p && p.fatigue > 72)
      .sort((a, b) => b.fatigue - a.fatigue);
    const bench = match.benches[key];
    if (tired.length && bench.length && rng.chance(0.5)) {
      const out = tired[0];
      const inId = bench.shift();
      match.lineups[key] = match.lineups[key].map(x => (x === out.id ? inId : x));
      match.benches[key] = bench;
      match.subsUsed[key]++;
      const inP = state.players[inId];
      pushEvent(match, { type: 'sub', side, outId: out.id, outName: out.name, inId, inName: inP.name, text: `🔄 ${club.shortName}: entra ${inP.name} por ${out.name}` });
    }
  }
}

function ratingForPlayer(match, playerId, side) {
  let r = 6.3;
  r += (match.goals[playerId] || 0) * 1.2;
  r += (match.assists[playerId] || 0) * 0.7;
  if (match._yellowIds && match._yellowIds.has(playerId)) r -= 0.4;
  if (match._redIds && match._redIds.has(playerId)) r -= 1.5;
  const teamGoals = match.score[side];
  const oppGoals = match.score[side === 0 ? 1 : 0];
  if (teamGoals > oppGoals) r += 0.35;
  else if (teamGoals < oppGoals) r -= 0.25;
  const p = match._statePlayers[playerId];
  if (p) r += (p.overall - 60) / 90;
  return clamp(Math.round(r * 10) / 10 + (Math.random() * 0.4 - 0.2), 3, 10);
}

function finishMatch(state, match) {
  if (match.finished) return;
  match.minute = Math.max(match.minute, 90);
  match.stoppage = match._stoppage || 0;
  match.finished = true;
  match._yellowIds = new Set(match.events.filter(e => e.type === 'yellow').map(e => e.playerId).filter(Boolean));
  match._redIds = new Set(match.events.filter(e => e.type === 'red').map(e => e.playerId).filter(Boolean));
  match._statePlayers = state.players;
  match._formations = match._formations || [state.clubs[match.homeId].formation, state.clubs[match.awayId].formation];

  pushEvent(match, {
    type: 'fulltime',
    text: `Final: ${state.clubs[match.homeId].name} ${match.score[0]} - ${match.score[1]} ${state.clubs[match.awayId].name}`
  });

  for (const side of [0, 1]) {
    const key = side === 0 ? 'home' : 'away';
    for (const id of match.lineups[key]) {
      const p = state.players[id];
      if (!p) continue;
      p.stats.apps++;
      p.stats.goals += match.goals[id] || 0;
      p.stats.assists += match.assists[id] || 0;
      const rating = ratingForPlayer(match, id, side);
      p.stats.ratingSum += rating;
      p.stats.ratedApps++;
      p.stats.avgRating = Math.round((p.stats.ratingSum / p.stats.ratedApps) * 100) / 100;
      p.form = clamp(p.form * 0.7 + (rating - 6.5) * 1.2, -3, 3);
      let sp = 0;
      if (rating >= 7.5) sp += 1;
      if ((match.goals[id] || 0) > 0) sp += 1;
      if (sp > 0) p.skillPoints = (p.skillPoints || 0) + sp;
      if (p._matchRed) { p.ban = Math.max(p.ban, 2); p.stats.red++; p._matchRed = false; }
      if (p._matchYellow) {
        p.stats.yellow++;
        if (p.stats.yellow % 5 === 0) p.ban = Math.max(p.ban, 1);
        p._matchYellow = 0;
      }
      p.morale = clamp(p.morale + (match.score[side] > match.score[side === 0 ? 1 : 0] ? 3 : match.score[side] < match.score[side === 0 ? 1 : 0] ? -3 : 0), 20, 99);
    }
  }

  const events = match.events;
  for (const side of [0, 1]) {
    const oppSide = side === 0 ? 1 : 0;
    if (match.score[oppSide] === 0) {
      const gkId = match.lineups[side === 0 ? 'home' : 'away'].find(id => state.players[id] && state.players[id].pos === 'GK');
      if (gkId) state.players[gkId].stats.cleanSheets++;
    }
  }

  return match;
}

module.exports = {
  createMatch, runSegment, finishMatch, resolveLineup, autoPickLineup,
  teamStrength, formationSlots, positionFit, effectiveRating, RELATED
};
