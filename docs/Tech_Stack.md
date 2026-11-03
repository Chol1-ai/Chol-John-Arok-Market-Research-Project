# Technical Stack, System Architecture & Database Schema

**Specification Target:** Antigravity IDE + Opencode CLI Repository Scaffold<br>
**PRD Alignment:** Real-Time Multi-Channel Routing, Digital Token Issuance & Surplus Auditing<br>
**Related Files:** `Foundational_Concept.md` · `Design_System.md` · `User_Flow.md` · `User_Profiles_Personas.md` · `Delivery_Zones_and_Dispatch.md` · `Payment_Integration.md` · `Hardware_and_Peripherals.md` · `Seed_Data_and_Testing.md` · `Repo_Scaffold_and_Config.md` · `Daily_Audit_Digest.md` · `Deployment_Runbook.md` · `build_strategy/Build_Strategy_and_Phases.md`

> [!IMPORTANT]
> **Database source of truth:** `prisma/schema.prisma` is the **canonical database definition** for this project. All Prisma migrations are generated from that file. The raw PostgreSQL DDL in §4 of this document is provided for architecture review and reference only — it shows intent and field semantics in plain SQL, but it may drift from the Prisma schema over time. **In any conflict between the DDL here and `prisma/schema.prisma`, the Prisma schema wins.** Never hand-edit a migration file or the live database to match this DDL without going through `prisma migrate dev`.

---

## 1. System Architecture Diagram

```
[ Customer PWA ]   [ Waiter Handhelds + FOH Dispatch ]   [ KDS Screens ]   [ Admin Dashboard ]
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
│  - Cash Counts & Digests     │  │  - KDS_NEW_ORDER pub channel │
│  - Closing Surplus Audit Log │  │                              │
└──────────────────────────────┘  └──────────────────────────────┘
                             │
                             ▼
      ┌────────────────────────────────────────────────────┐
      │         PAYMENT GATEWAY INTEGRATION ENGINE         │
      │  - MTN Mobile Money API (Collections v1.0)         │
      │  - Airtel Money OpenAPI (Merchant Pay v2.0)        │
      └────────────────────────────────────────────────────┘
```

An in-process `node-cron` job runs at **21:30 EAT**, reads `payments`, `delivery_handoffs`, `cash_counts`, and inventory tables, writes the idempotent `daily_digests` row, and sends the owner SMS/email. See `Daily_Audit_Digest.md`.

> **Delivery location note:** The only location service in Phase 1 is the browser's one-shot `navigator.geolocation.getCurrentPosition`, called after an explicit customer tap. There is **no map tile provider, no Google Maps SDK, and no map API key**. FOH dispatch uses a static Google Maps link (`https://www.google.com/maps/search/?api=1&query=lat,lng`), `tel:` links, and `wa.me` links. See `Delivery_Zones_and_Dispatch.md`.

---

## 2. Technology Stack Summary

| Layer | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Backend Framework** | Fastify (Node.js) | v4.x | High-performance REST API & WebSocket server |
| **Language** | TypeScript | v5.x | Type-safe server and shared schema definitions |
| **ORM** | Prisma | v5.x | PostgreSQL schema management and query builder |
| **Primary Database** | PostgreSQL | v16 | Orders, inventory, tokens, payments, surplus logs |
| **Pub/Sub Broker** | Redis | v7 | Real-time KDS event streaming and cache |
| **Customer Frontend** | Next.js PWA (App Router) | v14 | Mobile-first progressive web app |
| **Delivery Location** | HTML5 Geolocation API | Browser-native | Optional one-shot drop-off pin; no `watchPosition`, no background tracking |
| **Maps** | Static Google Maps universal link | — | Opens only on tap; no JS SDK, Places, Directions, Geocoding, or API key |
| **Dispatch Contact** | `tel:` + `wa.me` links | — | FOH/rider calls or WhatsApps the customer from the dispatch queue or printed chit |
| **Waiter / FOH UI** | Next.js 14 client | v14 | Handheld table grid, order entry, delivery dispatch queue |
| **KDS UI** | Next.js 14 client | v14 | Wall-mounted kitchen display |
| **Admin Dashboard** | Next.js 14 client | v14 | Cross-outlet management portal |
| **Customer Alerts** | Africa's Talking SMS API | v1 | SMS pickup alerts; no browser push in Phase 1 |
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

-- Kitchen ticket lifecycle (four KDS states) plus a pre-payment holding state.
-- AWAITING_PAYMENT is never shown on the KDS; payment success promotes the
-- order to PENDING, which is the first state the kitchen can see.
CREATE TYPE order_status AS ENUM (
    'AWAITING_PAYMENT',
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

CREATE TYPE uom_type AS ENUM (
    'MILLILITERS',
    'LITERS',
    'GRAMS',
    'KILOGRAMS',
    'PIECES',
    'PORTIONS',
    'UNITS'
);

CREATE TYPE surplus_action AS ENUM (
    'DISCOUNTED_CLEARANCE',
    'STAFF_MEAL',
    'WASTE_DISCARDED'
);

CREATE TYPE dispatch_method AS ENUM (
    'CALL',
    'WHATSAPP',
    'COUNTER_HANDOFF'
);

CREATE TYPE handoff_outcome AS ENUM (
    'PENDING',
    'DELIVERED',
    'FAILED_UNREACHABLE',
    'REFUSED',
    'RETURNED'
);


-- ============================================================
-- 2. USERS, SESSIONS & APPEND-ONLY AUDIT LOG
-- ============================================================
CREATE TABLE users (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    outlet              outlet_location,             -- NULL = cross-outlet access
    role                user_role NOT NULL,
    full_name           VARCHAR(100) NOT NULL,
    phone_number        VARCHAR(20) NOT NULL,
    pin_hash            TEXT NOT NULL,               -- bcrypt/argon2id, never plaintext
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    failed_login_count  INT NOT NULL DEFAULT 0,
    locked_until        TIMESTAMP WITH TIME ZONE,
    last_login_at       TIMESTAMP WITH TIME ZONE,
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT users_phone_unique UNIQUE (phone_number),
    CONSTRAINT users_phone_format CHECK (phone_number ~ '^256[0-9]{9}$'),
    CONSTRAINT users_staff_outlet_required CHECK (
        role IN ('CUSTOMER', 'MANAGER_ADMIN') OR outlet IS NOT NULL
    ),
    CONSTRAINT users_failed_login_non_negative CHECK (failed_login_count >= 0)
);

COMMENT ON TABLE users IS
    'Staff and manager accounts. Customers can browse without an account; the CUSTOMER role exists for a future customer login.';
COMMENT ON COLUMN users.outlet IS
    'NULL means cross-outlet access (MANAGER_ADMIN). WAITER_FOH and KITCHEN_STAFF must be assigned to one outlet.';
COMMENT ON COLUMN users.pin_hash IS
    'bcrypt/argon2id hash of the 4–6 digit login PIN. Never store, log, or return the PIN itself.';

CREATE TABLE user_sessions (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  CHAR(64) NOT NULL UNIQUE,            -- SHA-256 of the opaque cookie token
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at  TIMESTAMP WITH TIME ZONE,
    ip_address  INET,
    user_agent  TEXT,

    CONSTRAINT user_sessions_expiry_valid CHECK (expires_at > created_at)
);

CREATE INDEX idx_user_sessions_active
    ON user_sessions (user_id, expires_at)
    WHERE revoked_at IS NULL;

COMMENT ON TABLE user_sessions IS
    'Server-side sessions. The browser receives an opaque HttpOnly cookie; only its SHA-256 hash is stored.';

CREATE TABLE audit_log (
    id             BIGSERIAL PRIMARY KEY,
    occurred_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actor_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
    actor_role     user_role,
    outlet         outlet_location,
    action         VARCHAR(80) NOT NULL,             -- e.g. VOID_ORDER, CHANGE_PRICE, VERIFY_MANUAL_MOMO
    entity_type    VARCHAR(40) NOT NULL,             -- e.g. order, menu_item, payment, user
    entity_id      UUID,
    before_json    JSONB,
    after_json     JSONB,
    reason         TEXT,
    ip_address     INET,
    request_id     UUID,

    CONSTRAINT audit_log_action_not_blank CHECK (char_length(btrim(action)) > 0)
);

CREATE INDEX idx_audit_log_occurred ON audit_log (occurred_at DESC);
CREATE INDEX idx_audit_log_entity ON audit_log (entity_type, entity_id, occurred_at DESC);
CREATE INDEX idx_audit_log_actor ON audit_log (actor_user_id, occurred_at DESC);

CREATE FUNCTION prevent_audit_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'audit_log is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_no_update
    BEFORE UPDATE OR DELETE ON audit_log
    FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();

COMMENT ON TABLE audit_log IS
    'Append-only. The application role gets INSERT/SELECT only; the trigger blocks UPDATE/DELETE even for the owner.';


-- ============================================================
-- 3. DELIVERY ZONES & LANDMARK CATALOGUE
-- ============================================================
CREATE TABLE delivery_zones (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    outlet             outlet_location NOT NULL,
    zone_code          VARCHAR(40) NOT NULL,        -- e.g., 'MK_LUMUMBA', 'YMCA_MAIN'
    display_name       VARCHAR(100) NOT NULL,       -- e.g., 'Makerere University — Lumumba Hall'
    landmark_group     VARCHAR(60) NOT NULL,        -- dropdown group, e.g., 'Makerere Campus'
    landmark_hint      VARCHAR(160),                -- e.g., 'Call at hall reception'
    fee_ugx            NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    eta_min_minutes    INT NOT NULL DEFAULT 10,
    eta_max_minutes    INT NOT NULL DEFAULT 20,
    is_active          BOOLEAN NOT NULL DEFAULT TRUE,
    display_order      INT NOT NULL DEFAULT 0,
    created_at         TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT delivery_zones_outlet_code_unique UNIQUE (outlet, zone_code),
    CONSTRAINT delivery_zones_fee_non_negative CHECK (fee_ugx >= 0),
    CONSTRAINT delivery_zones_eta_valid CHECK (eta_min_minutes > 0 AND eta_max_minutes >= eta_min_minutes)
);

COMMENT ON TABLE delivery_zones IS
    'Outlet-scoped delivery zones shown in the customer and phone-entry dropdowns. Fees are server-owned and snapshotted onto each order.';
COMMENT ON COLUMN delivery_zones.is_active IS
    'FALSE hides the zone from checkout. Phase 2 areas (Kololo, Nakasero, etc.) ship inactive.';


-- ============================================================
-- 4. RESTAURANT TABLES & OCCUPANCY MATRIX
-- ============================================================
CREATE TABLE restaurant_tables (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    outlet            outlet_location NOT NULL,
    table_label       VARCHAR(20) NOT NULL,         -- e.g., 'T-04', 'B-02'
    capacity          INT DEFAULT 4,
    status            table_status DEFAULT 'VACANT',
    current_waiter_id UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT restaurant_tables_outlet_label_unique UNIQUE (outlet, table_label),
    CONSTRAINT restaurant_tables_capacity_positive CHECK (capacity IS NULL OR capacity > 0)
);

COMMENT ON TABLE restaurant_tables IS
    'Visual Table Occupancy Matrix source of truth. Polled by FOH/Waiter UI via WebSocket.';


-- ============================================================
-- 5. MENU ITEMS — SERVER-OWNED PRICES & AVAILABILITY
-- ============================================================
CREATE TABLE menu_items (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    outlet      outlet_location NOT NULL,
    name        VARCHAR(100) NOT NULL,
    category    VARCHAR(40) NOT NULL,
    price_ugx   NUMERIC(10, 2) NOT NULL,
    station     station_type NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    is_86       BOOLEAN NOT NULL DEFAULT FALSE,      -- manual sold-out override
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT menu_items_outlet_name_unique UNIQUE (outlet, name),
    CONSTRAINT menu_items_name_not_blank CHECK (char_length(btrim(name)) > 0),
    CONSTRAINT menu_items_price_non_negative CHECK (price_ugx >= 0)
);

COMMENT ON TABLE menu_items IS
    'Server-owned menu and price catalogue. order_items snapshot the name and price so historical bills never change.';
COMMENT ON COLUMN menu_items.is_86 IS
    'Manual sold-out override. Auto-86 is derived when a BOM ingredient reaches zero; neither flag deletes the item.';

CREATE INDEX idx_menu_items_outlet_active
    ON menu_items (outlet, is_active, category, name);


-- ============================================================
-- 6. ORDERS — PAYMENT GATE, DIGITAL TOKEN & DELIVERY SUPPORT
-- ============================================================
CREATE TABLE orders (
    id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    outlet                 outlet_location NOT NULL,
    digital_token          VARCHAR(20) NOT NULL,       -- e.g., 'TOKEN-042'; per outlet/day
    public_ref             VARCHAR(32) NOT NULL UNIQUE, -- e.g., 'ORD-7F3C2A9D4B11'; telco reference
    business_date          DATE NOT NULL DEFAULT
                               ((CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Kampala')::date),
    channel                channel_type NOT NULL,
    status                 order_status NOT NULL DEFAULT 'AWAITING_PAYMENT',
    table_id               UUID REFERENCES restaurant_tables(id),
    created_by             UUID REFERENCES users(id) ON DELETE SET NULL, -- FOH/manager; NULL = customer
    customer_name          VARCHAR(80),                -- required for delivery; used on chit
    customer_phone         VARCHAR(20),                -- delivery: required rider-callable; pickup: payer MSISDN for READY SMS
    delivery_zone_id       UUID REFERENCES delivery_zones(id) ON DELETE RESTRICT,
    delivery_note          VARCHAR(160),               -- room/office/gate; never shown on KDS
    delivery_lat           NUMERIC(9, 6),              -- optional one-shot GPS hint
    delivery_lng           NUMERIC(9, 6),
    delivery_accuracy_m    NUMERIC(6, 1),
    delivery_pin_captured_at TIMESTAMP WITH TIME ZONE,
    subtotal_ugx           NUMERIC(10, 2) NOT NULL,
    delivery_fee_ugx       NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_amount_ugx       NUMERIC(10, 2) NOT NULL,    -- subtotal + delivery_fee_ugx
    estimated_prep_minutes INT DEFAULT 10,
    created_at             TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ready_at               TIMESTAMP WITH TIME ZONE,
    completed_at           TIMESTAMP WITH TIME ZONE,
    cancelled_at           TIMESTAMP WITH TIME ZONE,
    cancelled_by           UUID REFERENCES users(id) ON DELETE SET NULL,
    cancellation_reason    TEXT,

    CONSTRAINT orders_token_unique_per_day UNIQUE (outlet, business_date, digital_token),
    CONSTRAINT orders_token_format CHECK (digital_token ~ '^TOKEN-[0-9]{3,6}$'),
    CONSTRAINT orders_public_ref_format CHECK (public_ref ~ '^ORD-[A-Z0-9]{8,24}$'),
    CONSTRAINT orders_delivery_fields_required CHECK (
        channel <> 'PHONE_DELIVERY' OR (
            delivery_zone_id IS NOT NULL
            AND delivery_note IS NOT NULL
            AND customer_name IS NOT NULL
            AND customer_phone IS NOT NULL
        )
    ),
    CONSTRAINT orders_customer_name_length CHECK (
        customer_name IS NULL OR char_length(btrim(customer_name)) BETWEEN 2 AND 80
    ),
    CONSTRAINT orders_customer_phone_format CHECK (
        customer_phone IS NULL OR customer_phone ~ '^256[0-9]{9}$'
    ),
    CONSTRAINT orders_delivery_note_length CHECK (
        delivery_note IS NULL OR char_length(btrim(delivery_note)) BETWEEN 3 AND 160
    ),
    CONSTRAINT orders_delivery_coords_paired CHECK (
        (delivery_lat IS NULL) = (delivery_lng IS NULL)
    ),
    CONSTRAINT orders_delivery_coords_valid CHECK (
        delivery_lat IS NULL OR (
            delivery_lat BETWEEN -90 AND 90
            AND delivery_lng BETWEEN -180 AND 180
        )
    ),
    CONSTRAINT orders_delivery_accuracy_non_negative CHECK (
        delivery_accuracy_m IS NULL OR delivery_accuracy_m >= 0
    ),
    CONSTRAINT orders_delivery_accuracy_requires_pin CHECK (
        delivery_accuracy_m IS NULL OR delivery_lat IS NOT NULL
    ),
    CONSTRAINT orders_delivery_pin_timestamp_requires_pin CHECK (
        delivery_pin_captured_at IS NULL OR delivery_lat IS NOT NULL
    ),
    CONSTRAINT orders_amounts_non_negative CHECK (
        subtotal_ugx >= 0 AND delivery_fee_ugx >= 0 AND total_amount_ugx >= 0
    ),
    CONSTRAINT orders_total_matches CHECK (
        total_amount_ugx = subtotal_ugx + delivery_fee_ugx
    ),
    CONSTRAINT orders_prep_minutes_positive CHECK (
        estimated_prep_minutes IS NULL OR estimated_prep_minutes > 0
    ),
    CONSTRAINT orders_dine_in_table_required CHECK (
        channel <> 'DINE_IN' OR table_id IS NOT NULL
    ),
    CONSTRAINT orders_dine_in_postpay CHECK (
        channel <> 'DINE_IN' OR status <> 'AWAITING_PAYMENT'
    )
);

COMMENT ON COLUMN orders.digital_token IS
    'Human-readable queue token, unique per outlet per business date. Format TOKEN-NNN (3 digits, widening to 4–6 digits after 999).';
COMMENT ON COLUMN orders.public_ref IS
    'Globally unique order reference used as the telco externalId and the manual-payment reference. Never use the reusable display token for this.';
COMMENT ON COLUMN orders.business_date IS
    'Africa/Kampala business date. Scopes token numbering, daily reporting, and the digest.';
COMMENT ON COLUMN orders.channel IS
    'PHONE_DELIVERY covers both customer-app delivery and cashier phone delivery. No APP_DELIVERY enum in Phase 1. DINE_IN is the authenticated FOH postpay table tab and requires a table_id; it never starts in AWAITING_PAYMENT.';
COMMENT ON COLUMN orders.status IS
    'AWAITING_PAYMENT → PENDING → PREPARING → READY → COMPLETED | CANCELLED. Only PENDING and later are kitchen-visible.';
COMMENT ON COLUMN orders.delivery_note IS
    'Authoritative room/office/block/gate instruction. Never included in KDS broadcasts or KDS cards.';
COMMENT ON COLUMN orders.delivery_lat IS
    'Optional one-shot GPS hint. The landmark note is authoritative; no live tracking or routing uses this value.';
COMMENT ON COLUMN orders.delivery_fee_ugx IS
    'Snapshot of the delivery zone fee at order time. Included in total_amount_ugx and payment reconciliation.';

CREATE INDEX idx_delivery_zones_outlet_active
    ON delivery_zones (outlet, is_active, display_order);
CREATE INDEX idx_orders_delivery_zone
    ON orders (delivery_zone_id);
CREATE INDEX idx_orders_channel_status
    ON orders (channel, status);
CREATE INDEX idx_orders_outlet_business_date
    ON orders (outlet, business_date, status);

-- One open dine-in tab per table. A second DINE_IN insert for the same table
-- fails until the existing tab is COMPLETED or CANCELLED. The table grid's
-- "tap to claim" action relies on this guard.
CREATE UNIQUE INDEX orders_one_open_dine_in_per_table
    ON orders (table_id)
    WHERE channel = 'DINE_IN'
      AND status NOT IN ('COMPLETED', 'CANCELLED');


-- ============================================================
-- 7. ORDER LINE ITEMS
-- ============================================================
CREATE TABLE order_items (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id         UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id     UUID NOT NULL REFERENCES menu_items(id) ON DELETE RESTRICT,
    menu_item_name   VARCHAR(100) NOT NULL,          -- snapshot from menu_items
    station          station_type NOT NULL,
    quantity         INT NOT NULL DEFAULT 1,
    unit_price_ugx   NUMERIC(10, 2) NOT NULL,
    line_total_ugx   NUMERIC(10, 2) GENERATED ALWAYS AS
                         (quantity * unit_price_ugx) STORED,
    is_bumped        BOOLEAN NOT NULL DEFAULT FALSE, -- TRUE when cook marks this item ready
    special_notes    TEXT,

    CONSTRAINT order_items_quantity_positive CHECK (quantity > 0),
    CONSTRAINT order_items_price_non_negative CHECK (unit_price_ugx >= 0)
);

CREATE INDEX idx_order_items_order ON order_items (order_id);


-- ============================================================
-- 8. RAW MATERIALS & INVENTORY REGISTER
-- ============================================================
CREATE TABLE raw_inventory (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    outlet            outlet_location NOT NULL,
    item_name         VARCHAR(100) NOT NULL,       -- e.g., 'Cooking Oil', 'Whole Poultry'
    unit_of_measure   uom_type NOT NULL,           -- MILLILITERS, GRAMS, PIECES, PORTIONS, ...
    current_stock     NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    alert_threshold   NUMERIC(10, 2) NOT NULL DEFAULT 5.00,
    updated_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT raw_inventory_outlet_name_unique UNIQUE (outlet, item_name),
    CONSTRAINT raw_inventory_stock_non_negative CHECK (current_stock >= 0),
    CONSTRAINT raw_inventory_threshold_non_negative CHECK (alert_threshold >= 0)
);

COMMENT ON COLUMN raw_inventory.alert_threshold IS
    'When current_stock drops below this value, an SMS + dashboard alert fires to MANAGER_ADMIN.';


-- ============================================================
-- 9. BILL OF MATERIALS (BOM) — RECIPE DECREMENT MAP
-- ============================================================
CREATE TABLE recipe_bom (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    menu_item_id        UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    raw_material_id     UUID NOT NULL REFERENCES raw_inventory(id) ON DELETE RESTRICT,
    quantity_deducted   NUMERIC(10, 2) NOT NULL,  -- amount consumed per 1 unit of menu item

    CONSTRAINT recipe_bom_unique UNIQUE (menu_item_id, raw_material_id),
    CONSTRAINT recipe_bom_quantity_positive CHECK (quantity_deducted > 0)
);

COMMENT ON TABLE recipe_bom IS
    'Maps each menu item to its raw material consumption. Triggered on the order PREPARING transition. The service must reject a menu item and raw material from different outlets.';


-- ============================================================
-- 10. END-OF-DAY CLOSING SURPLUS LOGS (PRD Requirement C3)
-- ============================================================
CREATE TABLE closing_surplus_logs (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    outlet             outlet_location NOT NULL,
    log_date           DATE NOT NULL DEFAULT
                           ((CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Kampala')::date),
    menu_item_id       UUID REFERENCES menu_items(id) ON DELETE SET NULL,
    item_name          VARCHAR(100) NOT NULL,      -- snapshot; e.g., 'Beef Luwombo'
    leftover_portions  INT NOT NULL,
    resolution         surplus_action NOT NULL,
    logged_by          UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT closing_surplus_portions_positive CHECK (leftover_portions > 0)
);

CREATE INDEX idx_closing_surplus_date
    ON closing_surplus_logs (outlet, log_date);

COMMENT ON TABLE closing_surplus_logs IS
    'Evidence for the next-day prep review. Rows record what was cleared, staff-fed, or wasted; they do not drive an automatic forecast or price change.';

-- ============================================================
-- 11. DELIVERY HANDOFFS — RIDER ACCOUNTABILITY & OUTCOMES
-- ============================================================
CREATE TABLE delivery_handoffs (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id         UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    rider_name       VARCHAR(80) NOT NULL,
    rider_phone      VARCHAR(20),
    dispatched_by    UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    dispatch_method  dispatch_method NOT NULL DEFAULT 'CALL',
    rider_advance_ugx NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    rider_advance_returned_ugx NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    dispatched_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    delivered_at     TIMESTAMP WITH TIME ZONE,
    outcome          handoff_outcome NOT NULL DEFAULT 'PENDING',
    notes            TEXT,

    CONSTRAINT delivery_handoffs_delivered_at_valid CHECK (
        (outcome = 'DELIVERED' AND delivered_at IS NOT NULL)
        OR (outcome <> 'DELIVERED' AND delivered_at IS NULL)
    ),
    CONSTRAINT delivery_handoffs_advance_non_negative CHECK (
        rider_advance_ugx >= 0 AND rider_advance_returned_ugx >= 0
    ),
    CONSTRAINT delivery_handoffs_advance_returned_valid CHECK (
        rider_advance_returned_ugx <= rider_advance_ugx
    )
);

COMMENT ON TABLE delivery_handoffs IS
    'Records who handed a delivery bag to which rider, by which contact method, and whether it was delivered. Riders do not need system accounts in Phase 1.';
COMMENT ON COLUMN delivery_handoffs.outcome IS
    'PENDING until the rider returns a result. FAILED_UNREACHABLE/REFUSED/RETURNED require manager review; the order must not be marked COMPLETED.';
COMMENT ON COLUMN delivery_handoffs.rider_advance_ugx IS
    'Cash advanced to the rider for transport. Operating cost, not delivery-fee revenue; reconciled at shift close.';
COMMENT ON COLUMN delivery_handoffs.rider_advance_returned_ugx IS
    'Change or unused advance returned by the rider. Must not exceed rider_advance_ugx.';

CREATE INDEX idx_delivery_handoffs_order
    ON delivery_handoffs (order_id);
CREATE INDEX idx_delivery_handoffs_outcome
    ON delivery_handoffs (outcome, dispatched_at);


-- ============================================================
-- 12. PAYMENTS REGISTER (stub — full DDL in Payment_Integration.md §7)
-- ============================================================
-- The payments table, payment_status enum, payment_carrier enum, and
-- payment_events dedupe ledger are defined in Payment_Integration.md §7
-- and must be migrated after the orders table above. Key rules:
--   payments.order_id NOT NULL; many attempts per order are allowed
--   one SUCCESSFUL payment per order (partial unique index)
--   status INITIATED → PENDING_CUSTOMER_PIN → SUCCESSFUL | FAILED | TIMED_OUT | CANCELLED
--   a late/duplicate success, or a paid order cancelled after payment, becomes
--   REFUND_PENDING and is excluded from gross collections; a manager closes it
--   as REFUNDED after the external reversal
--   customer_msisdn is nullable ONLY for CASH; all mobile-money rows require it
--   payment_events(provider, event_id) makes webhook retries idempotent
-- Order creation sets status AWAITING_PAYMENT; payment success promotes it to PENDING.
-- An authenticated DINE_IN POSTPAY tab starts at PENDING and is settled at bill close.


-- ============================================================
-- 13. CASH COUNTS — SHIFT-CLOSE DRAWER RECONCILIATION
-- ============================================================
CREATE TABLE cash_counts (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    outlet             outlet_location NOT NULL,
    business_date      DATE NOT NULL,
    counted_cash_ugx   NUMERIC(10, 2) NOT NULL,
    expected_cash_ugx  NUMERIC(10, 2) NOT NULL,
    variance_ugx       NUMERIC(10, 2) GENERATED ALWAYS AS
                           (counted_cash_ugx - expected_cash_ugx) STORED,
    counted_by         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    counted_at         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes              TEXT,

    CONSTRAINT cash_counts_unique UNIQUE (outlet, business_date),
    CONSTRAINT cash_counts_non_negative CHECK (
        counted_cash_ugx >= 0 AND expected_cash_ugx >= 0
    )
);

COMMENT ON TABLE cash_counts IS
    'One cash count per outlet per business date. Expected cash is computed by the service as cash payments minus net rider advances (and cash refunds when implemented).';
COMMENT ON COLUMN cash_counts.variance_ugx IS
    'counted - expected. Positive = surplus; negative = shortage. The daily digest must read this, never hard-code zero.';

CREATE INDEX idx_cash_counts_date
    ON cash_counts (business_date, outlet);


-- ============================================================
-- 14. DAILY DIGESTS — IDEMPOTENT OWNER REPORTING
-- ============================================================
CREATE TYPE digest_status AS ENUM ('GENERATED', 'PARTIAL', 'SENT', 'FAILED');

CREATE TABLE daily_digests (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    digest_date     DATE NOT NULL UNIQUE,          -- consolidated Africa/Kampala date
    generated_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status          digest_status NOT NULL DEFAULT 'GENERATED',
    payload_json    JSONB NOT NULL,
    channels_sent   TEXT[] NOT NULL DEFAULT '{}', -- {'SMS','EMAIL','WHATSAPP'}
    error           TEXT,

    CONSTRAINT daily_digests_channels_valid CHECK (
        channels_sent <@ ARRAY['SMS', 'EMAIL', 'WHATSAPP']::TEXT[]
    )
);

COMMENT ON TABLE daily_digests IS
    'Idempotency and audit trail for the 21:30 EAT consolidated owner digest. One row per business date; unique digest_date prevents duplicate sends.';
COMMENT ON COLUMN daily_digests.payload_json IS
    'Aggregate business data only, with a per-outlet breakdown. Must contain no customer name, phone number, delivery note, or GPS coordinate.';
COMMENT ON COLUMN daily_digests.status IS
    'GENERATED = rendered but not sent; PARTIAL = at least one channel sent and at least one failed; SENT = all requested channels sent; FAILED = no channel sent.';

CREATE INDEX idx_daily_digests_status
    ON daily_digests (status, digest_date);


-- ============================================================
-- 15. TOKEN COUNTERS — CONCURRENCY-SAFE DAILY NUMBERING
-- ============================================================
CREATE TABLE token_counters (
    outlet        outlet_location NOT NULL,
    business_date DATE NOT NULL,
    last_value    INT NOT NULL DEFAULT 0,
    PRIMARY KEY (outlet, business_date),
    CONSTRAINT token_counters_non_negative CHECK (last_value >= 0)
);

COMMENT ON TABLE token_counters IS
    'One counter per outlet per Kampala business date. Allocate with INSERT ... ON CONFLICT DO UPDATE ... RETURNING last_value so concurrent checkouts never reuse TOKEN-042.';
```

---

## 4. Delivery Zone & Dispatch Integration

Full behavioural contract: **`Delivery_Zones_and_Dispatch.md`**. This section defines the backend surface that the rest of the stack consumes.

### 4.1 Zone lookup and validation

| Endpoint | Method | Behaviour |
| :--- | :--- | :--- |
| `/api/v1/delivery-zones?outlet=FOODIZO_HAM_TOWERS` | `GET` | Returns active zones for the outlet, ordered by `display_order`, with `fee_ugx`, ETA range, and `landmark_hint` |
| `/api/v1/admin/delivery-zones` | `GET/POST/PATCH` | Manager-only zone/fee/ETA maintenance; writes to the audit log |
| `/api/v1/orders` | `POST` | Validates items against `menu_items`, recomputes all prices and the delivery fee, allocates a daily token, then either creates a prepaid order as `AWAITING_PAYMENT` or an authenticated FOH dine-in POSTPAY tab as `PENDING` |
| `/api/v1/dispatch/queue?outlet=...&state=active\|review` | `GET` | `active` (default) returns `READY` + `PHONE_DELIVERY` orders with no handoff or an open `PENDING` handoff; a `PENDING` handoff is displayed as **ON THE WAY**. `review` returns failed handoffs for manager resolution. Both include zone, note, recipient, phone, and an optional static map link. |
| `/api/v1/orders/:id/dispatch` | `POST` | Records the rider handoff, cash transport advance, and optionally sends an “on the way” SMS |
| `/api/v1/orders/:id/delivery-complete` | `POST` | Sets `delivered_at`, records `DELIVERED` and any returned advance, moves the order to `COMPLETED` |
| `/api/v1/orders/:id/reprint-chit` | `POST` | Re-fires the ESC/POS chit and writes an audit row |

```typescript
// src/server/services/delivery-zone-service.ts
import { prisma } from '../plugins/prisma';

export async function getActiveZones(outlet: 'FOODIZO_HAM_TOWERS' | 'OBUNUZI_YMCA') {
  return prisma.delivery_zones.findMany({
    where: { outlet, is_active: true },
    orderBy: [{ display_order: 'asc' }, { display_name: 'asc' }],
    select: {
      id: true,
      zone_code: true,
      display_name: true,
      landmark_group: true,
      landmark_hint: true,
      fee_ugx: true,
      eta_min_minutes: true,
      eta_max_minutes: true,
    },
  });
}

export async function resolveDeliveryZone(input: {
  outlet: 'FOODIZO_HAM_TOWERS' | 'OBUNUZI_YMCA';
  zoneId: string;
}) {
  const zone = await prisma.delivery_zones.findUnique({
    where: { id: input.zoneId },
  });

  if (!zone) throw new Error('DELIVERY_ZONE_REQUIRED');
  if (!zone.is_active) throw new Error('DELIVERY_ZONE_INACTIVE');
  if (zone.outlet !== input.outlet) throw new Error('DELIVERY_ZONE_OUTLET_MISMATCH');

  return zone; // caller snapshots zone.fee_ugx onto the order
}

// src/server/utils/maps-link.ts
// Free universal link. No API key, no SDK.
export function staticMapLink(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

// tel/WhatsApp deep links. The phone must already be E.164 (2567XXXXXXXX).
export function callLink(e164: string): string {
  return `tel:+${e164}`;
}

export function whatsAppLink(e164: string, message: string): string {
  return `https://wa.me/${e164}?text=${encodeURIComponent(message)}`;
}
```

**Order-creation rule:** validate the active menu items and all delivery fields **before** creating the order or payment row. For `DINE_IN`, validate that the `table_id` exists, is active, belongs to the same outlet, and has no open `DINE_IN` tab; return `TABLE_ALREADY_OCCUPIED` rather than opening a second tab. Resolve every price and the delivery fee on the server; ignore client-supplied totals. If validation fails, return the specific error code from `Delivery_Zones_and_Dispatch.md §9`; do not allocate a token, create an order, or initiate an STK push. For a customer-app `TAKEAWAY_PICKUP`, persist the payer MSISDN as `orders.customer_phone` so the READY SMS has a destination; a walk-in cash takeaway without a phone stores `NULL` and simply receives no SMS. A prepaid order is created as `AWAITING_PAYMENT`; only a verified payment promotes it to `PENDING` for the KDS. A failed or timed-out payment leaves the order in `AWAITING_PAYMENT` for a retry and is auto-cancelled after the payment TTL. The only exception is an authenticated FOH dine-in **POSTPAY** tab, which is created as `PENDING` because the guest settles at bill close; a POSTPAY request that is not `DINE_IN` or lacks a valid staff session is rejected.

### 4.2 Dispatch handoff service

```typescript
// src/server/services/dispatch-service.ts
import { prisma } from '../plugins/prisma';

export async function recordHandoff(input: {
  orderId: string;
  dispatchedBy: string;
  riderName: string;
  riderPhone?: string;
  dispatchMethod: 'CALL' | 'WHATSAPP' | 'COUNTER_HANDOFF';
  riderAdvanceUgx?: number;
  riderAdvanceReturnedUgx?: number;
}) {
  return prisma.delivery_handoffs.create({
    data: {
      order_id: input.orderId,
      dispatched_by: input.dispatchedBy,
      rider_name: input.riderName,
      rider_phone: input.riderPhone,
      dispatch_method: input.dispatchMethod,
      rider_advance_ugx: input.riderAdvanceUgx ?? 0,
      rider_advance_returned_ugx: input.riderAdvanceReturnedUgx ?? 0,
      outcome: 'PENDING',
    },
  });
}

export async function completeDelivery(input: {
  orderId: string;
  handoffId: string;
  outcome: 'DELIVERED' | 'FAILED_UNREACHABLE' | 'REFUSED' | 'RETURNED';
  riderAdvanceReturnedUgx?: number;
}) {
  return prisma.$transaction(async (tx) => {
    await tx.delivery_handoffs.update({
      where: { id: input.handoffId },
      data: {
        outcome: input.outcome,
        ...(input.riderAdvanceReturnedUgx !== undefined
          ? { rider_advance_returned_ugx: input.riderAdvanceReturnedUgx }
          : {}),
        ...(input.outcome === 'DELIVERED' ? { delivered_at: new Date() } : {}),
      },
    });

    if (input.outcome === 'DELIVERED') {
      return tx.orders.update({
        where: { id: input.orderId },
        data: { status: 'COMPLETED', completed_at: new Date() },
      });
    }

    // Failed outcomes do not mark the order COMPLETED. The manager resolves
    // the order as CANCELLED and routes food through the surplus/waste log.
    return tx.orders.findUniqueOrThrow({ where: { id: input.orderId } });
  });
}
```

### 4.3 KDS privacy boundary

The Redis broadcast for delivery orders includes `deliveryZone` (display name) but **never** `customer_name`, `customer_phone`, `delivery_note`, `delivery_lat`, `delivery_lng`, or `delivery_accuracy_m`. The `PATCH /api/v1/orders/:id/status` response is also sanitized to the same KDS-safe fields; the KDS client never receives the contact block. The FOH dispatch endpoint is role-guarded and is the only API that returns the full delivery contact block.

### 4.4 Notification behaviour

| Trigger | Channel | Message |
| :--- | :--- | :--- |
| `READY` + `TAKEAWAY_PICKUP` | SMS (Africa's Talking) | “TOKEN-088 is ready at the Express Counter.” |
| `READY` + `PHONE_DELIVERY` | FOH dispatch queue + printed chit | No automatic customer SMS at `READY`; the rider is being assigned |
| FOH taps “Dispatch rider” | Optional SMS | “Your order is on the way.” No live-tracking claim or precise ETA |
| `DELIVERED` | Optional SMS | “Delivered. Thank you.” Only if the business enables delivery notifications |

---

## 5. Real-Time KDS Event Handler

```typescript
// Fastify Handler: PATCH /api/v1/orders/:id/status
// Advances an order through the PRD-normalised ticket lifecycle.
// Payment webhook route:  src/server/routes/payments.ts
// MTN payment service:    src/server/services/momo-service.ts
// Airtel payment service: src/server/services/airtel-service.ts
// See Payment_Integration.md §5–6 for implementation.
import type { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../plugins/prisma';
import { redisPublisher } from '../plugins/redis';
import { deductOrderInventory } from '../services/inventory-service';
import { sendPickupSmsAlert } from '../services/sms-service';
import { printExpoBagLabel } from '../services/printer-service';

type StatusTransition = 'PREPARING' | 'READY' | 'COMPLETED';

const expectedStatus: Record<StatusTransition, 'PENDING' | 'PREPARING' | 'READY'> = {
  PREPARING: 'PENDING',
  READY: 'PREPARING',
  COMPLETED: 'READY',
};

export async function updateOrderStatus(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { id } = request.params as { id: string };
  const { status } = request.body as { status: StatusTransition };
  const requestId = request.id;

  // ── 0. Delivery completion is handoff-owned. ───────────────────────────
  // A PHONE_DELIVERY order closes only through
  // POST /api/v1/orders/:id/delivery-complete, which records the handoff
  // outcome and delivered_at. Reject a bare KDS bump to COMPLETED.
  if (status === 'COMPLETED') {
    const order = await prisma.orders.findUnique({
      where: { id },
      select: { channel: true },
    });
    if (order?.channel === 'PHONE_DELIVERY') {
      await reply.code(409).send({ error: 'DELIVERY_COMPLETION_REQUIRES_HANDOFF' });
      return;
    }
  }

  // ── 1. Atomic transition + BOM decrement. ───────────────────────────────
  // The WHERE clause makes the bump concurrency-safe: two cooks tapping the
  // same card cannot both advance it. AWAITING_PAYMENT and CANCELLED orders
  // cannot be bumped because they never match the expected status.
  const updatedOrder = await prisma.$transaction(async (tx) => {
    const { count } = await tx.orders.updateMany({
      where: { id, status: expectedStatus[status] },
      data: {
        status,
        ...(status === 'READY'     ? { ready_at: new Date() }     : {}),
        ...(status === 'COMPLETED' ? { completed_at: new Date() } : {}),
      },
    });

    if (count !== 1) throw new Error('INVALID_STATUS_TRANSITION');

    // deductOrderInventory must accept the transaction client and must throw
    // INSUFFICIENT_STOCK rather than silently going negative. The rollback
    // keeps the ticket in its previous state for a manager decision.
    if (status === 'PREPARING') {
      await deductOrderInventory(tx, id);
    }

    return tx.orders.findUniqueOrThrow({
      where: { id },
      include: { table: true, delivery_zone: true },
    });
  });

  // ── 2. Broadcast after commit, never inside the transaction. ────────────
  // A rollback must not leave a phantom ticket on the KDS.
  try {
    await redisPublisher.publish('ORDER_STATUS_CHANNEL', JSON.stringify({
      orderId:      updatedOrder.id,
      digitalToken: updatedOrder.digital_token,
      channel:      updatedOrder.channel,
      status:       updatedOrder.status,
      table:        updatedOrder.table?.table_label ?? null,
      deliveryZone: updatedOrder.delivery_zone?.display_name ?? null,
    }));
  } catch (err) {
    // The status change is already durable. Clients recover on reconnect or
    // poll; log the failure and do not ask the cook to bump again.
    request.log.error({ err, orderId: updatedOrder.id, requestId }, 'KDS broadcast failed');
  }

  // ── 3. SMS for TAKEAWAY_PICKUP when READY. ──────────────────────────────
  if (
    status === 'READY' &&
    updatedOrder.channel === 'TAKEAWAY_PICKUP' &&
    updatedOrder.customer_phone
  ) {
    try {
      await sendPickupSmsAlert(
        updatedOrder.customer_phone,
        updatedOrder.digital_token,
        updatedOrder.outlet === 'FOODIZO_HAM_TOWERS' ? 'Foodizo' : 'Obunuzi'
      );
    } catch (err) {
      // A failed SMS must not undo a completed kitchen bump.
      request.log.error({ err, orderId: updatedOrder.id, requestId }, 'pickup SMS failed');
    }
  }

  // ── 4. Takeaway and delivery: print the packaging chit. ────────────────
  // Dine-in food is plated, so it does not produce a bag label. Do not send
  // phone/room/GPS data over Redis. The dispatch queue reads the role-guarded
  // /dispatch/queue endpoint; the chit printer receives the full contact block
  // through its own service call.
  if (
    status === 'READY' &&
    (updatedOrder.channel === 'TAKEAWAY_PICKUP' || updatedOrder.channel === 'PHONE_DELIVERY')
  ) {
    try {
      await printExpoBagLabel(updatedOrder.id);
    } catch (err) {
      // A printer failure must not block the KDS bump. The Expo/FOH screen
      // exposes PRINT CHIT so staff can retry without bumping again.
      request.log.error({ err, orderId: updatedOrder.id, requestId }, 'packaging chit print failed');
    }
  }

  // ── 5. Return only KDS-safe fields. ─────────────────────────────────────
  // The PATCH endpoint is the kitchen bump surface. Do not leak the phone,
  // room note, or GPS pin back to the KDS client via the response body.
  reply.status(200).send({
    id: updatedOrder.id,
    digital_token: updatedOrder.digital_token,
    channel: updatedOrder.channel,
    status: updatedOrder.status,
    table: updatedOrder.table?.table_label ?? null,
    deliveryZone: updatedOrder.delivery_zone?.display_name ?? null,
  });
}
```

---

## 6. Authentication, Sessions & Role-Based Access Control

Phase 1 uses **staff login only**. Customers browse and order without an account; the `CUSTOMER` role exists for a future customer login and must not be seeded as a staff shortcut.

### 6.1 Login and session contract

- **Credentials:** E.164 phone number + a 4–6 digit PIN. The PIN is hashed with bcrypt (cost 12) or argon2id; the plaintext PIN is never stored, logged, or returned.
- **Endpoints:** `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me`.
- **Cookie:** `foodizo_session`, an opaque 32-byte random token. `HttpOnly`, `SameSite=Lax`, `Path=/`, and `Secure` whenever the app is served over HTTPS. On a plain-HTTP LAN, `Secure` must be off and the Wi-Fi must be restricted to staff devices; use HTTPS through the tunnel for remote access.
- **Server-side session:** only the SHA-256 hash is stored in `user_sessions.token_hash`. Sessions expire after `SESSION_TTL_HOURS` (default 12), and are revoked on logout, PIN reset, role change, or deactivation.
- **Brute-force control:** rate-limit login by IP and phone; lock the account after `LOGIN_MAX_ATTEMPTS` failures for `LOGIN_LOCK_MINUTES`. Record failures in `audit_log` without the attempted PIN.
- **CSRF:** `SameSite=Lax` plus an `Origin`/`Referer` check on every mutating request. No state-changing GET. Do not rely on a client-supplied `data-role`.
- **Destructive-action approval:** a `WAITER_FOH` cannot cancel or void directly. The UI opens an approval prompt; a `MANAGER_ADMIN` enters their phone and PIN, which the API verifies through the same login service and outlet guard. A manager who is already signed in may approve with their own session. Record both the requesting user and the approving manager in `audit_log`. There is no separate shared override PIN.
- **Audit:** login success/failure, logout, user create/update/deactivate, role change, price change, zone change, void, manual MoMo verification, cash count, chit reprint, and surplus log.

### 6.2 Route and surface matrix

| Surface | Allowed roles |
| :--- | :--- |
| `/`, `/cart`, `/checkout`, `/token/[token]` | Public; `CUSTOMER` if customer login is enabled |
| `/pos/*` | `WAITER_FOH`, `MANAGER_ADMIN` |
| `/kds/*` | `KITCHEN_STAFF`, `MANAGER_ADMIN` |
| `/admin/*` | `MANAGER_ADMIN` |
| `GET /api/v1/menu?outlet=...` | Public; active, non-86 items with server-owned prices |
| `GET /api/v1/delivery-zones?outlet=...` | Public; active zones for the outlet |
| `POST /api/v1/orders` | Public customer checkout (prepaid only); `WAITER_FOH` or `MANAGER_ADMIN` for phone entry and `DINE_IN` POSTPAY tabs |
| `POST /api/v1/orders/:id/settle` | `WAITER_FOH`, `MANAGER_ADMIN`; records cash, verified manual MoMo, or initiates a telco payment against an existing tab |
| `POST /api/v1/orders/:id/cancel` | `MANAGER_ADMIN`; `WAITER_FOH` only with manager approval |
| `POST /api/v1/payments/:id/refund` | `MANAGER_ADMIN`; closes a `REFUND_PENDING` payment as `REFUNDED` after the external reversal, with an audit-logged reference |
| `PATCH /api/v1/orders/:id/status` | `KITCHEN_STAFF`, `MANAGER_ADMIN` |
| `PATCH /api/v1/tables/:id/status` | `WAITER_FOH`, `MANAGER_ADMIN` |
| `/api/v1/dispatch/*` | `WAITER_FOH`, `MANAGER_ADMIN` |
| `POST /api/v1/orders/:id/dispatch` | `WAITER_FOH`, `MANAGER_ADMIN`; records the rider handoff and advance |
| `POST /api/v1/orders/:id/delivery-complete` | `WAITER_FOH`, `MANAGER_ADMIN`; records the delivered outcome and closes the order |
| `POST /api/v1/orders/:id/reprint-chit` | `WAITER_FOH`, `MANAGER_ADMIN`; audit-logged reprint |
| `POST /api/v1/payments/webhook` | Provider-authenticated public callback; no staff session |
| `/api/v1/admin/*` | `MANAGER_ADMIN` |
| `/api/v1/auth/login` | Public |
| `/api/v1/auth/logout`, `/api/v1/auth/me` | Any authenticated user |

`POST /api/v1/orders` treats `channel = DINE_IN` as the postpay table tab: it requires an authenticated `WAITER_FOH` or `MANAGER_ADMIN` session and a valid `table_id`. The order is created as `PENDING` and never enters `AWAITING_PAYMENT`. A public request that asks for `DINE_IN` is rejected with `POSTPAY_REQUIRES_STAFF`. Every other channel is prepaid: it is created as `AWAITING_PAYMENT` and enters `PENDING` only through a verified payment. `POST /api/v1/orders/:id/settle` never changes kitchen status; it only records money against the tab.

**Order and status error codes**

| Code | Meaning |
| :--- | :--- |
| `POSTPAY_REQUIRES_STAFF` | A public/customer request asked for `DINE_IN`; POSTPAY tabs are staff-only |
| `TABLE_ALREADY_OCCUPIED` | The table already has an open `DINE_IN` tab; settle or cancel it before opening another |
| `DELIVERY_COMPLETION_REQUIRES_HANDOFF` | A KDS bump tried to set a `PHONE_DELIVERY` order to `COMPLETED`; use the FOH delivery-complete endpoint so the handoff outcome and `delivered_at` are recorded |
| `INVALID_STATUS_TRANSITION` | The order is not in the expected previous state, or the transition is not allowed |

Authorization is enforced in Fastify route guards and repeated in the service layer for destructive actions. Hiding a button is never authorization. A `MANAGER_ADMIN` with `users.outlet = NULL` may read both outlets but must still pass the manager guard; outlet-scoped staff are restricted to their own outlet.

---

## 7. Repository Scaffold (Recommended Directory Structure)

The canonical, exact scaffold is `Repo_Scaffold_and_Config.md §1`. This is the same tree in summary form; do not create a second monorepo layout:

```
foodizo-obunuzi-kds/
├── Dockerfile.client / Dockerfile.server / docker-compose.yml
├── prisma/
│   ├── schema.prisma            # Mirrors the DDL above + payments table
│   └── seed.ts
├── scripts/
│   ├── run-daily-digest.ts      # Manual digest run / dry-run
│   └── simulate-rush-hour.ts
├── src/
│   ├── app/                     # Next.js 14 App Router: customer PWA, FOH POS, KDS, admin
│   ├── components/              # Shared UI, delivery, KDS, POS components
│   ├── lib/                     # Client-side helpers (audio, geolocation, websocket)
│   └── server/                  # Fastify API: jobs, plugins, routes, services, utils
├── deploy/
│   ├── backup.sh
│   └── cloudflared.yml
├── docs/                        # This 15-file specification package
├── .env.example                 # MoMo/Airtel/AT/SMTP config; NO Google Maps API key
└── package.json                 # Single Next.js + Fastify application
```
