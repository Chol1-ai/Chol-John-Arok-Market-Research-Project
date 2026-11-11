import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getKampalaBusinessDate } from '../services/tokenService.js';
import { OutletLocation } from '../types/index.js';

const outletSchema = z.enum(['FOODIZO_HAM_TOWERS', 'OBUNUZI_YMCA']);
const querySchema = z.object({ outlet: outletSchema.optional() });

const createItemSchema = z.object({
  outlet: outletSchema.optional(),
  itemName: z.string().trim().min(1).max(100),
  unitOfMeasure: z.enum(['MILLILITERS', 'LITERS', 'GRAMS', 'KILOGRAMS', 'PIECES', 'PORTIONS', 'UNITS']),
  alertThreshold: z.number().nonnegative().max(99999999)
});

const stockUpdateSchema = z.object({
  outlet: outletSchema.optional(),
  inventoryId: z.string().uuid(),
  action: z.enum(['STOCK_COUNT', 'MANUAL_USAGE']),
  quantity: z.number().nonnegative().max(99999999),
  note: z.string().trim().max(250).optional()
}).superRefine((data, context) => {
  if (data.action === 'MANUAL_USAGE' && data.quantity <= 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['quantity'], message: 'Usage quantity must be greater than zero.' });
  }
});

const purchaseOrderSchema = z.object({
  outlet: outletSchema.optional(),
  supplierName: z.string().trim().min(1).max(100),
  notes: z.string().trim().max(250).optional(),
  items: z.array(z.object({
    inventoryId: z.string().uuid(),
    quantity: z.number().positive().max(99999999),
    unitCostUgx: z.number().nonnegative().max(99999999.99).optional()
  })).min(1).max(50)
}).superRefine((data, context) => {
  const ids = data.items.map((item) => item.inventoryId);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['items'], message: 'Each inventory item can only appear once per supplier order.' });
  }
});

const receiveSchema = z.object({
  items: z.array(z.object({
    itemId: z.string().uuid(),
    quantity: z.number().positive().max(99999999)
  })).min(1)
}).superRefine((data, context) => {
  const ids = data.items.map((item) => item.itemId);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['items'], message: 'Each order line can only appear once per delivery.' });
  }
});

function resolveOutlet(
  actorOutlet: OutletLocation | null,
  requested: OutletLocation | undefined,
  required = false
): { outlet?: OutletLocation; error?: string } {
  if (actorOutlet) {
    if (requested && requested !== actorOutlet) {
      return { error: `This account is scoped to ${actorOutlet}.` };
    }
    return { outlet: actorOutlet };
  }
  if (required && !requested) return { error: 'An outlet is required for this action.' };
  return { outlet: requested };
}

class SupplierOrderConflict extends Error {}

function serializeOrder(order: {
  id: string;
  outlet: OutletLocation;
  supplier_name: string;
  status: string;
  notes: string | null;
  created_at: Date;
  received_at: Date | null;
  items: Array<{
    id: string;
    inventory_id: string;
    quantity_ordered: unknown;
    quantity_received: unknown;
    unit_cost_ugx: unknown;
    inventory: { item_name: string; unit_of_measure: string };
  }>;
}) {
  return {
    id: order.id,
    outlet: order.outlet,
    supplierName: order.supplier_name,
    status: order.status,
    notes: order.notes,
    createdAt: order.created_at,
    receivedAt: order.received_at,
    items: order.items.map((item) => ({
      id: item.id,
      inventoryId: item.inventory_id,
      itemName: item.inventory.item_name,
      unitOfMeasure: item.inventory.unit_of_measure,
      quantityOrdered: Number(item.quantity_ordered),
      quantityReceived: Number(item.quantity_received),
      unitCostUgx: item.unit_cost_ugx === null ? null : Number(item.unit_cost_ugx)
    }))
  };
}

export const inventoryRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/',
    { preHandler: [fastify.requireRole(['MANAGER_ADMIN'])] },
    async (request, reply) => {
      const query = querySchema.parse(request.query);
      const { outlet, error } = resolveOutlet(request.user!.outlet, query.outlet);
      if (error) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          code: 'OUTLET_FORBIDDEN',
          message: error
        });
      }

      const businessDate = getKampalaBusinessDate();
      const [items, orders, movements, openingCounts] = await Promise.all([
        fastify.prisma.raw_inventory.findMany({
          where: outlet ? { outlet } : undefined,
          orderBy: [{ outlet: 'asc' }, { item_name: 'asc' }]
        }),
        fastify.prisma.supplier_orders.findMany({
          where: {
            ...(outlet ? { outlet } : {}),
            status: { in: ['ORDERED', 'PARTIALLY_RECEIVED'] }
          },
          include: { items: { include: { inventory: true } } },
          orderBy: { created_at: 'desc' },
          take: 30
        }),
        fastify.prisma.stock_movements.findMany({
          where: outlet ? { outlet } : undefined,
          include: {
            inventory: { select: { item_name: true, unit_of_measure: true } },
            user: { select: { full_name: true } }
          },
          orderBy: { created_at: 'desc' },
          take: 60
        }),
        fastify.prisma.stock_movements.findMany({
          where: {
            ...(outlet ? { outlet } : {}),
            movement_type: 'STOCK_COUNT',
            business_date: businessDate
          },
          select: { inventory_id: true },
          distinct: ['inventory_id']
        })
      ]);
      const countedToday = new Set(openingCounts.map((movement) => movement.inventory_id));

      return reply.send({
        success: true,
        items: items.map((item) => ({
          id: item.id,
          outlet: item.outlet,
          itemName: item.item_name,
          unitOfMeasure: item.unit_of_measure,
          currentStock: Number(item.current_stock),
          alertThreshold: Number(item.alert_threshold),
          isLow: Number(item.current_stock) <= Number(item.alert_threshold),
          openingCountRecorded: countedToday.has(item.id),
          updatedAt: item.updated_at
        })),
        supplierOrders: orders.map(serializeOrder),
        movements: movements.map((movement) => ({
          id: movement.id,
          outlet: movement.outlet,
          itemName: movement.inventory.item_name,
          unitOfMeasure: movement.inventory.unit_of_measure,
          type: movement.movement_type,
          quantityChange: Number(movement.quantity_change),
          stockAfter: Number(movement.stock_after),
          businessDate: movement.business_date,
          note: movement.note,
          recordedBy: movement.user?.full_name || null,
          createdAt: movement.created_at
        }))
      });
    }
  );

  fastify.post(
    '/items',
    { preHandler: [fastify.requireRole(['MANAGER_ADMIN'])] },
    async (request, reply) => {
      const data = createItemSchema.parse(request.body);
      const { outlet, error } = resolveOutlet(request.user!.outlet, data.outlet, true);
      if (error || !outlet) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          code: 'OUTLET_FORBIDDEN',
          message: error || 'An outlet is required.'
        });
      }

      const existing = await fastify.prisma.raw_inventory.findUnique({
        where: {
          raw_inventory_outlet_name_unique: {
            outlet,
            item_name: data.itemName
          }
        }
      });
      if (existing) {
        return reply.status(409).send({
          statusCode: 409,
          error: 'Conflict',
          code: 'INVENTORY_ITEM_EXISTS',
          message: `${data.itemName} is already tracked at this outlet.`
        });
      }

      const item = await fastify.prisma.$transaction(async (tx) => {
        const created = await tx.raw_inventory.create({
          data: {
            outlet,
            item_name: data.itemName,
            unit_of_measure: data.unitOfMeasure,
            alert_threshold: data.alertThreshold
          }
        });
        await tx.audit_log.create({
          data: {
            actor_user_id: request.user!.userId,
            actor_role: request.user!.role,
            outlet,
            action: 'INVENTORY_ITEM_CREATED',
            entity_type: 'RAW_INVENTORY',
            entity_id: created.id,
            after_json: { itemName: created.item_name, unitOfMeasure: created.unit_of_measure },
            ip_address: request.ip
          }
        });
        return created;
      });

      return reply.status(201).send({
        success: true,
        item: {
          id: item.id,
          outlet: item.outlet,
          itemName: item.item_name,
          unitOfMeasure: item.unit_of_measure,
          currentStock: Number(item.current_stock),
          alertThreshold: Number(item.alert_threshold),
          isLow: Number(item.current_stock) <= Number(item.alert_threshold)
        }
      });
    }
  );

  fastify.post(
    '/stock',
    { preHandler: [fastify.requireRole(['MANAGER_ADMIN'])] },
    async (request, reply) => {
      const data = stockUpdateSchema.parse(request.body);
      const { outlet, error } = resolveOutlet(request.user!.outlet, data.outlet, true);
      if (error || !outlet) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          code: 'OUTLET_FORBIDDEN',
          message: error || 'An outlet is required.'
        });
      }

      const result = await fastify.prisma.$transaction(async (tx) => {
        const item = await tx.raw_inventory.findFirst({
          where: { id: data.inventoryId, outlet }
        });
        if (!item) return null;

        if (data.action === 'MANUAL_USAGE') {
          const updatedCount = await tx.raw_inventory.updateMany({
            where: { id: item.id, outlet, current_stock: { gte: data.quantity } },
            data: { current_stock: { decrement: data.quantity } }
          });
          if (!updatedCount.count) return { insufficient: true as const };
        } else {
          await tx.raw_inventory.update({
            where: { id: item.id },
            data: { current_stock: data.quantity }
          });
        }

        const updated = await tx.raw_inventory.findUniqueOrThrow({ where: { id: item.id } });
        const change = data.action === 'STOCK_COUNT'
          ? Number(updated.current_stock) - Number(item.current_stock)
          : -data.quantity;
        const movement = await tx.stock_movements.create({
          data: {
            outlet,
            inventory_id: item.id,
            recorded_by: request.user!.userId,
            movement_type: data.action,
            quantity_change: change,
            stock_after: updated.current_stock,
            business_date: getKampalaBusinessDate(),
            note: data.note || null
          }
        });
        await tx.audit_log.create({
          data: {
            actor_user_id: request.user!.userId,
            actor_role: request.user!.role,
            outlet,
            action: data.action === 'STOCK_COUNT' ? 'INVENTORY_COUNT_RECORDED' : 'INVENTORY_USAGE_RECORDED',
            entity_type: 'RAW_INVENTORY',
            entity_id: item.id,
            before_json: { currentStock: Number(item.current_stock) },
            after_json: { currentStock: Number(updated.current_stock), quantityChange: change },
            reason: data.note || null,
            ip_address: request.ip
          }
        });
        return { item: updated, movement };
      });

      if (!result) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          code: 'INVENTORY_ITEM_NOT_FOUND',
          message: 'The selected product was not found at this outlet.'
        });
      }
      if ('insufficient' in result) {
        return reply.status(409).send({
          statusCode: 409,
          error: 'Conflict',
          code: 'INSUFFICIENT_STOCK',
          message: 'The quantity used cannot be greater than the current stock.'
        });
      }

      return reply.send({
        success: true,
        item: {
          id: result.item.id,
          currentStock: Number(result.item.current_stock),
          alertThreshold: Number(result.item.alert_threshold)
        },
        movement: {
          type: result.movement.movement_type,
          quantityChange: Number(result.movement.quantity_change),
          stockAfter: Number(result.movement.stock_after)
        }
      });
    }
  );

  fastify.post(
    '/supplier-orders',
    { preHandler: [fastify.requireRole(['MANAGER_ADMIN'])] },
    async (request, reply) => {
      const data = purchaseOrderSchema.parse(request.body);
      const { outlet, error } = resolveOutlet(request.user!.outlet, data.outlet, true);
      if (error || !outlet) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          code: 'OUTLET_FORBIDDEN',
          message: error || 'An outlet is required.'
        });
      }
      const inventory = await fastify.prisma.raw_inventory.findMany({
        where: { outlet, id: { in: data.items.map((item) => item.inventoryId) } },
        select: { id: true }
      });
      if (inventory.length !== data.items.length) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          code: 'INVENTORY_OUTLET_MISMATCH',
          message: 'All supplier order products must belong to the selected outlet.'
        });
      }

      const order = await fastify.prisma.$transaction(async (tx) => {
        const created = await tx.supplier_orders.create({
          data: {
            outlet,
            supplier_name: data.supplierName,
            notes: data.notes || null,
            created_by: request.user!.userId,
            items: {
              create: data.items.map((item) => ({
                inventory_id: item.inventoryId,
                quantity_ordered: item.quantity,
                unit_cost_ugx: item.unitCostUgx ?? null
              }))
            }
          },
          include: { items: { include: { inventory: true } } }
        });
        await tx.audit_log.create({
          data: {
            actor_user_id: request.user!.userId,
            actor_role: request.user!.role,
            outlet,
            action: 'SUPPLIER_ORDER_CREATED',
            entity_type: 'SUPPLIER_ORDER',
            entity_id: created.id,
            after_json: {
              supplierName: created.supplier_name,
              items: created.items.map((item) => ({
                itemName: item.inventory.item_name,
                quantity: Number(item.quantity_ordered)
              }))
            },
            ip_address: request.ip
          }
        });
        return created;
      });

      return reply.status(201).send({
        success: true,
        message: `Supplier order placed with ${order.supplier_name}. Stock will update when the delivery is received.`,
        order: serializeOrder(order)
      });
    }
  );

  fastify.post(
    '/supplier-orders/:id/receive',
    { preHandler: [fastify.requireRole(['MANAGER_ADMIN'])] },
    async (request, reply) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const data = receiveSchema.parse(request.body);
      const order = await fastify.prisma.supplier_orders.findUnique({
        where: { id: params.id },
        include: { items: { include: { inventory: true } } }
      });
      if (!order) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          code: 'SUPPLIER_ORDER_NOT_FOUND',
          message: 'The supplier order was not found.'
        });
      }
      const { outlet, error } = resolveOutlet(request.user!.outlet, order.outlet, true);
      if (error || !outlet) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          code: 'OUTLET_FORBIDDEN',
          message: error || 'An outlet is required.'
        });
      }
      if (order.status === 'RECEIVED') {
        return reply.status(409).send({
          statusCode: 409,
          error: 'Conflict',
          code: 'SUPPLIER_ORDER_ALREADY_RECEIVED',
          message: 'This supplier order has already been fully received.'
        });
      }
      const orderItems = new Map(order.items.map((item) => [item.id, item]));
      for (const received of data.items) {
        const line = orderItems.get(received.itemId);
        if (!line || received.quantity > Number(line.quantity_ordered) - Number(line.quantity_received)) {
          return reply.status(400).send({
            statusCode: 400,
            error: 'Bad Request',
            code: 'INVALID_DELIVERY_QUANTITY',
            message: 'Delivery quantities must match an order line and cannot exceed its remaining quantity.'
          });
        }
      }

      let updatedOrder;
      try {
        updatedOrder = await fastify.prisma.$transaction(async (tx) => {
          for (const received of data.items) {
            const line = orderItems.get(received.itemId)!;
            const reserved = await tx.supplier_order_items.updateMany({
              where: {
                id: line.id,
                quantity_received: {
                  lte: Number(line.quantity_ordered) - received.quantity
                }
              },
              data: { quantity_received: { increment: received.quantity } }
            });
            if (!reserved.count) throw new SupplierOrderConflict();

            const inventoryItem = await tx.raw_inventory.update({
              where: { id: line.inventory_id },
              data: { current_stock: { increment: received.quantity } }
            });
            await tx.stock_movements.create({
              data: {
                outlet,
                inventory_id: line.inventory_id,
                recorded_by: request.user!.userId,
                movement_type: 'SUPPLIER_RECEIPT',
                quantity_change: received.quantity,
                stock_after: inventoryItem.current_stock,
                business_date: getKampalaBusinessDate(),
                note: `Supplier delivery: ${order.supplier_name}`,
                supplier_order_id: order.id
              }
            });
          }

          const receivedItems = await tx.supplier_order_items.findMany({
            where: { supplier_order_id: order.id },
            select: { quantity_ordered: true, quantity_received: true }
          });
          const fullyReceived = receivedItems.every(
            (line) => Number(line.quantity_received) >= Number(line.quantity_ordered)
          );
          const updated = await tx.supplier_orders.update({
            where: { id: order.id },
            data: {
              status: fullyReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED',
              ...(fullyReceived ? { received_at: new Date() } : {})
            },
            include: { items: { include: { inventory: true } } }
          });
          await tx.audit_log.create({
            data: {
              actor_user_id: request.user!.userId,
              actor_role: request.user!.role,
              outlet,
              action: 'SUPPLIER_DELIVERY_RECEIVED',
              entity_type: 'SUPPLIER_ORDER',
              entity_id: order.id,
              after_json: { items: data.items, status: updated.status },
              ip_address: request.ip
            }
          });
          return updated;
        });
      } catch (receiveError) {
        if (receiveError instanceof SupplierOrderConflict) {
          return reply.status(409).send({
            statusCode: 409,
            error: 'Conflict',
            code: 'DELIVERY_ALREADY_RECORDED',
            message: 'Another delivery update changed this order. Refresh it before recording these quantities.'
          });
        }
        throw receiveError;
      }

      return reply.send({
        success: true,
        message: 'Supplier delivery recorded and stock updated.',
        order: serializeOrder(updatedOrder)
      });
    }
  );
};
