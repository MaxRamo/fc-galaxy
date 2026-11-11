'use strict';

/* ================= FC Galaxy — arranque ================= */

(async function boot() {
  try {
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
  } catch (err) {
    document.getElementById('app').innerHTML =
      '<div class="loading-screen"><p style="color:var(--danger)">No se pudo conectar con el servidor: ' +
      esc(err.message) + '</p><button class="btn" onclick="location.reload()">Reintentar</button></div>';
  }
})();
