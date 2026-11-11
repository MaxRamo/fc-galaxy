'use strict';

/* Modo navegador: el bundle público ejecuta el juego completo sin Node,
   con persistencia en localStorage. */

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const crypto = require('crypto');

function loadBundle(existingMem) {
  const mem = existingMem || {};
  global.localStorage = {
    getItem: k => (k in mem ? mem[k] : null),
    setItem: (k, v) => { mem[k] = String(v); },
    removeItem: k => { delete mem[k]; }
  };
  global.window = {};
  const bundlePath = require.resolve(path.join(__dirname, '..', 'public', 'js', 'engine-bundle.js'));
  delete require.cache[bundlePath];
  require(bundlePath);
  return { L: global.window.FC_LOCAL, mem };
}

test('bundle navegador: SHA-256 puro coincide con el crypto de Node', () => {
  const { sha256Hex } = require('../blockchain/sha256');
  for (const sample of ['hola', 'FC Galaxy SIMCHAIN', 'a|b|c|1234567890']) {
    assert.strictEqual(sha256Hex(sample), crypto.createHash('sha256').update(sample).digest('hex'));
  }
});

test('bundle navegador: ciclo de juego completo sin servidor', () => {
  const { L, mem } = loadBundle();
  assert.ok(L, 'FC_LOCAL expuesto');
  assert.strictEqual(L.mode, 'browser');

  const call = (m, p, b) => {
    const r = L.handle(m, p, b);
    if (r.status >= 400) throw new Error(r.data.error);
    return r.data;
  };

  assert.strictEqual(call('GET', '/api/state').phase, 'setup');
  const s = call('POST', '/api/game/new', { clubName: 'Browser FC' });
  assert.strictEqual(Object.keys(s.nft.assets).length >= 300, true);
  call('POST', '/api/match/sim');
  const adv = call('POST', '/api/week/advance');
  assert.strictEqual(adv.snapshot.week, 2);
  call('POST', '/api/tactics', { mentality: 'attacking' });
  call('POST', '/api/training', { focus: 'technique' });

  let guard = 0;
  let state = call('GET', '/api/state');
  while (state.phase === 'season' && guard++ < 30) {
    call('POST', '/api/match/sim');
    state = call('POST', '/api/week/advance').snapshot;
  }
  assert.strictEqual(state.phase, 'seasonEnd');
  assert.ok(state.seasonAwards.champion);
  const next = call('POST', '/api/season/next').snapshot;
  assert.strictEqual(next.season, 2);

  const chainMod = require('../blockchain/chain');
  const v = chainMod.validateChain(call('GET', '/api/state').chain);
  assert.strictEqual(v.valid, true);
  assert.ok(v.blocks > 10);

  const saved = JSON.parse(mem['fc-galaxy-save-v1']);
  assert.strictEqual(saved.clubs[saved.userClubId].name, 'Browser FC');
  assert.strictEqual(saved.season, 2);
});

test('bundle navegador: persistencia entre "sesiones" y errores controlados', () => {
  const { L, mem } = loadBundle();
  const r1 = L.handle('POST', '/api/game/new', { clubName: 'Sesion Uno' });
  assert.strictEqual(r1.status, 200);
  L.handle('POST', '/api/match/sim');

  const { L: L2 } = loadBundle(mem);
  const st = L2.handle('GET', '/api/state');
  assert.strictEqual(st.status, 200);
  assert.strictEqual(st.data.clubs[st.data.userClubId].name, 'Sesion Uno', 'partida restaurada de localStorage');

  const bad = L2.handle('POST', '/api/market/buy', { listingId: 'no-existe' });
  assert.strictEqual(bad.status, 500);
  assert.ok(bad.data.error);

  const missing = L2.handle('GET', '/api/nope');
  assert.strictEqual(missing.status, 404);

  L2.handle('POST', '/api/game/reset');
  assert.strictEqual(JSON.parse(mem['fc-galaxy-save-v1'] || 'null'), null, 'reset limpia el guardado');
});
