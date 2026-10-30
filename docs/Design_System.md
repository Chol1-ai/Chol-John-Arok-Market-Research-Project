# Design System & UI/UX Specifications

**Theme Archetype:** Role-Differentiated Tactile Utility<br>
**Anti-Slop Directive:** No generic SaaS styling. Four roles, four visual personalities, zero shared button skins.<br>
**Target Locations:** Foodizo (Ham Towers) & Obunuzi Restaurant & Cafe (Opposite YMCA)<br>
**Related Files:** `Foundational_Concept.md` Â· `User_Flow.md` Â· `User_Profiles_Personas.md` Â· `Delivery_Zones_and_Dispatch.md` Â· `Tech_Stack.md` Â· `Payment_Integration.md` Â· `Hardware_and_Peripherals.md` Â· `Seed_Data_and_Testing.md` Â· `Repo_Scaffold_and_Config.md` Â· `Demo_Script_and_Closing_Strategy.md` Â· `Daily_Audit_Digest.md` Â· `Deployment_Runbook.md` Â· `Service_Contract_and_Invoice_Template.md` Â · `build_strategy/Build_Strategy_and_Phases.md`

> **Authority:** This file is the visual contract for all four surfaces. If another document disagrees on a visual value, this file wins. If another document disagrees on a role permission, the RBAC matrix in `Foundational_Concept.md` wins.

---

## 0. Canonical Values (Resolve Conflicts Here)

These values supersede older references elsewhere in the documentation set:

| Item | Canonical Value |
| :--- | :--- |
| KDS bump button height | **68px**, full ticket width |
| Customer token display | **54px** JetBrains Mono 700 |
| Display / narrative font | **Plus Jakarta Sans** (600/700/800) |
| Data / numeric font | **JetBrains Mono** (500/700/800) |
| KDS surface / card | `#050811` / `#0F172A` |
| Customer surface / card | `#FAF8F5` / `#FFFFFF` |
| FOH surface / card | `#F1F5F9` / `#FFFFFF` |
| Admin surface / card | `#0B0F17` / `#111827` |
| Admin primary accent | **Champagne Brass `#C8A96A`** â€” deliberately not amber |
| READY badge | **Pine `#047857`** with white text; `#10B981` is the glow accent |
| General touch target | **48px** minimum; FOH menu tiles **56px**; KDS bump **68px** |
| Customer form fields | **12px** radius; pill geometry is reserved for actions |
| Currency format | **UGX 14,000** â€” no decimals, no `$`, no `â‚¬` |

---

## 1. Architectural Philosophy: The Anti-Uniformity Mandate

A student on a 20-minute lecture break, a waiter carrying eight table tabs, a cook reaching through oil mist, and an operations lead auditing a cash drawer do not share a visual language. Treating them as one â€œuserâ€ is what produces generic dashboards.

**Core rule:** *Share code, never share the rendered skin.* A single `RoleButton` primitive is acceptable. The four variants must differ in **hue, radius, border weight, depth, typography, and press behaviour** â€” not just fill colour.

| Dimension | 1. Customer PWA | 2. Waiter / FOH | 3. Kitchen / KDS | 4. Manager / Admin |
| :--- | :--- | :--- | :--- | :--- |
| **Route scope** | `/`, `/cart`, `/checkout`, `/token/[token]` | `/pos`, `/pos/tables`, `/pos/phone-entry`, `/pos/dispatch` | `/kds/steam`, `/kds/fryer`, `/kds/rolex`, `/kds/expo` | `/admin/*` |
| **Design mood** | Warm street craft | Tactical service terminal | Industrial machinery HUD | Executive ledger |
| **Surface** | Warm cream `#FAF8F5` | Utilitarian slate `#F1F5F9` | Carbon matte `#050811` | Obsidian `#0B0F17` |
| **Primary accent** | Chili `#C2410C` | Cobalt `#1E3A8A` | Phosphor `#059669` | Brass `#C8A96A` |
| **Primary hover** | `#9A3412` | `#172554` | `#10B981` | `#D9BC80` |
| **Primary active** | `#7C2D12` | `#0F172A` | `#022C22` | `#8C6D2F` |
| **Text on primary** | White | White | Ink `#050811` | Ink `#0B0F17` |
| **Geometry** | Pill `9999px` | Crisp `6px` | Zero `0` | Precision `2px` |
| **Depth language** | Soft warm lift | Hard ink offset | 5px physical bevel | Flat hairline, no shadow |
| **Press language** | Scale to `0.97` | Snap down `2px` | Sink `4px`, collapse bevel | Background step only |

> **Reject condition:** If you can swap the logo and the screen still looks like a generic Tailwind admin template, the design is not finished.

---

## 2. Token Architecture

### 2.1 Shared Semantic Colours (Never Role-Scoped)

Status, channel, and payment colours are **global semantics**. They must not be recoloured per role, or a cook and a waiter will describe the same ticket differently.

**Order status**

| Status | Fill | Text On Fill | Meaning |
| :--- | :--- | :--- | :--- |
| `AWAITING_PAYMENT` | `#475569` | `#FFFFFF` | Checkout holding state; never shown on the KDS |
| `PENDING` | `#64748B` | `#FFFFFF` | Awaiting cook claim |
| `PREPARING` | `#D97706` | `#1C1917` on light / `#050811` on dark | On griddle / in fryer |
| `READY` | `#047857` | `#FFFFFF` | Plated / ready for pickup |
| `OVERDUE` (>10 min) | `#DC2626` | `#FFFFFF` | Display flag only; does not alter state |
| `COMPLETED` | `#334155` | `#FFFFFF` | Handed over |
| `CANCELLED` | `#7F1D1D` | `#FFFFFF` | Manager phone + PIN approval, or payment-TTL expiry |

**Fulfilment channel**

| Channel | Fill | Text On Fill |
| :--- | :--- | :--- |
| `DINE_IN` | `#2563EB` | `#FFFFFF` |
| `TAKEAWAY_PICKUP` | `#D97706` | `#1C1917` on light / `#050811` on dark |
| `PHONE_DELIVERY` | `#7C3AED` | `#FFFFFF` |

**Payment state**

| Status | Fill | Text On Fill |
| :--- | :--- | :--- |
| `INITIATED` | `#64748B` | `#FFFFFF` |
| `PENDING_CUSTOMER_PIN` | `#D97706` | `#1C1917` / `#050811` |
| `SUCCESSFUL` | `#047857` | `#FFFFFF` |
| `FAILED / TIMED_OUT` | `#DC2626` | `#FFFFFF` |
| `CANCELLED` | `#7F1D1D` | `#FFFFFF` |
| `REFUND_PENDING` | `#B45309` | `#FFFFFF` |
| `REFUNDED` | `#334155` | `#FFFFFF` |

> **Colour-independence rule:** Every status badge must include a text label and an icon. Colour alone is never the only signal.
>
> **Manual MoMo is an audit flag, not a status.** `VERIFIED_MANUAL_MOMO` is stored in `payments.audit_flag` on a payment whose real status is `SUCCESSFUL`. Render it as a secondary purple â€œManual verifiedâ€ tag beside the green `SUCCESSFUL` badge; never add a separate manual-MoMo payment status or a purple paid badge that can be confused with a telco success.

### 2.2 Role Accent Tokens

Each role gets its own `--role-*` CSS variables. Components consume those variables; they never hardcode a role hex.

#### Customer PWA â€” Warm Appetite & Street Craft

| Token | Value | Notes |
| :--- | :--- | :--- |
| `--role-surface` | `#FAF8F5` | Warm cream canvas |
| `--role-card` | `#FFFFFF` | Crisp warm white |
| `--role-border` | `#E7E2D9` | 1.5px warm hairline |
| `--role-ink` | `#1C1917` | Near-black warm ink |
| `--role-muted` | `#57534E` | Body secondary text |
| `--role-primary` | `#C2410C` | Burnt terracotta; white text = 5.18:1 |
| `--role-primary-hover` | `#9A3412` | Deep flame red; white = 7.31:1 |
| `--role-primary-active` | `#7C2D12` | Pressed brick; white = 9.37:1 |
| `--role-on-primary` | `#FFFFFF` | Rest + hover |
| `--role-on-primary-active` | `#FFFFFF` | Active only |
| `--role-secondary` | `#D97706` | Spiced ochre; ink text = 5.49:1 |
| `--role-secondary-hover` | `#F59E0B` | Luminous ochre; ink text = 8.14:1 |
| `--role-secondary-active` | `#B45309` | Caramel press; white text = 5.02:1 |
| `--role-secondary-border` | `#B45309` | 1.5px boundary; 5.02:1 on white |
| `--role-on-secondary` | `#1C1917` | Rest + hover |
| `--role-on-secondary-active` | `#FFFFFF` | Active only |
| `--role-disabled` | `#E2DDD5` | Muted warm sand |
| `--role-on-disabled` | `#57534E` | 5.64:1 on disabled fill |
| `--role-focus` | `#9A3412` | 2px ring, 2px offset |
| `--role-radius` | `9999px` | Pill geometry |
| `--role-shadow` | `0 4px 14px rgba(194, 65, 12, 0.22)` | Warm lift |
| `--role-shadow-active` | `0 1px 0 rgba(124, 45, 18, 0.5)` | Physical dip |

#### Waiter / FOH â€” Tactical Service Terminal

| Token | Value | Notes |
| :--- | :--- | :--- |
| `--role-surface` | `#F1F5F9` | Sunlight-readable slate |
| `--role-card` | `#FFFFFF` | High-contrast white |
| `--role-border` | `#0F172A` | 2px hard ink border |
| `--role-ink` | `#0F172A` | Ink text |
| `--role-muted` | `#475569` | Secondary text |
| `--role-primary` | `#1E3A8A` | Cobalt; white = 10.36:1 |
| `--role-primary-hover` | `#172554` | Midnight navy; white = 14.69:1 |
| `--role-primary-active` | `#0F172A` | Ink snap; white = 17.06:1 |
| `--role-on-primary` | `#FFFFFF` | Rest + hover |
| `--role-on-primary-active` | `#FFFFFF` | Active only |
| `--role-secondary` | `#0F766E` | Tactical pine; white = 5.47:1 |
| `--role-secondary-hover` | `#115E59` | Deep pine; white = 7.58:1 |
| `--role-secondary-active` | `#042F2E` | Abyss teal; white = 14.47:1 |
| `--role-on-secondary` | `#FFFFFF` | Rest + hover |
| `--role-on-secondary-active` | `#FFFFFF` | Active only |
| `--role-disabled` | `#94A3B8` | Faded slate |
| `--role-on-disabled` | `#1E293B` | 5.71:1 |
| `--role-focus` | `#2563EB` | 2px ring, 2px offset |
| `--role-radius` | `6px` | Crisp terminal radius |
| `--role-shadow` | `2px 2px 0 #0F172A` | Hard ink offset |
| `--role-shadow-active` | `0 0 0 #0F172A` | Shadow collapses on press |

#### Kitchen KDS â€” Industrial Machinery HUD

| Token | Value | Notes |
| :--- | :--- | :--- |
| `--role-surface` | `#050811` | Carbon matte, anti-reflective |
| `--role-card` | `#0F172A` | Heavy dark steel |
| `--role-border` | `#1E293B` | 2px industrial border |
| `--role-ink` | `#F8FAFC` | High-lumen text |
| `--role-muted` | `#94A3B8` | Secondary station text |
| `--role-primary` | `#059669` | Phosphor emerald; ink text = 5.31:1 |
| `--role-primary-hover` | `#10B981` | High-glow lime; ink text = 7.89:1 |
| `--role-primary-active` | `#022C22` | Pressed pit; light text = 14.48:1 |
| `--role-on-primary` | `#050811` | Rest + hover â€” **never white** |
| `--role-on-primary-active` | `#F8FAFC` | Active only |
| `--role-secondary` | `#D97706` | Warning / hold amber; ink = 6.28:1 |
| `--role-secondary-hover` | `#F59E0B` | Luminous amber; ink = 9.32:1 |
| `--role-secondary-active` | `#451A03` | Burned amber; light text = 14.44:1 |
| `--role-on-secondary` | `#050811` | Rest + hover |
| `--role-on-secondary-active` | `#FFFBEB` | Active only |
| `--role-disabled` | `#1E293B` | Dead steel |
| `--role-on-disabled` | `#64748B` | 3.07:1 â€” disabled only |
| `--role-focus` | `#FDE047` | 3px ring, 2px offset |
| `--role-radius` | `0` | Zero-radius industrial slab |
| `--role-shadow` | `0 5px 0 #022C22` | Physical bevel |
| `--role-secondary-shadow` | `0 5px 0 #451A03` | Amber warning bevel |
| `--role-shadow-active` | `0 0 0 #022C22` | Bevel collapses |

> **Critical correction:** White text on `#10B981` is only **2.54:1** and white on `#059669` is **3.77:1**. Both fail WCAG AA for normal text. KDS phosphor buttons use dark ink text. This also reads more like industrial equipment.

#### Manager / Admin â€” Executive Ledger & Audit

| Token | Value | Notes |
| :--- | :--- | :--- |
| `--role-surface` | `#0B0F17` | Obsidian shadow |
| `--role-card` | `#111827` | Dark quartz |
| `--role-border` | `#1F2937` | 1px hairline |
| `--role-ink` | `#F8FAFC` | Ledger text |
| `--role-muted` | `#94A3B8` | Secondary text |
| `--role-primary` | `#C8A96A` | Champagne brass; ink = 8.53:1 |
| `--role-primary-hover` | `#D9BC80` | Liquid brass; ink = 10.46:1 |
| `--role-primary-active` | `#8C6D2F` | Burnished brass; white = 4.83:1 |
| `--role-on-primary` | `#0B0F17` | Rest + hover |
| `--role-on-primary-active` | `#FFFFFF` | Active only |
| `--role-secondary` | `#047857` | Sovereign pine; white = 5.48:1 |
| `--role-secondary-hover` | `#065F46` | Deep pine; white = 7.68:1 |
| `--role-secondary-active` | `#064E3B` | Forest press; white = 9.5:1 |
| `--role-on-secondary` | `#FFFFFF` | Rest + hover |
| `--role-on-secondary-active` | `#FFFFFF` | Active only |
| `--role-disabled` | `#1F2937` | Dark graphite |
| `--role-on-disabled` | `#6B7280` | Disabled only |
| `--role-focus` | `#FBBF24` | 2px ring, 2px offset |
| `--role-radius` | `2px` | Precision micro-radius |
| `--role-shadow` | `none` | Flat data aesthetic |

> **Why brass instead of amber:** `#D97706` is already the shared `PREPARING` status and the customer secondary accent. Reusing it for admin actions makes a commit button look like a kitchen status. Brass is deliberately shifted toward muted gold so the admin surface reads as a financial ledger, not a KDS warning.

### 2.3 Text-on-Accent Contrast Reference

Builders must not guess. These pairs are pre-verified:

| Pair | Ratio | Use |
| :--- | :--- | :--- |
| White on `#C2410C` | 5.18:1 | Customer primary |
| White on `#9A3412` | 7.31:1 | Customer primary hover |
| Ink on `#D97706` | 5.49:1 | Customer secondary rest / amber badge on light |
| Ink on `#F59E0B` | 8.14:1 | Customer secondary hover |
| White on `#B45309` | 5.02:1 | Customer secondary active / border |
| White on `#1E3A8A` | 10.36:1 | FOH primary |
| White on `#0F766E` | 5.47:1 | FOH secondary |
| Ink on `#059669` | 5.31:1 | KDS bump rest |
| Ink on `#10B981` | 7.89:1 | KDS bump hover |
| Ink on `#D97706` | 6.28:1 on `#050811` | KDS warning |
| White on `#DC2626` | 4.83:1 | Overdue / failed |
| Ink on `#C8A96A` | 8.53:1 | Admin primary |
| White on `#047857` | 5.48:1 | Admin secondary / READY badge |
| `#10B981` on `#111827` | 6.99:1 | Admin positive variance |
| `#F87171` on `#111827` | 6.41:1 | Admin negative variance |
| Black on `#FDE047` | 15.93:1 | Kitchen modifier flag |

> **Body copy target:** 4.5:1 minimum. **Large text (â‰¥24px regular or â‰¥19px bold):** 3:1 minimum. **UI boundaries and icons:** 3:1 minimum.

---

## 3. Typography Architecture: Strict Dual-Engine System

All quantitative data runs on a **Monospace Engine**. All narrative text runs on an **Industrial Sans Engine**. This prevents counters, timers, and currency columns from shifting as values change.

| Engine | Family | Weights | Usage |
| :--- | :--- | :--- | :--- |
| **Operational Data** | `JetBrains Mono`, `Consolas`, monospace | 500 / 700 / 800 | Tokens, timers, quantities, UGX values, table counts, audit IDs |
| **Narrative / UI** | `Plus Jakarta Sans`, `Inter`, sans-serif | 600 / 700 / 800 | Dish names, modifiers, prompts, headings, buttons |

### 3.1 Type Scale

| Token | Spec |
| :--- | :--- |
| Customer token display | **54px** / JetBrains Mono / 700 / line-height 1.0 / tracking -0.03em |
| KDS station label | **24px** / Plus Jakarta Sans / 800 / uppercase / tracking +0.08em |
| KDS elapsed timer | **26px** / JetBrains Mono / 800 / tabular-nums |
| KDS ticket number | **22px** / JetBrains Mono / 700 |
| Menu dish title | **19px** / Plus Jakarta Sans / 700 / wraps to two lines |
| Table number indicator | **24px** / Plus Jakarta Sans / 800 |
| UGX currency value | **17px** / JetBrains Mono / 700 / tabular-nums |
| Modifier flag | **14px** / JetBrains Mono / 700 / black on `#FDE047` |
| Body / labels | **15â€“16px** / Plus Jakarta Sans / 600 |
| Admin table row | **14px** / Plus Jakarta Sans / 600 + mono numerics |

### 3.2 Typographic Rules

- **No layout jitter:** apply `font-variant-numeric: tabular-nums slashed-zero;` to every Mono numeric surface.
- **No truncation of food names:** allow two-line wrapping. Never render `Fried Chicken & Ch...`.
- **No decimal cents:** `UGX 14,000`, never `UGX 14,000.00`.
- **No foreign currency symbols:** no `$`, `â‚¬`, or `Â£` anywhere.
- **No faux-bold:** load the actual 700/800 weights; do not rely on browser synthesis.
- **Uppercase only for tactical labels:** KDS station headers, table status chips, and compact button labels. Never uppercase a dish name or a customer message.

### 3.3 Font Loading & Offline Resilience

- **Next.js path:** use `next/font/local` with self-hosted WOFF2 files, or `next/font/google` at build time. Do not depend on a runtime Google Fonts request.
- **Non-Next.js fallback:** self-host `@fontsource/plus-jakarta-sans` and `@fontsource/jetbrains-mono` in the bundle.
- **Why:** the Ham Towers / YMCA edge node must render correctly during a fiber cut or UMEME load-shedding event.
- Set `font-display: swap` and preload only the 700/800 display weights plus the 700 mono weight.
- Keep the fallback stack metric-compatible: `Plus Jakarta Sans â†’ Inter â†’ system-ui â†’ sans-serif`; `JetBrains Mono â†’ Consolas â†’ monospace`.
- Expose the loaded families as CSS variables so the Tailwind config resolves:

```css
:root {
  --font-display: 'Plus Jakarta Sans';
  --font-mono: 'JetBrains Mono';
}
```

With `next/font`, pass `variable: '--font-display'` and `variable: '--font-mono'`, then apply both variables to the root `<body>` element. In a non-Next.js build, declare the variables directly in `:root`.

---

## 4. Component Blueprints

### 4.1 Customer PWA â€” Digital Token Pass

The token is not a generic success card. It is a **physical meal ticket**: notched edges, a perforated tear line, hard ink border, and a token number that can be read from two metres away.

```text
+===================================================+
|  FOODIZO Â· HAM TOWERS          PREPARING Â· 04:12  |
+ - - - - - - - - - - - - - - - - - - - - - - - - - +
|                                                   |
|                      #042                         |  <- 54px JetBrains Mono 700
|         PICKUP TOKEN Â· REF TOKEN-042              |
|                                                   |
|  EXPRESS PICKUP Â· SHOW THIS SCREEN AT THE COUNTER |
+ - - - - - - - - - - - - - - - - - - - - - - - - - +
|  2x Rolex (2 Eggs, 1 Chapati)                     |
|  1x Cold Mirinda Apple 500ml                      |
+===================================================+
```

**Specification**

- Border: `2px solid #0F172A`; background `#FFFFFF`; perforated separator `border-top: 2px dashed #E7E2D9`.
- Notches: two 12px circular cut-outs at the perforation line, created with `radial-gradient` masks. Do not use a generic rounded card.
- Token value: large `#042` under a `PICKUP TOKEN` label; the canonical API value `TOKEN-042` is printed in 12px Mono beneath the number for counter verification.
- Status: live `PREPARING` / `READY` badge with icon + text. On `READY`, transition to a `#047857 â†’ #065F46` background, white text, `aria-live="polite"`, and a single vibration pattern if `navigator.vibrate` exists.
- Do **not** pulse/flash indefinitely. One arrival flash, then a static ready state.
- Full-order breakdown remains visible; no â€œview detailsâ€ accordion on the token screen.

**Customer menu and checkout**

- Dish cards: 16px radius, 1.5px `#E7E2D9` border, no floating shadow. The food image is the hero, not a generic gradient header.
- Price: Mono 17px, right-aligned, `UGX 14,000`.
- Primary CTA: pill, Chili `#C2410C`, white text, warm lift. Hover `#9A3412`; active `#7C2D12` + `scale(0.97)`.
- Secondary CTA: pill, Spiced Ochre `#D97706` fill, 1.5px `#B45309` border, ink text. Hover `#F59E0B`; active `#B45309` + white text. The border keeps the button boundary above 3:1 when the hover fill brightens.
- â€œSold outâ€ is a binary 86 state. Never expose raw inventory quantities or supplier costs to the customer.

**Payment countdown / fallback**

- `PENDING_CUSTOMER_PIN`: 45-second conic-gradient ring in amber; `37s` in 54px Mono; the API starts polling at `T+30s`, and the retry/pay-at-counter actions appear at `T+45s`; background `#FAF8F5`.
- `FAILED / TIMED_OUT`: 2px `#DC2626` warning border; merchant dial codes in 24px Mono; `I have paid â€” Notify Cashier` flags manual verification.
- Do not use a generic spinner as the primary waiting state. The countdown ring is the state.

**Delivery details panel (only when fulfilment = Delivery)**

The panel is a short form, not a map. It appears between the cart review and the payment CTA. Full behavioural contract: `Delivery_Zones_and_Dispatch.md Â§4`.

```text
+--------------------------------------------------------+
|  DELIVERY DETAILS                    Obunuzi / YMCA    |
+--------------------------------------------------------+
|  ZONE / LANDMARK                                       |
|  [ YMCA Main Campus                              v ]   |
|  UGX 1,500 delivery - 5-10 min                         |
|                                                        |
|  EXACT ROOM / OFFICE / LANDMARK NOTE                   |
|  [ Block C, Room 204 - call at security gate       ]   |
|  42/160                                                |
|                                                        |
|  RECIPIENT NAME                                        |
|  [ Dr. Okello                                      ]   |
|                                                        |
|  PHONE NUMBER FOR RIDER CALL                           |
|  [ 0701 234 567                                   ]    |
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

- **Zone select:** native `<select>` with `<optgroup>` by area; 56px height; visible `<label>`; 1.5px `#E7E2D9` border; 12px radius (form fields use a softer radius than the pill action controls). Each option reads `Zone Â· UGX 2,000 Â· 10â€“15 min`.
- **Note field:** 3â€“160 characters, two-line textarea, visible counter; helper copy â€œRoom, block, office, or gate instruction.â€ Never accept a bare â€œcampusâ€ or â€œnear YMCAâ€ as sufficient.
- **Recipient name:** 2â€“80 characters.
- **Phone:** 10-digit Ugandan format accepted; normalised to E.164 on blur. Show inline carrier-neutral validation, not an MTN/Airtel-specific prompt.
- **GPS button:** 48px minimum, secondary style (Spiced Ochre fill, ink text). Only requests location after the tap. No map iframe, no draggable pin, no tiles, no API key.
- **Captured state:** show accuracy, a small `Open in Maps` link, and a `Clear` action. If accuracy is worse than 100m, label it **Approximate**; never present it as an exact drop-off.
- **Denied/unavailable state:** neutral helper text, not a red error: â€œNo pin added â€” your landmark note is enough.â€
- **WhatsApp sharing:** after capture, show a text link **Share map link on WhatsApp**. Do not label it â€œSend WhatsApp Location Pinâ€; a `wa.me` link sends text, not a WhatsApp location object.
- **No â€œOther / type your ownâ€ zone option.** If the customerâ€™s location is not listed, show the outlet phone number and â€œCall us to confirm delivery.â€ This prevents untracked addresses and surprise fees.
- **Fee display:** always show the server-computed delivery fee and the resulting total before the pay button. Do not let the client edit the fee.
- **Error state:** 2px `#DC2626` border, icon + text, error summary above the pay button, and focus moved to the first invalid field. The pay button stays disabled until the required fields pass.
- **No live map:** do not add a map preview, route line, rider marker, or â€œnearby restaurantsâ€ map. The zone and note are the delivery UX.

### 4.2 Waiter / FOH â€” Tactical Table Grid

The floor screen is a dispatch board, not a card gallery. Tiles are dense, high-contrast blocks with an ink border and a hard offset shadow.

```text
+------------------------------------+
|  T-04                 [ 4 SEATS ]  |
|                                    |
|  UGX 48,000           [ 18 MINS ]  |
+------------------------------------+
|  [ OCCUPIED ]     [ + ADD DISH ]   |
+------------------------------------+
```

| State | Visual | Interaction |
| :--- | :--- | :--- |
| `VACANT` | White card, 2px dashed `#64748B`, ink text | Tap claims the table and opens a new tab |
| `OCCUPIED` | `#1E3A8A` header, white text, `3px 3px 0 #0F172A` shadow | Shows elapsed time, live UGX total, order status |
| `BILL_REQUESTED` | 2px `#D97706` border + 1.2s pulse loop | Badge â€œBILL REQUESTEDâ€; opens settlement panel |
| `NEEDS_CLEARING` | Diagonal 45Â° hash pattern in `#CBD5E1` / `#FFFFFF` | Badge â€œCLEARINGâ€; busser marks clean |

**Rules**

- Grid: 4 columns at â‰¥768px, 2 columns below 768px. Tile height â‰¥112px.
- `VACANT` is intentionally not green: green is reserved for `READY`/bump semantics. The dashed slate border communicates â€œopen slotâ€ without competing with status colour.
- `T-04` is the `restaurant_tables.table_label` value. Seed main-floor tables as `T-01`â€¦`T-12` and balcony tables as `B-01`â€¦`B-04`; do not mix `Table 4`, `T-04`, and `#4` in the same UI.
- Menu selection tiles: **56Ã—56px** minimum. Quantity steppers: 48px.
- Primary action strip uses Cobalt `#1E3A8A`; table-select secondary uses Tactical Pine `#0F766E`.
- Press feedback: `translate-y-0.5` + shadow collapse. No hover-dependent actions.
- Never show kitchen bump controls or recipe/BOM data on the FOH surface.
- Settlement panel: one order total with a single carrier choice (cash, manual MoMo, or a MoMo/Airtel STK prompt). The entered amount must equal the order total before â€œClose Tableâ€ enables. Split checks, split tender, and table transfers are deferred to Phase 2.

**Delivery dispatch queue (`/pos/dispatch`)**

The dispatch queue is a FOH tab, not a fifth role. The active queue lists only `PHONE_DELIVERY` orders that are `READY` with no handoff row, plus orders whose handoff is still `PENDING`, which display as **ON THE WAY**; newest first. Failed handoffs move to a separate manager review lane (`state=review`).

```text
+--------------------------------------------------------+
|  READY Â· TOKEN-042                    WAITING 02:14   |
|  DESTINATION: YMCA MAIN CAMPUS                         |
|  ROOM/NOTE: BLOCK C, ROOM 204 - CALL AT SECURITY GATE  |
|  Dr. Okello - 0701 234 567                             |
|  [ CALL ]   [ WHATSAPP ]   [ PRINT CHIT ]              |
|  GPS: +/-18 m  [ OPEN PIN ]                            |
|  [ HANDED TO RIDER ]                                   |
+--------------------------------------------------------+
```

- Card uses the FOH white card, 2px ink border, `3px 3px 0 #0F172A` shadow, and a purple `PHONE_DELIVERY` channel strip.
- **CALL** and **WHATSAPP** are 56px buttons. `tel:+2567XXXXXXXX` and `https://wa.me/2567XXXXXXXX?text=...`; no WhatsApp Business API and no embedded map.
- **OPEN PIN** opens the static Google Maps link in a new tab. It is a text link/button, not a map tile.
- **PRINT CHIT** re-fires the ESC/POS job. Every reprint is audit-logged.
- **HANDED TO RIDER** opens a compact modal: rider name (required), rider phone (optional), dispatch method (`CALL` / `WHATSAPP` / `COUNTER_HANDOFF`), rider transport advance in UGX (optional, default `0`), optional note. Confirm is 56px. If an advance is entered, show the delivery fee minus the advance as **Delivery contribution** before confirming; negative values are allowed and displayed in red.
- The queue must show the room/office note and phone because the rider needs them. It must **not** show prices, BOM data, or kitchen preparation details.
- The queue refreshes over the existing WebSocket connection. If the socket drops, show a visible â€œReconnecting â€” use CALL from the last known cardâ€ banner; do not silently stale the list.
- No live rider marker, route line, or map panel in Phase 1.

### 4.3 Kitchen KDS â€” Heavy-Duty Station Ticket

The KDS is a machine interface. It must survive grease, water spray, palm bumps, and 3-metre viewing distance.

```text
+===================================================+
| T-04  [ DINE-IN ]                 04:12  [STN 2]  |
+===================================================+
| [ ] 2x FRIED CHICKEN & CHIPS                      |
|     >>> NOTE: EXTRA HOT CHILLI                    |
| [ ] 1x SAUSAGE ROLL (SPLIT)                       |
+===================================================+
|                                                   |
|      [   BUMP TICKET  (SPACE / ENTER)   ]         |
|                                                   |
+===================================================+
```

**Specification**

- Card: `#0F172A`, 2px `#1E293B` border, zero radius, no blur shadow.
- Identity: dine-in tickets show the table code (`T-04`); takeaway/delivery tickets show the canonical token (`TOKEN-042`). Delivery tickets also show the destination zone as a short line (e.g. `YMCA MAIN CAMPUS`) so Expo can label the bag. Never invent a separate kitchen order number.
- Channel strip: 8px solid left border â€” Cobalt `#2563EB` (`DINE_IN`), Amber `#D97706` (`TAKEAWAY_PICKUP`), Purple `#7C3AED` (`PHONE_DELIVERY`).
- Header colour by elapsed time: `<5 min` slate `#334155`; `5â€“10 min` signal amber `#D97706`; `>10 min` hazard crimson `#DC2626`.
- Bump button: **68px tall**, full card width, `#059669` fill, `#050811` text, bevel `0 5px 0 #022C22`. Press: `translateY(4px)`, shadow collapses to `0 1px 0 #000`.
- Warning/hold button: `#D97706` fill, `#050811` text, bevel `0 5px 0 #451A03`.
- Line items: 19px display font; tap toggles strike-through + 1,800Hz tick; `aria-pressed` reflects state. Keep the line-item toggles at least 24px away from the bump button to prevent palm mis-taps.
- Modifier flags: `#FDE047` background, `#000000` text, 14px Mono 700, prefixed with `>>> NOTE:`.
- **No prices, no order totals, no customer names, no phone numbers, no room notes, no GPS coordinates.** The kitchen sees item, quantity, modifier, elapsed time, channel, station, token, table (dine-in), and destination zone (delivery) only. Personal delivery data belongs on the FOH dispatch queue and the printed chit.
- Filter bar: sticky, 52px buttons, exclusive toggle for `ALL / DINE-IN / TAKEAWAY / DELIVERY`, live counts.
- 86 control: 56px, crimson outline, requires a second confirmation tap. It must never sit beside the bump button.
- Overdue treatment: static crimson border + icon under `prefers-reduced-motion`; otherwise a 1.2s pulse, not a strobe.

### 4.4 Manager / Admin â€” Executive Ledger

The admin surface is a financial instrument, not a dashboard of rounded cards. It uses hairline panels, dense rows, right-aligned Mono numbers, and restrained brass actions.

**Ledger table**

- Row height: 36â€“40px. Sticky header. 1px `#1F2937` dividers. No zebra striping, no glassmorphism, no 20px blur shadows.
- All UGX values: Mono 14â€“17px, tabular-nums, right-aligned, `UGX 2,744,000`.
- Variance: zero is neutral; positive uses Pine `#10B981` + `â†‘`; negative uses Light Crimson `#F87171` + `â†“`. Never rely on colour alone.
- Row hover: `#172033` background + 2px brass left rule. No lift, no scale, no shadow.
- Selection: 1px `#C8A96A` inset outline, not a blue checkbox default.

**Actions**

- Primary commit: Brass `#C8A96A`, `#0B0F17` text, 2px radius, 40px height, no shadow. Hover `#D9BC80`; active `#8C6D2F` + white text.
- Secondary/threshold override: Pine `#047857`, white text, 1px `#10B981` border. Hover `#065F46`; active `#064E3B`.
- Destructive void: brass outline with Light Crimson `#F87171` text; requires manager phone + PIN approval and writes to the append-only audit log. A signed-in manager may approve with their own session. No separate shared override PIN and no one-click red delete button.
- Multi-outlet switch: segmented control with a 2px brass underline. Do not use a generic dropdown for the primary outlet context.
- Audit trail: every void, comp, price change, and stock adjustment shows actor, timestamp, before/after values, and reason. No â€œdeleteâ€ affordance exists in the UI.
- Shift close: the â€œClose Shiftâ€ action stays disabled until physical cash count is entered and the variance is acknowledged.

---

## 5. Interaction, Motion & Accessibility

### 5.1 Hover, Press, Focus

- **Hover only on fine pointers.** Enable Tailwindâ€™s `hoverOnlyWhenSupported` future flag or wrap hover rules in `@media (hover: hover) and (pointer: fine)`. Touch devices must not get sticky hover states.
- **Press is mandatory.** Every actionable control has a visible `:active` state. On touch, `:active` is the primary feedback.
- **Focus is not optional.** `:focus-visible` uses a 2px role focus ring with a 2px offset. Never remove the outline without a replacement.
- **No `transition-all`.** Transition only `background-color`, `border-color`, `box-shadow`, `transform`, and `opacity` at 120â€“180ms.
- **No hover-only reveal.** Table actions, row actions, and bill controls must be reachable on touch.

### 5.2 Touch Targets

| Component | Minimum |
| :--- | :--- |
| KDS bump button | **68px** height, full card width |
| KDS filter buttons | **52px** height |
| FOH menu tiles | **56Ã—56px** |
| Delivery zone select / note field | **56px** height |
| GPS pin / Clear pin controls | **48px** height |
| FOH CALL / WHATSAPP buttons | **56px** height |
| Handoff confirm | **56px** height, full width |
| Token verification button | **48px** height |
| Pay Now / Retry Push | **56px** height, full width |
| General controls | **48Ã—48px** |

### 5.3 Motion Safety

- Overdue and bill-requested pulses: maximum one cycle every 1.2s; never more than 3 flashes per second.
- Under `prefers-reduced-motion: reduce`, replace pulses with a static border, icon, and text label.
- The KDS ready flash is one transition, not a loop.
- Vibration: feature-detect `navigator.vibrate`; never assume iOS Safari support. Provide a visible status change as the fallback.
- Do not animate layout properties (`width`, `height`, `top`, `left`) for press feedback. Use `transform` and `box-shadow`.

### 5.4 Colour & Semantics

- Status is always icon + text + colour.
- Role accent colour never overrides a status colour. A brass admin button must not sit inside a `PREPARING` badge.
- Do not use red for non-destructive admin actions. Red is reserved for `OVERDUE`, `FAILED`, `CANCELLED`, and destructive confirmation.
- Do not use green for â€œgoâ€ on the KDS unless it means `READY` or `BUMP`. The KDS phosphor green is an action colour, not a success decoration.

### 5.5 Keyboard & Screen Reader

- KDS: `Space` / `Enter` bumps the focused ticket; `Tab` moves between line items and the bump control; visible focus ring at 3m.
- FOH table grid: arrow-key navigation between tiles; `Enter` opens the table; `Escape` closes the panel.
- Token screen: `role="status"` + `aria-live="polite"` on the status line; the token number has an accessible label â€œPickup token 042â€.
- Admin tables: semantic `<table>` with `<th scope="col">`; sortable headers expose `aria-sort`.
- Delivery zone select: real `<label for>`, `<optgroup>` labels, `aria-describedby` for fee/ETA/error text. Do not use a div-based dropdown.
- GPS button: user-initiated only; announce `Requesting pin`, `Pin captured with Â±18 m accuracy`, and `No pin added` through a polite live region. Denial is a neutral state, not an error.
- Dispatch queue: CALL and WHATSAPP buttons have visible text labels and `aria-label` including the recipient name. The phone number is rendered as text, not an image. The handoff modal traps focus and returns focus to the card on close.
- All icon-only controls require an `aria-label`. Decorative icons use `aria-hidden="true"`.

### 5.6 Local Environment

- Surfaces are matte. No glossy gradients, no glass panels, no translucent blur. These disappear under Ham Towers sunlight and kitchen glare.
- Test at 100% and 200% browser zoom; no clipped currency values or overlapping table tiles.
- Test the KDS from 3 metres in a bright room; the timer and channel strip must remain legible.
- Test FOH with wet or gloved hands; every primary action must be reachable with a thumb or palm heel.
- Self-host fonts and icons so the edge node still renders during a connectivity loss.

---

## 6. Tailored Audio & Acoustic Feedback

Kitchen environments at Ham Towers and YMCA have exhaust fans, sizzling oil, and street traffic. Audio is a safety cue, not decoration. It must be **armed by a user gesture** â€” browsers block autoplay, and a silent KDS is worse than a loud one.

```ts
// src/lib/audio-alerts.ts
// Zero external MP3 assets. Requires an explicit "Arm Sound" gesture.

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private armed = false;

  async arm(): Promise<void> {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.18;
      this.master.connect(this.ctx.destination);
    }
    await this.ctx.resume();
    this.armed = true;
  }

  disarm(): void {
    this.armed = false;
  }

  playNewOrderChime(): void {
    this.playTone(880, 0.10, 'sine');
    window.setTimeout(() => this.playTone(1320, 0.25, 'triangle'), 100);
  }

  playUrgentWarning(): void {
    this.playTone(440, 0.40, 'sawtooth');
  }

  playItemStrikeTick(): void {
    this.playTone(1800, 0.03, 'square');
  }

  private playTone(freq: number, duration: number, type: OscillatorType): void {
    if (!this.armed || !this.ctx || !this.master || document.hidden) return;
    if (this.ctx.state === 'suspended') void this.ctx.resume();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }
}
```

**Requirements**

- First KDS load shows a 68px **ARM SOUND** control. Do not attempt to play before it is pressed.
- Persist the preference per device in `localStorage`, but still require a tap after reload. If audio is suspended, show â€œSound paused â€” tap to armâ€ instead of failing silently.
- Provide a visible mute control. The kitchen must be able to silence the room without navigating away.
- New order: dual chime A5 â†’ E6. Overdue: low 440Hz warning, repeated no more than every 10 seconds. Line strike: 30ms tick.
- Cap master gain at 0.18â€“0.20 and keep the tones short. Do not stack more than two simultaneous voices.
- Pause audio when the document is hidden; resume only after the next user interaction.

---

## 7. Implementation Contract

### 7.1 Role-Scoped CSS Variables

Set `data-role` on the authenticated layout wrapper, never on individual buttons. The role comes from the server session, not a client-supplied query parameter.

| `data-role` | RBAC enum |
| :--- | :--- |
| `customer` | `CUSTOMER` |
| `foh` | `WAITER_FOH` |
| `kds` | `KITCHEN_STAFF` |
| `admin` | `MANAGER_ADMIN` |

```css
/* src/app/globals.css */
[data-role='customer'] {
  --role-surface: #faf8f5;
  --role-card: #ffffff;
  --role-border: #e7e2d9;
  --role-ink: #1c1917;
  --role-muted: #57534e;
  --role-primary: #c2410c;
  --role-primary-hover: #9a3412;
  --role-primary-active: #7c2d12;
  --role-on-primary: #ffffff;
  --role-on-primary-active: #ffffff;
  --role-secondary: #d97706;
  --role-secondary-hover: #f59e0b;
  --role-secondary-active: #b45309;
  --role-secondary-border: #b45309;
  --role-on-secondary: #1c1917;
  --role-on-secondary-active: #ffffff;
  --role-disabled: #e2ddd5;
  --role-on-disabled: #57534e;
  --role-focus: #9a3412;
  --role-radius: 9999px;
  --role-shadow: 0 4px 14px rgb(194 65 12 / 0.22);
  --role-shadow-active: 0 1px 0 rgb(124 45 18 / 0.5);
}

[data-role='foh'] {
  --role-surface: #f1f5f9;
  --role-card: #ffffff;
  --role-border: #0f172a;
  --role-ink: #0f172a;
  --role-muted: #475569;
  --role-primary: #1e3a8a;
  --role-primary-hover: #172554;
  --role-primary-active: #0f172a;
  --role-on-primary: #ffffff;
  --role-on-primary-active: #ffffff;
  --role-secondary: #0f766e;
  --role-secondary-hover: #115e59;
  --role-secondary-active: #042f2e;
  --role-on-secondary: #ffffff;
  --role-on-secondary-active: #ffffff;
  --role-disabled: #94a3b8;
  --role-on-disabled: #1e293b;
  --role-focus: #2563eb;
  --role-radius: 6px;
  --role-shadow: 2px 2px 0 #0f172a;
  --role-shadow-active: 0 0 0 #0f172a;
}

[data-role='kds'] {
  --role-surface: #050811;
  --role-card: #0f172a;
  --role-border: #1e293b;
  --role-ink: #f8fafc;
  --role-muted: #94a3b8;
  --role-primary: #059669;
  --role-primary-hover: #10b981;
  --role-primary-active: #022c22;
  --role-on-primary: #050811;
  --role-on-primary-active: #f8fafc;
  --role-secondary: #d97706;
  --role-secondary-hover: #f59e0b;
  --role-secondary-active: #451a03;
  --role-on-secondary: #050811;
  --role-on-secondary-active: #fffbeb;
  --role-disabled: #1e293b;
  --role-on-disabled: #64748b;
  --role-focus: #fde047;
  --role-radius: 0px;
  --role-shadow: 0 5px 0 #022c22;
  --role-secondary-shadow: 0 5px 0 #451a03;
  --role-shadow-active: 0 0 0 #022c22;
}

[data-role='admin'] {
  --role-surface: #0b0f17;
  --role-card: #111827;
  --role-border: #1f2937;
  --role-ink: #f8fafc;
  --role-muted: #94a3b8;
  --role-primary: #c8a96a;
  --role-primary-hover: #d9bc80;
  --role-primary-active: #8c6d2f;
  --role-on-primary: #0b0f17;
  --role-on-primary-active: #ffffff;
  --role-secondary: #047857;
  --role-secondary-hover: #065f46;
  --role-secondary-active: #064e3b;
  --role-on-secondary: #ffffff;
  --role-on-secondary-active: #ffffff;
  --role-disabled: #1f2937;
  --role-on-disabled: #6b7280;
  --role-focus: #fbbf24;
  --role-radius: 2px;
  --role-shadow: none;
  --role-shadow-active: none;
}
```

### 7.2 Tailwind Configuration

The project uses Tailwind CSS 3.4 (see `Repo_Scaffold_and_Config.md`). Add the role tokens and the tactile shadows to `tailwind.config.ts`.

> **Framework note:** All surfaces use the Next.js 14 client specified in `Repo_Scaffold_and_Config.md` and `Tech_Stack.md`. This visual contract is framework-agnostic; if a surface is ever split into a separate app, declare the same `data-role` CSS variables there and do not fork the palette.

```ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  future: { hoverOnlyWhenSupported: true },
  theme: {
    extend: {
      colors: {
        role: {
          surface: 'var(--role-surface)',
          card: 'var(--role-card)',
          border: 'var(--role-border)',
          ink: 'var(--role-ink)',
          muted: 'var(--role-muted)',
          primary: 'var(--role-primary)',
          'primary-hover': 'var(--role-primary-hover)',
          'primary-active': 'var(--role-primary-active)',
          'on-primary': 'var(--role-on-primary)',
          'on-primary-active': 'var(--role-on-primary-active)',
          secondary: 'var(--role-secondary)',
          'secondary-hover': 'var(--role-secondary-hover)',
          'secondary-active': 'var(--role-secondary-active)',
          'secondary-border': 'var(--role-secondary-border)',
          'on-secondary': 'var(--role-on-secondary)',
          'on-secondary-active': 'var(--role-on-secondary-active)',
          disabled: 'var(--role-disabled)',
          'on-disabled': 'var(--role-on-disabled)',
        },
        status: {
          awaitingPayment: '#475569',
          pending: '#64748b',
          preparing: '#d97706',
          ready: '#047857',
          overdue: '#dc2626',
          completed: '#334155',
          cancelled: '#7f1d1d',
          refundPending: '#b45309',
        },
        channel: {
          dinein: '#2563eb',
          takeaway: '#d97706',
          delivery: '#7c3aed',
        },
        customer: {
          cream: '#faf8f5',
          ink: '#1c1917',
          chili: '#c2410c',
          ochre: '#d97706',
        },
        foh: {
          slate: '#f1f5f9',
          cobalt: '#1e3a8a',
          pine: '#0f766e',
          ink: '#0f172a',
        },
        kds: {
          carbon: '#050811',
          steel: '#0f172a',
          phosphor: '#059669',
          amber: '#d97706',
          crimson: '#dc2626',
          flag: '#fde047',
        },
        admin: {
          obsidian: '#0b0f17',
          quartz: '#111827',
          brass: '#c8a96a',
          pine: '#047857',
        },
      },
      borderRadius: {
        role: 'var(--role-radius)',
      },
      boxShadow: {
        role: 'var(--role-shadow)',
        'role-active': 'var(--role-shadow-active)',
        'ink-flat': '2px 2px 0 #0f172a',
        'ink-deep': '4px 4px 0 #0f172a',
        'kds-bump': '0 5px 0 #022c22',
        'kds-warn': '0 5px 0 #451a03',
      },
      fontFamily: {
        display: ['var(--font-display)', 'Plus Jakarta Sans', 'Inter', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'Consolas', 'monospace'],
      },
      spacing: {
        'touch-sm': '48px',
        'touch-md': '56px',
        'touch-lg': '68px',
      },
      keyframes: {
        'ready-arrive': {
          '0%': { opacity: '0.4', transform: 'scale(0.98)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'bill-pulse': {
          '0%, 100%': { borderColor: '#d97706' },
          '50%': { borderColor: '#f59e0b' },
        },
        'overdue-pulse': {
          '0%, 100%': { borderColor: '#dc2626' },
          '50%': { borderColor: '#7f1d1d' },
        },
      },
      animation: {
        'ready-arrive': 'ready-arrive 220ms ease-out 1',
        'bill-pulse': 'bill-pulse 1.2s ease-in-out infinite',
        'overdue-pulse': 'overdue-pulse 1.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
```

### 7.3 Button Recipes (Do Not Collapse Into One Skin)

```tsx
// Customer â€” pill, warm lift, physical scale
<button className="h-14 rounded-role bg-role-primary px-6 font-display text-base font-bold text-role-on-primary shadow-role transition-[background-color,transform,box-shadow] duration-150 hover:bg-role-primary-hover active:translate-y-px active:scale-[0.97] active:bg-role-primary-active active:shadow-role-active">
  Pay UGX 14,000
</button>

// FOH â€” hard border, ink offset, mechanical snap
<button className="h-14 rounded-role border-2 border-role-border bg-role-primary px-5 font-display text-sm font-extrabold uppercase tracking-wide text-role-on-primary shadow-role transition-[background-color,transform,box-shadow] duration-100 hover:bg-role-primary-hover active:translate-y-0.5 active:bg-role-primary-active active:shadow-role-active">
  Fire Ticket
</button>

// KDS â€” zero radius, 68px slab, bevel collapse
<button className="h-touch-lg w-full rounded-role border-t-2 border-role-border bg-role-primary font-display text-lg font-extrabold uppercase tracking-[0.08em] text-role-on-primary shadow-role transition-[background-color,transform,box-shadow] duration-100 hover:bg-role-primary-hover active:translate-y-1 active:bg-role-primary-active active:text-role-on-primary-active active:shadow-role-active">
  Bump Ticket
</button>

// Admin â€” 40px ledger action, 2px radius, no shadow, colour step only
<button className="h-10 rounded-role border border-role-border bg-role-primary px-4 font-display text-sm font-bold text-role-on-primary transition-colors duration-150 hover:bg-role-primary-hover active:bg-role-primary-active active:text-role-on-primary-active">
  Commit Audit
</button>
```

### 7.4 Implementation Rules

- **No raw hex in components.** All role colours come from `--role-*`; semantic statuses come from the `status` / `channel` token maps.
- **No shared `btn-primary`.** Create `CustomerButton`, `FireTicketButton`, `BumpButton`, and `LedgerButton`, or one primitive with four explicitly separated variants. A single class string reused across roles is a defect.
- **No `transition-all`.** Use the property list shown above.
- **No `hover:` without a pointer guard.** Tailwindâ€™s `hoverOnlyWhenSupported` flag is mandatory.
- **No client-side role switching.** `data-role` is rendered from the server session; route guards and API middleware remain the security boundary.
- **No role colour leaking into charts.** Admin charts use status/channel semantics plus a neutral grid; brass is reserved for actions.
- **No generic illustrations.** Use real food photography and real station names (Steam, Fryer, Rolex, Expo), not abstract SVG blobs.

---

## 8. Operational DOs and DON'Ts (Anti-Slop Protocol)

### 8.1 Role Identity & Colour

| âœ… DO | âŒ DON'T |
| :--- | :--- |
| Give every role its own `--role-primary`, `--role-primary-hover`, `--role-primary-active`, and `--role-on-primary`. | Reuse one `primary` colour across Customer, FOH, KDS, and Admin. |
| Change hue **and** geometry **and** depth per role: pill + warm lift, 6px + ink offset, 0px + bevel, 2px + flat. | Ship four recoloured copies of the same rounded pill button. |
| Use Chili for customer commitment, Cobalt for firing tickets, Phosphor for bumping, Brass for committing audits. | Use the same blue button for â€œPayâ€, â€œFireâ€, â€œBumpâ€, and â€œApproveâ€. |
| Keep status/channel/payment colours global and consistent. | Recolour `PREPARING` amber on one screen because it clashes with the role palette. |
| Use dark ink on bright phosphor/brass fills. | Put white text on `#10B981` (2.54:1), `#059669` (3.77:1), or `#D97706` (3.19:1). |
| Use brass `#C8A96A` for admin actions so they never read as a kitchen amber status. | Use `#D97706` for both `PREPARING` and the admin â€œApproveâ€ button. |

### 8.2 Depth, Shape & Motion

| âœ… DO | âŒ DON'T |
| :--- | :--- |
| Use hard physical shadows on FOH and KDS: `2px 2px 0 #0F172A`, `0 5px 0 #022C22`. | Use soft, blurry SaaS shadows such as `0 20px 25px rgba(0,0,0,0.05)`. |
| Make the press visible: scale, snap, or sink with shadow collapse. | Change only the hover colour and leave the press state identical to rest. |
| Use zero radius and flat steel on KDS. | Put 16px rounded cards and floating glass panels on a kitchen screen. |
| Use hairline panels and dense rows on Admin. | Give every admin KPI a giant rounded card with a gradient icon tile. |
| Respect `prefers-reduced-motion` and cap pulses at 1.2s. | Strobe overdue tickets or loop the ready flash indefinitely. |
| Put hover behind `(hover: hover) and (pointer: fine)`. | Rely on hover to reveal actions on a waiterâ€™s touch handheld. |

### 8.3 Kitchen & FOH Ergonomics

| âœ… DO | âŒ DON'T |
| :--- | :--- |
| Make the KDS bump button **68px** tall and full ticket width. | Use 16px checkboxes, tiny icon buttons, or a three-dot menu on the KDS. |
| Separate line-item toggles from the bump button by at least 24px. | Place â€œbumpâ€ and â€œ86â€ next to each other where a palm can hit the wrong one. |
| Use `#FDE047` flags with black text for â€œNO ONIONSâ€ / â€œEXTRA CHILLIâ€. | Render special instructions in faint italic gray beneath the item. |
| Use 56Ã—56px FOH menu tiles and 48px steppers. | Use desktop-sized 32px controls on a 6.5" handheld. |
| Keep the KDS free of prices, totals, and customer phone numbers. | Show order value on the kitchen ticket and invite ticket bias. |
| Give the waiter a table grid with explicit status labels and one-tap claim. | Make the waiter drill through a generic list view to find a table. |
| Capture delivery as zone + exact room/office/gate note + callable phone. | Use a free-text â€œaddressâ€ box or a â€œnear campusâ€ note. |
| Make the GPS pin optional, user-initiated, and one-shot. | Auto-request location on page load or block payment when permission is denied. |
| Give FOH large CALL and WHATSAPP buttons plus a printable chit. | Embed a live map, rider marker, or route line in the Phase 1 dispatch screen. |
| Keep room notes, phone numbers, and GPS coordinates on the FOH/chit only. | Print customer personal data on the KDS. |

### 8.4 Data, Currency & Localisation

| âœ… DO | âŒ DON'T |
| :--- | :--- |
| Format every amount as `UGX 14,000` with comma grouping. | Show `UGX 14,000.00`, `$14,000`, or `14,000/=`. |
| Use JetBrains Mono + `tabular-nums` for all prices, tokens, timers, and counters. | Use a proportional font for counters that causes the layout to jump. |
| Let dish names wrap to two lines. | Truncate with ellipsis: `Fried Chicken & Ch...`. |
| Show binary `AVAILABLE` / `SOLD OUT (86)` to customers. | Expose raw oil litres, supplier costs, or BOM quantities to customers. |
| Use `TOKEN-042` as the canonical API value and `#042` as the large visual token. | Mix `TOKEN-042`, `#042`, and a separate kitchen order number without a documented mapping. |
| Use the outlet name and station name in the UI. | Use â€œStore 1â€, â€œLocation Aâ€, or generic placeholder copy. |
| Show the server-computed delivery fee and include it in the total before payment. | Hide the delivery fee until after payment or let the client edit it. |
| Say â€œUGX 0 in map API feesâ€ when describing the zone model. | Claim the entire delivery operation is free; SMS, printing, airtime, and staff time still cost money. |
| Use a static Google Maps link only when the customer/FOH taps it. | Load Google Maps JavaScript, Places, Directions, or Geocoding APIs at checkout. |

### 8.5 Accessibility & Implementation

| âœ… DO | âŒ DON'T |
| :--- | :--- |
| Keep body text at 4.5:1 and large text at 3:1. | Use `#94A3B8` body text on a white card. |
| Add icon + text to every status badge. | Use colour alone to distinguish `PREPARING` from `READY`. |
| Add `aria-live` to token and order status changes. | Rely on a visual flash as the only â€œreadyâ€ signal. |
| Self-host fonts and icons for offline edge operation. | Depend on a runtime Google Fonts request during a fiber cut. |
| Arm Web Audio with an explicit 68px control. | Call `new AudioContext()` and play on page load; browsers will block it. |
| Use semantic `<button>`, `<table>`, and `<th scope="col">`. | Build buttons out of `<div onClick>` and tables out of CSS grid. |
| Test at 200% zoom and 3m KDS distance. | Approve a design only on a 27" desktop monitor at 100%. |

### 8.6 Reject Criteria

Reject the screen if any of these are true:

1. The same button radius, shadow, and hover treatment appears on more than one role.
2. The KDS contains a UGX value.
3. The FOH screen depends on hover to reveal an action.
4. The admin screen uses a soft floating shadow or a gradient KPI card.
5. White text sits on `#10B981`, `#059669`, or `#D97706`.
6. A food name is truncated with an ellipsis.
7. A status is communicated by colour alone.
8. The page uses a stock â€œdashboardâ€ hero, abstract blob illustration, or generic icon tile.
9. The customer token card looks like a standard success card with a checkmark.
10. The role accent is changed in a component instead of the `data-role` token layer.
11. Delivery checkout embeds a live map or blocks payment when GPS is denied.
12. The KDS displays a customer phone number, room note, GPS coordinates, or delivery fee.

---

## 9. QA Acceptance Checklist

Run this checklist before any UI review or demo:

- [ ] All four role surfaces render with their own `data-role` token set.
- [ ] Customer primary is Chili; FOH is Cobalt; KDS is Phosphor; Admin is Brass.
- [ ] Hover, active, disabled, and focus-visible states exist for every interactive element.
- [ ] The KDS bump button is 68px tall and full ticket width.
- [ ] The customer token is 54px Mono and readable at 2m.
- [ ] FOH menu tiles are at least 56Ã—56px; general controls are at least 48Ã—48px.
- [ ] No white text on `#10B981`, `#059669`, or `#D97706`.
- [ ] Every status badge includes text and an icon.
- [ ] The KDS shows no prices, totals, or customer phone numbers.
- [ ] Every UGX value renders as `UGX 14,000` with tabular numerals.
- [ ] No food name is truncated with an ellipsis.
- [ ] No `transition-all`, no soft SaaS shadows, no generic gradient cards.
- [ ] Hover effects are disabled on coarse pointers; press states remain visible.
- [ ] `prefers-reduced-motion` removes pulses and strobes.
- [ ] Web Audio requires an explicit â€œArm Soundâ€ gesture and has a visible mute control.
- [ ] Fonts and icons load from the local bundle with the network offline.
- [ ] Admin actions write an audit entry and expose actor, timestamp, before/after, and reason.
- [ ] Shift close is blocked until the physical cash count is entered.
- [ ] Keyboard focus is visible on KDS, FOH, and Admin; the token status is announced by a screen reader.
- [ ] A delivery order can be completed with the GPS pin denied or unavailable.
- [ ] The zone select is a labelled 56px control, scoped to the selected outlet, with fee and ETA visible.
- [ ] The delivery fee shown at checkout matches the server-computed zone fee and is included in the payment total.
- [ ] No Google Maps SDK, embedded tiles, Places, Directions, or Geocoding request loads at checkout.
- [ ] The FOH dispatch queue exposes 56px CALL, WHATSAPP, PRINT CHIT, and HANDED TO RIDER actions.
- [ ] The KDS shows the delivery destination zone but no phone number, room note, or GPS coordinates.
- [ ] Playwright visual snapshots exist for Customer, FOH, KDS, and Admin at 360px, 768px, 1280px, and 1920px.

---

## 10. Related Specifications

| File | Scope |
| :--- | :--- |
| `Foundational_Concept.md` | Problem scope, four-role responsibility matrix, KPIs |
| `User_Flow.md` | Ticket lifecycle, table service, delivery handoff, surplus routine |
| `Delivery_Zones_and_Dispatch.md` | Zone/landmark checkout, optional GPS pin, dispatch queue, chit, privacy |
| `Payment_Integration.md` | MoMo/Airtel checkout states, delivery-fee inclusion, USSD fallback, reconciliation |
| `User_Profiles_Personas.md` | Brian K., Prossy N., Chef Juma, Zito Mbowe, rider actor |
| `Tech_Stack.md` | Fastify, PostgreSQL DDL, Redis pub/sub, delivery services, KDS event handler |
| `Repo_Scaffold_and_Config.md` | Directory tree, dependencies, environment variables |
| `Hardware_and_Peripherals.md` | ESC/POS printers, SMS gateway, power resilience |
| `Seed_Data_and_Testing.md` | Menu seed, BOM conversions, rush-hour simulation |
| `Demo_Script_and_Closing_Strategy.md` | Live demo flow and commercial proposal |


---

## 11. Viewport Adaptation, Responsive Breakpoint Grid & Component Snippets

### 11.1 Viewport Adaptation Matrix per Role Surface

| Surface | Target Devices | Primary Resolution | Layout Structure | Responsive Breakpoint Policy |
| :--- | :--- | :--- | :--- | :--- |
| **Customer PWA** (`/`, `/cart`, `/checkout`, `/token/*`) | Tecno Camon, Infinix, Samsung A-series, iPhones | 375px – 430px width (portrait) | Single-column fluid stack; sticky bottom checkout drawer (`z-50`); max container width `480px` centered on wider screens | Mobile-only lock; if opened on desktop, constrain to 480px centered card with neutral background |
| **Waiter / FOH POS** (`/pos`, `/pos/tables`, `/pos/dispatch`) | 6.5" Android handheld terminals, 8" counter tablets | 360px – 412px (handheld) / 800px (tablet) | 2-column table grid; 3-column menu tile grid; persistent bottom status strip; touch target floor `56px` | Adaptive 2-col handheld to 4-col tablet; zero horizontal scrolling |
| **Kitchen KDS HUD** (`/kds/steam`, `/kds/fryer`, `/kds/expo`) | 10"–15" wall-mounted touchscreen monitors | 1280×800 (16:10) / 1920×1080 (16:9) | 4-column horizontal ticket feed (1280px) or 5-column (1920px); top channel summary bar; bottom 68px bump button | Fixed landscape layout; auto-scales ticket column width (`minmax(280px, 320px)`); zero modal overlays |
| **Manager Admin Portal** (`/admin/*`) | 13"–16" Laptops, Desktop Monitors | 1280px – 2560px width | Collapsible 240px sidebar; dense metric stat cards; hairline ledger tables; dual-pane detail inspection drawer | Desktop-first; collapses sidebar to icon strip at `<1024px`; tables support horizontal scroll on narrow viewports |

---

### 11.2 Canonical `tailwind.config.ts` Role Architecture

```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        customer: {
          surface: '#FAF8F5',
          card: '#FFFFFF',
          primary: '#C2410C', // Chili
          hover: '#9A3412',
          active: '#7C2D12',
          ink: '#1C1917',
          border: '#E7E5E4',
        },
        foh: {
          surface: '#F1F5F9',
          card: '#FFFFFF',
          primary: '#1E3A8A', // Cobalt
          hover: '#172554',
          active: '#0F172A',
          ink: '#0F172A',
          border: '#CBD5E1',
        },
        kds: {
          surface: '#050811',
          card: '#0F172A',
          primary: '#059669', // Phosphor
          hover: '#10B981',
          active: '#022C22',
          ink: '#FFFFFF',
          border: '#1E293B',
        },
        admin: {
          surface: '#0B0F17',
          card: '#111827',
          primary: '#C8A96A', // Champagne Brass
          hover: '#D9BC80',
          active: '#8C6D2F',
          ink: '#F9FAFB',
          border: '#1F2937',
        },
        semantic: {
          pending: '#64748B',
          preparing: '#D97706',
          ready: '#047857',
          readyGlow: '#10B981',
          overdue: '#DC2626',
          completed: '#334155',
          channelDineIn: '#2563EB',
          channelTakeaway: '#D97706',
          channelDelivery: '#7C3AED',
        },
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        customer: '9999px',
        foh: '6px',
        kds: '0px',
        admin: '2px',
      },
      boxShadow: {
        'foh-offset': '2px 2px 0px #0F172A',
        'kds-bevel': '0px 5px 0px #022C22',
        'customer-lift': '0px 4px 12px rgba(194, 65, 12, 0.12)',
      },
    },
  },
  plugins: [],
};

export default config;
```

---

### 11.3 Production CSS Tactile Button Classes (`globals.css`)

```css
@layer components {
  /* Customer Pill Button: Soft warm lift & scale press */
  .btn-customer-chili {
    @apply h-12 px-6 rounded-customer bg-customer-primary text-white font-semibold text-base
           shadow-customer-lift transition-transform duration-100 ease-out active:scale-95;
  }

  /* Waiter Tactical Button: Crisp 6px radius & hard ink offset snap */
  .btn-foh-cobalt {
    @apply h-14 min-w-[56px] px-4 rounded-foh bg-foh-primary text-white font-medium text-sm
           shadow-foh-offset transition-all duration-75 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none;
  }

  /* KDS Machinery HUD Bump: Zero radius, 5px bevel collapse */
  .btn-kds-bump {
    @apply h-[68px] w-full rounded-none bg-kds-primary text-kds-surface font-mono font-bold text-lg tracking-wider
           shadow-kds-bevel transition-all duration-75 active:translate-y-[4px] active:shadow-none;
  }

  /* Admin Executive Action: Precision 2px hairline, flat background shift */
  .btn-admin-brass {
    @apply h-10 px-4 rounded-admin bg-admin-primary text-admin-surface font-sans font-semibold text-xs uppercase tracking-wider
           border border-admin-primary/40 hover:bg-admin-hover active:bg-admin-active transition-colors duration-100;
  }
}
```

---

### 11.4 Automated Visual Snapshot & Contrast Testing Specification

To guarantee zero regression across screens, the automated testing harness incorporates Playwright visual snapshot tests:

```typescript
// tests/e2e/visual-regression.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Role Surface Tactile Visual Integrity', () => {
  test('Customer PWA renders warm street craft identity', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 }); // iPhone 12/13/14
    await page.goto('/');
    await expect(page).toHaveScreenshot('customer-pwa-home.png', { maxDiffPixelRatio: 0.02 });
  });

  test('Waiter POS renders high-contrast table grid on handheld', async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 915 }); // Pixel 7
    await page.goto('/pos/tables');
    await expect(page).toHaveScreenshot('foh-tables-grid.png', { maxDiffPixelRatio: 0.02 });
  });

  test('Kitchen KDS HUD bump buttons meet 68px requirement', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 }); // 10" Tablet Landscape
    await page.goto('/kds/fryer');
    const bumpBtn = page.locator('.btn-kds-bump').first();
    const box = await bumpBtn.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(68);
    await expect(page).toHaveScreenshot('kds-fryer-hud.png', { maxDiffPixelRatio: 0.02 });
  });

  test('Admin Executive Portal maintains obsidian brass palette', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin/dashboard');
    await expect(page).toHaveScreenshot('admin-ledger-dashboard.png', { maxDiffPixelRatio: 0.02 });
  });
});
```
