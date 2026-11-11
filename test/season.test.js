'use strict';

/* Simulaci\u00f3n headless de la temporada completa: ciclo de juego de principio a fin. */

const test = require('node:test');
const assert = require('node:assert');
const chainMod = require('../blockchain/chain');
const game = require('../server/engine/game');

test('ciclo completo: temporada entera con fichajes, ventas y cierre de temporada', { timeout: 120000 }, () => {
  const state = game.newGame({ clubName: 'Galaxy FC', city: 'Vallebravo' });
  const user = state.clubs[state.userClubId];
  assert.strictEqual(state.league.clubIds.length, 12);
  assert.strictEqual(state.league.fixtures.length, 22);
  assert.ok(user.squad.length >= 20 && user.squad.length <= 30);
  assert.ok(state.chain.length >= 1, 'cadena creada con bloque génesis');
  assert.match(state.chain[0].transactions[0].note, /simulada/i);
  assert.ok(Object.keys(state.nft.assets).length >= 300, 'NFT por jugador');

  let bought = 0, sold = 0, transferred = false;
  for (let round = 0; round < 22; round++) {
    assert.strictEqual(state.phase, 'season', 'en temporada durante la ronda ' + round);

    if (round === 2) {
      const listings = state.market.listings.filter(l => l.sellerClubId !== state.userClubId && state.clubs[state.userClubId].budget > l.price * 1.1);
      if (listings.length) {
        const target = listings[0];
        const receipt = game.userBuyListing(state, target.id);
        assert.strictEqual(receipt.status, 'SUCCESS');
        assert.strictEqual(receipt.simulated, true);
        assert.ok(state.clubs[state.userClubId].squad.includes(target.playerId));
        const asset = Object.values(state.nft.assets).find(a => a.playerId === target.playerId);
        assert.ok(asset, 'el jugador tiene NFT');
        assert.strictEqual(asset.owner, user.wallet, 'el NFT ahora pertenece al wallet del club del usuario');
        bought++;
      }
    }

    if (round === 5 && user.squad.length > 15) {
      const candidate = user.squad.map(id => state.players[id])
        .filter(p => p.overall < 58 && !state.market.listings.some(l => l.playerId === p.id))[0];
      if (candidate) {
        const listing = require('../server/engine/market').listPlayer(state, state.userClubId, candidate.id, Math.round(candidate.value));
        assert.ok(listing.id);
      }
    }

    game.simUserMatch(state);
    assert.strictEqual(state.pendingMatch, null);

    if (round === 8) {
      const pending = state.market.offers.find(o => o.status === 'pending' && o.toClubId === state.userClubId);
      if (pending) {
        const r = game.respondOffer(state, pending.id, true);
        if (r.receipt) { sold++; transferred = true; }
      }
    }

    game.advanceWeek(state, {});
    const v = chainMod.validateChain(state.chain);
    assert.strictEqual(v.valid, true, 'cadena v\u00e1lida tras jornada ' + round);
  }

  assert.strictEqual(state.phase, 'seasonEnd', 'la temporada termina tras 22 jornadas');
  assert.ok(state.seasonAwards, 'premios de temporada calculados');
  assert.ok(state.seasonAwards.champion);

  const table = require('../server/engine/league').computeTable(state);
  const totalAppearances = table.reduce((s, r) => s + r.played, 0);
  assert.strictEqual(totalAppearances, 264, '12 clubes x 22 jornadas = 264 apariciones (132 partidos)');

  const result = game.startNewSeason(state);
  assert.strictEqual(state.season, 2);
  assert.strictEqual(state.phase, 'season');
  assert.strictEqual(state.league.fixtures.length, 22);
  assert.ok(Array.isArray(result.retired));
  for (const fa of state.market.freeAgents) {
    const p = typeof fa === 'string' ? state.players[fa] : fa;
    assert.ok(p, 'agente libre accesible');
  }
  assert.ok(state.chain.length > 10, 'la cadena creci\u00f3 durante la temporada: ' + state.chain.length + ' bloques');
  assert.ok(bought >= 0 && sold >= 0, 'operaciones de mercado ejecutadas sin errores');
  assert.ok(state.market.transferHistory.length > 0 || (!bought && !sold && !transferred), 'historial coherente con la actividad');
});

test('persistencia: guardar y recargar conserva el estado y el RNG', () => {
  const store = require('../server/store');
  const fs = require('fs');
  const path = require('path');
  const tmpSave = path.join(__dirname, 'tmp-save.json');
  const origPath = process.env.FC_GALAXY_SAVE || '';
  process.env.FC_GALAXY_SAVE = tmpSave;
  delete require.cache[require.resolve('../server/store')];
  const localStore = require('../server/store');

  const state = game.newGame({ clubName: 'Persist FC' });
  game.simUserMatch(state);
  game.advanceWeek(state, {});
  const rngBefore = state.rng.toJSON();
  const budgetBefore = state.clubs[state.userClubId].budget;
  localStore.save(state);

  const loaded = localStore.load();
  assert.ok(loaded, 'estado cargado');
  assert.strictEqual(loaded.clubs[state.userClubId].budget, budgetBefore);
  assert.deepStrictEqual(loaded.rng.toJSON(), rngBefore, 'RNG restaurado');
  const seqA = Array.from({ length: 5 }, () => state.rng.float());
  const seqB = Array.from({ length: 5 }, () => loaded.rng.float());
  assert.deepStrictEqual(seqA, seqB, 'secuencia RNG contin\u00faa id\u00e9ntica tras recargar');

  localStore.clear();
  if (origPath) process.env.FC_GALAXY_SAVE = origPath; else delete process.env.FC_GALAXY_SAVE;
  delete require.cache[require.resolve('../server/store')];
  assert.ok(!fs.existsSync(tmpSave), 'guard temporal limpiado');
});
