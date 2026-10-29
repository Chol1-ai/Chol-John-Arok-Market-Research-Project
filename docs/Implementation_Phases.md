# Implementation Phases & Delivery Gates

**Status:** Phase 1 delivery plan — sequencing and gate criteria, not a second scope document.<br>
**Product scope:** Phase 1 initial deployment at Foodizo (Ham Towers) and Obunuzi Restaurant & Cafe (Opposite YMCA).<br>
**Delivery model:** Stage 0–6 inside product Phase 1; product Phase 2 is a separate decision.<br>
**Contract baseline:** `Service_Contract_and_Invoice_Template.md §3` proposes Milestone 1 (7 calendar days), Milestone 2 (7 calendar days), Milestone 3 (3 calendar days), and ongoing Milestone 4. This plan fits inside that baseline. The contract controls commercial terms; this document controls delivery sequencing.<br>
**Related specifications:** `Foundational_Concept.md` · `Repo_Scaffold_and_Config.md` · `Deployment_Runbook.md` · `Seed_Data_and_Testing.md` · `Delivery_Zones_and_Dispatch.md` · `Payment_Integration.md` · `Daily_Audit_Digest.md` · `Service_Contract_and_Invoice_Template.md`

> **Read this first — two different meanings of “phase.”**
>
> - **Product Phase 1** is the initial system specified in this repository: PWA, FOH POS, KDS, inventory, payments, delivery dispatch, digest, and the edge node.
> - **Product Phase 2** is optional future work such as live rider tracking or a rider app. It is **not** part of this plan.
> - **Implementation Stage 0–6** is the delivery sequence for product Phase 1. Stage 6 is only a review and decision point; it does not authorize any Phase 2 build.
>
> Do not use “Phase 2” to mean “week 2 of the project.”

---

## 1. Why Phased Delivery

A single big-bang go-live hides integration failures until the busiest service window. This plan splits the work so each stage produces evidence that the next stage can safely depend on:

1. **Order of dependencies.** The network, database, and authentication must work before POS or KDS testing is meaningful.
2. **Operational safety.** Payments, delivery dispatch, and printing are tested before staff are asked to use them with customers.
3. **Real acceptance.** Each stage ends with a demonstrable artifact and a signed gate, not a status meeting.
4. **Scope control.** A new request is either a defect, a planned item, or a change request. It does not silently enter the current stage.
5. **Faster diagnosis.** If a payment webhook fails during UAT, the team knows the environment and core order flow were already stable.

**Rule:** A stage can overlap the next only where the dependency is genuinely independent. A gate is never skipped to protect a date. If a dependency slips, move the dependent stage; do not compress testing.

---

## 2. Stage Map

The windows below are **proposed calendar days from kickoff**, aligned to the contract's 7 + 7 + 3 day baseline. Confirm actual dates at kickoff. The overlap between Stages 2 and 3 is intentional: payment integration can begin once the order and menu models are stable.

| Stage | Proposed window | Contract link | Primary output | Exit gate |
| :--- | :--- | :--- | :--- | :--- |
| **0 — Mobilization & readiness** | Days 1–2 | M1 kickoff | Signed scope, data/hardware/telco checklist, risk log, RACI | **G0** — build authorized |
| **1 — Environment & foundation** | Days 3–7 | Milestone 1 | Edge node, Compose stack, database, authentication/RBAC, backup/restore baseline | **G1** — staging is stable and reproducible |
| **2 — Core operations** | Days 8–11 | Milestone 2 | Menu/BOM, customer PWA, FOH POS, KDS, printer, surplus log | **G2** — order-to-KDS-to-chit works on the LAN |
| **3 — Payments, delivery & digest** | Days 10–14 | Milestone 2 | MoMo/Airtel, cash/manual settlement, zones/fees, dispatch, rider advances, cash count, 21:30 digest | **G3** — money and delivery reconcile |
| **4 — Hardening, UAT & training** | Days 15–17 | Milestone 3 | Full test pass, restore test, staff training, go-live checklist | **G4** — go-live accepted |
| **5 — Go-live & hypercare** | Days 18–30 | Milestone 4 transition | On-site support, monitoring, defect burn-down, stabilization report | **G5** — stable handover |
| **6 — Post-pilot review** | Day 30+ | Optional | Phase 2 decision memo and separate quote if triggered | **G6** — continue, adjust, or defer |

**Critical path:** hardware and site readiness → environment → menu/BOM data → telco credentials → payment/delivery UAT → training → go-live → hypercare.

---

## 3. Stage Details

### Stage 0 — Mobilization & Readiness (Days 1–2)

**Purpose:** Make the unknowns visible before installation or code changes.

**Contractor work**

- Run a kickoff workshop with the client lead and outlet leads.
- Confirm outlets, four system roles, peak windows, menu scope, delivery zones, printer locations, and support contacts.
- Freeze the product Phase 1 scope and write an explicit **not-in-scope** list.
- Issue data templates for menu, prices, recipes/BOM, staff roles, tables, delivery zones/fees/ETAs, and owner contacts.
- Complete a site and network survey: power, UPS, router, switch, cabling, tablet mounts, printer IP, internet, and LAN coverage.
- Confirm MTN MoMo and Airtel Money merchant accounts, KYC status, Africa's Talking sender ID, SMTP details, and owner phone/email.
- Agree the RACI, communication channel, change-request process, and risk log.

**Client inputs**

- A named decision-maker and an operational lead for each outlet.
- Access to the sites and network equipment.
- Draft menu, recipe/BOM, staff, table, and delivery-zone data.
- Hardware plan and delivery dates.
- Telco and SMS account status.

**Gate G0 — Build authorized**

- [ ] Kickoff checklist signed.
- [ ] Product Phase 1 scope and exclusions confirmed.
- [ ] Named owners and escalation contacts recorded.
- [ ] Data, hardware, power, network, and telco dependencies have owners and dates.
- [ ] Acceptance criteria and gate evidence are agreed.
- [ ] No unresolved blocker would make the proposed go-live date misleading.

If a blocking dependency is unresolved, start only the independent work. Do **not** publish a go-live date until the dependency has a credible path.

---

### Stage 1 — Environment & Foundation (Days 3–7)

**Purpose:** Build a stable, secure edge environment before application configuration.

**Contractor work**

- Install the edge server OS, Docker, and Docker Compose.
- Bring up PostgreSQL 16, Redis 7, the Fastify API, and the Next.js frontend.
- Run Prisma migrations and a baseline seed; verify the `/health` endpoint.
- Set `TZ=Africa/Kampala`; confirm the host timezone and time sync.
- Configure the same-origin `/api` rewrite; do not bake a LAN IP into the browser bundle.
- Configure `.env` secrets, LAN access, firewall rules, DHCP reservation, and printer networking.
- Install the backup script and perform a restore dry run to a staging database.
- Implement authentication, sessions, and the four-role RBAC matrix; add the append-only audit log.
- Add log rotation and a basic health/monitoring check.

**Client inputs**

- Physical access, power, router/switch access, and a static/DHCP-reserved address.
- Hardware delivered and imaged to the agreed specification.
- Confirmation of the owner and manager accounts.

**Evidence**

- `docker compose ps` shows healthy services.
- `/health` returns success.
- Migration log is clean.
- Role matrix test passes for each role.
- Backup restores into a staging database.
- PostgreSQL and Redis are not exposed to the LAN or internet; printer port `9100` is reachable only from the edge node on the staff LAN, never from the internet.
- Frontend loads through the edge node's LAN address.

**Gate G1 — Staging is stable and reproducible**

- [ ] The environment can be rebuilt from the repository and `.env` without undocumented manual steps.
- [ ] API, database, Redis, and frontend are healthy.
- [ ] The RBAC matrix is approved by the client lead.
- [ ] Backup and restore have both been demonstrated.
- [ ] No blocking network, power, or hardware issue remains.

A developer laptop is not an acceptable substitute for the edge node at this gate.

---

### Stage 2 — Core Operations (Days 8–11)

**Purpose:** Prove the order-to-kitchen flow before adding money and rider dispatch.

**Contractor work**

- Load the real menu, prices, recipes/BOM, inventory thresholds, staff accounts, and table layout.
- Build the customer PWA: menu, cart, checkout shell, token page, and order status.
- Build the FOH POS: dine-in, takeaway/pickup, phone-order capture, and table occupancy.
- Build the KDS stations (Steam, Fryer, Rolex, Expo) with WebSocket updates, audio alerts, and the bump flow.
- Implement auto-86, BOM decrement on `PREPARING`, and the closing surplus log.
- Implement the ESC/POS printer service and packaging chit.
- Apply the role-specific design system and the KDS privacy boundary: no prices, customer phone, room note, or GPS pin on the kitchen screen.

**Client inputs**

- Final menu and price list for the pilot.
- Recipe/BOM quantities and inventory thresholds.
- Table map, staff list, and printer location.
- FOH and kitchen representatives available for a short workflow review.

**Evidence**

- A `DINE_IN` POSTPAY table tab completes the full lifecycle in staging. A prepaid `TAKEAWAY_PICKUP` order is created as `AWAITING_PAYMENT` and is correctly withheld from the KDS; its payment promotion is accepted in Stage 3. Seeded `PENDING` fixtures verify the pickup and delivery channel badges, and a `PHONE_DELIVERY` fixture reaches the KDS with the purple channel badge. The delivery-chit layout is accepted in Stage 3.
- Auto-86 hides an out-of-stock item and blocks ordering.
- A bump to `PREPARING` decrements the expected inventory.
- A `READY` bump for a `TAKEAWAY_PICKUP` or `PHONE_DELIVERY` order prints a packaging chit; a `DINE_IN` order does not.
- The KDS reconnect test passes after a tablet Wi-Fi drop.
- The KDS does not display customer phone numbers, room notes, prices, or GPS coordinates.

**Gate G2 — Order-to-KDS-to-chit works on the LAN**

- [ ] A dine-in POSTPAY tab completes the lifecycle; a prepaid pickup order is correctly held in `AWAITING_PAYMENT` until payment.
- [ ] Phone-delivery capture reaches the KDS with seeded `PENDING` metadata and the correct channel badge.
- [ ] No duplicate KDS tickets are created by a repeated request.
- [ ] BOM and auto-86 behave as specified.
- [ ] Printing works from the edge node to the production printer.
- [ ] Local order and print flow still works with the WAN disconnected.
- [ ] FOH and kitchen leads sign the workflow review.

Payment and live delivery validation are accepted in Stage 3. The phone-delivery capture in Stage 2 uses seeded `PENDING` test metadata; the prepaid payment gate, live zone, fee, required-field, and dispatch gates are not passed yet.

---

### Stage 3 — Payments, Delivery & Digest (Days 10–14)

**Purpose:** Add the money and delivery paths that carry the highest operational risk.

**Contractor work**

- Integrate MTN MoMo Collections and Airtel Money Merchant Pay in sandbox.
- Move to production credentials in the client's name only after KYC and written approval.
- Implement STK push, webhook authentication (provider secret/IP allowlist; HMAC only where the provider supplies a signature), idempotency, timeout handling, and the manual MoMo verification fallback.
- Enforce server-side delivery-fee computation and outlet-scoped zone validation.
- Require recipient name, room/office/gate note, and rider-callable phone before payment.
- Add the optional one-shot GPS pin and static Google Maps link; no map SDK, Places, Directions, Geocoding, or API key.
- Build the FOH dispatch queue, rider handoff record, rider advance/return fields, failed-delivery outcome, and printed delivery chit.
- Build cash count, shift-close reconciliation, and the 21:30 SMS/email digest. Keep the owner-only WhatsApp adapter disabled by default.
- Verify that the KDS remains free of delivery PII.

**Client inputs**

- Telco sandbox and production credentials, merchant accounts, and KYC approval.
- Approved zone list, fees, ETAs, and delivery boundaries.
- Rider-callable phone policy and dispatch routine.
- Owner phone, owner email, SMTP credentials, and Africa's Talking sender ID.
- A named cash-count owner for each outlet.

**Evidence**

- A sandbox payment completes and a duplicate webhook does not create a second order or ticket.
- A phone-delivery order with a real zone, required room/office/gate note, recipient name, and phone passes the full checkout path.
- A client-supplied delivery fee is ignored; the server-computed fee is charged.
- A zone from the other outlet is rejected before payment.
- A delivery order without a room note, recipient name, or phone is rejected before the STK prompt.
- A dispatch handoff records the rider, method, advance, and outcome; a returned advance reduces the net advance.
- A delivery chit prints the destination, landmark note, and rider-callable phone.
- Cash variance and `CASH_COUNT_MISSING` behave as specified.
- The digest dry-run sends nothing; a live test reaches the owner.
- DevTools shows no Google Maps, Places, Directions, or Geocoding request.

**Gate G3 — Money and delivery reconcile**

- [ ] One sandbox payment and one delivery order pass end-to-end.
- [ ] Webhook idempotency is proven with a duplicate callback.
- [ ] Delivery fees are server-computed and outlet-scoped.
- [ ] Rider advances and returns reconcile to the shift-close report.
- [ ] The 21:30 digest is correct, idempotent, and free of customer PII.
- [ ] No map API key or live rider-tracking feature is present.
- [ ] Telco credentials and sender IDs are confirmed to be client-owned.

If telco production approval is delayed, the project may proceed to Stage 4 with the sandbox and manual-verification fallback, but go-live cannot claim completed mobile-money acceptance.

---

### Stage 4 — Hardening, UAT & Training (Days 15–17)

**Purpose:** Prove the system under realistic conditions and prepare staff to operate it without the implementation team beside them.

**Contractor work**

- Run the complete test checklist in `Seed_Data_and_Testing.md` (tests 1–39), including the payment, cash-count, and digest cases (16–39).
- Run a security review: secrets, least privilege, CORS, rate limits, headers, exposed ports, backup encryption, and session handling.
- Run a rush-hour simulation, WAN-off test, power-cut/restart test, printer-offline test, and duplicate-webhook test.
- Run UAT with FOH (including cashier), kitchen, and manager staff using synthetic data; do not copy production totals into fixtures.
- Fix Severity 1 and Severity 2 defects before go-live.
- Deliver role-specific training and quick-reference cards.
- Rehearse restore and rollback; update the deployment runbook with the actual site values.
- Complete the go-live checklist and support escalation sheet.

**Client inputs**

- Staff availability for UAT and training.
- A decision on open punch-list items.
- Confirmation that the production menu, prices, zones, and staff accounts are final.
- Sign-off authority available during the go-live window.

**Evidence**

- Test report with pass/fail evidence.
- Signed UAT record.
- Training attendance and role cards issued.
- Restore and rollback logs.
- Go-live checklist signed by the client lead.
- Open defects list with severity and owner.

**Gate G4 — Go-live accepted**

- [ ] No open Severity 1 or Severity 2 defects.
- [ ] All Phase 1 acceptance tests pass or have a written, client-approved workaround.
- [ ] Backup/restore and rollback are demonstrated.
- [ ] FOH (including cashier), kitchen, and manager training is complete.
- [ ] The client has signed acceptance or issued a punch list under the contract's acceptance clause.
- [ ] The go-live window and on-site support plan are confirmed.

Do not start go-live with an unsigned checklist or an untested restore.

---

### Stage 5 — Go-live & Hypercare (Days 18–30)

**Purpose:** Run the system in production with close support, then hand it over cleanly.

**Contractor work**

- Go live in a low-risk service window, with on-site or immediately available support.
- Run opening and closing checklists with the outlet leads.
- Monitor payment success, KDS latency, printing, digest delivery, backup completion, disk space, and UPS health.
- Hold a 15-minute daily stand-up for the first five business days.
- Triage and fix defects; route new requests through change control.
- Review the first weekly reconciliation and digest with the owner.
- Update the runbook with real IPs, printer settings, contacts, and recovery steps.
- Produce a hypercare report and handover pack.

**Client inputs**

- Operational staff available during the first live shifts.
- A single incident contact and a single acceptance contact.
- Access to the owner for the first digest and reconciliation review.

**Evidence**

- Go-live log and incident log.
- Backup verification records.
- Digest delivery proof.
- First weekly reconciliation review.
- Hypercare report and handover sign-off.

**Gate G5 — Stable handover**

- [ ] No unresolved Severity 1 incident.
- [ ] KDS, payments, printing, and the digest have been stable for at least five consecutive business days.
- [ ] Backups are completing and at least one restore has been verified.
- [ ] The owner can run the daily digest and shift-close review without developer intervention.
- [ ] Support contacts and escalation paths are confirmed.
- [ ] The retainer start date is agreed under the contract.

---

### Stage 6 — Post-Pilot Review (Day 30+)

**Purpose:** Decide whether product Phase 2 is justified. This is a review, not a build phase.

**Review inputs**

- Order volume, peak queue times, and walk-away observations.
- Payment success rate and unresolved webhook issues.
- Delivery failures, address ambiguity, and rider dispatch times.
- Cash-count completeness and digest usage.
- Staff feedback and support incident trends.

**Phase 2 triggers**

Consider Phase 2 only if the evidence supports it. The existing triggers in `Delivery_Zones_and_Dispatch.md §11` remain authoritative:

- The operation has 5+ full-time contracted riders and more than 100 deliveries/day outside the immediate campus radius.
- Delivery failures caused by address ambiguity exceed 5% for two consecutive weeks.
- The owner accepts a separate Phase 2 scope, privacy review, tile-provider decision, and quote.

**Gate G6 — Written decision**

- [ ] Continue product Phase 1 and the retainer as agreed; or
- [ ] Adjust the retainer/scope through a change request; or
- [ ] Approve a separate Phase 2 discovery and quote.

No Phase 2 build starts from this gate. A rider app, live tracking, or a live map requires a new agreement.

---

## 4. Scope Boundary

### In scope for this implementation plan

- Two outlets: Foodizo Ham Towers and Obunuzi Opposite YMCA.
- Four system roles: `CUSTOMER`, `WAITER_FOH`, `KITCHEN_STAFF`, `MANAGER_ADMIN`.
- Customer PWA, FOH POS, multi-station KDS, admin dashboard, and audit log.
- Menu, recipe/BOM, inventory thresholds, auto-86, and closing surplus.
- MTN MoMo and Airtel Money, subject to telco approval.
- Zone/landmark delivery checkout, FOH dispatch, printed chits, rider advances, and failed-delivery handling.
- Edge-node deployment, LAN operation, backups, UPS guidance, and monitoring.
- 21:30 SMS/email digest; optional owner-only WhatsApp disabled by default.
- Training, UAT, go-live support, and hypercare.

### Explicitly out of scope unless separately quoted

- Live Google Maps SDK, Places, Directions, Geocoding, or any paid map API key.
- Live rider tracking, rider app, rider login, or a fifth system role.
- Customer-facing WhatsApp Business API automation.
- Native iOS/Android apps.
- Split checks, split tender, and table transfers; Phase 1 closes one table tab with one settlement transaction.
- Accounting/ERP integration, payroll, loyalty, card payments, or multi-currency.
- New outlets or cross-outlet cloud multi-tenancy.
- Historical POS/accounting data migration.
- Hardware supply, cabling, or network upgrades unless a signed quotation says otherwise.
- 24/7 support or an uptime guarantee beyond the contract's stated target.
- Demand-forecasting/BI work beyond the specified dashboards and surplus log.

---

## 5. Workstreams & RACI

These are **project roles**, not system logins. The four system roles remain unchanged.

| Workstream | Contractor lead | Client lead | Outlet staff | Notes |
| :--- | :--- | :--- | :--- | :--- |
| Scope, gates and change control | **R/A** | **A** | C | Client accepts each gate |
| Edge environment and deployment | **R/A** | C | I | Client provides access and power |
| Menu, BOM, staff and zone data | **R** | **A** | C | Client owns the business data |
| Telco merchant accounts and KYC | C | **R/A** | I | Client-owned accounts |
| Core application build | **R/A** | C | I | Contractor delivery |
| UAT and acceptance | C | **A** | **R** | Real users test realistic workflows |
| Training | **R/A** | C | **R** | Attendance is a gate input |
| Go-live | **R** | **A** | **R** | One client go-live decision |
| Hypercare and handover | **R/A** | C | C | Daily support during the window |

**Key:** R = responsible, A = accountable, C = consulted, I = informed.

The client lead is the single acceptance authority. If Zito Mbowe delegates, the delegation must be written before a gate is signed.

---

## 6. Dependencies & Critical Path

| Dependency | Owner | Needed by | If late |
| :--- | :--- | :--- | :--- |
| Edge hardware, SSD, UPS, router, switch, tablets, printer | Client | Stage 1 | Environment and go-live shift; do not substitute a laptop |
| Power, LAN, cabling, printer IP, DHCP reservation | Client | Stage 1 | Network tests cannot pass |
| Menu, prices, recipes/BOM, inventory thresholds | Client | Stage 2 | Core operations cannot be configured |
| Table map and staff role list | Client | Stage 2 | POS/KDS UAT is incomplete |
| Approved zones, fees, ETAs, and delivery boundaries | Client | Stage 3 | Delivery checkout cannot be accepted |
| MTN/Airtel merchant accounts and KYC | Client | Stage 3 | Sandbox can proceed; production acceptance cannot |
| Africa's Talking sender ID, SMTP, owner phone/email | Client | Stage 3 | Digest and SMS acceptance cannot pass |
| Staff availability for UAT and training | Client | Stage 4 | Go-live acceptance shifts |
| Signed gate decisions | Client | Each gate | Next stage does not start |

**Rule:** A dependency that is late moves the dependent stage. It does not justify skipping security, restore, payment, or delivery tests.

---

## 7. Gate Evidence & Definition of Done

A stage is done only when the evidence exists and the gate owner signs it. A verbal “looks good” is not a gate.

Each gate record should contain:

- [ ] The deliverable or environment is available at the agreed location.
- [ ] The relevant tests have run, with output or screenshots attached.
- [ ] Client inputs and approvals are recorded.
- [ ] Open issues are classified by severity and assigned an owner.
- [ ] The next stage's dependencies are confirmed.
- [ ] The gate decision is signed and dated.

A gate may pass with a written punch list only when no Severity 1 or Severity 2 issue remains. Security, data-loss, payment-integrity, and restore failures are never conditionally accepted.

---

## 8. Defect Severity During Implementation

| Severity | Definition | Target response | Target resolution |
| :--- | :--- | :--- | :--- |
| **Sev 1** | An outlet cannot take, prepare, pay for, or print orders; data loss; security breach | 45 minutes during support hours | Workaround or fix the same day |
| **Sev 2** | A major workflow is blocked but a safe workaround exists | 4 business hours | Next business day |
| **Sev 3** | Minor functional defect with limited operational impact | 1 business day | Next scheduled release |
| **Sev 4** | Cosmetic issue or new request | 2 business days | Backlog or change request |

Support hours are **07:00–22:00 EAT**, matching the contract. This is not a 24/7 promise. After hours, Sev 1 may be escalated by phone on a best-effort basis; the contract controls the formal support obligation.

---

## 9. Change Control

The following are **change requests**, not implementation defects:

- A new feature, report, integration, outlet, or user role.
- A change to the order lifecycle, delivery model, payment flow, or pricing rules after the stage gate.
- A Phase 2 item such as a rider app, live tracking, or a map SDK.
- A request to migrate historical data or connect an accounting system.
- A request to support customer WhatsApp automation.

Each change request must state the change, the reason, the impact on scope, the impact on the timeline, the impact on the retainer, and the price. Work starts only after written approval. A bug that prevents the agreed specification from working is fixed under the current scope.

---

## 10. Phase 2 Guardrails

Product Phase 2 is deliberately deferred. The following remain true unless a separate agreement says otherwise:

- No live map SDK, API key, Places, Directions, or Geocoding in Phase 1.
- No rider app, rider login, background location, or live rider marker in Phase 1.
- No customer-facing WhatsApp Business API automation in Phase 1.
- The edge node remains the source of truth; there is no automatic cloud sync.
- A Phase 2 proposal must cover privacy, consent, tile-provider licensing or self-hosting, data retention, operating cost, and support.
- Phase 2 is not approved by passing Stage 6; it requires its own scope and quote.

---

## 11. One-Page Go/No-Go Checklist

Use this at the end of Stage 4 and again before Stage 5.

- [ ] Hardware is installed, on UPS, and reachable on the staff LAN.
- [ ] Database, Redis, API, and frontend are healthy.
- [ ] Backups run and a restore has been verified.
- [ ] Four-role RBAC is configured and tested.
- [ ] Menu, BOM, inventory thresholds, tables, and staff accounts are live.
- [ ] Dine-in, takeaway, and delivery orders reach the correct KDS surfaces.
- [ ] Auto-86 and BOM deduction are working.
- [ ] Packaging and delivery chits print correctly.
- [ ] MTN and Airtel payment paths are tested in sandbox; production status is explicit.
- [ ] Delivery zones, fees, required fields, and server-side fee validation are tested.
- [ ] Rider handoff, advance/return, and failed-delivery paths are tested.
- [ ] Cash count, variance, and the 21:30 digest are tested.
- [ ] No live map SDK, rider tracking, or customer WhatsApp automation is enabled.
- [ ] Staff training is complete and role cards are issued.
- [ ] Support contacts and escalation paths are confirmed.
- [ ] The client has signed the go-live checklist or issued a punch list under the contract.

If any box is unchecked, the correct action is to move the go-live date, not to explain away the gap.

---

## 12. Coding Phases (Build Order)

**Short answer:** No, the project will not be generated in one pass, and files will not be created in a random order. Coding proceeds in **small, runnable vertical slices**, each with tests and a reviewable diff. The implementation stages above are the delivery gates; the coding phases below are the build order inside them.

### 12.1 Coding rules

1. **The specification is the contract.** Do not invent endpoints, enums, statuses, or field names that are not in `Tech_Stack.md`, `Payment_Integration.md`, or `Delivery_Zones_and_Dispatch.md`.
2. **Foundation first.** Repository setup, schema, authentication, and RBAC come before feature screens.
3. **No giant one-shot generation.** Do not generate the whole application and test it at the end.
4. **Every phase is runnable.** A phase ends with an app that starts, migrates, builds, and demonstrates its slice.
5. **Every phase has tests.** Unit, integration, or end-to-end as appropriate, plus lint, typecheck, and build.
6. **Schema changes use migrations.** Do not edit an applied migration or hand-edit the production database.
7. **Small commits.** One coding phase is split into small commits/PRs; do not hide the whole project in one “initial commit.”
8. **No fake completion.** A stub, hard-coded success response, or TODO is not “done.” Incomplete work stays behind an explicit feature flag or out of the branch.
9. **No secrets or production data.** Use `.env.example`, synthetic fixtures, and sandbox credentials.
10. **Do not commit or push unless asked.** The current documentation work remains uncommitted for review.

### 12.2 Build sequence

| Coding phase | Implementation stage | Main work | Exit evidence |
| :--- | :--- | :--- | :--- |
| **C0 — Repository & quality gates** | Stage 1 | Next.js 14 + Fastify skeleton, TypeScript config, Prisma wiring, Docker files, lint/typecheck/test scripts, `/health`, base layout | App starts; `/health` returns success; lint, typecheck, and build pass |
| **C1 — Data model & access control** | Stage 1 | Prisma schema, migrations, seed baseline, sessions, four-role RBAC, audit log | Clean database migrates and seeds; role matrix tests pass |
| **C2 — Menu, inventory & BOM** | Stage 2 | Menu/pricing CRUD, recipe BOM, thresholds, auto-86, batch/surplus foundation | Inventory unit/integration tests pass; auto-86 blocks ordering |
| **C3 — Order core, KDS & printing** | Stage 2 | Order state machine, table occupancy, Redis pub/sub + WebSocket, KDS stations, ESC/POS service | Order → KDS → chit works; WAN-off LAN test passes |
| **C4 — Customer PWA & tokens** | Stage 2 | Menu, cart, checkout shell, token page, status view, responsive/PWA behavior | Pickup path and token/status view pass in staging; delivery seam is completed in C6 |
| **C5 — Payments** | Stage 3 | MTN/Airtel clients, STK push, webhook validation, idempotency, manual MoMo fallback, reconciliation records | Sandbox payment passes; duplicate webhook creates no second ticket |
| **C6 — Delivery & dispatch** | Stage 3 | Zones, server-side fee, required fields, optional GPS pin, static map link, dispatch queue, handoffs, rider advances, delivery chit | Delivery tests 5–14 pass; fee cannot be client-supplied |
| **C7 — Cash count & digest** | Stage 3 | Cash counts, variance, shift-close reconciliation, 21:30 digest, SMS/email, signed report link | Cash/digest tests 21–37 pass; dry-run sends nothing |
| **C8 — Hardening & deployment** | Stage 4 | Security headers, rate limits, backup/restore, monitoring, performance, production Compose, optional tunnel | Restore, security, WAN-off, and rush-hour checks pass |
| **C9 — Release candidate & UAT fixes** | Stage 4 | Defect fixes, accessibility, training data, release notes, runbook finalization | UAT signed; no open Sev 1/2 defects |
| **C10 — Hypercare patches** | Stage 5 | Production defect fixes only; no new features | Stable handover and hypercare report |

**Dependency order:** C0 → C1 → C2 → C3 → C4. C5 and C6 can overlap after C3/C4, but C7 waits for both C5 and C6. C8 starts only when the feature set is complete. C9 is the release candidate. C10 is post-go-live.

### 12.3 What gets built in each coding phase

#### C0 — Repository & quality gates

- Create the single Next.js 14 + Fastify application from `Repo_Scaffold_and_Config.md`.
- Add TypeScript, Prisma, Tailwind, Docker, and the same-origin `/api` rewrite.
- Add scripts for `lint`, `typecheck`, `test`, `build`, and `start`.
- Add a `/health` endpoint and a minimal shell page.
- Verify `npm run build` and the Docker build before writing features.

**Do not** start with menu cards or a dashboard. A pretty UI over an unverified build is not progress.

#### C1 — Data model & access control

- Implement the canonical Prisma schema from `Tech_Stack.md` and `Payment_Integration.md`.
- Create forward-only migrations and a synthetic seed.
- Implement login/session handling for the three staff roles (`WAITER_FOH`, `KITCHEN_STAFF`, `MANAGER_ADMIN`); the `CUSTOMER` enum stays reserved for a future customer login and is not seeded.
- Enforce server-side role checks; hiding a button is not authorization.
- Add the append-only audit log.
- Test the role matrix against allowed and denied actions.

**Gate:** a clean database migrates from zero, seeds, and passes RBAC tests.

#### C2 — Menu, inventory & BOM

- Menu categories, items, prices, availability, and outlet scope.
- Recipe/BOM quantities and raw-inventory thresholds.
- Decrement on `PREPARING`; auto-86 when stock reaches zero.
- Closing surplus log foundation.
- Unit tests for BOM math and edge cases such as zero or fractional quantities.

**Gate:** an out-of-stock item is blocked, and a test recipe decrements exactly once per order item.

#### C3 — Order core, KDS & printing

- Order creation with the `AWAITING_PAYMENT` prepaid gate and the `PENDING` → `PREPARING` → `READY` → `COMPLETED` lifecycle. Authenticated `DINE_IN` POSTPAY tabs start at `PENDING`.
- Dine-in, takeaway, and phone-delivery channel handling.
- Table occupancy state.
- Redis pub/sub plus WebSocket KDS updates and reconnect behavior.
- KDS station filters, audio alert, and 68px bump controls.
- ESC/POS printer service with chit sanitization.
- KDS privacy boundary: no prices, phone numbers, room notes, or GPS coordinates.

**Gate:** order → KDS works for a dine-in POSTPAY tab, and seeded `TAKEAWAY_PICKUP` / `PHONE_DELIVERY` fixtures print the packaging or delivery chit, on the LAN with the WAN disconnected, with no duplicate tickets.

#### C4 — Customer PWA & tokens

- Customer menu, cart, and checkout shell.
- Token generation and the token/status page.
- Pickup path and token/status view; the delivery checkout seam is completed in C6.
- PWA manifest, install behavior, and offline-safe error states.
- Do not add payment or delivery logic here beyond the seams needed for C5/C6.

**Gate:** a customer can create a pickup order, see the reserved token and the `AWAITING_PAYMENT` state, and understand that the order enters the kitchen only after payment. Payment completion is accepted in C5.

#### C5 — Payments

- MTN MoMo Collections and Airtel Money Merchant Pay clients.
- STK push, timeout handling, polling, and webhook authentication.
- Idempotency using the payment reference; duplicate callbacks must not duplicate the ticket.
- Cash and manual-MoMo settlement for walk-in and POSTPAY tabs; settlement never changes kitchen status.
- Manager-only refund closure for late/duplicate MoMo successes and paid-order cancellations (`REFUND_PENDING` → `REFUNDED`) with an audit-logged external reference; cancellation moves a successful MoMo/Airtel/manual-MoMo payment to `REFUND_PENDING` in the same transaction.
- Manual MoMo verification fallback.
- Payment records linked to orders and the reconciliation report.

**Gate:** a sandbox payment and a duplicate webhook pass, and a POSTPAY tab settles by cash or manual MoMo without changing kitchen status. Do not switch to production credentials until the client-owned account and KYC are confirmed.

#### C6 — Delivery & dispatch

- Outlet-scoped zones, fees, ETAs, and active/inactive flags.
- Server-side fee recomputation; ignore any client-supplied fee.
- Required room/office/gate note, recipient name, and rider-callable phone.
- Optional one-shot GPS pin and static Google Maps link; no map SDK or API key.
- FOH dispatch queue, rider handoff, advance/return fields, failed-delivery outcomes, and delivery chit.
- No rider login, rider app, or live tracking.

**Gate:** delivery tests 5–14 pass, including cross-outlet zone rejection, missing-field rejection, fee integrity, dispatch, and failed delivery.

#### C7 — Cash count & digest

- Cash count entry, expected-cash formula, and variance.
- Shift-close reconciliation using `payments.carrier`, not a nonexistent `method`.
- 21:30 EAT digest with idempotency, retry, signed report link, and PII exclusion.
- Africa's Talking SMS and SMTP email; optional owner-only WhatsApp disabled by default.
- Manual `--dry-run` support.

**Gate:** cash/digest tests 21–37 pass; a missing cash count says `CASH_COUNT_MISSING`, never a fabricated zero.

#### C8 — Hardening & deployment

- Production Compose, no host ports for PostgreSQL, Redis, or the API; printer outbound-only.
- Backup script, restore test, log rotation, monitoring, and graceful UPS shutdown.
- Security headers, CORS, rate limits, session hardening, and secret handling.
- Rush-hour load simulation and WAN-off recovery.
- Optional Cloudflare Tunnel behind Access; no DB/Redis/printer exposure.
- Final deployment runbook with real site values.

**Gate:** restore, security (including tests 38–39), offline, and performance checks pass on the edge hardware.

#### C9 — Release candidate & UAT fixes

- Fix only validated UAT defects and acceptance blockers.
- Accessibility and touch-target checks on the actual tablets.
- Final synthetic training data, role cards, and release notes.
- Freeze features; no new scope in the release candidate.
- Run the full regression checklist.

**Gate:** the client signs UAT and the go-live checklist, or issues a punch list under the contract.

#### C10 — Hypercare patches

- Fix Sev 1/2 production defects.
- No new features, no Phase 2 work, no silent scope changes.
- Record every patch, migration, and configuration change.
- Hand over the stabilized system and the hypercare report.

### 12.4 Definition of done for every coding phase

- [ ] The acceptance test for the slice is written first or alongside the code.
- [ ] Database changes are in a migration; no manual production edits.
- [ ] Server-side validation exists for every client input that matters.
- [ ] The UI calls the real API contract, not a mock that will be thrown away.
- [ ] Tests cover the happy path and the important failure path.
- [ ] Lint, typecheck, tests, and build pass.
- [ ] The slice is demonstrated on the running app.
- [ ] Documentation and `.env.example` are updated if behavior changed.
- [ ] No secrets, production data, or fake success responses are committed.
- [ ] The diff is small enough to review without guessing what changed.

### 12.5 How the work will be sequenced in practice

When you authorize the build, I will:

1. Start with **C0 and C1** on the actual repository.
2. Show the diff and run the available checks.
3. Move to **C2–C4** only after the foundation is green.
4. Add **C5–C7** in dependency order, with tests at each gate.
5. Finish with **C8–C9**, then support **C10** during hypercare.

I will not generate every file in one response, and I will not jump to payments, delivery, or dashboards while the schema, auth, or order core is still unverified. If a phase cannot run or test cleanly, it is not complete.

---

## 13. Related Documents

| Document | Use in this plan |
| :--- | :--- |
| `Service_Contract_and_Invoice_Template.md` | Commercial milestones, acceptance, support hours, and change control |
| `Repo_Scaffold_and_Config.md` | Canonical repository tree, dependencies, and environment variables |
| `Deployment_Runbook.md` | Edge-node installation, backups, restore, monitoring, and rollback |
| `Seed_Data_and_Testing.md` | Seed data, E2E checklist, and cash/digest test cases |
| `Delivery_Zones_and_Dispatch.md` | Zone model, dispatch flow, chit contract, and Phase 2 triggers |
| `Payment_Integration.md` | MoMo/Airtel flows, webhook idempotency, and reconciliation |
| `Daily_Audit_Digest.md` | 21:30 owner report, variance rules, and delivery channels |
| `Foundational_Concept.md` | Four-role RBAC, business scope, and success metrics |
