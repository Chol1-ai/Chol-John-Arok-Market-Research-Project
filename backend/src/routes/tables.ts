import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { PrinterService } from '../services/printerService.js';
import { OutletLocation } from '../types/index.js';

const tableQuerySchema = z.object({
  outlet: z.enum(['FOODIZO_HAM_TOWERS', 'OBUNUZI_YMCA']).optional()
});

const tableStatusSchema = z.object({
  status: z.enum(['VACANT', 'OCCUPIED', 'BILL_REQUESTED', 'NEEDS_CLEARING']),
  assignedWaiterId: z.string().uuid().nullable().optional()
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

export const tableRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/tables — authenticated floor map, scoped to the staff outlet.
  fastify.get(
    '/',
    { preHandler: [fastify.requireRole(['WAITER_FOH', 'MANAGER_ADMIN'])] },
    async (request, reply) => {
      const query = tableQuerySchema.parse(request.query);
      const { outlet, error } = resolveOutlet(request.user!.outlet, query.outlet);
      if (error) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          code: 'OUTLET_FORBIDDEN',
          message: error
        });
      }

      const tables = await fastify.prisma.restaurant_tables.findMany({
        where: outlet ? { outlet } : undefined,
        include: {
          current_waiter: {
            select: { id: true, full_name: true }
          },
          orders: {
            where: { status: { in: ['PENDING', 'PREPARING', 'READY'] } },
            select: {
              id: true,
              public_ref: true,
              digital_token: true,
              total_amount_ugx: true,
              status: true,
              created_at: true
            }
          }
        },
        orderBy: { table_label: 'asc' }
      });

      return reply.send({
        success: true,
        tables: tables.map((table) => ({
          id: table.id,
          outlet: table.outlet,
          label: table.table_label,
          status: table.status,
          capacity: table.capacity,
          currentWaiterId: table.current_waiter_id,
          currentWaiter: table.current_waiter?.full_name || null,
          activeOrders: table.orders.map((order) => ({
            id: order.id,
            orderNumber: order.public_ref,
            tokenNumber: order.digital_token,
            totalUgx: Number(order.total_amount_ugx),
            status: order.status,
            createdAt: order.created_at
          }))
        }))
      });
    }
  );

  // PATCH /api/v1/tables/:id/status
  fastify.patch<{ Params: { id: string }; Body: z.infer<typeof tableStatusSchema> }>(
    '/:id/status',
    { preHandler: [fastify.requireRole(['WAITER_FOH', 'MANAGER_ADMIN'])] },
    async (request, reply) => {
      const { status, assignedWaiterId } = tableStatusSchema.parse(request.body);

      const table = await fastify.prisma.restaurant_tables.findUnique({
        where: { id: request.params.id },
        include: {
          orders: {
            where: { status: { in: ['PENDING', 'PREPARING', 'READY'] } },
            select: { id: true }
          }
        }
      });

      if (!table) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          code: 'TABLE_NOT_FOUND',
          message: `Table ${request.params.id} not found`
        });
      }

      if (request.user!.outlet && request.user!.outlet !== table.outlet) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          code: 'OUTLET_FORBIDDEN',
          message: 'This table belongs to another outlet.'
        });
      }

      if (status === 'VACANT' && table.orders.length > 0) {
        return reply.status(409).send({
          statusCode: 409,
          error: 'Conflict',
          code: 'TABLE_HAS_ACTIVE_ORDER',
          message: `Table ${table.table_label} still has ${table.orders.length} active order(s).`
        });
      }

      if (assignedWaiterId) {
        const waiter = await fastify.prisma.users.findUnique({
          where: { id: assignedWaiterId },
          select: {
            id: true,
            role: true,
            outlet: true,
            is_active: true
          }
        });

        if (
          !waiter ||
          !waiter.is_active ||
          !['WAITER_FOH', 'MANAGER_ADMIN'].includes(waiter.role) ||
          (waiter.outlet !== null && waiter.outlet !== table.outlet)
        ) {
          return reply.status(400).send({
            statusCode: 400,
            error: 'Bad Request',
            code: 'INVALID_WAITER',
            message: 'The assigned waiter must be an active floor user at this outlet.'
          });
        }
      }

      const updated = await fastify.prisma.restaurant_tables.update({
        where: { id: table.id },
        data: {
          status,
          ...(status === 'VACANT'
            ? { current_waiter_id: null }
            : assignedWaiterId !== undefined
              ? { current_waiter_id: assignedWaiterId }
              : {})
        }
      });

      fastify.broadcastWs({
        event: 'TABLE_STATUS_CHANGED',
        outlet: updated.outlet,
        data: {
          tableId: updated.id,
          label: updated.table_label,
          status: updated.status,
          currentWaiterId: updated.current_waiter_id
        }
      });

      return reply.send({
        success: true,
        table: {
          id: updated.id,
          outlet: updated.outlet,
          label: updated.table_label,
          status: updated.status,
          capacity: updated.capacity,
          currentWaiterId: updated.current_waiter_id
        }
      });
    }
  );

  // POST /api/v1/tables/drawer/kick — real ESC/POS pulse, honest outcome.
  fastify.post(
    '/drawer/kick',
    { preHandler: [fastify.requireRole(['WAITER_FOH', 'MANAGER_ADMIN'])] },
    async (request, reply) => {
      const body = (request.body as { reason?: string } | undefined) || {};
      const released = await PrinterService.kickDrawer();

      await fastify.prisma.audit_log.create({
        data: {
          actor_user_id: request.user!.userId,
          actor_role: request.user!.role,
          outlet: request.user!.outlet,
          action: 'CASH_DRAWER_KICK_TRIGGERED',
          entity_type: 'CASH_DRAWER',
          reason: body.reason || 'Manual drawer test or cash tender',
          after_json: { released }
        }
      });

      return reply.status(released ? 200 : 503).send({
        success: released,
        released,
        message: released
          ? 'Drawer kick pulse delivered to the thermal printer.'
          : 'Printer unreachable; the drawer did not confirm release. Open it manually and check the printer.',
        commandEmitted: released ? 'ESC p 0 25 250 (1B 70 00 19 FA)' : null
      });
    }
  );
};
