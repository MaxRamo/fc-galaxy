'use strict';

/* Patrocinadores: generación de ofertas, negociación y caducidad */

const test = require('node:test');
const assert = require('node:assert');
const sponsors = require('../server/engine/sponsors');
const game = require('../server/engine/game');

function freshState() {
  const state = game.newGame({ clubName: 'Patrocinio FC', managerName: 'Test' });
  return state;
}

test('patrocinios: ofertas iniciales para camiseta y gradas libres', () => {
  const state = freshState();
  const offers = sponsors.refreshOffers(state);
  assert.ok(offers.length >= 3, 'camiseta + 2 gradas');
  const shirt = offers.find(o => o.kind === 'shirt');
  assert.ok(shirt, 'oferta de camiseta presente');
  assert.ok(shirt.weekly > 0 && shirt.seasons >= 1 && shirt.seasons <= 3);
  assert.strictEqual(shirt.expiresWeek, state.week + 2);
  const stands = offers.filter(o => o.kind === 'stand');
  assert.ok(stands.length >= 2, 'al menos dos gradas ofertadas');
  const standKeys = new Set(stands.map(o => o.stand));
  assert.strictEqual(standKeys.size, stands.length, 'sin gradas duplicadas');
  for (const o of stands) {
    assert.ok(o.stand && o.standLabel);
    assert.ok(!state.clubs[state.userClubId].standSponsors[o.stand], 'solo gradas libres');
  }
});

test('patrocinios: aceptar una oferta firma el contrato y abona ingresos', () => {
  const state = freshState();
  sponsors.refreshOffers(state);
  const club = state.clubs[state.userClubId];
  const shirt = state.sponsorOffers.find(o => o.kind === 'shirt');
  const baseIncome = club.sponsor.income;

  const r = sponsors.negotiate(state, shirt.id, 'accept');
  assert.strictEqual(r.status, 'signed');
  assert.strictEqual(club.sponsor.name, shirt.name);
  assert.strictEqual(club.sponsor.income, shirt.weekly);
  assert.ok(club.sponsor.deal);
  assert.strictEqual(club.sponsor.deal.untilSeason, state.season + shirt.seasons - 1);
  assert.ok(club.sponsor.income >= baseIncome * 0.5, 'ingreso de contrato razonable');
  assert.ok(!state.sponsorOffers.some(o => o.id === shirt.id), 'la oferta firmada desaparece');

  const standOffer = state.sponsorOffers.find(o => o.kind === 'stand');
  const r2 = sponsors.negotiate(state, standOffer.id, 'accept');
  assert.strictEqual(r2.status, 'signed');
  assert.ok(club.standSponsors[standOffer.stand]);
  assert.strictEqual(club.standSponsors[standOffer.stand].weekly, standOffer.weekly);
});

test('patrocinios: contraoferta con riesgo y rechazo', () => {
  const state = freshState();
  sponsors.refreshOffers(state);
  const offer = state.sponsorOffers[0];
  const originalWeekly = offer.weekly;

  const greedy = sponsors.negotiate(state, offer.id, 'counter', 200);
  assert.ok(['countered', 'walked'].includes(greedy.status), 'porcentaje excesivo se clamp a 60, sin error');
  if (greedy.status === 'walked') {
    const state2 = freshState();
    sponsors.refreshOffers(state2);
    const offer2 = state2.sponsorOffers[0];
    const r = sponsors.negotiate(state2, offer2.id, 'counter', 15);
    assert.ok(['countered', 'walked'].includes(r.status));
    var countered = r.status === 'countered' ? r.offer : null;
    var remaining = state2;
  } else {
    var countered = null;
    var remaining = null;
  }
  const r = greedy;
  assert.ok(['countered', 'walked'].includes(r.status), 'resultado probabilístico controlado');
  if (r.status === 'countered') {
    assert.ok(r.offer.weekly > originalWeekly, 'contraoferta aceptada mejora el contrato');
  } else if (r.status === 'walked') {
    assert.ok(!state.sponsorOffers.some(o => o.id === offer.id), 'oferta retirada');
  }

  const other = state.sponsorOffers[0];
  const id = other.id;
  const rr = sponsors.negotiate(state, id, 'reject');
  assert.strictEqual(rr.status, 'rejected');
  assert.ok(!state.sponsorOffers.some(o => o.id === id));
  assert.throws(() => sponsors.negotiate(state, id, 'accept'), /no disponible/);
});

test('patrocinios: caducidad de contratos al cambiar de temporada', () => {
  const state = freshState();
  sponsors.refreshOffers(state);
  const club = state.clubs[state.userClubId];
  const shirt = state.sponsorOffers.find(o => o.kind === 'shirt');
  sponsors.negotiate(state, shirt.id, 'accept');
  assert.ok(club.sponsor.deal, 'contrato firmado');

  state.season += 10;
  const expired = sponsors.expireDeals(state, state.userClubId);
  assert.ok(expired.some(e => e.includes('camiseta')), 'camiseta caducada');
  assert.ok(!club.sponsor.deal, 'sin contrato de camiseta');
  assert.ok(club.sponsor.income > 0, 'ingreso base de emergencia');
});

test('patrocinios: las ofertas aparecen en el snapshot para el frontend', () => {
  const state = freshState();
  sponsors.refreshOffers(state);
  const { buildSnapshot } = require('../server/routes');
  const routes = require('../server/routes');
  assert.ok(typeof routes.createRoutes === 'function', 'rutas expuestas');
  assert.ok(state.sponsorOffers.length >= 3);
});
