'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const store = require('./store');
const game = require('./engine/game');
const leagueMod = require('./engine/league');
const chainMod = require('../blockchain/chain');
const tokenMod = require('../blockchain/token');
const nftMod = require('../blockchain/nft');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

let state = store.load();

function ensureState() {
  if (!state) throw new ApiError(409, 'No hay partida iniciada. Crea tu club primero.');
  return state;
}

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function snapshot(state) {
  const table = state.phase === 'setup' ? [] : leagueMod.computeTable(state);
  const user = state.clubs[state.userClubId];
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
    pendingMatch: state.pendingMatch,
    lastResults: state.lastResults.slice(0, 10),
    seasonAwards: state.seasonAwards,
    chain: state.chain,
    token: { symbol: state.token.symbol, balances: state.token.balances, totalSupply: state.token.totalSupply },
    nft: state.nft,
    nextFixture
  };
}

const routes = {
  'GET /api/state': () => {
    if (!state) return { phase: 'setup' };
    return snapshot(state);
  },

  'POST /api/game/new': (body) => {
    if (!body || !body.clubName || String(body.clubName).trim().length < 3) {
      throw new ApiError(400, 'El nombre del club debe tener al menos 3 caracteres');
    }
    if (String(body.clubName).length > 30) throw new ApiError(400, 'Nombre demasiado largo (máx. 30)');
    state = game.newGame({
      clubName: String(body.clubName).trim(),
      shortName: body.shortName ? String(body.shortName).trim().slice(0, 4) : undefined,
      city: body.city ? String(body.city).trim().slice(0, 30) : undefined,
      managerName: body.managerName ? String(body.managerName).trim().slice(0, 30) : undefined,
      primaryColor: body.primaryColor,
      secondaryColor: body.secondaryColor,
      formation: body.formation
    });
    store.save(state);
    return snapshot(state);
  },

  'POST /api/game/reset': () => {
    store.clear();
    state = null;
    return { phase: 'setup' };
  },

  'POST /api/match/start': () => {
    ensureState();
    const match = game.startMatch(state);
    store.save(state);
    return { match };
  },

  'POST /api/match/resume': (body) => {
    ensureState();
    const match = game.resumeMatch(state, body || {});
    store.save(state);
    return { match };
  },

  'POST /api/match/sim': () => {
    ensureState();
    const match = game.simUserMatch(state);
    store.save(state);
    return { match };
  },

  'POST /api/week/advance': (body) => {
    ensureState();
    const summary = game.advanceWeek(state, body || {});
    store.save(state);
    return { summary, snapshot: snapshot(state) };
  },

  'POST /api/season/next': () => {
    ensureState();
    const result = game.startNewSeason(state);
    store.save(state);
    return { result, snapshot: snapshot(state) };
  },

  'POST /api/tactics': (body) => {
    ensureState();
    const club = state.clubs[state.userClubId];
    if (body.formation) {
      const { FORMATIONS } = require('./engine/club');
      if (!FORMATIONS[body.formation]) throw new ApiError(400, 'Formación inválida');
      club.formation = body.formation;
      club.lineup = [];
    }
    if (body.mentality && ['defensive', 'balanced', 'attacking'].includes(body.mentality)) club.mentality = body.mentality;
    if (body.pressing && ['low', 'medium', 'high'].includes(body.pressing)) club.tactics.pressing = body.pressing;
    if (Array.isArray(body.lineup)) {
      const valid = body.lineup.filter(id => club.squad.includes(id));
      const slots = require('./engine/match').formationSlots(club.formation).length;
      if (valid.length !== slots) throw new ApiError(400, `Debes seleccionar ${slots} jugadores titulares`);
      if (new Set(valid).size !== valid.length) throw new ApiError(400, 'Jugadores duplicados en la alineación');
      club.lineup = valid;
    }
    store.save(state);
    return { ok: true };
  },

  'POST /api/training': (body) => {
    ensureState();
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
    ensureState();
    const listing = require('./engine/market').listPlayer(state, state.userClubId, body.playerId, Math.round(Number(body.price)));
    store.save(state);
    return { listing };
  },

  'POST /api/market/cancel': (body) => {
    ensureState();
    require('./engine/market').cancelListing(state, state.userClubId, body.listingId);
    store.save(state);
    return { ok: true };
  },

  'POST /api/market/buy': (body) => {
    ensureState();
    const receipt = game.userBuyListing(state, body.listingId);
    store.save(state);
    return { receipt, snapshot: snapshot(state) };
  },

  'POST /api/market/offer': (body) => {
    ensureState();
    const amount = Math.round(Number(body.amount));
    if (!amount || amount <= 0) throw new ApiError(400, 'Importe de oferta inválido');
    const result = game.userMakeOffer(state, body.playerId, amount);
    store.save(state);
    return { ...result, snapshot: snapshot(state) };
  },

  'POST /api/offers/respond': (body) => {
    ensureState();
    const result = game.respondOffer(state, body.offerId, !!body.accept);
    store.save(state);
    return { ...result, snapshot: snapshot(state) };
  },

  'POST /api/contracts/renew': (body) => {
    ensureState();
    const result = game.renewContract(state, body.playerId, Number(body.years) || 2);
    store.save(state);
    return result;
  },

  'POST /api/youth/promote': (body) => {
    ensureState();
    const p = require('./engine/youth').promoteYouth(state, state.userClubId, body.playerId);
    store.save(state);
    return { player: p };
  },

  'POST /api/facilities/upgrade': (body) => {
    ensureState();
    const result = game.upgradeFacility(state, body.type);
    store.save(state);
    return result;
  },

  'POST /api/scout': (body) => {
    ensureState();
    const result = game.scoutPlayer(state, body.playerId);
    store.save(state);
    return result;
  },

  'POST /api/freeagents/sign': (body) => {
    ensureState();
    const p = game.signFreeAgent(state, body.playerId);
    store.save(state);
    return { player: p };
  },

  'GET /api/chain/verify': () => {
    ensureState();
    return chainMod.validateChain(state.chain);
  },

  'POST /api/inbox/read': () => {
    ensureState();
    for (const msg of state.inbox) msg.read = true;
    store.save(state);
    return { ok: true };
  }
};

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

function serveStatic(req, res, urlPath) {
  let filePath = urlPath === '/' ? '/index.html' : urlPath;
  const abs = path.normalize(path.join(PUBLIC_DIR, filePath));
  if (!abs.startsWith(PUBLIC_DIR)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  fs.readFile(abs, (err, data) => {
    if (err) {
      fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (err2, indexData) => {
        if (err2) { res.writeHead(404); res.end('Not found'); return; }
        res.writeHead(200, { 'Content-Type': MIME['.html'] });
        res.end(indexData);
      });
      return;
    }
    const ext = path.extname(abs).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const routeKey = req.method + ' ' + url.pathname;

  if (url.pathname.startsWith('/api/')) {
    const handler = routes[routeKey];
    if (!handler) {
      sendJson(res, 404, { error: 'Ruta no encontrada: ' + routeKey });
      return;
    }
    let body = null;
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        if (raw) body = JSON.parse(raw);
        const result = handler(body);
        sendJson(res, 200, result);
      } catch (err) {
        if (err instanceof ApiError) {
          sendJson(res, err.status, { error: err.message });
        } else {
          console.error('[api]', routeKey, err);
          sendJson(res, 400, { error: err.message || 'Error interno' });
        }
      }
    });
    return;
  }

  serveStatic(req, res, url.pathname);
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log('FC Galaxy servidor en http://localhost:' + PORT);
    console.log('Partida existente:', store.exists() ? 'sí (continúa donde la dejaste)' : 'no (crea un club nuevo)');
  });
}

module.exports = { server, routes };
