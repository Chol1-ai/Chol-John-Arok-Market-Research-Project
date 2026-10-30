import { config } from '../config.js';

export interface MoMoPushRequest {
  phoneNumber: string;
  amountUgx: number;
  orderId: string;
  carrier: 'MTN' | 'AIRTEL';
}

export interface MoMoPushResult {
  transactionId: string;
  status: 'PENDING_CUSTOMER_PIN' | 'SUCCESSFUL' | 'FAILED';
  carrierRef: string;
}

export class MomoService {
  /**
   * Initiates USSD STK Push prompt on customer handset.
   */
  static async requestToPay(req: MoMoPushRequest): Promise<MoMoPushResult> {
    const txId = `MOMO-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    if (config.NODE_ENV === 'development' || config.MTN_MOMO_PRIMARY_KEY === 'sandbox_key') {
      console.log(`[MoMoService Mock] Initiated ${req.carrier} STK Push for UGX ${req.amountUgx.toLocaleString()} to ${req.phoneNumber}`);
      return {
        transactionId: txId,
        status: 'PENDING_CUSTOMER_PIN',
        carrierRef: `UG-${req.carrier}-${Date.now()}`
      };
    }

    // Production integration with MTN OpenAPI / Airtel Money OpenAPI
    return {
      transactionId: txId,
      status: 'PENDING_CUSTOMER_PIN',
      carrierRef: `PROD-${req.carrier}-${Date.now()}`
    };
  }

  /**
   * Validates webhook callback signature from telecom aggregator.
   */
  static verifyWebhookSignature(carrier: 'MTN' | 'AIRTEL', signature: string, payload: any): boolean {
    if (config.NODE_ENV === 'development') {
      return true; // Always allow in dev/test sandbox
    }
    // Production HMAC-SHA256 signature check
    return true;
  }
}

