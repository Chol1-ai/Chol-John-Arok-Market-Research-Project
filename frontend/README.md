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
│   ├── staff_terminal_pin_login.html                    # Surface 1: Staff PIN Gateway
│   ├── customer_pwa_landing_page.html                  # Surface 2A: Customer PWA Landing Page
│   ├── campus_pre_order_menu.html                      # Surface 2B: Campus Pre-Order Menu
│   ├── momo_checkout_delivery_zone_selector.html       # Surface 2C: MoMo Checkout & Delivery Selector
│   ├── digital_token_queue_bypass_status.html          # Surface 2D: Takeaway Token Pass (#F-104)
│   ├── boda_landmark_delivery_tracker.html             # Surface 2E: Customer Landmark Boda Tracker
│   ├── waitress_pos_table_floor_order_pad.html          # Surface 3: Waitress Table Floor Map & POS Pad
│   ├── kitchen_display_system_kds_active_stations.html  # Surface 4: Multi-Station KDS Flow
│   ├── foh_boda_dispatch_delivery_queue.html            # Surface 5: FOH Dispatch & Rider Handoff Queue
│   └── manager_admin_eod_surplus_audit_digest.html      # Surface 6: Manager Admin EOD Audit & Daily Digest
│
├── css/                                                    # Independent CSS stylesheets (1-to-1 matching)
│   ├── README.md                                           # Styling documentation
│   ├── theme_tokens.css                                    # Shared fast-casual palette, fonts & variables
│   ├── staff_terminal_pin_login.css                     # Companion styles for 01
│   ├── customer_pwa_landing_page.css                   # Companion styles for 02a
│   ├── campus_pre_order_menu.css                       # Companion styles for 02b
│   ├── momo_checkout_delivery_zone_selector.css        # Companion styles for 02c
│   ├── digital_token_queue_bypass_status.css           # Companion styles for 02d
│   ├── boda_landmark_delivery_tracker.css              # Companion styles for 02e
│   ├── waitress_pos_table_floor_order_pad.css           # Companion styles for 03
│   ├── kitchen_display_system_kds_active_stations.css   # Companion styles for 04
│   ├── foh_boda_dispatch_delivery_queue.css             # Companion styles for 05
│   └── manager_admin_eod_surplus_audit_digest.css       # Companion styles for 06
│
├── images/                                                 # High-resolution screen capture previews (.png)
│   ├── staff_terminal_pin_login.png                     # Surface 1 High-res preview
│   ├── customer_pwa_landing_page.png                   # Surface 2A High-res preview
│   ├── campus_pre_order_menu.png                       # Surface 2B High-res preview
│   ├── momo_checkout_delivery_zone_selector.png        # Surface 2C High-res preview
│   ├── digital_token_queue_bypass_status.png           # Surface 2D High-res preview
│   ├── boda_landmark_delivery_tracker.png              # Surface 2E High-res preview
│   ├── kitchen_display_system_kds_active_stations.png   # Surface 4 High-res preview
│   └── foh_boda_dispatch_delivery_queue.png             # Surface 5 High-res preview
│
├── design_tokens_kampala_fast_casual.md                    # Material 3 & typography specification
└── README.md                                               # Master frontend architecture guide
```

---

## 2. 1-to-1 Screen Mapping Matrix

| Surface ID | Screen Role | HTML Screen (`html/`) | Matching CSS (`css/`) | Visual Preview (`images/`) | Target Next.js Route |
| :---: | :--- | :--- | :--- | :--- | :--- |
| **Surface 1** | Staff PIN Gateway | [`staff_terminal_pin_login.html`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/html/staff_terminal_pin_login.html) | [`staff_terminal_pin_login.css`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/css/staff_terminal_pin_login.css) | [`staff_terminal_pin_login.png`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/images/staff_terminal_pin_login.png) | `/login` |
| **Surface 2A** | Customer PWA Landing | [`customer_pwa_landing_page.html`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/html/customer_pwa_landing_page.html) | [`customer_pwa_landing_page.css`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/css/customer_pwa_landing_page.css) | [`customer_pwa_landing_page.png`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/images/customer_pwa_landing_page.png) | `/` |
| **Surface 2B** | Campus Pre-Order Menu | [`campus_pre_order_menu.html`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/html/campus_pre_order_menu.html) | [`campus_pre_order_menu.css`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/css/campus_pre_order_menu.css) | [`campus_pre_order_menu.png`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/images/campus_pre_order_menu.png) | `/menu` |
| **Surface 2C** | MoMo STK Checkout | [`momo_checkout_delivery_zone_selector.html`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/html/momo_checkout_delivery_zone_selector.html) | [`momo_checkout_delivery_zone_selector.css`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/css/momo_checkout_delivery_zone_selector.css) | [`momo_checkout_delivery_zone_selector.png`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/images/momo_checkout_delivery_zone_selector.png) | `/checkout` |
| **Surface 2D** | Takeaway Token Pass | [`digital_token_queue_bypass_status.html`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/html/digital_token_queue_bypass_status.html) | [`digital_token_queue_bypass_status.css`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/css/digital_token_queue_bypass_status.css) | [`digital_token_queue_bypass_status.png`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/images/digital_token_queue_bypass_status.png) | `/token/[token]` |
| **Surface 2E** | Landmark Boda Tracker | [`boda_landmark_delivery_tracker.html`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/html/boda_landmark_delivery_tracker.html) | [`boda_landmark_delivery_tracker.css`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/css/boda_landmark_delivery_tracker.css) | [`boda_landmark_delivery_tracker.png`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/images/boda_landmark_delivery_tracker.png) | `/order/[id]/tracker` |
| **Surface 3** | Waitress Floor POS | [`waitress_pos_table_floor_order_pad.html`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/html/waitress_pos_table_floor_order_pad.html) | [`waitress_pos_table_floor_order_pad.css`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/css/waitress_pos_table_floor_order_pad.css) | *(Integrated)* | `/pos`, `/pos/tables` |
| **Surface 4** | Kitchen Display (KDS) | [`kitchen_display_system_kds_active_stations.html`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/html/kitchen_display_system_kds_active_stations.html) | [`kitchen_display_system_kds_active_stations.css`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/css/kitchen_display_system_kds_active_stations.css) | [`kitchen_display_system_kds_active_stations.png`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/images/kitchen_display_system_kds_active_stations.png) | `/kds/[station]` |
| **Surface 5** | FOH Dispatch Queue | [`foh_boda_dispatch_delivery_queue.html`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/html/foh_boda_dispatch_delivery_queue.html) | [`foh_boda_dispatch_delivery_queue.css`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/css/foh_boda_dispatch_delivery_queue.css) | [`foh_boda_dispatch_delivery_queue.png`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/images/foh_boda_dispatch_delivery_queue.png) | `/pos/dispatch` |
| **Surface 6** | Manager Admin & EOD | [`manager_admin_eod_surplus_audit_digest.html`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/html/manager_admin_eod_surplus_audit_digest.html) | [`manager_admin_eod_surplus_audit_digest.css`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/css/manager_admin_eod_surplus_audit_digest.css) | *(Integrated)* | `/admin/inventory/surplus` |

---

## 3. Styling & Token Architecture

- **Independent CSS:** Each screen in `html/` links directly to its own companion stylesheet in `css/` via `<link rel="stylesheet" href="../css/<name>.css"/>`.
- **Shared Theme Foundation:** All companion CSS files import [`css/theme_tokens.css`](file:///c:/Users/USER/OneDrive/Desktop/Chol-John-Arok-Market-Research-Project/frontend/css/theme_tokens.css), guaranteeing color, font, and ergonomic consistency while isolating page-specific layout rules.

