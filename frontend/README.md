# Frontend Workspace & UI Architecture (`frontend/`)

> **Location:** `frontend/`  
> **Purpose:** Master repository for all frontend prototypes, stylesheets, design tokens, and UI screen assets.  
> **Brand Identity:** Foodizo (Ham Towers) & Obunuzi Restaurant (Opposite YMCA, Wandegeya, Kampala)

---

## 1. Directory Structure

```
frontend/
├── html/                                                   # HTML screen prototypes (10 surfaces)
│   ├── README.md                                           # Route & companion stylesheet map
│   ├── 01_staff_terminal_pin_login.html                    # Surface 1: Staff PIN Gateway
│   ├── 02a_customer_pwa_landing_page.html                  # Surface 2A: Customer PWA Landing Page
│   ├── 02b_campus_pre_order_menu.html                      # Surface 2B: Campus Pre-Order Menu
│   ├── 02c_momo_checkout_delivery_zone_selector.html       # Surface 2C: MoMo Checkout & Delivery Selector
│   ├── 02d_digital_token_queue_bypass_status.html          # Surface 2D: Takeaway Token Pass (#F-104)
│   ├── 02e_boda_landmark_delivery_tracker.html             # Surface 2E: Customer Landmark Boda Tracker
│   ├── 03_waitress_pos_table_floor_order_pad.html          # Surface 3: Waitress Table Floor Map & POS Pad
│   ├── 04_kitchen_display_system_kds_active_stations.html  # Surface 4: Multi-Station KDS Flow
│   ├── 05_foh_boda_dispatch_delivery_queue.html            # Surface 5: FOH Dispatch & Rider Handoff Queue
│   └── 06_manager_admin_eod_surplus_audit_digest.html      # Surface 6: Manager Admin EOD Audit & Daily Digest
│
├── css/                                                    # Independent CSS stylesheets (1-to-1 matching)
│   ├── README.md                                           # Styling documentation
│   ├── theme_tokens.css                                    # Shared fast-casual palette, fonts & variables
│   ├── 01_staff_terminal_pin_login.css                     # Companion styles for 01
│   ├── 02a_customer_pwa_landing_page.css                   # Companion styles for 02a
│   ├── 02b_campus_pre_order_menu.css                       # Companion styles for 02b
│   ├── 02c_momo_checkout_delivery_zone_selector.css        # Companion styles for 02c
│   ├── 02d_digital_token_queue_bypass_status.css           # Companion styles for 02d
│   ├── 02e_boda_landmark_delivery_tracker.css              # Companion styles for 02e
│   ├── 03_waitress_pos_table_floor_order_pad.css           # Companion styles for 03
│   ├── 04_kitchen_display_system_kds_active_stations.css   # Companion styles for 04
│   ├── 05_foh_boda_dispatch_delivery_queue.css             # Companion styles for 05
│   └── 06_manager_admin_eod_surplus_audit_digest.css       # Companion styles for 06
│
├── images/                                                 # High-resolution screen capture previews (.png)
│   ├── 01_staff_terminal_pin_login.png                     # Surface 1 High-res preview
│   ├── 02a_customer_pwa_landing_page.png                   # Surface 2A High-res preview
│   ├── 02b_campus_pre_order_menu.png                       # Surface 2B High-res preview
│   ├── 02c_momo_checkout_delivery_zone_selector.png        # Surface 2C High-res preview
│   ├── 02d_digital_token_queue_bypass_status.png           # Surface 2D High-res preview
│   ├── 02e_boda_landmark_delivery_tracker.png              # Surface 2E High-res preview
│   ├── 04_kitchen_display_system_kds_active_stations.png   # Surface 4 High-res preview
│   └── 05_foh_boda_dispatch_delivery_queue.png             # Surface 5 High-res preview
│
├── design_tokens_kampala_fast_casual.md                    # Material 3 & typography specification
└── README.md                                               # Master frontend architecture guide
```

---

## 2. 1-to-1 Screen Mapping Matrix

| Surface ID | Screen Role | HTML Screen (`html/`) | Matching CSS (`css/`) | Visual Preview (`images/`) | Target Next.js Route |
| :---: | :--- | :--- | :--- | :--- | :--- |
| **Surface 1** | Staff PIN Gateway | [`01_staff_terminal_pin_login.html`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/html/01_staff_terminal_pin_login.html) | [`01_staff_terminal_pin_login.css`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/css/01_staff_terminal_pin_login.css) | [`01_staff_terminal_pin_login.png`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/images/01_staff_terminal_pin_login.png) | `/login` |
| **Surface 2A** | Customer PWA Landing | [`02a_customer_pwa_landing_page.html`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/html/02a_customer_pwa_landing_page.html) | [`02a_customer_pwa_landing_page.css`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/css/02a_customer_pwa_landing_page.css) | [`02a_customer_pwa_landing_page.png`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/images/02a_customer_pwa_landing_page.png) | `/` |
| **Surface 2B** | Campus Pre-Order Menu | [`02b_campus_pre_order_menu.html`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/html/02b_campus_pre_order_menu.html) | [`02b_campus_pre_order_menu.css`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/css/02b_campus_pre_order_menu.css) | [`02b_campus_pre_order_menu.png`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/images/02b_campus_pre_order_menu.png) | `/menu` |
| **Surface 2C** | MoMo STK Checkout | [`02c_momo_checkout_delivery_zone_selector.html`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/html/02c_momo_checkout_delivery_zone_selector.html) | [`02c_momo_checkout_delivery_zone_selector.css`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/css/02c_momo_checkout_delivery_zone_selector.css) | [`02c_momo_checkout_delivery_zone_selector.png`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/images/02c_momo_checkout_delivery_zone_selector.png) | `/checkout` |
| **Surface 2D** | Takeaway Token Pass | [`02d_digital_token_queue_bypass_status.html`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/html/02d_digital_token_queue_bypass_status.html) | [`02d_digital_token_queue_bypass_status.css`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/css/02d_digital_token_queue_bypass_status.css) | [`02d_digital_token_queue_bypass_status.png`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/images/02d_digital_token_queue_bypass_status.png) | `/token/[token]` |
| **Surface 2E** | Landmark Boda Tracker | [`02e_boda_landmark_delivery_tracker.html`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/html/02e_boda_landmark_delivery_tracker.html) | [`02e_boda_landmark_delivery_tracker.css`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/css/02e_boda_landmark_delivery_tracker.css) | [`02e_boda_landmark_delivery_tracker.png`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/images/02e_boda_landmark_delivery_tracker.png) | `/order/[id]/tracker` |
| **Surface 3** | Waitress Floor POS | [`03_waitress_pos_table_floor_order_pad.html`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/html/03_waitress_pos_table_floor_order_pad.html) | [`03_waitress_pos_table_floor_order_pad.css`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/css/03_waitress_pos_table_floor_order_pad.css) | *(Integrated)* | `/pos`, `/pos/tables` |
| **Surface 4** | Kitchen Display (KDS) | [`04_kitchen_display_system_kds_active_stations.html`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/html/04_kitchen_display_system_kds_active_stations.html) | [`04_kitchen_display_system_kds_active_stations.css`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/css/04_kitchen_display_system_kds_active_stations.css) | [`04_kitchen_display_system_kds_active_stations.png`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/images/04_kitchen_display_system_kds_active_stations.png) | `/kds/[station]` |
| **Surface 5** | FOH Dispatch Queue | [`05_foh_boda_dispatch_delivery_queue.html`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/html/05_foh_boda_dispatch_delivery_queue.html) | [`05_foh_boda_dispatch_delivery_queue.css`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/css/05_foh_boda_dispatch_delivery_queue.css) | [`05_foh_boda_dispatch_delivery_queue.png`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/images/05_foh_boda_dispatch_delivery_queue.png) | `/pos/dispatch` |
| **Surface 6** | Manager Admin & EOD | [`06_manager_admin_eod_surplus_audit_digest.html`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/html/06_manager_admin_eod_surplus_audit_digest.html) | [`06_manager_admin_eod_surplus_audit_digest.css`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/css/06_manager_admin_eod_surplus_audit_digest.css) | *(Integrated)* | `/admin/inventory/surplus` |

---

## 3. Styling & Token Architecture

- **Independent CSS:** Each screen in `html/` links directly to its own companion stylesheet in `css/` via `<link rel="stylesheet" href="../css/<name>.css"/>`.
- **Shared Theme Foundation:** All companion CSS files import [`css/theme_tokens.css`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/css/theme_tokens.css), guaranteeing color, font, and ergonomic consistency while isolating page-specific layout rules.

