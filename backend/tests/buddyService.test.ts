import { describe, expect, it } from 'vitest';
import {
  BuddyContext,
  getDeterministicBuddyReply,
  resolveBuddyOutlet
} from '../src/services/buddyService.js';

const context: BuddyContext = {
  outlet: 'FOODIZO_HAM_TOWERS',
  outletName: 'Foodizo (Ham Towers)',
  menuItems: [
    {
      name: 'Chicken Luwombo',
      category: 'Meals',
      description: 'Slow-cooked chicken.',
      priceUgx: 12000,
      isAvailable: true
    },
    {
      name: 'Beef Rolex',
      category: 'Rolex',
      description: null,
      priceUgx: 8000,
      isAvailable: true
    },
    {
      name: 'Beans and Rice',
      category: 'Meals',
      description: null,
      priceUgx: 6000,
      isAvailable: true
    },
    {
      name: 'Chapati',
      category: 'Sides',
      description: null,
      priceUgx: 1000,
      isAvailable: false
    },
    {
      name: 'Bottled Water',
      category: 'Cold Drinks & Beverages',
      description: null,
      priceUgx: 1500,
      isAvailable: true
    }
  ],
  deliveryZones: [
    {
      code: 'YMCA',
      name: 'Opposite YMCA',
      landmarkGroup: 'Wandegeya',
      landmarkHint: 'Near the YMCA entrance',
      feeUgx: 2500,
      etaMinMinutes: 15,
      etaMaxMinutes: 30
    },
    {
      code: 'MAKERERE',
      name: 'Makerere University',
      landmarkGroup: 'Makerere',
      landmarkHint: null,
      feeUgx: 4000,
      etaMinMinutes: 20,
      etaMaxMinutes: 40
    }
  ]
};

describe('Foodizo Buddy data-backed answers', () => {
  it('uses only available meals for budget recommendations', () => {
    const answer = getDeterministicBuddyReply('What can I eat for UGX 10,000?', context);

    expect(answer).toContain('Beef Rolex - UGX 8,000');
    expect(answer).toContain('Beans and Rice - UGX 6,000');
    expect(answer).not.toContain('Bottled Water');
    expect(answer).not.toContain('Chapati');
    expect(answer).not.toContain('Chicken Luwombo');
  });

  it('returns the lowest-priced available options for a cheapest-meal question', () => {
    const answer = getDeterministicBuddyReply('What is the cheapest meal?', context);

    expect(answer).toContain('Beans and Rice - UGX 6,000');
    expect(answer).not.toContain('Bottled Water');
    expect(answer).not.toContain('Chapati');
  });

  it('answers a delivery-fee question from the requested active zone', () => {
    const answer = getDeterministicBuddyReply('How much is delivery near YMCA?', context);

    expect(answer).toContain('Opposite YMCA: UGX 2,500');
    expect(answer).toContain('ETA 15-30 min');
    expect(answer).not.toContain('Makerere University');
  });

  it('makes a shortened delivery-zone list explicit', () => {
    const firstZone = context.deliveryZones[0];
    if (!firstZone) throw new Error('Test fixture requires a delivery zone.');
    const expandedContext: BuddyContext = {
      ...context,
      deliveryZones: [
        ...context.deliveryZones,
        ...Array.from({ length: 7 }, (_, index) => ({
          ...firstZone,
          code: `ZONE_${index}`,
          name: `Zone ${index}`
        }))
      ]
    };

    const answer = getDeterministicBuddyReply('What are the delivery fees?', expandedContext);

    expect(answer).toContain('Ask about a specific area for other active delivery zones.');
  });

  it('uses a named outlet in the question instead of the current selection', () => {
    expect(resolveBuddyOutlet('Is this available at Obunuzi?', 'FOODIZO_HAM_TOWERS'))
      .toBe('OBUNUZI_YMCA');
    expect(resolveBuddyOutlet('What is the cheapest meal?', 'OBUNUZI_YMCA'))
      .toBe('OBUNUZI_YMCA');
  });
});
