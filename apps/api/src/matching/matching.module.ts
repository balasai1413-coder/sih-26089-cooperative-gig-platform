import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WorkerDiscoveryController } from './matching.controller';
import { WorkerMatchingService } from './matching.service';

@Module({
  imports: [AuthModule],
  controllers: [WorkerDiscoveryController],
  providers: [WorkerMatchingService],
})
export class MatchingModule {}
