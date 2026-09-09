import { Module } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ReviewsService } from './reviews.service';
import { CustomerReviewsController } from './customer-reviews.controller';
import { WorkerReviewsController } from './worker-reviews.controller';

@Module({
  providers: [PrismaService, ReviewsService],
  controllers: [CustomerReviewsController, WorkerReviewsController],
  exports: [ReviewsService],
})
export class ReviewsModule {}
