# Foundational Concept: Multi-Channel Order & Kitchen Display System (KDS)

**Target Outlets:** Foodizo (Ham Towers) & Obunuzi Restaurant & Cafe (Opposite YMCA)  
**Location:** Wandegeya, Kampala, Uganda  
**Reference Document:** Project Requirement Document (PRD) v1.0  
**Project Lead:** Zito Mbowe (Project Coordinator - MRFSS Project)  
**Target Environment:** Antigravity IDE + Opencode CLI Repository Scaffold  
**Related Specifications:** `Design_System.md` · `User_Flow.md` · `User_Profiles_Personas.md` · `Tech_Stack.md` · `Payment_Integration.md`

---

## 1. Executive Summary & Purpose

This system solves three mission-critical operational challenges for Foodizo and Obunuzi:

1. **High-Volume Rush-Hour Bottlenecks (1:00 PM–3:00 PM & 6:00 PM–8:00 PM):** Eliminates walk-away customer loss at Ham Towers by replacing physical counter queues with a self-service mobile pre-order flow featuring digital token-based counter bypass.
2. **Multi-Channel Order Collision (Obunuzi 60/40 Split):** Harmonizes sit-down table-side orders with phone-in, takeaway, and delivery orders into a unified KDS queue with real-time visual channel segregation.
3. **Automated Inventory & Surplus Management:** Automatically decrements high-turnover ingredients (poultry, cooking oil, beef, Rolex/Luwombo items) and introduces an end-of-day surplus log that feeds predictive prep algorithms to minimize food waste.

---

## 2. User Roles & System Permissions Matrix

| User Role | Target Users | Core Responsibilities & Permissions |
| :--- | :--- | :--- |
| **Customer** | Makerere/YMCA students, Ham Towers corporate workers, walk-ins | • Browse digital menus, modifier choices, and daily specials.<br>• Place pre-orders for pickup or delivery to bypass counter lines.<br>• Pay via MTN MoMo (`25677/78/76`) and Airtel Money (`25670/75/74`) — see `Payment_Integration.md`.<br>• Receive digital tokens and live push notifications for status updates. |
| **Waiter / FOH** | Floor staff, order takers, counter cashiers | • Input and modify table-side dine-in orders.<br>• View live visual table occupancy grid (`VACANT`, `OCCUPIED`, `NEEDS_CLEARING`).<br>• Manage split checks, table transfers, and manual cash settlement. |
| **Kitchen Staff (KDS Operator)** | Chefs, station cooks, kitchen supervisors | • View incoming real-time orders on station-routed KDS monitors.<br>• Filter/toggle queues by channel (`DINE_IN` vs. `TAKEAWAY` vs. `DELIVERY`).<br>• Advance order/item states: `PENDING` → `PREPARING` → `READY`. |
| **Manager / Admin (Zito Mbowe)** | Store owners, operations coordinators, auditors | • Monitor cross-outlet live ticket queues and kitchen turnaround metrics.<br>• Audit automated stock tracking for poultry, cooking oil, and beef.<br>• Manage menu pricing, RBAC user accounts, and end-of-day surplus/waste logs.<br>• Review daily financial reconciliation (MTN, Airtel, Cash) — see `Payment_Integration.md §9`. |

---

## 3. Core System Workflows

### 3.1 Customer Pre-Order & Queue Bypass Workflow

1. **Discovery:** Customer accesses the PWA, selects their location (Foodizo or Obunuzi), and browses menu categories (Rolex, Fried Chicken, Luwombo).
2. **Checkout:** Selects fulfillment type (`PRE_ORDER_PICKUP` or `DIRECT_DELIVERY`), inputs MTN or Airtel phone number. The system auto-detects the carrier and dispatches a USSD STK push — full payment flow in `Payment_Integration.md §5`.
3. **Token Issuance:** Upon webhook confirmation (`SUCCESSFUL`), the app displays a high-visibility **Digital Token** (e.g., `TOKEN #042`) and estimated pickup time. The order enters the KDS queue only at this point.
4. **Bypass:** When the kitchen marks the order `READY`, the customer receives an instant SMS/web notification, walks directly to the express shelf, shows the token, and collects the meal without waiting in the counter line.

### 3.2 Unified KDS Coordination Workflow

1. **Unified Stream:** Mobile pre-orders, waiter table-side inputs, and cashier phone orders merge into one chronological queue.
2. **Channel Segregation:** Each ticket displays color-coded badges to indicate channel type:
   - `DINE_IN` (Blue Badge)
   - `TAKEAWAY_PICKUP` (Orange Badge)
   - `PHONE_DELIVERY` (Purple Badge)
3. **Lifecycle Advance:** Tapping an order updates its state from `PENDING` to `PREPARING` to `READY`, instantly updating waiter floor tablets and customer devices.

### 3.3 Inventory Decrementing & Surplus Logging Workflow

1. **Real-Time Decrementing:** Recipe-level Bill of Materials (BOM) automatically decrements raw materials (e.g., grams of beef, milliliters of oil, units of eggs/chapatis) upon order confirmation.
2. **Threshold Alerts:** When high-turnover ingredients cross safety thresholds (e.g., cooking oil < 5 Liters), a push alert notifies the Manager.
3. **Closing Surplus Log:** At 9:00 PM, managers log remaining unsold cooked batches into the Surplus Register, informing predictive prep schedules for subsequent days.

### 3.4 Payment Processing & Financial Settlement Workflow

> Full specification: **`Payment_Integration.md`**

1. **Carrier Detection:** Customer phone prefix is normalised to E.164 and routed to MTN MoMo or Airtel Money API automatically.
2. **USSD STK Push:** A non-blocking push is dispatched to the customer's handset; the system starts a 45-second countdown with a polling fallback at 30 seconds.
3. **Webhook Settlement:** On `SUCCESSFUL` callback, the idempotency engine promotes the order to `PENDING` and fires it to the KDS — preventing any duplicate tickets on webhook retry.
4. **Manual Fallback:** If telecom APIs are down, cashiers can accept USSD counter payments via merchant codes (`*165*3*242424#` / `*185*9*121212#`) and manually verify the transaction ID.
5. **Shift-Close Reconciliation:** At 9:30 PM, Zito Mbowe reviews an auto-generated report reconciling MTN, Airtel, manual MoMo, and cash channels across both outlets.

---

## 4. Key Performance Targets

| Metric | Target |
| :--- | :--- |
| Counter Queue Reduction | Divert ≥ 40% of peak-hour volume to pre-orders |
| Order Collisions | 0 lost or duplicated tickets between table and phone channels |
| Turnaround Speed (Fast-Casual) | Meals ready in < 7 minutes |
| Turnaround Speed (Luwombo) | Plated in < 3 minutes from steam line |
| Inventory Accuracy | Ingredient variance held below 2% daily |
| Payment Success Rate | ≥ 97% of MoMo STK pushes confirmed within 45 seconds |
| Duplicate Ticket Rate | 0 duplicate KDS tickets from webhook retries |
| Daily Reconciliation Variance | UGX 0 variance between payment records and till totals |

---

## 5. Document Index

| File | Scope |
| :--- | :--- |
| `Foundational_Concept.md` | This file — problem scope, roles, workflows, KPIs |
| `Design_System.md` | UI palette, typography, component specs (token card, table grid, KDS filter bar) |
| `User_Flow.md` | Step-by-step channel flows, ticket lifecycle state machine, surplus routine |
| `User_Profiles_Personas.md` | Brian K., Prossy N., Chef Juma, Zito Mbowe personas |
| `Tech_Stack.md` | Architecture, full DDL schema (7 tables), KDS event handler, repo scaffold |
| `Payment_Integration.md` | MTN MoMo & Airtel Money engine, idempotency, USSD fallback, reconciliation |
