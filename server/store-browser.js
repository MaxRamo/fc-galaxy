'use strict';

/* Store para el modo navegador: misma interfaz que server/store.js pero con
   localStorage. Cada cuenta tiene su clave de guardado; la partida antigua
   (clave \u00fanica) se adopta como partida de la primera cuenta que inicie sesi\u00f3n. */

const LEGACY_KEY = 'fc-galaxy-save-v1';
const KEY_PREFIX = 'fc-galaxy-save-';

function storage() {
  if (typeof localStorage === 'undefined') {
    const mem = {};
    return {
      getItem: k => (k in mem ? mem[k] : null),
      setItem: (k, v) => { mem[k] = String(v); },
      removeItem: k => { delete mem[k]; }
    };
  }
  return localStorage;
}

function keyFor(accountId) {
  const safe = String(accountId || 'guest').replace(/[^a-zA-Z0-9_-]/g, '');
  return KEY_PREFIX + safe;
}

function parseState(raw) {
  if (!raw) return null;
  try {
    const state = JSON.parse(raw);
    if (state.rng && state.rng._rngState !== undefined) {
      const { Rng } = require('./engine/rng');
      state.rng = Rng.fromJSON(state.rng);
    }
    const game = require('./engine/game');
    return game.migrate(state);
  } catch (err) {
    return null;
  }
}

function createBrowserStore(accountId) {
  const KEY = keyFor(accountId);
  return {
    save(state) { storage().setItem(KEY, JSON.stringify(state)); },
    load() { return parseState(storage().getItem(KEY)); },
    exists() { return storage().getItem(KEY) != null; },
    clear() { storage().removeItem(KEY); }
  };
}

/* Adopta la partida antigua de clave \u00fanica si la cuenta a\u00fan no tiene una. */
function adoptLegacy(accountId) {
  const store = createBrowserStore(accountId);
  const legacy = storage().getItem(LEGACY_KEY);
  if (store.exists() || !legacy) return false;
  storage().setItem(keyFor(accountId), legacy);
  storage().removeItem(LEGACY_KEY);
  return true;
}

const guest = createBrowserStore('guest');

module.exports = {
  createBrowserStore, adoptLegacy,
  save: guest.save, load: guest.load, exists: guest.exists, clear: guest.clear
};
