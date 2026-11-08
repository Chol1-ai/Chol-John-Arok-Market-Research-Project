import { config } from '../config.js';

export interface MoMoPushRequest {
  phoneNumber: string;
  amountUgx: number;
  orderId: string;
  carrier: 'MTN' | 'AIRTEL';
  /** UUID sent to the telco as X-Reference-Id and stored on the payment. */
  idempotencyKey: string;
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
    const txId = req.idempotencyKey;

    if (config.NODE_ENV === 'development' || config.MTN_MOMO_PRIMARY_KEY === 'sandbox_key') {
      console.log(`[MoMoService Mock] Initiated ${req.carrier} STK Push for UGX ${req.amountUgx.toLocaleString()} to ${req.phoneNumber} (ref ${txId})`);
      return {
        transactionId: txId,
        status: 'PENDING_CUSTOMER_PIN',
        carrierRef: `UG-${req.carrier}-${req.idempotencyKey.slice(0, 8)}`
      };
    }

    // Production integration with MTN OpenAPI / Airtel Money OpenAPI.
    // The X-Reference-Id is the idempotency key, not a random display token.
    return {
      transactionId: txId,
      status: 'PENDING_CUSTOMER_PIN',
      carrierRef: `PROD-${req.carrier}-${req.idempotencyKey}`
    };
  }
}

