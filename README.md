# Chol-John-Arok-Market-Research-Project

Solution Project: Foodizo & Obunuzi Restaurant & Cafe
1. Business Name
●	Selected Eateries for Comparative Solution Development:
1.	Foodizo (Ham Towers)
2.	Obunuzi Restaurant & Cafe (Opposite YMCA)
2. Main Contact Persons
●	a. Name: Mr. Cyrus / Assistant Manager (Foodizo Ham Towers)
●	b. Phone Number/WhatsApp: +256 768 550986

●	a. Name: Mr. Mubiru Mahad / Waiter (Obunuzi Restaurant & Cafe)
●	b. Phone Number/WhatsApp: +256 760 723280

3. List of All the Gaps and Challenges
Based on the market research and operational focus for both establishments:
●	Challenge 1: High-Volume Queue Management and Speed (Foodizo): Managing rapid student traffic surges during peak windows (1:00 PM–3:00 PM and 6:00 PM–8:00 PM) handling 150–200 daily customers without long delays.

●	Challenge 2: Supply Chain and Price Volatility (Foodizo): Dealing with price volatility for fresh cooking oil and maintaining stable daily deliveries of high-turnover items like fresh poultry, fried chicken, Rolex wraps, and beef Luwombo.


●	Challenge 3: Multi-Channel Order Coordination (Obunuzi Restaurant & Cafe): Balancing a 60/40 split between sit-down diners and phone-based takeaway/delivery orders without causing order backlog or confusion.

●	Challenge 4: Food Surplus and Waste Management (Obunuzi Restaurant & Cafe): Managing moderate batch cooking and late-evening discounting manually, risking inventory discrepancies if ticket volumes fluctuate.

4. List of All Possible Solutions for Each Challenge
●	For Challenge 1 (High-Volume Queue Management):
	Implement a student-focused digital pre-ordering mobile app allowing users to order ahead and skip the counter queue.
	Install fast self-checkout POS terminals at the Ham Towers location.

●	For Challenge 2 (Supply Chain and Price Volatility):
	Integrate automated stock-tracking linked directly to supplier pricing alerts for poultry and cooking oil.
	Use predictive sales analytics based on university schedules to optimize daily ingredient prep for high-turnover items (fried chicken, Rolex, beef Luwombo).

●	For Challenge 3 (Multi-Channel Order Coordination):
	Deploy a centralized Kitchen Display System (KDS) that consolidates sit-down table-side tickets and phone-based takeaway orders into a single queue.

●	For Challenge 4 (Food Surplus and Waste Management):
	Implement real-time inventory decrementing and end-of-day surplus tracking to optimize batch-cooking metrics and automate late-evening discounted meal notifications.

> **Scope note:** These are solutions from the original brief, not all Phase 1 commitments. The Phase 1 system records surplus and provides a **manual** clearance action; predictive sales analytics based on university schedules and automated late-evening discounted-meal notifications are explicitly deferred to Phase 2. Phase 1 also uses no automated supplier-price alerts; it tracks stock against menu-item BOMs and surfaces low-stock flags.

5. Pick One Solution to Build
●	Selected Solution: Centralized Multi-Channel Order and Kitchen Display System (KDS) Integrated with Automated Inventory Tracking.

●	Rationale: This directly solves Obunuzi's multi-channel order split (sit-down vs. phone delivery) while addressing Foodizo's high-volume student traffic surges and high-turnover inventory items (poultry, cooking oil, local staples) to minimize waste and speed up fulfillment.

6. Research Existing Similar Solutions in the Market
●	TouchBistro / Square for Restaurants: Comprehensive POS platforms capable of managing multi-channel orders (sit-down and takeout) and tracking real-time inventory.

●	Toast POS: Offers robust Kitchen Display System (KDS) integrations and advanced reporting on high-turnover items.


●	Local Context Adaptations: Integration with Ugandan mobile money gateways (MTN/Airtel Money) and local supplier tracking to accommodate regional supply chain nuances for items like matooke, posho, and fresh poultry.

### Delivery Design Decision

Delivery uses the local-first **Zone & Landmark Dropdown + Direct Phone/WhatsApp Dispatch** model. The customer selects an outlet-scoped zone (Makerere halls, YMCA, Ham Towers, Wandegeya Market), adds an exact room/office/gate note, and provides a rider-callable phone number. A one-shot HTML5 GPS pin is optional and never blocks checkout. The kitchen prints a delivery chit at `READY`; FOH dispatches the rider with `tel:` and `wa.me` links and records the rider handoff plus any cash transport advance, so the usual UGX 1,500–3,000 stage-boda payment reconciles at shift close.

Live embedded maps, continuous rider tracking, and a rider app are **deferred to Phase 2**. Phase 1 uses no map SDK, no API key, and no map API fees; the only map surface is a static Google Maps link the customer or FOH taps to open. The full specification is in **[Delivery Zones & Dispatch](docs/Delivery_Zones_and_Dispatch.md)**.

---

## 7. Master Specification Blueprint (`docs/`)

The end-to-end implementation specifications for Antigravity IDE and Opencode CLI are organized across 15 modular documents:

1. **[Foundational Concept](docs/Foundational_Concept.md)** — High-volume queue bypass, multi-channel order collision resolution, 4-role RBAC matrix, delivery model, and operational boundaries.
2. **[Design System](docs/Design_System.md)** — Role-differentiated palettes, tactile component specs, Digital Token card, table occupancy grid, delivery checkout/dispatch surfaces, channel status badges, and the anti-generic DOs/DON'Ts.
3. **[User Flow](docs/User_Flow.md)** — Prepaid `AWAITING_PAYMENT` gate, four KDS lifecycle states (`PENDING` → `PREPARING` → `READY` → `COMPLETED`), postpay table tabs, delivery handoff, and end-of-day surplus logs.
4. **[User Profiles & Personas](docs/User_Profiles_Personas.md)** — User archetypes for Zito Mbowe, Brian K., Prossy N., Chef Juma, and the Phase 1 rider actor.
5. **[Delivery Zones & Dispatch](docs/Delivery_Zones_and_Dispatch.md)** — Zone/landmark checkout, optional one-shot GPS pin, rider-callable phone, FOH dispatch queue, ESC/POS chit contract, privacy rules, and Phase 2 live-tracking triggers.
6. **[Tech Stack](docs/Tech_Stack.md)** — Fastify backend, Prisma ORM, canonical PostgreSQL 16 DDL (users/sessions/audit, menu, orders, tokens, payments, delivery zones/handoffs, cash counts, digests), staff auth/RBAC, and local edge deployment.
7. **[Payment Integration](docs/Payment_Integration.md)** — MTN MoMo, Airtel Money, cash and manual-MoMo flows; delivery-fee inclusion; concurrency-safe webhooks; one-success/refund handling; and reconciliation.
8. **[Hardware & Peripherals](docs/Hardware_and_Peripherals.md)** — ESC/POS thermal packaging and delivery chits, Africa's Talking SMS gateway, and UMEME load-shedding/mini-UPS power protocols.
9. **[Seed Data & Testing](docs/Seed_Data_and_Testing.md)** — Prisma seed with server-owned menu prices, hashed demo PINs, delivery zones, menu-ID BOM conversions, prepaid/concurrency test runner, digest/cash-count test cases, and E2E checklist.
10. **[Repo Scaffold & Config](docs/Repo_Scaffold_and_Config.md)** — `src/app` directory tree, Next.js 14 + Fastify dependencies and quality scripts (`lint`/`typecheck`/`test`), Docker build files, server-only `.env.example`, client env template, auth/menu routes, and CLI bootstrap instructions.
11. **[Demo Script & Closing Strategy](docs/Demo_Script_and_Closing_Strategy.md)** — Minute-by-minute live demonstration flow, delivery dispatch demo, objection handling guide, and commercial implementation proposal in UGX to close Zito Mbowe.
12. **[Daily Audit Digest](docs/Daily_Audit_Digest.md)** — 21:30 EAT owner SMS/email report, real cash-variance rules, inventory and exception flags, idempotency, and security constraints.
13. **[Deployment Runbook](docs/Deployment_Runbook.md)** — Edge-first Docker Compose stack, in-store LAN/router topology, optional Cloudflare Tunnel, backups, restore tests, and rollback.
14. **[Service Contract & Invoice Template](docs/Service_Contract_and_Invoice_Template.md)** — Milestone-based service agreement and UGX invoice template for legal review; not legal advice.
15. **[Implementation Phases & Delivery Gates](docs/Implementation_Phases.md)** — Stage 0–6 delivery sequence, coding build order (C0–C10), evidence-based gate criteria, RACI, dependencies, change control, and Phase 2 hand-off.
