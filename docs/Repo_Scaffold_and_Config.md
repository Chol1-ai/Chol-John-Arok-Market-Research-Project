# Repository Scaffold, Dependency Lock & Environment Configuration

**Target Build Tools:** Antigravity IDE + Opencode CLI Repository Scaffold<br>
**Framework:** TypeScript / Next.js 14 (App Router) + Fastify API Engine + Prisma ORM<br>
**Target Locations:** Foodizo (Ham Towers) & Obunuzi (Opposite YMCA)<br>
**Related Specifications:** `Foundational_Concept.md` · `Design_System.md` · `User_Flow.md` · `User_Profiles_Personas.md` · `Delivery_Zones_and_Dispatch.md` · `Tech_Stack.md` · `Payment_Integration.md` · `Hardware_and_Peripherals.md` · `Seed_Data_and_Testing.md` · `Demo_Script_and_Closing_Strategy.md` · `Daily_Audit_Digest.md` · `Deployment_Runbook.md` · `Service_Contract_and_Invoice_Template.md` · `Implementation_Phases.md`

---

## 1. Directory Tree Structure

The Next.js App Router must live at `src/app`. There is no `src/client/app`; that path is invalid for this repository and must not be scaffolded.

```text
foodizo-obunuzi-kds/
├── .env.example
├── .env.client.example
├── .dockerignore
├── .gitignore
├── .eslintrc.json
├── README.md
├── Dockerfile.client
├── Dockerfile.server
├── docker-compose.yml
├── next.config.js
├── package.json
├── package-lock.json
├── postcss.config.js
├── tailwind.config.ts
├── tsconfig.json
├── tsconfig.server.json
├── vitest.config.ts
├── public/
│   └── manifest.webmanifest
├── deploy/
│   ├── backup.sh
│   └── cloudflared.yml
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
├── scripts/
│   ├── run-daily-digest.ts
│   └── simulate-rush-hour.ts
├── tests/
│   ├── unit/
│   └── integration/
├── src/
│   ├── app/                              # Next.js 14 App Router
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   ├── page.tsx                      # Customer menu & pre-order
│   │   ├── login/page.tsx                # Staff phone + PIN login
│   │   ├── cart/page.tsx                 # Customer cart review
│   │   ├── checkout/page.tsx             # Delivery details + MoMo/Airtel checkout
│   │   ├── token/[token]/page.tsx        # Customer token status view
│   │   ├── pos/
│   │   │   ├── page.tsx                  # Waiter table-side POS
│   │   │   ├── tables/page.tsx           # Table occupancy grid
│   │   │   ├── phone-entry/page.tsx      # Phone-in delivery capture
│   │   │   └── dispatch/page.tsx         # FOH delivery dispatch queue
│   │   ├── kds/
│   │   │   ├── steam/page.tsx            # Station 1: Luwombo / steam line
│   │   │   ├── fryer/page.tsx            # Station 2: Grill & fryer
│   │   │   ├── rolex/page.tsx            # Station 3: Rolex griddle
│   │   │   └── expo/page.tsx             # Station 4: Pass / consolidation
│   │   └── admin/
│   │       ├── dashboard/page.tsx        # Cross-outlet overview
│   │       ├── menu/page.tsx             # Menu, price, availability
│   │       ├── inventory/page.tsx        # Recipe BOM & thresholds
│   │       ├── delivery-zones/page.tsx   # Zone, fee, ETA maintenance
│   │       ├── surplus/page.tsx          # Closing surplus logs
│   │       ├── reconcile/page.tsx        # Cash, MoMo, refunds
│   │       ├── digest/page.tsx           # Digest history / preview
│   │       ├── users/page.tsx            # Staff accounts, roles, PIN resets
│   │       └── audit/page.tsx            # Append-only audit log
│   ├── components/
│   │   ├── ui/                           # Buttons, badges, modals, form fields
│   │   ├── delivery/DeliveryZoneSelect.tsx
│   │   ├── delivery/DeliveryDetailsPanel.tsx
│   │   ├── kds/TicketCard.tsx
│   │   ├── pos/TableTile.tsx
│   │   ├── pos/DispatchQueueCard.tsx
│   │   └── TokenBanner.tsx
│   ├── lib/
│   │   ├── api-client.ts                 # Same-origin /api fetch wrapper
│   │   ├── audio-alerts.ts               # KDS Web Audio alert
│   │   ├── capture-delivery-pin.ts       # One-shot optional geolocation
│   │   └── websocket-client.ts           # Reconnecting KDS/FOH socket
│   └── server/                           # Fastify API
│       ├── index.ts                      # API entrypoint (port 4000)
│       ├── jobs/
│       │   ├── daily-digest-cron.ts      # 21:30 EAT owner digest
│       │   └── payment-expiry-job.ts     # AWAITING_PAYMENT TTL cleanup
│       ├── plugins/
│       │   ├── auth.ts                   # Cookie session guard + role checks
│       │   ├── prisma.ts                 # Database connection pool
│       │   ├── redis.ts                  # Pub/Sub event bus
│       │   └── websocket.ts              # Socket server
│       ├── routes/
│       │   ├── auth.ts                   # login, logout, me
│       │   ├── health.ts                 # /health readiness/liveness
│       │   ├── menu.ts                   # Public active menu
│       │   ├── orders.ts                 # Prepaid + POSTPAY orders, status, settle, cancel
│       │   ├── delivery.ts               # Zone lookup + manager zone maintenance
│       │   ├── dispatch.ts               # Dispatch queue + rider handoffs
│       │   ├── payments.ts               # MoMo/Airtel/cash/manual + webhooks
│       │   ├── inventory.ts              # BOM, stock, surplus
│       │   ├── digest.ts                 # Digest history, preview, resend
│       │   └── tables.ts                 # Table occupancy state
│       ├── services/
│       │   ├── auth-service.ts           # PIN verification, sessions, lockout
│       │   ├── menu-service.ts           # Server price resolution + auto-86
│       │   ├── order-service.ts          # Token allocation, totals, transitions
│       │   ├── inventory-service.ts      # BOM decrement, low-stock flags, surplus
│       │   ├── momo-service.ts           # MTN MoMo Collections v1.0
│       │   ├── airtel-service.ts         # Airtel Money Merchant Pay v2.0
│       │   ├── delivery-zone-service.ts  # Zone validation + fee resolution
│       │   ├── dispatch-service.ts       # Rider handoff/completion
│       │   ├── daily-digest-service.ts   # Owner digest aggregation
│       │   ├── sms-service.ts            # Africa's Talking SMS
│       │   ├── email-service.ts          # SMTP digest delivery
│       │   ├── printer-service.ts        # Raw TCP ESC/POS chits
│       │   └── audit-service.ts          # Append-only audit writes
│       └── utils/
│           ├── password.ts               # bcrypt/argon2id hash + verify
│           ├── session.ts                # Opaque token, SHA-256, cookie options
│           ├── msisdn-validator.ts       # Ugandan E.164 normalisation
│           ├── chit-sanitizer.ts         # ESC/POS control-byte removal
│           └── maps-link.ts              # Static Maps + tel/wa.me links
```

---

## 2. Dependency Specification (`package.json`)

```json
{
  "name": "foodizo-obunuzi-kds",
  "version": "1.0.0",
  "private": true,
  "description": "Multi-Channel Order, KDS and Inventory Engine for Foodizo & Obunuzi",
  "scripts": {
    "dev:client": "next dev -p 3000",
    "dev:server": "tsx watch src/server/index.ts",
    "dev": "concurrently \"npm run dev:server\" \"npm run dev:client\"",
    "build:client": "next build",
    "build:server": "tsc -p tsconfig.server.json",
    "build": "prisma generate && npm run build:client && npm run build:server",
    "start": "npm run start:server",
    "start:client": "next start -p 3000",
    "start:server": "node dist/server/index.js",
    "lint": "next lint --max-warnings=0",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:migrate:deploy": "prisma migrate deploy",
    "db:seed": "tsx prisma/seed.ts",
    "digest": "tsx scripts/run-daily-digest.ts",
    "test:rush": "tsx scripts/simulate-rush-hour.ts"
  },
  "dependencies": {
    "@fastify/cookie": "^9.4.0",
    "@fastify/cors": "^9.0.1",
    "@fastify/rate-limit": "^9.1.0",
    "@fastify/websocket": "^10.0.1",
    "@prisma/client": "^5.19.1",
    "axios": "^1.7.7",
    "bcryptjs": "^2.4.3",
    "clsx": "^2.1.1",
    "dotenv": "^16.4.5",
    "fastify": "^4.28.1",
    "ioredis": "^5.4.1",
    "lucide-react": "^0.441.0",
    "next": "^14.2.11",
    "node-cron": "^3.0.3",
    "nodemailer": "^6.9.15",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "tailwind-merge": "^2.5.2",
    "uuid": "^10.0.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/node": "^20.16.5",
    "@types/node-cron": "^3.0.11",
    "@types/nodemailer": "^6.4.16",
    "@types/react": "^18.3.5",
    "@types/react-dom": "^18.3.0",
    "@types/uuid": "^10.0.0",
    "autoprefixer": "^10.4.20",
    "concurrently": "^8.2.2",
    "eslint": "^8.57.0",
    "eslint-config-next": "^14.2.11",
    "postcss": "^8.4.45",
    "prisma": "^5.19.1",
    "tailwindcss": "^3.4.11",
    "tsx": "^4.19.1",
    "typescript": "^5.6.2",
    "vitest": "^2.1.1"
  }
}
```

> `next lint` and the `tests/` folders are part of the quality gate, not optional extras. A coding phase is not complete until `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` pass.

---

## 3. Database Schema Specification (`prisma/schema.prisma`)

This is the canonical Prisma ORM schema directly mapping PostgreSQL 16 DDL from `Tech_Stack.md §3` and `Payment_Integration.md §7`. It enforces foreign keys, relations, cascading deletes, unique constraints, and indexes across all 15 tables.

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// ============================================================
// 1. GLOBAL SYSTEM ENUMS
// ============================================================

enum outlet_location {
  FOODIZO_HAM_TOWERS
  OBUNUZI_YMCA
}

enum user_role {
  CUSTOMER
  WAITER_FOH
  KITCHEN_STAFF
  MANAGER_ADMIN
}

enum channel_type {
  DINE_IN
  TAKEAWAY_PICKUP
  PHONE_DELIVERY
}

enum order_status {
  AWAITING_PAYMENT
  PENDING
  PREPARING
  READY
  COMPLETED
  CANCELLED
}

enum station_type {
  STEAM_LINE
  GRILL_FRYER
  ROLEX_GRIDDLE
  BAR_BEVERAGE
}

enum table_status {
  VACANT
  OCCUPIED
  BILL_REQUESTED
  NEEDS_CLEARING
}

enum uom_type {
  MILLILITERS
  LITERS
  GRAMS
  KILOGRAMS
  PIECES
  PORTIONS
  UNITS
}

enum surplus_action {
  DISCOUNTED_CLEARANCE
  STAFF_MEAL
  WASTE_DISCARDED
}

enum dispatch_method {
  CALL
  WHATSAPP
  COUNTER_HANDOFF
}

enum handoff_outcome {
  PENDING
  DELIVERED
  FAILED_UNREACHABLE
  REFUSED
  RETURNED
}

enum digest_status {
  GENERATED
  PARTIAL
  SENT
  FAILED
}

enum payment_status {
  INITIATED
  PENDING_CUSTOMER_PIN
  SUCCESSFUL
  FAILED
  TIMED_OUT
  CANCELLED
  REFUND_PENDING
  REFUNDED
}

enum payment_carrier {
  MTN
  AIRTEL
  CASH
  MANUAL_MOMO
}

// ============================================================
// 2. USERS, SESSIONS & APPEND-ONLY AUDIT LOG
// ============================================================

model users {
  id                 String           @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  outlet             outlet_location?
  role               user_role
  full_name          String           @db.VarChar(100)
  phone_number       String           @unique @db.VarChar(20)
  pin_hash           String
  is_active          Boolean          @default(true)
  failed_login_count Int              @default(0)
  locked_until       DateTime?        @db.Timestamptz(6)
  last_login_at      DateTime?        @db.Timestamptz(6)
  created_at         DateTime         @default(now()) @db.Timestamptz(6)
  updated_at         DateTime         @default(now()) @updatedAt @db.Timestamptz(6)

  sessions            user_sessions[]
  audit_logs          audit_log[]
  assigned_tables     restaurant_tables[]
  created_orders      orders[]               @relation("orders_created_by")
  cancelled_orders    orders[]               @relation("orders_cancelled_by")
  surplus_logs        closing_surplus_logs[]
  dispatched_handoffs delivery_handoffs[]
  cash_counts         cash_counts[]
  recorded_payments   payments[]             @relation("payments_recorded_by")
  verified_payments   payments[]             @relation("payments_manual_verified_by")

  @@map("users")
}

model user_sessions {
  id         String    @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  user_id    String    @db.Uuid
  token_hash String    @unique @db.Char(64)
  created_at DateTime  @default(now()) @db.Timestamptz(6)
  expires_at DateTime  @db.Timestamptz(6)
  revoked_at DateTime? @db.Timestamptz(6)
  ip_address String?   @db.Inet
  user_agent String?

  user users @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@index([user_id, expires_at], name: "idx_user_sessions_active")
  @@map("user_sessions")
}

model audit_log {
  id            BigInt           @id @default(autoincrement())
  occurred_at   DateTime         @default(now()) @db.Timestamptz(6)
  actor_user_id String?          @db.Uuid
  actor_role    user_role?
  outlet        outlet_location?
  action        String           @db.VarChar(80)
  entity_type   String           @db.VarChar(40)
  entity_id     String?          @db.Uuid
  before_json   Json?
  after_json    Json?
  reason        String?
  ip_address    String?          @db.Inet
  request_id    String?          @db.Uuid

  actor users? @relation(fields: [actor_user_id], references: [id], onDelete: SetNull)

  @@index([occurred_at(sort: Desc)], name: "idx_audit_log_occurred")
  @@index([entity_type, entity_id, occurred_at(sort: Desc)], name: "idx_audit_log_entity")
  @@index([actor_user_id, occurred_at(sort: Desc)], name: "idx_audit_log_actor")
  @@map("audit_log")
}

// ============================================================
// 3. DELIVERY ZONES & LANDMARKS
// ============================================================

model delivery_zones {
  id              String          @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  outlet          outlet_location
  zone_code       String          @db.VarChar(40)
  display_name    String          @db.VarChar(100)
  landmark_group  String          @db.VarChar(60)
  landmark_hint   String?         @db.VarChar(160)
  fee_ugx         Decimal         @default(0.00) @db.Decimal(10, 2)
  eta_min_minutes Int             @default(10)
  eta_max_minutes Int             @default(20)
  is_active       Boolean         @default(true)
  display_order   Int             @default(0)
  created_at      DateTime?       @default(now()) @db.Timestamptz(6)

  orders orders[]

  @@unique([outlet, zone_code], name: "delivery_zones_outlet_code_unique")
  @@index([outlet, is_active, display_order], name: "idx_delivery_zones_outlet_active")
  @@map("delivery_zones")
}

// ============================================================
// 4. RESTAURANT TABLES & OCCUPANCY MATRIX
// ============================================================

model restaurant_tables {
  id                String          @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  outlet            outlet_location
  table_label       String          @db.VarChar(20)
  capacity          Int?            @default(4)
  status            table_status    @default(VACANT)
  current_waiter_id String?         @db.Uuid
  updated_at        DateTime?       @default(now()) @updatedAt @db.Timestamptz(6)

  current_waiter users?   @relation(fields: [current_waiter_id], references: [id], onDelete: SetNull)
  orders         orders[]

  @@unique([outlet, table_label], name: "restaurant_tables_outlet_label_unique")
  @@map("restaurant_tables")
}

// ============================================================
// 5. MENU ITEMS & PRICING
// ============================================================

model menu_items {
  id         String          @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  outlet     outlet_location
  name       String          @db.VarChar(100)
  category   String          @db.VarChar(40)
  price_ugx  Decimal         @db.Decimal(10, 2)
  station    station_type
  is_active  Boolean         @default(true)
  is_86      Boolean         @default(false)
  created_at DateTime        @default(now()) @db.Timestamptz(6)
  updated_at DateTime        @default(now()) @updatedAt @db.Timestamptz(6)

  order_items  order_items[]
  recipe_boms  recipe_bom[]
  surplus_logs closing_surplus_logs[]

  @@unique([outlet, name], name: "menu_items_outlet_name_unique")
  @@index([outlet, is_active, category, name], name: "idx_menu_items_outlet_active")
  @@map("menu_items")
}

// ============================================================
// 6. ORDERS REGISTER
// ============================================================

model orders {
  id                       String           @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  outlet                   outlet_location
  digital_token            String           @db.VarChar(20)
  public_ref               String           @unique @db.VarChar(32)
  business_date            DateTime         @db.Date
  channel                  channel_type
  status                   order_status     @default(AWAITING_PAYMENT)
  table_id                 String?          @db.Uuid
  created_by               String?          @db.Uuid
  customer_name            String?          @db.VarChar(80)
  customer_phone           String?          @db.VarChar(20)
  delivery_zone_id         String?          @db.Uuid
  delivery_note            String?          @db.VarChar(160)
  delivery_lat             Decimal?         @db.Decimal(9, 6)
  delivery_lng             Decimal?         @db.Decimal(9, 6)
  delivery_accuracy_m      Decimal?         @db.Decimal(6, 1)
  delivery_pin_captured_at DateTime?        @db.Timestamptz(6)
  subtotal_ugx             Decimal          @db.Decimal(10, 2)
  delivery_fee_ugx         Decimal          @default(0.00) @db.Decimal(10, 2)
  total_amount_ugx         Decimal          @db.Decimal(10, 2)
  estimated_prep_minutes   Int?             @default(10)
  created_at               DateTime         @default(now()) @db.Timestamptz(6)
  ready_at                 DateTime?        @db.Timestamptz(6)
  completed_at             DateTime?        @db.Timestamptz(6)
  cancelled_at             DateTime?        @db.Timestamptz(6)
  cancelled_by             String?          @db.Uuid
  cancellation_reason      String?

  table         restaurant_tables? @relation(fields: [table_id], references: [id])
  creator       users?             @relation("orders_created_by", fields: [created_by], references: [id], onDelete: SetNull)
  canceller     users?             @relation("orders_cancelled_by", fields: [cancelled_by], references: [id], onDelete: SetNull)
  delivery_zone delivery_zones?    @relation(fields: [delivery_zone_id], references: [id], onDelete: Restrict)

  order_items order_items[]
  handoffs    delivery_handoffs[]
  payments    payments[]

  @@unique([outlet, business_date, digital_token], name: "orders_token_unique_per_day")
  @@index([delivery_zone_id], name: "idx_orders_delivery_zone")
  @@index([channel, status], name: "idx_orders_channel_status")
  @@index([outlet, business_date, status], name: "idx_orders_outlet_business_date")
  @@map("orders")
}

// ============================================================
// 7. ORDER LINE ITEMS
// ============================================================

model order_items {
  id             String       @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  order_id       String       @db.Uuid
  menu_item_id   String       @db.Uuid
  menu_item_name String       @db.VarChar(100)
  station        station_type
  quantity       Int          @default(1)
  unit_price_ugx Decimal      @db.Decimal(10, 2)
  line_total_ugx Decimal      @db.Decimal(10, 2)
  is_bumped      Boolean      @default(false)
  special_notes  String?

  order     orders     @relation(fields: [order_id], references: [id], onDelete: Cascade)
  menu_item menu_items @relation(fields: [menu_item_id], references: [id], onDelete: Restrict)

  @@index([order_id], name: "idx_order_items_order")
  @@map("order_items")
}

// ============================================================
// 8. RAW MATERIALS & INVENTORY REGISTER
// ============================================================

model raw_inventory {
  id              String          @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  outlet          outlet_location
  item_name       String          @db.VarChar(100)
  unit_of_measure uom_type
  current_stock   Decimal         @default(0.00) @db.Decimal(10, 2)
  alert_threshold Decimal         @default(5.00) @db.Decimal(10, 2)
  updated_at      DateTime?       @default(now()) @updatedAt @db.Timestamptz(6)

  recipe_boms recipe_bom[]

  @@unique([outlet, item_name], name: "raw_inventory_outlet_name_unique")
  @@map("raw_inventory")
}

// ============================================================
// 9. RECIPE BILL OF MATERIALS (BOM)
// ============================================================

model recipe_bom {
  id                String  @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  menu_item_id      String  @db.Uuid
  raw_material_id   String  @db.Uuid
  quantity_deducted Decimal @db.Decimal(10, 2)

  menu_item    menu_items    @relation(fields: [menu_item_id], references: [id], onDelete: Cascade)
  raw_material raw_inventory @relation(fields: [raw_material_id], references: [id], onDelete: Restrict)

  @@unique([menu_item_id, raw_material_id], name: "recipe_bom_unique")
  @@map("recipe_bom")
}

// ============================================================
// 10. CLOSING SURPLUS LOGS
// ============================================================

model closing_surplus_logs {
  id                String          @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  outlet            outlet_location
  log_date          DateTime        @db.Date
  menu_item_id      String?         @db.Uuid
  item_name         String          @db.VarChar(100)
  leftover_portions Int
  resolution        surplus_action
  logged_by         String          @db.Uuid
  created_at        DateTime        @default(now()) @db.Timestamptz(6)

  menu_item menu_items? @relation(fields: [menu_item_id], references: [id], onDelete: SetNull)
  user      users       @relation(fields: [logged_by], references: [id], onDelete: Restrict)

  @@index([outlet, log_date], name: "idx_closing_surplus_date")
  @@map("closing_surplus_logs")
}

// ============================================================
// 11. DELIVERY HANDOFFS
// ============================================================

model delivery_handoffs {
  id                         String          @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  order_id                   String          @db.Uuid
  rider_name                 String          @db.VarChar(80)
  rider_phone                String?         @db.VarChar(20)
  dispatched_by              String          @db.Uuid
  dispatch_method            dispatch_method @default(CALL)
  rider_advance_ugx          Decimal         @default(0.00) @db.Decimal(10, 2)
  rider_advance_returned_ugx Decimal         @default(0.00) @db.Decimal(10, 2)
  dispatched_at              DateTime?       @default(now()) @db.Timestamptz(6)
  delivered_at               DateTime?       @db.Timestamptz(6)
  outcome                    handoff_outcome @default(PENDING)
  notes                      String?

  order      orders @relation(fields: [order_id], references: [id], onDelete: Cascade)
  dispatcher users  @relation(fields: [dispatched_by], references: [id], onDelete: Restrict)

  @@index([order_id], name: "idx_delivery_handoffs_order")
  @@index([outcome, dispatched_at], name: "idx_delivery_handoffs_outcome")
  @@map("delivery_handoffs")
}

// ============================================================
// 12. CASH COUNTS
// ============================================================

model cash_counts {
  id                String          @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  outlet            outlet_location
  business_date     DateTime        @db.Date
  counted_cash_ugx  Decimal         @db.Decimal(10, 2)
  expected_cash_ugx Decimal         @db.Decimal(10, 2)
  variance_ugx      Decimal         @db.Decimal(10, 2)
  counted_by        String          @db.Uuid
  counted_at        DateTime        @default(now()) @db.Timestamptz(6)
  notes             String?

  counter users @relation(fields: [counted_by], references: [id], onDelete: Restrict)

  @@unique([outlet, business_date], name: "cash_counts_unique")
  @@index([business_date, outlet], name: "idx_cash_counts_date")
  @@map("cash_counts")
}

// ============================================================
// 13. DAILY DIGESTS
// ============================================================

model daily_digests {
  id            String        @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  digest_date   DateTime      @unique @db.Date
  generated_at  DateTime      @default(now()) @db.Timestamptz(6)
  status        digest_status @default(GENERATED)
  payload_json  Json
  channels_sent String[]      @default([])
  error         String?

  @@index([status, digest_date], name: "idx_daily_digests_status")
  @@map("daily_digests")
}

// ============================================================
// 14. TOKEN COUNTERS
// ============================================================

model token_counters {
  outlet        outlet_location
  business_date DateTime        @db.Date
  last_value    Int             @default(0)

  @@id([outlet, business_date])
  @@map("token_counters")
}

// ============================================================
// 15. PAYMENTS REGISTER & WEBHOOK EVENTS
// ============================================================

model payments {
  id                      String          @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  order_id                String          @db.Uuid
  idempotency_key         String          @unique @db.VarChar(36)
  carrier                 payment_carrier
  customer_msisdn         String?         @db.VarChar(20)
  amount_ugx              Decimal         @db.Decimal(10, 2)
  status                  payment_status  @default(INITIATED)
  external_transaction_id String?         @db.VarChar(100)
  audit_flag              String?         @db.VarChar(50)
  failure_reason          String?
  recorded_by             String?         @db.Uuid
  manual_verified_by      String?         @db.Uuid
  manual_verified_at      DateTime?       @db.Timestamptz(6)
  initiated_at            DateTime        @default(now()) @db.Timestamptz(6)
  completed_at            DateTime?       @db.Timestamptz(6)
  refunded_at             DateTime?       @db.Timestamptz(6)
  refund_reference        String?         @db.VarChar(100)

  order    orders           @relation(fields: [order_id], references: [id], onDelete: Cascade)
  recorder users?           @relation("payments_recorded_by", fields: [recorded_by], references: [id], onDelete: SetNull)
  verifier users?           @relation("payments_manual_verified_by", fields: [manual_verified_by], references: [id], onDelete: SetNull)
  events   payment_events[]

  @@index([order_id], name: "idx_payments_order")
  @@index([carrier, completed_at], name: "idx_payments_completed")
  @@map("payments")
}

model payment_events {
  id           BigInt   @id @default(autoincrement())
  payment_id   String   @db.Uuid
  provider     String   @db.VarChar(20)
  event_id     String   @db.VarChar(180)
  payload_json Json
  received_at  DateTime @default(now()) @db.Timestamptz(6)

  payment payments @relation(fields: [payment_id], references: [id], onDelete: Cascade)

  @@unique([provider, event_id], name: "payment_events_unique")
  @@map("payment_events")
}
```

---

## 4. Environment Variables Template (`.env.example`)

This template is for the **API container only**. Never pass this file, the database URL, or any telco/SMTP secret to the browser or the frontend container. The Next.js container receives only `NEXT_PUBLIC_API_URL` and `API_INTERNAL_URL` through `.env.client.example`.

```bash
# ==============================================================================
# API ENVIRONMENT: FOODIZO & OBUNUZI MULTI-OUTLET ENGINE
# ==============================================================================

# 1. APPLICATION PORTS, TIMEZONE & HOSTS
PORT=4000
NODE_ENV=development
TZ=Africa/Kampala
CLIENT_BASE_URL=http://localhost:3000
# The browser calls the Next.js origin at /api; Next.js rewrites that to the
# API service (API_INTERNAL_URL). This works on the LAN and through a tunnel.
API_INTERNAL_URL=http://localhost:4000

# 2. POSTGRESQL DATABASE & REDIS PUB/SUB
# Local development defaults. Docker Compose overrides DATABASE_URL/REDIS_URL
# to service names (postgres:5432 / redis:6379); never expose those ports.
POSTGRES_USER=foodizo
POSTGRES_PASSWORD="replace_with_a_strong_random_password"
POSTGRES_DB=foodizo_kds
DATABASE_URL="postgresql://foodizo:replace_with_a_strong_random_password@localhost:5432/foodizo_kds?schema=public"
REDIS_URL="redis://localhost:6379"

# 3. STAFF AUTHENTICATION & SESSIONS
SESSION_TTL_HOURS=12
COOKIE_SECURE=false          # true behind HTTPS or the Cloudflare Tunnel
LOGIN_MAX_ATTEMPTS=5
LOGIN_LOCK_MINUTES=15

# 4. PAYMENT EXPIRY
# An unpaid AWAITING_PAYMENT order is cancelled after this TTL.
PAYMENT_TTL_MINUTES=15

# 5. MTN MOBILE MONEY (UGANDA OPEN API)
MOMO_BASE_URL="https://sandbox.momodeveloper.mtn.com"
MOMO_TARGET_ENV="sandbox"
MOMO_SUBSCRIPTION_KEY="your_mtn_subscription_key_here"
MOMO_API_USER_UUID="your_mtn_api_user_uuid_here"
MOMO_API_KEY="your_mtn_api_key_here"
MOMO_MERCHANT_NAME="Foodizo Ham Towers"

# 6. AIRTEL MONEY (UGANDA OPENAPI)
AIRTEL_BASE_URL="https://openapiuat.airtel.africa"
AIRTEL_CLIENT_ID="your_airtel_client_id_here"
AIRTEL_CLIENT_SECRET="your_airtel_client_secret_here"
AIRTEL_COUNTRY="UG"
AIRTEL_CURRENCY="UGX"

# 7. AFRICA'S TALKING SMS (PICKUP NOTIFICATIONS + OWNER DIGEST)
AT_USERNAME="sandbox"
AT_API_KEY="your_africastalking_api_key_here"
AT_SENDER_ID="FOODIZO"

# 8. DELIVERY ZONES & OPTIONAL GEOLOCATION
# No Google Maps API key is required. Do not add one for Phase 1.
# Geolocation is browser-native, one-shot, and user-initiated only.
DELIVERY_PIN_ENABLED=true
DISPATCH_QUEUE_PAGE_SIZE=25
# Outlet WhatsApp numbers used only for tap-to-chat `wa.me` links.
# These are NOT the WhatsApp Cloud API sender.
FOODIZO_WHATSAPP_NUMBER="256768550986"
OBUNUZI_WHATSAPP_NUMBER="256760723280"

# 9. THERMAL ESC/POS PACKAGING / DELIVERY PRINTER (EXPO PASS)
EXPO_PRINTER_IP="192.168.1.200"
EXPO_PRINTER_PORT=9100
ENABLE_THERMAL_PRINTING=false

# 10. DAILY AUDIT DIGEST (21:30 EAT)
# Owner contact details are configured by the developer and confirmed by the
# owner. Never hard-code them in source; see Daily_Audit_Digest.md.
OWNER_PHONE="2567XXXXXXXX"
OWNER_EMAIL="owner@example.com"
DIGEST_REPORT_BASE_URL="https://admin.foodizo.ug"
DIGEST_LINK_SECRET="replace_with_a_long_random_string"
CASH_VARIANCE_ALERT_UGX=5000

# SMTP for the full email report (nodemailer).
SMTP_HOST="smtp.example.com"
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER="digest@example.com"
SMTP_PASS="replace_with_the_smtp_password"
SMTP_FROM="Foodizo Audit <digest@example.com>"

# Optional owner-only WhatsApp Cloud API digest. Disabled by default; requires
# Meta Business verification, an approved utility template, and a permanent
# token. Not for customer-facing messages in Phase 1.
OWNER_WHATSAPP_ENABLED=false
WHATSAPP_PHONE_NUMBER_ID=""
WHATSAPP_API_TOKEN=""
WHATSAPP_GRAPH_VERSION="v19.0"

# 11. OPTIONAL REMOTE ADMIN ACCESS (CLOUDFLARE TUNNEL)
# Leave empty to keep the tunnel profile disabled. Ingress only; never expose
# PostgreSQL (5432), Redis (6379), or printer port 9100 through the tunnel.
CLOUDFLARE_TUNNEL_TOKEN=""

# 12. SEED DATA SAFETY
# The destructive seed refuses to run when NODE_ENV=production unless this is
# explicitly true. Leave false in every deployed environment; enable it only
# against a disposable demo database.
ALLOW_DESTRUCTIVE_SEED=false
```

`.env.client.example`:

```bash
# Next.js runtime only. No database, telco, SMS, SMTP, or session secret.
NEXT_PUBLIC_API_URL=/api
API_INTERNAL_URL=http://api:4000
```

For a direct-API development run outside Docker, set `NEXT_PUBLIC_API_URL=http://localhost:4000` and `API_INTERNAL_URL=http://localhost:4000`; the browser still needs CORS permission from the API in that mode.

---

## 5. Bootstrap Instructions for Opencode CLI / Antigravity IDE

1. **Initialize directory structure:**
   ```bash
   mkdir -p src/app src/components src/lib src/server/jobs src/server/plugins src/server/routes src/server/services src/server/utils tests/unit tests/integration prisma/migrations scripts
   ```
2. **Environment setup:** copy `.env.example` to `.env` and `.env.client.example` to `.env.local`, then populate the server credentials. Do not put server secrets in `.env.local`.
3. **Install dependencies:** `npm install`
4. **Generate and migrate:** `npm run db:generate && npm run db:migrate`
5. **Seed operational data:** `npm run db:seed`
6. **Start dev servers:** `npm run dev`
7. **Quality gate:** `npm run lint && npm run typecheck && npm test && npm run build`
8. **Execute the prepaid/concurrency test:** `npm run test:rush`. Test the authenticated `DINE_IN` POSTPAY tab separately with the seeded FOH login.
