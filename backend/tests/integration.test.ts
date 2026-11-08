import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHmac } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { config } from '../src/config.js';
import { getKampalaBusinessDate } from '../src/services/tokenService.js';
import { main as seedDatabase } from '../prisma/seed.js';

const probe = new PrismaClient();
let dbReachable = false;
try {
  await probe.$queryRaw`SELECT 1`;
  dbReachable = true;
} catch {
  dbReachable = false;
} finally {
  await probe.$disconnect();
}

const describeIntegration = dbReachable ? describe : describe.skip;

type Json = Record<string, any>;

describeIntegration('Foodizo & Obunuzi API integration', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let tokens: Record<string, string>;
  let staff: Record<string, { id: string; outlet: string | null; role: string }>;
  let menu: Record<string, { foodizoChicken: string; foodizoRolex: string; obunuziLuwombo: string }>;
  let tableIds: Record<string, string>;
  let zoneIds: Record<string, string>;

  const auth = (token: string) => ({ authorization: `Bearer ${token}` });

  async function inject(
    method: 'GET' | 'POST' | 'PATCH',
    url: string,
    options: { token?: string; payload?: unknown; headers?: Record<string, string> } = {}
  ) {
    const headers: Record<string, string> = { ...(options.headers || {}) };
    if (options.token) headers.authorization = `Bearer ${options.token}`;

    return app.inject({
      method,
      url,
      headers,
      ...(options.payload !== undefined ? { payload: options.payload as any } : {})
    });
  }

  function signWebhook(payload: Json) {
    const raw = JSON.stringify(payload);
    const signature = createHmac('sha256', config.PAYMENTS_WEBHOOK_SECRET)
      .update(raw)
      .digest('hex');
    return { raw, signature: `sha256=${signature}` };
  }

  async function createOrder(
    token: string,
    body: Json
  ): Promise<{ statusCode: number; body: Json }> {
    const res = await inject('POST', '/api/v1/orders', { token, payload: body });
    return { statusCode: res.statusCode, body: res.json() as Json };
  }

  async function createPaidOrder(input: {
    outlet: 'FOODIZO_HAM_TOWERS' | 'OBUNUZI_YMCA';
    token: string;
    menuItemId: string;
    quantity?: number;
    channel?: 'TAKEAWAY_PICKUP' | 'PHONE_DELIVERY';
    customerPhone?: string;
    customerName?: string;
    zoneId?: string;
    note?: string;
  }): Promise<Json> {
    const channel = input.channel || 'TAKEAWAY_PICKUP';
    const orderBody: Json = {
      outlet: input.outlet,
      channel,
      customerPhone: input.customerPhone || '256770555444',
      items: [{ menuItemId: input.menuItemId, quantity: input.quantity || 1 }]
    };
    if (channel === 'PHONE_DELIVERY') {
      orderBody.customerName = input.customerName || 'Integration Customer';
      orderBody.deliveryZoneId = input.zoneId;
      orderBody.deliveryAddressNote = input.note || 'Call at the reception desk';
    }
    const created = await createOrder(input.token, orderBody);
    expect(created.statusCode).toBe(201);
    const order = created.body.order as Json;

    const settled = await inject('POST', `/api/v1/orders/${order.id}/settle`, {
      token: input.token,
      payload: {
        paymentMethod: 'MTN',
        amountUgx: order.totalUgx,
        customerMsisdn: input.customerPhone || '256770555444'
      }
    });
    expect(settled.statusCode).toBe(202);
    const referenceId = (settled.json() as Json).referenceId as string;

    const payload: Json = {
      provider: 'MTN',
      eventId: `evt-${referenceId}`,
      referenceId,
      status: 'SUCCESSFUL',
      amountUgx: order.totalUgx,
      financialTransactionId: `FIN-${referenceId.slice(0, 8)}`
    };
    const signed = signWebhook(payload);
    const callback = await inject('POST', '/api/v1/payments/webhook', {
      headers: { 'content-type': 'application/json', 'x-foodizo-signature': signed.signature },
      payload: signed.raw
    });
    expect(callback.statusCode).toBe(200);
    expect((callback.json() as Json).status).toBe('ACKNOWLEDGED');

    return order;
  }

  beforeAll(async () => {
    // The integration suite mutates operational data (tables, payments,
    // counters). Rebuild the canonical seed so repeated runs start from the
    // same fixture the dashboards and documentation describe.
    await seedDatabase();

    app = await buildApp();

    const users = await app.prisma.users.findMany({
      select: { id: true, full_name: true, role: true, outlet: true }
    });
    const byName = Object.fromEntries(users.map((user) => [user.full_name, user]));
    staff = {
      zito: byName['Zito Mbowe'],
      cyrus: byName['Cyrus M.'],
      sarah: byName['Sarah K.'],
      juma: byName['Chef Juma'],
      mubiru: byName['Mubiru Mahad'],
      prossy: byName['Prossy N.'],
      aisha: byName['Chef Aisha']
    };

    tokens = {};
    for (const [key, user] of Object.entries(staff)) {
      const res = await inject('POST', '/api/v1/auth/pin', {
        payload: { staffId: user.id, pin: '1234' }
      });
      expect(res.statusCode, `login for ${key}`).toBe(200);
      tokens[key] = (res.json() as Json).token as string;
    }

    const chicken = await app.prisma.menu_items.findFirstOrThrow({
      where: { outlet: 'FOODIZO_HAM_TOWERS', name: '2pc Fried Chicken & Chips' }
    });
    const rolex = await app.prisma.menu_items.findFirstOrThrow({
      where: { outlet: 'FOODIZO_HAM_TOWERS', name: 'Regular Rolex (2 Eggs, 1 Chapati)' }
    });
    const luwombo = await app.prisma.menu_items.findFirstOrThrow({
      where: { outlet: 'OBUNUZI_YMCA', name: 'Traditional Beef Luwombo' }
    });
    menu = {
      foodizoChicken: chicken.id,
      foodizoRolex: rolex.id,
      obunuziLuwombo: luwombo.id
    };

    const tables = await app.prisma.restaurant_tables.findMany({
      select: { id: true, outlet: true, table_label: true }
    });
    tableIds = Object.fromEntries(
      tables.map((table) => [`${table.outlet}:${table.table_label}`, table.id])
    );

    const zones = await app.prisma.delivery_zones.findMany({
      select: { id: true, outlet: true, zone_code: true }
    });
    zoneIds = Object.fromEntries(
      zones.map((zone) => [`${zone.outlet}:${zone.zone_code}`, zone.id])
    );
  });

  afterAll(async () => {
    await app?.close();
  });

  it('serves a public staff directory without leaking phone numbers or PIN hashes', async () => {
    const res = await inject('GET', '/api/v1/auth/terminal-staff');
    expect(res.statusCode).toBe(200);

    const body = res.json() as Json;
    expect(body.staff).toHaveLength(7);
    expect(body.staff.some((row: Json) => row.fullName === 'Prossy N.')).toBe(true);
    expect(body.staff.some((row: Json) => row.fullName === 'Chef Aisha')).toBe(true);

    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('256772111222');
    expect(serialized).not.toContain('pinHash');
    expect(body.staff[0].roleLabel).toBeDefined();
  });

  it('authenticates by staffId, returns canonical role labels/home paths, and enforces logout revocation', async () => {
    const me = await inject('GET', '/api/v1/auth/me', { token: tokens.prossy });
    expect(me.statusCode).toBe(200);
    const meBody = me.json() as Json;
    expect(meBody.user.role).toBe('WAITER_FOH');
    expect(meBody.user.roleLabel).toBe('Waiter / FOH');
    expect(meBody.user.homePath).toBe('/pos');
    expect(meBody.user.outlet).toBe('OBUNUZI_YMCA');

    const kitchenMe = await inject('GET', '/api/v1/auth/me', { token: tokens.juma });
    expect((kitchenMe.json() as Json).user.homePath).toBe('/kds');

    const managerMe = await inject('GET', '/api/v1/auth/me', { token: tokens.zito });
    expect((managerMe.json() as Json).user.homePath).toBe('/admin');

    // Aisha's token is used only for the revocation assertion.
    const logout = await inject('POST', '/api/v1/auth/logout', { token: tokens.aisha });
    expect(logout.statusCode).toBe(200);
    const after = await inject('GET', '/api/v1/auth/me', { token: tokens.aisha });
    expect(after.statusCode).toBe(401);

    // Later tests use this token to prove cross-outlet rejection, so restore
    // the session after asserting revocation.
    const relogin = await inject('POST', '/api/v1/auth/pin', {
      payload: { staffId: staff.aisha.id, pin: '1234' }
    });
    expect(relogin.statusCode).toBe(200);
    tokens.aisha = (relogin.json() as Json).token as string;
  });

  it('rejects cross-role and cross-outlet access while allowing a cross-outlet manager', async () => {
    const order = await app.prisma.orders.findFirstOrThrow({
      where: { outlet: 'FOODIZO_HAM_TOWERS', status: 'PREPARING' }
    });

    const kitchenSettle = await inject('POST', `/api/v1/orders/${order.id}/settle`, {
      token: tokens.juma,
      payload: { paymentMethod: 'CASH', amountUgx: Number(order.total_amount_ugx) }
    });
    expect(kitchenSettle.statusCode).toBe(403);

    const waiterKds = await inject('GET', '/api/v1/kds/tickets', { token: tokens.prossy });
    expect(waiterKds.statusCode).toBe(403);

    const wrongOutlet = await inject('GET', `/api/v1/orders/${order.id}`, {
      token: tokens.prossy
    });
    expect(wrongOutlet.statusCode).toBe(403);

    const managerRead = await inject('GET', `/api/v1/orders/${order.id}`, {
      token: tokens.zito
    });
    expect(managerRead.statusCode).toBe(200);

    const wrongOutletTables = await inject(
      'GET',
      '/api/v1/tables?outlet=FOODIZO_HAM_TOWERS',
      { token: tokens.prossy }
    );
    expect(wrongOutletTables.statusCode).toBe(403);
  });

  it('validates order creation, computes totals server-side, and blocks duplicate table tabs', async () => {
    const publicDineIn = await inject('POST', '/api/v1/orders', {
      payload: {
        outlet: 'FOODIZO_HAM_TOWERS',
        channel: 'DINE_IN',
        tableId: tableIds['FOODIZO_HAM_TOWERS:T-01'],
        items: [{ menuItemId: menu.foodizoChicken, quantity: 1 }]
      }
    });
    expect(publicDineIn.statusCode).toBe(401);
    expect((publicDineIn.json() as Json).code).toBe('POSTPAY_REQUIRES_STAFF');

    const conflict = await createOrder(tokens.sarah, {
      outlet: 'FOODIZO_HAM_TOWERS',
      channel: 'DINE_IN',
      tableId: tableIds['FOODIZO_HAM_TOWERS:T-04'],
      items: [{ menuItemId: menu.foodizoChicken, quantity: 1 }]
    });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.body.code).toBe('TABLE_ALREADY_OCCUPIED');

    const crossOutletZone = await createOrder(tokens.cyrus, {
      outlet: 'FOODIZO_HAM_TOWERS',
      channel: 'PHONE_DELIVERY',
      customerName: 'Zone Mismatch',
      customerPhone: '256770555111',
      deliveryZoneId: zoneIds['OBUNUZI_YMCA:YMCA_MAIN'],
      deliveryAddressNote: 'Reception',
      items: [{ menuItemId: menu.foodizoChicken, quantity: 1 }]
    });
    expect(crossOutletZone.statusCode).toBe(400);
    expect(crossOutletZone.body.code).toBe('INVALID_DELIVERY_ZONE');

    const created = await createOrder(tokens.cyrus, {
      outlet: 'FOODIZO_HAM_TOWERS',
      channel: 'TAKEAWAY_PICKUP',
      customerPhone: '256770555222',
      items: [{ menuItemId: menu.foodizoChicken, quantity: 2 }]
    });
    expect(created.statusCode).toBe(201);
    const order = created.body.order as Json;
    expect(order.tokenNumber).toMatch(/^TOKEN-\d{3,6}$/);
    expect(order.status).toBe('AWAITING_PAYMENT');
    expect(order.subtotalUgx).toBe(28000);
    expect(order.totalUgx).toBe(28000);

    const tokenLookup = await inject(
      'GET',
      `/api/v1/orders/token/${order.tokenNumber}?outlet=FOODIZO_HAM_TOWERS`
    );
    expect(tokenLookup.statusCode).toBe(200);
    const publicOrder = tokenLookup.json() as Json;
    expect(publicOrder.displayToken).toMatch(/^#\d{3,6}$/);
    expect(publicOrder.items).toHaveLength(1);
    expect(JSON.stringify(publicOrder)).not.toContain('256770555222');
  });

  it('does not rewind kitchen state on cash settlement and releases a READY table for clearing', async () => {
    const created = await createOrder(tokens.sarah, {
      outlet: 'FOODIZO_HAM_TOWERS',
      channel: 'DINE_IN',
      tableId: tableIds['FOODIZO_HAM_TOWERS:T-10'],
      items: [{ menuItemId: menu.foodizoChicken, quantity: 1 }]
    });
    expect(created.statusCode).toBe(201);
    const order = created.body.order as Json;
    expect(order.status).toBe('PENDING');

    const claim = await inject('POST', `/api/v1/kds/${order.id}/claim`, {
      token: tokens.juma
    });
    expect(claim.statusCode).toBe(200);

    const bump = await inject('POST', `/api/v1/kds/${order.id}/bump`, {
      token: tokens.juma,
      payload: {}
    });
    expect(bump.statusCode).toBe(200);

    const settled = await inject('POST', `/api/v1/orders/${order.id}/settle`, {
      token: tokens.sarah,
      payload: {
        paymentMethod: 'CASH',
        amountUgx: order.totalUgx,
        tenderedCashUgx: order.totalUgx + 5000
      }
    });
    expect(settled.statusCode).toBe(200);
    const body = settled.json() as Json;
    expect(body.changeUgx).toBe(5000);
    expect(body.kitchenStatus).toBe('READY');
    expect(body.tableStatus).toBe('NEEDS_CLEARING');

    const retry = await inject('POST', `/api/v1/orders/${order.id}/settle`, {
      token: tokens.sarah,
      payload: { paymentMethod: 'CASH', amountUgx: order.totalUgx }
    });
    expect(retry.statusCode).toBe(200);
    expect((retry.json() as Json).alreadySettled).toBe(true);
  });

  it('requires a signature and de-duplicates payment webhooks', async () => {
    const created = await createOrder(tokens.cyrus, {
      outlet: 'FOODIZO_HAM_TOWERS',
      channel: 'TAKEAWAY_PICKUP',
      customerPhone: '256770555333',
      items: [{ menuItemId: menu.foodizoRolex, quantity: 2 }]
    });
    expect(created.statusCode).toBe(201);
    const order = created.body.order as Json;

    const push = await inject('POST', '/api/v1/payments/momo/push', {
      token: tokens.cyrus,
      payload: {
        orderId: order.id,
        phoneNumber: '0770555333',
        carrier: 'MTN'
      }
    });
    expect(push.statusCode).toBe(202);
    const pushBody = push.json() as Json;
    expect(pushBody.amountUgx).toBe(order.totalUgx);
    const referenceId = pushBody.referenceId as string;

    const unsigned = await inject('POST', '/api/v1/payments/webhook', {
      payload: { referenceId, status: 'SUCCESSFUL' }
    });
    expect(unsigned.statusCode).toBe(401);

    const payload: Json = {
      provider: 'MTN',
      eventId: `evt-${referenceId}`,
      referenceId,
      status: 'SUCCESSFUL',
      amountUgx: order.totalUgx,
      financialTransactionId: 'FIN-INTEGRATION-1'
    };
    const signed = signWebhook(payload);

    const success = await inject('POST', '/api/v1/payments/webhook', {
      headers: { 'content-type': 'application/json', 'x-foodizo-signature': signed.signature },
      payload: signed.raw
    });
    expect(success.statusCode).toBe(200);
    expect((success.json() as Json).status).toBe('ACKNOWLEDGED');

    const duplicate = await inject('POST', '/api/v1/payments/webhook', {
      headers: { 'content-type': 'application/json', 'x-foodizo-signature': signed.signature },
      payload: signed.raw
    });
    expect(duplicate.statusCode).toBe(200);
    expect((duplicate.json() as Json).status).toBe('ALREADY_PROCESSED');

    const detail = await inject('GET', `/api/v1/orders/${order.id}`, {
      token: tokens.zito
    });
    const detailBody = (detail.json() as Json).order as Json;
    expect(detailBody.status).toBe('PENDING');
    expect(detailBody.payments[0].status).toBe('SUCCESSFUL');

    // A second attempt with a different amount must not settle the order.
    const created2 = await createOrder(tokens.cyrus, {
      outlet: 'FOODIZO_HAM_TOWERS',
      channel: 'TAKEAWAY_PICKUP',
      items: [{ menuItemId: menu.foodizoRolex, quantity: 1 }]
    });
    const order2 = created2.body.order as Json;
    const push2 = await inject('POST', '/api/v1/payments/momo/push', {
      token: tokens.cyrus,
      payload: { orderId: order2.id, phoneNumber: '0770555333', carrier: 'MTN' }
    });
    const reference2 = (push2.json() as Json).referenceId as string;
    const mismatch = signWebhook({
      provider: 'MTN',
      eventId: `evt-${reference2}`,
      referenceId: reference2,
      status: 'SUCCESSFUL',
      amountUgx: order2.totalUgx + 1000
    });
    const mismatchRes = await inject('POST', '/api/v1/payments/webhook', {
      headers: { 'content-type': 'application/json', 'x-foodizo-signature': mismatch.signature },
      payload: mismatch.raw
    });
    expect(mismatchRes.statusCode).toBe(400);
    expect((mismatchRes.json() as Json).code).toBe('AMOUNT_MISMATCH');
  });

  it('scopes KDS tickets, hides customer PII, and enforces claim/bump transitions', async () => {
    const paid = await createPaidOrder({
      outlet: 'FOODIZO_HAM_TOWERS',
      token: tokens.cyrus,
      menuItemId: menu.foodizoChicken,
      customerPhone: '256770555444'
    });

    const queue = await inject('GET', '/api/v1/kds/tickets?outlet=FOODIZO_HAM_TOWERS', {
      token: tokens.juma
    });
    expect(queue.statusCode).toBe(200);
    const queueBody = queue.json() as Json;
    const ticket = queueBody.tickets.find((row: Json) => row.id === paid.id);
    expect(ticket).toBeDefined();
    expect(JSON.stringify(ticket)).not.toContain('256770555444');
    expect(ticket.destination).toBe('Takeaway Counter');

    const foreignClaim = await inject('POST', `/api/v1/kds/${paid.id}/claim`, {
      token: tokens.aisha
    });
    expect(foreignClaim.statusCode).toBe(403);

    const claim = await inject('POST', `/api/v1/kds/${paid.id}/claim`, {
      token: tokens.juma
    });
    expect(claim.statusCode).toBe(200);

    const duplicateClaim = await inject('POST', `/api/v1/kds/${paid.id}/claim`, {
      token: tokens.juma
    });
    expect(duplicateClaim.statusCode).toBe(409);

    const bump = await inject('POST', `/api/v1/kds/${paid.id}/bump`, {
      token: tokens.juma,
      payload: {}
    });
    expect(bump.statusCode).toBe(200);
    expect((bump.json() as Json).order.status).toBe('READY');
  });

  it('handles manager cancellation and closes a mobile-money refund', async () => {
    const paid = await createPaidOrder({
      outlet: 'FOODIZO_HAM_TOWERS',
      token: tokens.cyrus,
      menuItemId: menu.foodizoChicken,
      customerPhone: '256770555666'
    });

    const waiterCancel = await inject('POST', `/api/v1/orders/${paid.id}/cancel`, {
      token: tokens.sarah,
      payload: { reason: 'Waiter should not be allowed' }
    });
    expect(waiterCancel.statusCode).toBe(403);

    const cancel = await inject('POST', `/api/v1/orders/${paid.id}/cancel`, {
      token: tokens.zito,
      payload: { reason: 'Customer cancelled after paying' }
    });
    expect(cancel.statusCode).toBe(200);

    const detail = await inject('GET', `/api/v1/orders/${paid.id}`, {
      token: tokens.zito
    });
    const order = (detail.json() as Json).order as Json;
    expect(order.status).toBe('CANCELLED');
    expect(order.payments[0].status).toBe('REFUND_PENDING');
    expect(order.payments[0].audit_flag).toBe('CANCELLED_AFTER_PAYMENT');

    const refund = await inject('POST', `/api/v1/payments/${order.payments[0].id}/refund`, {
      token: tokens.zito,
      payload: { refundReference: 'MOMO-REVERSAL-INTEGRATION-1' }
    });
    expect(refund.statusCode).toBe(200);

    const detailAfter = await inject('GET', `/api/v1/orders/${paid.id}`, {
      token: tokens.zito
    });
    expect((detailAfter.json() as Json).order.payments[0].status).toBe('REFUNDED');
  });

  it('assigns a rider, exposes delivery queue states, and completes the handoff', async () => {
    const order = await createPaidOrder({
      outlet: 'FOODIZO_HAM_TOWERS',
      token: tokens.cyrus,
      menuItemId: menu.foodizoChicken,
      channel: 'PHONE_DELIVERY',
      customerPhone: '256770555777',
      customerName: 'Delivery Integration',
      zoneId: zoneIds['FOODIZO_HAM_TOWERS:MK_LUMUMBA'],
      note: 'Block C, Room 12'
    });

    await inject('POST', `/api/v1/kds/${order.id}/claim`, { token: tokens.juma });
    const bump = await inject('POST', `/api/v1/kds/${order.id}/bump`, {
      token: tokens.juma,
      payload: {}
    });
    expect(bump.statusCode).toBe(200);

    const kitchenQueue = await inject('GET', '/api/v1/dispatch/queue', {
      token: tokens.juma
    });
    expect(kitchenQueue.statusCode).toBe(403);

    const queue = await inject(
      'GET',
      '/api/v1/dispatch/queue?outlet=FOODIZO_HAM_TOWERS&state=active',
      { token: tokens.sarah }
    );
    expect(queue.statusCode).toBe(200);
    const queueBody = queue.json() as Json;
    const queued = queueBody.queue.find((row: Json) => row.id === order.id);
    expect(queued).toBeDefined();
    expect(queued.handoffState).toBe('AWAITING_RIDER');
    expect(JSON.stringify(queued)).toContain('256770555777');

    const assign = await inject('POST', `/api/v1/orders/${order.id}/dispatch`, {
      token: tokens.sarah,
      payload: {
        riderName: 'Rider Integration',
        riderPhone: '256701110000',
        bodaPlateNumber: 'UEX 999Z',
        bodaStage: 'Wandegeya',
        advanceCashUgx: 2000,
        dispatchMethod: 'CALL'
      }
    });
    expect(assign.statusCode).toBe(200);

    const duplicate = await inject('POST', `/api/v1/orders/${order.id}/dispatch`, {
      token: tokens.sarah,
      payload: {
        riderName: 'Rider Integration',
        riderPhone: '256701110000',
        advanceCashUgx: 0
      }
    });
    expect(duplicate.statusCode).toBe(409);

    const onTheWay = await inject(
      'GET',
      '/api/v1/dispatch/queue?outlet=FOODIZO_HAM_TOWERS&state=active',
      { token: tokens.sarah }
    );
    const onTheWayRow = (onTheWay.json() as Json).queue.find(
      (row: Json) => row.id === order.id
    );
    expect(onTheWayRow.handoffState).toBe('ON_THE_WAY');

    const review = await inject(
      'GET',
      '/api/v1/dispatch/queue?outlet=FOODIZO_HAM_TOWERS&state=review',
      { token: tokens.cyrus }
    );
    expect(review.statusCode).toBe(200);
    expect((review.json() as Json).count).toBeGreaterThan(0);

    const complete = await inject('POST', `/api/v1/orders/${order.id}/delivery-complete`, {
      token: tokens.sarah
    });
    expect(complete.statusCode).toBe(200);

    const detail = await inject('GET', `/api/v1/orders/${order.id}`, { token: tokens.sarah });
    const completed = (detail.json() as Json).order as Json;
    expect(completed.status).toBe('COMPLETED');
    expect(completed.handoffs[0].outcome).toBe('DELIVERED');
  });

  it('exposes 16 outlet tables, protects occupied tables, and reports drawer-kick truthfully', async () => {
    const tables = await inject('GET', '/api/v1/tables', { token: tokens.sarah });
    expect(tables.statusCode).toBe(200);
    const tableRows = (tables.json() as Json).tables as Json[];
    expect(tableRows).toHaveLength(16);
    expect(tableRows.map((row) => row.label)).toContain('B-04');

    const occupy = await inject('PATCH', `/api/v1/tables/${tableIds['FOODIZO_HAM_TOWERS:B-04']}/status`, {
      token: tokens.sarah,
      payload: { status: 'OCCUPIED', assignedWaiterId: staff.sarah.id }
    });
    expect(occupy.statusCode).toBe(200);
    expect((occupy.json() as Json).table.currentWaiterId).toBe(staff.sarah.id);

    const vacateActive = await inject(
      'PATCH',
      `/api/v1/tables/${tableIds['FOODIZO_HAM_TOWERS:T-04']}/status`,
      { token: tokens.sarah, payload: { status: 'VACANT' } }
    );
    expect(vacateActive.statusCode).toBe(409);
    expect((vacateActive.json() as Json).code).toBe('TABLE_HAS_ACTIVE_ORDER');

    const drawer = await inject('POST', '/api/v1/tables/drawer/kick', {
      token: tokens.sarah,
      payload: { reason: 'Integration drawer check' }
    });
    const drawerBody = drawer.json() as Json;
    expect(typeof drawerBody.released).toBe('boolean');
    expect(drawerBody.success).toBe(drawerBody.released);
    if (!drawerBody.released) {
      expect(drawer.statusCode).toBe(503);
      expect(drawerBody.message).toContain('did not confirm release');
    }
  });

  it('computes, reconciles, dispatches, and links the daily digest without exposing PII', async () => {
    const forbidden = await inject('GET', '/api/v1/digest/preview', { token: tokens.sarah });
    expect(forbidden.statusCode).toBe(403);

    const preview = await inject(
      'GET',
      '/api/v1/digest/preview?outlet=FOODIZO_HAM_TOWERS',
      { token: tokens.cyrus }
    );
    expect(preview.statusCode).toBe(200);
    const previewBody = preview.json() as Json;
    const summary = previewBody.summary as Json;
    expect(summary.outlets).toHaveLength(1);
    expect(summary.outlets[0].outlet).toBe('FOODIZO_HAM_TOWERS');
    expect(summary.outlets[0].grossUgx).toBeGreaterThan(0);
    expect(Array.isArray(summary.flags)).toBe(true);

    const overview = await inject('GET', '/api/v1/digest/overview', { token: tokens.zito });
    expect(overview.statusCode).toBe(200);
    const overviewBody = overview.json() as Json;
    expect(overviewBody.summary.outlets).toHaveLength(2);
    expect(overviewBody.staff).toHaveLength(7);
    const tableTotal = (overviewBody.tables as Json[]).reduce(
      (sum, row) => sum + Number(row.count),
      0
    );
    expect(tableTotal).toBe(32);

    const expected = Number(summary.outlets[0].expectedCashUgx);
    const reconcile = await inject('POST', '/api/v1/digest/reconcile-cash', {
      token: tokens.cyrus,
      payload: { countedCashUgx: expected + 1500, notes: 'Integration count' }
    });
    expect(reconcile.statusCode).toBe(200);
    expect((reconcile.json() as Json).varianceUgx).toBe(1500);

    const dispatch = await inject('POST', '/api/v1/digest/dispatch-now', {
      token: tokens.zito,
      payload: {}
    });
    expect(dispatch.statusCode).toBe(200);
    const dispatchBody = dispatch.json() as Json;
    expect(dispatchBody.digestStatus).toBe('PARTIAL');
    expect(dispatchBody.smsStatus).toBe('MOCK');
    expect(dispatchBody.emailStatus).toBe('NOT_CONFIGURED');
    expect(dispatchBody.channelsSent).toContain('SMS_MOCK');
    expect(dispatchBody.summary.link).toMatch(/\/d\/[a-z0-9]+$/);

    const linkToken = String(dispatchBody.summary.link).split('/').pop();
    const view = await inject('GET', `/api/v1/digest/view/${linkToken}`);
    expect(view.statusCode).toBe(200);
    const viewBody = view.json() as Json;
    expect(viewBody.grossUgx).toBeGreaterThan(0);
    expect(JSON.stringify(viewBody)).not.toContain('256770555777');
    expect(JSON.stringify(viewBody)).not.toContain('Block C');

    const cashCount = await app.prisma.cash_counts.findUnique({
      where: {
        cash_counts_unique: {
          outlet: 'FOODIZO_HAM_TOWERS',
          business_date: getKampalaBusinessDate()
        }
      }
    });
    expect(cashCount?.variance_ugx?.toString()).toBe('1500');
  });
});
