'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const storeMod = require('./store');
const { createAuth } = require('./auth');
const { ApiError, createRoutes } = require('./routes');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const COOKIE = 'fcg_session';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

const auth = createAuth(storeMod.DATA_DIR);

const sessionStores = new Map();
const sessionRoutes = new Map();
function sessionContext(accountId) {
  let store = sessionStores.get(accountId);
  if (!store) {
    store = accountId === 'guest' ? storeMod : storeMod.storeForAccount(accountId);
    sessionStores.set(accountId, store);
  }
  let routes = sessionRoutes.get(accountId);
  if (!routes) {
    let state = store.load();
    routes = createRoutes({
      getState: () => state,
      setState: (s) => { state = s; },
      store
    });
    sessionRoutes.set(accountId, routes);
  }
  return { store, routes };
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx > -1) out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

function sendJson(res, status, data, extraHeaders) {
  const body = JSON.stringify(data);
  res.writeHead(status, Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, extraHeaders || {}));
  res.end(body);
}

function sessionCookie(token, maxAgeDays) {
  const days = maxAgeDays === 0 ? 0 : 30;
  return { 'Set-Cookie': COOKIE + '=' + token + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' + (days * 24 * 3600) };
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

      const cookies = parseCookies(req);
      const token = cookies[COOKIE];

      try {
        if (pathname === '/api/auth/register' && req.method === 'POST') {
          const acc = auth.register(body.username, body.password);
          const { token: t } = auth.login(body.username, body.password);
          return sendJson(res, 200, { account: { id: acc.id, username: acc.username, provider: acc.provider } }, sessionCookie(t, 30));
        }
        if (pathname === '/api/auth/login' && req.method === 'POST') {
          const { token: t, account } = auth.login(body.username, body.password);
          return sendJson(res, 200, { account }, sessionCookie(t, 30));
        }
        if (pathname === '/api/auth/logout' && req.method === 'POST') {
          auth.logout(token);
          return sendJson(res, 200, { ok: true }, sessionCookie('', 0));
        }
        if (pathname === '/api/auth/me' && req.method === 'GET') {
          const account = auth.verify(token);
          if (!account) return sendJson(res, 401, { error: 'Sin sesi\u00f3n' });
          return sendJson(res, 200, { account });
        }
      } catch (err) {
        return sendJson(res, err instanceof ApiError ? err.status : 400, { error: err.message });
      }

      const account = auth.verify(token);
      if (!account) {
        return sendJson(res, 401, { error: 'Inicia sesi\u00f3n para jugar', authRequired: true });
      }

      const { routes } = sessionContext(account.id);
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
});
