import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { DigestService } from '../services/digestService.js';
import { getKampalaBusinessDate } from '../services/tokenService.js';
import { OutletLocation } from '../types/index.js';

const cashCountSchema = z.object({
  outlet: z.enum(['FOODIZO_HAM_TOWERS', 'OBUNUZI_YMCA']).optional(),
  countedCashUgx: z.number().nonnegative(),
  notes: z.string().trim().max(250).optional()
});

const outletQuerySchema = z.object({
  outlet: z.enum(['FOODIZO_HAM_TOWERS', 'OBUNUZI_YMCA']).optional()
});

function resolveOutlet(
  actorOutlet: OutletLocation | null,
  requested: OutletLocation | undefined,
  allowConsolidated: boolean
): { outlet?: OutletLocation; error?: string } {
  if (actorOutlet) {
    if (requested && requested !== actorOutlet) {
      return { error: `This account is scoped to ${actorOutlet}.` };
    }
    return { outlet: actorOutlet };
  }
  if (!requested && !allowConsolidated) {
    return { error: 'An outlet is required for this action.' };
  }
  return { outlet: requested };
}

export const digestRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/digest/preview?outlet=... — manager-only computed report.
  fastify.get(
    '/preview',
    { preHandler: [fastify.requireRole(['MANAGER_ADMIN'])] },
    async (request, reply) => {
      const query = outletQuerySchema.parse(request.query);
      const { outlet, error } = resolveOutlet(request.user!.outlet, query.outlet, true);
      if (error) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          code: 'OUTLET_FORBIDDEN',
          message: error
        });
      }

      const summary = await DigestService.generateDigest(fastify.prisma, undefined, outlet);
      return reply.send({ success: true, summary });
    }
  );

  // GET /api/v1/digest/overview — live data for the manager dashboard.
  fastify.get(
    '/overview',
    { preHandler: [fastify.requireRole(['MANAGER_ADMIN'])] },
    async (request, reply) => {
      const query = outletQuerySchema.parse(request.query);
      const { outlet, error } = resolveOutlet(request.user!.outlet, query.outlet, true);
      if (error) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          code: 'OUTLET_FORBIDDEN',
          message: error
        });
      }

      const businessDate = getKampalaBusinessDate();
      const summary = await DigestService.generateDigest(
        fastify.prisma,
        businessDate,
        outlet
      );

      const recentOrders = await fastify.prisma.orders.findMany({
        where: outlet ? { outlet } : undefined,
        orderBy: { created_at: 'desc' },
        take: 12,
        include: {
          table: true,
          payments: { where: { status: 'SUCCESSFUL' }, select: { id: true, carrier: true } }
        }
      });

      const tables = await fastify.prisma.restaurant_tables.groupBy({
        by: ['status'],
        where: outlet ? { outlet } : undefined,
        _count: { _all: true }
      });

      const staff = await fastify.prisma.users.findMany({
        where: {
          is_active: true,
          role: { in: ['WAITER_FOH', 'KITCHEN_STAFF', 'MANAGER_ADMIN'] },
          ...(outlet ? { OR: [{ outlet }, { outlet: null }] } : {})
        },
        select: {
          id: true,
          full_name: true,
          role: true,
          outlet: true,
          last_login_at: true
        },
        orderBy: { full_name: 'asc' }
      });

      const surplusLogs = await fastify.prisma.closing_surplus_logs.findMany({
        where: outlet ? { outlet, log_date: businessDate } : { log_date: businessDate },
        include: {
          menu_item: { select: { name: true } },
          user: { select: { full_name: true } }
        },
        orderBy: { created_at: 'desc' },
        take: 20
      });

      return reply.send({
        success: true,
        generatedAt: new Date().toISOString(),
        summary,
        recentOrders: recentOrders.map((order) => ({
          id: order.id,
          orderNumber: order.public_ref,
          tokenNumber: order.digital_token,
          outlet: order.outlet,
          channel: order.channel,
          status: order.status,
          table: order.table?.table_label || null,
          totalUgx: Number(order.total_amount_ugx),
          paid: order.payments.length > 0,
          paymentCarriers: order.payments.map((payment) => payment.carrier),
          createdAt: order.created_at
        })),
        tables: tables.map((row) => ({ status: row.status, count: row._count._all })),
        staff,
        surplusLogs: surplusLogs.map((log) => ({
          id: log.id,
          itemName: log.menu_item?.name || log.item_name,
          quantity: log.leftover_portions,
          resolution: log.resolution,
          loggedBy: log.user.full_name,
          createdAt: log.created_at
        }))
      });
    }
  );

  // POST /api/v1/digest/reconcile-cash — record the physical drawer count.
  fastify.post(
    '/reconcile-cash',
    { preHandler: [fastify.requireRole(['MANAGER_ADMIN'])] },
    async (request, reply) => {
      const body = cashCountSchema.parse(request.body);
      const { outlet, error } = resolveOutlet(request.user!.outlet, body.outlet, false);
      if (error || !outlet) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          code: 'OUTLET_REQUIRED',
          message: error || 'An outlet is required for cash reconciliation.'
        });
      }

      const businessDate = getKampalaBusinessDate();
      const summary = await DigestService.generateDigest(fastify.prisma, businessDate, outlet);
      const outletSummary = summary.outlets[0];
      const expected = outletSummary.expectedCashUgx;
      const variance = body.countedCashUgx - expected;

      const count = await fastify.prisma.cash_counts.upsert({
        where: {
          cash_counts_unique: {
            outlet,
            business_date: businessDate
          }
        },
        update: {
          counted_cash_ugx: body.countedCashUgx,
          expected_cash_ugx: expected,
          variance_ugx: variance,
          counted_by: request.user!.userId,
          notes: body.notes || null,
          counted_at: new Date()
        },
        create: {
          outlet,
          business_date: businessDate,
          counted_cash_ugx: body.countedCashUgx,
          expected_cash_ugx: expected,
          variance_ugx: variance,
          counted_by: request.user!.userId,
          notes: body.notes || null
        }
      });

      await fastify.prisma.audit_log.create({
        data: {
          actor_user_id: request.user!.userId,
          actor_role: request.user!.role,
          outlet,
          action: 'CASH_COUNT_RECORDED',
          entity_type: 'CASH_COUNT',
          entity_id: count.id,
          after_json: {
            countedCashUgx: body.countedCashUgx,
            expectedCashUgx: expected,
            varianceUgx: variance
          },
          ip_address: request.ip
        }
      });

      return reply.send({
        success: true,
        message:
          variance === 0
            ? 'Physical cash count recorded. The drawer is balanced.'
            : `Physical cash count recorded with a variance of UGX ${variance.toLocaleString()}.`,
        cashCountId: count.id,
        outlet,
        varianceUgx: variance,
        expectedUgx: expected,
        countedUgx: body.countedCashUgx
      });
    }
  );

  // POST /api/v1/digest/dispatch-now — sends and reports real channel outcomes.
  fastify.post(
    '/dispatch-now',
    { preHandler: [fastify.requireRole(['MANAGER_ADMIN'])] },
    async (request, reply) => {
      const body = outletQuerySchema.parse(request.body || {});
      const { outlet, error } = resolveOutlet(request.user!.outlet, body.outlet, true);
      if (error) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          code: 'OUTLET_FORBIDDEN',
          message: error
        });
      }

      const result = await DigestService.dispatchDigest(fastify.prisma, undefined, outlet);

      await fastify.prisma.audit_log.create({
        data: {
          actor_user_id: request.user!.userId,
          actor_role: request.user!.role,
          outlet: outlet || null,
          action: 'DIGEST_DISPATCHED',
          entity_type: 'DAILY_DIGEST',
          entity_id: result.digestId,
          after_json: {
            status: result.status,
            smsStatus: result.smsStatus,
            emailStatus: result.emailStatus,
            channelsSent: result.channelsSent
          },
          ip_address: request.ip
        }
      });

      return reply.send({
        success: result.status !== 'FAILED',
        digestStatus: result.status,
        message: result.message,
        digestId: result.digestId,
        smsStatus: result.smsStatus,
        smsMode: result.smsMode,
        emailStatus: result.emailStatus,
        channelsSent: result.channelsSent,
        summary: result.summary
      });
    }
  );

  // GET /api/v1/digest/view/:token — 72-hour read-only deep link payload.
  fastify.get<{ Params: { token: string } }>('/view/:token', async (request, reply) => {
    const record = await DigestService.findByLinkToken(fastify.prisma, request.params.token);
    if (!record) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        code: 'DIGEST_LINK_EXPIRED',
        message: 'This digest link is invalid or older than 72 hours.'
      });
    }

    return reply.send({
      success: true,
      digestDate: record.business_date,
      status: record.status,
      grossUgx: record.gross_ugx ? Number(record.gross_ugx) : null,
      flags: record.flags,
      payload: record.payload_json,
      generatedAt: record.generated_at,
      smsStatus: record.sms_status,
      emailStatus: record.email_status,
      channelsSent: record.channels_sent,
      sentAt: record.sent_at,
      error: record.error
    });
  });
};
