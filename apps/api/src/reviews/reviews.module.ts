import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../database/prisma.service';
import { NotificationsModule } from '../notifications/notifications.module';

import { ReviewsService } from './reviews.service';
import { CustomerReviewsController } from './customer-reviews.controller';
import { WorkerReviewsController } from './worker-reviews.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
<<<<<<< Updated upstream
  imports: [AuthModule, NotificationsModule],
=======
  imports: [
    NotificationsModule,
    AuthModule,   // ADD THIS
  ],
>>>>>>> Stashed changes
  providers: [PrismaService, ReviewsService],
  controllers: [CustomerReviewsController, WorkerReviewsController],
  exports: [ReviewsService],
})
export class ReviewsModule {}