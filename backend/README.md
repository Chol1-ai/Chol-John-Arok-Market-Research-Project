# Backend Engine & Fastify API (`backend/`)

> **Location:** `backend/`  
> **Framework:** TypeScript + Fastify API Engine + Prisma ORM  
> **Brand & Outlets:** Foodizo (Ham Towers) & Obunuzi Restaurant (Opposite YMCA, Wandegeya, Kampala)

---

## 1. Architecture Overview

The backend is built with Fastify, Prisma ORM, and TypeScript to power the 6 operational surfaces of the Kampala fast-casual restaurant suite.

* **High Throughput & Low Overhead:** Fastify delivers low latency during the 12:00–14:00 campus lunch rush.
* **Real-Time WebSocket Bus (`/ws/events`):** Pushes live ticket creations, bumps, and takeaway token statuses to KDS displays without client polling.
* **Local LAN Hardware Integration:** Direct TCP socket communication with the Station #4 Expo Pass 80mm ESC/POS thermal printer (`192.168.1.200:9100`) and RJ12 drawer kick triggers.
* **Prepayment Integrity:** Digital takeaway and delivery orders remain in `AWAITING_PAYMENT` until MTN/Airtel MoMo webhooks confirm funds, while FOH waitstaff table tabs execute postpay directly into `PENDING`.
* **Automatic BOM Deduction:** Claiming kitchen tickets automatically deducts raw food commodities (eggs, cooking oil, chicken pieces, matooke portions) from `raw_inventory`.

---

## 2. Directory Structure

```
backend/
├── package.json                          # Dependencies (@fastify, prisma, bcryptjs, zod, vitest)
├── tsconfig.json                         # NodeNext TypeScript configuration
├── .env.example                          # Canonical environment configuration
│
├── prisma/
│   ├── schema.prisma                     # 15 models, 13 enums, indexing & relations
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
│   │   ├── menu.ts                       # Menu catalogue & 86'd availability toggles (/api/v1/menu-items)
│   │   ├── tables.ts                     # Table occupancy & status matrix (/api/v1/tables)
│   │   ├── orders.ts                     # Order creation, tokens & state transitions (/api/v1/orders)
│   │   ├── kds.ts                        # Multi-station ticket claim & bump flow (/api/v1/kds)
│   │   ├── payments.ts                   # MTN/Airtel MoMo STK push & settlement (/api/v1/payments)
│   │   ├── dispatch.ts                   # Boda rider handoffs & transport advance (/api/v1/dispatch)
│   │   ├── surplus.ts                    # EOD surplus clearance & waste logging (/api/v1/surplus)
│   │   └── digest.ts                     # 21:30 EAT Nightly audit digest & cash counts (/api/v1/digest)
│   │
│   ├── services/
│   │   ├── tokenService.ts               # Sequential digital token generator (#F-101..#F-999)
│   │   ├── bomService.ts                 # Recipe Bill-of-Materials atomic stock decrement
│   │   ├── printerService.ts             # ESC/POS raw TCP thermal receipt print engine
│   │   ├── smsService.ts                 # Africa's Talking SMS delivery/pickup alerts
│   │   ├── momoService.ts                # MTN Uganda MoMo & Airtel Money OpenAPI client
│   │   └── digestService.ts              # End-of-day sales reconciliation & cash variance
│   │
│   └── types/
│       └── index.ts                      # Shared TypeScript types, enums & DTO interfaces
│
└── tests/
    ├── tokenService.test.ts              # Unit tests for token sequence & daily reset
    ├── bom.test.ts                       # Unit tests for recipe BOM calculations
    ├── printer.test.ts                   # Unit tests for ESC/POS chit byte formatting & paper cut
    └── digest.test.ts                    # Unit tests for cash drawer reconciliation & variance
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

#### Seeded Staff Credentials (Demo PINs):
* **Manager / Admin:** Phone `256700000000` | PIN `1234` (Zito Mbowe — Cross-outlet)
* **Waitstaff (FOH):** Phone `256772111222` | PIN `1234` (Prossy N. — Obunuzi YMCA)
* **Kitchen Cook:** Phone `256772333444` | PIN `1234` (Chef Juma — Foodizo Ham Towers)

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

| Method | Endpoint | Description | Role / Access |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/pin` | Authenticate staff member via 4-digit PIN | Public / Staff |
| `GET` | `/api/v1/auth/me` | Fetch active user profile from JWT session | Authenticated |
| `GET` | `/api/v1/menu-items` | List available menu items & prices in UGX | Public |
| `PATCH`| `/api/v1/menu-items/:id/availability` | 86 / Sold-out toggle for menu items | Staff |
| `GET` | `/api/v1/tables` | Fetch 12-zone table grid for Obunuzi YMCA | Staff (`WAITER_FOH`) |
| `POST` | `/api/v1/orders` | Create Dine-in, Takeaway, or Delivery order | Public / Staff |
| `GET` | `/api/v1/orders/token/:token` | Real-time takeaway token status check | Public (`Brian K.`) |
| `GET` | `/api/v1/kds/tickets` | Multi-station KDS tickets with preparation timers | Cook (`KITCHEN_STAFF`)|
| `POST` | `/api/v1/kds/:id/claim` | Claim ticket, advance to PREPARING, deduct BOM | Cook (`KITCHEN_STAFF`)|
| `POST` | `/api/v1/kds/:id/bump` | Bump to READY, print ESC/POS chit, dispatch SMS | Cook (`KITCHEN_STAFF`)|
| `POST` | `/api/v1/payments/momo/push` | Trigger MTN / Airtel MoMo USSD prompt | Public / Customer |
| `POST` | `/api/v1/payments/momo/webhook` | Webhook receiver unlocking prepaid orders | Telecom Aggregator |
| `POST` | `/api/v1/orders/:id/settle` | Settle table bill via Cash, MoMo, or Manual Code| Waitstaff (`WAITER_FOH`)|
| `GET` | `/api/v1/dispatch/queue` | Delivery handoff queue awaiting boda rider | FOH Cashier / Waiter |
| `POST` | `/api/v1/dispatch/:id/assign-rider`| Assign boda rider & log cash transport advance | FOH Cashier / Waiter |
| `POST` | `/api/v1/dispatch/:id/complete`| Mark delivery order completed upon rider return| FOH Cashier / Waiter |
| `GET` | `/api/v1/digest/preview` | Shift financial digest & physical cash variance| Manager (`MANAGER_ADMIN`)|
| `POST` | `/api/v1/digest/reconcile-cash` | Submit physical drawer cash count | Manager (`MANAGER_ADMIN`)|

