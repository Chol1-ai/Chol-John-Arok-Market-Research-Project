# Frontend Workspace & UI Architecture (`frontend/`)

> **Location:** `frontend/`  
> **Purpose:** API-backed staff and customer surfaces, retained legacy design assets, shared stylesheets, and design tokens.
> **Brand Identity:** Foodizo (Ham Towers) & Obunuzi Restaurant (Opposite YMCA, Wandegeya, Kampala)

---

## 1. Directory Structure

```
frontend/
├── live/                                                   # API-backed staff HTML surfaces
│   ├── pos.html                                            # /pos — floor map, table tabs, settlement
│   ├── kds.html                                            # /kds — kitchen ticket board
│   ├── dispatch.html                                       # /dispatch — boda handoff queue
│   └── admin.html                                          # /admin — manager audit, surplus & digest
│
├── js/                                                     # Live surface controllers (vanilla ES modules)
│   ├── api.js                                              # Fetch client, session guard, role routing, toasts
│   ├── login.js                                            # Staff directory, PIN keypad, login & logout
│   ├── pos.js                                              # Tables, menu, order creation, items, settle, cancel
│   ├── kds.js                                              # Ticket polling, claim, bump
│   ├── dispatch.js                                         # Active/review queues, rider assign, delivery outcome
│   └── admin.js                                            # Digest overview, cash count, surplus, dispatch-now
│
├── html/                                                   # Live hub/login/tracker + retained legacy design assets
│   ├── README.md                                           # Screen routes and companion stylesheet map
│   ├── index.html                                          # Launch hub at /
│   ├── staff_terminal_pin_login.html                       # Surface 1: live staff PIN gateway (/login)
│   ├── customer_pwa_landing_page.html                      # Retained legacy customer design (not routed)
│   ├── campus_pre_order_menu.html                          # Retained legacy menu design (not routed)
│   ├── momo_checkout_delivery_zone_selector.html           # Retained legacy checkout design (not routed)
│   ├── digital_token_queue_bypass_status.html              # Retained legacy token design (not routed)
│   ├── boda_landmark_delivery_tracker.html                 # Surface 2E: public live order tracker
│   ├── waitress_pos_table_floor_order_pad.html             # Retained legacy POS design (not routed)
│   ├── kitchen_display_system_kds_active_stations.html     # Retained legacy KDS design (not routed)
│   ├── foh_boda_dispatch_delivery_queue.html               # Retained legacy dispatch design (not routed)
│   └── manager_admin_eod_surplus_audit_digest.html         # Retained legacy manager design (not routed)
│
├── css/                                                    # Shared and companion stylesheets
│   ├── README.md                                           # Styling documentation
│   ├── theme_tokens.css                                    # Shared fast-casual palette, fonts & variables
│   ├── live_surfaces.css                                   # Shared layout/components for live staff screens
│   ├── staff_terminal_pin_login.css                        # Companion styles for Surface 1
│   ├── customer_pwa_landing_page.css                       # Companion styles for Surface 2A
│   ├── campus_pre_order_menu.css                           # Companion styles for Surface 2B
│   ├── momo_checkout_delivery_zone_selector.css            # Companion styles for Surface 2C
│   ├── digital_token_queue_bypass_status.css               # Companion styles for Surface 2D
│   ├── boda_landmark_delivery_tracker.css                  # Companion styles for Surface 2E
│   ├── waitress_pos_table_floor_order_pad.css              # Companion styles for Surface 3
│   ├── kitchen_display_system_kds_active_stations.css      # Companion styles for Surface 4
│   ├── foh_boda_dispatch_delivery_queue.css                # Companion styles for Surface 5
│   └── manager_admin_eod_surplus_audit_digest.css          # Companion styles for Surface 6
│
├── images/                                                 # High-resolution screen capture previews (.png)
│   ├── staff_terminal_pin_login.png
│   ├── customer_pwa_landing_page.png
│   ├── campus_pre_order_menu.png
│   ├── momo_checkout_delivery_zone_selector.png
│   ├── digital_token_queue_bypass_status.png
│   ├── boda_landmark_delivery_tracker.png
│   ├── kitchen_display_system_kds_active_stations.png
│   └── foh_boda_dispatch_delivery_queue.png
│
├── design_tokens_kampala_fast_casual.md                    # Material 3 & typography specification
└── README.md                                               # Master frontend architecture guide
```

---

## 2. Live Staff Surfaces (API-backed)

These routes run against the Fastify/Prisma backend and the real-time `/ws/events` bus. They are the only staff screens that read or mutate production data.

| Surface ID | Screen Role | Live Route | HTML | Controller | Access |
| :---: | :--- | :--- | :--- | :--- | :--- |
| **Surface 1** | Staff PIN Gateway | `/login` | [`html/staff_terminal_pin_login.html`](html/staff_terminal_pin_login.html) | [`js/login.js`](js/login.js) | Public directory; PIN required |
| **Surface 3** | Floor POS / Table Tabs | `/pos` | [`live/pos.html`](live/pos.html) | [`js/pos.js`](js/pos.js) | `WAITER_FOH`, `MANAGER_ADMIN` |
| **Surface 4** | Kitchen Display (KDS) | `/kds` | [`live/kds.html`](live/kds.html) | [`js/kds.js`](js/kds.js) | `KITCHEN_STAFF`, `MANAGER_ADMIN` |
| **Surface 5** | Boda Dispatch Queue | `/dispatch` | [`live/dispatch.html`](live/dispatch.html) | [`js/dispatch.js`](js/dispatch.js) | `WAITER_FOH`, `MANAGER_ADMIN` |
| **Surface 6** | Manager Audit & Digest | `/admin` | [`live/admin.html`](live/admin.html) | [`js/admin.js`](js/admin.js) | `MANAGER_ADMIN` |

Customer ordering is live at `/order` and `/customer`; token lookup and status tracking are live at `/tracker`. Former `/prototype/*` URLs redirect to their corresponding live screens. Staff routes remain protected by role-based authentication.

The login page uses the public `/api/v1/auth/terminal-staff` display directory (name, role, outlet, initials only) and authenticates with `staffId` plus PIN. Other live pages use the shared [`js/api.js`](js/api.js) client, which relies on the HttpOnly `foodizo_session` cookie with a Bearer-token fallback.

The launch hub at `/` links directly to the live customer and staff workflows.

---

## 3. Live Customer Workflows and Legacy URLs

The customer menu, cart, checkout, pickup and delivery orders are handled by the live flow at `/order`. Customers can look up token status and track delivery progress at `/tracker`. Former prototype URLs redirect to these live pages or to the corresponding role-protected staff screen; staff authentication and outlet/role checks still apply.

| Surface | Live route | Purpose |
| :--- | :--- | :--- |
| Customer ordering | `/order` | Live menu, cart, pickup/delivery checkout and order creation |
| Customer tracking | `/tracker` | Live order token lookup and pickup/delivery status |
| Legacy customer URLs | `/prototype/customer`, `/prototype/menu`, `/prototype/checkout`, `/prototype/token`, `/prototype/tracker` | Redirect to live order or tracking workflows |
| Legacy staff URLs | `/prototype/login`, `/prototype/pos`, `/prototype/kds`, `/prototype/dispatch`, `/prototype/admin` | Redirect to live staff surfaces with existing access control |

---

## 4. Styling & Token Architecture

- **Live surfaces:** `live/*.html` load [`css/theme_tokens.css`](css/theme_tokens.css) and [`css/live_surfaces.css`](css/live_surfaces.css). The shared stylesheet carries the role-differentiated dark staff palette, touch targets, cards, tables, modals, and toasts used by POS, KDS, dispatch, and admin.
- **Retained design assets:** Legacy HTML/CSS screens remain available in the repository for reference, but application routes redirect customers and staff to live workflows.
- **Shared theme foundation:** Companion stylesheets import [`css/theme_tokens.css`](css/theme_tokens.css), guaranteeing colour, type, and ergonomic consistency while isolating page-specific layout rules.
- **Canonical values:** Colors, type scale, spacing, and touch targets follow [`design_tokens_kampala_fast_casual.md`](design_tokens_kampala_fast_casual.md) and [`../docs/Design_System.md`](../docs/Design_System.md).
