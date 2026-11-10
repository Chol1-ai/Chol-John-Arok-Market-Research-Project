import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { SmsService } from '../services/smsService.js';
import {
  assignRiderToOrder,
  completeOrderDelivery,
  HandoffError
} from '../services/handoffService.js';
import { AssignRiderInput, OutletLocation } from '../types/index.js';

const assignRiderSchema = z.object({
  riderName: z.string().trim().min(2).max(80),
  riderPhone: z.string().min(9).max(20),
  bodaPlateNumber: z.string().trim().max(20).optional(),
  bodaStage: z.string().trim().max(80).optional(),
  advanceCashUgx: z.number().nonnegative().default(0),
  dispatchMethod: z.enum(['CALL', 'WHATSAPP', 'COUNTER_HANDOFF']).optional()
});

const queueQuerySchema = z.object({
  outlet: z.enum(['FOODIZO_HAM_TOWERS', 'OBUNUZI_YMCA']).optional(),
  state: z.enum(['active', 'review']).default('active')
});

const completeSchema = z.object({
  outcome: z
    .enum(['DELIVERED', 'FAILED_UNREACHABLE', 'REFUSED', 'RETURNED'])
    .default('DELIVERED'),
  riderAdvanceReturnedUgx: z.number().nonnegative().optional(),
  cashTenderedUgx: z.number().positive().optional()
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

function mapHandoffError(error: unknown, reply: any) {
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

export const dispatchRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/dispatch/queue?outlet=...&state=active|review
  fastify.get(
    '/queue',
    { preHandler: [fastify.requireRole(['WAITER_FOH', 'MANAGER_ADMIN'])] },
    async (request, reply) => {
      const query = queueQuerySchema.parse(request.query);
      const { outlet, error } = resolveOutlet(request.user!.outlet, query.outlet);
      if (error) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          code: 'OUTLET_FORBIDDEN',
          message: error
        });
      }

      if (query.state === 'review') {
        const failed = await fastify.prisma.delivery_handoffs.findMany({
          where: {
            outcome: { in: ['FAILED_UNREACHABLE', 'REFUSED', 'RETURNED'] },
            reviewed: false,
            ...(outlet && { order: { outlet } })
          },
          include: {
            order: {
              include: {
                delivery_zone: true,
                order_items: true
              }
            },
            dispatcher: { select: { id: true, full_name: true } }
          },
          orderBy: { dispatched_at: 'desc' },
          take: 50
        });

        return reply.send({
          success: true,
          state: 'review',
          count: failed.length,
          queue: failed.map((handoff) => ({
            handoffId: handoff.id,
            orderId: handoff.order_id,
            orderNumber: handoff.order.public_ref,
            tokenNumber: handoff.order.digital_token,
            outcome: handoff.outcome,
            notes: handoff.notes,
            riderName: handoff.rider_name,
            riderPhone: handoff.rider_phone,
            dispatchedBy: handoff.dispatcher.full_name,
            dispatchedAt: handoff.dispatched_at,
            customerName: handoff.order.customer_name,
            customerPhone: handoff.order.customer_phone,
            destinationZone: handoff.order.delivery_zone?.display_name || null
          }))
        });
      }

      const queue = await fastify.prisma.orders.findMany({
        where: {
          channel: 'PHONE_DELIVERY',
          status: 'READY',
          ...(outlet && { outlet }),
          OR: [
            { handoffs: { none: {} } },
            { handoffs: { some: { outcome: 'PENDING' } } }
          ]
        },
        include: {
          delivery_zone: true,
          order_items: true,
          payments: { where: { status: 'SUCCESSFUL' } },
          handoffs: { orderBy: { dispatched_at: 'desc' } }
        },
        orderBy: { created_at: 'asc' }
      });

      const now = Date.now();
      return reply.send({
        success: true,
        state: 'active',
        count: queue.length,
        queue: queue.map((order) => {
          const openHandoff = order.handoffs.find((handoff) => handoff.outcome === 'PENDING');
          const lat = order.delivery_lat ? Number(order.delivery_lat) : null;
          const lng = order.delivery_lng ? Number(order.delivery_lng) : null;

          return {
            id: order.id,
            orderNumber: order.public_ref,
            tokenNumber: order.digital_token,
            status: order.status,
            outlet: order.outlet,
            handoffState: openHandoff ? 'ON_THE_WAY' : 'AWAITING_RIDER',
            customerName: order.customer_name,
            customerPhone: order.customer_phone,
            callLink: order.customer_phone ? `tel:+${order.customer_phone}` : null,
            destinationZone: order.delivery_zone?.display_name,
            landmarkHint: order.delivery_zone?.landmark_hint,
            roomNote: order.delivery_note,
            gpsLatitude: lat,
            gpsLongitude: lng,
            mapLink: lat !== null && lng !== null
              ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
              : null,
            totalUgx: Number(order.total_amount_ugx),
            cashOnDelivery: order.payments.length === 0,
            elapsedMinutes: Math.floor((now - new Date(order.created_at).getTime()) / 60000),
            items: order.order_items.map((item) => ({
              name: item.menu_item_name,
              quantity: item.quantity,
              notes: item.special_notes
            })),
            handoff: openHandoff
              ? {
                  id: openHandoff.id,
                  riderName: openHandoff.rider_name,
                  riderPhone: openHandoff.rider_phone,
                  riderAdvanceUgx: Number(openHandoff.rider_advance_ugx),
                  dispatchedAt: openHandoff.dispatched_at,
                  outcome: openHandoff.outcome
                }
              : null
          };
        })
      });
    }
  );

  // POST /api/v1/dispatch/:id/assign-rider — legacy alias for the documented
  // order-level handoff endpoint.
  fastify.post<{ Params: { id: string }; Body: AssignRiderInput }>(
    '/:id/assign-rider',
    { preHandler: [fastify.requireRole(['WAITER_FOH', 'MANAGER_ADMIN'])] },
    async (request, reply) => {
      const data = assignRiderSchema.parse(request.body);

      try {
        const handoff = await assignRiderToOrder(fastify.prisma, request.params.id, data, request.user!);
        const order = await fastify.prisma.orders.findUniqueOrThrow({
          where: { id: request.params.id }
        });

        let smsResult = null;
        if (order.customer_phone) {
          smsResult = await SmsService.sendDispatchAlert(
            order.customer_phone,
            order.public_ref,
            data.riderName,
            data.riderPhone
          );
        }

        return reply.send({
          success: true,
          message: `Boda rider ${data.riderName} assigned to order ${order.public_ref}.`,
          handoff,
          smsSent: smsResult?.success ?? false,
          smsMode: smsResult?.mode ?? null,
          smsDetail: smsResult?.detail ?? null
        });
      } catch (error) {
        return mapHandoffError(error, reply);
      }
    }
  );

  // POST /api/v1/dispatch/:id/complete — legacy alias. Accepts an outcome so a
  // failed delivery is not silently recorded as delivered.
  fastify.post<{ Params: { id: string }; Body: { outcome?: string; riderAdvanceReturnedUgx?: number } }>(
    '/:id/complete',
    { preHandler: [fastify.requireRole(['WAITER_FOH', 'MANAGER_ADMIN'])] },
    async (request, reply) => {
      const parsed = completeSchema.safeParse(request.body || {});
      if (!parsed.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          code: 'INVALID_DELIVERY_OUTCOME',
          message: 'Outcome must be DELIVERED, FAILED_UNREACHABLE, REFUSED, or RETURNED.'
        });
      }

      try {
        const result = await completeOrderDelivery(
          fastify.prisma,
          request.params.id,
          request.user!,
          parsed.data
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
              ? `Order ${result.order.public_ref} delivery marked complete.`
              : `Order ${result.order.public_ref} handoff recorded as ${result.outcome}.`,
          orderId: result.order.id,
          outcome: result.outcome,
          orderStatus: result.order.status,
          cashCollectedUgx: result.cashCollectedUgx || 0,
          changeUgx: result.changeUgx || 0
        });
      } catch (error) {
        return mapHandoffError(error, reply);
      }
    }
  );
};
