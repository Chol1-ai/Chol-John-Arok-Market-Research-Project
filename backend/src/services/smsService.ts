import { config } from '../config.js';

export interface SmsResult {
  success: boolean;
  /** MOCK means no carrier was contacted; never report it as a delivered SMS. */
  mode: 'MOCK' | 'LIVE' | 'FAILED';
  detail?: string;
}

export class SmsService {
  /**
   * Dispatches SMS alert to customer phone number via Africa's Talking Uganda.
   */
  static async sendPickupAlert(phoneNumber: string, token: string, outletName: string): Promise<SmsResult> {
    const message = `[${outletName}] Your order is READY for pickup! Present Token ${token} at the service counter to collect.`;
    return this.dispatchSms(phoneNumber, message);
  }

  static async sendDispatchAlert(
    phoneNumber: string,
    orderRef: string,
    riderName: string,
    riderPhone: string
  ): Promise<SmsResult> {
    const message = `[Foodizo Delivery] Your meal is on its way! Boda Rider: ${riderName} (${riderPhone}). Keep cash/MoMo ready for handoff.`;
    return this.dispatchSms(phoneNumber, message);
  }

  static async sendOwnerDigest(phoneNumber: string, message: string): Promise<SmsResult> {
    return this.dispatchSms(phoneNumber, message);
  }

  static async dispatchSms(to: string, message: string): Promise<SmsResult> {
    if (config.NODE_ENV === 'development' || config.NODE_ENV === 'test') {
      console.log(`[SmsService Mock] TO: ${to} | SENDER: ${config.SMS_SENDER_ID} | MSG: "${message}"`);
      return { success: true, mode: 'MOCK', detail: 'Development mock — no carrier request sent.' };
    }

    if (config.AFRICASTALKING_API_KEY === 'sandbox_key') {
      console.error('[SmsService] AFRICASTALKING_API_KEY is not configured; no SMS sent.');
      return { success: false, mode: 'FAILED', detail: 'AFRICASTALKING_API_KEY is not configured.' };
    }

    try {
      const body = new URLSearchParams({
        username: config.AFRICASTALKING_USERNAME,
        to,
        message,
        from: config.SMS_SENDER_ID
      });

      const response = await fetch('https://api.africastalking.com/version1/messaging', {
        method: 'POST',
        headers: {
          apiKey: config.AFRICASTALKING_API_KEY,
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        console.error(`[SmsService] Africa's Talking returned ${response.status}: ${detail}`);
        return { success: false, mode: 'FAILED', detail: `Provider returned HTTP ${response.status}.` };
      }

      return { success: true, mode: 'LIVE' };
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error(`[SmsService] Failed to dispatch SMS to ${to}: ${detail}`);
      return { success: false, mode: 'FAILED', detail };
    }
  }
}
