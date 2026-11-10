import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { BomService } from '../services/bomService.js';
import { PrinterService } from '../services/printerService.js';
import { SmsService } from '../services/smsService.js';
import { OutletLocation } from '../types/index.js';

const kdsQuerySchema = z.object({
  outlet: z.enum(['FOODIZO_HAM_TOWERS', 'OBUNUZI_YMCA']).optional(),
  station: z.enum(['STEAM_LINE', 'GRILL_FRYER', 'ROLEX_GRIDDLE', 'BAR_BEVERAGE']).optional()
});

const stationBodySchema = z.object({
  station: z.enum(['STEAM_LINE', 'GRILL_FRYER', 'ROLEX_GRIDDLE', 'BAR_BEVERAGE']).optional()
});

function resolveOutlet(
  actorOutlet: OutletLocation | null,
  requested: OutletLocation | undefined
): { outlet?: OutletLocation; error?: string } {
  if (actorOutlet) {
    if (requested && requested !== actorOutlet) {
      return { error: `This account is scoped to ${actorOutlet}.` };
    }
    return { outlet: actorOutlet };
  }
  return { outlet: requested };
}

function assertOrderOutlet(actorOutlet: OutletLocation | null, orderOutlet: OutletLocation) {
  return !actorOutlet || actorOutlet === orderOutlet;
}

export const kdsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/kds/tickets — kitchen staff only, outlet-scoped.
  fastify.get(
    '/tickets',
    { preHandler: [fastify.requireRole(['KITCHEN_STAFF', 'MANAGER_ADMIN'])] },
    async (request, reply) => {
      const query = kdsQuerySchema.parse(request.query);
      const { outlet, error } = resolveOutlet(request.user!.outlet, query.outlet);
      if (error) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          code: 'OUTLET_FORBIDDEN',
          message: error
        });
      }

      const activeOrders = await fastify.prisma.orders.findMany({
        where: {
          status: { in: ['PENDING', 'PREPARING'] },
          ...(outlet && { outlet }),
          ...(query.station && {
            order_items: {
              some: { station: query.station }
            }
          })
        },
        include: {
          order_items: true,
          table: true,
          delivery_zone: true
        },
        orderBy: { created_at: 'asc' }
      });

      const now = Date.now();
      const tickets = activeOrders.map((order) => {
        const elapsedMinutes = Math.floor((now - new Date(order.created_at).getTime()) / 60000);
        const stationItems = order.order_items.filter(
          (item) => !query.station || item.station === query.station
        );

        return {
          id: order.id,
          orderNumber: order.public_ref,
          tokenNumber: order.digital_token,
          outlet: order.outlet,
          channel: order.channel,
          status: order.status,
          elapsedMinutes,
          isOverdue: elapsedMinutes >= 10,
          destination:
            order.table?.table_label ||
            order.delivery_zone?.display_name ||
            'Takeaway Counter',
          items: stationItems.map((item) => ({
            id: item.id,
            name: item.menu_item_name,
            quantity: item.quantity,
            notes: item.special_notes,
            station: item.station,
            isBumped: item.is_bumped
          }))
        };
      });

      return reply.send({
        success: true,
        outlet: outlet || 'ALL',
        station: query.station || 'ALL',
        activeCount: tickets.length,
        tickets
      });
    }
  );

  // POST /api/v1/kds/:id/claim — PENDING -> PREPARING.
  fastify.post<{ Params: { id: string } }>(
    '/:id/claim',
    { preHandler: [fastify.requireRole(['KITCHEN_STAFF', 'MANAGER_ADMIN'])] },
    async (request, reply) => {
      const order = await fastify.prisma.orders.findUnique({
        where: { id: request.params.id },
        include: { order_items: true }
      });

      if (!order) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          code: 'ORDER_NOT_FOUND',
          message: `Order ${request.params.id} not found`
        });
      }

      if (!assertOrderOutlet(request.user!.outlet, order.outlet)) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          code: 'OUTLET_FORBIDDEN',
          message: 'This order belongs to another outlet.'
        });
      }

      if (order.status !== 'PENDING') {
        return reply.status(409).send({
          statusCode: 409,
          error: 'Conflict',
          code: 'INVALID_KDS_TRANSITION',
          message: `Cannot claim order with status ${order.status}.`
        });
      }

      const updated = await fastify.prisma.orders.update({
        where: { id: order.id },
        data: { status: 'PREPARING' }
      });

      try {
        await BomService.deductOrderBom(fastify.prisma, order.id);
      } catch (bomErr) {
        fastify.log.warn({ err: bomErr, orderId: order.id }, 'BOM deduction warning on claim');
      }

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
    }
  );

  // POST /api/v1/kds/:id/bump — PREPARING/PENDING -> READY, print chit, SMS.
  fastify.post<{ Params: { id: string }; Body: { station?: string } }>(
    '/:id/bump',
    { preHandler: [fastify.requireRole(['KITCHEN_STAFF', 'MANAGER_ADMIN'])] },
    async (request, reply) => {
      const { station } = stationBodySchema.parse(request.body || {});

      const order = await fastify.prisma.orders.findUnique({
        where: { id: request.params.id },
        include: {
          order_items: true,
          table: true,
          delivery_zone: true
        }
      });

      if (!order) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          code: 'ORDER_NOT_FOUND',
          message: `Order ${request.params.id} not found`
        });
      }

      if (!assertOrderOutlet(request.user!.outlet, order.outlet)) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          code: 'OUTLET_FORBIDDEN',
          message: 'This order belongs to another outlet.'
        });
      }

      if (order.status !== 'PREPARING' && order.status !== 'PENDING') {
        return reply.status(409).send({
          statusCode: 409,
          error: 'Conflict',
          code: 'INVALID_KDS_TRANSITION',
          message: `Cannot bump order with status ${order.status}.`
        });
      }

      const updated = await fastify.prisma.$transaction(async (tx) => {
        if (station) {
          await tx.order_items.updateMany({
            where: { order_id: order.id, station },
            data: { is_bumped: true }
          });
        } else {
          await tx.order_items.updateMany({
            where: { order_id: order.id },
            data: { is_bumped: true }
          });
        }

        return tx.orders.update({
          where: { id: order.id },
          data: {
            status: 'READY',
            ready_at: new Date()
          }
        });
      });

      PrinterService.printChit({
        orderNumber: updated.public_ref,
        tokenNumber: updated.digital_token,
        channel: updated.channel,
        tableOrZone:
          order.table?.table_label ||
          order.delivery_zone?.display_name ||
          'Takeaway Counter',
        customerName: order.customer_name || undefined,
        customerPhone: order.customer_phone || undefined,
        deliveryNotes: order.delivery_note || undefined,
        items: order.order_items.map((item) => ({
          name: item.menu_item_name,
          quantity: item.quantity,
          notes: item.special_notes || undefined
        })),
        totalUgx: Number(order.total_amount_ugx)
      }).catch((err) => fastify.log.warn({ err }, 'Printer chit print failed'));

      if (updated.channel === 'TAKEAWAY_PICKUP' && order.customer_phone) {
        const outletLabel =
          updated.outlet === 'FOODIZO_HAM_TOWERS' ? 'Foodizo Ham Towers' : 'Obunuzi YMCA';
        SmsService.sendPickupAlert(order.customer_phone, updated.digital_token, outletLabel).catch(
          (err) => fastify.log.warn({ err }, 'Pickup SMS alert failed')
        );
      }

      fastify.broadcastWs({
        event: 'TOKEN_READY',
        outlet: updated.outlet,
        data: {
          orderId: updated.id,
          tokenNumber: updated.digital_token,
          channel: updated.channel,
          destination:
            order.table?.table_label ||
            order.delivery_zone?.display_name ||
            'Takeaway Counter',
          status: 'READY'
        }
      });

      return reply.send({
        success: true,
        message: `Order ${updated.digital_token} bumped to READY`,
        order: updated
      });
    }
  );
};
