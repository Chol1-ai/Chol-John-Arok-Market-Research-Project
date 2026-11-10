# User Profiles & Operational Personas

**Reference:** PRD Section 2 (User Roles & Permissions Matrix)<br>
**Related Files:** `Foundational_Concept.md` (roles matrix) · `Design_System.md` (role styling) · `User_Flow.md` (lifecycle state machine) · `Delivery_Zones_and_Dispatch.md` (zone, pin & dispatch model) · `Tech_Stack.md` (DDL & RBAC) · `Payment_Integration.md` (MoMo payment flows by persona) · `Hardware_and_Peripherals.md` (printers & SMS) · `Seed_Data_and_Testing.md` (fixtures & test checklist) · `Repo_Scaffold_and_Config.md` (scaffold & env) · `Demo_Script_and_Closing_Strategy.md` (live demo) · `Daily_Audit_Digest.md` (owner reporting) · `Deployment_Runbook.md` (edge/offline operation) · `Service_Contract_and_Invoice_Template.md` (commercials) · `build_strategy/Build_Strategy_and_Phases.md` (delivery gates)

> **Implementation status:** The live, API-backed surfaces are `/login`, `/pos`, `/kds`, `/dispatch`, and `/admin`. Customer pages under `/prototype/*` (landing, menu, checkout, token, tracker) are static design prototypes and do not call the live API. The customer persona below describes the intended product flow; today the customer order is keyed by staff on the POS, and staff confirm its status. SMS is `MOCK` outside production unless Africa's Talking credentials are configured, and there is no email transport.

---

## 1. Customer Persona: The Campus Pre-Orderer

- **Archetype:** **Brian K.** — Makerere Final-Year Student / Ham Towers Commuter
- **Role Category:** `CUSTOMER`
- **Device:** Android Smartphone (Tecno Camon / Infinix), Mobile Web Browser

> *"I have exactly 20 minutes between lectures at Makerere. If I have to stand in a long line at Foodizo, I will be late or go hungry."*

### Permissions & Access

| Permission | Description |
| :--- | :--- |
| Menu Browsing | Browse active menus, prices, and stock availability |
| Order Placement | Initiate pre-orders and pay via MTN MoMo (`25677/78/76`) or Airtel Money (`25670/75/74`) |
| Delivery Details | Select an outlet-scoped zone/landmark, enter an exact room/office/gate note, recipient name, and rider-callable phone |
| Optional GPS Pin | Tap once to attach a one-shot location pin; decline without losing the order |
| MoMo Checkout | Approve USSD STK push on handset within the 45-second countdown window |
| USSD Fallback | Use merchant dial codes (`*165*3*242424#` / `*185*9*121212#`) if the STK push fails |
| Token Access | Receive the digital token on the printed chit and in the pickup SMS; **Phase 1 has no live customer status page** — `/prototype/token` is a static design prototype, and staff confirm readiness at the counter |
| Notification Opt-In | Receive an SMS pickup alert when Africa's Talking is configured in production; development runs report `MOCK`. No browser push and no live in-page status feed in Phase 1 |

### Pain Points

- Counter congestion during **1:00 PM – 2:30 PM** peak hours.
- Arriving at the counter to find a menu item is already sold out.
- USSD STK push not arriving due to MTN/Airtel network congestion — resolved by the 45-second fallback in `Payment_Integration.md §4`.
- Delivery confusion: a free-text address such as “near YMCA” or “Makerere” does not tell the rider which block, room, or gate to use. The zone + note model fixes this without asking the student to drop a map pin.

### Success Scenario

```
Orders from class  →  approves MoMo STK push  →  receives TOKEN-042
→  arrives at Ham Towers  →  picks up packaged food without queueing
→  eats on time before next lecture.
```

---

## 2. Front-of-House Persona: The Floor Operator

- **Archetype:** **Prossy N.** — Senior Waitress & Floor Lead at Obunuzi
- **Role Category:** `WAITER_FOH`
- **Device:** 6.5" Android Handheld Terminal / Tablet

> *"I manage a 16-table floor while people call for deliveries. If the kitchen misses a modification, the customer blames me."*

### Permissions & Access

| Permission | Description |
| :--- | :--- |
| Table Occupancy Grid | View and update the live Visual Table Occupancy Grid |
| Order Management | Create and modify table orders; send tickets to KDS |
| Delivery Capture | On phone orders, select the outlet-scoped zone, enter the room/office/gate note, recipient name, and rider-callable phone |
| Dispatch Queue | Open `/dispatch`, confirm the customer details and chit state, call the customer from the card, assign the boda rider, and record the handoff outcome plus any cash transport advance |
| Payment Handling | Collect cash, trigger an MTN/Airtel STK prompt from the settle dialog, or record a verified manual MoMo reference when the customer has already paid |
| Manual Verification | Choose `MANUAL_MOMO` at settlement and enter the full provider transaction reference (at least 3 characters); four digits alone are not accepted (see `Payment_Integration.md §8`) |
| Bill Management | Close one table tab with a single settlement transaction (`POST /api/v1/orders/:id/settle`); split checks and table transfers are Phase 2. Cancellation is manager-only |

### Pain Points

- Losing track of multiple table statuses during busy lunch hours.
- Hand-written paper slips getting oily or misplaced on the kitchen pass.
- Vague delivery notes (“near YMCA”, “Makerere”) forcing repeated rider calls while the food cools.
- Not knowing which rider took which bag when two deliveries leave at the same time; the dispatch queue and handoff log fix this.
- Failed or refused handoffs need manager review; the order stays `READY` instead of silently completing.

### Success Scenario

```
Enters table order on handheld  →  checks live table occupancy grid
→  sends to KDS  →  bills customers accurately with zero dropped items.
```

---

## 3. Kitchen Operator Persona: The Multi-Station Cook

- **Archetype:** **Chef Juma** — Fryer & Griddle Operator at Foodizo
- **Role Category:** `KITCHEN_STAFF`
- **Device:** 15" Wall-Mounted Industrial Touchscreen Monitor

> *"My hands are wet and oily. I need large buttons, clear order types, and loud alerts so I don't confuse takeaway orders with dine-in."*

### Permissions & Access

| Permission | Description |
| :--- | :--- |
| Station Queue View | View tickets filtered to their assigned station (Fryer, Grill, Rolex, Steam) |
| Channel Filter | Toggle queue to isolate `DINE_IN`, `TAKEAWAY_PICKUP`, or `PHONE_DELIVERY` |
| Ticket Lifecycle | Bump tickets through stages: `PENDING` → `PREPARING` → `READY` |
| Delivery Privacy | See the destination zone for bag labelling, but never the customer phone, room note, or GPS coordinates |
| 86 Alerts | Receive auto-86 out-of-stock alerts from the inventory engine |

### Pain Points

- Verbal order calls shouted over kitchen noise causing errors.
- Plating takeaway orders on ceramic dine-in plates by mistake.

### Success Scenario

```
Reads high-contrast KDS ticket  →  taps PREPARING  →  cooks food
→  taps READY  →  expediter bags it with the correct digital token printed on label.
```

---

## 4. Administrative Persona: The Operations Coordinator

- **Archetype:** **Zito Mbowe** — Obunuzi Restaurant & Cafe Manager
- **Role Category:** `MANAGER_ADMIN`
- **Device:** Laptop Dashboard (Chrome) + Smartphone for critical alerts

> *"I manage margins and operations across Ham Towers and YMCA. If we cook too much Luwombo or leak oil, we lose our profit margins."*

### Permissions & Access

| Permission | Description |
| :--- | :--- |
| Cross-Outlet Oversight | Full real-time view of orders, tables, dispatch, staff, and digest data for an unscoped manager account such as Zito; an outlet-scoped manager sees only their assigned outlet |
| Stock & 86 Control | Mark menu items 86/unavailable; the KDS claim deducts recipe-BOM quantities and the digest flags items at or below their alert threshold. Phase 1 has no inventory-management UI, stock-count screen, or automatic low-stock SMS |
| Delivery Zones | Outlet-scoped zones, fees, and ETAs are seeded configuration enforced when a delivery order is created; there is no zone-editing UI or API in Phase 1 |
| Dispatch Audit | Review rider handoffs and failed deliveries on `/dispatch`; reprint a chit from the POS after a printer failure |
| Staff Roster | View the active staff roster on `/admin`; seeded accounts are managed in `backend/prisma/seed.ts`, and there is no user CRUD UI in Phase 1 |
| Menu Availability | Toggle an item's 86/unavailable state; item names and prices are seeded configuration, not editable from `/admin` |
| Surplus & Waste Logs | Record and review end-of-day surplus as clearance, staff meal, or waste, with the next-day prep-review data |
| Payment Reconciliation | Review the computed daily report on `/admin` (MTN, Airtel, manual MoMo, cash; delivery fees as a memo line). The scheduled/on-demand digest is sent by SMS when Africa's Talking is configured; email is not implemented (`emailStatus: NOT_CONFIGURED`) — see `Payment_Integration.md §9` and `Daily_Audit_Digest.md` |
| Exception & Refund Control | Cancel an order with a required reason of at least 3 characters (manager session only; no phone/PIN second factor). `REFUND_PENDING` payments appear on `/admin`; close one with `POST /api/v1/payments/:id/refund` after completing the external reversal and recording the reference (see `Payment_Integration.md §8.3`) |

### Pain Points

- Inventory loss and suspected theft of high-turnover items (cooking oil, poultry).
- Unsold cooked batches discarded at closing time with no tracking or learning loop.

### Success Scenario

```
Receives a low-oil operational alert (manual observation in Phase 1)
→  logs into the manager dashboard
→  reviews end-of-day surplus logs  →  adjusts next-day batch prep targets
→  reviews daily payment reconciliation and the 21:30 EAT scheduled digest
   (sample gross UGX 2,744,000; variance computed from the cash count)
→  sees a computed inventory variance only when opening and closing counts exist;
   Phase 1 does not ship an inventory-count screen, so the digest reports no
   inventory figure rather than inventing one.
```

---

## 5. Delivery Rider (Phase 1 Non-System Actor)

- **Archetype:** **Freelance boda rider / dispatch runner** — picked from the Wandegeya stage for a lunch run
- **Role Category:** None in Phase 1 — **not** a fifth RBAC role and **not** a system login
- **Device:** The rider’s own Android phone, plus the printed delivery chit

> *"I don't need another app. Tell me the hall, the room, and a phone number that answers, and I will deliver it."*

### Access & Interaction

| Interaction | Description |
| :--- | :--- |
| Printed Chit | Receives token, destination zone, room/office note, customer phone, and gate instructions |
| Phone Call | Dials the customer directly from the chit or the FOH dispatch screen |
| WhatsApp | Optional; FOH can open a `wa.me` chat with the customer |
| Handoff Log | FOH records the rider’s name and phone; the rider does not log in |
| No Live Tracking | No rider app, no background location, no map marker in Phase 1 |

### Pain Points

- Being sent to “Makerere” or “YMCA” with no block, room, or gate instruction.
- Calling a customer who does not answer while the food cools.
- Being blamed for a late delivery when the kitchen only released the bag after the rider arrived.

### Success Scenario

```
Rider receives bag + chit  →  reads YMCA MAIN CAMPUS, BLOCK C, ROOM 204
→  calls the customer from the chit  →  delivers to the security gate
→  FOH marks COMPLETED and records the handoff.
```

> **Phase 2 trigger:** A dedicated rider app and live location sharing are considered only when the operation has 5+ full-time contracted riders and >100 deliveries/day outside the immediate campus radius. See `Delivery_Zones_and_Dispatch.md §11`.

---


## 6. Persona Summary Matrix

| Persona | Role Enum | Primary Device | Peak Usage Window | Session / Auth Timeout |
| :--- | :--- | :--- | :--- | :--- |
| Brian K. | `CUSTOMER` | Android Mobile (PWA prototype) | 12:30 PM - 2:30 PM | No customer login in Phase 1; `/prototype/*` screens are static |
| Prossy N. | `WAITER_FOH` | 6.5in Android Handheld | 12:00 PM - 9:30 PM | JWT session expires after 12 hours; logout revokes the row in `user_sessions`; no idle auto-logout |
| Chef Juma | `KITCHEN_STAFF` | 15in Wall-Mount Touchscreen | 11:30 AM - 9:00 PM | JWT session expires after 12 hours; logout revokes the row in `user_sessions`; no idle auto-logout |
| Zito Mbowe | `MANAGER_ADMIN` | Laptop + Smartphone | 8:00 AM - 10:00 PM | JWT session expires after 12 hours; cancellation needs only the manager session plus a reason |
| Delivery Rider | -- (non-system actor) | Own Android phone + printed chit | 12:00 PM - 9:00 PM | No login; not a system user |
