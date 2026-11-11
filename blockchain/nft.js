'use strict';

const { txHash } = require('./chain');

/**
 * Registro de activos digitales únicos (NFT) por jugador — SIMULACIÓN.
 * Equivalente a un contrato ERC-721: cada jugador tiene un tokenId único
 * y un propietario registrado en el libro de activos.
 */
function createAssetRegistry() {
  return { name: 'FCG Player Assets', standard: 'SIM-721', assets: {}, nextTokenId: 1 };
}

function mintAsset(registry, playerId, ownerAddress, meta) {
  const tokenId = registry.nextTokenId++;
  registry.assets[tokenId] = {
    tokenId,
    playerId,
    owner: ownerAddress,
    mintedAt: Date.now(),
    meta: meta || {},
    serial: 'FCG-' + String(tokenId).padStart(5, '0')
  };
  return {
    type: 'ASSET_MINT', standard: registry.standard, tokenId, playerId,
    to: ownerAddress, simulated: true,
    hash: txHash({ tokenId, playerId, to: ownerAddress, t: Date.now() })
  };
}

function ownerOf(registry, tokenId) {
  const a = registry.assets[tokenId];
  if (!a) throw new Error('Asset tokenId ' + tokenId + ' no existe');
  return a.owner;
}

function transferAsset(registry, tokenId, from, to, memo) {
  const a = registry.assets[tokenId];
  if (!a) throw new Error('Asset tokenId ' + tokenId + ' no existe');
  if (a.owner !== from) throw new Error(`El asset ${tokenId} no pertenece a ${from} (propietario: ${a.owner})`);
  a.owner = to;
  a.transfers = (a.transfers || 0) + 1;
  return {
    type: 'ASSET_TRANSFER', standard: registry.standard, tokenId, playerId: a.playerId,
    from, to, memo: memo || '', simulated: true,
    hash: txHash({ tokenId, from, to, memo, t: Date.now() })
  };
}

function assetsOfOwner(registry, ownerAddress) {
  return Object.values(registry.assets).filter(a => a.owner === ownerAddress);
}

module.exports = { createAssetRegistry, mintAsset, ownerOf, transferAsset, assetsOfOwner };
