'use strict';

/* ================= FC Galaxy — vistas: finanzas, club, blockchain ================= */

function facilityCostLocal(type, level) {
  const base = { training: 2200000, youth: 2600000, medical: 1800000, stadium: 3500000 };
  return Math.round((base[type] || 2000000) * Math.pow(1.6, level - 1));
}

function facilityEffectText(type, level) {
  switch (type) {
    case 'training': return 'Aumenta la probabilidad de desarrollo de los jugadores en entrenamientos';
    case 'youth': return 'Mejora la calidad y frecuencia de las promesas de la cantera';
    case 'medical': return 'Reduce la duraci\u00f3n de lesiones y el riesgo de reca\u00edda';
    case 'stadium': return 'M\u00e1s aforo, m\u00e1s ingresos por taquilla';
    default: return '';
  }
}

function facilityLabel(type) {
  return { training: 'Instalaci\u00f3n de entrenamiento', youth: 'Cantera', medical: 'Centro m\u00e9dico', stadium: 'Estadio' }[type] || type;
}

function viewFinance(root) {
  const club = userClub();
  const ledger = (club.ledger || []).slice(0, 40);
  const wages = club.squad.reduce((sum, id) => sum + (S.players[id] ? S.players[id].contract.wage : 0), 0);
  const incomes = [{ k: 'Patrocinio (' + esc(club.sponsor.name) + ')', v: club.sponsor.income },
    { k: 'Merchandising y abonos', v: Math.round(club.fanbase * 0.012) }];
  const catTotals = {};
  for (const e of (club.ledger || [])) {
    catTotals[e.category] = (catTotals[e.category] || 0) + e.amount;
  }

  let html = '<h1 class="view-title">Finanzas</h1>' +
    '<div class="grid grid-3">' +
    '<div class="card stat-card"><h3>Tesorer\u00eda</h3><p class="big-num" style="color:' + (club.budget < 0 ? 'var(--danger)' : 'var(--accent)') + '">' + fmtMoney(club.budget) + ' FCG</p>' +
    '<p class="hint-line">Wallet: <span class="mono">' + esc(club.wallet) + '</span></p></div>' +
    '<div class="card stat-card"><h3>Ingresos semanales</h3><p class="big-num" style="color:var(--ok)">' + fmtMoney(incomes.reduce((s, i) => s + i.v, 0)) + ' FCG</p>' +
    incomes.map(i => '<p class="hint-line">' + i.k + ': +' + fmtMoney(i.v) + '</p>').join('') + '</div>' +
    '<div class="card stat-card"><h3>Gastos semanales</h3><p class="big-num" style="color:var(--danger)">-' + fmtMoney(wages + 120000 + 60000) + ' FCG</p>' +
    '<p class="hint-line">Salarios: -' + fmtMoney(wages) + '</p><p class="hint-line">Mantenimiento estadio + cuerpo t\u00e9cnico: -180K</p></div>' +
    '</div>';

  html += '<div class="grid grid-2"><div class="card"><h3>Totales por categor\u00eda (hist\u00f3rico)</h3>';
  const cats = Object.entries(catTotals);
  if (cats.length) {
    html += '<table class="table compact"><thead><tr><th>Categor\u00eda</th><th>Total</th></tr></thead><tbody>' +
      cats.map(([c, v]) => '<tr><td>' + esc(c) + '</td><td style="color:' + (v >= 0 ? 'var(--ok)' : 'var(--danger)') + '">' +
        (v >= 0 ? '+' : '') + fmtMoney(v) + '</td></tr>').join('') + '</tbody></table>';
  } else {
    html += '<p class="empty-state">Sin movimientos a\u00fan. Avanza una jornada para generar ingresos y gastos.</p>';
  }
  html += '</div><div class="card"><h3>\u00daltimos movimientos</h3>';
  if (ledger.length) {
    html += '<div class="ledger-list">' + ledger.map(e =>
      '<div class="ledger-item"><span class="li-concept">' + esc(e.concept) + '</span>' +
      '<span class="li-amount" style="color:' + (e.amount >= 0 ? 'var(--ok)' : 'var(--danger)') + '">' +
      (e.amount >= 0 ? '+' : '') + fmtMoney(e.amount) + '</span></div>').join('') + '</div>';
  } else {
    html += '<p class="empty-state">Sin movimientos registrados.</p>';
  }
  html += '</div></div>';

  root.innerHTML = html;
  bindNav(root);
}

function viewClub(root) {
  const club = userClub();
  const facs = ['training', 'youth', 'medical', 'stadium'];
  let html = '<h1 class="view-title">Mi Club</h1>' +
    '<div class="grid grid-2">' +
    '<div class="card"><h2>Identidad</h2>' +
    '<div class="club-identity">' + badge(club, 64) +
    '<div><h3 style="margin:0">' + esc(club.name) + '</h3>' +
    '<p class="hint-line">' + esc(club.city) + ' \u00b7 M\u00e1nager: ' + esc(club.managerName || '\u2014') + '</p>' +
    '<p class="hint-line">Fundado con colores <span style="display:inline-block;width:12px;height:12px;background:' + esc(club.primaryColor) + ';border-radius:3px;vertical-align:middle"></span> ' +
    '<span style="display:inline-block;width:12px;height:12px;background:' + esc(club.secondaryColor) + ';border-radius:3px;vertical-align:middle"></span></p></div></div>' +
    '<p class="hint-line">Reputaci\u00f3n: <strong>' + Math.round(club.reputation) + '/95</strong> \u00b7 Afici\u00f3n: <strong>' + (club.fanbase / 1000000).toFixed(2) + 'M</strong></p>' +
    '<p class="hint-line">Patrocinador: <strong>' + esc(club.sponsor.name) + '</strong> (' + fmtMoney(club.sponsor.income) + ' FCG/semana)</p>' +
    '<button class="btn secondary small" id="btn-edit-identity"><svg class="icon-svg" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false" style="vertical-align:-2px;margin-right:5px"><path d="M12 3a9 9 0 0 0 0 18c1.4 0 2.2-.9 2.2-2 0-.6-.3-1-.6-1.4-.3-.4-.6-.8-.6-1.4 0-1.1.9-2 2-2h2.4A4.6 4.6 0 0 0 21 9.8C20.4 6 16.6 3 12 3Z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="7.5" cy="10.5" r="1.3" fill="currentColor"/><circle cx="11" cy="7.5" r="1.3" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.3" fill="currentColor"/></svg>Editar escudo y camiseta</button>' +
    '</div>';

  html += '<div class="card"><h2>Estadio</h2>' +
    '<p class="hint-line">' + esc(club.stadium.name) + '</p>' +
    '<p class="hint-line">Aforo: <strong>' + club.stadium.capacity.toLocaleString('es-ES') + '</strong> \u00b7 Entrada: ' + fmtMoney(club.stadium.ticketPrice) + ' FCG</p>' +
    '<p class="hint-line">Ingreso estimado por partido lleno: ' + fmtMoney(club.stadium.capacity * club.stadium.ticketPrice) + ' FCG</p></div>' +
    '</div>';

  html += '<div class="card"><h2>Instalaciones</h2><div class="facility-grid">';
  for (const type of facs) {
    const isStadium = type === 'stadium';
    const level = isStadium ? Math.round(club.stadium.capacity / 24000 * 2) : club.facilities[type];
    const cost = facilityCostLocal(type, isStadium ? Math.max(1, Math.round(club.stadium.capacity / 24000)) : level);
    const maxed = isStadium ? club.stadium.capacity >= 80000 : level >= 6;
    const afford = club.budget >= cost && !maxed;
    html += '<div class="facility-card">' +
      '<h3>' + facilityLabel(type) + '</h3>' +
      '<div class="fac-level">' + Array.from({ length: 6 }, (_, i) =>
        '<span class="fac-dot' + (i < level ? ' on' : '') + '"></span>').join('') + '</div>' +
      '<p class="hint-line">' + facilityEffectText(type, level) + '</p>' +
      (isStadium
        ? '<p class="hint-line">Ampliar aforo +4.000 asientos</p>'
        : '<p class="hint-line">Nivel actual: ' + level + '/6</p>') +
      (maxed
        ? '<p class="hint-line" style="color:var(--accent)">Nivel m\u00e1ximo alcanzado</p>'
        : '<button class="btn small' + (afford ? '' : ' secondary') + '" data-upgrade="' + type + '"' + (afford ? '' : ' disabled') + '>Mejorar \u00b7 ' + fmtMoney(cost) + '</button>') +
      '</div>';
  }
  html += '</div></div>';

  root.innerHTML = html;
  document.getElementById('btn-edit-identity').addEventListener('click', () => {
    openModal(
      '<h2>Editar escudo y camiseta</h2>' +
      identityEditorHtml('club', club) +
      '<div class="close-row"><button class="btn secondary" id="idf-cancel">Cancelar</button>' +
      '<button class="btn" id="idf-save">Guardar cambios</button></div>'
    );
    const mroot = document.getElementById('modal-root');
    let draft = readIdentityDraft(mroot, 'club', club);
    bindIdentityPreview(mroot, 'club', () => draft);
    document.getElementById('idf-cancel').addEventListener('click', closeModal);
    document.getElementById('idf-save').addEventListener('click', async () => {
      draft = readIdentityDraft(mroot, 'club', club);
      const btn = document.getElementById('idf-save');
      btn.classList.add('loading'); btn.disabled = true;
      try {
        const r = await API.post('/api/club/identity', { crest: draft.crest, kit: draft.kit });
        S = r.snapshot || S;
        closeModal();
        render();
        toast('Escudo y camiseta actualizados.');
      } catch (err) {
        btn.classList.remove('loading'); btn.disabled = false;
        toast(err.message, 'error');
      }
    });
  });
  root.querySelectorAll('[data-upgrade]').forEach(el =>
    el.addEventListener('click', () => {
      const type = el.dataset.upgrade;
      confirmModal('Mejorar ' + facilityLabel(type),
        'Coste: <strong>' + fmtMoney(facilityCostLocal(type, type === 'stadium'
          ? Math.max(1, Math.round(club.stadium.capacity / 24000)) : club.facilities[type])) + ' FCG</strong>. ' + facilityEffectText(type, 0),
        async () => {
          const r = await API.post('/api/facilities/upgrade', { type });
          await refresh();
          toast(facilityLabel(type) + ' mejorada.');
        }, 'Mejorar');
    }));
  bindNav(root);
}

function viewChain(root) {
  const club = userClub();
  const chainBlocks = Object.keys(S.chain).map(k => S.chain[k]).sort((a, b) => a.index - b.index);
  const myAssets = Object.values(S.nft.assets).filter(a => a.owner === club.wallet);
  const balances = Object.entries(S.token.balances || {}).sort((a, b) => b[1] - a[1]);

  let html = '<h1 class="view-title">Blockchain simulada (SIMCHAIN)</h1>' +
    '<div class="sim-banner">\u26d3\ufe0f SIMCHAIN \u2014 blockchain <strong>simulada</strong> para el juego. Ninguna transacci\u00f3n de esta pantalla es real ni existe en una red blockchain.</div>' +
    '<div class="grid grid-3">' +
    '<div class="card stat-card"><h3>Mi wallet</h3><p class="big-num" style="color:var(--accent)">' + fmtMoney(S.token.balances[club.wallet] || 0) + ' FCG</p>' +
    '<p class="hint-line mono">' + esc(club.wallet) + '</p></div>' +
    '<div class="card stat-card"><h3>Token FCG</h3><p class="big-num">' + fmtMoney(S.token.totalSupply) + '</p>' +
    '<p class="hint-line">Suministro total simulado</p></div>' +
    '<div class="card stat-card"><h3>Mis activos NFT</h3><p class="big-num">' + myAssets.length + '</p>' +
    '<p class="hint-line">Un activo \u00fanico por jugador (est\u00e1ndar SIM-721)</p></div>' +
    '</div>';

  html += '<div class="grid grid-2">' +
    '<div class="card"><h2>\ud83c\udff7\ufe0f Activos digitales de mi club</h2><div class="asset-list">';
  if (myAssets.length) {
    const shown = myAssets.slice(0, 30);
    for (const a of shown) {
      const p = S.players[a.playerId];
      html += '<div class="asset-card"><span class="mono">#' + a.tokenId + '</span> ' +
        '<strong>' + esc(p ? p.name : a.meta.name) + '</strong> ' +
        '<span class="hash">' + esc(a.serial) + '</span>' +
        (p ? ovrBadge(p.overall) : '') + '</div>';
    }
    if (myAssets.length > shown.length) html += '<p class="hint-line">\u2026y ' + (myAssets.length - shown.length) + ' activos m\u00e1s.</p>';
  } else {
    html += '<p class="empty-state">Tu club a\u00fan no tiene activos registrados.</p>';
  }
  html += '</div></div>';

  html += '<div class="card"><h2>\ud83d\udcb0 Saldos de wallets (clubes)</h2><div class="table-scroll"><table class="table compact"><thead><tr>' +
    '<th>Wallet</th><th>Club</th><th>Saldo FCG</th></tr></thead><tbody>';
  for (const [addr, bal] of balances) {
    const c = Object.values(S.clubs).find(cl => cl.wallet === addr);
    html += '<tr><td class="mono hash">' + esc(addr) + '</td><td>' + esc(c ? c.name : '\u2014') + '</td><td>' + fmtMoney(bal) + '</td></tr>';
  }
  html += '</tbody></table></div></div></div>';

  html += '<div class="card"><h2>\ud83e\uddf1 Explorador de bloques <span class="hash">(' + chainBlocks.length + ' bloques)</span>' +
    '<button class="btn secondary small" id="btn-verify" style="float:right">\u2705 Verificar cadena</button></h2>' +
    '<div class="block-list">';
  const recent = chainBlocks.slice(-8).reverse();
  for (const b of recent) {
    html += '<div class="block-card"><div class="block-head">Bloque #' + b.index +
      ' <span class="hash mono" title="' + esc(b.hash) + '">' + esc(String(b.hash).slice(0, 16)) + '\u2026</span></div>' +
      '<div class="tx-list">' + (b.transactions || []).map(tx =>
        '<div class="tx"><span class="tx-type">' + esc(tx.type || 'TX') + '</span>' +
        '<span>' + esc(tx.note || tx.memo || (tx.from ? tx.from + ' \u2192 ' + tx.to : '') || '') + '</span>' +
        (tx.amount != null ? '<strong>' + fmtMoney(tx.amount) + '</strong>' : '') + '</div>').join('') + '</div></div>';
  }
  html += '</div><p id="verify-result"></p></div>';

  root.innerHTML = html;
  document.getElementById('btn-verify').addEventListener('click', async () => {
    try {
      const r = await API.get('/api/chain/verify');
      document.getElementById('verify-result').innerHTML = r.valid
        ? '<p class="sim-note" style="color:var(--ok)">\u2705 Cadena v\u00e1lida: ' + r.blocks + ' bloques verificados (hashes encadenados correctamente). Simulaci\u00f3n local, no red real.</p>'
        : '<p class="sim-note" style="color:var(--danger)">\u274c Cadena inv\u00e1lida: ' + esc(r.reason) + '</p>';
    } catch (err) { toast(err.message, 'error'); }
  });
  bindNav(root);
}

const SPONSOR_STAND_LABELS = { norte: 'Fondo Norte', sur: 'Fondo Sur', este: 'Lateral Este', oeste: 'Tribuna Oeste' };

function sponsorDealCard(title, deal, extra) {
  return '<div class="deal-card">' +
    '<div class="deal-head"><strong>' + esc(deal.name) + '</strong><span class="deal-kind">' + esc(title) + '</span></div>' +
    '<p class="hint-line">' + fmtMoney(deal.weekly) + ' FCG/semana · hasta temporada ' + deal.untilSeason +
    (extra ? ' · ' + extra : '') + '</p></div>';
}

function sponsorOfferCard(o) {
  const kindLabel = o.kind === 'shirt' ? 'Camiseta' : 'Grada · ' + esc(SPONSOR_STAND_LABELS[o.stand] || o.stand || '');
  return '<div class="sponsor-card" data-offer="' + esc(o.id) + '">' +
    '<div class="sponsor-head"><div><strong>' + esc(o.name) + '</strong>' +
    '<p class="hint-line">' + kindLabel + ' · ' + o.seasons + ' temporada(s)</p></div>' +
    '<div class="sponsor-money"><strong>+' + fmtMoney(o.weekly) + '</strong><span class="hint-line">FCG/semana</span>' +
    (o.bonus ? '<span class="hint-line">+' + fmtMoney(o.bonus) + ' FCG de prima</span>' : '') +
    '</div></div>' +
    '<div class="sponsor-actions">' +
      '<button class="btn small" data-neg="accept">Firmar</button>' +
      '<span class="counter-box"><input type="number" min="5" max="60" value="15" data-counter>' +
      '<button class="btn secondary small" data-neg="counter" title="Pide un % más sobre la oferta">Contraoferta %</button></span>' +
      '<button class="btn secondary small" data-neg="reject">Rechazar</button>' +
    '</div></div>';
}

function viewSponsors(root) {
  const club = userClub();
  const offers = S.sponsorOffers || [];
  const standDeals = Object.entries(club.standSponsors || {});

  let html = '<h1 class="view-title">Patrocinios</h1>' +
    '<div class="grid grid-2">' +
    '<div class="card"><h2>Contratos activos</h2>';
  if (club.sponsor.deal) {
    html += sponsorDealCard('Camiseta', club.sponsor.deal);
  } else {
    html += '<p class="empty-state">No tienes patrocinador de camiseta. La marca actual (' + esc(club.sponsor.name) + ') solo paga ' + fmtMoney(club.sponsor.income) + ' FCG/semana.</p>';
  }
  if (standDeals.length) {
    html += standDeals.map(([key, deal]) =>
      sponsorDealCard('Grada · ' + esc(SPONSOR_STAND_LABELS[key] || key), deal)).join('');
  } else {
    html += '<p class="empty-state">Ninguna grada del estadio patrocinada todavía.</p>';
  }
  html += '<p class="hint-line">Los ingresos se abonan semanalmente junto al resto de tus ingresos.</p></div>';

  html += '<div class="card"><h2>Ofertas sobre la mesa</h2>';
  if (offers.length) {
    html += offers.map(sponsorOfferCard).join('') +
      '<p class="hint-line">Contraofertar sube el contrato, pero si pides demasiado el patrocinador retira la oferta. Las ofertas caducan en 2 semanas.</p>';
  } else {
    html += '<p class="empty-state">No hay ofertas ahora mismo. Avanza una semana: llegarán nuevas propuestas según tu reputación y afición.</p>';
  }
  html += '</div></div>';

  root.innerHTML = html;
  root.querySelectorAll('[data-neg]').forEach(btn =>
    btn.addEventListener('click', async () => {
      const card = btn.closest('.sponsor-card');
      const offerId = card.dataset.offer;
      const action = btn.dataset.neg;
      const body = { offerId, action };
      if (action === 'counter') {
        const input = card.querySelector('[data-counter]');
        const pct = Number(input && input.value);
        if (!pct || pct < 5 || pct > 60) { toast('La contraoferta debe estar entre 5% y 60%.', 'error'); return; }
        body.counterPct = pct;
      }
      card.querySelectorAll('button').forEach(b => { b.disabled = true; });
      try {
        const r = await API.post('/api/sponsors/negotiate', body);
        if (r.snapshot) S = r.snapshot;
        render();
        toast(r.message || 'Negociación completada.', r.status === 'walked' || r.status === 'rejected' ? 'warn' : '');
      } catch (err) {
        toast(err.message, 'error');
        render();
      }
    }));
  bindNav(root);
}
