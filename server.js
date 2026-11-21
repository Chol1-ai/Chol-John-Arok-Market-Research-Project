/**
 * Kampala Fast-Casual Restaurant Suite — Unified Frontend & API Server
 * APP_OUTLET selects the restaurant served by this deployment (Foodizo by default).
 * Currency: UGX (Ugandan Shilling)
 *
 * Zero external dependencies: Runs on native Node.js (v18+)
 * Usage: node server.js [port]
 *
 * Canonical staff routes serve the live API-backed surfaces:
 *   /staff /login /pos /kds /dispatch /admin
 *
 * Former /prototype/* URLs redirect to live customer or staff workflows.
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
const OUTLET_BRANDS = {
  FOODIZO_HAM_TOWERS: {
    name: 'Foodizo',
    locationLabel: 'Ham Towers',
    outletLabel: 'Foodizo · Ham Towers',
    logoPath: '/images/Foodizo_logo.png?v=2'
  },
  OBUNUZI_YMCA: {
    name: 'Obunuzi',
    locationLabel: 'Opposite YMCA',
    outletLabel: 'Obunuzi · Opposite YMCA',
    logoPath: '/images/obunuzi_logo.png?v=1'
  }
};
const APP_OUTLET = process.env.APP_OUTLET || 'OBUNUZI_YMCA';
const APP_BRAND = OUTLET_BRANDS[APP_OUTLET];

if (!APP_BRAND) {
  throw new Error('APP_OUTLET must be FOODIZO_HAM_TOWERS or OBUNUZI_YMCA.');
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf'
};

// Public customer pages and staff surfaces gated by active session and role.
const ROUTE_MAP = {
  '/': 'html/index.html',
  '/hub': 'html/index.html',

  // Canonical live staff surfaces (API-backed).
  '/staff': 'html/staff_terminal_pin_login.html',
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
  '/tracker': 'html/boda_landmark_delivery_tracker.html',
  '/rider/dashboard': 'html/rider_tracking.html',
  '/rider/track': 'html/rider_tracking.html',

};

const STAFF_SURFACE_ROLES = {
  '/pos': ['WAITER_FOH', 'MANAGER_ADMIN'],
  '/waitress': ['WAITER_FOH', 'MANAGER_ADMIN'],
  '/live/pos.html': ['WAITER_FOH', 'MANAGER_ADMIN'],
  '/kds': ['KITCHEN_STAFF', 'MANAGER_ADMIN'],
  '/kitchen': ['KITCHEN_STAFF', 'MANAGER_ADMIN'],
  '/live/kds.html': ['KITCHEN_STAFF', 'MANAGER_ADMIN'],
  '/dispatch': ['WAITER_FOH', 'MANAGER_ADMIN'],
  '/boda': ['WAITER_FOH', 'MANAGER_ADMIN'],
  '/live/dispatch.html': ['WAITER_FOH', 'MANAGER_ADMIN'],
  '/admin': ['MANAGER_ADMIN'],
  '/digest': ['MANAGER_ADMIN'],
  '/live/admin.html': ['MANAGER_ADMIN']
};

const SESSION_COOKIE = 'foodizo_session';

// Keep former prototype URLs usable by sending them to the live workflows.
const LIVE_REDIRECTS = {
  '/category': '/order',
  '/prototype': '/',
  '/prototype/': '/',
  '/prototype/customer': '/order',
  '/prototype/menu': '/order',
  '/prototype/checkout': '/order#checkout-form',
  '/prototype/token': '/tracker',
  '/prototype/tracker': '/tracker',
  '/prototype/login': '/login',
  '/prototype/pos': '/pos',
  '/prototype/kds': '/kds',
  '/prototype/dispatch': '/dispatch',
  '/prototype/admin': '/admin',
  '/html/customer_pwa_landing_page.html': '/order',
  '/html/campus_pre_order_menu.html': '/order',
  '/html/momo_checkout_delivery_zone_selector.html': '/order#checkout-form',
  '/html/digital_token_queue_bypass_status.html': '/tracker',
  '/html/waitress_pos_table_floor_order_pad.html': '/pos',
  '/html/kitchen_display_system_kds_active_stations.html': '/kds',
  '/html/foh_boda_dispatch_delivery_queue.html': '/dispatch',
  '/html/manager_admin_eod_surplus_audit_digest.html': '/admin',
  '/landing': '/order',
  '/menu': '/order',
  '/checkout': '/order#checkout-form',
  '/token': '/tracker'
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

function getStaffUser(request) {
  const sessionCookie = String(request.headers.cookie || '')
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  const authorization = request.headers.authorization;
  const bearerToken = typeof authorization === 'string' && authorization.startsWith('Bearer ')
    ? authorization
    : null;
  const authHeaders = { accept: 'application/json' };

  if (bearerToken) {
    authHeaders.authorization = bearerToken;
  } else if (sessionCookie && sessionCookie.slice(SESSION_COOKIE.length + 1)) {
    authHeaders.cookie = sessionCookie;
  } else {
    return Promise.resolve(null);
  }

  return new Promise((resolve, reject) => {
    const authReq = http.request(
      {
        hostname: BACKEND_HOST,
        port: BACKEND_PORT,
        path: '/api/v1/auth/me',
        method: 'GET',
        headers: authHeaders,
        timeout: 5000
      },
      (authRes) => {
        let body = '';
        authRes.setEncoding('utf8');
        authRes.on('data', (chunk) => {
          body += chunk;
        });
        authRes.on('error', reject);
        authRes.on('end', () => {
          if (authRes.statusCode === 401 || authRes.statusCode === 403) {
            resolve(null);
            return;
          }
          if (!authRes.statusCode || authRes.statusCode < 200 || authRes.statusCode >= 300) {
            reject(new Error(`Session verification returned HTTP ${authRes.statusCode || 0}`));
            return;
          }

          try {
            const payload = JSON.parse(body);
            if (!payload.user || typeof payload.user.role !== 'string') {
              throw new Error('Session verification returned an invalid user.');
            }
            resolve(payload.user);
          } catch (error) {
            reject(error);
          }
        });
      }
    );

    authReq.on('timeout', () => {
      authReq.destroy(new Error('Session verification timed out.'));
    });
    authReq.on('error', reject);
    authReq.end();
  });
}

async function enforceStaffSurface(req, res, pathname, search) {
  const normalizedPath = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  const allowedRoles = STAFF_SURFACE_ROLES[normalizedPath];
  if (!allowedRoles) return false;

  let user;
  try {
    user = await getStaffUser(req);
  } catch (error) {
    console.error('Staff route session verification failed:', error);
    res.writeHead(503, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store'
    });
    res.end('Staff access verification is unavailable. Please try again.');
    return true;
  }

  if (!user) {
    const next = `${pathname}${search}`;
    res.writeHead(302, {
      Location: `/staff?next=${encodeURIComponent(next)}`,
      'Cache-Control': 'no-store'
    });
    res.end();
    return true;
  }

  if (!allowedRoles.includes(user.role)) {
    res.writeHead(302, {
      Location: user.homePath || '/',
      'Cache-Control': 'no-store'
    });
    res.end();
    return true;
  }

  return false;
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
          <div><strong>Customer Workflows:</strong><br>
            • <a href="/">Customer home</a><br>
            • <a href="/order">Menu, ordering &amp; checkout</a><br>
            • <a href="/tracker">Order token &amp; tracking</a><br>
            • <a href="/rider/dashboard">Rider dashboard (private invite required)</a><br>
            • <a href="/customer">Customer ordering</a>
          </div>
          <div><strong>Staff?</strong><br>
            Sign in at <a href="/staff">/staff</a>. Dashboards require an active staff account.
          </div>
        </div>
      </div>
    </body>
    </html>
  `);
}

function serveAppConfig(res) {
  const config = JSON.stringify({
    outlet: APP_OUTLET,
    brandName: APP_BRAND.name,
    locationLabel: APP_BRAND.locationLabel,
    outletLabel: APP_BRAND.outletLabel,
    logoPath: APP_BRAND.logoPath
  });
  res.writeHead(200, {
    'Content-Type': 'application/javascript; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(`(function () {
  const appConfig = Object.freeze(${config});
  window.FoodizoAppConfig = appConfig;
  document.documentElement.dataset.appOutlet = appConfig.outlet;
  document.addEventListener('DOMContentLoaded', function () {
    document.body.dataset.appOutlet = appConfig.outlet;
    document.querySelectorAll('[data-outlet-copy]').forEach(function (node) {
      node.hidden = node.getAttribute('data-outlet-copy') !== appConfig.outlet;
      if (node.hidden) {
        node.style.setProperty('display', 'none', 'important');
      } else {
        node.style.removeProperty('display');
      }
    });

    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) {
      themeColor.content = appConfig.outlet === 'OBUNUZI_YMCA' ? '#f3f1ef' : '#211f1b';
    }

    function replaceBranding(value) {
      return value
        .replace(/\\b(?:Foodizo|Obunuzi)\\b/gi, appConfig.brandName)
        .replace(/\\b(?:Ham Towers|Opposite YMCA|Opp\\.?\\s+YMCA)\\b/gi, appConfig.locationLabel);
    }

    document.title = replaceBranding(document.title);
    document.querySelectorAll('img[src*="Foodizo_logo.png"], img[src*="obunuzi_logo.png"]').forEach(function (image) {
      image.src = appConfig.logoPath;
      if (image.alt) image.alt = replaceBranding(image.alt);
      if (!image.nextElementSibling || !image.nextElementSibling.matches('[data-app-brand], .app-brand-name')) {
        const parent = image.parentElement;
        const existingBrandName = parent && parent.querySelector('[data-app-brand], .app-brand-name, strong');
        if (!existingBrandName) {
          const name = document.createElement('span');
          name.className = 'app-brand-name';
          name.textContent = appConfig.brandName;
          name.setAttribute('aria-hidden', 'true');
          image.insertAdjacentElement('afterend', name);
        }
      }
    });
    document.querySelectorAll('link[rel~="icon"]').forEach(function (icon) {
      icon.href = appConfig.logoPath;
    });
    document.querySelectorAll('select').forEach(function (select) {
      const options = Array.from(select.options);
      const outletOption = options.find(function (option) {
        return option.value === 'FOODIZO_HAM_TOWERS' || option.value === 'OBUNUZI_YMCA';
      });
      if (!outletOption) return;
      outletOption.value = appConfig.outlet;
      outletOption.textContent = appConfig.outletLabel;
      options.forEach(function (option) {
        if (option === outletOption) return;
        if (
          option.value === 'ALL' ||
          option.value === 'FOODIZO_HAM_TOWERS' ||
          option.value === 'OBUNUZI_YMCA'
        ) {
          option.remove();
        }
      });
      select.value = appConfig.outlet;
      select.hidden = true;
      const field = select.closest('label');
      if (field) field.hidden = true;
    });
    document.querySelectorAll('[data-app-brand]').forEach(function (node) {
      node.textContent = appConfig.brandName;
    });
    document.querySelectorAll('[data-app-outlet-label]').forEach(function (node) {
      node.textContent = appConfig.outletLabel;
    });
    document.querySelectorAll('[data-app-outlet-map]').forEach(function (node) {
      node.href = 'https://www.google.com/maps/search/?api=1&query=' +
        encodeURIComponent(appConfig.locationLabel + ', Kampala');
    });
    document.querySelectorAll('[title], [alt], [aria-label], [placeholder], meta[content]').forEach(function (node) {
      ['title', 'alt', 'aria-label', 'placeholder', 'content'].forEach(function (attribute) {
        const value = node.getAttribute(attribute);
        if (value) node.setAttribute(attribute, replaceBranding(value));
      });
    });

    const textWalker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        return node.parentElement && node.parentElement.closest('script, style, noscript, textarea')
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT;
      }
    });
    while (textWalker.nextNode()) {
      textWalker.currentNode.nodeValue = replaceBranding(textWalker.currentNode.nodeValue);
    }
  });
})();`);
}

function serveStatic(pathname, res, options) {
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

    if (ext === '.html') {
      fs.readFile(filePath, 'utf8', (readError, html) => {
        if (readError) {
          console.error(`Could not read frontend page ${filePath}:`, readError);
          res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Could not load this page.');
          return;
        }
        res.writeHead(200, {
          'Content-Type': contentType,
          'Cache-Control': options && options.noStore ? 'no-store' : 'no-cache'
        });
        res.end(html.replace(/<head(\s[^>]*)?>/i, (head) => `${head}\n  <script src="/app-config.js"></script>`));
      });
      return;
    }
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': options && options.noStore ? 'no-store' : 'public, max-age=300'
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
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

  if (pathname === '/app-config.js') {
    serveAppConfig(res);
    return;
  }

  if (pathname.startsWith('/api/v1/')) {
    proxyApiRequest(req, res);
    return;
  }

  const liveRedirect = LIVE_REDIRECTS[pathname] ||
    (pathname.startsWith('/prototype/') ? '/' : null);
  if (liveRedirect) {
    const destination = new URL(liveRedirect, `http://${req.headers.host || 'localhost'}`);
    if (urlObj.search) destination.search = urlObj.search;
    res.writeHead(302, {
      Location: `${destination.pathname}${destination.search}${destination.hash}`
    });
    res.end();
    return;
  }

  const isStaffSurface = Object.prototype.hasOwnProperty.call(
    STAFF_SURFACE_ROLES,
    pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  );
  if (await enforceStaffSurface(req, res, pathname, urlObj.search)) return;

  const isTrackingSurface =
    pathname === '/rider/dashboard' || pathname === '/rider/track';
  serveStatic(
    pathname,
    res,
    isStaffSurface || isTrackingSurface ? { noStore: true } : undefined
  );
});

server.on('upgrade', (req, socket, head) => {
  proxyWebSocketUpgrade(req, socket, head);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('\n===============================================================');
  console.log(` ${APP_BRAND.name.toUpperCase()} RESTAURANT & KITCHEN DISPLAY SYSTEM`);
  console.log(` ${APP_BRAND.outletLabel}`);
  console.log(' Currency Engine: UGX (Ugandan Shilling)');
  console.log(` Server active on:  http://localhost:${PORT}`);
  console.log(` API + WS backend:  http://localhost:${BACKEND_PORT}`);
  console.log('===============================================================');
  console.log('LIVE STAFF SURFACES (API-backed):');
  console.log(`   Staff PIN Login:        http://localhost:${PORT}/staff`);
  console.log(`    Floor POS Pad:          http://localhost:${PORT}/pos`);
  console.log(`   Kitchen Display (KDS):   http://localhost:${PORT}/kds`);
  console.log(`   Boda Dispatch Queue:    http://localhost:${PORT}/dispatch`);
  console.log(`   Manager EOD Audit:      http://localhost:${PORT}/admin`);
  console.log(`   Read-only Digest link:  http://localhost:${PORT}/d/<token>`);
  console.log(`   Customer Orders:        http://localhost:${PORT}/order`);
  console.log(`   Live customer tracker:  http://localhost:${PORT}/tracker`);
  console.log(`   Rider dashboard:        http://localhost:${PORT}/rider/dashboard (private invite required)`);
  console.log('LIVE CUSTOMER FLOWS:');
  console.log(`   Customer ordering:     http://localhost:${PORT}/order`);
  console.log(`   Order tracker:         http://localhost:${PORT}/tracker`);
  console.log('Former /prototype/* URLs redirect to live surfaces.');
  console.log(`   Customer home:          http://localhost:${PORT}/`);
  console.log('===============================================================\n');
});
