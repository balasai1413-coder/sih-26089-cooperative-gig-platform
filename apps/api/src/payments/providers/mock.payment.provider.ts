import { createHmac } from 'node:crypto';
import { CreateOrderResult, ParsedPaymentWebhook, PaymentProvider } from '../payment.provider';

/**
 * Deterministic provider used only by tests. It simulates order creation and
 * signature verification without touching the network or real credentials.
 *
 * It deliberately does NOT fake a payment success on its own: just like the
 * real provider it returns an `id` for an order reservation, and the caller is
 * still required to 'verify' a signature before a payment can move to SUCCESS.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock';

  private orderCounter = 0;
  private readonly secret: string;

  constructor(secret = 'mock-signing-secret') {
    this.secret = secret;
  }

  async createOrder(input: {
    paymentId: string;
    amountMinor: number;
    currency: string;
    receipt: string;
  }): Promise<CreateOrderResult> {
    this.orderCounter += 1;
    return {
      provider: this.name,
      providerOrderId: `order_${this.orderCounter}_${input.paymentId}`,
      keyId: 'rzp_test_mock_public_key',
    };
  }

  verifySignature(input: {
    providerOrderId: string;
    providerPaymentId: string;
    providerSignature: string;
  }): boolean {
    const expected = this.signatureFor(input.providerOrderId, input.providerPaymentId);
    return safeEqualHex(expected, input.providerSignature);
  }

  /** Computes the signature a real client would receive for a payment. */
  signatureFor(providerOrderId: string, providerPaymentId: string): string {
    return createHmac('sha256', this.secret)
      .update(`${providerOrderId}|${providerPaymentId}`)
      .digest('hex');
  }

  /** Signature the test would expect to be valid. */
  validSignatureFor(input: { providerOrderId: string; providerPaymentId: string }): string {
    return this.signatureFor(input.providerOrderId, input.providerPaymentId);
  }

  /** Computes a valid webhook signature over a raw JSON payload string. */
  webhookSignature(rawBody: string | Buffer): string {
    return createHmac('sha256', this.secret)
      .update(Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8'))
      .digest('hex');
  }

  verifyWebhookSignature(rawBody: string | Buffer, signature: string | undefined): boolean {
    if (!signature) return false;
    const expected = createHmac('sha256', this.secret)
      .update(Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8'))
      .digest('hex');
    return safeEqualHex(expected, signature);
  }

  parseWebhook(rawBody: string | Buffer): ParsedPaymentWebhook {
    const payload = JSON.parse(Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody) as {
      event?: string;
      payload?: {
        payment?: {
          entity?: {
            id?: string;
            order_id?: string;
            amount?: number;
            currency?: string;
          };
        };
      };
    };
    const entity = payload?.payload?.payment?.entity;
    return {
      providerEvent: payload?.event ?? '',
      providerOrderId: entity?.order_id,
      providerPaymentId: entity?.id,
      amountMinor: entity?.amount,
      currency: entity?.currency,
    };
  }
}

function safeEqualHex(expected: string, actual: string): boolean {
  if (expected.length !== actual.length) return false;
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(actual, 'hex');
  return a.length === b.length && a.equals(b);
}
