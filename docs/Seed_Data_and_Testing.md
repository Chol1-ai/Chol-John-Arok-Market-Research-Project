# Seed Data, Delivery Zones, BOM Conversion & Automated Test Runner

**Target Environment:** Antigravity IDE + Opencode CLI Repository Scaffold<br>
**Database:** PostgreSQL 16 via Prisma ORM<br>
**Location Data:** Wandegeya, Kampala, Uganda<br>
**Related Specifications:** `Foundational_Concept.md` Â· `Design_System.md` Â· `User_Flow.md` Â· `User_Profiles_Personas.md` Â· `Delivery_Zones_and_Dispatch.md` Â· `Tech_Stack.md` Â· `Payment_Integration.md` Â· `Hardware_and_Peripherals.md` Â· `Repo_Scaffold_and_Config.md` Â· `Demo_Script_and_Closing_Strategy.md` Â· `Daily_Audit_Digest.md` Â· `Deployment_Runbook.md` Â· `Service_Contract_and_Invoice_Template.md` Â · `build_strategy/Build_Strategy_and_Phases.md`

---

## 1. Seed Script (`prisma/seed.ts`)

Run via `npx prisma db seed` to populate a development or first-install database with authentic menus, market-accurate UGX prices, staff accounts, and recipe conversions.

> **Development only:** the demo PINs below must be changed before any real staff use. The seed never prints or stores a plaintext PIN; it stores a bcrypt hash. Never run the destructive cleanup block against a live database that contains real orders or audit history.

```typescript
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const DEMO_PIN = '1234';
const BCRYPT_COST = 12;

type MenuSeed = {
  name: string;
  category: string;
  price_ugx: number;
  station: 'STEAM_LINE' | 'GRILL_FRYER' | 'ROLEX_GRIDDLE' | 'BAR_BEVERAGE';
};

async function seedMenu(
  outlet: 'FOODIZO_HAM_TOWERS' | 'OBUNUZI_YMCA',
  items: MenuSeed[]
) {
  const rows = [];
  for (const item of items) {
    rows.push(await prisma.menu_items.create({ data: { outlet, ...item } }));
  }
  return Object.fromEntries(rows.map((row) => [row.name, row]));
}

async function main() {
  console.log('Seeding Foodizo & Obunuzi operational database...');

  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DESTRUCTIVE_SEED !== 'true') {
    throw new Error('Refusing to run the destructive seed in production.');
  }

  // 1. CLEAN EXISTING DEVELOPMENT DATA
  // audit_log is deliberately never deleted: it is append-only. Deleting a
  // user sets audit_log.actor_user_id to NULL and preserves the row.
  await prisma.daily_digests.deleteMany();
  await prisma.cash_counts.deleteMany();
  await prisma.closing_surplus_logs.deleteMany();
  await prisma.delivery_handoffs.deleteMany();
  await prisma.payment_events.deleteMany();
  await prisma.payments.deleteMany();
  await prisma.order_items.deleteMany();
  await prisma.orders.deleteMany();
  await prisma.recipe_bom.deleteMany();
  await prisma.menu_items.deleteMany();
  await prisma.raw_inventory.deleteMany();
  await prisma.delivery_zones.deleteMany();
  await prisma.restaurant_tables.deleteMany();
  await prisma.token_counters.deleteMany();
  await prisma.user_sessions.deleteMany();
  await prisma.users.deleteMany();

  // 2. CREATE STAFF ACCOUNTS
  // Zito is cross-outlet (outlet = NULL). Every waiter/kitchen user must have
  // one outlet; the database CHECK enforces it.
  const pinHash = await bcrypt.hash(DEMO_PIN, BCRYPT_COST);

  await prisma.users.create({
    data: {
      full_name: 'Zito Mbowe',
      phone_number: '256700000000',
      role: 'MANAGER_ADMIN',
      outlet: null,
      pin_hash: pinHash
    }
  });

  await prisma.users.create({
    data: {
      full_name: 'Prossy N.',
      phone_number: '256772111222',
      role: 'WAITER_FOH',
      outlet: 'OBUNUZI_YMCA',
      pin_hash: pinHash
    }
  });

  await prisma.users.create({
    data: {
      full_name: 'Chef Juma',
      phone_number: '256772333444',
      role: 'KITCHEN_STAFF',
      outlet: 'FOODIZO_HAM_TOWERS',
      pin_hash: pinHash
    }
  });

  // 3. CREATE TABLES FOR OBUNUZI (YMCA)
  const tables = ['T-01', 'T-02', 'T-03', 'T-04', 'B-01', 'B-02'];
  for (const label of tables) {
    await prisma.restaurant_tables.create({
      data: {
        outlet: 'OBUNUZI_YMCA',
        table_label: label,
        status: 'VACANT',
        capacity: 4
      }
    });
  }

  // 4. CREATE DELIVERY ZONES (Phase 1 active + Phase 2 inactive)
  // Fees/ETAs are launch defaults pending Zito Mbowe's approval. Both outlets
  // get their own rows so each can override a fee without affecting the other.
  const zoneTemplate = [
    { zone_code: 'MK_LUMUMBA',      display_name: 'Makerere University â€” Lumumba Hall',       landmark_group: 'Makerere Campus', landmark_hint: 'Call at hall reception',        fee_ugx: 2000, eta_min_minutes: 10, eta_max_minutes: 15, display_order: 10, is_active: true },
    { zone_code: 'MK_MITCHELL',     display_name: 'Makerere University â€” Mitchell Hall',      landmark_group: 'Makerere Campus', landmark_hint: 'Call at the main gate',         fee_ugx: 2000, eta_min_minutes: 10, eta_max_minutes: 15, display_order: 20, is_active: true },
    { zone_code: 'MK_AFRICA',       display_name: 'Makerere University â€” Africa Hall',        landmark_group: 'Makerere Campus', landmark_hint: 'Call at the reception desk',    fee_ugx: 2000, eta_min_minutes: 10, eta_max_minutes: 15, display_order: 30, is_active: true },
    { zone_code: 'MK_MARY_STUART',  display_name: 'Makerere University â€” Mary Stuart Hall',   landmark_group: 'Makerere Campus', landmark_hint: 'Call at the security gate',     fee_ugx: 2000, eta_min_minutes: 10, eta_max_minutes: 15, display_order: 40, is_active: true },
    { zone_code: 'MK_COMPLEX',      display_name: 'Makerere University â€” Main Complex / Freedom Square', landmark_group: 'Makerere Campus', landmark_hint: 'Meet at the main entrance', fee_ugx: 2000, eta_min_minutes: 10, eta_max_minutes: 15, display_order: 50, is_active: true },
    { zone_code: 'MK_SENATE',       display_name: 'Makerere University â€” Senate Building / Main Gate',    landmark_group: 'Makerere Campus', landmark_hint: 'Call at the main gate',    fee_ugx: 2000, eta_min_minutes: 10, eta_max_minutes: 15, display_order: 60, is_active: true },
    { zone_code: 'YMCA_MAIN',       display_name: 'YMCA Main Campus',                         landmark_group: 'YMCA',            landmark_hint: 'Call at the reception',         fee_ugx: 1500, eta_min_minutes: 5,  eta_max_minutes: 10, display_order: 70, is_active: true },
    { zone_code: 'HAM_TOWERS',      display_name: 'Ham Towers',                               landmark_group: 'Wandegeya',       landmark_hint: 'Foodizo atrium / office floor',  fee_ugx: 1000, eta_min_minutes: 5,  eta_max_minutes: 10, display_order: 80, is_active: true },
    { zone_code: 'WANDEGEYA_MARKET',display_name: 'Wandegeya Market',                         landmark_group: 'Wandegeya',       landmark_hint: 'Call at the market main gate',   fee_ugx: 2000, eta_min_minutes: 10, eta_max_minutes: 15, display_order: 90, is_active: true },
    { zone_code: 'KIKONI',          display_name: 'Kikoni',                                   landmark_group: 'Wandegeya',       landmark_hint: 'Call at the hostel gate',        fee_ugx: 3000, eta_min_minutes: 15, eta_max_minutes: 20, display_order: 100, is_active: true },
    { zone_code: 'MULAGO',          display_name: 'Mulago Hospital Area',                     landmark_group: 'Phase 2',         landmark_hint: 'Confirm with outlet',            fee_ugx: 4000, eta_min_minutes: 20, eta_max_minutes: 30, display_order: 200, is_active: false },
    { zone_code: 'KAMWOKYA',        display_name: 'Kamwokya',                                 landmark_group: 'Phase 2',         landmark_hint: 'Confirm with outlet',            fee_ugx: 4000, eta_min_minutes: 20, eta_max_minutes: 30, display_order: 210, is_active: false },
    { zone_code: 'NAKASERO',        display_name: 'Nakasero',                                 landmark_group: 'Phase 2',         landmark_hint: 'Confirm with outlet',            fee_ugx: 5000, eta_min_minutes: 25, eta_max_minutes: 35, display_order: 220, is_active: false },
    { zone_code: 'KOLOLO',          display_name: 'Kololo',                                   landmark_group: 'Phase 2',         landmark_hint: 'Confirm with outlet',            fee_ugx: 6000, eta_min_minutes: 30, eta_max_minutes: 40, display_order: 230, is_active: false }
  ];

  const outlets = ['FOODIZO_HAM_TOWERS', 'OBUNUZI_YMCA'] as const;
  for (const outlet of outlets) {
    await prisma.delivery_zones.createMany({
      data: zoneTemplate.map((zone) => ({ ...zone, outlet }))
    });
  }

  // 5. CREATE MENU ITEMS â€” the server-owned price and availability catalogue
  const foodizoMenu = await seedMenu('FOODIZO_HAM_TOWERS', [
    { name: '2pc Fried Chicken & Chips',        category: 'Mains',      price_ugx: 14000, station: 'GRILL_FRYER' },
    { name: 'Regular Rolex (2 Eggs, 1 Chapati)', category: 'Breakfast', price_ugx: 3500,  station: 'ROLEX_GRIDDLE' },
    { name: 'Fresh Passion Juice',              category: 'Drinks',     price_ugx: 4000,  station: 'BAR_BEVERAGE' },
    { name: 'Bottled Water',                    category: 'Drinks',     price_ugx: 1500,  station: 'BAR_BEVERAGE' }
  ]);

  const obunuziMenu = await seedMenu('OBUNUZI_YMCA', [
    { name: 'Traditional Beef Luwombo', category: 'Mains',  price_ugx: 16000, station: 'STEAM_LINE' },
    { name: 'Steamed Matooke',          category: 'Sides',  price_ugx: 3000,  station: 'STEAM_LINE' },
    { name: 'Bottled Water',            category: 'Drinks', price_ugx: 1500,  station: 'BAR_BEVERAGE' }
  ]);

  // 6. CREATE RAW INVENTORY (HIGH-TURNOVER COMMODITIES)
  const oil = await prisma.raw_inventory.create({
    data: {
      outlet: 'FOODIZO_HAM_TOWERS',
      item_name: 'Mukwano Cooking Oil',
      unit_of_measure: 'MILLILITERS',
      current_stock: 40000, // 40 Liters
      alert_threshold: 5000
    }
  });

  const eggs = await prisma.raw_inventory.create({
    data: {
      outlet: 'FOODIZO_HAM_TOWERS',
      item_name: 'Fresh Farm Eggs',
      unit_of_measure: 'PIECES',
      current_stock: 300, // 25 trays
      alert_threshold: 60
    }
  });

  const chicken = await prisma.raw_inventory.create({
    data: {
      outlet: 'FOODIZO_HAM_TOWERS',
      item_name: 'Raw Broiler Chicken Portions',
      unit_of_measure: 'PIECES',
      current_stock: 80,
      alert_threshold: 15
    }
  });

  const potatoes = await prisma.raw_inventory.create({
    data: {
      outlet: 'FOODIZO_HAM_TOWERS',
      item_name: 'Potatoes (pre-cut chips)',
      unit_of_measure: 'GRAMS',
      current_stock: 10000,
      alert_threshold: 2000
    }
  });

  const beef = await prisma.raw_inventory.create({
    data: {
      outlet: 'OBUNUZI_YMCA',
      item_name: 'Fresh Stewing Beef',
      unit_of_measure: 'GRAMS',
      current_stock: 25000, // 25 Kg
      alert_threshold: 5000
    }
  });

  const matooke = await prisma.raw_inventory.create({
    data: {
      outlet: 'OBUNUZI_YMCA',
      item_name: 'Steamed Matooke Portions',
      unit_of_measure: 'PORTIONS',
      current_stock: 50,
      alert_threshold: 10
    }
  });

  // 7. CREATE BILL OF MATERIALS (BOM) BY menu_items.id
  await prisma.recipe_bom.createMany({
    data: [
      // Regular Rolex: 2 eggs + 15 ml oil per portion.
      { menu_item_id: foodizoMenu['Regular Rolex (2 Eggs, 1 Chapati)'].id, raw_material_id: eggs.id,    quantity_deducted: 2 },
      { menu_item_id: foodizoMenu['Regular Rolex (2 Eggs, 1 Chapati)'].id, raw_material_id: oil.id,     quantity_deducted: 15 },

      // 2pc chicken & chips: 2 chicken pieces + 250 g chips + 50 ml frying oil.
      { menu_item_id: foodizoMenu['2pc Fried Chicken & Chips'].id, raw_material_id: chicken.id,  quantity_deducted: 2 },
      { menu_item_id: foodizoMenu['2pc Fried Chicken & Chips'].id, raw_material_id: potatoes.id, quantity_deducted: 250 },
      { menu_item_id: foodizoMenu['2pc Fried Chicken & Chips'].id, raw_material_id: oil.id,      quantity_deducted: 50 },

      // Beef Luwombo: 350 g stewing beef + 1 matooke portion per serving.
      { menu_item_id: obunuziMenu['Traditional Beef Luwombo'].id, raw_material_id: beef.id,    quantity_deducted: 350 },
      { menu_item_id: obunuziMenu['Traditional Beef Luwombo'].id, raw_material_id: matooke.id, quantity_deducted: 1 },

      // A standalone matooke side consumes one portion.
      { menu_item_id: obunuziMenu['Steamed Matooke'].id, raw_material_id: matooke.id, quantity_deducted: 1 }
    ]
  });

  console.log('Seeding completed successfully.');
  console.log('Development staff logins (phone / PIN):');
  console.log('  256700000000 / 1234  MANAGER_ADMIN (cross-outlet)');
  console.log('  256772111222 / 1234  WAITER_FOH (Obunuzi)');
  console.log('  256772333444 / 1234  KITCHEN_STAFF (Foodizo)');
  console.log('Change these PINs before go-live.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

---

## 2. Mock Test Runner: Prepaid Gate & KDS Concurrency

This script simulates 20 rapid prepaid orders during the 1:00 PM rush. It verifies that the API ignores client prices, creates every order as `AWAITING_PAYMENT`, allocates unique per-outlet tokens, and promotes each order to `PENDING` only after a successful, deduplicated webhook.

> The runner covers `TAKEAWAY_PICKUP` and `PHONE_DELIVERY`. A `DINE_IN` POSTPAY tab is an authenticated FOH action and must be tested separately with a Prossy session; it does not call the customer payment webhook.

```typescript
// scripts/simulate-rush-hour.ts
import axios from 'axios';

const API_BASE = 'http://localhost:4000/api/v1';

type MenuItem = {
  id: string;
  name: string;
  price_ugx: string | number;
  is_active: boolean;
  is_86: boolean;
};

async function loadMenu(outlet: 'FOODIZO_HAM_TOWERS' | 'OBUNUZI_YMCA') {
  const res = await axios.get<MenuItem[]>(`${API_BASE}/menu`, {
    params: { outlet }
  });
  return new Map(
    res.data
      .filter((item) => item.is_active && !item.is_86)
      .map((item) => [item.name, item])
  );
}

async function simulatePeakRush() {
  console.log('ðŸš€ Starting concurrent rush-hour simulation (1:00 PM)...');

  const [foodizoMenu, obunuziMenu] = await Promise.all([
    loadMenu('FOODIZO_HAM_TOWERS'),
    loadMenu('OBUNUZI_YMCA')
  ]);

  const zonesRes = await axios.get<Array<{ id: string; zone_code: string }>>(
    `${API_BASE}/delivery-zones`,
    { params: { outlet: 'OBUNUZI_YMCA' } }
  );
  const ymcaZone = zonesRes.data.find((zone) => zone.zone_code === 'YMCA_MAIN');
  if (!ymcaZone) throw new Error('YMCA_MAIN delivery zone is not seeded');

  const chicken = foodizoMenu.get('2pc Fried Chicken & Chips');
  const rolex = foodizoMenu.get('Regular Rolex (2 Eggs, 1 Chapati)');
  const luwombo = obunuziMenu.get('Traditional Beef Luwombo');
  if (!chicken || !rolex || !luwombo) {
    throw new Error('Run the seed before the rush-hour simulation');
  }

  const runId = Date.now().toString(36);
  const requests = Array.from({ length: 20 }, (_, index) => {
    const isDelivery = index % 3 === 2;
    const isObunuzi = isDelivery || index % 4 === 1;
    const item = isObunuzi ? luwombo : index % 2 === 0 ? chicken : rolex;
    const outlet = isObunuzi ? 'OBUNUZI_YMCA' : 'FOODIZO_HAM_TOWERS';
    const channel = isDelivery ? 'PHONE_DELIVERY' : 'TAKEAWAY_PICKUP';

    return {
      outlet,
      channel,
      customerPhone: `2567${String(71000000 + index)}`,
      items: [{ menuItemId: item.id, quantity: 1 }],
      ...(isDelivery
        ? {
            customerName: `Rush Customer ${index + 1}`,
            deliveryZoneId: ymcaZone.id,
            deliveryNote: 'YMCA reception â€” call on arrival'
          }
        : {})
    };
  });

  // 1. Create all orders concurrently. The client sends only menu IDs and
  // quantities: no name, no price, and no total.
  const orderResponses = await Promise.all(
    requests.map((body) => axios.post(`${API_BASE}/orders`, body))
  );

  for (const res of orderResponses) {
    if (res.data.status !== 'AWAITING_PAYMENT') {
      throw new Error(`Expected AWAITING_PAYMENT, got ${res.data.status}`);
    }
    if (!res.data.paymentReferenceId) {
      throw new Error('Order response is missing paymentReferenceId');
    }
  }

  const tokenKeys = orderResponses.map(
    (res) => `${res.data.outlet}:${res.data.digital_token}`
  );
  if (new Set(tokenKeys).size !== tokenKeys.length) {
    throw new Error('Duplicate display token detected for an outlet/business date');
  }

  // 2. Deliver one successful webhook per order, concurrently and with a
  // unique provider event id. This exercises the dedupe ledger and the
  // order-level lock without creating duplicate tickets.
  const webhookResponses = await Promise.all(
    orderResponses.map((res, index) =>
      axios.post(`${API_BASE}/payments/webhook`, {
        provider: 'MTN',
        eventId: `rush-${runId}-${index}`,
        referenceId: res.data.paymentReferenceId,
        status: 'SUCCESSFUL',
        financialTransactionId: `MOMO-${runId}-${index}`
      })
    )
  );

  for (const res of webhookResponses) {
    if (res.data.status !== 'ACKNOWLEDGED') {
      throw new Error(`Unexpected webhook result: ${res.data.status}`);
    }
  }

  console.log(`âœ… ${orderResponses.length} orders created AWAITING_PAYMENT.`);
  console.log('âœ… All display tokens were unique per outlet.');
  console.log('âœ… All webhooks acknowledged and promoted their orders to PENDING.');
}

simulatePeakRush().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

---

## 3. End-to-End Test Verification Checklist

Before demonstrating the solution to Zito Mbowe, the builders must verify these criteria pass:

1. **Auto-86 verification:** Decrement `Fresh Farm Eggs` to `0` in the database. Verify that `Regular Rolex (2 Eggs, 1 Chapati)` immediately displays an out-of-stock badge on the student mobile app and cannot be ordered.
2. **Channel segregation:** Submit an authenticated FOH `DINE_IN` tab and prepaid `TAKEAWAY_PICKUP` and `PHONE_DELIVERY` orders. Verify the KDS displays distinct Blue, Amber, and Purple badges.
3. **KDS bump progression:** Tap a `PENDING` `TAKEAWAY_PICKUP` order â†’ verify it transitions to `PREPARING` and decrements recipe inventory once â†’ tap to `READY` â†’ verify the packaging chit print job fires. A `DINE_IN` order must not print a bag label.
4. **Digital token and pickup SMS:** Verify the token allocated at checkout matches the token rendered on the KDS card and the Expo packaging/delivery chit. For a customer-app `TAKEAWAY_PICKUP`, verify the payer MSISDN was persisted as `orders.customer_phone` and the `READY` SMS reached that number; a cash walk-in without a phone must not attempt an SMS.
5. **Delivery zone scope:** Attempt to submit an order with a zone from the other outlet. Verify the API rejects it with `DELIVERY_ZONE_OUTLET_MISMATCH` and no payment is initiated.
6. **Delivery required fields:** Attempt to submit a `PHONE_DELIVERY` order with no room note, no recipient name, or no phone. Verify each request is rejected before the MoMo/Airtel prompt.
7. **Delivery fee integrity:** Change the YMCA zone fee from `1,500` to `2,000`; verify the checkout total and the STK amount both change, and a client-supplied `deliveryFeeUgx` is ignored.
8. **Optional GPS:** Submit a delivery order with geolocation blocked. Verify checkout completes, the order has no coordinates, and the dispatch queue/chit still show the landmark note and phone.
9. **KDS privacy:** Open a `PHONE_DELIVERY` ticket on the KDS. Verify it shows `YMCA MAIN CAMPUS` but not the phone number, room note, or GPS coordinates.
10. **Dispatch handoff:** On a `READY` delivery order, verify a KDS bump to `COMPLETED` is rejected with `DELIVERY_COMPLETION_REQUIRES_HANDOFF`. Record a rider handoff and verify `delivery_handoffs` contains rider name, dispatcher, method, and `PENDING` outcome; complete delivery and verify the order becomes `COMPLETED` with `delivered_at`.
11. **Rider advance reconciliation:** Record a handoff with a `UGX 2,000` rider advance and no returned change. Verify the shift-close report shows the cash-drawer deduction and the net delivery contribution. Repeat with `UGX 500` returned; verify the drawer reconciles to the net `UGX 1,500`.
12. **Failed delivery:** Record `FAILED_UNREACHABLE`. Verify the order is **not** marked `COMPLETED`, the manager can resolve it as `CANCELLED`, the rider advance/return is recorded, and the food can be logged in the surplus/waste routine. If the order was prepaid, verify the successful MoMo/Airtel payment moves to `REFUND_PENDING` with `audit_flag = 'FAILED_DELIVERY'`, leaves gross, and can be closed via `POST /api/v1/payments/:id/refund`.
13. **No map SDK:** Open DevTools Network during delivery checkout. Verify no Google Maps, Places, Directions, or Geocoding request is made and no map API key is present in the client bundle.
14. **Chit sanitization:** Unit-test `sanitizeChitText` with a note containing `\x1B@` and verify control bytes are removed before the ESC/POS buffer is built.
15. **Closing surplus log:** Trigger the 9:00 PM surplus routine; verify that unsold batch counts append to `closing_surplus_logs` without altering historic sales records.
16. **Prepaid gate:** Create a prepaid order and confirm it stays `AWAITING_PAYMENT`; verify no KDS query returns it and no ticket is broadcast. Send the successful webhook and verify it becomes `PENDING` exactly once.
17. **Server-owned pricing:** Submit a prepaid order with a forged low `priceUgx` or total. Verify the API ignores it, snapshots `menu_items.price_ugx`, and charges the correct total.
18. **Token concurrency:** Create 20 orders concurrently for one outlet and business date. Verify every `(outlet, business_date, digital_token)` is unique and `token_counters.last_value` equals the number allocated.
19. **Duplicate, late, and cancelled payment:** Send the same successful webhook twice, then send a second successful payment for the same order. Verify the duplicate is acknowledged without a second ticket and the second payment becomes `REFUND_PENDING`. Close it as `REFUNDED` via `POST /api/v1/payments/:id/refund`; verify it leaves the pending memo, stays out of gross, and is audit-logged. Cancel an `AWAITING_PAYMENT` order, then send a successful webhook; verify it is flagged `LATE_PAYMENT_AFTER_CANCEL` and never enters the KDS. Verify a manual-MoMo payment on an already-paid order becomes `REFUND_PENDING` with `DUPLICATE_SUCCESS_REQUIRES_REFUND`. Finally, cancel an order that already has a `SUCCESSFUL` payment; verify the order is `CANCELLED`, the payment becomes `REFUND_PENDING` with `CANCELLED_AFTER_PAYMENT`, and the digest no longer counts it in gross.
20. **POSTPAY authorization:** Attempt a `DINE_IN` POSTPAY request with no session and a valid seeded `tableId`; verify it is rejected with `POSTPAY_REQUIRES_STAFF`. Repeat as `WAITER_FOH` with the same `tableId`; verify the tab enters `PENDING` and writes the staff identity to `created_by`. Attempt a second POSTPAY tab on the same table; verify it is rejected with `TABLE_ALREADY_OCCUPIED`. At bill close, call `POST /api/v1/orders/:id/settle` with `carrier: 'CASH'`; verify the payment records as `SUCCESSFUL`, the kitchen status is unchanged, and the settlement is audit-logged.

---

## 4. Cash Count & Daily Digest Test Cases

Use a fixed test date and synthetic fixtures. Do not copy production totals into assertions, and do not assert `UGX 0` unless the fixture actually balances.

| # | Test | Steps | Expected result |
| :--- | :--- | :--- | :--- |
| 21 | Cash count uniqueness | Insert two `cash_counts` rows for the same outlet and business date | Second insert is rejected by `cash_counts_unique` |
| 22 | Expected cash formula | Seed `UGX 100,000` cash payments; rider advances `UGX 30,000` with `UGX 10,000` returned; no refunds implemented | Expected cash = `UGX 80,000` (cash âˆ’ net advances) |
| 23 | Variance sign and flag | Counted cash `UGX 70,000` against expected `UGX 80,000` | Variance = `-UGX 10,000`; digest emits `CASH_VARIANCE` (threshold `UGX 5,000`) |
| 24 | Missing cash count | Delete the day's `cash_counts` row | Variance is `null`; digest emits `CASH_COUNT_MISSING`; SMS says â€œCASH COUNT MISSING,â€ never â€œUGX 0â€ |
| 25 | Carrier coverage | Seed one successful payment each for `MTN`, `AIRTEL`, `MANUAL_MOMO`, and `CASH` | All four appear in the digest; gross equals their sum; the query uses `carrier`, not `method` |
| 26 | Rider advance netting | Record a `UGX 2,000` advance with `UGX 500` returned | Net advance `UGX 1,500`; expected cash and delivery contribution both reflect the net amount |
| 27 | Digest idempotency | Run the generator twice for the same business date | One `daily_digests` row remains `SENT`; second run skips; exactly one SMS/email is sent |
| 28 | Timezone boundary | Run with host clock in UTC; freeze at `18:29` and `18:30` UTC | No send at 18:29; send at 18:30 UTC (21:30 EAT); `digest_date` is the Kampala date, not the UTC date |
| 29 | SMS size and content | Render the SMS for a day with 3 flags | At most 2 GSM segments; contains gross, cash variance or missing-count flag, flag count, and full-report link |
| 30 | Email content | Render the full email | Plain text and HTML contain the four payment lines, cash reconciliation, stock/clearance sections, exceptions, and the three admin links |
| 31 | Failure and retry | Make SMTP and SMS provider fail | `daily_digests.status = FAILED` with `error`; one retry after 5 minutes; escalation follows; no successful duplicate send |
| 32 | WhatsApp disabled by default | Leave `OWNER_WHATSAPP_ENABLED=false` | No WhatsApp API call is attempted; SMS and email still send |
| 33 | WhatsApp fallback | Enable WhatsApp and make the Cloud API return an error | SMS fallback is sent; failure is logged; no customer-facing WhatsApp message is generated |
| 34 | Clearance accounting | Log 4 discounted, 2 staff-meal, and 1 waste portion | Digest reports the three resolutions separately; no â€œrevenue recoveredâ€ double count; estimated value is labelled as an estimate |
| 35 | Signed report link | Request the full report without a session and with an expired signature | Access is denied; a valid unexpired link opens the report; the URL contains no customer data |
| 36 | PII exclusion | Inspect `daily_digests.payload_json`, the SMS, and the email | No customer name, phone number, delivery note, or GPS coordinate appears |
| 37 | Manual dry run | Run `npm run digest -- --date=YYYY-MM-DD --dry-run` | Report renders to stdout/files without sending SMS, email, or WhatsApp and without marking the digest `SENT` |
| 38 | PIN storage | Read a seeded `users` row and the login audit rows | `pin_hash` is a bcrypt/argon2id hash; no plaintext PIN appears in the database, logs, or API response |
| 39 | Session revocation | Log in, deactivate the user, then reuse the cookie | The session is rejected on the next request and the revocation is logged |


---

## 5. Dev Seed: Delivery Handoffs & Daily Digest Fixtures

These extra seed rows let you test the **FOH Dispatch Queue**, the **Manager Audit** screen, and the **Nightly Digest** without waiting for a full shift to complete or triggering the 21:30 cron in development.

> Add this block to `prisma/seed.ts` after the orders and payments seed section. These rows depend on the FOH user (`prossy`), manager user (`zito`), and at least two completed delivery orders from the main seed.

### 5.1 Delivery Handoff Seed Rows

```typescript
// â”€â”€â”€ DELIVERY HANDOFF FIXTURES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Requires: at least 2 PHONE_DELIVERY orders already seeded (order1, order2)
// and a WAITER_FOH user (prossy) in the users table.

const handoff1 = await prisma.delivery_handoffs.create({
  data: {
    order_id:                   deliveryOrder1.id,
    rider_name:                 'Hassan B.',
    rider_phone:                '+256701234567',
    dispatched_by:              prossy.id,
    dispatch_method:            'CALL',
    rider_advance_ugx:          2000,       // stage-boda transport advance
    rider_advance_returned_ugx: 0,          // advance not yet returned (order still in transit)
    dispatched_at:              new Date(new Date().setHours(13, 15, 0, 0)),
    delivered_at:               new Date(new Date().setHours(13, 42, 0, 0)),
    outcome:                    'DELIVERED',
    reviewed:                   false,
    notes:                      'Delivered on time. Customer called at gate.',
  },
});

const handoff2 = await prisma.delivery_handoffs.create({
  data: {
    order_id:                   deliveryOrder2.id,
    rider_name:                 'Ssemakula J.',
    rider_phone:                '+256772345678',
    dispatched_by:              prossy.id,
    dispatch_method:            'WHATSAPP',
    rider_advance_ugx:          2000,
    rider_advance_returned_ugx: 2000,       // full advance returned â€” customer refused delivery
    dispatched_at:              new Date(new Date().setHours(14, 5, 0, 0)),
    delivered_at:               null,
    outcome:                    'FAILED_UNREACHABLE',
    reviewed:                   false,       // manager must review this â€” will appear as a digest flag
    notes:                      'Called x3, WhatsApp x1. No response. Food returned to outlet.',
  },
});

console.log(`Seeded ${2} delivery handoff fixtures (1 DELIVERED, 1 FAILED_UNREACHABLE)`);
```

> **Test this fixture by:**
> 1. Opening `/pos/dispatch` as Prossy â€” the `FAILED_UNREACHABLE` order should appear in the "Review" tab
> 2. Opening `/admin/audit` as Zito â€” the unreviewed failure should appear as a flag
> 3. Running the digest dry-run â€” the flag count should be â‰¥ 1

### 5.2 Daily Digest Fixture Row

This seeds a yesterday's digest row so you can test the `/admin/digest` and `/d/[token]` views without waiting for the 21:30 cron.

```typescript
// â”€â”€â”€ DAILY DIGEST FIXTURE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
import crypto from 'crypto';

const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
yesterday.setHours(0, 0, 0, 0);

const sampleLinkToken = crypto.randomBytes(4).toString('hex'); // e.g. "7f3c2a1b"

await prisma.daily_digests.create({
  data: {
    business_date: yesterday,
    status:        'SENT',
    gross_ugx:     2744000,    // sample gross for demo: UGX 2,744,000
    flags:         1,           // 1 FAILED_UNREACHABLE handoff pending manager review
    link_token:    sampleLinkToken,
    payload_json: {
      mtn_ugx:          1200000,
      airtel_ugx:        880000,
      cash_ugx:          664000,
      manual_momo_ugx:       0,
      cash_variance_ugx:     0,
      cash_count_status: 'SUBMITTED',
      flags: [
        { type: 'FAILED_DELIVERY', order_id: deliveryOrder2.id, note: 'Customer unreachable' },
      ],
    },
    channels_sent: ['SMS', 'EMAIL'],
    sms_status:    'SENT',
    email_status:  'SENT',
    sent_at:       new Date(new Date().setDate(new Date().getDate() - 1)),
    error:         null,
  },
});

console.log(`Seeded daily digest for ${yesterday.toISOString().slice(0, 10)} â€” token: ${sampleLinkToken}`);
console.log(`View report at: http://localhost:3000/d/${sampleLinkToken}`);
```

> **Test this fixture by:**
> 1. Opening `/admin/digest` â€” yesterday's digest should appear with correct gross and flag count
> 2. Opening `http://localhost:3000/d/<token>` â€” full report page should render
> 3. Trying an expired or invalid token â€” should return 404 or 403
> 4. Running the cron for today's date â€” idempotency check should detect no row exists for today and proceed
