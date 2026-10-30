import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

const menuQuerySchema = z.object({
  outlet: z.enum(['FOODIZO_HAM_TOWERS', 'OBUNUZI_YMCA']).optional(),
  category: z.string().optional(),
  station: z.enum(['STEAM_LINE', 'GRILL_FRYER', 'ROLEX_GRIDDLE', 'BAR_BEVERAGE']).optional()
});

const availabilitySchema = z.object({
  isAvailable: z.boolean().optional(),
  is86: z.boolean().optional()
}).refine(data => data.isAvailable !== undefined || data.is86 !== undefined, {
  message: "Either isAvailable or is86 must be provided"
});

export const menuRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/menu-items
  fastify.get('/', async (request, reply) => {
    const { outlet, category, station } = menuQuerySchema.parse(request.query);

    const items = await fastify.prisma.menu_items.findMany({
      where: {
        ...(outlet && { outlet }),
        ...(category && { category }),
        ...(station && { station })
      },
      orderBy: { name: 'asc' }
    });

    return reply.send({
      success: true,
      items: items.map((i) => ({
        id: i.id,
        outlet: i.outlet,
        name: i.name,
        category: i.category,
        priceUgx: Number(i.price_ugx),
        station: i.station,
        isActive: i.is_active,
        is86: i.is_86,
        isAvailable: i.is_active && !i.is_86
      }))
    });
  });

  // PATCH /api/v1/menu-items/:id/availability (Staff only)
  fastify.patch<{ Params: { id: string }; Body: { isAvailable?: boolean; is86?: boolean } }>(
    '/:id/availability',
    { preHandler: [fastify.requireRole(['WAITER_FOH', 'KITCHEN_STAFF', 'MANAGER_ADMIN'])] },
    async (request, reply) => {
      const { id } = request.params;
      const { isAvailable, is86 } = availabilitySchema.parse(request.body);

      const targetIs86 = is86 !== undefined ? is86 : (isAvailable !== undefined ? !isAvailable : undefined);

      const updated = await fastify.prisma.menu_items.update({
        where: { id },
        data: {
          ...(targetIs86 !== undefined && { is_86: targetIs86 })
        }
      });

      return reply.send({
        success: true,
        message: `Menu item ${updated.name} availability set to ${!updated.is_86}`,
        item: {
          id: updated.id,
          outlet: updated.outlet,
          name: updated.name,
          category: updated.category,
          priceUgx: Number(updated.price_ugx),
          station: updated.station,
          isActive: updated.is_active,
          is86: updated.is_86,
          isAvailable: updated.is_active && !updated.is_86
        }
      });
    }
  );
};

