'use strict';

/* Cuentas para el modo navegador: misma lógica que server/auth.js pero
   persistiendo en localStorage. El hash usa SHA-256 + salt (scrypt no existe
   en el navegador). En este modo todo vive en el cliente: es adecuado para
   jugar, no para proteger secretos. */

const { sha256Hex } = require('../blockchain/sha256');
const core = require('./auth-core');

const ACC_KEY = 'fc-galaxy-accounts-v1';
const SESSION_KEY = 'fc-galaxy-session-v1';

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

function createBrowserAuth() {
  function loadDb() {
    try { return JSON.parse(storage().getItem(ACC_KEY) || '') || { accounts: {} }; }
    catch (e) { return { accounts: {} }; }
  }
  function saveDb(db) { storage().setItem(ACC_KEY, JSON.stringify(db)); }

  function publicAccount(acc) { return { id: acc.id, username: acc.username, provider: acc.provider }; }

  return {
    register(username, password, recoveryQuestion, recoveryAnswer) {
      const u = core.validateUsername(username);
      core.validatePassword(password);
      const db = loadDb();
      if (db.accounts[u]) throw new Error('Ese usuario ya existe');
      const id = 'acc-' + Math.floor(Math.random() * 0xffffffff).toString(36);
      const acc = core.newAccount(id, u, password, sha256Hex, 'local');
      core.setRecovery(acc, recoveryQuestion, recoveryAnswer, sha256Hex);
      db.accounts[u] = acc;
      saveDb(db);
      return db.accounts[u];
    },
    login(username, password) {
      const u = core.validateUsername(username);
      const acc = loadDb().accounts[u];
      if (!acc || !core.verifyPassword(password, acc.salt, acc.hash, sha256Hex)) {
        throw new Error('Usuario o contrase\u00f1a incorrectos');
      }
      const token = 'tok-' + Math.floor(Math.random() * 0xffffffff).toString(36) + Date.now().toString(36);
      storage().setItem(SESSION_KEY, JSON.stringify({ token, accountId: acc.id }));
      return { token, account: publicAccount(acc) };
    },
    verify(token) {
      const sess = storage().getItem(SESSION_KEY);
      if (!sess || !token) return null;
      try {
        const s = JSON.parse(sess);
        if (s.token !== token) return null;
        const acc = Object.values(loadDb().accounts).find(a => a.id === s.accountId);
        return acc ? publicAccount(acc) : null;
      } catch (e) { return null; }
    },
    currentSession() {
      const sess = storage().getItem(SESSION_KEY);
      if (!sess) return null;
      try {
        const s = JSON.parse(sess);
        const acc = Object.values(loadDb().accounts).find(a => a.id === s.accountId);
        return acc ? publicAccount(acc) : null;
      } catch (e) { return null; }
    },
    logout() { storage().removeItem(SESSION_KEY); },

    getRecoveryQuestion(username) {
      const u = core.validateUsername(username);
      const acc = loadDb().accounts[u];
      if (!acc || !core.hasRecovery(acc)) {
        throw new Error('No hay pregunta de recuperación para ese usuario');
      }
      return acc.recovery.q;
    },

    resetPassword(username, answer, newPassword) {
      const u = core.validateUsername(username);
      core.validatePassword(newPassword);
      const db = loadDb();
      const acc = db.accounts[u];
      if (!acc) throw new Error('No hay pregunta de recuperación para ese usuario');
      core.verifyRecoveryAnswer(acc, answer, sha256Hex);
      acc.hash = core.hashPassword(newPassword, acc.salt, sha256Hex);
      saveDb(db);
      const token = 'tok-' + Math.floor(Math.random() * 0xffffffff).toString(36) + Date.now().toString(36);
      storage().setItem(SESSION_KEY, JSON.stringify({ token, accountId: acc.id }));
      return { token, account: publicAccount(acc) };
    },

    setRecoveryQuestion(accountId, question, answer) {
      const db = loadDb();
      const acc = Object.values(db.accounts).find(a => a.id === accountId);
      if (!acc) throw new Error('Cuenta no encontrada');
      core.setRecovery(acc, question, answer, sha256Hex);
      saveDb(db);
      return { ok: true };
    }
  };
}

module.exports = { createBrowserAuth };
