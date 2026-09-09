import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

export interface InvoiceInput {
  paymentId: string;
  bookingId: string;
  customerId: string;
  workerId: string;
  subtotalMinor: number;
  taxAmountMinor: number;
  currency: string;
  paidAt: Date;
}

/**
 * Creates invoices for successfully captured payments.
 *
 * The invoice stores immutable historical amount snapshots (subtotal, tax,
 * total) at the moment of payment success. Amounts never reflect later changes
 * to the booking/payment rows. The invoice number is generated server-side and
 * guaranteed unique through a retry loop around the DB unique constraint.
 */
@Injectable()
export class InvoiceService {
  constructor(private readonly prisma: PrismaService) {}

  async generateInvoiceForPayment(
    payment: Prisma.PaymentGetPayload<Record<string, never>>,
  ): Promise<void> {
    const taxAmount = 0;
    const totalAmount = payment.amount + taxAmount;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const invoiceNumber = await this.nextInvoiceNumber();
      try {
        await this.prisma.$transaction(async (tx) => {
          const created = await tx.invoice.create({
            data: {
              invoiceNumber,
              bookingId: payment.bookingId,
              customerId: payment.customerId,
              workerId: payment.workerId,
              subtotal: payment.amount,
              taxAmount,
              totalAmount,
              currency: payment.currency,
              status: 'PAID',
              issuedAt: new Date(),
              paidAt: payment.paidAt ?? new Date(),
            },
          });
          await tx.payment.update({
            where: { id: payment.id },
            data: { invoiceId: created.id },
          });
          return created;
        });

        // Found a free number and linked it to the payment.
        return;
      } catch (error) {
        const isUniqueViolation =
          error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
        if (isUniqueViolation && attempt < 4) {
          continue; // invoice number collision — retry with the next number
        }
        throw error;
      }
    }
  }

  /**
   * Computes the next human-readable server-side invoice number, e.g.
   * INV-2026-000007. The DB unique constraint remains the source of truth; this
   * loop simply picks the next free slot.
   */
  private async nextInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;

    const last = await this.prisma.invoice.findFirst({
      where: { invoiceNumber: { startsWith: prefix } },
      orderBy: { invoiceNumber: 'desc' },
      select: { invoiceNumber: true },
    });

    const nextSeq = last ? parseInt(last.invoiceNumber.split('-').pop() ?? '0', 10) + 1 : 1;

    return `${prefix}${String(nextSeq).padStart(6, '0')}`;
  }
}

/** Number the tests assert against the generation format. */
export function buildInvoiceNumber(year: number, seq: number): string {
  return `INV-${year}-${String(seq).padStart(6, '0')}`;
}

export const MAX_INVOICE_NUMBER_RETRIES = 5;
