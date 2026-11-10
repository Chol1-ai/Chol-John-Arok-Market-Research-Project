import { afterEach, describe, expect, it } from 'vitest';
import { config } from '../src/config.js';
import { MomoService } from '../src/services/momoService.js';

const originalNodeEnv = config.NODE_ENV;

afterEach(() => {
  config.NODE_ENV = originalNodeEnv;
});

describe('MomoService', () => {
  const request = {
    phoneNumber: '256770555333',
    amountUgx: 12000,
    orderId: 'order-1',
    carrier: 'MTN' as const,
    idempotencyKey: 'reference-1'
  };

  it('uses the local simulation outside production', async () => {
    config.NODE_ENV = 'development';

    await expect(MomoService.requestToPay(request)).resolves.toEqual({
      transactionId: request.idempotencyKey,
      status: 'PENDING_CUSTOMER_PIN',
      carrierRef: 'UG-MTN-referenc'
    });
  });

  it('refuses to return a simulated prompt in production', async () => {
    config.NODE_ENV = 'production';

    await expect(MomoService.requestToPay(request)).rejects.toThrow(
      'Live MTN mobile-money integration is not configured'
    );
  });
});
