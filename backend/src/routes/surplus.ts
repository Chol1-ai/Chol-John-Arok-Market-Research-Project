import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getKampalaBusinessDate } from '../services/tokenService.js';
import { OutletLocation } from '../types/index.js';

const surplusLogSchema = z.object({
  outlet: z.enum(['FOODIZO_HAM_TOWERS', 'OBUNUZI_YMCA']).optional(),
  menuItemId: z.string().uuid(),
  quantity: z.number().int().positive(),
  action: z.enum(['DISCOUNTED_CLEARANCE', 'STAFF_MEAL', 'WASTE_DISCARDED']),
  reason: z.string().trim().max(250).optional()
});

const surplusQuerySchema = z.object({
  outlet: z.enum(['FOODIZO_HAM_TOWERS', 'OBUNUZI_YMCA']).optional()
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

export const surplusRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/surplus — manager-only, outlet-scoped.
  fastify.get(
    '/',
    { preHandler: [fastify.requireRole(['MANAGER_ADMIN'])] },
    async (request, reply) => {
      const query = surplusQuerySchema.parse(request.query);
      const { outlet, error } = resolveOutlet(request.user!.outlet, query.outlet);
      if (error) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          code: 'OUTLET_FORBIDDEN',
          message: error
        });
      }

      const logs = await fastify.prisma.closing_surplus_logs.findMany({
        where: outlet ? { outlet } : undefined,
        include: {
          menu_item: true,
          user: { select: { id: true, full_name: true } }
        },
        orderBy: { created_at: 'desc' },
        take: 50
      });

      return reply.send({
        success: true,
        logs: logs.map((log) => ({
          id: log.id,
          outlet: log.outlet,
          itemName: log.item_name,
          quantity: log.leftover_portions,
          action: log.resolution,
          loggedBy: log.user?.full_name || 'Former staff member',
          loggedAt: log.created_at
        }))
      });
    }
  );

  // POST /api/v1/surplus/log
  fastify.post(
    '/log',
    { preHandler: [fastify.requireRole(['MANAGER_ADMIN'])] },
    async (request, reply) => {
      const data = surplusLogSchema.parse(request.body);

      const menuItem = await fastify.prisma.menu_items.findUnique({
        where: { id: data.menuItemId }
      });
      if (!menuItem) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          code: 'MENU_ITEM_NOT_FOUND',
          message: 'The selected menu item does not exist.'
        });
      }

      const { outlet, error } = resolveOutlet(request.user!.outlet, data.outlet || menuItem.outlet);
      if (error || !outlet) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          code: 'OUTLET_FORBIDDEN',
          message: error || 'An outlet is required.'
        });
      }

      if (menuItem.outlet !== outlet) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          code: 'MENU_ITEM_OUTLET_MISMATCH',
          message: `${menuItem.name} belongs to ${menuItem.outlet}, not ${outlet}.`
        });
      }

      const businessDate = getKampalaBusinessDate();
      const log = await fastify.prisma.$transaction(async (tx) => {
        const created = await tx.closing_surplus_logs.create({
          data: {
            outlet,
            log_date: businessDate,
            menu_item_id: menuItem.id,
            item_name: menuItem.name,
            leftover_portions: data.quantity,
            resolution: data.action,
            logged_by: request.user!.userId
          }
        });

        await tx.audit_log.create({
          data: {
            actor_user_id: request.user!.userId,
            actor_role: request.user!.role,
            outlet,
            action: 'SURPLUS_LOGGED',
            entity_type: 'SURPLUS_LOG',
            entity_id: created.id,
            reason: data.reason || null,
            after_json: {
              itemName: menuItem.name,
              quantity: data.quantity,
              resolution: data.action
            },
            ip_address: request.ip
          }
        });

        return created;
      });

      return reply.status(201).send({
        success: true,
        message: `Surplus recorded: ${data.quantity} portion(s) marked as ${data.action}.`,
        log
      });
    }
  );
};
