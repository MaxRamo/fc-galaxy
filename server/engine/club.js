'use strict';

const { Rng } = require('./rng');
const { CITIES, CLUB_SUFFIX, SPONSOR_NAMES, randomName, countryOf, DEFAULT_COUNTRY } = require('./names');
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

function generateClubSquad(rng, level, season, country) {
  const c = country || DEFAULT_COUNTRY;
  const squad = [];
  for (const pos of SQUAD_TEMPLATE) {
    const ageRoll = rng.float();
    const age = ageRoll < 0.22 ? rng.int(17, 20) : ageRoll < 0.62 ? rng.int(21, 27) : ageRoll < 0.88 ? rng.int(28, 31) : rng.int(32, 36);
    const nat = rng.chance(0.18) ? null : c;
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
