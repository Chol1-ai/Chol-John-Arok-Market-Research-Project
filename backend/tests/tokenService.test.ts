import { describe, it, expect, beforeEach } from 'vitest';
import { TokenService } from '../src/services/tokenService.js';

describe('TokenService (Kampala Digital Token Queue)', () => {
  beforeEach(() => {
    TokenService.resetDailyCounters();
  });

  it('generates sequential Foodizo tokens starting at #F-101', async () => {
    const mockPrisma = {} as any;
    const t1 = await TokenService.getNextToken(mockPrisma, 'FOODIZO_HAM_TOWERS');
    const t2 = await TokenService.getNextToken(mockPrisma, 'FOODIZO_HAM_TOWERS');

    expect(t1).toBe('#F-101');
    expect(t2).toBe('#F-102');
  });

  it('generates sequential Obunuzi tokens starting at #O-101', async () => {
    const mockPrisma = {} as any;
    const t1 = await TokenService.getNextToken(mockPrisma, 'OBUNUZI_YMCA');
    const t2 = await TokenService.getNextToken(mockPrisma, 'OBUNUZI_YMCA');

    expect(t1).toBe('#O-101');
    expect(t2).toBe('#O-102');
  });

  it('resets counters at 05:00 EAT start of day', async () => {
    const mockPrisma = {} as any;
    await TokenService.getNextToken(mockPrisma, 'FOODIZO_HAM_TOWERS');
    await TokenService.getNextToken(mockPrisma, 'FOODIZO_HAM_TOWERS');
    TokenService.resetDailyCounters();

    const freshToken = await TokenService.getNextToken(mockPrisma, 'FOODIZO_HAM_TOWERS');
    expect(freshToken).toBe('#F-101');
  });
});

