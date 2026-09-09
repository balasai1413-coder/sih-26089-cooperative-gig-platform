import { IsString, Length } from 'class-validator';

/**
 * Creating a payment requires ONLY an idempotency key.
 *
 * There is intentionally NO `amount` field: the payable amount is always
 * derived server-side from trusted Booking data. Because the global
 * ValidationPipe uses `forbidNonWhitelisted`, a client sending `amount` (or any
 * other field) receives a 400 instead of being able to influence the price.
 */
export class CreatePaymentDto {
  @IsString()
  @Length(8, 128, { message: 'idempotencyKey must be between 8 and 128 characters' })
  idempotencyKey!: string;
}
