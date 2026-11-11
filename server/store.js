'use strict';

const fs = require('fs');
const path = require('path');
const { Rng } = require('./engine/rng');

const DATA_DIR = path.join(__dirname, 'data');
const SAVE_FILE = process.env.FC_GALAXY_SAVE || path.join(DATA_DIR, 'save.json');

function save(state) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = SAVE_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state));
  fs.renameSync(tmp, SAVE_FILE);
}

function load() {
  if (!fs.existsSync(SAVE_FILE)) return null;
  try {
    const raw = fs.readFileSync(SAVE_FILE, 'utf8');
    const state = JSON.parse(raw);
    if (state.rng && state.rng._rngState !== undefined) {
      state.rng = Rng.fromJSON(state.rng);
    } else if (!state.rng) {
      state.rng = new Rng(state.rngSeed || Date.now());
    }
    return state;
  } catch (err) {
    console.error('[store] Error cargando partida:', err.message);
    return null;
  }
}

function exists() {
  return fs.existsSync(SAVE_FILE);
}

function clear() {
  if (fs.existsSync(SAVE_FILE)) fs.unlinkSync(SAVE_FILE);
}

module.exports = { save, load, exists, clear, SAVE_FILE };
