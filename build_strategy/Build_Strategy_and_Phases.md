# Engineering Roadmap & Phase Status

**Document Type:** Current implementation status and delivery roadmap
**Implementation Stack:** Static HTML/CSS/JavaScript served by Node.js; TypeScript + Fastify API; Prisma ORM + PostgreSQL
**Target Hardware:** In-Store Intel NUC / Mini-PC Edge Node + 80mm ESC/POS Thermal LAN Printers  
**Target Locations:** Foodizo (Ham Towers) & Obunuzi Restaurant & Cafe (Opposite YMCA), Kampala, Uganda  
**Related Specifications:** `build_strategy/Dashboard_Build_Progression.md` · `docs/Tech_Stack.md` · `docs/Repo_Scaffold_and_Config.md` · `docs/Payment_Integration.md` · `docs/Delivery_Zones_and_Dispatch.md` · `docs/Hardware_and_Peripherals.md` · `docs/Seed_Data_and_Testing.md` · `docs/Deployment_Runbook.md` · `go_to_market/Go_To_Market_Strategy.md`

**Status reviewed:** 2026-11-11

> This roadmap separates what is present in the repository from what has been verified for release. “Implemented” means the capability exists in the local application; it does not mean production deployment, hardware acceptance, or client sign-off. Historical architecture details and estimates have been removed; this document reflects the current implementation rather than proposed Next.js, Redis, or Docker work.

## 1. Current Implementation Snapshot

The application is served by root `server.js`; live surfaces are `/login`, `/pos`, `/kds`, `/dispatch`, `/admin`, customer ordering at `/order` (also `/customer`), public token-based order tracking at `/tracker`, and a public `/d/:token` digest. Former `/prototype/*` and legacy design-file URLs redirect to the live customer or role-protected staff workflows. The backend uses Fastify, Prisma, PostgreSQL, an in-process WebSocket bus, and an in-process `node-cron` digest scheduler. See `docs/Repo_Scaffold_and_Config.md` for the maintained architecture.

| Phase | Scope | Current status | Remaining evidence or work |
| :--- | :--- | :--- | :--- |
| C0 | Repository, runtime, quality gates | **Implemented, adapted** | The current static-server/backend layout builds and tests. The original Next.js/Docker gates do not apply. |
| C1 | Data model, authentication, RBAC, audit | **Implemented locally** | Production backup/restore and deployment configuration still need verification. |
| C2 | Menu, inventory, BOM | **Implemented locally** | Opening counts, stock movements, supplier orders/receipts, recipe deductions, low-stock display, and recipe-stock-aware menu/order validation pass local tests. Configured BOM values were inspected on 2026-11-11; kitchen confirmation is still pending. |
| C3 | Orders, KDS, printing | **Implemented locally** | Automated tests cover key flows. Physical printer operation and WAN-off LAN behavior have not been evidenced here. |
| C4 | Customer ordering and digital tokens | **Implemented locally; acceptance pending** | Clean-page browser check on 2026-11-11 placed a local pickup order and verified the same token, item, outlet, and status on the standalone tracker; the unpaid test order was then cancelled. Complete staff/device sign-off. The customer hub links to live workflows; former prototype URLs redirect to live pages. |
| C5 | Payments | **Partial; provider access pending** | Mobile money is required before final release. The user is awaiting MTN/Airtel connectivity/credentials; non-production initiation remains simulated and production refuses fabricated prompts. Wire and sandbox-test providers only after credentials and a reachable callback URL are supplied. |
| C6 | Delivery and dispatch | **Implemented locally; UAT pending** | Automated integration tests cover zone-priced delivery, kitchen queueing, outlet-scoped rider dispatch, COD collection/audit, completion, and public delivery status. A 2026-11-11 local preview confirmed the Ham Towers zone fee and total; end-to-end acceptance on intended devices and staff review remain. |
| C7 | Cash reconciliation and daily digest | **Implemented locally** | Digest/cash flows exist; SMS is mock in development, email is not configured, and production delivery/scheduling is unverified. |
| C8 | Deployment hardening and offline operation | **Partial, locally hardened; acceptance pending** | Production configuration now fails closed for missing secrets, non-HTTPS origins, or non-local API binding, and health checks verify PostgreSQL readiness. Complete deployment, backup/restore, security, and WAN-disconnection drills on the intended edge hardware. |
| C9 | Release candidate and UAT | **Partial, local browser UAT passed; acceptance pending** | 2026-11-11 clean-page pickup/tracker, waiter POS, kitchen KDS, outlet-denial, and delivery-fee preview checks passed locally. The backend build and 34 automated tests last passed on 2026-11-10. See `docs/UAT_Release_Candidate.md`. Complete recipe/staff sign-off on intended devices, resolve C8/C5 gates, and obtain stakeholder acceptance. |
| C10 | Production go-live and hypercare | **Pending** | Requires passed release gates, approved production configuration, operational ownership, and a documented support period. |

### 1.1 Verified Local Baseline

As of 2026-11-10, C6 local verification passed: `npm run backend:build`, `npm test` (34 tests), JavaScript syntax checks, `git diff --check`, and Prisma migration status. Browser smoke testing placed a zone-priced COD delivery, followed it through kitchen and dispatch, and verified the handoff recorded payment and change and removed the order from the active queue. These results validate local build and covered behavior only; they do not prove live telco, printer, offline, production deployment, or operational UAT readiness.

> **Test safety:** The integration suite runs the canonical seed, which clears and rebuilds development operational data. Run it only against a disposable or explicitly designated development database.

### 1.2 Previous Phase Checkpoint (2026-11-10)

- The backend production build passed, and the full `npm test` suite passed (34 tests across 7 files), including the integration suite against the user-confirmed disposable development database.
- The integration app uses a higher global rate limit only when `NODE_ENV=test`, preventing the suite's in-process requests from exhausting the production/development limit. Normal environments retain the 120-request limit.
- Prisma schema validation and migration status passed; `git diff --check` passed. The local API health endpoint returned `UP`.
- A current local customer pickup submission returned a token; direct requests to both the backend and same-origin frontend proxy returned the correct `AWAITING_PAYMENT` order. The shared browser displayed an unrelated fixture for that token, so tracker UI acceptance remains inconclusive and must be repeated in a clean/target browser.
- The customer homepage at `/` highlights menu items and restaurant locations; staff sign-in is separate at `/staff`. Browser smoke checks confirmed that former customer/staff prototype URLs redirect to live workflows, preserving order query parameters.
- The deployment runbook now directs acceptance testing through the live customer order/tracker and requires MTN/Airtel sandbox verification before release.
- The integration suite reseeded operational data as designed, then the canonical seed was run again successfully after testing and the local pickup smoke test. The database is left in its canonical seeded state.
- Local migration/readiness checks are complete; C8 target-host setup, backup/restore rehearsal, and WAN-disconnection testing still require the intended deployment hardware and network.
- Mobile money is a required pre-release capability, intentionally waiting on MTN/Airtel provider access. Do not mark C5, C9, or go-live complete until provider integration and acceptance are evidenced.

### 1.3 Current Acceptance Checkpoint (2026-11-11)

- The local backend and same-origin health checks returned `UP`. In a clean browser page, the current Foodizo menu and images loaded, including the Rwenzori Bottle photo.
- A local pickup order for one Rwenzori Bottle (UGX 1,500) displayed the correct `AWAITING_PAYMENT` status on both confirmation and a separate `/tracker` page. The earlier shared-browser mismatch is resolved for this clean-page check.
- The unpaid development test order was cancelled and its tracker changed to `CANCELLED`; the cancelled test row and audit entry remain in the local development database.
- Delivery preview showed the Ham Towers UGX 1,000 fee, 5–10 minute estimate, and UGX 2,500 total for the same item. Checkout was not submitted.
- Sarah K. signed in to the Foodizo POS (16 tables), and Chef Juma signed in to the Foodizo KDS (live bus connected; seeded tickets left unchanged). A cross-outlet queue request returned `403 OUTLET_FORBIDDEN`.
- Configured recipe/BOM values were read for staff review, not accepted as accurate recipes: chicken uses 2 broiler pieces, 250 g potatoes, and 50 ml oil; a regular Rolex uses 2 eggs and 15 ml oil; beef luwombo uses 350 g beef and 1 matooke portion. Kitchen confirmation remains outstanding.
- No production database, real customer order, physical staff device, or printer was used. The local database contains seeded demo data plus the cancelled, unpaid UAT order; it is not an operations database.
- Backend build and the full 34-test suite last passed on 2026-11-10. Target-host backup/restore and WAN-off testing, MTN/Airtel provider access, staff recipe/workflow sign-off, and intended-device acceptance remain open.

### 1.4 Recommended Delivery Sequence

1. Complete remaining C4/C6 human acceptance: have kitchen and front-of-house staff confirm recipe quantities and real workflows, then repeat on intended tablets/phones. Clean-page customer tracking, waiter/KDS login, outlet denial, and a delivery fee preview are now locally verified.
2. Continue C8 deployment readiness on the intended host: production configuration, migration and backup/restore rehearsal, access review, and WAN-off LAN test.
3. When MTN/Airtel provide the required access, complete C5 provider integration and sandbox/webhook verification. Mobile money is required before release; simulated prompts are not acceptable as production payments.
4. Run C9 end-to-end on target browsers and hardware, including printer checks, dispatch, cash close, digest outcomes, staff role workflows, and mobile-money acceptance. Obtain client sign-off.
5. Approve C10 only after the release gates below are evidenced and the client accepts the operational handover.

### 1.5 Release Gates

| Gate | Required evidence | Current status |
| :--- | :--- | :--- |
| G1 — Staging ready | Reproducible supported deployment, health check, RBAC verification, and successful backup/restore rehearsal | **Not evidenced** |
| G2 — Core LAN workflow | Order-to-KDS-to-print and dine-in lifecycle verified on target LAN, including WAN disconnection | **Not evidenced** |
| G3 — Financial and dispatch | Payment approach approved and tested, duplicate/late payment handling, dispatch/cash reconciliation, digest privacy and delivery outcomes verified | **Partially covered locally; not release-verified** |
| G4 — UAT accepted | Agreed acceptance checklist passed, no open critical/high defects, staff training completed, client sign-off recorded | **Not evidenced** |
| G5 — Stable handover | Production service meets an agreed stable-operation period; reconciliation and support ownership accepted | **Not evidenced** |
| G6 — Pilot review | Operational results reviewed and Phase 2 decision recorded | **Not started** |

Gate statuses are evidence-based: an empty or undocumented production check is **not** considered passed. Update this table when dated test records, deployment evidence, or signed acceptance become available.
