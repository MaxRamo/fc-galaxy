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
