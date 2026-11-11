'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const store = require('./store');
const { ApiError, createRoutes } = require('./routes');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

let state = store.load();
const routes = createRoutes({
  getState: () => state,
  setState: (s) => { state = s; },
  store
});

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

function serveStatic(res, pathname) {
  let filePath = pathname === '/' ? '/index.html' : pathname;
  const resolved = path.normalize(path.join(PUBLIC_DIR, filePath));
  if (!resolved.startsWith(PUBLIC_DIR)) {
    res.writeHead(403); res.end('Prohibido'); return;
  }
  fs.readFile(resolved, (err, data) => {
    if (err) {
      fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (err2, html) => {
        if (err2) { res.writeHead(404); res.end('No encontrado'); return; }
        res.writeHead(200, { 'Content-Type': MIME['.html'] });
        res.end(html);
      });
      return;
    }
    const ext = path.extname(resolved).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;

  if (pathname.startsWith('/api/')) {
    let raw = '';
    req.on('data', chunk => { raw += chunk; if (raw.length > 5e6) req.destroy(); });
    req.on('end', () => {
      let body = {};
      if (raw) { try { body = JSON.parse(raw); } catch (e) { return sendJson(res, 400, { error: 'JSON inv\u00e1lido' }); } }
      const routeKey = req.method + ' ' + pathname;
      const handler = routes[routeKey];
      if (!handler) return sendJson(res, 404, { error: 'Endpoint no encontrado: ' + routeKey });
      try {
        const result = handler(body);
        sendJson(res, 200, result);
      } catch (err) {
        if (err instanceof ApiError) sendJson(res, err.status, { error: err.message });
        else {
          console.error('[api] Error en', routeKey, ':', err.message);
          sendJson(res, 500, { error: 'Error interno: ' + err.message });
        }
      }
    });
    return;
  }

  serveStatic(res, pathname);
});

server.listen(PORT, () => {
  console.log('FC Galaxy escuchando en http://localhost:' + PORT);
  console.log(state ? 'Partida cargada: T' + state.season + ' S' + state.week : 'Sin partida: crea tu club al abrir la web');
});
