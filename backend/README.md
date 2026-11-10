# Backend Engine & Fastify API (`backend/`)

> **Location:** `backend/`  
> **Framework:** TypeScript + Fastify API Engine + Prisma ORM  
> **Brand & Outlets:** Foodizo (Ham Towers) & Obunuzi Restaurant (Opposite YMCA, Wandegeya, Kampala)

---

## 1. Architecture Overview

The backend is built with Fastify, Prisma ORM, and TypeScript to power the five live staff surfaces of the Kampala fast-casual restaurant suite (`/login`, `/pos`, `/kds`, `/dispatch`, `/admin`). The customer menu prototype reads the live menu catalogue, but its cart and checkout remain demonstrations and do not create orders.

* **High Throughput & Low Overhead:** Fastify delivers low latency during the 12:00–14:00 campus lunch rush.
* **Real-Time WebSocket Bus (`/ws/events`):** Pushes live ticket creations, bumps, and takeaway token statuses to KDS displays without client polling.
* **Local LAN Hardware Integration:** Direct TCP socket communication with the Station #4 Expo Pass 80mm ESC/POS thermal printer (`192.168.1.200:9100`) and RJ12 drawer kick triggers.
* **Payment Integrity:** Customer pickup orders remain in `AWAITING_PAYMENT` until cash is recorded at the counter. Customer delivery orders use cash on delivery and enter `PENDING` so the kitchen can prepare; the rider records collected cash at handoff. FOH waitstaff table tabs execute postpay directly into `PENDING`.
* **Automatic BOM Deduction:** Claiming kitchen tickets automatically deducts recipe ingredients from `raw_inventory` and records each deduction in the stock activity ledger. Managers can record opening counts, manual use, supplier orders, and partial deliveries.

---

## 2. Directory Structure

```
backend/
├── package.json                          # Dependencies (@fastify, prisma, bcryptjs, zod, vitest)
├── tsconfig.json                         # NodeNext TypeScript configuration
├── .env.example                          # Canonical environment configuration
│
├── prisma/
│   ├── schema.prisma                     # 17 models, 13 enums, indexing & relations
│   └── seed.ts                           # Market seed with staff PINs, menu items & BOM recipes
│
├── src/
│   ├── index.ts                          # Server entrypoint (listening on port 4000)
│   ├── app.ts                            # Fastify app builder & plugin registration
│   ├── config.ts                         # Zod-validated environment config
│   │
│   ├── plugins/
│   │   ├── prisma.ts                     # Prisma Client decorator & connection pool
│   │   ├── auth.ts                       # JWT + 4-digit PIN auth guard & RBAC hooks
│   │   ├── websocket.ts                  # Real-time WebSocket event broadcaster
│   │   └── errorHandler.ts               # Standardized Fastify error responses
│   │
│   ├── routes/
│   │   ├── auth.ts                       # Staff PIN authentication (/api/v1/auth)
│   │   ├── categories.ts                 # Category listings (/api/v1/categories)
│   │   ├── menu.ts                       # Menu catalogue, manager editing, photos & availability (/api/v1/menu-items)
│   │   ├── tables.ts                     # Table occupancy & status matrix (/api/v1/tables)
│   │   ├── orders.ts                     # Order creation, tokens & state transitions (/api/v1/orders)
│   │   ├── kds.ts                        # Multi-station ticket claim & bump flow (/api/v1/kds)
│   │   ├── payments.ts                   # MTN/Airtel MoMo STK push & settlement (/api/v1/payments)
│   │   ├── dispatch.ts                   # Boda rider handoffs & transport advance (/api/v1/dispatch)
│   │   ├── surplus.ts                    # EOD surplus clearance & waste logging (/api/v1/surplus)
│   │   └── digest.ts                     # Scheduled/on-demand audit digest, cash counts & read-only links (/api/v1/digest)
│   │
│   ├── services/
│   │   ├── tokenService.ts               # Sequential digital token generator (TOKEN-001..TOKEN-999)
│   │   ├── bomService.ts                 # Recipe Bill-of-Materials atomic stock decrement
│   │   ├── printerService.ts             # ESC/POS raw TCP thermal receipt print engine
│   │   ├── smsService.ts                 # Africa's Talking SMS delivery/pickup alerts (MOCK in development)
│   │   ├── momoService.ts                # STK-initiation stub; no live telco HTTP call
│   │   ├── handoffService.ts             # Rider assignment, delivery outcome, and advance reconciliation
│   │   └── digestService.ts              # End-of-day sales reconciliation & cash variance
│   │
│   ├── utils/
│   │   ├── phone.ts                      # Ugandan MSISDN normalization
│   │   └── businessDate.ts               # Kampala 05:00 EAT business-day rollover
│   │
│   └── types/
│       └── index.ts                      # Shared TypeScript types, enums & DTO interfaces
│
└── tests/
    ├── tokenService.test.ts              # Unit tests for token sequence & daily reset
    ├── bom.test.ts                       # Unit tests for recipe BOM calculations
    ├── printer.test.ts                   # Unit tests for ESC/POS chit byte formatting & paper cut
    ├── digest.test.ts                    # Unit tests for cash drawer reconciliation & variance
    └── integration.test.ts               # End-to-end auth, RBAC, orders, webhooks, dispatch & digest
```

---

## 3. Getting Started

### 3.1 Install Dependencies
```bash
cd backend
npm install
```

### 3.2 Environment Setup
Copy the example environment file and adjust credentials if needed:
```bash
cp .env.example .env
```

### 3.3 Database Migration & Seeding
Ensure PostgreSQL is running on port 5432, then generate the Prisma client and seed development data:
```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

#### Seeded Staff Credentials (demo PIN `1234` for every account):
| Staff member | Role | Outlet | Phone |
| :--- | :--- | :--- | :--- |
| Zito Mbowe | `MANAGER_ADMIN` | Obunuzi · Opp. YMCA | `256700000000` |
| Cyrus M. | `MANAGER_ADMIN` | Foodizo · Ham Towers | `256768550986` |
| Sarah K. | `WAITER_FOH` | Foodizo · Ham Towers | `256772555666` |
| Chef Juma | `KITCHEN_STAFF` | Foodizo · Ham Towers | `256772333444` |
| Mubiru Mahad | `WAITER_FOH` | Obunuzi · Opp. YMCA | `256760723280` |
| Prossy N. | `WAITER_FOH` | Obunuzi · Opp. YMCA | `256772111222` |
| Chef Aisha | `KITCHEN_STAFF` | Obunuzi · Opp. YMCA | `256772777888` |

Each outlet seeds 16 tables (`T-01`–`T-12`, `B-01`–`B-04`). The live login pad reads the public display-only directory; log in with the staff card or phone number and PIN `1234`.

### 3.4 Running the Server
```bash
# Development mode with hot-reloading
npm run dev

# Run automated unit test suite
npm run test

# Production build
npm run build
npm start
```

---

## 4. API Reference Summary

Base URL: `http://localhost:4000/api/v1` (the frontend on port 3000 proxies the same `/api/v1/*` paths). Authenticated routes accept the `foodizo_session` HttpOnly cookie or `Authorization: Bearer <token>`. Staff sessions last 12 hours by default and are revoked server-side by logout.

### 4.1 Authentication & Staff Directory

| Method | Endpoint | Description | Role / Access |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/auth/terminal-staff` | Display-only staff directory for the login pad (name, role, outlet, initials; no phone or PIN data) | Public, 30/min |
| `POST` | `/api/v1/auth/pin` | Authenticate with `staffId` or `phoneNumber` plus 4-digit `pin`; returns a bearer token and sets the session cookie | Public, 10/min |
| `GET` | `/api/v1/auth/me` | Current user, role label, and role home path | Any authenticated staff |
| `POST` | `/api/v1/auth/logout` | Revoke the current `user_sessions` row and clear the session cookie | Any authenticated staff |

Five failed PIN attempts lock the account for 15 minutes. Every login receives a unique `jti`, so rapid re-logins never collide on `user_sessions.token_hash`.

### 4.2 Catalogue, Tables & Orders

| Method | Endpoint | Description | Role / Access |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/health` | Service health and environment | Public |
| `GET` | `/api/v1/categories` | Menu categories, filtered by `outlet` | Public |
| `GET` | `/api/v1/menu-items` | Menu catalogue, UGX prices, optional `imageUrl`, and recipe-stock-aware `isAvailable` / `availabilityReason`, filtered by `outlet`, `category`, or `station` | Public |
| `POST` | `/api/v1/menu-items` | Add a meal with its name, category, price, station, outlet and uploaded photo (`imageDataUrl`, PNG/JPEG/WebP, max 2 MB) | Manager only; outlet-scoped |
| `PATCH` | `/api/v1/menu-items/:id` | Update a meal's price and optionally replace its photo (`imageDataUrl`), remove an uploaded photo (`removeImage: true`), or hide/restore original artwork (`hideOriginalImage`) | Manager only; outlet-scoped |
| `GET` | `/api/v1/menu-items/images/:filename` | Serve an uploaded meal photo | Public |
| `PATCH` | `/api/v1/menu-items/:id/availability` | Toggle `isAvailable` / `is86` (86'd items cannot be ordered) | Waiter, Kitchen, Manager |
| `GET` | `/api/v1/tables` | 16-table grid per outlet (`T-01`–`T-12`, `B-01`–`B-04`), optionally filtered by `outlet` | Waiter, Manager |
| `PATCH` | `/api/v1/tables/:id/status` | Change table occupancy / cleaning status | Waiter, Manager |
| `POST` | `/api/v1/tables/drawer/kick` | Fire the RJ12 cash-drawer kick through the printer service | Waiter, Manager |
| `GET` | `/api/v1/orders/delivery-zones?outlet=...` | List active delivery zones, fees, landmark hints, and ETA for one outlet | Public |
| `POST` | `/api/v1/orders` | Create a `DINE_IN`, `TAKEAWAY_PICKUP`, or `PHONE_DELIVERY` order; rejects recipe quantities above current ingredient stock with `INSUFFICIENT_INGREDIENT_STOCK`; customer pickup starts `AWAITING_PAYMENT`, customer COD delivery starts `PENDING` | Public for pickup/delivery; `DINE_IN` requires Waiter or Manager |
| `GET` | `/api/v1/orders/awaiting-payment` | List unpaid customer pickup orders for the staff member's outlet (managers may select an outlet) | Waiter, Manager; outlet-scoped |
| `GET` | `/api/v1/orders/token/:token` | Public sanitized takeaway status lookup by `TOKEN-NNN` (optional `outlet` when the token exists at both) | Public |
| `GET` | `/api/v1/orders/:id` | Full order detail with items, payments, table, zone, and handoffs | Waiter, Manager; outlet-scoped |
| `POST` | `/api/v1/orders/:id/items` | Append items to an open table tab if recipe ingredients are in stock, then recompute totals | Waiter, Manager |
| `POST` | `/api/v1/orders/:id/settle` | Settle the full bill by `CASH`, `MANUAL_MOMO`, `MTN`, or `AIRTEL`; MoMo returns `202` until the signed webhook confirms | Waiter, Manager |
| `POST` | `/api/v1/orders/:id/cancel` | Cancel an order with a mandatory reason; paid MoMo moves to `REFUND_PENDING`, cash is flagged | Manager only |
| `POST` | `/api/v1/orders/:id/status` | Explicit kitchen/floor status transition (`PENDING`, `PREPARING`, `READY`, `COMPLETED`, `CANCELLED`) | Waiter, Kitchen, Manager |
| `POST` | `/api/v1/orders/:id/reprint-chit` | Re-fire the ESC/POS kitchen or packaging chit | Waiter, Manager |
| `POST` | `/api/v1/orders/:id/dispatch` | Assign a boda rider, log the cash advance, and optionally send the dispatch SMS | Waiter, Manager |
| `POST` | `/api/v1/orders/:id/delivery-complete` | Record handoff outcome; successful COD delivery requires sufficient cash tender and atomically records payment, audit, and order completion | Waiter, Manager |
| `GET` | `/api/v1/kds/tickets` | Active KDS tickets with station filters and preparation timers | Kitchen, Manager |
| `POST` | `/api/v1/kds/:id/claim` | Claim a ticket, move it to `PREPARING`, and deduct recipe BOM stock | Kitchen, Manager |
| `POST` | `/api/v1/kds/:id/bump` | Bump the ticket/station to `READY`, print the chit, and send the pickup SMS | Kitchen, Manager |

### 4.3 Kitchen Inventory & Supplier Orders

Managers use the Admin dashboard to review on-hand quantities and reorder alerts, set an opening or counted quantity, record stock taken for non-sales use, add products such as flour, and place multi-product supplier orders. An order does not change stock until delivery is recorded; partial deliveries update stock immediately and leave the remaining balance open. Recipe usage from sales, counts, manual use, and supplier receipts are listed in stock activity. Stock carries forward between business days until the manager records a new count.

| Method | Endpoint | Description | Role / Access |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/inventory?outlet=...` | On-hand stock, reorder status, open supplier orders, and recent stock movements | Manager only; outlet-scoped |
| `POST` | `/api/v1/inventory/items` | Add a product with its unit and reorder threshold | Manager only; outlet-scoped |
| `POST` | `/api/v1/inventory/stock` | Set a stock count (`STOCK_COUNT`) or remove quantity for manual use (`MANUAL_USAGE`) | Manager only; outlet-scoped |
| `POST` | `/api/v1/inventory/supplier-orders` | Create a supplier order with one or more products and quantities | Manager only; outlet-scoped |
| `POST` | `/api/v1/inventory/supplier-orders/:id/receive` | Record full or partial delivered quantities and increase on-hand stock | Manager only; outlet-scoped |

### 4.4 Payments, Dispatch, Surplus & Digest

| Method | Endpoint | Description | Role / Access |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/payments/momo/push` | Start an MTN/Airtel STK push for an existing order; the amount is always read from the order | Waiter, Manager |
| `POST` | `/api/v1/payments/webhook` | Canonical provider callback; HMAC-SHA256 in `X-Foodizo-Signature` using `PAYMENTS_WEBHOOK_SECRET` | Public, signature required |
| `POST` | `/api/v1/payments/momo/webhook` | Legacy telco-sandbox alias for the same signed handler | Public, signature required |
| `POST` | `/api/v1/payments/:id/refund` | Close a `REFUND_PENDING` payment after the external reversal, using the telco reference | Manager only |
| `GET` | `/api/v1/dispatch/queue` | `state=active` returns ready deliveries awaiting a rider or on the way; `state=review` returns unreviewed failed handoffs | Waiter, Manager |
| `POST` | `/api/v1/dispatch/:id/assign-rider` | Compatibility alias for the order-level rider handoff | Waiter, Manager |
| `POST` | `/api/v1/dispatch/:id/complete` | Compatibility alias for order delivery completion | Waiter, Manager |
| `GET` | `/api/v1/surplus` | Current business day's surplus / staff meal / waste log | Manager only |
| `POST` | `/api/v1/surplus/log` | Log leftover portions with a resolution and audit entry | Manager only |
| `GET` | `/api/v1/digest/preview` | Computed shift digest and cash variance without persisting or sending | Manager only |
| `GET` | `/api/v1/digest/overview` | Live manager dashboard payload: digest summary, recent orders, table counts, staff, surplus logs | Manager only |
| `POST` | `/api/v1/digest/reconcile-cash` | Upsert the physical drawer count and variance for the business date | Manager only |
| `POST` | `/api/v1/digest/dispatch-now` | Generate and dispatch the digest on demand; reports real channel outcomes | Manager only |
| `GET` | `/api/v1/digest/view/:token` | Read-only 72-hour digest link payload | Public, link token |

The API process also schedules the digest at `DIGEST_CRON_SCHEDULE` (default `30 21 * * *`, `Africa/Kampala`). The human-facing read-only report is served at `/d/:token`.

Meal photos uploaded from `/admin` are stored under `backend/uploads/menu-items/`; back up this directory with the database, and do not commit its contents. Run the Prisma migrations before using menu editing. The customer menu retains its original prototype cards/photos, applies live prices to matching meals, and appends newly managed meals. Removing an uploaded replacement restores the original artwork; managers can also explicitly hide and restore that artwork.

### 4.5 Contract Notes

* **Settlement is order-level.** `POST /api/v1/orders/:id/settle` requires the full order total. Cash/manual settlement promotes only `AWAITING_PAYMENT` orders to `PENDING`; it never rewinds an order already `PREPARING`, `READY`, or `COMPLETED`. A fully paid `READY`/`COMPLETED` dine-in tab moves its table to `NEEDS_CLEARING`.
* **Live customer ordering supports pickup and delivery.** `/order` and `/customer` use the live menu and order/token APIs. Pickup orders wait for staff to record cash in the POS before entering `PENDING`; delivery orders require a valid outlet zone and address details, include the server-calculated fee, and enter the kitchen as cash-on-delivery. Dispatch staff must record cash at delivery before completion. Customer mobile-money payment remains unavailable pending C5 provider integration and verification.
* **Webhooks are idempotent and signed.** Set `PAYMENTS_WEBHOOK_SECRET` in production; unsigned callbacks are rejected there and accepted only outside production. Duplicate callbacks are acknowledged through `payment_events`, not applied twice.
* **Digest delivery is honest.** Phase 1 has no SMTP transport. `POST /digest/dispatch-now` reports `emailStatus: NOT_CONFIGURED`; development SMS reports `smsMode: MOCK` and `channelsSent: ["SMS_MOCK"]`. A digest status of `PARTIAL` is expected, not a claim that email was delivered. The scheduler runs at 21:30 EAT by default, but `SENT` is reserved for a future multi-channel implementation.
* **Business date.** The Kampala business day rolls at 05:00 EAT; `business_date` is stored as UTC midnight of that calendar day. Tokens are unique per outlet per business date.
