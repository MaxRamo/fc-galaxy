'use strict';

/* Países: nombres coherentes con la nacionalidad y migración de partidas antiguas */

const test = require('node:test');
const assert = require('node:assert');
const names = require('../server/engine/names');
const game = require('../server/engine/game');

test('nombres: catálogo de países completo y coherente', () => {
  assert.ok(names.COUNTRIES.length >= 12);
  for (const c of names.COUNTRIES) {
    assert.ok(c.code && c.name && c.flag);
    assert.ok(c.first.length >= 10 && c.last.length >= 10, 'pools de nombres suficientes');
  }
  assert.strictEqual(names.countryOf('zz').code, names.DEFAULT_COUNTRY, 'código desconocido cae al país por defecto');
  assert.strictEqual(names.countryOf('ar').code, 'ar');
  assert.strictEqual(names.DEFAULT_COUNTRY, 'es');
});

test('nombres: randomName genera nombres del país solicitado', () => {
  const rng = new (require('../server/engine/rng').Rng)('names-1');
  for (const c of names.COUNTRIES) {
    for (let i = 0; i < 30; i++) {
      const n = names.randomName(rng, c.code);
      assert.ok(typeof n === 'string' && n.trim().length >= 3, 'nombre válido para ' + c.code);
      const [given, ...rest] = n.split(' ');
      assert.ok(c.first.includes(given) || c.last.includes(given), 'nombre del pool de ' + c.code);
    }
  }
  const fallback = names.randomName(rng, 'zz');
  assert.ok(fallback.split(' ').every(part =>
    names.COUNTRIES.some(c => c.first.includes(part) || c.last.includes(part))), 'país inválido cae al pool por defecto');
});

test('nueva partida: país aplica nacionalidad coherente a las plantillas', () => {
  const state = game.newGame({ clubName: 'Nación FC', country: 'ar' });
  const club = state.clubs[state.userClubId];
  assert.strictEqual(club.country, 'ar');
  const players = club.squad.map(id => state.players[id]);
  const argentines = players.filter(p => p.nationality === 'ar').length;
  assert.ok(argentines >= players.length * 0.6, 'mayoría argentina (~82%): ' + argentines + '/' + players.length);
  const foreign = players.filter(p => p.nationality !== 'ar');
  for (const p of foreign) {
    assert.ok(names.COUNTRY_MAP[p.nationality], 'extranjero con nacionalidad válida: ' + p.nationality);
  }
  const argentineNames = players.filter(p => p.nationality === 'ar').map(p => p.name);
  const esPool = names.COUNTRY_MAP.es;
  const spanishOnly = argentineNames.filter(n =>
    n.split(' ').every(part => esPool.first.includes(part) || esPool.last.includes(part)));
  assert.ok(spanishOnly.length < argentineNames.length * 0.5, 'los nombres argentinos no salen mayoritariamente del pool español');

  const crest = club.crest, kit = club.kit;
  assert.ok(crest && ['shield', 'circle', 'hex'].includes(crest.shape));
  assert.ok(kit && ['solid', 'stripes', 'hoops', 'sash'].includes(kit.pattern));
});

test('migración: partida v3 (sin país/escudo/patrocinios) se actualiza a v4 sin perder datos', () => {
  const state = game.newGame({ clubName: 'Legacy FC' });
  const club = state.clubs[state.userClubId];
  const snapshotNames = club.squad.map(id => state.players[id].name);

  const legacy = JSON.parse(JSON.stringify(state));
  legacy.version = 3;
  delete legacy.sponsorOffers;
  for (const c of Object.values(legacy.clubs)) {
    delete c.country; delete c.crest; delete c.kit; delete c.standSponsors;
    c.sponsor = { name: c.sponsor.name, income: c.sponsor.income };
  }
  for (const p of Object.values(legacy.players)) delete p.nationality;

  const migrated = game.migrate(legacy);
  assert.ok(migrated.version >= 4);
  const mClub = migrated.clubs[migrated.userClubId];
  assert.ok(mClub.country);
  assert.ok(mClub.crest && mClub.crest.initials);
  assert.ok(mClub.kit);
  assert.deepStrictEqual(mClub.standSponsors, {});
  assert.deepStrictEqual(migrated.sponsorOffers, []);
  assert.deepStrictEqual(mClub.squad.map(id => migrated.players[id].name), snapshotNames, 'plantilla intacta');
  for (const p of Object.values(migrated.players)) {
    assert.ok(p.nationality, 'nacionalidad rellenada en migración');
  }
});
