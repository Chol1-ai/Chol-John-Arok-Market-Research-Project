# Seed Data, Fixtures & Verification

**Database:** PostgreSQL via Prisma ORM (tested on PostgreSQL 17)<br>
**Location Data:** Wandegeya, Kampala, Uganda<br>
**Canonical seeder:** `backend/prisma/seed.ts`

> **Development only:** every seeded account uses PIN `1234`. Change all PINs before real staff use. The seed is destructive and refuses to run in production unless `ALLOW_DESTRUCTIVE_SEED=true` is set.

---

## 1. Canonical Seed

Run from the repository root:

```bash
npm --prefix backend run prisma:generate
npm --prefix backend run prisma:migrate
npm --prefix backend run prisma:seed
```

The seed wipes development operational data (orders, payments, sessions, tables, menu, inventory, zones, surplus, cash counts, and digests), keeps append-only audit history, and rebuilds the canonical fixtures below.

### 1.1 Staff Accounts (demo PIN `1234` for all)

| Staff member | Role | Outlet | Phone |
| :--- | :--- | :--- | :--- |
| Zito Mbowe | `MANAGER_ADMIN` | Cross-outlet | `256700000000` |
| Cyrus M. | `MANAGER_ADMIN` | Foodizo · Ham Towers | `256768550986` |
| Sarah K. | `WAITER_FOH` | Foodizo · Ham Towers | `256772555666` |
| Chef Juma | `KITCHEN_STAFF` | Foodizo · Ham Towers | `256772333444` |
| Mubiru Mahad | `WAITER_FOH` | Obunuzi · Opp. YMCA | `256760723280` |
| Prossy N. | `WAITER_FOH` | Obunuzi · Opp. YMCA | `256772111222` |
| Chef Aisha | `KITCHEN_STAFF` | Obunuzi · Opp. YMCA | `256772777888` |

The live login pad reads the public display-only directory and authenticates by `staffId` plus PIN. Phone-number login is also supported. Every role has a distinct home path: Waiter/FOH → `/pos`, Kitchen Staff → `/kds`, Manager/Admin → `/admin`.

### 1.2 Operational Fixtures

| Fixture | Canonical count |
| :--- | :--- |
| Restaurant tables | **16 per outlet**: `T-01`–`T-12` (capacity 4) and `B-01`–`B-04` (capacity 2) |
| Delivery zones | **14 per outlet**: 10 active Phase 1 zones and 4 inactive Phase 2 zones |
| Menu items | 5 per outlet with server-owned UGX prices and stations |
| Raw inventory | 6 high-turnover commodities across the two outlets |
| Recipe BOM | Rolex, chicken & chips, beef luwombo, and matooke deductions |
| Orders | **16 total**: 9 Foodizo and 7 Obunuzi, with 3 completed orders per outlet |
| Order statuses | Mixed `AWAITING_PAYMENT`, `PENDING`, `PREPARING`, `READY`, `COMPLETED`, and `CANCELLED` examples |
| Digital tokens | `TOKEN-001` onward per outlet; counters end at `TOKEN-009` (Foodizo) and `TOKEN-007` (Obunuzi) |
| Delivery handoffs | 4 fixtures: 2 `DELIVERED`, 1 unreviewed `FAILED_UNREACHABLE`, 1 `PENDING` on-the-way |
| Closing surplus | 5 logs across clearance, staff meal, and waste resolutions |
| Cash counts | 1 balanced count per outlet (`variance_ugx = 0`) |
| Digest | 1 generated row for the current Kampala business date |

The business date rolls at **05:00 EAT**; `business_date` is stored as UTC midnight of that calendar day. Reseed after running destructive tests or end-to-end suites so demos start from these canonical fixtures.

---

## 2. Test Commands

```bash
# Type-check and build the backend
npm --prefix backend run build

# Unit and integration tests (Vitest)
npm --prefix backend test
```

**Current repository test suite:** 5 files, **20 tests passed** — token sequencing, BOM deduction, ESC/POS output, cash variance, and integration coverage for auth, RBAC, orders, webhooks, dispatch, surplus, and digest privacy.

**Verification record for this revision:** backend build passed; API end-to-end run passed **109 checks**; browser end-to-end run passed **93 checks** with zero uncaught page errors. The browser run covered all seven staff logins, role redirects, POS → KDS → settlement → clearing, dispatch, digest channel reporting, the 72-hour digest link, and prototype namespacing.

> The API and browser E2E harnesses are developer tooling kept outside the committed app. Re-run them against a freshly seeded database when changing auth, order, payment, dispatch, or digest behaviour.

---

## 3. API Verification Checklist

### 3.1 Authentication & Role Scope

1. Open `/login`; confirm seven staff cards load from `GET /api/v1/auth/terminal-staff` without exposing phone numbers or PIN data.
2. Log in with PIN `1234` as each role. Confirm the redirect: Waiter/FOH → `/pos`, Kitchen → `/kds`, Manager → `/admin`.
3. Confirm a Waiter cannot open `/admin` or `/kds`, a Kitchen user cannot open `/pos` or `/admin`, and a Manager can open all three.
4. Confirm `GET /api/v1/auth/me` returns the role label and `homePath`, and `POST /api/v1/auth/logout` revokes the session and clears the cookie.
5. Submit five wrong PINs; confirm the sixth attempt reports an account lock for 15 minutes.

### 3.2 Orders, Kitchen & Settlement

6. Create a `TAKEAWAY_PICKUP` order; confirm it starts `AWAITING_PAYMENT` and does not appear on the KDS.
7. Create an authenticated `DINE_IN` tab; confirm it starts `PENDING`, occupies the table, and rejects a second open tab on the same table with `TABLE_ALREADY_OCCUPIED`.
8. Attempt an unauthenticated `DINE_IN` order; confirm `POSTPAY_REQUIRES_STAFF`.
9. Confirm the KDS ticket shows table/zone, items, notes, and token, but no customer phone, delivery note, or GPS coordinates.
10. Claim a ticket → `PREPARING`; confirm recipe inventory is deducted once. Bump → `READY`; confirm the chit print attempt and SMS outcome are recorded.
11. Settle a full bill by `CASH`, `MANUAL_MOMO`, or a telco push. Confirm partial amounts fail with `SETTLEMENT_AMOUNT_MISMATCH`.
12. Confirm settlement never rewinds a `PREPARING`/`READY`/`COMPLETED` order. A fully paid `READY`/`COMPLETED` table moves to `NEEDS_CLEARING`.
13. Confirm a second settlement attempt returns `alreadySettled` without creating a duplicate successful payment.
14. Cancel as Manager and confirm the order becomes `CANCELLED`; a successful MoMo payment becomes `REFUND_PENDING`, while cash is flagged. A Waiter cannot cancel.
15. Verify `POST /api/v1/payments/:id/refund` closes a `REFUND_PENDING` payment using the external reference.

### 3.3 Token, Webhook & Payment Integrity

16. Look up a token with `GET /api/v1/orders/token/:token`; confirm no customer PII is returned. If the token exists at both outlets, request `?outlet=`.
17. Send a signed successful webhook; confirm the order moves `AWAITING_PAYMENT` → `PENDING` exactly once. Send the same event again; confirm `ALREADY_PROCESSED`.
18. Send an unsigned webhook in production mode; confirm `401 INVALID_WEBHOOK_SIGNATURE`. In development without `PAYMENTS_WEBHOOK_SECRET`, unsigned callbacks are accepted for local testing only.
19. Send a successful webhook after cancellation; confirm the payment becomes `REFUND_PENDING` with `LATE_PAYMENT_AFTER_CANCEL` and never enters the KDS.
20. Send a duplicate or late success for an already-paid order; confirm `DUPLICATE_SUCCESS_REQUIRES_REFUND`.

### 3.4 Dispatch

21. Open `/dispatch` as Waiter or Manager. Confirm the active queue shows `READY` `PHONE_DELIVERY` orders with no handoff, and that an open handoff displays as **ON THE WAY**.
22. Assign a rider with `POST /api/v1/orders/:id/dispatch`; confirm rider name, phone, method, and advance are recorded and the response reports SMS mode (`MOCK` in development).
23. Complete with `DELIVERED`; confirm the order becomes `COMPLETED` and `delivered_at` is set. Complete with `FAILED_UNREACHABLE`; confirm the order is **not** completed and appears in the review queue.
24. Confirm the compatibility aliases `POST /api/v1/dispatch/:id/assign-rider` and `POST /api/v1/dispatch/:id/complete` behave the same as the order-level routes.

### 3.5 Digest, Surplus & Frontend Routes

25. Open `/admin`; confirm the dashboard loads digest overview, recent orders, table counts, staff, and surplus logs.
26. Submit the physical cash count; confirm expected cash = successful cash − net rider advances and the variance is stored.
27. Log surplus portions with clearance, staff-meal, and waste resolutions; confirm they appear in the digest overview.
28. Dispatch the digest; confirm the response reports `digestStatus: PARTIAL` in development, `smsStatus: MOCK`, `channelsSent: ["SMS_MOCK"]`, and `emailStatus: NOT_CONFIGURED`.
29. Open the returned `GET /api/v1/digest/view/:token` link; confirm it is read-only and rejects a token older than 72 hours.
30. Open `/` and confirm the launch hub labels five live staff surfaces and five static prototypes; open `/prototype/customer`, `/prototype/menu`, `/prototype/checkout`, `/prototype/token`, and `/prototype/tracker`. Confirm `/menu`, `/checkout`, `/token`, and `/tracker` return `302` to the prototype routes.

---

## 4. Digest & Reconciliation Test Cases

| # | Test | Expected result |
| :--- | :--- | :--- |
| 1 | Cash count uniqueness | A second count for the same outlet and business date updates the existing row (`cash_counts_unique`) rather than duplicating it |
| 2 | Expected cash | Successful cash minus net rider advances; a `UGX 30,000` advance with `UGX 10,000` returned nets `UGX 20,000` |
| 3 | Variance sign | Counted `UGX 70,000` against expected `UGX 80,000` stores `-10,000` and raises a variance flag |
| 4 | Missing count | Digest reports `CASH_COUNT_MISSING`; it never prints a false zero |
| 5 | Carrier coverage | `MTN`, `AIRTEL`, `MANUAL_MOMO`, and `CASH` appear separately; gross is their sum |
| 6 | Refund exclusion | `REFUND_PENDING` and `REFUNDED` payments stay out of gross; pending refunds appear as a memo count |
| 7 | Digest idempotency | Re-generating the same business date updates one `daily_digests` row rather than inserting duplicates |
| 8 | Development SMS | `smsStatus: MOCK`, `channelsSent` contains `SMS_MOCK`, and no carrier request is made |
| 9 | Email not implemented | `emailStatus: NOT_CONFIGURED`; `digestStatus` is `PARTIAL`, not `SENT` |
| 10 | SMS failure | `smsStatus: FAILED`, `digestStatus: FAILED`, and the digest row records the error |
| 11 | Signed report link | A valid link opens read-only; an invalid or older-than-72-hour token returns `DIGEST_LINK_EXPIRED` |
| 12 | PII exclusion | `payload_json`, the SMS text, and the report contain no customer name, phone, delivery note, or GPS coordinate |
| 13 | Surplus accounting | Clearance, staff-meal, and waste portions are reported separately; estimated value is labelled as an estimate |
| 14 | PIN storage | `users.pin_hash` is a bcrypt hash; no plaintext PIN appears in the database, logs, or API response |
| 15 | Session revocation | Logout revokes the `user_sessions` row; the old cookie/token is rejected on the next protected request |

---

## 5. Seeded Dispatch & Digest Fixtures

The canonical seed already builds the data needed for demos; do not add a second fixture layer.

- **Dispatch:** one delivered Foodizo handoff, one delivered Obunuzi handoff, one unreviewed `FAILED_UNREACHABLE` Foodizo handoff, and one `PENDING` Obunuzi handoff.
- **Digest:** generated from the seeded orders, payments, handoffs, surplus logs, and cash counts for the current business date. The expected flags include the failed-delivery review item and any low-stock or stale-order conditions present in the fixture.
- **Cash:** each outlet has a balanced physical count so the default demo shows zero variance; change a counted amount to demonstrate a variance.

To verify the fixtures:

1. Open `/dispatch` as Mubiru or Prossy; confirm the on-the-way and review queues.
2. Open `/admin` as Zito or Cyrus; confirm gross, payment split, cash variance, flags, surplus, and recent orders.
3. Call `POST /api/v1/digest/dispatch-now` from the admin screen; confirm the honest `PARTIAL` / `MOCK` / `NOT_CONFIGURED` channel states.
4. Open `/api/v1/digest/view/<token>`; confirm the read-only report and 72-hour expiry rule.
