import { createHash } from 'crypto';
import { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import { AuthUserPayload, UserRole } from '../types/index.js';
import { config } from '../config.js';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authenticateOptional: (request: FastifyRequest) => Promise<boolean>;
    requireRole: (allowedRoles: UserRole[]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    authToken?: string;
  }
}

export const SESSION_COOKIE = 'foodizo_session';

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function extractRequestToken(request: FastifyRequest): string | undefined {
  const authorization = request.headers.authorization;
  if (authorization?.startsWith('Bearer ')) {
    return authorization.slice(7).trim();
  }

  const cookieToken = request.cookies?.[SESSION_COOKIE];
  if (cookieToken) return cookieToken;

  // WebSocket clients cannot set an Authorization header in the browser. The
  // login page uses the HttpOnly cookie, but the query fallback keeps native
  // test clients and hardware terminals working over a secured LAN.
  const queryToken = (request.query as Record<string, unknown> | undefined)?.token;
  return typeof queryToken === 'string' ? queryToken : undefined;
}

/**
 * Verifies a session token against the signed JWT and the durable
 * user_sessions table. Exported so the WebSocket layer can protect its
 * upgrade without going through an HTTP reply.
 */
export async function resolveSessionToken(
  fastify: Parameters<FastifyPluginAsync>[0],
  token: string | undefined
): Promise<AuthUserPayload | null> {
  if (!token) return null;

  try {
    fastify.jwt.verify<AuthUserPayload>(token);
  } catch {
    return null;
  }

  const session = await fastify.prisma.user_sessions.findUnique({
    where: { token_hash: hashSessionToken(token) },
    include: {
      user: {
        select: {
          id: true,
          full_name: true,
          phone_number: true,
          role: true,
          outlet: true,
          is_active: true
        }
      }
    }
  });

  if (
    !session ||
    session.revoked_at ||
    session.expires_at.getTime() <= Date.now() ||
    !session.user.is_active
  ) {
    return null;
  }

  return {
    // Use the current database row rather than stale JWT claims. A manager can
    // deactivate an account or move it between outlets without waiting 12h.
    userId: session.user.id,
    fullName: session.user.full_name,
    phoneNumber: session.user.phone_number,
    role: session.user.role,
    outlet: session.user.outlet
  };
}

async function resolveSession(
  fastify: Parameters<FastifyPluginAsync>[0],
  request: FastifyRequest
): Promise<AuthUserPayload | null> {
  const token = extractRequestToken(request);
  const user = await resolveSessionToken(fastify, token);
  if (user && token) {
    request.authToken = token;
  }
  return user;
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(fastifyJwt, {
    secret: config.JWT_SECRET,
    sign: {
      expiresIn: `${config.JWT_EXPIRATION_HOURS}h`
    }
  });

  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = await resolveSession(fastify, request);
      if (!user) throw new Error('No active session');

      request.user = user;
    } catch (err) {
      fastify.log.debug({ err }, 'Authentication rejected');
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid, expired, or revoked staff session'
      });
    }
  });

  fastify.decorate('authenticateOptional', async (request: FastifyRequest) => {
    try {
      const user = await resolveSession(fastify, request);
      if (!user) return false;

      request.user = user;
      return true;
    } catch (err) {
      fastify.log.debug({ err }, 'Optional authentication rejected');
      return false;
    }
  });

  fastify.decorate('requireRole', (allowedRoles: UserRole[]) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      await fastify.authenticate(request, reply);
      if (reply.sent) return;

      if (!request.user || !allowedRoles.includes(request.user.role)) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: `Access denied. Requires one of roles: [${allowedRoles.join(', ')}]`
        });
      }
    };
  });
};

export default fp(authPlugin, {
  name: 'auth-plugin'
});
