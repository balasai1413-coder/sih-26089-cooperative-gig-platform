import { Controller, Headers, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { PaymentsService } from './payments.service';

/**
 * Provider-level webhook listener. This endpoint deliberately has NO JWT
 * authentication or customer ownership logic — it authenticates via the
 * provider's webhook signature (verified server-side over the raw body).
 */
@Controller('payments')
export class PaymentWebhookController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('webhooks/razorpay')
  async razorpayWebhook(@Req() req: Request, @Headers('x-razorpay-signature') signature?: string) {
    const rawBody = this.rawBodyFrom(req);
    return this.paymentsService.handleWebhook(rawBody, signature);
  }

  private rawBodyFrom(req: Request): string | Buffer {
    const raw = (req as Request & { rawBody?: Buffer | string }).rawBody;
    if (raw) return raw;
    // Fallback when the transport does not expose raw bytes: re-serialize the
    // parsed JSON deterministically (tests mirror this exact serialization).
    return JSON.stringify(req.body);
  }
}
