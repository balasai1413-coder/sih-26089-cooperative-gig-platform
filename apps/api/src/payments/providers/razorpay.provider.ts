import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  CreateOrderResult,
  ParsedPaymentWebhook,
  PaymentProvider,
  PaymentProviderNotConfiguredError,
} from '../payment.provider';

const RAZORPAY_API = 'https://api.razorpay.com/v1/orders';

function toBuffer(value: string | Buffer): Buffer {
  return Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8');
}

/**
 * Live Razorpay integration. All credentials are read from server-only
 * environment variables; nothing secret is ever returned by the API.
 */
export class RazorpayProvider implements PaymentProvider {
  readonly name = 'razorpay';

  private readonly keyId: string | undefined;
  private readonly keySecret: string | undefined;
  private readonly webhookSecret: string | undefined;

  constructor() {
    this.keyId = process.env.RAZORPAY_KEY_ID;
    this.keySecret = process.env.RAZORPAY_KEY_SECRET;
    this.webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  }

  private isConfigured(): boolean {
    return Boolean(this.keyId && this.keySecret);
  }

  async createOrder(input: {
    paymentId: string;
    amountMinor: number;
    currency: string;
    receipt: string;
  }): Promise<CreateOrderResult> {
    if (!this.isConfigured()) {
      throw new PaymentProviderNotConfiguredError();
    }

    const auth = Buffer.from(`${this.keyId as string}:${this.keySecret as string}`).toString(
      'base64',
    );

    const response = await fetch(RAZORPAY_API, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: input.amountMinor,
        currency: input.currency,
        receipt: input.receipt,
      }),
    });

    if (!response.ok) {
      throw new Error(`Razorpay order creation failed with status ${response.status}`);
    }

    const body = (await response.json()) as { id: string };
    return {
      provider: this.name,
      providerOrderId: body.id,
      keyId: this.keyId ?? null,
    };
  }

  /**
   * Razorpay checkout signature: HMAC-SHA256(key_secret, order_id|payment_id).
   */
  verifySignature(input: {
    providerOrderId: string;
    providerPaymentId: string;
    providerSignature: string;
  }): boolean {
    if (!this.keySecret) {
      throw new PaymentProviderNotConfiguredError();
    }
    const expected = createHmac('sha256', this.keySecret)
      .update(`${input.providerOrderId}|${input.providerPaymentId}`)
      .digest('hex');
    return safeEqualHex(expected, input.providerSignature);
  }

  verifyWebhookSignature(rawBody: string | Buffer, signature: string | undefined): boolean {
    if (!this.webhookSecret || !signature) {
      return false;
    }
    const expected = createHmac('sha256', this.webhookSecret)
      .update(toBuffer(rawBody))
      .digest('hex');
    return safeEqualHex(expected, signature);
  }

  parseWebhook(rawBody: string | Buffer): ParsedPaymentWebhook {
    const payload = JSON.parse(toBuffer(rawBody).toString('utf8')) as {
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
  return a.length === b.length && timingSafeEqual(a, b);
}
