'use strict';

const { Rng } = require('./rng');
const { CITIES, randomName } = require('./names');
const { generatePlayer, computeValue, wageDemand, growthForPlayer, applyGrowth, clamp } = require('./player');
const { generateClubSquad, createClub, aiClubName, FORMATIONS } = require('./club');
const { TEAMS, PRIZE_MONEY, buildFixtures, computeTable, currentRoundFixtures, allRoundMatchesPlayed } = require('./league');
const matchEngine = require('./match');
const finance = require('./finance');
const youth = require('./youth');
const market = require('./market');

const chainMod = require('../../blockchain/chain');
const tokenMod = require('../../blockchain/token');
const nftMod = require('../../blockchain/nft');
const contractMod = require('../../blockchain/contract');

const SAVE_VERSION = 3;

function walletAddress(state, clubId) {
  return '0xSIM' + clubId.replace(/[^a-z0-9]/gi, '').toUpperCase().padEnd(8, '0').slice(0, 8);
}

function syncWallet(state, clubId, memo) {
  const club = state.clubs[clubId];
  const addr = club.wallet;
  const bal = tokenMod.balanceOf(state.token, addr);
  const delta = Math.round(club.budget) - bal;
  if (delta > 0) {
    const tx = tokenMod.mint(state.token, addr, delta, memo || 'Sincronización económica semanal (simulada)');
    return tx;
  } else if (delta < 0) {
    const tx = tokenMod.burn(state.token, addr, -delta, memo || 'Ajuste económico semanal (simulado)');
    return tx;
  }
  return null;
}

function newGame(opts) {
  const rng = new Rng();
  const season = 1;
  const state = {
    version: SAVE_VERSION,
    createdAt: Date.now(),
    rngSeed: rng.seed,
    rng,
    phase: 'season',
    season,
    week: 1,
    userClubId: null,
    clubs: {},
    players: {},
    youth: {},
    market: { listings: [], offers: [], transferHistory: [], freeAgents: [] },
    league: { clubIds: [], fixtures: [], round: 0, champion: null },
    chain: null,
    token: null,
    nft: null,
    inbox: [],
    news: [],
    pendingMatch: null,
    lastResults: [],
    seasonAwards: null
  };

  const usedNames = new Set();
  const levels = [72, 69, 67, 65, 63, 61, 60, 58, 56, 54, 52, 50];
  const shuffledLevels = rng.shuffle(levels.slice());

  const userClub = createClub(rng, {
    id: 'user-club',
    name: opts.clubName || 'Mi Club',
    shortName: (opts.shortName || (opts.clubName || 'MCL').slice(0, 3)).toUpperCase(),
    city: opts.city || rng.pick(CITIES),
    primaryColor: opts.primaryColor || '#c8102e',
    secondaryColor: opts.secondaryColor || '#ffffff',
    formation: opts.formation || '4-3-3',
    isUser: true,
    reputation: 50, fanbase: 750000, budget: 12000000,
    capacity: 24000, trainingLevel: 2, youthLevel: 2, medicalLevel: 2
  });
  userClub.managerName = opts.managerName || 'El Míster';
  const userSquad = generateClubSquad(rng, 60, season);
  state.clubs[userClub.id] = userClub;
  state.userClubId = userClub.id;

  const clubIds = [userClub.id];
  for (let i = 0; i < TEAMS - 1; i++) {
    const level = shuffledLevels[i];
    const rep = Math.round(30 + (level - 50) * 1.6);
    const club = createClub(rng, {
      name: aiClubName(rng, usedNames),
      city: rng.pick(CITIES),
      reputation: clamp(rep, 25, 85),
      fanbase: Math.round((200000 + rep * 22000) * rng.range(0.7, 1.3)),
      budget: Math.round((3000000 + rep * 220000) * rng.range(0.8, 1.25)),
      capacity: Math.round((12000 + rep * 550) * rng.range(0.75, 1.25)),
      trainingLevel: clamp(Math.round(rep / 22), 1, 5),
      youthLevel: clamp(Math.round(rep / 25), 1, 5),
      medicalLevel: clamp(Math.round(rep / 28), 1, 5),
      formation: rng.pick(Object.keys(FORMATIONS))
    });
    const squad = generateClubSquad(rng, level, season);
    state.clubs[club.id] = club;
    clubIds.push(club.id);
    for (const p of squad) { state.players[p.id] = p; }
    club.squad = squad.map(p => p.id);
    club.lineup = matchEngine.autoPickLineup(club, state.players);
  }
  for (const p of userSquad) { state.players[p.id] = p; }
  userClub.squad = userSquad.map(p => p.id);
  userClub.lineup = matchEngine.autoPickLineup(userClub, state.players);

  state.league.clubIds = clubIds;
  state.league.fixtures = buildFixtures(clubIds, rng);

  // Capa blockchain simulada
  state.chain = chainMod.createChain();
  state.token = tokenMod.createTokenLedger();
  state.nft = nftMod.createAssetRegistry();

  const mintTxs = [];
  for (const clubId of clubIds) {
    const club = state.clubs[clubId];
    club.wallet = walletAddress(state, clubId);
    mintTxs.push(tokenMod.mint(state.token, club.wallet, Math.round(club.budget), 'Dotación inicial de tesorería (simulada)'));
    for (const pid of club.squad) {
      const p = state.players[pid];
      const mintTx = nftMod.mintAsset(state.nft, pid, club.wallet, { name: p.name, position: p.pos, overall: p.overall });
      p.tokenId = mintTx.tokenId;
      mintTxs.push(mintTx);
    }
  }
  chainMod.addBlock(state.chain, mintTxs);

  market.aiGenerateListings(state);
  pushInbox(state, 'welcome', '¡Bienvenido a ' + userClub.name + '!', 'Eres el nuevo mánager. Configura tu alineación en Tácticas, entrena a tus jugadores y disputa la jornada 1. Tu tesorería inicial es de ' + fmtMoney(userClub.budget) + ' FCG. Todos los activos y transacciones se registran en la SIMCHAIN (blockchain simulada).');
  return state;
}

function fmtMoney(v) {
  if (Math.abs(v) >= 1000000) return (v / 1000000).toFixed(2) + 'M';
  if (Math.abs(v) >= 1000) return Math.round(v / 1000) + 'K';
  return String(Math.round(v));
}

function pushInbox(state, type, title, body) {
  state.inbox.unshift({ id: 'msg-' + (state._msgCounter = (state._msgCounter || 0) + 1), type, title, body, week: state.week, season: state.season, read: false });
  if (state.inbox.length > 120) state.inbox.length = 120;
}

function clubOfPlayer(state, playerId) {
  for (const id of state.league.clubIds) {
    if (state.clubs[id].squad.includes(playerId)) return state.clubs[id];
  }
  return null;
}

// ---------- Partidos ----------

function getUserFixture(state) {
  for (const m of currentRoundFixtures(state)) {
    if (m.played) continue;
    if (m.home === state.userClubId || m.away === state.userClubId) return m;
  }
  return null;
}

function startMatch(state) {
  if (state.pendingMatch) return state.pendingMatch;
  const fixture = getUserFixture(state);
  if (!fixture) throw new Error('No tienes partido pendiente esta jornada');
  const match = matchEngine.createMatch(state, fixture.home, fixture.away);
  state.pendingMatch = match;
  const events = matchEngine.runSegment(state, match, 45);
  return match;
}

function resumeMatch(state, decisions) {
  const match = state.pendingMatch;
  if (!match) throw new Error('No hay partido en curso');
  if (match.finished) throw new Error('El partido ya terminó');
  const userSide = match.homeId === state.userClubId ? 0 : 1;
  const club = state.clubs[state.userClubId];

  if (decisions) {
    if (decisions.mentality && ['defensive', 'balanced', 'attacking'].includes(decisions.mentality)) {
      club.mentality = decisions.mentality;
      match._formations[userSide] = club.formation;
    }
    if (decisions.formation && FORMATIONS[decisions.formation]) {
      club.formation = decisions.formation;
      match._formations[userSide] = decisions.formation;
      if (decisions.lineup && Array.isArray(decisions.lineup)) {
        const valid = decisions.lineup.filter(id => club.squad.includes(id) && state.players[id] && !state.players[id].injury && state.players[id].ban <= 0);
        if (valid.length === matchEngine.formationSlots(decisions.formation).length) {
          match.lineups[userSide === 0 ? 'home' : 'away'] = valid;
        }
      }
    }
    if (Array.isArray(decisions.subs)) {
      for (const sub of decisions.subs) {
        applySub(state, match, userSide, sub.outId, sub.inId);
      }
    }
  }

  const from = match.minute;
  const target = match.minute < 45 ? 45 : match.minute < 75 ? 75 : 90;
  matchEngine.runSegment(state, match, target);
  if (match.finished) {
    commitMatch(state, match);
    state.pendingMatch = null;
  }
  return match;
}

function applySub(state, match, userSide, outId, inId) {
  const key = userSide === 0 ? 'home' : 'away';
  const lineup = match.lineups[key];
  const bench = match.benches[key];
  if (!lineup.includes(outId)) throw new Error('El jugador que sale no está en el campo');
  if (!bench.includes(inId)) throw new Error('El suplente no está en el banquillo');
  if (match.subsUsed[key] >= 5) throw new Error('Ya has usado los 5 cambios permitidos');
  const outP = state.players[outId], inP = state.players[inId];
  if (inP.injury || inP.ban > 0) throw new Error('El suplente no está disponible');
  match.lineups[key] = lineup.map(id => (id === outId ? inId : id));
  match.benches[key] = bench.filter(id => id !== inId);
  match.subsUsed[key]++;
  pushLiveEvent(match, { type: 'sub', side: userSide, outId, outName: outP.name, inId, inName: inP.name, text: `🔄 Cambio: entra ${inP.name} por ${outP.name}` });
}

function pushLiveEvent(match, ev) {
  ev.minute = match.minute;
  match.events.push(ev);
}

function simUserMatch(state) {
  const match = state.pendingMatch || (() => {
    const m = matchEngine.createMatch(state, getUserFixture(state).home, getUserFixture(state).away);
    state.pendingMatch = m;
    return m;
  })();
  while (!match.finished) {
    matchEngine.runSegment(state, match, match.minute < 45 ? 45 : match.minute < 75 ? 75 : 90);
  }
  commitMatch(state, match);
  state.pendingMatch = null;
  return match;
}

function commitMatch(state, match) {
  const fixture = currentRoundFixtures(state).find(m => !m.played && (m.home === match.homeId && m.away === match.awayId));
  if (fixture) {
    fixture.played = true;
    fixture.score = match.score.slice();
  }
  state.lastResults.unshift({ season: state.season, round: state.league.round, homeId: match.homeId, awayId: match.awayId, score: match.score.slice(), events: match.events });
  if (state.lastResults.length > 30) state.lastResults.length = 30;

  const userIsHome = match.homeId === state.userClubId;
  const homeClub = state.clubs[match.homeId];
  const awayClub = state.clubs[match.awayId];

  if (homeClub.isUser || awayClub.isUser) {
    const userId = state.userClubId;
    const gf = userIsHome ? match.score[0] : match.score[1];
    const ga = userIsHome ? match.score[1] : match.score[0];
    const oppId = userIsHome ? match.awayId : match.homeId;
    const gate = finance.gateReceipts(state, userId, oppId);
    let repDelta = 0;
    if (gf > ga) repDelta = 1.2; else if (gf < ga) repDelta = -0.8; else repDelta = 0.1;
    state.clubs[userId].reputation = clamp(state.clubs[userId].reputation + repDelta, 10, 95);
    const opp = state.clubs[oppId];
    pushInbox(state, 'result', `Resultado: ${homeClub.shortName} ${match.score[0]}-${match.score[1]} ${awayClub.shortName}`,
      `${gf > ga ? '¡Victoria!' : gf === ga ? 'Empate.' : 'Derrota.'} Taquilla: ${fmtMoney(gate.income)} FCG (${gate.attendance} espectadores).`);
  } else {
    homeClub.reputation = clamp(homeClub.reputation + (match.score[0] > match.score[1] ? 0.4 : match.score[0] < match.score[1] ? -0.3 : 0), 10, 95);
    awayClub.reputation = clamp(awayClub.reputation + (match.score[1] > match.score[0] ? 0.4 : match.score[1] < match.score[0] ? -0.3 : 0), 10, 95);
  }

  for (const clubId of [match.homeId, match.awayId]) {
    const club = state.clubs[clubId];
    for (const pid of club.squad) {
      const p = state.players[pid];
      if (!p) continue;
      if (!match.lineups[clubId === match.homeId ? 'home' : 'away'].includes(pid) && !p.injury) {
        p.fatigue = clamp(p.fatigue - 6, 0, 100);
        if (!match.lineups[clubId === match.homeId ? 'home' : 'away'].includes(pid)) {
          const playedRecently = match.events.some(e => (e.inId === pid));
          if (!playedRecently) p.morale = clamp(p.morale - 1, 20, 99);
        }
      }
    }
  }
}

function simulateAiFixtures(state) {
  const results = [];
  for (const m of currentRoundFixtures(state)) {
    if (m.played) continue;
    if (m.home === state.userClubId || m.away === state.userClubId) continue;
    const match = matchEngine.createMatch(state, m.home, m.away);
    while (!match.finished) {
      matchEngine.runSegment(state, match, match.minute < 45 ? 45 : match.minute < 75 ? 75 : 90);
    }
    m.played = true;
    m.score = match.score.slice();
    results.push({ homeId: m.home, awayId: m.away, score: m.score.slice() });
  }
  return results;
}

// ---------- Avance de semana ----------

function advanceWeek(state, opts) {
  opts = opts || {};
  if (state.phase !== 'season') throw new Error('La temporada ha terminado. Inicia la siguiente.');
  const fixture = getUserFixture(state);
  if (fixture && !state.pendingMatch) {
    if (opts.simUserMatch) {
      simUserMatch(state);
    } else {
      throw new Error('Tienes un partido pendiente. Juega, simula o usa la opción de auto-simular.');
    }
  }
  if (state.pendingMatch) throw new Error('Termina el partido en curso primero');

  if (!allRoundMatchesPlayed(state)) simulateAiFixtures(state);
  if (!allRoundMatchesPlayed(state)) throw new Error('Error interno: quedan partidos sin jugar');

  const weekly = processWeekly(state);

  state.week++;
  state.league.round++;
  const totalRounds = state.league.fixtures.length;
  if (state.league.round >= totalRounds) {
    endSeason(state);
  } else {
    market.aiGenerateListings(state);
  }
  return weekly;
}

function processWeekly(state) {
  const summary = { finances: {}, training: [], youth: [], offers: [], injuries: [], contracts: [] };

  for (const clubId of state.league.clubIds) {
    finance.weeklyFinances(state, clubId);
    const players = state.clubs[clubId].squad.map(id => state.players[id]).filter(Boolean);
    for (const p of players) {
      if (p.injury) {
        p.injury.weeks -= 1 + Math.floor(state.clubs[clubId].facilities.medical / 2.5);
        if (p.injury.weeks <= 0) { p.injury = null; }
      }
      p.ban = Math.max(0, p.ban - 1);
      p.fatigue = clamp(p.fatigue - 22, 0, 100);
      p.morale = clamp(p.morale + (p.morale < 40 ? 2 : 0), 20, 99);
    }
  }

  const user = state.clubs[state.userClubId];
  for (const pid of user.squad) {
    const p = state.players[pid];
    if (!p || p.injury) continue;
    const focus = user.playerTraining[pid] || user.trainingFocus;
    const { decline, gains } = growthForPlayer(p, state.rng, user.facilities.training, focus);
    const delta = applyGrowth(p, gains, decline);
    if (delta > 0) summary.training.push({ playerId: pid, name: p.name, delta });
    p.fatigue = clamp(p.fatigue + 6, 0, 100);
    if (state.rng.chance(0.008)) {
      p.injury = { type: 'molestia en entrenamiento', weeks: 1 };
      summary.injuries.push(p.name);
    }
  }

  for (const clubId of state.league.clubIds) {
    const fresh = youth.weeklyYouth(state, clubId);
    if (clubId === state.userClubId) {
      for (const p of fresh) {
        summary.youth.push(p);
        pushInbox(state, 'youth', '💎 Nueva promesa en la cantera', `${p.name} (${p.pos}, ${p.age} años) ha destacado en los entrenamientos de la cantera. Valoración media actual: ${p.overall}. Reclútalo desde la sección Cantera.`);
      }
    }
  }

  market.aiGenerateListings(state);

  const newOffers = [];
  for (const listing of state.market.listings.slice()) {
    if (listing.sellerClubId === state.userClubId) {
      const bid = market.aiBidOnListing(state, listing);
      if (bid) {
        state.market.offers.push(bid);
        newOffers.push(bid);
        const p = state.players[bid.playerId];
        pushInbox(state, 'offer', `Oferta por ${p.name}`, `${state.clubs[bid.fromClubId].name} ofrece ${fmtMoney(bid.amount)} FCG por tu jugador (publicado en ${fmtMoney(listing.price)} FCG). Responde en Mercado → Ofertas.`);
      }
    }
  }
  const direct = market.aiOfferForSquadPlayer(state, state.userClubId);
  if (direct) {
    state.market.offers.push(direct);
    newOffers.push(direct);
    const p = state.players[direct.playerId];
    pushInbox(state, 'offer', `Oferta directa por ${p.name}`, `${state.clubs[direct.fromClubId].name} ofrece ${fmtMoney(direct.amount)} FCG. Puedes aceptar o rechazar en Mercado → Ofertas.`);
  }
  summary.offers = newOffers;

  for (const clubId of state.league.clubIds) {
    const club = state.clubs[clubId];
    for (const pid of club.squad) {
      const p = state.players[pid];
      if (p && p.contract.until - state.season <= 1 && p.contract.until - state.season >= 0) {
        if (clubId === state.userClubId && state.week > state.league.fixtures.length - 6) {
          summary.contracts.push({ playerId: pid, name: p.name, until: p.contract.until });
        }
      }
    }
  }

  const syncTxs = [];
  for (const clubId of state.league.clubIds) {
    const tx = syncWallet(state, clubId);
    if (tx) syncTxs.push(tx);
  }
  if (syncTxs.length) chainMod.addBlock(state.chain, syncTxs);

  return summary;
}

// ---------- Fichajes ----------

function executeTransfer(state, buyerClubId, sellerClubId, playerId, price, opts) {
  const buyer = state.clubs[buyerClubId];
  const seller = state.clubs[sellerClubId];
  const p = state.players[playerId];
  if (!p) throw new Error('Jugador no encontrado');
  if (!seller.squad.includes(playerId)) throw new Error('El vendedor ya no tiene a ese jugador');
  if (buyer.squad.length >= 30) throw new Error('Plantilla llena (máximo 30 jugadores)');
  if (seller.squad.length <= 14) throw new Error('El club vendedor no puede bajar de 14 jugadores');
  if (state.pendingMatch && (state.pendingMatch.lineups.home.includes(playerId) || state.pendingMatch.lineups.away.includes(playerId))) {
    throw new Error('El jugador está disputando un partido ahora mismo');
  }

  const tokenId = p.tokenId;
  const receipt = contractMod.simulateTransfer(
    { chain: state.chain, addBlock: chainMod.addBlock, token: state.token, nft: state.nft },
    { tokenId, from: seller.wallet, to: buyer.wallet, price, playerId, memo: `Traspaso de ${p.name} (${seller.name} → ${buyer.name})` }
  );

  seller.squad = seller.squad.filter(id => id !== playerId);
  buyer.squad.push(playerId);
  seller.budget = tokenMod.balanceOf(state.token, seller.wallet);
  buyer.budget = tokenMod.balanceOf(state.token, buyer.wallet);
  finance.addLedger(state, buyerClubId, { concept: `Fichaje de ${p.name} (${seller.name})`, amount: -price, category: 'fichajes' });
  finance.addLedger(state, sellerClubId, { concept: `Venta de ${p.name} (${buyer.name})`, amount: price, category: 'fichajes' });

  const wage = opts && opts.wage ? opts.wage : wageDemand(p, state.rng);
  const years = opts && opts.years ? opts.years : 3;
  p.contract = { wage, until: state.season + years };
  p.morale = clamp(p.morale + 5, 20, 99);
  p.value = computeValue(p);

  state.market.listings = state.market.listings.filter(l => l.playerId !== playerId);
  state.market.offers = state.market.offers.filter(o => o.playerId !== playerId);

  state.market.transferHistory.unshift({
    id: receipt.txHash.slice(0, 12),
    playerId, playerName: p.name,
    fromClubId: sellerClubId, fromClubName: seller.name,
    toClubId: buyerClubId, toClubName: buyer.name,
    price, fee: receipt.fee,
    txHash: receipt.txHash, blockIndex: receipt.blockIndex,
    season: state.season, week: state.week,
    simulated: true
  });
  if (state.market.transferHistory.length > 100) state.market.transferHistory.length = 100;

  if (!buyer.isUser) {
    buyer.lineup = matchEngine.autoPickLineup(buyer, state.players);
  }
  if (buyer.isUser || seller.isUser) {
    pushInbox(state, 'transfer', `${p.name} ${buyer.isUser ? 'fichado' : 'vendido'}`,
      `${buyer.name} ↔ ${seller.name} por ${fmtMoney(price)} FCG. Salario: ${fmtMoney(wage)} FCG/semana. Transacción registrada en la SIMCHAIN (bloque #${receipt.blockIndex}, simulada).`);
  }
  return receipt;
}

function userBuyListing(state, listingId) {
  const listing = state.market.listings.find(l => l.id === listingId);
  if (!listing) throw new Error('Publicación no encontrada o expirada');
  const user = state.clubs[state.userClubId];
  const price = listing.price;
  if (user.budget < price * 1.05) throw new Error(`Fondos insuficientes: necesitas ${fmtMoney(price)} FCG + comisión (~4%)`);
  return executeTransfer(state, state.userClubId, listing.sellerClubId, listing.playerId, price);
}

function userMakeOffer(state, playerId, amount) {
  const listing = state.market.listings.find(l => l.playerId === playerId);
  if (!listing) throw new Error('Ese jugador no está en el mercado');
  const seller = state.clubs[listing.sellerClubId];
  if (seller.isUser) throw new Error('No puedes negociar contigo mismo');
  const user = state.clubs[state.userClubId];
  if (user.budget < amount) throw new Error('No tienes saldo FCG suficiente para esa oferta');
  const response = market.evaluateAiResponse(state, playerId, listing.sellerClubId, amount);
  if (response.accept) {
    const receipt = executeTransfer(state, state.userClubId, listing.sellerClubId, playerId, amount);
    return { accepted: true, receipt, message: `¡${state.players[playerId].name} es tuyo! Traspaso ejecutado por ${fmtMoney(amount)} FCG.` };
  }
  if (response.counter) {
    listing.price = response.counter;
    return { accepted: false, counter: response.counter, message: `Contraoferta de ${seller.name}: piden ${fmtMoney(response.counter)} FCG. El precio de la publicación se ha actualizado.` };
  }
  return { accepted: false, message: response.reason || `${seller.name} ha rechazado tu oferta.` };
}

function respondOffer(state, offerId, accept) {
  const offer = state.market.offers.find(o => o.id === offerId && o.status === 'pending');
  if (!offer) throw new Error('Oferta no encontrada o ya gestionada');
  if (offer.toClubId !== state.userClubId) throw new Error('Esa oferta no va dirigida a tu club');
  const p = state.players[offer.playerId];
  if (!accept) {
    offer.status = 'rejected';
    return { message: `Oferta por ${p.name} rechazada.` };
  }
  const buyer = state.clubs[offer.fromClubId];
  if (buyer.budget < offer.amount * 1.05) {
    offer.status = 'rejected';
    return { message: `${buyer.name} no tiene fondos suficientes; la oferta queda anulada.` };
  }
  offer.status = 'accepted';
  const receipt = executeTransfer(state, offer.fromClubId, state.userClubId, offer.playerId, offer.amount);
  return { message: `${p.name} vendido a ${buyer.name} por ${fmtMoney(offer.amount)} FCG.`, receipt };
}

function renewContract(state, playerId, years) {
  const user = state.clubs[state.userClubId];
  if (!user.squad.includes(playerId)) throw new Error('Jugador no pertenece a tu plantilla');
  const p = state.players[playerId];
  years = clamp(years || 2, 1, 5);
  const newWage = Math.round(wageDemand(p, state.rng) * (1 + years * 0.06) / 100) * 100;
  const signingBonus = Math.round(p.value * 0.04 * years);
  if (user.budget < signingBonus) throw new Error(`Necesitas ${fmtMoney(signingBonus)} FCG de prima de fichaje`);
  finance.addLedger(state, state.userClubId, { concept: `Prima de renovación de ${p.name}`, amount: -signingBonus, category: 'salarios' });
  p.contract = { wage: newWage, until: state.season + years };
  p.morale = clamp(p.morale + 6, 20, 99);
  return { wage: newWage, until: p.contract.until, bonus: signingBonus };
}

// ---------- Instalaciones ----------

function upgradeFacility(state, type) {
  const user = state.clubs[state.userClubId];
  const validTypes = ['training', 'youth', 'medical', 'stadium'];
  if (!validTypes.includes(type)) throw new Error('Tipo de mejora inválido');
  const currentLevel = type === 'stadium' ? Math.round(user.stadium.capacity / 12000) : user.facilities[type];
  if (currentLevel >= 6) throw new Error('Nivel máximo alcanzado');
  const cost = finance.facilityCost(type, currentLevel + 1);
  if (user.budget < cost) throw new Error(`Necesitas ${fmtMoney(cost)} FCG`);
  finance.addLedger(state, state.userClubId, { concept: `Mejora de ${type === 'stadium' ? 'estadio' : type === 'training' ? 'centro de entrenamiento' : type === 'youth' ? 'cantera' : 'médico'} a nivel ${currentLevel + 1}`, amount: -cost, category: 'instalaciones' });
  if (type === 'stadium') {
    user.stadium.capacity += 8000;
  } else {
    user.facilities[type] = currentLevel + 1;
  }
  return { type, level: currentLevel + 1, cost };
}

// ---------- Fin de temporada ----------

function endSeason(state) {
  const table = computeTable(state);
  state.league.champion = table[0].clubId;
  const awards = { season: state.season, champion: state.clubs[table[0].clubId].name, topScorer: null, bestPlayer: null, userPosition: null, prize: 0 };

  let topScorer = null;
  for (const id of state.league.clubIds) {
    for (const pid of state.clubs[id].squad) {
      const p = state.players[pid];
      if (p && (!topScorer || p.stats.goals > topScorer.goals)) {
        topScorer = { playerId: pid, name: p.name, goals: p.stats.goals, club: state.clubs[id].name };
      }
    }
  }
  awards.topScorer = topScorer;

  let bestRated = null;
  for (const id of state.league.clubIds) {
    for (const pid of state.clubs[id].squad) {
      const p = state.players[pid];
      if (p && p.stats.ratedApps >= 8 && (!bestRated || p.stats.avgRating > bestRated.rating)) {
        bestRated = { playerId: pid, name: p.name, rating: p.stats.avgRating, club: state.clubs[id].name };
      }
    }
  }
  awards.bestPlayer = bestRated;

  const userPos = table.findIndex(t => t.clubId === state.userClubId) + 1;
  awards.userPosition = userPos;
  const prize = PRIZE_MONEY[Math.min(userPos - 1, PRIZE_MONEY.length - 1)];
  awards.prize = prize;
  finance.addLedger(state, state.userClubId, { concept: `Premio por posición ${userPos}ª en liga`, amount: prize, category: 'premios' });
  const user = state.clubs[state.userClubId];
  const expected = 6;
  user.reputation = clamp(user.reputation + (expected - userPos) * 0.7, 10, 95);
  user.fanbase = Math.round(user.fanbase * (1 + (expected - userPos) * 0.012));

  for (const [i, row] of table.entries()) {
    const pos = i + 1;
    if (state.clubs[row.clubId].isUser) continue;
    const prizeI = PRIZE_MONEY[Math.min(i, PRIZE_MONEY.length - 1)];
    finance.addLedger(state, row.clubId, { concept: `Premio liga (posición ${pos})`, amount: prizeI, category: 'premios' });
  }

  state.seasonAwards = awards;
  state.phase = 'seasonEnd';
  pushInbox(state, 'season', `Temporada ${state.season} finalizada`, `Campeón: ${awards.champion}. Tu posición: ${userPos}ª. Premio: ${fmtMoney(prize)} FCG. Inicia la siguiente temporada cuando quieras.`);
}

function startNewSeason(state) {
  if (state.phase !== 'seasonEnd') throw new Error('La temporada aún no ha terminado');
  state.season++;
  state.week = 1;
  state.league.round = 0;
  state.league.champion = null;
  state.phase = 'season';
  state.pendingMatch = null;

  const retired = [];
  const freed = [];
  for (const clubId of state.league.clubIds) {
    const club = state.clubs[clubId];
    const remaining = [];
    for (const pid of club.squad) {
      const p = state.players[pid];
      p.age++;
      p.seasonHistory.push({ season: state.season - 1, apps: p.stats.apps, goals: p.stats.goals, assists: p.stats.assists, rating: p.stats.avgRating });
      p.stats = { apps: 0, goals: 0, assists: 0, yellow: 0, red: 0, avgRating: 0, ratingSum: 0, ratedApps: 0, cleanSheets: 0 };
      p.form = 0;
      p.fatigue = clamp(p.fatigue - 40, 0, 100);
      p.ban = 0;
      let retire = false;
      if (p.age >= 35 && state.rng.chance(0.45)) retire = true;
      if (p.age >= 38) retire = true;
      if (retire) {
        retired.push({ name: p.name, club: club.name, age: p.age });
        delete state.players[pid];
        continue;
      }
      if (p.contract.until < state.season) {
        if (club.isUser) {
          freed.push({ name: p.name, id: pid });
          state.nft.assets[p.tokenId].owner = '0xSIMFREEAGENT';
          p.contract = { wage: 0, until: 0 };
          state.market.freeAgents.push(p);
          continue;
        } else if (state.rng.chance(0.7)) {
          p.contract = { wage: wageDemand(p, state.rng), until: state.season + state.rng.int(1, 3) };
        } else {
          state.nft.assets[p.tokenId].owner = '0xSIMFREEAGENT';
          p.contract = { wage: 0, until: 0 };
          state.market.freeAgents.push(p);
          continue;
        }
      }
      remaining.push(pid);
    }
    club.squad = remaining;
    while (club.squad.length < 16) {
      const p = generatePlayer(state.rng, { level: 45 + club.reputation * 0.25, age: state.rng.int(18, 24) });
      p.contract = { wage: wageDemand(p, state.rng), until: state.season + state.rng.int(2, 4) };
      state.players[p.id] = p;
      const mintTx = nftMod.mintAsset(state.nft, p.id, club.wallet, { name: p.name, position: p.pos, overall: p.overall });
      p.tokenId = mintTx.tokenId;
      chainMod.addBlock(state.chain, [mintTx]);
      club.squad.push(p.id);
    }
    club.lineup = matchEngine.autoPickLineup(club, state.players);
  }

  state.league.fixtures = buildFixtures(state.league.clubIds, state.rng);
  market.aiGenerateListings(state);
  syncWallet(state, state.userClubId, 'Ajuste de inicio de temporada');

  pushInbox(state, 'season', `¡Arranca la temporada ${state.season}!`, `${retired.length} retiradas, ${state.market.freeAgents.length} agentes libres disponibles en el mercado. Nueva calendario generado. ¡A por todas!`);
  if (freed.length) {
    pushInbox(state, 'warning', 'Contratos vencidos', `Los siguientes jugadores no tenían contrato vigente y han quedado libres: ${freed.map(f => f.name).join(', ')}. Renueva a tiempo la próxima vez.`);
  }
  return { retired, freeAgents: state.market.freeAgents.length };
}

// ---------- Consultas ----------

function scoutPlayer(state, playerId) {
  const user = state.clubs[state.userClubId];
  const cost = 45000;
  if (user.budget < cost) throw new Error(`Necesitas ${fmtMoney(cost)} FCG para el informe de ojeadores`);
  finance.addLedger(state, state.userClubId, { concept: `Informe de ojeadores`, amount: -cost, category: 'ojeadores' });
  const p = state.players[playerId];
  if (p) p.scouted = true;
  const club = clubOfPlayer(state, playerId);
  return { cost, scouted: true };
}

function signFreeAgent(state, playerId) {
  const p = state.players[playerId];
  const idx = state.market.freeAgents.findIndex(f => f.playerId === playerId || f.id === playerId);
  if (!p || idx === -1) throw new Error('Agente libre no disponible');
  const user = state.clubs[state.userClubId];
  if (user.squad.length >= 30) throw new Error('Plantilla llena (máximo 30)');
  const bonus = Math.round(p.value * 0.15);
  const wage = wageDemand(p, state.rng);
  if (user.budget < bonus + wage * 2) throw new Error(`Necesitas al menos ${fmtMoney(bonus + wage * 2)} FCG (prima + 2 semanas de ficha)`);
  p.contract = { wage, until: state.season + 2 };
  p.scouted = true;
  user.squad.push(p.id);
  state.market.freeAgents.splice(idx, 1);
  finance.addLedger(state, state.userClubId, { concept: `Fichaje de agente libre: ${p.name}`, amount: -bonus, category: 'fichajes' });
  const mintTx = nftMod.mintAsset(state.nft, p.id, user.wallet, { name: p.name, position: p.pos, overall: p.overall });
  p.tokenId = mintTx.tokenId;
  chainMod.addBlock(state.chain, [mintTx, tokenMod.burn(state.token, user.wallet, bonus, `Prima de fichaje de ${p.name} (simulada)`)]);
  user.budget = tokenMod.balanceOf(state.token, user.wallet);
  pushInbox(state, 'transfer', `${p.name} se une al club`, `Agente libre fichado por prima de ${fmtMoney(bonus)} FCG y ${fmtMoney(wage)} FCG/semana.`);
  return p;
}

module.exports = {
  SAVE_VERSION, newGame, startMatch, resumeMatch, simUserMatch, commitMatch,
  advanceWeek, processWeekly, executeTransfer, userBuyListing, userMakeOffer,
  respondOffer, renewContract, upgradeFacility, endSeason, startNewSeason,
  getUserFixture, clubOfPlayer, walletAddress, syncWallet, pushInbox, scoutPlayer,
  signFreeAgent, fmtMoney
};
