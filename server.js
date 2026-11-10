/**
 * Kampala Fast-Casual Restaurant Suite — Unified Frontend & API Server
 * Outlets: Foodizo (Ham Towers) & Obunuzi Restaurant (Opp. YMCA, Wandegeya, Kampala)
 * Currency: UGX (Ugandan Shilling)
 *
 * Zero external dependencies: Runs on native Node.js (v18+)
 * Usage: node server.js [port]
 *
 * Canonical staff routes serve the live API-backed surfaces:
 *   /login /pos /kds /dispatch /admin
 *
 * The original static screens remain available as design prototypes under
 * /prototype/* so they are never mistaken for working production behaviour.
 *
 * /api/v1/* and the /ws/events upgrade are proxied to the Fastify backend on
 * BACKEND_PORT (default 4000).
 */

import http from 'http';
import net from 'net';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || process.argv[2] || '3000', 10);
const BACKEND_PORT = parseInt(process.env.BACKEND_PORT || '4000', 10);
const BACKEND_HOST = process.env.BACKEND_HOST || '127.0.0.1';
const FRONTEND_DIR = path.join(__dirname, 'frontend');
const FRONTEND_ROOT = path.resolve(FRONTEND_DIR);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf'
};

// Live surfaces, the launch hub, and clearly namespaced design prototypes.
const ROUTE_MAP = {
  // The launch hub explains which surfaces are live and which are prototypes.
  '/': 'html/index.html',
  '/hub': 'html/index.html',

  // Canonical live staff surfaces (API-backed).
  '/login': 'html/staff_terminal_pin_login.html',
  '/terminal': 'html/staff_terminal_pin_login.html',
  '/pos': 'live/pos.html',
  '/waitress': 'live/pos.html',
  '/kds': 'live/kds.html',
  '/kitchen': 'live/kds.html',
  '/dispatch': 'live/dispatch.html',
  '/boda': 'live/dispatch.html',
  '/admin': 'live/admin.html',
  '/digest': 'live/admin.html',
  '/order': 'live/customer-order.html',
  '/customer': 'live/customer-order.html',

  // Static design prototypes — clearly not live and never API-backed.
  '/prototype': 'html/index.html',
  '/prototype/customer': 'html/customer_pwa_landing_page.html',
  '/prototype/menu': 'html/campus_pre_order_menu.html',
  '/prototype/checkout': 'html/momo_checkout_delivery_zone_selector.html',
  '/prototype/token': 'html/digital_token_queue_bypass_status.html',
  '/prototype/tracker': 'html/boda_landmark_delivery_tracker.html',
  '/prototype/login': 'html/staff_terminal_pin_login.html',
  '/prototype/pos': 'html/waitress_pos_table_floor_order_pad.html',
  '/prototype/kds': 'html/kitchen_display_system_kds_active_stations.html',
  '/prototype/dispatch': 'html/foh_boda_dispatch_delivery_queue.html',
  '/prototype/admin': 'html/manager_admin_eod_surplus_audit_digest.html'
};

// Old customer-surface aliases now point at the prototype namespace so a static
// screen is never presented as a live ordering or payment flow.
const PROTOTYPE_REDIRECTS = {
  '/landing': '/prototype/customer',
  '/menu': '/prototype/menu',
  '/checkout': '/prototype/checkout',
  '/token': '/prototype/token',
  '/tracker': '/prototype/tracker'
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function proxyApiRequest(req, res) {
  const proxyReq = http.request(
    {
      hostname: BACKEND_HOST,
      port: BACKEND_PORT,
      path: req.url,
      method: req.method,
      headers: {
        ...req.headers,
        host: `${BACKEND_HOST}:${BACKEND_PORT}`
      }
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );

  proxyReq.on('error', (err) => {
    if (res.headersSent) {
      res.destroy();
      return;
    }
    sendJson(res, 502, {
      error: 'Bad Gateway',
      code: 'BACKEND_UNREACHABLE',
      message: `Backend API server on port ${BACKEND_PORT} is currently unreachable. Start it with: npm --prefix backend run dev`,
      details: err.message
    });
  });

  req.pipe(proxyReq);
}

function proxyWebSocketUpgrade(req, socket, head) {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (urlObj.pathname !== '/ws/events') {
    socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
    return;
  }

  const backendSocket = net.connect(BACKEND_PORT, BACKEND_HOST, () => {
    const headers = { ...req.headers, host: `${BACKEND_HOST}:${BACKEND_PORT}` };
    let raw = `${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`;

    for (const [key, value] of Object.entries(headers)) {
      if (value === undefined) continue;
      if (Array.isArray(value)) {
        for (const entry of value) raw += `${key}: ${entry}\r\n`;
      } else {
        raw += `${key}: ${value}\r\n`;
      }
    }
    raw += '\r\n';

    backendSocket.write(raw);
    if (head && head.length) backendSocket.write(head);

    backendSocket.pipe(socket);
    socket.pipe(backendSocket);
  });

  backendSocket.on('error', () => {
    if (!socket.destroyed) {
      socket.end('HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n');
    }
  });
  socket.on('error', () => backendSocket.destroy());
  backendSocket.on('close', () => socket.destroy());
  socket.on('close', () => backendSocket.destroy());
}

function renderNotFound(res, pathname) {
  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>404 - Surface Not Found</title>
      <style>
        body { font-family: system-ui, sans-serif; background: #0f172a; color: #f8fafc; padding: 40px; text-align: center; }
        .card { max-width: 640px; margin: 40px auto; background: #1e293b; padding: 30px; border-radius: 16px; border: 1px solid #334155; }
        h1 { color: #dc2626; margin-bottom: 8px; }
        a { color: #38bdf8; text-decoration: none; font-weight: bold; }
        a:hover { text-decoration: underline; }
        .routes { text-align: left; margin-top: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        code { color: #fca5a5; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>404 - Page Not Found</h1>
        <p>Could not find <code>${pathname}</code> in the Kampala Fast-Casual suite.</p>
        <div class="routes">
          <div><strong>Live Staff Surfaces:</strong><br>
            • <a href="/login">Staff PIN Login</a><br>
            • <a href="/pos">Floor POS Pad</a><br>
            • <a href="/kds">Kitchen Display (KDS)</a><br>
            • <a href="/dispatch">Boda Dispatch Queue</a><br>
            • <a href="/admin">Manager EOD Audit</a>
          </div>
          <div><strong>Static Prototypes (not live):</strong><br>
            • <a href="/">Launch hub</a><br>
            • <a href="/prototype/customer">Customer PWA</a><br>
            • <a href="/prototype/menu">Campus Menu</a><br>
            • <a href="/prototype/checkout">MoMo Checkout</a><br>
            • <a href="/prototype">All design prototypes</a>
          </div>
        </div>
      </div>
    </body>
    </html>
  `);
}

function serveStatic(pathname, res) {
  let relativePath = ROUTE_MAP[pathname];

  // Public read-only digest deep link: /d/<token>. The page itself validates
  // the token against GET /api/v1/digest/view/:token.
  if (!relativePath && (pathname === '/d' || pathname.startsWith('/d/'))) {
    relativePath = 'live/digest.html';
  }

  if (!relativePath && pathname.endsWith('/') && pathname !== '/') {
    const trimmed = pathname.replace(/\/+$/, '');
    relativePath = ROUTE_MAP[trimmed] || `${trimmed.slice(1)}`;
  }

  if (!relativePath) {
    const stripped = pathname === '/' ? '' : pathname.replace(/^\/+/, '');
    relativePath = stripped;
  }

  let filePath = path.resolve(FRONTEND_DIR, relativePath);

  // Security: prevent path traversal outside FRONTEND_DIR.
  if (filePath !== FRONTEND_ROOT && !filePath.startsWith(FRONTEND_ROOT + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      if (!path.extname(filePath)) {
        const htmlTry = `${filePath}.html`;
        if (fs.existsSync(htmlTry)) {
          filePath = htmlTry;
        } else {
          renderNotFound(res, pathname);
          return;
        }
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
        return;
      }
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300'
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(urlObj.pathname);
  const origin = req.headers.origin;

  // Same-origin by default; echo a configured dev origin when present so the
  // session cookie keeps working from a split dev frontend.
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (pathname.startsWith('/api/v1/')) {
    proxyApiRequest(req, res);
    return;
  }

  if (PROTOTYPE_REDIRECTS[pathname]) {
    res.writeHead(302, { Location: PROTOTYPE_REDIRECTS[pathname] });
    res.end();
    return;
  }

  serveStatic(pathname, res);
});

server.on('upgrade', (req, socket, head) => {
  proxyWebSocketUpgrade(req, socket, head);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('\n===============================================================');
  console.log(' KAMPALA FAST-CASUAL DINING & KITCHEN DISPLAY SYSTEM');
  console.log(' Foodizo (Ham Towers) & Obunuzi Restaurant (Opposite YMCA)');
  console.log(' Currency Engine: UGX (Ugandan Shilling)');
  console.log(` Server active on:  http://localhost:${PORT}`);
  console.log(` API + WS backend:  http://localhost:${BACKEND_PORT}`);
  console.log('===============================================================');
  console.log('LIVE STAFF SURFACES (API-backed):');
  console.log(`   Staff PIN Login:        http://localhost:${PORT}/login`);
  console.log(`    Floor POS Pad:          http://localhost:${PORT}/pos`);
  console.log(`   Kitchen Display (KDS):   http://localhost:${PORT}/kds`);
  console.log(`   Boda Dispatch Queue:    http://localhost:${PORT}/dispatch`);
  console.log(`   Manager EOD Audit:      http://localhost:${PORT}/admin`);
  console.log(`   Read-only Digest link:  http://localhost:${PORT}/d/<token>`);
  console.log(`   Customer Pickup Orders: http://localhost:${PORT}/order`);
  console.log('STATIC DESIGN PROTOTYPES (not live):');
  console.log(`   Launch hub:             http://localhost:${PORT}/`);
  console.log(`   Customer PWA prototype: http://localhost:${PORT}/prototype/customer`);
  console.log(`   Campus menu prototype:  http://localhost:${PORT}/prototype/menu`);
  console.log(`   MoMo checkout prototype:http://localhost:${PORT}/prototype/checkout`);
  console.log(`   Token prototype:        http://localhost:${PORT}/prototype/token`);
  console.log(`   Tracker prototype:      http://localhost:${PORT}/prototype/tracker`);
  console.log(`   All design prototypes:  http://localhost:${PORT}/prototype`);
  console.log('===============================================================\n');
});
