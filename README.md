# Chol-John-Arok-Market-Research-Project

Solution Project: Foodizo & Obunuzi Restaurant & Cafe
1. Business Name
â—	Selected Eateries for Comparative Solution Development:
1.	Foodizo (Ham Towers)
2.	Obunuzi Restaurant & Cafe (Opposite YMCA)
2. Main Contact Persons
â—	a. Name: Mr. Cyrus / Assistant Manager (Foodizo Ham Towers)
â—	b. Phone Number/WhatsApp: +256 768 550986

â—	a. Name: Mr. Mubiru Mahad / Waiter (Obunuzi Restaurant & Cafe)
â—	b. Phone Number/WhatsApp: +256 760 723280

3. List of All the Gaps and Challenges
Based on the market research and operational focus for both establishments:
â—	Challenge 1: High-Volume Queue Management and Speed (Foodizo): Managing rapid student traffic surges during peak windows (1:00 PMâ€“3:00 PM and 6:00 PMâ€“8:00 PM) handling 150â€“200 daily customers without long delays.

â—	Challenge 2: Supply Chain and Price Volatility (Foodizo): Dealing with price volatility for fresh cooking oil and maintaining stable daily deliveries of high-turnover items like fresh poultry, fried chicken, Rolex wraps, and beef Luwombo.


â—	Challenge 3: Multi-Channel Order Coordination (Obunuzi Restaurant & Cafe): Balancing a 60/40 split between sit-down diners and phone-based takeaway/delivery orders without causing order backlog or confusion.

â—	Challenge 4: Food Surplus and Waste Management (Obunuzi Restaurant & Cafe): Managing moderate batch cooking and late-evening discounting manually, risking inventory discrepancies if ticket volumes fluctuate.

4. List of All Possible Solutions for Each Challenge
â—	For Challenge 1 (High-Volume Queue Management):
ïƒ¼	Implement a student-focused digital pre-ordering mobile app allowing users to order ahead and skip the counter queue.
ïƒ¼	Install fast self-checkout POS terminals at the Ham Towers location.

â—	For Challenge 2 (Supply Chain and Price Volatility):
ïƒ¼	Integrate automated stock-tracking linked directly to supplier pricing alerts for poultry and cooking oil.
ïƒ¼	Use predictive sales analytics based on university schedules to optimize daily ingredient prep for high-turnover items (fried chicken, Rolex, beef Luwombo).

â—	For Challenge 3 (Multi-Channel Order Coordination):
ïƒ¼	Deploy a centralized Kitchen Display System (KDS) that consolidates sit-down table-side tickets and phone-based takeaway orders into a single queue.

â—	For Challenge 4 (Food Surplus and Waste Management):
ïƒ¼	Implement real-time inventory decrementing and end-of-day surplus tracking to optimize batch-cooking metrics and automate late-evening discounted meal notifications.

> **Scope note:** These are solutions from the original brief, not all Phase 1 commitments. The Phase 1 system records surplus and provides a **manual** clearance action; predictive sales analytics based on university schedules and automated late-evening discounted-meal notifications are explicitly deferred to Phase 2. Phase 1 also uses no automated supplier-price alerts; it tracks stock against menu-item BOMs and surfaces low-stock flags.

5. Pick One Solution to Build
â—	Selected Solution: Centralized Multi-Channel Order and Kitchen Display System (KDS) Integrated with Automated Inventory Tracking.

â—	Rationale: This directly solves Obunuzi's multi-channel order split (sit-down vs. phone delivery) while addressing Foodizo's high-volume student traffic surges and high-turnover inventory items (poultry, cooking oil, local staples) to minimize waste and speed up fulfillment.

6. Research Existing Similar Solutions in the Market
â—	TouchBistro / Square for Restaurants: Comprehensive POS platforms capable of managing multi-channel orders (sit-down and takeout) and tracking real-time inventory.

â—	Toast POS: Offers robust Kitchen Display System (KDS) integrations and advanced reporting on high-turnover items.


â—	Local Context Adaptations: Integration with Ugandan mobile money gateways (MTN/Airtel Money) and local supplier tracking to accommodate regional supply chain nuances for items like matooke, posho, and fresh poultry.

### Delivery Design Decision

Delivery uses the local-first **Zone & Landmark Dropdown + Direct Phone/WhatsApp Dispatch** model. The customer selects an outlet-scoped zone (Makerere halls, YMCA, Ham Towers, Wandegeya Market), adds an exact room/office/gate note, and provides a rider-callable phone number. A one-shot HTML5 GPS pin is optional and never blocks checkout. The kitchen prints a delivery chit at `READY`; FOH dispatches the rider with `tel:` and `wa.me` links and records the rider handoff plus any cash transport advance, so the usual UGX 1,500â€“3,000 stage-boda payment reconciles at shift close.

Live embedded maps, continuous rider tracking, and a rider app are **deferred to Phase 2**. Phase 1 uses no map SDK, no API key, and no map API fees; the only map surface is a static Google Maps link the customer or FOH taps to open. The full specification is in **[Delivery Zones & Dispatch](docs/Delivery_Zones_and_Dispatch.md)**.

---

## 7. Master Specification Blueprint (docs/)

The end-to-end technical and operational specifications are organized into clean, dedicated directories without duplication:

### 7.1 Core System Specifications (docs/)
1. **[Foundational Concept](docs/Foundational_Concept.md)** — High-volume queue bypass, multi-channel order collision resolution, 4-role RBAC matrix, delivery model, and Phase 1 scope boundaries.
2. **[Design System](docs/Design_System.md)** — Role-differentiated palettes, tactile component specs, Digital Token card, table occupancy grid, delivery checkout/dispatch surfaces, channel status badges, and anti-generic DOs/DON'Ts.
3. **[User Flow](docs/User_Flow.md)** — Prepaid AWAITING_PAYMENT gate, four KDS lifecycle states (PENDING → PREPARING → READY → COMPLETED), postpay table tabs, delivery handoff, exception flows, and surplus logs.
4. **[User Profiles & Personas](docs/User_Profiles_Personas.md)** — User archetypes for Zito Mbowe, Brian K., Prossy N., Chef Juma, session timeouts, and the Phase 1 rider actor.
5. **[Delivery Zones & Dispatch](docs/Delivery_Zones_and_Dispatch.md)** — Zone/landmark checkout, optional one-shot GPS pin, rider-callable phone, FOH dispatch queue, ESC/POS chit contract, privacy rules, and Phase 2 triggers.
6. **[Tech Stack](docs/Tech_Stack.md)** — Fastify backend, Prisma ORM, canonical schema architecture, staff auth/RBAC, and local edge deployment.
7. **[Payment Integration](docs/Payment_Integration.md)** — MTN MoMo, Airtel Money, cash and manual-MoMo flows; delivery-fee inclusion; concurrency-safe webhooks; refunds; and reconciliation.
8. **[Hardware & Peripherals](docs/Hardware_and_Peripherals.md)** — ESC/POS thermal packaging and delivery chits, print trigger API route, fail-open printer fault handling, Africa's Talking SMS gateway, and mini-UPS power protocols.
9. **[Seed Data & Testing](docs/Seed_Data_and_Testing.md)** — Prisma seed with menu prices, hashed PINs, delivery zones, recipe BOMs, dispatch/digest test fixtures, and 39-point E2E checklist.
10. **[Repo Scaffold & Config](docs/Repo_Scaffold_and_Config.md)** — src/app directory tree, Next.js 14 + Fastify dependencies and quality scripts, Docker build files, .env.example, and CLI bootstrap instructions.
11. **[Daily Audit Digest](docs/Daily_Audit_Digest.md)** — 21:30 EAT owner SMS/email report, real cash-variance rules, inventory summary, digest query specifications, link token generator, and security constraints.
12. **[Deployment Runbook](docs/Deployment_Runbook.md)** — First-boot checklist (21 steps), edge-first Docker Compose stack, in-store LAN topology, backups, restore tests, and rollback.

### 7.2 Engineering Build Strategy & Execution (uild_strategy/)
* **[Build Strategy & Phases](build_strategy/Build_Strategy_and_Phases.md)** — Core engineering architecture, C0–C10 developer execution pipeline, time estimates per phase, client delivery staging (Stages 0–6), acceptance gates (G0–G6), and RACI matrix.
* **[Dashboard Build Progression](build_strategy/Dashboard_Build_Progression.md)** — Screen-by-screen frontend and backend build order (Login → Customer PWA → Waitress POS → Kitchen KDS → Dispatch Queue → Manager Admin → Nightly Digest).
* **[Pre-Coding Readiness Audit](build_strategy/Pre_Coding_Readiness_Audit.md)** — 0–100% specification quality grading report confirming repository readiness prior to coding.

### 7.3 Post-Launch Go-To-Market & Commercials (go_to_market/)
*(Active after development and deployment — not referenced during active coding)*
* **[Go-To-Market Strategy](go_to_market/Go_To_Market_Strategy.md)** — Market entry plan, student pre-order conversion, waitstaff/cook change management, stage boda agreements, and retainer execution.
* **[Demo Script & Closing Strategy](go_to_market/Demo_Script_and_Closing_Strategy.md)** — Live demonstration script, objection handling, and commercial closing proposal in UGX to close Zito Mbowe.
* **[Service Contract & Invoice Template](go_to_market/Service_Contract_and_Invoice_Template.md)** — Milestone-based service agreement and UGX invoice template for legal review.

### 7.4 Frontend Prototypes & UI Screens (frontend/)
* **[Frontend Architecture Guide](frontend/README.md)** — Master index of all 10 canonical fast-casual UI screens, modular stylesheets, and design tokens.
* **[HTML Prototypes](frontend/html/README.md)** (`frontend/html/`) — Standalone HTML prototypes for Surfaces 1–6 (PIN Login, Customer PWA, Floor POS, KDS, Dispatch Queue, Manager Admin).
* **[Modular CSS Stylesheets](frontend/css/README.md)** (`frontend/css/`) — 1-to-1 matching companion CSS files and shared `theme_tokens.css`.
* **[UI Screen Previews](frontend/images/)** (`frontend/images/`) — High-resolution full-screen PNG previews.
* **[Design Tokens Specification](frontend/design_tokens_kampala_fast_casual.md)** (`frontend/design_tokens_kampala_fast_casual.md`) — Fast-casual color palette, typography scales, touch targets, and spacing rules.

### 7.5 Backend Engine & Fastify API (backend/)
* **[Backend Architecture & API Guide](backend/README.md)** — Master guide to the Fastify API engine, Prisma ORM, and WebSocket real-time bus.
* **[Database Schema & Seeder](backend/prisma/)** (`backend/prisma/schema.prisma`) — The authoritative database definition for all 15 models, 13 enums, and relations, plus production seeder `seed.ts`.
* **[API Routes & Plugins](backend/src/)** (`backend/src/`) — Route handlers for Auth, Menu, Tables, Orders, KDS, MoMo Payments, Dispatch, Surplus, and Nightly Digest.
* **[Automated Unit Tests](backend/tests/)** (`backend/tests/`) — Vitest test suites verifying token sequences, BOM deductions, ESC/POS printer buffers, and cash variance.

## 8. Strategic Execution Separation: Build Strategy vs. Go-To-Market Strategy

To ensure absolute operational clarity and prevent conflating technical development with commercial rollout, the execution plans are strictly decoupled into dedicated directories:

| Execution Track | Dedicated Folder & Master Blueprint | Primary Objective | Audience & Evaluation Gates |
| :--- | :--- | :--- | :--- |
| **Engineering Build Strategy** | **[`build_strategy/Build_Strategy_and_Phases.md`](build_strategy/Build_Strategy_and_Phases.md)**<br>ðŸ‘‰ *Screen-by-Screen Progression:* **[`build_strategy/Dashboard_Build_Progression.md`](build_strategy/Dashboard_Build_Progression.md)** | Technical engineering architecture, containerized edge node, C0â€“C10 coding phases, screen-by-screen dashboard progression (Customer PWA $\rightarrow$ Waitress POS $\rightarrow$ Kitchen KDS $\rightarrow$ Dispatch Queue $\rightarrow$ Manager Admin), KDS WebSocket event bus, raw thermal print engine, and automated quality gates. | **Software Engineers & Technical Architects:** Evaluated on passing unit/integration tests, zero lint/typecheck errors, schema parity, LAN offline resilience, and concurrency safety. |
| **Go-To-Market (GTM) Strategy** | **[`go_to_market/Go_To_Market_Strategy.md`](go_to_market/Go_To_Market_Strategy.md)** | Commercial market entry, Makerere & YMCA student pre-order conversion, in-store QR merchandising, waitstaff/cook change management, stage boda agreements, milestone invoicing, and retainer execution. | **Business Leads, Operations & Owners (Zito Mbowe):** Evaluated on peak queue divert rate ($\ge 40\%$), food spoilage reduction, zero cash drawer variance, and monthly retainer execution. |
