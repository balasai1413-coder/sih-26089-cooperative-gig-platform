import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Authorize } from '../auth/decorators/authorize.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { BookingsService } from './bookings.service';
import { WorkerCompleteBookingDto, WorkerRejectBookingDto } from './dto/booking-action.dto';

@Controller('workers/me')
@Authorize({ roles: [UserRole.WORKER] })
export class WorkerBookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get('bookings')
  listMyBookings(@CurrentUser() user: AuthenticatedUser) {
    return this.bookingsService.listWorkerBookings(user);
  }

  @Get('bookings/:bookingId')
  getMyBooking(
    @CurrentUser() user: AuthenticatedUser,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
  ) {
    return this.bookingsService.getWorkerBooking(user, bookingId);
  }

  @Post('bookings/:bookingId/accept')
  acceptBooking(
    @CurrentUser() user: AuthenticatedUser,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
  ) {
    return this.bookingsService.acceptBooking(user, bookingId);
  }

  @Post('bookings/:bookingId/reject')
  rejectBooking(
    @CurrentUser() user: AuthenticatedUser,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Body() dto: WorkerRejectBookingDto,
  ) {
    return this.bookingsService.rejectBooking(user, bookingId, dto);
  }

  @Post('bookings/:bookingId/start')
  startBooking(
    @CurrentUser() user: AuthenticatedUser,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
  ) {
    return this.bookingsService.startBooking(user, bookingId);
  }

  @Post('bookings/:bookingId/complete')
  completeBooking(
    @CurrentUser() user: AuthenticatedUser,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Body() dto: WorkerCompleteBookingDto,
  ) {
    return this.bookingsService.completeBooking(user, bookingId, dto);
  }
}
