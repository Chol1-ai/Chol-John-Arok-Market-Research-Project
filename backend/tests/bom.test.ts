import { describe, it, expect } from 'vitest';

describe('Recipe Bill-of-Materials (BOM) Calculations', () => {
  const rolexRecipe = {
    name: 'Regular Rolex (2 Eggs, 1 Chapati)',
    boms: [
      { material: 'Fresh Farm Eggs', unit: 'PIECES', quantity: 2 },
      { material: 'Mukwano Cooking Oil', unit: 'MILLILITERS', quantity: 15 }
    ]
  };

  const chickenComboRecipe = {
    name: '2pc Fried Chicken & Chips',
    boms: [
      { material: 'Raw Broiler Chicken Portions', unit: 'PIECES', quantity: 2 },
      { material: 'Potatoes (pre-cut chips)', unit: 'GRAMS', quantity: 250 },
      { material: 'Mukwano Cooking Oil', unit: 'MILLILITERS', quantity: 50 }
    ]
  };

  it('calculates correct inventory deduction for 3 Rolexes', () => {
    const orderQuantity = 3;
    const eggDeduction = rolexRecipe.boms[0].quantity * orderQuantity;
    const oilDeduction = rolexRecipe.boms[1].quantity * orderQuantity;

    expect(eggDeduction).toBe(6); // 6 eggs
    expect(oilDeduction).toBe(45); // 45 ml
  });

  it('calculates correct inventory deduction for 2 Chicken combos', () => {
    const orderQuantity = 2;
    const chickenPieces = chickenComboRecipe.boms[0].quantity * orderQuantity;
    const potatoGrams = chickenComboRecipe.boms[1].quantity * orderQuantity;
    const oilMl = chickenComboRecipe.boms[2].quantity * orderQuantity;

    expect(chickenPieces).toBe(4); // 4 pieces
    expect(potatoGrams).toBe(500); // 500 grams
    expect(oilMl).toBe(100); // 100 ml
  });
});

