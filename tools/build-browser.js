'use strict';

/* Genera public/js/engine-bundle.js: motor de juego + SIMCHAIN + rutas
   empaquetados para ejecutarse en el navegador (sin Node).
   Uso: node tools/build-browser.js */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const MODULES = [
  'blockchain/sha256.js',
  'blockchain/chain.js',
  'blockchain/token.js',
  'blockchain/nft.js',
  'blockchain/contract.js',
  'server/engine/rng.js',
  'server/engine/names.js',
  'server/engine/player.js',
  'server/engine/club.js',
  'server/engine/match.js',
  'server/engine/league.js',
  'server/engine/finance.js',
  'server/engine/youth.js',
  'server/engine/market.js',
  'server/engine/sponsors.js',
  'server/engine/skills.js',
  'server/engine/game.js',
  'server/auth-core.js',
  'server/auth-browser.js',
  'server/store-browser.js',
  'server/routes.js'
];

const ADAPTER = `
'use strict';
/* Adaptador local: expone window.FC_LOCAL.handle(method, path, body) con la
   misma sem\u00e1ntica que la API HTTP, persistiendo en localStorage.
   Incluye cuentas (login/registro) y una partida guardada por cuenta. */

const storeMod = require('./server/store-browser.js');
const routesMod = require('./server/routes.js');
const { createBrowserAuth } = require('./server/auth-browser.js');

const auth = createBrowserAuth();
let current = auth.currentSession();
let ctx = null;

function contextFor(accountId) {
  if (!ctx) {
    const store = storeMod.createBrowserStore(accountId);
    let state = store.load();
    ctx = {
      store,
      routes: routesMod.createRoutes({
        getState: () => state,
        setState: (s) => { state = s; },
        store
      })
    };
  }
  return ctx;
}

module.exports = {
  mode: 'browser',
  handle(method, path, body) {
    body = body || {};
    try {
      if (path === '/api/auth/register' && method === 'POST') {
        const acc = auth.register(body.username, body.password);
        const { account } = auth.login(body.username, body.password);
        storeMod.adoptLegacy(account.id);
        current = account; ctx = null;
        return { status: 200, data: { account } };
      }
      if (path === '/api/auth/login' && method === 'POST') {
        const { account } = auth.login(body.username, body.password);
        storeMod.adoptLegacy(account.id);
        current = account; ctx = null;
        return { status: 200, data: { account } };
      }
      if (path === '/api/auth/logout' && method === 'POST') {
        auth.logout();
        current = null; ctx = null;
        return { status: 200, data: { ok: true } };
      }
      if (path === '/api/auth/me' && method === 'GET') {
        if (!current) return { status: 401, data: { error: 'Sin sesi\u00f3n' } };
        return { status: 200, data: { account: current } };
      }
    } catch (err) {
      if (err instanceof routesMod.ApiError) return { status: err.status, data: { error: err.message } };
      return { status: 400, data: { error: err.message } };
    }

    if (!current) return { status: 401, data: { error: 'Inicia sesi\u00f3n para jugar', authRequired: true } };
    const c = contextFor(current.id);
    const handler = c.routes[method + ' ' + path];
    if (!handler) return { status: 404, data: { error: 'Endpoint no encontrado: ' + method + ' ' + path } };
    try {
      return { status: 200, data: handler(body) };
    } catch (err) {
      if (err instanceof routesMod.ApiError) return { status: err.status, data: { error: err.message } };
      return { status: 500, data: { error: 'Error interno: ' + err.message } };
    }
  }
};
`;

function build() {
  const entries = [];
  for (const rel of MODULES) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    entries.push('  ' + JSON.stringify(rel) + ': function (exports, require, module) {\n' + src + '\n}');
  }
  entries.push('  "fc-entry.js": function (exports, require, module) {\n' + ADAPTER + '\n}');

  const bundle = `/* FC Galaxy — bundle del motor para navegador (generado por tools/build-browser.js).
   Incluye el motor de juego, la SIMCHAIN (blockchain simulada) y las rutas de la API.
   La persistencia se realiza en localStorage del navegador. NO editar a mano. */
(function () {
'use strict';
var REGISTRY = {
${entries.join(',\n')}
};
var CACHE = {};
function resolveKey(from, req) {
  if (req.charAt(0) !== '.') return null;
  var dir = from.indexOf('/') === -1 ? '' : from.slice(0, from.lastIndexOf('/'));
  var parts = (dir + '/' + req).split('/');
  var out = [];
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i];
    if (p === '' || p === '.') continue;
    if (p === '..') out.pop(); else out.push(p);
  }
  var key = out.join('/');
  return key.slice(-3) === '.js' ? key.slice(0, -3) : key;
}
function mkRequire(from) {
  return function (req) {
    var key = resolveKey(from, req);
    if (key === null || !REGISTRY[key + '.js']) {
      throw new Error("Cannot find module '" + req + "'");
    }
    key = key + '.js';
    if (CACHE[key]) return CACHE[key].exports;
    var mod = { exports: {} };
    CACHE[key] = mod;
    REGISTRY[key](mod.exports, mkRequire(key), mod);
    return mod.exports;
  };
}
var FC_ENTRY = mkRequire('')('./fc-entry.js');
if (typeof window !== 'undefined') window.FC_LOCAL = FC_ENTRY;
})();
`;

  const out = path.join(ROOT, 'public', 'js', 'engine-bundle.js');
  fs.writeFileSync(out, bundle);
  console.log('Bundle generado:', out, '(' + Math.round(bundle.length / 1024) + ' KB,', MODULES.length + ' módulos + adaptador)');
}

build();
