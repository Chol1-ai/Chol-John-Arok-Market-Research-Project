import { FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import fastifyWebsocket from '@fastify/websocket';
import { WebSocket } from 'ws';
import { AuthUserPayload, OutletLocation, UserRole } from '../types/index.js';
import { extractRequestToken, resolveSessionToken } from './auth.js';

export interface WsEventMessage {
  event:
    | 'TICKET_CREATED'
    | 'TICKET_UPDATED'
    | 'TICKET_BUMPED'
    | 'TOKEN_READY'
    | 'ORDER_SETTLED'
    | 'ORDER_CANCELLED'
    | 'TABLE_STATUS_CHANGED'
    | 'DELIVERY_UPDATED';
  outlet?: OutletLocation;
  station?: string;
  data: unknown;
}

declare module 'fastify' {
  interface FastifyInstance {
    broadcastWs: (message: WsEventMessage) => void;
  }
}

interface WsClient {
  user: AuthUserPayload;
  outlet: OutletLocation | null;
  station: string | null;
}

const activeSockets = new Map<WebSocket, WsClient>();

function parseOutletFilter(request: FastifyRequest): OutletLocation | null {
  const value = (request.query as Record<string, unknown> | undefined)?.outlet;
  return value === 'FOODIZO_HAM_TOWERS' || value === 'OBUNUZI_YMCA' ? value : null;
}

function parseStationFilter(request: FastifyRequest): string | null {
  const value = (request.query as Record<string, unknown> | undefined)?.station;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

const websocketPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(fastifyWebsocket);

  fastify.decorate('broadcastWs', (message: WsEventMessage) => {
    const payload = JSON.stringify(message);

    for (const [socket, client] of activeSockets.entries()) {
      if (socket.readyState !== WebSocket.OPEN) continue;

      // A scoped waiter/kitchen session can only receive its own outlet's
      // events. Cross-outlet managers receive everything unless they chose an
      // outlet filter at connection time.
      if (message.outlet && client.outlet && client.outlet !== message.outlet) {
        continue;
      }

      if (
        message.station &&
        client.station &&
        client.station !== message.station
      ) {
        continue;
      }

      try {
        socket.send(payload);
      } catch (err) {
        fastify.log.warn({ err }, 'Failed to send WS broadcast to client');
      }
    }
  });

  fastify.get('/ws/events', { websocket: true }, async (socket, request) => {
    const token = extractRequestToken(request);
    const user = await resolveSessionToken(fastify, token);

    if (!user || user.role === 'CUSTOMER') {
      socket.send(
        JSON.stringify({
          event: 'ERROR',
          code: 'UNAUTHORIZED',
          message: 'A valid staff session is required to subscribe to live events.'
        })
      );
      socket.close(1008, 'Unauthorized');
      return;
    }

    // A cross-outlet manager may narrow their stream explicitly. Staff with a
    // fixed outlet cannot widen it by passing a query parameter.
    const requestedOutlet = parseOutletFilter(request);
    const outlet = user.outlet ?? requestedOutlet;

    activeSockets.set(socket, {
      user,
      outlet,
      station: parseStationFilter(request)
    });

    fastify.log.info(
      { ip: request.ip, userId: user.userId, outlet, role: user.role },
      'WebSocket staff client connected to /ws/events'
    );

    socket.send(
      JSON.stringify({
        event: 'CONNECTED',
        message: 'Connected to Kampala Fast-Casual Realtime Bus',
        user: {
          id: user.userId,
          fullName: user.fullName,
          role: user.role as UserRole,
          outlet: user.outlet
        },
        outlet
      })
    );

    socket.on('close', () => {
      activeSockets.delete(socket);
      fastify.log.info({ ip: request.ip }, 'WebSocket client disconnected');
    });

    socket.on('error', (err: Error) => {
      fastify.log.error({ err }, 'WebSocket error occurred');
      activeSockets.delete(socket);
    });
  });
};

export default fp(websocketPlugin, {
  name: 'websocket-plugin'
});
