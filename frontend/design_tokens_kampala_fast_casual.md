---
name: Kampala Fast-Casual PWA
colors:
  surface: '#f9f9ff'
  surface-dim: '#d3daef'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f1f3ff'
  surface-container: '#e9edff'
  surface-container-high: '#e1e8fd'
  surface-container-highest: '#dce2f7'
  on-surface: '#141b2b'
  on-surface-variant: '#5c403c'
  inverse-surface: '#293040'
  inverse-on-surface: '#edf0ff'
  outline: '#916f6b'
  outline-variant: '#e6bdb8'
  surface-tint: '#bf0715'
  primary: '#b70011'
  on-primary: '#ffffff'
  primary-container: '#dc2626'
  on-primary-container: '#fff6f5'
  inverse-primary: '#ffb4ab'
  secondary: '#855300'
  on-secondary: '#ffffff'
  secondary-container: '#fea619'
  on-secondary-container: '#684000'
  tertiary: '#00682b'
  on-tertiary: '#ffffff'
  tertiary-container: '#008438'
  on-tertiary-container: '#e7ffe4'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdad6'
  primary-fixed-dim: '#ffb4ab'
  on-primary-fixed: '#410002'
  on-primary-fixed-variant: '#93000b'
  secondary-fixed: '#ffddb8'
  secondary-fixed-dim: '#ffb95f'
  on-secondary-fixed: '#2a1700'
  on-secondary-fixed-variant: '#653e00'
  tertiary-fixed: '#7ffc97'
  tertiary-fixed-dim: '#62df7d'
  on-tertiary-fixed: '#002109'
  on-tertiary-fixed-variant: '#005320'
  background: '#f9f9ff'
  on-background: '#141b2b'
  surface-variant: '#dce2f7'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '800'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '800'
    lineHeight: 34px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 26px
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '700'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.03em
  currency-display:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '800'
    lineHeight: 28px
    letterSpacing: -0.01em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-sm: 0.75rem
  margin: 1rem
  margin-sm: 0.75rem
  margin-lg: 1.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style
This design system captures the dynamic, bustling energy of Kampala's fast-casual food corridors—specifically targeting the high-density student and professional hubs around Makerere University, Wandegeya, and Ham Towers. The interface blends contemporary African urban optimism with lightning-fast transactional efficiency, eliminating ordering friction during peak lunch and dinner surges.

The design philosophy adopts a tactile, high-contrast modernism optimized for Progressive Web Apps running on varying mobile hardware and unstable networks. Surfaces prioritize tangible touch response, rich visual warmth, appetizing clarity, and zero-ambiguity order states. 

Key attributes:
- **Tone:** Inviting, hungry, rapid, authentic, and hyper-reliable.
- **Physicality:** Solid color blocks, rounded tactile pill buttons, crisp divider lines, and rich surface contrasts that perform well even in direct sunlight outdoors.
- **Contextual Signals:** Prominent digital queue tokens, unambiguous takeaway/dine-in status indicators, and localized visual trust cues built around Ugandan Mobile Money (MTN MoMo & Airtel Money) workflows.

## Colors
The palette balances appetizing warmth, energetic urban accents, and institutional payment familiarity against a softened canvas:

- **Primary (`#DC2626` - Spicy Terracotta Red):** Represents heat, appetizing urgency, primary calls-to-action (e.g., "Add to Tray", "Order Now"), and essential badges.
- **Secondary (`#F59E0B` - Warm Saffron Amber):** Conveys street-food warmth, freshly roasted spices, secondary CTA states, queue tracking, and warning badges.
- **Tertiary (`#16A34A` - Crisp Forest Green):** Reserved for positive transactional clarity: order ready states, instant kitchen receipt verification, and trusted local mobile telecom payment gateways (MTN MoMo and Airtel Money checkouts).
- **Neutral (`#111827` - Rich Charcoal):** Provides deep, accessible contrast for typography, prominent container frames, and dark tactile action pills.
- **Canvas (`#FAF9F6` - Warm Cream Background):** A soothing, non-glare off-white surface that keeps the interface organic, appetizing, and comfortably readable across sunny street conditions.

### Supporting Semantic States
- **Canvas Base:** `#FAF9F6`
- **Surface Elevated:** `#FFFFFF`
- **Surface Muted / Pressed:** `#F3F0E6`
- **Border Default:** `#E5E0D8`
- **Text On Primary/Neutral:** `#FFFFFF`
- **Text Subdued:** `#6B7280`

## Typography
Plus Jakarta Sans is used universally across display, body, and label roles. Its geometric roundness, wide apertures, and clean vertical metrics preserve instant readability for fast ordering in bustling environments.

### Currency Formatting Rules
Local Ugandan currency strings must strictly follow the format: `UGX 15,000` with the code prefix uppercase, a non-breaking space, followed by comma-separated grouping. In compact menu tags, the prefix uses `label-sm` weight while the amount uses `label-lg` or `currency-display` weight for clear billing visibility.

## Layout & Spacing
The layout follows a mobile-first, fluid 4-column grid engineered for handheld single-thumb operation, adapting to a max-width container on larger screens (max 480px width for standard PWA viewport containment).

- **Mobile Viewport (< 640px):** 4 columns, `gutter-sm` (12px), `margin` (16px outer safety gutter).
- **Tablet / Large Mobile Viewport (640px - 1024px):** Centers into a fixed mobile-frame width of 480px with backdrop scrim or expands to an 8-column layout with 16px gutters for iPad kiosk ordering stations.
- **Bottom Navigation Safe Zone:** Fixed bottom checkout trays and floating cart summaries enforce an 80px safe clearance margin from the screen floor to account for mobile navigation bars and gesture pill indicators.

## Elevation & Depth
Depth relies on crisp surface layering and tactile ambient shadows rather than harsh skeuomorphic bevels:

- **Level 0 (Floor):** Canvas background `#FAF9F6`.
- **Level 1 (Cards & Rows):** `#FFFFFF` surfaces with a 1px border (`#E5E0D8`) and a warm ambient drop: `0px 2px 6px -1px rgba(17, 24, 39, 0.04)`.
- **Level 2 (Active Cards & Floating Bar):** Elevated tray counters and order status modules: `0px 8px 18px -3px rgba(17, 24, 39, 0.08)`, complemented by a 1px border (`#E5E0D8`).
- **Level 3 (Modals & Sheet Drawers):** Bottom drawer overlays and digital queue vouchers: `0px 16px 32px -4px rgba(17, 24, 39, 0.16)`.
- **Tactile Pressed State:** Interactive elements eliminate upward shadows upon `:active`, dropping downward by 1px with a tinted surface overlay (`rgba(17, 24, 39, 0.05)`), producing a physical click sensation.

## Shapes
A roundedness tier of 2 provides friendly, approachable ergonomics without feeling cartoonish:
- **Base Components:** Radius of `0.5rem` (8px) for input fields, order detail rows, and payment selection containers.
- **Cards & Modals:** Radius of `1rem` (16px) for item cards, restaurant header banners, and queue sheets.
- **Pill Accents:** Fully rounded (9999px) for primary action triggers, zone selection chips, count badges, and digital queue tokens.

## Components

### Buttons
- **Primary Action (CTA):** Height 48px minimum (48px - 56px touch target). Background `#DC2626`, text `#FFFFFF`, bold `label-lg`, fully rounded pill. Active state deepens to `#B91C1C`.
- **MoMo Payment Action:** Background `#16A34A`, text `#FFFFFF`, bold `label-lg`. Accompanied by telecom brand icons (MTN yellow tag or Airtel red dot).
- **Secondary / Stepper Button:** Height 36px, background `#F3F0E6`, text `#111827`, border 1px `#E5E0D8`. Active state deepens to `#E5E0D8`.

### Chips & Zone Selectors
- **Branch / Zone Filter (e.g., "Ham Towers", "Wandegeya / Makerere"):** 36px height, pill shape.
  - *Inactive:* Background `#FFFFFF`, border 1px `#E5E0D8`, text `#111827` (`label-md`).
  - *Active:* Background `#111827`, border 1px `#111827`, text `#FFFFFF`, bold font.
- **Fulfillment Switcher:** Segmented control toggling "Takeaway (Bypass Queue)" vs "Dine-in (Obunuzi Hall)".

### Cards & Menu Items
- **Food Item Card:** White container (`#FFFFFF`), 16px rounded corners, 1px subtle border `#E5E0D8`. Displays an appetizing landscape photo ratio (4:3), bold title (`headline-sm`), localized price (`UGX 12,000`), and a direct `+` touch trigger (44x44px minimum touch target).
- **Digital Queue Token Card:** Border 2px dashed `#DC2626` or `#16A34A` based on readiness. Features high-visibility 36px bold token digits (e.g., `#B-42`), estimated turnaround time, and an animated pulsing beacon when ready for pickup at the counter.

### Form Inputs & MoMo Fields
- **Phone / MoMo Input:** 52px height, 8px radius, white surface, 1.5px border `#E5E0D8`. Focus state shifts border to `#DC2626` with a soft 3px tinted halo (`rgba(220, 38, 38, 0.15)`). Country code prefix (+256) is locked and weighted in bold neutral.

### Lists & Order Summary
- **Item Breakdown Rows:** Divided by hairline rules (`#E5E0D8`). Quantity modifiers (`-`, `+`) set with prominent tap targets, aligned right. Subtotal, VAT, and packaging fees presented in clean tabular alignment using `body-md` and `currency-display`.