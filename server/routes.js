'use strict';

/* Rutas de la API, independientes del transporte (HTTP o navegador local). */

const game = require('./engine/game');
const leagueMod = require('./engine/league');
const chainMod = require('../blockchain/chain');

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function snapshot(state) {
  const table = state.phase === 'setup' ? [] : leagueMod.computeTable(state);
  const fixture = state.phase === 'season' ? game.getUserFixture(state) : null;
  const nextFixture = fixture ? {
    home: state.clubs[fixture.home].name, away: state.clubs[fixture.away].name,
    homeId: fixture.home, awayId: fixture.away, isHome: fixture.home === state.userClubId
  } : null;
  return {
    phase: state.phase,
    season: state.season,
    week: state.week,
    round: state.league.round,
    totalRounds: state.league.fixtures.length,
    userClubId: state.userClubId,
    clubs: state.clubs,
    players: state.players,
    youth: state.youth,
    market: state.market,
    league: { fixtures: state.league.fixtures, champion: state.league.champion },
    table,
    inbox: state.inbox,
    sponsorOffers: state.sponsorOffers || [],
    countries: require('./engine/names').COUNTRIES.map(c => ({ code: c.code, name: c.name, flag: c.flag })),
    skillTrees: require('./engine/skills').treesByPosition(),
    treatments: require('./engine/medical').TREATMENTS,
    pendingMatch: state.pendingMatch,
    lastResults: state.lastResults.slice(0, 10),
    seasonAwards: state.seasonAwards,
    chain: state.chain,
    token: { symbol: state.token.symbol, balances: state.token.balances, totalSupply: state.token.totalSupply },
    nft: state.nft,
    nextFixture
  };
}

function createRoutes({ getState, setState, store }) {
  function ensureState() {
    const s = getState();
    if (!s) throw new ApiError(409, 'No hay partida iniciada. Crea tu club primero.');
    return s;
  }

  return {
    'GET /api/state': () => {
      const state = getState();
      if (!state) return { phase: 'setup' };
      return snapshot(state);
    },

    'POST /api/game/new': (body) => {
      if (!body || !body.clubName || String(body.clubName).trim().length < 3) {
        throw new ApiError(400, 'El nombre del club debe tener al menos 3 caracteres');
      }
      if (String(body.clubName).length > 30) throw new ApiError(400, 'Nombre demasiado largo (m\u00e1x. 30)');
      const state = game.newGame({
        clubName: String(body.clubName).trim(),
        shortName: body.shortName ? String(body.shortName).trim().slice(0, 4) : undefined,
        city: body.city ? String(body.city).trim().slice(0, 30) : undefined,
        managerName: body.managerName ? String(body.managerName).trim().slice(0, 30) : undefined,
        primaryColor: body.primaryColor,
        secondaryColor: body.secondaryColor,
        formation: body.formation,
        country: body.country,
        crest: body.crest,
        kit: body.kit
      });
      setState(state);
      store.save(state);
      return snapshot(state);
    },

    'POST /api/game/reset': () => {
      store.clear();
      setState(null);
      return { phase: 'setup' };
    },

    'POST /api/match/start': () => {
      const state = ensureState();
      const match = game.startMatch(state);
      store.save(state);
      return { match };
    },

    'POST /api/match/resume': (body) => {
      const state = ensureState();
      const match = game.resumeMatch(state, body || {});
      store.save(state);
      return { match };
    },

    'POST /api/match/sim': () => {
      const state = ensureState();
      const match = game.simUserMatch(state);
      store.save(state);
      return { match };
    },

    'POST /api/week/advance': (body) => {
      const state = ensureState();
      const summary = game.advanceWeek(state, body || {});
      store.save(state);
      return { summary, snapshot: snapshot(state) };
    },

    'POST /api/season/next': () => {
      const state = ensureState();
      const result = game.startNewSeason(state);
      store.save(state);
      return { result, snapshot: snapshot(state) };
    },

    'POST /api/tactics': (body) => {
      const state = ensureState();
      const club = state.clubs[state.userClubId];
      if (body.formation) {
        const { FORMATIONS } = require('./engine/club');
        if (!FORMATIONS[body.formation]) throw new ApiError(400, 'Formaci\u00f3n inv\u00e1lida');
        club.formation = body.formation;
        club.lineup = [];
      }
      if (body.mentality && ['defensive', 'balanced', 'attacking'].includes(body.mentality)) club.mentality = body.mentality;
      if (body.pressing && ['low', 'medium', 'high'].includes(body.pressing)) club.tactics.pressing = body.pressing;
      if (Array.isArray(body.lineup)) {
        const valid = body.lineup.filter(id => club.squad.includes(id));
        const slots = require('./engine/match').formationSlots(club.formation).length;
        if (valid.length !== slots) throw new ApiError(400, `Debes seleccionar ${slots} jugadores titulares`);
        if (new Set(valid).size !== valid.length) throw new ApiError(400, 'Jugadores duplicados en la alineaci\u00f3n');
        club.lineup = valid;
      }
      store.save(state);
      return { ok: true };
    },

    'POST /api/training': (body) => {
      const state = ensureState();
      const club = state.clubs[state.userClubId];
      if (body.focus && ['balanced', 'attack', 'defense', 'technique', 'fitness'].includes(body.focus)) {
        club.trainingFocus = body.focus;
      }
      if (body.playerTraining && typeof body.playerTraining === 'object') {
        for (const [pid, focus] of Object.entries(body.playerTraining)) {
          if (club.squad.includes(pid) && ['balanced', 'attack', 'defense', 'technique', 'fitness'].includes(focus)) {
            club.playerTraining[pid] = focus;
          }
        }
      }
      store.save(state);
      return { ok: true };
    },

    'POST /api/market/list': (body) => {
      const state = ensureState();
      const listing = require('./engine/market').listPlayer(state, state.userClubId, body.playerId, Math.round(Number(body.price)));
      store.save(state);
      return { listing };
    },

    'POST /api/market/cancel': (body) => {
      const state = ensureState();
      require('./engine/market').cancelListing(state, state.userClubId, body.listingId);
      store.save(state);
      return { ok: true };
    },

    'POST /api/market/buy': (body) => {
      const state = ensureState();
      const receipt = game.userBuyListing(state, body.listingId);
      store.save(state);
      return { receipt, snapshot: snapshot(state) };
    },

    'POST /api/market/offer': (body) => {
      const state = ensureState();
      const amount = Math.round(Number(body.amount));
      if (!amount || amount <= 0) throw new ApiError(400, 'Importe de oferta inv\u00e1lido');
      const result = game.userMakeOffer(state, body.playerId, amount);
      store.save(state);
      return { ...result, snapshot: snapshot(state) };
    },

    'POST /api/offers/respond': (body) => {
      const state = ensureState();
      const result = game.respondOffer(state, body.offerId, !!body.accept);
      store.save(state);
      return { ...result, snapshot: snapshot(state) };
    },

    'POST /api/contracts/renew': (body) => {
      const state = ensureState();
      const result = game.renewContract(state, body.playerId, Number(body.years) || 2);
      store.save(state);
      return result;
    },

    'POST /api/youth/promote': (body) => {
      const state = ensureState();
      const p = require('./engine/youth').promoteYouth(state, state.userClubId, body.playerId);
      store.save(state);
      return { player: p };
    },

    'POST /api/facilities/upgrade': (body) => {
      const state = ensureState();
      const result = game.upgradeFacility(state, body.type);
      store.save(state);
      return result;
    },

    'POST /api/scout': (body) => {
      const state = ensureState();
      const result = game.scoutPlayer(state, body.playerId);
      store.save(state);
      return result;
    },

    'POST /api/freeagents/sign': (body) => {
      const state = ensureState();
      const p = game.signFreeAgent(state, body.playerId);
      store.save(state);
      return { player: p };
    },

    'POST /api/club/identity': (body) => {
      const state = ensureState();
      const club = state.clubs[state.userClubId];
      const { CREST_SHAPES, CREST_PATTERNS, CREST_FIGURES, KIT_PATTERNS } = require('./engine/club');
      if (body.crest && typeof body.crest === 'object') {
        const c = body.crest;
        if (!CREST_SHAPES.includes(c.shape) || !CREST_PATTERNS.includes(c.pattern) || !CREST_FIGURES.includes(c.figure)) {
          throw new ApiError(400, 'Escudo inválido');
        }
        const hex = /^#[0-9a-fA-F]{6}$/;
        if (!hex.test(c.c1 || '') || !hex.test(c.c2 || '')) throw new ApiError(400, 'Colores del escudo inválidos');
        club.crest = {
          shape: c.shape, pattern: c.pattern, figure: c.figure,
          c1: c.c1, c2: c.c2,
          initials: String(c.initials || club.shortName).slice(0, 4).toUpperCase()
        };
      }
      if (body.kit && typeof body.kit === 'object') {
        const k = body.kit;
        if (!KIT_PATTERNS.includes(k.pattern)) throw new ApiError(400, 'Diseño de camiseta inválido');
        const hex = /^#[0-9a-fA-F]{6}$/;
        if (!hex.test(k.c1 || '') || !hex.test(k.c2 || '')) throw new ApiError(400, 'Colores de la camiseta inválidos');
        club.kit = { pattern: k.pattern, c1: k.c1, c2: k.c2 };
      }
      if (body.name && String(body.name).trim().length >= 3) club.name = String(body.name).trim().slice(0, 30);
      if (body.shortName) club.shortName = String(body.shortName).trim().slice(0, 4).toUpperCase();
      if (club.crest) club.crest.initials = club.shortName;
      store.save(state);
      return { ok: true, snapshot: snapshot(state) };
    },

    'POST /api/player/skill': (body) => {
      const state = ensureState();
      const club = state.clubs[state.userClubId];
      const player = state.players[body.playerId];
      if (!player || !club.squad.includes(player.id)) throw new ApiError(404, 'Jugador no encontrado en tu plantilla');
      const result = require('./engine/skills').unlockSkill(player, body.skillId);
      if (!result.ok) throw new ApiError(400, result.reason);
      store.save(state);
      return { ok: true, message: player.name + ' ha desbloqueado: ' + result.skill.name, snapshot: snapshot(state) };
    },

    'POST /api/player/treat': (body) => {
      const state = ensureState();
      const result = require('./engine/medical').treatPlayer(state, body.playerId, body.treatment);
      store.save(state);
      return { ...result, snapshot: snapshot(state) };
    },

    'POST /api/sponsors/negotiate': (body) => {
      const state = ensureState();
      const result = require('./engine/sponsors').negotiate(state, body.offerId, body.action, Number(body.counterPct) || 0);
      store.save(state);
      return { ...result, snapshot: snapshot(state) };
    },

    'GET /api/chain/verify': () => {
      const state = ensureState();
      return chainMod.validateChain(state.chain);
    },

    'POST /api/inbox/read': () => {
      const state = ensureState();
      for (const msg of state.inbox) msg.read = true;
      store.save(state);
      return { ok: true };
    }
  };
}

module.exports = { ApiError, snapshot, createRoutes };
