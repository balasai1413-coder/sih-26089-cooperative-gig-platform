import { IsString, Length } from 'class-validator';

/**
 * Verifying a payment requires the provider identifiers and signature returned
 * by the client-side checkout. All three are opaque provider strings; the
 * server independently verifies the cryptographic signature before marking a
 * payment SUCCESS.
 */
export class VerifyPaymentDto {
  @IsString()
  @Length(1, 255, { message: 'providerOrderId is required' })
  providerOrderId!: string;

  @IsString()
  @Length(1, 255, { message: 'providerPaymentId is required' })
  providerPaymentId!: string;

  @IsString()
  @Length(1, 512, { message: 'providerSignature is required' })
  providerSignature!: string;
}
