import { createHash, randomBytes } from 'crypto';

export const CUSTOMER_TRACKING_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const RIDER_TRACKING_TTL_MS = 24 * 60 * 60 * 1000;
export const TRACKING_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function createTrackingToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashTrackingToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function isTrackingToken(token: unknown): token is string {
  return typeof token === 'string' && TRACKING_TOKEN_PATTERN.test(token);
}
