import { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  hashTrackingToken,
  isTrackingToken
} from '../services/deliveryTrackingService.js';

function trackingToken(request: FastifyRequest): string | null {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) return null;
  const token = authorization.slice(7).trim();
  return isTrackingToken(token) ? token : null;
}

function unauthorized(reply: FastifyReply) {
  return reply.status(401).send({
    statusCode: 401,
    error: 'Unauthorized',
    code: 'INVALID_TRACKING_TOKEN',
    message: 'A valid delivery tracking link is required.'
  });
}

function noStore(reply: FastifyReply) {
  reply.header('Cache-Control', 'no-store');
  reply.header('Pragma', 'no-cache');
}

const locationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyM: z.number().min(0).max(5000),
  speedMps: z.number().min(0).max(100).nullable().optional(),
  headingDegrees: z.number().min(0).max(359.99).nullable().optional()
}).strict();

const riderStateSchema = z.object({
  status: z.enum(['SHARING', 'PAUSED', 'STOPPED'])
}).strict();

export const deliveryTrackingRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/customer',
    { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (request, reply) => {
      noStore(reply);
      const token = trackingToken(request);
      if (!token) return unauthorized(reply);

      const session = await fastify.prisma.delivery_tracking_sessions.findUnique({
        where: { customer_token_hash: hashTrackingToken(token) },
        include: {
          order: {
            select: {
              public_ref: true,
              digital_token: true,
              outlet: true,
              channel: true,
              status: true,
              delivery_zone: { select: { display_name: true } }
            }
          },
          handoff: {
            select: {
              rider_name: true,
              outcome: true
            }
          }
        }
      });

      if (
        !session ||
        session.customer_token_expires_at.getTime() <= Date.now() ||
        session.order.channel !== 'PHONE_DELIVERY'
      ) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          code: 'TRACKING_LINK_UNAVAILABLE',
          message: 'This delivery tracking link is invalid or has expired.'
        });
      }

      const handoffActive =
        session.order.status === 'READY' && session.handoff?.outcome === 'PENDING';
      const isSharing =
        handoffActive && ['SHARING', 'PAUSED'].includes(session.status);
      const deliveryStatus = session.order.status === 'COMPLETED'
        ? 'COMPLETED'
        : session.order.status === 'CANCELLED'
          ? 'CANCELLED'
          : handoffActive
            ? 'OUT_FOR_DELIVERY'
            : session.order.status;

      return reply.send({
        success: true,
        orderNumber: session.order.public_ref,
        tokenNumber: session.order.digital_token,
        outlet: session.order.outlet,
        deliveryStatus,
        destination: session.order.delivery_zone?.display_name || null,
        trackingStatus: handoffActive ? session.status : 'STOPPED',
        riderName: handoffActive ? session.handoff?.rider_name || null : null,
        latitude: isSharing && session.latitude !== null ? Number(session.latitude) : null,
        longitude: isSharing && session.longitude !== null ? Number(session.longitude) : null,
        accuracyM: isSharing && session.accuracy_m !== null
          ? Number(session.accuracy_m)
          : null,
        locationUpdatedAt: isSharing ? session.location_updated_at : null
      });
    }
  );

  fastify.get(
    '/rider/session',
    { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (request, reply) => {
      noStore(reply);
      const token = trackingToken(request);
      if (!token) return unauthorized(reply);

      const session = await fastify.prisma.delivery_tracking_sessions.findUnique({
        where: { rider_token_hash: hashTrackingToken(token) },
        include: {
          order: {
            select: {
              public_ref: true,
              digital_token: true,
              status: true,
              channel: true,
              customer_name: true,
              customer_phone: true,
              delivery_note: true,
              delivery_lat: true,
              delivery_lng: true,
              delivery_zone: { select: { display_name: true } }
            }
          },
          handoff: { select: { rider_name: true, outcome: true } }
        }
      });
      if (
        !session ||
        !session.rider_token_expires_at ||
        session.rider_token_expires_at.getTime() <= Date.now() ||
        session.status === 'STOPPED' ||
        session.order.channel !== 'PHONE_DELIVERY' ||
        session.order.status !== 'READY' ||
        session.handoff?.outcome !== 'PENDING'
      ) {
        return reply.status(410).send({
          statusCode: 410,
          error: 'Gone',
          code: 'TRACKING_SESSION_CLOSED',
          message: 'This rider tracking invite has expired or the delivery has ended.'
        });
      }

      const hasDeliveryPin =
        session.order.delivery_lat !== null && session.order.delivery_lng !== null;
      const latitude = hasDeliveryPin ? Number(session.order.delivery_lat) : null;
      const longitude = hasDeliveryPin ? Number(session.order.delivery_lng) : null;

      return reply.send({
        success: true,
        orderNumber: session.order.public_ref,
        tokenNumber: session.order.digital_token,
        destination: session.order.delivery_zone?.display_name || null,
        deliveryNote: session.order.delivery_note,
        customerName: session.order.customer_name,
        customerPhone: session.order.customer_phone,
        mapLink: latitude !== null && longitude !== null
          ? `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
          : null,
        riderName: session.handoff.rider_name,
        status: session.status,
        locationUpdatedAt: session.location_updated_at
      });
    }
  );

  fastify.patch(
    '/rider/session',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (request, reply) => {
      noStore(reply);
      const token = trackingToken(request);
      if (!token) return unauthorized(reply);

      const parsed = riderStateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          code: 'INVALID_TRACKING_STATUS',
          message: 'Tracking status must be SHARING, PAUSED, or STOPPED.'
        });
      }

      const tokenHash = hashTrackingToken(token);
      const session = await fastify.prisma.delivery_tracking_sessions.findUnique({
        where: { rider_token_hash: tokenHash },
        include: {
          order: { select: { id: true, outlet: true, status: true, channel: true } },
          handoff: { select: { outcome: true } }
        }
      });
      if (
        !session ||
        !session.rider_token_expires_at ||
        session.rider_token_expires_at.getTime() <= Date.now() ||
        session.status === 'STOPPED' ||
        session.order.channel !== 'PHONE_DELIVERY' ||
        session.order.status !== 'READY' ||
        session.handoff?.outcome !== 'PENDING'
      ) {
        return reply.status(410).send({
          statusCode: 410,
          error: 'Gone',
          code: 'TRACKING_SESSION_CLOSED',
          message: 'This rider tracking invite has expired or the delivery has ended.'
        });
      }

      const { status } = parsed.data;
      if (status === 'PAUSED' && session.status !== 'SHARING') {
        return reply.status(409).send({
          statusCode: 409,
          error: 'Conflict',
          code: 'TRACKING_NOT_SHARING',
          message: 'Location sharing must be active before it can be paused.'
        });
      }

      const now = new Date();
      const result = await fastify.prisma.delivery_tracking_sessions.updateMany({
        where: {
          id: session.id,
          rider_token_hash: tokenHash,
          status: session.status
        },
        data: {
          status,
          ...(status === 'SHARING' && {
            started_at: session.started_at || now,
            paused_at: null
          }),
          ...(status === 'PAUSED' && { paused_at: now }),
          ...(status === 'STOPPED' && {
            rider_token_hash: null,
            rider_token_expires_at: null,
            latitude: null,
            longitude: null,
            accuracy_m: null,
            speed_mps: null,
            heading_degrees: null,
            location_updated_at: null,
            stopped_at: now
          })
        }
      });
      if (result.count !== 1) {
        return reply.status(409).send({
          statusCode: 409,
          error: 'Conflict',
          code: 'TRACKING_SESSION_CHANGED',
          message: 'The delivery tracking session changed. Refresh the page before continuing.'
        });
      }

      fastify.broadcastWs({
        event: 'DELIVERY_LOCATION_UPDATED',
        outlet: session.order.outlet,
        data: { orderId: session.order.id, trackingStatus: status, updatedAt: now }
      });
      return reply.send({ success: true, status });
    }
  );

  fastify.post(
    '/rider/location',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (request, reply) => {
      noStore(reply);
      const token = trackingToken(request);
      if (!token) return unauthorized(reply);

      const parsed = locationSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          code: 'INVALID_LOCATION',
          message: 'Location coordinates and optional motion values are invalid.'
        });
      }

      const tokenHash = hashTrackingToken(token);
      const session = await fastify.prisma.delivery_tracking_sessions.findUnique({
        where: { rider_token_hash: tokenHash },
        include: {
          order: { select: { id: true, outlet: true, status: true, channel: true } },
          handoff: { select: { outcome: true } }
        }
      });
      if (
        !session ||
        !session.rider_token_expires_at ||
        session.rider_token_expires_at.getTime() <= Date.now() ||
        session.status !== 'SHARING' ||
        session.order.channel !== 'PHONE_DELIVERY' ||
        session.order.status !== 'READY' ||
        session.handoff?.outcome !== 'PENDING'
      ) {
        return reply.status(409).send({
          statusCode: 409,
          error: 'Conflict',
          code: 'TRACKING_NOT_ACTIVE',
          message: 'Location updates are accepted only during an active, shared delivery.'
        });
      }

      const updatedAt = new Date();
      const result = await fastify.prisma.delivery_tracking_sessions.updateMany({
        where: {
          id: session.id,
          rider_token_hash: tokenHash,
          status: 'SHARING',
          rider_token_expires_at: { gt: updatedAt }
        },
        data: {
          latitude: parsed.data.latitude,
          longitude: parsed.data.longitude,
          accuracy_m: parsed.data.accuracyM,
          speed_mps: parsed.data.speedMps ?? null,
          heading_degrees: parsed.data.headingDegrees ?? null,
          location_updated_at: updatedAt
        }
      });
      if (result.count !== 1) {
        return reply.status(409).send({
          statusCode: 409,
          error: 'Conflict',
          code: 'TRACKING_NOT_ACTIVE',
          message: 'Location updates are accepted only during an active, shared delivery.'
        });
      }

      fastify.broadcastWs({
        event: 'DELIVERY_LOCATION_UPDATED',
        outlet: session.order.outlet,
        data: { orderId: session.order.id, trackingStatus: 'SHARING', updatedAt }
      });
      return reply.send({ success: true, updatedAt });
    }
  );
};
