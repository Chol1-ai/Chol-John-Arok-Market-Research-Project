import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

const productionEnvironment: NodeJS.ProcessEnv = {
  NODE_ENV: 'production',
  HOST: '127.0.0.1',
  DATABASE_URL: 'postgresql://foodizo_app:secret@127.0.0.1:5432/foodizo?schema=public',
  JWT_SECRET: 'a-production-only-secret-that-is-long-enough',
  PAYMENTS_WEBHOOK_SECRET: 'a-production-webhook-secret-long-enough',
  CORS_ORIGIN: 'https://192.168.1.100',
  DIGEST_APP_URL: 'https://192.168.1.100'
};

describe('production configuration', () => {
  it('accepts explicit secure production values', () => {
    expect(loadConfig(productionEnvironment)).toMatchObject({
      NODE_ENV: 'production',
      HOST: '127.0.0.1',
      CORS_ORIGIN: 'https://192.168.1.100'
    });
  });

  it('rejects missing secrets and insecure origins without printing their values', () => {
    expect(() =>
      loadConfig({
        ...productionEnvironment,
        JWT_SECRET: undefined,
        PAYMENTS_WEBHOOK_SECRET: undefined,
        CORS_ORIGIN: 'http://localhost:3000',
        DIGEST_APP_URL: 'http://localhost:3000'
      })
    ).toThrow(/JWT_SECRET.*PAYMENTS_WEBHOOK_SECRET.*CORS_ORIGIN.*DIGEST_APP_URL/);
  });

  it('rejects binding the API beyond the local proxy', () => {
    expect(() =>
      loadConfig({
        ...productionEnvironment,
        HOST: '0.0.0.0'
      })
    ).toThrow('HOST must be 127.0.0.1');
  });

  it('requires an explicitly configured production database', () => {
    expect(() =>
      loadConfig({
        ...productionEnvironment,
        DATABASE_URL: undefined
      })
    ).toThrow('DATABASE_URL must be set');
  });
});
