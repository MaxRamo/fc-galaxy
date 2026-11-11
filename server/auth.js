'use strict';

/* Cuentas y sesiones persistentes para el modo servidor (Node).
   Contraseñas con scrypt + salt aleatorio; sesiones por token en el mismo
   archivo. Cada cuenta tiene su partida en data/saves/<accountId>.json. */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const core = require('./auth-core');

function createAuth(dataDir) {
  const FILE = path.join(dataDir, 'accounts.json');
  let db = { accounts: {}, sessions: {} };

  function loadDb() {
    if (!fs.existsSync(FILE)) return;
    try { db = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) { db = { accounts: {}, sessions: {} }; }
  }
  function saveDb() {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    const tmp = FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, FILE);
  }
  function hashFn(input) {
    return crypto.scryptSync(input, 'fc-galaxy', 32).toString('hex');
  }

  loadDb();

  return {
    register(username, password) {
      const u = core.validateUsername(username);
      core.validatePassword(password);
      if (db.accounts[u]) throw new Error('Ese usuario ya existe');
      const id = 'acc-' + crypto.randomBytes(6).toString('hex');
      db.accounts[u] = core.newAccount(id, u, password, hashFn, 'local');
      saveDb();
      return db.accounts[u];
    },

    login(username, password) {
      const u = core.validateUsername(username);
      const acc = db.accounts[u];
      if (!acc || !core.verifyPassword(password, acc.salt, acc.hash, hashFn)) {
        throw new Error('Usuario o contraseña incorrectos');
      }
      const token = crypto.randomBytes(32).toString('hex');
      db.sessions[token] = { accountId: acc.id, username: u, createdAt: Date.now() };
      if (Object.keys(db.sessions).length > 500) {
        const cutoff = Date.now() - 30 * 24 * 3600 * 1000;
        for (const [t, s] of Object.entries(db.sessions)) {
          if (s.createdAt < cutoff) delete db.sessions[t];
        }
      }
      saveDb();
      return { token, account: { id: acc.id, username: acc.username, provider: acc.provider } };
    },

    verify(token) {
      if (!token) return null;
      const s = db.sessions[token];
      if (!s) return null;
      const acc = Object.values(db.accounts).find(a => a.id === s.accountId);
      return acc ? { id: acc.id, username: acc.username, provider: acc.provider } : null;
    },

    logout(token) {
      if (token && db.sessions[token]) { delete db.sessions[token]; saveDb(); }
    }
  };
}

module.exports = { createAuth };
