import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { config } from '../config.js';
import {
  BUDDY_GUIDED_REPLY,
  BUDDY_OUTLETS,
  BuddyProviderError,
  buildBuddyContext,
  getAiBuddyReply,
  getDeterministicBuddyReply,
  resolveBuddyOutlet
} from '../services/buddyService.js';

const buddyMessageSchema = z.object({
  outlet: z.enum(BUDDY_OUTLETS),
  message: z.string().trim().min(1).max(500),
  history: z.array(z.string().trim().min(1).max(500)).max(4).optional()
});

export const buddyRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/chat',
    {
      bodyLimit: 12 * 1024,
      config: {
        rateLimit: {
          max: 12,
          timeWindow: '1 minute'
        }
      }
    },
    async (request, reply) => {
      const { outlet: selectedOutlet, message, history = [] } = buddyMessageSchema.parse(request.body);
      const outlet = resolveBuddyOutlet(message, selectedOutlet);
      const context = await buildBuddyContext(fastify.prisma, outlet);
      const deterministicReply = getDeterministicBuddyReply(message, context);

      if (deterministicReply) return reply.send({ answer: deterministicReply });
      if (!config.OPENAI_API_KEY || !config.OPENAI_MODEL) {
        return reply.send({ answer: BUDDY_GUIDED_REPLY });
      }

      try {
        const answer = await getAiBuddyReply(
          message,
          history,
          context,
          config.OPENAI_API_KEY,
          config.OPENAI_MODEL
        );
        return reply.send({ answer });
      } catch (error) {
        if (error instanceof BuddyProviderError) {
          fastify.log.warn(
            { providerStatus: error.status },
            'Foodizo Buddy AI provider request failed'
          );
          return reply.status(503).send({
            code: 'BUDDY_AI_UNAVAILABLE',
            message: 'Foodizo Buddy could not reach its AI service. Please try again shortly.'
          });
        }
        throw error;
      }
    }
  );
};
