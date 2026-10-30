import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const DEMO_PIN = '1234';
const BCRYPT_COST = 10;

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

export async function main() {
  console.log('Seeding Foodizo & Obunuzi operational database...');

  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DESTRUCTIVE_SEED !== 'true') {
    throw new Error('Refusing to run the destructive seed in production.');
  }

  // 1. CLEAN EXISTING DEVELOPMENT DATA
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
  await prisma.user_sessions.deleteMany();
  await prisma.users.deleteMany();

  // 2. CREATE STAFF ACCOUNTS
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

  await prisma.users.create({
    data: {
      full_name: 'Mr. Cyrus',
      phone_number: '256768550986',
      role: 'MANAGER_ADMIN',
      outlet: 'FOODIZO_HAM_TOWERS',
      pin_hash: pinHash
    }
  });

  await prisma.users.create({
    data: {
      full_name: 'Mr. Mubiru Mahad',
      phone_number: '256760723280',
      role: 'WAITER_FOH',
      outlet: 'OBUNUZI_YMCA',
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

  // 4. CREATE DELIVERY ZONES
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

  const outlets = ['FOODIZO_HAM_TOWERS', 'OBUNUZI_YMCA'] as const;
  for (const outlet of outlets) {
    await prisma.delivery_zones.createMany({
      data: zoneTemplate.map((zone) => ({ ...zone, outlet }))
    });
  }

  // 5. CREATE MENU ITEMS
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

  // 6. CREATE RAW INVENTORY
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
      current_stock: 25000,
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

  // 7. CREATE BILL OF MATERIALS (BOM)
  await prisma.recipe_bom.createMany({
    data: [
      { menu_item_id: foodizoMenu['Regular Rolex (2 Eggs, 1 Chapati)'].id, raw_material_id: eggs.id,    quantity_deducted: 2 },
      { menu_item_id: foodizoMenu['Regular Rolex (2 Eggs, 1 Chapati)'].id, raw_material_id: oil.id,     quantity_deducted: 15 },
      { menu_item_id: foodizoMenu['2pc Fried Chicken & Chips'].id, raw_material_id: chicken.id,  quantity_deducted: 2 },
      { menu_item_id: foodizoMenu['2pc Fried Chicken & Chips'].id, raw_material_id: potatoes.id, quantity_deducted: 250 },
      { menu_item_id: foodizoMenu['2pc Fried Chicken & Chips'].id, raw_material_id: oil.id,      quantity_deducted: 50 },
      { menu_item_id: obunuziMenu['Traditional Beef Luwombo'].id, raw_material_id: beef.id,    quantity_deducted: 350 },
      { menu_item_id: obunuziMenu['Traditional Beef Luwombo'].id, raw_material_id: matooke.id, quantity_deducted: 1 },
      { menu_item_id: obunuziMenu['Steamed Matooke'].id, raw_material_id: matooke.id, quantity_deducted: 1 }
    ]
  });

  console.log('Seeding completed successfully.');
  console.log('Staff accounts seeded (Phone / PIN: 1234):');
  console.log('  Manager: 256700000000 (Zito Mbowe) - Cross-outlet');
  console.log('  Manager: 256768550986 (Mr. Cyrus) - Foodizo Ham Towers');
  console.log('  Waitstaff Lead: 256760723280 (Mr. Mubiru Mahad) - Obunuzi YMCA');
  console.log('  Waitstaff: 256772111222 (Prossy N.) - Obunuzi YMCA');
  console.log('  Kitchen Cook: 256772333444 (Chef Juma) - Foodizo Ham Towers');
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

