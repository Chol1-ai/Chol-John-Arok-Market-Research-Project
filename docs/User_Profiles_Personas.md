# User Profiles & Operational Personas

**Reference:** PRD Section 2 (User Roles & Permissions Matrix)  
**Related Files:** `Foundational_Concept.md` (roles matrix) · `Payment_Integration.md` (MoMo payment flows by persona)

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
| MoMo Checkout | Approve USSD STK push on handset within the 45-second countdown window |
| USSD Fallback | Use merchant dial codes (`*165*3*242424#` / `*185*9*121212#`) if the STK push fails |
| Token Access | Access Digital Pickup Token and receive live order progress alerts |
| Notification Opt-In | Receive SMS and PWA push notifications for order status changes |

### Pain Points

- Counter congestion during **1:00 PM – 2:30 PM** peak hours.
- Arriving at the counter to find a menu item is already sold out.
- USSD STK push not arriving due to MTN/Airtel network congestion — resolved by the 45-second fallback in `Payment_Integration.md §4`.

### Success Scenario

```
Orders from class  →  approves MoMo STK push  →  receives TOKEN #042
→  arrives at Ham Towers  →  picks up packaged food without queueing
→  eats on time before next lecture.
```

---

## 2. Front-of-House Persona: The Floor Operator

- **Archetype:** **Prossy N.** — Senior Waitress & Floor Lead at Obunuzi
- **Role Category:** `WAITER / FRONT_OF_HOUSE`
- **Device:** 6.5" Android Handheld Terminal / Tablet

> *"I manage 8 tables at once while people call for deliveries. If the kitchen misses a modification, the customer blames me."*

### Permissions & Access

| Permission | Description |
| :--- | :--- |
| Table Occupancy Grid | View and update the live Visual Table Occupancy Grid |
| Order Management | Create, modify, and split table orders; send tickets to KDS |
| Payment Handling | Collect cash, request customer MoMo STK prompts at tables, and issue USSD merchant codes when signal is poor |
| Manual Verification | Tap **"Verify MoMo Transaction"** using last 4 digits of telco SMS receipt (see `Payment_Integration.md §8`) |
| Bill Management | Issue split checks and initiate table transfers |

### Pain Points

- Losing track of multiple table statuses during busy lunch hours.
- Hand-written paper slips getting oily or misplaced on the kitchen pass.

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
| Channel Filter | Toggle queue to isolate `DINE_IN`, `TAKEAWAY`, or `PHONE_DELIVERY` |
| Ticket Lifecycle | Bump tickets through stages: `PENDING` → `PREPARING` → `READY` |
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

- **Archetype:** **Zito Mbowe** — Operations Lead, MRFSS Project
- **Role Category:** `MANAGER / ADMIN`
- **Device:** Laptop Dashboard (Chrome) + Smartphone for critical alerts

> *"I manage margins and operations across Ham Towers and YMCA. If we cook too much Luwombo or leak oil, we lose our profit margins."*

### Permissions & Access

| Permission | Description |
| :--- | :--- |
| Cross-Outlet Oversight | Full real-time view of multi-channel ticket queues at both outlets |
| Inventory Monitoring | Real-time stock levels, threshold management, and BOM audit |
| User Management | RBAC user account creation, role assignments, and deactivation |
| Menu & Pricing | Update menu item names, prices, and availability |
| Surplus & Waste Logs | Review and export end-of-day surplus logs and predictive prep data |
| Payment Reconciliation | Review auto-generated daily financial report (MTN, Airtel, Manual MoMo, Cash) at 9:30 PM — see `Payment_Integration.md §9` |

### Pain Points

- Inventory loss and suspected theft of high-turnover items (cooking oil, poultry).
- Unsold cooked batches discarded at closing time with no tracking or learning loop.

### Success Scenario

```
Receives low-oil alert on phone  →  logs into Manager Portal
→  reviews end-of-day surplus logs  →  adjusts next-day batch prep targets
→  reviews daily payment reconciliation (zero variance: UGX 2,744,000)
→  achieves < 2% food cost variance for the week.
```

---

## 5. Persona Summary Matrix

| Persona | Role Enum | Primary Device | Peak Usage Window |
| :--- | :--- | :--- | :--- |
| Brian K. | `CUSTOMER` | Android Mobile (PWA) | 12:30 PM – 2:30 PM |
| Prossy N. | `WAITER_FOH` | 6.5" Android Handheld | 12:00 PM – 9:30 PM |
| Chef Juma | `KITCHEN_STAFF` | 15" Wall-Mount Touchscreen | 11:30 AM – 9:00 PM |
| Zito Mbowe | `MANAGER_ADMIN` | Laptop + Smartphone | 8:00 AM – 10:00 PM |
