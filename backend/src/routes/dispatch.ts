import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { SmsService } from '../services/smsService.js';
import { AssignRiderInput } from '../types/index.js';

const assignRiderSchema = z.object({
  riderName: z.string().min(2),
  riderPhone: z.string().min(9),
  bodaPlateNumber: z.string().optional(),
  bodaStage: z.string().optional(),
  advanceCashUgx: z.number().default(0)
});

export const dispatchRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/dispatch/queue (List all READY delivery orders)
  fastify.get('/queue', async (request, reply) => {
    const queue = await fastify.prisma.orders.findMany({
      where: {
        channel: 'PHONE_DELIVERY',
        status: { in: ['READY', 'PREPARING'] }
      },
      include: {
        delivery_zone: true,
        order_items: { include: { menu_item: true } },
        handoffs: true
      },
      orderBy: { created_at: 'asc' }
    });

    const now = Date.now();
    return reply.send({
      success: true,
      activeCount: queue.length,
      queue: queue.map((o) => ({
        id: o.id,
        orderNumber: o.public_ref,
        tokenNumber: o.digital_token,
        status: o.status,
        customerName: o.customer_name,
        customerPhone: o.customer_phone,
        destinationZone: o.delivery_zone?.display_name,
        landmarkHint: o.delivery_zone?.landmark_hint,
        roomNote: o.delivery_note,
        gpsLatitude: o.delivery_lat ? Number(o.delivery_lat) : null,
        gpsLongitude: o.delivery_lng ? Number(o.delivery_lng) : null,
        totalUgx: Number(o.total_amount_ugx),
        elapsedMinutes: Math.floor((now - new Date(o.created_at).getTime()) / 60000),
        items: o.order_items.map((oi) => ({
          name: oi.menu_item.name,
          quantity: oi.quantity,
          notes: oi.special_notes
        })),
        handoff: o.handoffs[0] || null
      }))
    });
  });

  // POST /api/v1/dispatch/:id/assign-rider
  fastify.post<{ Params: { id: string }; Body: AssignRiderInput }>(
    '/:id/assign-rider',
    { preHandler: [fastify.requireRole(['WAITER_FOH', 'MANAGER_ADMIN'])] },
    async (request, reply) => {
      const { id } = request.params;
      const data = assignRiderSchema.parse(request.body);

      const order = await fastify.prisma.orders.findUnique({
        where: { id }
      });

      if (!order) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: `Order ${id} not found`
        });
      }

      const notesArr = [];
      if (data.bodaStage) notesArr.push(`Stage: ${data.bodaStage}`);
      if (data.bodaPlateNumber) notesArr.push(`Plate: ${data.bodaPlateNumber}`);

      // Record delivery handoff
      const handoff = await fastify.prisma.delivery_handoffs.create({
        data: {
          order_id: order.id,
          dispatched_by: request.user!.userId,
          rider_name: data.riderName,
          rider_phone: data.riderPhone,
          rider_advance_ugx: data.advanceCashUgx,
          outcome: 'PENDING',
          notes: notesArr.length > 0 ? notesArr.join(' • ') : null
        }
      });

      // Send Customer Dispatch SMS
      if (order.customer_phone) {
        SmsService.sendDispatchAlert(order.customer_phone, order.public_ref, data.riderName, data.riderPhone)
          .catch((err) => fastify.log.warn({ err }, 'Customer dispatch SMS failed'));
      }

      return reply.send({
        success: true,
        message: `Boda rider ${data.riderName} assigned to order ${order.public_ref}`,
        handoff
      });
    }
  );

  // POST /api/v1/dispatch/:id/complete
  fastify.post<{ Params: { id: string } }>(
    '/:id/complete',
    { preHandler: [fastify.requireRole(['WAITER_FOH', 'MANAGER_ADMIN'])] },
    async (request, reply) => {
      const { id } = request.params;

      const order = await fastify.prisma.orders.findUnique({
        where: { id },
        include: { handoffs: true }
      });

      if (!order) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: `Order ${id} not found`
        });
      }

      if (order.handoffs.length === 0) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'DELIVERY_COMPLETION_REQUIRES_HANDOFF: Order cannot be marked complete without a recorded boda handoff.'
        });
      }

      await fastify.prisma.$transaction(async (tx) => {
        await tx.delivery_handoffs.updateMany({
          where: { order_id: order.id },
          data: {
            outcome: 'DELIVERED',
            delivered_at: new Date()
          }
        });

        await tx.orders.update({
          where: { id: order.id },
          data: {
            status: 'COMPLETED',
            completed_at: new Date()
          }
        });
      });

      return reply.send({
        success: true,
        message: `Order ${order.public_ref} delivery marked complete`
      });
    }
  );
};

