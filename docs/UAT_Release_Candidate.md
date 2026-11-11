# C9 Release Candidate UAT Record

**Execution dates:** 2026-11-10 and 2026-11-11
**Environment:** Local development server and seeded development database  
**Result:** Partial local UAT passed; release acceptance remains open

This record covers the local browser smoke test and automated checks available in this environment. It is not production, hardware, or stakeholder acceptance. The integration suite reseeds the development database; no production data was used.

## Executed checks — 2026-11-10

| Area | Result | Evidence / notes |
| :--- | :--- | :--- |
| Backend build and automated suite | **PASS** | Production TypeScript build passed; full suite passed with 34 tests across 7 files, including integration tests on the confirmed disposable development database. |
| Customer menu and product photos | **PASS** | Foodizo menu loaded with matching chicken, water, juice, chips, and Rolex photos. Image responses loaded in-browser and returned JPEG content from the local server. |
| Pickup checkout and public status | **PASS** | Created a labeled development-only pickup order, token `TOKEN-020`, for UGX 14,000. It initially showed cash due and not yet in the kitchen. |
| Current customer pickup submission and token API | **PASS (API); browser status display inconclusive** | Submitted a local pickup order for a seeded menu item. The backend and frontend same-origin proxy both returned the new token's order in `AWAITING_PAYMENT`. The shared browser then displayed an unrelated fixture for that token; see findings below. |
| Staff login and cash collection | **PASS** | Seeded Foodizo waiter login reached POS; recording UGX 14,000 cash moved the order into the kitchen queue. |
| Kitchen queue and status transition | **PASS** | Seeded Foodizo kitchen login reached KDS; the test ticket transitioned `PENDING → PREPARING → READY`; the public token page then displayed ready-for-pickup status. |
| Delivery checkout preview | **PASS** | Ham Towers fee showed UGX 1,000; a UGX 14,000 meal produced a UGX 15,000 total and enabled checkout. The preview was not submitted, so no additional delivery order was created. |
| Manager dashboard and dispatch | **PASS WITH REVIEW ITEMS** | Manager login, live bus, dashboard, and dispatch queue loaded. The seeded database surfaced cash variance, failed-payment, failed-delivery, low-stock, and handoff-review alerts. These are seed/test records, not verified business activity. |

## Findings and disposition

On 2026-11-10 the shared browser displayed `ORD-TEST123` for the newly issued token, but direct requests to both the local backend and frontend proxy returned the actual order in `AWAITING_PAYMENT`. The tracker UI check was inconclusive at that time; the clean-page recheck below subsequently passed. The manager and dispatch warning data is **not classified as a software defect**; the business owner must confirm how these seeded exceptions should appear and ensure demo records are not mistaken for actual operations.

The earlier `TOKEN-020` pickup UAT order and the latest pickup smoke-test order were removed by the canonical reseed after testing. Demo seed records remain; none of these test orders represented a physical handoff or a real sale.

## 2026-11-11 clean-browser recheck

The local frontend and backend were started against the configured development database. The API and same-origin health endpoints both returned `UP`. A new browser page without prior tracker state was used for the checks below.

| Area | Result | Evidence / notes |
| :--- | :--- | :--- |
| Live customer menu and product photos | **PASS** | All five Foodizo menu cards rendered; each image loaded, including the Rwenzori Bottle fallback photo. |
| Pickup order and standalone tracker | **PASS** | Placed one local pickup order for one Rwenzori Bottle (UGX 1,500). The order page and a separate `/tracker` page displayed token `#020`, the correct order reference, outlet, item, and `AWAITING_PAYMENT` cash-at-counter instructions. |
| Test-order cleanup | **PASS** | Manager-cancelled the unpaid development UAT order with an audit reason. A tracker refresh displayed `CANCELLED`. No cash was recorded and no kitchen preparation was started. The cancelled test row and audit entry remain in the local development database. |
| Delivery checkout preview | **PASS (preview only)** | One Rwenzori Bottle at UGX 1,500 plus the Ham Towers zone fee of UGX 1,000 showed UGX 2,500 total and the 5–10 minute estimate. Checkout was not submitted. |
| Foodizo waiter role and outlet access | **PASS** | Sarah K. signed in through the PIN UI and reached the Foodizo POS with 16 tables. A read-only attempt to view the Obunuzi awaiting-payment queue returned `403 OUTLET_FORBIDDEN`. |
| Foodizo kitchen role | **PASS (read-only)** | Chef Juma signed in and reached the KDS; the live event bus connected and the seeded active tickets rendered. Seeded tickets were not changed during this recheck. |
| Recipe/BOM operational confirmation | **PENDING STAFF REVIEW** | Local configured examples include chicken with 2 broiler pieces, 250 g potatoes, and 50 ml cooking oil; a regular Rolex with 2 eggs and 15 ml oil; and beef luwombo with 350 g beef plus 1 matooke portion. These are configuration values only; kitchen staff have not confirmed they match actual preparation. |

## Acceptance gates still open

- Obtain manager/owner and kitchen/front-of-house sign-off using real operational scenarios and correct outlet data.
- Have kitchen staff verify the configured BOM quantities against actual recipes; this local inspection is not recipe acceptance.
- Repeat the workflows on the intended tablets/phones, including touch usability, responsive layout, session expiry, and role/outlet access.
- Complete C8 intended-host deployment, backup/restore rehearsal, and WAN-disconnection testing.
- The local database migration status is up to date and the local API health endpoint returns `UP`; these checks do not replace target-host deployment and recovery acceptance.
- Verify printer output and cash drawer operation on the actual hardware. The automated integration run logged printer connection timeouts because no printer was reachable.
- Mobile money is required before release. Verify MTN/Airtel sandbox and live callbacks after provider credentials and a reachable callback are available; C5 remains partial until then.
- Review seeded/demonstration exception records before presenting manager cash and dispatch summaries as live operational figures.

**C9 status:** Partial local browser UAT passed. Do not mark the release candidate accepted or proceed to production go-live until the open gates above have evidence and stakeholder approval.
