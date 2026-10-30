import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { MomoService } from '../services/momoService.js';
import { SettleOrderInput } from '../types/index.js';

const pushSchema = z.object({
  orderId: z.string().uuid(),
  phoneNumber: z.string().min(9),
  carrier: z.enum(['MTN', 'AIRTEL'])
});

const settleSchema = z.object({
  paymentMethod: z.enum(['MTN', 'AIRTEL', 'CASH', 'MANUAL_MOMO']),
  amountUgx: z.number().positive(),
  transactionReference: z.string().optional(),
  tenderedCashUgx: z.number().optional()
});

export const paymentRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/v1/payments/momo/push (Initiate STK Push)
  fastify.post('/momo/push', async (request, reply) => {
    const { orderId, phoneNumber, carrier } = pushSchema.parse(request.body);

    const order = await fastify.prisma.orders.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: `Order ${orderId} not found`
      });
    }

    const result = await MomoService.requestToPay({
      orderId: order.id,
      phoneNumber,
      amountUgx: Number(order.total_amount_ugx),
      carrier
    });

    // Record initiated payment row
    await fastify.prisma.payments.create({
      data: {
        order_id: order.id,
        idempotency_key: randomUUID(),
        carrier,
        status: 'PENDING_CUSTOMER_PIN',
        customer_msisdn: phoneNumber,
        amount_ugx: order.total_amount_ugx,
        external_transaction_id: result.carrierRef
      }
    });

    return reply.send({
      success: true,
      message: `USSD push sent to ${phoneNumber}. Please prompt customer to enter PIN.`,
      transactionId: result.transactionId,
      carrierRef: result.carrierRef
    });
  });

  // POST /api/v1/payments/momo/webhook (Telecom Callback)
  fastify.post('/momo/webhook', async (request, reply) => {
    const payload = request.body as any;
    fastify.log.info({ payload }, 'Received MoMo Webhook Callback');

    const carrierRef = payload.carrierRef || payload.externalId;
    const isSuccess = payload.status === 'SUCCESSFUL' || payload.status === 'SUCCESS';

    if (carrierRef) {
      const payment = await fastify.prisma.payments.findFirst({
        where: { external_transaction_id: carrierRef },
        include: { order: true }
      });

      if (payment && isSuccess) {
        await fastify.prisma.$transaction(async (tx) => {
          await tx.payments.update({
            where: { id: payment.id },
            data: {
              status: 'SUCCESSFUL',
              completed_at: new Date()
            }
          });

          // Prepayment Gate: Unlock order to PENDING so it appears on KDS
          if (payment.order.status === 'AWAITING_PAYMENT') {
            await tx.orders.update({
              where: { id: payment.order.id },
              data: { status: 'PENDING' }
            });

            // Broadcast TICKET_CREATED on WebSocket
            fastify.broadcastWs({
              event: 'TICKET_CREATED',
              outlet: payment.order.outlet,
              data: {
                orderId: payment.order.id,
                orderNumber: payment.order.public_ref,
                tokenNumber: payment.order.digital_token,
                channel: payment.order.channel
              }
            });
          }
        });
      }
    }

    return reply.send({ received: true });
  });

  // POST /api/v1/orders/:id/settle (Table Bill Settlement)
  fastify.post<{ Params: { id: string }; Body: SettleOrderInput }>(
    '/:id/settle',
    { preHandler: [fastify.requireRole(['WAITER_FOH', 'MANAGER_ADMIN'])] },
    async (request, reply) => {
      const { id } = request.params;
      const { paymentMethod, amountUgx, transactionReference, tenderedCashUgx } = settleSchema.parse(request.body);

      const order = await fastify.prisma.orders.findUnique({
        where: { id },
        include: { table: true }
      });

      if (!order) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: `Order ${id} not found`
        });
      }

      const changeUgx = tenderedCashUgx && tenderedCashUgx > amountUgx ? tenderedCashUgx - amountUgx : 0;

      await fastify.prisma.$transaction(async (tx) => {
        // 1. Record payment
        await tx.payments.create({
          data: {
            order_id: order.id,
            idempotency_key: randomUUID(),
            carrier: paymentMethod,
            status: 'SUCCESSFUL',
            amount_ugx: amountUgx,
            external_transaction_id: transactionReference || `SETTLE-${Date.now()}`,
            completed_at: new Date()
          }
        });

        // 2. Mark order completed
        await tx.orders.update({
          where: { id: order.id },
          data: {
            status: 'COMPLETED',
            completed_at: new Date()
          }
        });

        // 3. Free table to NEEDS_CLEARING
        if (order.table_id) {
          await tx.restaurant_tables.update({
            where: { id: order.table_id },
            data: { status: 'NEEDS_CLEARING' }
          });
        }
      });

      return reply.send({
        success: true,
        message: `Order ${order.public_ref} settled via ${paymentMethod}`,
        tenderedCashUgx,
        changeUgx
      });
    }
  );
};

