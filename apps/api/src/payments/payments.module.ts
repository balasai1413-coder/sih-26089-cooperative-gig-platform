import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InvoiceService } from './invoice.service';
import { PaymentProvider } from './payment.provider';
import { PAYMENT_PROVIDER } from './payments.constants';
import { PaymentsService } from './payments.service';
import { CustomerPaymentsController } from './customer-payments.controller';
import { WorkerPaymentsController } from './worker-payments.controller';
import { PaymentWebhookController } from './payment-webhook.controller';
import { RazorpayProvider } from './providers/razorpay.provider';

/**
 * A real provider factory. When Razorpay credentials are present in the
 * environment the live provider is used; otherwise the Razorpay provider boots
 * with no credentials and throws rather than faking success. Tests override
 * PAYMENT_PROVIDER with a deterministic mock.
 */
function paymentProviderFactory(): PaymentProvider {
  return new RazorpayProvider();
}

@Module({
  imports: [AuthModule],
  controllers: [CustomerPaymentsController, WorkerPaymentsController, PaymentWebhookController],
  providers: [
    PaymentsService,
    InvoiceService,
    {
      provide: PAYMENT_PROVIDER,
      useFactory: paymentProviderFactory,
    },
  ],
  exports: [PaymentsService, InvoiceService],
})
export class PaymentsModule {}
