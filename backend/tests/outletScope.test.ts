import { describe, expect, it } from 'vitest';
import { applyOutletScope } from '../src/plugins/outletScope.js';

describe('configured outlet request scope', () => {
  it('defaults outlet filters and public order creation to the configured outlet', () => {
    const query: Record<string, unknown> = {};
    const body: Record<string, unknown> = { channel: 'TAKEAWAY_PICKUP' };

    expect(
      applyOutletScope(
        { method: 'POST', url: '/api/v1/orders', query, body },
        'FOODIZO_HAM_TOWERS'
      )
    ).toBeNull();
    expect(query.outlet).toBe('FOODIZO_HAM_TOWERS');
    expect(body.outlet).toBe('FOODIZO_HAM_TOWERS');
  });

  it('rejects query and body attempts to select another outlet', () => {
    expect(
      applyOutletScope(
        {
          method: 'GET',
          url: '/api/v1/menu-items?outlet=OBUNUZI_YMCA',
          query: { outlet: 'OBUNUZI_YMCA' },
          body: null
        },
        'FOODIZO_HAM_TOWERS'
      )
    ).toBe('OBUNUZI_YMCA');

    expect(
      applyOutletScope(
        {
          method: 'POST',
          url: '/api/v1/auth/staff',
          query: {},
          body: { outlet: 'OBUNUZI_YMCA' }
        },
        'FOODIZO_HAM_TOWERS'
      )
    ).toBe('OBUNUZI_YMCA');
  });

  it('pins list requests to the configured outlet when no outlet is supplied', () => {
    const query: Record<string, unknown> = { category: 'Mains' };
    expect(
      applyOutletScope(
        { method: 'GET', url: '/api/v1/menu-items', query, body: null },
        'FOODIZO_HAM_TOWERS'
      )
    ).toBeNull();
    expect(query).toEqual({ category: 'Mains', outlet: 'FOODIZO_HAM_TOWERS' });
  });
});
