import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { Authorize } from '../auth/decorators/authorize.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { PaymentsService } from './payments.service';

@Controller('customers/me')
@Authorize({ roles: [UserRole.CUSTOMER] })
export class CustomerPaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('bookings/:bookingId/payments')
  createPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Body() dto: CreatePaymentDto,
  ) {
    return this.paymentsService.createPayment(user, bookingId, dto);
  }

  @Post('payments/:paymentId/verify')
  verifyPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Body() dto: VerifyPaymentDto,
  ) {
    return this.paymentsService.verifyPayment(user, paymentId, dto);
  }

  @Get('payments')
  listMyPayments(@CurrentUser() user: AuthenticatedUser) {
    return this.paymentsService.listCustomerPayments(user);
  }

  @Get('payments/:paymentId')
  getMyPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
  ) {
    return this.paymentsService.getCustomerPayment(user, paymentId);
  }

  @Get('invoices')
  listMyInvoices(@CurrentUser() user: AuthenticatedUser) {
    return this.paymentsService.listCustomerInvoices(user);
  }

  @Get('invoices/:invoiceId')
  getMyInvoice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
  ) {
    return this.paymentsService.getCustomerInvoice(user, invoiceId);
  }
}
