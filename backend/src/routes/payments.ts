import { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { MomoService } from '../services/momoService.js';
import { config } from '../config.js';
import { normalizeUgandanPhone } from '../utils/phone.js';

const pushSchema = z.object({
  orderId: z.string().uuid(),
  phoneNumber: z.string().min(9).max(20),
  carrier: z.enum(['MTN', 'AIRTEL'])
});

const webhookSchema = z
  .object({
    provider: z.enum(['MTN', 'AIRTEL']).optional(),
    eventId: z.string().min(1).max(180).optional(),
    referenceId: z.string().min(1).max(100).optional(),
    idempotencyKey: z.string().min(1).max(100).optional(),
    carrierRef: z.string().min(1).max(100).optional(),
    externalId: z.string().min(1).max(100).optional(),
    status: z.string().min(1).max(40),
    amountUgx: z.union([z.number(), z.string()]).optional(),
    financialTransactionId: z.string().min(1).max(100).optional(),
    reason: z.string().max(250).optional()
  })
  .passthrough();

const refundSchema = z.object({
  refundReference: z.string().trim().min(3).max(100)
});

type WebhookPayload = z.infer<typeof webhookSchema>;

type WebhookResult =
  | 'ACKNOWLEDGED'
  | 'ALREADY_PROCESSED'
  | 'FAILED_RECORDED'
  | 'IGNORED_TERMINAL'
  | 'IGNORED_PENDING'
  | 'LATE_PAYMENT_REQUIRES_REFUND'
  | 'AMOUNT_MISMATCH'
  | 'PROVIDER_MISMATCH'
  | 'NOT_FOUND';

function normalizeStatus(raw: string): 'SUCCESSFUL' | 'FAILED' | 'PENDING' | 'UNKNOWN' {
  switch (raw.trim().toUpperCase()) {
    case 'SUCCESSFUL':
    case 'SUCCESS':
    case 'COMPLETED':
    case 'PAID':
      return 'SUCCESSFUL';
    case 'FAILED':
    case 'REJECTED':
    case 'CANCELLED':
    case 'CANCELED':
    case 'TIMED_OUT':
    case 'TIMEOUT':
      return 'FAILED';
    case 'PENDING':
    case 'PENDING_CUSTOMER_PIN':
    case 'INITIATED':
      return 'PENDING';
    default:
      return 'UNKNOWN';
  }
}

function parseAmount(value: number | string | undefined): number | null {
  if (value === undefined) return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function signatureMatches(header: string | undefined, payload: WebhookPayload): boolean {
  if (!config.PAYMENTS_WEBHOOK_SECRET) {
    // Secure default: never accept unsigned production callbacks.
    return config.NODE_ENV !== 'production';
  }
  if (!header) return false;

  const provided = header.startsWith('sha256=') ? header.slice(7) : header;
  const expected = createHmac('sha256', config.PAYMENTS_WEBHOOK_SECRET)
    .update(JSON.stringify(payload))
    .digest('hex');

  if (provided.length !== expected.length) return false;

  try {
    return timingSafeEqual(Buffer.from(provided, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

function referenceFrom(payload: WebhookPayload): string | undefined {
  return (
    payload.referenceId ||
    payload.idempotencyKey ||
    payload.carrierRef ||
    payload.externalId
  );
}

export const paymentRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/v1/payments/momo/push — authenticated staff initiates an STK push
  // against an existing order. The amount always comes from the order row.
  fastify.post('/momo/push', { preHandler: [fastify.requireRole(['WAITER_FOH', 'MANAGER_ADMIN'])] }, async (request, reply) => {
    const { orderId, phoneNumber, carrier } = pushSchema.parse(request.body);

    const order = await fastify.prisma.orders.findUnique({
      where: { id: orderId },
      include: {
        payments: {
          where: { status: 'SUCCESSFUL' },
          select: { id: true, amount_ugx: true }
        }
      }
    });

    if (!order) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        code: 'ORDER_NOT_FOUND',
        message: `Order ${orderId} not found`
      });
    }

    if (request.user!.outlet && request.user!.outlet !== order.outlet) {
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
        message: `Order ${order.public_ref} is ${order.status}.`
      });
    }

    if (order.payments.length > 0) {
      const paid = order.payments.reduce((sum, payment) => sum + Number(payment.amount_ugx), 0);
      return reply.status(409).send({
        statusCode: 409,
        error: 'Conflict',
        code: 'ORDER_ALREADY_PAID',
        message: `Order ${order.public_ref} already has a successful payment of UGX ${paid.toLocaleString()}.`,
        paidAmountUgx: paid
      });
    }

    // A retry supersedes old attempts; only one attempt should be live.
    await fastify.prisma.payments.updateMany({
      where: {
        order_id: order.id,
        status: { in: ['INITIATED', 'PENDING_CUSTOMER_PIN'] }
      },
      data: {
        status: 'TIMED_OUT',
        failure_reason: 'SUPERSEDED_BY_NEW_PUSH'
      }
    });

    const idempotencyKey = randomUUID();
    const msisdn = normalizeUgandanPhone(phoneNumber);

    const payment = await fastify.prisma.payments.create({
      data: {
        order_id: order.id,
        idempotency_key: idempotencyKey,
        carrier,
        status: 'INITIATED',
        customer_msisdn: msisdn,
        amount_ugx: order.total_amount_ugx,
        recorded_by: request.user!.userId
      }
    });

    let result;
    try {
      result = await MomoService.requestToPay({
        orderId: order.id,
        phoneNumber: msisdn,
        amountUgx: Number(order.total_amount_ugx),
        carrier,
        idempotencyKey
      });
    } catch (error) {
      await fastify.prisma.payments.update({
        where: { id: payment.id },
        data: {
          status: 'FAILED',
          failure_reason: 'STK_PUSH_DISPATCH_FAILED'
        }
      });
      fastify.log.error({ err: error, orderId: order.id }, 'MoMo STK push failed');
      return reply.status(502).send({
        statusCode: 502,
        error: 'Bad Gateway',
        code: 'MOMO_PUSH_FAILED',
        message: 'The mobile-money provider did not accept the push. Retry or record a manual payment.'
      });
    }

    await fastify.prisma.payments.update({
      where: { id: payment.id },
      data: {
        status: result.status,
        external_transaction_id: result.carrierRef,
        audit_flag: result.status === 'SUCCESSFUL' ? 'PROVIDER_SYNCHRONOUS_SUCCESS' : null
      }
    });

    return reply.status(202).send({
      success: true,
      message: `USSD push sent to ${msisdn}. Ask the customer to enter their mobile-money PIN.`,
      paymentId: payment.id,
      referenceId: idempotencyKey,
      carrierRef: result.carrierRef,
      status: result.status,
      amountUgx: Number(order.total_amount_ugx),
      expiresInSeconds: 45
    });
  });

  /**
   * POST /api/v1/payments/webhook — provider callback (public, signature
   * checked). The legacy /momo/webhook alias is kept for existing telco
   * sandbox configuration. Duplicate delivery is acknowledged without a
   * second state change through payment_events(provider, event_id).
   */
  const webhookHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const payload = webhookSchema.parse(request.body);

    const signatureHeader =
      (request.headers['x-foodizo-signature'] as string | undefined) ||
      (request.headers['x-webhook-signature'] as string | undefined) ||
      (request.headers['x-momo-signature'] as string | undefined);

    if (!signatureMatches(signatureHeader, payload)) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        code: 'INVALID_WEBHOOK_SIGNATURE',
        message: 'The payment callback signature is missing or invalid.'
      });
    }

    const reference = referenceFrom(payload);
    if (!reference) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        code: 'REFERENCE_REQUIRED',
        message: 'The callback must include referenceId, idempotencyKey, carrierRef, or externalId.'
      });
    }

    const mappedStatus = normalizeStatus(payload.status);
    if (mappedStatus === 'UNKNOWN') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        code: 'UNKNOWN_PAYMENT_STATUS',
        message: `Unsupported payment status "${payload.status}".`
      });
    }

    const eventId =
      payload.eventId ||
      `${reference}:${mappedStatus}:${payload.financialTransactionId || payload.status}`;

    const state: {
      result: WebhookResult;
      broadcastOrder: {
        outlet: 'FOODIZO_HAM_TOWERS' | 'OBUNUZI_YMCA';
        orderId: string;
        orderNumber: string;
        tokenNumber: string;
        channel: string;
      } | null;
    } = {
      result: 'ACKNOWLEDGED',
      broadcastOrder: null
    };

    await fastify.prisma.$transaction(async (tx) => {
      const payment = await tx.payments.findFirst({
        where: {
          OR: [
            { idempotency_key: reference },
            { external_transaction_id: reference }
          ]
        },
        include: { order: true }
      });

      if (!payment) {
        state.result = 'NOT_FOUND';
        return;
      }

      if (payload.provider && payload.provider !== payment.carrier) {
        state.result = 'PROVIDER_MISMATCH';
        return;
      }

      const callbackAmount = parseAmount(payload.amountUgx);
      if (
        callbackAmount !== null &&
        Math.round(callbackAmount) !== Math.round(Number(payment.amount_ugx))
      ) {
        state.result = 'AMOUNT_MISMATCH';
        return;
      }

      // Insert the durable dedupe event. skipDuplicates means a concurrent
      // retry inserts zero rows and simply acknowledges the callback.
      const inserted = await tx.payment_events.createMany({
        data: [
          {
            payment_id: payment.id,
            provider: payment.carrier,
            event_id: eventId,
            payload_json: JSON.parse(JSON.stringify(payload))
          }
        ],
        skipDuplicates: true
      });

      if (inserted.count === 0) {
        state.result = 'ALREADY_PROCESSED';
        return;
      }

      // Serialize all state changes for this order. This prevents two
      // different attempts from both becoming the one successful payment.
      await tx.$queryRaw`SELECT id FROM orders WHERE id = ${payment.order_id}::uuid FOR UPDATE`;

      const locked = await tx.payments.findUniqueOrThrow({
        where: { id: payment.id }
      });
      const order = await tx.orders.findUniqueOrThrow({
        where: { id: payment.order_id }
      });

      if (mappedStatus === 'PENDING') {
        state.result = 'IGNORED_PENDING';
        return;
      }

      if (locked.status === 'SUCCESSFUL' || locked.status === 'REFUND_PENDING' || locked.status === 'REFUNDED') {
        state.result = 'ALREADY_PROCESSED';
        return;
      }

      if (mappedStatus === 'FAILED') {
        const failed = await tx.payments.updateMany({
          where: {
            id: payment.id,
            status: { in: ['INITIATED', 'PENDING_CUSTOMER_PIN'] }
          },
          data: {
            status: 'FAILED',
            failure_reason: payload.reason || 'TELCO_CALLBACK_FAILED'
          }
        });
        state.result = failed.count === 1 ? 'FAILED_RECORDED' : 'IGNORED_TERMINAL';
        return;
      }

      // Successful callback.
      if (order.status === 'CANCELLED') {
        await tx.payments.update({
          where: { id: payment.id },
          data: {
            status: 'REFUND_PENDING',
            external_transaction_id: payload.financialTransactionId || payment.external_transaction_id,
            completed_at: new Date(),
            audit_flag: 'LATE_PAYMENT_AFTER_CANCEL'
          }
        });
        state.result = 'LATE_PAYMENT_REQUIRES_REFUND';
        return;
      }

      const priorSuccess = await tx.payments.findFirst({
        where: {
          order_id: order.id,
          status: 'SUCCESSFUL',
          id: { not: payment.id }
        },
        select: { id: true }
      });

      if (priorSuccess) {
        await tx.payments.update({
          where: { id: payment.id },
          data: {
            status: 'REFUND_PENDING',
            external_transaction_id: payload.financialTransactionId || payment.external_transaction_id,
            completed_at: new Date(),
            audit_flag: 'DUPLICATE_SUCCESS_REQUIRES_REFUND'
          }
        });
        state.result = 'LATE_PAYMENT_REQUIRES_REFUND';
        return;
      }

      const paid = await tx.payments.updateMany({
        where: {
          id: payment.id,
          status: { in: ['INITIATED', 'PENDING_CUSTOMER_PIN', 'FAILED', 'TIMED_OUT'] }
        },
        data: {
          status: 'SUCCESSFUL',
          external_transaction_id: payload.financialTransactionId || payment.external_transaction_id,
          completed_at: new Date()
        }
      });

      if (paid.count !== 1) {
        state.result = 'IGNORED_TERMINAL';
        return;
      }

      const promoted = await tx.orders.updateMany({
        where: { id: order.id, status: 'AWAITING_PAYMENT' },
        data: { status: 'PENDING' }
      });

      if (promoted.count === 1) {
        state.broadcastOrder = {
          outlet: order.outlet,
          orderId: order.id,
          orderNumber: order.public_ref,
          tokenNumber: order.digital_token,
          channel: order.channel
        };
      }

      state.result = 'ACKNOWLEDGED';
    });

    if (state.broadcastOrder) {
      const { outlet, ...data } = state.broadcastOrder;
      fastify.broadcastWs({
        event: 'TICKET_CREATED',
        outlet,
        data
      });
    }

    if (state.result === 'NOT_FOUND') {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        code: 'PAYMENT_REFERENCE_NOT_FOUND',
        message: 'Transaction reference not found.'
      });
    }

    if (state.result === 'AMOUNT_MISMATCH' || state.result === 'PROVIDER_MISMATCH') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        code: state.result,
        message:
          state.result === 'AMOUNT_MISMATCH'
            ? 'Callback amount does not match the recorded payment amount.'
            : 'Callback provider does not match the payment carrier.'
      });
    }

    return reply.status(200).send({ received: true, status: state.result });
  };

  fastify.post('/webhook', webhookHandler);
  fastify.post('/momo/webhook', webhookHandler);

  // POST /api/v1/payments/:id/refund — manager closes a manual reversal.
  fastify.post<{ Params: { id: string }; Body: { refundReference: string } }>(
    '/:id/refund',
    { preHandler: [fastify.requireRole(['MANAGER_ADMIN'])] },
    async (request, reply) => {
      const { refundReference } = refundSchema.parse(request.body);

      const payment = await fastify.prisma.payments.findUnique({
        where: { id: request.params.id },
        include: { order: true }
      });

      if (!payment) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          code: 'PAYMENT_NOT_FOUND',
          message: `Payment ${request.params.id} not found.`
        });
      }

      if (request.user!.outlet && request.user!.outlet !== payment.order.outlet) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          code: 'OUTLET_FORBIDDEN',
          message: 'This payment belongs to another outlet.'
        });
      }

      if (payment.status === 'REFUNDED') {
        return reply.send({
          success: true,
          message: 'Payment is already refunded.',
          paymentId: payment.id
        });
      }

      if (payment.status !== 'REFUND_PENDING') {
        return reply.status(409).send({
          statusCode: 409,
          error: 'Conflict',
          code: 'PAYMENT_NOT_REFUND_PENDING',
          message: `Payment is ${payment.status}; only REFUND_PENDING payments can be closed.`
        });
      }

      const updated = await fastify.prisma.$transaction(async (tx) => {
        const refunded = await tx.payments.update({
          where: { id: payment.id },
          data: {
            status: 'REFUNDED',
            refunded_at: new Date(),
            refund_reference: refundReference
          }
        });

        await tx.audit_log.create({
          data: {
            actor_user_id: request.user!.userId,
            actor_role: request.user!.role,
            outlet: payment.order.outlet,
            action: 'PAYMENT_REFUNDED',
            entity_type: 'PAYMENT',
            entity_id: payment.id,
            before_json: { status: payment.status, amountUgx: Number(payment.amount_ugx) },
            after_json: { status: 'REFUNDED', refundReference },
            reason: payment.audit_flag || 'MANUAL_REVERSAL',
            ip_address: request.ip
          }
        });

        return refunded;
      });

      return reply.send({
        success: true,
        message: `Payment ${updated.id} marked REFUNDED.`,
        paymentId: updated.id,
        refundReference
      });
    }
  );
};
