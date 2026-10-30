import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { TokenService } from '../services/tokenService.js';
import { CreateOrderInput, OrderStatus } from '../types/index.js';

const createOrderSchema = z.object({
  outlet: z.enum(['FOODIZO_HAM_TOWERS', 'OBUNUZI_YMCA']),
  channel: z.enum(['DINE_IN', 'TAKEAWAY_PICKUP', 'PHONE_DELIVERY']),
  tableId: z.string().uuid().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  deliveryZoneId: z.string().uuid().optional(),
  deliveryAddressNote: z.string().optional(),
  gpsLatitude: z.number().optional(),
  gpsLongitude: z.number().optional(),
  items: z.array(
    z.object({
      menuItemId: z.string().uuid(),
      quantity: z.number().int().positive(),
      notes: z.string().optional()
    })
  ).min(1)
});

export const orderRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/v1/orders
  fastify.post<{ Body: CreateOrderInput }>('/', async (request, reply) => {
    const data = createOrderSchema.parse(request.body);

    // 1. Fetch menu items for authoritative server-owned pricing
    const itemIds = data.items.map((i) => i.menuItemId);
    const menuItems = await fastify.prisma.menu_items.findMany({
      where: { id: { in: itemIds } }
    });

    if (menuItems.length !== itemIds.length) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'One or more menu items are invalid or no longer available'
      });
    }

    const priceMap = new Map(menuItems.map((m) => [m.id, { price: Number(m.price_ugx), name: m.name, station: m.station }]));

    let foodTotalUgx = 0;
    const orderItemsData = data.items.map((i) => {
      const itemInfo = priceMap.get(i.menuItemId)!;
      const subtotal = itemInfo.price * i.quantity;
      foodTotalUgx += subtotal;

      return {
        menu_item_id: i.menuItemId,
        menu_item_name: itemInfo.name,
        station: itemInfo.station,
        quantity: i.quantity,
        unit_price_ugx: itemInfo.price,
        line_total_ugx: subtotal,
        special_notes: i.notes || null
      };
    });

    // Delivery fee calculation
    let deliveryFeeUgx = 0;
    if (data.channel === 'PHONE_DELIVERY' && data.deliveryZoneId) {
      const zone = await fastify.prisma.delivery_zones.findUnique({
        where: { id: data.deliveryZoneId }
      });
      if (zone) {
        deliveryFeeUgx = Number(zone.fee_ugx);
      }
    }

    const totalAmountUgx = foodTotalUgx + deliveryFeeUgx;

    // Determine initial order status
    // DINE_IN tabs created by waitstaff start at PENDING.
    // Digital takeaway/delivery orders start at AWAITING_PAYMENT until MoMo payment confirms.
    const initialStatus: OrderStatus = data.channel === 'DINE_IN' ? 'PENDING' : 'AWAITING_PAYMENT';

    // Issue digital token
    const token = await TokenService.getNextToken(fastify.prisma, data.outlet);
    const orderNumber = `ORD-${Date.now().toString().slice(-6)}`;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Create order atomically
    const order = await fastify.prisma.$transaction(async (tx) => {
      const created = await tx.orders.create({
        data: {
          public_ref: orderNumber,
          outlet: data.outlet,
          business_date: today,
          channel: data.channel,
          status: initialStatus,
          table_id: data.tableId || null,
          digital_token: token,
          customer_name: data.customerName || null,
          customer_phone: data.customerPhone || null,
          delivery_zone_id: data.deliveryZoneId || null,
          delivery_note: data.deliveryAddressNote || null,
          delivery_lat: data.gpsLatitude ? Number(data.gpsLatitude) : null,
          delivery_lng: data.gpsLongitude ? Number(data.gpsLongitude) : null,
          subtotal_ugx: foodTotalUgx,
          delivery_fee_ugx: deliveryFeeUgx,
          total_amount_ugx: totalAmountUgx,
          order_items: {
            create: orderItemsData
          }
        },
        include: {
          order_items: {
            include: { menu_item: true }
          }
        }
      });

      // If Dine-in, mark table OCCUPIED
      if (data.channel === 'DINE_IN' && data.tableId) {
        await tx.restaurant_tables.update({
          where: { id: data.tableId },
          data: { status: 'OCCUPIED' }
        });
      }

      return created;
    });

    // Broadcast ticket creation to KDS & FOH via WebSocket
    if (order.status === 'PENDING') {
      fastify.broadcastWs({
        event: 'TICKET_CREATED',
        outlet: order.outlet,
        data: {
          orderId: order.id,
          orderNumber: order.public_ref,
          tokenNumber: order.digital_token,
          channel: order.channel,
          items: order.order_items.map((oi) => ({
            name: oi.menu_item.name,
            quantity: oi.quantity,
            notes: oi.special_notes,
            station: oi.menu_item.station
          }))
        }
      });
    }

    return reply.status(201).send({
      success: true,
      order: {
        id: order.id,
        orderNumber: order.public_ref,
        tokenNumber: order.digital_token,
        channel: order.channel,
        status: order.status,
        totalUgx: Number(order.total_amount_ugx),
        items: order.order_items.map((i) => ({
          name: i.menu_item.name,
          quantity: i.quantity,
          unitPrice: Number(i.unit_price_ugx),
          subtotal: Number(i.line_total_ugx)
        }))
      }
    });
  });

  // GET /api/v1/orders/:id
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params;
    const order = await fastify.prisma.orders.findUnique({
      where: { id },
      include: {
        order_items: { include: { menu_item: true } },
        table: true,
        delivery_zone: true,
        payments: true
      }
    });

    if (!order) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: `Order ${id} not found`
      });
    }

    return reply.send({
      success: true,
      order
    });
  });

  // GET /api/v1/orders/token/:token
  fastify.get<{ Params: { token: string } }>('/token/:token', async (request, reply) => {
    const { token } = request.params;
    const cleanToken = token.startsWith('#') ? token : `#${token}`;

    const order = await fastify.prisma.orders.findFirst({
      where: { digital_token: cleanToken },
      include: {
        order_items: { include: { menu_item: true } },
        delivery_zone: true
      },
      orderBy: { created_at: 'desc' }
    });

    if (!order) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: `Token ${token} not found`
      });
    }

    return reply.send({
      success: true,
      token: order.digital_token,
      orderNumber: order.public_ref,
      status: order.status,
      outlet: order.outlet,
      createdAt: order.created_at,
      channel: order.channel,
      items: order.order_items.map((oi) => ({
        name: oi.menu_item.name,
        quantity: oi.quantity
      }))
    });
  });
};

