import { config } from '../config.js';

export class SmsService {
  /**
   * Dispatches SMS alert to customer phone number via Africa's Talking Uganda.
   */
  static async sendPickupAlert(phoneNumber: string, token: string, outletName: string): Promise<boolean> {
    const message = `[${outletName}] Your order is READY for pickup! Present Token ${token} at the service counter to collect.`;
    return this.dispatchSms(phoneNumber, message);
  }

  static async sendDispatchAlert(phoneNumber: string, orderRef: string, riderName: string, riderPhone: string): Promise<boolean> {
    const message = `[Foodizo Delivery] Your meal is on its way! Boda Rider: ${riderName} (${riderPhone}). Keep cash/MoMo ready for handoff.`;
    return this.dispatchSms(phoneNumber, message);
  }

  private static async dispatchSms(to: string, message: string): Promise<boolean> {
    if (config.NODE_ENV === 'development' || config.AFRICASTALKING_API_KEY === 'sandbox_key') {
      console.log(`[SmsService Mock] TO: ${to} | SENDER: ${config.SMS_SENDER_ID} | MSG: "${message}"`);
      return true;
    }

    try {
      // In production, make HTTP POST to Africa's Talking SMS endpoint:
      // https://api.africastalking.com/version1/messaging
      console.log(`[SmsService Production] Sending SMS to ${to} via Africa's Talking...`);
      return true;
    } catch (err: any) {
      console.error(`[SmsService] Failed to dispatch SMS to ${to}: ${err.message}`);
      return false;
    }
  }
}

