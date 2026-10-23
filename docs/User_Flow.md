# End-to-End User Workflows & State Progression

**Reference:** PRD Section 3 (Workflows A, B, and C)  
**Related Files:** `Foundational_Concept.md` · `Tech_Stack.md` (DDL) · `Payment_Integration.md` (checkout & webhook detail)

---

## 1. Master Ticket Lifecycle (PRD Compliant)

```
[ CUSTOMER PRE-ORDER ]                      [ WAITER TABLE ORDER ]
             │                                        │
             ▼                                        ▼
  (Payment: INITIATED)                      (Waiter Fires Tab)
  (MoMo Webhook: SUCCESSFUL)                         │
  └─ See Payment_Integration.md §§4–6               │
             │                                        │
             └──────────────────┬─────────────────────┘
                                │
                               ▼
                        ┌─────────────┐
                        │  1. PENDING │
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
          (Customer Notified / Token Flashes on Screen)
                               │
                 (Expediter Hands Over Meal)
                               │
                               ▼
                       ┌─────────────┐
                       │ 4. COMPLETED│
                       └─────────────┘
```

> **Normalised State Machine:** Every order — regardless of channel — passes through exactly these four states. There are no shortcut or skip transitions permitted outside of `CANCELLED`.
> 
> **Payment Pre-Condition:** Pre-order tickets enter `PENDING` **only after** the payment reaches `SUCCESSFUL` status. The idempotency engine in `Payment_Integration.md §6` prevents duplicate tickets if a telco webhook is retried.

---

## 2. Detailed Channel Scenarios

### Flow A: Customer Mobile Pre-Order & Queue Bypass

| Step | Actor | Action |
| :--- | :--- | :--- |
| 1 | Customer | Scans Foodizo Ham Towers QR code or opens saved bookmark |
| 2 | Customer | Adds `1x Fried Chicken & Chips` (UGX 14,000) + `1x Fresh Passion Juice` (UGX 4,000) |
| 3 | Customer | Selects fulfillment type: `PRE_ORDER_PICKUP` |
| 4 | Customer | Inputs MTN MoMo number (`077XXXXXXX`) → taps **"Pay Now"** |
| 5 | System | MSISDN normalised to E.164 (`25677XXXXXXX`); carrier detected as MTN |
| 6 | System | `POST /collection/v1_0/requesttopay` dispatched with `X-Reference-Id` (idempotency key); payment record status → `INITIATED` |
| 7 | Customer | USSD prompt arrives on handset: *"Approve UGX 18,000 for Foodizo? Enter PIN"*; frontend shows 45s countdown |
| 8 | Customer | Enters MoMo PIN on handset |
| 9 | System | MTN webhook fires: `status: SUCCESSFUL` → idempotency guard checks → order promoted to `PENDING` → `TOKEN #088` issued *(see `Payment_Integration.md §6`)* |
| 10 | KDS | Order appears on Station 2 (Fryer) with amber badge: `TAKEAWAY — TOKEN #088` |
| 11 | Chef Juma | Advances: `PENDING` → `PREPARING` → `READY` |
| 12 | System | Push notification sent: *"Token #088 is ready at the Express Counter!"* |
| 13 | Customer | Walks past register queue → shows `TOKEN #088` → collects bag → departs |

**Outcome:** Zero counter queue time. Order fulfilled in < 7 minutes from payment webhook confirmation. Duplicate KDS tickets are prevented by idempotency keys — see `Payment_Integration.md §6`.

---

### Flow B: Obunuzi Table-Side Service & Channel Merging

| Step | Actor | Action |
| :--- | :--- | :--- |
| 1 | Prossy N. | Views Table Occupancy Grid → taps `Table 4` (`VACANT` → `OCCUPIED`) |
| 2 | Prossy N. | Selects `2x Beef Luwombo`, `2x Matooke`, `2x Water`. Adds note: *"Sauce hot"* |
| 3 | Prossy N. | Taps **"Send to Kitchen"** |
| 4 | KDS | Order appears on Station 1 (Steam Line): `DINE_IN — TABLE 4` (blue badge) → `PENDING` |
| 5 | Cashier | Takes phone order: `1x Beef Luwombo Takeaway` for Dr. Okello |
| 6 | KDS | Second ticket appears: `PHONE_DELIVERY — DR. OKELLO` (purple badge) → `PENDING` |
| 7 | Cook | KDS shows both tickets chronologically. Cook prepares both Luwombo portions together. |
| 8 | Cook | Advances both tickets: `PREPARING` → `READY` |
| 9 | Prossy N. | Tablet shows Table 4 order as `READY` → serves plated meal |
| 10 | System | Delivery ticket triggers notification to cashier for driver dispatch |

**Outcome:** Zero duplicate prep. Table-side and phone channel harmonised in one shared queue.

---

### Flow C: Real-Time Inventory & Closing Surplus Routine

#### C1. Real-Time BOM Decrement (Triggered at `PREPARING`)

When `TOKEN #088` advances to `PREPARING`, the BOM engine automatically decrements:

| Ingredient | Amount Deducted | Unit |
| :--- | :--- | :--- |
| Raw Broiler Chicken | 1 | piece |
| Potatoes (pre-cut chips) | 250 | grams |
| Mukwano Cooking Oil | 30 | ml |

#### C2. Low-Stock Threshold Alert

1. Cooking oil stock drops below **5.0 Liters**.
2. System pushes SMS + Dashboard alert to **Zito Mbowe**:  
   > *"⚠️ Warning: Mukwano Cooking Oil below reorder point at Ham Towers. Current: 4.7L / Threshold: 5.0L."*
3. Manager can acknowledge and trigger a purchase order from the Manager Portal.

#### C3. Closing Surplus Log — 9:00 PM EOD Routine

1. Kitchen supervisor opens **Manager Portal → "End-of-Day Surplus Log"**.
2. System pre-populates with remaining cooked batch quantities:

   | Item | Leftover Portions |
   | :--- | :--- |
   | Beef Luwombo | 4 portions |
   | Steamed Matooke | 6 portions |
   | Rolex (Egg + Chapati) | 3 portions |

3. Supervisor selects resolution for each item:

   | Resolution Code | Meaning |
   | :--- | :--- |
   | `DISCOUNTED_CLEARANCE_SOLD` | Sold at reduced price before closing |
   | `STAFF_MEAL` | Consumed by kitchen/service staff |
   | `WASTE_DISCARDED` | Disposed of — triggers waste metric |

4. Log appends to **Predictive Sales Engine** to compute lower batch prep targets for the following day, reducing food cost variance.

---

## 3. State Transition Reference

```
PENDING  ──(Cook Claims)──►  PREPARING  ──(Cook Bumps)──►  READY  ──(Handed Over)──►  COMPLETED
   │                              │                           │
   └────────(Manager Cancel)──────┴────────────────────────────┴──────►  CANCELLED
```

- `CANCELLED` is only accessible by `MANAGER_ADMIN` or `WAITER_FOH` roles.
- `COMPLETED` is a terminal state; no further transitions are permitted.
- `OVERDUE` is a **display flag only** (> 10 minutes in `PREPARING`) — it does not alter the state machine.

## 4. Payment State Reference

> Full specification: **`Payment_Integration.md §4`**

```
INITIATED ──► PENDING_CUSTOMER_PIN ──(Webhook SUCCESS)──► SUCCESSFUL ──► [order.status = PENDING]
                    │
             (45s Timeout)
                    │
                    ► TIMED_OUT / FAILED ──► [Show USSD Fallback UI]
```

- The payment state machine lives in the `payments` table — DDL in `Payment_Integration.md §7`.
- A KDS ticket (`order.status = PENDING`) is **never created** until payment reaches `SUCCESSFUL`.
- `VERIFIED_MANUAL_MOMO` is set as `payments.audit_flag` when a cashier manually confirms a USSD counter payment.
