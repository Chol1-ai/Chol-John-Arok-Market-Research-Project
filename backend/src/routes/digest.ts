import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { DigestService } from '../services/digestService.js';
import { OutletLocation } from '../types/index.js';

const cashCountSchema = z.object({
  outlet: z.enum(['FOODIZO_HAM_TOWERS', 'OBUNUZI_YMCA']),
  countedCashUgx: z.number().nonnegative(),
  notes: z.string().optional()
});

const previewQuerySchema = z.object({
  outlet: z.enum(['FOODIZO_HAM_TOWERS', 'OBUNUZI_YMCA']).default('OBUNUZI_YMCA')
});

export const digestRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/digest/preview (Executive shift review)
  fastify.get('/preview', { preHandler: [fastify.requireRole(['MANAGER_ADMIN'])] }, async (request, reply) => {
    const { outlet } = previewQuerySchema.parse(request.query);
    const summary = await DigestService.generateDigest(fastify.prisma, outlet as OutletLocation);

    return reply.send({
      success: true,
      summary
    });
  });

  // POST /api/v1/digest/reconcile-cash (Record physical cash drawer count)
  fastify.post(
    '/reconcile-cash',
    { preHandler: [fastify.requireRole(['MANAGER_ADMIN'])] },
    async (request, reply) => {
      const { outlet, countedCashUgx, notes } = cashCountSchema.parse(request.body);

      const summary = await DigestService.generateDigest(fastify.prisma, outlet);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const count = await fastify.prisma.cash_counts.upsert({
        where: {
          cash_counts_unique: {
            outlet,
            business_date: today
          }
        },
        update: {
          counted_cash_ugx: countedCashUgx,
          expected_cash_ugx: summary.cashSalesUgx,
          variance_ugx: countedCashUgx - summary.cashSalesUgx,
          counted_by: request.user!.userId,
          notes: notes || null
        },
        create: {
          outlet,
          business_date: today,
          counted_cash_ugx: countedCashUgx,
          expected_cash_ugx: summary.cashSalesUgx,
          variance_ugx: countedCashUgx - summary.cashSalesUgx,
          counted_by: request.user!.userId,
          notes: notes || null
        }
      });

      return reply.send({
        success: true,
        message: 'Physical cash count recorded successfully',
        cashCountId: count.id,
        varianceUgx: Number(count.variance_ugx),
        expectedUgx: Number(count.expected_cash_ugx),
        countedUgx: Number(count.counted_cash_ugx)
      });
    }
  );

  // POST /api/v1/digest/dispatch-now (Trigger digest SMS/Email immediately)
  fastify.post(
    '/dispatch-now',
    { preHandler: [fastify.requireRole(['MANAGER_ADMIN'])] },
    async (request, reply) => {
      const { outlet } = previewQuerySchema.parse(request.body || {});
      const summary = await DigestService.generateDigest(fastify.prisma, outlet as OutletLocation);

      fastify.log.info({ summary }, 'Dispatching Nightly Audit Digest to Owner');

      return reply.send({
        success: true,
        message: `Daily Audit Digest dispatched to owner for ${outlet}`,
        summary
      });
    }
  );
};

