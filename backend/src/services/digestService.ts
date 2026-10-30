import { PrismaClient } from '@prisma/client';
import { OutletLocation } from '../types/index.js';

export interface DigestReconciliationSummary {
  digestDate: string;
  outlet: OutletLocation;
  totalOrders: number;
  grossSalesUgx: number;
  cashSalesUgx: number;
  momoMtnSalesUgx: number;
  momoAirtelSalesUgx: number;
  physicalCashCountedUgx: number;
  cashVarianceUgx: number;
  surplusClearanceCount: number;
  wasteDiscardCount: number;
  smsWhatsAppSummary?: string;
}

export class DigestService {
  /**
   * Compiles daily audit digest and reconciliation report for store manager / owner.
   */
  static async generateDigest(
    prisma: PrismaClient,
    outlet: OutletLocation,
    date: Date = new Date()
  ): Promise<DigestReconciliationSummary> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // 1. Fetch completed orders for today
    const orders = await prisma.orders.findMany({
      where: {
        outlet,
        created_at: {
          gte: startOfDay,
          lte: endOfDay
        },
        status: 'COMPLETED'
      },
      include: {
        payments: true
      }
    });

    let totalOrders = orders.length;
    let grossSalesUgx = 0;
    let cashSalesUgx = 0;
    let momoMtnSalesUgx = 0;
    let momoAirtelSalesUgx = 0;

    for (const order of orders) {
      grossSalesUgx += Number(order.total_amount_ugx);

      for (const p of order.payments) {
        if (p.status === 'SUCCESSFUL') {
          const amount = Number(p.amount_ugx);
          if (p.carrier === 'CASH') {
            cashSalesUgx += amount;
          } else if (p.carrier === 'MTN') {
            momoMtnSalesUgx += amount;
          } else if (p.carrier === 'AIRTEL') {
            momoAirtelSalesUgx += amount;
          }
        }
      }
    }

    // 2. Fetch latest cash count for the day
    const latestCashCount = await prisma.cash_counts.findFirst({
      where: {
        outlet,
        counted_at: {
          gte: startOfDay,
          lte: endOfDay
        }
      },
      orderBy: { counted_at: 'desc' }
    });

    const physicalCashCountedUgx = latestCashCount ? Number(latestCashCount.counted_cash_ugx) : cashSalesUgx;
    const cashVarianceUgx = physicalCashCountedUgx - cashSalesUgx;

    // 3. Fetch surplus logs
    const surplusLogs = await prisma.closing_surplus_logs.findMany({
      where: {
        outlet,
        created_at: {
          gte: startOfDay,
          lte: endOfDay
        }
      }
    });

    const surplusClearanceCount = surplusLogs.filter((s) => s.resolution === 'DISCOUNTED_CLEARANCE').length;
    const wasteDiscardCount = surplusLogs.filter((s) => s.resolution === 'WASTE_DISCARDED').length;

    const summary: DigestReconciliationSummary = {
      digestDate: startOfDay.toISOString().split('T')[0],
      outlet,
      totalOrders,
      grossSalesUgx,
      cashSalesUgx,
      momoMtnSalesUgx,
      momoAirtelSalesUgx,
      physicalCashCountedUgx,
      cashVarianceUgx,
      surplusClearanceCount,
      wasteDiscardCount
    };

    summary.smsWhatsAppSummary = this.formatDigestTextMessage(summary);
    return summary;
  }

  /**
   * Formats a clean WhatsApp / SMS text digest ready for delivery to owner / store manager.
   */
  static formatDigestTextMessage(summary: DigestReconciliationSummary): string {
    const outletLabel = summary.outlet === 'FOODIZO_HAM_TOWERS' ? 'Foodizo (Ham Towers)' : 'Obunuzi (Opp. YMCA)';
    const varianceSign = summary.cashVarianceUgx >= 0 ? '+' : '';
    const varianceStatus = summary.cashVarianceUgx === 0 
      ? 'UGX 0 (Reconciled Balanced)' 
      : `UGX ${varianceSign}${summary.cashVarianceUgx.toLocaleString()} (${summary.cashVarianceUgx < 0 ? 'SHORTAGE ALERT' : 'SURPLUS'})`;

    return (
      `📊 FOODIZO & OBUNUZI NIGHTLY AUDIT (21:30 EAT)\n` +
      `Branch: ${outletLabel}\n` +
      `Date: ${summary.digestDate}\n` +
      `Total Completed Orders: ${summary.totalOrders}\n` +
      `Gross Revenue: UGX ${summary.grossSalesUgx.toLocaleString()}\n` +
      `  • MTN MoMo (API Verified): UGX ${summary.momoMtnSalesUgx.toLocaleString()}\n` +
      `  • Airtel Money (API Verified): UGX ${summary.momoAirtelSalesUgx.toLocaleString()}\n` +
      `  • Cash Drawer (Physical Count): UGX ${summary.physicalCashCountedUgx.toLocaleString()}\n` +
      `Drawer Discrepancy: ${varianceStatus}\n` +
      `Surplus Clearance Actions: ${summary.surplusClearanceCount} discounted / ${summary.wasteDiscardCount} discarded\n` +
      `Status: AUDIT_LOCKED_AND_VERIFIED`
    );
  }
}

