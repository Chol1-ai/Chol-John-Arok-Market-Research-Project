import { randomUUID } from 'crypto';
import { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { PinLoginInput, UserRole } from '../types/index.js';
import { config } from '../config.js';
import { hashSessionToken, SESSION_COOKIE } from '../plugins/auth.js';
import { normalizeUgandanPhone } from '../utils/phone.js';

const loginSchema = z
  .object({
    phoneNumber: z
      .string()
      .trim()
      .min(9)
      .max(24)
      .transform(normalizeUgandanPhone)
      .refine((phone) => /^256\d{9}$/.test(phone), 'Enter a valid Ugandan mobile number'),
    pin: z.string().regex(/^\d{4}$/, 'PIN must be exactly four digits')
  });

const createStaffSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  phoneNumber: z
    .string()
    .trim()
    .min(9)
    .max(24)
    .transform(normalizeUgandanPhone)
    .refine((phone) => /^256\d{9}$/.test(phone), 'Enter a valid Ugandan mobile number'),
  pin: z.string().regex(/^\d{4}$/, 'Staff PIN must be exactly four digits'),
  role: z.enum(['WAITER_FOH', 'KITCHEN_STAFF']),
  outlet: z.enum(['FOODIZO_HAM_TOWERS', 'OBUNUZI_YMCA'])
});

const staffIdParamsSchema = z.object({
  id: z.string().uuid()
});

const ROLE_LABELS: Record<UserRole, string> = {
  CUSTOMER: 'Customer',
  WAITER_FOH: 'Waiter / FOH',
  KITCHEN_STAFF: 'Kitchen Staff',
  MANAGER_ADMIN: 'Manager / Admin'
};

const ROLE_HOME: Record<UserRole, string> = {
  CUSTOMER: '/',
  WAITER_FOH: '/pos',
  KITCHEN_STAFF: '/kds',
  MANAGER_ADMIN: '/admin'
};

const DUMMY_PIN_HASH = bcrypt.hashSync('0000', 12);

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Managers provision staff PIN accounts. PINs are never stored or returned
  // in plaintext, and outlet-scoped managers cannot create cross-outlet users.
  fastify.post(
    '/staff',
    { preHandler: [fastify.requireRole(['MANAGER_ADMIN'])] },
    async (request, reply) => {
      const body = createStaffSchema.parse(request.body);
      const managerOutlet = request.user!.outlet;
      if (managerOutlet && managerOutlet !== body.outlet) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          code: 'OUTLET_FORBIDDEN',
          message: `This manager account is scoped to ${managerOutlet}.`
        });
      }

      const existing = await fastify.prisma.users.findUnique({
        where: { phone_number: body.phoneNumber },
        select: { id: true }
      });
      if (existing) {
        return reply.status(409).send({
          statusCode: 409,
          error: 'Conflict',
          code: 'STAFF_PHONE_EXISTS',
          message: 'A staff account already uses this phone number.'
        });
      }

      const pinHash = await bcrypt.hash(body.pin, 12);
      try {
        const user = await fastify.prisma.$transaction(async (transaction) => {
          const created = await transaction.users.create({
            data: {
              full_name: body.fullName,
              phone_number: body.phoneNumber,
              pin_hash: pinHash,
              role: body.role,
              outlet: body.outlet
            },
            select: {
              id: true,
              full_name: true,
              role: true,
              outlet: true,
              created_at: true
            }
          });

          await transaction.audit_log.create({
            data: {
              actor_user_id: request.user!.userId,
              actor_role: request.user!.role,
              outlet: body.outlet,
              action: 'STAFF_ACCOUNT_CREATED',
              entity_type: 'USER',
              entity_id: created.id,
              after_json: {
                fullName: created.full_name,
                role: created.role,
                outlet: created.outlet
              },
              ip_address: request.ip
            }
          });

          return created;
        });

        reply.header('Cache-Control', 'no-store');
        return reply.status(201).send({
          success: true,
          message: 'Staff account created. Share the PIN with the staff member privately.',
          staff: {
            id: user.id,
            fullName: user.full_name,
            role: user.role,
            outlet: user.outlet,
            createdAt: user.created_at
          }
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          return reply.status(409).send({
            statusCode: 409,
            error: 'Conflict',
            code: 'STAFF_PHONE_EXISTS',
            message: 'A staff account already uses this phone number.'
          });
        }
        throw error;
      }
    }
  );

  fastify.delete(
    '/staff/:id',
    { preHandler: [fastify.requireRole(['MANAGER_ADMIN'])] },
    async (request, reply) => {
      const { id } = staffIdParamsSchema.parse(request.params);
      const manager = request.user!;

      const outcome = await fastify.prisma.$transaction(async (transaction) => {
        const user = await transaction.users.findUnique({
          where: { id },
          select: {
            id: true,
            full_name: true,
            role: true,
            outlet: true,
            is_active: true
          }
        });

        if (
          !user ||
          !user.is_active ||
          (user.role !== 'WAITER_FOH' && user.role !== 'KITCHEN_STAFF')
        ) {
          return { kind: 'not-found' as const };
        }

        if (manager.outlet && user.outlet !== manager.outlet) {
          return { kind: 'forbidden' as const };
        }

        const deleted = await transaction.users.deleteMany({
          where: {
            id: user.id,
            is_active: true,
            role: { in: ['WAITER_FOH', 'KITCHEN_STAFF'] },
            ...(manager.outlet ? { outlet: manager.outlet } : {})
          }
        });
        if (deleted.count === 0) {
          return { kind: 'not-found' as const };
        }

        await transaction.audit_log.create({
          data: {
            actor_user_id: manager.userId,
            actor_role: manager.role,
            outlet: user.outlet,
            action: 'STAFF_ACCOUNT_DELETED',
            entity_type: 'USER',
            entity_id: user.id,
            before_json: {
              fullName: user.full_name,
              role: user.role,
              outlet: user.outlet,
              isActive: true
            },
            after_json: { deleted: true },
            ip_address: request.ip
          }
        });

        return { kind: 'deleted' as const, fullName: user.full_name };
      });

      if (outcome.kind === 'forbidden') {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          code: 'OUTLET_FORBIDDEN',
          message: `This manager account is scoped to ${manager.outlet}.`
        });
      }

      if (outcome.kind === 'not-found') {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          code: 'STAFF_ACCOUNT_NOT_FOUND',
          message: 'Active waiter or kitchen staff account not found.'
        });
      }

      reply.header('Cache-Control', 'no-store');
      return reply.send({
        success: true,
        message: `${outcome.fullName}'s account was permanently deleted.`
      });
    }
  );

  fastify.post<{ Body: PinLoginInput }>(
    '/pin',
    { config: { rateLimit: { max: config.NODE_ENV === 'test' ? 1000 : 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const { phoneNumber, pin } = loginSchema.parse(request.body);
      const user = await fastify.prisma.users.findUnique({
        where: { phone_number: phoneNumber }
      });
      const isStaffAccount = user && user.is_active && user.role !== 'CUSTOMER';

      if (!isStaffAccount) {
        await bcrypt.compare(pin, DUMMY_PIN_HASH);
        return reply.status(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Invalid phone number or PIN.'
        });
      }

      const isPinValid = await bcrypt.compare(pin, user.pin_hash);

      if (!isPinValid) {
        await fastify.prisma.$transaction(async (transaction) => {
          const [current] = await transaction.$queryRaw<Array<{
            failed_login_count: number;
            locked_until: Date | null;
          }>>`
            SELECT failed_login_count, locked_until
            FROM users
            WHERE id = ${user.id}::uuid
            FOR UPDATE
          `;
          if (!current || (current.locked_until && current.locked_until > new Date())) return;

          const failedCount = current.failed_login_count + 1;
          await transaction.users.update({
            where: { id: user.id },
            data: {
              failed_login_count: failedCount,
              locked_until: failedCount >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null
            }
          });
        });
        return reply.status(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Invalid phone number or PIN.'
        });
      }

      const canSignIn = await fastify.prisma.$transaction(async (transaction) => {
        const [current] = await transaction.$queryRaw<Array<{ locked_until: Date | null }>>`
          SELECT locked_until
          FROM users
          WHERE id = ${user.id}::uuid
          FOR UPDATE
        `;
        if (!current || (current.locked_until && current.locked_until > new Date())) return false;

        await transaction.users.update({
          where: { id: user.id },
          data: {
            failed_login_count: 0,
            locked_until: null,
            last_login_at: new Date()
          }
        });
        return true;
      });
      if (!canSignIn) {
        return reply.status(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Invalid phone number or PIN.'
        });
      }

      const token = fastify.jwt.sign({
        // A unique claim per login keeps quick re-logins from producing the same
        // signed token (JWTs are deterministic within the same `iat` second),
        // which would collide on user_sessions.token_hash.
        jti: randomUUID(),
        userId: user.id,
        fullName: user.full_name,
        phoneNumber: user.phone_number,
        role: user.role,
        outlet: user.outlet
      });

      const expiresAt = new Date(Date.now() + config.JWT_EXPIRATION_HOURS * 60 * 60 * 1000);
      await fastify.prisma.user_sessions.create({
        data: {
          user_id: user.id,
          token_hash: hashSessionToken(token),
          expires_at: expiresAt,
          ip_address: request.ip,
          user_agent: request.headers['user-agent'] || null
        }
      });

      reply.setCookie(SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.NODE_ENV === 'production',
        path: '/',
        maxAge: config.JWT_EXPIRATION_HOURS * 60 * 60
      });

      return reply.send({
        success: true,
        token,
        expiresAt,
        user: {
          id: user.id,
          fullName: user.full_name,
          phoneNumber: user.phone_number,
          role: user.role,
          roleLabel: ROLE_LABELS[user.role],
          outlet: user.outlet,
          homePath: ROLE_HOME[user.role]
        }
      });
    }
  );

  // GET /api/v1/auth/me
  fastify.get('/me', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const role = request.user!.role;
    return reply.send({
      success: true,
      user: {
        ...request.user,
        roleLabel: ROLE_LABELS[role],
        homePath: ROLE_HOME[role]
      }
    });
  });

  // POST /api/v1/auth/logout
  fastify.post('/logout', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    if (request.authToken) {
      await fastify.prisma.user_sessions.updateMany({
        where: {
          token_hash: hashSessionToken(request.authToken),
          revoked_at: null
        },
        data: { revoked_at: new Date() }
      });
    }

    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return reply.send({
      success: true,
      message: 'Logged out successfully'
    });
  });
};
