# Design System & UI/UX Specifications

**Theme Archetype:** Industrial Kitchen Tactile & Sunlight-Optimized Contrast  
**Anti-Slop Directive:** No generic SaaS styling. Every component is optimized for high-glare environments, greasy fingers, small screens, and noisy kitchens.  
**Related Files:** `Foundational_Concept.md` · `User_Flow.md` · `Payment_Integration.md` (payment UI states)

---

## 1. Visual Tokens & Semantic Palette

### Surfaces & Backgrounds

| Token | Hex | Usage |
| :--- | :--- | :--- |
| KDS Dark Background | `#0A0F1D` | Anti-reflective, eye-strain relief for kitchen screens |
| KDS Card Surface | `#1E293B` | Elevated slate for ticket cards |
| FOH / Customer Background | `#F8FAFC` | Ultra-clean off-white for waiter & customer PWA |
| FOH / Customer Card | `#FFFFFF` | Solid white with 1.5px solid borders |

### Channel Segregation Badges (KDS Critical)

| Channel | Hex | Name |
| :--- | :--- | :--- |
| `DINE_IN` | `#2563EB` | High-visibility Cobalt Blue |
| `TAKEAWAY / PRE_ORDER` | `#D97706` | Industrial Amber Orange |
| `PHONE_DELIVERY` | `#7C3AED` | Deep Purple |

### Order Status Progression (PRD Standard)

| Status | Hex | Description |
| :--- | :--- | :--- |
| `PENDING` | `#64748B` | Muted Slate — Awaiting cook claim |
| `PREPARING` | `#D97706` | Active Amber — On griddle / in fryer |
| `READY` | `#059669` | Vibrant Emerald — Plated / Ready for pickup |
| `OVERDUE (> 10 mins)` | `#DC2626` | Flashing Industrial Red |

### Payment Status Colours (Checkout Flow — Customer PWA)

| Status | Hex | Description |
| :--- | :--- | :--- |
| `INITIATED` | `#64748B` | Muted Slate — Push dispatched, awaiting PIN |
| `PENDING_CUSTOMER_PIN` | `#D97706` | Pulsing Amber — 45-second countdown active |
| `SUCCESSFUL` | `#059669` | Vibrant Emerald — Token issued, order fired to KDS |
| `FAILED / TIMED_OUT` | `#DC2626` | Industrial Red — Show USSD fallback UI |
| `VERIFIED_MANUAL_MOMO` | `#7C3AED` | Deep Purple — Cashier-verified counter payment |

---

## 2. Typography Rules

| Element | Spec |
| :--- | :--- |
| **Data & Tokens font** | `JetBrains Mono`, `Consolas`, monospace — used for Token IDs, Timers, Quantities, UGX Currency |
| **Interface & Labels font** | `Inter`, `system-ui`, sans-serif — bold, legible at a distance |
| Token Display (Customer PWA) | 48px / Bold / Monospace (`#0A0F1D`) |
| KDS Ticket Header | 22px / Bold / Monospace |
| Menu Item Name | 18px / Semi-Bold (`#0F172A`) |
| Modifier Tag (e.g., Extra Soup) | 14px / Bold / Yellow-on-Black Badge (`#FDE047` on `#000000`) |
| Table Number Indicator | 24px / Extra-Bold |

---

## 3. Dedicated Component Specifications

### 3.1 Digital Token Display (Customer Queue Bypass Card)

Designed for clear, cross-counter visibility from 2 meters away:

```
+------------------------------------------+
|       FOODIZO - HAM TOWERS               |
|  Status: PREPARING  (ETA: 4 mins)        |
+------------------------------------------+
|                                          |
|            TOKEN #042                    |  ← 48px Monospace Bold
|                                          |
+------------------------------------------+
|  Show this screen at the Express Counter |
|  Items: 2x Rolex, 1x Mirinda Apple       |
+------------------------------------------+
```

**Behaviour:**
- Token number displayed in `48px` bold monospace, centred.
- Status badge (`PREPARING` / `READY`) updates live via WebSocket.
- When status reaches `READY`, the card border pulses green (`#059669`) with a vibration alert.

### 3.2 Visual Table Occupancy Grid (Waiter / FOH Screen)

A responsive tile grid representing the restaurant floor:

| Border / Fill Style | Status | Action on Tap |
| :--- | :--- | :--- |
| Green border | `VACANT` | Opens a new tab and assigns seats |
| Blue filled | `OCCUPIED` | Shows elapsed time, order total (UGX), active status |
| Amber flashing | `BILL_REQUESTED` | Indicates the table requested settlement |
| Gray stippled | `NEEDS_CLEARING` | Alerts busser/waiter to clean table |

**Layout Rules:**
- Grid is a minimum of 4 columns on tablet (>= 768px) and 2 columns on handheld (< 768px).
- Each tile shows: Table label, capacity, elapsed time since seating, and current order total in UGX.

### 3.3 KDS Channel Filter & Segregation Bar

Top header of every KDS screen contains sticky filter toggles:

```
[ ALL TICKETS (14) ]  [ DINE-IN (8) ]  [ TAKEAWAY (4) ]  [ DELIVERY (2) ]
```

- Filters are exclusive-toggle (selecting one deactivates others, except `ALL`).
- Counts update in real-time as orders arrive or advance states.
- Cooks can isolate their station queue with one tap during peak lunch/dinner delivery rushes.

### 3.4 Tactile Touch Boundaries

| Component | Minimum Size |
| :--- | :--- |
| KDS Bump Buttons | `64px` height, full card width |
| FOH Menu Selection Tiles | `56px × 56px` |
| Token Verification Button | `48px` height |
| KDS Filter Bar Buttons | `52px` height |
| Pay Now / Retry Push Button | `56px` height, full-width, high-contrast |

> **Rationale:** All touch targets exceed the 44px WCAG minimum, accommodating kitchen gloves and wet hands.

---

### 3.5 Payment & Checkout UI Components

> Full payment logic: **`Payment_Integration.md`**

#### A. Checkout Countdown Screen (PENDING_CUSTOMER_PIN)

Displayed for up to 45 seconds while waiting for the customer to approve the USSD push:

```
+------------------------------------------+
|  Waiting for MoMo Confirmation…          |
|                                          |
|        [  37s  ]   ← countdown ring      |
|                                          |
|  Check your phone for a prompt from MTN  |
|  Approve: UGX 14,000 for Foodizo         |
|                                          |
|         [ Retry Push ]                   |
+------------------------------------------+
```

- Countdown ring animates using `conic-gradient` updated every second.
- **Retry Push** button appears after `T+20s` to reduce user anxiety.
- Background colour: `#F8FAFC`; ring colour pulses `#D97706` (Amber) while pending.

#### B. USSD Manual Fallback Card (FAILED / TIMED_OUT)

Shown when the STK push times out or the telecom API is unreachable:

```
+------------------------------------------+
|  ⚠️  Could not reach MTN / Airtel        |
+------------------------------------------+
|  PAY MANUALLY:                           |
|  MTN:    Dial  *165*3*242424#            |
|  Airtel: Dial  *185*9*121212#            |
|  Reference:    TOKEN-042                 |
+------------------------------------------+
|  Then show your SMS receipt to cashier   |
|  [ I have paid — Notify Cashier ]        |
+------------------------------------------+
```

- Border: `2px solid #DC2626` (red warning state).
- Reference code displayed in `24px JetBrains Mono` for readability at counter distance.
- **"I have paid"** button flags the order for manual cashier verification workflow.
