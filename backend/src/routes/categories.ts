import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

const categoryQuerySchema = z.object({
  outlet: z.enum(['FOODIZO_HAM_TOWERS', 'OBUNUZI_YMCA']).optional()
});

export const categoryRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async (request, reply) => {
    const { outlet } = categoryQuerySchema.parse(request.query);

    const items = await fastify.prisma.menu_items.findMany({
      where: {
        ...(outlet && { outlet }),
        is_active: true
      },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' }
    });

    const categories = items.map((i, idx) => ({
      id: i.category,
      name: i.category,
      display_order: idx + 1
    }));

    return reply.send({
      success: true,
      categories
    });
  });
};

