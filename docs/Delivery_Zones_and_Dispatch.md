# Delivery Zones, Landmark Checkout & Rider Dispatch

**Status:** Phase 1 canonical specification — supersedes any assumption that checkout requires a live map.<br>
**Target Outlets:** Foodizo (Ham Towers) & Obunuzi Restaurant & Cafe (Opposite YMCA)<br>
**Location:** Wandegeya, Kampala, Uganda<br>
**Related Specifications:** `Foundational_Concept.md` · `Design_System.md` · `User_Flow.md` · `User_Profiles_Personas.md` · `Tech_Stack.md` · `Payment_Integration.md` · `Hardware_and_Peripherals.md` · `Seed_Data_and_Testing.md` · `Repo_Scaffold_and_Config.md` · `Demo_Script_and_Closing_Strategy.md` · `Daily_Audit_Digest.md` · `Deployment_Runbook.md` · `Service_Contract_and_Invoice_Template.md` · `build_strategy/Build_Strategy_and_Phases.md`

---

## 1. Decision & Verdict

Adopt the **Zone & Landmark Dropdown + Direct Phone/WhatsApp Dispatch** model for Phase 1. Do **not** build a live Google Maps checkout or live rider tracking for the initial deployment.

The AI Studio recommendation is directionally correct — location matters — but a live Google Maps checkout is the wrong implementation for two Wandegeya restaurants serving Makerere halls, YMCA, Ham Towers, and the surrounding market corridor. The local-first model matches how freelance boda riders actually operate: they know landmarks, call the customer, and navigate from a room/office note — not from a pin dropped on a rooftop.

### 1.1 What we adopt

| Recommendation | Decision |
| :--- | :--- |
| Outlet-scoped zone/landmark dropdown | **Adopt** — required for every delivery order |
| Exact room/office/landmark note | **Adopt** — required, 3–160 characters |
| Customer phone for rider calls | **Adopt** — required for delivery, normalised to E.164 |
| Optional HTML5 geolocation pin | **Adopt as optional convenience only** — one-shot, never required |
| Google Maps universal link (`https://www.google.com/maps/search/?api=1&query=...`) | **Adopt** — free link, no API key, no map SDK |
| Thermal packaging chit with destination + room/note + phone | **Adopt** — printed at `READY` for takeaway and delivery only; dine-in does not print |
| Call / WhatsApp dispatch from FOH | **Adopt** — native `tel:` and `wa.me` links |
| Live rider tracking | **Defer to Phase 2** — see §11 |
| Dedicated rider login/app | **Defer to Phase 2** — riders are non-system actors in Phase 1 |

### 1.2 Corrections to the original suggestion

1. **“Send WhatsApp Location Pin (Optional)” is not implementable as a checkbox in a normal web app.** A `wa.me` link can prefill text, but it cannot attach a WhatsApp location object. Replace it with two honest controls:
   - **“Use my current GPS pin (optional)”** — captures coordinates with `navigator.geolocation`.
   - **“Share map link on WhatsApp (optional)”** — opens the outlet’s WhatsApp chat with a prefilled Google Maps link. The customer still taps **Send** inside WhatsApp.
2. **A Google Maps *link* is free; the Google Maps *Platform* is not.** Embedding a map, geocoding, directions, or place search uses billable APIs, requires a key, and introduces quota/failure modes. A universal map link does not. Even if a monthly free credit covers the pilot volume, enabling billing and an API key creates an account, quota, and key-rotation burden that a two-outlet MVP does not need; Google can change pricing and terms.
3. **Riders should not become a fifth system role in Phase 1.** The existing four-role model stays intact. FOH/cashier dispatches from a dedicated queue, and the rider receives a printed chit. A rider app is a Phase 2 decision.
4. **“UGX 0” is accurate only for map API fees.** SMS, thermal paper, rider airtime/data, rider transport advances (the typical stage-boda payment is UGX 1,500–3,000), and staff time still cost money. The claim should be “UGX 0 in map API fees,” not “zero operating cost.”
5. **Leaflet + OpenStreetMap is free and open-source, but public OSM tile servers are not an unconditional production CDN.** Phase 2 must use a tile provider with a real usage policy or self-host tiles.

### 1.3 What this document fixes

Before this specification, the documentation defined `PHONE_DELIVERY` as a channel but never defined how a delivery address is captured, validated, printed, or handed to a rider. That is the gap this document closes.

---

## 2. Why the Zone/Landmark Model Fits Wandegeya

### 2.1 The operational reality

- Obunuzi runs a **60/40 split** between sit-down diners and phone-based takeaway/delivery orders. The phone order currently relies on a handwritten note or a verbal address.
- Foodizo’s delivery radius is dominated by Makerere University halls, YMCA blocks, Ham Towers offices, and Wandegeya Market.
- Campus buildings have named halls, blocks, reception desks, and security gates. A rooftop GPS pin is often less useful than “Mary Stuart Hall, Block B, Room 14 — call at the gate.”
- Riders are often freelance boda riders picked from the stage. They do not install a fleet app for a single lunch delivery; they answer a phone call and follow a landmark.
- A delivery that fails because the rider cannot find a room costs more than the map API fee ever would: the food cools, the customer calls the cashier, and the kitchen loses a ticket.

### 2.2 Why a live map is the wrong Phase 1 investment

| Concern | Live map / live tracking | Zone + landmark dropdown |
| :--- | :--- | :--- |
| **Map API cost** | Billable Maps JavaScript/Geocoding/Directions usage, API key, billing account | UGX 0 in map API fees |
| **Reliability** | Map tiles and SDK must load; quota errors, expired keys, and weak data connections break checkout | Native `<select>` and text fields render on the weakest connection |
| **Indoor accuracy** | GPS drifts in high-rise blocks, basements, and campus courtyards; pins land on roofs or wrong gates | Room/office note and reception landmark are authoritative |
| **Customer effort** | Permission prompt, map panning, pin placement, accidental drag | One dropdown, one note, one phone number |
| **Rider reality** | Requires rider app, background location, battery, data, training | Printed chit + phone call + WhatsApp link |
| **Privacy exposure** | Continuous location is sensitive personal data | One-shot optional pin, explicit consent |
| **Build/maintenance** | Weeks of map work, key rotation, quota monitoring, vendor changes | Days of CRUD, validation, and print layout |
| **Failure mode** | Blank map at checkout when the API is unavailable | Checkout still completes with zone + note |

> **Rule:** The landmark note is the source of truth. A GPS pin is a hint, never a requirement.

### 2.3 Delivery channel naming

The existing `channel_type` enum keeps `PHONE_DELIVERY` for backward compatibility. In this specification, `PHONE_DELIVERY` means **any delivery order**, whether it was keyed in by the cashier or placed by the customer in the PWA. Do not add a second `APP_DELIVERY` enum in Phase 1; it would duplicate every KDS filter and report.

---

## 3. Phase 1 Scope

| In scope | Out of scope |
| :--- | :--- |
| Outlet-scoped zone dropdown with fee/ETA | Live map embedded at checkout |
| Required room/office/landmark note | Route optimisation |
| Required recipient name and rider-callable phone | Automatic rider assignment |
| Optional one-shot HTML5 GPS pin | Continuous rider tracking |
| Static Google Maps link on the FOH dispatch screen | Google Maps JavaScript SDK / Places / Directions / Geocoding |
| Thermal delivery chit | Rider mobile app or rider login |
| FOH call / WhatsApp links | Customer-facing WhatsApp Business API / automated customer messages (the owner-only 21:30 digest is separate; see `Daily_Audit_Digest.md`) |
| Rider handoff audit | Customer-facing live “rider is 3 minutes away” view |
| Zone and fee maintenance in the admin portal | Distance-based dynamic pricing |

---

## 4. Customer Checkout Contract

### 4.1 Required fields for `PHONE_DELIVERY`

| Field | Required | Validation | Error copy |
| :--- | :--- | :--- | :--- |
| `outlet` | Yes | One of `FOODIZO_HAM_TOWERS` / `OBUNUZI_YMCA` | “Choose the outlet preparing your order.” |
| `delivery_zone_id` | Yes | Active zone belonging to the selected outlet | “Choose your campus, hall, or landmark.” |
| `delivery_note` | Yes | 3–160 printable characters | “Add a room, office, block, or gate instruction.” |
| `customer_name` | Yes | 2–80 characters | “Who should the rider ask for?” |
| `customer_phone` | Yes | Ugandan MSISDN normalised to E.164 (`2567XXXXXXXX`) | “Enter the phone number the rider should call.” |
| `delivery_lat` / `delivery_lng` | No | Valid WGS84 range; only from the GPS button | — |
| `delivery_accuracy_m` | No | `>= 0`; shown to FOH as a confidence hint | — |
| `delivery_fee_ugx` | Server-owned | Recomputed from the selected zone; client value ignored | — |

`customer_phone` remains optional for `TAKEAWAY_PICKUP` at the schema level. A customer-app pickup stores the payer MSISDN there so the `READY` SMS works; a cash walk-in with no phone stores `NULL` and receives no SMS. It is mandatory for `PHONE_DELIVERY`.

### 4.2 Checkout flow

1. Customer selects **Delivery** instead of **Pre-order pickup** (or the cashier selects delivery on the phone-entry screen). The canonical channel becomes `PHONE_DELIVERY`.
2. The outlet is already known from the menu context. The zone list is filtered to that outlet only.
3. Customer selects a zone from a grouped dropdown. Each option shows the zone name, fee, and ETA range.
4. Customer types the exact room/office/block and a gate or reception instruction.
5. Customer enters recipient name and the phone number the rider should call.
6. Customer may tap **“Use my current GPS pin (optional)”**. If permission is denied, checkout continues normally.
7. The order summary shows `Subtotal + Delivery fee = Total`. The fee comes from the server, not the client.
8. Payment is initiated only after all required delivery fields pass validation. The normal MoMo/Airtel flow in `Payment_Integration.md` is unchanged.
9. After payment succeeds, the order enters the KDS as `PENDING` with the purple `PHONE_DELIVERY` channel and the destination zone on the ticket.

### 4.3 Checkout wireframe

```text
+--------------------------------------------------------+
|  DELIVERY DETAILS                    Obunuzi / YMCA    |
+--------------------------------------------------------+
|  1. ZONE / LANDMARK                                    |
|     [ YMCA Main Campus                         v ]     |
|     UGX 1,500 delivery - 5-10 min                      |
|                                                        |
|  2. EXACT ROOM / OFFICE / LANDMARK NOTE                |
|     [ Block C, Room 204 - call at security gate    ]   |
|     0/160                                              |
|                                                        |
|  3. RECIPIENT NAME                                     |
|     [ Dr. Okello                                   ]   |
|                                                        |
|  4. PHONE NUMBER FOR RIDER CALL                        |
|     [ 0701 234 567                                 ]   |
|                                                        |
|  [ Use my current GPS pin (optional) ]                 |
|  Pin captured - +/-18 m - Open in Maps - Clear         |
|                                                        |
|  Subtotal                                   UGX 16,000 |
|  Delivery fee                                UGX 1,500 |
|  TOTAL                                      UGX 17,500 |
|  [ Pay UGX 17,500 ]                                    |
+--------------------------------------------------------+
```

The layout uses the existing Customer PWA tokens from `Design_System.md`: warm cream surface, pill action controls, Chili primary action, 48px minimum touch targets, and Mono numerals for UGX values. Form fields use the 12px radius, not a pill. Do not introduce map tiles, a draggable pin, or a new colour.

### 4.4 Zone dropdown behaviour

- **Source:** Phase 1 has **no public delivery-zone catalogue endpoint**. Zones are seeded into `delivery_zones` and referenced by `deliveryZoneId` when an order is created. The customer checkout screen is a static prototype; it does not call the live API. A future zone endpoint can group active zones by area without changing the order contract.
- **Grouping:** native `<optgroup>` by area (Makerere Campus, YMCA, Wandegeya, Phase 2). If an outlet ever exceeds 20 zones, replace the native select with an accessible searchable combobox; keep the same server contract.
- **Option label:** `Makerere University — Lumumba Hall · UGX 2,000 · 10–15 min`.
- **No “Other / type your own” option in Phase 1.** If the customer’s location is not listed, show the outlet phone number and the message “Call us to confirm delivery.” This keeps zone data clean and prevents surprise fees.
- **Changing a zone recalculates fee and ETA**, clears any previously selected zone-specific hint, and keeps the typed note.
- **Empty state:** if no active zones exist, disable delivery and show the outlet phone number. Do not fall back to a free-text address.
- **Accessibility:** a real `<label>`; keyboard-operable; error text linked with `aria-describedby`; no placeholder-only labels.

### 4.5 Optional GPS pin

Use the browser’s one-shot geolocation API. Do **not** use `watchPosition`, background location, or a third-party location SDK.

```ts
// src/lib/capture-delivery-pin.ts
// One-shot, user-initiated, optional. Returns null instead of throwing
// when the browser denies or cannot resolve a location.

export type DeliveryPin = {
  lat: number;
  lng: number;
  accuracyM: number;
  capturedAt: string;
};

export function captureDeliveryPin(): Promise<DeliveryPin | null> {
  if (!('geolocation' in navigator)) return Promise.resolve(null);

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        // 5 decimal places is roughly 1.1 m; do not store more precision
        // than the delivery actually needs.
        resolve({
          lat: Number(position.coords.latitude.toFixed(5)),
          lng: Number(position.coords.longitude.toFixed(5)),
          accuracyM: Math.round(position.coords.accuracy * 10) / 10,
          capturedAt: new Date().toISOString(),
        });
      },
      () => resolve(null), // denied, unavailable, or timed out
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 60_000, // accept a recent cached fix, not a 5-minute-old one
      }
    );
  });
}
```

**Rules**

- Geolocation requires a secure context: HTTPS in production, or `localhost` during development. It is not available on a plain-HTTP LAN address.
- The permission prompt must only appear after an explicit tap. Never request geolocation on page load.
- Never block “Pay” on geolocation. The pin is optional.
- Show the accuracy radius. If `accuracyM > 100`, label the pin **“Approximate”**. If `accuracyM > 500`, keep it as a hint but tell the customer the landmark note is more important.
- Provide **Clear pin**. A customer must be able to remove a location before paying.
- Store coordinates and accuracy in the database. Generate the link on demand; do not store a URL that can go stale.
- Map link format: `https://www.google.com/maps/search/?api=1&query=<lat>,<lng>`. Open it with `target="_blank"` and `rel="noopener noreferrer"`.
- Do not reverse-geocode the coordinates. Reverse geocoding is a billable Maps API and is unnecessary because the customer already selected a zone.

### 4.6 WhatsApp sharing: what is actually possible

A normal web page cannot attach a WhatsApp location pin or read a pin the customer received in WhatsApp. The honest implementation is:

1. Capture the pin with the GPS button.
2. Show a **“Share map link on WhatsApp”** button after capture.
3. Open `https://wa.me/<outlet-number>?text=<urlencoded message>` with a message such as:

```text
Order TOKEN-042 — my delivery pin: https://www.google.com/maps/search/?api=1&query=0.33410,32.56820
```

4. The customer taps **Send** in WhatsApp. The outlet receives a normal text message with a clickable link.

Outlet numbers are configured in `.env` as `FOODIZO_WHATSAPP_NUMBER` and `OBUNUZI_WHATSAPP_NUMBER` (see `Repo_Scaffold_and_Config.md §3`). Do not label this control “Send WhatsApp Location Pin.” It sends a **link**, not a WhatsApp location object. The zone and room note remain mandatory even if a pin is shared.

### 4.7 Delivery fee and ETA display

- Fee and ETA come from `delivery_zones.fee_ugx`, `eta_min_minutes`, and `eta_max_minutes`.
- The fee is part of `orders.total_amount_ugx` and therefore part of the MoMo/Airtel amount. It must appear in the payment reconciliation as a delivery component, not as an untracked cash top-up.
- The ETA is a range, not a promise. Do not display a single-minute countdown for delivery.
- Free-delivery promotions are configured by changing the seeded zone fee to `0` (database/seed); there is no Phase 1 admin UI for zone maintenance. Never hard-code a promotion in the client.

---

## 5. FOH Dispatch Contract

### 5.1 Dispatch queue

Delivery orders do not need a fifth role. When a delivery order reaches `READY`, it appears in the FOH/cashier **Dispatch Queue** (`/dispatch`), which is separate from the `/pos` table and phone-entry screen.

```text
+--------------------------------------------------------+
|  READY · TOKEN-042                    WAITING 02:14   |
|  DESTINATION: YMCA MAIN CAMPUS                         |
|  ROOM/NOTE: BLOCK C, ROOM 204 - CALL AT SECURITY GATE  |
|  Dr. Okello - 0701 234 567                             |
|  [ ASSIGN BODA RIDER ]  [ CALL CUSTOMER ]  [ OPEN MAP ]|
+--------------------------------------------------------+
```

The live `/dispatch` card renders the order total for cash collection, but no BOM, recipe, or kitchen-preparation data.

### 5.2 Dispatch actions

| Action | Behaviour |
| :--- | :--- |
| **ASSIGN BODA RIDER** | Opens the handoff modal: rider name (required), rider phone (required), boda plate and stage (optional), dispatch method (`CALL` / `WHATSAPP` / `COUNTER_HANDOFF`), and advance cash in UGX (optional, default `0`). |
| **CALL CUSTOMER** | Opens the `tel:` link returned by the API. The FOH phone or a rider’s phone dials the customer. |
| **OPEN MAP** | Opens the static Google Maps link returned by the API when a zone or GPS hint exists. It never embeds a map, rider marker, or route line. |
| **COMPLETE DELIVERY** | Appears on an **ON THE WAY** card. Records `DELIVERED`, `FAILED_UNREACHABLE`, `REFUSED`, or `RETURNED` plus any returned advance. |

There is no print-chit button on the dispatch card. Printing happens internally when the KDS bumps the order to `READY`; a failed print is retried from the POS with `POST /api/v1/orders/:id/reprint-chit`.

### 5.3 Handoff rules

- The rider does **not** log in. FOH records the rider’s name and phone number for accountability.
- If the outlet pays the rider’s transport (the normal Wandegeya stage-boda arrangement), record the cash advance in `rider_advance_ugx`. Record any change or unused advance returned by the rider in `rider_advance_returned_ugx`. An unrecorded UGX 2,000 handoff will show up as a cash-drawer variance at shift close.
- Do not confuse the rider advance with the delivery fee. The customer pays the delivery fee; the outlet pays the rider. The difference is the delivery contribution, which can be positive or negative.
- On handoff, write a `delivery_handoffs` row with `dispatched_at`, the FOH user, the dispatch method, and the rider advance fields.
- The active queue (`state=active`, default) lists `READY` delivery orders that have no handoff row yet, plus orders whose handoff outcome is still `PENDING`; the latter display as **ON THE WAY**. Failed handoffs (`FAILED_UNREACHABLE`, `REFUSED`, `RETURNED`) move to the manager review lane (`state=review`) instead of remaining in the active queue.
- The order remains `READY` while the rider is on the way. Delivering the food moves the order to `COMPLETED` and sets `delivery_handoffs.delivered_at`.
- If the customer is unreachable: call twice, wait five minutes, notify the manager, and record the outcome. Do not mark the order `COMPLETED` if the food was not handed over.
- Undelivered food follows the closing surplus/waste routine in `User_Flow.md §2 Flow C3` and is logged with a reason.
- An optional SMS can be sent when the rider is dispatched (“Your order is on the way”). It must not claim live tracking or a precise arrival minute.

### 5.4 What FOH sees vs. what the kitchen sees

| Data | KDS | FOH dispatch queue | Printed chit |
| :--- | :---: | :---: | :---: |
| Token, channel, items, station, elapsed time | Yes | Yes | Yes |
| Destination zone / landmark | Zone only | Yes | Yes |
| Room/office note | **No** | Yes | Yes |
| Customer name | **No** | Yes | Yes |
| Customer phone | **No** | Yes | Yes |
| GPS coordinates / map link | **No** | Link only | **No** |
| Prices / totals | **No** | Yes | **No** |

The KDS must remain free of customer names, phone numbers, and personal delivery notes, consistent with `Design_System.md §4.3`. The KDS may show the destination zone so the expo station can label the bag correctly.

---

## 6. Data Model Summary

The canonical DDL lives in `Tech_Stack.md §3`. This section defines the intent.

### 6.1 `delivery_zones`

| Column | Type | Notes |
| :--- | :--- | :--- |
| `id` | UUID | Primary key |
| `outlet` | `outlet_location` | Zone belongs to exactly one outlet |
| `zone_code` | `VARCHAR(40)` | Stable code, e.g. `MK_LUMUMBA` |
| `display_name` | `VARCHAR(100)` | Customer-facing label |
| `landmark_group` | `VARCHAR(60)` | Dropdown group, e.g. “Makerere Campus” |
| `landmark_hint` | `VARCHAR(160)` | Short helper, e.g. “Call at hall reception” |
| `fee_ugx` | `NUMERIC(10,2)` | Server-owned delivery fee |
| `eta_min_minutes` / `eta_max_minutes` | `INT` | Display range |
| `is_active` | `BOOLEAN` | Inactive zones never appear at checkout |
| `display_order` | `INT` | Stable dropdown ordering |

Unique constraint: `(outlet, zone_code)`.

### 6.2 `orders` additions

| Column | Type | Notes |
| :--- | :--- | :--- |
| `customer_name` | `VARCHAR(80)` | Required for delivery; used on the chit |
| `delivery_zone_id` | `UUID` FK → `delivery_zones.id` | Required when `channel = PHONE_DELIVERY` |
| `delivery_note` | `VARCHAR(160)` | Room/office/gate instruction; never shown on KDS |
| `delivery_lat` / `delivery_lng` | `NUMERIC(9,6)` | Optional one-shot pin |
| `delivery_accuracy_m` | `NUMERIC(6,1)` | Optional confidence hint |
| `delivery_pin_captured_at` | `TIMESTAMPTZ` | Optional; supports retention cleanup |
| `delivery_fee_ugx` | `NUMERIC(10,2)` | Snapshot of the zone fee at order time |

`customer_phone` already exists and is reused as the rider-call number.

### 6.3 `delivery_handoffs`

| Column | Type | Notes |
| :--- | :--- | :--- |
| `id` | UUID | Primary key |
| `order_id` | UUID FK → `orders.id` | Cascade delete |
| `rider_name` | `VARCHAR(80)` | Required |
| `rider_phone` | `VARCHAR(20)` | Optional |
| `dispatched_by` | UUID (references `users.id`) | FOH or manager; users table is defined by the auth module |
| `dispatch_method` | `dispatch_method` enum | `CALL`, `WHATSAPP`, `COUNTER_HANDOFF` |
| `rider_advance_ugx` | `NUMERIC(10,2)` | Cash advanced to the rider for transport; default `0` |
| `rider_advance_returned_ugx` | `NUMERIC(10,2)` | Change or unused advance returned; default `0`; must not exceed the advance |
| `dispatched_at` | `TIMESTAMPTZ` | Defaults to now |
| `delivered_at` | `TIMESTAMPTZ` | Null until delivered |
| `outcome` | `handoff_outcome` enum | `PENDING`, `DELIVERED`, `FAILED_UNREACHABLE`, `REFUSED`, `RETURNED` |
| `notes` | `TEXT` | Optional dispatch note |

### 6.4 Validation rules

1. A delivery order must reference an **active** zone owned by the same outlet.
2. The server recomputes `delivery_fee_ugx` from the zone; it never trusts the client.
3. `delivery_note`, `customer_name`, and `customer_phone` are required when `channel = PHONE_DELIVERY`.
4. Coordinates, if present, must be within valid WGS84 ranges.
5. A customer can clear the GPS pin without invalidating the order.
6. The KDS broadcast payload must not include customer name, phone, room note, or coordinates.
7. Notes printed to ESC/POS must be stripped of control characters (see `Hardware_and_Peripherals.md §1.3`).
8. `rider_advance_returned_ugx` must be `>= 0` and must not exceed `rider_advance_ugx`; a negative net advance is invalid.
9. Rider advance fields are FOH/manager-only and must never appear on the KDS or the customer-facing order view.

---

## 7. Zone Catalogue & Fee Policy

The following zones are the proposed Phase 1 pilot catalogue. Fees and ETAs are **launch defaults pending Zito Mbowe’s approval**, not contractual prices. All values are editable in the admin portal and must be seeded per outlet.

| Zone code | Display name | Group | Fee (UGX) | ETA | Landmark hint | Active |
| :--- | :--- | :--- | ---: | :--- | :--- | :---: |
| `MK_LUMUMBA` | Makerere University — Lumumba Hall | Makerere Campus | 2,000 | 10–15 min | Call at hall reception | Yes |
| `MK_MITCHELL` | Makerere University — Mitchell Hall | Makerere Campus | 2,000 | 10–15 min | Call at the main gate | Yes |
| `MK_AFRICA` | Makerere University — Africa Hall | Makerere Campus | 2,000 | 10–15 min | Call at the reception desk | Yes |
| `MK_MARY_STUART` | Makerere University — Mary Stuart Hall | Makerere Campus | 2,000 | 10–15 min | Call at the security gate | Yes |
| `MK_COMPLEX` | Makerere University — Main Complex / Freedom Square | Makerere Campus | 2,000 | 10–15 min | Meet at the main entrance | Yes |
| `MK_SENATE` | Makerere University — Senate Building / Main Gate | Makerere Campus | 2,000 | 10–15 min | Call at the main gate | Yes |
| `YMCA_MAIN` | YMCA Main Campus | YMCA | 1,500 | 5–10 min | Call at the reception | Yes |
| `HAM_TOWERS` | Ham Towers | Wandegeya | 1,000 | 5–10 min | Foodizo atrium / office floor | Yes |
| `WANDEGEYA_MARKET` | Wandegeya Market | Wandegeya | 2,000 | 10–15 min | Call at the market main gate | Yes |
| `KIKONI` | Kikoni | Wandegeya | 3,000 | 15–20 min | Call at the hostel gate | Yes |
| `MULAGO` | Mulago Hospital Area | Phase 2 | 4,000 | 20–30 min | Confirm with outlet | No |
| `KAMWOKYA` | Kamwokya | Phase 2 | 4,000 | 20–30 min | Confirm with outlet | No |
| `NAKASERO` | Nakasero | Phase 2 | 5,000 | 25–35 min | Confirm with outlet | No |
| `KOLOLO` | Kololo | Phase 2 | 6,000 | 30–40 min | Confirm with outlet | No |

**Fee policy**

- Fees are configured per outlet and per zone in the admin portal.
- The zone fee is a snapshot on the order (`delivery_fee_ugx`) so historical orders remain accurate if the fee changes later.
- The fee is shown before payment and included in the payment amount.
- The admin can set a zone to `0` for a free-delivery promotion without a code deployment.
- Delivery fee revenue is included in the shift-close reconciliation. Do not collect it as an untracked cash top-up.
- The delivery fee is revenue, not pure margin. The rider transport advance is an operating cost and must be recorded on the handoff. Set each zone fee at or above the typical rider advance, or budget the shortfall deliberately.
- **Launch-fee warning:** at the proposed fees, Ham Towers (`UGX 1,000`) and YMCA (`UGX 1,500`) are below the typical `UGX 2,000` stage-boda advance. Either raise those two fees to `UGX 2,000` or record the difference as a deliberate delivery subsidy. Do not discover this as a cash-drawer variance at 9:30 PM.
- Phase 2 zones remain inactive in the database so the dropdown stays short and the pilot radius stays honest.

---

## 8. Rider Chit Contract

The existing Expo ESC/POS printer fires the packaging chit when the kitchen bumps a `TAKEAWAY_PICKUP` or `PHONE_DELIVERY` order to `READY`; `DINE_IN` does not print a bag label. For delivery orders, the chit adds a delivery block. Full byte-level template: `Hardware_and_Peripherals.md §1`.

```text
+------------------------------------------------+
|                  TOKEN-042                     |
|                  PHONE-DELIVERY                |
+------------------------------------------------+
| CUSTOMER: DR. OKELLO                           |
| DESTINATION: YMCA MAIN CAMPUS                  |
| ROOM/NOTE: BLOCK C, ROOM 204                   |
|   CALL AT SECURITY GATE                        |
| PHONE: 0701 234 567                            |
+------------------------------------------------+
| [ ] 1x TRADITIONAL BEEF LUWOMBO                |
| [ ] 1x STEAMED MATOOKE                         |
+------------------------------------------------+
| PACKED BY: ________   CHECKED: [ ]             |
+------------------------------------------------+
```

**Rules**

- The chit is printed only after the order reaches `READY`, so the food is packed and the rider can leave immediately.
- The delivery chit contains personal data. It must be handed to the rider with the bag, not left on the counter.
- The phone number is printed in a bold, readable size. The rider can dial it without opening the FOH screen.
- If no GPS pin exists, the chit is still complete: zone + room note + phone are sufficient.
- Do not print the full GPS URL on the 80mm chit in Phase 1; it wraps badly. The FOH dispatch screen carries the link. A QR code is a possible Phase 2 enhancement.
- Reprints are allowed only through the FOH dispatch screen and are audit-logged.

---

## 9. API & Service Contracts

| Endpoint | Method | Purpose |
| :--- | :--- | :--- |
| `/api/v1/orders` | `POST` | Create order; validate the selected zone, recompute the delivery fee from `delivery_zones.fee_ugx`, and allocate a daily token |
| `/api/v1/dispatch/queue?outlet=...&state=active\|review` | `GET` | `active` (default): `READY` delivery orders with no handoff or an open `PENDING` handoff, displayed as **ON THE WAY**. `review`: failed handoffs for manager resolution. Both include zone, landmark hint, room note, customer name/phone, `tel:` link, and an optional static map link. |
| `/api/v1/orders/:id/dispatch` | `POST` | Record rider name/phone, dispatch method, transport advance, and optional “on the way” SMS |
| `/api/v1/orders/:id/delivery-complete` | `POST` | Record `DELIVERED`, `FAILED_UNREACHABLE`, `REFUSED`, or `RETURNED`; only `DELIVERED` completes the order and sets `delivered_at` |
| `/api/v1/orders/:id/reprint-chit` | `POST` | Re-fire the delivery chit; audit-logged |
| `/api/v1/dispatch/:id/assign-rider`, `/api/v1/dispatch/:id/complete` | `POST` | Compatibility aliases for the order-level handoff and completion routes |

There is **no public delivery-zone catalogue endpoint** and **no zone-maintenance admin API** in Phase 1. Zones are seeded into `delivery_zones`; changing a fee, ETA, or active flag is seed/database maintenance. The customer checkout screen is a static prototype under `/prototype/checkout`.

**Validation and order-creation errors**

| Code | HTTP | Meaning |
| :--- | :--- | :--- |
| `INVALID_DELIVERY_ZONE` | `400` | The zone does not exist, is inactive, or belongs to another outlet |
| *(Zod validation error)* | `400` | A required delivery field is missing or malformed: `deliveryZoneId`, `customerName`, `customerPhone`, or the items array. The response identifies the failing field. |
| `POSTPAY_REQUIRES_STAFF` | `403` | A public request tried to open a `DINE_IN` POSTPAY tab |

A missing or invalid zone is rejected before any MoMo/Airtel STK push is initiated. Delivery orders require a callable phone, a recipient name, and a zone from the selected outlet.

### 9.1 Zone Deactivated Between Selection and Submission

A delivery order can be composed from a zone that becomes inactive before `POST /api/v1/orders` is submitted. Phase 1 has no live customer checkout or zone-admin UI, so this applies to API clients, seeded demo tooling, and any future customer surface; zone changes are made through the seed or a direct database update.

| Step | Actor | Action |
| :--- | :--- | :--- |
| 1 | Client | Selects `YMCA_MAIN_CAMPUS` (active, fee UGX 2,000) and prepares the delivery fields |
| 2 | Operator | Runs seed/database maintenance and sets `is_active = false` on that zone (e.g., riders unavailable for the evening) |
| 3 | System | `POST /api/v1/orders` re-reads `delivery_zones` at creation time |
| 4 | System | The zone is missing, inactive, or from another outlet → `400 INVALID_DELIVERY_ZONE` |
| 5 | Client | Shows the zone error and asks the customer to choose another zone or switch to pickup |
| 6 | Client | Retries with a valid active zone — no payment was initiated |

> **Rule:** Zone validation and fee recomputation happen at `POST /api/v1/orders` — **before** the STK push is dispatched. The client-side zone selection is advisory only; the server always re-reads `delivery_zones.is_active` and `delivery_zones.fee_ugx` from the database. Never trust or compare a client-supplied fee.

---

## 10. Privacy, Security & Operational Safety

- **Consent:** GPS is captured only after an explicit tap. The button copy explains that the pin will be shared with the rider. Declining has no penalty.
- **Data minimisation:** Store zone, note, name, phone, and optional pin. Do not collect continuous location, background location, or contacts.
- **Access control:** Customer name, phone, room note, and GPS link are visible to `WAITER_FOH` and `MANAGER_ADMIN`. `KITCHEN_STAFF` sees only the destination zone. Riders receive the printed chit, not a system login.
- **Logging:** Mask phone numbers in application logs (`0701***567`). Do not log GPS coordinates at `info` level.
- **Retention:** Keep precise coordinates only as long as needed for delivery disputes; a default proposal is 90 days, then null the lat/lng/accuracy fields while retaining the zone and note for order history. Confirm the final retention period with Zito Mbowe and the business’s data-protection policy.
- **Uganda Data Protection and Privacy Act, 2019:** Treat phone numbers and precise location as personal data. Collect for a stated purpose, protect it, and do not repurpose it for marketing without consent. This is an engineering note, not legal advice.
- **ESC/POS injection:** Customer notes are printed to a raw printer. Strip `ESC`, `GS`, and control bytes before printing; cap the note length. A malicious note must not be able to issue printer commands.
- **Client trust:** The client may send coordinates, but the server must validate ranges. The client must never send a trusted fee. The server recomputes the zone fee and total.
- **No API keys:** No Google Maps key, no Places key, and no Directions key is required for Phase 1. Do not add one to `.env`.

---

## 11. Phase 2 Trigger: When Live Tracking Becomes Worth It

Do not add live GPS tracking because a competitor has a map. Add it when the operation has the fleet discipline to use it.

| Trigger | Threshold | Why it changes the decision |
| :--- | :--- | :--- |
| Dedicated fleet | 5+ full-time contracted riders (not freelance stage bodas) | A rider app can be mandated and supported |
| Delivery volume | >100 deliveries/day outside the immediate 1 km campus radius | Dispatch by phone stops scaling |
| Delivery failures | >5% of deliveries fail or are late because of address ambiguity for two consecutive weeks | The zone model needs a live assist |
| Geographic spread | Regular deliveries to Kololo, Nakasero, Mulago, or Kamwokya | Landmark familiarity drops |
| Customer expectation | Corporate/office clients require live ETA | A tracking link becomes commercially necessary |

### 11.1 Phase 2 architecture (if triggered)

- **Map:** Leaflet + OpenStreetMap, not Google Maps JavaScript SDK. Budget for a tile provider or self-host tiles; public OSM tile servers have usage policies and no SLA.
- **Rider PWA:** a lightweight rider view with `navigator.geolocation.watchPosition`, a 15–30 second heartbeat, and a visible “sharing location” indicator.
- **Transport:** WebSocket (`@fastify/websocket`) to the FOH dispatch screen. Phase 1 uses the in-process `fastify.broadcastWs` bus; a multi-instance Phase 2 deployment would need a shared broker, which is not implemented.
- **Storage:** `rider_locations` table (optionally PostGIS) with rider ID, order ID, lat/lng, accuracy, and timestamp. Retain only the latest point plus a short trail.
- **Consent and battery:** explicit rider opt-in, foreground-only sharing by default, pause when the app is backgrounded, and a clear battery impact warning.
- **Fallback:** the zone + landmark + phone workflow remains available if the map, GPS, or network fails.

### 11.2 Migration path

Phase 2 is additive:

1. Keep `delivery_zones`, `delivery_zone_id`, and the printed chit.
2. Add rider and location tables; do not rewrite the order state machine.
3. Add a `tracking_url` to the customer notification only when a rider is actually sharing.
4. Keep the call/WhatsApp path forever as the fallback.

---

## 12. Acceptance Criteria

Before the delivery feature is demoed to Zito Mbowe, verify:

- [ ] A delivery order cannot be submitted without an active, outlet-matched zone.
- [ ] A delivery order cannot be submitted without a room/office/landmark note, a recipient name, and a valid Ugandan phone number.
- [ ] Delivery fee and ETA are displayed before payment; the total includes the fee.
- [ ] The server ignores a client-supplied delivery fee and writes only the zone-derived fee.
- [ ] The customer can complete checkout with GPS denied or unavailable.
- [ ] The GPS button never prompts on page load and never blocks payment.
- [ ] The map link opens a static Google Maps pin; no map SDK, API key, or embedded tiles load.
- [ ] The KDS shows the destination zone but not the customer name, phone number, room note, or GPS coordinates.
- [ ] The FOH dispatch queue shows zone, room note, phone, **ASSIGN BODA RIDER**, **CALL CUSTOMER**, and **OPEN MAP**; a failed print is retried from the POS.
- [ ] The thermal chit prints destination, room/note, and phone for delivery orders.
- [ ] The chit printer strips control characters from customer notes.
- [ ] A rider handoff records rider name, dispatcher, method, timestamp, and any transport advance.
- [ ] Rider advances and returned change reconcile to the cash drawer at shift close.
- [ ] A delivery can be completed and reconciled without a live map.
- [ ] Inactive Phase 2 zones do not appear in the checkout dropdown.
- [ ] The flow works on a 3G connection with map services blocked.
- [ ] All controls meet the 48px touch-target minimum; the zone select has a visible label and accessible error text.

---

## 13. Related Specifications

| File | Scope |
| :--- | :--- |
| `Foundational_Concept.md` | Problem scope, four-role matrix, workflows, KPIs |
| `Design_System.md` | Customer delivery panel, FOH dispatch queue, KDS privacy rules |
| `User_Flow.md` | Delivery checkout flow, dispatch handoff, order lifecycle |
| `User_Profiles_Personas.md` | Brian K., Prossy N., Chef Juma, Zito Mbowe, rider actor |
| `Tech_Stack.md` | DDL for zones/orders/handoffs, dispatch services, repo scaffold |
| `Payment_Integration.md` | Delivery fee included in the MoMo/Airtel amount |
| `Hardware_and_Peripherals.md` | ESC/POS delivery chit and printer safety |
| `Seed_Data_and_Testing.md` | Zone seed data and delivery test cases |
| `Repo_Scaffold_and_Config.md` | Delivery components, services, and environment variables |
| `Demo_Script_and_Closing_Strategy.md` | Delivery demo segment and “why no live map” objection |
