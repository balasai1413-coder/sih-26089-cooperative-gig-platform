import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { BookingStatus, PaymentStatus, Prisma } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { InvoiceService } from './invoice.service';
import {
  PaymentProvider,
  PaymentProviderNotConfiguredError,
  PaymentSignatureVerificationError,
} from './payment.provider';
import { getPayableAmountMinor } from './payment.pricing';
import { assertValidTransition } from './payment.state';
import { PAYMENT_CURRENCY, PAYMENT_PROVIDER } from './payments.constants';

type PaymentStatusDb = Prisma.PaymentGetPayload<Record<string, never>>;

interface CustomerPaymentShape {
  id: string;
  bookingId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  provider: string | null;
  providerOrderId: string | null;
  failureReason: string | null;
  paidAt: Date | null;
  failedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  invoice: { id: string; invoiceNumber: string } | null;
}

interface InitializeOrderResult {
  payment: PaymentStatusDb;
  orderId: string;
  keyId: string | null;
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoiceService: InvoiceService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
  ) {}

  private async resolveCustomerId(user: AuthenticatedUser): Promise<string> {
    const customer = await this.prisma.customer.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!customer) {
      throw new NotFoundException('Customer profile is not available');
    }
    return customer.id;
  }

  private async resolveWorkerId(user: AuthenticatedUser): Promise<string> {
    const worker = await this.prisma.worker.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!worker) {
      throw new NotFoundException('Worker profile is not available');
    }
    return worker.id;
  }

  // -------------------------------------------------------------------------
  // Customer payment creation
  // -------------------------------------------------------------------------

  /**
   * Creates a payment for one of the customer's own completed bookings. The
   * amount is always computed server-side; the client may only supply an
   * idempotency key. Idempotent (and concurrency-safe) via the unique key.
   */
  async createPayment(
    user: AuthenticatedUser,
    bookingId: string,
    dto: CreatePaymentDto,
  ): Promise<CustomerPaymentShape & { orderId: string; keyId: string | null }> {
    const customerId = await this.resolveCustomerId(user);

    // Idempotency is checked before booking eligibility so that a conflicting
    // reuse of the same key (same customer, different booking) deterministically
    // returns 409, and an exact replay returns the original payment (200).
    // Scoping the lookup to the requesting customer avoids leaking other
    // customers' payments; a cross-customer collision surfaces as 409 via the
    // global unique constraint at insert time.
    const existingOwnPayment = await this.prisma.payment.findFirst({
      where: { idempotencyKey: dto.idempotencyKey, customerId },
      include: { invoice: { select: { id: true, invoiceNumber: true } } },
    });
    if (existingOwnPayment) {
      if (existingOwnPayment.bookingId !== bookingId) {
        throw new ConflictException(
          'This idempotency key was already used for a different booking',
        );
      }
      const initialized = await this.initializeOrder(existingOwnPayment);
      return {
        ...this.toCustomerShape(existingOwnPayment, existingOwnPayment.invoice),
        orderId: initialized.orderId,
        keyId: initialized.keyId,
      };
    }

    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, customerId },
    });
    if (!booking) {
      throw new NotFoundException('Booking is not available');
    }
    if (booking.status !== BookingStatus.COMPLETED) {
      throw new BadRequestException(
        `Only completed services can be paid for (current status: ${booking.status})`,
      );
    }

    const amount = getPayableAmountMinor(booking);

    const payment = await this.createPaymentRow(
      dto.idempotencyKey,
      bookingId,
      customerId,
      booking.workerId,
      amount,
    );

    // If a previous attempt had already reserved an order, replay it rather
    // than creating a duplicate order.
    if (payment.providerOrderId && payment.status === PaymentStatus.PROCESSING) {
      return this.toCustomerCreateShape(payment);
    }

    const initialized = await this.initializeOrder(payment);
    return this.toCustomerCreateShape(initialized.payment);
  }

  /** Idempotent, concurrency-safe row creation keyed on idempotencyKey. */
  private async createPaymentRow(
    idempotencyKey: string,
    bookingId: string,
    customerId: string,
    workerId: string,
    amount: number,
  ): Promise<PaymentStatusDb> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.payment.findUnique({
          where: { idempotencyKey },
        });
        if (existing) {
          this.assertIdempotencyReplay(existing, bookingId, customerId, amount);
          return existing;
        }
        return tx.payment.create({
          data: {
            bookingId,
            customerId,
            workerId,
            amount,
            currency: PAYMENT_CURRENCY,
            status: PaymentStatus.PENDING,
            idempotencyKey,
          },
        });
      });
    } catch (error) {
      if (this.isUniqueKeyViolation(error, 'idempotencyKey')) {
        const existing = await this.prisma.payment.findUnique({
          where: { idempotencyKey },
        });
        if (existing) {
          this.assertIdempotencyReplay(existing, bookingId, customerId, amount);
          return existing;
        }
      }
      throw error;
    }
  }

  private assertIdempotencyReplay(
    existing: PaymentStatusDb,
    bookingId: string,
    customerId: string,
    amount: number,
  ): void {
    const sameRequest =
      existing.bookingId === bookingId &&
      existing.customerId === customerId &&
      existing.amount === amount;
    if (!sameRequest) {
      throw new ConflictException('Idempotency key was already used for a different payment');
    }
  }

  private async initializeOrder(payment: PaymentStatusDb): Promise<InitializeOrderResult> {
    try {
      const order = await this.provider.createOrder({
        paymentId: payment.id,
        amountMinor: payment.amount,
        currency: payment.currency,
        receipt: `booking_${payment.bookingId}`,
      });

      const updated = await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.PROCESSING,
          provider: order.provider,
          providerOrderId: order.providerOrderId,
        },
      });
      return {
        payment: updated,
        orderId: order.providerOrderId,
        keyId: order.keyId,
      };
    } catch (error) {
      if (error instanceof PaymentProviderNotConfiguredError) {
        await this.failPayment(
          payment.id,
          'Payment gateway is not configured. Please try again later.',
        );
        throw new ServiceUnavailableException(
          'Payments are temporarily unavailable. Please try again later.',
        );
      }
      await this.failPayment(payment.id, 'Payment could not be initialized with the gateway.');
      throw error;
    }
  }

  private async failPayment(id: string, reason: string): Promise<void> {
    await this.prisma.payment.update({
      where: { id },
      data: {
        status: PaymentStatus.FAILED,
        failedAt: new Date(),
        failureReason: reason.slice(0, 500),
      },
    });
  }

  // -------------------------------------------------------------------------
  // Customer payment verification (provider signature)
  // -------------------------------------------------------------------------

  /**
   * Confirms a client-side Razorpay checkout using the server-verified
   * signature. Only a valid signature moves PROCESSING -> SUCCESS. Already
   * SUCCESS payments return the stored result (idempotent).
   */
  async verifyPayment(
    user: AuthenticatedUser,
    paymentId: string,
    dto: VerifyPaymentDto,
  ): Promise<CustomerPaymentShape> {
    const customerId = await this.resolveCustomerId(user);
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, customerId },
      include: { invoice: { select: { id: true, invoiceNumber: true } } },
    });
    if (!payment) {
      throw new NotFoundException('Payment is not available');
    }

    if (payment.status === PaymentStatus.SUCCESS) {
      return this.toCustomerShape(payment, payment.invoice);
    }

    if (payment.status !== PaymentStatus.PROCESSING) {
      throw new BadRequestException(`Payment cannot be verified in ${payment.status} status`);
    }
    if (!payment.providerOrderId) {
      throw new BadRequestException('Payment has no provider order');
    }
    if (payment.providerOrderId !== dto.providerOrderId) {
      throw new BadRequestException('Provider order id does not match this payment');
    }

    let valid: boolean;
    try {
      valid = this.provider.verifySignature({
        providerOrderId: dto.providerOrderId,
        providerPaymentId: dto.providerPaymentId,
        providerSignature: dto.providerSignature,
      });
    } catch (error) {
      if (error instanceof PaymentSignatureVerificationError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }

    if (!valid) {
      throw new BadRequestException('Payment signature verification failed');
    }

    // Guarded critical section: only one concurrent verifier may capture.
    const captured = await this.prisma.payment.updateMany({
      where: { id: payment.id, status: PaymentStatus.PROCESSING },
      data: {
        status: PaymentStatus.SUCCESS,
        providerPaymentId: dto.providerPaymentId,
        providerSignature: dto.providerSignature,
        paidAt: new Date(),
      },
    });

    if (captured.count === 0) {
      // Another request captured it first — return its current state.
      const latest = await this.prisma.payment.findUnique({
        where: { id: payment.id },
      });
      return this.toCustomerShape(latest!, payment.invoice);
    }

    const succeeded = await this.prisma.payment.findUnique({
      where: { id: payment.id },
    });
    await this.invoiceService.generateInvoiceForPayment(succeeded!);
    return this.toCustomerShape(succeeded!, payment.invoice);
  }

  // -------------------------------------------------------------------------
  // Webhook (provider-level, no customer ownership)
  // -------------------------------------------------------------------------

  /**
   * Securely processes a provider webhook. Signature is verified over the raw
   * body before anything is parsed or trusted. Idempotent for already handled
   * events.
   */
  async handleWebhook(
    rawBody: string | Buffer,
    signature: string | undefined,
  ): Promise<{ received: boolean }> {
    if (!this.provider.verifyWebhookSignature(rawBody, signature)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    const parsed = this.provider.parseWebhook(rawBody);

    if (parsed.providerEvent === 'payment.captured') {
      const payment = await this.prisma.payment.findFirst({
        where: { providerOrderId: parsed.providerOrderId },
      });
      if (!payment) return { received: true };

      // Never trust webhook amount — it must equal the server-stored amount.
      if (typeof parsed.amountMinor === 'number' && parsed.amountMinor !== payment.amount) {
        throw new BadRequestException('Webhook amount mismatch');
      }

      await this.capturePaymentViaWebhook(payment);
      return { received: true };
    }

    if (parsed.providerEvent === 'payment.failed') {
      const payment = await this.prisma.payment.findFirst({
        where: { providerOrderId: parsed.providerOrderId },
      });
      if (!payment) return { received: true };
      if (payment.status === PaymentStatus.PENDING || payment.status === PaymentStatus.PROCESSING) {
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.FAILED,
            failedAt: new Date(),
            failureReason: 'Payment failed at the gateway',
          },
        });
      }
      return { received: true };
    }

    return { received: true };
  }

  private async capturePaymentViaWebhook(payment: PaymentStatusDb): Promise<void> {
    if (payment.status !== PaymentStatus.PENDING && payment.status !== PaymentStatus.PROCESSING) {
      return; // already SUCCESS/terminal — idempotent no-op
    }
    assertValidTransition(payment.status, PaymentStatus.SUCCESS);

    const captured = await this.prisma.payment.updateMany({
      where: {
        id: payment.id,
        status: { in: [PaymentStatus.PENDING, PaymentStatus.PROCESSING] },
      },
      data: {
        status: PaymentStatus.SUCCESS,
        paidAt: new Date(),
      },
    });

    if (captured.count === 0) return;

    const succeeded = await this.prisma.payment.findUnique({
      where: { id: payment.id },
    });
    await this.invoiceService.generateInvoiceForPayment(succeeded!);
  }

  // -------------------------------------------------------------------------
  // Customer reads
  // -------------------------------------------------------------------------

  async listCustomerPayments(user: AuthenticatedUser): Promise<CustomerPaymentShape[]> {
    const customerId = await this.resolveCustomerId(user);
    const payments = await this.prisma.payment.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      include: {
        invoice: { select: { id: true, invoiceNumber: true } },
      },
    });
    return payments.map((p) => this.toCustomerShape(p, p.invoice));
  }

  async getCustomerPayment(
    user: AuthenticatedUser,
    paymentId: string,
  ): Promise<CustomerPaymentShape> {
    const customerId = await this.resolveCustomerId(user);
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, customerId },
      include: { invoice: { select: { id: true, invoiceNumber: true } } },
    });
    if (!payment) {
      throw new NotFoundException('Payment is not available');
    }
    return this.toCustomerShape(payment, payment.invoice);
  }

  async listCustomerInvoices(user: AuthenticatedUser) {
    const customerId = await this.resolveCustomerId(user);
    const invoices = await this.prisma.invoice.findMany({
      where: { customerId },
      orderBy: { issuedAt: 'desc' },
      include: {
        booking: {
          select: {
            id: true,
            serviceRequest: { select: { id: true, title: true } },
          },
        },
      },
    });
    return invoices.map((inv) => this.toInvoiceShape(inv));
  }

  async getCustomerInvoice(user: AuthenticatedUser, invoiceId: string) {
    const customerId = await this.resolveCustomerId(user);
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, customerId },
      include: {
        booking: {
          select: {
            id: true,
            serviceRequest: { select: { id: true, title: true } },
          },
        },
      },
    });
    if (!invoice) {
      throw new NotFoundException('Invoice is not available');
    }
    return this.toInvoiceShape(invoice);
  }

  // -------------------------------------------------------------------------
  // Worker limited visibility
  // -------------------------------------------------------------------------

  async listWorkerPayments(user: AuthenticatedUser) {
    const workerId = await this.resolveWorkerId(user);
    const payments = await this.prisma.payment.findMany({
      where: { workerId },
      orderBy: { createdAt: 'desc' },
    });
    return payments.map((p) => this.toWorkerShape(p));
  }

  async getWorkerPayment(user: AuthenticatedUser, paymentId: string) {
    const workerId = await this.resolveWorkerId(user);
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, workerId },
    });
    if (!payment) {
      throw new NotFoundException('Payment is not available');
    }
    return this.toWorkerShape(payment);
  }

  // -------------------------------------------------------------------------
  // Response shaping (never leaks secrets or other users' data)
  // -------------------------------------------------------------------------

  private toCustomerCreateShape(
    payment: PaymentStatusDb,
    invoice: { id: string; invoiceNumber: string } | null = null,
  ): CustomerPaymentShape & { orderId: string; keyId: string | null } {
    return {
      ...this.toCustomerShape(payment, invoice),
      orderId: payment.providerOrderId ?? '',
      keyId: null,
    };
  }

  private toCustomerShape(
    payment: PaymentStatusDb,
    invoice: { id: string; invoiceNumber: string } | null = null,
  ): CustomerPaymentShape {
    return {
      id: payment.id,
      bookingId: payment.bookingId,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      provider: payment.provider,
      providerOrderId: payment.providerOrderId,
      failureReason: payment.failureReason,
      paidAt: payment.paidAt,
      failedAt: payment.failedAt,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      invoice,
    };
  }

  private toWorkerShape(payment: PaymentStatusDb) {
    return {
      id: payment.id,
      bookingId: payment.bookingId,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      paidAt: payment.paidAt,
      failedAt: payment.failedAt,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
  }

  private toInvoiceShape(
    invoice: Prisma.InvoiceGetPayload<{
      include: {
        booking: {
          select: { id: true; serviceRequest: { select: { id: true; title: true } } };
        };
      };
    }>,
  ) {
    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      bookingId: invoice.bookingId,
      subtotal: invoice.subtotal,
      taxAmount: invoice.taxAmount,
      totalAmount: invoice.totalAmount,
      currency: invoice.currency,
      status: invoice.status,
      issuedAt: invoice.issuedAt,
      paidAt: invoice.paidAt,
      booking: invoice.booking,
    };
  }

  private isUniqueKeyViolation(error: unknown, field: string): boolean {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = (error.meta?.target as string[] | undefined) ?? [];
      return target.includes(field);
    }
    return false;
  }
}
