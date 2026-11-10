# Dashboard-by-Dashboard Build Progression & UI Implementation Roadmap

**Document Type:** Screen-by-Screen Frontend/Backend Build Order & Interface Architecture  
**Target Environment:** Antigravity IDE + Opencode CLI Repository Scaffold  
**Framework:** Next.js 14 (App Router) + Fastify API Engine + Prisma ORM + PostgreSQL 16 + Redis 7  
**Locations:** Foodizo (Ham Towers) & Obunuzi Restaurant & Cafe (Opposite YMCA), Kampala, Uganda  
**Related Specifications:** `build_strategy/Build_Strategy_and_Phases.md` · `docs/Design_System.md` · `docs/User_Flow.md` · `docs/Tech_Stack.md` · `docs/Payment_Integration.md` · `docs/Delivery_Zones_and_Dispatch.md` · `go_to_market/Go_To_Market_Strategy.md`

> **Implementation status:** This is a historical screen-by-screen plan, not a description of the shipped app. The repository uses static HTML/CSS/JS, not Next.js. The live staff surfaces are `/login`, `/pos`, `/kds`, `/dispatch`, `/admin`, plus the public `/d/:token` digest. Customer screens under `/prototype/*` are static design prototypes. The KDS is one live screen with channel filters, not four station routes. Manager functions are consolidated on `/admin`. There is no Redis and no inventory-management screen. See `docs/Repo_Scaffold_and_Config.md` for the actual scaffold.

---

## 1. Executive Implementation Vision: The Surface Build Chain

When constructing this system, development does **not** proceed randomly or as a disconnected monorepo. It follows a strict, operational **Dashboard-by-Dashboard Build Progression**.

Every screen represents a physical actor in the restaurant service loop: the hungry student ordering from class, the waiter taking table orders on the floor, the cook working through kitchen heat, the expediter handing delivery bags to boda riders, and the owner balancing the cash drawer at night.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        MASTER DASHBOARD BUILD PROGRESSION                              │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│   [ Surface 1: Staff Auth & Role Dispatch Gateway ]                                    │
│   (/login — Phone + PIN Keypad -> Role-Based Routing)                                  │
│         │                                                                              │
│         ├─────────────────────────────────────────┐                                    │
│         ▼                                         ▼                                    │
│   [ Surface 2: Customer Pre-Order PWA ]     [ Surface 3: Waitress / FOH POS ]          │
│   (/, /cart, /checkout, /token/[token])     (/pos/tables, /pos, /pos/phone-entry)      │
│   • Rolex / Chicken Menu Discovery          • Visual Table Occupancy Grid              │
│   • Campus Delivery Landmark Dropdown       • Rapid Dine-In Order Entry                │
│   • MTN / Airtel MoMo STK Push Prompt       • Postpay "Send to Kitchen" Tab            │
│   • High-Visibility Token Card (#042)       • Table-Side Cash / MoMo Settle            │
│         │                                         │                                    │
│         │ (Prepaid MoMo Success)                  │ (Fires Postpay PENDING Tab)        │
│         └────────────────────┬────────────────────┘                                    │
│                              │                                                         │
│                              ▼                                                         │
│               [ Surface 4: Kitchen KDS Dashboards ]                                    │
│               (/kds/steam, /kds/fryer, /kds/rolex, /kds/expo)                          │
│               • Station-Filtered Ticket Queues                                         │
│               • Color-Coded Channel Badges (Blue/Amber/Purple)                         │
│               • Giant 68px Bump Buttons (CLAIM -> READY)                               │
│               • Automated Recipe BOM Inventory Deduction                               │
│               • Privacy Filter (Destination Zone only; NO Phone/GPS)                   │
│               • ESC/POS LAN Thermal Printing Trigger at READY                          │
│                              │                                                         │
│                              ▼                                                         │
│               [ Surface 5: FOH Delivery Dispatch Queue ]                               │
│               (/pos/dispatch — Packaging & Rider Handoff)                              │
│               • Waiting Orders with Destination & Landmark Room Note                   │
│               • One-Tap CALL (tel:) and WHATSAPP (wa.me:) Deep Links                   │
│               • Optional Static Google Maps Link                                       │
│               • Rider Assignment & Cash Transport Advance Tracking                     │
│               • Delivered Confirmation / Unreachable Handling                          │
│                              │                                                         │
│                              ▼                                                         │
│               [ Surface 6: Manager Executive Admin Portal ]                            │
│               (/admin/dashboard, /admin/menu, /admin/inventory,                        │
│                /admin/surplus, /admin/reconcile, /admin/audit)                         │
│               • Cross-Outlet Live Ticket Queues & Turnaround KPIs                      │
│               • 7:30 PM Luwombo Flash Clearance Pricing Override                       │
│               • Raw Commodity Inventory & Low-Stock Alerts                             │
│               • 9:00 PM Closing Surplus Logging Routine                                │
│               • Shift-Close Cash Reconciliation (Actual Drawer vs Expected)            │
│               • Append-Only Security Audit Log                                         │
│                              │                                                         │
│                              ▼                                                         │
│               [ Surface 7: Automated Nightly Audit Digest ]                            │
│               (Automated 21:30 EAT Cron Engine)                                        │
│               • Africa's Talking 2-Segment SMS Summary                                 │
│               • Full Financial & Inventory Audit HTML/Text Email                       │
│               • Cryptographic Signed One-Click Audit Report URL                        │
│               • Explicit CASH_COUNT_MISSING Alert (Zero Fabricated Zeroes)             │
│                                                                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Detailed Screen-by-Screen Build Specifications

---

### Surface 1: Staff Authentication & Role Dispatch Gateway

* **Route:** `/login`
* **Stitch Prototype:** [`frontend/html/staff_terminal_pin_login.html`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/html/staff_terminal_pin_login.html)
* **Target Users:** All staff members: Prossy N. (Waiter), Chef Juma (Cook), Zito Mbowe (Manager/Admin).
* **Design Personality:** Tactical Service Slate (`#F1F5F9` surface, `#1E3A8A` Cobalt primary, 6px crisp radius).

```
┌────────────────────────────────────────────┐
│         FOODIZO & OBUNUZI OPERATING        │
│                STAFF PORTAL                │
├────────────────────────────────────────────┤
│  Select Outlet:                            │
│  (•) Foodizo Ham Towers   ( ) Obunuzi YMCA │
│                                            │
│  Phone Number:                             │
│  [ +256 772 111 222                      ] │
│                                            │
│  Enter 4-Digit Security PIN:               │
│  [ • • • •                               ] │
│                                            │
│  [ 1 ]  [ 2 ]  [ 3 ]                       │
│  [ 4 ]  [ 5 ]  [ 6 ]                       │
│  [ 7 ]  [ 8 ]  [ 9 ]                       │
│  [ C ]  [ 0 ]  [ ⌫ ]                       │
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │         SIGN IN TO TERMINAL          │  │
│  └──────────────────────────────────────┘  │
└────────────────────────────────────────────┘
```

* **Frontend UI Components:**
  - Outlet selector pill toggle: Foodizo Ham Towers vs. Obunuzi YMCA.
  - Ugandan MSISDN input field with automatic prefix formatting.
  - 4-digit PIN keypad with masked dot display.
  - Tactile 56px action button with active depression feedback (`translate-y-[2px]`).
* **Backend API & Data Flow:**
  - Endpoint: `POST /api/v1/auth/login`.
  - Service: `auth-service.ts` verifies `pin_hash` via bcrypt cost 12.
  - Security check: Locks account for 15 minutes after 5 consecutive failed attempts (`locked_until`).
  - Session creation: Writes SHA-256 hash to `user_sessions`, issues opaque 32-byte `foodizo_session` HttpOnly cookie.
* **Role-Based Routing Logic:**
  - If `role === 'WAITER_FOH'` $\rightarrow$ redirect directly to **Surface 3** (`/pos/tables`).
  - If `role === 'KITCHEN_STAFF'` $\rightarrow$ redirect directly to **Surface 4** (`/kds/expo` or assigned station).
  - If `role === 'MANAGER_ADMIN'` $\rightarrow$ redirect directly to **Surface 6** (`/admin/dashboard`).
  - Customers browse public routes without login; the `CUSTOMER` enum is reserved for future customer accounts.

---

### Surface 2: Customer Pre-Order PWA & Pickup Token Interface

* **Routes:** `/` (Menu), `/cart` (Cart Review), `/checkout` (Fulfillment & Payment), `/token/[token]` (Token Card).
* **Stitch Prototypes:** [`02a Landing`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/html/customer_pwa_landing_page.html), [`02b Menu`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/html/campus_pre_order_menu.html), [`02c Checkout`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/html/momo_checkout_delivery_zone_selector.html), [`02d Token`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/html/digital_token_queue_bypass_status.html), [`02e Delivery Tracker`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/html/boda_landmark_delivery_tracker.html)
* **Target User:** Brian K. (Makerere University Student rushing between lectures).
* **Design Personality:** Warm Street Craft (`#FAF8F5` Warm Cream background, `#C2410C` Chili pill buttons `9999px` radius, soft warm lift shadows).

```
┌────────────────────────────────────────────┐
│  Foodizo — Ham Towers          Cart (2)│
├────────────────────────────────────────────┤
│ [All]  [Rolex]  [Chicken]  [Luwombo]  [Sides]│
├────────────────────────────────────────────┤
│ ┌────────────────────────────────────────┐ │
│ │ 2pc Fried Chicken & Chips              │ │
│ │ Crispy golden chicken with fresh chips │ │
│ │ UGX 14,000            ┌──────────────┐ │ │
│ │ Station: Grill/Fryer  │  + ADD (1)   │ │ │
│ └───────────────────────┴──────────────┴─┘ │
│ ┌────────────────────────────────────────┐ │
│ │ Regular Rolex (2 Eggs, 1 Chapati)      │ │
│ │ Freshly rolled on the griddle          │ │
│ │ UGX 3,500             ┌──────────────┐ │ │
│ │ Station: Rolex        │    + ADD     │ │ │
│ └───────────────────────┴──────────────┴─┘ │
├────────────────────────────────────────────┤
│ ┌────────────────────────────────────────┐ │
│ │  VIEW CART (2 Items) — UGX 17,500  ─►  │ │
│ └────────────────────────────────────────┘ │
└────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────┐
│               CHECKOUT & PAY               │
├────────────────────────────────────────────┤
│ Fulfillment Method:                        │
│ [ (•) Pre-Order Pickup ]  [ ( ) Delivery ] │
│                                            │
│ Delivery Drop-Off Zone:                    │
│ [ Makerere Univ — Mary Stuart Hall    ▼ ]  │
│ (Fee: UGX 2,000 · ETA: 10–15 min)          │
│                                            │
│ Room / Office / Gate Landmark Note:        │
│ [ Block B, Room 14 — call at the gate    ] │
│                                            │
│ Recipient Name:                            │
│ [ Brian K.                               ] │
│                                            │
│ Rider-Callable Phone Number:               │
│ [ 0772 123 456                           ] │
│                                            │
│ [  Use My Current Location (Optional) ]  │
│                                            │
│ Payment Method: Mobile Money               │
│ Subtotal:                   UGX 17,500     │
│ Delivery Fee:               UGX  2,000     │
│ ────────────────────────────────────────── │
│ Total Payable:              UGX 19,500     │
│                                            │
│ ┌────────────────────────────────────────┐ │
│ │     PAY VIA MOMO / AIRTEL MONEY        │ │
│ └────────────────────────────────────────┘ │
└────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────┐
│            FOODIZO EXPRESS PICKUP          │
├────────────────────────────────────────────┤
│                                            │
│             YOUR PICKUP TOKEN              │
│                                            │
│                 #042                       │
│          REF: TOKEN-042 (Foodizo)          │
│                                            │
│  ● PREPARING (Est. Ready in 5 Mins)        │
│                                            │
│  [===================>           ] 65%     │
│                                            │
│  Instructions:                             │
│  Walk past the counter line directly to    │
│  the Express Pickup Shelf. Show this       │
│  token to the counter server to collect.   │
│                                            │
└────────────────────────────────────────────┘
```

* **Frontend UI Components:**
  - **Menu (`/`):** Category selector chips, menu item cards with live stock indicator, 86 overlay.
  - **Checkout (`/checkout`):** Pickup vs Delivery toggle. Grouped zone dropdown (`delivery_zones`), landmark note textarea (3–160 chars), recipient name, rider phone, optional one-shot HTML5 GPS button.
  - **Payment Modal:** 45-second animated countdown timer showing telecom approval instructions.
  - **Digital Token Card (`/token/[token]`):** 54px JetBrains Mono token number (`#042`), live animated progress bar, audio alert on bump to `READY`.
* **Backend API & Data Flow:**
  - `GET /api/v1/menu` $\rightarrow$ loads active menu items and prices.
  - `POST /api/v1/orders` $\rightarrow$ server validates zone, recalculates prices and delivery fee, creates order in `AWAITING_PAYMENT`, reserves daily `TOKEN-NNN`.
  - `POST /api/v1/payments/request-topay` $\rightarrow$ triggers MTN/Airtel USSD push.
  - Webhook settlement $\rightarrow$ promotes order to `PENDING` and streams to KDS.

---

### Surface 3: Waitress / FOH Handheld POS & Table Dashboard

* **Routes:** `/pos/tables` (Table Grid), `/pos` (Order Entry), `/pos/phone-entry` (Phone Orders).
* **Stitch Prototype:** [`frontend/html/waitress_pos_table_floor_order_pad.html`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/html/waitress_pos_table_floor_order_pad.html)
* **Target User:** Prossy N. (Senior Waitress & Floor Lead at Obunuzi).
* **Design Personality:** Tactical Service Slate (`#F1F5F9` slate background, `#1E3A8A` Cobalt primary, 6px crisp buttons, 48px/56px touch targets).

```
┌────────────────────────────────────────────┐
│ OBUNUZI FLOOR: TABLE GRID    [Phone Order] │
├────────────────────────────────────────────┤
│ ┌──────────────┐          ┌──────────────┐ │
│ │ T-01         │          │ T-02         │ │
│ │ VACANT       │          │ OCCUPIED     │ │
│ │ Cap: 4       │          │ 24m · Prossy │ │
│ └──────────────┘          └──────────────┘ │
│ ┌──────────────┐          ┌──────────────┐ │
│ │ T-03         │          │ T-04         │ │
│ │ BILL REQ     │          │ OCCUPIED     │ │
│ │ UGX 38,000   │          │ 12m · Prossy │ │
│ └──────────────┘          └──────────────┘ │
│ ┌──────────────┐          ┌──────────────┐ │
│ │ B-01 (Booth) │          │ B-02 (Booth) │ │
│ │ NEEDS CLEAR  │          │ VACANT       │ │
│ │ Busser alert │          │ Cap: 6       │ │
│ └──────────────┘          └──────────────┘ │
└────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────┐
│ TABLE T-04 (2 Guests)           Staff: Pro │
├────────────────────────────────────────────┤
│ [Steam Line]  [Luwombo]  [Sides]  [Drinks] │
├─────────────────────┬──────────────────────┤
│ ┌─────────────────┐ │ Current Ticket:      │
│ │ Beef Luwombo    │ │ 2x Beef Luwombo      │
│ │ UGX 16,000      │ │    UGX 32,000        │
│ └─────────────────┘ │    *Sauce hot*       │
│ ┌─────────────────┐ │ 2x Steamed Matooke   │
│ │ Steamed Matooke │ │    UGX 6,000         │
│ │ UGX 3,000       │ │ 2x Bottled Water     │
│ └─────────────────┘ │    UGX 3,000         │
│ ┌─────────────────┐ ├──────────────────────┤
│ │ Bottled Water   │ │ Total: UGX 41,000    │
│ │ UGX 1,500       │ │ ┌──────────────────┐ │
│ └─────────────────┘ │ │ SEND TO KITCHEN  │ │
│                     │ └──────────────────┘ │
└─────────────────────┴──────────────────────┘
```

* **Frontend UI Components:**
  - **Table Grid (`/pos/tables`):** Visual occupancy tiles with live status indicators (`VACANT`, `OCCUPIED`, `BILL_REQUESTED`, `NEEDS_CLEARING`).
  - **Order Entry (`/pos`):** Left-side 56px category and menu tiles; right-side live bill summary.
  - **Special Instruction Modal:** Fast modification tags ("Sauce hot", "Separate plate", "No salt").
  - **Bill Settlement Modal:** Collect cash, trigger customer MoMo STK prompt at table, or verify manual USSD merchant codes.
* **Backend API & Data Flow:**
  - `GET /api/v1/tables` $\rightarrow$ reads real-time table statuses.
  - `POST /api/v1/orders` $\rightarrow$ authenticated FOH user fires `DINE_IN` postpay tab directly to `PENDING` (no prepayment gate).
  - `POST /api/v1/orders/:id/settle` $\rightarrow$ records cash or MoMo payment against the tab, frees table to `NEEDS_CLEARING`.

---

### Surface 4: Kitchen Display System (KDS) Station Dashboards

* **Routes:** `/kds/steam` (Station 1), `/kds/fryer` (Station 2), `/kds/rolex` (Station 3), `/kds/expo` (Station 4 Pass).
* **Stitch Prototype:** [`frontend/html/kitchen_display_system_kds_active_stations.html`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/html/kitchen_display_system_kds_active_stations.html)
* **Target User:** Chef Juma & Kitchen Cooks (working with hot fryers, griddles, and steam pots).
* **Design Personality:** Industrial Machinery HUD (`#050811` Carbon Matte background, `#059669` Phosphor Green accents, 0px border radius, 68px full-width physical bevel bump buttons).

```
┌────────────────────────────────────────────────────────────────────────────┐
│ KDS — STATION 2: GRILL & FRYER   [Active: 3]   [All Channels ▼]    SOUND │
├────────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐ │
│ │ TAKEAWAY — TOKEN-042 │ │ DINE-IN — TABLE T-04 │ │ DELIVERY — TOKEN-043 │ │
│ │ Time: 02:45 (Normal) │ │ Time: 06:12 (Normal) │ │ Destination: YMCA    │ │
│ ├──────────────────────┤ ├──────────────────────┤ ├──────────────────────┤ │
│ │ 1x 2pc Fried Chicken │ │ 2x Beef Luwombo      │ │ 1x 2pc Fried Chicken │ │
│ │    & Chips           │ │    (Steam Line)      │ │    & Chips           │ │
│ │                      │ │                      │ │                      │ │
│ │ *Extra chili dip*    │ │ *Sauce hot*          │ │                      │ │
│ ├──────────────────────┤ ├──────────────────────┤ ├──────────────────────┤ │
│ │ ┌──────────────────┐ │ │ ┌──────────────────┐ │ │ ┌──────────────────┐ │ │
│ │ │ CLAIM PREPARING  │ │ │ │ BUMP TO READY    │ │ │ │ CLAIM PREPARING  │ │ │
│ │ └──────────────────┘ │ │ └──────────────────┘ │ │ └──────────────────┘ │ │
│ └──────────────────────┘ └──────────────────────┘ └──────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────┘
```

* **Frontend UI Components:**
  - Top Bar: Station filter switcher, active order counter, Web Audio "ARM SOUND" toggle.
  - Ticket Cards:
    - High-visibility channel badges: Blue (`DINE_IN`), Amber (`TAKEAWAY_PICKUP`), Purple (`PHONE_DELIVERY`).
    - Preparation timer: turns Red (`OVERDUE`) if prep exceeds 10 minutes.
    - Delivery tickets show destination zone only (`YMCA MAIN CAMPUS`).
    - Tap on individual line items toggles strike-through with audible 1,800Hz tick.
  - Giant 68px Bump Button:
    - State 1: `CLAIM PREPARING` (decrements recipe BOM).
    - State 2: `BUMP TO READY` (fires pickup SMS alert & Expo thermal printer).
* **Backend API & Hardware Data Flow:**
  - `PATCH /api/v1/orders/:id/status` $\rightarrow$ advances state atomically.
  - BOM Decrement: deducts cooking oil, chicken pieces, beef grams from `raw_inventory`.
  - Expo Printing: bump to `READY` triggers raw ESC/POS TCP socket write to `192.168.1.200:9100`.
  - Privacy Guard: Customer phone, room note, and GPS coordinates are stripped before WebSocket broadcast.

---

### Surface 5: Front-of-House Delivery Dispatch Queue

* **Route:** `/pos/dispatch`.
* **Stitch Prototype:** [`frontend/html/foh_boda_dispatch_delivery_queue.html`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/html/foh_boda_dispatch_delivery_queue.html)
* **Target Users:** FOH Cashier / Waiter (Prossy N.) and Freelance Boda Riders.
* **Design Personality:** Tactical Service Slate (`#F1F5F9`).

```
┌────────────────────────────────────────────────────────────────────────────┐
│ FOH DELIVERY DISPATCH QUEUE                           [Active: 2 | Total: 8]│
├────────────────────────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────────────────────────────┐ │
│ │ TOKEN-043  ● READY (Waiting for Rider)                 Elapsed: 02:15  │ │
│ │ Customer: Dr. Okello | Phone: 0701 234 567                             │ │
│ │ Destination: YMCA Main Campus — Block C, Room 204                      │ │
│ │ Note: Call at security gate. Food in thermal bag.                      │ │
│ │ Items: 1x Beef Luwombo, 1x Steamed Matooke, 1x Water                   │ │
│ ├────────────────────────────────────────────────────────────────────────┤ │
│ │ [  CALL ]   [  WHATSAPP ]   [  OPEN PIN ]   [  REPRINT CHIT ]   │ │
│ │                                                                        │ │
│ │ ┌────────────────────────────────────────────────────────────────────┐ │ │
│ │ │            ASSIGN RIDER & RECORD CASH ADVANCE (UGX 1,500)          │ │ │
│ │ └────────────────────────────────────────────────────────────────────┘ │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────┘
```

* **Frontend UI Components:**
  - Real-time list of all `READY` delivery orders.
  - One-tap quick actions: `CALL` (`tel:+256...`), `WHATSAPP` (`wa.me/256...`), `OPEN PIN` (static Google Maps link).
  - **Hand to Rider Modal:** Captures Rider Name, Phone, and Cash Transport Advance (`rider_advance_ugx`).
  - **Delivery Complete Modal:** Captures delivery outcome (`DELIVERED`), change returned, and closes order.
* **Backend API & Data Flow:**
  - Endpoint: `POST /api/v1/orders/:id/dispatch` $\rightarrow$ writes row to `delivery_handoffs`.
  - Endpoint: `POST /api/v1/orders/:id/delivery-complete` $\rightarrow$ marks order `COMPLETED`. Guard prevents KDS from marking delivery complete directly (`DELIVERY_COMPLETION_REQUIRES_HANDOFF`).

---

### Surface 6: Manager & Admin Executive Portal

* **Routes:** `/admin/dashboard`, `/admin/menu`, `/admin/inventory`, `/admin/surplus`, `/admin/reconcile`, `/admin/audit`, `/admin/users`.
* **Stitch Prototype:** [`frontend/html/manager_admin_eod_surplus_audit_digest.html`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/html/manager_admin_eod_surplus_audit_digest.html)
* **Target User:** Zito Mbowe (Project Coordinator / Operations Owner).
* **Design Personality:** Executive Obsidian Ledger (`#0B0F17` dark obsidian background, Champagne Brass `#C8A96A` accents, 2px precision borders, high data density).

```
┌────────────────────────────────────────────────────────────────────────────┐
│  FOODIZO & OBUNUZI — OPERATIONS AUDIT PORTAL        Logged in: Zito Mbowe│
├────────────────────────────────────────────────────────────────────────────┤
│ [Dashboard]  [Menu/Pricing]  [Inventory/BOM]  [Surplus Log]  [Reconcile]   │
├────────────────────────────────────────────────────────────────────────────┤
│ DAILY FINANCIAL RECONCILIATION — SHIFT CLOSE (21:30 EAT)                   │
│                                                                            │
│ Financial Collections:                     Physical Cash Reconciliation:   │
│   MTN MoMo (API Verified):   UGX 1,596,000   Expected in Drawer: UGX 246,000│
│   Airtel Money (Verified):   UGX   672,000   Counted Cash:       UGX 246,000│
│   Manual MoMo (Chits):       UGX   168,000   ───────────────────────────────│
│   Physical Cash Drawer:      UGX   308,000   Cash Variance:      UGX       0│
│   ────────────────────────────────────────   Status:             BALANCED   │
│   Gross Collections:         UGX 2,744,000                                  │
│                                              High-Turnover Inventory (BOM): │
│ Delivery Memo:                               Cooking Oil: 25.8L remaining   │
│   Delivery Fees Collected:   UGX    84,000   Broiler Chicken: 18 pcs remain │
│   Less: Rider Cash Advances: UGX   (62,000)  Fresh Eggs: 36 eggs remaining  │
│   ────────────────────────────────────────   Stewing Beef: 18.2kg remaining │
│   Net Delivery Contribution: UGX    22,000                                  │
│                                              7:30 PM Flash Clearance Log:   │
│ Exception Flags:                             Beef Luwombo: 4 portions sold  │
│   [0] Failed Payments                        2 staff meals | 1 waste        │
│   [0] Failed Deliveries                                                     │
│                                              [ PREVIEW 21:30 OWNER DIGEST ] │
└────────────────────────────────────────────────────────────────────────────┘
```

* **Frontend UI Components:**
  - **Executive Dashboard (`/admin/dashboard`):** Cross-outlet live revenue, turnaround times, active ticket volume.
  - **Menu Management (`/admin/menu`):** Instant price overrides, 86 toggles, 7:30 PM Luwombo flash clearance pricing.
  - **Inventory & BOM (`/admin/inventory`):** Live stock levels with red alert thresholds.
  - **Surplus Log Routine (`/admin/surplus`):** 9:00 PM batch entry (`DISCOUNTED_CLEARANCE`, `STAFF_MEAL`, `WASTE_DISCARDED`).
  - **Reconciliation Engine (`/admin/reconcile`):** Shift-close cash count audit. Computes real variance. Displays `CASH COUNT MISSING` if unsubmitted.
  - **Audit Log (`/admin/audit`):** Read-only table of all system mutations and voids.
* **Backend API & Data Flow:**
  - Full Fastify `/api/v1/admin/*` routes strictly guarded by `MANAGER_ADMIN` role session.

---

### Surface 7: Automated Nightly Audit Digest & Shift-Close Engine

* **Trigger:** In-process `node-cron` firing daily at **21:30 EAT** (`Africa/Kampala`).
* **Target Recipient:** Zito Mbowe's mobile handset and email address.

```text
[ Africa's Talking SMS — Sent 21:30 EAT ]
FOODIZO+OBUNUZI 28/10: Gross UGX 2,744,000.
Cash variance UGX 0. 2 flags.
Full: https://admin.foodizo.ug/d/7f3c2a
```

* **Engine Specifications:**
  - **SMS Summary:** Under 160 GSM characters (2 segments max). Consolidates gross collections, cash drawer variance, and exception flags.
  - **Full Email Statement:** Detailed financial settlement, outlet split, delivery contribution memo, BOM usage, surplus resolution, and exception logs.
  - **Cryptographic Signed URL:** 7-day signed link granting direct read-only access to the full audit report without credentials.
  - **Idempotency Guard:** `daily_digests` table ensures zero duplicate SMS charges on retry.

---

## 3. Step-by-Step Build Sequence & Verification Checklist

To execute this build cleanly, implement each surface in sequential order, verifying the exit gate before advancing:

| Step | Surface / Dashboard | Route | Primary Technology | Exit Verification Gate |
| :---: | :--- | :--- | :--- | :--- |
| **1** | **Staff Auth & Gateway** | `/login` | Fastify Cookie + Bcrypt + Prisma | Login locks after 5 failed attempts; sets HttpOnly cookie; redirects correctly by role. |
| **2** | **Customer Pre-Order PWA** | `/`, `/cart`, `/checkout`, `/token/[token]` | Next.js 14 App Router + Tailwind | Generates unique daily tokens (`TOKEN-042`); checkout validates delivery zone & room note. |
| **3** | **Waitress FOH POS** | `/pos/tables`, `/pos`, `/pos/phone-entry` | Handheld Next.js client + WebSocket | Table occupancy grid updates; dine-in postpay tabs fire directly to KDS as `PENDING`. |
| **4** | **Kitchen KDS Dashboards** | `/kds/steam`, `/kds/fryer`, `/kds/expo` | Wall-mount Next.js client + Redis Pub/Sub | 68px bump button advances ticket; BOM decrements; Expo printer fires chit over LAN port 9100. |
| **5** | **FOH Delivery Dispatch** | `/pos/dispatch` | FOH Next.js client + ESC/POS service | Captures rider name & cash transport advance; records completed delivery outcome. |
| **6** | **Manager Admin Portal** | `/admin/*` | Obsidian theme Next.js client + Prisma | Cash count reconciles actual vs expected cash; surplus log saves closing batch data. |
| **7** | **Audit Digest Cron** | Node-cron (`30 21 * * *`) | Africa's Talking SMS + Nodemailer | Digest fires at 21:30 EAT Kampala time; sends 2-segment SMS; skips duplicate executions. |



---

## 4. Dashboard Surface Technical Interface Contracts & Touch Ergonomics

### 4.1 Strict Touch Ergonomics Matrix across Dashboard Surfaces

| Surface | Critical Control Element | Minimum Touch Target | Geometry & Physics | Ergonomic Rationale |
| :--- | :--- | :---: | :---: | :--- |
| **Surface 1: Staff Login** | Numeric PIN Keypad Buttons | **64px × 64px** | 6px radius, tactile click sound | High-speed PIN entry during shift changes without mis-taps |
| **Surface 2: Customer PWA** | "Add to Cart" & "Pay Now" Pill | **48px height** | Full container width pill (`9999px`) | Thumb-zone reachability on modern mobile devices (375–430px) |
| **Surface 3: Waiter Floor POS**| Menu Item Tiles & Table Cells | **56px × 56px** | Crisp 6px radius, 2px ink shadow offset | One-handed operation while carrying dining trays or beverage glasses |
| **Surface 4: Kitchen KDS HUD** | "BUMP TICKET" Action Button | **68px height** | Full ticket width (100%), zero radius, 5px bottom bevel | Large target designed for gloved, wet, or oily fingertips reaching across a stainless steel pass |
| **Surface 5: FOH Dispatch** | CALL, WHATSAPP, PRINT CHIT | **56px height** | Crisp 6px radius, cobalt styling | Immediate action buttons when handing orders to boda boda riders |
| **Surface 6: Manager Admin** | Reconcile & Void Order Triggers | **44px height** | 2px precision radius, Champagne brass styling | Intentional, deliberate action requiring two-factor PIN verification |

---

### 4.2 TypeScript Component Prop & Wire Contracts

#### Surface 2: Customer Checkout & Token Contract
```typescript
export interface DeliveryCheckoutFormProps {
  outlet: 'FOODIZO_HAM_TOWERS' | 'OBUNUZI_YMCA';
  cartSubtotalUgx: number;
  availableZones: Array<{
    id: string;
    zoneCode: string;
    displayName: string;
    feeUgx: number;
    etaRange: string;
  }>;
  onSubmitOrder: (payload: {
    channel: 'TAKEAWAY_PICKUP' | 'PHONE_DELIVERY';
    customerName: string;
    customerPhone: string; // Normalised E.164 (+2567...)
    deliveryZoneId?: string;
    deliveryNote?: string; // 3–160 chars
    gpsPin?: { lat: number; lng: number; accuracy: number };
  }) => Promise<{ orderId: string; publicRef: string; digitalToken: string }>;
}
```

#### Surface 3: Waiter POS Table Tab Contract
```typescript
export interface TableOccupancyGridProps {
  outlet: 'FOODIZO_HAM_TOWERS' | 'OBUNUZI_YMCA';
  tables: Array<{
    id: string;
    label: string; // "T1", "T2", "PATIO-4"
    status: 'VACANT' | 'OCCUPIED' | 'BILL_REQUESTED' | 'NEEDS_CLEARING';
    currentWaiterId?: string;
    activeTabOrderId?: string;
    occupiedMinutes: number;
  }>;
  onSelectTable: (tableId: string) => void;
  onFireDineInTab: (tableId: string, items: Array<{ menuItemId: string; quantity: number; notes?: string }>) => Promise<void>;
  onSettleTab: (orderId: string, carrier: 'CASH' | 'MTN' | 'AIRTEL' | 'MANUAL_MOMO', amountUgx: number) => Promise<void>;
}
```

#### Surface 4: KDS Station Ticket & Bump Contract
```typescript
export interface KdsStationTicketProps {
  station: 'STEAM_LINE' | 'GRILL_FRYER' | 'ROLEX_GRIDDLE' | 'BAR_BEVERAGE';
  ticket: {
    orderId: string;
    digitalToken: string; // e.g. "TOKEN-088"
    channel: 'DINE_IN' | 'TAKEAWAY_PICKUP' | 'PHONE_DELIVERY';
    status: 'PENDING' | 'PREPARING' | 'READY';
    elapsedMinutes: number;
    destinationZone?: string; // Delivery orders only; NO customer phone or room note
    items: Array<{
      orderItemId: string;
      name: string;
      quantity: number;
      specialNotes?: string;
      isBumped: boolean;
    }>;
  };
  onBumpTicket: (orderId: string, nextStatus: 'PREPARING' | 'READY') => Promise<void>;
}
```

#### Surface 5: FOH Dispatch Queue Contract
```typescript
export interface FohDispatchItemProps {
  order: {
    id: string;
    digitalToken: string;
    customerName: string;
    customerPhone: string; // Formatted E.164 for tel: link
    destinationZone: string;
    deliveryNote: string;
    gpsCoords?: { lat: number; lng: number };
    readyAt: string;
  };
  onDispatchRider: (orderId: string, payload: {
    riderName: string;
    riderPhone?: string;
    dispatchMethod: 'CALL' | 'WHATSAPP' | 'COUNTER_HANDOFF';
    riderAdvanceUgx: number;
  }) => Promise<void>;
  onCompleteDelivery: (orderId: string, returnedAdvanceUgx: number) => Promise<void>;
  onMarkUnreachable: (orderId: string, notes: string) => Promise<void>;
  onReprintChit: (orderId: string) => Promise<void>;
}
```

---

### 4.3 Automated End-to-End User Journey Test Spec (`tests/e2e/surface-journey.spec.ts`)

```typescript
import { test, expect } from '@playwright/test';

test.describe('End-to-End Multi-Dashboard Service Cycle', () => {
  test('Complete pre-order loop: Customer PWA -> KDS -> Dispatch -> Reconcile', async ({ page }) => {
    // 1. Customer places delivery pre-order
    await page.goto('/');
    await page.click('text=Rolex (2 Eggs)');
    await page.click('text=Proceed to Checkout');
    await page.selectOption('select[name="deliveryZoneId"]', { label: 'YMCA MAIN CAMPUS (UGX 2,000)' });
    await page.fill('input[name="deliveryNote"]', 'Block C, Room 204');
    await page.fill('input[name="customerPhone"]', '0772123456');
    await page.click('button:has-text("Pay with MTN MoMo")');

    // Verify token issued
    await expect(page.locator('[data-testid="digital-token"]')).toContainText('TOKEN-');

    // 2. Kitchen KDS verifies ticket arrival
    await page.goto('/kds/rolex');
    await expect(page.locator('.ticket-card')).toContainText('Rolex (2 Eggs)');
    await expect(page.locator('.ticket-card')).toContainText('YMCA MAIN CAMPUS');
    // Privacy boundary assertion: Phone and room note MUST NOT appear on KDS
    await expect(page.locator('.ticket-card')).not.toContainText('0772123456');
    await expect(page.locator('.ticket-card')).not.toContainText('Block C, Room 204');

    // Cook bumps ticket to READY
    await page.click('.btn-kds-bump');

    // 3. FOH Dispatch Queue verifies delivery packet
    await page.goto('/pos/dispatch');
    await expect(page.locator('.dispatch-card')).toContainText('Block C, Room 204');
    await expect(page.locator('.dispatch-card a[href^="tel:"]')).toBeVisible();

    // 4. Admin Portal verifies shift reconciliation
    await page.goto('/admin/reconcile');
    await expect(page.locator('[data-testid="expected-revenue"]')).toBeVisible();
  });
});
```
