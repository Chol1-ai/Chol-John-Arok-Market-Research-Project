/**
 * Accepts the forms staff actually type: +256 772 111 222, 0772..., 772...,
 * or the canonical 256772111222 stored in PostgreSQL.
 */
export function normalizeUgandanPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('256') && digits.length === 12) return digits;
  if (digits.startsWith('0') && digits.length === 10) return `256${digits.slice(1)}`;
  if (digits.length === 9 && digits.startsWith('7')) return `256${digits}`;
  return digits;
}
