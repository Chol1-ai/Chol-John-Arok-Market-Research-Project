# Daily Audit & Owner Digest

**Status:** Implemented in Phase 1 — scheduled and on-demand owner reporting.<br>
**Recipient:** Owner/manager on duty (`DIGEST_RECIPIENT_PHONE`).<br>
**Schedule:** `DIGEST_CRON_SCHEDULE`, default `30 21 * * *` in `Africa/Kampala`.<br>
**Primary channel:** Africa's Talking SMS (short summary).<br>
**Email:** Not implemented. The API reports `emailStatus: NOT_CONFIGURED`; no SMTP transport exists in this repository.<br>
**WhatsApp:** Not implemented and not planned for Phase 1.

**Canonical source:** `backend/src/services/digestService.ts` · **Scheduler:** `backend/src/index.ts` · **Routes:** `backend/src/routes/digest.ts`

---

## 1. Purpose

The owner should not have to open the manager dashboard after a long shift. The digest delivers the few numbers that matter to a phone:

- What was collected, by payment channel.
- Whether the physical cash drawer balanced after rider advances.
- What surplus was cleared, staff-fed, or wasted.
- Which exceptions need a human decision.

The digest is a **notification layer**. It does not replace the `/admin` manager console; it links back to the read-only report.

> **Rule:** Never fabricate a zero variance. If a cash count is missing, the digest reports `CASH_COUNT_MISSING` and leaves the variance `null`. A false “BALANCED” message is worse than no message.

---

## 2. What Is Actually Implemented

| Capability | Status |
| :--- | :--- |
| Automatic schedule at 21:30 EAT | **Implemented** via `node-cron` in the API process; configurable with `DIGEST_CRON_SCHEDULE` |
| On-demand dispatch from `/admin` | **Implemented** as `POST /api/v1/digest/dispatch-now` (manager only) |
| SMS summary | **Implemented** through `SmsService.sendOwnerDigest`; development returns `MOCK`, production requires Africa's Talking credentials |
| Email report | **Not implemented**; always reports `NOT_CONFIGURED` unless `DIGEST_EMAIL_ENABLED=true`, which reports `FAILED_NOT_IMPLEMENTED` |
| WhatsApp / Telegram | **Not implemented** |
| Automatic retry of a failed digest | **Not implemented**; the scheduler skips overlapping ticks and logs failures |
| Redis-based distributed lock | **Not used**; the edge deployment runs a single API process with an in-process `digestRunning` guard |
| 72-hour read-only report link | **Implemented** as an API payload and `/d/:token` page |
| Cash count | **Implemented** through `POST /api/v1/digest/reconcile-cash` and the `/admin` form |

The scheduler is registered only when `NODE_ENV !== 'test'` and `cron.validate(DIGEST_CRON_SCHEDULE)` passes. If the expression is invalid, the API logs `DIGEST_CRON_SCHEDULE is invalid; scheduled digest disabled` and continues serving.

---

## 3. Schedule and Idempotency

- The default expression is `30 21 * * *`, interpreted in `Africa/Kampala`, not the host timezone.
- A single API process runs the job. A boolean `digestRunning` guard skips a tick if the previous digest is still running.
- The digest is persisted in `daily_digests`, one row per business date. Re-running the same date updates that row and reuses its existing `link_token`; it does not insert a duplicate.
- Phase 1 has **no retry queue**. A failed SMS is recorded with `status: FAILED` and the provider detail in `error`; the manager can run `POST /api/v1/digest/dispatch-now` again.
- There is no Redis lock because there is no Redis and no multi-replica API in Phase 1. If the API is ever replicated, add a documented distributed lock before enabling the scheduler on more than one instance.

---

## 4. Digest Content

### 4.1 SMS summary

The service builds a short consolidated message and caps it at 320 characters:

```text
FOODIZO+OBUNUZI 2026-11-07: Gross UGX 2,744,000.
Cash variance UGX 0. 2 flags.
Full: https://admin.foodizo.ug/d/7f3c2a
```

If either outlet has not submitted a cash count:

```text
FOODIZO+OBUNUZI 2026-11-07: Gross UGX 2,744,000.
CASH COUNT MISSING - drawer not verified. 1 flags.
Full: https://admin.foodizo.ug/d/7f3c2a
```

The SMS is always the **consolidated** figure. Per-outlet detail is in the report payload and the `/admin` console.

### 4.2 Report payload

The persisted `payload_json` and the `/d/:token` page include:

| Section | Fields |
| :--- | :--- |
| Consolidated | `grossUgx`, `mtnUgx`, `airtelUgx`, `manualMomoUgx`, `cashUgx`, `paymentCount`, `totalOrders` |
| Cash | `expectedCashUgx`, `countedCashUgx`, `cashVarianceUgx`, `cashCountStatus` (`SUBMITTED` or `MISSING`) |
| Delivery | `deliveryFeesUgx`, `riderAdvancesNetUgx`, `netDeliveryContributionUgx`, `failedDeliveryCount` |
| Refunds | `refundPendingUgx`, `refundPendingCount`, `refundedUgx`, `refundedCount` |
| Payments | `failedPaymentCount` |
| Surplus | `clearancePortions`, `staffMealPortions`, `wastePortions` |
| Risk | `lowStock[]`, `staleOrderCount` |
| Per outlet | Every field above for `FOODIZO_HAM_TOWERS` and `OBUNUZI_YMCA` |
| Meta | `digestDate`, `generatedAt`, `flags[]`, `flagCount`, `smsSummary`, `linkToken`, `link` |

The report contains **no customer name, phone number, delivery note, or GPS coordinate**.

---

## 5. Data Sources & Formulas

The business day starts at **05:00 EAT** and ends at **04:59:59.999 EAT** the next calendar day. `business_date` is stored as UTC midnight of the Kampala calendar date.

### 5.1 Financial settlement

| Line | Formula |
| :--- | :--- |
| MTN | `SUM(payments.amount_ugx)` where `carrier = 'MTN'`, `status = 'SUCCESSFUL'`, `completed_at` inside the business day |
| Airtel | Same, `carrier = 'AIRTEL'` |
| Manual MoMo | Same, `carrier = 'MANUAL_MOMO'` |
| Cash | Same, `carrier = 'CASH'` |
| Gross collected | Sum of the four lines; `REFUND_PENDING` and `REFUNDED` are excluded |
| Refund pending (memo) | `SUM(payments.amount_ugx)` where `status = 'REFUND_PENDING'`, with no date filter because it is an open liability |
| Refunds completed (memo) | `SUM(payments.amount_ugx)` where `status = 'REFUNDED'` and `refunded_at` is inside the business day |
| Delivery fees (memo) | `SUM(orders.delivery_fee_ugx)` for paid `PHONE_DELIVERY` orders in the day |
| Rider advances (net) | `SUM(delivery_handoffs.rider_advance_ugx - rider_advance_returned_ugx)` for handoffs dispatched in the day |
| Net delivery contribution | Delivery fees − net rider advances |

Per-outlet figures are computed separately and then consolidated. The consolidated total is never labelled with one outlet's name.

### 5.2 Cash reconciliation

| Line | Formula |
| :--- | :--- |
| Expected cash | `cash payments − net rider advances` |
| Counted cash | `cash_counts.counted_cash_ugx` for the outlet and business date |
| Variance | `counted cash − expected cash` |

If no `cash_counts` row exists, `countedCashUgx` and `cashVarianceUgx` remain `null`, `cashCountStatus` is `MISSING`, and the `CASH_COUNT_MISSING` flag is raised. Cash refunds out of the drawer are not implemented in Phase 1; the formula excludes them and does not pretend otherwise.

### 5.3 Surplus and inventory

- `closing_surplus_logs` grouped by `resolution`: `DISCOUNTED_CLEARANCE`, `STAFF_MEAL`, `WASTE_DISCARDED`.
- Low-stock items are `raw_inventory` rows where `current_stock <= alert_threshold`.
- The digest reports current stock and the low-stock list. It does **not** claim a usage or variance figure that requires an opening count the system does not capture.

### 5.4 Flags

| Code | Trigger |
| :--- | :--- |
| `CASH_COUNT_MISSING` | At least one requested outlet has no submitted cash count |
| `CASH_VARIANCE` | Absolute consolidated variance above UGX 5,000 |
| `REFUND_PENDING` | One or more payments are awaiting an external refund |
| `FAILED_PAYMENTS` | One or more `FAILED` or `TIMED_OUT` payment attempts in the day |
| `FAILED_DELIVERIES` | One or more `FAILED_UNREACHABLE`, `REFUSED`, or `RETURNED` handoffs in the day |
| `STALE_ORDERS` | One or more `PENDING`, `PREPARING`, or `READY` orders older than 45 minutes |
| `LOW_STOCK` | One or more inventory items at or below the alert threshold |

Flags are actionable, not decorative. The SMS contains only the count; the report and `/admin` show the detail.

---

## 6. Channel Behaviour

### 6.1 SMS

- Uses `SmsService.sendOwnerDigest(to, message)`.
- In `development` and `test`, returns `{ success: true, mode: 'MOCK' }`, logs the message, and sends nothing. The digest response reports `smsStatus: MOCK` and `channelsSent: ["SMS_MOCK"]`.
- In `production`, requires a real `AFRICASTALKING_API_KEY`. If it still has the sandbox placeholder, returns `FAILED` with detail `AFRICASTALKING_API_KEY is not configured.`
- A live provider HTTP failure returns `FAILED`; the digest status is `FAILED`.
- `sent_at` is set only for a **LIVE** SMS. A mocked digest leaves `sent_at` null.

### 6.2 Email

- No SMTP client, template, or mail transport exists in this repository.
- `DIGEST_EMAIL_ENABLED=false` (default): `emailStatus: NOT_CONFIGURED`.
- `DIGEST_EMAIL_ENABLED=true`: `emailStatus: FAILED_NOT_IMPLEMENTED`.
- `DIGEST_RECIPIENT_EMAIL` is stored for future use only. Do not describe email as delivered.

### 6.3 Digest status

| Status | Meaning in Phase 1 |
| :--- | :--- |
| `PARTIAL` | The digest was generated and the SMS was sent live **or** simulated as `MOCK`; email is not configured. This is the normal result. |
| `FAILED` | The SMS dispatch failed. The report row is still persisted with the error. |
| `SENT` | Reserved for a future implementation where every requested channel succeeds. Phase 1 does not produce it because email is unavailable. |

A `PARTIAL` status is **not** a claim that email was delivered.

---

## 7. Report Link

- Each digest row stores a random 8-hex-character `link_token`.
- The SMS link is `${DIGEST_APP_URL}/d/<token>`.
- `/d/:token` is a public, read-only page that calls `GET /api/v1/digest/view/:token` and renders the persisted payload.
- The API rejects an unknown token or a token older than **72 hours** with `404 DIGEST_LINK_EXPIRED`.
- The link exposes aggregate business data only. It grants no mutation endpoint and no staff session.
- Regenerating the same business date reuses the original token, so a previously sent link keeps working until it expires.

---

## 8. API Reference

| Method | Endpoint | Access | Purpose |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/digest/preview?outlet=...` | Manager | Compute the current digest without persisting or sending |
| `GET` | `/api/v1/digest/overview?outlet=...` | Manager | Dashboard payload: summary, recent orders, table counts, active staff, surplus logs |
| `POST` | `/api/v1/digest/reconcile-cash` | Manager | Upsert the physical cash count and variance for the business date |
| `POST` | `/api/v1/digest/dispatch-now` | Manager | Generate, persist, and send the digest; reports real channel outcomes |
| `GET` | `/api/v1/digest/view/:token` | Public link token | Read-only 72-hour digest payload |

An outlet-scoped manager can request only their own outlet. A cross-outlet manager may pass `outlet` or omit it for the consolidated view.

---

## 9. Security and Privacy

- **No customer PII:** the payload is aggregate sales, stock, surplus, and exception data. Customer names, phones, delivery notes, and GPS coordinates are excluded.
- **Recipient control:** `DIGEST_RECIPIENT_PHONE` is configured by the developer/owner. Changing it requires access to the server environment, not a public API.
- **Secrets:** the Africa's Talking key, telco secrets, and `JWT_SECRET` live in `backend/.env` with restricted permissions, never in the repository.
- **Link access:** the report link is a bearer capability valid for 72 hours. Treat it as sensitive business data; do not post it publicly.
- **Logging:** the API logs digest status and channel outcomes, not customer PII. SMS phone numbers are masked in operational logs where practical.
- **Cost:** SMS is billed per segment by Africa's Talking. The summary is capped at 320 characters (two segments); it is not a full report.

---

## 10. Operational Checks

1. Confirm the API starts with `Daily digest cron registered` and the configured schedule in `journalctl -u foodizo-api`.
2. Submit a cash count from `/admin`; confirm the variance is computed from successful cash minus net rider advances.
3. Log surplus with clearance, staff-meal, and waste resolutions; confirm the digest payload groups them separately.
4. Press **Dispatch digest** on `/admin`; confirm `digestStatus: PARTIAL`, `smsStatus: MOCK` in development, and `emailStatus: NOT_CONFIGURED`.
5. Open the returned `/d/<token>` link; confirm it is read-only and shows the persisted payload.
6. Wait past 72 hours or use a stale fixture; confirm the link returns `DIGEST_LINK_EXPIRED`.
7. Confirm no customer name, phone, delivery note, or GPS coordinate appears anywhere in the digest payload or SMS.

---

## 11. Deferred Work

These are not Phase 1 claims:

- SMTP/email delivery and templates.
- WhatsApp Cloud API or Telegram delivery.
- Automatic retry of failed channels.
- Distributed scheduling locks for multi-replica deployments.
- Opening/closing stock counts and a true inventory usage variance.
- Customer-facing digest or notification channels.

---

## 12. Related Specifications

| File | Scope |
| :--- | :--- |
| `Foundational_Concept.md` | Business scope and four-role RBAC |
| `Design_System.md` | Manager dashboard styling and status badges |
| `User_Flow.md` | Order lifecycle and closing surplus routine |
| `Payment_Integration.md` | Payment statuses, carriers, refunds, and reconciliation |
| `Delivery_Zones_and_Dispatch.md` | Rider advances, delivery fees, and delivery contribution |
| `Hardware_and_Peripherals.md` | SMS gateway and printer operations |
| `Seed_Data_and_Testing.md` | Digest fixtures and verification checklist |
| `Deployment_Runbook.md` | Scheduler, timezone, backup, and environment configuration |
