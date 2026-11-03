# End-to-End User Workflows & State Progression

**Reference:** PRD Section 3 (Workflows A, B, and C)<br>
**Related Files:** `Foundational_Concept.md` · `Design_System.md` · `User_Profiles_Personas.md` · `Delivery_Zones_and_Dispatch.md` · `Tech_Stack.md` (DDL) · `Payment_Integration.md` (checkout & webhook detail) · `Hardware_and_Peripherals.md` · `Seed_Data_and_Testing.md` · `Repo_Scaffold_and_Config.md` · `Demo_Script_and_Closing_Strategy.md` · `Daily_Audit_Digest.md` (shift-close owner report) · `Deployment_Runbook.md` (offline edge operation) · `Service_Contract_and_Invoice_Template.md` · `build_strategy/Build_Strategy_and_Phases.md`

---

## 1. Master Ticket Lifecycle

```
[ CUSTOMER PRE-ORDER ]                  [ DINE-IN TABLE TAB ]
             │                                    │
             ▼                                    ▼
   POST /orders: AWAITING_PAYMENT       FOH fires tab: PENDING
   Payment INITIATED                            (postpay;
   → PENDING_CUSTOMER_PIN                        settled at bill close)
             │                                    │
   (MoMo/Airtel webhook: SUCCESSFUL)               │
   order.status → PENDING                          │
             └──────────────────┬─────────────────┘
                                │
                               ▼
                        ┌─────────────┐
                        │  1. PENDING │  ← first KDS-visible state
                        └─────────────┘
             (Enters KDS Queue / Channel Segregated)
                                │
                     (Cook Claims / Taps Card)
                                │
                                ▼
                       ┌──────────────┐
                       │ 2. PREPARING │
                       └──────────────┘
           (On Grill / In Steam Pot / Recipe Decremented)
                                │
                       (Cook Bumps Ticket)
                                │
                                ▼
                         ┌───────────┐
                         │  3. READY │
                         └───────────┘
          (Customer SMS / Token Flashes on Screen)
                                │
                 (Expediter Hands Over Meal)
                                │
                                ▼
                        ┌─────────────┐
                        │ 4. COMPLETED│
                        └─────────────┘
```

> **Normalised State Machine:** Every kitchen ticket — regardless of channel — passes through exactly four KDS states: `PENDING`, `PREPARING`, `READY`, and `COMPLETED`. `AWAITING_PAYMENT` is a pre-kitchen holding state, not a fifth kitchen state; it never appears on the KDS. `CANCELLED` is a terminal exception available from `AWAITING_PAYMENT` or any KDS state, and every cancellation is logged.
>
> **Prepaid gate:** Customer-app, QR, and phone-delivery orders are created as `AWAITING_PAYMENT` before the STK push. They enter `PENDING` — and therefore the KDS — **only after** a verified `SUCCESSFUL` payment. A failed or timed-out attempt leaves the order available for retry until the payment TTL marks it `CANCELLED`. The idempotency engine in `Payment_Integration.md §6` prevents duplicate tickets when a telco webhook is retried.
>
> **Postpay exception:** A dine-in table tab fired by an authenticated `WAITER_FOH` or `MANAGER_ADMIN` enters `PENDING` without prepayment. The guest pays at bill close; the payment record is then attached to the tab. This exception never applies to customer-app, QR, or delivery orders.
>
> **Delivery Pre-Condition:** A `PHONE_DELIVERY` order cannot initiate payment until it has an active outlet-matched zone, a room/office/gate note, a recipient name, and a rider-callable phone number. The optional GPS pin is never a precondition. See `Delivery_Zones_and_Dispatch.md §4` and `§9`.

---

## 2. Detailed Channel Scenarios

### Flow A: Customer Mobile Pre-Order & Queue Bypass

| Step | Actor | Action |
| :--- | :--- | :--- |
| 1 | Customer | Scans Foodizo Ham Towers QR code or opens saved bookmark |
| 2 | Customer | Adds `1x 2pc Fried Chicken & Chips` (UGX 14,000) + `1x Fresh Passion Juice` (UGX 4,000) |
| 3 | Customer | Selects fulfillment type: **Pre-order pickup** (canonical channel: `TAKEAWAY_PICKUP`) |
| 4 | System | Resolves menu IDs, names, and prices from `menu_items`; creates the order as `AWAITING_PAYMENT`; reserves the next daily display token and a globally unique `public_ref` |
| 5 | Customer | Inputs MTN MoMo number (`077XXXXXXX`) → taps **"Pay Now"** |
| 6 | System | MSISDN normalised to E.164 (`25677XXXXXXX`); carrier detected as MTN; the same number is stored as `orders.customer_phone` so the `READY` SMS has a destination |
| 7 | System | `POST /collection/v1_0/requesttopay` dispatched with `X-Reference-Id` (payment-attempt idempotency key); payment record status → `INITIATED` |
| 8 | Customer | USSD prompt arrives on handset: *"Approve UGX 18,000 for Foodizo? Enter PIN"*; frontend shows the payment countdown |
| 9 | Customer | Enters MoMo PIN on handset |
| 10 | System | MTN webhook fires: `status: SUCCESSFUL` → `payment_events` dedupe and row locks run → `payments.status → SUCCESSFUL` → `orders.status: AWAITING_PAYMENT → PENDING` *(see `Payment_Integration.md §6`)* |
| 11 | KDS | Order appears on Station 2 (Fryer) with the reserved token: `TAKEAWAY_PICKUP — TOKEN-088` |
| 12 | Chef Juma | Advances: `PENDING` → `PREPARING` → `READY` |
| 13 | System | SMS sent: *"TOKEN-088 is ready at the Express Counter!"* |
| 14 | Customer | Walks past register queue → shows `TOKEN-088` → collects bag → departs |

**Outcome:** Zero counter queue time. Order fulfilled in < 7 minutes from payment webhook confirmation. Duplicate KDS tickets are prevented by payment-attempt idempotency and event dedupe — see `Payment_Integration.md §6`.

---

### Flow B: Obunuzi Table-Side Service & Channel Merging

| Step | Actor | Action |
| :--- | :--- | :--- |
| 1 | Prossy N. | Views Table Occupancy Grid → taps `T-04` (`VACANT` → `OCCUPIED`) |
| 2 | Prossy N. | Selects `2x Beef Luwombo`, `2x Matooke`, `2x Water`. Adds note: *"Sauce hot"* |
| 3 | Prossy N. | Taps **"Send to Kitchen"** |
| 4 | KDS | The authenticated FOH action creates the postpay table tab as `PENDING`; it appears on Station 1 (Steam Line): `DINE_IN — T-04` (blue badge) |
| 5 | Prossy N. (FOH cashier) | Takes phone order: `1x Beef Luwombo (delivery)` for Dr. Okello. Selects delivery zone `YMCA_MAIN`, enters note `Block C, Room 204 — call at security gate`, recipient `Dr. Okello`, phone `0701 234 567` |
| 6 | System | Validates the zone is active and belongs to Obunuzi; recomputes menu prices and delivery fee `UGX 1,500`; creates the order as `AWAITING_PAYMENT`; includes the fee in the MoMo/Airtel amount. No payment is initiated if the zone, note, name, or phone is missing |
| 7 | System | Verified payment promotes the delivery order to `PENDING` |
| 8 | KDS | Second ticket appears: `PHONE_DELIVERY — TOKEN-043` (purple badge) with destination `YMCA MAIN CAMPUS`. Customer name, phone, room note, and GPS (if any) are not shown on the KDS |
| 9 | Cook | KDS shows both tickets chronologically. Cook prepares both Luwombo portions together. |
| 10 | Cook | Advances both tickets: `PREPARING` → `READY` |
| 11 | Prossy N. | Tablet shows T-04 order as `READY` → serves plated meal |
| 12 | System | Expo printer fires the delivery chit with token, destination, room/office note, phone, and instructions |
| 13 | Prossy N. | Opens `/pos/dispatch`, verifies the chit, taps **CALL** or **WHATSAPP** if needed, hands the bag to the rider, and records rider name + dispatch method + any cash transport advance |
| 14 | Prossy N. | On delivery, marks the order `COMPLETED` and records the handoff outcome plus any returned change. If the customer is unreachable, the manager follows the failed-delivery routine instead of marking it complete |
| 15 | Prossy N. (FOH cashier) | When the T-04 guests leave, settles the table tab by cash, direct MoMo, or verified manual MoMo through `POST /api/v1/orders/:id/settle`, then marks the table `NEEDS_CLEARING` |

**Outcome:** Zero duplicate prep. Table-side and phone channels harmonised in one shared queue. The rider gets a complete landmark/room/phone chit without a live map, and the kitchen never sees customer personal data.

---

### Flow C: Real-Time Inventory & Closing Surplus Routine

#### C1. Real-Time BOM Decrement (Triggered at `PREPARING`)

When `TOKEN-088` advances to `PREPARING`, the BOM engine automatically decrements the recipe attached to `menu_items.id`:

| Ingredient | Amount Deducted | Unit |
| :--- | :--- | :--- |
| Raw Broiler Chicken Portions | 2 | pieces |
| Potatoes (pre-cut chips) | 250 | grams |
| Mukwano Cooking Oil | 50 | ml |

The same transaction deducts every defined BOM line on the ticket; menu items without a BOM do not affect inventory. The decrement is idempotent per order: a duplicate bump cannot consume inventory twice.

#### C2. Low-Stock Threshold Alert

1. Cooking oil stock drops below **5.0 Liters**.
2. System sends an SMS and an in-page dashboard alert to **Zito Mbowe**:
   > *"⚠️ Warning: Mukwano Cooking Oil below reorder point at Ham Towers. Current: 4.7L / Threshold: 5.0L."*
3. Manager can acknowledge and trigger a purchase order from the Manager Portal.

#### C3. Closing Surplus Log — 9:00 PM EOD Routine

0. **Optional 7:30 PM clearance:** The manager may apply a reduced price to selected items through the existing **Menu & Pricing** admin. This is a manual price change, not an automatic markdown engine. The normal menu price returns the next day.
1. Kitchen supervisor opens **Manager Portal → "End-of-Day Surplus Log"**.
2. **System pre-populates the surplus form with the menu items and lets the supervisor enter the remaining cooked portions manually:**

   | Item | Leftover Portions |
   | :--- | :--- |
   | Beef Luwombo | 4 portions |
   | Steamed Matooke | 6 portions |
   | Rolex (Egg + Chapati) | 3 portions |

3. Supervisor selects resolution for each item:

   | Resolution Code | Meaning |
   | :--- | :--- |
   | `DISCOUNTED_CLEARANCE` | Sold at reduced price before closing |
   | `STAFF_MEAL` | Consumed by kitchen/service staff |
   | `WASTE_DISCARDED` | Disposed of — triggers waste metric |

4. The manager records opening and closing stock counts for the high-turnover ingredients. The surplus log alone is not an inventory variance measurement.
5. The surplus rows and the count delta feed the following day's prep-target review. They do not promise an automatic forecast or a fixed variance reduction.

---

### Flow D: Customer-App Delivery & Zone Dispatch

This flow is the PWA equivalent of the phone-in delivery in Flow B. It uses the same zone catalogue and the same four KDS states after payment.

| Step | Actor | Action |
| :--- | :--- | :--- |
| 1 | Customer | Opens the Foodizo or Obunuzi PWA and selects **Delivery** |
| 2 | Customer | Selects an outlet-scoped zone, e.g. `Makerere University — Mary Stuart Hall` (UGX 2,000 · 10–15 min) |
| 3 | Customer | Enters note `Block B, Room 14 — call at the gate`, recipient name, and phone `0772 123 456` |
| 4 | Customer | Optionally taps **“Use my current GPS pin”**. Browser asks permission once; the pin is stored with an accuracy value. Declining continues checkout |
| 5 | System | Normalises the phone to E.164, validates the active zone + note + name + phone, resolves menu prices, recomputes the fee, and displays `Subtotal + Delivery fee = Total` |
| 6 | Customer | Pays via MTN MoMo or Airtel Money; the order remains `AWAITING_PAYMENT` until the verified webhook promotes it to `PENDING` — see `Payment_Integration.md §6` |
| 7 | KDS | Ticket appears as `PHONE_DELIVERY` with destination zone `MARY STUART HALL`; the KDS does not show the phone, room note, or GPS |
| 8 | Chef | Advances `PENDING` → `PREPARING` → `READY`; BOM decrements as normal |
| 9 | System | Fires the delivery chit; the FOH Dispatch Queue shows `CALL`, `WHATSAPP`, `PRINT CHIT`, and `OPEN PIN` (if a pin exists) |
| 10 | FOH / Rider | Rider takes the bag; FOH records rider name, dispatch method, and any cash transport advance. Rider calls the customer from the chit |
| 11 | FOH | Marks the order `COMPLETED` on delivery; records `DELIVERED` handoff outcome and any returned change |
| 12 | Manager | If unreachable, records `FAILED_UNREACHABLE`, returns food to the outlet, and routes it through the surplus/waste log |

**Outcome:** The customer gets delivery without a live map, the rider gets a complete drop-off note and phone number, and the kitchen/manager retain a clean audit of the handoff.

---

## 3. State Transition Reference

```
AWAITING_PAYMENT ──(Verified payment)──► PENDING ──(Cook claims)──► PREPARING
       │                                    │                         │
       │                                    │                         ▼
       │                                    │                ┌─────────────┐
       │                                    │                │    READY    │
       │                                    │                └─────────────┘
       │                                    │                         │
       │                                    │                (Handed over)
       │                                    │                         ▼
       │                                    │                ┌─────────────┐
       │                                    │                │  COMPLETED  │
       │                                    │                └─────────────┘
       └──────────(Manager approval / payment TTL)────┴──────────────────────────────► CANCELLED
```

- `AWAITING_PAYMENT` is pre-kitchen and is never returned to a KDS queue.
- A dine-in table tab fired by authenticated FOH may start at `PENDING` (postpay exception). Every other order starts at `AWAITING_PAYMENT`.
- `CANCELLED` is only accessible by `MANAGER_ADMIN`, by `WAITER_FOH` only with manager phone + PIN approval, or by the payment-TTL cleanup job (`cancellation_reason = 'PAYMENT_TIMEOUT'`). The void must write to the append-only audit log, naming both the requesting user and the approving manager. If the order already has a `SUCCESSFUL` MTN, Airtel, or manual-MoMo payment, the same transaction moves it to `REFUND_PENDING` with `audit_flag = 'CANCELLED_AFTER_PAYMENT'` (or `'FAILED_DELIVERY'`); a cash-paid cancellation is a manager exception recorded in the audit log, because Phase 1 has no cash-refund ledger. See `Payment_Integration.md §8.3`.
- `COMPLETED` is a terminal state; no further transitions are permitted.
- `OVERDUE` is a **display flag only** (> 10 minutes in `PREPARING`) — it does not alter the state machine.
- Delivery does **not** add a fifth order status in Phase 1. The rider handoff is recorded in `delivery_handoffs` (`dispatched_at`, `delivered_at`, `outcome`, `rider_advance_ugx`, `rider_advance_returned_ugx`). The order stays `READY` while the rider is on the way, then becomes `COMPLETED` on delivery. Failed deliveries are resolved as `CANCELLED` with a manager-authorised reason and are logged; they are never marked `COMPLETED`.
- **Derived dispatch state:** For UI and reporting, a `READY` delivery order with an open handoff (`outcome = 'PENDING'`) is displayed as **ON THE WAY**, not as “waiting in kitchen.” Any dashboard that counts `READY` orders must apply this rule, or kitchen-readiness metrics will be inflated by bags that already left the building. This is a view rule, not a new `order_status` value.

## 4. Payment State Reference

> Full specification: **`Payment_Integration.md §4`**

```
INITIATED ──► PENDING_CUSTOMER_PIN ──(Webhook SUCCESS)──► SUCCESSFUL ──► [order.status = PENDING]
    │                 │
    │          (Webhook FAILED / timeout)
    │                 │
    │                 ▼
    │          FAILED / TIMED_OUT ──► [retry with a new attempt]
    │                 │
    │          (Payment TTL expires)
    │                 ▼
    │            order CANCELLED
    │
    └──(Late/duplicate success, or paid order cancelled)──► REFUND_PENDING ──► REFUNDED [manager confirms external reversal; never gross]
```

- The payment state machine lives in the `payments` table — DDL in `Payment_Integration.md §7`.
- A prepaid kitchen ticket (`order.status = PENDING`) is **never created** until payment reaches `SUCCESSFUL`. The exception is an authenticated dine-in table tab, which is postpay.
- The display token is reserved at order creation, not when the webhook arrives; this keeps `TOKEN-088` stable while the customer pays. Telco references use the globally unique `orders.public_ref`, never the reusable token.
- One `SUCCESSFUL` payment is allowed per order. A late or duplicate success, or a paid order cancelled after payment (including a failed delivery), becomes `REFUND_PENDING` with a reason and is excluded from gross collections until resolved. See `Payment_Integration.md §8.3`.
- `VERIFIED_MANUAL_MOMO` is a `payments.audit_flag`, not a payment status. It marks a cashier-verified manual USSD payment; the payment row still moves to `SUCCESSFUL`.
- For `PHONE_DELIVERY`, the STK amount includes the server-computed zone delivery fee. Validation of zone, note, recipient name, and phone happens before the payment record is created; a failed delivery validation never produces a payment prompt.


---

## 6. Exception Flows

These are the failure and edge-case paths that every developer must handle. Happy paths are not enough; each of these must have a corresponding test in `Seed_Data_and_Testing.md`.

---

### 6.1 Payment TTL Expiry — Customer Cannot Pay in Time

**Trigger:** Customer starts checkout, receives the USSD STK push, but does not approve within 45 seconds and the payment polling fallback also times out.

| Step | Actor | Action |
| :--- | :--- | :--- |
| 1 | System | STK push dispatched; countdown starts on the frontend (45 seconds) |
| 2 | Customer | Does not approve (network issue, wrong PIN, distracted) |
| 3 | System | Polling at 30 seconds returns `FAILED` or `TIMED_OUT`; payment record moves to `FAILED` |
| 4 | Frontend | Shows: *"Payment did not go through. Try again or use merchant code."* |
| 5 | Customer | Taps **"Try Again"** — a **new** payment attempt is created with a new idempotency key; the order stays `AWAITING_PAYMENT` |
| 6 | System | If the customer never retries and the payment TTL window expires, the order moves to `CANCELLED` automatically |
| 7 | Customer | Token page shows: *"Order #TOKEN-042 was cancelled. Place a new order."* |

> **Rule:** The display token (`TOKEN-042`) and `public_ref` are assigned at order creation. If the order is cancelled, that token is recycled by the daily token counter for the next day — it is never reissued within the same business day. A new order gets a new token.

---

### 6.2 Manager-Initiated Void / Cancellation

**Trigger:** A manager needs to cancel an order that is already `PENDING`, `PREPARING`, or `READY` — e.g., a customer called back to cancel, a menu item is unavailable, or a duplicate ticket was raised.

| Step | Actor | Action |
| :--- | :--- | :--- |
| 1 | Manager | Opens the order in `/admin/audit` or the live ticket queue |
| 2 | Manager | Taps **"Void Order"** — system prompts for manager phone + PIN (two-factor confirmation) |
| 3 | System | Validates PIN server-side against the hashed PIN for the `MANAGER_ADMIN` session |
| 4 | System | If order had a successful MoMo/Airtel payment: sets `payments.status → REFUND_PENDING`; attaches a void reason; order moves to `CANCELLED` |
| 5 | System | If order was a postpay dine-in tab with no payment yet: tab closes as `CANCELLED`; no payment action needed |
| 6 | System | `audit_log` records: actor user ID, order ID, old status, new status, void reason, timestamp |
| 7 | Manager | Completes the external MoMo reversal via the telco portal; returns and enters the telco reference in `/admin/refunds` |
| 8 | System | Manager taps **"Mark Refunded"**; `payments.status → REFUNDED`; `audit_log` records the reference |

> **Rule:** A void that moves a `SUCCESSFUL` payment to `REFUND_PENDING` is **excluded from gross collections** in the daily digest until resolved. The digest shows it as a flagged exception, not as income. See `Payment_Integration.md §8.3` and `Daily_Audit_Digest.md §4`.

---

### 6.3 Failed Delivery — Customer Unreachable

**Trigger:** Rider arrives at the delivery destination but cannot reach the customer (customer doesn't answer calls, wrong room note, security won't let the rider in).

| Step | Actor | Action |
| :--- | :--- | :--- |
| 1 | Rider | Calls the customer using the phone number on the chit — no answer after 2 attempts |
| 2 | FOH | Calls the customer from the dispatch queue (**CALL** button on `/pos/dispatch`) — no answer |
| 3 | FOH | Optionally opens **WHATSAPP** (`wa.me` link) with a message — still no response after 5 minutes |
| 4 | FOH | Selects **"Customer Unreachable"** from the dispatch outcome dropdown |
| 5 | System | Records handoff outcome as `FAILED_UNREACHABLE`; timestamps the failure; flags the order for manager review |
| 6 | FOH | Rider returns the food to the outlet; rider records how much of any cash transport advance was used and returns the balance |
| 7 | Manager | Reviews the flagged order in `/admin/audit`; decides one of: (a) re-attempt delivery, (b) customer collects in person, (c) food disposed — logs the outcome |
| 8 | Manager | If payment was already collected (MoMo): decides whether to issue a refund or not; if refund — follows void flow in §6.2 |

> **Rule:** An order is **never falsely marked `COMPLETED`** when delivery failed. The system must not auto-complete delivery orders based on a timer. A human FOH actor must record the outcome. The manager's `/admin/audit` screen must surface all `FAILED_UNREACHABLE` orders from the last 24 hours.

---

### 6.4 Printer Offline at Expo — Chit Not Printed

**Trigger:** When a KDS Expo operator bumps an order to `READY`, the ESC/POS TCP socket to port 9100 times out or is refused.

| Step | Actor | Action |
| :--- | :--- | :--- |
| 1 | System | Attempts TCP connection to `192.168.1.200:9100`; connection times out after 3 seconds |
| 2 | System | Logs the error: `PRINT_FAILED — order_id, token, timestamp, error_message` |
| 3 | System | **Order status still advances to `READY`.** The print failure does not hold the kitchen flow hostage. |
| 4 | KDS Expo Screen | Shows a visible **"⚠ Chit print failed — Re-print"** button on the ticket card |
| 5 | Expo Operator | Fixes the printer (power cycle, cable check) and taps **Re-print** |
| 6 | System | Retries the print job; logs success or failure |
| 7 | Manager | Printer failures are surfaced in the admin hardware-status panel; repeated failures trigger an SMS alert |

> **Rule:** Never block order state progression on a printer. The printer is a convenience device, not the order of truth. The system state — `order.status = READY` — is always the authority.

---

### 6.5 Duplicate Webhook — MoMo/Airtel Fires Twice

**Trigger:** Telecom sends the `SUCCESSFUL` webhook callback more than once for the same transaction (retry behavior common with MTN/Airtel).

| Step | Actor | Action |
| :--- | :--- | :--- |
| 1 | MTN/Airtel | Sends `POST /api/v1/webhooks/momo` with `X-Reference-Id: <uuid>` — first delivery |
| 2 | System | Checks `payment_events` table for this `X-Reference-Id`; not found → processes normally |
| 3 | System | Sets `payments.status → SUCCESSFUL`; promotes order to `PENDING`; fires KDS ticket |
| 4 | System | Inserts a row into `payment_events` with this `X-Reference-Id` and result `PROCESSED` |
| 5 | MTN/Airtel | Sends the same webhook again (duplicate) |
| 6 | System | Checks `payment_events` — finds the `X-Reference-Id` already processed |
| 7 | System | Returns `200 OK` immediately (telco must not see a failure that causes further retries) |
| 8 | System | Does **not** create a second KDS ticket, does **not** change any order or payment status |

> **Rule:** The idempotency engine in `payment_events` is the gatekeeper. A duplicate webhook must always return `200 OK` — returning 4xx or 5xx causes the telco to retry again, compounding the problem. See `Payment_Integration.md §6`.
