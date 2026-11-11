'use strict';

/* ================= FC Galaxy — vistas: mercado y cantera ================= */

let marketTab = 'search';
let marketFilters = { pos: '', maxPrice: '', sort: 'value' };

function viewMarket(root) {
  const tabs = [
    { id: 'search', label: '\ud83d\udd0d Buscar' },
    { id: 'offers', label: '\ud83d\udce9 Ofertas' + (pendingOfferCount() ? ' (' + pendingOfferCount() + ')' : '') },
    { id: 'mylistings', label: '\ud83c\udff7\ufe0f Mis publicaciones' },
    { id: 'free', label: '\ud83c\udf31 Agentes libres' },
    { id: 'history', label: '\ud83d\udcdc Historial' }
  ];
  let html = '<h1 class="view-title">Mercado de fichajes</h1>' +
    '<div class="tab-bar">' + tabs.map(t =>
      '<button class="tab' + (marketTab === t.id ? ' active' : '') + '" data-mtab="' + t.id + '">' + t.label + '</button>').join('') +
    '</div><div id="market-body" class="card"></div>';
  root.innerHTML = html;
  root.querySelectorAll('[data-mtab]').forEach(el =>
    el.addEventListener('click', () => { marketTab = el.dataset.mtab; viewMarket(root); }));

  const body = document.getElementById('market-body');
  if (marketTab === 'search') renderMarketSearch(body);
  else if (marketTab === 'offers') renderMarketOffers(body);
  else if (marketTab === 'mylistings') renderMyListings(body);
  else if (marketTab === 'free') renderFreeAgents(body);
  else renderTransferHistory(body);
  bindNav(root);
}

function pendingOfferCount() {
  return (S.market.offers || []).filter(o => o.status === 'pending' && o.toClubId === S.userClubId).length;
}

function renderMarketSearch(body) {
  const club = userClub();
  let listings = (S.market.listings || []).filter(l => l.sellerClubId !== S.userClubId && S.players[l.playerId]);
  if (marketFilters.pos) listings = listings.filter(l => S.players[l.playerId].pos === marketFilters.pos);
  if (marketFilters.maxPrice) listings = listings.filter(l => l.price <= Number(marketFilters.maxPrice));
  listings.sort((a, b) => marketFilters.sort === 'price' ? a.price - b.price :
    marketFilters.sort === 'overall' ? S.players[b.playerId].overall - S.players[a.playerId].overall :
    S.players[b.playerId].value - S.players[a.playerId].value);

  let html = '<div class="filter-row">' +
    '<label class="field inline"><span>Posici\u00f3n</span><select id="mf-pos"><option value="">Todas</option>' +
    ['GK', 'CB', 'LB', 'RB', 'DM', 'CM', 'AM', 'LW', 'RW', 'ST'].map(p =>
      '<option value="' + p + '"' + (marketFilters.pos === p ? ' selected' : '') + '>' + p + '</option>').join('') +
    '</select></label>' +
    '<label class="field inline"><span>Precio m\u00e1x. (M FCG)</span><input type="number" id="mf-max" min="0" step="0.5" value="' + marketFilters.maxPrice + '" placeholder="Sin l\u00edmite"></label>' +
    '<label class="field inline"><span>Orden</span><select id="mf-sort">' +
    '<option value="value"' + (marketFilters.sort === 'value' ? ' selected' : '') + '>Valoraci\u00f3n</option>' +
    '<option value="overall"' + (marketFilters.sort === 'overall' ? ' selected' : '') + '>Media</option>' +
    '<option value="price"' + (marketFilters.sort === 'price' ? ' selected' : '') + '>Precio</option>' +
    '</select></label></div>';

  if (!listings.length) {
    html += '<p class="empty-state">No hay jugadores publicados con estos filtros. Los dem\u00e1s clubes publican nuevas incorporaciones cada semana; tambi\u00e9n puedes poner jugadores tuyos en el mercado desde Plantilla.</p>';
  } else {
    html += '<div class="listing-grid">';
    for (const l of listings) {
      const p = S.players[l.playerId];
      const seller = S.clubs[l.sellerClubId];
      const afford = club.budget >= l.price;
      html += '<div class="listing-card">' +
        '<div class="lc-head">' + posTag(p.pos) + '<strong>' + esc(p.name) + '</strong>' + ovrBadge(p.overall) + '</div>' +
        '<p class="lc-meta">' + p.age + ' a\u00f1os \u00b7 Potencial ' + potentialText(p) + '</p>' +
        '<p class="lc-meta">Vende: ' + esc(seller ? seller.name : '?') + ' \u00b7 caduca S' + l.expiresWeek + '</p>' +
        '<p class="lc-price">' + fmtMoney(l.price) + ' FCG</p>' +
        '<div class="lc-actions">' +
        '<button class="btn small' + (afford ? '' : ' secondary') + '" data-buy="' + l.id + '"' + (afford ? '' : ' disabled') + '>Comprar</button>' +
        '<button class="btn small secondary" data-offer-l="' + l.id + '">Ofertar</button>' +
        '</div></div>';
    }
    html += '</div>';
  }
  body.innerHTML = html;

  const applyFilters = () => {
    marketFilters.pos = document.getElementById('mf-pos').value;
    marketFilters.maxPrice = document.getElementById('mf-max').value;
    marketFilters.sort = document.getElementById('mf-sort').value;
    renderMarketSearch(body);
  };
  ['mf-pos', 'mf-max', 'mf-sort'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', applyFilters);
  });

  body.querySelectorAll('[data-buy]').forEach(el =>
    el.addEventListener('click', () => {
      const l = S.market.listings.find(x => x.id === el.dataset.buy);
      const p = S.players[l.playerId];
      confirmModal('Fichar a ' + p.name,
        'Comprar\u00e1s a <strong>' + esc(p.name) + '</strong> (' + p.pos + ', ' + p.overall + ' media) por <strong>' +
        fmtMoney(l.price) + ' FCG</strong>. La transferencia se ejecutar\u00e1 como contrato inteligente simulado en la SIMCHAIN (comisi\u00f3n 4%, quemada).',
        async () => {
          const r = await API.post('/api/market/buy', { listingId: l.id });
          S = r.snapshot; tacticsDraft = null;
          toast('\u00a1' + p.name + ' fichado! Tx ' + (r.receipt.txHash || '').slice(0, 10) + '\u2026');
          render();
        }, 'Fichar por ' + fmtMoney(l.price));
    }));

  body.querySelectorAll('[data-offer-l]').forEach(el =>
    el.addEventListener('click', () => {
      const l = S.market.listings.find(x => x.id === el.dataset.offerL);
      if (l) openOfferModal(l.playerId, l.price);
    }));
}

function openOfferModal(playerId, referencePrice) {
  const p = S.players[playerId];
  openModal(
    '<h2>Oferta por ' + esc(p.name) + '</h2>' +
    '<p style="color:var(--text-dim)">Valoraci\u00f3n: ' + fmtMoney(p.value) + ' FCG' +
    (referencePrice ? ' \u00b7 precio publicado: ' + fmtMoney(referencePrice) : '') + '. El club vendedor aceptar\u00e1, contraofertar\u00e1 o rechazar\u00e1.</p>' +
    '<label class="field"><span>Importe de la oferta (FCG)</span>' +
    '<input type="number" id="of-amount" min="100000" step="100000" value="' + Math.round(p.value) + '"></label>' +
    '<div class="close-row"><button class="btn secondary" id="of-cancel">Cancelar</button>' +
    '<button class="btn" id="of-ok">Enviar oferta</button></div>'
  );
  document.getElementById('of-cancel').addEventListener('click', closeModal);
  document.getElementById('of-ok').addEventListener('click', async () => {
    try {
      const amount = Math.round(Number(document.getElementById('of-amount').value));
      const r = await API.post('/api/market/offer', { playerId, amount });
      S = r.snapshot; tacticsDraft = null;
      closeModal();
      toast(r.message || 'Oferta enviada.');
      render();
    } catch (err) { toast(err.message, 'error'); }
  });
}

function renderMarketOffers(body) {
  const offers = (S.market.offers || []).filter(o => o.status === 'pending' && o.toClubId === S.userClubId);
  let html = '<h2>Ofertas recibidas</h2>';
  if (!offers.length) {
    html += '<p class="empty-state">No hay ofertas pendientes. Cuando otros clubes quieran a tus jugadores, las recibir\u00e1s aqu\u00ed y en la bandeja de entrada.</p>';
  } else {
    for (const o of offers) {
      const p = S.players[o.playerId];
      if (!p) continue;
      const from = S.clubs[o.fromClubId];
      html += '<div class="offer-card">' +
        '<div class="lc-head">' + posTag(p.pos) + '<strong>' + esc(p.name) + '</strong>' + ovrBadge(p.overall) + '</div>' +
        '<p class="lc-meta">' + esc(from ? from.name : '?') + ' ofrece <strong style="color:var(--accent)">' + fmtMoney(o.amount) + ' FCG</strong>' +
        ' (valoraci\u00f3n: ' + fmtMoney(p.value) + ')</p>' +
        '<div class="lc-actions">' +
        '<button class="btn small" data-accept="' + o.id + '">Aceptar y vender</button>' +
        '<button class="btn small secondary" data-reject="' + o.id + '">Rechazar</button>' +
        '</div></div>';
    }
  }
  body.innerHTML = html;

  body.querySelectorAll('[data-accept]').forEach(el =>
    el.addEventListener('click', () => {
      const o = S.market.offers.find(x => x.id === el.dataset.accept);
      const p = S.players[o.playerId];
      confirmModal('Vender a ' + p.name,
        'Vender\u00e1s a <strong>' + esc(p.name) + '</strong> a ' + esc(S.clubs[o.fromClubId].name) + ' por <strong>' +
        fmtMoney(o.amount) + ' FCG</strong>. Se ejecutar\u00e1 un contrato inteligente simulado en la SIMCHAIN.',
        async () => {
          const r = await API.post('/api/offers/respond', { offerId: o.id, accept: true });
          S = r.snapshot; tacticsDraft = null;
          if (r.receipt) toast('Venta completada. Tx ' + (r.receipt.txHash || '').slice(0, 10) + '\u2026');
          else toast('Venta completada.');
          render();
        }, 'Vender');
    }));
  body.querySelectorAll('[data-reject]').forEach(el =>
    el.addEventListener('click', async () => {
      try {
        const r = await API.post('/api/offers/respond', { offerId: el.dataset.reject, accept: false });
        S = r.snapshot; tacticsDraft = null;
        toast('Oferta rechazada.');
        render();
      } catch (err) { toast(err.message, 'error'); }
    }));
}

function renderMyListings(body) {
  const listings = (S.market.listings || []).filter(l => l.sellerClubId === S.userClubId);
  let html = '<h2>Mis jugadores publicados</h2>';
  if (!listings.length) {
    html += '<p class="empty-state">No has publicado jugadores. Hazlo desde Plantilla \u2192 clic en jugador \u2192 \u201cPoner en el mercado\u201d.</p>';
  } else {
    for (const l of listings) {
      const p = S.players[l.playerId];
      if (!p) continue;
      html += '<div class="listing-card">' +
        '<div class="lc-head">' + posTag(p.pos) + '<strong>' + esc(p.name) + '</strong>' + ovrBadge(p.overall) + '</div>' +
        '<p class="lc-price">' + fmtMoney(l.price) + ' FCG</p>' +
        '<p class="lc-meta">Caduca en semana ' + l.expiresWeek + '</p>' +
        '<div class="lc-actions"><button class="btn small secondary" data-cancel="' + l.id + '">Retirar</button></div></div>';
    }
  }
  body.innerHTML = html;
  body.querySelectorAll('[data-cancel]').forEach(el =>
    el.addEventListener('click', async () => {
      try {
        await API.post('/api/market/cancel', { listingId: el.dataset.cancel });
        S.market.listings = S.market.listings.filter(l => l.id !== el.dataset.cancel);
        toast('Publicaci\u00f3n retirada.');
        render();
      } catch (err) { toast(err.message, 'error'); }
    }));
}

function renderFreeAgents(body) {
  const club = userClub();
  const fas = (S.market.freeAgents || []).map(fa => typeof fa === 'string' ? S.players[fa] : fa).filter(Boolean);
  let html = '<h2>Agentes libres</h2>' +
    '<p class="hint-line">Jugadores sin contrato. Firmarles cuesta la prima y el salario que pidan; no hay traspaso (no tienen activo asignado a ning\u00fan club: al firmar, su NFT se transfiere a tu wallet en la SIMCHAIN).</p>';
  if (!fas.length) {
    html += '<p class="empty-state">No hay agentes libres disponibles ahora mismo. Aparecen al final de cada temporada cuando expiran contratos.</p>';
  } else {
    html += '<div class="table-scroll"><table class="table"><thead><tr>' +
      '<th>Pos</th><th>Jugador</th><th>Edad</th><th>Med</th><th>Pot</th><th>Salario ped.</th><th>Valor</th><th></th></tr></thead><tbody>';
    for (const p of fas) {
      const wage = p.contract && p.contract.wage ? p.contract.wage : Math.round(p.value * 0.004 / 100) * 100;
      html += '<tr><td>' + posTag(p.pos) + '</td><td class="name-cell">' + esc(p.name) + '</td><td>' + p.age + '</td>' +
        '<td>' + ovrBadge(p.overall) + '</td><td>' + potentialText(p) + '</td>' +
        '<td>' + fmtMoney(wage) + '</td><td>' + fmtMoney(p.value) + '</td>' +
        '<td><button class="btn small" data-sign="' + p.id + '"' + (club.squad.length >= 30 ? ' disabled' : '') + '>Firmar</button></td></tr>';
    }
    html += '</tbody></table></div>';
  }
  body.innerHTML = html;
  body.querySelectorAll('[data-sign]').forEach(el =>
    el.addEventListener('click', () => {
      const p = S.players[el.dataset.sign];
      confirmModal('Fichar agente libre',
        'Firmar\u00e1s a <strong>' + esc(p.name) + '</strong> (' + p.pos + ', ' + p.overall + ') con un salario aproximado de ' +
        fmtMoney(p.contract && p.contract.wage ? p.contract.wage : Math.round(p.value * 0.004 / 100) * 100) + ' FCG/semana.',
        async () => {
          const r = await API.post('/api/freeagents/sign', { playerId: p.id });
          await refresh();
          toast(p.name + ' firmado. Su NFT ahora pertenece a tu wallet.');
        }, 'Firmar');
    }));
}

function renderTransferHistory(body) {
  const hist = (S.market.transferHistory || []);
  let html = '<h2>Historial de transferencias</h2>' +
    '<p class="hint-line">Cada traspaso se registra como bloque en la SIMCHAIN con su hash de transacci\u00f3n. Todas las entradas son transacciones simuladas, no reales.</p>';
  if (!hist.length) {
    html += '<p class="empty-state">A\u00fan no se han producido traspasos. Ficha o vende jugadores para llenar este historial.</p>';
  } else {
    html += '<div class="table-scroll"><table class="table"><thead><tr>' +
      '<th>Temp.</th><th>Jugador</th><th>Origen</th><th>Destino</th><th>Precio</th><th>Comisi\u00f3n</th><th>Tx</th></tr></thead><tbody>';
    for (const h of hist) {
      html += '<tr><td>T' + h.season + 'S' + h.week + '</td><td class="name-cell">' + esc(h.playerName) + '</td>' +
        '<td>' + esc(h.fromClubName) + '</td><td>' + esc(h.toClubName) + '</td>' +
        '<td>' + fmtMoney(h.price) + '</td><td>' + fmtMoney(h.fee) + '</td>' +
        '<td><span class="hash mono" title="' + esc(h.txHash) + '">' + esc(String(h.txHash).slice(0, 10)) + '\u2026</span></td></tr>';
    }
    html += '</tbody></table></div>';
  }
  body.innerHTML = html;
}

function viewYouth(root) {
  const club = userClub();
  const academy = (S.youth[S.userClubId] || []);
  let html = '<h1 class="view-title">Cantera</h1>' +
    '<div class="grid grid-3">' +
    '<div class="card stat-card"><h3>Nivel de cantera</h3><p class="big-num">' + club.facilities.youth + '/6</p>' +
    '<p class="hint-line">Mej\u00f3rala en Mi Club para atraer mejores promesas.</p></div>' +
    '<div class="card stat-card"><h3>Promesas</h3><p class="big-num">' + academy.length + '/6</p>' +
    '<p class="hint-line">Cada semana puede aparecer una nueva joya.</p></div>' +
    '<div class="card stat-card"><h3>Plantilla</h3><p class="big-num">' + club.squad.length + '/30</p>' +
    '<p class="hint-line">Espacio para promocionar: ' + Math.max(0, 30 - club.squad.length) + '</p></div></div>' +
    '<div class="card"><h2>J\u00f3venes de la academia</h2>';
  if (!academy.length) {
    html += '<p class="empty-state">Tu cantera est\u00e1 vac\u00eda. Semana a semana pueden aparecer promesas (probabilidad seg\u00fan el nivel de la instalaci\u00f3n). Avanza jornadas y vigila la bandeja de entrada.</p>';
  } else {
    html += '<div class="table-scroll"><table class="table"><thead><tr>' +
      '<th>Pos</th><th>Jugador</th><th>Edad</th><th>Med</th><th>Pot</th><th>Moral</th><th></th></tr></thead><tbody>';
    for (const p of academy) {
      html += '<tr><td>' + posTag(p.pos) + '</td><td class="name-cell">' + esc(p.name) + '</td><td>' + p.age + '</td>' +
        '<td>' + ovrBadge(p.overall) + '</td><td><strong style="color:var(--accent)">' + p.potential + '</strong></td>' +
        '<td>' + moraleEmoji(p.morale) + '</td>' +
        '<td><button class="btn small" data-promote="' + p.id + '"' + (club.squad.length >= 30 ? ' disabled' : '') + '>Promocionar</button></td></tr>';
    }
    html += '</tbody></table></div>' +
      '<p class="hint-line">Promocionar firma al juvenil con un contrato de 3 temporadas y lo sube al primer equipo (su NFT se acu\u00f1a a nombre de tu club).</p>';
  }
  html += '</div>';
  root.innerHTML = html;
  root.querySelectorAll('[data-promote]').forEach(el =>
    el.addEventListener('click', () => {
      const p = academy.find(x => x.id === el.dataset.promote);
      confirmModal('Promocionar a ' + p.name,
        'Subir\u00e1s a <strong>' + esc(p.name) + '</strong> (' + p.pos + ', ' + p.overall + ' \u2192 potencial ' + p.potential + ') al primer equipo con contrato de 3 temporadas.',
        async () => {
          const r = await API.post('/api/youth/promote', { playerId: p.id });
          await refresh();
          toast(r.player.name + ' ascendido al primer equipo \ud83c\udf31');
        }, 'Promocionar');
    }));
  bindNav(root);
}
