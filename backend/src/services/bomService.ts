import { PrismaClient } from '@prisma/client';

export class BomService {
  /**
   * Deducts raw inventory items based on recipe BOM definitions for all items in an order.
   * Atomically executes in a transaction.
   */
  static async deductOrderBom(prisma: PrismaClient, orderId: string): Promise<void> {
    const order = await prisma.orders.findUnique({
      where: { id: orderId },
      include: {
        order_items: {
          include: {
            menu_item: {
              include: {
                recipe_boms: {
                  include: {
                    raw_material: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!order) {
      throw new Error(`Order ${orderId} not found for BOM deduction`);
    }

    await prisma.$transaction(async (tx) => {
      const deductions = new Map<string, number>();
      for (const item of order.order_items) {
        for (const bom of item.menu_item.recipe_boms) {
          const totalDeduction = Number(bom.quantity_deducted) * item.quantity;
          deductions.set(
            bom.raw_material_id,
            (deductions.get(bom.raw_material_id) || 0) + totalDeduction
          );
        }
      }

      for (const [inventoryId, quantity] of deductions) {
        const inventory = await tx.raw_inventory.update({
          where: { id: inventoryId },
          data: { current_stock: { decrement: quantity } }
        });
        await tx.stock_movements.create({
          data: {
            outlet: order.outlet,
            inventory_id: inventoryId,
            movement_type: 'SALES_USAGE',
            quantity_change: -quantity,
            stock_after: inventory.current_stock,
            business_date: order.business_date,
            note: `Recipe ingredients for order ${order.digital_token}`,
            order_id: order.id
          }
        });
      }
    });
  }
}
