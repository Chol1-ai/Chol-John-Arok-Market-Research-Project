# User Profiles & Operational Personas

**Reference:** PRD Section 2 (User Roles & Permissions Matrix)<br>
**Related Files:** `Foundational_Concept.md` (roles matrix) Â· `Design_System.md` (role styling) Â· `User_Flow.md` (lifecycle state machine) Â· `Delivery_Zones_and_Dispatch.md` (zone, pin & dispatch model) Â· `Tech_Stack.md` (DDL & RBAC) Â· `Payment_Integration.md` (MoMo payment flows by persona) Â· `Hardware_and_Peripherals.md` (printers & SMS) Â· `Seed_Data_and_Testing.md` (fixtures & test checklist) Â· `Repo_Scaffold_and_Config.md` (scaffold & env) Â· `Demo_Script_and_Closing_Strategy.md` (live demo) Â· `Daily_Audit_Digest.md` (owner reporting) Â· `Deployment_Runbook.md` (edge/offline operation) Â· `Service_Contract_and_Invoice_Template.md` (commercials) Â · `build_strategy/Build_Strategy_and_Phases.md` (delivery gates)

---

## 1. Customer Persona: The Campus Pre-Orderer

- **Archetype:** **Brian K.** â€” Makerere Final-Year Student / Ham Towers Commuter
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
| Token Access | Access Digital Pickup Token and receive live order progress alerts |
| Notification Opt-In | Receive SMS pickup alerts and live in-page status updates; no browser push in Phase 1 |

### Pain Points

- Counter congestion during **1:00 PM â€“ 2:30 PM** peak hours.
- Arriving at the counter to find a menu item is already sold out.
- USSD STK push not arriving due to MTN/Airtel network congestion â€” resolved by the 45-second fallback in `Payment_Integration.md Â§4`.
- Delivery confusion: a free-text address such as â€œnear YMCAâ€ or â€œMakerereâ€ does not tell the rider which block, room, or gate to use. The zone + note model fixes this without asking the student to drop a map pin.

### Success Scenario

```
Orders from class  â†’  approves MoMo STK push  â†’  receives TOKEN-042
â†’  arrives at Ham Towers  â†’  picks up packaged food without queueing
â†’  eats on time before next lecture.
```

---

## 2. Front-of-House Persona: The Floor Operator

- **Archetype:** **Prossy N.** â€” Senior Waitress & Floor Lead at Obunuzi
- **Role Category:** `WAITER_FOH`
- **Device:** 6.5" Android Handheld Terminal / Tablet

> *"I manage 8 tables at once while people call for deliveries. If the kitchen misses a modification, the customer blames me."*

### Permissions & Access

| Permission | Description |
| :--- | :--- |
| Table Occupancy Grid | View and update the live Visual Table Occupancy Grid |
| Order Management | Create and modify table orders; send tickets to KDS |
| Delivery Capture | On phone orders, select the outlet-scoped zone, enter the room/office/gate note, recipient name, and rider-callable phone |
| Dispatch Queue | Open `/pos/dispatch`, verify the chit, call/WhatsApp the customer, and record the rider handoff plus any cash transport advance |
| Payment Handling | Collect cash, request customer MoMo STK prompts at tables, and issue USSD merchant codes when signal is poor |
| Manual Verification | Tap **"Verify MoMo Transaction"** and enter the full telco transaction ID (or the receipt's last six characters), amount, and payer phone; four digits alone are not accepted (see `Payment_Integration.md Â§8`) |
| Bill Management | Close one table tab with a single settlement transaction; split checks and table transfers are Phase 2 |

### Pain Points

- Losing track of multiple table statuses during busy lunch hours.
- Hand-written paper slips getting oily or misplaced on the kitchen pass.
- Vague delivery notes (â€œnear YMCAâ€, â€œMakerereâ€) forcing repeated rider calls while the food cools.
- Not knowing which rider took which bag when two deliveries leave at the same time; the dispatch queue and handoff log fix this.

### Success Scenario

```
Enters table order on handheld  â†’  checks live table occupancy grid
â†’  sends to KDS  â†’  bills customers accurately with zero dropped items.
```

---

## 3. Kitchen Operator Persona: The Multi-Station Cook

- **Archetype:** **Chef Juma** â€” Fryer & Griddle Operator at Foodizo
- **Role Category:** `KITCHEN_STAFF`
- **Device:** 15" Wall-Mounted Industrial Touchscreen Monitor

> *"My hands are wet and oily. I need large buttons, clear order types, and loud alerts so I don't confuse takeaway orders with dine-in."*

### Permissions & Access

| Permission | Description |
| :--- | :--- |
| Station Queue View | View tickets filtered to their assigned station (Fryer, Grill, Rolex, Steam) |
| Channel Filter | Toggle queue to isolate `DINE_IN`, `TAKEAWAY_PICKUP`, or `PHONE_DELIVERY` |
| Ticket Lifecycle | Bump tickets through stages: `PENDING` â†’ `PREPARING` â†’ `READY` |
| Delivery Privacy | See the destination zone for bag labelling, but never the customer phone, room note, or GPS coordinates |
| 86 Alerts | Receive auto-86 out-of-stock alerts from the inventory engine |

### Pain Points

- Verbal order calls shouted over kitchen noise causing errors.
- Plating takeaway orders on ceramic dine-in plates by mistake.

### Success Scenario

```
Reads high-contrast KDS ticket  â†’  taps PREPARING  â†’  cooks food
â†’  taps READY  â†’  expediter bags it with the correct digital token printed on label.
```

---

## 4. Administrative Persona: The Operations Coordinator

- **Archetype:** **Zito Mbowe** â€” Operations Lead, MRFSS Project
- **Role Category:** `MANAGER_ADMIN`
- **Device:** Laptop Dashboard (Chrome) + Smartphone for critical alerts

> *"I manage margins and operations across Ham Towers and YMCA. If we cook too much Luwombo or leak oil, we lose our profit margins."*

### Permissions & Access

| Permission | Description |
| :--- | :--- |
| Cross-Outlet Oversight | Full real-time view of multi-channel ticket queues at both outlets |
| Inventory Monitoring | Real-time stock levels, threshold management, and BOM audit |
| Delivery Zones | Maintain outlet-scoped zones, delivery fees, ETAs, and active/inactive Phase 2 areas |
| Dispatch Audit | Review rider handoffs, failed/unreachable deliveries, and chit reprints |
| User Management | RBAC user account creation, role assignments, and deactivation |
| Menu & Pricing | Update menu item names, prices, and availability |
| Surplus & Waste Logs | Review and export end-of-day surplus logs and next-day prep-review data |
| Payment Reconciliation | Review the auto-generated daily financial report (MTN, Airtel, Manual MoMo, Cash; delivery fees as a memo line) at 9:30 PM and receive the 21:30 SMS/email digest â€” see `Payment_Integration.md Â§9` and `Daily_Audit_Digest.md` |
| Exception & Refund Control | Approve voids/cancellations with phone + PIN; close a `REFUND_PENDING` payment as `REFUNDED` after completing the external reversal and recording the reference (see `Payment_Integration.md Â§8.3`) |

### Pain Points

- Inventory loss and suspected theft of high-turnover items (cooking oil, poultry).
- Unsold cooked batches discarded at closing time with no tracking or learning loop.

### Success Scenario

```
Receives low-oil alert on phone  â†’  logs into Manager Portal
â†’  reviews end-of-day surplus logs  â†’  adjusts next-day batch prep targets
â†’  reviews daily payment reconciliation and the 21:30 digest (sample gross UGX 2,744,000; variance computed from the cash count)
â†’  sees a computed inventory variance only when opening and closing counts exist; otherwise the screen says â€œcount not submitted.â€
```

---

## 5. Delivery Rider (Phase 1 Non-System Actor)

- **Archetype:** **Freelance boda rider / dispatch runner** â€” picked from the Wandegeya stage for a lunch run
- **Role Category:** None in Phase 1 â€” **not** a fifth RBAC role and **not** a system login
- **Device:** The riderâ€™s own Android phone, plus the printed delivery chit

> *"I don't need another app. Tell me the hall, the room, and a phone number that answers, and I will deliver it."*

### Access & Interaction

| Interaction | Description |
| :--- | :--- |
| Printed Chit | Receives token, destination zone, room/office note, customer phone, and gate instructions |
| Phone Call | Dials the customer directly from the chit or the FOH dispatch screen |
| WhatsApp | Optional; FOH can open a `wa.me` chat with the customer |
| Handoff Log | FOH records the riderâ€™s name and phone; the rider does not log in |
| No Live Tracking | No rider app, no background location, no map marker in Phase 1 |

### Pain Points

- Being sent to â€œMakerereâ€ or â€œYMCAâ€ with no block, room, or gate instruction.
- Calling a customer who does not answer while the food cools.
- Being blamed for a late delivery when the kitchen only released the bag after the rider arrived.

### Success Scenario

```
Rider receives bag + chit  â†’  reads YMCA MAIN CAMPUS, BLOCK C, ROOM 204
â†’  calls the customer from the chit  â†’  delivers to the security gate
â†’  FOH marks COMPLETED and records the handoff.
```

> **Phase 2 trigger:** A dedicated rider app and live location sharing are considered only when the operation has 5+ full-time contracted riders and >100 deliveries/day outside the immediate campus radius. See `Delivery_Zones_and_Dispatch.md Â§11`.

---


## 6. Persona Summary Matrix

| Persona | Role Enum | Primary Device | Peak Usage Window | Session / Auth Timeout |
| :--- | :--- | :--- | :--- | :--- |
| Brian K. | `CUSTOMER` | Android Mobile (PWA) | 12:30 PM - 2:30 PM | Cart: 30 min idle; no account login in Phase 1 |
| Prossy N. | `WAITER_FOH` | 6.5in Android Handheld | 12:00 PM - 9:30 PM | 8-hour shift session; re-PIN after 30 min idle |
| Chef Juma | `KITCHEN_STAFF` | 15in Wall-Mount Touchscreen | 11:30 AM - 9:00 PM | Never auto-logout on KDS; PIN re-auth after >4 hours inactivity |
| Zito Mbowe | `MANAGER_ADMIN` | Laptop + Smartphone | 8:00 AM - 10:00 PM | 8-hour session; re-PIN always required for void/cancel |
| Delivery Rider | -- (non-system actor) | Own Android phone + printed chit | 12:00 PM - 9:00 PM | No login; not a system user |
