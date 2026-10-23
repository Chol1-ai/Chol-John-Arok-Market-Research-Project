# Technical Stack, System Architecture & Database Schema

**Specification Target:** Antigravity IDE + Opencode CLI Repository Scaffold  
**PRD Alignment:** Real-Time Multi-Channel Routing, Digital Token Issuance & Surplus Auditing  
**Related Files:** `Foundational_Concept.md` · `User_Flow.md` · `Payment_Integration.md` (full payment DDL, API contracts & idempotency engine)

---

## 1. System Architecture Diagram

```
[ Customer PWA ]   [ Waiter Handhelds ]   [ KDS Screens ]   [ Admin Dashboard ]
       │                   │                    │                    │
       └───────────────────┼────────────────────┴────────────────────┘
                           │
                   HTTPS / Secure WebSockets
                           │
                           ▼
            ┌──────────────────────────────────┐
            │      FASTIFY APPLICATION API      │
            │    Node.js (TypeScript) Backend   │
            └────────────────┬─────────────────┘
                             │
               ┌─────────────┴──────────────┐
               ▼                            ▼
┌──────────────────────────────┐  ┌──────────────────────────────┐
│    POSTGRESQL 16 DATABASE    │  │    REDIS 7 PUB/SUB BROKER    │
│  - BOM Inventory Engine      │  │  - Instant Station Routing   │
│  - Order & Token Registers   │  │  - KDS Status Synchronization│
│  - Payments Register         │  │  - Auto-86 Out-of-Stock Bus  │
│  - Closing Surplus Audit Log │  │  - KDS_NEW_ORDER pub channel │
└──────────────────────────────┘  └──────────────────────────────┘
                             │
                             ▼
      ┌────────────────────────────────────────────────────┐
      │         PAYMENT GATEWAY INTEGRATION ENGINE         │
      │  - MTN Mobile Money API (Collections v1.0)         │
      │  - Airtel Money OpenAPI (Merchant Pay v2.0)        │
      └────────────────────────────────────────────────────┘
```

---

## 2. Technology Stack Summary

| Layer | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Backend Framework** | Fastify (Node.js) | v4.x | High-performance REST API & WebSocket server |
| **Language** | TypeScript | v5.x | Type-safe server and shared schema definitions |
| **ORM** | Prisma | v5.x | PostgreSQL schema management and query builder |
| **Primary Database** | PostgreSQL | v16 | Orders, inventory, tokens, payments, surplus logs |
| **Pub/Sub Broker** | Redis | v7 | Real-time KDS event streaming and cache |
| **Customer Frontend** | PWA (Vanilla JS / Vite) | Latest | Mobile-first progressive web app |
| **Waiter / FOH UI** | React (Vite) | v18 | Handheld table grid and order entry |
| **KDS UI** | React (Vite) | v18 | Wall-mounted kitchen display |
| **Admin Dashboard** | React (Vite) | v18 | Cross-outlet management portal |
| **Push Notifications** | Africa's Talking SMS API | v1 | Uganda-local SMS delivery for token alerts |
| **Payment — MTN** | MTN MoMo API | Collections v1.0 | USSD STK push for MTN subscribers (see `Payment_Integration.md §5.1`) |
| **Payment — Airtel** | Airtel Money OpenAPI | Merchant Pay v2.0 | Airtel merchant payment flow (see `Payment_Integration.md §5.2`) |
| **MSISDN Utils** | Custom lib (`msisdn.ts`) | — | E.164 normalisation & carrier detection for Ugandan prefixes |

---

## 3. PostgreSQL DDL Schema

```sql
-- ============================================================
-- 1. EXTENSIONS & ENUM TYPE DEFINITIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE outlet_location AS ENUM (
    'FOODIZO_HAM_TOWERS',
    'OBUNUZI_YMCA'
);

CREATE TYPE user_role AS ENUM (
    'CUSTOMER',
    'WAITER_FOH',
    'KITCHEN_STAFF',
    'MANAGER_ADMIN'
);

CREATE TYPE channel_type AS ENUM (
    'DINE_IN',
    'TAKEAWAY_PICKUP',
    'PHONE_DELIVERY'
);

-- PRD-Normalised 4-stage lifecycle
CREATE TYPE order_status AS ENUM (
    'PENDING',
    'PREPARING',
    'READY',
    'COMPLETED',
    'CANCELLED'
);

CREATE TYPE station_type AS ENUM (
    'STEAM_LINE',
    'GRILL_FRYER',
    'ROLEX_GRIDDLE',
    'BAR_BEVERAGE'
);

CREATE TYPE table_status AS ENUM (
    'VACANT',
    'OCCUPIED',
    'BILL_REQUESTED',
    'NEEDS_CLEARING'
);

CREATE TYPE surplus_action AS ENUM (
    'DISCOUNTED_CLEARANCE',
    'STAFF_MEAL',
    'WASTE_DISCARDED'
);


-- ============================================================
-- 2. RESTAURANT TABLES & OCCUPANCY MATRIX
-- ============================================================
CREATE TABLE restaurant_tables (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    outlet           outlet_location NOT NULL,
    table_label      VARCHAR(20) NOT NULL,         -- e.g., 'Table 1', 'Balcony 3'
    capacity         INT DEFAULT 4,
    status           table_status DEFAULT 'VACANT',
    current_waiter_id UUID,
    updated_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE restaurant_tables IS
    'Visual Table Occupancy Matrix source of truth. Polled by FOH/Waiter UI via WebSocket.';


-- ============================================================
-- 3. ORDERS — WITH DIGITAL TOKEN SUPPORT
-- ============================================================
CREATE TABLE orders (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    outlet                outlet_location NOT NULL,
    digital_token         VARCHAR(20) UNIQUE NOT NULL,  -- e.g., 'TOKEN-042'
    channel               channel_type NOT NULL,
    status                order_status NOT NULL DEFAULT 'PENDING',
    table_id              UUID REFERENCES restaurant_tables(id),
    customer_phone        VARCHAR(20),
    total_amount_ugx      NUMERIC(10, 2) NOT NULL,
    estimated_prep_minutes INT DEFAULT 10,
    created_at            TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ready_at              TIMESTAMP WITH TIME ZONE,
    completed_at          TIMESTAMP WITH TIME ZONE
);

COMMENT ON COLUMN orders.digital_token IS
    'Queue bypass token shown to customer. Format: TOKEN-NNN (zero-padded to 3 digits).';
COMMENT ON COLUMN orders.status IS
    'PRD-normalised lifecycle: PENDING → PREPARING → READY → COMPLETED | CANCELLED.';


-- ============================================================
-- 4. ORDER LINE ITEMS
-- ============================================================
CREATE TABLE order_items (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id         UUID REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_name   VARCHAR(100) NOT NULL,
    station          station_type NOT NULL,
    quantity         INT NOT NULL DEFAULT 1,
    unit_price_ugx   NUMERIC(10, 2) NOT NULL,
    is_bumped        BOOLEAN DEFAULT FALSE,         -- TRUE when cook marks this item ready
    special_notes    TEXT
);


-- ============================================================
-- 5. RAW MATERIALS & INVENTORY REGISTER
-- ============================================================
CREATE TABLE raw_inventory (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    outlet            outlet_location NOT NULL,
    item_name         VARCHAR(100) NOT NULL,       -- e.g., 'Cooking Oil', 'Whole Poultry'
    unit_of_measure   VARCHAR(20) NOT NULL,        -- 'LITERS', 'KILOGRAMS', 'UNITS'
    current_stock     NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    alert_threshold   NUMERIC(10, 2) NOT NULL DEFAULT 5.00,
    updated_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON COLUMN raw_inventory.alert_threshold IS
    'When current_stock drops below this value, an SMS + dashboard alert fires to MANAGER_ADMIN.';


-- ============================================================
-- 6. BILL OF MATERIALS (BOM) — RECIPE DECREMENT MAP
-- ============================================================
CREATE TABLE recipe_bom (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    menu_item_name      VARCHAR(100) NOT NULL,
    raw_material_id     UUID REFERENCES raw_inventory(id) ON DELETE RESTRICT,
    quantity_deducted   NUMERIC(8, 2) NOT NULL    -- amount consumed per 1 unit of menu item
);

COMMENT ON TABLE recipe_bom IS
    'Maps each menu item to its raw material consumption. Triggered on order PREPARING transition.';


-- ============================================================
-- 7. END-OF-DAY CLOSING SURPLUS LOGS (PRD Requirement C3)
-- ============================================================
CREATE TABLE closing_surplus_logs (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    outlet             outlet_location NOT NULL,
    log_date           DATE DEFAULT CURRENT_DATE,
    item_name          VARCHAR(100) NOT NULL,      -- e.g., 'Beef Luwombo', 'Steamed Matooke'
    leftover_portions  INT NOT NULL,
    resolution         surplus_action NOT NULL,
    logged_by          UUID NOT NULL,              -- FK to users table (MANAGER_ADMIN)
    created_at         TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE closing_surplus_logs IS
    'Feeds the Predictive Sales Engine. Each row reduces next-day batch prep targets.';

-- ============================================================
-- 8. PAYMENTS REGISTER (stub — full DDL in Payment_Integration.md §7)
-- ============================================================
-- The payments table, payment_status enum, and payment_carrier enum
-- are defined in Payment_Integration.md §7 and must be migrated
-- after the orders table above. Key columns:
--   idempotency_key VARCHAR(36) UNIQUE  ← prevents duplicate KDS tickets on webhook retry
--   status          payment_status       ← INITIATED → PENDING_CUSTOMER_PIN → SUCCESSFUL
--   audit_flag      VARCHAR(50)          ← 'VERIFIED_MANUAL_MOMO' for counter payments
-- See Payment_Integration.md §7 for the complete CREATE TABLE statement.
```

---

## 4. Real-Time KDS Event Handler

```typescript
// Fastify Handler: PATCH /api/v1/orders/:id/status
// Advances an order through the PRD-normalised ticket lifecycle.
// Payment webhook handler is in: apps/api/src/handlers/paymentWebhookHandler.ts
// Full payment service:          apps/api/src/services/paymentService.ts
// See Payment_Integration.md §5–6 for implementation.

import type { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma';
import { redisPublisher } from '../lib/redis';
import { deductOrderInventory } from '../services/inventoryService';
import { sendPickupReadyAlert } from '../services/notificationService';

type StatusTransition = 'PREPARING' | 'READY' | 'COMPLETED';

export async function updateOrderStatus(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { id } = request.params as { id: string };
  const { status } = request.body as { status: StatusTransition };

  const updatedOrder = await prisma.orders.update({
    where: { id },
    data: {
      status,
      ...(status === 'READY'      ? { ready_at: new Date() }     : {}),
      ...(status === 'COMPLETED'  ? { completed_at: new Date() } : {}),
    },
    include: { table: true },
  });

  // ── 1. BOM Inventory Decrement (triggered on first cook claim) ──────────
  if (status === 'PREPARING') {
    await deductOrderInventory(updatedOrder.id);
  }

  // ── 2. Broadcast to all connected KDS, FOH, and Customer PWA clients ───
  await redisPublisher.publish('ORDER_STATUS_CHANNEL', JSON.stringify({
    orderId:      updatedOrder.id,
    digitalToken: updatedOrder.digital_token,
    channel:      updatedOrder.channel,
    status:       updatedOrder.status,
    table:        updatedOrder.table?.table_label ?? null,
  }));

  // ── 3. SMS/Push notification for TAKEAWAY_PICKUP when READY ────────────
  if (status === 'READY' && updatedOrder.channel === 'TAKEAWAY_PICKUP') {
    await sendPickupReadyAlert(
      updatedOrder.customer_phone,
      updatedOrder.digital_token
    );
  }

  return reply.status(200).send(updatedOrder);
}
```

---

## 5. Repository Scaffold (Recommended Directory Structure)

```
mrfss-kds/
├── apps/
│   ├── api/                    # Fastify TypeScript backend
│   │   ├── src/
│   │   │   ├── handlers/       # Route handlers (orders, inventory, surplus, paymentWebhook)
│   │   │   ├── services/       # inventoryService, notificationService, paymentService
│   │   │   ├── lib/            # prisma.ts, redis.ts, msisdn.ts, momoClient.ts, airtelClient.ts
│   │   │   └── routes/         # Fastify route registrations
│   │   └── prisma/
│   │       └── schema.prisma   # Prisma schema (mirrors DDL above + payments table)
│   ├── customer-pwa/           # Vite PWA — order placement + token display + MoMo checkout
│   ├── waiter-ui/              # React — table grid, order entry, manual MoMo verification
│   ├── kds-ui/                 # React — kitchen display with filter bar
│   └── admin-dashboard/        # React — cross-outlet manager portal + reconciliation report
├── docs/                       # ← THIS FOLDER (PRD-aligned .md files)
│   ├── Foundational_Concept.md
│   ├── Design_System.md
│   ├── User_Flow.md
│   ├── User_Profiles_Personas.md
│   ├── Tech_Stack.md
│   └── Payment_Integration.md  # ← NEW: MoMo/Airtel engine, idempotency, USSD fallback
├── packages/
│   └── shared-types/           # Shared TypeScript enums & interfaces (incl. TelecomCarrier)
├── .env.example               # MOMO_BASE_URL, MOMO_SUBSCRIPTION_KEY, AIRTEL_CLIENT_ID, etc.
├── docker-compose.yml          # PostgreSQL 16 + Redis 7 local dev
└── package.json                # Turborepo / pnpm workspace root
```
