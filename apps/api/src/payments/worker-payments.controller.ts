import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { Authorize } from '../auth/decorators/authorize.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PaymentsService } from './payments.service';

/**
 * Worker payment visibility is intentionally read-only and limited to the
 * worker's own assigned bookings. Workers can never create or modify a
 * customer's payment.
 */
@Controller('workers/me')
@Authorize({ roles: [UserRole.WORKER] })
export class WorkerPaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('payments')
  listMyPayments(@CurrentUser() user: AuthenticatedUser) {
    return this.paymentsService.listWorkerPayments(user);
  }

  @Get('payments/:paymentId')
  getMyPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
  ) {
    return this.paymentsService.getWorkerPayment(user, paymentId);
  }
}
