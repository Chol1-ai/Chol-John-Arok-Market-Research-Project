import { PrismaClient } from '@prisma/client';
import { AssignRiderInput, AuthUserPayload } from '../types/index.js';

export class HandoffError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'HandoffError';
  }
}

function assertOutlet(actor: AuthUserPayload, outlet: string) {
  if (actor.outlet && actor.outlet !== outlet) {
    throw new HandoffError(
      403,
      'OUTLET_FORBIDDEN',
      `This account is scoped to ${actor.outlet} and cannot dispatch an order from ${outlet}.`
    );
  }
}

export async function assignRiderToOrder(
  prisma: PrismaClient,
  orderId: string,
  input: AssignRiderInput,
  actor: AuthUserPayload
) {
  const order = await prisma.orders.findUnique({
    where: { id: orderId },
    include: {
      handoffs: {
        where: { outcome: 'PENDING' },
        orderBy: { dispatched_at: 'desc' }
      }
    }
  });

  if (!order) {
    throw new HandoffError(404, 'ORDER_NOT_FOUND', `Order ${orderId} not found.`);
  }

  assertOutlet(actor, order.outlet);

  if (order.channel !== 'PHONE_DELIVERY') {
    throw new HandoffError(
      400,
      'DELIVERY_ONLY_ACTION',
      'Rider handoffs can only be recorded for PHONE_DELIVERY orders.'
    );
  }

  if (order.status !== 'READY') {
    throw new HandoffError(
      409,
      'ORDER_NOT_READY',
      `Order ${order.public_ref} is ${order.status}; a rider can only be assigned when the kitchen has marked it READY.`
    );
  }

  if (order.handoffs.length > 0) {
    throw new HandoffError(
      409,
      'HANDOFF_ALREADY_OPEN',
      `Order ${order.public_ref} already has an open rider handoff.`
    );
  }

  const notes = [
    input.bodaStage ? `Stage: ${input.bodaStage}` : null,
    input.bodaPlateNumber ? `Plate: ${input.bodaPlateNumber}` : null
  ].filter(Boolean);

  return prisma.delivery_handoffs.create({
    data: {
      order_id: order.id,
      dispatched_by: actor.userId,
      rider_name: input.riderName,
      rider_phone: input.riderPhone,
      rider_advance_ugx: input.advanceCashUgx ?? 0,
      dispatch_method: input.dispatchMethod || 'CALL',
      outcome: 'PENDING',
      notes: notes.length > 0 ? notes.join(' • ') : null
    }
  });
}

export type DeliveryOutcome =
  | 'DELIVERED'
  | 'FAILED_UNREACHABLE'
  | 'REFUSED'
  | 'RETURNED';

export async function completeOrderDelivery(
  prisma: PrismaClient,
  orderId: string,
  actor: AuthUserPayload,
  options: { outcome?: DeliveryOutcome; riderAdvanceReturnedUgx?: number } = {}
) {
  const outcome = options.outcome || 'DELIVERED';
  const order = await prisma.orders.findUnique({
    where: { id: orderId },
    include: {
      handoffs: {
        orderBy: { dispatched_at: 'desc' }
      }
    }
  });

  if (!order) {
    throw new HandoffError(404, 'ORDER_NOT_FOUND', `Order ${orderId} not found.`);
  }

  assertOutlet(actor, order.outlet);

  if (order.channel !== 'PHONE_DELIVERY') {
    throw new HandoffError(
      400,
      'DELIVERY_ONLY_ACTION',
      'Delivery completion is only valid for PHONE_DELIVERY orders.'
    );
  }

  if (order.status === 'COMPLETED') {
    return { order, alreadyCompleted: true, outcome };
  }

  const openHandoff = order.handoffs.find((handoff) => handoff.outcome === 'PENDING');
  if (!openHandoff) {
    throw new HandoffError(
      409,
      'DELIVERY_COMPLETION_REQUIRES_HANDOFF',
      'Order cannot be marked complete without an open boda handoff.'
    );
  }

  return prisma.$transaction(async (tx) => {
    await tx.delivery_handoffs.update({
      where: { id: openHandoff.id },
      data: {
        outcome,
        delivered_at: outcome === 'DELIVERED' ? new Date() : null,
        ...(options.riderAdvanceReturnedUgx !== undefined && {
          rider_advance_returned_ugx: options.riderAdvanceReturnedUgx
        })
      }
    });

    if (outcome !== 'DELIVERED') {
      // Leave the READY order in place for manager review/retry. The failed
      // handoff is visible in the dispatch review queue and the daily digest.
      const current = await tx.orders.findUniqueOrThrow({ where: { id: order.id } });
      return { order: current, alreadyCompleted: false, outcome };
    }

    const updated = await tx.orders.update({
      where: { id: order.id },
      data: {
        status: 'COMPLETED',
        completed_at: new Date()
      }
    });

    return { order: updated, alreadyCompleted: false, outcome };
  });
}
