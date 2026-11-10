import fastify, { FastifyInstance } from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyCookie from '@fastify/cookie';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifySensible from '@fastify/sensible';

import prismaPlugin from './plugins/prisma.js';
import authPlugin from './plugins/auth.js';
import websocketPlugin from './plugins/websocket.js';
import errorHandlerPlugin from './plugins/errorHandler.js';

import { authRoutes } from './routes/auth.js';
import { categoryRoutes } from './routes/categories.js';
import { menuRoutes } from './routes/menu.js';
import { tableRoutes } from './routes/tables.js';
import { orderRoutes } from './routes/orders.js';
import { kdsRoutes } from './routes/kds.js';
import { paymentRoutes } from './routes/payments.js';
import { dispatchRoutes } from './routes/dispatch.js';
import { surplusRoutes } from './routes/surplus.js';
import { digestRoutes } from './routes/digest.js';
import { inventoryRoutes } from './routes/inventory.js';
import { config } from './config.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = fastify({
    logger: {
      level: config.NODE_ENV === 'test' ? 'silent' : 'info'
    }
  });

  // 1. Core Fastify Ecosystem Plugins
  await app.register(fastifySensible);
  await app.register(fastifyCookie);
  await app.register(fastifyCors, {
    origin: config.CORS_ORIGIN.split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
  });

  await app.register(fastifyRateLimit, {
    max: 120,
    timeWindow: '1 minute'
  });

  // 2. Custom Domain Plugins
  await app.register(prismaPlugin);
  await app.register(authPlugin);
  await app.register(websocketPlugin);
  await app.register(errorHandlerPlugin);

  // 3. Health Check
  app.get('/api/v1/health', async (_request, reply) => {
    try {
      await app.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'UP',
        service: 'foodizo-obunuzi-fastify-api',
        ...(config.NODE_ENV === 'production' ? {} : { environment: config.NODE_ENV }),
        timestamp: new Date().toISOString()
      };
    } catch {
      app.log.error('Health check failed: database unavailable');
      return reply.code(503).send({
        status: 'DOWN',
        service: 'foodizo-obunuzi-fastify-api',
        timestamp: new Date().toISOString()
      });
    }
  });

  // 4. API Domain Routes
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(categoryRoutes, { prefix: '/api/v1/categories' });
  await app.register(menuRoutes, { prefix: '/api/v1/menu-items' });
  await app.register(tableRoutes, { prefix: '/api/v1/tables' });
  await app.register(orderRoutes, { prefix: '/api/v1/orders' });
  await app.register(kdsRoutes, { prefix: '/api/v1/kds' });
  await app.register(paymentRoutes, { prefix: '/api/v1/payments' });
  await app.register(dispatchRoutes, { prefix: '/api/v1/dispatch' });
  await app.register(surplusRoutes, { prefix: '/api/v1/surplus' });
  await app.register(digestRoutes, { prefix: '/api/v1/digest' });
  await app.register(inventoryRoutes, { prefix: '/api/v1/inventory' });

  return app;
}
