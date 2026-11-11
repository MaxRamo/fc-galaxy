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
