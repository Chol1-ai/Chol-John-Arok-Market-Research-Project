import { randomUUID } from 'crypto';
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { TokenService, getKampalaBusinessDate } from '../services/tokenService.js';
import { PrinterService } from '../services/printerService.js';
import { MomoService } from '../services/momoService.js';
import { assignRiderToOrder, completeOrderDelivery, HandoffError } from '../services/handoffService.js';
import {
  findInventoryShortages,
  inventoryAvailabilityReason
} from '../services/inventoryAvailability.js';
import { normalizeUgandanPhone } from '../utils/phone.js';
import { CreateOrderInput, OrderStatus, SettleOrderInput } from '../types/index.js';

const createOrderSchema = z
  .object({
    outlet: z.enum(['FOODIZO_HAM_TOWERS', 'OBUNUZI_YMCA']),
    channel: z.enum(['DINE_IN', 'TAKEAWAY_PICKUP', 'PHONE_DELIVERY']),
    tableId: z.string().uuid().optional(),
    customerName: z.string().trim().min(2).max(80).optional(),
    customerPhone: z.string().min(9).max(20).optional(),
    deliveryZoneId: z.string().uuid().optional(),
    deliveryAddressNote: z.string().trim().min(3).max(160).optional(),
    gpsLatitude: z.number().min(-90).max(90).optional(),
    gpsLongitude: z.number().min(-180).max(180).optional(),
    items: z
      .array(
        z.object({
          menuItemId: z.string().uuid(),
          quantity: z.number().int().positive().max(50),
          notes: z.string().trim().max(200).optional()
        })
      )
      .min(1)
  })
  .superRefine((value, ctx) => {
    if (value.channel === 'DINE_IN' && !value.tableId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['tableId'],
        message: 'tableId is required for DINE_IN orders'
      });
    }

    if (value.channel === 'PHONE_DELIVERY') {
      if (!value.deliveryZoneId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['deliveryZoneId'],
          message: 'deliveryZoneId is required for PHONE_DELIVERY orders'
        });
      }
      if (!value.customerPhone) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['customerPhone'],
          message: 'customerPhone is required for PHONE_DELIVERY orders'
        });
      }
      if (!value.customerName) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['customerName'],
          message: 'customerName is required for PHONE_DELIVERY orders'
        });
      }
      if (!value.deliveryAddressNote) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['deliveryAddressNote'],
          message: 'A room, office, gate, or landmark note is required for delivery.'
        });
      }
    }
  });

const settleSchema = z.object({
  paymentMethod: z.enum(['MTN', 'AIRTEL', 'CASH', 'MANUAL_MOMO']),
  amountUgx: z.number().positive(),
  transactionReference: z.string().trim().min(3).max(100).optional(),
  externalTransactionId: z.string().trim().min(3).max(100).optional(),
  customerMsisdn: z.string().min(9).max(20).optional(),
  tenderedCashUgx: z.number().positive().optional()
});

const cancelSchema = z.object({
  reason: z.string().trim().min(3).max(250)
});

const appendItemsSchema = z.object({
  items: z
    .array(
      z.object({
        menuItemId: z.string().uuid(),
        quantity: z.number().int().positive().max(50),
        notes: z.string().trim().max(200).optional()
      })
    )
    .min(1)
});

const statusSchema = z.object({
  status: z.enum(['PENDING', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'])
});

const assignRiderSchema = z.object({
  riderName: z.string().trim().min(2).max(80),
  riderPhone: z.string().min(9).max(20),
  bodaPlateNumber: z.string().trim().max(20).optional(),
  bodaStage: z.string().trim().max(80).optional(),
  advanceCashUgx: z.number().nonnegative().default(0),
  dispatchMethod: z.enum(['CALL', 'WHATSAPP', 'COUNTER_HANDOFF']).optional()
});

const deliveryCompleteSchema = z.object({
  outcome: z
    .enum(['DELIVERED', 'FAILED_UNREACHABLE', 'REFUSED', 'RETURNED'])
    .default('DELIVERED'),
  riderAdvanceReturnedUgx: z.number().nonnegative().optional(),
  cashTenderedUgx: z.number().positive().optional()
});

const tokenLookupSchema = z.object({
  outlet: z.enum(['FOODIZO_HAM_TOWERS', 'OBUNUZI_YMCA']).optional()
});

function assertOutlet(actorOutlet: string | null, orderOutlet: string) {
  if (actorOutlet && actorOutlet !== orderOutlet) {
    return false;
  }
  return true;
}

function normalizeToken(raw: string): string {
  const upper = raw.trim().toUpperCase();
  if (upper.startsWith('TOKEN-')) return upper;
  if (/^#?\d{1,6}$/.test(upper)) {
    return `TOKEN-${upper.replace('#', '').padStart(3, '0')}`;
  }
  if (upper.startsWith('#')) return upper.slice(1);
  return upper;
}

function orderResponse(order: any) {
  return {
    id: order.id,
    orderNumber: order.public_ref,
    tokenNumber: order.digital_token,
    outlet: order.outlet,
    channel: order.channel,
    status: order.status,
    tableId: order.table_id,
    totalUgx: Number(order.total_amount_ugx),
    subtotalUgx: Number(order.subtotal_ugx),
    deliveryFeeUgx: Number(order.delivery_fee_ugx),
    createdAt: order.created_at,
    readyAt: order.ready_at,
    completedAt: order.completed_at,
    items: (order.order_items || []).map((item: any) => ({
      id: item.id,
      menuItemId: item.menu_item_id,
      name: item.menu_item_name,
      station: item.station,
      quantity: item.quantity,
      unitPriceUgx: Number(item.unit_price_ugx),
      lineTotalUgx: Number(item.line_total_ugx),
      notes: item.special_notes,
      isBumped: item.is_bumped
    }))
  };
}

export const orderRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/delivery-zones', async (request, reply) => {
    const { outlet } = z.object({
      outlet: z.enum(['FOODIZO_HAM_TOWERS', 'OBUNUZI_YMCA'])
    }).parse(request.query);
    const zones = await fastify.prisma.delivery_zones.findMany({
      where: { outlet, is_active: true },
      orderBy: [{ display_order: 'asc' }, { display_name: 'asc' }]
    });

    return reply.send({
      success: true,
      zones: zones.map((zone) => ({
        id: zone.id,
        outlet: zone.outlet,
        code: zone.zone_code,
        name: zone.display_name,
        landmarkGroup: zone.landmark_group,
        landmarkHint: zone.landmark_hint,
        feeUgx: Number(zone.fee_ugx),
        etaMinMinutes: zone.eta_min_minutes,
        etaMaxMinutes: zone.eta_max_minutes
      }))
    });
  });

  // POST /api/v1/orders
  fastify.post<{ Body: CreateOrderInput }>('/', async (request, reply) => {
    const data = createOrderSchema.parse(request.body);
    const isStaffSession = await fastify.authenticateOptional(request);
    const actor = isStaffSession ? request.user! : null;

    // DINE_IN is POSTPAY and therefore staff-only. A public/customer request
    // must never be able to open a table tab.
    if (data.channel === 'DINE_IN') {
      if (!actor || !['WAITER_FOH', 'MANAGER_ADMIN'].includes(actor.role)) {
        return reply.status(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          code: 'POSTPAY_REQUIRES_STAFF',
          message: 'DINE_IN table tabs require an authenticated waiter or manager session.'
        });
      }
    }

    if (
      !actor &&
      data.channel === 'TAKEAWAY_PICKUP' &&
      (!data.customerName || !data.customerPhone)
    ) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        code: 'CUSTOMER_DETAILS_REQUIRED',
        message: 'A customer name and mobile number are required for pickup orders.'
      });
    }

    if (actor?.outlet && actor.outlet !== data.outlet) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        code: 'OUTLET_FORBIDDEN',
        message: `This account is scoped to ${actor.outlet}.`
      });
    }

    const uniqueItemIds = [...new Set(data.items.map((item) => item.menuItemId))];
    const menuItems = await fastify.prisma.menu_items.findMany({
      where: { id: { in: uniqueItemIds } },
      include: { recipe_boms: { include: { raw_material: true } } }
    });

    if (menuItems.length !== uniqueItemIds.length) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        code: 'MENU_ITEM_NOT_FOUND',
        message: 'One or more menu items do not exist.'
      });
    }

    const unavailable = menuItems.find(
      (item) => item.outlet !== data.outlet || !item.is_active || item.is_86
    );
    if (unavailable) {
      return reply.status(409).send({
        statusCode: 409,
        error: 'Conflict',
        code: 'MENU_ITEM_UNAVAILABLE',
        message: `${unavailable.name} is not available at ${data.outlet}.`,
        menuItemId: unavailable.id
      });
    }

    const requestedQuantities = new Map<string, number>();
    for (const item of data.items) {
      requestedQuantities.set(
        item.menuItemId,
        (requestedQuantities.get(item.menuItemId) || 0) + item.quantity
      );
    }
    const shortages = findInventoryShortages(
      menuItems,
      requestedQuantities,
      data.outlet
    );
    if (shortages.length) {
      return reply.status(409).send({
        statusCode: 409,
        error: 'Conflict',
        code: 'INSUFFICIENT_INGREDIENT_STOCK',
        message: inventoryAvailabilityReason(shortages),
        shortages
      });
    }

    const menuMap = new Map(
      menuItems.map((item) => [
        item.id,
        {
          price: Number(item.price_ugx),
          name: item.name,
          station: item.station
        }
      ])
    );

    let foodTotalUgx = 0;
    const orderItemsData = data.items.map((item) => {
      const menuItem = menuMap.get(item.menuItemId)!;
      const lineTotal = menuItem.price * item.quantity;
      foodTotalUgx += lineTotal;

      return {
        menu_item_id: item.menuItemId,
        menu_item_name: menuItem.name,
        station: menuItem.station,
        quantity: item.quantity,
        unit_price_ugx: menuItem.price,
        line_total_ugx: lineTotal,
        special_notes: item.notes || null
      };
    });

    let deliveryFeeUgx = 0;
    if (data.channel === 'PHONE_DELIVERY') {
      const zone = await fastify.prisma.delivery_zones.findUnique({
        where: { id: data.deliveryZoneId }
      });

      if (!zone || !zone.is_active || zone.outlet !== data.outlet) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          code: 'INVALID_DELIVERY_ZONE',
          message: 'The selected delivery zone is invalid, inactive, or belongs to another outlet.'
        });
      }
      deliveryFeeUgx = Number(zone.fee_ugx);
    }

    if (data.channel === 'DINE_IN') {
      const table = await fastify.prisma.restaurant_tables.findUnique({
        where: { id: data.tableId }
      });

      if (!table || table.outlet !== data.outlet) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          code: 'INVALID_TABLE',
          message: 'The selected table does not exist at this outlet.'
        });
      }

      const openTab = await fastify.prisma.orders.findFirst({
        where: {
          table_id: table.id,
          channel: 'DINE_IN',
          status: { in: ['PENDING', 'PREPARING', 'READY'] }
        },
        select: { id: true, public_ref: true }
      });

      if (openTab) {
        return reply.status(409).send({
          statusCode: 409,
          error: 'Conflict',
          code: 'TABLE_ALREADY_OCCUPIED',
          message: `Table ${table.table_label} already has an open tab (${openTab.public_ref}).`,
          activeOrderId: openTab.id
        });
      }
    }

    const totalAmountUgx = foodTotalUgx + deliveryFeeUgx;
    const customerCashOnDelivery = !actor && data.channel === 'PHONE_DELIVERY';
    const initialStatus: OrderStatus =
      data.channel === 'DINE_IN' || customerCashOnDelivery ? 'PENDING' : 'AWAITING_PAYMENT';
    const businessDate = getKampalaBusinessDate();
    const token = await TokenService.getNextToken(fastify.prisma, data.outlet, businessDate);

    const order = await fastify.prisma.$transaction(async (tx) => {
      const created = await tx.orders.create({
        data: {
          public_ref: `ORD-${randomUUID().slice(0, 8).toUpperCase()}`,
          outlet: data.outlet,
          business_date: businessDate,
          channel: data.channel,
          status: initialStatus,
          table_id: data.tableId || null,
          created_by: actor?.userId || null,
          digital_token: token,
          customer_name: data.customerName || null,
          customer_phone: data.customerPhone ? normalizeUgandanPhone(data.customerPhone) : null,
          delivery_zone_id: data.deliveryZoneId || null,
          delivery_note: data.deliveryAddressNote || null,
          delivery_lat: data.gpsLatitude ?? null,
          delivery_lng: data.gpsLongitude ?? null,
          subtotal_ugx: foodTotalUgx,
          delivery_fee_ugx: deliveryFeeUgx,
          total_amount_ugx: totalAmountUgx,
          order_items: { create: orderItemsData }
        },
        include: {
          order_items: true,
          table: true,
          delivery_zone: true
        }
      });

      if (data.channel === 'DINE_IN' && data.tableId) {
        await tx.restaurant_tables.update({
          where: { id: data.tableId },
          data: {
            status: 'OCCUPIED',
            current_waiter_id: actor?.userId || null
          }
        });
      }

      return created;
    });

    if (order.status === 'PENDING') {
      fastify.broadcastWs({
        event: 'TICKET_CREATED',
        outlet: order.outlet,
        data: {
          orderId: order.id,
          orderNumber: order.public_ref,
          tokenNumber: order.digital_token,
          channel: order.channel,
          table: order.table?.table_label || null,
          items: order.order_items.map((item) => ({
            name: item.menu_item_name,
            quantity: item.quantity,
            notes: item.special_notes,
            station: item.station
          }))
        }
      });
    }

    return reply.status(201).send({
      success: true,
      order: orderResponse(order)
    });
  });

  fastify.get(
    '/awaiting-payment',
    { preHandler: [fastify.requireRole(['WAITER_FOH', 'MANAGER_ADMIN'])] },
    async (request, reply) => {
      const { outlet } = tokenLookupSchema.parse(request.query);
      if (request.user!.outlet && outlet && request.user!.outlet !== outlet) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          code: 'OUTLET_FORBIDDEN',
          message: 'This account cannot view orders from another outlet.'
        });
      }

      const scopedOutlet = request.user!.outlet || outlet;
      const orders = await fastify.prisma.orders.findMany({
        where: {
          status: 'AWAITING_PAYMENT',
          channel: 'TAKEAWAY_PICKUP',
          ...(scopedOutlet && { outlet: scopedOutlet })
        },
        include: { order_items: true },
        orderBy: { created_at: 'asc' },
        take: 50
      });

      return reply.send({
        success: true,
        orders: orders.map((order) => ({
          ...orderResponse(order),
          customerName: order.customer_name,
          customerPhone: order.customer_phone
        }))
      });
    }
  );

  // GET /api/v1/orders/token/:token — public, sanitized status screen.
  fastify.get<{ Params: { token: string } }>('/token/:token', async (request, reply) => {
    const { outlet } = tokenLookupSchema.parse(request.query);
    const token = normalizeToken(request.params.token);

    const matches = await fastify.prisma.orders.findMany({
      where: {
        digital_token: token,
        // Tokens are unique per outlet per business day, not globally. A
        // public lookup must not collide with yesterday's TOKEN-001.
        business_date: getKampalaBusinessDate(),
        ...(outlet && { outlet })
      },
      include: {
        order_items: true,
        delivery_zone: true
      },
      orderBy: { created_at: 'desc' },
      take: 5
    });

    if (matches.length === 0) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        code: 'TOKEN_NOT_FOUND',
        message: `Token ${token} not found.`
      });
    }

    if (matches.length > 1) {
      return reply.status(409).send({
        statusCode: 409,
        error: 'Conflict',
        code: 'TOKEN_OUTLET_REQUIRED',
        message: 'This token exists at more than one outlet. Add ?outlet=FOODIZO_HAM_TOWERS or ?outlet=OBUNUZI_YMCA.'
      });
    }

    const order = matches[0];
    return reply.send({
      success: true,
      token: order.digital_token,
      displayToken: `#${order.digital_token.replace('TOKEN-', '')}`,
      orderNumber: order.public_ref,
      status: order.status,
      outlet: order.outlet,
      createdAt: order.created_at,
      channel: order.channel,
      destination: order.delivery_zone?.display_name || null,
      items: order.order_items.map((item) => ({
        name: item.menu_item_name,
        quantity: item.quantity
      }))
    });
  });

  // GET /api/v1/orders/:id — staff only, outlet-scoped. Customer PII never
  // flows through the public token lookup above.
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [fastify.requireRole(['WAITER_FOH', 'MANAGER_ADMIN'])] },
    async (request, reply) => {
      const order = await fastify.prisma.orders.findUnique({
        where: { id: request.params.id },
        include: {
          order_items: true,
          table: true,
          delivery_zone: true,
          payments: true,
          handoffs: true
        }
      });

      if (!order) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: `Order ${request.params.id} not found`
        });
      }

      if (!assertOutlet(request.user!.outlet, order.outlet)) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          code: 'OUTLET_FORBIDDEN',
          message: 'This order belongs to another outlet.'
        });
      }

      return reply.send({
        success: true,
        order: {
          ...orderResponse(order),
          customerName: order.customer_name,
          customerPhone: order.customer_phone,
          deliveryNote: order.delivery_note,
          deliveryZone: order.delivery_zone?.display_name || null,
          deliveryLat: order.delivery_lat ? Number(order.delivery_lat) : null,
          deliveryLng: order.delivery_lng ? Number(order.delivery_lng) : null,
          tableLabel: order.table?.table_label || null,
          payments: order.payments,
          handoffs: order.handoffs
        }
      });
    }
  );

  // POST /api/v1/orders/:id/items — append lines to an open tab.
  fastify.post<{ Params: { id: string }; Body: { items: z.infer<typeof appendItemsSchema>['items'] } }>(
    '/:id/items',
    { preHandler: [fastify.requireRole(['WAITER_FOH', 'MANAGER_ADMIN'])] },
    async (request, reply) => {
      const { items } = appendItemsSchema.parse(request.body);
      const order = await fastify.prisma.orders.findUnique({
        where: { id: request.params.id }
      });

      if (!order) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: `Order ${request.params.id} not found`
        });
      }
      if (!assertOutlet(request.user!.outlet, order.outlet)) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          code: 'OUTLET_FORBIDDEN',
          message: 'This order belongs to another outlet.'
        });
      }
      if (['COMPLETED', 'CANCELLED'].includes(order.status)) {
        return reply.status(409).send({
          statusCode: 409,
          error: 'Conflict',
          code: 'ORDER_CLOSED',
          message: `Cannot add items to a ${order.status} order.`
        });
      }

      const uniqueItemIds = [...new Set(items.map((item) => item.menuItemId))];
      const menuItems = await fastify.prisma.menu_items.findMany({
        where: { id: { in: uniqueItemIds } },
        include: { recipe_boms: { include: { raw_material: true } } }
      });
      if (menuItems.length !== uniqueItemIds.length) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          code: 'MENU_ITEM_NOT_FOUND',
          message: 'One or more menu items do not exist.'
        });
      }

      const unavailable = menuItems.find(
        (item) => item.outlet !== order.outlet || !item.is_active || item.is_86
      );
      if (unavailable) {
        return reply.status(409).send({
          statusCode: 409,
          error: 'Conflict',
          code: 'MENU_ITEM_UNAVAILABLE',
          message: `${unavailable.name} is not available.`
        });
      }

      const requestedQuantities = new Map<string, number>();
      for (const item of items) {
        requestedQuantities.set(
          item.menuItemId,
          (requestedQuantities.get(item.menuItemId) || 0) + item.quantity
        );
      }
      const shortages = findInventoryShortages(
        menuItems,
        requestedQuantities,
        order.outlet
      );
      if (shortages.length) {
        return reply.status(409).send({
          statusCode: 409,
          error: 'Conflict',
          code: 'INSUFFICIENT_INGREDIENT_STOCK',
          message: inventoryAvailabilityReason(shortages),
          shortages
        });
      }

      const menuMap = new Map(
        menuItems.map((item) => [
          item.id,
          { price: Number(item.price_ugx), name: item.name, station: item.station }
        ])
      );

      let addedSubtotal = 0;
      const newRows = items.map((item) => {
        const menuItem = menuMap.get(item.menuItemId)!;
        const lineTotal = menuItem.price * item.quantity;
        addedSubtotal += lineTotal;
        return {
          order_id: order.id,
          menu_item_id: item.menuItemId,
          menu_item_name: menuItem.name,
          station: menuItem.station,
          quantity: item.quantity,
          unit_price_ugx: menuItem.price,
          line_total_ugx: lineTotal,
          special_notes: item.notes || null
        };
      });

      const updated = await fastify.prisma.$transaction(async (tx) => {
        await tx.order_items.createMany({ data: newRows });
        return tx.orders.update({
          where: { id: order.id },
          data: {
            subtotal_ugx: Number(order.subtotal_ugx) + addedSubtotal,
            total_amount_ugx: Number(order.total_amount_ugx) + addedSubtotal
          },
          include: { order_items: true }
        });
      });

      fastify.broadcastWs({
        event: 'TICKET_UPDATED',
        outlet: order.outlet,
        data: {
          orderId: order.id,
          tokenNumber: order.digital_token,
          status: updated.status,
          addedItems: newRows.map((row) => ({
            name: row.menu_item_name,
            quantity: row.quantity,
            station: row.station
          }))
        }
      });

      return reply.status(201).send({
        success: true,
        message: `Added ${newRows.length} line(s) to ${order.public_ref}.`,
        order: orderResponse(updated)
      });
    }
  );

  // POST /api/v1/orders/:id/settle — the documented bill-close contract.
  fastify.post<{ Params: { id: string }; Body: SettleOrderInput }>(
    '/:id/settle',
    { preHandler: [fastify.requireRole(['WAITER_FOH', 'MANAGER_ADMIN'])] },
    async (request, reply) => {
      const {
        paymentMethod,
        amountUgx,
        transactionReference,
        externalTransactionId,
        customerMsisdn,
        tenderedCashUgx
      } = settleSchema.parse(request.body);
      const reference = externalTransactionId || transactionReference;

      const order = await fastify.prisma.orders.findUnique({
        where: { id: request.params.id },
        include: {
          table: true,
          payments: {
            where: { status: 'SUCCESSFUL' }
          }
        }
      });

      if (!order) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: `Order ${request.params.id} not found`
        });
      }

      if (!assertOutlet(request.user!.outlet, order.outlet)) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          code: 'OUTLET_FORBIDDEN',
          message: 'This order belongs to another outlet.'
        });
      }

      if (['COMPLETED', 'CANCELLED'].includes(order.status)) {
        return reply.status(409).send({
          statusCode: 409,
          error: 'Conflict',
          code: 'ORDER_CLOSED',
          message: `Order ${order.public_ref} is already ${order.status}.`
        });
      }

      const orderTotal = Number(order.total_amount_ugx);
      if (Math.round(amountUgx) !== Math.round(orderTotal)) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          code: 'SETTLEMENT_AMOUNT_MISMATCH',
          message: `Settlement must equal the full order total of UGX ${orderTotal.toLocaleString()}.`,
          expectedAmountUgx: orderTotal
        });
      }

      // A verified MoMo webhook may already have settled this tab. Do not
      // create a duplicate payment on a POS retry; simply confirm the money
      // and release a table that the kitchen has already finished.
      if (order.payments.length > 0) {
        const alreadyPaid = order.payments.reduce((sum, payment) => sum + Number(payment.amount_ugx), 0);

        if (alreadyPaid >= orderTotal) {
          let tableStatus = order.table?.status;
          if (order.table_id && ['READY', 'COMPLETED'].includes(order.status)) {
            const table = await fastify.prisma.restaurant_tables.update({
              where: { id: order.table_id },
              data: { status: 'NEEDS_CLEARING', current_waiter_id: null }
            });
            tableStatus = table.status;
          }

          return reply.send({
            success: true,
            alreadySettled: true,
            message: `Order ${order.public_ref} is already fully paid.`,
            paymentId: order.payments[0].id,
            orderId: order.id,
            amountUgx: alreadyPaid,
            changeUgx: 0,
            kitchenStatus: order.status,
            tableStatus: tableStatus || null
          });
        }

        return reply.status(409).send({
          statusCode: 409,
          error: 'Conflict',
          code: 'ORDER_ALREADY_SETTLED',
          message: `Order ${order.public_ref} already has UGX ${alreadyPaid.toLocaleString()} recorded. Refund or reverse that payment before re-settling.`
        });
      }

      if (paymentMethod === 'MANUAL_MOMO' && !reference) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          code: 'TRANSACTION_REFERENCE_REQUIRED',
          message: 'A verified MoMo transaction reference is required for MANUAL_MOMO settlement.'
        });
      }

      const tendered = tenderedCashUgx ?? amountUgx;
      if (paymentMethod === 'CASH' && tendered < amountUgx) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          code: 'INSUFFICIENT_CASH_TENDERED',
          message: `Tendered cash UGX ${tendered.toLocaleString()} is below the bill total.`
        });
      }

      const changeUgx = paymentMethod === 'CASH' ? tendered - amountUgx : 0;

      // Telco settlement is asynchronous: create the attempt, send the STK
      // push, and let the signed webhook set SUCCESSFUL and unlock the KDS.
      if (paymentMethod === 'MTN' || paymentMethod === 'AIRTEL') {
        const msisdn = customerMsisdn || order.customer_phone;
        if (!msisdn) {
          return reply.status(400).send({
            statusCode: 400,
            error: 'Bad Request',
            code: 'CUSTOMER_MSISDN_REQUIRED',
            message: 'A customer mobile number is required to send a mobile-money prompt.'
          });
        }

        const idempotencyKey = randomUUID();
        const normalizedMsisdn = normalizeUgandanPhone(msisdn);
        const payment = await fastify.prisma.payments.create({
          data: {
            order_id: order.id,
            idempotency_key: idempotencyKey,
            carrier: paymentMethod,
            status: 'INITIATED',
            customer_msisdn: normalizedMsisdn,
            amount_ugx: amountUgx,
            recorded_by: request.user!.userId
          }
        });

        let push;
        try {
          push = await MomoService.requestToPay({
            orderId: order.id,
            phoneNumber: normalizedMsisdn,
            amountUgx,
            carrier: paymentMethod,
            idempotencyKey
          });
        } catch (error) {
          await fastify.prisma.payments.update({
            where: { id: payment.id },
            data: { status: 'FAILED', failure_reason: 'STK_PUSH_DISPATCH_FAILED' }
          });
          fastify.log.error({ err: error, orderId: order.id }, 'MoMo settlement push failed');
          return reply.status(502).send({
            statusCode: 502,
            error: 'Bad Gateway',
            code: 'MOMO_PUSH_FAILED',
            message: 'The provider did not accept the mobile-money prompt.'
          });
        }

        await fastify.prisma.payments.update({
          where: { id: payment.id },
          data: {
            status: push.status,
            external_transaction_id: push.carrierRef
          }
        });

        return reply.status(202).send({
          success: true,
          pending: true,
          message: `Mobile-money prompt sent to ${normalizedMsisdn}. Settlement completes on the verified provider callback.`,
          paymentId: payment.id,
          referenceId: idempotencyKey,
          amountUgx,
          kitchenStatus: order.status
        });
      }

      const result = await fastify.prisma.$transaction(async (tx) => {
        const payment = await tx.payments.create({
          data: {
            order_id: order.id,
            idempotency_key: randomUUID(),
            carrier: paymentMethod,
            status: 'SUCCESSFUL',
            amount_ugx: amountUgx,
            external_transaction_id: reference || `SETTLE-${Date.now()}`,
            recorded_by: request.user!.userId,
            manual_verified_by: paymentMethod === 'MANUAL_MOMO' ? request.user!.userId : null,
            manual_verified_at: paymentMethod === 'MANUAL_MOMO' ? new Date() : null,
            audit_flag: paymentMethod === 'MANUAL_MOMO' ? 'VERIFIED_MANUAL_MOMO' : null,
            completed_at: new Date()
          }
        });

        // A cash/manual payment unlocks a prepaid order for the kitchen but
        // never rewinds an order that is already cooking or ready.
        const promoted = await tx.orders.updateMany({
          where: { id: order.id, status: 'AWAITING_PAYMENT' },
          data: { status: 'PENDING' }
        });

        let tableStatus = order.table?.status || null;
        if (order.table_id && ['READY', 'COMPLETED'].includes(order.status)) {
          const table = await tx.restaurant_tables.update({
            where: { id: order.table_id },
            data: { status: 'NEEDS_CLEARING', current_waiter_id: null }
          });
          tableStatus = table.status;
        }

        await tx.audit_log.create({
          data: {
            actor_user_id: request.user!.userId,
            actor_role: request.user!.role,
            outlet: order.outlet,
            action: 'ORDER_SETTLED',
            entity_type: 'ORDER',
            entity_id: order.id,
            after_json: {
              paymentId: payment.id,
              paymentMethod,
              amountUgx,
              tenderedCashUgx: paymentMethod === 'CASH' ? tendered : null,
              changeUgx,
              promotedToPending: promoted.count === 1
            },
            ip_address: request.ip
          }
        });

        return { payment, promoted: promoted.count === 1, tableStatus };
      });

      const kitchenStatus = result.promoted ? 'PENDING' : order.status;

      if (result.promoted) {
        fastify.broadcastWs({
          event: 'TICKET_CREATED',
          outlet: order.outlet,
          data: {
            orderId: order.id,
            orderNumber: order.public_ref,
            tokenNumber: order.digital_token,
            channel: order.channel,
            table: order.table?.table_label || null,
            items: []
          }
        });
      }

      fastify.broadcastWs({
        event: 'ORDER_SETTLED',
        outlet: order.outlet,
        data: {
          orderId: order.id,
          tokenNumber: order.digital_token,
          table: order.table?.table_label || null,
          paymentMethod,
          amountUgx,
          kitchenStatus
        }
      });
      if (order.table_id && result.tableStatus === 'NEEDS_CLEARING') {
        fastify.broadcastWs({
          event: 'TABLE_STATUS_CHANGED',
          outlet: order.outlet,
          data: {
            tableId: order.table_id,
            label: order.table?.table_label,
            status: 'NEEDS_CLEARING'
          }
        });
      }

      return reply.send({
        success: true,
        message: `Order ${order.public_ref} settled via ${paymentMethod}`,
        paymentId: result.payment.id,
        orderId: order.id,
        amountUgx,
        tenderedCashUgx: paymentMethod === 'CASH' ? tendered : undefined,
        changeUgx,
        kitchenStatus,
        tableStatus: result.tableStatus
      });
    }
  );

  // POST /api/v1/orders/:id/cancel — manager-only destructive action. There is
  // no shared override PIN; the manager's own authenticated session is used.
  fastify.post<{ Params: { id: string }; Body: { reason: string } }>(
    '/:id/cancel',
    { preHandler: [fastify.requireRole(['MANAGER_ADMIN'])] },
    async (request, reply) => {
      const { reason } = cancelSchema.parse(request.body);
      const order = await fastify.prisma.orders.findUnique({
        where: { id: request.params.id },
        include: {
          table: true,
          payments: { where: { status: 'SUCCESSFUL' } }
        }
      });

      if (!order) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: `Order ${request.params.id} not found`
        });
      }
      if (!assertOutlet(request.user!.outlet, order.outlet)) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          code: 'OUTLET_FORBIDDEN',
          message: 'This order belongs to another outlet.'
        });
      }
      if (order.status === 'COMPLETED') {
        return reply.status(409).send({
          statusCode: 409,
          error: 'Conflict',
          code: 'COMPLETED_ORDER_REQUIRES_REFUND',
          message: 'A completed order cannot be cancelled; record a refund instead.'
        });
      }
      if (order.status === 'CANCELLED') {
        return reply.send({ success: true, message: 'Order is already cancelled.' });
      }

      const updated = await fastify.prisma.$transaction(async (tx) => {
        // Resolve the money in the same transaction as the cancellation.
        // MoMo success moves to REFUND_PENDING; cash stays in the drawer and
        // is surfaced as a CASH_REFUND_EXCEPTION in the digest.
        const refundPending: string[] = [];
        let cashRefundException = false;

        for (const payment of order.payments) {
          if (payment.carrier === 'CASH') {
            cashRefundException = true;
            continue;
          }

          await tx.payments.update({
            where: { id: payment.id },
            data: {
              status: 'REFUND_PENDING',
              audit_flag: 'CANCELLED_AFTER_PAYMENT'
            }
          });
          refundPending.push(payment.id);
        }

        const cancelled = await tx.orders.update({
          where: { id: order.id },
          data: {
            status: 'CANCELLED',
            cancelled_at: new Date(),
            cancelled_by: request.user!.userId,
            cancellation_reason: reason
          }
        });

        if (order.table_id) {
          const remaining = await tx.orders.count({
            where: {
              table_id: order.table_id,
              id: { not: order.id },
              status: { in: ['PENDING', 'PREPARING', 'READY'] }
            }
          });
          if (remaining === 0) {
            await tx.restaurant_tables.update({
              where: { id: order.table_id },
              data: { status: 'VACANT', current_waiter_id: null }
            });
          }
        }

        await tx.audit_log.create({
          data: {
            actor_user_id: request.user!.userId,
            actor_role: request.user!.role,
            outlet: order.outlet,
            action: 'ORDER_CANCELLED',
            entity_type: 'ORDER',
            entity_id: order.id,
            reason,
            before_json: { status: order.status },
            after_json: {
              status: 'CANCELLED',
              refundPending,
              cashRefundException
            },
            ip_address: request.ip
          }
        });

        return cancelled;
      });

      fastify.broadcastWs({
        event: 'ORDER_CANCELLED',
        outlet: order.outlet,
        data: { orderId: order.id, status: 'CANCELLED', tokenNumber: order.digital_token }
      });
      if (order.table_id) {
        fastify.broadcastWs({
          event: 'TABLE_STATUS_CHANGED',
          outlet: order.outlet,
          data: {
            tableId: order.table_id,
            label: order.table?.table_label,
            status: 'VACANT'
          }
        });
      }

      return reply.send({
        success: true,
        message: `Order ${order.public_ref} cancelled.`,
        orderId: updated.id
      });
    }
  );

  // POST /api/v1/orders/:id/status — documented KDS/FOH transition endpoint.
  fastify.post<{ Params: { id: string }; Body: { status: OrderStatus } }>(
    '/:id/status',
    { preHandler: [fastify.requireRole(['WAITER_FOH', 'KITCHEN_STAFF', 'MANAGER_ADMIN'])] },
    async (request, reply) => {
      const { status } = statusSchema.parse(request.body);
      const order = await fastify.prisma.orders.findUnique({
        where: { id: request.params.id },
        include: {
          table: true,
          payments: { where: { status: 'SUCCESSFUL' }, select: { id: true } }
        }
      });

      if (!order) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: `Order ${request.params.id} not found`
        });
      }
      if (!assertOutlet(request.user!.outlet, order.outlet)) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          code: 'OUTLET_FORBIDDEN',
          message: 'This order belongs to another outlet.'
        });
      }

      const allowedNext: Record<string, OrderStatus[]> = {
        AWAITING_PAYMENT: [],
        PENDING: ['PREPARING'],
        PREPARING: ['READY'],
        READY: ['COMPLETED'],
        COMPLETED: [],
        CANCELLED: []
      };

      if (order.status === status) {
        return reply.send({ success: true, message: `Order is already ${status}.`, order: orderResponse(order) });
      }
      if (!allowedNext[order.status]?.includes(status)) {
        return reply.status(409).send({
          statusCode: 409,
          error: 'Conflict',
          code: 'INVALID_ORDER_TRANSITION',
          message: `Cannot move order from ${order.status} to ${status}. Use /settle for payment closure.`
        });
      }

      const updated = await fastify.prisma.$transaction(async (tx) => {
        const row = await tx.orders.update({
          where: { id: order.id },
          data: {
            status,
            ...(status === 'READY' && { ready_at: new Date() }),
            ...(status === 'COMPLETED' && { completed_at: new Date() })
          },
          include: { order_items: true }
        });

        if (status === 'COMPLETED' && order.table_id) {
          await tx.restaurant_tables.update({
            where: { id: order.table_id },
            data: {
              status: order.payments.length > 0 ? 'NEEDS_CLEARING' : 'BILL_REQUESTED',
              current_waiter_id: null
            }
          });
        }

        return row;
      });

      fastify.broadcastWs({
        event: status === 'READY' ? 'TOKEN_READY' : 'TICKET_UPDATED',
        outlet: order.outlet,
        data: { orderId: order.id, status, tokenNumber: order.digital_token }
      });

      if (status === 'COMPLETED' && order.table_id) {
        fastify.broadcastWs({
          event: 'TABLE_STATUS_CHANGED',
          outlet: order.outlet,
          data: {
            tableId: order.table_id,
            label: order.table?.table_label,
            status: order.payments.length > 0 ? 'NEEDS_CLEARING' : 'BILL_REQUESTED'
          }
        });
      }

      return reply.send({ success: true, order: orderResponse(updated) });
    }
  );

  // POST /api/v1/orders/:id/reprint-chit
  fastify.post<{ Params: { id: string } }>(
    '/:id/reprint-chit',
    { preHandler: [fastify.requireRole(['WAITER_FOH', 'MANAGER_ADMIN'])] },
    async (request, reply) => {
      const order = await fastify.prisma.orders.findUnique({
        where: { id: request.params.id },
        include: { order_items: true, table: true, delivery_zone: true }
      });

      if (!order) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: `Order ${request.params.id} not found`
        });
      }
      if (!assertOutlet(request.user!.outlet, order.outlet)) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          code: 'OUTLET_FORBIDDEN',
          message: 'This order belongs to another outlet.'
        });
      }

      const printed = await PrinterService.printChit({
        orderNumber: order.public_ref,
        tokenNumber: order.digital_token,
        channel: order.channel,
        tableOrZone: order.table?.table_label || order.delivery_zone?.display_name || 'Takeaway Counter',
        customerName: order.customer_name || undefined,
        customerPhone: order.customer_phone || undefined,
        deliveryNotes: order.delivery_note || undefined,
        items: order.order_items.map((item) => ({
          name: item.menu_item_name,
          quantity: item.quantity,
          notes: item.special_notes || undefined
        })),
        totalUgx: Number(order.total_amount_ugx),
        reprint: true
      });

      await fastify.prisma.audit_log.create({
        data: {
          actor_user_id: request.user!.userId,
          actor_role: request.user!.role,
          outlet: order.outlet,
          action: 'CHIT_REPRINTED',
          entity_type: 'ORDER',
          entity_id: order.id,
          after_json: { printed },
          ip_address: request.ip
        }
      });

      return reply.send({
        success: true,
        printed,
        message: printed
          ? `Reprint sent to the thermal printer for ${order.public_ref}.`
          : 'Printer unavailable; the chit was not printed. Check the printer and reprint again.'
      });
    }
  );

  // POST /api/v1/orders/:id/dispatch — documented dispatch contract.
  fastify.post<{ Params: { id: string }; Body: z.infer<typeof assignRiderSchema> }>(
    '/:id/dispatch',
    { preHandler: [fastify.requireRole(['WAITER_FOH', 'MANAGER_ADMIN'])] },
    async (request, reply) => {
      const data = assignRiderSchema.parse(request.body);
      try {
        const handoff = await assignRiderToOrder(fastify.prisma, request.params.id, data, request.user!);
        return reply.send({
          success: true,
          message: `Boda rider ${data.riderName} assigned.`,
          handoff
        });
      } catch (error) {
        if (error instanceof HandoffError) {
          return reply.status(error.statusCode).send({
            statusCode: error.statusCode,
            error: error.name,
            code: error.code,
            message: error.message
          });
        }
        throw error;
      }
    }
  );

  // POST /api/v1/orders/:id/delivery-complete — documented dispatch contract.
  // Accepts the real outcome so a failed door drop is never recorded as a
  // successful delivery.
  fastify.post<{
    Params: { id: string };
    Body: { outcome?: string; riderAdvanceReturnedUgx?: number; cashTenderedUgx?: number };
  }>(
    '/:id/delivery-complete',
    { preHandler: [fastify.requireRole(['WAITER_FOH', 'MANAGER_ADMIN'])] },
    async (request, reply) => {
      const options = deliveryCompleteSchema.parse(request.body || {});

      try {
        const result = await completeOrderDelivery(
          fastify.prisma,
          request.params.id,
          request.user!,
          options
        );

        fastify.broadcastWs({
          event: 'DELIVERY_UPDATED',
          outlet: result.order.outlet,
          data: {
            orderId: result.order.id,
            orderNumber: result.order.public_ref,
            outcome: result.outcome,
            status: result.order.status
          }
        });

        return reply.send({
          success: true,
          message:
            result.outcome === 'DELIVERED'
              ? result.alreadyCompleted
                ? 'Delivery was already completed.'
                : 'Delivery marked complete.'
              : `Order ${result.order.public_ref} handoff recorded as ${result.outcome}.`,
          orderId: result.order.id,
          outcome: result.outcome,
          orderStatus: result.order.status,
          alreadyCompleted: result.alreadyCompleted,
          cashCollectedUgx: result.cashCollectedUgx || 0,
          changeUgx: result.changeUgx || 0
        });
      } catch (error) {
        if (error instanceof HandoffError) {
          return reply.status(error.statusCode).send({
            statusCode: error.statusCode,
            error: error.name,
            code: error.code,
            message: error.message
          });
        }
        throw error;
      }
    }
  );
};
