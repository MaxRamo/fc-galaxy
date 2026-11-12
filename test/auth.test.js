'use strict';

/* Cuentas: núcleo compartido + almacenamiento de cuentas del servidor */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const core = require('../server/auth-core');
const { createAuth } = require('../server/auth');

const scryptHash = (input) => crypto.scryptSync(input, 'fcg-peer', 32).toString('hex');
const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'fcg-auth-'));

test('auth-core: validación de usuario, contraseña y hash', () => {
  assert.strictEqual(core.validateUsername(' Max_Ramo-9 '), 'max_ramo-9');
  assert.throws(() => core.validateUsername('a'), /Usuario inv/);
  assert.throws(() => core.validateUsername('mal usuario!'), /Usuario inv/);
  assert.throws(() => core.validatePassword('12345'), /al menos 6/);
  assert.throws(() => core.validatePassword('x'.repeat(129)), /larga/);

  const acc = core.newAccount('acc-1', 'max', 'secreta', scryptHash, 'local');
  assert.strictEqual(acc.provider, 'local');
  assert.ok(core.verifyPassword('secreta', acc.salt, acc.hash, scryptHash));
  assert.ok(!core.verifyPassword('incorrecta', acc.salt, acc.hash, scryptHash));
  const withProvider = core.newAccount('acc-2', 'g', 'secreta', scryptHash, 'google');
  assert.strictEqual(withProvider.provider, 'google', 'costura OAuth para integración futura');
});

test('auth servidor: registro, duplicados, login y sesiones', () => {
  const dir = tmpDir();
  const auth = createAuth(dir);

  const account = auth.register('jugador_uno', 'clave123', '¿En qué ciudad naciste?', 'madrid');
  assert.strictEqual(account.username, 'jugador_uno');
  assert.strictEqual(account.provider, 'local');

  const { token } = auth.login('jugador_uno', 'clave123');
  assert.ok(token.length >= 32);

  assert.throws(() => auth.register('jugador_uno', 'otra123'), /ya existe/);
  assert.throws(() => auth.login('jugador_uno', 'malclave'), /incorrectos/);
  assert.throws(() => auth.login('nadie', 'clave123'), /incorrectos/);

  const login = auth.login('JUGADOR_UNO', 'clave123');
  assert.strictEqual(login.account.id, account.id);
  assert.ok(auth.verify(login.token));
  assert.strictEqual(auth.verify(token).id, account.id, 'sesión anterior sigue válida');
  assert.strictEqual(auth.verify('token-inventado'), null);

  auth.logout(token);
  assert.strictEqual(auth.verify(token), null, 'logout invalida la sesión');

  const auth2 = createAuth(dir);
  assert.ok(auth2.verify(login.token), 'las sesiones persisten en disco');
  assert.throws(() => auth2.login('jugador_uno', 'malclave'), /incorrectos/, 'el hash persiste');
  fs.rmSync(dir, { recursive: true, force: true });
});
