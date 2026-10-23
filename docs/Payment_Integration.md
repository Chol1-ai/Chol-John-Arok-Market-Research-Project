# Payment Integration Specification: MTN Mobile Money & Airtel Money Engine

**Target Outlets:** Foodizo (Ham Towers) & Obunuzi Restaurant & Cafe (Opposite YMCA)  
**Location:** Kampala, Uganda  
**Currency:** Ugandan Shilling (UGX)  
**Author:** Lead Technical Product Manager & System Architect  
**Target Environment:** Antigravity IDE + Opencode CLI Repository Scaffold  
**Related Files:** `Tech_Stack.md` (DDL schema), `User_Flow.md` (Flow A checkout steps), `Design_System.md` (payment UI components)

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

> **Dependency:** A KDS ticket (`PENDING`) is **only** created after payment is confirmed `SUCCESSFUL`. See `User_Flow.md §2 Flow A` and `Tech_Stack.md §4` for the order promotion handler.

---

## 2. Master Payment Architecture

```
[ CUSTOMER / WAITER CLIENT ]
             │
  (Initiates Checkout — UGX amount + phone number)
             │
             ▼
┌────────────────────────────────────────┐
│       PAYMENT GATEWAY CONTROLLER       │
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
       │  - HMAC / API-Key Validate  │
       │  - IP whitelist check       │
       │  - Idempotency lock check   │
       └──────────────┬──────────────┘
                      │
                      ▼
       ┌─────────────────────────────┐
       │       PAYMENT SETTLED       │
       │  status → SUCCESSFUL        │
       │  order.status → PENDING     │  ←── Fires to KDS via Redis
       │  digital_token issued       │
       └─────────────────────────────┘
```

---

## 3. Telco Routing & MSISDN Normalisation

Before initiating a push, all Ugandan phone numbers must be sanitised into standard `E.164` format (no leading zeros, no `+` prefix):

```typescript
// Utility: Normalize and Detect Ugandan Telecom Operator
// Location: apps/api/src/lib/msisdn.ts

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
(Order → PENDING → KDS)   [ TIMED_OUT ]
                                │
                                ▼
                         [ FAILED / CANCELLED ]
                         (Show Cash Fallback UI)
```

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
// Location: apps/api/src/services/paymentService.ts

import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

export async function requestMtnPayment(payload: {
  amountUgx: number;
  phone: string;        // E.164 normalised, e.g., '256770000000'
  orderNumber: string;  // e.g., 'TOKEN-042'
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
  "reference": "TOKEN-042",
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
// Location: apps/api/src/handlers/paymentWebhookHandler.ts

import type { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma';
import { redisPublisher } from '../lib/redis';

export async function handlePaymentWebhook(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const payload = request.body as {
    referenceId: string;
    status: 'SUCCESSFUL' | 'FAILED';
    financialTransactionId?: string;
  };

  return await prisma.$transaction(async (tx) => {
    const payment = await tx.payments.findUnique({
      where: { idempotency_key: payload.referenceId },
      include: { order: true },
    });

    if (!payment) {
      return reply.status(404).send({ error: 'Transaction reference not found' });
    }

    // ── IDEMPOTENCY GUARD: Reject replays ─────────────────────────────────
    if (payment.status === 'SUCCESSFUL') {
      return reply.status(200).send({ message: 'Already processed — no action taken' });
    }

    if (payload.status === 'SUCCESSFUL') {
      // 1. Mark payment record successful
      await tx.payments.update({
        where: { id: payment.id },
        data: {
          status: 'SUCCESSFUL',
          external_transaction_id: payload.financialTransactionId,
          completed_at: new Date(),
        },
      });

      // 2. Promote order to PENDING — this is the gate to KDS ingestion
      const updatedOrder = await tx.orders.update({
        where: { id: payment.order_id },
        data: { status: 'PENDING' },
      });

      // 3. Broadcast to KDS station monitors via Redis
      await redisPublisher.publish('KDS_NEW_ORDER', JSON.stringify(updatedOrder));

      return reply.status(200).send({ status: 'ACKNOWLEDGED' });
    }

    // Payment failed — record it, no KDS action
    await tx.payments.update({
      where: { id: payment.id },
      data: { status: 'FAILED' },
    });

    return reply.status(200).send({ status: 'FAILED_RECORDED' });
  });
}
```

---

## 7. PostgreSQL Payments Table (DDL Extension)

This table extends the schema in `Tech_Stack.md §3`. Add after the `orders` table:

```sql
-- ============================================================
-- 8. PAYMENTS REGISTER (Extends Tech_Stack.md DDL)
-- ============================================================
CREATE TYPE payment_status AS ENUM (
    'INITIATED',
    'PENDING_CUSTOMER_PIN',
    'SUCCESSFUL',
    'FAILED',
    'TIMED_OUT',
    'CANCELLED'
);

CREATE TYPE payment_carrier AS ENUM ('MTN', 'AIRTEL', 'CASH', 'MANUAL_MOMO');

CREATE TABLE payments (
    id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id                 UUID REFERENCES orders(id) ON DELETE CASCADE,
    idempotency_key          VARCHAR(36) UNIQUE NOT NULL, -- UUIDv4, sent as X-Reference-Id
    carrier                  payment_carrier NOT NULL,
    customer_msisdn          VARCHAR(20) NOT NULL,        -- E.164 normalised
    amount_ugx               NUMERIC(10, 2) NOT NULL,
    status                   payment_status NOT NULL DEFAULT 'INITIATED',
    external_transaction_id  VARCHAR(100),                -- Telco's own TxID
    audit_flag               VARCHAR(50),                 -- e.g., 'VERIFIED_MANUAL_MOMO'
    initiated_at             TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at             TIMESTAMP WITH TIME ZONE
);

COMMENT ON COLUMN payments.idempotency_key IS
    'UUIDv4 sent as X-Reference-Id to telco. Prevents duplicate KDS tickets on webhook retry.';
COMMENT ON COLUMN payments.audit_flag IS
    'Set to VERIFIED_MANUAL_MOMO when cashier manually confirms a USSD counter payment.';
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
│  Reference:    TOKEN-042                   │
├────────────────────────────────────────────┤
│  Then show your SMS receipt to the cashier │
└────────────────────────────────────────────┘
```

**Step 2 — Cashier manual verification:**
1. Customer shows telco SMS receipt at counter.
2. Cashier taps **"Verify MoMo Transaction"** on their terminal.
3. Inputs the **last 4 digits** of the SMS Transaction ID.
4. Order releases to KDS with `audit_flag = 'VERIFIED_MANUAL_MOMO'`.

| Merchant Code | Outlet | Carrier |
| :--- | :--- | :--- |
| `*165*3*242424#` | Foodizo Ham Towers | MTN |
| `*185*9*121212#` | Obunuzi YMCA | Airtel |

---

## 9. Manager Shift-Close Reconciliation Report

At **9:30 PM**, Zito Mbowe reviews the daily financial reconciliation across both outlets:

```
+-------------------------------------------------------------------------+
| DAILY FINANCIAL RECONCILIATION: FOODIZO (HAM TOWERS)                   |
| Date: 2026-10-23 | Shift: All-Day | Auditor: Zito Mbowe                |
+-------------------------------------------------------------------------+
| CHANNEL                   | COUNT | TOTAL VALUE (UGX) | STATUS          |
+---------------------------+-------+-------------------+-----------------+
| MTN Mobile Money (Direct) |  114  | UGX 1,596,000     | Reconciled API  |
| Airtel Money (Direct)     |   48  | UGX   672,000     | Reconciled API  |
| Manual MoMo (USSD Verify) |   12  | UGX   168,000     | Verified Chits  |
| Physical Cash Register    |   22  | UGX   308,000     | Drawer Match    |
+---------------------------+-------+-------------------+-----------------+
| TOTAL COLLECTED           |  196  | UGX 2,744,000     | ZERO VARIANCE   |
+-------------------------------------------------------------------------+
```

> The reconciliation report is generated automatically from the `payments` table at 9:30 PM and pushed to Zito Mbowe's admin dashboard and email.

---

## 10. Security & Compliance Checklist

| Control | Implementation |
| :--- | :--- |
| **No PIN Handling** | Customer MoMo PINs are entered exclusively on the telco SIM card level — never passed through or stored by this app |
| **Idempotency Keys** | Every payment request uses a cryptographically generated `UUIDv4` sent as `X-Reference-Id` to eliminate duplicate debits |
| **Webhook Validation** | Incoming webhooks are validated via HMAC signature check and IP whitelist (MTN/Airtel CIDR blocks) to block spoofed callbacks |
| **TLS 1.3 Enforcement** | All transit data between customer PWA, in-store edge nodes, and cloud API is strictly encrypted |
| **Environment Isolation** | `MOMO_TARGET_ENV=sandbox` for development; `production` flag requires explicit deployment approval |
| **PCI Scope Reduction** | No card data is stored or processed — system is MoMo-only, reducing PCI DSS scope to SAQ A |
