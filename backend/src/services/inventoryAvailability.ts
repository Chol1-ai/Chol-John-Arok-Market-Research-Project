import { Prisma } from '@prisma/client';

export type MenuItemWithInventory = Prisma.menu_itemsGetPayload<{
  include: {
    recipe_boms: {
      include: { raw_material: true };
    };
  };
}>;

export interface InventoryShortage {
  inventoryId: string;
  itemName: string;
  requiredQuantity: number;
  currentStock: number;
  unitOfMeasure: string;
  menuItemNames: string[];
}

export function findInventoryShortages(
  menuItems: MenuItemWithInventory[],
  quantities: Map<string, number>,
  outlet: string
): InventoryShortage[] {
  const requiredByInventory = new Map<
    string,
    {
      requiredQuantity: number;
      currentStock: number;
      itemName: string;
      unitOfMeasure: string;
      menuItemNames: Set<string>;
    }
  >();

  for (const menuItem of menuItems) {
    const quantity = quantities.get(menuItem.id) || 0;
    for (const recipe of menuItem.recipe_boms) {
      const ingredient = recipe.raw_material;

      const existing = requiredByInventory.get(ingredient.id);
      if (existing) {
        existing.requiredQuantity += Number(recipe.quantity_deducted) * quantity;
        existing.menuItemNames.add(menuItem.name);
      } else {
        requiredByInventory.set(ingredient.id, {
          requiredQuantity: Number(recipe.quantity_deducted) * quantity,
          currentStock: ingredient.outlet === outlet ? Number(ingredient.current_stock) : 0,
          itemName: ingredient.item_name,
          unitOfMeasure: ingredient.unit_of_measure,
          menuItemNames: new Set([menuItem.name])
        });
      }
    }
  }

  return [...requiredByInventory.entries()]
    .filter(([, ingredient]) => ingredient.currentStock < ingredient.requiredQuantity)
    .map(([inventoryId, ingredient]) => ({
      inventoryId,
      itemName: ingredient.itemName,
      requiredQuantity: ingredient.requiredQuantity,
      currentStock: ingredient.currentStock,
      unitOfMeasure: ingredient.unitOfMeasure,
      menuItemNames: [...ingredient.menuItemNames]
    }));
}

export function inventoryAvailabilityReason(shortages: InventoryShortage[]): string | null {
  if (!shortages.length) return null;
  return `Insufficient stock: ${shortages.map((item) => item.itemName).join(', ')}`;
}
