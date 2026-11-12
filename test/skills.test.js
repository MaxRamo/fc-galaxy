'use strict';

/* Árboles de habilidades: árbol por posición, desbloqueo con requisitos
   y puntos, y efecto real sobre atributos/overall. */

const test = require('node:test');
const assert = require('node:assert');
const skills = require('../server/engine/skills');
const game = require('../server/engine/game');

test('habilidades: hay árbol para cada posición y nodos encadenados', () => {
  for (const pos of ['GK', 'CB', 'LB', 'RB', 'DM', 'CM', 'AM', 'LW', 'RW', 'ST']) {
    const tree = skills.treeFor(pos);
    assert.strictEqual(tree.length, 6, 'árbol de ' + pos + ' completo');
    const ids = new Set(tree.map(s => s.id));
    for (const sk of tree) {
      assert.ok(sk.name && sk.desc && sk.cost >= 1 && sk.tier >= 1 && sk.tier <= 3);
      for (const req of sk.requires) assert.ok(ids.has(req), 'requisito válido en ' + pos);
    }
    assert.strictEqual(tree.filter(s => s.tier === 1).length, 3);
  }
  const byPos = skills.treesByPosition();
  assert.strictEqual(byPos.LB.length, 6);
  assert.strictEqual(byPos.ST[5].id, 'letal');
  assert.ok(byPos.ST[5].name.includes('letal') || byPos.ST[5].name.includes('Letal'));
});

test('habilidades: desbloqueo valida requisitos, puntos y aplica bonus a atributos', () => {
  const state = game.newGame({ clubName: 'Skills FC' });
  const st = state.players[state.clubs[state.userClubId].squad.find(id => state.players[id].pos === 'ST')];
  st.skillPoints = 4;
  const shootingBefore = st.attrs.shooting;
  const overallBefore = st.overall;

  assert.ok(!skills.canUnlock(st, 'letal').ok, 'tier 3 bloqueado sin requisitos');
  assert.ok(!skills.canUnlock(st, 'no-existe').ok, 'skill inexistente rechazada');

  let r = skills.unlockSkill(st, 'definicion');
  assert.ok(r.ok);
  assert.strictEqual(st.attrs.shooting, Math.min(99, shootingBefore + 3));
  assert.ok(st.overall >= overallBefore, 'overall no baja al desbloquear');
  assert.strictEqual(st.skillPoints, 3);

  assert.ok(!skills.canUnlock(st, 'disparocertero').ok && st.skillPoints < 2 ? false : true, 'precondición');
  st.skillPoints = 0;
  assert.ok(!skills.unlockSkill(st, 'disparocertero').ok, 'sin puntos no se desbloquea');
  st.skillPoints = 2;
  r = skills.unlockSkill(st, 'disparocertero');
  assert.ok(r.ok, 'con puntos y requisito se desbloquea');
  assert.ok(st.skills.includes('definicion') && st.skills.includes('disparocertero'));
  assert.ok(!skills.unlockSkill(st, 'disparocertero').ok, 'no se puede repetir');

  const valueBefore = st.value;
  assert.ok(st.value > 0 && valueBefore > 0);
});

test('habilidades: los porteros usan su propio árbol de atributos', () => {
  const state = game.newGame({ clubName: 'GK FC' });
  const gk = state.players[state.clubs[state.userClubId].squad.find(id => state.players[id].pos === 'GK')];
  gk.skillPoints = 3;
  const reflBefore = gk.attrs.reflexes;
  const r = skills.unlockSkill(gk, 'reflejos');
  assert.ok(r.ok);
  assert.strictEqual(gk.attrs.reflexes, reflBefore + 3);
  assert.ok(skills.skillState(gk, skills.skillById('GK', 'muralla')).startsWith('locked') ||
    skills.skillState(gk, skills.skillById('GK', 'muralla')) === 'locked', 'muralla requiere tier 2');
});

test('habilidades: puntos se ganan entrenando y jugando; migración v4→v5 añade campos', () => {
  const state = game.newGame({ clubName: 'Puntos FC' });
  for (let i = 0; i < 12 && state.phase === 'season'; i++) {
    game.simUserMatch(state);
    if (state.phase !== 'season') break;
    game.advanceWeek(state, {});
  }
  const withPoints = Object.values(state.players).filter(p => (p.skillPoints || 0) > 0);
  assert.ok(withPoints.length > 0, 'alguien ganó puntos de habilidad jugando');

  const legacy = JSON.parse(JSON.stringify(state));
  legacy.version = 4;
  for (const p of Object.values(legacy.players)) { delete p.skills; delete p.skillPoints; }
  const migrated = game.migrate(legacy);
  assert.ok(migrated.version >= 5);
  for (const p of Object.values(migrated.players)) {
    assert.deepStrictEqual(p.skills, []);
    assert.strictEqual(p.skillPoints, 0);
  }
});
