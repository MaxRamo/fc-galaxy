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

  const merch = Math.round(club.fanbase * 0.0022 * (0.85 + club.reputation / 200));
  addLedger(state, clubId, { concept: 'Merchandising y abonos', amount: merch, category: 'comercial' });

  const maintenance = Math.round(club.stadium.capacity * 0.09 + (club.facilities.training + club.facilities.youth + club.facilities.medical) * 14000);
  addLedger(state, clubId, { concept: 'Mantenimiento de instalaciones', amount: -maintenance, category: 'instalaciones' });

  return { wages, sponsor, merch, maintenance };
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
