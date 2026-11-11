'use strict';

/* ================= FC Galaxy \u2014 arranque ================= */

async function bootLoadState() {
  const data = await API.get('/api/state');
  if (data && data.phase && data.phase !== 'setup') {
    S = data;
    if (S.pendingMatch && !S.pendingMatch.finished) {
      route = 'match';
      matchPlayback = {
        revealed: S.pendingMatch.events.length,
        timer: null, checkpoint: null, subs: [], done: false
      };
      render();
      startPlayback();
      return;
    }
    if (S.pendingMatch && S.pendingMatch.finished) S.pendingMatch = null;
    route = 'dashboard';
  }
  render();
}

(async function boot() {
  try {
    const me = await API.get('/api/auth/me');
    User = me.account;
    await bootLoadState();
  } catch (err) {
    if (err.message && (err.message.indexOf('Inicia sesi\u00f3n') !== -1 || err.message.indexOf('Sin sesi\u00f3n') !== -1)) {
      renderLogin('login');
      return;
    }
    document.getElementById('app').innerHTML =
      '<div class="loading-screen"><p style="color:var(--danger)">No se pudo conectar con el servidor: ' +
      esc(err.message) + '</p><button class="btn" onclick="location.reload()">Reintentar</button></div>';
  }
})();
