# Foundational Concept: Multi-Channel Order & Kitchen Display System (KDS)

**Target Outlets:** Foodizo (Ham Towers) & Obunuzi Restaurant & Cafe (Opposite YMCA)<br>
**Location:** Wandegeya, Kampala, Uganda<br>
**Reference Document:** Project Requirement Document (PRD) v1.0<br>
**Project Lead:** Zito Mbowe (Project Coordinator - MRFSS Project)<br>
**Target Environment:** Antigravity IDE + Opencode CLI Repository Scaffold<br>
**Related Specifications:** `Design_System.md` · `User_Flow.md` · `User_Profiles_Personas.md` · `Delivery_Zones_and_Dispatch.md` · `Tech_Stack.md` · `Payment_Integration.md` · `Hardware_and_Peripherals.md` · `Seed_Data_and_Testing.md` · `Repo_Scaffold_and_Config.md` · `Demo_Script_and_Closing_Strategy.md` · `Daily_Audit_Digest.md` · `Deployment_Runbook.md` · `Service_Contract_and_Invoice_Template.md` · `Implementation_Phases.md`

---

## 1. Executive Summary & Purpose

This system solves four mission-critical operational challenges for Foodizo and Obunuzi:

1. **High-Volume Rush-Hour Bottlenecks (1:00 PM–3:00 PM & 6:00 PM–8:00 PM):** Eliminates walk-away customer loss at Ham Towers by replacing physical counter queues with a self-service mobile pre-order flow featuring digital token-based counter bypass.
2. **Multi-Channel Order Collision (Obunuzi 60/40 Split):** Harmonizes sit-down table-side orders with phone-in, takeaway, and delivery orders into a unified KDS queue with real-time visual channel segregation.
3. **Automated Inventory & Surplus Management:** Automatically decrements high-turnover ingredients (poultry, cooking oil, potatoes, beef, Rolex/Luwombo items) and records an end-of-day surplus log that gives managers evidence for next-day prep targets and waste reduction.
4. **Delivery Drop-Off Ambiguity (Obunuzi & Campus Corridor):** Replaces error-prone free-text delivery addresses and unnecessary live-map tracking with outlet-scoped zone/landmark selection, a required room/office/gate note, a rider-callable phone number, and an optional one-shot GPS pin. See `Delivery_Zones_and_Dispatch.md`.

---

## 2. User Roles & System Permissions Matrix

| User Role | Target Users | Core Responsibilities & Permissions |
| :--- | :--- | :--- |
| **Customer** | Makerere/YMCA students, Ham Towers corporate workers, walk-ins | • Browse digital menus, modifier choices, and daily specials.<br>• Place pre-orders for pickup or delivery to bypass counter lines.<br>• For delivery, select an outlet-scoped zone/landmark, enter an exact room/office/gate note, and provide a rider-callable phone number.<br>• Optionally attach a one-shot GPS pin; declining it never blocks checkout.<br>• Pay via MTN MoMo (`25677/78/76`) and Airtel Money (`25670/75/74`) — see `Payment_Integration.md`.<br>• Receive a digital token and an SMS or in-page status update when the order is ready. |
| **Waiter / FOH** | Floor staff, order takers, counter cashiers | • Input and modify table-side dine-in orders.<br>• View live visual table occupancy grid (`VACANT`, `OCCUPIED`, `BILL_REQUESTED`, `NEEDS_CLEARING`).<br>• Capture delivery zone, room/office note, recipient name, and phone on the phone-entry screen.<br>• Dispatch delivery orders from the FOH queue: print/verify chit, call or WhatsApp the customer, and record the rider handoff.<br>• Settle an open table tab in one transaction: cash, manual MoMo, or a MoMo/Airtel STK prompt to the guest. Split checks, split tender, and table transfers are Phase 2. |
| **Kitchen Staff (KDS Operator)** | Chefs, station cooks, kitchen supervisors | • View incoming real-time orders on station-routed KDS monitors.<br>• Filter/toggle queues by channel (`DINE_IN` vs. `TAKEAWAY_PICKUP` vs. `PHONE_DELIVERY`).<br>• Advance order/item states: `PENDING` → `PREPARING` → `READY`.<br>• Delivery tickets show the destination zone only; customer name, phone, room notes, and GPS coordinates never appear on the KDS. |
| **Manager / Admin (Zito Mbowe)** | Store owners, operations coordinators, auditors | • Monitor cross-outlet live ticket queues and kitchen turnaround metrics.<br>• Audit automated stock tracking for poultry, cooking oil, and beef.<br>• Maintain delivery zones, fees, ETAs, and active/inactive Phase 2 areas.<br>• Audit delivery handoffs, failed deliveries, and chit reprints.<br>• Authorise voids/cancellations and close `REFUND_PENDING` MoMo payments after the external reversal.<br>• Manage menu pricing, RBAC user accounts, and end-of-day surplus/waste logs.<br>• Review daily financial reconciliation (MTN, Airtel, Manual MoMo, Cash); delivery fees are a memo component of the paid total, not a separate payment channel — see `Payment_Integration.md §9`. |

---

## 3. Core System Workflows

### 3.1 Customer Pre-Order & Queue Bypass Workflow

1. **Discovery:** Customer accesses the PWA, selects their location (Foodizo or Obunuzi), and browses menu categories (Rolex, Fried Chicken, Luwombo).
2. **Checkout:** Selects fulfillment type (**Pre-order pickup** or **Delivery**), which maps to the canonical channel `TAKEAWAY_PICKUP` or `PHONE_DELIVERY`, and inputs an MTN or Airtel phone number. For delivery, the customer must also select an active zone and enter a room/office/gate note, recipient name, and rider-callable phone; an optional one-shot GPS pin can be attached but is never required (`Delivery_Zones_and_Dispatch.md §4`). The system auto-detects the carrier and dispatches a USSD STK push — full payment flow in `Payment_Integration.md §5`.
3. **Token Issuance:** The order is created as `AWAITING_PAYMENT` and reserves a high-visibility **Digital Token** (e.g., `TOKEN-042`) and a globally unique `public_ref`. Upon webhook confirmation (`SUCCESSFUL`), the app reveals the token and estimated pickup time, and the order enters the KDS queue as `PENDING`.
4. **Bypass:** When the kitchen marks the order `READY`, the customer receives an SMS or in-page notification, walks directly to the express shelf, shows the token, and collects the meal without waiting in the counter line.

### 3.2 Unified KDS Coordination Workflow

1. **Unified Stream:** Mobile pre-orders, waiter table-side inputs, and cashier phone orders merge into one chronological queue.
2. **Channel Segregation:** Each ticket displays color-coded badges to indicate channel type:
   - `DINE_IN` (Blue Badge)
   - `TAKEAWAY_PICKUP` (Amber Badge)
   - `PHONE_DELIVERY` (Purple Badge) — covers both cashier phone orders and customer-app delivery; the KDS shows the destination zone only, never the customer phone, room note, or GPS coordinates.
3. **Lifecycle Advance:** Tapping an order updates its state from `PENDING` to `PREPARING` to `READY`, instantly updating waiter floor tablets and customer devices. Prepaid orders reach `PENDING` only after verified payment; an authenticated FOH dine-in tab is the postpay exception and settles at bill close.

### 3.3 Inventory Decrementing & Surplus Logging Workflow

1. **Real-Time Decrementing:** Recipe-level Bill of Materials (BOM) automatically decrements raw materials (e.g., grams of beef, milliliters of oil, units of eggs/chapatis) when the ticket advances to `PREPARING`.
2. **Threshold Alerts:** When high-turnover ingredients cross safety thresholds (e.g., cooking oil < 5 Liters), an SMS and in-page dashboard alert notifies the Manager.
3. **Closing Surplus Log:** At 9:00 PM, managers log remaining unsold cooked batches into the Surplus Register, giving the next day's prep review a factual starting point rather than an automatic forecast.

### 3.4 Payment Processing & Financial Settlement Workflow

> Full specification: **`Payment_Integration.md`**

1. **Carrier Detection:** Customer phone prefix is normalised to E.164 and routed to MTN MoMo or Airtel Money API automatically.
2. **USSD STK Push:** A non-blocking push is dispatched to the customer's handset; the system starts a 45-second countdown with a polling fallback at 30 seconds.
3. **Webhook Settlement:** On `SUCCESSFUL` callback, the idempotency engine promotes the order to `PENDING` and fires it to the KDS — preventing any duplicate tickets on webhook retry.
4. **Manual Fallback:** If telecom APIs are down, cashiers can accept USSD counter payments via merchant codes (`*165*3*242424#` / `*185*9*121212#`) and manually verify the transaction ID.
5. **Shift-Close Reconciliation:** At 9:30 PM, Zito Mbowe reviews an auto-generated report reconciling MTN, Airtel, Manual MoMo, and cash collections across both outlets. Delivery fees are shown as a memo component of the paid total, not as a fifth payment channel. The same figures produce the 21:30 SMS/email digest (`Daily_Audit_Digest.md`); if the drawer has not been counted, the report flags `CASH_COUNT_MISSING` instead of printing a zero.

### 3.5 Zone & Landmark Delivery Dispatch Workflow

> Full specification: **`Delivery_Zones_and_Dispatch.md`**

1. **Zone Capture:** The customer (or cashier on a phone order) selects an active zone belonging to the outlet. The dropdown shows the zone name, delivery fee, and ETA range.
2. **Landmark Note:** The customer enters an exact room, office, block, or gate instruction (3–160 characters). This note is the authoritative drop-off instruction.
3. **Rider Contact:** The customer enters a recipient name and a Ugandan phone number normalised to E.164. The phone is required for delivery and is used by the rider for calls.
4. **Optional Pin:** The customer may tap **“Use my current GPS pin (optional)”**. The browser makes a single `navigator.geolocation.getCurrentPosition` request; denial is handled without blocking checkout. The system stores coordinates and accuracy, not a map tile or route.
5. **Fee & Payment:** The server recomputes the zone fee and includes it in the MoMo/Airtel amount. The client-supplied fee is never trusted.
6. **KDS:** The paid order enters the KDS as `PENDING` with the purple `PHONE_DELIVERY` channel. The KDS shows the destination zone but never the customer phone, room note, or GPS coordinates.
7. **Pack & Print:** When the kitchen bumps the order to `READY`, the Expo printer fires an ESC/POS delivery chit containing token, destination, room note, phone, and instructions.
8. **Dispatch:** The FOH Dispatch Queue shows the `READY` delivery order with **CALL**, **WHATSAPP**, and **PRINT CHIT** actions. The rider takes the bag; FOH records the rider name, phone (optional), dispatch method, and any cash transport advance.
9. **Completion:** On delivery, FOH marks the order `COMPLETED`, records the handoff outcome and any returned advance. If the customer is unreachable, the manager follows the failed-delivery routine; the order is not falsely marked complete.

---

## 4. Key Performance Targets

| Metric | Target |
| :--- | :--- |
| Counter Queue Reduction | Divert ≥ 40% of peak-hour volume to pre-orders |
| Order Collisions | 0 lost or duplicated tickets between table and phone channels |
| Turnaround Speed (Fast-Casual) | Meals ready in < 7 minutes |
| Turnaround Speed (Luwombo) | Plated in < 3 minutes from steam line |
| Inventory Variance Visibility | 100% of high-turnover items show a variance computed from opening and closing counts, or `N/A — count not submitted`; never a fabricated variance |
| Delivery Data Completeness | 100% of delivery orders have an active zone, room/office note, recipient name, and rider-callable phone before payment |
| Delivery Fee Integrity | 0 orders where the charged delivery fee differs from the server-computed zone fee |
| Dispatch Readiness | ≥ 95% of `READY` delivery orders handed to a rider within 3 minutes |
| Delivery Failure Visibility | 100% of failed/unreachable deliveries recorded with a handoff outcome and manager review |
| Rider Advance Reconciliation | 100% of cash transport advances recorded on handoff; UGX 0 unexplained cash-drawer variance at shift close |
| Map API Dependency | 0 paid map SDK/API calls in Phase 1 checkout |
| Payment Success Rate | ≥ 97% of MoMo STK pushes confirmed within 45 seconds |
| Duplicate Ticket Rate | 0 duplicate KDS tickets from webhook retries |
| Daily Reconciliation Variance | 0 unexplained variance between payment records and till totals; delivery fees are memo within the paid total, not a separate channel |

---

## 5. Document Index

| File | Scope |
| :--- | :--- |
| `Foundational_Concept.md` | This file — problem scope, roles, workflows, KPIs |
| `Design_System.md` | UI palette, typography, component specs (token card, table grid, delivery checkout/dispatch, KDS filter bar) |
| `User_Flow.md` | Step-by-step channel flows, delivery handoff, ticket lifecycle state machine, surplus routine |
| `User_Profiles_Personas.md` | Brian K., Prossy N., Chef Juma, Zito Mbowe, and the Phase 1 rider actor |
| `Delivery_Zones_and_Dispatch.md` | Zone/landmark checkout, optional GPS pin, dispatch queue, chit contract, privacy, Phase 2 triggers |
| `Tech_Stack.md` | Architecture, canonical DDL (users/sessions/audit/menu/orders/payments/tokens), KDS event handler, auth/RBAC, repo scaffold |
| `Payment_Integration.md` | MTN MoMo, Airtel Money, cash and manual-MoMo engine; delivery-fee inclusion; idempotency; refunds; reconciliation |
| `Hardware_and_Peripherals.md` | ESC/POS packaging and delivery chits, SMS gateway, power resilience |
| `Seed_Data_and_Testing.md` | Menu, delivery zones, BOM conversions, rush-hour simulation, E2E checklist |
| `Repo_Scaffold_and_Config.md` | Directory tree, dependencies, environment variables, bootstrap |
| `Demo_Script_and_Closing_Strategy.md` | Live demo flow, delivery dispatch segment, objection handling, commercial proposal |
| `Daily_Audit_Digest.md` | 21:30 owner SMS/email digest, cash-variance rules, idempotency, security |
| `Deployment_Runbook.md` | Edge-node Compose deployment, LAN topology, backups, restore, rollback |
| `Service_Contract_and_Invoice_Template.md` | Milestone-based agreement and invoice template for legal review |
| `Implementation_Phases.md` | Stage 0–6 delivery sequence, C0–C10 coding build order, gate evidence, RACI, dependencies, Phase 2 hand-off |
