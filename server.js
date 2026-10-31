/**
 * Kampala Fast-Casual Restaurant Suite — Unified Frontend & API Server
 * Outlets: Foodizo (Ham Towers) & Obunuzi Restaurant (Opp. YMCA, Wandegeya, Kampala)
 * Currency: UGX (Ugandan Shilling)
 * 
 * Zero external dependencies: Runs on native Node.js (v18+)
 * Usage: node server.js [port]
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || process.argv[2] || '3000', 10);
const BACKEND_PORT = parseInt(process.env.BACKEND_PORT || '4000', 10);
const FRONTEND_DIR = path.join(__dirname, 'frontend');

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

// Route shortcuts
const ROUTE_MAP = {
  '/': 'html/customer_pwa_landing_page.html',
  '/hub': 'html/index.html',
  '/landing': 'html/customer_pwa_landing_page.html',
  '/customer': 'html/customer_pwa_landing_page.html',
  '/menu': 'html/campus_pre_order_menu.html',
  '/checkout': 'html/momo_checkout_delivery_zone_selector.html',
  '/token': 'html/digital_token_queue_bypass_status.html',
  '/tracker': 'html/boda_landmark_delivery_tracker.html',
  '/login': 'html/staff_terminal_pin_login.html',
  '/terminal': 'html/staff_terminal_pin_login.html',
  '/pos': 'html/waitress_pos_table_floor_order_pad.html',
  '/waitress': 'html/waitress_pos_table_floor_order_pad.html',
  '/kds': 'html/kitchen_display_system_kds_active_stations.html',
  '/kitchen': 'html/kitchen_display_system_kds_active_stations.html',
  '/dispatch': 'html/foh_boda_dispatch_delivery_queue.html',
  '/boda': 'html/foh_boda_dispatch_delivery_queue.html',
  '/admin': 'html/manager_admin_eod_surplus_audit_digest.html',
  '/digest': 'html/manager_admin_eod_surplus_audit_digest.html'
};

const server = http.createServer((req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = decodeURIComponent(urlObj.pathname);

  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Proxy /api/v1 requests to Fastify backend if running
  if (pathname.startsWith('/api/v1/')) {
    const proxyReq = http.request(
      {
        hostname: 'localhost',
        port: BACKEND_PORT,
        path: req.url,
        method: req.method,
        headers: {
          ...req.headers,
          host: `localhost:${BACKEND_PORT}`
        }
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
        proxyRes.pipe(res);
      }
    );

    proxyReq.on('error', (err) => {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: 'Bad Gateway',
          message: `Backend API server on port ${BACKEND_PORT} is currently unreachable. Start it with: cd backend && npm run dev`,
          details: err.message
        })
      );
    });

    req.pipe(proxyReq);
    return;
  }

  // Resolve Route shortcut
  let relativePath = ROUTE_MAP[pathname];
  if (!relativePath) {
    if (pathname.startsWith('/')) pathname = pathname.slice(1);
    relativePath = pathname;
  }

  let filePath = path.join(FRONTEND_DIR, relativePath);

  // Security: prevent path traversal outside FRONTEND_DIR
  if (!filePath.startsWith(FRONTEND_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  // Check if file exists
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback: check if appending .html works
      if (!path.extname(filePath)) {
        const htmlTry = filePath + '.html';
        if (fs.existsSync(htmlTry)) {
          filePath = htmlTry;
        } else {
          res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>404 - Surface Not Found</title>
              <style>
                body { font-family: system-ui, sans-serif; background: #0f172a; color: #f8fafc; padding: 40px; text-align: center; }
                .card { max-width: 600px; margin: 40px auto; background: #1e293b; padding: 30px; border-radius: 16px; border: 1px solid #334155; }
                h1 { color: #dc2626; margin-bottom: 8px; }
                a { color: #38bdf8; text-decoration: none; font-weight: bold; }
                a:hover { text-decoration: underline; }
                .routes { text-align: left; margin-top: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
              </style>
            </head>
            <body>
              <div class="card">
                <h1>404 - Page Not Found</h1>
                <p>Could not find <code>${pathname}</code> in the Kampala Fast-Casual suite.</p>
                <div class="routes">
                  <div><strong>Customer Surfaces:</strong><br>
                    • <a href="/">Customer PWA Landing</a><br>
                    • <a href="/menu">Pre-Order Menu</a><br>
                    • <a href="/checkout">MoMo Checkout</a><br>
                    • <a href="/token">Token Pass</a><br>
                    • <a href="/tracker">Boda Tracker</a>
                  </div>
                  <div><strong>Staff & POS Surfaces:</strong><br>
                    • <a href="/login">Staff PIN Login</a><br>
                    • <a href="/pos">Waitress POS Pad</a><br>
                    • <a href="/kds">Kitchen Display (KDS)</a><br>
                    • <a href="/dispatch">Boda Dispatch Queue</a><br>
                    • <a href="/admin">Manager EOD Audit</a>
                  </div>
                </div>
              </div>
            </body>
            </html>
          `);
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

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('\n===============================================================');
  console.log('🚀 KAMPALA FAST-CASUAL DINING & KITCHEN DISPLAY SYSTEM');
  console.log('📍 Foodizo (Ham Towers) & Obunuzi Restaurant (Opposite YMCA)');
  console.log('💰 Currency Engine: UGX (Ugandan Shilling)');
  console.log(`🌐 Server active on: http://localhost:${PORT}`);
  console.log('===============================================================');
  console.log('SURFACE SHORTCUTS:');
  console.log(`  📱 Customer PWA Landing:   http://localhost:${PORT}/`);
  console.log(`  🍲 Campus Express Menu:    http://localhost:${PORT}/menu`);
  console.log(`  💳 MoMo STK Checkout:      http://localhost:${PORT}/checkout`);
  console.log(`  🎫 Digital Token (#F-104): http://localhost:${PORT}/token`);
  console.log(`  🛵 Boda Landmark Tracker:  http://localhost:${PORT}/tracker`);
  console.log(`  🔐 Staff PIN Login:        http://localhost:${PORT}/login`);
  console.log(`  🍽️  Waitress Floor POS Pad: http://localhost:${PORT}/pos`);
  console.log(`  👨‍🍳 Kitchen Display (KDS):   http://localhost:${PORT}/kds`);
  console.log(`  📦 Boda Dispatch Queue:    http://localhost:${PORT}/dispatch`);
  console.log(`  📊 Manager EOD Audit:      http://localhost:${PORT}/admin`);
  console.log('===============================================================\n');
});

