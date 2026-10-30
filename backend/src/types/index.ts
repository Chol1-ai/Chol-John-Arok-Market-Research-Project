import { FastifyRequest } from 'fastify';

export type OutletLocation = 'FOODIZO_HAM_TOWERS' | 'OBUNUZI_YMCA';

export type UserRole = 'CUSTOMER' | 'WAITER_FOH' | 'KITCHEN_STAFF' | 'MANAGER_ADMIN';

export type ChannelType = 'DINE_IN' | 'TAKEAWAY_PICKUP' | 'PHONE_DELIVERY';

export type OrderStatus =
  | 'AWAITING_PAYMENT'
  | 'PENDING'
  | 'PREPARING'
  | 'READY'
  | 'COMPLETED'
  | 'CANCELLED';

export type StationType = 'STEAM_LINE' | 'GRILL_FRYER' | 'ROLEX_GRIDDLE' | 'BAR_BEVERAGE';

export type TableStatus = 'VACANT' | 'OCCUPIED' | 'BILL_REQUESTED' | 'NEEDS_CLEARING';

export type PaymentCarrier = 'MTN' | 'AIRTEL' | 'CASH' | 'MANUAL_MOMO';

export type PaymentStatus =
  | 'INITIATED'
  | 'PENDING_CUSTOMER_PIN'
  | 'SUCCESSFUL'
  | 'FAILED'
  | 'TIMED_OUT'
  | 'CANCELLED'
  | 'REFUND_PENDING'
  | 'REFUNDED';

export interface AuthUserPayload {
  userId: string;
  fullName: string;
  phoneNumber: string;
  role: UserRole;
  outlet: OutletLocation | null;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AuthUserPayload;
    user: AuthUserPayload;
  }
}

export interface CreateOrderItemInput {
  menuItemId: string;
  quantity: number;
  notes?: string;
}

export interface CreateOrderInput {
  outlet: OutletLocation;
  channel: ChannelType;
  tableId?: string;
  customerName?: string;
  customerPhone?: string;
  deliveryZoneId?: string;
  deliveryAddressNote?: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
  items: CreateOrderItemInput[];
}

export interface PinLoginInput {
  phoneNumber: string;
  pin: string;
}

export interface SettleOrderInput {
  paymentMethod: PaymentCarrier;
  amountUgx: number;
  transactionReference?: string;
  tenderedCashUgx?: number;
}

export interface AssignRiderInput {
  riderName: string;
  riderPhone: string;
  bodaPlateNumber?: string;
  bodaStage?: string;
  advanceCashUgx?: number;
}

