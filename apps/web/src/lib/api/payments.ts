import { apiRequest } from './client';
import type { CreatePaymentPayload, Invoice, Payment, PaymentOrder } from '@/types/payment';

function withToken(accessToken: string, method?: string, body?: unknown) {
  return {
    ...(method ? { method } : {}),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    accessToken,
  };
}

export const paymentsApi = {
  /** Step 9 — create a payment for an eligible (completed) own booking. */
  createPayment: (accessToken: string, bookingId: string, payload: CreatePaymentPayload) =>
    apiRequest<PaymentOrder>(
      `/customers/me/bookings/${bookingId}/payments`,
      withToken(accessToken, 'POST', payload),
    ),
  /** Step 9 — verify the client checkout signature server-side. */
  verifyPayment: (
    accessToken: string,
    paymentId: string,
    payload: { providerOrderId: string; providerPaymentId: string; providerSignature: string },
  ) =>
    apiRequest<Payment>(
      `/customers/me/payments/${paymentId}/verify`,
      withToken(accessToken, 'POST', payload),
    ),
  payments: (accessToken: string) =>
    apiRequest<Payment[]>('/customers/me/payments', withToken(accessToken)),
  payment: (accessToken: string, paymentId: string) =>
    apiRequest<Payment>(`/customers/me/payments/${paymentId}`, withToken(accessToken)),
  invoices: (accessToken: string) =>
    apiRequest<Invoice[]>('/customers/me/invoices', withToken(accessToken)),
  invoice: (accessToken: string, invoiceId: string) =>
    apiRequest<Invoice>(`/customers/me/invoices/${invoiceId}`, withToken(accessToken)),
};

/** Worker Step 9 visibility — read-only, own bookings only. */
export const workerPaymentsApi = {
  payments: (accessToken: string) =>
    apiRequest<Payment[]>('/workers/me/payments', withToken(accessToken)),
};
