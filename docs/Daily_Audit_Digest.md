# Daily Audit & Owner Digest Engine

**Status:** Phase 1 specification — owner reporting, not customer messaging.<br>
**Target Recipient:** Zito Mbowe (Project Coordinator — MRFSS Project)<br>
**Scheduled Execution:** Daily at **21:30 EAT** (after kitchen close and cash count)<br>
**Primary Channels:** Africa's Talking **SMS** (short summary) + **email** (full report)<br>
**Optional Channel:** WhatsApp Cloud API utility template (owner only; see §3.3)<br>
**Related Specifications:** `Foundational_Concept.md` · `Design_System.md` · `User_Flow.md` · `User_Profiles_Personas.md` · `Delivery_Zones_and_Dispatch.md` · `Tech_Stack.md` · `Payment_Integration.md` · `Hardware_and_Peripherals.md` · `Seed_Data_and_Testing.md` · `Repo_Scaffold_and_Config.md` · `Demo_Script_and_Closing_Strategy.md` · `Deployment_Runbook.md` · `Service_Contract_and_Invoice_Template.md` · `Implementation_Phases.md`

---

## 1. Why This Exists

A restaurant coordinator will not reliably open an admin dashboard at 10:00 PM after a 14-hour operating day. The system already records the data; the digest sends the few numbers that matter to the owner's phone:

- What was collected, by channel.
- Whether the cash drawer balanced after rider advances.
- What high-turnover stock was used and what is left.
- What was cleared, staff-fed, or wasted.
- Which exceptions need a human decision.

The digest is a **notification layer**. It does not replace the `/admin/reconcile`, `/admin/inventory`, or `/admin/audit` screens; it links to them.

> **Rule:** Never hard-code a zero variance. If the cash count is missing, the digest must say **“cash count not submitted”** and flag it. A false “BALANCED” message is worse than no message.

---

## 2. Channel Strategy (Important Correction)

The original proposal made WhatsApp Business API the primary channel. That is not the right Phase 1 default for this project.

| Channel | Phase 1 decision | Why |
| :--- | :--- | :--- |
| **SMS — Africa's Talking** | **Primary** | Already integrated for pickup alerts; no new vendor; works on any phone; ~UGX 25–30 per segment |
| **Email** | **Primary for the full report** | Free/cheap, printable, no message-length limit, good for the audit trail |
| **WhatsApp Cloud API** | **Optional, owner-only, Phase 1.5** | Requires Meta Business verification, a dedicated number, an approved utility template, a permanent token, and per-message fees. It also conflicts with the customer-facing “no WhatsApp Business API” decision unless scoped carefully |
| **WhatsApp `wa.me` link** | **Not a notification channel** | It opens a chat; it cannot push an automated 21:30 message |
| **Telegram bot** | Not adopted | Another app for the owner to install; SMS/email already work |

The existing `Delivery_Zones_and_Dispatch.md §3` rule remains: **no customer-facing WhatsApp Business API in Phase 1**. The owner digest is a separate, internal notification. If WhatsApp is enabled for the owner, it must be behind `OWNER_WHATSAPP_ENABLED=false` by default.

**SMS length:** Africa's Talking bills per 160-character segment. The digest must send a **2-segment maximum** summary, not the full report. The full report goes by email (and optionally WhatsApp).

---

## 3. Digest Content

### 3.1 SMS summary (maximum 2 segments)

```text
FOODIZO+OBUNUZI 28/10: Gross UGX 2,744,000.
Cash variance UGX 0. 2 flags.
Full: https://admin.foodizo.ug/d/7f3c2a
```

If cash count is missing for one or both outlets:

```text
FOODIZO+OBUNUZI 28/10: Gross UGX 2,744,000.
CASH COUNT MISSING - drawer not verified.
Full: https://admin.foodizo.ug/d/7f3c2a
```

The SMS is always the **consolidated** figure. Per-outlet detail belongs in the email and the report page; do not label a consolidated total “FOODIZO.”

### 3.2 Full email report (illustrative)

```text
FOODIZO & OBUNUZI — DAILY AUDIT
Date: Wednesday, 28 October 2026 | Generated: 21:30 EAT
Status: CLOSED | Prepared by: automated digest

FINANCIAL SETTLEMENT
  MTN MoMo (API verified)       UGX 1,596,000   (114)
  Airtel Money (API verified)   UGX   672,000   ( 48)
  Manual MoMo (USSD verified)   UGX   168,000   ( 12)
  Cash in drawers               UGX   308,000   ( 22)
  -------------------------------------------------
  Gross collected               UGX 2,744,000   (196)
  Outlet split: Foodizo UGX 1,780,000 (129); Obunuzi UGX 964,000 (67)
  Refund pending (not gross)    UGX         0   (  0)

DELIVERY CONTRIBUTION (MEMO)
  Delivery fees collected       UGX    84,000
  Less rider advances (net)     UGX   (62,000)
  Net delivery contribution     UGX    22,000

CASH RECONCILIATION
  Expected cash in drawer       UGX   246,000
  Counted cash                  UGX   246,000
  Variance                      UGX         0   BALANCED

HIGH-TURNOVER STOCK
  Foodizo — Mukwano cooking oil 25.8 L remaining | 14.2 L BOM usage today
  Foodizo — Broiler chicken     18 pcs remaining | 68 pcs sold
  Foodizo — Farm eggs           36 eggs remaining | 142 used (71 Rolexes)
  Obunuzi — Stewing beef        18.2 kg remaining | 6.8 kg BOM usage today

SURPLUS RESOLUTIONS
  Obunuzi — Beef Luwombo        6 portions cleared | 2 staff meals | 1 waste

EXCEPTIONS
  - 1 voided ticket (T-02, waiter error, manager phone + PIN approved)
  - Rolex 86'd at 20:45 (eggs finished)
  - 0 failed deliveries
  - 0 failed payments

LINKS
  Reconciliation: https://admin.foodizo.ug/admin/reconcile
  Inventory:      https://admin.foodizo.ug/admin/inventory
  Audit log:      https://admin.foodizo.ug/admin/audit
```

All numbers above are illustrative. The generator must compute every value from the database.

### 3.3 Optional WhatsApp Cloud API message

If the owner explicitly opts in:

- Use a **utility template** named `daily_audit_digest` with variables for date, gross, variance, flags, and link.
- Send to the owner's verified WhatsApp number only.
- Keep the same content as the email, but cap it at 4,000 characters.
- Fall back to SMS if the Cloud API returns an error or the 24-hour window/template rules reject the message.
- Do not use the WhatsApp Cloud API for customer order updates in Phase 1.

Setup burden to document before enabling: Meta Business Portfolio, phone number verification, display name approval, template approval, permanent system-user token, webhook verification, and per-message billing. This is why it is optional.

---

## 4. Data Sources & Formulas

The canonical schema is in `Tech_Stack.md §3` and `Payment_Integration.md §7`. The digest requires two supporting tables, also defined in `Tech_Stack.md §3`:

- `cash_counts` — the FOH/manager cash count at close, one row per outlet per business date.
- `daily_digests` — the generated payload, send status (`GENERATED`, `PARTIAL`, `SENT`, `FAILED`), and idempotency key.

### 4.1 Financial settlement

For business date `D` (00:00–23:59 EAT):

| Line | Formula |
| :--- | :--- |
| MTN | `SUM(payments.amount_ugx)` where `carrier = 'MTN'`, `status = 'SUCCESSFUL'`, `completed_at` in `D` |
| Airtel | same, `carrier = 'AIRTEL'` |
| Manual MoMo | same, `carrier = 'MANUAL_MOMO'` |
| Cash | same, `carrier = 'CASH'` |
| Gross collected | sum of the four lines; `REFUND_PENDING` and `REFUNDED` are excluded |
| Refund pending (memo) | `SUM(payments.amount_ugx)` where `status = 'REFUND_PENDING'`, listed separately with `audit_flag` |
| Refunds completed (memo) | `SUM(payments.amount_ugx)` where `status = 'REFUNDED'` and `refunded_at` in `D`; never added to gross |
| Delivery fees (memo) | `SUM(orders.delivery_fee_ugx)` for paid `PHONE_DELIVERY` orders in `D` |
| Rider advances (net) | `SUM(delivery_handoffs.rider_advance_ugx - rider_advance_returned_ugx)` for handoffs in `D` |
| Net delivery contribution | delivery fees − net rider advances |

`MANUAL_MOMO` must be included. The original sample showed it but the proposed code omitted it. Every financial line is computed per outlet and then summed; the consolidated total is never labelled with one outlet's name.

### 4.2 Cash reconciliation

| Line | Formula |
| :--- | :--- |
| Expected cash | `cash payments − net rider advances` (Phase 1 has no cash refunds; do not subtract an assumed zero silently) |
| Counted cash | `SUM(cash_counts.counted_cash_ugx)` for `D` |
| Variance | `counted cash − expected cash` |

If no `cash_counts` row exists for an outlet, set `variance = null`, add the flag `CASH_COUNT_MISSING`, and do not print a zero. Cash refunds out of the drawer are not implemented in Phase 1; the digest must state that the formula excludes them rather than implying they were considered.

### 4.3 Inventory

The digest reports three things separately:

1. **Current stock** from `raw_inventory.current_stock` for high-turnover items.
2. **Theoretical BOM usage** from `order_items` × `recipe_bom.quantity_deducted` for completed orders in `D`.
3. **Variance** only if an opening/closing count exists. Without both counts, print `N/A — count not submitted`; never fabricate a variance.

The original proposal's “Variance: +0.2L - OK” had no data source. Do not ship that. Add a closing stock count to the manager routine if variance is required; otherwise report stock remaining and BOM usage.

### 4.4 Clearance and waste

Use `closing_surplus_logs` grouped by `resolution`:

- `DISCOUNTED_CLEARANCE` — portions sold at clearance; actual revenue is already in gross sales.
- `STAFF_MEAL` — portions consumed by staff.
- `WASTE_DISCARDED` — portions discarded.

Do **not** label `leftover_portions × clearance price` as “revenue recovered.” It is an estimate at best, and it double-counts revenue already in the sales total. If an estimate is useful, label it **“estimated clearance value, not additional revenue.”**

### 4.5 Exceptions and flags

The digest should flag, at minimum:

- `CASH_COUNT_MISSING` — no cash count for one or both outlets.
- `CASH_VARIANCE` — absolute variance above `CASH_VARIANCE_ALERT_UGX` (default `UGX 5,000`).
- `FAILED_PAYMENTS` — count of `FAILED` / `TIMED_OUT` payments.
- `REFUND_PENDING` — count and value of successful payments awaiting refund (late/duplicate successes and paid orders cancelled after payment, including failed deliveries); excluded from gross. A manager closes the reversal as `REFUNDED` through `Payment_Integration.md §8.2`; closed refunds move to the memo count and are no longer flagged pending.
- `CASH_REFUND_EXCEPTION` — a `CANCELLED` order still has a `SUCCESSFUL` `CASH` payment. Phase 1 has no cash-refund ledger, so the digest names the order and amount and asks the manager to confirm the drawer adjustment; it must not imply the system refunded it.
- `FAILED_DELIVERIES` — count of `FAILED_UNREACHABLE` / `REFUSED` / `RETURNED` handoffs.
- `LOW_STOCK` — `raw_inventory.current_stock <= alert_threshold`.
- `STALE_ORDERS` — `PENDING` / `PREPARING` / `READY` orders older than 45 minutes at close.
- `DIGEST_RETRY` — previous day's digest failed or was not sent.
- `PRINTER_OFFLINE` — only if the printer health check is stored; otherwise omit.
- `VOIDS` — only if the audit log has a void event; otherwise show “void tracking not available.”

Flags are actionable, not decorative. The email lists them; the SMS says only the count.

---

## 5. Implementation Contract

### 5.1 Service interface

```ts
// src/server/services/daily-digest-service.ts
export type DigestChannel = 'SMS' | 'EMAIL' | 'WHATSAPP';

export type DailyDigestPayload = {
  digestDate: string;              // YYYY-MM-DD, Africa/Kampala
  generatedAt: string;             // ISO timestamp
  outlets: Array<{
    outlet: 'FOODIZO_HAM_TOWERS' | 'OBUNUZI_YMCA';
    grossUgx: number;
    mtnUgx: number;
    airtelUgx: number;
    manualMomoUgx: number;
    cashUgx: number;
    deliveryFeesUgx: number;
    riderAdvancesNetUgx: number;
    expectedCashUgx: number | null;
    countedCashUgx: number | null;
    cashVarianceUgx: number | null;
    refundPendingUgx: number;
    refundPendingCount: number;
    refundedUgx: number;
    refundedCount: number;
  }>;
  refundPending: Array<{
    outlet: 'FOODIZO_HAM_TOWERS' | 'OBUNUZI_YMCA';
    carrier: 'MTN' | 'AIRTEL' | 'CASH' | 'MANUAL_MOMO';
    amountUgx: number;
    reason: string | null;
  }>;
  flags: Array<{ code: string; severity: 'INFO' | 'WARN' | 'CRITICAL'; message: string }>;
  links: { fullReport: string; reconcile: string; inventory: string; audit: string };
};

export type DigestSendResult = {
  status: 'SENT' | 'PARTIAL' | 'FAILED';
  sent: DigestChannel[];
  failed: Array<{ channel: DigestChannel; error: string }>;
};

export async function generateDailyDigest(date: string): Promise<DailyDigestPayload>;
export async function renderSmsSummary(payload: DailyDigestPayload): string;
export async function renderEmailReport(payload: DailyDigestPayload): { subject: string; text: string; html: string };
export async function sendDailyDigest(
  payload: DailyDigestPayload,
  channels: DigestChannel[],
  alreadySent?: DigestChannel[]
): Promise<DigestSendResult>;
```

### 5.2 Prisma queries (field names aligned to the schema)

```ts
// src/server/services/daily-digest-service.ts
import { prisma } from '../plugins/prisma';

const start = new Date(`${date}T00:00:00+03:00`);
const end = new Date(`${date}T23:59:59.999+03:00`);

const payments = await prisma.payments.findMany({
  where: { status: 'SUCCESSFUL', completed_at: { gte: start, lte: end } },
  select: {
    carrier: true,
    amount_ugx: true,
    audit_flag: true,
    order_id: true,
    order: { select: { outlet: true } },
  },
});

const byCarrier = (
  outlet: 'FOODIZO_HAM_TOWERS' | 'OBUNUZI_YMCA',
  carrier: 'MTN' | 'AIRTEL' | 'MANUAL_MOMO' | 'CASH'
) =>
  payments
    .filter((p) => p.order.outlet === outlet && p.carrier === carrier)
    .reduce((sum, p) => sum + Number(p.amount_ugx), 0);

const refundPending = await prisma.payments.findMany({
  // Open liability: no date filter, because a payment that became refundable
  // yesterday is still owed today. The manager closes each row explicitly.
  where: { status: 'REFUND_PENDING' },
  select: {
    amount_ugx: true,
    audit_flag: true,
    carrier: true,
    order: { select: { outlet: true } },
  },
});

const refunded = await prisma.payments.findMany({
  where: { status: 'REFUNDED', refunded_at: { gte: start, lte: end } },
  select: {
    amount_ugx: true,
    carrier: true,
    order: { select: { outlet: true } },
  },
});

const handoffs = await prisma.delivery_handoffs.findMany({
  where: { dispatched_at: { gte: start, lte: end } },
  select: {
    rider_advance_ugx: true,
    rider_advance_returned_ugx: true,
    order: { select: { outlet: true } },
  },
});

const riderAdvancesNetUgx = (outlet: 'FOODIZO_HAM_TOWERS' | 'OBUNUZI_YMCA') =>
  handoffs
    .filter((h) => h.order.outlet === outlet)
    .reduce(
      (sum, h) =>
        sum + Number(h.rider_advance_ugx) - Number(h.rider_advance_returned_ugx),
      0
    );

const refundedTotals = (outlet: 'FOODIZO_HAM_TOWERS' | 'OBUNUZI_YMCA') => {
  const rows = refunded.filter((p) => p.order.outlet === outlet);
  return {
    amountUgx: rows.reduce((sum, p) => sum + Number(p.amount_ugx), 0),
    count: rows.length,
  };
};

const cashCounts = await prisma.cash_counts.findMany({
  where: { business_date: new Date(date) },
  select: { outlet: true, counted_cash_ugx: true, expected_cash_ugx: true, variance_ugx: true },
});

const refundPendingTotals = (outlet: 'FOODIZO_HAM_TOWERS' | 'OBUNUZI_YMCA') => {
  const rows = refundPending.filter((p) => p.order.outlet === outlet);
  return {
    amountUgx: rows.reduce((sum, p) => sum + Number(p.amount_ugx), 0),
    count: rows.length,
  };
};

const outletTotals = (outlet: 'FOODIZO_HAM_TOWERS' | 'OBUNUZI_YMCA') => {
  const pending = refundPendingTotals(outlet);
  const refunds = refundedTotals(outlet);
  const carriers = ['MTN', 'AIRTEL', 'MANUAL_MOMO', 'CASH'] as const;

  return {
    grossUgx: carriers.reduce((sum, carrier) => sum + byCarrier(outlet, carrier), 0),
    refundPendingUgx: pending.amountUgx,
    refundPendingCount: pending.count,
    refundedUgx: refunds.amountUgx,
    refundedCount: refunds.count,
  };
};

// If a cash count is absent, set variance to null and add CASH_COUNT_MISSING.
// Do not default to zero.
```

**Notes:**

- `payments.carrier` is the actual column; the proposal's `payments.method` would not compile.
- `payments.completed_at` exists in `Payment_Integration.md §7`.
- `cash_counts` is defined in `Tech_Stack.md §3`.
- Per-outlet figures must join `orders.outlet`; neither `payments` nor `delivery_handoffs` carries the outlet directly. Do not silently sum both outlets into one and call it “Foodizo,” and do not label a consolidated figure as one outlet.
- `REFUND_PENDING` payments are reported separately and never added to gross collections. The query has no date filter because the memo is an open liability; a refundable payment stays visible until a manager closes it with `POST /api/v1/payments/:id/refund`. `REFUNDED` payments are excluded from gross and appear only in the completed-refund memo for the day they were closed (`refunded_at`).
- A cancelled order with a `SUCCESSFUL` `CASH` payment is not moved automatically; raise `CASH_REFUND_EXCEPTION` and require a manager to reconcile the drawer, because Phase 1 has no cash-refund ledger.
- Use `Prisma.Decimal` or integer UGX; never use JavaScript floating point for money beyond display.

### 5.3 Cron and idempotency

```ts
// src/server/jobs/daily-digest-cron.ts
import cron from 'node-cron';
import { redis } from '../plugins/redis';
import { runDailyDigest } from '../services/daily-digest-service';

export function startDailyDigestCron() {
  cron.schedule(
    '30 21 * * *', // 21:30 Africa/Kampala
    async () => {
      const date = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Africa/Kampala',
      }).format(new Date());

      const lockKey = `lock:daily-digest:${date}`;
      const acquired = await redis.set(lockKey, '1', 'EX', 3600, 'NX');
      if (!acquired) {
        console.log(`[digest] ${date} already running or sent; skipping`);
        return;
      }

      try {
        await runDailyDigest(date);
      } catch (error) {
        console.error('[digest] failed', error);
        // Release the lock so the retry job can reacquire it, then schedule
        // exactly one retry after five minutes. The retry job reads
        // daily_digests.channels_sent and resends only the missing channel(s).
        await redis.del(lockKey);
      }
    },
    { timezone: 'Africa/Kampala' }
  );
}
```

**Rules:**

- Run **after** the cash count deadline. If the manager has not submitted the count by 21:30, send the digest with `CASH_COUNT_MISSING`; do not wait indefinitely.
- Use `daily_digests.digest_date` as the idempotency key. If the row is `SENT`, skip every channel. If it is `GENERATED` or `PARTIAL`, send only the channels not already present in `channels_sent`. If it is `FAILED`, allow the documented retry.
- Status meaning: `SENT` = every requested channel succeeded; `PARTIAL` = at least one succeeded and at least one failed; `FAILED` = none succeeded. A retry that completes the missing channel updates `PARTIAL` to `SENT` without resending the successful channel.
- A single scheduler instance per edge node. If the API ever runs multiple replicas, the Redis lock prevents duplicate sends.
- Set `TZ=Africa/Kampala` in the container and still pass the explicit timezone to `node-cron`; do not trust the host clock.
- The cron must not block API requests. Run it in the API process only if the deployment has one instance; otherwise use a separate worker container.

### 5.4 Rendering and sending

- **SMS:** use a generic `sendSms(phone, message)` helper. Do not reuse `sendPickupSmsAlert`; it prepends a pickup token and outlet name.
- **Email:** use SMTP (`nodemailer`) with `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`. Send both plain text and HTML.
- **WhatsApp:** optional adapter behind `OWNER_WHATSAPP_ENABLED`; use the approved template, not free-form text for a business-initiated message.
- **Recipient:** `OWNER_PHONE` and `OWNER_EMAIL` from environment. Never hard-code `256700000000`.
- **Signed link:** generate a short-lived signed URL (7 days) to the full report using `DIGEST_REPORT_BASE_URL` and `DIGEST_LINK_SECRET`. Do not put a raw database ID or customer data in the URL.
- **Retry:** SMS/email failures are recorded in `daily_digests.error`, `status` becomes `PARTIAL` or `FAILED`, and `channels_sent` records what actually arrived. Retry once after 5 minutes for missing channels only, then alert the owner and the developer. Never resend a channel already in `channels_sent`.

---

## 6. Security, Privacy & Cost

- **No customer PII:** the digest contains aggregate sales, stock, and exception counts. It must not include customer names, phone numbers, delivery notes, or GPS coordinates.
- **Recipient verification:** the owner's phone/email are configured by the developer and confirmed by the owner. Changing them requires a manager login or a signed change request.
- **Secrets:** SMTP password, Africa's Talking API key, and WhatsApp token live in `.env`/secret storage, never in the repository.
- **Link access:** the full report requires an authenticated manager session or a signed URL; do not expose an unauthenticated `/audit` endpoint.
- **Logging:** mask phone numbers (`2567***567`) and never log the full digest payload at `info`.
- **Cost:** SMS is ~UGX 25–30 per 160-character segment. A 2-segment daily SMS is ~UGX 50–60/day (~UGX 1,500–1,800/month). Email is effectively free. WhatsApp utility pricing is separate and market-dependent; do not promise “free WhatsApp.”
- **Retention:** keep `daily_digests.payload_json` for 12 months, then archive or delete; it contains business data, not customer PII.

---

## 7. Acceptance Criteria

- [ ] The digest runs at **21:30 EAT** and uses `Africa/Kampala`, not the server's local timezone.
- [ ] A second run for the same date does not send a duplicate SMS/email.
- [ ] Cash variance is computed from `cash_counts`; a missing count produces `CASH_COUNT_MISSING`, not `UGX 0`.
- [ ] `MANUAL_MOMO` payments are included in the gross total.
- [ ] Per-outlet figures are shown separately and the consolidated total is labelled “Foodizo + Obunuzi,” not “Foodizo.”
- [ ] `REFUND_PENDING` payments are listed outside gross collections with their reason; a manager-closed `REFUNDED` payment leaves the pending memo, remains outside gross, and appears in the completed-refund memo.
- [ ] A partial send is recorded as `PARTIAL`; the retry sends only the missing channel(s) and never duplicates a delivered SMS/email.
- [ ] Rider advances are netted out of expected cash and shown as a separate delivery-contribution line.
- [ ] The SMS is at most 2 segments and contains the gross total, cash variance/flag, flag count, and full-report link.
- [ ] The email contains the full report and links to reconcile/inventory/audit.
- [ ] The digest contains no customer name, phone number, delivery note, or GPS coordinate.
- [ ] A failed SMS/email is recorded, retried once, and escalated; it is never silently dropped.
- [ ] The full-report link expires and requires authentication.
- [ ] The digest can be generated manually with `npm run digest -- --date=YYYY-MM-DD --dry-run` for testing; dry-run sends nothing and does not mark the digest `SENT`.
- [ ] The WhatsApp channel is disabled by default and, when enabled, uses an approved utility template.

---

## 8. Related Specifications

| File | Scope |
| :--- | :--- |
| `Foundational_Concept.md` | Business scope, four-role RBAC, executive problem statement |
| `Design_System.md` | Role styling, status badges, and admin dashboard surfaces |
| `User_Flow.md` | Channel flows, order state machine, and closing surplus routine |
| `User_Profiles_Personas.md` | Operational personas and owner requirements |
| `Delivery_Zones_and_Dispatch.md` | Rider advances, delivery fees, and delivery contribution |
| `Tech_Stack.md` | Canonical DDL (`cash_counts`, `daily_digests`), service placement, and Redis |
| `Payment_Integration.md` | Payment statuses, carriers, reconciliation formulas, and refund ledger |
| `Hardware_and_Peripherals.md` | Africa's Talking SMS gateway, printer health, and power resilience |
| `Seed_Data_and_Testing.md` | Digest test cases, sample dates, and fixture runner |
| `Repo_Scaffold_and_Config.md` | Repository structure, cron job placement, and environment variables |
| `Demo_Script_and_Closing_Strategy.md` | Demonstration flow for reconciliation and owner reporting |
| `Deployment_Runbook.md` | Cron, timezone (`Africa/Kampala`), SMTP, and backup configuration |
| `Service_Contract_and_Invoice_Template.md` | Commercial SLA, reporting milestones, and support hours |
| `Implementation_Phases.md` | Delivery Stage 3 / Coding Phase C7 digest acceptance criteria |
