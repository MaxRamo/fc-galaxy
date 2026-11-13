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
