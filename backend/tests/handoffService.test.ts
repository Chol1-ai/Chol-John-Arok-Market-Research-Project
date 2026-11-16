import { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { assignRiderToOrder } from '../src/services/handoffService.js';
import { hashTrackingToken } from '../src/services/deliveryTrackingService.js';
import { AuthUserPayload } from '../src/types/index.js';

const actor: AuthUserPayload = {
  userId: '00000000-0000-4000-8000-000000000001',
  fullName: 'Sarah K.',
  phoneNumber: '256701112233',
  role: 'WAITER_FOH',
  outlet: 'FOODIZO_HAM_TOWERS'
};

function makePrisma(
  priorHandoffs: Array<{ id: string; outcome: string; reviewed: boolean }>,
  trackingSession: {
    customer_token_hash: string;
    customer_token_expires_at: Date;
  } | null = {
    customer_token_hash: 'a'.repeat(64),
    customer_token_expires_at: new Date(Date.now() + 60_000)
  }
) {
  const tx = {
    delivery_handoffs: {
      create: vi.fn().mockResolvedValue({
        id: '00000000-0000-4000-8000-000000000003',
        outcome: 'PENDING'
      }),
      updateMany: vi.fn().mockResolvedValue({ count: priorHandoffs.length })
    },
    delivery_tracking_sessions: {
      upsert: vi.fn().mockResolvedValue({})
    },
    audit_log: {
      create: vi.fn().mockResolvedValue({})
    }
  };
  const prisma = {
    orders: {
      findUnique: vi.fn().mockResolvedValue({
        id: '00000000-0000-4000-8000-000000000002',
        outlet: 'FOODIZO_HAM_TOWERS',
        channel: 'PHONE_DELIVERY',
        status: 'READY',
        public_ref: 'ORD-RETRY',
        handoffs: priorHandoffs,
        delivery_tracking_session: trackingSession
      })
    },
    $transaction: vi.fn(
      async (work: (client: typeof tx) => Promise<unknown>) => work(tx)
    )
  } as unknown as PrismaClient;

  return { prisma, tx };
}

describe('assignRiderToOrder', () => {
  it('marks a failed handoff reviewed when a new rider is assigned', async () => {
    const failedHandoff = {
      id: '00000000-0000-4000-8000-000000000004',
      outcome: 'FAILED_UNREACHABLE',
      reviewed: false
    };
    const { prisma, tx } = makePrisma([failedHandoff]);

    await assignRiderToOrder(
      prisma,
      '00000000-0000-4000-8000-000000000002',
      { riderName: 'Kato Emmanuel', riderPhone: '256701112233' },
      actor
    );

    expect(tx.delivery_handoffs.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [failedHandoff.id] }, reviewed: false },
      data: { reviewed: true }
    });
    expect(tx.audit_log.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'FAILED_DELIVERY_RETRY_ASSIGNED',
          entity_id: failedHandoff.id
        })
      })
    );
  });

  it('does not mark reviewed or write review audit when there was no failed attempt', async () => {
    const { prisma, tx } = makePrisma([]);

    await assignRiderToOrder(
      prisma,
      '00000000-0000-4000-8000-000000000002',
      { riderName: 'Kato Emmanuel', riderPhone: '256701112233' },
      actor
    );

    expect(tx.delivery_handoffs.updateMany).not.toHaveBeenCalled();
    expect(tx.audit_log.create).not.toHaveBeenCalled();
  });

  it('creates private rider and customer links while persisting only token hashes', async () => {
    const { prisma, tx } = makePrisma([], null);

    const result = await assignRiderToOrder(
      prisma,
      '00000000-0000-4000-8000-000000000002',
      { riderName: 'Kato Emmanuel', riderPhone: '256701112233' },
      actor
    );

    expect(result.riderTrackingToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(result.customerTrackingToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(tx.delivery_tracking_sessions.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          rider_token_hash: hashTrackingToken(result.riderTrackingToken),
          customer_token_hash: hashTrackingToken(result.customerTrackingToken)
        })
      })
    );
    const persistedSession = tx.delivery_tracking_sessions.upsert.mock.calls[0][0];
    expect(JSON.stringify(persistedSession)).not.toContain(result.riderTrackingToken);
    expect(JSON.stringify(persistedSession)).not.toContain(result.customerTrackingToken);
  });
});
