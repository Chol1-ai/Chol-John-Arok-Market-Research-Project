# Repository Scaffold, Dependencies & Environment Configuration

**Runtime:** Node.js ≥ 20<br>
**Backend:** TypeScript + Fastify 5 + Prisma 5 + PostgreSQL<br>
**Frontend:** Static HTML, CSS, and vanilla JS served by the root Node `server.js` process<br>
**Target Locations:** Foodizo (Ham Towers) & Obunuzi (Opposite YMCA)<br>
**Related Specifications:** `Foundational_Concept.md` · `Design_System.md` · `User_Flow.md` · `User_Profiles_Personas.md` · `Delivery_Zones_and_Dispatch.md` · `Tech_Stack.md` · `Payment_Integration.md` · `Hardware_and_Peripherals.md` · `Seed_Data_and_Testing.md` · `Daily_Audit_Digest.md` · `Deployment_Runbook.md` · `build_strategy/Build_Strategy_and_Phases.md`

> **Implementation status:** This is the scaffold that exists in the repository, not a target Next.js monorepo. The backend compiles to `backend/dist/` and runs as a Fastify API; the frontend is static files served by `server.js`. There is no Redis, no SMTP transport, and no supported Docker Compose deployment. `docker-compose.yml` and `backend/Dockerfile` are legacy artifacts and are not the reference deployment (`Deployment_Runbook.md`).

---

## 1. Directory Tree

```text
Chol-John-Arok-Market-Research-Project/
|-- package.json                  # Root static-server scripts
|-- server.js                     # Static frontend + API proxy + route map
|-- docker-compose.yml            # Legacy, not the reference deployment
|-- README.md
|-- docs/                         # Specifications
|-- build_strategy/
|-- go_to_market/
|-- frontend/
|   |-- live/                     # API-backed staff screens
|   |   |-- pos.html
|   |   |-- kds.html
|   |   |-- dispatch.html
|   |   |-- admin.html
|   |   `-- digest.html           # Public /d/<token> report
|   |-- html/                     # Hub, login, tracker, and retained legacy design files
|   |-- js/
|   |   |-- api.js                # Session guard, API client, WebSocket client
|   |   |-- login.js
|   |   |-- pos.js
|   |   |-- kds.js
|   |   |-- dispatch.js
|   |   |-- admin.js
|   |   `-- digest.js
|   |-- css/                      # Shared tokens, live surfaces, prototype CSS
|   |-- images/
|   `-- design_tokens_kampala_fast_casual.md
`-- backend/
    |-- package.json
    |-- tsconfig.json
    |-- Dockerfile                # Legacy, not the reference deployment
    |-- .env.example
    |-- prisma/
    |   |-- schema.prisma         # 17 models, 13 enums
    |   `-- seed.ts               # Canonical fixtures
    |-- src/
    |   |-- index.ts              # API entrypoint + node-cron digest scheduler
    |   |-- app.ts                # Fastify app, route registration, auth, rate limit
    |   |-- config.ts             # Zod-validated environment
    |   |-- plugins/
    |   |   |-- auth.ts           # JWT, HttpOnly cookie, session revocation
    |   |   |-- prisma.ts
    |   |   `-- websocket.ts      # In-process WebSocket bus (/ws/events)
    |   |-- routes/
    |   |   |-- auth.ts           # terminal-staff, pin, me, logout
    |   |   |-- categories.ts
    |   |   |-- menu.ts           # menu list + availability/86
    |   |   |-- tables.ts         # occupancy + drawer kick
    |   |   |-- orders.ts         # create, token lookup, settle, cancel, reprint, dispatch, delivery-complete
    |   |   |-- kds.ts            # queue, claim, bump
    |   |   |-- payments.ts       # MoMo push stub, webhooks, refund
    |   |   |-- dispatch.ts       # rider handoff queue and outcomes
    |   |   |-- surplus.ts        # closing surplus logs
    |   |   `-- digest.ts         # preview, overview, reconcile-cash, dispatch-now, view
    |   |-- services/
    |   |   |-- tokenService.ts
    |   |   |-- bomService.ts
    |   |   |-- momoService.ts    # STK-initiation stub
    |   |   |-- handoffService.ts
    |   |   |-- printerService.ts # ESC/POS + text sanitization
    |   |   |-- smsService.ts     # Africa's Talking (MOCK/LIVE/FAILED)
    |   |   `-- digestService.ts
    |   |-- types/
    |   `-- utils/
    `-- tests/                    # Vitest suites
        |-- bom.test.ts
        |-- digest.test.ts
        |-- integration.test.ts
        |-- printer.test.ts
        `-- tokenService.test.ts
```

### 1.1 Live Routes

| Route | Serves |
| :--- | :--- |
| `/` | Launch hub linking to live customer and staff workflows |
| `/login` | Staff directory + PIN login |
| `/pos` | Floor POS and table tabs |
| `/kds` | Kitchen Display System |
| `/dispatch` | Boda dispatch queue |
| `/admin` | Manager audit, cash, surplus, digest |
| `/d/:token` | Public read-only digest report |
| `/prototype/*` | Legacy URLs redirecting to live customer/staff workflows |

Customer ordering is live at `/order` and `/customer`; order tracking is live at `/tracker`. Legacy `/prototype/*` and customer alias URLs redirect to live ordering, tracking, or the corresponding role-protected staff surface. `/waitress`, `/kitchen`, `/boda`, and `/digest` are aliases for the live staff surfaces.

---

## 2. Dependencies

### 2.1 Root (`package.json`)

The root package has no framework dependencies. It runs the static server and proxies `/api/*` to the backend.

```json
{
  "scripts": {
    "start": "node server.js",
    "serve": "node server.js",
    "dev": "node server.js",
    "backend": "npm --prefix backend run dev",
    "backend:start": "npm --prefix backend start",
    "backend:build": "npm --prefix backend run build",
    "test": "npm --prefix backend test"
  }
}
```

### 2.2 Backend (`backend/package.json`)

| Runtime dependencies | Purpose |
| :--- | :--- |
| `fastify`, `@fastify/cookie`, `@fastify/cors`, `@fastify/jwt`, `@fastify/rate-limit`, `@fastify/sensible`, `@fastify/websocket` | HTTP API, auth, CORS, rate limiting, WebSocket |
| `@prisma/client`, `prisma` | PostgreSQL ORM and migrations |
| `zod` | Request and environment validation |
| `bcryptjs` | PIN hashing |
| `dotenv` | Environment loading |
| `node-cron` | 21:30 EAT digest scheduler |
| `ws` | WebSocket server |

Dev dependencies: `typescript`, `tsx`, `vitest`, `@types/*`, `prisma`.

There is **no** `next`, `react`, `ioredis`, `nodemailer`, or `axios` dependency. Telco HTTP calls are not implemented; SMS uses global `fetch`.

### 2.3 Scripts

```bash
npm start                              # frontend static server on :3000
npm --prefix backend run dev           # API watch mode on :4000
npm --prefix backend run build         # tsc -> backend/dist
npm --prefix backend start             # node dist/index.js
npm --prefix backend test              # vitest run
npm --prefix backend run prisma:generate
npm --prefix backend run prisma:migrate
npm --prefix backend run prisma:seed
```

---

## 3. Database Schema

The authoritative schema is `backend/prisma/schema.prisma`. Do not duplicate it in documentation; read the file before changing a model or enum.

### 3.1 Models

| Area | Models |
| :--- | :--- |
| Identity and audit | `users`, `user_sessions`, `audit_log` |
| Menu and inventory | `menu_items`, `raw_inventory`, `recipe_bom` |
| Floor and orders | `restaurant_tables`, `orders`, `order_items`, `token_counters` |
| Delivery | `delivery_zones`, `delivery_handoffs` |
| Payments | `payments`, `payment_events` |
| Reporting | `cash_counts`, `closing_surplus_logs`, `daily_digests` |

### 3.2 Enums

`outlet_location`, `user_role`, `channel_type`, `order_status`, `station_type`, `table_status`, `uom_type`, `surplus_action`, `dispatch_method`, `handoff_outcome`, `digest_status`, `payment_status`, `payment_carrier`.

### 3.3 Constraints That Matter

- `payment_events(provider, event_id)` is unique; duplicate webhooks insert zero rows.
- A payment attempt has a unique `idempotency_key`; one successful payment per order is enforced in the settlement/webhook transaction.
- `user_sessions.token_hash` is unique; every JWT includes a unique `jti`.
- `token_counters` allocates `TOKEN-NNN` per outlet and business date.
- `business_date` is the UTC midnight of the 05:00 EAT business day.

### 3.4 Seed

`backend/prisma/seed.ts` is the canonical fixture source. It creates **7 staff users** with PIN `1234`, **16 tables per outlet** (`T-01…T-12`, `B-01…B-04`), menus, delivery zones, recipe BOMs, 16 orders, 4 delivery handoffs, 5 surplus logs, 5 digest flags, and balanced cash counts. Re-run it after E2E tests to restore the documented baseline:

```bash
npm --prefix backend run prisma:seed
```

---

## 4. Environment Variables

Copy `backend/.env.example` to `backend/.env`. `backend/src/config.ts` validates the values with Zod.

| Variable | Default | Notes |
| :--- | :--- | :--- |
| `NODE_ENV` | `development` | `development` / `test` / `production` |
| `PORT` | `4000` | API port |
| `HOST` | `0.0.0.0` | API bind address |
| `CORS_ORIGIN` | `http://localhost:3000,http://127.0.0.1:3000` | Allowed frontend origins |
| `DATABASE_URL` | local `foodizo_obunuzi_db` | PostgreSQL connection string |
| `JWT_SECRET` | development value | Minimum 16 characters; replace in production |
| `JWT_EXPIRATION_HOURS` | `12` | Session lifetime |
| `PAYMENTS_WEBHOOK_SECRET` | empty | Enables HMAC `X-Foodizo-Signature`; unsigned callbacks are rejected in production |
| `MTN_MOMO_*` | sandbox values | Present for the future telco client; `requestToPay()` is a stub |
| `AIRTEL_MONEY_*` | sandbox values | Present for the future telco client |
| `AFRICASTALKING_USERNAME` | `sandbox` | SMS gateway username |
| `AFRICASTALKING_API_KEY` | `sandbox_key` | `sandbox_key` keeps SMS in `MOCK` mode |
| `SMS_SENDER_ID` | `FOODIZO` | SMS sender |
| `EXPO_PRINTER_IP` | `192.168.1.200` | ESC/POS printer |
| `EXPO_PRINTER_PORT` | `9100` | Raw TCP print port |
| `CASH_DRAWER_KICK_ENABLED` | `1` | Drawer pulse flag |
| `DIGEST_CRON_SCHEDULE` | `30 21 * * *` | 21:30 EAT, `Africa/Kampala` |
| `DIGEST_RECIPIENT_PHONE` | `+256772000000` | Owner SMS recipient |
| `DIGEST_RECIPIENT_EMAIL` | `zito.mbowe@foodizo.ug` | Stored for future email; no transport |
| `DIGEST_APP_URL` | `http://localhost:3000` | Base URL for 72-hour `/d/<token>` links |
| `DIGEST_EMAIL_ENABLED` | `false` | `true` reports `FAILED_NOT_IMPLEMENTED`; no SMTP |

### 4.1 Production Checklist

1. Set a strong `JWT_SECRET` and a real `PAYMENTS_WEBHOOK_SECRET`.
2. Use a PostgreSQL role with only the privileges the app needs.
3. Set `AFRICASTALKING_API_KEY` to a real key; otherwise SMS stays `MOCK`.
4. Set `DIGEST_APP_URL` to the public HTTPS origin so the 72-hour links resolve.
5. Leave `DIGEST_EMAIL_ENABLED=false` until a mailer is implemented.
6. Wire the real MTN/Airtel client before accepting mobile-money payments in production.

---

## 5. Local Bootstrap

```bash
# 1. Install
npm install
npm --prefix backend install

# 2. Database
# Create the database, then:
npm --prefix backend run prisma:generate
npm --prefix backend run prisma:migrate
npm --prefix backend run prisma:seed

# 3. Environment
copy backend/.env.example backend/.env   # Windows
# cp backend/.env.example backend/.env   # Linux/macOS

# 4. Run
npm --prefix backend run dev             # API on :4000
npm start                                # frontend on :3000
```

Open `http://127.0.0.1:3000/` for the launch hub. The login page lists the seven seeded staff accounts; the PIN for every account is `1234`.

### 5.1 Quality Gate

Before committing:

```bash
npm --prefix backend run build
npm --prefix backend test
```

The Vitest suites cover token sequences, BOM deduction, ESC/POS formatting and sanitization, cash variance, auth/session revocation, order lifecycle, webhooks, rider dispatch, and digest privacy. The Puppeteer browser E2E harness lives outside the repository; see `Seed_Data_and_Testing.md` for the current pass record and rerun procedure.

---

## 6. Deployment Boundary

The reference deployment is a host running Node.js, PostgreSQL, the Fastify API under systemd, and `server.js` behind a TLS reverse proxy. See `Deployment_Runbook.md`.

- Do **not** use `docker-compose.yml` as an installation guide; it is legacy and is not maintained.
- There is no Redis service, no Next.js server, and no SMTP service.
- The WebSocket bus is in-process. Running multiple API instances without a shared bus would split live events; keep one API process per outlet deployment.
- The digest scheduler runs inside the API process. Multiple API instances would each schedule the digest; the in-process overlap guard does not coordinate across processes.
