'use strict';

const fs = require('fs');
const path = require('path');
const { Rng } = require('./engine/rng');
const game = require('./engine/game');

const DATA_DIR = path.join(__dirname, 'data');
const SAVES_DIR = path.join(DATA_DIR, 'saves');

function createFileStore(filePath) {
  function save(state) {
    if (!fs.existsSync(SAVES_DIR)) fs.mkdirSync(SAVES_DIR, { recursive: true });
    const tmp = filePath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(state));
    fs.renameSync(tmp, filePath);
  }
  function load() {
    if (!fs.existsSync(filePath)) return null;
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const state = JSON.parse(raw);
      if (state.rng && state.rng._rngState !== undefined) {
        state.rng = Rng.fromJSON(state.rng);
      } else if (!state.rng) {
        state.rng = new Rng(state.rngSeed || Date.now());
      }
      return game.migrate(state);
    } catch (err) {
      console.error('[store] Error cargando partida:', err.message);
      return null;
    }
  }
  function exists() { return fs.existsSync(filePath); }
  function clear() { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); }
  return { save, load, exists, clear };
}

function storeForAccount(accountId) {
  const safe = String(accountId).replace(/[^a-zA-Z0-9_-]/g, '');
  return createFileStore(path.join(SAVES_DIR, safe + '.json'));
}

const SAVE_FILE = process.env.FC_GALAXY_SAVE || path.join(SAVES_DIR, 'guest.json');
const defaultStore = createFileStore(SAVE_FILE);

module.exports = { createFileStore, storeForAccount, save: defaultStore.save, load: defaultStore.load, exists: defaultStore.exists, clear: defaultStore.clear, SAVE_FILE, DATA_DIR };
