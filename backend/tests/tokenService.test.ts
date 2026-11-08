import { describe, it, expect } from 'vitest';
import { TokenService, getKampalaBusinessDate } from '../src/services/tokenService.js';

function mockPrisma() {
  let value = 0;
  return {
    token_counters: {
      upsert: async ({ create }: { create: { last_value: number } }) => {
        value = value === 0 ? create.last_value : value + 1;
        return { last_value: value };
      }
    }
  } as any;
}

describe('TokenService (Kampala Digital Token Queue)', () => {
  it('allocates sequential TOKEN-NNN values per outlet through the database counter', async () => {
    const prisma = mockPrisma();
    const first = await TokenService.getNextToken(
      prisma,
      'FOODIZO_HAM_TOWERS',
      new Date('2026-11-05T00:00:00.000Z')
    );
    const second = await TokenService.getNextToken(
      prisma,
      'FOODIZO_HAM_TOWERS',
      new Date('2026-11-05T00:00:00.000Z')
    );

    expect(first).toBe('TOKEN-001');
    expect(second).toBe('TOKEN-002');
  });

  it('widens beyond three digits without breaking the canonical prefix', async () => {
    const prisma = {
      token_counters: {
        upsert: async () => ({ last_value: 1000 })
      }
    } as any;

    await expect(
      TokenService.getNextToken(prisma, 'OBUNUZI_YMCA', new Date('2026-11-05T00:00:00.000Z'))
    ).resolves.toBe('TOKEN-1000');
  });

  it('rolls the Kampala business date at 05:00 EAT, not at UTC midnight', () => {
    // 04:59 EAT on 5 Nov = 01:59 UTC on 5 Nov -> still business date 4 Nov.
    expect(
      getKampalaBusinessDate(new Date('2026-11-05T01:59:00.000Z')).toISOString()
    ).toBe('2026-11-04T00:00:00.000Z');

    // 05:00 EAT on 5 Nov = 02:00 UTC on 5 Nov -> business date 5 Nov.
    expect(
      getKampalaBusinessDate(new Date('2026-11-05T02:00:00.000Z')).toISOString()
    ).toBe('2026-11-05T00:00:00.000Z');
  });
});
