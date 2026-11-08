import { PrismaClient } from '@prisma/client';
import { OutletLocation } from '../types/index.js';

/**
 * Kampala business date. The restaurant day rolls at 05:00 EAT (UTC+3), not at
 * midnight and not at the UTC boundary. The returned value is stored in a
 * PostgreSQL `date` column, so it is normalised to UTC midnight of that date.
 */
export function getKampalaBusinessDate(now: Date = new Date()): Date {
  const eatMillis = now.getTime() + 3 * 60 * 60 * 1000;
  const eat = new Date(eatMillis);

  if (eat.getUTCHours() < 5) {
    eat.setUTCDate(eat.getUTCDate() - 1);
  }

  return new Date(Date.UTC(eat.getUTCFullYear(), eat.getUTCMonth(), eat.getUTCDate()));
}

export class TokenService {
  /**
   * Allocates the next human-readable token for an outlet and business day.
   * The upsert is one atomic PostgreSQL statement, so concurrent checkouts
   * cannot reuse TOKEN-042.
   */
  static async getNextToken(
    prisma: PrismaClient,
    outlet: OutletLocation,
    businessDate: Date = getKampalaBusinessDate()
  ): Promise<string> {
    const counter = await prisma.token_counters.upsert({
      where: {
        outlet_business_date: {
          outlet,
          business_date: businessDate
        }
      },
      update: {
        last_value: { increment: 1 }
      },
      create: {
        outlet,
        business_date: businessDate,
        last_value: 1
      }
    });

    return `TOKEN-${String(counter.last_value).padStart(3, '0')}`;
  }

  /**
   * Kept for callers that used the old in-memory counter API. The database
   * counter is authoritative now, so there is nothing process-local to reset.
   */
  static resetDailyCounters(): void {
    // Intentionally a no-op. Retained to avoid breaking operator scripts that
    // imported the old method during the prototype phase.
  }
}
