'use strict';

/* Modo navegador: el bundle público ejecuta el juego completo sin Node,
   con cuentas y persistencia por cuenta en localStorage. */

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

test('bundle navegador: auth obligatoria y errores de cuenta controlados', () => {
  const { L, mem } = loadBundle();

  const denied = L.handle('GET', '/api/state');
  assert.strictEqual(denied.status, 401);
  assert.strictEqual(denied.data.authRequired, true);

  const badUser = L.handle('POST', '/api/auth/register', { username: 'a', password: 'clave123' });
  assert.strictEqual(badUser.status, 400);
  assert.ok(badUser.data.error);

  const badPass = L.handle('POST', '/api/auth/register', { username: 'jugador', password: '12345' });
  assert.strictEqual(badPass.status, 400);

  const ok = L.handle('POST', '/api/auth/register', { username: 'jugador', password: 'clave123' });
  assert.strictEqual(ok.status, 200);
  assert.ok(ok.data.account.id);
  assert.strictEqual(ok.data.account.provider, 'local');

  const dup = L.handle('POST', '/api/auth/register', { username: 'jugador', password: 'clave123' });
  assert.strictEqual(dup.status, 400);
  assert.ok(dup.data.error.includes('ya existe'));

  const badLogin = L.handle('POST', '/api/auth/login', { username: 'jugador', password: 'malclave' });
  assert.strictEqual(badLogin.status, 400);
  assert.ok(badLogin.data.error.includes('incorrectos'));

  const me = L.handle('GET', '/api/auth/me');
  assert.strictEqual(me.status, 200);
  assert.strictEqual(me.data.account.username, 'jugador');

  L.handle('POST', '/api/auth/logout');
  assert.strictEqual(L.handle('GET', '/api/auth/me').status, 401, 'logout cierra la sesión');
  assert.strictEqual(L.handle('GET', '/api/state').status, 401);
});

test('bundle navegador: ciclo de juego completo sin servidor', () => {
  const { L, mem } = loadBundle();
  assert.ok(L, 'FC_LOCAL expuesto');
  assert.strictEqual(L.mode, 'browser');

  const acc = L.handle('POST', '/api/auth/register', { username: 'ciclo', password: 'clave123' }).data.account;
  const saveKey = 'fc-galaxy-save-' + acc.id;

  const call = (m, p, b) => {
    const r = L.handle(m, p, b);
    if (r.status >= 400) throw new Error(r.data.error);
    return r.data;
  };

  assert.strictEqual(call('GET', '/api/state').phase, 'setup');
  const s = call('POST', '/api/game/new', { clubName: 'Browser FC', country: 'ar' });
  assert.strictEqual(Object.keys(s.nft.assets).length >= 300, true);
  const myClub = s.clubs[s.userClubId];
  assert.strictEqual(myClub.country, 'ar');
  assert.ok(myClub.crest && myClub.kit);
  const squad = myClub.squad.map(id => s.players[id]);
  assert.ok(squad.filter(p => p.nationality === 'ar').length > squad.length * 0.6, 'nacionalidad argentina mayoritaria');
  assert.ok(Array.isArray(s.sponsorOffers) && s.sponsorOffers.length >= 3, 'ofertas de patrocinio en snapshot');

  const shirt = s.sponsorOffers.find(o => o.kind === 'shirt');
  const neg = call('POST', '/api/sponsors/negotiate', { offerId: shirt.id, action: 'accept' });
  assert.ok(neg.snapshot.clubs[s.userClubId].sponsor.deal, 'contrato de camiseta firmado');

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

  const saved = JSON.parse(mem[saveKey]);
  assert.strictEqual(saved.clubs[saved.userClubId].name, 'Browser FC');
  assert.strictEqual(saved.season, 2);
});

test('bundle navegador: persistencia por cuenta entre "sesiones" y errores controlados', () => {
  const { L, mem } = loadBundle();
  const acc = L.handle('POST', '/api/auth/register', { username: 'sesion', password: 'clave123' }).data.account;
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
  assert.strictEqual(JSON.parse(mem['fc-galaxy-save-' + acc.id] || 'null'), null, 'reset limpia el guardado de la cuenta');
});

test('bundle navegador: cuentas aisladas y adopción de partida legacy', () => {
  const { L, mem } = loadBundle();
  const game = require('../server/engine/game');
  const legacy = JSON.parse(JSON.stringify(game.newGame({ clubName: 'Legacy FC' })));
  legacy.version = 3;
  legacy.week = 9;
  delete legacy.sponsorOffers;
  for (const c of Object.values(legacy.clubs)) { delete c.country; delete c.crest; delete c.kit; delete c.standSponsors; }
  for (const p of Object.values(legacy.players)) delete p.nationality;
  mem['fc-galaxy-save-v1'] = JSON.stringify(legacy);

  const acc = L.handle('POST', '/api/auth/register', { username: 'legacy', password: 'clave123' }).data.account;
  const st = L.handle('GET', '/api/state');
  assert.strictEqual(st.status, 200);
  assert.strictEqual(st.data.week, 9, 'la partida antigua se adopta en la cuenta nueva');
  assert.ok(st.data.clubs[st.data.userClubId].crest, 'escudo generado en la migración a v4');
  assert.ok(st.data.clubs[st.data.userClubId].country, 'país asignado en la migración');

  L.handle('POST', '/api/auth/logout');
  const acc2 = L.handle('POST', '/api/auth/register', { username: 'otro', password: 'clave123' }).data.account;
  assert.notStrictEqual(acc2.id, acc.id);
  const st2 = L.handle('GET', '/api/state');
  assert.strictEqual(st2.data.phase, 'setup', 'cada cuenta tiene su partida independiente');
  assert.notStrictEqual(mem['fc-galaxy-save-' + acc.id], undefined, 'guardado de la primera cuenta intacto');
});
