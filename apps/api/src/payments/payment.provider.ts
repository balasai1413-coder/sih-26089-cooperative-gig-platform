/**
 * Step 9 — Payment provider abstraction.
 *
 * The platform depends on the `PaymentProvider` interface, never on a concrete
 * vendor. In production the injected implementation is the real Razorpay
 * provider (server-side only). Tests inject a deterministic mock provider so no
 * live credentials or network calls are required.
 *
 * A provider must never leak its secret. Only the public key id (`keyId`) is
 * allowed to reach a client, because the browser needs it to open the Razorpay
 * checkout. Payment verification is always confirmed server-side.
 */

export interface CreateOrderInput {
  paymentId: string;
  amountMinor: number;
  currency: string;
  receipt: string;
}

export interface CreateOrderResult {
  provider: string;
  providerOrderId: string;
  keyId: string | null;
}

export interface VerifySignatureInput {
  providerOrderId: string;
  providerPaymentId: string;
  providerSignature: string;
}

export interface ParsedPaymentWebhook {
  providerEvent: string;
  providerOrderId?: string;
  providerPaymentId?: string;
  amountMinor?: number;
  currency?: string;
}

export interface PaymentProvider {
  readonly name: string;

  /**
   * Asks the payment gateway to reserve an order for the given amount.
   * Throws when the provider is not configured (never fakes success).
   */
  createOrder(input: CreateOrderInput): Promise<CreateOrderResult>;

  /**
   * Verifies the signature returned from the client-side checkout flow.
   * Returns true only when the cryptographic signature is valid.
   */
  verifySignature(input: VerifySignatureInput): boolean;

  /**
   * Verifies a provider webhook signature over the raw request body.
   */
  verifyWebhookSignature(rawBody: string | Buffer, signature: string | undefined): boolean;

  /**
   * Parses a verified webhook payload into a normalised event that the service
   * can safely act on. Must run only after signature verification.
   */
  parseWebhook(rawBody: string | Buffer): ParsedPaymentWebhook;
}

export class PaymentProviderNotConfiguredError extends Error {
  readonly code = 'PAYMENT_PROVIDER_NOT_CONFIGURED';
  constructor(message = 'Razorpay is not configured on the server') {
    super(message);
    this.name = 'PaymentProviderNotConfiguredError';
  }
}

export class PaymentSignatureVerificationError extends Error {
  readonly code = 'PAYMENT_SIGNATURE_INVALID';
  constructor(message = 'Payment signature verification failed') {
    super(message);
    this.name = 'PaymentSignatureVerificationError';
  }
}
