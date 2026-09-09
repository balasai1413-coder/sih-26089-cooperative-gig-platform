import { Booking } from '@prisma/client';

/**
 * Step 9 — Server-side price determination.
 *
 * The payable amount for a booking comes exclusively from trusted server-side
 * data. A client can never supply this value.
 *
 * When Booking.priceAmount has been set, it is used as-is. Otherwise the
 * platform falls back to its configured base service fee so a booking that was
 * created before pricing was introduced still has a deterministic price. All
 * money is stored as integer minor units (paise).
 */
export const DEFAULT_SERVICE_PRICE_MINOR = 250_00; // ₹250.00

export const PLATFORM_TAX_RATE_BPS = 0; // tax structure is orthogonal to the base price

export function getPayableAmountMinor(booking: Pick<Booking, 'priceAmount'>): number {
  if (typeof booking.priceAmount === 'number' && booking.priceAmount > 0) {
    return Math.floor(booking.priceAmount);
  }
  return DEFAULT_SERVICE_PRICE_MINOR;
}

export function formatMinorToMajor(minor: number): string {
  return (minor / 100).toFixed(2);
}
