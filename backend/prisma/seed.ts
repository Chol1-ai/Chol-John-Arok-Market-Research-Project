import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { getKampalaBusinessDate } from '../src/services/tokenService.js';
import { DigestService } from '../src/services/digestService.js';

const prisma = new PrismaClient();
const DEMO_PIN = '1234';
const BCRYPT_COST = 12;

type Outlet = 'FOODIZO_HAM_TOWERS' | 'OBUNUZI_YMCA';
type Channel = 'DINE_IN' | 'TAKEAWAY_PICKUP' | 'PHONE_DELIVERY';
type OrderStatus = 'AWAITING_PAYMENT' | 'PENDING' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED';
type Station = 'STEAM_LINE' | 'GRILL_FRYER' | 'ROLEX_GRIDDLE' | 'BAR_BEVERAGE';

type MenuSeed = {
  name: string;
  category: string;
  price_ugx: number;
  station: Station;
};

type MenuMap = Record<string, { id: string; name: string; price_ugx: number; station: Station }>;

type OrderLine = { name: string; quantity: number; notes?: string };

type OrderSeed = {
  outlet: Outlet;
  channel: Channel;
  status: OrderStatus;
  tokenNumber: string;
  tableLabel?: string;
  waiterId?: string;
  createdBy: string;
  customerName?: string;
  customerPhone?: string;
  zoneCode?: string;
  deliveryNote?: string;
  minutesAgo: number;
  readyMinutesAgo?: number;
  completedMinutesAgo?: number;
  cancelledMinutesAgo?: number;
  cancellationReason?: string;
  estimatedPrepMinutes?: number;
  items: OrderLine[];
};

async function seedMenu(outlet: Outlet, items: MenuSeed[]): Promise<MenuMap> {
  const rows = [];
  for (const item of items) {
    rows.push(await prisma.menu_items.create({ data: { outlet, ...item } }));
  }
  return Object.fromEntries(
    rows.map((row) => [
      row.name,
      {
        id: row.id,
        name: row.name,
        price_ugx: Number(row.price_ugx),
        station: row.station as Station
      }
    ])
  );
}

function publicRef(prefix: string, sequence: number): string {
  const suffix = randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
  return `ORD-${prefix}${String(sequence).padStart(3, '0')}${suffix}`;
}

async function createOrder(
  seed: OrderSeed,
  menu: MenuMap,
  businessDate: Date,
  tables: Map<string, { id: string }>,
  zones: Map<string, { id: string; fee_ugx: number }>,
  sequence: number
) {
  const now = Date.now();
  const createdAt = new Date(now - seed.minutesAgo * 60_000);
  const subtotal = seed.items.reduce(
    (sum, line) => sum + menu[line.name].price_ugx * line.quantity,
    0
  );
  const zone = seed.zoneCode ? zones.get(seed.zoneCode) : undefined;
  const deliveryFee = zone?.fee_ugx ?? 0;
  const total = subtotal + deliveryFee;

  const order = await prisma.orders.create({
    data: {
      outlet: seed.outlet,
      digital_token: seed.tokenNumber,
      public_ref: publicRef(seed.outlet === 'FOODIZO_HAM_TOWERS' ? 'FZ' : 'OB', sequence),
      business_date: businessDate,
      channel: seed.channel,
      status: seed.status,
      table_id: seed.tableLabel ? tables.get(seed.tableLabel)!.id : null,
      created_by: seed.createdBy,
      customer_name: seed.customerName || null,
      customer_phone: seed.customerPhone || null,
      delivery_zone_id: zone?.id || null,
      delivery_note: seed.deliveryNote || null,
      subtotal_ugx: subtotal,
      delivery_fee_ugx: deliveryFee,
      total_amount_ugx: total,
      estimated_prep_minutes: seed.estimatedPrepMinutes ?? 12,
      created_at: createdAt,
      ready_at:
        seed.readyMinutesAgo !== undefined
          ? new Date(now - seed.readyMinutesAgo * 60_000)
          : seed.status === 'READY' || seed.status === 'COMPLETED'
            ? new Date(createdAt.getTime() + 10 * 60_000)
            : null,
      completed_at:
        seed.completedMinutesAgo !== undefined
          ? new Date(now - seed.completedMinutesAgo * 60_000)
          : null,
      cancelled_at:
        seed.cancelledMinutesAgo !== undefined
          ? new Date(now - seed.cancelledMinutesAgo * 60_000)
          : null,
      cancelled_by: seed.cancelledMinutesAgo !== undefined ? seed.createdBy : null,
      cancellation_reason: seed.cancellationReason || null,
      order_items: {
        create: seed.items.map((line) => {
          const item = menu[line.name];
          return {
            menu_item_id: item.id,
            menu_item_name: item.name,
            station: item.station,
            quantity: line.quantity,
            unit_price_ugx: item.price_ugx,
            line_total_ugx: item.price_ugx * line.quantity,
            is_bumped: seed.status === 'READY' || seed.status === 'COMPLETED',
            special_notes: line.notes || null
          };
        })
      }
    }
  });

  return { order, subtotal, deliveryFee, total };
}

async function createPayment(input: {
  orderId: string;
  carrier: 'MTN' | 'AIRTEL' | 'CASH' | 'MANUAL_MOMO';
  amountUgx: number;
  status: 'INITIATED' | 'PENDING_CUSTOMER_PIN' | 'SUCCESSFUL' | 'FAILED' | 'TIMED_OUT' | 'REFUND_PENDING';
  recordedBy: string;
  minutesAgo: number;
  completedMinutesAgo?: number;
  externalRef?: string;
  auditFlag?: string;
  failureReason?: string;
  msisdn?: string;
}) {
  return prisma.payments.create({
    data: {
      order_id: input.orderId,
      idempotency_key: randomUUID(),
      carrier: input.carrier,
      status: input.status,
      amount_ugx: input.amountUgx,
      customer_msisdn: input.msisdn || null,
      external_transaction_id: input.externalRef || null,
      audit_flag: input.auditFlag || null,
      failure_reason: input.failureReason || null,
      recorded_by: input.recordedBy,
      manual_verified_by: input.carrier === 'MANUAL_MOMO' ? input.recordedBy : null,
      manual_verified_at:
        input.carrier === 'MANUAL_MOMO' && input.status === 'SUCCESSFUL'
          ? new Date(Date.now() - (input.completedMinutesAgo ?? input.minutesAgo) * 60_000)
          : null,
      initiated_at: new Date(Date.now() - input.minutesAgo * 60_000),
      completed_at:
        input.completedMinutesAgo !== undefined
          ? new Date(Date.now() - input.completedMinutesAgo * 60_000)
          : input.status === 'SUCCESSFUL'
            ? new Date(Date.now() - input.minutesAgo * 60_000)
            : null
    }
  });
}

async function createHandoff(input: {
  orderId: string;
  dispatcherId: string;
  riderName: string;
  riderPhone: string;
  outcome: 'PENDING' | 'DELIVERED' | 'FAILED_UNREACHABLE' | 'REFUSED' | 'RETURNED';
  advanceUgx?: number;
  returnedUgx?: number;
  minutesAgo: number;
  deliveredMinutesAgo?: number;
  reviewed?: boolean;
  notes?: string;
  method?: 'CALL' | 'WHATSAPP' | 'COUNTER_HANDOFF';
}) {
  return prisma.delivery_handoffs.create({
    data: {
      order_id: input.orderId,
      dispatched_by: input.dispatcherId,
      rider_name: input.riderName,
      rider_phone: input.riderPhone,
      rider_advance_ugx: input.advanceUgx ?? 0,
      rider_advance_returned_ugx: input.returnedUgx ?? 0,
      dispatch_method: input.method || 'CALL',
      outcome: input.outcome,
      dispatched_at: new Date(Date.now() - input.minutesAgo * 60_000),
      delivered_at:
        input.deliveredMinutesAgo !== undefined
          ? new Date(Date.now() - input.deliveredMinutesAgo * 60_000)
          : null,
      reviewed: input.reviewed ?? false,
      notes: input.notes || null
    }
  });
}

export async function main() {
  console.log('Seeding Foodizo & Obunuzi operational database...');

  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DESTRUCTIVE_SEED !== 'true') {
    throw new Error('Refusing to run the destructive seed in production.');
  }

  // 1. CLEAN EXISTING DEVELOPMENT DATA.
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

  // 2. CREATE STAFF ACCOUNTS (7 aligned staff records).
  // Zito is cross-outlet (outlet = NULL). Every waiter/kitchen user must have
  // one outlet; the database CHECK enforces it.
  const pinHash = await bcrypt.hash(DEMO_PIN, BCRYPT_COST);

  const zito = await prisma.users.create({
    data: {
      full_name: 'Zito Mbowe',
      phone_number: '256700000000',
      role: 'MANAGER_ADMIN',
      outlet: null,
      pin_hash: pinHash
    }
  });

  const cyrus = await prisma.users.create({
    data: {
      full_name: 'Cyrus M.',
      phone_number: '256768550986',
      role: 'MANAGER_ADMIN',
      outlet: 'FOODIZO_HAM_TOWERS',
      pin_hash: pinHash
    }
  });

  const sarah = await prisma.users.create({
    data: {
      full_name: 'Sarah K.',
      phone_number: '256772555666',
      role: 'WAITER_FOH',
      outlet: 'FOODIZO_HAM_TOWERS',
      pin_hash: pinHash
    }
  });

  const juma = await prisma.users.create({
    data: {
      full_name: 'Chef Juma',
      phone_number: '256772333444',
      role: 'KITCHEN_STAFF',
      outlet: 'FOODIZO_HAM_TOWERS',
      pin_hash: pinHash
    }
  });

  const mubiru = await prisma.users.create({
    data: {
      full_name: 'Mubiru Mahad',
      phone_number: '256760723280',
      role: 'WAITER_FOH',
      outlet: 'OBUNUZI_YMCA',
      pin_hash: pinHash
    }
  });

  const prossy = await prisma.users.create({
    data: {
      full_name: 'Prossy N.',
      phone_number: '256772111222',
      role: 'WAITER_FOH',
      outlet: 'OBUNUZI_YMCA',
      pin_hash: pinHash
    }
  });

  const aisha = await prisma.users.create({
    data: {
      full_name: 'Chef Aisha',
      phone_number: '256772777888',
      role: 'KITCHEN_STAFF',
      outlet: 'OBUNUZI_YMCA',
      pin_hash: pinHash
    }
  });

  // 3. CREATE 16 TABLES PER OUTLET (T-01..T-12 + B-01..B-04).
  const tableLabels = [
    ...Array.from({ length: 12 }, (_, index) => `T-${String(index + 1).padStart(2, '0')}`),
    ...Array.from({ length: 4 }, (_, index) => `B-${String(index + 1).padStart(2, '0')}`)
  ];

  const tablesByOutlet = new Map<Outlet, Map<string, { id: string }>>();
  for (const outlet of ['FOODIZO_HAM_TOWERS', 'OBUNUZI_YMCA'] as const) {
    const map = new Map<string, { id: string }>();
    for (const label of tableLabels) {
      const row = await prisma.restaurant_tables.create({
        data: {
          outlet,
          table_label: label,
          status: 'VACANT',
          capacity: label.startsWith('B-') ? 2 : 4
        }
      });
      map.set(label, { id: row.id });
    }
    tablesByOutlet.set(outlet, map);
  }

  // 4. CREATE DELIVERY ZONES (Phase 1 active + Phase 2 inactive).
  const zoneTemplate = [
    { zone_code: 'MK_LUMUMBA',      display_name: 'Makerere University — Lumumba Hall',       landmark_group: 'Makerere Campus', landmark_hint: 'Call at hall reception',        fee_ugx: 2000, eta_min_minutes: 10, eta_max_minutes: 15, display_order: 10, is_active: true },
    { zone_code: 'MK_MITCHELL',     display_name: 'Makerere University — Mitchell Hall',      landmark_group: 'Makerere Campus', landmark_hint: 'Call at the main gate',         fee_ugx: 2000, eta_min_minutes: 10, eta_max_minutes: 15, display_order: 20, is_active: true },
    { zone_code: 'MK_AFRICA',       display_name: 'Makerere University — Africa Hall',        landmark_group: 'Makerere Campus', landmark_hint: 'Call at the reception desk',    fee_ugx: 2000, eta_min_minutes: 10, eta_max_minutes: 15, display_order: 30, is_active: true },
    { zone_code: 'MK_MARY_STUART',  display_name: 'Makerere University — Mary Stuart Hall',   landmark_group: 'Makerere Campus', landmark_hint: 'Call at the security gate',     fee_ugx: 2000, eta_min_minutes: 10, eta_max_minutes: 15, display_order: 40, is_active: true },
    { zone_code: 'MK_COMPLEX',      display_name: 'Makerere University — Main Complex / Freedom Square', landmark_group: 'Makerere Campus', landmark_hint: 'Meet at the main entrance', fee_ugx: 2000, eta_min_minutes: 10, eta_max_minutes: 15, display_order: 50, is_active: true },
    { zone_code: 'MK_SENATE',       display_name: 'Makerere University — Senate Building / Main Gate',    landmark_group: 'Makerere Campus', landmark_hint: 'Call at the main gate',    fee_ugx: 2000, eta_min_minutes: 10, eta_max_minutes: 15, display_order: 60, is_active: true },
    { zone_code: 'YMCA_MAIN',       display_name: 'YMCA Main Campus',                         landmark_group: 'YMCA',            landmark_hint: 'Call at the reception',         fee_ugx: 1500, eta_min_minutes: 5,  eta_max_minutes: 10, display_order: 70, is_active: true },
    { zone_code: 'HAM_TOWERS',      display_name: 'Ham Towers',                               landmark_group: 'Wandegeya',       landmark_hint: 'Foodizo atrium / office floor',  fee_ugx: 1000, eta_min_minutes: 5,  eta_max_minutes: 10, display_order: 80, is_active: true },
    { zone_code: 'WANDEGEYA_MARKET',display_name: 'Wandegeya Market',                         landmark_group: 'Wandegeya',       landmark_hint: 'Call at the market main gate',   fee_ugx: 2000, eta_min_minutes: 10, eta_max_minutes: 15, display_order: 90, is_active: true },
    { zone_code: 'KIKONI',          display_name: 'Kikoni',                                   landmark_group: 'Wandegeya',       landmark_hint: 'Call at the hostel gate',        fee_ugx: 3000, eta_min_minutes: 15, eta_max_minutes: 20, display_order: 100, is_active: true },
    { zone_code: 'MULAGO',          display_name: 'Mulago Hospital Area',                     landmark_group: 'Phase 2',         landmark_hint: 'Confirm with outlet',            fee_ugx: 4000, eta_min_minutes: 20, eta_max_minutes: 30, display_order: 200, is_active: false },
    { zone_code: 'KAMWOKYA',        display_name: 'Kamwokya',                                 landmark_group: 'Phase 2',         landmark_hint: 'Confirm with outlet',            fee_ugx: 4000, eta_min_minutes: 20, eta_max_minutes: 30, display_order: 210, is_active: false },
    { zone_code: 'NAKASERO',        display_name: 'Nakasero',                                 landmark_group: 'Phase 2',         landmark_hint: 'Confirm with outlet',            fee_ugx: 5000, eta_min_minutes: 25, eta_max_minutes: 35, display_order: 220, is_active: false },
    { zone_code: 'KOLOLO',          display_name: 'Kololo',                                   landmark_group: 'Phase 2',         landmark_hint: 'Confirm with outlet',            fee_ugx: 6000, eta_min_minutes: 30, eta_max_minutes: 40, display_order: 230, is_active: false }
  ];

  const zonesByOutlet = new Map<Outlet, Map<string, { id: string; fee_ugx: number }>>();
  for (const outlet of ['FOODIZO_HAM_TOWERS', 'OBUNUZI_YMCA'] as const) {
    const map = new Map<string, { id: string; fee_ugx: number }>();
    for (const zone of zoneTemplate) {
      const row = await prisma.delivery_zones.create({
        data: { ...zone, outlet }
      });
      map.set(zone.zone_code, { id: row.id, fee_ugx: Number(row.fee_ugx) });
    }
    zonesByOutlet.set(outlet, map);
  }

  // 5. MENU ITEMS.
  const foodizoMenu = await seedMenu('FOODIZO_HAM_TOWERS', [
    { name: '2pc Fried Chicken & Chips',         category: 'Mains',     price_ugx: 14000, station: 'GRILL_FRYER' },
    { name: 'Regular Rolex (2 Eggs, 1 Chapati)', category: 'Breakfast', price_ugx: 3500,  station: 'ROLEX_GRIDDLE' },
    { name: 'Plain Chips',                       category: 'Sides',     price_ugx: 5000,  station: 'GRILL_FRYER' },
    { name: 'Fresh Passion Juice',               category: 'Drinks',    price_ugx: 4000,  station: 'BAR_BEVERAGE' },
    { name: 'Bottled Water',                     category: 'Drinks',    price_ugx: 1500,  station: 'BAR_BEVERAGE' }
  ]);

  const obunuziMenu = await seedMenu('OBUNUZI_YMCA', [
    { name: 'Traditional Beef Luwombo', category: 'Mains',  price_ugx: 16000, station: 'STEAM_LINE' },
    { name: 'Steamed Matooke',          category: 'Sides',  price_ugx: 3000,  station: 'STEAM_LINE' },
    { name: 'Rice & Beans',             category: 'Mains',  price_ugx: 6000,  station: 'STEAM_LINE' },
    { name: 'Fresh Passion Juice',      category: 'Drinks', price_ugx: 4000,  station: 'BAR_BEVERAGE' },
    { name: 'Bottled Water',            category: 'Drinks', price_ugx: 1500,  station: 'BAR_BEVERAGE' }
  ]);

  // 6. RAW INVENTORY.
  const oil = await prisma.raw_inventory.create({
    data: {
      outlet: 'FOODIZO_HAM_TOWERS',
      item_name: 'Mukwano Cooking Oil',
      unit_of_measure: 'MILLILITERS',
      current_stock: 40000,
      alert_threshold: 5000,
      is_high_turnover: true
    }
  });

  const eggs = await prisma.raw_inventory.create({
    data: {
      outlet: 'FOODIZO_HAM_TOWERS',
      item_name: 'Fresh Farm Eggs',
      unit_of_measure: 'PIECES',
      current_stock: 300,
      alert_threshold: 60
    }
  });

  const chicken = await prisma.raw_inventory.create({
    data: {
      outlet: 'FOODIZO_HAM_TOWERS',
      item_name: 'Raw Broiler Chicken Portions',
      unit_of_measure: 'PIECES',
      current_stock: 80,
      alert_threshold: 15,
      is_high_turnover: true
    }
  });

  const potatoes = await prisma.raw_inventory.create({
    data: {
      outlet: 'FOODIZO_HAM_TOWERS',
      item_name: 'Potatoes (pre-cut chips)',
      unit_of_measure: 'GRAMS',
      current_stock: 4500,
      alert_threshold: 5000
    }
  });

  const beef = await prisma.raw_inventory.create({
    data: {
      outlet: 'OBUNUZI_YMCA',
      item_name: 'Fresh Stewing Beef',
      unit_of_measure: 'GRAMS',
      current_stock: 25000,
      alert_threshold: 5000,
      is_high_turnover: true
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

  // 7. RECIPE BOM.
  await prisma.recipe_bom.createMany({
    data: [
      { menu_item_id: foodizoMenu['Regular Rolex (2 Eggs, 1 Chapati)'].id, raw_material_id: eggs.id,    quantity_deducted: 2 },
      { menu_item_id: foodizoMenu['Regular Rolex (2 Eggs, 1 Chapati)'].id, raw_material_id: oil.id,     quantity_deducted: 15 },
      { menu_item_id: foodizoMenu['2pc Fried Chicken & Chips'].id,         raw_material_id: chicken.id, quantity_deducted: 2 },
      { menu_item_id: foodizoMenu['2pc Fried Chicken & Chips'].id,         raw_material_id: potatoes.id, quantity_deducted: 250 },
      { menu_item_id: foodizoMenu['2pc Fried Chicken & Chips'].id,         raw_material_id: oil.id,     quantity_deducted: 50 },
      { menu_item_id: foodizoMenu['Plain Chips'].id,                       raw_material_id: potatoes.id, quantity_deducted: 300 },
      { menu_item_id: foodizoMenu['Plain Chips'].id,                       raw_material_id: oil.id,     quantity_deducted: 40 },
      { menu_item_id: obunuziMenu['Traditional Beef Luwombo'].id,          raw_material_id: beef.id,    quantity_deducted: 350 },
      { menu_item_id: obunuziMenu['Traditional Beef Luwombo'].id,          raw_material_id: matooke.id, quantity_deducted: 1 },
      { menu_item_id: obunuziMenu['Steamed Matooke'].id,                   raw_material_id: matooke.id, quantity_deducted: 1 }
    ]
  });

  // 8. OPERATIONAL ORDERS, PAYMENTS, HANDOFFS.
  const businessDate = getKampalaBusinessDate();
  const foodizoTables = tablesByOutlet.get('FOODIZO_HAM_TOWERS')!;
  const obunuziTables = tablesByOutlet.get('OBUNUZI_YMCA')!;
  const foodizoZones = zonesByOutlet.get('FOODIZO_HAM_TOWERS')!;
  const obunuziZones = zonesByOutlet.get('OBUNUZI_YMCA')!;

  // --- Foodizo Ham Towers ---
  const f1 = await createOrder(
    {
      outlet: 'FOODIZO_HAM_TOWERS',
      channel: 'DINE_IN',
      status: 'PREPARING',
      tokenNumber: 'TOKEN-001',
      tableLabel: 'T-04',
      waiterId: sarah.id,
      createdBy: sarah.id,
      minutesAgo: 12,
      items: [
        { name: '2pc Fried Chicken & Chips', quantity: 2 },
        { name: 'Fresh Passion Juice', quantity: 2, notes: 'No ice' }
      ]
    },
    foodizoMenu,
    businessDate,
    foodizoTables,
    foodizoZones,
    1
  );
  await prisma.restaurant_tables.update({
    where: { id: foodizoTables.get('T-04')!.id },
    data: { status: 'OCCUPIED', current_waiter_id: sarah.id }
  });

  const f2 = await createOrder(
    {
      outlet: 'FOODIZO_HAM_TOWERS',
      channel: 'DINE_IN',
      status: 'COMPLETED',
      tokenNumber: 'TOKEN-002',
      tableLabel: 'T-06',
      waiterId: sarah.id,
      createdBy: sarah.id,
      minutesAgo: 80,
      readyMinutesAgo: 55,
      completedMinutesAgo: 40,
      items: [
        { name: '2pc Fried Chicken & Chips', quantity: 1 },
        { name: 'Bottled Water', quantity: 2 }
      ]
    },
    foodizoMenu,
    businessDate,
    foodizoTables,
    foodizoZones,
    2
  );
  await createPayment({
    orderId: f2.order.id,
    carrier: 'CASH',
    amountUgx: f2.total,
    status: 'SUCCESSFUL',
    recordedBy: sarah.id,
    minutesAgo: 42,
    completedMinutesAgo: 40
  });
  await prisma.restaurant_tables.update({
    where: { id: foodizoTables.get('T-06')!.id },
    data: { status: 'NEEDS_CLEARING', current_waiter_id: null }
  });

  const f3 = await createOrder(
    {
      outlet: 'FOODIZO_HAM_TOWERS',
      channel: 'TAKEAWAY_PICKUP',
      status: 'COMPLETED',
      tokenNumber: 'TOKEN-003',
      createdBy: cyrus.id,
      customerName: 'Brian K.',
      customerPhone: '256770123456',
      minutesAgo: 60,
      completedMinutesAgo: 48,
      items: [{ name: '2pc Fried Chicken & Chips', quantity: 1 }]
    },
    foodizoMenu,
    businessDate,
    foodizoTables,
    foodizoZones,
    3
  );
  await createPayment({
    orderId: f3.order.id,
    carrier: 'MTN',
    amountUgx: f3.total,
    status: 'SUCCESSFUL',
    recordedBy: cyrus.id,
    minutesAgo: 58,
    completedMinutesAgo: 56,
    externalRef: 'MTN-FZ-SEED-003',
    msisdn: '256770123456'
  });

  const f4 = await createOrder(
    {
      outlet: 'FOODIZO_HAM_TOWERS',
      channel: 'PHONE_DELIVERY',
      status: 'READY',
      tokenNumber: 'TOKEN-004',
      createdBy: cyrus.id,
      customerName: 'Dr. Okello',
      customerPhone: '256701234567',
      zoneCode: 'MK_LUMUMBA',
      deliveryNote: 'Block C, Room 204 — call at the security gate',
      minutesAgo: 25,
      readyMinutesAgo: 5,
      items: [
        { name: '2pc Fried Chicken & Chips', quantity: 1 },
        { name: 'Bottled Water', quantity: 1 }
      ]
    },
    foodizoMenu,
    businessDate,
    foodizoTables,
    foodizoZones,
    4
  );
  await createPayment({
    orderId: f4.order.id,
    carrier: 'AIRTEL',
    amountUgx: f4.total,
    status: 'SUCCESSFUL',
    recordedBy: cyrus.id,
    minutesAgo: 24,
    completedMinutesAgo: 22,
    externalRef: 'AIRTEL-FZ-SEED-004',
    msisdn: '256701234567'
  });

  const f5 = await createOrder(
    {
      outlet: 'FOODIZO_HAM_TOWERS',
      channel: 'PHONE_DELIVERY',
      status: 'COMPLETED',
      tokenNumber: 'TOKEN-005',
      createdBy: sarah.id,
      customerName: 'Nakato Grace',
      customerPhone: '256782345678',
      zoneCode: 'HAM_TOWERS',
      deliveryNote: 'Foodizo atrium, 3rd floor reception',
      minutesAgo: 180,
      readyMinutesAgo: 150,
      completedMinutesAgo: 120,
      items: [
        { name: 'Regular Rolex (2 Eggs, 1 Chapati)', quantity: 2 },
        { name: 'Bottled Water', quantity: 1 }
      ]
    },
    foodizoMenu,
    businessDate,
    foodizoTables,
    foodizoZones,
    5
  );
  await createPayment({
    orderId: f5.order.id,
    carrier: 'MANUAL_MOMO',
    amountUgx: f5.total,
    status: 'SUCCESSFUL',
    recordedBy: sarah.id,
    minutesAgo: 175,
    completedMinutesAgo: 174,
    externalRef: 'MP260105.1400.A12345',
    auditFlag: 'VERIFIED_MANUAL_MOMO'
  });
  await createHandoff({
    orderId: f5.order.id,
    dispatcherId: sarah.id,
    riderName: 'Moses Boda',
    riderPhone: '256772998877',
    outcome: 'DELIVERED',
    advanceUgx: 2000,
    minutesAgo: 140,
    deliveredMinutesAgo: 120,
    notes: 'Stage: Wandegeya • Plate: UEX 123A'
  });

  const f6 = await createOrder(
    {
      outlet: 'FOODIZO_HAM_TOWERS',
      channel: 'PHONE_DELIVERY',
      status: 'READY',
      tokenNumber: 'TOKEN-006',
      createdBy: cyrus.id,
      customerName: 'Aine Patricia',
      customerPhone: '256759876543',
      zoneCode: 'KIKONI',
      deliveryNote: 'Hostel gate, blue block',
      minutesAgo: 90,
      readyMinutesAgo: 65,
      items: [
        { name: '2pc Fried Chicken & Chips', quantity: 1 },
        { name: 'Fresh Passion Juice', quantity: 1 }
      ]
    },
    foodizoMenu,
    businessDate,
    foodizoTables,
    foodizoZones,
    6
  );
  await createPayment({
    orderId: f6.order.id,
    carrier: 'MTN',
    amountUgx: f6.total,
    status: 'SUCCESSFUL',
    recordedBy: cyrus.id,
    minutesAgo: 88,
    completedMinutesAgo: 86,
    externalRef: 'MTN-FZ-SEED-006',
    msisdn: '256759876543'
  });
  await createHandoff({
    orderId: f6.order.id,
    dispatcherId: cyrus.id,
    riderName: 'Kato Emmanuel',
    riderPhone: '256701112233',
    outcome: 'FAILED_UNREACHABLE',
    advanceUgx: 2000,
    minutesAgo: 60,
    reviewed: false,
    notes: 'Customer phone off; rider returned to stage with the bag.'
  });

  const f7 = await createOrder(
    {
      outlet: 'FOODIZO_HAM_TOWERS',
      channel: 'TAKEAWAY_PICKUP',
      status: 'AWAITING_PAYMENT',
      tokenNumber: 'TOKEN-007',
      createdBy: cyrus.id,
      customerName: 'Student Queue Walk-in',
      customerPhone: '256780000111',
      minutesAgo: 6,
      items: [{ name: 'Regular Rolex (2 Eggs, 1 Chapati)', quantity: 1 }]
    },
    foodizoMenu,
    businessDate,
    foodizoTables,
    foodizoZones,
    7
  );
  await createPayment({
    orderId: f7.order.id,
    carrier: 'MTN',
    amountUgx: f7.total,
    status: 'TIMED_OUT',
    recordedBy: cyrus.id,
    minutesAgo: 5,
    failureReason: 'CUSTOMER_DID_NOT_ENTER_PIN',
    msisdn: '256780000111'
  });
  await createPayment({
    orderId: f7.order.id,
    carrier: 'MTN',
    amountUgx: f7.total,
    status: 'INITIATED',
    recordedBy: cyrus.id,
    minutesAgo: 2,
    msisdn: '256780000111'
  });

  const f8 = await createOrder(
    {
      outlet: 'FOODIZO_HAM_TOWERS',
      channel: 'TAKEAWAY_PICKUP',
      status: 'CANCELLED',
      tokenNumber: 'TOKEN-008',
      createdBy: cyrus.id,
      customerName: 'Ronald T.',
      customerPhone: '256774445566',
      minutesAgo: 240,
      cancelledMinutesAgo: 200,
      cancellationReason: 'Customer changed their mind after paying',
      items: [{ name: '2pc Fried Chicken & Chips', quantity: 1 }]
    },
    foodizoMenu,
    businessDate,
    foodizoTables,
    foodizoZones,
    8
  );
  await createPayment({
    orderId: f8.order.id,
    carrier: 'AIRTEL',
    amountUgx: f8.total,
    status: 'REFUND_PENDING',
    recordedBy: cyrus.id,
    minutesAgo: 235,
    completedMinutesAgo: 230,
    externalRef: 'AIRTEL-FZ-SEED-008',
    auditFlag: 'CANCELLED_AFTER_PAYMENT',
    msisdn: '256774445566'
  });

  const f9 = await createOrder(
    {
      outlet: 'FOODIZO_HAM_TOWERS',
      channel: 'DINE_IN',
      status: 'PENDING',
      tokenNumber: 'TOKEN-009',
      tableLabel: 'T-08',
      waiterId: sarah.id,
      createdBy: sarah.id,
      minutesAgo: 8,
      items: [
        { name: 'Regular Rolex (2 Eggs, 1 Chapati)', quantity: 1 },
        { name: 'Fresh Passion Juice', quantity: 1 }
      ]
    },
    foodizoMenu,
    businessDate,
    foodizoTables,
    foodizoZones,
    9
  );
  await prisma.restaurant_tables.update({
    where: { id: foodizoTables.get('T-08')!.id },
    data: { status: 'OCCUPIED', current_waiter_id: sarah.id }
  });

  // --- Obunuzi YMCA ---
  const o1 = await createOrder(
    {
      outlet: 'OBUNUZI_YMCA',
      channel: 'DINE_IN',
      status: 'PENDING',
      tokenNumber: 'TOKEN-001',
      tableLabel: 'T-02',
      waiterId: prossy.id,
      createdBy: prossy.id,
      minutesAgo: 6,
      items: [
        { name: 'Traditional Beef Luwombo', quantity: 1 },
        { name: 'Steamed Matooke', quantity: 1 },
        { name: 'Bottled Water', quantity: 1 }
      ]
    },
    obunuziMenu,
    businessDate,
    obunuziTables,
    obunuziZones,
    1
  );
  await prisma.restaurant_tables.update({
    where: { id: obunuziTables.get('T-02')!.id },
    data: { status: 'OCCUPIED', current_waiter_id: prossy.id }
  });

  const o2 = await createOrder(
    {
      outlet: 'OBUNUZI_YMCA',
      channel: 'DINE_IN',
      status: 'READY',
      tokenNumber: 'TOKEN-002',
      tableLabel: 'T-05',
      waiterId: mubiru.id,
      createdBy: mubiru.id,
      minutesAgo: 35,
      readyMinutesAgo: 8,
      items: [
        { name: 'Traditional Beef Luwombo', quantity: 2 },
        { name: 'Steamed Matooke', quantity: 2 }
      ]
    },
    obunuziMenu,
    businessDate,
    obunuziTables,
    obunuziZones,
    2
  );
  await prisma.restaurant_tables.update({
    where: { id: obunuziTables.get('T-05')!.id },
    data: { status: 'BILL_REQUESTED', current_waiter_id: mubiru.id }
  });

  const o3 = await createOrder(
    {
      outlet: 'OBUNUZI_YMCA',
      channel: 'TAKEAWAY_PICKUP',
      status: 'COMPLETED',
      tokenNumber: 'TOKEN-003',
      createdBy: prossy.id,
      customerName: 'Brian K.',
      customerPhone: '256770123456',
      minutesAgo: 75,
      completedMinutesAgo: 62,
      items: [
        { name: 'Traditional Beef Luwombo', quantity: 1 },
        { name: 'Steamed Matooke', quantity: 1 }
      ]
    },
    obunuziMenu,
    businessDate,
    obunuziTables,
    obunuziZones,
    3
  );
  await createPayment({
    orderId: o3.order.id,
    carrier: 'CASH',
    amountUgx: o3.total,
    status: 'SUCCESSFUL',
    recordedBy: prossy.id,
    minutesAgo: 64,
    completedMinutesAgo: 62
  });

  const o4 = await createOrder(
    {
      outlet: 'OBUNUZI_YMCA',
      channel: 'PHONE_DELIVERY',
      status: 'COMPLETED',
      tokenNumber: 'TOKEN-004',
      createdBy: prossy.id,
      customerName: 'Dr. Okello',
      customerPhone: '256701234567',
      zoneCode: 'YMCA_MAIN',
      deliveryNote: 'Block C, Room 204 — call at security gate',
      minutesAgo: 240,
      readyMinutesAgo: 215,
      completedMinutesAgo: 190,
      items: [
        { name: 'Traditional Beef Luwombo', quantity: 1 },
        { name: 'Bottled Water', quantity: 1 }
      ]
    },
    obunuziMenu,
    businessDate,
    obunuziTables,
    obunuziZones,
    4
  );
  await createPayment({
    orderId: o4.order.id,
    carrier: 'AIRTEL',
    amountUgx: o4.total,
    status: 'SUCCESSFUL',
    recordedBy: prossy.id,
    minutesAgo: 236,
    completedMinutesAgo: 234,
    externalRef: 'AIRTEL-OB-SEED-004',
    msisdn: '256701234567'
  });
  await createHandoff({
    orderId: o4.order.id,
    dispatcherId: prossy.id,
    riderName: 'Moses Boda',
    riderPhone: '256772998877',
    outcome: 'DELIVERED',
    advanceUgx: 2000,
    minutesAgo: 210,
    deliveredMinutesAgo: 190,
    notes: 'Stage: YMCA • Plate: UEX 456B'
  });

  const o5 = await createOrder(
    {
      outlet: 'OBUNUZI_YMCA',
      channel: 'DINE_IN',
      status: 'COMPLETED',
      tokenNumber: 'TOKEN-005',
      tableLabel: 'T-07',
      waiterId: prossy.id,
      createdBy: prossy.id,
      minutesAgo: 150,
      readyMinutesAgo: 120,
      completedMinutesAgo: 105,
      items: [
        { name: 'Traditional Beef Luwombo', quantity: 1 },
        { name: 'Steamed Matooke', quantity: 1 },
        { name: 'Bottled Water', quantity: 1 }
      ]
    },
    obunuziMenu,
    businessDate,
    obunuziTables,
    obunuziZones,
    5
  );
  await createPayment({
    orderId: o5.order.id,
    carrier: 'CASH',
    amountUgx: o5.total,
    status: 'SUCCESSFUL',
    recordedBy: prossy.id,
    minutesAgo: 108,
    completedMinutesAgo: 105
  });
  await prisma.restaurant_tables.update({
    where: { id: obunuziTables.get('T-07')!.id },
    data: { status: 'NEEDS_CLEARING', current_waiter_id: null }
  });

  const o6 = await createOrder(
    {
      outlet: 'OBUNUZI_YMCA',
      channel: 'PHONE_DELIVERY',
      status: 'PENDING',
      tokenNumber: 'TOKEN-006',
      createdBy: prossy.id,
      customerName: 'Aisha Nabirye',
      customerPhone: '256703456789',
      zoneCode: 'MK_COMPLEX',
      deliveryNote: 'Freedom Square, meet at main entrance',
      minutesAgo: 4,
      items: [
        { name: 'Traditional Beef Luwombo', quantity: 1 },
        { name: 'Steamed Matooke', quantity: 1 }
      ]
    },
    obunuziMenu,
    businessDate,
    obunuziTables,
    obunuziZones,
    6
  );
  await createPayment({
    orderId: o6.order.id,
    carrier: 'MTN',
    amountUgx: o6.total,
    status: 'SUCCESSFUL',
    recordedBy: prossy.id,
    minutesAgo: 3.5,
    completedMinutesAgo: 2,
    externalRef: 'MTN-OB-SEED-006',
    msisdn: '256703456789'
  });

  const o7 = await createOrder(
    {
      outlet: 'OBUNUZI_YMCA',
      channel: 'PHONE_DELIVERY',
      status: 'READY',
      tokenNumber: 'TOKEN-007',
      createdBy: mubiru.id,
      customerName: 'Ssemakula Joel',
      customerPhone: '256705566778',
      zoneCode: 'YMCA_MAIN',
      deliveryNote: 'Main campus reception, ask for Joel',
      minutesAgo: 45,
      readyMinutesAgo: 12,
      items: [
        { name: 'Traditional Beef Luwombo', quantity: 1 },
        { name: 'Bottled Water', quantity: 1 }
      ]
    },
    obunuziMenu,
    businessDate,
    obunuziTables,
    obunuziZones,
    7
  );
  await createPayment({
    orderId: o7.order.id,
    carrier: 'MTN',
    amountUgx: o7.total,
    status: 'SUCCESSFUL',
    recordedBy: mubiru.id,
    minutesAgo: 43,
    completedMinutesAgo: 41,
    externalRef: 'MTN-OB-SEED-007',
    msisdn: '256705566778'
  });
  await createHandoff({
    orderId: o7.order.id,
    dispatcherId: mubiru.id,
    riderName: 'Kato Emmanuel',
    riderPhone: '256701112233',
    outcome: 'PENDING',
    advanceUgx: 2000,
    minutesAgo: 10,
    method: 'WHATSAPP',
    notes: 'Stage: YMCA • Plate: UEX 789C'
  });

  // 9. TOKEN COUNTERS reflect the highest seeded token per outlet/day.
  await prisma.token_counters.createMany({
    data: [
      { outlet: 'FOODIZO_HAM_TOWERS', business_date: businessDate, last_value: 9 },
      { outlet: 'OBUNUZI_YMCA', business_date: businessDate, last_value: 7 }
    ]
  });

  // 10. CLOSING SURPLUS LOGS (4 clearance, 2 staff meal, 1 waste).
  await prisma.closing_surplus_logs.createMany({
    data: [
      {
        outlet: 'FOODIZO_HAM_TOWERS',
        log_date: businessDate,
        menu_item_id: foodizoMenu['2pc Fried Chicken & Chips'].id,
        item_name: '2pc Fried Chicken & Chips',
        leftover_portions: 3,
        resolution: 'DISCOUNTED_CLEARANCE',
        logged_by: cyrus.id
      },
      {
        outlet: 'FOODIZO_HAM_TOWERS',
        log_date: businessDate,
        menu_item_id: foodizoMenu['Plain Chips'].id,
        item_name: 'Plain Chips',
        leftover_portions: 1,
        resolution: 'WASTE_DISCARDED',
        logged_by: cyrus.id
      },
      {
        outlet: 'FOODIZO_HAM_TOWERS',
        log_date: businessDate,
        menu_item_id: foodizoMenu['Regular Rolex (2 Eggs, 1 Chapati)'].id,
        item_name: 'Regular Rolex (2 Eggs, 1 Chapati)',
        leftover_portions: 1,
        resolution: 'STAFF_MEAL',
        logged_by: cyrus.id
      },
      {
        outlet: 'OBUNUZI_YMCA',
        log_date: businessDate,
        menu_item_id: obunuziMenu['Traditional Beef Luwombo'].id,
        item_name: 'Traditional Beef Luwombo',
        leftover_portions: 1,
        resolution: 'DISCOUNTED_CLEARANCE',
        logged_by: zito.id
      },
      {
        outlet: 'OBUNUZI_YMCA',
        log_date: businessDate,
        menu_item_id: obunuziMenu['Steamed Matooke'].id,
        item_name: 'Steamed Matooke',
        leftover_portions: 1,
        resolution: 'STAFF_MEAL',
        logged_by: zito.id
      }
    ]
  });

  // 11. CASH COUNTS: expected = successful cash - net rider advances.
  for (const outlet of ['FOODIZO_HAM_TOWERS', 'OBUNUZI_YMCA'] as const) {
    const cash = await prisma.payments.aggregate({
      _sum: { amount_ugx: true },
      where: {
        carrier: 'CASH',
        status: 'SUCCESSFUL',
        order: { outlet, business_date: businessDate }
      }
    });
    const advances = await prisma.delivery_handoffs.aggregate({
      _sum: {
        rider_advance_ugx: true,
        rider_advance_returned_ugx: true
      },
      where: {
        order: { outlet, business_date: businessDate }
      }
    });

    const netAdvances =
      Number(advances._sum.rider_advance_ugx || 0) -
      Number(advances._sum.rider_advance_returned_ugx || 0);
    const expectedCash = Number(cash._sum.amount_ugx || 0) - netAdvances;

    await prisma.cash_counts.create({
      data: {
        outlet,
        business_date: businessDate,
        counted_cash_ugx: expectedCash,
        expected_cash_ugx: expectedCash,
        variance_ugx: 0,
        counted_by: outlet === 'FOODIZO_HAM_TOWERS' ? cyrus.id : zito.id,
        notes: 'Seed drawer count — balanced against cash sales less rider float.'
      }
    });
  }

  // 12. GENERATE TODAY'S DIGEST FIXTURE from real seeded rows.
  const summary = await DigestService.generateDigest(prisma, businessDate);
  await DigestService.persistDigest(prisma, summary, 'GENERATED');

  console.log('Seeding completed successfully.');
  console.log('Staff accounts seeded (PIN: 1234):');
  console.log('  Manager / Admin : Zito Mbowe       256700000000  (cross-outlet)');
  console.log('  Manager / Admin : Cyrus M.         256768550986  (Foodizo Ham Towers)');
  console.log('  Waiter / FOH    : Sarah K.         256772555666  (Foodizo Ham Towers)');
  console.log('  Kitchen Staff   : Chef Juma        256772333444  (Foodizo Ham Towers)');
  console.log('  Waiter / FOH    : Mubiru Mahad     256760723280  (Obunuzi YMCA)');
  console.log('  Waiter / FOH    : Prossy N.        256772111222  (Obunuzi YMCA)');
  console.log('  Kitchen Staff   : Chef Aisha       256772777888  (Obunuzi YMCA)');
  console.log(
    `  Tables          : 16 per outlet (T-01..T-12, B-01..B-04); tokens up to ${summary.outlets[0].totalOrders} completed orders today.`
  );
}

if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
