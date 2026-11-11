'use strict';

const crypto = require('crypto');

function txHash(tx) {
  return crypto.createHash('sha256').update(JSON.stringify(tx)).digest('hex');
}

function hashBlock(block) {
  const { index, timestamp, prevHash, transactions } = block;
  return crypto.createHash('sha256')
    .update(index + '|' + timestamp + '|' + prevHash + '|' + JSON.stringify(transactions))
    .digest('hex');
}

function createChain() {
  const genesis = {
    index: 0,
    timestamp: Date.now(),
    prevHash: '0'.repeat(64),
    transactions: [{ type: 'GENESIS', note: 'FC Galaxy SIMCHAIN - cadena simulada, no es una blockchain real' }]
  };
  genesis.hash = hashBlock(genesis);
  return [genesis];
}

function addBlock(chain, transactions) {
  const prev = chain[chain.length - 1];
  const block = {
    index: prev.index + 1,
    timestamp: Date.now(),
    prevHash: prev.hash,
    transactions
  };
  block.hash = hashBlock(block);
  chain.push(block);
  return block;
}

function validateChain(chain) {
  for (let i = 1; i < chain.length; i++) {
    const b = chain[i];
    if (b.prevHash !== chain[i - 1].hash) return { valid: false, reason: 'prevHash mismatch en bloque ' + i };
    if (b.hash !== hashBlock(b)) return { valid: false, reason: 'hash inválido en bloque ' + i };
  }
  return { valid: true, blocks: chain.length };
}

module.exports = { createChain, addBlock, hashBlock, validateChain, txHash };
