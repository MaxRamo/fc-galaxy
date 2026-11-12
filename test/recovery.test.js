'use strict';

/* Recuperación de contraseña: pregunta de seguridad, restablecimiento,
   bloqueo por intentos fallidos y configuración para cuentas sin pregunta. */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const core = require('../server/auth-core');
const { createAuth } = require('../server/auth');

const scryptHash = (input) => crypto.scryptSync(input, 'fcg-peer', 32).toString('hex');
const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'fcg-recovery-'));

test('auth-core: normalización de respuesta y hash sin texto plano', () => {
  assert.strictEqual(core.normalizeAnswer('  Mi   RESPuesta  '), 'mi respuesta');
  assert.strictEqual(core.normalizeAnswer('MÁDRID'), 'madrid');
  assert.throws(() => core.validateRecoveryAnswer('x'), /al menos 2/);
  assert.throws(() => core.validateRecoveryQuestion('cort'), /entre 5 y 200/);
  assert.throws(() => core.validateRecoveryQuestion('x'.repeat(201)), /entre 5 y 200/);

  const acc = core.newAccount('acc-1', 'max', 'secreta', scryptHash, 'local');
  core.setRecovery(acc, '¿Cuál es el nombre de tu primera mascota?', '  REX  ', scryptHash);
  assert.ok(acc.recovery.aHash.length >= 32);
  assert.ok(!JSON.stringify(acc.recovery).includes('rex'), 'la respuesta nunca se guarda en claro');
  assert.ok(core.hasRecovery(acc));
  assert.ok(core.verifyRecoveryAnswer(acc, 'rex', scryptHash));
  assert.throws(() => core.verifyRecoveryAnswer(acc, 'gato', scryptHash), /incorrecta/);
  assert.throws(() => core.verifyRecoveryAnswer({ id: 'x' }, 'rex', scryptHash), /no tiene pregunta/);
});

test('auth servidor: pregunta, respuesta incorrecta y restablecimiento', () => {
  const dir = tmpDir();
  const auth = createAuth(dir);
  const acc = auth.register('jugador_uno', 'clave123', '¿En qué ciudad naciste?', '  MáDRID ');
  assert.strictEqual(auth.getRecoveryQuestion('JUGADOR_UNO'), '¿En qué ciudad naciste?');
  assert.throws(() => auth.getRecoveryQuestion('nadie'), /No hay pregunta/);

  assert.throws(() => auth.resetPassword('jugador_uno', 'barcelona', 'nueva123'), /incorrecta/);
  assert.throws(() => auth.login('jugador_uno', 'nueva123'), /incorrectos/, 'respuesta errónea no cambia nada');

  const r = auth.resetPassword('jugador_uno', 'madrid', 'nueva123');
  assert.strictEqual(r.account.id, acc.id);
  assert.ok(auth.verify(r.token), 'el restablecimiento abre sesión');
  assert.strictEqual(auth.login('jugador_uno', 'nueva123').account.id, acc.id);
  assert.throws(() => auth.login('jugador_uno', 'clave123'), /incorrectos/, 'la contraseña antigua ya no vale');

  assert.throws(() => auth.resetPassword('jugador_uno', 'madrid', 'corta'), /al menos 6/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('auth servidor: bloqueo temporal tras 5 respuestas fallidas', () => {
  const dir = tmpDir();
  const auth = createAuth(dir);
  auth.register('jugador_dos', 'clave123', '¿Cuál fue tu primer videojuego?', 'tetris');

  for (let i = 0; i < 5; i++) {
    assert.throws(() => auth.resetPassword('jugador_dos', 'pong', 'nueva123'), /incorrecta/);
  }
  assert.throws(
    () => auth.resetPassword('jugador_dos', 'tetris', 'nueva123'),
    /Demasiados intentos/,
    'incluso la respuesta correcta falla durante el bloqueo'
  );
  assert.throws(() => auth.login('jugador_dos', 'nueva123'), /incorrectos/, 'no se cambió la contraseña');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('auth servidor: cuenta legacy sin pregunta adopta recuperación', () => {
  const dir = tmpDir();
  const auth = createAuth(dir);
  const acc = auth.register('legacy', 'clave123', '¿Pregunta inicial?', 'inicial');

  const FILE = path.join(dir, 'accounts.json');
  const db = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  delete db.accounts.legacy.recovery;
  fs.writeFileSync(FILE, JSON.stringify(db));

  const auth2 = createAuth(dir);
  assert.throws(() => auth2.getRecoveryQuestion('legacy'), /No hay pregunta/);
  assert.throws(() => auth2.resetPassword('legacy', 'loquesea', 'nueva123'), /no tiene pregunta|No hay pregunta/);

  auth2.setRecoveryQuestion(acc.id, '¿Cómo se llama tu equipo favorito?', '  El GALAXY  ');
  assert.strictEqual(auth2.getRecoveryQuestion('legacy'), '¿Cómo se llama tu equipo favorito?');
  const r = auth2.resetPassword('legacy', 'el galaxy', 'nueva456');
  assert.ok(auth2.verify(r.token));
  fs.rmSync(dir, { recursive: true, force: true });
});
