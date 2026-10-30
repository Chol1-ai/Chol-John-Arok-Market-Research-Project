import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

const surplusLogSchema = z.object({
  menuItemId: z.string().uuid(),
  quantity: z.number().int().positive(),
  action: z.enum(['DISCOUNTED_CLEARANCE', 'STAFF_MEAL', 'WASTE_DISCARDED']),
  reason: z.string().optional()
});

export const surplusRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/surplus
  fastify.get('/', { preHandler: [fastify.requireRole(['MANAGER_ADMIN'])] }, async (request, reply) => {
    const logs = await fastify.prisma.closing_surplus_logs.findMany({
      include: {
        menu_item: true,
        user: { select: { id: true, full_name: true } }
      },
      orderBy: { created_at: 'desc' },
      take: 50
    });

    return reply.send({
      success: true,
      logs: logs.map((l) => ({
        id: l.id,
        itemName: l.item_name,
        quantity: l.leftover_portions,
        action: l.resolution,
        loggedBy: l.user.full_name,
        loggedAt: l.created_at,
        notes: null
      }))
    });
  });

  // POST /api/v1/surplus/log
  fastify.post(
    '/log',
    { preHandler: [fastify.requireRole(['MANAGER_ADMIN'])] },
    async (request, reply) => {
      const data = surplusLogSchema.parse(request.body);

      const menuItem = await fastify.prisma.menu_items.findUnique({
        where: { id: data.menuItemId }
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const log = await fastify.prisma.closing_surplus_logs.create({
        data: {
          outlet: request.user?.outlet || menuItem?.outlet || 'OBUNUZI_YMCA',
          log_date: today,
          menu_item_id: data.menuItemId,
          item_name: menuItem?.name || 'Surplus Item',
          leftover_portions: data.quantity,
          resolution: data.action,
          logged_by: request.user!.userId
        }
      });

      return reply.status(201).send({
        success: true,
        message: `Surplus recorded: ${data.quantity} portions marked as ${data.action}`,
        log
      });
    }
  );
};

