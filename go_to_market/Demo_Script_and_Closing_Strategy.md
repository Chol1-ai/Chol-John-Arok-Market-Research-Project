# Live Demonstration Script & Commercial Closing Strategy

**Target Stakeholder:** Zito Mbowe (Project Coordinator - MRFSS Project)<br>
**Location:** Foodizo (Ham Towers) / Obunuzi (Opposite YMCA), Wandegeya<br>
**Meeting Goal:** Execute a 10-minute live demonstration, prove ROI on food waste and queue walk-aways, and secure agreement on the implementation contract.<br>
**Related Specifications:** `Foundational_Concept.md` · `Design_System.md` · `User_Flow.md` · `User_Profiles_Personas.md` · `Delivery_Zones_and_Dispatch.md` · `Tech_Stack.md` · `Payment_Integration.md` · `Hardware_and_Peripherals.md` · `Seed_Data_and_Testing.md` · `Repo_Scaffold_and_Config.md` · `Daily_Audit_Digest.md` · `Deployment_Runbook.md` · `Service_Contract_and_Invoice_Template.md` · `../build_strategy/Build_Strategy_and_Phases.md`

---

## 1. Physical Demonstration Setup

Before Zito Mbowe arrives, arrange three devices on the table:
* **Device 1 (Your Smartphone):** Customer PWA interface (`http://localhost:3000`).
* **Device 2 (A Tablet / Second Phone):** Waiter / FOH Table Occupancy view (`/pos`).
* **Device 3 (Your Laptop Screen):** Split between the Kitchen Expo KDS (`/kds/expo`) and the Admin Dashboard (`/admin/dashboard`).

---

## 2. The 10-Minute Demonstration Script

### Minute 0:00–2:00 — The Ham Towers Peak Rush Solution
* **What you say:**
  > *"Zito Mbowe, between 1:00 PM and 3:00 PM at Ham Towers, your biggest loss isn't food costs—it's Makerere students and office tenants who walk past Foodizo because the counter line has 15 people in it. Let me show you how we recover those lost sales."*
* **What you do:**
  1. Open **Device 1** (Customer PWA).
  2. Select **Foodizo (Ham Towers)** $\rightarrow$ tap `2pc Fried Chicken & Chips` (UGX 14,000) $\rightarrow$ select **Pre-order pickup**.
  3. Enter an MTN phone number $\rightarrow$ tap **"Pay via Mobile Money"**.
  4. The checkout has already reserved a daily display token and a globally unique order reference; after the verified MoMo confirmation, the screen reveals high-visibility **`TOKEN-042`** with a 6-minute ETA.
  5. Point to **Device 3** (Laptop): The ticket immediately drops into Station 2 (Fryer) with an Amber `TAKEAWAY_PICKUP` tag.
* **The Punchline:**
  > *"The student placed this order while walking out of a lecture at Makerere. They walk straight past the queue, show TOKEN-042, grab their hot food, and leave. You just doubled your counter capacity without adding staff."*

---

### Minute 2:00–4:30 — The Obunuzi 60/40 Split & Ticket Collision Fix
* **What you say:**
  > *"Now let's cross the street to Obunuzi. Your biggest headache opposite YMCA is managing sit-down diners while the phone rings with delivery orders from lecturers. Right now, cooks prioritize whoever shouts loudest, and tickets get lost. Here is how we fix it."*
* **What you do:**
  1. Pick up **Device 2** (Waiter Handheld). Show the **Visual Table Grid**:
     * Tap `T-04` (turns Blue: `OCCUPIED`).
     * Ring up: `1x Traditional Beef Luwombo` + `1x Matooke`. Tap **"Send to Kitchen"**.
  2. Switch immediately to the Counter Phone Entry screen:
     * Key in: `Customer: Dr. Okello`, `Phone: 0701 234 567`.
     * Select zone: `YMCA Main Campus` (shows `UGX 1,500 · 5–10 min`).
     * Add note: `Block C, Room 204 — call at security gate`.
     * Add `1x Beef Luwombo (delivery)`. Tap **"Dispatch"**.
     * Point out that the delivery fee is included in the total before payment.
  3. Turn Laptop to Zito Mbowe:
     * Station 1 (Steam Line) shows **both orders consolidated**:
       * Ticket A: Blue Badge `[DINE-IN - T-04]`
       * Ticket B: Purple Badge `[PHONE-DELIVERY - TOKEN-043]` with `YMCA MAIN CAMPUS`
       * Station Summary bar reads: **`2x Beef Luwombo Plating Required`**.
     * The KDS shows **no phone number, room note, or GPS** — that data lives on the FOH dispatch screen and the printed delivery chit.
  4. When the order is `READY`, open `/pos/dispatch`:
     * Show the delivery chit: `DESTINATION: YMCA MAIN CAMPUS`, `ROOM/NOTE: BLOCK C, ROOM 204 — CALL AT SECURITY GATE`, `PHONE: 0701 234 567`.
     * Tap **CALL** or **WHATSAPP**; then **HANDED TO RIDER** and record the rider name plus the `UGX 1,500` transport advance (matching the YMCA delivery fee).
     * Say: *“No map pin required. The rider has the hall, the room, the phone number, and a bag with the right token. The cash advance is logged, so it will not show up as a drawer shortage at 9:30 PM.”*
* **The Punchline:**
  > *"Chef doesn't guess. In one motion, he dishes two Luwombo bowls. T-04 gets served, Dr. Okello's delivery bag is labeled, and zero orders were scribbled on paper chits."*

---

### Minute 4:30–6:30 — Automated Recipe Inventory, 7:30 PM Clearance & 9:00 PM Surplus Engine
* **What you say:**
  > *"Let's talk about food waste and raw ingredient loss—Mukwano cooking oil, chicken pieces, and unsold Luwombo."*
* **What you do:**
  1. Open `/admin/inventory` on the Laptop:
     * Show raw stock: Cooking oil automatically decremented by 50 ml, chicken pieces by 2, and stewing beef by **700 g** (two Luwombo portions at 350 g each) based on the demonstration orders.
  2. Open the **Closing Surplus Routine**:
     * Show: *"Beef Luwombo: 6 portions remaining unsold at 7:30 PM."*
     * Apply the **"7:30 PM Clearance Special"** (a manual manager price change via Menu & Pricing, not an automatic markdown engine):
     * Show **Device 1** (Customer PWA): Beef Luwombo reflects the clearance price of `UGX 12,000` (down from `UGX 16,000`) with a red **"Flash Clearance"** badge.
     * At **9:00 PM**, log the remaining unsold portions in the same routine; the log feeds next-day prep targets.
* **The Punchline:**
  > *"Six portions at UGX 12,000 is UGX 72,000 of sales that would otherwise be zero, but that is revenue, not profit. At an illustrative 30% contribution margin, it is about UGX 21,600 on a clearance night. The UGX 350,000 monthly retainer would need roughly 17 such nights to cover on clearance alone. The business case is the combined effect of recovered queue sales, fewer unrecorded staff meals, and lower over-prep — measured during the pilot, not promised in the demo."*

---

### Minute 6:30–8:00 — Financial Reconciliation (Zero Leakage)
* **What you say:**
  > *"At 9:30 PM, you need to balance the books between Ham Towers and YMCA without spending two hours auditing paper receipts."*
* **What you do:**
  1. Open `/admin/reconcile`.
  2. Display the consolidated ledger (figures are demo fixtures, not live client data):
     * MTN Collections: `UGX 1,596,000` (Verified via API, includes delivery fees)
     * Airtel Money: `UGX 672,000` (Verified via API, includes delivery fees)
     * Manual MoMo (USSD verified): `UGX 168,000` (Cashier-verified chits)
     * Cash Drawer: `UGX 308,000` (Assigned to Waiter Prossy)
     * Total collected: `UGX 2,744,000`; outlet split: Foodizo `UGX 1,780,000`, Obunuzi `UGX 964,000`
     * Cash variance: calculated from the shift-close count, never hard-coded. Show a **missing count** state first: `CASH COUNT MISSING`; then enter the count and show the real variance.
  3. Point out that delivery fees are part of the MoMo/Airtel amount, not an untracked cash top-up, and that rider advances are netted out before the drawer is compared. `REFUND_PENDING` amounts are shown separately and are not counted as collections.
  4. Show the 21:30 digest on your phone or in `/admin/digest`: a 2-segment SMS summary plus the full email report. Emphasize that it is sent **after** the cash count deadline, not instead of it.
* **The Punchline:**
  > *"Every shilling collected maps to a verified kitchen ticket, and if the drawer has not been counted, the system says so instead of printing a fake zero. That is the difference between a dashboard and an audit trail."*

---

### Minute 8:00–10:00 — The Commercial Proposal & Close
* **What you say:**
  > *"Zito Mbowe, this system is built specifically for your two locations. It targets Foodizo's rush-hour walk-aways and reduces Obunuzi's evening food waste. Here is how we roll this out:"*

```text
+--------------------------------------------------------------------------+
| COMMERCIAL IMPLEMENTATION PROPOSAL                                       |
+--------------------------------------------------------------------------+
| 1. ONE-TIME IMPLEMENTATION & DEPLOYMENT SETUP FEE: UGX 2,500,000         |
| • In-store Local Edge Node setup (LAN resilience during fiber cuts)      |
| • Multi-station KDS deployment & tablet mounting                         |
| • Delivery zones, dispatch queue & thermal rider chits (no map fees)     |
| • Full Recipe BOM configuration (Cooking oil, poultry, Luwombo)          |
| • FOH & Kitchen Staff on-site training across Ham Towers & YMCA          |
+--------------------------------------------------------------------------+
| 2. MONTHLY SYSTEM LICENSE & MAINTENANCE: UGX 350,000 / month             |
| • Edge-node maintenance, backup verification & Redis Pub/Sub health      |
| • MTN & Airtel MoMo API maintenance & webhook monitoring                 |
| • 07:00–22:00 EAT priority local support (45-min critical response)     |
+--------------------------------------------------------------------------+
```

* **The Closing Question:**
  > *"Let us use conservative numbers, not a 12-day payback promise. Five recovered orders a day at UGX 14,000 is UGX 70,000 of extra sales; at an illustrative 30% contribution margin, that is UGX 21,000 a day. Recovering the UGX 2,500,000 implementation fee at that rate takes about 119 operating days, and the UGX 350,000 retainer needs roughly 17 such days a month. Clearance and waste reduction improve those figures, but they are planning assumptions we will measure in the pilot. Can we schedule on-site deployment and staff onboarding for this Monday?"*

---

## 3. Objection Handling Guide (Kampala Realities)

### Objection 1: *"What happens if the internet goes off in Wandegeya?"*
* **Response:** *"The system is built edge-first. If fiber cuts or 4G drops, the in-store mini-server keeps tickets moving between your waiters and kitchen screens over local Wi-Fi. Its PostgreSQL database is the source of truth, not a cloud copy. When the internet returns, mobile-money confirmations and the owner digest resume; no table order waits for a cloud round trip."*

### Objection 2: *"What if kitchen staff find tablets hard to use with wet or greasy hands?"*
* **Response:** *"We specifically eliminated small buttons and complex menus. The bump buttons are 68px tall—full card width. Cooks can bump tickets with the heel of their palm or a single tap. We also support external hardware bump bars if they prefer physical buttons."*

### Objection 3: *"What if a customer claims they paid via MoMo, but the system hasn't confirmed it?"*
* **Response:** *"Our system has a built-in 45-second polling fallback that actively queries the telecom network. Even if the telecom network experiences severe lag, the cashier has a 'Verify MoMo' button to enter the telecom SMS transaction ID, verify it instantly, and release the order."*

### Objection 4: *"Why doesn't the app show a live map like Uber?"*
* **Response:** *"Because a live map would not solve your actual delivery problem. Uber tracks a driver on a road; your rider is trying to find Block C, Room 204 at YMCA or Mary Stuart Hall. A GPS pin lands on a roof or the wrong gate, and a live map adds API fees, battery drain, and a screen your freelance riders will not use. We use what works on the ground: a zone/landmark dropdown, an exact room note, a phone number the rider can call, and a printed chit. If you later hire 5+ full-time riders and exceed 100 deliveries a day outside campus, we can add live tracking with free open-source maps — without rebuilding this workflow."*

---

## 4. Complete Deliverable Index (15-File Master Blueprint)

| File Name | Purpose in DICE Framework |
| :--- | :--- |
| **`Foundational_Concept.md`** | Problem scope, 4-role matrix, delivery model, and business boundaries. |
| **`Design_System.md`** | Industrial contrast UI, Digital Token card, Table Occupancy grid, delivery checkout/dispatch, and channel badges. |
| **`User_Flow.md`** | Prepaid `AWAITING_PAYMENT` gate, four KDS states (`PENDING` $\rightarrow$ `PREPARING` $\rightarrow$ `READY` $\rightarrow$ `COMPLETED`), table service, delivery handoff, and batch routines. |
| **`User_Profiles_Personas.md`** | Operational archetypes: Zito Mbowe, Brian K., Prossy N., Chef Juma, and the Phase 1 rider actor. |
| **`Delivery_Zones_and_Dispatch.md`** | Zone/landmark checkout, optional one-shot GPS pin, FOH dispatch queue, delivery chit, privacy, and Phase 2 triggers. |
| **`Tech_Stack.md`** | Fastify backend, canonical PostgreSQL DDL, staff auth/RBAC, menu/token model, and local edge deployment. |
| **`Payment_Integration.md`** | MTN MoMo & Airtel Money STK pushes, delivery-fee inclusion, webhook listeners, and USSD fallbacks. |
| **`Hardware_and_Peripherals.md`** | ESC/POS packaging and delivery chits, Africa's Talking SMS alerts, and UMEME power resilience. |
| **`Seed_Data_and_Testing.md`** | Complete Prisma seed script, delivery-zone seed data, recipe BOM conversions, and automated rush-hour test runner. |
| **`Repo_Scaffold_and_Config.md`** | Exact repository tree, Docker build files, `package.json` dependencies, and `.env.example`. |
| **`Demo_Script_and_Closing_Strategy.md`** | 10-minute live demonstration script and commercial proposal in UGX to close Zito Mbowe. |
| **`Daily_Audit_Digest.md`** | 21:30 EAT owner SMS/email digest, real cash-variance rules, inventory/exception flags, and idempotency. |
| **`Deployment_Runbook.md`** | Edge-first Docker Compose stack, LAN/router topology, Cloudflare Tunnel, backups, and restore tests. |
| **`Service_Contract_and_Invoice_Template.md`** | Milestone-based service agreement and UGX invoice template for legal review; not legal advice. |
| ** · `../build_strategy/Build_Strategy_and_Phases.md`** | Stage 0–6 delivery sequence, coding build order (C0–C10), evidence-based gates, RACI, dependencies, change control, and Phase 2 hand-off. |
