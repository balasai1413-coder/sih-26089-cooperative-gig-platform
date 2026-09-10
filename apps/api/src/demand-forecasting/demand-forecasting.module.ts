import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BaselineForecastingStrategy } from './baseline-forecasting.strategy';
import { DemandForecastingController } from './demand-forecasting.controller';
import { DemandForecastingService } from './demand-forecasting.service';
import { HistoricalDemandService } from './historical-demand.service';

@Module({
  imports: [AuthModule],
  controllers: [DemandForecastingController],
  providers: [HistoricalDemandService, BaselineForecastingStrategy, DemandForecastingService],
})
export class DemandForecastingModule {}
