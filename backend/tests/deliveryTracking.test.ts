import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { deliveryTrackingRoutes } from '../src/routes/deliveryTracking.js';
import { hashTrackingToken } from '../src/services/deliveryTrackingService.js';

const customerToken = 'c'.repeat(43);
const riderToken = 'r'.repeat(43);

function customerSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'session-id',
    customer_token_expires_at: new Date(Date.now() + 60_000),
    status: 'INVITED',
    latitude: null,
    longitude: null,
    accuracy_m: null,
    location_updated_at: null,
    handoff: { rider_name: 'Kato Emmanuel', outcome: 'PENDING' },
    order: {
      public_ref: 'ORD-TRACK',
      digital_token: 'TOKEN-012',
      outlet: 'FOODIZO_HAM_TOWERS',
      channel: 'PHONE_DELIVERY',
      status: 'READY',
      delivery_zone: { display_name: 'Makerere' }
    },
    ...overrides
  };
}

function riderSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'session-id',
    rider_token_expires_at: new Date(Date.now() + 60_000),
    status: 'SHARING',
    started_at: new Date(),
    order: {
      id: 'order-id',
      public_ref: 'ORD-TRACK',
      digital_token: 'TOKEN-012',
      outlet: 'FOODIZO_HAM_TOWERS',
      channel: 'PHONE_DELIVERY',
      status: 'READY',
      customer_name: 'Amina N.',
      customer_phone: '256701112233',
      delivery_note: 'Mary Stuart Hall, Block B',
      delivery_lat: 0.3275,
      delivery_lng: 32.5681,
      delivery_zone: { display_name: 'Makerere' }
    },
    handoff: { rider_name: 'Kato Emmanuel', outcome: 'PENDING' },
    ...overrides
  };
}

describe('delivery tracking routes', () => {
  let app: ReturnType<typeof Fastify>;
  let prisma: {
    delivery_tracking_sessions: {
      findUnique: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
    };
  };
  let broadcastWs: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    prisma = {
      delivery_tracking_sessions: {
        findUnique: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 })
      }
    };
    broadcastWs = vi.fn();
    app = Fastify({ logger: false });
    app.decorate('prisma', prisma as unknown as PrismaClient);
    app.decorate('broadcastWs', broadcastWs);
    await app.register(deliveryTrackingRoutes, { prefix: '/api/v1/delivery-tracking' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('requires an opaque bearer link before looking up customer tracking', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/delivery-tracking/customer'
    });

    expect(response.statusCode).toBe(401);
    expect(prisma.delivery_tracking_sessions.findUnique).not.toHaveBeenCalled();
  });

  it('returns only the assigned rider location through the customer-specific link', async () => {
    prisma.delivery_tracking_sessions.findUnique.mockResolvedValue(customerSession({
      status: 'SHARING',
      latitude: 0.3275,
      longitude: 32.5681,
      accuracy_m: 12.5,
      location_updated_at: new Date('2026-11-16T10:00:00.000Z')
    }));

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/delivery-tracking/customer',
      headers: { authorization: `Bearer ${customerToken}` }
    });

    expect(response.statusCode).toBe(200);
    expect(prisma.delivery_tracking_sessions.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { customer_token_hash: hashTrackingToken(customerToken) }
      })
    );
    expect(response.json()).toMatchObject({
      success: true,
      orderNumber: 'ORD-TRACK',
      tokenNumber: 'TOKEN-012',
      trackingStatus: 'SHARING',
      riderName: 'Kato Emmanuel',
      latitude: 0.3275,
      longitude: 32.5681,
      accuracyM: 12.5
    });
    expect(response.json()).not.toHaveProperty('customerPhone');
  });

  it('labels paused tracking and returns only its last known point', async () => {
    prisma.delivery_tracking_sessions.findUnique.mockResolvedValue(customerSession({
      status: 'PAUSED',
      latitude: 0.3275,
      longitude: 32.5681,
      accuracy_m: 12.5,
      location_updated_at: new Date('2026-11-16T10:00:00.000Z')
    }));

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/delivery-tracking/customer',
      headers: { authorization: `Bearer ${customerToken}` }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      trackingStatus: 'PAUSED',
      latitude: 0.3275,
      longitude: 32.5681,
      locationUpdatedAt: '2026-11-16T10:00:00.000Z'
    });
  });

  it('returns delivery contact details only through the assigned rider invite', async () => {
    prisma.delivery_tracking_sessions.findUnique.mockResolvedValue(riderSession());

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/delivery-tracking/rider/session',
      headers: { authorization: `Bearer ${riderToken}` }
    });

    expect(response.statusCode).toBe(200);
    expect(prisma.delivery_tracking_sessions.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { rider_token_hash: hashTrackingToken(riderToken) }
      })
    );
    expect(response.json()).toMatchObject({
      orderNumber: 'ORD-TRACK',
      destination: 'Makerere',
      deliveryNote: 'Mary Stuart Hall, Block B',
      customerName: 'Amina N.',
      customerPhone: '256701112233',
      mapLink: 'https://www.google.com/maps/search/?api=1&query=0.3275,32.5681'
    });
  });

  it('rejects GPS updates when the rider has paused sharing', async () => {
    prisma.delivery_tracking_sessions.findUnique.mockResolvedValue(riderSession({
      status: 'PAUSED'
    }));

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/delivery-tracking/rider/location',
      headers: { authorization: `Bearer ${riderToken}` },
      payload: {
        latitude: 0.3275,
        longitude: 32.5681,
        accuracyM: 10
      }
    });

    expect(response.statusCode).toBe(409);
    expect(prisma.delivery_tracking_sessions.updateMany).not.toHaveBeenCalled();
  });

  it('rejects out-of-range coordinates before writing them', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/delivery-tracking/rider/location',
      headers: { authorization: `Bearer ${riderToken}` },
      payload: {
        latitude: 91,
        longitude: 32.5681,
        accuracyM: 10
      }
    });

    expect(response.statusCode).toBe(400);
    expect(prisma.delivery_tracking_sessions.findUnique).not.toHaveBeenCalled();
    expect(prisma.delivery_tracking_sessions.updateMany).not.toHaveBeenCalled();
  });

  it('revokes the rider invite and clears the last location when tracking stops', async () => {
    prisma.delivery_tracking_sessions.findUnique.mockResolvedValue(
      riderSession({ status: 'INVITED' })
    );

    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/delivery-tracking/rider/session',
      headers: { authorization: `Bearer ${riderToken}` },
      payload: { status: 'STOPPED' }
    });

    expect(response.statusCode).toBe(200);
    expect(prisma.delivery_tracking_sessions.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'session-id',
          rider_token_hash: hashTrackingToken(riderToken),
          status: 'INVITED'
        },
        data: expect.objectContaining({
          status: 'STOPPED',
          rider_token_hash: null,
          latitude: null,
          longitude: null
        })
      })
    );
    expect(broadcastWs).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'DELIVERY_LOCATION_UPDATED' })
    );
  });
});
