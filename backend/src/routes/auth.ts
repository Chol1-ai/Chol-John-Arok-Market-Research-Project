import { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { PinLoginInput } from '../types/index.js';

const loginSchema = z.object({
  phoneNumber: z.string().min(9),
  pin: z.string().length(4)
});

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Staff PIN Gateway: POST /api/v1/auth/pin
  fastify.post<{ Body: PinLoginInput }>('/pin', async (request, reply) => {
    const { phoneNumber, pin } = loginSchema.parse(request.body);

    const user = await fastify.prisma.users.findUnique({
      where: { phone_number: phoneNumber }
    });

    if (!user || !user.is_active) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid phone number or staff account inactive'
      });
    }

    // Check account lockout
    if (user.locked_until && user.locked_until > new Date()) {
      return reply.status(423).send({
        statusCode: 423,
        error: 'Locked',
        message: `Account is locked until ${user.locked_until.toISOString()} due to excessive PIN failures`
      });
    }

    // Verify 4-digit PIN against bcrypt hash
    const isPinValid = await bcrypt.compare(pin, user.pin_hash);

    if (!isPinValid) {
      const failedCount = user.failed_login_count + 1;
      const lockedUntil = failedCount >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;

      await fastify.prisma.users.update({
        where: { id: user.id },
        data: {
          failed_login_count: failedCount,
          locked_until: lockedUntil
        }
      });

      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Incorrect 4-digit staff PIN'
      });
    }

    // Reset failed attempts & record login
    await fastify.prisma.users.update({
      where: { id: user.id },
      data: {
        failed_login_count: 0,
        locked_until: null,
        last_login_at: new Date()
      }
    });

    const token = fastify.jwt.sign({
      userId: user.id,
      fullName: user.full_name,
      phoneNumber: user.phone_number,
      role: user.role,
      outlet: user.outlet
    });

    return reply.send({
      success: true,
      token,
      user: {
        id: user.id,
        fullName: user.full_name,
        role: user.role,
        outlet: user.outlet
      }
    });
  });

  // GET /api/v1/auth/me
  fastify.get('/me', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    return reply.send({
      user: request.user
    });
  });

  // POST /api/v1/auth/logout
  fastify.post('/logout', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    return reply.send({
      success: true,
      message: 'Logged out successfully'
    });
  });
};

