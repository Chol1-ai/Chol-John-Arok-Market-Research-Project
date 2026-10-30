import { PrismaClient } from '@prisma/client';
import { OutletLocation } from '../types/index.js';

let localDailyCounters: Record<string, number> = {
  FOODIZO_HAM_TOWERS: 100,
  OBUNUZI_YMCA: 100
};

export class TokenService {
  /**
   * Generates next sequential digital token (e.g., #F-101, #F-102) for the given outlet.
   */
  static async getNextToken(prisma: PrismaClient, outlet: OutletLocation): Promise<string> {
    const prefix = outlet === 'FOODIZO_HAM_TOWERS' ? 'F' : 'O';
    
    // Increment local counter
    localDailyCounters[outlet] = (localDailyCounters[outlet] || 100) + 1;
    const tokenNumber = localDailyCounters[outlet];

    return `#${prefix}-${tokenNumber}`;
  }

  /**
   * Reset counters at start of day (05:00 EAT)
   */
  static resetDailyCounters() {
    localDailyCounters = {
      FOODIZO_HAM_TOWERS: 100,
      OBUNUZI_YMCA: 100
    };
  }
}

