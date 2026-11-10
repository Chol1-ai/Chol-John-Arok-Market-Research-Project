# Engineering Roadmap & Phase Status

**Document Type:** Current implementation status and delivery roadmap
**Implementation Stack:** Static HTML/CSS/JavaScript served by Node.js; TypeScript + Fastify API; Prisma ORM + PostgreSQL
**Target Hardware:** In-Store Intel NUC / Mini-PC Edge Node + 80mm ESC/POS Thermal LAN Printers  
**Target Locations:** Foodizo (Ham Towers) & Obunuzi Restaurant & Cafe (Opposite YMCA), Kampala, Uganda  
**Related Specifications:** `build_strategy/Dashboard_Build_Progression.md` · `docs/Tech_Stack.md` · `docs/Repo_Scaffold_and_Config.md` · `docs/Payment_Integration.md` · `docs/Delivery_Zones_and_Dispatch.md` · `docs/Hardware_and_Peripherals.md` · `docs/Seed_Data_and_Testing.md` · `docs/Deployment_Runbook.md` · `go_to_market/Go_To_Market_Strategy.md`

**Status reviewed:** 2026-11-10

> This roadmap separates what is present in the repository from what has been verified for release. “Implemented” means the capability exists in the local application; it does not mean production deployment, hardware acceptance, or client sign-off. Historical architecture details and estimates have been removed; this document reflects the current implementation rather than proposed Next.js, Redis, or Docker work.

## 1. Current Implementation Snapshot

The application is served by root `server.js`; live surfaces are `/login`, `/pos`, `/kds`, `/dispatch`, `/admin`, and pickup ordering at `/order` (also `/customer`), with public order status by token and a public `/d/:token` digest. Other customer-facing pages under `/prototype/*` remain static prototypes. The backend uses Fastify, Prisma, PostgreSQL, an in-process WebSocket bus, and an in-process `node-cron` digest scheduler. See `docs/Repo_Scaffold_and_Config.md` for the maintained architecture.

| Phase | Scope | Current status | Remaining evidence or work |
| :--- | :--- | :--- | :--- |
| C0 | Repository, runtime, quality gates | **Implemented, adapted** | The current static-server/backend layout builds and tests. The original Next.js/Docker gates do not apply. |
| C1 | Data model, authentication, RBAC, audit | **Implemented locally** | Production backup/restore and deployment configuration still need verification. |
| C2 | Menu, inventory, BOM | **Implemented locally** | Opening counts, stock movements, supplier orders/receipts, recipe deductions, low-stock display, and recipe-stock-aware menu/order validation pass local tests. Confirm BOM quantities with kitchen operations during UAT. |
| C3 | Orders, KDS, printing | **Implemented locally** | Automated tests cover key flows. Physical printer operation and WAN-off LAN behavior have not been evidenced here. |
| C4 | Customer ordering and digital tokens | **Partial** | Live API-backed pickup and delivery ordering, outlet-aware menu/availability, public token status, and staff cash collection are implemented locally. Customer mobile-money payment remains blocked on C5. |
| C5 | Payments | **Partial** | Non-production initiation is simulated; production refuses fabricated prompts. Signed, idempotent webhook handling exists, but live MTN/Airtel clients and sandbox verification remain blocked on provider credentials and a reachable callback URL. |
| C6 | Delivery and dispatch | **Implemented locally; UAT pending** | Live zone-priced customer delivery checkout, kitchen queueing, outlet-scoped rider dispatch, COD collection/audit, and completion are covered by integration tests. Broader browser/device and real operational acceptance tests remain. |
| C7 | Cash reconciliation and daily digest | **Implemented locally** | Digest/cash flows exist; SMS is mock in development, email is not configured, and production delivery/scheduling is unverified. |
| C8 | Deployment hardening and offline operation | **Pending verification** | Complete deployment, backup/restore, security, and WAN-disconnection drills on the intended edge hardware. |
| C9 | Release candidate and UAT | **Pending formal acceptance** | Run browser/device E2E and physical workflow tests; record severity triage and stakeholder sign-off. |
| C10 | Production go-live and hypercare | **Pending** | Requires passed release gates, approved production configuration, operational ownership, and a documented support period. |

### 1.1 Verified Local Baseline

As of 2026-11-10, C6 local verification passed: `npm run backend:build`, `npm test` (27 tests), JavaScript syntax checks, `git diff --check`, and Prisma migration status. Browser smoke testing placed a zone-priced COD delivery, followed it through kitchen and dispatch, and verified the handoff recorded payment and change and removed the order from the active queue. These results validate local build and covered behavior only; they do not prove live telco, printer, offline, production deployment, or operational UAT readiness.

> **Test safety:** The integration suite runs the canonical seed, which clears and rebuilds development operational data. Run it only against a disposable or explicitly designated development database.

### 1.2 Recommended Delivery Sequence

1. Finish C4/C6 acceptance testing and close the remaining C5 gap. Customer mobile-money still requires provider credentials, a reachable callback URL, and verified end-to-end testing; do not treat mock payment initiation as production-ready. Confirm recipe quantities with kitchen operations during C9 UAT.
2. Complete C8 on the intended host: production configuration, migration and backup/restore rehearsal, access review, and WAN-off LAN test.
3. Run C9 end-to-end on the target browsers and hardware, including printer checks, dispatch, cash close, digest outcomes, and staff role workflows. Track evidence and unresolved defects.
4. Approve C10 only after the release gates below are evidenced and the client accepts the operational handover.

### 1.3 Release Gates

| Gate | Required evidence | Current status |
| :--- | :--- | :--- |
| G1 — Staging ready | Reproducible supported deployment, health check, RBAC verification, and successful backup/restore rehearsal | **Not evidenced** |
| G2 — Core LAN workflow | Order-to-KDS-to-print and dine-in lifecycle verified on target LAN, including WAN disconnection | **Not evidenced** |
| G3 — Financial and dispatch | Payment approach approved and tested, duplicate/late payment handling, dispatch/cash reconciliation, digest privacy and delivery outcomes verified | **Partially covered locally; not release-verified** |
| G4 — UAT accepted | Agreed acceptance checklist passed, no open critical/high defects, staff training completed, client sign-off recorded | **Not evidenced** |
| G5 — Stable handover | Production service meets an agreed stable-operation period; reconciliation and support ownership accepted | **Not evidenced** |
| G6 — Pilot review | Operational results reviewed and Phase 2 decision recorded | **Not started** |

Gate statuses are evidence-based: an empty or undocumented production check is **not** considered passed. Update this table when dated test records, deployment evidence, or signed acceptance become available.
