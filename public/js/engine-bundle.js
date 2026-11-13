/* FC Galaxy — bundle del motor para navegador (generado por tools/build-browser.js).
   Incluye el motor de juego, la SIMCHAIN (blockchain simulada) y las rutas de la API.
   La persistencia se realiza en localStorage del navegador. NO editar a mano. */
(function () {
'use strict';
var REGISTRY = {
  "blockchain/sha256.js": function (exports, require, module) {
'use strict';

/* Implementaci\u00f3n pura de SHA-256 (hex) para entornos sin m\u00f3dulo crypto (navegador). */

const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
];

function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }

function sha256Hex(str) {
  const utf8 = unescape(encodeURIComponent(str));
  const len = utf8.length;
  const words = [];
  for (let i = 0; i < len; i++) words[i >> 2] = (words[i >> 2] || 0) | (utf8.charCodeAt(i) << (24 - (i % 4) * 8));
  words[len >> 2] = (words[len >> 2] || 0) | (0x80 << (24 - (len % 4) * 8));
  const bitLen = len * 8;
  const total = (((len + 8) >> 6) + 1) * 16;
  words[total - 1] = bitLen;
  words[total - 2] = Math.floor(bitLen / 0x100000000);

  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
  const w = new Array(64);

  for (let i = 0; i < total; i += 16) {
    for (let j = 0; j < 16; j++) w[j] = words[i + j] || 0;
    for (let j = 16; j < 64; j++) {
      const s0 = rotr(w[j - 15], 7) ^ rotr(w[j - 15], 18) ^ (w[j - 15] >>> 3);
      const s1 = rotr(w[j - 2], 17) ^ rotr(w[j - 2], 19) ^ (w[j - 2] >>> 10);
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let j = 0; j < 64; j++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[j] + w[j]) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0;
      d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map(x => ('00000000' + ((x >>> 0).toString(16))).slice(-8))
    .join('');
}

module.exports = { sha256Hex };

},
  "blockchain/chain.js": function (exports, require, module) {
'use strict';

const { sha256Hex } = require('./sha256');

let crypto = null;
try { crypto = require('crypto'); } catch (e) { /* navegador: se usa SHA-256 puro */ }

function hashStr(s) {
  return crypto ? crypto.createHash('sha256').update(s).digest('hex') : sha256Hex(s);
}

function txHash(tx) {
  return hashStr(JSON.stringify(tx));
}

function hashBlock(block) {
  const { index, timestamp, prevHash, transactions } = block;
  return hashStr(index + '|' + timestamp + '|' + prevHash + '|' + JSON.stringify(transactions));
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

},
  "blockchain/token.js": function (exports, require, module) {
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

},
  "blockchain/nft.js": function (exports, require, module) {
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

},
  "blockchain/contract.js": function (exports, require, module) {
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

},
  "server/engine/rng.js": function (exports, require, module) {
'use strict';

class Rng {
  constructor(seed) {
    this.seed = seed != null ? seed >>> 0 : (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
    this._a = this.seed;
  }

  float() {
    let a = (this._a = (this._a + 0x6D2B79F5) | 0);
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(min, max) { return min + this.float() * (max - min); }
  int(min, max) { return Math.floor(this.range(min, max + 1)); }
  chance(p) { return this.float() < p; }
  pick(arr) { return arr[Math.floor(this.float() * arr.length)]; }
  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.float() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  gauss(mean, sd) {
    let u = 0, v = 0;
    while (u === 0) u = this.float();
    while (v === 0) v = this.float();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  id(prefix) {
    return prefix + '-' + Math.floor(this.float() * 0xffffffff).toString(36) + Math.floor(this.float() * 0xffff).toString(36);
  }
  toJSON() { return { _rngState: this._a, seed: this.seed }; }
  static fromJSON(data) {
    const r = new Rng(data.seed);
    if (data && typeof data._rngState === 'number') r._a = data._rngState;
    return r;
  }
}

module.exports = { Rng };

},
  "server/engine/names.js": function (exports, require, module) {
'use strict';

const COUNTRIES = [
  {
    code: 'es', name: 'España', flag: '🇪🇸',
    first: ['Alejandro', 'Mateo', 'Diego', 'Lucas', 'Hugo', 'Pablo', 'Martín', 'Daniel', 'Sergio', 'Álvaro', 'Adrián', 'Javier', 'Iker', 'Unai', 'Gonzalo', 'Rodrigo'],
    last: ['García', 'Martínez', 'López', 'Sánchez', 'Pérez', 'Gómez', 'Fernández', 'Ruiz', 'Díaz', 'Moreno', 'Álvarez', 'Romero', 'Navarro', 'Torres', 'Ramos', 'Iglesias']
  },
  {
    code: 'ar', name: 'Argentina', flag: '🇦🇷',
    first: ['Lautaro', 'Julián', 'Enzo', 'Nicolás', 'Facundo', 'Thiago', 'Valentín', 'Emiliano', 'Cristian', 'Matías', 'Franco', 'Agustín', 'Joaquín', 'Bruno', 'Santiago', 'Gonzalo'],
    last: ['Fernández', 'Rodríguez', 'González', 'Álvarez', 'Romero', 'Martínez', 'Paredes', 'Molina', 'Correa', 'Domínguez', 'Palacios', 'Mac Allister', 'Lo Celso', 'Pezzella', 'Ocampos', 'Garnacho']
  },
  {
    code: 'br', name: 'Brasil', flag: '🇧🇷',
    first: ['João', 'Pedro', 'Gabriel', 'Lucas', 'Matheus', 'Rafael', 'Vinícius', 'Rodrygo', 'Éder', 'Bruno', 'Caio', 'Everton', 'Wesley', 'Danilo', 'Igor', 'Murilo'],
    last: ['Silva', 'Santos', 'Oliveira', 'Souza', 'Pereira', 'Costa', 'Almeida', 'Ferreira', 'Ribeiro', 'Barbosa', 'Cardoso', 'Gomes', 'Martins', 'Rocha', 'Nunes', 'Lima']
  },
  {
    code: 'en', name: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    first: ['Harry', 'Jack', 'Jude', 'Bukayo', 'Declan', 'Marcus', 'Phil', 'Ollie', 'Reece', 'Trent', 'Callum', 'Mason', 'Jarrod', 'Dominic', 'Cole', 'Levi'],
    last: ['Smith', 'Jones', 'Walker', 'Foden', 'Rice', 'Kane', 'Sterling', 'Grealish', 'Watkins', 'Trippier', 'Alexander-Arnold', 'Maddison', 'Bowen', 'Wilson', 'Palmer', 'Colwill']
  },
  {
    code: 'fr', name: 'Francia', flag: '🇫🇷',
    first: ['Kylian', 'Antoine', 'Ousmane', 'Aurélien', 'Jules', 'Théo', 'Randal', 'Christopher', 'Warren', 'Eduardo', 'Youssouf', 'Lucas', 'Benjamin', 'Manu', 'Adrien', 'Loïc'],
    last: ['Dubois', 'Lefèvre', 'Moreau', 'Girard', 'Kolo Muani', 'Dembélé', 'Camavinga', 'Konaté', 'Upamecano', 'Zaïre-Emery', 'Fofana', 'Hernández', 'Pavard', 'Rabiot', 'Thuram', 'Nkunku']
  },
  {
    code: 'de', name: 'Alemania', flag: '🇩🇪',
    first: ['Jamal', 'Florian', 'Kai', 'Joshua', 'Leon', 'Serge', 'Niklas', 'Robin', 'Maximilian', 'Felix', 'Lukas', 'Jonas', 'Tim', 'Marvin', 'Nico', 'Elias'],
    last: ['Müller', 'Schmidt', 'Wirtz', 'Havertz', 'Kimmich', 'Goretzka', 'Süle', 'Gosens', 'Mittelstädt', 'Nmecha', 'Klain', 'Hofmann', 'Kleindienst', 'Wolf', 'Schlotterbeck', 'Grimaldo']
  },
  {
    code: 'it', name: 'Italia', flag: '🇮🇹',
    first: ['Nicolò', 'Federico', 'Lorenzo', 'Giacomo', 'Davide', 'Alessandro', 'Matteo', 'Riccardo', 'Gianluca', 'Samuele', 'Andrea', 'Marco', 'Simone', 'Tommaso', 'Michele', 'Cristian'],
    last: ['Rossi', 'Ferrari', 'Bianchi', 'Barella', 'Chiesa', 'Pellegrini', 'Frattesi', 'Scamacca', 'Zaniolo', 'Bastoni', 'Cambiaso', 'Retegui', 'Ricci', 'Baldanzi', 'Colombo', 'Gatti']
  },
  {
    code: 'pt', name: 'Portugal', flag: '🇵🇹',
    first: ['João', 'Diogo', 'Rúben', 'Gonçalo', 'Bernardo', 'Rafael', 'Pedro', 'Nuno', 'Vitinha', 'Fábio', 'Otávio', 'Tiago', 'Ricardo', 'André', 'Daniel', 'Francisco'],
    last: ['Silva', 'Fernandes', 'Neves', 'Ramos', 'Dias', 'Leão', 'Dalot', 'Trincão', 'Conceição', 'Semedo', 'Moutinho', 'Palhinha', 'Veiga', 'Inácio', 'Todibo', 'Costa']
  },
  {
    code: 'nl', name: 'Países Bajos', flag: '🇳🇱',
    first: ['Cody', 'Virgil', 'Frenkie', 'Memphis', 'Xavi', 'Ryan', 'Jurriën', 'Denzel', 'Steven', 'Teun', 'Micky', 'Donyell', 'Quinten', 'Brian', 'Joshua', 'Lutsharel'],
    last: ['Gakpo', 'Van Dijk', 'De Jong', 'Depay', 'Simons', 'Gravenberch', 'Timber', 'Dumfries', 'Bergwijn', 'Koopmeiners', 'Van de Ven', 'Malen', 'Brobbey', 'Zirkzee', 'Geertruida', 'Weghorst']
  },
  {
    code: 'uy', name: 'Uruguay', flag: '🇺🇾',
    first: ['Federico', 'Darwin', 'Facundo', 'Manuel', 'Nicolás', 'Rodrigo', 'Brian', 'Maxi', 'Agustín', 'Emiliano', 'Sebastián', 'Mathías', 'Diego', 'Santiago', 'Cristian', 'Ignacio'],
    last: ['Valverde', 'Núñez', 'Pellistri', 'Ugarte', 'De la Cruz', 'Bentancur', 'Araújo', 'Olivera', 'Sánchez', 'Canobbio', 'Gómez', 'Cáceres', 'Rodríguez', 'Viña', 'Rossi', 'Bueno']
  },
  {
    code: 'mx', name: 'México', flag: '🇲🇽',
    first: ['Santiago', 'Hirving', 'Alexis', 'Edson', 'César', 'Luis', 'Diego', 'Roberto', 'Julián', 'Uriel', 'Jesús', 'Erick', 'Jorge', 'Kevin', 'Israel', 'Obed'],
    last: ['Giménez', 'Lozano', 'Vega', 'Álvarez', 'Montes', 'Chávez', 'Lainez', 'Alvarado', 'Quiñones', 'Antuna', 'Ochoa', 'Reyes', 'Vargas', 'Romo', 'Sandoval', 'Márquez']
  },
  {
    code: 'ng', name: 'Nigeria', flag: '🇳🇬',
    first: ['Victor', 'Samuel', 'Ademola', 'Wilfred', 'Alex', 'Calvin', 'Frank', 'Kelechi', 'Terem', 'Bright', 'Zaidu', 'Peter', 'Cyriel', 'Joe', 'Bruno', 'Alhassan'],
    last: ['Osimhen', 'Chukwueze', 'Lookman', 'Ndidi', 'Iwobi', 'Bassey', 'Onyeka', 'Aina', 'Moffi', 'Osayi-Samuel', 'Sanusi', 'Ebiowei', 'Dessers', 'Aribo', 'Onomacho', 'Yusuf']
  }
];

const COUNTRY_MAP = {};
for (const c of COUNTRIES) COUNTRY_MAP[c.code] = c;

const DEFAULT_COUNTRY = 'es';

const CITIES = [
  'Vallebravo', 'Puerto Lumen', 'San Adriano', 'Costa Doria', 'Monte Real', 'Río Verde',
  'Villa Nova', 'El Portillo', 'Santa Elena', 'La Cañada', 'Torreblanca', 'Miramar',
  'Alta Mar', 'Fuentevieja', 'Peñas Negras', 'Bahía Sol'
];

const CLUB_SUFFIX = ['CF', 'FC', 'UD', 'Atlético', 'Real', 'Deportivo', 'CD', 'Unión'];

const SPONSOR_NAMES = [
  'AeroVolt', 'NovaBank', 'Cerveza Dorada', 'TeleSur', 'MaxiMart', 'Fintia', 'TurboFuel',
  'Zapatón', 'Café Andino', 'SeguraSeg', 'PixelPlay', 'Orbitel'
];

const SPONSOR_SECTORS = [
  'Aerolíneas', 'Banca', 'Bebidas', 'Telecomunicaciones', 'Retail', 'Fintech',
  'Energía', 'Deporte', 'Café', 'Seguros', 'Videojuegos', 'Telefonía'
];

function countryOf(code) {
  return COUNTRY_MAP[code] || COUNTRY_MAP[DEFAULT_COUNTRY];
}

function randomName(rng, countryCode) {
  const c = countryOf(countryCode);
  return rng.pick(c.first) + ' ' + rng.pick(c.last);
}

module.exports = {
  COUNTRIES, COUNTRY_MAP, DEFAULT_COUNTRY, CITIES, CLUB_SUFFIX,
  SPONSOR_NAMES, SPONSOR_SECTORS, randomName, countryOf
};

},
  "server/engine/player.js": function (exports, require, module) {
'use strict';

const { randomName, DEFAULT_COUNTRY } = require('./names');

const POSITIONS = ['GK', 'CB', 'LB', 'RB', 'DM', 'CM', 'AM', 'LW', 'RW', 'ST'];

const ATTR_KEYS = ['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical'];
const GK_KEYS = ['reflexes', 'handling', 'positioning', 'kicking'];

const POSITION_WEIGHTS = {
  GK: { gk: 1.0 },
  CB: { defending: 0.40, physical: 0.25, pace: 0.15, passing: 0.12, dribbling: 0.03, shooting: 0.00, passingAlt: 0 },
  LB: { defending: 0.28, pace: 0.24, physical: 0.16, passing: 0.20, dribbling: 0.10, shooting: 0.02 },
  RB: { defending: 0.28, pace: 0.24, physical: 0.16, passing: 0.20, dribbling: 0.10, shooting: 0.02 },
  DM: { defending: 0.32, passing: 0.26, physical: 0.22, pace: 0.08, dribbling: 0.08, shooting: 0.04 },
  CM: { passing: 0.32, dribbling: 0.18, defending: 0.16, physical: 0.14, pace: 0.10, shooting: 0.10 },
  AM: { passing: 0.28, dribbling: 0.26, shooting: 0.20, pace: 0.14, physical: 0.06, defending: 0.06 },
  LW: { pace: 0.26, dribbling: 0.26, passing: 0.18, shooting: 0.18, physical: 0.08, defending: 0.04 },
  RW: { pace: 0.26, dribbling: 0.26, passing: 0.18, shooting: 0.18, physical: 0.08, defending: 0.04 },
  ST: { shooting: 0.36, pace: 0.22, dribbling: 0.16, physical: 0.16, passing: 0.08, defending: 0.02 }
};

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function round1(v) { return Math.round(v * 10) / 10; }

function overallOf(player) {
  if (player.pos === 'GK') {
    const g = player.attrs;
    return Math.round(g.reflexes * 0.42 + g.handling * 0.26 + g.positioning * 0.22 + g.kicking * 0.10);
  }
  const w = POSITION_WEIGHTS[player.pos];
  let sum = 0, total = 0;
  for (const k of ATTR_KEYS) {
    sum += player.attrs[k] * w[k];
    total += w[k];
  }
  return Math.round(sum / total);
}

function potentialRangeOf(player) {
  const gap = player.potential - player.overall;
  return [player.overall, player.overall + Math.max(0, Math.ceil(gap * 0.6))];
}

function generatePlayer(rng, opts) {
  const pos = opts.pos || rng.pick(POSITIONS.filter(p => p !== 'GK'));
  const age = opts.age != null ? opts.age : rng.int(17, 34);
  const level = opts.level != null ? opts.level : 60;
  const country = opts.country || DEFAULT_COUNTRY;

  let base = clamp(rng.gauss(level, 7), 30, 92);

  const ageFactor = age < 21 ? 0.80 : age < 24 ? 0.90 : age <= 29 ? 1.0 : age <= 32 ? 0.97 : 0.92;
  base *= ageFactor;
  base = clamp(base, 25, 94);

  const attrs = {};
  if (pos === 'GK') {
    for (const k of GK_KEYS) attrs[k] = clamp(Math.round(rng.gauss(base, 5)), 20, 96);
  } else {
    const w = POSITION_WEIGHTS[pos];
    for (const k of ATTR_KEYS) {
      const bias = w[k] >= 0.24 ? 6 : w[k] <= 0.06 ? -8 : 0;
      attrs[k] = clamp(Math.round(rng.gauss(base + bias, 6)), 20, 96);
    }
  }

  const growthLeft = age <= 23 ? rng.int(6, 22) : age <= 27 ? rng.int(2, 10) : rng.int(0, 3);
  const player = {
    id: rng.id('p'),
    name: randomName(rng, country),
    nationality: country,
    pos,
    age,
    attrs,
    skills: [],
    skillPoints: 0,
    potential: clamp(Math.round(base + growthLeft + (age <= 21 ? rng.int(0, 8) : 0)), 30, 96),
    morale: rng.int(60, 85),
    fatigue: rng.int(0, 15),
    form: 0,
    injury: null,
    ban: 0,
    contract: { wage: 0, until: 0 },
    stats: { apps: 0, goals: 0, assists: 0, yellow: 0, red: 0, avgRating: 0, ratingSum: 0, ratedApps: 0, cleanSheets: 0 },
    seasonHistory: [],
    tokenId: null,
    scouted: false
  };
  player.overall = overallOf(player);
  player.contract.wage = wageDemand(player, rng);
  player.value = computeValue(player);
  return player;
}

function wageDemand(player, rng) {
  const o = player.overall;
  let base = 800 * Math.pow(1.055, Math.max(0, o - 40));
  if (player.age <= 21) base *= 0.7;
  if (player.age >= 33) base *= 0.85;
  return Math.round((base + rng.range(-500, 1500)) / 100) * 100;
}

function computeValue(player) {
  const o = player.overall;
  let v = 12000 * Math.pow(1.13, Math.max(0, o - 40));
  const potGap = Math.max(0, player.potential - o);
  if (player.age <= 23) v *= 1 + potGap * 0.055;
  else if (player.age <= 27) v *= 1 + potGap * 0.025;
  if (player.age >= 31) v *= 0.72;
  if (player.age >= 34) v *= 0.6;
  const yearsLeft = Math.max(0, player.contract.until - (player._season || 1));
  if (yearsLeft === 0) v *= 0.55;
  else if (yearsLeft === 1) v *= 0.8;
  return Math.max(25000, Math.round(v / 10000) * 10000);
}

function growthForPlayer(player, rng, facilityLevel, focus) {
  if (player.age >= 31) {
    const decline = rng.chance(0.35 + (player.age - 31) * 0.08) ? 1 : 0;
    return { decline, gains: {} };
  }
  const gap = player.potential - player.overall;
  if (gap <= 0) return { decline: 0, gains: {} };
  const ageChance = player.age <= 20 ? 0.55 : player.age <= 23 ? 0.42 : player.age <= 27 ? 0.25 : 0.10;
  let chance = ageChance * (0.75 + facilityLevel * 0.09) * Math.min(1, gap / 6);
  if (focus && focus !== 'balanced') chance *= 1.12;
  if (player.fatigue > 70) chance *= 0.6;
  const gains = {};
  if (rng.chance(chance)) {
    const keys = player.pos === 'GK' ? GK_KEYS : ATTR_KEYS;
    let key;
    if (focus && focus !== 'balanced' && rng.chance(0.65)) {
      const focusMap = {
        attack: ['shooting', 'dribbling', 'pace'],
        defense: ['defending', 'physical'],
        technique: ['passing', 'dribbling'],
        fitness: ['physical', 'pace']
      };
      const cands = (focusMap[focus] || keys).filter(k => keys.includes(k));
      key = rng.pick(cands.length ? cands : keys);
    } else {
      key = rng.pick(keys);
    }
    const w = POSITION_WEIGHTS[player.pos];
    const weight = player.pos === 'GK' ? 0.5 : (w[key] || 0.1);
    const amount = weight >= 0.24 ? 1 : rng.chance(0.3) ? 1 : 0;
    if (amount > 0) gains[key] = amount;
  }
  return { decline: 0, gains };
}

function applyGrowth(player, gains, decline) {
  if (decline) {
    const keys = player.pos === 'GK' ? GK_KEYS : ATTR_KEYS;
    const key = keys[Math.floor(Math.random() * keys.length)];
    player.attrs[key] = clamp(player.attrs[key] - 1, 20, 96);
  }
  for (const [k, v] of Object.entries(gains)) {
    player.attrs[k] = clamp(player.attrs[k] + v, 20, 96);
  }
  const prev = player.overall;
  player.overall = overallOf(player);
  player.value = computeValue(player);
  return player.overall - prev;
}

module.exports = {
  POSITIONS, ATTR_KEYS, GK_KEYS, POSITION_WEIGHTS,
  overallOf, potentialRangeOf, generatePlayer, wageDemand, computeValue,
  growthForPlayer, applyGrowth, clamp
};

},
  "server/engine/club.js": function (exports, require, module) {
'use strict';

const { Rng } = require('./rng');
const { COUNTRIES, CITIES, CLUB_SUFFIX, SPONSOR_NAMES, randomName, countryOf, DEFAULT_COUNTRY } = require('./names');
const { generatePlayer, computeValue, clamp } = require('./player');

const CREST_SHAPES = ['shield', 'circle', 'hex'];
const CREST_PATTERNS = ['solid', 'stripes', 'halves', 'sash', 'hoops'];
const CREST_FIGURES = ['none', 'star', 'ball', 'crown'];
const KIT_PATTERNS = ['solid', 'stripes', 'hoops', 'sash'];

const FORMATIONS = {
  '4-4-2': { GK: 1, CB: 2, LB: 1, RB: 1, DM: 0, CM: 2, AM: 0, LW: 1, RW: 1, ST: 2 },
  '4-3-3': { GK: 1, CB: 2, LB: 1, RB: 1, DM: 1, CM: 2, AM: 0, LW: 1, RW: 1, ST: 1 },
  '4-2-3-1': { GK: 1, CB: 2, LB: 1, RB: 1, DM: 2, CM: 0, AM: 1, LW: 1, RW: 1, ST: 1 },
  '3-5-2': { GK: 1, CB: 3, LB: 0, RB: 0, DM: 1, CM: 3, AM: 1, LW: 0, RW: 0, ST: 2 },
  '5-3-2': { GK: 1, CB: 3, LB: 1, RB: 1, DM: 1, CM: 2, AM: 0, LW: 0, RW: 0, ST: 2 },
  '4-1-4-1': { GK: 1, CB: 2, LB: 1, RB: 1, DM: 1, CM: 3, AM: 0, LW: 1, RW: 1, ST: 1 }
};

const SQUAD_TEMPLATE = [
  'GK', 'GK', 'GK',
  'CB', 'CB', 'CB', 'CB',
  'LB', 'LB', 'RB', 'RB',
  'DM', 'DM', 'CM', 'CM', 'CM', 'AM', 'AM',
  'LW', 'LW', 'RW', 'RW',
  'ST', 'ST', 'ST'
];

function foreignNat(rng, home) {
  const codes = COUNTRIES.map(c => c.code).filter(x => x !== home);
  return rng.pick(codes);
}

function generateClubSquad(rng, level, season, country) {
  const c = country || DEFAULT_COUNTRY;
  const squad = [];
  for (const pos of SQUAD_TEMPLATE) {
    const ageRoll = rng.float();
    const age = ageRoll < 0.22 ? rng.int(17, 20) : ageRoll < 0.62 ? rng.int(21, 27) : ageRoll < 0.88 ? rng.int(28, 31) : rng.int(32, 36);
    const nat = rng.chance(0.18) ? foreignNat(rng, c) : c;
    const p = generatePlayer(rng, { pos, age, level: level + rng.range(-4, 4), country: nat || undefined });
    p.contract.until = season + rng.int(1, 4);
    squad.push(p);
  }
  return squad;
}

function generateCrest(rng, primaryColor, secondaryColor, shortName) {
  return {
    shape: rng.pick(CREST_SHAPES),
    pattern: rng.pick(CREST_PATTERNS),
    figure: rng.pick(CREST_FIGURES),
    c1: primaryColor,
    c2: secondaryColor,
    initials: shortName
  };
}

function generateKit(rng, primaryColor, secondaryColor) {
  return { pattern: rng.pick(KIT_PATTERNS), c1: primaryColor, c2: secondaryColor };
}

function createClub(rng, opts) {
  const club = {
    id: opts.id || rng.id('c'),
    name: opts.name,
    shortName: opts.shortName || opts.name.slice(0, 3).toUpperCase(),
    city: opts.city,
    primaryColor: opts.primaryColor || '#c8102e',
    secondaryColor: opts.secondaryColor || '#ffffff',
    reputation: opts.reputation != null ? opts.reputation : 50,
    fanbase: opts.fanbase != null ? opts.fanbase : 800000,
    budget: opts.budget != null ? opts.budget : 8000000,
    stadium: { capacity: opts.capacity || 25000, name: opts.stadiumName || ('Estadio ' + opts.city), ticketPrice: 22 },
    facilities: { training: opts.trainingLevel || 2, youth: opts.youthLevel || 2, medical: opts.medicalLevel || 2 },
    formation: opts.formation || '4-3-3',
    mentality: 'balanced',
    trainingFocus: 'balanced',
    playerTraining: {},
    sponsor: { name: rng.pick(SPONSOR_NAMES), income: 0 },
    standSponsors: {},
    crest: opts.crest || generateCrest(rng, opts.primaryColor || '#c8102e', opts.secondaryColor || '#ffffff', (opts.shortName || opts.name.slice(0, 3).toUpperCase())),
    kit: opts.kit || generateKit(rng, opts.primaryColor || '#c8102e', opts.secondaryColor || '#ffffff'),
    country: opts.country || DEFAULT_COUNTRY,
    lineup: [],
    tactics: { pressing: 'medium', width: 'normal' },
    isUser: !!opts.isUser
  };
  club.sponsor.income = Math.round((club.reputation * 9000 + club.fanbase * 0.004) / 1000) * 1000;
  return club;
}

function aiClubName(rng, used) {
  for (let i = 0; i < 50; i++) {
    const name = rng.pick(['Atlético', 'Real', 'Club', 'Deportivo', 'Unión', 'Racing', 'Sporting']) + ' ' + rng.pick(CITIES);
    if (!used.has(name)) { used.add(name); return name; }
  }
  const fallback = 'Club ' + rng.pick(CITIES) + ' ' + rng.int(2, 99);
  used.add(fallback);
  return fallback;
}

module.exports = {
  FORMATIONS, SQUAD_TEMPLATE, generateClubSquad, createClub, aiClubName,
  generateCrest, generateKit, CREST_SHAPES, CREST_PATTERNS, CREST_FIGURES, KIT_PATTERNS
};

},
  "server/engine/match.js": function (exports, require, module) {
'use strict';

const { Rng } = require('./rng');
const { FORMATIONS } = require('./club');
const { clamp } = require('./player');

const RELATED = {
  CB: ['DM', 'LB', 'RB'],
  LB: ['CB', 'DM', 'CM'],
  RB: ['CB', 'DM', 'CM'],
  DM: ['CM', 'CB'],
  CM: ['DM', 'AM'],
  AM: ['CM', 'LW', 'RW', 'ST'],
  LW: ['RW', 'ST', 'AM'],
  RW: ['LW', 'ST', 'AM'],
  ST: ['AM', 'LW', 'RW']
};

function positionFit(playerPos, slotPos) {
  if (playerPos === slotPos) return 1.0;
  if (playerPos === 'GK' || slotPos === 'GK') return 0.4;
  if ((RELATED[playerPos] || []).includes(slotPos)) return 0.93;
  return 0.8;
}

function formationSlots(formation) {
  const f = FORMATIONS[formation] || FORMATIONS['4-3-3'];
  const slots = [];
  const order = ['GK', 'CB', 'LB', 'RB', 'DM', 'CM', 'AM', 'LW', 'RW', 'ST'];
  for (const pos of order) {
    for (let i = 0; i < (f[pos] || 0); i++) slots.push(pos);
  }
  return slots;
}

function effectiveRating(player, slotPos) {
  const fit = positionFit(player.pos, slotPos);
  let r = player.overall * fit;
  r *= 1 - Math.max(0, player.fatigue - 40) / 160;
  r += (player.morale - 70) / 22;
  r += player.form * 0.5;
  return r;
}

function autoPickLineup(club, players) {
  const slots = formationSlots(club.formation);
  const available = club.squad
    .map(id => players[id])
    .filter(p => p && !p.injury && p.ban <= 0)
    .sort((a, b) => b.overall - a.overall);
  const used = new Set();
  const lineup = [];
  for (const slot of slots) {
    let best = null, bestR = -1;
    for (const p of available) {
      if (used.has(p.id)) continue;
      const r = effectiveRating(p, slot);
      if (r > bestR) { bestR = r; best = p; }
    }
    if (best) { used.add(best.id); lineup.push(best.id); }
    else lineup.push(null);
  }
  return lineup.filter(Boolean);
}

function resolveLineup(club, players) {
  const slots = formationSlots(club.formation);
  let lineup = (club.lineup || []).map(id => players[id]).filter(p => p && !p.injury && p.ban <= 0).map(p => p.id);
  lineup = lineup.slice(0, slots.length);
  if (lineup.length < slots.length) {
    const picked = autoPickLineup(club, players);
    for (const id of picked) {
      if (lineup.length >= slots.length) break;
      if (!lineup.includes(id)) lineup.push(id);
    }
  }
  const bench = club.squad
    .map(id => players[id])
    .filter(p => p && !lineup.includes(p.id) && !p.injury && p.ban <= 0)
    .sort((a, b) => b.overall - a.overall)
    .slice(0, 7)
    .map(p => p.id);
  return { lineup, bench };
}

function teamStrength(club, lineupIds, players, isHome) {
  const slots = formationSlots(club.formation);
  const playersIn = lineupIds.map(id => players[id]).filter(Boolean);
  let def = 0, mid = 0, att = 0, dW = 0, mW = 0, aW = 0;
  let chemSum = 0;
  const DEF_POS = ['CB', 'LB', 'RB'], MID_POS = ['DM', 'CM', 'AM'], ATT_POS = ['LW', 'RW', 'ST'];
  slots.forEach((slot, i) => {
    const p = playersIn[i];
    if (!p) return;
    const r = effectiveRating(p, slot);
    chemSum += positionFit(p.pos, slot);
    if (p.pos === 'GK') { def += r * 0.9; dW += 0.9; return; }
    if (DEF_POS.includes(p.pos)) { def += r; dW += 1; mid += r * 0.15; mW += 0.15; }
    else if (MID_POS.includes(p.pos)) { mid += r; mW += 1; def += r * 0.22; dW += 0.22; att += r * 0.2; aW += 0.2; }
    else { att += r; aW += 1; mid += r * 0.2; mW += 0.2; }
  });
  def = dW ? def / dW : 40;
  mid = mW ? mid / mW : 40;
  att = aW ? att / aW : 40;

  const naturalCount = playersIn.filter((p, i) => slots[i] && p.pos === slots[i]).length;
  const chem = playersIn.length ? chemSum / playersIn.length : 0.7;
  const chemBonus = 1 + (chem - 0.85) * 0.25 + (naturalCount / Math.max(1, playersIn.length)) * 0.06;

  const m = club.mentality || 'balanced';
  const mentMod = {
    defensive: { att: 0.88, def: 1.12 },
    balanced: { att: 1.0, def: 1.0 },
    attacking: { att: 1.14, def: 0.9 }
  }[m] || { att: 1, def: 1 };

  const press = club.tactics && club.tactics.pressing;
  const pressMod = press === 'high' ? { att: 1.05, def: 0.96, fatigue: 1.25 } : press === 'low' ? { att: 0.95, def: 1.04, fatigue: 0.8 } : { att: 1, def: 1, fatigue: 1 };

  const home = isHome ? 1.045 : 1.0;

  return {
    attack: att * mentMod.att * pressMod.att * chemBonus * home,
    defense: def * mentMod.def * pressMod.def * chemBonus,
    midfield: mid * chemBonus * home,
    chemistry: chem,
    fatigueMod: pressMod.fatigue
  };
}

function createMatch(state, homeClubId, awayClubId) {
  const players = state.players;
  const home = state.clubs[homeClubId], away = state.clubs[awayClubId];
  const h = resolveLineup(home, players);
  const a = resolveLineup(away, players);
  return {
    homeId: homeClubId,
    awayId: awayClubId,
    minute: 0,
    score: [0, 0],
    events: [],
    stats: {
      possession: [50, 50], shots: [0, 0], onTarget: [0, 0],
      corners: [0, 0], fouls: [0, 0], cardsYellow: [0, 0], cardsRed: [0, 0]
    },
    _formations: [home.formation, away.formation],
    lineups: { home: h.lineup, away: a.lineup },
    benches: { home: h.bench, away: a.bench },
    subsUsed: { home: 0, away: 0 },
    matchRatings: {},
    goals: {},
    assists: {},
    finished: false,
    userClubId: state.clubs[homeClubId].isUser ? homeClubId : (state.clubs[awayClubId].isUser ? awayClubId : null)
  };
}

function pushEvent(match, ev) {
  ev.minute = match.minute;
  match.events.push(ev);
  return ev;
}

function pickWeighted(rng, entries) {
  let total = 0;
  for (const e of entries) total += e.w;
  let r = rng.float() * total;
  for (const e of entries) { r -= e.w; if (r <= 0) return e; }
  return entries[entries.length - 1];
}

function attackerWeight(player, slotPos) {
  if (player.pos === 'GK') return 0.02;
  const map = { ST: 10, LW: 7, RW: 7, AM: 6, CM: 3, DM: 1.2, LB: 1.5, RB: 1.5, CB: 0.8 };
  return (map[slotPos] || 2) * (0.4 + player.attrs.shooting / 100);
}

function creatorWeight(player, slotPos) {
  if (player.pos === 'GK') return 0.05;
  const map = { AM: 9, CM: 6, LW: 6, RW: 6, ST: 3, DM: 2.5, LB: 3, RB: 3, CB: 1 };
  return (map[slotPos] || 2) * (0.4 + player.attrs.passing / 100);
}

function runSegment(state, match, untilMinute) {
  const rng = state.rng;
  const players = state.players;
  const home = state.clubs[match.homeId], away = state.clubs[match.awayId];
  const hs = teamStrength(home, match.lineups.home, players, true);
  const as = teamStrength(away, match.lineups.away, players, false);

  const stoppageOf = () => (untilMinute >= 90 ? (match._stoppage || 0) : 0);
  while (match.minute < untilMinute + stoppageOf() && !match.finished) {
    match.minute++;
    const min = match.minute;

    if (min === 90 && untilMinute >= 90 && !match._stoppageAnnounced) {
      match._stoppageAnnounced = true;
      const interruptions = match.events.filter(e =>
        ['goal', 'sub', 'yellow', 'red', 'injury'].includes(e.type) && e.minute > 45).length;
      match._stoppage = Math.max(1, Math.min(6, 1 + Math.ceil(interruptions / 4)));
      pushEvent(match, { type: 'added', text: '\u23f1\ufe0f Se jugar\u00e1n ' + match._stoppage + ' minutos de tiempo a\u00f1adido' });
    }

    const midDiff = hs.midfield - as.midfield;
    const homePoss = clamp(50 + midDiff * 0.35, 30, 70);
    match.stats.possession[0] = Math.round((match.stats.possession[0] * (min - 1) + homePoss) / min);
    match.stats.possession[1] = 100 - match.stats.possession[0];

    const homeAttacking = homePoss / 100 * hs.attack / (hs.attack + as.defense);
    const homeLosing = match.score[0] < match.score[1];
    if (min === 60 && homeLosing && !match._crowdPushed) {
      match._crowdPushed = true;
      pushEvent(match, { type: 'crowd', side: 0, text: '🔥 La grada local se echa el equipo a la espalda y empuja' });
    }
    const crowdBoost = (min >= 60 && homeLosing) ? 1.12 : 1;
    const chanceProb = 0.21 * (homeAttacking * 2) * crowdBoost;
    if (rng.chance(chanceProb)) createChance(state, match, hs, as, 0);
    const awayAttacking = (1 - homePoss / 100) * as.attack / (as.attack + hs.defense);
    if (rng.chance(0.21 * (awayAttacking * 2))) createChance(state, match, as, hs, 1);

    if (rng.chance(0.028)) cardEvent(state, match);
    if (rng.chance(0.006)) injuryEvent(state, match);

    if ((min === 60 || min === 72 || min === 80) && !match.finished) {
      aiSubstitutions(state, match);
    }

    for (const side of [0, 1]) {
      const ids = match.lineups[side === 0 ? 'home' : 'away'];
      const fatigueMod = side === 0 ? hs.fatigueMod : as.fatigueMod;
      for (const id of ids) {
        const p = players[id];
        if (p) p.fatigue = clamp(p.fatigue + 0.45 * fatigueMod, 0, 100);
      }
    }

    if (min === 45 && match.userClubId) {
      pushEvent(match, { type: 'checkpoint', checkpoint: 'HT', text: 'Descanso: ' + home.shortName + ' ' + match.score[0] + '-' + match.score[1] + ' ' + away.shortName });
      return;
    }
  }
  finishMatch(state, match);
}

function createChance(state, match, attS, defS, side) {
  const rng = state.rng;
  const players = state.players;
  const oppSide = side === 0 ? 1 : 0;
  const lineupKey = side === 0 ? 'home' : 'away';
  const oppKey = oppSide === 0 ? 'home' : 'away';
  const attIds = match.lineups[lineupKey];
  const defIds = match.lineups[oppKey];

  const slots = formationSlots(match._formations[side]);
  const creator = pickWeighted(rng, attIds.map((id, i) => ({ id, w: creatorWeight(players[id], slots[i] || 'CM') })));
  const shooter = pickWeighted(rng, attIds.map((id, i) => ({ id, w: attackerWeight(players[id], slots[i] || 'CM') })));

  const gkId = defIds.find(id => players[id] && players[id].pos === 'GK');
  const gk = gkId ? players[gkId] : null;

  const shooterP = players[shooter.id];
  if (rng.chance(0.08)) {
    pushEvent(match, { type: 'offside', side, playerId: shooter.id, playerName: shooterP.name, text: '🚩 Fuera de juego de ' + shooterP.name });
    return;
  }
  const quality = clamp(0.25 + (shooterP.attrs.shooting - 55) / 90 + (attS.attack - defS.defense) / 130 + rng.range(-0.08, 0.08), 0.05, 0.75);
  const gkFactor = gk ? clamp(0.9 + (gk.attrs.reflexes - 60) / 220, 0.75, 1.05) : 1;
  const roll = rng.float();

  match.stats.onTarget[side]++;
  if (roll < quality * gkFactor * 0.95) {
    match.score[side]++;
    const hasAssist = creator.id !== shooter.id && rng.chance(0.75);
    if (hasAssist) match.assists[creator.id] = (match.assists[creator.id] || 0) + 1;
    match.goals[shooter.id] = (match.goals[shooter.id] || 0) + 1;
    const teamName = side === 0 ? state.clubs[match.homeId].shortName : state.clubs[match.awayId].shortName;
    pushEvent(match, {
      type: 'goal', side, team: teamName,
      playerId: shooter.id, playerName: shooterP.name,
      assistId: hasAssist ? creator.id : null,
      assistName: hasAssist ? players[creator.id].name : null,
      text: `¡GOL de ${shooterP.name} (${teamName})!`
    });
  } else if (roll < quality * gkFactor * 0.95 + 0.22) {
    pushEvent(match, {
      type: 'save', side,
      text: gk ? `Gran parada de ${gk.name} tras el disparo de ${shooterP.name}` : `Disparo fuera de ${shooterP.name}`
    });
  } else if (roll < 0.92) {
    match.stats.shots[side]++;
    pushEvent(match, { type: 'miss', side, text: `${shooterP.name} remata fuera` });
  }
}

function cardEvent(state, match) {
  const rng = state.rng;
  const side = rng.chance(0.5) ? 0 : 1;
  const key = side === 0 ? 'home' : 'away';
  const ids = match.lineups[key].filter(id => players_gk(state, id) === false);
  if (!ids.length) return;
  const id = rng.pick(ids);
  const p = state.players[id];
  if (!p) return;
  const red = rng.chance(0.12);
  if (red) {
    match.stats.cardsRed[side]++;
    match.lineups[key] = match.lineups[key].filter(x => x !== id);
    pushEvent(match, { type: 'red', side, playerId: id, playerName: p.name, text: `🟥 Roja directa para ${p.name}! Su equipo se queda con 10` });
    p._matchRed = true;
  } else {
    match.stats.cardsYellow[side]++;
    p._matchYellow = (p._matchYellow || 0) + 1;
    pushEvent(match, { type: 'yellow', side, playerId: id, playerName: p.name, text: `🟨 Amarilla para ${p.name}` });
  }
}

function players_gk(state, id) {
  const p = state.players[id];
  return !p || p.pos === 'GK';
}

function injuryEvent(state, match) {
  const rng = state.rng;
  const side = rng.chance(0.5) ? 0 : 1;
  const key = side === 0 ? 'home' : 'away';
  const ids = match.lineups[key];
  if (!ids.length) return;
  const id = rng.pick(ids);
  const p = state.players[id];
  if (!p || p.injury) return;
  const risk = 0.25 + Math.max(0, p.fatigue - 50) / 120;
  if (!rng.chance(risk)) return;
  const severities = [
    { name: 'golpe leve', weeks: 1 },
    { name: 'distensión muscular', weeks: rng.int(2, 3) },
    { name: 'lesión de tobillo', weeks: rng.int(3, 6) },
    { name: 'rotura fibrilar', weeks: rng.int(6, 10) }
  ];
  const sev = rng.pick(severities);
  p.injury = { type: sev.name, weeks: sev.weeks };
  pushEvent(match, { type: 'injury', side, playerId: id, playerName: p.name, text: `🚑 ${p.name} se lesiona (${sev.name}, ~${sev.weeks} sem.)` });
  const bench = match.benches[key];
  if (bench.length && match.subsUsed[key] < 5) {
    const subId = bench.shift();
    match.lineups[key] = match.lineups[key].map(x => (x === id ? subId : x));
    match.benches[key] = bench;
    match.subsUsed[key]++;
    const subP = state.players[subId];
    pushEvent(match, { type: 'sub', side, outId: id, outName: p.name, inId: subId, inName: subP.name, text: `🔄 Entra ${subP.name} por ${p.name}` });
  }
}

function aiSubstitutions(state, match) {
  const rng = state.rng;
  for (const side of [0, 1]) {
    const key = side === 0 ? 'home' : 'away';
    const club = side === 0 ? state.clubs[match.homeId] : state.clubs[match.awayId];
    if (club.isUser && match.userClubId) continue;
    if (match.subsUsed[key] >= 4) continue;
    const tired = match.lineups[key]
      .map(id => state.players[id])
      .filter(p => p && p.fatigue > 72)
      .sort((a, b) => b.fatigue - a.fatigue);
    const bench = match.benches[key];
    if (tired.length && bench.length && rng.chance(0.5)) {
      const out = tired[0];
      const inId = bench.shift();
      match.lineups[key] = match.lineups[key].map(x => (x === out.id ? inId : x));
      match.benches[key] = bench;
      match.subsUsed[key]++;
      const inP = state.players[inId];
      pushEvent(match, { type: 'sub', side, outId: out.id, outName: out.name, inId, inName: inP.name, text: `🔄 ${club.shortName}: entra ${inP.name} por ${out.name}` });
    }
  }
}

function ratingForPlayer(match, playerId, side) {
  let r = 6.3;
  r += (match.goals[playerId] || 0) * 1.2;
  r += (match.assists[playerId] || 0) * 0.7;
  if (match._yellowIds && match._yellowIds.has(playerId)) r -= 0.4;
  if (match._redIds && match._redIds.has(playerId)) r -= 1.5;
  const teamGoals = match.score[side];
  const oppGoals = match.score[side === 0 ? 1 : 0];
  if (teamGoals > oppGoals) r += 0.35;
  else if (teamGoals < oppGoals) r -= 0.25;
  const p = match._statePlayers[playerId];
  if (p) r += (p.overall - 60) / 90;
  return clamp(Math.round(r * 10) / 10 + (Math.random() * 0.4 - 0.2), 3, 10);
}

function finishMatch(state, match) {
  if (match.finished) return;
  match.minute = Math.max(match.minute, 90);
  match.stoppage = match._stoppage || 0;
  match.finished = true;
  match._yellowIds = new Set(match.events.filter(e => e.type === 'yellow').map(e => e.playerId).filter(Boolean));
  match._redIds = new Set(match.events.filter(e => e.type === 'red').map(e => e.playerId).filter(Boolean));
  match._statePlayers = state.players;
  match._formations = match._formations || [state.clubs[match.homeId].formation, state.clubs[match.awayId].formation];

  pushEvent(match, {
    type: 'fulltime',
    text: `Final: ${state.clubs[match.homeId].name} ${match.score[0]} - ${match.score[1]} ${state.clubs[match.awayId].name}`
  });

  for (const side of [0, 1]) {
    const key = side === 0 ? 'home' : 'away';
    for (const id of match.lineups[key]) {
      const p = state.players[id];
      if (!p) continue;
      p.stats.apps++;
      p.stats.goals += match.goals[id] || 0;
      p.stats.assists += match.assists[id] || 0;
      const rating = ratingForPlayer(match, id, side);
      p.stats.ratingSum += rating;
      p.stats.ratedApps++;
      p.stats.avgRating = Math.round((p.stats.ratingSum / p.stats.ratedApps) * 100) / 100;
      p.form = clamp(p.form * 0.7 + (rating - 6.5) * 1.2, -3, 3);
      let sp = 0;
      if (rating >= 7.5) sp += 1;
      if ((match.goals[id] || 0) > 0) sp += 1;
      if (sp > 0) p.skillPoints = (p.skillPoints || 0) + sp;
      if (p._matchRed) { p.ban = Math.max(p.ban, 2); p.stats.red++; p._matchRed = false; }
      if (p._matchYellow) {
        p.stats.yellow++;
        if (p.stats.yellow % 5 === 0) p.ban = Math.max(p.ban, 1);
        p._matchYellow = 0;
      }
      p.morale = clamp(p.morale + (match.score[side] > match.score[side === 0 ? 1 : 0] ? 3 : match.score[side] < match.score[side === 0 ? 1 : 0] ? -3 : 0), 20, 99);
    }
  }

  const events = match.events;
  for (const side of [0, 1]) {
    const oppSide = side === 0 ? 1 : 0;
    if (match.score[oppSide] === 0) {
      const gkId = match.lineups[side === 0 ? 'home' : 'away'].find(id => state.players[id] && state.players[id].pos === 'GK');
      if (gkId) state.players[gkId].stats.cleanSheets++;
    }
  }

  return match;
}

module.exports = {
  createMatch, runSegment, finishMatch, resolveLineup, autoPickLineup,
  teamStrength, formationSlots, positionFit, effectiveRating, RELATED
};

},
  "server/engine/league.js": function (exports, require, module) {
'use strict';

const TEAMS = 12;
const PRIZE_MONEY = [4000000, 2800000, 2200000, 1800000, 1500000, 1300000, 1150000, 1000000, 900000, 800000, 700000, 600000];

function buildFixtures(clubIds, rng) {
  const teams = rng.shuffle(clubIds.slice());
  const n = teams.length;
  const rounds = [];
  const arr = teams.slice();
  for (let r = 0; r < n - 1; r++) {
    const round = [];
    for (let i = 0; i < n / 2; i++) {
      const home = arr[i], away = arr[n - 1 - i];
      round.push(r % 2 === 0 ? { home, away, played: false, score: null } : { home: away, away: home, played: false, score: null });
    }
    rounds.push(round);
    arr.splice(1, 0, arr.pop());
  }
  const second = rounds.map(round => round.map(m => ({ home: m.away, away: m.home, played: false, score: null })));
  return rounds.concat(second);
}

function computeTable(state) {
  const clubs = state.league.clubIds;
  const table = clubs.map(id => ({
    clubId: id, name: state.clubs[id].name, shortName: state.clubs[id].shortName,
    played: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0
  }));
  const byId = Object.fromEntries(table.map(t => [t.clubId, t]));
  for (const round of state.league.fixtures) {
    for (const m of round) {
      if (!m.played || m.score == null) continue;
      const h = byId[m.home], a = byId[m.away];
      if (!h || !a) continue;
      h.played++; a.played++;
      h.gf += m.score[0]; h.ga += m.score[1];
      a.gf += m.score[1]; a.ga += m.score[0];
      if (m.score[0] > m.score[1]) { h.w++; h.pts += 3; a.l++; }
      else if (m.score[0] < m.score[1]) { a.w++; a.pts += 3; h.l++; }
      else { h.d++; a.d++; h.pts++; a.pts++; }
    }
  }
  for (const row of table) row.gd = row.gf - row.ga;
  table.sort((x, y) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf);
  return table;
}

function currentRoundFixtures(state) {
  return state.league.fixtures[state.league.round] || [];
}

function allRoundMatchesPlayed(state) {
  return currentRoundFixtures(state).every(m => m.played);
}

module.exports = { TEAMS, PRIZE_MONEY, buildFixtures, computeTable, currentRoundFixtures, allRoundMatchesPlayed };

},
  "server/engine/finance.js": function (exports, require, module) {
'use strict';

const { clamp } = require('./player');

function addLedger(state, clubId, entry) {
  const club = state.clubs[clubId];
  club.ledger = club.ledger || [];
  club.ledger.push({ week: state.week, season: state.season, ...entry });
  if (club.ledger.length > 400) club.ledger = club.ledger.slice(-400);
  club.budget = Math.round(club.budget + entry.amount);
}

function weeklyFinances(state, clubId) {
  const club = state.clubs[clubId];
  let wages = 0;
  for (const id of club.squad) {
    const p = state.players[id];
    if (p) wages += p.contract.wage;
  }
  addLedger(state, clubId, { concept: 'Salarios de plantilla', amount: -wages, category: 'salarios' });

  const sponsor = club.sponsor.income;
  addLedger(state, clubId, { concept: `Patrocinio (${club.sponsor.name})`, amount: sponsor, category: 'patrocinio' });

  let standsIncome = 0;
  for (const [key, deal] of Object.entries(club.standSponsors || {})) {
    standsIncome += deal.weekly;
    addLedger(state, clubId, { concept: `Patrocinio de ${deal.standLabel || key} (${deal.name})`, amount: deal.weekly, category: 'patrocinio' });
  }

  const merch = Math.round(club.fanbase * 0.0022 * (0.85 + club.reputation / 200));
  addLedger(state, clubId, { concept: 'Merchandising y abonos', amount: merch, category: 'comercial' });

  const maintenance = Math.round(club.stadium.capacity * 0.09 + (club.facilities.training + club.facilities.youth + club.facilities.medical) * 14000);
  addLedger(state, clubId, { concept: 'Mantenimiento de instalaciones', amount: -maintenance, category: 'instalaciones' });

  return { wages, sponsor, standsIncome, merch, maintenance };
}

function gateReceipts(state, clubId, opponentClubId) {
  const club = state.clubs[clubId];
  const opponent = state.clubs[opponentClubId];
  const interest = clamp(0.45 + club.reputation / 220 + (opponent ? opponent.reputation : 50) / 300, 0.4, 0.99);
  const attendance = Math.round(club.stadium.capacity * interest);
  const income = Math.round(attendance * club.stadium.ticketPrice);
  addLedger(state, clubId, { concept: `Taquilla vs ${opponent ? opponent.name : 'rival'} (${attendance} espectadores)`, amount: income, category: 'taquilla' });
  club.fanbase = Math.round(club.fanbase * (1 + (club.reputation - 50) * 0.0002));
  return { attendance, income };
}

function canAfford(club, amount) {
  return club.budget >= amount;
}

function facilityCost(type, level) {
  const base = { training: 2200000, youth: 2600000, medical: 1800000, stadium: 3500000 };
  return Math.round((base[type] || 2000000) * Math.pow(1.6, level - 1));
}

function facilityEffect(type, level) {
  switch (type) {
    case 'training': return 'Aumenta la probabilidad de desarrollo de los jugadores en entrenamientos';
    case 'youth': return 'Mejora la calidad y frecuencia de las promesas de la cantera';
    case 'medical': return 'Reduce la duración de lesiones y el riesgo de recaída';
    case 'stadium': return 'Más aforo, más ingresos por taquilla';
    default: return '';
  }
}

module.exports = { addLedger, weeklyFinances, gateReceipts, canAfford, facilityCost, facilityEffect };

},
  "server/engine/youth.js": function (exports, require, module) {
'use strict';

const { generatePlayer, computeValue, wageDemand, clamp } = require('./player');

const YOUTH_POSITIONS = ['CB', 'LB', 'RB', 'DM', 'CM', 'AM', 'LW', 'RW', 'ST'];

function weeklyYouth(state, clubId) {
  const club = state.clubs[clubId];
  const rng = state.rng;
  const academy = state.youth[clubId] = state.youth[clubId] || [];
  const newOnes = [];
  const baseChance = 0.06 + club.facilities.youth * 0.035;
  if (rng.chance(baseChance) && academy.length < 6) {
    const qualityBonus = (club.facilities.youth - 1) * 4 + (club.reputation - 50) * 0.12;
    const p = generatePlayer(rng, {
      pos: rng.pick(YOUTH_POSITIONS),
      age: rng.int(15, 18),
      level: clamp(42 + qualityBonus + rng.range(-4, 8), 30, 72),
      country: club.country
    });
    p.potential = clamp(p.potential + Math.round(qualityBonus / 2), 40, 96);
    p.origin = 'cantera';
    p.scouted = true;
    academy.push(p);
    newOnes.push(p);
  }
  return newOnes;
}

function promoteYouth(state, clubId, playerId) {
  const club = state.clubs[clubId];
  const academy = state.youth[clubId] || [];
  const idx = academy.findIndex(p => p.id === playerId);
  if (idx === -1) throw new Error('La promesa no está en tu cantera');
  const p = academy.splice(idx, 1)[0];
  p.age = Math.max(p.age, 16);
  p.contract = { wage: wageDemand(p, state.rng), until: state.season + 3 };
  p.value = computeValue(p);
  club.squad.push(p.id);
  state.players[p.id] = p;
  return p;
}

module.exports = { weeklyYouth, promoteYouth, YOUTH_POSITIONS };

},
  "server/engine/market.js": function (exports, require, module) {
'use strict';

const { computeValue, wageDemand, clamp } = require('./player');

const LIST_FEE_PCT = 0.01;

function listPlayer(state, clubId, playerId, price) {
  const club = state.clubs[clubId];
  if (!club.squad.includes(playerId)) throw new Error('Ese jugador no pertenece a tu plantilla');
  const p = state.players[playerId];
  if (!p) throw new Error('Jugador no encontrado');
  const minPrice = Math.round(p.value * 0.4);
  const maxPrice = Math.round(p.value * 4);
  if (price < minPrice || price > maxPrice) {
    throw new Error(`Precio fuera de rango razonable: entre ${fmt(minPrice)} y ${fmt(maxPrice)}`);
  }
  if (club.squad.length <= 14) throw new Error('Necesitas al menos 14 jugadores en plantilla');
  const listing = {
    id: 'lst-' + state.rng.id('x'),
    playerId, sellerClubId: clubId, price,
    listedAt: { season: state.season, week: state.week },
    expiresWeek: state.week + 6
  };
  state.market.listings.push(listing);
  return listing;
}

function fmt(v) { return v >= 1000000 ? (v / 1000000).toFixed(1) + 'M' : Math.round(v / 1000) + 'K'; }

function cancelListing(state, clubId, listingId) {
  const idx = state.market.listings.findIndex(l => l.id === listingId && l.sellerClubId === clubId);
  if (idx === -1) throw new Error('Publicación no encontrada');
  state.market.listings.splice(idx, 1);
}

function aiGenerateListings(state) {
  const rng = state.rng;
  const listings = state.market.listings;
  for (const clubId of state.league.clubIds) {
    const club = state.clubs[clubId];
    if (club.isUser) continue;
    if (!rng.chance(0.35)) continue;
    const best = club.squad.reduce((mx, id) => Math.max(mx, (state.players[id] || {}).overall || 0), 0);
    const candidates = club.squad.map(id => state.players[id]).filter(p => p && p.overall < best + 2);
    if (!candidates.length) continue;
    const p = rng.pick(candidates);
    if (listings.some(l => l.playerId === p.id)) continue;
    if (club.squad.length <= 15) continue;
    listings.push({
      id: 'lst-' + rng.id('x'),
      playerId: p.id, sellerClubId: clubId,
      price: Math.round(p.value * rng.range(0.9, 1.6) / 10000) * 10000,
      listedAt: { season: state.season, week: state.week },
      expiresWeek: state.week + rng.int(3, 8)
    });
  }
  state.market.listings = listings.filter(l => l.expiresWeek > state.week && state.players[l.playerId]);
}

function aiBidOnListing(state, listing) {
  const rng = state.rng;
  const p = state.players[listing.playerId];
  if (!p) return null;
  const interested = state.league.clubIds.filter(id => {
    const c = state.clubs[id];
    return !c.isUser && c.id !== listing.sellerClubId && c.budget > listing.price * 1.2;
  });
  if (!interested.length) return null;
  if (!rng.chance(0.3)) return null;
  const buyer = state.clubs[rng.pick(interested)];
  return {
    id: 'off-' + rng.id('x'),
    type: 'listing-bid',
    listingId: listing.id,
    playerId: p.id,
    fromClubId: buyer.id,
    toClubId: listing.sellerClubId,
    amount: Math.round(listing.price * rng.range(0.85, 1.15) / 10000) * 10000,
    status: 'pending',
    week: state.week,
    season: state.season
  };
}

function aiOfferForSquadPlayer(state, clubId) {
  const rng = state.rng;
  const club = state.clubs[clubId];
  const candidates = club.squad
    .map(id => state.players[id])
    .filter(p => p && p.overall >= 58 && p.age < 33);
  if (!candidates.length) return null;
  const p = rng.pick(candidates);
  if (state.market.offers.some(o => o.playerId === p.id && o.status === 'pending')) return null;
  const buyerIds = state.league.clubIds.filter(id => !state.clubs[id].isUser);
  const buyer = state.clubs[rng.pick(buyerIds)];
  if (buyer.budget < p.value * 0.8) return null;
  const factor = p.overall > 70 ? rng.range(1.0, 1.5) : rng.range(0.75, 1.25);
  return {
    id: 'off-' + rng.id('x'),
    type: 'direct-offer',
    playerId: p.id,
    fromClubId: buyer.id,
    toClubId: clubId,
    amount: Math.round(p.value * factor / 10000) * 10000,
    status: 'pending',
    week: state.week,
    season: state.season
  };
}

function evaluateAiResponse(state, playerId, sellerClubId, amount) {
  const p = state.players[playerId];
  const seller = state.clubs[sellerClubId];
  const valuation = computeValue(p);
  const ratio = amount / valuation;
  if (seller.squad.length <= 15) return { accept: false, counter: Math.round(valuation * 1.3 / 10000) * 10000, reason: 'Plantilla corta: solo venderían por una oferta muy alta' };
  if (ratio >= 1.15) return { accept: true };
  if (ratio >= 0.9) return { accept: rng.chance((ratio - 0.9) * 3) };
  if (ratio >= 0.65) return { accept: false, counter: Math.round(valuation * rng.range(1.05, 1.25) / 10000) * 10000 };
  return { accept: false, reason: 'Oferta muy baja' };
}

function wageRequestFor(state, playerId) {
  const p = state.players[playerId];
  const userRep = state.clubs[state.userClubId].reputation;
  let mult = 1;
  if (userRep < 45) mult = 1.25;
  else if (userRep > 65) mult = 0.92;
  return Math.round(wageDemand(p, state.rng) * mult / 100) * 100;
}

module.exports = {
  LIST_FEE_PCT, listPlayer, cancelListing, aiGenerateListings,
  aiBidOnListing, aiOfferForSquadPlayer, evaluateAiResponse, wageRequestFor
};

},
  "server/engine/sponsors.js": function (exports, require, module) {
'use strict';

/* Patrocinadores: ofertas semanales para camiseta y gradas del estadio,
   con negociación (aceptar / contraoferta / rechazar). Los ingresos firmados
   se abonan semanalmente desde finance.weeklyFinances. */

const { clamp } = require('./player');

const STANDS = [
  { key: 'norte', label: 'Fondo Norte' },
  { key: 'sur', label: 'Fondo Sur' },
  { key: 'este', label: 'Lateral Este' },
  { key: 'oeste', label: 'Tribuna Oeste' }
];

const KINDS = ['shirt', 'stand'];

function sponsorBaseIncome(state, club) {
  return Math.round((club.reputation * 9500 + club.fanbase * 0.0045) / 500) * 500;
}

function generateOffers(state) {
  const club = state.clubs[state.userClubId];
  if (!club) return [];
  const rng = state.rng;
  const { SPONSOR_NAMES, SPONSOR_SECTORS } = require('./names');
  const offers = [];
  const usedNames = new Set();
  const pickName = () => {
    for (let i = 0; i < 30; i++) {
      const n = rng.pick(SPONSOR_NAMES) + (rng.chance(0.3) ? ' ' + rng.pick(SPONSOR_SECTORS) : '');
      if (!usedNames.has(n)) { usedNames.add(n); return n; }
    }
    return 'Patrocinador ' + rng.int(2, 99);
  };

  const base = sponsorBaseIncome(state, club);

  if (!club.sponsor.deal) {
    offers.push({
      id: 'off-' + rng.id('s'),
      kind: 'shirt',
      name: pickName(),
      weekly: Math.round(base * rng.range(0.85, 1.25) / 500) * 500,
      seasons: rng.int(1, 3),
      bonus: Math.round(base * rng.range(0.4, 1.1) / 500) * 500,
      minRep: 0,
      flex: rng.range(0.08, 0.22),
      expiresWeek: state.week + 2
    });
  }

  const freeStands = STANDS.filter(s => !club.standSponsors[s.key]);
  for (const stand of rng.shuffle(freeStands).slice(0, 2)) {
    offers.push({
      id: 'off-' + rng.id('s'),
      kind: 'stand',
      stand: stand.key,
      standLabel: stand.label,
      name: pickName(),
      weekly: Math.round(base * rng.range(0.08, 0.2) / 100) * 100,
      seasons: rng.int(1, 2),
      bonus: Math.round(base * rng.range(0.05, 0.18) / 100) * 100,
      minRep: 0,
      flex: rng.range(0.1, 0.3),
      expiresWeek: state.week + 2
    });
  }

  return offers;
}

function refreshOffers(state) {
  state.sponsorOffers = (state.sponsorOffers || []).filter(o => o.expiresWeek > state.week);
  const current = new Set((state.sponsorOffers || []).map(o => o.kind + ':' + (o.stand || '')));
  const fresh = generateOffers(state).filter(o => !current.has(o.kind + ':' + (o.stand || '')));
  state.sponsorOffers = state.sponsorOffers.concat(fresh).slice(0, 6);
  return state.sponsorOffers;
}

function negotiate(state, offerId, action, counterPct) {
  const club = state.clubs[state.userClubId];
  const idx = (state.sponsorOffers || []).findIndex(o => o.id === offerId);
  if (idx === -1) throw new Error('Oferta de patrocinio no disponible o caducada');
  const offer = state.sponsorOffers[idx];
  const rng = state.rng;

  if (action === 'reject') {
    state.sponsorOffers.splice(idx, 1);
    return { status: 'rejected', message: 'Oferta de ' + offer.name + ' rechazada.' };
  }

  if (action === 'counter') {
    const pct = clamp(Number(counterPct) || 0, 5, 60);
    const greed = pct / 100;
    const successChance = clamp(0.9 - greed * 1.6 - (offer.flex - 0.15) * 0.5 + (club.reputation - 50) * 0.004, 0.05, 0.85);
    if (rng.chance(successChance)) {
      offer.weekly = Math.round(offer.weekly * (1 + greed) / 100) * 100;
      offer.bonus = Math.round(offer.bonus * (1 + greed * 0.5) / 100) * 100;
      offer.flex = Math.max(0.02, offer.flex - greed * 0.4);
      return { status: 'countered', offer, message: offer.name + ' acepta tus términos: ' + fmt(offer.weekly) + ' FCG/semana. Confirma para firmar.' };
    }
    state.sponsorOffers.splice(idx, 1);
    return { status: 'walked', message: offer.name + ' considera excesiva tu petición y retira la oferta.' };
  }

  if (action !== 'accept') throw new Error('Acción de negociación inválida');

  const seasons = offer.seasons;
  const deal = {
    name: offer.name,
    kind: offer.kind,
    stand: offer.stand || null,
    weekly: offer.weekly,
    untilSeason: state.season + seasons - 1,
    signedSeason: state.season,
    signedWeek: state.week
  };
  if (offer.kind === 'shirt') {
    club.sponsor = { name: offer.name, income: offer.weekly, deal };
  } else {
    club.standSponsors[offer.stand] = deal;
  }
  state.sponsorOffers.splice(idx, 1);
  return { status: 'signed', deal, message: 'Contrato firmado con ' + offer.name + ': ' + fmt(offer.weekly) + ' FCG/semana hasta la temporada ' + deal.untilSeason + '.' };
}

function expireDeals(state, clubId) {
  const club = state.clubs[clubId];
  if (!club) return [];
  const expired = [];
  if (club.sponsor.deal && club.sponsor.deal.untilSeason < state.season) {
    expired.push('camiseta (' + club.sponsor.name + ')');
    club.sponsor = { name: club.sponsor.name, income: Math.round(sponsorBaseIncome(state, club) * 0.4 / 500) * 500, deal: null };
  }
  for (const [key, deal] of Object.entries(club.standSponsors || {})) {
    if (deal.untilSeason < state.season) {
      expired.push(deal.standLabel || key);
      delete club.standSponsors[key];
    }
  }
  return expired;
}

function fmt(v) {
  if (Math.abs(v) >= 1000000) return (v / 1000000).toFixed(2) + 'M';
  if (Math.abs(v) >= 1000) return Math.round(v / 1000) + 'K';
  return String(Math.round(v));
}

module.exports = { STANDS, KINDS, generateOffers, refreshOffers, negotiate, expireDeals, sponsorBaseIncome };

},
  "server/engine/skills.js": function (exports, require, module) {
'use strict';

/* Árboles de habilidades por posición. Cada jugador gana puntos de habilidad
   entrenando y jugando, y el mánager los invierte en nodos del árbol de su
   posición. Los efectos se aplican directamente a los atributos, así que el
   radar del perfil refleja el progreso sin capas intermedias. */

const { clamp, overallOf, computeValue, ATTR_KEYS, GK_KEYS } = require('./player');

/* Cada nodo: id, nombre, descripción, tier (1-3), coste en puntos,
   efectos sobre atributos y requisitos (ids de nodos previos). */
const TREES = {
  GK: [
    { id: 'reflejos', name: 'Reflejos felinos', desc: 'Reacción instantánea ante disparos cercanos', tier: 1, cost: 1, attrs: { reflexes: 3 }, requires: [] },
    { id: 'manos', name: 'Manos seguras', desc: 'Sujeta el balón con más firmeza', tier: 1, cost: 1, attrs: { handling: 3 }, requires: [] },
    { id: 'salidas', name: 'Dominio aéreo', desc: 'Mejor colocación en centros y salidas', tier: 1, cost: 1, attrs: { positioning: 3 }, requires: [] },
    { id: 'penaltis', name: 'Especialista en penaltis', desc: 'Lee la intención del lanzador', tier: 2, cost: 2, attrs: { reflexes: 3, handling: 2 }, requires: ['reflejos'] },
    { id: 'juegopie', name: 'Juego con los pies', desc: 'Inicia el ataque desde atrás con precisión', tier: 2, cost: 2, attrs: { kicking: 4 }, requires: ['salidas'] },
    { id: 'muralla', name: 'Muralla', desc: 'Presencia intimidante bajo palos', tier: 3, cost: 3, attrs: { reflexes: 3, positioning: 3, handling: 2 }, requires: ['penaltis', 'juegopie'] }
  ],
  CB: [
    { id: 'marcaje', name: 'Marcaje férreo', desc: 'Pega al delantero durante todo el partido', tier: 1, cost: 1, attrs: { defending: 3 }, requires: [] },
    { id: 'cuerpazo', name: 'Cuerpazo', desc: 'Gana los duelos físicos en el área', tier: 1, cost: 1, attrs: { physical: 3 }, requires: [] },
    { id: 'cobertura', name: 'Cobertura', desc: 'Recupera posiciones defensivas más rápido', tier: 1, cost: 1, attrs: { pace: 3 }, requires: [] },
    { id: 'entrada', name: 'Entrada limpia', desc: 'Roba el balón sin cometer falta', tier: 2, cost: 2, attrs: { defending: 4 }, requires: ['marcaje'] },
    { id: 'jerek', name: 'Jefe de la defensa', desc: 'Ordena la línea y gana todo aéreo', tier: 2, cost: 2, attrs: { physical: 3, defending: 2 }, requires: ['cuerpazo'] },
    { id: 'barrido', name: 'Barrido imposible', desc: 'Llegada salvadora al último recurso', tier: 3, cost: 3, attrs: { defending: 3, pace: 3, physical: 2 }, requires: ['entrada', 'jerek'] }
  ],
  FULLBACK: [
    { id: 'velocidad', name: 'Carriler eléctrico', desc: 'Sube y baja la banda sin parar', tier: 1, cost: 1, attrs: { pace: 3 }, requires: [] },
    { id: 'defensa', name: 'Cobertura defensiva', desc: 'Cierra la espalda del central', tier: 1, cost: 1, attrs: { defending: 3 }, requires: [] },
    { id: 'centro', name: 'Centro al área', desc: 'Pone balones peligrosos al área', tier: 1, cost: 1, attrs: { passing: 3 }, requires: [] },
    { id: 'subida', name: 'Progresión vertiginosa', desc: 'Conduce pegado a la línea de cal', tier: 2, cost: 2, attrs: { pace: 3, dribbling: 2 }, requires: ['velocidad'] },
    { id: 'anticipo', name: 'Anticipación', desc: 'Corta las jugadas antes de que nacieran', tier: 2, cost: 2, attrs: { defending: 3, physical: 2 }, requires: ['defensa'] },
    { id: 'todocampo', name: 'Lateral de élite', desc: 'Dueño absoluto de su banda', tier: 3, cost: 3, attrs: { pace: 3, defending: 3, passing: 2 }, requires: ['subida', 'anticipo'] }
  ],
  DM: [
    { id: 'posicion', name: 'Ancla posicional', desc: 'Siempre cubre la zona del mediocentro', tier: 1, cost: 1, attrs: { defending: 3 }, requires: [] },
    { id: 'pase', name: 'Primer pase', desc: 'Saca el balón limpio desde atrás', tier: 1, cost: 1, attrs: { passing: 3 }, requires: [] },
    { id: 'fisico', name: 'Pulmón', desc: 'Recorre más metros que nadie', tier: 1, cost: 1, attrs: { physical: 3 }, requires: [] },
    { id: 'robo', name: 'Pivote robón', desc: 'Lectura para cortar el contraataque', tier: 2, cost: 2, attrs: { defending: 4 }, requires: ['posicion'] },
    { id: 'distribucion', name: 'Distribución de juego', desc: 'Cambia de orientación con precisión', tier: 2, cost: 2, attrs: { passing: 4 }, requires: ['pase'] },
    { id: 'muro', name: 'Muro del mediocampo', desc: 'Nadie pasa por su zona', tier: 3, cost: 3, attrs: { defending: 3, physical: 3, passing: 2 }, requires: ['robo', 'distribucion'] }
  ],
  CM: [
    { id: 'vision', name: 'Visión de juego', desc: 'Ve el pase que nadie ve', tier: 1, cost: 1, attrs: { passing: 3 }, requires: [] },
    { id: 'conduccion', name: 'Conducción serena', desc: 'Sale de la presión sin perder el balón', tier: 1, cost: 1, attrs: { dribbling: 3 }, requires: [] },
    { id: 'ritmo', name: 'Llegada desde atrás', desc: 'Se incorpora al ataque por sorpresa', tier: 1, cost: 1, attrs: { pace: 3 }, requires: [] },
    { id: 'pasefiltrado', name: 'Pase filtrado', desc: 'Habilita a los delanteros entre líneas', tier: 2, cost: 2, attrs: { passing: 4 }, requires: ['vision'] },
    { id: 'duelo', name: 'Duelo en mediocampo', desc: 'Gana las segundas pelotas', tier: 2, cost: 2, attrs: { physical: 3, defending: 2 }, requires: ['ritmo'] },
    { id: 'motor', name: 'Motor del equipo', desc: 'Box-to-box de élite', tier: 3, cost: 3, attrs: { passing: 3, physical: 3, dribbling: 2 }, requires: ['pasefiltrado', 'duelo'] }
  ],
  AM: [
    { id: 'asistencia', name: 'Ojo de águila', desc: 'Asistencia milimétrica', tier: 1, cost: 1, attrs: { passing: 3 }, requires: [] },
    { id: 'regate', name: 'Regate en tres toques', desc: 'Se gira en espacios diminutos', tier: 1, cost: 1, attrs: { dribbling: 3 }, requires: [] },
    { id: 'media', name: 'Media distancia', desc: 'Prueba desde fuera del área', tier: 1, cost: 1, attrs: { shooting: 3 }, requires: [] },
    { id: 'paseoro', name: 'Pase de oro', desc: 'Asistencias que rompen partidos', tier: 2, cost: 2, attrs: { passing: 4, dribbling: 2 }, requires: ['asistencia'] },
    { id: 'gancho', name: 'Gancho en la frontal', desc: 'Remate colocado desde la frontal', tier: 2, cost: 2, attrs: { shooting: 4 }, requires: ['media'] },
    { id: 'magia', name: 'Diez mágico', desc: 'El equipo juega a su ritmo', tier: 3, cost: 3, attrs: { passing: 3, dribbling: 3, shooting: 2 }, requires: ['paseoro', 'gancho'] }
  ],
  WINGER: [
    { id: 'explosividad', name: 'Explosividad', desc: 'Aceleración brutal en los primeros metros', tier: 1, cost: 1, attrs: { pace: 3 }, requires: [] },
    { id: 'amagofinta', name: 'Amago y finta', desc: 'Deja al lateral sentado', tier: 1, cost: 1, attrs: { dribbling: 3 }, requires: [] },
    { id: 'centro', name: 'Centro raso', desc: 'Asistencias al segundo palo', tier: 1, cost: 1, attrs: { passing: 3 }, requires: [] },
    { id: 'banda', name: 'Dueño de la banda', desc: 'Encara y supera una y otra vez', tier: 2, cost: 2, attrs: { dribbling: 4, pace: 2 }, requires: ['amagofinta'] },
    { id: 'cortado', name: 'Disparo cortado', desc: 'Define al segundo palo tras cortarse', tier: 2, cost: 2, attrs: { shooting: 4 }, requires: ['centro'] },
    { id: 'extremo', name: 'Extremo de élite', desc: 'Desequilibrio constante', tier: 3, cost: 3, attrs: { pace: 3, dribbling: 3, shooting: 2 }, requires: ['banda', 'cortado'] }
  ],
  ST: [
    { id: 'definicion', name: 'Definición', desc: 'Friaza ante el portero', tier: 1, cost: 1, attrs: { shooting: 3 }, requires: [] },
    { id: 'desmarque', name: 'Desmarque', desc: 'Se escapa de la marca en el momento justo', tier: 1, cost: 1, attrs: { pace: 3 }, requires: [] },
    { id: 'potencia', name: 'Potencia de disparo', desc: 'Remate seco desde cualquier ángulo', tier: 1, cost: 1, attrs: { shooting: 2, physical: 2 }, requires: [] },
    { id: 'disparocertero', name: 'Disparo certero', desc: 'Ajusta el disparo al palo largo', tier: 2, cost: 2, attrs: { shooting: 4 }, requires: ['definicion'] },
    { id: 'cabezazo', name: 'Cabezazo salvador', desc: 'Gana los centros con autoridad', tier: 2, cost: 2, attrs: { shooting: 3, physical: 2 }, requires: ['potencia'] },
    { id: 'letal', name: 'Delantero letal', desc: 'Convierte media ocasión en gol', tier: 3, cost: 3, attrs: { shooting: 3, dribbling: 2, pace: 2 }, requires: ['disparocertero', 'cabezazo'] }
  ]
};

const TREE_FOR_POS = {
  GK: 'GK', CB: 'CB', LB: 'FULLBACK', RB: 'FULLBACK',
  DM: 'DM', CM: 'CM', AM: 'AM', LW: 'WINGER', RW: 'WINGER', ST: 'ST'
};

function treeFor(pos) {
  return TREES[TREE_FOR_POS[pos] || 'CM'] || [];
}

function skillById(pos, skillId) {
  return treeFor(pos).find(s => s.id === skillId) || null;
}

function attrsKeysFor(pos) {
  return pos === 'GK' ? GK_KEYS : ATTR_KEYS;
}

function skillState(player, skill) {
  if (player.skills && player.skills.includes(skill.id)) return 'unlocked';
  const missing = (skill.requires || []).filter(r => !(player.skills || []).includes(r));
  if (missing.length) return 'locked';
  if ((player.skillPoints || 0) < skill.cost) return 'no-points';
  return 'available';
}

function canUnlock(player, skillId) {
  const skill = skillById(player.pos, skillId);
  if (!skill) return { ok: false, reason: 'Habilidad no válida para la posición ' + player.pos };
  const state = skillState(player, skill);
  if (state === 'unlocked') return { ok: false, reason: player.name + ' ya tiene esa habilidad' };
  if (state === 'locked') return { ok: false, reason: 'Faltan requisitos previos para ' + skill.name };
  if (state === 'no-points') return { ok: false, reason: 'Puntos de habilidad insuficientes (coste: ' + skill.cost + ')' };
  return { ok: true, skill };
}

function unlockSkill(player, skillId) {
  const check = canUnlock(player, skillId);
  if (!check.ok) return check;
  const skill = check.skill;
  player.skillPoints = (player.skillPoints || 0) - skill.cost;
  player.skills = (player.skills || []).concat(skill.id);
  for (const [key, bonus] of Object.entries(skill.attrs)) {
    if (player.attrs[key] != null) player.attrs[key] = clamp(player.attrs[key] + bonus, 20, 99);
  }
  player.overall = overallOf(player);
  player.value = computeValue(player);
  return { ok: true, skill, player };
}

function grantPoints(player, n) {
  if (n > 0) player.skillPoints = (player.skillPoints || 0) + n;
  return player;
}

function pointsSummary(player) {
  const tree = treeFor(player.pos);
  const spent = tree.filter(s => (player.skills || []).includes(s.id)).reduce((a, s) => a + s.cost, 0);
  return { total: spent + (player.skillPoints || 0), spent, available: player.skillPoints || 0 };
}

function treesByPosition() {
  const out = {};
  for (const pos of Object.keys(TREE_FOR_POS)) out[pos] = TREES[TREE_FOR_POS[pos]];
  return out;
}

module.exports = { TREES, TREE_FOR_POS, treeFor, skillById, skillState, canUnlock, unlockSkill, grantPoints, pointsSummary, attrsKeysFor, treesByPosition };

},
  "server/engine/medical.js": function (exports, require, module) {
'use strict';

/* ================= FC Galaxy — enfermería: tratamientos de recuperación ================= */

const finance = require('./finance');
const { fmtMoney } = require('./game');

const TREATMENTS = [
  { id: 'physio', name: 'Fisioterapia', weeks: 1, costPerWeek: 150000 },
  { id: 'intensive', name: 'Tratamiento intensivo', weeks: 2, costPerWeek: 300000 },
  { id: 'surgery', name: 'Cirugía exprés', weeks: 4, costPerWeek: 520000 }
];

/* El nivel del centro médico acelera: +1 semana de reducción a partir de nivel 5
   y un descuento del 5% por nivel (máx. 25% con nivel 6). */
function treatmentQuote(injuryWeeks, treatmentId, medicalLevel) {
  const t = TREATMENTS.find(x => x.id === treatmentId);
  if (!t) throw new Error('Tratamiento desconocido');
  const weeks = Math.max(1, injuryWeeks);
  const reduction = Math.min(weeks, t.weeks + (medicalLevel >= 5 ? 1 : 0));
  const discount = 1 - 0.05 * (Math.max(1, Math.min(6, medicalLevel)) - 1);
  const cost = Math.round(t.costPerWeek * reduction * discount);
  return { treatment: t, reduction, cost };
}

function treatPlayer(state, playerId, treatmentId) {
  const club = state.clubs[state.userClubId];
  const p = state.players[playerId];
  if (!p || !club.squad.includes(p.id)) throw new Error('Jugador no encontrado en tu plantilla');
  if (!p.injury) throw new Error(p.name + ' no está lesionado');
  const { treatment, reduction, cost } = treatmentQuote(p.injury.weeks, treatmentId, club.facilities.medical);
  if (club.budget < cost) throw new Error('Necesitas ' + fmtMoney(cost) + ' FCG para el tratamiento');
  finance.addLedger(state, state.userClubId, {
    concept: 'Tratamiento (' + treatment.name + ') para ' + p.name,
    amount: -cost, category: 'sanidad'
  });
  p.injury.weeks -= reduction;
  const recovered = p.injury.weeks <= 0;
  if (recovered) p.injury = null;
  return {
    ok: true,
    player: p.name,
    treatment: treatment.name,
    reduction,
    cost,
    recovered,
    weeksLeft: recovered ? 0 : p.injury.weeks,
    message: recovered
      ? p.name + ' ha sido dado de alta tras ' + treatment.name.toLowerCase() + ' (' + fmtMoney(cost) + ' FCG).'
      : p.name + ' reduce su baja a ' + p.injury.weeks + ' sem. tras ' + treatment.name.toLowerCase() + ' (' + fmtMoney(cost) + ' FCG).'
  };
}

module.exports = { TREATMENTS, treatmentQuote, treatPlayer };

},
  "server/engine/game.js": function (exports, require, module) {
'use strict';

const { Rng } = require('./rng');
const { CITIES, randomName, DEFAULT_COUNTRY, countryOf } = require('./names');
const { generatePlayer, computeValue, wageDemand, growthForPlayer, applyGrowth, clamp } = require('./player');
const { generateClubSquad, createClub, aiClubName, FORMATIONS, generateCrest, generateKit } = require('./club');
const { TEAMS, PRIZE_MONEY, buildFixtures, computeTable, currentRoundFixtures, allRoundMatchesPlayed } = require('./league');
const matchEngine = require('./match');
const finance = require('./finance');
const youth = require('./youth');
const market = require('./market');
const sponsors = require('./sponsors');

const chainMod = require('../../blockchain/chain');
const tokenMod = require('../../blockchain/token');
const nftMod = require('../../blockchain/nft');
const contractMod = require('../../blockchain/contract');

const SAVE_VERSION = 5;

/* Rellena los campos añadidos en versiones posteriores para que las partidas
   antiguas (v3) sigan funcionando sin perder progreso. */
function migrate(state) {
  if (!state || state.version >= SAVE_VERSION) return state;
  for (const clubId of Object.keys(state.clubs || {})) {
    const club = state.clubs[clubId];
    if (!club.country) club.country = DEFAULT_COUNTRY;
    if (!club.crest) club.crest = generateCrest(new Rng(clubId.length * 7919), club.primaryColor, club.secondaryColor, club.shortName);
    if (!club.kit) club.kit = generateKit(new Rng(clubId.length * 104729), club.primaryColor, club.secondaryColor);
    if (!club.standSponsors) club.standSponsors = {};
    if (club.sponsor && club.sponsor.deal === undefined) club.sponsor.deal = null;
    for (const pid of club.squad || []) {
      const p = state.players[pid];
      if (p && !p.nationality) p.nationality = DEFAULT_COUNTRY;
    }
  }
  if (!state.sponsorOffers) state.sponsorOffers = [];
  for (const p of Object.values(state.players || {})) {
    if (!p.skills) p.skills = [];
    if (p.skillPoints == null) p.skillPoints = 0;
  }
  state.version = SAVE_VERSION;
  return state;
}

function walletAddress(state, clubId) {
  return '0xSIM' + clubId.replace(/[^a-z0-9]/gi, '').toUpperCase().padEnd(8, '0').slice(0, 8);
}

function syncWallet(state, clubId, memo) {
  const club = state.clubs[clubId];
  const addr = club.wallet;
  const bal = tokenMod.balanceOf(state.token, addr);
  const delta = Math.round(club.budget) - bal;
  if (delta > 0) {
    const tx = tokenMod.mint(state.token, addr, delta, memo || 'Sincronización económica semanal (simulada)');
    return tx;
  } else if (delta < 0) {
    const tx = tokenMod.burn(state.token, addr, -delta, memo || 'Ajuste económico semanal (simulado)');
    return tx;
  }
  return null;
}

function newGame(opts) {
  const rng = new Rng();
  const season = 1;
  const state = {
    version: SAVE_VERSION,
    createdAt: Date.now(),
    rngSeed: rng.seed,
    rng,
    phase: 'season',
    season,
    week: 1,
    userClubId: null,
    clubs: {},
    players: {},
    youth: {},
    market: { listings: [], offers: [], transferHistory: [], freeAgents: [] },
    league: { clubIds: [], fixtures: [], round: 0, champion: null },
    chain: null,
    token: null,
    nft: null,
    inbox: [],
    news: [],
    sponsorOffers: [],
    pendingMatch: null,
    lastResults: [],
    seasonAwards: null
  };

  const usedNames = new Set();
  const levels = [72, 69, 67, 65, 63, 61, 60, 58, 56, 54, 52, 50];
  const shuffledLevels = rng.shuffle(levels.slice());

  const country = countryOf(opts.country) ? opts.country : DEFAULT_COUNTRY;
  const userClub = createClub(rng, {
    id: 'user-club',
    name: opts.clubName || 'Mi Club',
    shortName: (opts.shortName || (opts.clubName || 'MCL').slice(0, 3)).toUpperCase(),
    city: opts.city || rng.pick(CITIES),
    primaryColor: opts.primaryColor || '#c8102e',
    secondaryColor: opts.secondaryColor || '#ffffff',
    formation: opts.formation || '4-3-3',
    crest: opts.crest || undefined,
    kit: opts.kit || undefined,
    country,
    isUser: true,
    reputation: 50, fanbase: 750000, budget: 12000000,
    capacity: 24000, trainingLevel: 2, youthLevel: 2, medicalLevel: 2
  });
  userClub.managerName = opts.managerName || 'El Míster';
  const userSquad = generateClubSquad(rng, 60, season, country);
  state.clubs[userClub.id] = userClub;
  state.userClubId = userClub.id;

  const clubIds = [userClub.id];
  for (let i = 0; i < TEAMS - 1; i++) {
    const level = shuffledLevels[i];
    const rep = Math.round(30 + (level - 50) * 1.6);
    const club = createClub(rng, {
      name: aiClubName(rng, usedNames),
      city: rng.pick(CITIES),
      country,
      reputation: clamp(rep, 25, 85),
      fanbase: Math.round((200000 + rep * 22000) * rng.range(0.7, 1.3)),
      budget: Math.round((3000000 + rep * 220000) * rng.range(0.8, 1.25)),
      capacity: Math.round((12000 + rep * 550) * rng.range(0.75, 1.25)),
      trainingLevel: clamp(Math.round(rep / 22), 1, 5),
      youthLevel: clamp(Math.round(rep / 25), 1, 5),
      medicalLevel: clamp(Math.round(rep / 28), 1, 5),
      formation: rng.pick(Object.keys(FORMATIONS))
    });
    const squad = generateClubSquad(rng, level, season, country);
    state.clubs[club.id] = club;
    clubIds.push(club.id);
    for (const p of squad) { state.players[p.id] = p; }
    club.squad = squad.map(p => p.id);
    club.lineup = matchEngine.autoPickLineup(club, state.players);
  }
  for (const p of userSquad) { state.players[p.id] = p; }
  userClub.squad = userSquad.map(p => p.id);
  userClub.lineup = matchEngine.autoPickLineup(userClub, state.players);

  state.league.clubIds = clubIds;
  state.league.fixtures = buildFixtures(clubIds, rng);

  // Capa blockchain simulada
  state.chain = chainMod.createChain();
  state.token = tokenMod.createTokenLedger();
  state.nft = nftMod.createAssetRegistry();

  const mintTxs = [];
  for (const clubId of clubIds) {
    const club = state.clubs[clubId];
    club.wallet = walletAddress(state, clubId);
    mintTxs.push(tokenMod.mint(state.token, club.wallet, Math.round(club.budget), 'Dotación inicial de tesorería (simulada)'));
    for (const pid of club.squad) {
      const p = state.players[pid];
      const mintTx = nftMod.mintAsset(state.nft, pid, club.wallet, { name: p.name, position: p.pos, overall: p.overall });
      p.tokenId = mintTx.tokenId;
      mintTxs.push(mintTx);
    }
  }
  chainMod.addBlock(state.chain, mintTxs);

  market.aiGenerateListings(state);
  sponsors.refreshOffers(state);
  pushInbox(state, 'welcome', '¡Bienvenido a ' + userClub.name + '!', 'Eres el nuevo mánager. Configura tu alineación en Tácticas, entrena a tus jugadores y disputa la jornada 1. Tu tesorería inicial es de ' + fmtMoney(userClub.budget) + ' FCG. Todos los activos y transacciones se registran en la SIMCHAIN (blockchain simulada).');
  return state;
}

function fmtMoney(v) {
  if (Math.abs(v) >= 1000000) return (v / 1000000).toFixed(2) + 'M';
  if (Math.abs(v) >= 1000) return Math.round(v / 1000) + 'K';
  return String(Math.round(v));
}

function pushInbox(state, type, title, body) {
  state.inbox.unshift({ id: 'msg-' + (state._msgCounter = (state._msgCounter || 0) + 1), type, title, body, week: state.week, season: state.season, read: false });
  if (state.inbox.length > 120) state.inbox.length = 120;
}

function clubOfPlayer(state, playerId) {
  for (const id of state.league.clubIds) {
    if (state.clubs[id].squad.includes(playerId)) return state.clubs[id];
  }
  return null;
}

// ---------- Partidos ----------

function getUserFixture(state) {
  for (const m of currentRoundFixtures(state)) {
    if (m.played) continue;
    if (m.home === state.userClubId || m.away === state.userClubId) return m;
  }
  return null;
}

function startMatch(state) {
  if (state.pendingMatch) return state.pendingMatch;
  const fixture = getUserFixture(state);
  if (!fixture) throw new Error('No tienes partido pendiente esta jornada');
  const match = matchEngine.createMatch(state, fixture.home, fixture.away);
  state.pendingMatch = match;
  const events = matchEngine.runSegment(state, match, 45);
  return match;
}

function resumeMatch(state, decisions) {
  const match = state.pendingMatch;
  if (!match) throw new Error('No hay partido en curso');
  if (match.finished) throw new Error('El partido ya terminó');
  const userSide = match.homeId === state.userClubId ? 0 : 1;
  const club = state.clubs[state.userClubId];

  if (decisions) {
    if (decisions.mentality && ['defensive', 'balanced', 'attacking'].includes(decisions.mentality)) {
      club.mentality = decisions.mentality;
      match._formations[userSide] = club.formation;
    }
    if (decisions.formation && FORMATIONS[decisions.formation]) {
      club.formation = decisions.formation;
      match._formations[userSide] = decisions.formation;
      if (decisions.lineup && Array.isArray(decisions.lineup)) {
        const valid = decisions.lineup.filter(id => club.squad.includes(id) && state.players[id] && !state.players[id].injury && state.players[id].ban <= 0);
        if (valid.length === matchEngine.formationSlots(decisions.formation).length) {
          match.lineups[userSide === 0 ? 'home' : 'away'] = valid;
        }
      }
    }
    if (Array.isArray(decisions.subs)) {
      for (const sub of decisions.subs) {
        applySub(state, match, userSide, sub.outId, sub.inId);
      }
    }
  }

  const from = match.minute;
  const target = match.minute < 45 ? 45 : match.minute < 75 ? 75 : 90;
  matchEngine.runSegment(state, match, target);
  if (match.finished) {
    commitMatch(state, match);
    state.pendingMatch = null;
  }
  return match;
}

function applySub(state, match, userSide, outId, inId) {
  const key = userSide === 0 ? 'home' : 'away';
  const lineup = match.lineups[key];
  const bench = match.benches[key];
  if (!lineup.includes(outId)) throw new Error('El jugador que sale no está en el campo');
  if (!bench.includes(inId)) throw new Error('El suplente no está en el banquillo');
  if (match.subsUsed[key] >= 5) throw new Error('Ya has usado los 5 cambios permitidos');
  const outP = state.players[outId], inP = state.players[inId];
  if (inP.injury || inP.ban > 0) throw new Error('El suplente no está disponible');
  match.lineups[key] = lineup.map(id => (id === outId ? inId : id));
  match.benches[key] = bench.filter(id => id !== inId);
  match.subsUsed[key]++;
  pushLiveEvent(match, { type: 'sub', side: userSide, outId, outName: outP.name, inId, inName: inP.name, text: `🔄 Cambio: entra ${inP.name} por ${outP.name}` });
}

function pushLiveEvent(match, ev) {
  ev.minute = match.minute;
  match.events.push(ev);
}

function simUserMatch(state) {
  const match = state.pendingMatch || (() => {
    const m = matchEngine.createMatch(state, getUserFixture(state).home, getUserFixture(state).away);
    state.pendingMatch = m;
    return m;
  })();
  while (!match.finished) {
    matchEngine.runSegment(state, match, match.minute < 45 ? 45 : match.minute < 75 ? 75 : 90);
  }
  commitMatch(state, match);
  state.pendingMatch = null;
  return match;
}

function commitMatch(state, match) {
  const fixture = currentRoundFixtures(state).find(m => !m.played && (m.home === match.homeId && m.away === match.awayId));
  if (fixture) {
    fixture.played = true;
    fixture.score = match.score.slice();
  }
  state.lastResults.unshift({ season: state.season, round: state.league.round, homeId: match.homeId, awayId: match.awayId, score: match.score.slice(), events: match.events });
  if (state.lastResults.length > 30) state.lastResults.length = 30;

  const userIsHome = match.homeId === state.userClubId;
  const homeClub = state.clubs[match.homeId];
  const awayClub = state.clubs[match.awayId];

  if (homeClub.isUser || awayClub.isUser) {
    const userId = state.userClubId;
    const gf = userIsHome ? match.score[0] : match.score[1];
    const ga = userIsHome ? match.score[1] : match.score[0];
    const oppId = userIsHome ? match.awayId : match.homeId;
    const gate = finance.gateReceipts(state, userId, oppId);
    let repDelta = 0;
    if (gf > ga) repDelta = 1.2; else if (gf < ga) repDelta = -0.8; else repDelta = 0.1;
    state.clubs[userId].reputation = clamp(state.clubs[userId].reputation + repDelta, 10, 95);
    const opp = state.clubs[oppId];
    pushInbox(state, 'result', `Resultado: ${homeClub.shortName} ${match.score[0]}-${match.score[1]} ${awayClub.shortName}`,
      `${gf > ga ? '¡Victoria!' : gf === ga ? 'Empate.' : 'Derrota.'} Taquilla: ${fmtMoney(gate.income)} FCG (${gate.attendance} espectadores).`);
  } else {
    homeClub.reputation = clamp(homeClub.reputation + (match.score[0] > match.score[1] ? 0.4 : match.score[0] < match.score[1] ? -0.3 : 0), 10, 95);
    awayClub.reputation = clamp(awayClub.reputation + (match.score[1] > match.score[0] ? 0.4 : match.score[1] < match.score[0] ? -0.3 : 0), 10, 95);
  }

  for (const clubId of [match.homeId, match.awayId]) {
    const club = state.clubs[clubId];
    for (const pid of club.squad) {
      const p = state.players[pid];
      if (!p) continue;
      if (!match.lineups[clubId === match.homeId ? 'home' : 'away'].includes(pid) && !p.injury) {
        p.fatigue = clamp(p.fatigue - 6, 0, 100);
        if (!match.lineups[clubId === match.homeId ? 'home' : 'away'].includes(pid)) {
          const playedRecently = match.events.some(e => (e.inId === pid));
          if (!playedRecently) p.morale = clamp(p.morale - 1, 20, 99);
        }
      }
    }
  }
}

function simulateAiFixtures(state) {
  const results = [];
  for (const m of currentRoundFixtures(state)) {
    if (m.played) continue;
    if (m.home === state.userClubId || m.away === state.userClubId) continue;
    const match = matchEngine.createMatch(state, m.home, m.away);
    while (!match.finished) {
      matchEngine.runSegment(state, match, match.minute < 45 ? 45 : match.minute < 75 ? 75 : 90);
    }
    m.played = true;
    m.score = match.score.slice();
    results.push({ homeId: m.home, awayId: m.away, score: m.score.slice() });
  }
  return results;
}

// ---------- Avance de semana ----------

function advanceWeek(state, opts) {
  opts = opts || {};
  if (state.phase !== 'season') throw new Error('La temporada ha terminado. Inicia la siguiente.');
  const fixture = getUserFixture(state);
  if (fixture && !state.pendingMatch) {
    if (opts.simUserMatch) {
      simUserMatch(state);
    } else {
      throw new Error('Tienes un partido pendiente. Juega, simula o usa la opción de auto-simular.');
    }
  }
  if (state.pendingMatch) throw new Error('Termina el partido en curso primero');

  if (!allRoundMatchesPlayed(state)) simulateAiFixtures(state);
  if (!allRoundMatchesPlayed(state)) throw new Error('Error interno: quedan partidos sin jugar');

  const weekly = processWeekly(state);

  state.week++;
  state.league.round++;
  const totalRounds = state.league.fixtures.length;
  if (state.league.round >= totalRounds) {
    endSeason(state);
  } else {
    market.aiGenerateListings(state);
  }
  return weekly;
}

function processWeekly(state) {
  const summary = { finances: {}, training: [], youth: [], offers: [], injuries: [], contracts: [] };

  for (const clubId of state.league.clubIds) {
    finance.weeklyFinances(state, clubId);
    const players = state.clubs[clubId].squad.map(id => state.players[id]).filter(Boolean);
    for (const p of players) {
      if (p.injury) {
        p.injury.weeks -= 1 + Math.floor(state.clubs[clubId].facilities.medical / 2.5);
        if (p.injury.weeks <= 0) { p.injury = null; }
      }
      p.ban = Math.max(0, p.ban - 1);
      p.fatigue = clamp(p.fatigue - 22, 0, 100);
      p.morale = clamp(p.morale + (p.morale < 40 ? 2 : 0), 20, 99);
    }
  }

  const user = state.clubs[state.userClubId];
  for (const pid of user.squad) {
    const p = state.players[pid];
    if (!p || p.injury) continue;
    const focus = user.playerTraining[pid] || user.trainingFocus;
    const { decline, gains } = growthForPlayer(p, state.rng, user.facilities.training, focus);
    const delta = applyGrowth(p, gains, decline);
    if (delta > 0) summary.training.push({ playerId: pid, name: p.name, delta });
    p.fatigue = clamp(p.fatigue + 6, 0, 100);
    if (state.rng.chance(0.008)) {
      p.injury = { type: 'molestia en entrenamiento', weeks: 1 };
      summary.injuries.push(p.name);
    }
  }

  for (const clubId of state.league.clubIds) {
    const fresh = youth.weeklyYouth(state, clubId);
    if (clubId === state.userClubId) {
      for (const p of fresh) {
        summary.youth.push(p);
        pushInbox(state, 'youth', '💎 Nueva promesa en la cantera', `${p.name} (${p.pos}, ${p.age} años) ha destacado en los entrenamientos de la cantera. Valoración media actual: ${p.overall}. Reclútalo desde la sección Cantera.`);
      }
    }
  }

  market.aiGenerateListings(state);

  const sponsorOffers = sponsors.refreshOffers(state);
  summary.sponsorOffers = sponsorOffers.length;

  const newOffers = [];
  for (const listing of state.market.listings.slice()) {
    if (listing.sellerClubId === state.userClubId) {
      const bid = market.aiBidOnListing(state, listing);
      if (bid) {
        state.market.offers.push(bid);
        newOffers.push(bid);
        const p = state.players[bid.playerId];
        pushInbox(state, 'offer', `Oferta por ${p.name}`, `${state.clubs[bid.fromClubId].name} ofrece ${fmtMoney(bid.amount)} FCG por tu jugador (publicado en ${fmtMoney(listing.price)} FCG). Responde en Mercado → Ofertas.`);
      }
    }
  }
  const direct = market.aiOfferForSquadPlayer(state, state.userClubId);
  if (direct) {
    state.market.offers.push(direct);
    newOffers.push(direct);
    const p = state.players[direct.playerId];
    pushInbox(state, 'offer', `Oferta directa por ${p.name}`, `${state.clubs[direct.fromClubId].name} ofrece ${fmtMoney(direct.amount)} FCG. Puedes aceptar o rechazar en Mercado → Ofertas.`);
  }
  summary.offers = newOffers;

  for (const clubId of state.league.clubIds) {
    const club = state.clubs[clubId];
    for (const pid of club.squad) {
      const p = state.players[pid];
      if (p && p.contract.until - state.season <= 1 && p.contract.until - state.season >= 0) {
        if (clubId === state.userClubId && state.week > state.league.fixtures.length - 6) {
          summary.contracts.push({ playerId: pid, name: p.name, until: p.contract.until });
        }
      }
    }
  }

  const syncTxs = [];
  for (const clubId of state.league.clubIds) {
    const tx = syncWallet(state, clubId);
    if (tx) syncTxs.push(tx);
  }
  if (syncTxs.length) chainMod.addBlock(state.chain, syncTxs);

  return summary;
}

// ---------- Fichajes ----------

function executeTransfer(state, buyerClubId, sellerClubId, playerId, price, opts) {
  const buyer = state.clubs[buyerClubId];
  const seller = state.clubs[sellerClubId];
  const p = state.players[playerId];
  if (!p) throw new Error('Jugador no encontrado');
  if (!seller.squad.includes(playerId)) throw new Error('El vendedor ya no tiene a ese jugador');
  if (buyer.squad.length >= 30) throw new Error('Plantilla llena (máximo 30 jugadores)');
  if (seller.squad.length <= 14) throw new Error('El club vendedor no puede bajar de 14 jugadores');
  if (state.pendingMatch && (state.pendingMatch.lineups.home.includes(playerId) || state.pendingMatch.lineups.away.includes(playerId))) {
    throw new Error('El jugador está disputando un partido ahora mismo');
  }

  const tokenId = p.tokenId;
  const receipt = contractMod.simulateTransfer(
    { chain: state.chain, addBlock: chainMod.addBlock, token: state.token, nft: state.nft },
    { tokenId, from: seller.wallet, to: buyer.wallet, price, playerId, memo: `Traspaso de ${p.name} (${seller.name} → ${buyer.name})` }
  );

  seller.squad = seller.squad.filter(id => id !== playerId);
  buyer.squad.push(playerId);
  seller.budget = tokenMod.balanceOf(state.token, seller.wallet);
  buyer.budget = tokenMod.balanceOf(state.token, buyer.wallet);
  finance.addLedger(state, buyerClubId, { concept: `Fichaje de ${p.name} (${seller.name})`, amount: -price, category: 'fichajes' });
  finance.addLedger(state, sellerClubId, { concept: `Venta de ${p.name} (${buyer.name})`, amount: price, category: 'fichajes' });

  const wage = opts && opts.wage ? opts.wage : wageDemand(p, state.rng);
  const years = opts && opts.years ? opts.years : 3;
  p.contract = { wage, until: state.season + years };
  p.morale = clamp(p.morale + 5, 20, 99);
  p.value = computeValue(p);

  state.market.listings = state.market.listings.filter(l => l.playerId !== playerId);
  state.market.offers = state.market.offers.filter(o => o.playerId !== playerId);

  state.market.transferHistory.unshift({
    id: receipt.txHash.slice(0, 12),
    playerId, playerName: p.name,
    fromClubId: sellerClubId, fromClubName: seller.name,
    toClubId: buyerClubId, toClubName: buyer.name,
    price, fee: receipt.fee,
    txHash: receipt.txHash, blockIndex: receipt.blockIndex,
    season: state.season, week: state.week,
    simulated: true
  });
  if (state.market.transferHistory.length > 100) state.market.transferHistory.length = 100;

  if (!buyer.isUser) {
    buyer.lineup = matchEngine.autoPickLineup(buyer, state.players);
  }
  if (buyer.isUser || seller.isUser) {
    pushInbox(state, 'transfer', `${p.name} ${buyer.isUser ? 'fichado' : 'vendido'}`,
      `${buyer.name} ↔ ${seller.name} por ${fmtMoney(price)} FCG. Salario: ${fmtMoney(wage)} FCG/semana. Transacción registrada en la SIMCHAIN (bloque #${receipt.blockIndex}, simulada).`);
  }
  return receipt;
}

function userBuyListing(state, listingId) {
  const listing = state.market.listings.find(l => l.id === listingId);
  if (!listing) throw new Error('Publicación no encontrada o expirada');
  const user = state.clubs[state.userClubId];
  const price = listing.price;
  if (user.budget < price * 1.05) throw new Error(`Fondos insuficientes: necesitas ${fmtMoney(price)} FCG + comisión (~4%)`);
  return executeTransfer(state, state.userClubId, listing.sellerClubId, listing.playerId, price);
}

function userMakeOffer(state, playerId, amount) {
  const listing = state.market.listings.find(l => l.playerId === playerId);
  if (!listing) throw new Error('Ese jugador no está en el mercado');
  const seller = state.clubs[listing.sellerClubId];
  if (seller.isUser) throw new Error('No puedes negociar contigo mismo');
  const user = state.clubs[state.userClubId];
  if (user.budget < amount) throw new Error('No tienes saldo FCG suficiente para esa oferta');
  const response = market.evaluateAiResponse(state, playerId, listing.sellerClubId, amount);
  if (response.accept) {
    const receipt = executeTransfer(state, state.userClubId, listing.sellerClubId, playerId, amount);
    return { accepted: true, receipt, message: `¡${state.players[playerId].name} es tuyo! Traspaso ejecutado por ${fmtMoney(amount)} FCG.` };
  }
  if (response.counter) {
    listing.price = response.counter;
    return { accepted: false, counter: response.counter, message: `Contraoferta de ${seller.name}: piden ${fmtMoney(response.counter)} FCG. El precio de la publicación se ha actualizado.` };
  }
  return { accepted: false, message: response.reason || `${seller.name} ha rechazado tu oferta.` };
}

function respondOffer(state, offerId, accept) {
  const offer = state.market.offers.find(o => o.id === offerId && o.status === 'pending');
  if (!offer) throw new Error('Oferta no encontrada o ya gestionada');
  if (offer.toClubId !== state.userClubId) throw new Error('Esa oferta no va dirigida a tu club');
  const p = state.players[offer.playerId];
  if (!accept) {
    offer.status = 'rejected';
    return { message: `Oferta por ${p.name} rechazada.` };
  }
  const buyer = state.clubs[offer.fromClubId];
  if (buyer.budget < offer.amount * 1.05) {
    offer.status = 'rejected';
    return { message: `${buyer.name} no tiene fondos suficientes; la oferta queda anulada.` };
  }
  offer.status = 'accepted';
  const receipt = executeTransfer(state, offer.fromClubId, state.userClubId, offer.playerId, offer.amount);
  return { message: `${p.name} vendido a ${buyer.name} por ${fmtMoney(offer.amount)} FCG.`, receipt };
}

function renewContract(state, playerId, years) {
  const user = state.clubs[state.userClubId];
  if (!user.squad.includes(playerId)) throw new Error('Jugador no pertenece a tu plantilla');
  const p = state.players[playerId];
  years = clamp(years || 2, 1, 5);
  const newWage = Math.round(wageDemand(p, state.rng) * (1 + years * 0.06) / 100) * 100;
  const signingBonus = Math.round(p.value * 0.04 * years);
  if (user.budget < signingBonus) throw new Error(`Necesitas ${fmtMoney(signingBonus)} FCG de prima de fichaje`);
  finance.addLedger(state, state.userClubId, { concept: `Prima de renovación de ${p.name}`, amount: -signingBonus, category: 'salarios' });
  p.contract = { wage: newWage, until: state.season + years };
  p.morale = clamp(p.morale + 6, 20, 99);
  return { wage: newWage, until: p.contract.until, bonus: signingBonus };
}

// ---------- Instalaciones ----------

function upgradeFacility(state, type) {
  const user = state.clubs[state.userClubId];
  const validTypes = ['training', 'youth', 'medical', 'stadium'];
  if (!validTypes.includes(type)) throw new Error('Tipo de mejora inválido');
  const currentLevel = type === 'stadium' ? Math.round(user.stadium.capacity / 12000) : user.facilities[type];
  if (currentLevel >= 6) throw new Error('Nivel máximo alcanzado');
  const cost = finance.facilityCost(type, currentLevel + 1);
  if (user.budget < cost) throw new Error(`Necesitas ${fmtMoney(cost)} FCG`);
  finance.addLedger(state, state.userClubId, { concept: `Mejora de ${type === 'stadium' ? 'estadio' : type === 'training' ? 'centro de entrenamiento' : type === 'youth' ? 'cantera' : 'médico'} a nivel ${currentLevel + 1}`, amount: -cost, category: 'instalaciones' });
  if (type === 'stadium') {
    user.stadium.capacity += 8000;
  } else {
    user.facilities[type] = currentLevel + 1;
  }
  return { type, level: currentLevel + 1, cost };
}

// ---------- Fin de temporada ----------

function endSeason(state) {
  const table = computeTable(state);
  state.league.champion = table[0].clubId;
  const awards = { season: state.season, champion: state.clubs[table[0].clubId].name, topScorer: null, bestPlayer: null, userPosition: null, prize: 0 };

  let topScorer = null;
  for (const id of state.league.clubIds) {
    for (const pid of state.clubs[id].squad) {
      const p = state.players[pid];
      if (p && (!topScorer || p.stats.goals > topScorer.goals)) {
        topScorer = { playerId: pid, name: p.name, goals: p.stats.goals, club: state.clubs[id].name };
      }
    }
  }
  awards.topScorer = topScorer;

  let bestRated = null;
  for (const id of state.league.clubIds) {
    for (const pid of state.clubs[id].squad) {
      const p = state.players[pid];
      if (p && p.stats.ratedApps >= 8 && (!bestRated || p.stats.avgRating > bestRated.rating)) {
        bestRated = { playerId: pid, name: p.name, rating: p.stats.avgRating, club: state.clubs[id].name };
      }
    }
  }
  awards.bestPlayer = bestRated;

  const userPos = table.findIndex(t => t.clubId === state.userClubId) + 1;
  awards.userPosition = userPos;
  const prize = PRIZE_MONEY[Math.min(userPos - 1, PRIZE_MONEY.length - 1)];
  awards.prize = prize;
  finance.addLedger(state, state.userClubId, { concept: `Premio por posición ${userPos}ª en liga`, amount: prize, category: 'premios' });
  const user = state.clubs[state.userClubId];
  const expected = 6;
  user.reputation = clamp(user.reputation + (expected - userPos) * 0.7, 10, 95);
  user.fanbase = Math.round(user.fanbase * (1 + (expected - userPos) * 0.012));

  for (const [i, row] of table.entries()) {
    const pos = i + 1;
    if (state.clubs[row.clubId].isUser) continue;
    const prizeI = PRIZE_MONEY[Math.min(i, PRIZE_MONEY.length - 1)];
    finance.addLedger(state, row.clubId, { concept: `Premio liga (posición ${pos})`, amount: prizeI, category: 'premios' });
  }

  state.seasonAwards = awards;
  state.phase = 'seasonEnd';
  pushInbox(state, 'season', `Temporada ${state.season} finalizada`, `Campeón: ${awards.champion}. Tu posición: ${userPos}ª. Premio: ${fmtMoney(prize)} FCG. Inicia la siguiente temporada cuando quieras.`);
}

function startNewSeason(state) {
  if (state.phase !== 'seasonEnd') throw new Error('La temporada aún no ha terminado');
  state.season++;
  state.week = 1;
  state.league.round = 0;
  state.league.champion = null;
  state.phase = 'season';
  state.pendingMatch = null;

  const retired = [];
  const freed = [];
  for (const clubId of state.league.clubIds) {
    const club = state.clubs[clubId];
    const remaining = [];
    for (const pid of club.squad) {
      const p = state.players[pid];
      p.age++;
      p.seasonHistory.push({ season: state.season - 1, apps: p.stats.apps, goals: p.stats.goals, assists: p.stats.assists, rating: p.stats.avgRating });
      p.stats = { apps: 0, goals: 0, assists: 0, yellow: 0, red: 0, avgRating: 0, ratingSum: 0, ratedApps: 0, cleanSheets: 0 };
      p.form = 0;
      p.fatigue = clamp(p.fatigue - 40, 0, 100);
      p.ban = 0;
      let retire = false;
      if (p.age >= 35 && state.rng.chance(0.45)) retire = true;
      if (p.age >= 38) retire = true;
      if (retire) {
        retired.push({ name: p.name, club: club.name, age: p.age });
        delete state.players[pid];
        continue;
      }
      if (p.contract.until < state.season) {
        if (club.isUser) {
          freed.push({ name: p.name, id: pid });
          state.nft.assets[p.tokenId].owner = '0xSIMFREEAGENT';
          p.contract = { wage: 0, until: 0 };
          state.market.freeAgents.push(p);
          continue;
        } else if (state.rng.chance(0.7)) {
          p.contract = { wage: wageDemand(p, state.rng), until: state.season + state.rng.int(1, 3) };
        } else {
          state.nft.assets[p.tokenId].owner = '0xSIMFREEAGENT';
          p.contract = { wage: 0, until: 0 };
          state.market.freeAgents.push(p);
          continue;
        }
      }
      remaining.push(pid);
    }
    club.squad = remaining;
    while (club.squad.length < 16) {
      const p = generatePlayer(state.rng, { level: 45 + club.reputation * 0.25, age: state.rng.int(18, 24), country: club.country });
      p.contract = { wage: wageDemand(p, state.rng), until: state.season + state.rng.int(2, 4) };
      state.players[p.id] = p;
      const mintTx = nftMod.mintAsset(state.nft, p.id, club.wallet, { name: p.name, position: p.pos, overall: p.overall });
      p.tokenId = mintTx.tokenId;
      chainMod.addBlock(state.chain, [mintTx]);
      club.squad.push(p.id);
    }
    club.lineup = matchEngine.autoPickLineup(club, state.players);
  }

  state.league.fixtures = buildFixtures(state.league.clubIds, state.rng);
  market.aiGenerateListings(state);
  const expiredSponsors = sponsors.expireDeals(state, state.userClubId);
  sponsors.refreshOffers(state);
  syncWallet(state, state.userClubId, 'Ajuste de inicio de temporada');

  pushInbox(state, 'season', `¡Arranca la temporada ${state.season}!`, `${retired.length} retiradas, ${state.market.freeAgents.length} agentes libres disponibles en el mercado. Nueva calendario generado.${expiredSponsors.length ? ' Contratos de patrocinio vencidos: ' + expiredSponsors.join(', ') + '.' : ''} ¡A por todas!`);
  if (freed.length) {
    pushInbox(state, 'warning', 'Contratos vencidos', `Los siguientes jugadores no tenían contrato vigente y han quedado libres: ${freed.map(f => f.name).join(', ')}. Renueva a tiempo la próxima vez.`);
  }
  return { retired, freeAgents: state.market.freeAgents.length };
}

// ---------- Consultas ----------

function scoutPlayer(state, playerId) {
  const user = state.clubs[state.userClubId];
  const cost = 45000;
  if (user.budget < cost) throw new Error(`Necesitas ${fmtMoney(cost)} FCG para el informe de ojeadores`);
  finance.addLedger(state, state.userClubId, { concept: `Informe de ojeadores`, amount: -cost, category: 'ojeadores' });
  const p = state.players[playerId];
  if (p) p.scouted = true;
  const club = clubOfPlayer(state, playerId);
  return { cost, scouted: true };
}

function signFreeAgent(state, playerId) {
  const p = state.players[playerId];
  const idx = state.market.freeAgents.findIndex(f => f.playerId === playerId || f.id === playerId);
  if (!p || idx === -1) throw new Error('Agente libre no disponible');
  const user = state.clubs[state.userClubId];
  if (user.squad.length >= 30) throw new Error('Plantilla llena (máximo 30)');
  const bonus = Math.round(p.value * 0.15);
  const wage = wageDemand(p, state.rng);
  if (user.budget < bonus + wage * 2) throw new Error(`Necesitas al menos ${fmtMoney(bonus + wage * 2)} FCG (prima + 2 semanas de ficha)`);
  p.contract = { wage, until: state.season + 2 };
  p.scouted = true;
  user.squad.push(p.id);
  state.market.freeAgents.splice(idx, 1);
  finance.addLedger(state, state.userClubId, { concept: `Fichaje de agente libre: ${p.name}`, amount: -bonus, category: 'fichajes' });
  const mintTx = nftMod.mintAsset(state.nft, p.id, user.wallet, { name: p.name, position: p.pos, overall: p.overall });
  p.tokenId = mintTx.tokenId;
  chainMod.addBlock(state.chain, [mintTx, tokenMod.burn(state.token, user.wallet, bonus, `Prima de fichaje de ${p.name} (simulada)`)]);
  user.budget = tokenMod.balanceOf(state.token, user.wallet);
  pushInbox(state, 'transfer', `${p.name} se une al club`, `Agente libre fichado por prima de ${fmtMoney(bonus)} FCG y ${fmtMoney(wage)} FCG/semana.`);
  return p;
}

module.exports = {
  SAVE_VERSION, newGame, migrate, startMatch, resumeMatch, simUserMatch, commitMatch,
  advanceWeek, processWeekly, executeTransfer, userBuyListing, userMakeOffer,
  respondOffer, renewContract, upgradeFacility, endSeason, startNewSeason,
  getUserFixture, clubOfPlayer, walletAddress, syncWallet, pushInbox, scoutPlayer,
  signFreeAgent, fmtMoney
};

},
  "server/auth-core.js": function (exports, require, module) {
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

},
  "server/auth-browser.js": function (exports, require, module) {
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

},
  "server/store-browser.js": function (exports, require, module) {
'use strict';

/* Store para el modo navegador: misma interfaz que server/store.js pero con
   localStorage. Cada cuenta tiene su clave de guardado; la partida antigua
   (clave \u00fanica) se adopta como partida de la primera cuenta que inicie sesi\u00f3n. */

const LEGACY_KEY = 'fc-galaxy-save-v1';
const KEY_PREFIX = 'fc-galaxy-save-';

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

function keyFor(accountId) {
  const safe = String(accountId || 'guest').replace(/[^a-zA-Z0-9_-]/g, '');
  return KEY_PREFIX + safe;
}

function parseState(raw) {
  if (!raw) return null;
  try {
    const state = JSON.parse(raw);
    if (state.rng && state.rng._rngState !== undefined) {
      const { Rng } = require('./engine/rng');
      state.rng = Rng.fromJSON(state.rng);
    }
    const game = require('./engine/game');
    return game.migrate(state);
  } catch (err) {
    return null;
  }
}

function createBrowserStore(accountId) {
  const KEY = keyFor(accountId);
  return {
    save(state) { storage().setItem(KEY, JSON.stringify(state)); },
    load() { return parseState(storage().getItem(KEY)); },
    exists() { return storage().getItem(KEY) != null; },
    clear() { storage().removeItem(KEY); }
  };
}

/* Adopta la partida antigua de clave \u00fanica si la cuenta a\u00fan no tiene una. */
function adoptLegacy(accountId) {
  const store = createBrowserStore(accountId);
  const legacy = storage().getItem(LEGACY_KEY);
  if (store.exists() || !legacy) return false;
  storage().setItem(keyFor(accountId), legacy);
  storage().removeItem(LEGACY_KEY);
  return true;
}

const guest = createBrowserStore('guest');

module.exports = {
  createBrowserStore, adoptLegacy,
  save: guest.save, load: guest.load, exists: guest.exists, clear: guest.clear
};

},
  "server/routes.js": function (exports, require, module) {
'use strict';

/* Rutas de la API, independientes del transporte (HTTP o navegador local). */

const game = require('./engine/game');
const leagueMod = require('./engine/league');
const chainMod = require('../blockchain/chain');

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function snapshot(state) {
  const table = state.phase === 'setup' ? [] : leagueMod.computeTable(state);
  const fixture = state.phase === 'season' ? game.getUserFixture(state) : null;
  const nextFixture = fixture ? {
    home: state.clubs[fixture.home].name, away: state.clubs[fixture.away].name,
    homeId: fixture.home, awayId: fixture.away, isHome: fixture.home === state.userClubId
  } : null;
  return {
    phase: state.phase,
    season: state.season,
    week: state.week,
    round: state.league.round,
    totalRounds: state.league.fixtures.length,
    userClubId: state.userClubId,
    clubs: state.clubs,
    players: state.players,
    youth: state.youth,
    market: state.market,
    league: { fixtures: state.league.fixtures, champion: state.league.champion },
    table,
    inbox: state.inbox,
    sponsorOffers: state.sponsorOffers || [],
    countries: require('./engine/names').COUNTRIES.map(c => ({ code: c.code, name: c.name, flag: c.flag })),
    skillTrees: require('./engine/skills').treesByPosition(),
    treatments: require('./engine/medical').TREATMENTS,
    pendingMatch: state.pendingMatch,
    lastResults: state.lastResults.slice(0, 10),
    seasonAwards: state.seasonAwards,
    chain: state.chain,
    token: { symbol: state.token.symbol, balances: state.token.balances, totalSupply: state.token.totalSupply },
    nft: state.nft,
    nextFixture
  };
}

function createRoutes({ getState, setState, store }) {
  function ensureState() {
    const s = getState();
    if (!s) throw new ApiError(409, 'No hay partida iniciada. Crea tu club primero.');
    return s;
  }

  return {
    'GET /api/state': () => {
      const state = getState();
      if (!state) return { phase: 'setup' };
      return snapshot(state);
    },

    'POST /api/game/new': (body) => {
      if (!body || !body.clubName || String(body.clubName).trim().length < 3) {
        throw new ApiError(400, 'El nombre del club debe tener al menos 3 caracteres');
      }
      if (String(body.clubName).length > 30) throw new ApiError(400, 'Nombre demasiado largo (m\u00e1x. 30)');
      const state = game.newGame({
        clubName: String(body.clubName).trim(),
        shortName: body.shortName ? String(body.shortName).trim().slice(0, 4) : undefined,
        city: body.city ? String(body.city).trim().slice(0, 30) : undefined,
        managerName: body.managerName ? String(body.managerName).trim().slice(0, 30) : undefined,
        primaryColor: body.primaryColor,
        secondaryColor: body.secondaryColor,
        formation: body.formation,
        country: body.country,
        crest: body.crest,
        kit: body.kit
      });
      setState(state);
      store.save(state);
      return snapshot(state);
    },

    'POST /api/game/reset': () => {
      store.clear();
      setState(null);
      return { phase: 'setup' };
    },

    'POST /api/match/start': () => {
      const state = ensureState();
      const match = game.startMatch(state);
      store.save(state);
      return { match };
    },

    'POST /api/match/resume': (body) => {
      const state = ensureState();
      const match = game.resumeMatch(state, body || {});
      store.save(state);
      return { match };
    },

    'POST /api/match/sim': () => {
      const state = ensureState();
      const match = game.simUserMatch(state);
      store.save(state);
      return { match };
    },

    'POST /api/week/advance': (body) => {
      const state = ensureState();
      const summary = game.advanceWeek(state, body || {});
      store.save(state);
      return { summary, snapshot: snapshot(state) };
    },

    'POST /api/season/next': () => {
      const state = ensureState();
      const result = game.startNewSeason(state);
      store.save(state);
      return { result, snapshot: snapshot(state) };
    },

    'POST /api/tactics': (body) => {
      const state = ensureState();
      const club = state.clubs[state.userClubId];
      if (body.formation) {
        const { FORMATIONS } = require('./engine/club');
        if (!FORMATIONS[body.formation]) throw new ApiError(400, 'Formaci\u00f3n inv\u00e1lida');
        club.formation = body.formation;
        club.lineup = [];
      }
      if (body.mentality && ['defensive', 'balanced', 'attacking'].includes(body.mentality)) club.mentality = body.mentality;
      if (body.pressing && ['low', 'medium', 'high'].includes(body.pressing)) club.tactics.pressing = body.pressing;
      if (Array.isArray(body.lineup)) {
        const valid = body.lineup.filter(id => club.squad.includes(id));
        const slots = require('./engine/match').formationSlots(club.formation).length;
        if (valid.length !== slots) throw new ApiError(400, `Debes seleccionar ${slots} jugadores titulares`);
        if (new Set(valid).size !== valid.length) throw new ApiError(400, 'Jugadores duplicados en la alineaci\u00f3n');
        club.lineup = valid;
      }
      store.save(state);
      return { ok: true };
    },

    'POST /api/training': (body) => {
      const state = ensureState();
      const club = state.clubs[state.userClubId];
      if (body.focus && ['balanced', 'attack', 'defense', 'technique', 'fitness'].includes(body.focus)) {
        club.trainingFocus = body.focus;
      }
      if (body.playerTraining && typeof body.playerTraining === 'object') {
        for (const [pid, focus] of Object.entries(body.playerTraining)) {
          if (club.squad.includes(pid) && ['balanced', 'attack', 'defense', 'technique', 'fitness'].includes(focus)) {
            club.playerTraining[pid] = focus;
          }
        }
      }
      store.save(state);
      return { ok: true };
    },

    'POST /api/market/list': (body) => {
      const state = ensureState();
      const listing = require('./engine/market').listPlayer(state, state.userClubId, body.playerId, Math.round(Number(body.price)));
      store.save(state);
      return { listing };
    },

    'POST /api/market/cancel': (body) => {
      const state = ensureState();
      require('./engine/market').cancelListing(state, state.userClubId, body.listingId);
      store.save(state);
      return { ok: true };
    },

    'POST /api/market/buy': (body) => {
      const state = ensureState();
      const receipt = game.userBuyListing(state, body.listingId);
      store.save(state);
      return { receipt, snapshot: snapshot(state) };
    },

    'POST /api/market/offer': (body) => {
      const state = ensureState();
      const amount = Math.round(Number(body.amount));
      if (!amount || amount <= 0) throw new ApiError(400, 'Importe de oferta inv\u00e1lido');
      const result = game.userMakeOffer(state, body.playerId, amount);
      store.save(state);
      return { ...result, snapshot: snapshot(state) };
    },

    'POST /api/offers/respond': (body) => {
      const state = ensureState();
      const result = game.respondOffer(state, body.offerId, !!body.accept);
      store.save(state);
      return { ...result, snapshot: snapshot(state) };
    },

    'POST /api/contracts/renew': (body) => {
      const state = ensureState();
      const result = game.renewContract(state, body.playerId, Number(body.years) || 2);
      store.save(state);
      return result;
    },

    'POST /api/youth/promote': (body) => {
      const state = ensureState();
      const p = require('./engine/youth').promoteYouth(state, state.userClubId, body.playerId);
      store.save(state);
      return { player: p };
    },

    'POST /api/facilities/upgrade': (body) => {
      const state = ensureState();
      const result = game.upgradeFacility(state, body.type);
      store.save(state);
      return result;
    },

    'POST /api/scout': (body) => {
      const state = ensureState();
      const result = game.scoutPlayer(state, body.playerId);
      store.save(state);
      return result;
    },

    'POST /api/freeagents/sign': (body) => {
      const state = ensureState();
      const p = game.signFreeAgent(state, body.playerId);
      store.save(state);
      return { player: p };
    },

    'POST /api/club/identity': (body) => {
      const state = ensureState();
      const club = state.clubs[state.userClubId];
      const { CREST_SHAPES, CREST_PATTERNS, CREST_FIGURES, KIT_PATTERNS } = require('./engine/club');
      if (body.crest && typeof body.crest === 'object') {
        const c = body.crest;
        if (!CREST_SHAPES.includes(c.shape) || !CREST_PATTERNS.includes(c.pattern) || !CREST_FIGURES.includes(c.figure)) {
          throw new ApiError(400, 'Escudo inválido');
        }
        const hex = /^#[0-9a-fA-F]{6}$/;
        if (!hex.test(c.c1 || '') || !hex.test(c.c2 || '')) throw new ApiError(400, 'Colores del escudo inválidos');
        club.crest = {
          shape: c.shape, pattern: c.pattern, figure: c.figure,
          c1: c.c1, c2: c.c2,
          initials: String(c.initials || club.shortName).slice(0, 4).toUpperCase()
        };
      }
      if (body.kit && typeof body.kit === 'object') {
        const k = body.kit;
        if (!KIT_PATTERNS.includes(k.pattern)) throw new ApiError(400, 'Diseño de camiseta inválido');
        const hex = /^#[0-9a-fA-F]{6}$/;
        if (!hex.test(k.c1 || '') || !hex.test(k.c2 || '')) throw new ApiError(400, 'Colores de la camiseta inválidos');
        club.kit = { pattern: k.pattern, c1: k.c1, c2: k.c2 };
      }
      if (body.name && String(body.name).trim().length >= 3) club.name = String(body.name).trim().slice(0, 30);
      if (body.shortName) club.shortName = String(body.shortName).trim().slice(0, 4).toUpperCase();
      if (club.crest) club.crest.initials = club.shortName;
      store.save(state);
      return { ok: true, snapshot: snapshot(state) };
    },

    'POST /api/player/skill': (body) => {
      const state = ensureState();
      const club = state.clubs[state.userClubId];
      const player = state.players[body.playerId];
      if (!player || !club.squad.includes(player.id)) throw new ApiError(404, 'Jugador no encontrado en tu plantilla');
      const result = require('./engine/skills').unlockSkill(player, body.skillId);
      if (!result.ok) throw new ApiError(400, result.reason);
      store.save(state);
      return { ok: true, message: player.name + ' ha desbloqueado: ' + result.skill.name, snapshot: snapshot(state) };
    },

    'POST /api/player/treat': (body) => {
      const state = ensureState();
      const result = require('./engine/medical').treatPlayer(state, body.playerId, body.treatment);
      store.save(state);
      return { ...result, snapshot: snapshot(state) };
    },

    'POST /api/sponsors/negotiate': (body) => {
      const state = ensureState();
      const result = require('./engine/sponsors').negotiate(state, body.offerId, body.action, Number(body.counterPct) || 0);
      store.save(state);
      return { ...result, snapshot: snapshot(state) };
    },

    'GET /api/chain/verify': () => {
      const state = ensureState();
      return chainMod.validateChain(state.chain);
    },

    'POST /api/inbox/read': () => {
      const state = ensureState();
      for (const msg of state.inbox) msg.read = true;
      store.save(state);
      return { ok: true };
    }
  };
}

module.exports = { ApiError, snapshot, createRoutes };

},
  "fc-entry.js": function (exports, require, module) {

'use strict';
/* Adaptador local: expone window.FC_LOCAL.handle(method, path, body) con la
   misma semántica que la API HTTP, persistiendo en localStorage.
   Incluye cuentas (login/registro) y una partida guardada por cuenta. */

const storeMod = require('./server/store-browser.js');
const routesMod = require('./server/routes.js');
const { createBrowserAuth } = require('./server/auth-browser.js');

const auth = createBrowserAuth();
let current = auth.currentSession();
let ctx = null;

function contextFor(accountId) {
  if (!ctx) {
    const store = storeMod.createBrowserStore(accountId);
    let state = store.load();
    ctx = {
      store,
      routes: routesMod.createRoutes({
        getState: () => state,
        setState: (s) => { state = s; },
        store
      })
    };
  }
  return ctx;
}

module.exports = {
  mode: 'browser',
  handle(method, path, body) {
    body = body || {};
    try {
      if (path === '/api/auth/register' && method === 'POST') {
        const acc = auth.register(body.username, body.password, body.recoveryQuestion, body.recoveryAnswer);
        const { account } = auth.login(body.username, body.password);
        storeMod.adoptLegacy(account.id);
        current = account; ctx = null;
        return { status: 200, data: { account } };
      }
      if (path === '/api/auth/recover/question' && method === 'POST') {
        const question = auth.getRecoveryQuestion(body.username);
        return { status: 200, data: { question } };
      }
      if (path === '/api/auth/recover/reset' && method === 'POST') {
        const { account } = auth.resetPassword(body.username, body.answer, body.password);
        storeMod.adoptLegacy(account.id);
        current = account; ctx = null;
        return { status: 200, data: { account } };
      }
      if (path === '/api/auth/login' && method === 'POST') {
        const { account } = auth.login(body.username, body.password);
        storeMod.adoptLegacy(account.id);
        current = account; ctx = null;
        return { status: 200, data: { account } };
      }
      if (path === '/api/auth/logout' && method === 'POST') {
        auth.logout();
        current = null; ctx = null;
        return { status: 200, data: { ok: true } };
      }
      if (path === '/api/auth/me' && method === 'GET') {
        if (!current) return { status: 401, data: { error: 'Sin sesión' } };
        return { status: 200, data: { account: current } };
      }
    } catch (err) {
      if (err instanceof routesMod.ApiError) return { status: err.status, data: { error: err.message } };
      return { status: 400, data: { error: err.message } };
    }

    if (!current) return { status: 401, data: { error: 'Inicia sesión para jugar', authRequired: true } };
    if (path === '/api/auth/recovery-question' && method === 'POST') {
      const r = auth.setRecoveryQuestion(current.id, body.question, body.answer);
      return { status: 200, data: r };
    }
    const c = contextFor(current.id);
    const handler = c.routes[method + ' ' + path];
    if (!handler) return { status: 404, data: { error: 'Endpoint no encontrado: ' + method + ' ' + path } };
    try {
      return { status: 200, data: handler(body) };
    } catch (err) {
      if (err instanceof routesMod.ApiError) return { status: err.status, data: { error: err.message } };
      return { status: 500, data: { error: 'Error interno: ' + err.message } };
    }
  }
};

}
};
var CACHE = {};
function resolveKey(from, req) {
  if (req.charAt(0) !== '.') return null;
  var dir = from.indexOf('/') === -1 ? '' : from.slice(0, from.lastIndexOf('/'));
  var parts = (dir + '/' + req).split('/');
  var out = [];
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i];
    if (p === '' || p === '.') continue;
    if (p === '..') out.pop(); else out.push(p);
  }
  var key = out.join('/');
  return key.slice(-3) === '.js' ? key.slice(0, -3) : key;
}
function mkRequire(from) {
  return function (req) {
    var key = resolveKey(from, req);
    if (key === null || !REGISTRY[key + '.js']) {
      throw new Error("Cannot find module '" + req + "'");
    }
    key = key + '.js';
    if (CACHE[key]) return CACHE[key].exports;
    var mod = { exports: {} };
    CACHE[key] = mod;
    REGISTRY[key](mod.exports, mkRequire(key), mod);
    return mod.exports;
  };
}
var FC_ENTRY = mkRequire('')('./fc-entry.js');
if (typeof window !== 'undefined') window.FC_LOCAL = FC_ENTRY;
})();
