'use strict';

/* Store para el modo navegador: misma interfaz que server/store.js pero con localStorage. */

const KEY = 'fc-galaxy-save-v1';

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

function save(state) {
  storage().setItem(KEY, JSON.stringify(state));
}

function load() {
  const raw = storage().getItem(KEY);
  if (!raw) return null;
  try {
    const state = JSON.parse(raw);
    if (state.rng && state.rng._rngState !== undefined) {
      const { Rng } = require('./engine/rng');
      state.rng = Rng.fromJSON(state.rng);
    }
    return state;
  } catch (err) {
    return null;
  }
}

function exists() {
  return storage().getItem(KEY) != null;
}

function clear() {
  storage().removeItem(KEY);
}

module.exports = { save, load, exists, clear };
