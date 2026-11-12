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

/* ---------- Recuperación de contraseña ----------
   Sin email: pregunta de seguridad elegida por el usuario. La respuesta se
   guarda solo como hash con salt propio, normalizada para comparar. */

const RECOVERY_QUESTIONS = [
  '¿Cuál es el nombre de tu primera mascota?',
  '¿En qué ciudad naciste?',
  '¿Cuál es el nombre de tu mejor amigo/a de la infancia?',
  '¿Cuál fue tu primer videojuego?',
  '¿Cómo se llama tu equipo favorito?'
];

function normalizeAnswer(answer) {
  return String(answer || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function validateRecoveryQuestion(question) {
  const q = String(question || '').trim();
  if (q.length < 5 || q.length > 200) throw new Error('La pregunta de recuperación debe tener entre 5 y 200 caracteres');
  return q;
}

function validateRecoveryAnswer(answer) {
  const a = normalizeAnswer(answer);
  if (a.length < 2) throw new Error('La respuesta de recuperación debe tener al menos 2 caracteres');
  if (a.length > 100) throw new Error('Respuesta de recuperación demasiado larga');
  return a;
}

function setRecovery(acc, question, answer, hashFn) {
  const q = validateRecoveryQuestion(question);
  const a = validateRecoveryAnswer(answer);
  const aSalt = acc.id + '-r-' + Math.floor(Math.random() * 0xffffffff).toString(36);
  acc.recovery = {
    q,
    aSalt,
    aHash: hashPassword(a, aSalt, hashFn),
    fails: 0,
    lockedUntil: 0
  };
  return acc.recovery;
}

function hasRecovery(acc) {
  return !!(acc && acc.recovery && acc.recovery.q && acc.recovery.aHash);
}

function verifyRecoveryAnswer(acc, answer, hashFn) {
  if (!hasRecovery(acc)) throw new Error('Esta cuenta no tiene pregunta de recuperación configurada');
  const now = Date.now();
  if (acc.recovery.lockedUntil && acc.recovery.lockedUntil > now) {
    const mins = Math.ceil((acc.recovery.lockedUntil - now) / 60000);
    throw new Error('Demasiados intentos fallidos. Espera ' + mins + ' min y vuelve a intentarlo');
  }
  const a = validateRecoveryAnswer(answer);
  if (!verifyPassword(a, acc.recovery.aSalt, acc.recovery.aHash, hashFn)) {
    acc.recovery.fails = (acc.recovery.fails || 0) + 1;
    if (acc.recovery.fails >= 5) {
      acc.recovery.fails = 0;
      acc.recovery.lockedUntil = now + 5 * 60 * 1000;
    }
    throw new Error('Respuesta incorrecta');
  }
  acc.recovery.fails = 0;
  acc.recovery.lockedUntil = 0;
  return true;
}

module.exports = { validateUsername, validatePassword, hashPassword, verifyPassword, newAccount, USERNAME_RE, RECOVERY_QUESTIONS, normalizeAnswer, validateRecoveryQuestion, validateRecoveryAnswer, setRecovery, hasRecovery, verifyRecoveryAnswer };
