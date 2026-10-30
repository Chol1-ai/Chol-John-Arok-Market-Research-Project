import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import fastifyWebsocket from '@fastify/websocket';
import { WebSocket } from 'ws';

export interface WsEventMessage {
  event: 'TICKET_CREATED' | 'TICKET_UPDATED' | 'TICKET_BUMPED' | 'TOKEN_READY' | 'TABLE_STATUS_CHANGED';
  outlet?: string;
  station?: string;
  data: any;
}

declare module 'fastify' {
  interface FastifyInstance {
    broadcastWs: (message: WsEventMessage) => void;
  }
}

const activeSockets = new Set<WebSocket>();

const websocketPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(fastifyWebsocket);

  fastify.decorate('broadcastWs', (message: WsEventMessage) => {
    const payload = JSON.stringify(message);
    for (const socket of activeSockets) {
      if (socket.readyState === WebSocket.OPEN) {
        try {
          socket.send(payload);
        } catch (err) {
          fastify.log.warn({ err }, 'Failed to send WS broadcast to client');
        }
      }
    }
  });

  fastify.get('/ws/events', { websocket: true }, (socket, req) => {
    activeSockets.add(socket);
    fastify.log.info({ ip: req.ip }, 'WebSocket client connected to /ws/events');

    socket.on('close', () => {
      activeSockets.delete(socket);
      fastify.log.info({ ip: req.ip }, 'WebSocket client disconnected');
    });

    socket.on('error', (err: Error) => {
      fastify.log.error({ err }, 'WebSocket error occurred');
      activeSockets.delete(socket);
    });

    // Send connection greeting
    socket.send(JSON.stringify({ event: 'CONNECTED', message: 'Connected to Kampala Fast-Casual Realtime Bus' }));
  });
};

export default fp(websocketPlugin, {
  name: 'websocket-plugin'
});

