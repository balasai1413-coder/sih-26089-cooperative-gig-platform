/**
 * DI token used to inject the configured payment provider (Razorpay in
 * production, a mock provider in tests).
 */
export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

export const PAYMENT_CURRENCY = 'INR';

/**
 * Booking states that are eligible for a customer to pay. Only a completed
 * service may be paid for.
 */
export const PAYABLE_BOOKING_STATES = ['COMPLETED'] as const;
