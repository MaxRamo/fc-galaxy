'use strict';

/**
 * Contrato inteligente SIMULADO de transferencias de jugadores.
 * Regula propiedad y pago de forma atómica, como haría un contrato real
 * desplegado en una blockchain. Todas las operaciones son simuladas y
 * se registran como transacciones en la SIMCHAIN interna.
 *
 * Reglas del contrato:
 *  1. El vendedor debe ser el propietario registrado del asset (NFT) del jugador.
 *  2. El comprador debe tener saldo FCG suficiente (precio + comisión).
 *  3. La transferencia es atómica: pago y cambio de propiedad en la misma transacción.
 *  4. Comisión de mercado del 4% quemada (retirada de circulación) como mecanismo deflacionario.
 */

const MARKET_FEE_PCT = 0.04;

function simulateTransfer(ctx, params) {
  const { chain, addBlock, token, nft } = ctx;
  const { tokenId, from, to, price, playerId, memo } = params;

  if (price <= 0) throw new Error('Precio de transferencia inválido');
  const owner = nft.assets[tokenId] ? nft.assets[tokenId].owner : null;
  if (owner !== from) throw new Error('CONTRACT_REVERT: el vendedor no es el propietario registrado del asset');
  const buyerBalance = token.balances[to] || 0;
  const fee = Math.round(price * MARKET_FEE_PCT);
  if (buyerBalance < price + fee) {
    throw new Error(`CONTRACT_REVERT: saldo insuficiente. Requiere ${price + fee} FCG (precio ${price} + comisión ${fee}), disponible ${buyerBalance}`);
  }

  const txs = [];

  const payTx = {
    type: 'CONTRACT_CALL',
    contract: 'PlayerTransferContract',
    method: 'purchasePlayer',
    params: { tokenId, playerId, from, to, price, fee },
    simulated: true
  };

  token.balances[to] = buyerBalance - price - fee;
  token.balances[from] = (token.balances[from] || 0) + price;
  token.totalSupply -= fee;
  txs.push({ ...payTx, tokenOps: [
    { op: 'DEBIT', account: to, amount: price + fee },
    { op: 'CREDIT', account: from, amount: price },
    { op: 'BURN', account: null, amount: fee }
  ] });

  nft.assets[tokenId].owner = to;
  nft.assets[tokenId].transfers = (nft.assets[tokenId].transfers || 0) + 1;
  txs.push({
    type: 'ASSET_TRANSFER', standard: nft.standard, tokenId, playerId,
    from, to, memo: memo || 'Transferencia de jugador via PlayerTransferContract', simulated: true
  });

  const block = addBlock(chain, txs);
  return {
    status: 'SUCCESS',
    txHash: txs[0].hash || block.hash,
    blockIndex: block.index,
    blockHash: block.hash,
    price, fee, buyer: to, seller: from, tokenId, playerId,
    simulated: true,
    note: 'Transacción simulada por SIMCHAIN — no es una blockchain real'
  };
}

module.exports = { simulateTransfer, MARKET_FEE_PCT };
