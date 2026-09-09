export type PaymentStatus =
  'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'REFUNDED';

export interface Payment {
  id: string;
  bookingId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  provider: string | null;
  failureReason: string | null;
  createdAt: string;
  paidAt: string | null;
  invoice: { id: string; invoiceNumber: string } | null;
}

export interface PaymentOrder {
  paymentId: string;
  bookingId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  provider: string;
  providerOrderId: string;
  /** Public Razorpay key id only — never a secret. */
  keyId: string | null;
}

export type InvoiceStatus = 'PAID' | 'VOID';

export interface Invoice {
  id: string;
  invoiceNumber: string;
  bookingId: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  status: InvoiceStatus;
  issuedAt: string;
  paidAt: string | null;
  booking: { id: string; serviceRequest: { id: string; title: string } } | null;
}

export interface CreatePaymentPayload {
  idempotencyKey: string;
}
