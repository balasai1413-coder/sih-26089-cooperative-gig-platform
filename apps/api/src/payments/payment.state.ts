import { BadRequestException } from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';

/**
 * Step 9 — Payment state machine.
 *
 * Every state change must be routed through `assertValidTransition`. Invalid
 * transitions (for example marking an already SUCCESS payment as PENDING, or
 * moving FAILED -> SUCCESS without a provider confirmation) are rejected here.
 */

export const PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  PENDING: [PaymentStatus.PROCESSING, PaymentStatus.FAILED, PaymentStatus.CANCELLED],
  PROCESSING: [PaymentStatus.SUCCESS, PaymentStatus.FAILED, PaymentStatus.CANCELLED],
  SUCCESS: [PaymentStatus.REFUNDED],
  FAILED: [],
  CANCELLED: [],
  REFUNDED: [],
};

/**
 * Returns the list of destinations allowed from `from`.
 * Used by tests to assert the full transition map.
 */
export function allowedTransitions(from: PaymentStatus): PaymentStatus[] {
  return PAYMENT_TRANSITIONS[from];
}

/**
 * Throws a 400 BadRequest when a payment state cannot move from -> to.
 */
export function assertValidTransition(from: PaymentStatus, to: PaymentStatus): void {
  const allowed = PAYMENT_TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    throw new BadRequestException(`Invalid payment status transition from ${from} to ${to}`);
  }
}
