# Frontend Workspace & UI Architecture (`frontend/`)

> **Location:** `frontend/`  
> **Purpose:** API-backed staff surfaces, static design prototypes, shared stylesheets, design tokens, and UI previews.  
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
├── html/                                                   # Live login page + static design prototypes
│   ├── README.md                                           # Prototype route & companion stylesheet map
│   ├── index.html                                          # Launch hub at / (live vs prototype labels)
│   ├── staff_terminal_pin_login.html                       # Surface 1: live staff PIN gateway (/login)
│   ├── customer_pwa_landing_page.html                      # Surface 2A: customer PWA prototype
│   ├── campus_pre_order_menu.html                          # Surface 2B: campus pre-order prototype
│   ├── momo_checkout_delivery_zone_selector.html           # Surface 2C: MoMo checkout prototype
│   ├── digital_token_queue_bypass_status.html              # Surface 2D: takeaway token prototype
│   ├── boda_landmark_delivery_tracker.html                 # Surface 2E: landmark tracker prototype
│   ├── waitress_pos_table_floor_order_pad.html             # Surface 3: static POS design
│   ├── kitchen_display_system_kds_active_stations.html     # Surface 4: static KDS design
│   ├── foh_boda_dispatch_delivery_queue.html               # Surface 5: static dispatch design
│   └── manager_admin_eod_surplus_audit_digest.html         # Surface 6: static manager design
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

The login page uses the public `/api/v1/auth/terminal-staff` display directory (name, role, outlet, initials only) and authenticates with `staffId` plus PIN. Other live pages use the shared [`js/api.js`](js/api.js) client, which relies on the HttpOnly `foodizo_session` cookie with a Bearer-token fallback.

The launch hub at `/` labels these five screens as live and lists the static prototypes separately.

---

## 3. Static Design Prototypes (not API-backed)

These screens are for layout and visual review. They do **not** create real orders, call the payment API, track real riders, or read live kitchen data. They are namespaced under `/prototype/*` so they cannot be mistaken for live behaviour. Legacy customer aliases (`/landing`, `/customer`, `/menu`, `/checkout`, `/token`, `/tracker`) return `302` to the matching prototype route.

| Surface ID | Screen Role | Prototype Route | HTML | Companion CSS |
| :---: | :--- | :--- | :--- | :--- |
| **Surface 2A** | Customer PWA Landing | `/prototype/customer` | [`html/customer_pwa_landing_page.html`](html/customer_pwa_landing_page.html) | [`css/customer_pwa_landing_page.css`](css/customer_pwa_landing_page.css) |
| **Surface 2B** | Campus Pre-Order Menu | `/prototype/menu` | [`html/campus_pre_order_menu.html`](html/campus_pre_order_menu.html) | [`css/campus_pre_order_menu.css`](css/campus_pre_order_menu.css) |
| **Surface 2C** | MoMo STK Checkout | `/prototype/checkout` | [`html/momo_checkout_delivery_zone_selector.html`](html/momo_checkout_delivery_zone_selector.html) | [`css/momo_checkout_delivery_zone_selector.css`](css/momo_checkout_delivery_zone_selector.css) |
| **Surface 2D** | Takeaway Token Pass | `/prototype/token` | [`html/digital_token_queue_bypass_status.html`](html/digital_token_queue_bypass_status.html) | [`css/digital_token_queue_bypass_status.css`](css/digital_token_queue_bypass_status.css) |
| **Surface 2E** | Landmark Boda Tracker | `/prototype/tracker` | [`html/boda_landmark_delivery_tracker.html`](html/boda_landmark_delivery_tracker.html) | [`css/boda_landmark_delivery_tracker.css`](css/boda_landmark_delivery_tracker.css) |
| **Surface 1** | Staff PIN design | `/prototype/login` | [`html/staff_terminal_pin_login.html`](html/staff_terminal_pin_login.html) | [`css/staff_terminal_pin_login.css`](css/staff_terminal_pin_login.css) |
| **Surface 3** | Floor POS design | `/prototype/pos` | [`html/waitress_pos_table_floor_order_pad.html`](html/waitress_pos_table_floor_order_pad.html) | [`css/waitress_pos_table_floor_order_pad.css`](css/waitress_pos_table_floor_order_pad.css) |
| **Surface 4** | KDS design | `/prototype/kds` | [`html/kitchen_display_system_kds_active_stations.html`](html/kitchen_display_system_kds_active_stations.html) | [`css/kitchen_display_system_kds_active_stations.css`](css/kitchen_display_system_kds_active_stations.css) |
| **Surface 5** | Dispatch design | `/prototype/dispatch` | [`html/foh_boda_dispatch_delivery_queue.html`](html/foh_boda_dispatch_delivery_queue.html) | [`css/foh_boda_dispatch_delivery_queue.css`](css/foh_boda_dispatch_delivery_queue.css) |
| **Surface 6** | Manager design | `/prototype/admin` | [`html/manager_admin_eod_surplus_audit_digest.html`](html/manager_admin_eod_surplus_audit_digest.html) | [`css/manager_admin_eod_surplus_audit_digest.css`](css/manager_admin_eod_surplus_audit_digest.css) |

---

## 4. Styling & Token Architecture

- **Live surfaces:** `live/*.html` load [`css/theme_tokens.css`](css/theme_tokens.css) and [`css/live_surfaces.css`](css/live_surfaces.css). The shared stylesheet carries the role-differentiated dark staff palette, touch targets, cards, tables, modals, and toasts used by POS, KDS, dispatch, and admin.
- **Static prototypes:** Each screen in `html/` links to its own companion stylesheet in `css/` via `<link rel="stylesheet" href="../css/<name>.css"/>`.
- **Shared theme foundation:** Companion stylesheets import [`css/theme_tokens.css`](css/theme_tokens.css), guaranteeing colour, type, and ergonomic consistency while isolating page-specific layout rules.
- **Canonical values:** Colors, type scale, spacing, and touch targets follow [`design_tokens_kampala_fast_casual.md`](design_tokens_kampala_fast_casual.md) and [`../docs/Design_System.md`](../docs/Design_System.md).
