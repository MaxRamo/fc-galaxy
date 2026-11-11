'use strict';

const { txHash } = require('./chain');

/**
 * Ledger de token FCG (FC Galaxy Coin) — SIMULACIÓN.
 * Los saldos viven en un libro contable interno; en producción esto sería
 * un contrato ERC-20 desplegado en una blockchain real.
 */
function createTokenLedger() {
  return { symbol: 'FCG', decimals: 0, balances: {}, totalSupply: 0 };
}

function mint(ledger, address, amount, memo) {
  if (amount <= 0) throw new Error('Cantidad de mint inválida');
  ledger.balances[address] = (ledger.balances[address] || 0) + amount;
  ledger.totalSupply += amount;
  return {
    type: 'TOKEN_MINT', symbol: ledger.symbol, to: address, amount,
    memo: memo || '', simulated: true, hash: txHash({ to: address, amount, memo, t: Date.now() })
  };
}

function transfer(ledger, from, to, amount, memo) {
  const bal = ledger.balances[from] || 0;
  if (amount <= 0) throw new Error('Cantidad de transferencia inválida');
  if (bal < amount) throw new Error(`Saldo FCG insuficiente en ${from}: tiene ${bal}, requiere ${amount}`);
  ledger.balances[from] = bal - amount;
  ledger.balances[to] = (ledger.balances[to] || 0) + amount;
  return {
    type: 'TOKEN_TRANSFER', symbol: ledger.symbol, from, to, amount,
    memo: memo || '', simulated: true, hash: txHash({ from, to, amount, memo, t: Date.now() })
  };
}

function burn(ledger, from, amount, memo) {
  const bal = ledger.balances[from] || 0;
  if (bal < amount) throw new Error(`Saldo FCG insuficiente para quemar en ${from}`);
  ledger.balances[from] = bal - amount;
  ledger.totalSupply -= amount;
  return {
    type: 'TOKEN_BURN', symbol: ledger.symbol, from, amount,
    memo: memo || '', simulated: true, hash: txHash({ from, amount, memo, t: Date.now() })
  };
}

function balanceOf(ledger, address) {
  return ledger.balances[address] || 0;
}

module.exports = { createTokenLedger, mint, transfer, burn, balanceOf };
