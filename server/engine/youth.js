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
      level: clamp(42 + qualityBonus + rng.range(-4, 8), 30, 72)
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
