# Payment Integration Specification: MTN Mobile Money & Airtel Money Engine

**Target Outlets:** Foodizo (Ham Towers) & Obunuzi Restaurant & Cafe (Opposite YMCA)<br>
**Location:** Kampala, Uganda<br>
**Currency:** Ugandan Shilling (UGX)<br>
**Author:** Lead Technical Product Manager & System Architect<br>
**Target Environment:** Antigravity IDE + Opencode CLI Repository Scaffold<br>
**Related Files:** `Foundational_Concept.md` · `Design_System.md` · `User_Flow.md` · `User_Profiles_Personas.md` · `Delivery_Zones_and_Dispatch.md` · `Tech_Stack.md` · `Hardware_and_Peripherals.md` · `Seed_Data_and_Testing.md` · `Repo_Scaffold_and_Config.md` · `Demo_Script_and_Closing_Strategy.md` · `Daily_Audit_Digest.md` · `Deployment_Runbook.md` · `Service_Contract_and_Invoice_Template.md` · `Implementation_Phases.md`

---

## 1. Overview & Payment Landscape

In the Wandegeya/Makerere corridor, over **85%** of cashless transactions occur via two telecom networks:

| Carrier | MSISDN Prefixes | API |
| :--- | :--- | :--- |
| **MTN Uganda** | `25677`, `25678`, `25676` | MTN MoMo Open API (Collections v1.0) |
| **Airtel Uganda** | `25670`, `25675`, `25674` | Airtel Money OpenAPI (Merchant Pay v2.0) |

This module manages the end-to-end payment lifecycle:
- Initiating automated USSD STK pushes to customer handsets
- Processing non-blocking asynchronous webhooks
- Running polling fallbacks during telecom downtime
- Locking against duplicate charges via idempotency tokens
- Generating verified financial receipts **before** firing tickets to the KDS
- Charging the server-computed delivery fee as part of the order total for `PHONE_DELIVERY`

> **Payment gate:** A prepaid request to `POST /api/v1/orders` creates the order as `AWAITING_PAYMENT` and a payment row as `INITIATED`. The order becomes `PENDING` — the first state visible to the KDS — **only** after a verified `SUCCESSFUL` payment. A failed or timed-out payment leaves the order in `AWAITING_PAYMENT` for a retry and is auto-cancelled after the payment TTL. The single exception is an authenticated FOH dine-in **POSTPAY** tab, which enters `PENDING` immediately and is settled at bill close; this exception is not available to customer-app, QR, or delivery orders. See `User_Flow.md §2 Flow A` and `Payment_Integration.md §6` for the promotion handler; `Tech_Stack.md §5` shows the downstream KDS status handler.

> **Delivery fee rule:** For delivery orders, `amountUgx` is `subtotal + delivery_fee_ugx`, where the fee is resolved from the active `delivery_zones` row on the server. The client never supplies a trusted fee. Zone, room note, recipient name, and rider-callable phone must validate **before** the order and payment record are created. See `Delivery_Zones_and_Dispatch.md §4` and `Tech_Stack.md §4`.

---

## 2. Master Payment Architecture

```
[ CUSTOMER / WAITER CLIENT ]
             │
  (Initiates Checkout — subtotal + delivery fee + phone)
             │
             ▼
┌────────────────────────────────────────┐
│       PAYMENT GATEWAY CONTROLLER       │
│  - Server-side menu price + fee total  │
│  - Order created: AWAITING_PAYMENT     │
│  - Daily display token + public_ref    │
│  - MSISDN normalization to E.164       │
│  - Telco Detection (MTN vs AIRTEL)     │
│  - Idempotency UUIDv4 token assigned   │
│  - Payment record created: INITIATED   │
└──────────────────┬─────────────────────┘
                   │
       ┌───────────┴───────────┐
(MTN)  │                       │  (Airtel)
       ▼                       ▼
┌────────────────────┐  ┌────────────────────┐
│  MTN MOMO OPEN API │  │  AIRTEL MONEY API  │
│  POST /requesttopay│  │  POST /merchant/   │
│                    │  │        v2/payments/│
└─────────┬──────────┘  └────────┬───────────┘
          └──────────┬───────────┘
                     │
         (USSD STK Push to Handset)
                     │
                     ▼
         [ CUSTOMER PHONE PROMPT ]
          "Approve UGX 14,000 for
          Foodizo? Enter MoMo PIN"
                     │
                     ▼
       ┌─────────────────────────────┐
       │    INBOUND WEBHOOK RECEIVER │
       │  - Provider credential      │
       │  - IP allowlist check       │
       │  - Idempotency lock check   │
       └──────────────┬──────────────┘
                      │
                      ▼
       ┌─────────────────────────────┐
       │       PAYMENT SETTLED       │
       │  payment.status → SUCCESSFUL│
       │  order.status:              │
       │    AWAITING_PAYMENT → PENDING│ ←── Fires to KDS via Redis
       │  display token already      │
       │  reserved at order creation │
       └─────────────────────────────┘
```

---

## 3. Telco Routing & MSISDN Normalisation

Before initiating a push, all Ugandan phone numbers must be sanitised into standard `E.164` format (no leading zeros, no `+` prefix):

```typescript
// Utility: Normalize and Detect Ugandan Telecom Operator
// Location: src/server/utils/msisdn-validator.ts

export type TelecomCarrier = 'MTN' | 'AIRTEL' | 'UNKNOWN';

export function parseUgandanMsisdn(rawInput: string): {
  normalized: string;
  carrier: TelecomCarrier;
} {
  let cleaned = rawInput.replace(/\D/g, ''); // Strip all non-digit characters

  // Convert 07XXXXXXXX (10 digits) → 2567XXXXXXXX (12 digits)
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    cleaned = '256' + cleaned.substring(1);
  }

  if (!cleaned.startsWith('256') || cleaned.length !== 12) {
    return { normalized: '', carrier: 'UNKNOWN' };
  }

  const prefix = cleaned.substring(0, 5); // e.g., '25677', '25670'

  if (['25677', '25678', '25676'].includes(prefix)) {
    return { normalized: cleaned, carrier: 'MTN' };
  }
  if (['25670', '25675', '25674'].includes(prefix)) {
    return { normalized: cleaned, carrier: 'AIRTEL' };
  }

  return { normalized: cleaned, carrier: 'UNKNOWN' };
}
```

---

## 4. Payment State Machine & Timeout Strategy

```
[ INITIATED ]
      │
(STK Push Dispatched to Handset)
      │
      ▼
[ PENDING_CUSTOMER_PIN ] ◄─────────────────────┐
      │                  │                      │
(Webhook: SUCCESS)  (30s → Poll Telco API)  (45s Timeout)
      │                  │                      │
      ▼                  └──────────────────────┘
[ SUCCESSFUL ]                  │
      │                         ▼
(Order AWAITING_PAYMENT    [ TIMED_OUT ]
 → PENDING → KDS)               │
                                ▼
                         [ FAILED / CANCELLED ]
                         (Order stays AWAITING_PAYMENT
                          for retry, then auto-cancels)
```

**Order-state rule:** payment status and order status are separate. A failed or timed-out payment does **not** cancel the order immediately; the customer may retry with a new payment attempt. The order remains `AWAITING_PAYMENT` until a success promotes it to `PENDING`, or until the payment TTL expires and a cleanup job marks it `CANCELLED` with `cancellation_reason = 'PAYMENT_TIMEOUT'`. A late success after cancellation must be flagged for refund, never silently pushed to the KDS. For a customer-app `TAKEAWAY_PICKUP`, the payer MSISDN is stored as `orders.customer_phone` at creation so the READY SMS has a destination; a cash walk-in without a phone has no number and no SMS.

### The 45-Second Rule & Polling Fallback

In Kampala, USSD network congestion causes pushes to take **10–25 seconds** to appear on handsets, and webhook callbacks can experience brief carrier delays.

| Time | System Action |
| :--- | :--- |
| `T+0s` | STK push dispatched; frontend shows 45-second countdown: *"Check your phone to enter your PIN"* |
| `T+30s` | If no webhook received, backend polls: `GET /collection/v1_0/requesttopay/{referenceId}` |
| `T+45s` | If still `PENDING`, UI transitions: *"Did not receive a prompt? [Retry Push] or [Pay at Counter]"* |

---

## 5. API Implementation Contracts

### 5.1 MTN MoMo Open API (Collection v1.0)

| Endpoint | Method | Purpose |
| :--- | :--- | :--- |
| `/collection/token/` | `POST` | Obtain Bearer token (Basic Auth: API User + API Key) |
| `/collection/v1_0/requesttopay` | `POST` | Initiate USSD STK push → returns `202 Accepted` |
| `/collection/v1_0/requesttopay/{X-Reference-Id}` | `GET` | Poll transaction status |

```typescript
// Service: MTN MoMo STK Push
// Location: src/server/services/momo-service.ts

import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

export async function requestMtnPayment(payload: {
  amountUgx: number;
  phone: string;          // E.164 normalised, e.g., '256770000000'
  orderNumber: string;    // globally unique orders.public_ref, e.g., 'ORD-7F3C2A9D4B11'
  bearerToken: string;
}): Promise<{ referenceId: string; httpStatus: number }> {
  const referenceId = uuidv4(); // Acts as idempotency key

  const response = await axios.post(
    `${process.env.MOMO_BASE_URL}/collection/v1_0/requesttopay`,
    {
      amount: payload.amountUgx.toString(),
      currency: 'UGX',
      externalId: payload.orderNumber,
      payer: { partyIdType: 'MSISDN', partyId: payload.phone },
      payerMessage: `Foodizo Order ${payload.orderNumber}`,
      payeeNote: 'Foodizo / Obunuzi Wandegeya',
    },
    {
      headers: {
        'Authorization': `Bearer ${payload.bearerToken}`,
        'X-Reference-Id': referenceId,
        'X-Target-Environment': process.env.MOMO_TARGET_ENV, // 'sandbox' | 'production'
        'Ocp-Apim-Subscription-Key': process.env.MOMO_SUBSCRIPTION_KEY,
        'Content-Type': 'application/json',
      },
    }
  );

  return { referenceId, httpStatus: response.status }; // Expect 202 Accepted
}
```

### 5.2 Airtel Money OpenAPI (Merchant Collection v2)

| Endpoint | Method | Purpose |
| :--- | :--- | :--- |
| `/auth/oauth2/token` | `POST` | Obtain Bearer token (client_credentials flow) |
| `/merchant/v2/payments/` | `POST` | Initiate merchant collection push |

**Required Headers:** `X-Country: UG`, `X-Currency: UGX`, `Authorization: Bearer <token>`

```json
// Airtel Push Request Body
{
  "reference": "ORD-7F3C2A9D4B11",
  "subscriber": {
    "country": "UG",
    "currency": "UGX",
    "msisdn": "256700000000"
  },
  "transaction": {
    "amount": 14000,
    "country": "UG",
    "currency": "UGX",
    "id": "PAY-UUID-987654"
  }
}
```

---

## 6. Webhook Processing & Idempotency Engine

Telcos may retry webhook deliveries. The idempotency guard prevents duplicate tickets being fired to the KDS.

```typescript
// Fastify Route: POST /api/v1/payments/webhook
// Location: src/server/routes/payments.ts

import type { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../plugins/prisma';
import { redisPublisher } from '../plugins/redis';

type PaymentWebhookPayload = {
  provider: 'MTN' | 'AIRTEL';
  eventId?: string;             // telco event id, if supplied
  referenceId: string;          // X-Reference-Id / payments.idempotency_key
  status: 'SUCCESSFUL' | 'FAILED';
  financialTransactionId?: string;
};

type WebhookResult =
  | 'ACKNOWLEDGED'
  | 'ALREADY_PROCESSED'
  | 'FAILED_RECORDED'
  | 'IGNORED_TERMINAL'
  | 'LATE_PAYMENT_REQUIRES_REFUND'
  | 'NOT_FOUND';

export async function handlePaymentWebhook(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const payload = request.body as PaymentWebhookPayload;
  // The route preflight verifies the provider callback credential and source
  // allowlist before this handler runs; see §10. Use an HMAC check only where
  // the provider actually supplies a signature.
  const eventId =
    payload.eventId ??
    `${payload.referenceId}:${payload.status}:${payload.financialTransactionId ?? ''}`;

  let result: WebhookResult = 'ACKNOWLEDGED';
  let broadcastOrder: {
    orderId: string;
    digitalToken: string;
    channel: string;
    status: string;
    tableId: string | null;
    deliveryZoneId: string | null;
  } | null = null;

  await prisma.$transaction(async (tx) => {
    const payment = await tx.payments.findUnique({
      where: { idempotency_key: payload.referenceId },
    });

    if (!payment) {
      result = 'NOT_FOUND';
      return;
    }

    // ── 1. Durable event dedupe. provider + event_id is UNIQUE. ────────────
    // Two concurrent deliveries of the same callback: exactly one INSERT wins;
    // the loser gets P2002 and returns 200 without side effects.
    try {
      await tx.payment_events.create({
        data: {
          payment_id: payment.id,
          provider: payload.provider,
          event_id: eventId,
          payload_json: payload,
        },
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        result = 'ALREADY_PROCESSED';
        return;
      }
      throw error;
    }

    // ── 2. Serialize all state changes for this payment. ──────────────────
    await tx.$queryRaw`SELECT id FROM payments WHERE id = ${payment.id} FOR UPDATE`;
    const locked = await tx.payments.findUniqueOrThrow({
      where: { id: payment.id },
    });

    if (locked.status === 'SUCCESSFUL' || locked.status === 'REFUND_PENDING') {
      result = 'ALREADY_PROCESSED';
      return;
    }

    if (locked.status === 'CANCELLED') {
      // The attempt was explicitly cancelled. A success after that is money
      // received but not a valid order; send it to the refund queue.
      if (payload.status === 'SUCCESSFUL') {
        await tx.payments.update({
          where: { id: payment.id },
          data: {
            status: 'REFUND_PENDING',
            external_transaction_id: payload.financialTransactionId,
            completed_at: new Date(),
            audit_flag: 'LATE_PAYMENT_AFTER_CANCEL',
          },
        });
        result = 'LATE_PAYMENT_REQUIRES_REFUND';
      } else {
        result = 'IGNORED_TERMINAL';
      }
      return;
    }

    if (payload.status === 'SUCCESSFUL') {
      // Lock the order as well as the payment. This serializes two different
      // payment attempts for the same order and makes the prior-success check
      // reliable.
      await tx.$queryRaw`SELECT id FROM orders WHERE id = ${payment.order_id} FOR UPDATE`;

      const order = await tx.orders.findUnique({
        where: { id: payment.order_id },
      });

      if (!order) {
        result = 'NOT_FOUND';
        return;
      }

      if (order.status === 'CANCELLED') {
        // Money arrived after the order expired. Record it as refundable;
        // never resurrect the KDS ticket.
        await tx.payments.update({
          where: { id: payment.id },
          data: {
            status: 'REFUND_PENDING',
            external_transaction_id: payload.financialTransactionId,
            completed_at: new Date(),
            audit_flag: 'LATE_PAYMENT_AFTER_CANCEL',
          },
        });
        result = 'LATE_PAYMENT_REQUIRES_REFUND';
        return;
      }

      const priorSuccess = await tx.payments.findFirst({
        where: {
          order_id: payment.order_id,
          status: 'SUCCESSFUL',
          id: { not: payment.id },
        },
      });

      if (priorSuccess) {
        await tx.payments.update({
          where: { id: payment.id },
          data: {
            status: 'REFUND_PENDING',
            external_transaction_id: payload.financialTransactionId,
            completed_at: new Date(),
            audit_flag: 'DUPLICATE_SUCCESS_REQUIRES_REFUND',
          },
        });
        result = 'LATE_PAYMENT_REQUIRES_REFUND';
        return;
      }
    }

    if (payload.status === 'FAILED') {
      const failed = await tx.payments.updateMany({
        where: {
          id: payment.id,
          status: { in: ['INITIATED', 'PENDING_CUSTOMER_PIN'] },
        },
        data: { status: 'FAILED', failure_reason: 'TELCO_CALLBACK_FAILED' },
      });
      result = failed.count === 1 ? 'FAILED_RECORDED' : 'IGNORED_TERMINAL';
      return;
    }

    // ── 3. Success: conditional update prevents a double-success race. ────
    const paid = await tx.payments.updateMany({
      where: {
        id: payment.id,
        status: { in: ['INITIATED', 'PENDING_CUSTOMER_PIN', 'FAILED', 'TIMED_OUT'] },
      },
      data: {
        status: 'SUCCESSFUL',
        external_transaction_id: payload.financialTransactionId,
        completed_at: new Date(),
      },
    });

    if (paid.count !== 1) {
      result = 'IGNORED_TERMINAL';
      return;
    }

    // ── 4. Promote only an AWAITING_PAYMENT order. ────────────────────────
    const promoted = await tx.orders.updateMany({
      where: { id: payment.order_id, status: 'AWAITING_PAYMENT' },
      data: { status: 'PENDING' },
    });

    if (promoted.count !== 1) {
      const order = await tx.orders.findUniqueOrThrow({
        where: { id: payment.order_id },
      });

      if (order.status === 'CANCELLED') {
        // Safety net for a cancellation racing the promotion. Move the money
        // to REFUND_PENDING; do not leave a successful payment on a dead order.
        await tx.payments.update({
          where: { id: payment.id },
          data: {
            status: 'REFUND_PENDING',
            audit_flag: 'LATE_PAYMENT_AFTER_CANCEL',
          },
        });
        result = 'LATE_PAYMENT_REQUIRES_REFUND';
        return;
      }

      // Already PENDING or further along: this is a valid POSTPAY/bill-close
      // settlement or a success that raced a promotion. The payment was
      // recorded above; there is no new KDS ticket to broadcast.
      result = 'ACKNOWLEDGED';
      return;
    }

    const order = await tx.orders.findUniqueOrThrow({
      where: { id: payment.order_id },
    });

    broadcastOrder = {
      orderId: order.id,
      digitalToken: order.digital_token,
      channel: order.channel,
      status: order.status,
      tableId: order.table_id,
      deliveryZoneId: order.delivery_zone_id,
    };

    result = 'ACKNOWLEDGED';
  });

  // Broadcast only after the transaction commits. Redis is a latency
  // optimization: the KDS also loads PENDING orders on reconnect, so a failed
  // publish must not cause the telco to retry a payment that already settled.
  if (broadcastOrder) {
    try {
      await redisPublisher.publish('KDS_NEW_ORDER', JSON.stringify(broadcastOrder));
    } catch (error) {
      request.log.error({ error, orderId: broadcastOrder.orderId }, 'KDS publish failed');
    }
  }

  if (result === 'NOT_FOUND') {
    reply.status(404).send({ error: 'Transaction reference not found' });
    return;
  }

  reply.status(200).send({ status: result });
}
```

---

## 7. PostgreSQL Payments Table (DDL Extension)

This table extends the schema in `Tech_Stack.md §3`. Add after the `orders` table:

```sql
-- ============================================================
-- PAYMENTS REGISTER (Extends Tech_Stack.md DDL)
-- ============================================================
CREATE TYPE payment_status AS ENUM (
    'INITIATED',
    'PENDING_CUSTOMER_PIN',
    'SUCCESSFUL',
    'FAILED',
    'TIMED_OUT',
    'CANCELLED',
    'REFUND_PENDING',
    'REFUNDED'
);

CREATE TYPE payment_carrier AS ENUM ('MTN', 'AIRTEL', 'CASH', 'MANUAL_MOMO');

CREATE TABLE payments (
    id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id                 UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    idempotency_key          VARCHAR(36) UNIQUE NOT NULL, -- UUIDv4, sent as X-Reference-Id
    carrier                  payment_carrier NOT NULL,
    customer_msisdn          VARCHAR(20),                 -- E.164; NULL only for CASH
    amount_ugx               NUMERIC(10, 2) NOT NULL,
    status                   payment_status NOT NULL DEFAULT 'INITIATED',
    external_transaction_id  VARCHAR(100),                -- Telco's own TxID
    audit_flag               VARCHAR(50),                 -- e.g., 'VERIFIED_MANUAL_MOMO'
    failure_reason           TEXT,
    recorded_by              UUID REFERENCES users(id) ON DELETE SET NULL, -- cashier for CASH/MANUAL_MOMO
    manual_verified_by       UUID REFERENCES users(id) ON DELETE SET NULL,
    manual_verified_at       TIMESTAMP WITH TIME ZONE,
    initiated_at             TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at             TIMESTAMP WITH TIME ZONE,
    refunded_at              TIMESTAMP WITH TIME ZONE,
    refund_reference         VARCHAR(100),

    CONSTRAINT payments_amount_positive CHECK (amount_ugx > 0),
    CONSTRAINT payments_msisdn_required CHECK (
        carrier = 'CASH' OR customer_msisdn IS NOT NULL
    ),
    CONSTRAINT payments_msisdn_format CHECK (
        customer_msisdn IS NULL OR customer_msisdn ~ '^256[0-9]{9}$'
    ),
    CONSTRAINT payments_manual_verification_paired CHECK (
        (manual_verified_by IS NULL) = (manual_verified_at IS NULL)
    ),
    CONSTRAINT payments_refund_complete CHECK (
        status <> 'REFUNDED' OR (refunded_at IS NOT NULL AND refund_reference IS NOT NULL)
    )
);

-- One successful payment per order. A second success is a duplicate charge
-- that must be refunded, not a second KDS ticket.
CREATE UNIQUE INDEX payments_one_success_per_order
    ON payments (order_id)
    WHERE status = 'SUCCESSFUL';

-- The same telco transaction ID must not settle two different payments.
CREATE UNIQUE INDEX payments_external_tx_unique
    ON payments (carrier, external_transaction_id)
    WHERE external_transaction_id IS NOT NULL;

CREATE INDEX idx_payments_order ON payments (order_id);
CREATE INDEX idx_payments_completed
    ON payments (carrier, completed_at)
    WHERE status = 'SUCCESSFUL';

CREATE TABLE payment_events (
    id            BIGSERIAL PRIMARY KEY,
    payment_id    UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    provider      VARCHAR(20) NOT NULL,
    event_id      VARCHAR(180) NOT NULL,
    payload_json  JSONB NOT NULL,
    received_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT payment_events_unique UNIQUE (provider, event_id),
    CONSTRAINT payment_events_provider_valid CHECK (
        provider IN ('MTN', 'AIRTEL', 'CASH', 'MANUAL_MOMO')
    )
);

COMMENT ON COLUMN payments.idempotency_key IS
    'UUIDv4 sent as X-Reference-Id to the telco. It identifies the payment attempt, not the reusable display token.';
COMMENT ON COLUMN payments.amount_ugx IS
    'For PHONE_DELIVERY, includes the server-computed delivery fee from delivery_zones.';
COMMENT ON COLUMN payments.audit_flag IS
    'Set to VERIFIED_MANUAL_MOMO for counter verification, LATE_PAYMENT_AFTER_CANCEL or DUPLICATE_SUCCESS_REQUIRES_REFUND for late money, or CANCELLED_AFTER_PAYMENT / FAILED_DELIVERY when a paid order is cancelled.';
COMMENT ON COLUMN payments.refunded_at IS
    'Set when a manager closes a REFUND_PENDING payment after completing the reversal in the telco merchant app. REFUNDED is terminal and excluded from gross collections.';
COMMENT ON COLUMN payments.refund_reference IS
    'Telco reversal reference or merchant-app confirmation code supplied by the manager. Not a provider API response; Phase 1 refunds are manual.';
COMMENT ON TABLE payment_events IS
    'Durable webhook dedupe ledger. provider + event_id is unique; concurrent duplicates are acknowledged without a second state change.';
```

---

## 8. In-Store Manual USSD Fallback Mode

When telecom APIs experience downtime or signal drops inside Ham Towers basement or Obunuzi back rooms:

**Step 1 — App renders fallback UI:**

```
┌────────────────────────────────────────────┐
│         PAY MANUALLY WITH MOMO             │
├────────────────────────────────────────────┤
│  MTN:    Dial  *165*3*242424#              │
│  Airtel: Dial  *185*9*121212#              │
│  Reference:    ORD-7F3C2A9D4B11            │
├────────────────────────────────────────────┤
│  Then show your SMS receipt to the cashier │
└────────────────────────────────────────────┘
```

**Step 2 — Cashier manual verification:**
1. Customer shows the telco SMS receipt at the counter.
2. Cashier taps **"Verify MoMo Transaction"** on their terminal.
3. Cashier enters the **full transaction ID** (or, if the receipt truncates it, the last **six** characters) plus the amount and payer phone. Four digits alone are not sufficient; they collide too easily and invite fraud.
4. The service checks the receipt against the order's `public_ref`, amount, and phone, creates a `payments` row with `carrier = 'MANUAL_MOMO'`, `status = 'SUCCESSFUL'`, the payer MSISDN, the full (or last-six) transaction ID, `manual_verified_by`, `manual_verified_at`, and `audit_flag = 'VERIFIED_MANUAL_MOMO'`. If the order is `AWAITING_PAYMENT`, it promotes the order to `PENDING`; if the order is already `PENDING` or later (a POSTPAY tab), it leaves kitchen status unchanged. If the order already has a `SUCCESSFUL` payment, the verified manual payment becomes `REFUND_PENDING` with `audit_flag = 'DUPLICATE_SUCCESS_REQUIRES_REFUND'` instead of creating a second success. The verification is audit-logged.

| Merchant Code | Outlet | Carrier |
| :--- | :--- | :--- |
| `*165*3*242424#` | Foodizo Ham Towers | MTN |
| `*185*9*121212#` | Obunuzi YMCA | Airtel |

> These are example merchant codes, not universal dial strings. Confirm a working manual code for **each carrier the outlet accepts**. Do not assume the Foodizo MTN code works at Obunuzi, or that one outlet’s Airtel code covers MTN customers. Record the confirmed codes in the outlet’s go-live checklist.

### 8.1 Cash, manual MoMo, and POSTPAY settlement

A cash sale is a real payment method, not a missing payment. Use `POST /api/v1/orders/:id/settle` (`WAITER_FOH` or `MANAGER_ADMIN`):

```json
{
  "carrier": "CASH",
  "amountUgx": 18000,
  "customerMsisdn": null,
  "externalTransactionId": null
}
```

- `CASH` and `MANUAL_MOMO` settle immediately as `SUCCESSFUL`; `MANUAL_MOMO` requires the transaction ID, amount, and payer phone from §8.
- `MTN` and `AIRTEL` create a new payment attempt and dispatch an STK push to `customerMsisdn`; the verified webhook completes it. Use this for a table tab that the guest wants to pay by mobile money at bill close.
- The endpoint never changes kitchen status. A tab that is already `PENDING`, `PREPARING`, `READY`, or `COMPLETED` stays there.
- One `SUCCESSFUL` payment is allowed per order. A second success becomes `REFUND_PENDING`; it is not a second ticket.
- Every settlement writes an `audit_log` row naming the staff user and the carrier.

1. For a walk-in cash sale, FOH creates the order as `AWAITING_PAYMENT` with server-resolved prices. For an existing dine-in POSTPAY tab, the order is already `PENDING` and may already be `READY` or `COMPLETED`.
2. FOH enters the amount tendered and confirms cash received.
3. In one transaction, the service creates a `payments` row with `carrier = 'CASH'`, `status = 'SUCCESSFUL'`, `recorded_by = <staff user>`, and `customer_msisdn = NULL`. It promotes an `AWAITING_PAYMENT` order to `PENDING`; an order already in the kitchen lifecycle stays in its current state.
4. `payments.amount_ugx` must equal `orders.total_amount_ugx`; a partial cash payment is not supported in Phase 1.

The nullable `customer_msisdn` is deliberate: a walk-in cash customer may not give a phone number. The database check still requires a phone for every MTN, Airtel, and manual-MoMo payment. Cash refunds are not implemented in Phase 1; the reconciliation formula must say so rather than silently assuming zero refunds.

### 8.2 Refund closure (manual, manager-only)

Phase 1 does not call a telco refund API. Late or duplicate MoMo successes are recorded as `REFUND_PENDING`, excluded from gross collections, and flagged in the 21:30 digest. To close one:

1. The manager completes the reversal in the telco merchant app and obtains the reversal/confirmation reference.
2. The manager calls `POST /api/v1/payments/:id/refund` (`MANAGER_ADMIN`) with the reference.
3. The service moves the payment `REFUND_PENDING` → `REFUNDED`, sets `refunded_at` and `refund_reference`, and writes an append-only audit row naming the manager, amount, carrier, and reference. It does not change order or kitchen status.
4. `REFUNDED` is terminal. The payment leaves the pending-refund memo and remains excluded from gross collections. It is never re-promoted to `SUCCESSFUL`.

Cash refunds out of the drawer remain out of scope in Phase 1. If the business later needs them, the cash-count formula must add a `cash_refunds` line rather than assuming zero.

### 8.3 Cancelling an order after payment

`POST /api/v1/orders/:id/cancel` must resolve the money in the same transaction as the cancellation. Otherwise a verified payment stays in gross after the order is voided and the digest overstates collections.

- **MTN, Airtel, or manual MoMo:** move the `SUCCESSFUL` payment to `REFUND_PENDING` and set `audit_flag = 'CANCELLED_AFTER_PAYMENT'` (or `'FAILED_DELIVERY'` when the cancellation follows a failed handoff). The payment leaves gross immediately and appears in the 21:30 refund memo. The manager completes the external reversal and closes it through `POST /api/v1/payments/:id/refund` under §8.2.
- **Cash:** Phase 1 has no cash-refund ledger, so the system does not move a `CASH` payment automatically. A cash-paid cancellation is a manager-only exception: the order is cancelled, the audit row states that cash was returned outside the system, and the digest raises `CASH_REFUND_EXCEPTION`. The person returning the cash adjusts the drawer; the digest must not claim the system refunded it.
- **No successful payment:** cancel the order directly. A late success after cancellation follows the `LATE_PAYMENT_AFTER_CANCEL` rule and becomes `REFUND_PENDING`.
- Cancellation never changes kitchen status for any other order and never re-promotes a refunded payment.

A failed delivery is settled as `CANCELLED` by the manager; if the delivery was prepaid, the same rule moves the MoMo/Airtel payment to `REFUND_PENDING`. The rider advance is reconciled separately through `delivery_handoffs`.

---

## 9. Manager Shift-Close Reconciliation Report

At **9:30 PM**, Zito Mbowe reviews the daily financial reconciliation across both outlets. The figures below are illustrative; the report must compute every value, and “balanced” is valid only after a cash count:

```
+-------------------------------------------------------------------------+
| DAILY FINANCIAL RECONCILIATION: FOODIZO + OBUNUZI (CONSOLIDATED)      |
| Date: 2026-10-23 | Shift: All-Day | Auditor: Zito Mbowe                   |
+-------------------------------------------------------------------------+
| CHANNEL                   | COUNT | TOTAL VALUE (UGX) | STATUS          |
+---------------------------+-------+-------------------+-----------------+
| MTN Mobile Money (Direct) |  114  | UGX 1,596,000     | Reconciled API  |
| Airtel Money (Direct)     |   48  | UGX   672,000     | Reconciled API  |
| Manual MoMo (USSD Verify) |   12  | UGX   168,000     | Verified Chits  |
| Physical Cash Register    |   22  | UGX   308,000     | Counted         |
+---------------------------+-------+-------------------+-----------------+
| TOTAL COLLECTED           |  196  | UGX 2,744,000     | See cash count  |
+-------------------------------------------------------------------------+
| OUTLET SPLIT: Foodizo UGX 1,780,000 (129) | Obunuzi UGX 964,000 (67)     |
+-------------------------------------------------------------------------+
| DELIVERY CONTRIBUTION (MEMO — NOT A COLLECTION CHANNEL)                 |
| Delivery fees collected (inside MoMo/Airtel totals)  | UGX    84,000    |
| Less: rider transport advances paid from cash drawer | UGX   (62,000)   |
| Net delivery contribution                            | UGX    22,000    |
+-------------------------------------------------------------------------+
| CASH RECONCILIATION                                                     |
| Foodizo: expected UGX 152,000 | counted 152,000 | variance      0      |
| Obunuzi: expected UGX  94,000 | counted  94,000 | variance      0      |
| Consolidated: expected 246,000 | counted 246,000 | variance     0      |
+-------------------------------------------------------------------------+
```

> The reconciliation report is generated automatically from the `payments`, `delivery_handoffs`, and `cash_counts` tables at 9:30 PM and pushed to Zito Mbowe's admin dashboard and email. Delivery fees are included in the MTN/Airtel totals; the report may show a **Delivery Fees (memo)** line for audit, but it is not a separate collection channel and must never be collected as an untracked cash top-up.

> **Daily digest:** The same figures feed the 21:30 owner SMS/email digest in `Daily_Audit_Digest.md`. The digest must read `cash_counts.variance_ugx`; if the cash count is missing, it must say so instead of printing a zero. `REFUND_PENDING` payments are not gross collections; list them separately with the reason (`LATE_PAYMENT_AFTER_CANCEL`, `DUPLICATE_SUCCESS_REQUIRES_REFUND`, `CANCELLED_AFTER_PAYMENT`, or `FAILED_DELIVERY`) until a manager closes the reversal as `REFUNDED` through §8.2. Closed refunds stay out of gross and move to a memo count.

> **Rider advance rule:** If the outlet pays the rider from the cash drawer, the handoff must record `rider_advance_ugx` and any returned change. The cash drawer count is reconciled against cash sales **minus net rider advances**. An unrecorded UGX 2,000 handoff appears as a UGX 2,000 drawer variance even though the money was spent correctly. The delivery fee is revenue; the rider advance is an operating cost. Report the net contribution, not just the fee collected.

---

## 10. Security & Compliance Checklist

| Control | Implementation |
| :--- | :--- |
| **No PIN Handling** | Customer MoMo PINs are entered exclusively on the telco SIM card level — never passed through or stored by this app |
| **Idempotency Keys** | Every payment attempt uses a cryptographically generated `UUIDv4` sent as `X-Reference-Id`; `payment_events(provider, event_id)` dedupes webhook retries |
| **Webhook Validation** | Verify the provider callback credential (shared secret or API key where the provider supports one) and enforce the provider’s published source IP ranges. Add an HMAC check only if the provider actually signs callbacks; do not claim HMAC support that the telco does not offer. |
| **Transport Security** | TLS is required for every internet-facing hop (telco APIs, Cloudflare Tunnel, SMTP). The in-store LAN is HTTP on a restricted staff SSID; do not expose it to the WAN |
| **Environment Isolation** | `MOMO_TARGET_ENV=sandbox` for development; `production` flag requires explicit deployment approval |
| **PCI Scope Reduction** | No card data is stored or processed — system is MoMo-only, reducing PCI DSS scope to SAQ A |
