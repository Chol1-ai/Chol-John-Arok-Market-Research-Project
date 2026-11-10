# C9 Release Candidate UAT Record

**Execution date:** 2026-11-10  
**Environment:** Local development server and seeded development database  
**Result:** Partial local UAT passed; release acceptance remains open

This record covers the local browser smoke test and automated checks available in this environment. It is not production, hardware, or stakeholder acceptance. The integration suite reseeds the development database; no production data was used.

## Executed checks

| Area | Result | Evidence / notes |
| :--- | :--- | :--- |
| Backend build and automated suite | **PASS** | Production TypeScript build passed; full suite passed with 32 tests across 7 files. |
| Customer menu and product photos | **PASS** | Foodizo menu loaded with matching chicken, water, juice, chips, and Rolex photos. Image responses loaded in-browser and returned JPEG content from the local server. |
| Pickup checkout and public status | **PASS** | Created a labeled development-only pickup order, token `TOKEN-020`, for UGX 14,000. It initially showed cash due and not yet in the kitchen. |
| Staff login and cash collection | **PASS** | Seeded Foodizo waiter login reached POS; recording UGX 14,000 cash moved the order into the kitchen queue. |
| Kitchen queue and status transition | **PASS** | Seeded Foodizo kitchen login reached KDS; the test ticket transitioned `PENDING → PREPARING → READY`; the public token page then displayed ready-for-pickup status. |
| Delivery checkout preview | **PASS** | Ham Towers fee showed UGX 1,000; a UGX 14,000 meal produced a UGX 15,000 total and enabled checkout. The preview was not submitted, so no additional delivery order was created. |
| Manager dashboard and dispatch | **PASS WITH REVIEW ITEMS** | Manager login, live bus, dashboard, and dispatch queue loaded. The seeded database surfaced cash variance, failed-payment, failed-delivery, low-stock, and handoff-review alerts. These are seed/test records, not verified business activity. |

## Findings and disposition

No reproducible application defect was found in the browser flows listed above. The manager and dispatch warning data is **not classified as a software defect**; the business owner must confirm how these seeded exceptions should appear and ensure demo records are not mistaken for actual operations.

The labeled pickup UAT order remains in the local development database in `READY` status with its test cash settlement recorded. It was not represented as a physical handoff. Do not treat this record as a real sale; clean or reseed the development database before a clean demonstration.

## Acceptance gates still open

- Obtain manager/owner and kitchen/front-of-house sign-off using real operational scenarios and correct outlet data.
- Repeat the workflows on the intended tablets/phones, including touch usability, responsive layout, session expiry, and role/outlet access.
- Complete C8 intended-host deployment, backup/restore rehearsal, and WAN-disconnection testing.
- Verify printer output and cash drawer operation on the actual hardware. The automated integration run logged printer connection timeouts because no printer was reachable.
- Verify any live mobile-money/SMS channels only after provider credentials and a reachable callback are available; C5 remains partial.
- Review seeded/demonstration exception records before presenting manager cash and dispatch summaries as live operational figures.

**C9 status:** Partial local browser UAT passed. Do not mark the release candidate accepted or proceed to production go-live until the open gates above have evidence and stakeholder approval.
