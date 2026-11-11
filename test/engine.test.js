'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { Rng } = require('../server/engine/rng');
const playerMod = require('../server/engine/player');
const leagueMod = require('../server/engine/league');
const matchMod = require('../server/engine/match');
const financeMod = require('../server/engine/finance');
const marketMod = require('../server/engine/market');
const clubMod = require('../server/engine/club');
const game = require('../server/engine/game');

test('RNG: determinista y serializable', () => {
  const a = new Rng('seed-1');
  const seq1 = Array.from({ length: 10 }, () => a.float());
  const b = new Rng('seed-1');
  const seq2 = Array.from({ length: 10 }, () => b.float());
  assert.deepStrictEqual(seq1, seq2);
  const json = JSON.parse(JSON.stringify(b.toJSON()));
  const c = Rng.fromJSON(json);
  const seq3 = Array.from({ length: 10 }, () => c.float());
  const d = new Rng('seed-1');
  Array.from({ length: 10 }, () => d.float());
  const seq4 = Array.from({ length: 10 }, () => d.float());
  assert.deepStrictEqual(seq3, seq4);
});

test('jugadores: generaci\u00f3n coherente y valoraci\u00f3n positiva', () => {
  const rng = new Rng('t');
  for (let i = 0; i < 50; i++) {
    const p = playerMod.generatePlayer(rng, {});
    assert.ok(p.overall >= 25 && p.overall <= 96, 'overall en rango');
    assert.ok(p.age >= 17 && p.age <= 34);
    assert.ok(p.value > 0, 'valor positivo');
    assert.ok(p.contract.wage > 0);
    assert.ok(p.potential >= p.overall - 5, 'potencial razonable');
  }
  const young = playerMod.generatePlayer(rng, { age: 18, level: 70 });
  const old = playerMod.generatePlayer(rng, { age: 33, level: 70 });
  assert.ok(playerMod.computeValue(young) > 0);
  assert.ok(playerMod.computeValue(old) > 0);
});

test('liga: calendario doble vuelta completo y tabla ordenada', () => {
  const rng = new Rng('t');
  const ids = Array.from({ length: 12 }, (_, i) => 'c' + i);
  const fixtures = leagueMod.buildFixtures(ids, rng);
  assert.strictEqual(fixtures.length, 22, '22 jornadas');
  for (const round of fixtures) {
    assert.strictEqual(round.length, 6, '6 partidos por jornada');
    const seen = new Set();
    for (const m of round) {
      assert.ok(!seen.has(m.home) && !seen.has(m.away), 'cada club juega una vez por jornada');
      seen.add(m.home); seen.add(m.away);
    }
  }
  const state = { league: { fixtures, clubIds: ids }, clubs: {}, players: {} };
  ids.forEach(id => { state.clubs[id] = { id, name: id }; });
  fixtures[0][0].played = true; fixtures[0][0].score = [2, 1];
  const table = leagueMod.computeTable(state);
  assert.strictEqual(table.length, 12);
  for (let i = 1; i < table.length; i++) {
    assert.ok(table[i - 1].pts >= table[i].pts, 'ordenada por puntos');
  }
  const leader = table[0];
  assert.strictEqual(leader.played, 1);
  assert.strictEqual(leader.pts, 3);
});

test('partidos: promedio de goles realista en 150 simulaciones', () => {
  const rng = new Rng('goals');
  const state = game.newGame({ clubName: 'Test United' });
  state.rng = rng;
  let goals = 0, games = 0;
  for (let i = 0; i < 150; i++) {
    const fixture = state.league.fixtures[i % 22][Math.floor(i / 22) % 6];
    const m = matchMod.createMatch(state, fixture.home, fixture.away);
    while (!m.finished) matchMod.runSegment(state, m, m.minute < 45 ? 45 : m.minute < 75 ? 75 : 90);
    goals += m.score[0] + m.score[1];
    games++;
  }
  const avg = goals / games;
  assert.ok(avg > 1.6 && avg < 4.2, 'media de goles razonable, obtenida: ' + avg.toFixed(2));
});

test('partido del usuario: puntos de control en 45 y 75', () => {
  const state = game.newGame({ clubName: 'Control FC' });
  const match = game.startMatch(state);
  assert.ok(state.pendingMatch);
  assert.strictEqual(match.minute, 45);
  assert.strictEqual(match.finished, false);
  const last = match.events[match.events.length - 1];
  assert.strictEqual(last.type, 'checkpoint');

  const mid = game.resumeMatch(state, { mentality: 'attacking' });
  assert.strictEqual(mid.minute, 75);
  const fin = game.resumeMatch(state, {});
  assert.strictEqual(fin.finished, true);
  assert.strictEqual(state.pendingMatch, null, 'commit al terminar');
  const fixture = state.league.fixtures[0].find(m => m.played);
  assert.ok(fixture, 'fixture actualizado');
});

test('finanzas: addLedger actualiza presupuesto y facilityCost escala', () => {
  const state = game.newGame({ clubName: 'Fin FC' });
  const club = state.clubs[state.userClubId];
  const before = club.budget;
  financeMod.addLedger(state, state.userClubId, { concept: 'test', amount: -1000, category: 'test' });
  assert.strictEqual(club.budget, before - 1000);
  assert.ok(financeMod.facilityCost('training', 2) > financeMod.facilityCost('training', 1));
  assert.ok(financeMod.canAfford(club, 1));
  assert.ok(!financeMod.canAfford(club, club.budget * 10));
});

test('mercado: publicar con precio fuera de rango falla', () => {
  const state = game.newGame({ clubName: 'Market FC' });
  const club = state.clubs[state.userClubId];
  const pid = club.squad[5];
  const p = state.players[pid];
  assert.throws(() => marketMod.listPlayer(state, state.userClubId, pid, Math.round(p.value * 10)), /rango/i);
  assert.throws(() => marketMod.listPlayer(state, state.userClubId, 'no-existe', 1000), /no pertenece/i);
  const listing = marketMod.listPlayer(state, state.userClubId, pid, Math.round(p.value));
  assert.ok(listing.id);
  marketMod.cancelListing(state, state.userClubId, listing.id);
  assert.ok(!state.market.listings.some(l => l.id === listing.id), 'publicación retirada');
});

test('mercado: la IA genera publicaciones y ofertas (bug bestOverall corregido)', () => {
  const state = game.newGame({ clubName: 'AI FC' });
  for (let i = 0; i < 8; i++) game.advanceWeek(state, { simUserMatch: true });
  assert.ok(state.market.listings.length > 0, 'deben existir publicaciones de la IA');
});

test('avanzar semana sin jugar el partido lanza error claro', () => {
  const state = game.newGame({ clubName: 'Week FC' });
  assert.throws(() => game.advanceWeek(state, {}), /partido pendiente/i);
});
