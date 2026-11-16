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
      isAvailable: true,
      station: 'STEAM_LINE',
      preparationTimeEstimate: { minMinutes: 5, maxMinutes: 15 }
    },
    {
      name: 'Beef Rolex',
      category: 'Rolex',
      description: null,
      priceUgx: 8000,
      isAvailable: true,
      station: 'ROLEX_GRIDDLE',
      preparationTimeEstimate: { minMinutes: 5, maxMinutes: 10 }
    },
    {
      name: 'Beans and Rice',
      category: 'Meals',
      description: null,
      priceUgx: 6000,
      isAvailable: true,
      station: 'STEAM_LINE',
      preparationTimeEstimate: { minMinutes: 5, maxMinutes: 15 }
    },
    {
      name: 'Chapati',
      category: 'Sides',
      description: null,
      priceUgx: 1000,
      isAvailable: false,
      station: 'ROLEX_GRIDDLE',
      preparationTimeEstimate: { minMinutes: 5, maxMinutes: 10 }
    },
    {
      name: 'Bottled Water',
      category: 'Cold Drinks & Beverages',
      description: null,
      priceUgx: 1500,
      isAvailable: true,
      station: 'BAR_BEVERAGE',
      preparationTimeEstimate: { minMinutes: 3, maxMinutes: 5 }
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

  it('answers a generic burger price question with current outlet prices', () => {
    const burgerContext: BuddyContext = {
      ...context,
      menuItems: [
        ...context.menuItems,
        {
          name: 'Classic Beef Burger',
          category: 'Burgers',
          description: 'Beef patty with lettuce and tomato.',
          priceUgx: 12000,
          isAvailable: true,
          station: 'GRILL_FRYER',
          preparationTimeEstimate: { minMinutes: 10, maxMinutes: 15 }
        },
        {
          name: 'Crispy Chicken Burger',
          category: 'Burgers',
          description: null,
          priceUgx: 13000,
          isAvailable: true,
          station: 'GRILL_FRYER',
          preparationTimeEstimate: { minMinutes: 10, maxMinutes: 15 }
        },
        {
          name: 'Double Stack Cheeseburger',
          category: 'Burgers',
          description: null,
          priceUgx: 18000,
          isAvailable: true,
          station: 'GRILL_FRYER',
          preparationTimeEstimate: { minMinutes: 10, maxMinutes: 15 }
        },
        {
          name: 'Veggie Burger',
          category: 'Burgers',
          description: null,
          priceUgx: 10000,
          isAvailable: false,
          station: 'GRILL_FRYER',
          preparationTimeEstimate: { minMinutes: 10, maxMinutes: 15 }
        }
      ]
    };

    const answer = getDeterministicBuddyReply('How much is a buger?', burgerContext);

    expect(answer).toContain('Classic Beef Burger: UGX 12,000');
    expect(answer).toContain('Crispy Chicken Burger: UGX 13,000');
    expect(answer).toContain('Double Stack Cheeseburger: UGX 18,000');
    expect(answer).toContain('Veggie Burger: UGX 10,000');
    expect(answer).toContain('currently unavailable');
  });

  it('answers specific meal prices and menu descriptions', () => {
    const answer = getDeterministicBuddyReply('How much is Chicken Luwombo?', context);

    expect(answer).toContain('Chicken Luwombo: UGX 12,000');
    expect(answer).toContain('Slow-cooked chicken.');
  });

  it('answers price questions when only part of a menu item name is provided', () => {
    const answer = getDeterministicBuddyReply('How much is luw?', context);

    expect(answer).toContain('Chicken Luwombo: UGX 12,000');
    expect(answer).toContain('Slow-cooked chicken.');
  });

  it('matches Kikomando questions against existing menu entries with the misspelling', () => {
    const kikomandoContext: BuddyContext = {
      ...context,
      menuItems: [
        ...context.menuItems,
        {
          name: 'Kikkomando (Chapati chopped with Beans)',
          category: 'Kampala Street Food Favourites',
          description: 'Campus favorite comfort food',
          priceUgx: 5000,
          isAvailable: true,
          station: 'ROLEX_GRIDDLE',
          preparationTimeEstimate: { minMinutes: 5, maxMinutes: 10 }
        }
      ]
    };

    const answer = getDeterministicBuddyReply('how much is kikomando', kikomandoContext);

    expect(answer).toContain('UGX 5,000');
    expect(answer).not.toContain('Broader AI chat is not enabled');
  });

  it('answers preparation-time questions with clearly labeled station estimates', () => {
    const answer = getDeterministicBuddyReply(
      'How long does Chicken Luwombo take to prepare?',
      context
    );

    expect(answer).toContain('Chicken Luwombo');
    expect(answer).toContain('estimated to take 5-15 minutes');
    expect(answer).toContain('excludes queue and delivery time');
  });

  it('does not quote a preparation estimate for an unavailable meal', () => {
    const answer = getDeterministicBuddyReply(
      'How long does Chapati take to prepare?',
      context
    );

    expect(answer).toContain('Chapati is currently unavailable');
    expect(answer).not.toContain('estimated to take');
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
