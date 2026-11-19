import { OutletLocation } from '../types/index.js';

type OutletScopedRequest = {
  method: string;
  url: string;
  query: unknown;
  body: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function applyOutletScope(
  request: OutletScopedRequest,
  outlet: OutletLocation
): string | null {
  const query = isRecord(request.query) ? request.query : null;
  if (query) {
    if (Object.prototype.hasOwnProperty.call(query, 'outlet') && query.outlet !== outlet) {
      return typeof query.outlet === 'string' ? query.outlet : 'invalid';
    }
    query.outlet = outlet;
  }

  const body = isRecord(request.body) ? request.body : null;
  if (body) {
    if (Object.prototype.hasOwnProperty.call(body, 'outlet') && body.outlet !== outlet) {
      return typeof body.outlet === 'string' ? body.outlet : 'invalid';
    }

    if (request.method === 'POST' && request.url.split('?')[0] === '/api/v1/orders') {
      body.outlet = outlet;
    }
  }

  return null;
}
