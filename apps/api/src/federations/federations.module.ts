import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DemandForecastingModule } from '../demand-forecasting/demand-forecasting.module';
import { FederationsController } from './federations.controller';
import { FederationsService } from './federations.service';

@Module({
  imports: [AuthModule, DemandForecastingModule],
  controllers: [FederationsController],
  providers: [FederationsService],
})
export class FederationsModule {}
