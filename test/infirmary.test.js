'use strict';

/* Enfermería: tratamientos que reducen la baja, coste al presupuesto
   y efecto del nivel del centro médico. */

const test = require('node:test');
const assert = require('node:assert');
const medical = require('../server/engine/medical');
const game = require('../server/engine/game');
const routesFactory = require('../server/routes');

function firstInjured(state) {
  const club = state.clubs[state.userClubId];
  for (const id of club.squad) {
    const p = state.players[id];
    if (p.injury) return p;
  }
  return null;
}

function forceInjury(state, weeks) {
  const club = state.clubs[state.userClubId];
  const p = state.players[club.squad[0]];
  p.injury = { type: 'rotura fibrilar', weeks };
  return p;
}

test('enfermería: hay catálogo de tratamientos y cotización con centro médico', () => {
  assert.strictEqual(medical.TREATMENTS.length, 3);
  for (const t of medical.TREATMENTS) {
    assert.ok(t.id && t.name && t.weeks >= 1 && t.costPerWeek > 0);
  }
  const q1 = medical.treatmentQuote(6, 'physio', 1);
  assert.strictEqual(q1.reduction, 1);
  assert.strictEqual(q1.cost, 150000);
  const q5 = medical.treatmentQuote(6, 'physio', 5);
  assert.strictEqual(q5.reduction, 2, 'nivel 5 de médico acelera +1 semana');
  assert.strictEqual(q5.cost, 240000, '2 semanas con descuento del 20% (nivel 5)');
  const q6 = medical.treatmentQuote(6, 'surgery', 6);
  assert.strictEqual(q6.reduction, 5);
  assert.strictEqual(q6.cost, Math.round(520000 * 5 * 0.75));
  const qCap = medical.treatmentQuote(2, 'surgery', 6);
  assert.strictEqual(qCap.reduction, 2, 'no reduce más semanas de las que quedan');
  assert.throws(() => medical.treatmentQuote(3, 'no-existe', 1), /desconocido/i);
});

test('enfermería: tratamiento reduce la baja, cobra y registra en el libro', () => {
  const state = game.newGame({ clubName: 'Infirmary FC' });
  const p = forceInjury(state, 6);
  const club = state.clubs[state.userClubId];
  const budgetBefore = club.budget;

  const r = medical.treatPlayer(state, p.id, 'intensive');
  assert.ok(r.ok);
  assert.strictEqual(r.reduction, 2);
  assert.strictEqual(p.injury.weeks, 4);
  assert.strictEqual(club.budget, budgetBefore - r.cost);
  const entry = club.ledger.filter(e => e.category === 'sanidad').pop();
  assert.ok(entry, 'movimiento de sanidad registrado');
  assert.ok(entry.amount < 0 && entry.concept.includes(p.name));

  const r2 = medical.treatPlayer(state, p.id, 'surgery');
  assert.strictEqual(r2.reduction, 4);
  assert.strictEqual(r2.recovered, true, 'recuperación completa');
  assert.strictEqual(p.injury, null);
});

test('enfermería: validaciones de jugador, lesión y presupuesto', () => {
  const state = game.newGame({ clubName: 'Infirmary FC' });
  const club = state.clubs[state.userClubId];

  assert.throws(() => medical.treatPlayer(state, 'no-existe', 'physio'), /plantilla/i);

  const healthy = state.players[club.squad.find(id => !state.players[id].injury)];
  assert.throws(() => medical.treatPlayer(state, healthy.id, 'physio'), /no está lesionado/i);

  const p = forceInjury(state, 6);
  club.budget = 10;
  assert.throws(() => medical.treatPlayer(state, p.id, 'surgery'), /Necesitas/);
  assert.strictEqual(p.injury.weeks, 6, 'la baja no cambia si no hay presupuesto');
});

test('enfermería: ruta HTTP trata y devuelve snapshot con catálogo', () => {
  const state = game.newGame({ clubName: 'Infirmary FC' });
  const saved = [];
  const store = { save: (s) => saved.push(s) };
  const routes = routesFactory.createRoutes({ getState: () => state, setState: () => {}, store });
  const snap = routes['GET /api/state']();
  assert.ok(Array.isArray(snap.treatments) && snap.treatments.length === 3, 'catálogo en snapshot');

  const p = forceInjury(state, 6);
  const budgetBefore = state.clubs[state.userClubId].budget;
  const r = routes['POST /api/player/treat']({ playerId: p.id, treatment: 'physio' });
  assert.ok(r.ok && r.message.includes(p.name));
  assert.ok(r.snapshot, 'snapshot devuelto');
  assert.strictEqual(state.clubs[state.userClubId].budget, budgetBefore - r.cost);
  assert.strictEqual(saved.length, 1, 'estado persistido');
  assert.throws(() => routes['POST /api/player/treat']({ playerId: p.id, treatment: 'no-existe' }), /desconocido/i);
});
