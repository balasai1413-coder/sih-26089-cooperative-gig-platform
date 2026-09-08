import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BookingsService } from './bookings.service';
import { CustomerBookingsController } from './customer-bookings.controller';
import { WorkerBookingsController } from './worker-bookings.controller';

@Module({
  imports: [AuthModule],
  controllers: [CustomerBookingsController, WorkerBookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
