import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { BomService } from '../services/bomService.js';
import { PrinterService } from '../services/printerService.js';
import { SmsService } from '../services/smsService.js';

const kdsQuerySchema = z.object({
  outlet: z.enum(['FOODIZO_HAM_TOWERS', 'OBUNUZI_YMCA']).optional(),
  station: z.enum(['STEAM_LINE', 'GRILL_FRYER', 'ROLEX_GRIDDLE', 'BAR_BEVERAGE']).optional()
});

export const kdsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/kds/tickets
  fastify.get('/tickets', async (request, reply) => {
    const { outlet, station } = kdsQuerySchema.parse(request.query);

    const activeOrders = await fastify.prisma.orders.findMany({
      where: {
        status: { in: ['PENDING', 'PREPARING'] },
        ...(outlet && { outlet }),
        ...(station && {
          order_items: {
            some: { menu_item: { station } }
          }
        })
      },
      include: {
        order_items: {
          include: { menu_item: true }
        },
        table: true,
        delivery_zone: true
      },
      orderBy: { created_at: 'asc' }
    });

    const now = Date.now();
    const tickets = activeOrders.map((o) => {
      const elapsedMinutes = Math.floor((now - new Date(o.created_at).getTime()) / 60000);
      const isOverdue = elapsedMinutes >= 10;

      return {
        id: o.id,
        orderNumber: o.public_ref,
        tokenNumber: o.digital_token,
        outlet: o.outlet,
        channel: o.channel,
        status: o.status,
        elapsedMinutes,
        isOverdue,
        destination: o.table?.table_label || o.delivery_zone?.display_name || 'Takeaway Counter',
        items: o.order_items
          .filter((oi) => !station || oi.menu_item.station === station)
          .map((oi) => ({
            name: oi.menu_item.name,
            quantity: oi.quantity,
            notes: oi.special_notes,
            station: oi.menu_item.station
          }))
      };
    });

    return reply.send({
      success: true,
      activeCount: tickets.length,
      tickets
    });
  });

  // POST /api/v1/kds/:id/claim (State 1: CLAIM PREPARING)
  fastify.post<{ Params: { id: string } }>('/:id/claim', async (request, reply) => {
    const { id } = request.params;

    const order = await fastify.prisma.orders.findUnique({
      where: { id },
      include: { order_items: { include: { menu_item: true } } }
    });

    if (!order) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: `Order ${id} not found`
      });
    }

    if (order.status !== 'PENDING') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: `Cannot claim order with status ${order.status}`
      });
    }

    // 1. Advance state to PREPARING
    const updated = await fastify.prisma.orders.update({
      where: { id },
      data: { status: 'PREPARING' }
    });

    // 2. Decrement Bill of Materials from raw_inventory
    try {
      await BomService.deductOrderBom(fastify.prisma, order.id);
    } catch (bomErr: any) {
      fastify.log.warn({ err: bomErr }, 'BOM deduction warning on claim');
    }

    // 3. Broadcast WebSocket event
    fastify.broadcastWs({
      event: 'TICKET_UPDATED',
      outlet: updated.outlet,
      data: {
        orderId: updated.id,
        status: 'PREPARING',
        tokenNumber: updated.digital_token
      }
    });

    return reply.send({
      success: true,
      message: `Order ${updated.digital_token} transitioned to PREPARING`,
      order: updated
    });
  });

  // POST /api/v1/kds/:id/bump (State 2: BUMP TO READY)
  fastify.post<{ Params: { id: string } }>('/:id/bump', async (request, reply) => {
    const { id } = request.params;

    const order = await fastify.prisma.orders.findUnique({
      where: { id },
      include: {
        order_items: { include: { menu_item: true } },
        table: true,
        delivery_zone: true
      }
    });

    if (!order) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: `Order ${id} not found`
      });
    }

    if (order.status !== 'PREPARING' && order.status !== 'PENDING') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: `Cannot bump order with status ${order.status}`
      });
    }

    // 1. Advance state to READY
    const updated = await fastify.prisma.orders.update({
      where: { id },
      data: { status: 'READY' }
    });

    // 2. Print Thermal Chit on Station #4 Expo Pass (Fail-open)
    PrinterService.printChit({
      orderNumber: updated.public_ref,
      tokenNumber: updated.digital_token,
      channel: updated.channel,
      tableOrZone: order.table?.table_label || order.delivery_zone?.display_name || 'Takeaway Counter',
      customerName: order.customer_name || undefined,
      customerPhone: order.customer_phone || undefined,
      deliveryNotes: order.delivery_note || undefined,
      items: order.order_items.map((oi) => ({
        name: oi.menu_item.name,
        quantity: oi.quantity,
        notes: oi.special_notes || undefined
      })),
      totalUgx: Number(order.total_amount_ugx)
    }).catch((err) => fastify.log.warn({ err }, 'Printer chit print failed'));

    // 3. Dispatch Pickup SMS if Takeaway and phone provided
    if (updated.channel === 'TAKEAWAY_PICKUP' && order.customer_phone) {
      const outletLabel = updated.outlet === 'FOODIZO_HAM_TOWERS' ? 'Foodizo Ham Towers' : 'Obunuzi YMCA';
      SmsService.sendPickupAlert(order.customer_phone, updated.digital_token, outletLabel)
        .catch((err) => fastify.log.warn({ err }, 'Pickup SMS alert failed'));
    }

    // 4. Broadcast TOKEN_READY on WebSocket bus
    fastify.broadcastWs({
      event: 'TOKEN_READY',
      outlet: updated.outlet,
      data: {
        orderId: updated.id,
        tokenNumber: updated.digital_token,
        channel: updated.channel
      }
    });

    return reply.send({
      success: true,
      message: `Order ${updated.digital_token} bumped to READY`,
      order: updated
    });
  });
};

