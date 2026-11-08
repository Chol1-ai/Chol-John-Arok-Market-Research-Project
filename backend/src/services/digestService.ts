import { randomBytes } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { config } from '../config.js';
import { OutletLocation } from '../types/index.js';
import { getKampalaBusinessDate } from './tokenService.js';
import { SmsService } from './smsService.js';

export const OUTLETS: OutletLocation[] = ['FOODIZO_HAM_TOWERS', 'OBUNUZI_YMCA'];

export interface DigestFlag {
  code: string;
  message: string;
}

export interface OutletDigestSummary {
  outlet: OutletLocation;
  totalOrders: number;
  grossUgx: number;
  mtnUgx: number;
  airtelUgx: number;
  manualMomoUgx: number;
  cashUgx: number;
  paymentCount: number;
  refundPendingUgx: number;
  refundPendingCount: number;
  refundedUgx: number;
  refundedCount: number;
  failedPaymentCount: number;
  failedDeliveryCount: number;
  deliveryFeesUgx: number;
  riderAdvancesNetUgx: number;
  netDeliveryContributionUgx: number;
  expectedCashUgx: number;
  countedCashUgx: number | null;
  cashVarianceUgx: number | null;
  cashCountStatus: 'SUBMITTED' | 'MISSING';
  surplus: {
    clearancePortions: number;
    staffMealPortions: number;
    wastePortions: number;
  };
  lowStock: Array<{
    itemName: string;
    unit: string;
    currentStock: number;
    alertThreshold: number;
  }>;
  staleOrderCount: number;
}

export interface DigestSummary {
  digestDate: string;
  generatedAt: string;
  outlets: OutletDigestSummary[];
  consolidated: Omit<OutletDigestSummary, 'outlet'>;
  flags: DigestFlag[];
  flagCount: number;
  smsSummary: string;
  linkToken?: string;
  link?: string;
}

export interface DigestDispatchResult {
  summary: DigestSummary;
  digestId: string;
  status: 'SENT' | 'PARTIAL' | 'FAILED';
  smsStatus: string;
  smsMode: string;
  emailStatus: string;
  channelsSent: string[];
  message: string;
}

function roundUgx(value: number): number {
  return Math.round(value);
}

function emptyOutletSummary(outlet: OutletLocation): OutletDigestSummary {
  return {
    outlet,
    totalOrders: 0,
    grossUgx: 0,
    mtnUgx: 0,
    airtelUgx: 0,
    manualMomoUgx: 0,
    cashUgx: 0,
    paymentCount: 0,
    refundPendingUgx: 0,
    refundPendingCount: 0,
    refundedUgx: 0,
    refundedCount: 0,
    failedPaymentCount: 0,
    failedDeliveryCount: 0,
    deliveryFeesUgx: 0,
    riderAdvancesNetUgx: 0,
    netDeliveryContributionUgx: 0,
    expectedCashUgx: 0,
    countedCashUgx: null,
    cashVarianceUgx: null,
    cashCountStatus: 'MISSING',
    surplus: { clearancePortions: 0, staffMealPortions: 0, wastePortions: 0 },
    lowStock: [],
    staleOrderCount: 0
  };
}

function dayBounds(date: Date): { start: Date; end: Date } {
  // `business_date` is stored as UTC midnight of the Kampala calendar date.
  // The operating day starts at 05:00 EAT (UTC+3), i.e. 02:00 UTC on that
  // date, and ends at 04:59:59.999 EAT on the following date.
  const start = new Date(date.getTime() + 2 * 60 * 60 * 1000);
  const end = new Date(date.getTime() + 26 * 60 * 60 * 1000 - 1);
  return { start, end };
}

async function outletDigest(
  prisma: PrismaClient,
  outlet: OutletLocation,
  businessDate: Date,
  staleCutoff: Date
): Promise<OutletDigestSummary> {
  const { start, end } = dayBounds(businessDate);
  const summary = emptyOutletSummary(outlet);

  const orders = await prisma.orders.findMany({
    where: {
      outlet,
      business_date: businessDate
    },
    select: {
      id: true,
      status: true,
      channel: true,
      delivery_fee_ugx: true,
      created_at: true,
      payments: {
        select: { id: true, status: true, carrier: true, amount_ugx: true, completed_at: true }
      }
    }
  });

  summary.totalOrders = orders.filter((order) => order.status === 'COMPLETED').length;

  const successfulPayments = await prisma.payments.findMany({
    where: {
      status: 'SUCCESSFUL',
      completed_at: { gte: start, lte: end },
      order: { outlet }
    },
    select: { carrier: true, amount_ugx: true }
  });

  for (const payment of successfulPayments) {
    const amount = Number(payment.amount_ugx);
    summary.grossUgx += amount;
    summary.paymentCount += 1;

    if (payment.carrier === 'MTN') summary.mtnUgx += amount;
    if (payment.carrier === 'AIRTEL') summary.airtelUgx += amount;
    if (payment.carrier === 'MANUAL_MOMO') summary.manualMomoUgx += amount;
    if (payment.carrier === 'CASH') summary.cashUgx += amount;
  }

  const pendingRefunds = await prisma.payments.findMany({
    where: { status: 'REFUND_PENDING', order: { outlet } },
    select: { amount_ugx: true }
  });
  summary.refundPendingCount = pendingRefunds.length;
  summary.refundPendingUgx = pendingRefunds.reduce(
    (sum, payment) => sum + Number(payment.amount_ugx),
    0
  );

  const refunded = await prisma.payments.findMany({
    where: {
      status: 'REFUNDED',
      refunded_at: { gte: start, lte: end },
      order: { outlet }
    },
    select: { amount_ugx: true }
  });
  summary.refundedCount = refunded.length;
  summary.refundedUgx = refunded.reduce((sum, payment) => sum + Number(payment.amount_ugx), 0);

  summary.failedPaymentCount = await prisma.payments.count({
    where: {
      status: { in: ['FAILED', 'TIMED_OUT'] },
      initiated_at: { gte: start, lte: end },
      order: { outlet }
    }
  });

  summary.failedDeliveryCount = await prisma.delivery_handoffs.count({
    where: {
      outcome: { in: ['FAILED_UNREACHABLE', 'REFUSED', 'RETURNED'] },
      dispatched_at: { gte: start, lte: end },
      order: { outlet }
    }
  });

  const deliveryOrders = orders.filter(
    (order) =>
      order.channel === 'PHONE_DELIVERY' &&
      order.payments.some((payment) => payment.status === 'SUCCESSFUL')
  );
  summary.deliveryFeesUgx = deliveryOrders.reduce(
    (sum, order) => sum + Number(order.delivery_fee_ugx),
    0
  );

  const handoffs = await prisma.delivery_handoffs.findMany({
    where: {
      dispatched_at: { gte: start, lte: end },
      order: { outlet }
    },
    select: { rider_advance_ugx: true, rider_advance_returned_ugx: true }
  });
  summary.riderAdvancesNetUgx = handoffs.reduce(
    (sum, handoff) =>
      sum + Number(handoff.rider_advance_ugx) - Number(handoff.rider_advance_returned_ugx),
    0
  );
  summary.netDeliveryContributionUgx =
    summary.deliveryFeesUgx - summary.riderAdvancesNetUgx;
  summary.expectedCashUgx = summary.cashUgx - summary.riderAdvancesNetUgx;

  const cashCount = await prisma.cash_counts.findUnique({
    where: {
      cash_counts_unique: {
        outlet,
        business_date: businessDate
      }
    }
  });
  if (cashCount) {
    summary.cashCountStatus = 'SUBMITTED';
    summary.countedCashUgx = Number(cashCount.counted_cash_ugx);
    summary.cashVarianceUgx = summary.countedCashUgx - summary.expectedCashUgx;
  }

  const surplus = await prisma.closing_surplus_logs.findMany({
    where: { outlet, log_date: businessDate },
    select: { resolution: true, leftover_portions: true }
  });
  for (const log of surplus) {
    if (log.resolution === 'DISCOUNTED_CLEARANCE') {
      summary.surplus.clearancePortions += log.leftover_portions;
    }
    if (log.resolution === 'STAFF_MEAL') {
      summary.surplus.staffMealPortions += log.leftover_portions;
    }
    if (log.resolution === 'WASTE_DISCARDED') {
      summary.surplus.wastePortions += log.leftover_portions;
    }
  }

  const lowStock = await prisma.raw_inventory.findMany({
    where: { outlet },
    orderBy: { item_name: 'asc' }
  });
  summary.lowStock = lowStock
    .filter((item) => Number(item.current_stock) <= Number(item.alert_threshold))
    .map((item) => ({
      itemName: item.item_name,
      unit: item.unit_of_measure,
      currentStock: Number(item.current_stock),
      alertThreshold: Number(item.alert_threshold)
    }));

  summary.staleOrderCount = await prisma.orders.count({
    where: {
      outlet,
      status: { in: ['PENDING', 'PREPARING', 'READY'] },
      created_at: { lte: staleCutoff }
    }
  });

  return summary;
}

function consolidate(outlets: OutletDigestSummary[]): Omit<OutletDigestSummary, 'outlet'> {
  const base = emptyOutletSummary('OBUNUZI_YMCA');
  const { outlet: _outlet, ...consolidated } = base;

  for (const outlet of outlets) {
    consolidated.totalOrders += outlet.totalOrders;
    consolidated.grossUgx += outlet.grossUgx;
    consolidated.mtnUgx += outlet.mtnUgx;
    consolidated.airtelUgx += outlet.airtelUgx;
    consolidated.manualMomoUgx += outlet.manualMomoUgx;
    consolidated.cashUgx += outlet.cashUgx;
    consolidated.paymentCount += outlet.paymentCount;
    consolidated.refundPendingUgx += outlet.refundPendingUgx;
    consolidated.refundPendingCount += outlet.refundPendingCount;
    consolidated.refundedUgx += outlet.refundedUgx;
    consolidated.refundedCount += outlet.refundedCount;
    consolidated.failedPaymentCount += outlet.failedPaymentCount;
    consolidated.failedDeliveryCount += outlet.failedDeliveryCount;
    consolidated.deliveryFeesUgx += outlet.deliveryFeesUgx;
    consolidated.riderAdvancesNetUgx += outlet.riderAdvancesNetUgx;
    consolidated.expectedCashUgx += outlet.expectedCashUgx;
    consolidated.surplus.clearancePortions += outlet.surplus.clearancePortions;
    consolidated.surplus.staffMealPortions += outlet.surplus.staffMealPortions;
    consolidated.surplus.wastePortions += outlet.surplus.wastePortions;
    consolidated.lowStock.push(...outlet.lowStock);
    consolidated.staleOrderCount += outlet.staleOrderCount;
  }

  consolidated.netDeliveryContributionUgx =
    consolidated.deliveryFeesUgx - consolidated.riderAdvancesNetUgx;

  const missingCount = outlets.filter((outlet) => outlet.cashCountStatus === 'MISSING').length;
  if (missingCount === 0) {
    consolidated.cashCountStatus = 'SUBMITTED';
    consolidated.countedCashUgx = outlets.reduce(
      (sum, outlet) => sum + (outlet.countedCashUgx || 0),
      0
    );
    consolidated.cashVarianceUgx =
      (consolidated.countedCashUgx || 0) - consolidated.expectedCashUgx;
  } else {
    consolidated.cashCountStatus = 'MISSING';
    consolidated.countedCashUgx = null;
    consolidated.cashVarianceUgx = null;
  }

  return consolidated;
}

function buildFlags(summary: DigestSummary): DigestFlag[] {
  const flags: DigestFlag[] = [];
  const missingCash = summary.outlets.filter((outlet) => outlet.cashCountStatus === 'MISSING');
  if (missingCash.length > 0) {
    flags.push({
      code: 'CASH_COUNT_MISSING',
      message: `Cash count not submitted for ${missingCash
        .map((outlet) => (outlet.outlet === 'FOODIZO_HAM_TOWERS' ? 'Foodizo' : 'Obunuzi'))
        .join(', ')}.`
    });
  }

  const variance = summary.consolidated.cashVarianceUgx;
  if (variance !== null && Math.abs(variance) > 5000) {
    flags.push({
      code: 'CASH_VARIANCE',
      message: `Cash variance is UGX ${variance.toLocaleString()} (above the UGX 5,000 threshold).`
    });
  }
  if (summary.consolidated.refundPendingCount > 0) {
    flags.push({
      code: 'REFUND_PENDING',
      message: `${summary.consolidated.refundPendingCount} payment(s) awaiting refund, UGX ${summary.consolidated.refundPendingUgx.toLocaleString()}.`
    });
  }
  if (summary.consolidated.failedPaymentCount > 0) {
    flags.push({
      code: 'FAILED_PAYMENTS',
      message: `${summary.consolidated.failedPaymentCount} failed or timed-out payment attempt(s).`
    });
  }
  if (summary.consolidated.failedDeliveryCount > 0) {
    flags.push({
      code: 'FAILED_DELIVERIES',
      message: `${summary.consolidated.failedDeliveryCount} failed delivery handoff(s).`
    });
  }
  if (summary.consolidated.staleOrderCount > 0) {
    flags.push({
      code: 'STALE_ORDERS',
      message: `${summary.consolidated.staleOrderCount} open order(s) older than 45 minutes.`
    });
  }
  if (summary.consolidated.lowStock.length > 0) {
    flags.push({
      code: 'LOW_STOCK',
      message: `${summary.consolidated.lowStock.length} inventory item(s) at or below the alert threshold.`
    });
  }

  return flags;
}

function formatSms(summary: DigestSummary): string {
  const gross = summary.consolidated.grossUgx.toLocaleString();
  const flags = summary.flagCount;
  const cashLine =
    summary.consolidated.cashCountStatus === 'MISSING'
      ? 'CASH COUNT MISSING - drawer not verified.'
      : `Cash variance UGX ${(summary.consolidated.cashVarianceUgx || 0).toLocaleString()}.`;
  const link = summary.link
    ? `\nFull: ${summary.link}`
    : '\nOpen the manager dashboard for the full report.';

  const text = `FOODIZO+OBUNUZI ${summary.digestDate}: Gross UGX ${gross}.\n${cashLine} ${flags} flags.${link}`;
  return text.length > 320 ? `${text.slice(0, 317)}...` : text;
}

export class DigestService {
  /**
   * Computes the consolidated and per-outlet digest from the database. When
   * `outlet` is omitted both outlets are included. Missing cash counts remain
   * null; the service never fabricates a zero variance.
   */
  static async generateDigest(
    prisma: PrismaClient,
    date: Date = getKampalaBusinessDate(),
    outlet?: OutletLocation
  ): Promise<DigestSummary> {
    // Callers pass either a normalized business date (UTC midnight) or rely
    // on the 05:00 EAT rollover default. Do not re-normalize an explicit date:
    // UTC midnight is 03:00 EAT, which would incorrectly roll it back a day.
    const businessDate = date;
    const staleCutoff = new Date(Date.now() - 45 * 60 * 1000);
    const requestedOutlets = outlet ? [outlet] : OUTLETS;

    const outletSummaries: OutletDigestSummary[] = [];
    for (const target of requestedOutlets) {
      outletSummaries.push(await outletDigest(prisma, target, businessDate, staleCutoff));
    }

    const summary: DigestSummary = {
      digestDate: businessDate.toISOString().slice(0, 10),
      generatedAt: new Date().toISOString(),
      outlets: outletSummaries,
      consolidated: consolidate(outletSummaries),
      flags: [],
      flagCount: 0,
      smsSummary: ''
    };

    summary.flags = buildFlags(summary);
    summary.flagCount = summary.flags.length;
    summary.smsSummary = formatSms(summary);
    return summary;
  }

  /**
   * Persists one consolidated digest per business date and reuses its stable
   * deep link on regeneration.
   */
  static async persistDigest(
    prisma: PrismaClient,
    summary: DigestSummary,
    status: 'GENERATED' | 'PARTIAL' | 'SENT' | 'FAILED' = 'GENERATED'
  ) {
    const businessDate = new Date(`${summary.digestDate}T00:00:00.000Z`);
    const existing = await prisma.daily_digests.findUnique({
      where: { business_date: businessDate }
    });

    const linkToken = existing?.link_token || randomBytes(4).toString('hex');
    summary.linkToken = linkToken;
    summary.link = `${config.DIGEST_APP_URL.replace(/\/$/, '')}/d/${linkToken}`;
    summary.smsSummary = formatSms(summary);

    const record = await prisma.daily_digests.upsert({
      where: { business_date: businessDate },
      update: {
        status,
        gross_ugx: summary.consolidated.grossUgx,
        flags: summary.flagCount,
        payload_json: summary as unknown as object,
        link_token: linkToken
      },
      create: {
        business_date: businessDate,
        status,
        gross_ugx: summary.consolidated.grossUgx,
        flags: summary.flagCount,
        payload_json: summary as unknown as object,
        link_token: linkToken
      }
    });

    return { record, summary };
  }

  /**
   * Sends the digest and records actual channel outcomes. SMS is reported as
   * MOCK in development; email is NOT_CONFIGURED until a mailer is wired.
   */
  static async dispatchDigest(
    prisma: PrismaClient,
    date: Date = getKampalaBusinessDate(),
    outlet?: OutletLocation
  ): Promise<DigestDispatchResult> {
    const summary = await DigestService.generateDigest(prisma, date, outlet);
    const persisted = await DigestService.persistDigest(prisma, summary, 'GENERATED');
    const sms = await SmsService.sendOwnerDigest(
      config.DIGEST_RECIPIENT_PHONE,
      persisted.summary.smsSummary
    );

    const emailStatus = config.DIGEST_EMAIL_ENABLED ? 'FAILED_NOT_IMPLEMENTED' : 'NOT_CONFIGURED';
    const channelsSent: string[] = [];
    if (sms.success && sms.mode === 'LIVE') channelsSent.push('SMS');
    if (sms.success && sms.mode === 'MOCK') channelsSent.push('SMS_MOCK');

    let status: DigestDispatchResult['status'];
    // Phase 1 has no email transport, so a digest cannot be fully SENT.
    // A live SMS with unimplemented email is PARTIAL; a mock SMS is also
    // PARTIAL because no carrier message was delivered. SENT is reserved for
    // a future implementation where every requested channel succeeds.
    if (!sms.success) {
      status = 'FAILED';
    } else {
      status = 'PARTIAL';
    }

    await prisma.daily_digests.update({
      where: { id: persisted.record.id },
      data: {
        status,
        sms_status: sms.success ? sms.mode : 'FAILED',
        email_status: emailStatus,
        channels_sent: channelsSent,
        sent_at: sms.mode === 'LIVE' ? new Date() : null,
        error: sms.success ? null : sms.detail || 'SMS dispatch failed'
      }
    });

    return {
      summary: persisted.summary,
      digestId: persisted.record.id,
      status,
      smsStatus: sms.success ? sms.mode : 'FAILED',
      smsMode: sms.mode,
      emailStatus,
      channelsSent,
      message:
        sms.mode === 'MOCK'
          ? 'Digest generated. SMS was simulated in development; no carrier message was sent.'
          : sms.success
            ? 'Digest sent by SMS. Email is not configured in Phase 1.'
            : 'Digest generated but SMS dispatch failed. See smsStatus and error.'
    };
  }

  static async findByLinkToken(prisma: PrismaClient, token: string) {
    const record = await prisma.daily_digests.findFirst({
      where: { link_token: token }
    });
    if (!record) return null;

    const ageMs = Date.now() - record.generated_at.getTime();
    if (ageMs > 72 * 60 * 60 * 1000) return null;
    return record;
  }
}
