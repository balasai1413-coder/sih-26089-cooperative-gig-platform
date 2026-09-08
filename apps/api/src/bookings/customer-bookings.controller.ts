import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Authorize } from '../auth/decorators/authorize.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CustomerCancelBookingDto } from './dto/booking-action.dto';

@Controller('customers/me')
@Authorize({ roles: [UserRole.CUSTOMER] })
export class CustomerBookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post('service-requests/:requestId/bookings')
  createBooking(
    @CurrentUser() user: AuthenticatedUser,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() dto: CreateBookingDto,
  ) {
    return this.bookingsService.createBooking(user, requestId, dto);
  }

  @Get('bookings')
  listMyBookings(@CurrentUser() user: AuthenticatedUser) {
    return this.bookingsService.listCustomerBookings(user);
  }

  @Get('bookings/:bookingId')
  getMyBooking(
    @CurrentUser() user: AuthenticatedUser,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
  ) {
    return this.bookingsService.getCustomerBooking(user, bookingId);
  }

  @Post('bookings/:bookingId/cancel')
  cancelMyBooking(
    @CurrentUser() user: AuthenticatedUser,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Body() dto: CustomerCancelBookingDto,
  ) {
    return this.bookingsService.cancelBooking(user, bookingId, dto);
  }
}

