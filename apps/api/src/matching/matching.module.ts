import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WorkerDiscoveryController } from './matching.controller';
import { WorkerMatchingService } from './matching.service';
import { ReviewsModule } from '../reviews/reviews.module';

@Module({
  imports: [AuthModule, ReviewsModule],
  controllers: [WorkerDiscoveryController],
  providers: [WorkerMatchingService],
})
export class MatchingModule {}
