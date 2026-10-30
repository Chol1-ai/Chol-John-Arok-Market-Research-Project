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
      for (const item of order.order_items) {
        for (const bom of item.menu_item.recipe_boms) {
          const totalDeduction = Number(bom.quantity_deducted) * item.quantity;

          // Decrement raw inventory stock atomically
          await tx.raw_inventory.update({
            where: { id: bom.raw_material_id },
            data: {
              current_stock: {
                decrement: totalDeduction
              }
            }
          });
        }
      }
    });
  }
}

