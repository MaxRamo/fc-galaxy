'use strict';

const test = require('node:test');
const assert = require('node:assert');
const chain = require('../blockchain/chain');
const token = require('../blockchain/token');
const nft = require('../blockchain/nft');
const contract = require('../blockchain/contract');

test('cadena: genesis + bloques encadenados y validaci\u00f3n', () => {
  const c = chain.createChain();
  assert.strictEqual(c.length, 1);
  const b1 = chain.addBlock(c, [{ type: 'MINT', amount: 1000 }]);
  const b2 = chain.addBlock(c, [{ type: 'BURN', amount: 40 }]);
  assert.strictEqual(b1.index, 1);
  assert.strictEqual(b2.prevHash, b1.hash);
  const v = chain.validateChain(c);
  assert.strictEqual(v.valid, true);
  assert.strictEqual(v.blocks, 3);
});

test('cadena: manipulaci\u00f3n detectada por validateChain', () => {
  const c = chain.createChain();
  chain.addBlock(c, [{ type: 'MINT', amount: 1000 }]);
  c[1].transactions[0].amount = 999999;
  const v = chain.validateChain(c);
  assert.strictEqual(v.valid, false);
  assert.match(v.reason, /hash/);
});

test('token: mint, transfer y burn con validaci\u00f3n de saldo', () => {
  const t = token.createTokenLedger('FCG');
  token.mint(t, '0xA', 1000);
  token.mint(t, '0xB', 500);
  token.transfer(t, '0xA', '0xB', 400);
  assert.strictEqual(token.balanceOf(t, '0xA'), 600);
  assert.strictEqual(token.balanceOf(t, '0xB'), 900);
  token.burn(t, '0xB', 100);
  assert.strictEqual(token.balanceOf(t, '0xB'), 800);
  assert.strictEqual(t.totalSupply, 1400);
  assert.throws(() => token.transfer(t, '0xA', '0xB', 99999), /saldo/i);
  assert.throws(() => token.burn(t, '0xA', 99999), /saldo/i);
});

test('NFT: mint, propiedad y transferencia validada', () => {
  const reg = nft.createAssetRegistry();
  const mintTx = nft.mintAsset(reg, 'p1', '0xA', { name: 'X' });
  const tid = mintTx.tokenId;
  assert.strictEqual(mintTx.simulated, true);
  assert.match(reg.assets[tid].serial, /FCG-/);
  assert.strictEqual(nft.ownerOf(reg, tid), '0xA');
  nft.transferAsset(reg, tid, '0xA', '0xB');
  assert.strictEqual(nft.ownerOf(reg, tid), '0xB');
  assert.throws(() => nft.transferAsset(reg, tid, '0xA', '0xC'), /no pertenece/i);
  assert.strictEqual(nft.assetsOfOwner(reg, '0xB').length, 1);
});

test('contrato simulado: transferencia at\u00f3mica con comisi\u00f3n quemada', () => {
  const c = chain.createChain();
  const t = token.createTokenLedger('FCG');
  const reg = nft.createAssetRegistry();
  token.mint(t, '0xSELLER', 100);
  token.mint(t, '0xBUYER', 1000000);
  const mintTx = nft.mintAsset(reg, 'p9', '0xSELLER', { name: 'Crack' });

  const receipt = contract.simulateTransfer(
    { chain: c, addBlock: chain.addBlock, token: t, nft: reg },
    { tokenId: mintTx.tokenId, from: '0xSELLER', to: '0xBUYER', price: 500000, playerId: 'p9', memo: 'test' }
  );
  assert.strictEqual(receipt.status, 'SUCCESS');
  assert.strictEqual(receipt.simulated, true);
  assert.strictEqual(receipt.fee, 20000);
  assert.strictEqual(token.balanceOf(t, '0xSELLER'), 500100);
  assert.strictEqual(token.balanceOf(t, '0xBUYER'), 480000);
  assert.strictEqual(nft.ownerOf(reg, mintTx.tokenId), '0xBUYER');
  assert.strictEqual(c.length, 2);
  const blockTxs = c[1].transactions;
  assert.strictEqual(blockTxs[0].type, 'CONTRACT_CALL');
  assert.strictEqual(blockTxs[0].simulated, true, 'marcada como simulada');
  assert.ok(blockTxs[0].tokenOps.some(op => op.op === 'BURN'), 'la comisi\u00f3n se registra como quemado');
  assert.strictEqual(blockTxs[1].type, 'ASSET_TRANSFER');
});

test('contrato simulado: revierte si el comprador no tiene fondos (estado intacto)', () => {
  const c = chain.createChain();
  const t = token.createTokenLedger('FCG');
  const reg = nft.createAssetRegistry();
  token.mint(t, '0xSELLER', 100);
  token.mint(t, '0xBUYER', 100);
  const mintTx = nft.mintAsset(reg, 'p9', '0xSELLER', {});

  assert.throws(() => contract.simulateTransfer(
    { chain: c, addBlock: chain.addBlock, token: t, nft: reg },
    { tokenId: mintTx.tokenId, from: '0xSELLER', to: '0xBUYER', price: 500000, playerId: 'p9' }
  ), /saldo|fondos/i);
  assert.strictEqual(nft.ownerOf(reg, mintTx.tokenId), '0xSELLER');
  assert.strictEqual(token.balanceOf(t, '0xSELLER'), 100);
  assert.strictEqual(c.length, 1, 'no debe a\u00f1adir bloque si la transferencia revierte');
});

test('contrato simulado: revierte si el vendedor no es el propietario del NFT', () => {
  const c = chain.createChain();
  const t = token.createTokenLedger('FCG');
  const reg = nft.createAssetRegistry();
  token.mint(t, '0xSELLER', 1000000);
  token.mint(t, '0xBUYER', 1000000);
  const mintTx = nft.mintAsset(reg, 'p9', '0xOTHER', {});
  assert.throws(() => contract.simulateTransfer(
    { chain: c, addBlock: chain.addBlock, token: t, nft: reg },
    { tokenId: mintTx.tokenId, from: '0xSELLER', to: '0xBUYER', price: 1000, playerId: 'p9' }
  ), /propietario/i);
  assert.strictEqual(c.length, 1);
});
