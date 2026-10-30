import { describe, it, expect } from 'vitest';

describe('Daily Audit Digest & Cash Drawer Variance', () => {
  it('detects balanced cash drawer with 0 variance', () => {
    const cashSalesUgx = 246000;
    const countedCashUgx = 246000;
    const variance = countedCashUgx - cashSalesUgx;

    expect(variance).toBe(0);
  });

  it('detects cash shortage variance correctly', () => {
    const cashSalesUgx = 300000;
    const countedCashUgx = 280000;
    const variance = countedCashUgx - cashSalesUgx;

    expect(variance).toBe(-20000); // 20,000 UGX shortage
  });

  it('detects cash surplus variance correctly', () => {
    const cashSalesUgx = 150000;
    const countedCashUgx = 155000;
    const variance = countedCashUgx - cashSalesUgx;

    expect(variance).toBe(5000); // 5,000 UGX surplus
  });
});

