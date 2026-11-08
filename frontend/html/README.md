# Staff Login & Static Design Prototypes (`html/`)

This directory contains the live staff PIN gateway at `/login`, the launch hub at `/`, and the static design prototypes used for layout review. The prototypes are served under `/prototype/*` and are **not connected to live ordering, payment, tracking, or kitchen APIs**.

Each prototype links directly to its companion stylesheet in `../css/`:

| HTML File | Surface / Served Route | Status | Companion Stylesheet | Visual Preview |
| :--- | :--- | :--- | :--- | :--- |
| [`staff_terminal_pin_login.html`](staff_terminal_pin_login.html) | Surface 1 (`/login`) | **Live** (API-backed) | [`../css/staff_terminal_pin_login.css`](../css/staff_terminal_pin_login.css) | [`../images/staff_terminal_pin_login.png`](../images/staff_terminal_pin_login.png) |
| [`customer_pwa_landing_page.html`](customer_pwa_landing_page.html) | Surface 2A (`/prototype/customer`) | Static prototype | [`../css/customer_pwa_landing_page.css`](../css/customer_pwa_landing_page.css) | [`../images/customer_pwa_landing_page.png`](../images/customer_pwa_landing_page.png) |
| [`campus_pre_order_menu.html`](campus_pre_order_menu.html) | Surface 2B (`/prototype/menu`) | Static prototype | [`../css/campus_pre_order_menu.css`](../css/campus_pre_order_menu.css) | [`../images/campus_pre_order_menu.png`](../images/campus_pre_order_menu.png) |
| [`momo_checkout_delivery_zone_selector.html`](momo_checkout_delivery_zone_selector.html) | Surface 2C (`/prototype/checkout`) | Static prototype | [`../css/momo_checkout_delivery_zone_selector.css`](../css/momo_checkout_delivery_zone_selector.css) | [`../images/momo_checkout_delivery_zone_selector.png`](../images/momo_checkout_delivery_zone_selector.png) |
| [`digital_token_queue_bypass_status.html`](digital_token_queue_bypass_status.html) | Surface 2D (`/prototype/token`) | Static prototype | [`../css/digital_token_queue_bypass_status.css`](../css/digital_token_queue_bypass_status.css) | [`../images/digital_token_queue_bypass_status.png`](../images/digital_token_queue_bypass_status.png) |
| [`boda_landmark_delivery_tracker.html`](boda_landmark_delivery_tracker.html) | Surface 2E (`/prototype/tracker`) | Static prototype | [`../css/boda_landmark_delivery_tracker.css`](../css/boda_landmark_delivery_tracker.css) | [`../images/boda_landmark_delivery_tracker.png`](../images/boda_landmark_delivery_tracker.png) |
| [`waitress_pos_table_floor_order_pad.html`](waitress_pos_table_floor_order_pad.html) | Surface 3 (`/prototype/pos`) | Static prototype | [`../css/waitress_pos_table_floor_order_pad.css`](../css/waitress_pos_table_floor_order_pad.css) | *(Integrated)* |
| [`kitchen_display_system_kds_active_stations.html`](kitchen_display_system_kds_active_stations.html) | Surface 4 (`/prototype/kds`) | Static prototype | [`../css/kitchen_display_system_kds_active_stations.css`](../css/kitchen_display_system_kds_active_stations.css) | [`../images/kitchen_display_system_kds_active_stations.png`](../images/kitchen_display_system_kds_active_stations.png) |
| [`foh_boda_dispatch_delivery_queue.html`](foh_boda_dispatch_delivery_queue.html) | Surface 5 (`/prototype/dispatch`) | Static prototype | [`../css/foh_boda_dispatch_delivery_queue.css`](../css/foh_boda_dispatch_delivery_queue.css) | [`../images/foh_boda_dispatch_delivery_queue.png`](../images/foh_boda_dispatch_delivery_queue.png) |
| [`manager_admin_eod_surplus_audit_digest.html`](manager_admin_eod_surplus_audit_digest.html) | Surface 6 (`/prototype/admin`) | Static prototype | [`../css/manager_admin_eod_surplus_audit_digest.css`](../css/manager_admin_eod_surplus_audit_digest.css) | *(Integrated)* |

The live POS, KDS, dispatch, and admin screens are in [`../live/`](../live/) and use [`../css/live_surfaces.css`](../css/live_surfaces.css).
