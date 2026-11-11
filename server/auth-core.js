'use strict';

/* Núcleo de cuentas, independiente del almacenamiento y del entorno.
   El hash se inyecta (scrypt en Node, SHA-256+salt en navegador) para que la
   misma lógica sirva al servidor y al modo navegador. El campo `provider`
   deja la costura para añadir 'google' (OAuth) sin tocar el resto del juego:
   bastaría con crear la cuenta con provider:'google' desde el callback OAuth. */

const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,20}$/;

function validateUsername(username) {
  const u = String(username || '').trim();
  if (!USERNAME_RE.test(u)) throw new Error('Usuario inválido: 3-20 caracteres (letras, números, . _ -)');
  return u.toLowerCase();
}

function validatePassword(password) {
  const p = String(password || '');
  if (p.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres');
  if (p.length > 128) throw new Error('Contraseña demasiado larga');
  return p;
}

function hashPassword(password, salt, hashFn) {
  return hashFn(salt + ':' + password);
}

function verifyPassword(password, salt, expectedHash, hashFn) {
  const h = hashPassword(password, salt, hashFn);
  if (h.length !== expectedHash.length) return false;
  let diff = 0;
  for (let i = 0; i < h.length; i++) diff |= h.charCodeAt(i) ^ expectedHash.charCodeAt(i);
  return diff === 0;
}

function newAccount(id, username, password, hashFn, provider) {
  const salt = id + '-' + Math.floor(Math.random() * 0xffffffff).toString(36);
  return {
    id,
    username,
    provider: provider || 'local',
    salt,
    hash: hashPassword(password, salt, hashFn),
    createdAt: Date.now()
  };
}

module.exports = { validateUsername, validatePassword, hashPassword, verifyPassword, newAccount, USERNAME_RE };
