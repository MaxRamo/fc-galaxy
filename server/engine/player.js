'use strict';

const { randomName } = require('./names');

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
    name: randomName(rng),
    pos,
    age,
    attrs,
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
