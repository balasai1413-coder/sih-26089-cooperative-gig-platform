import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DemandForecastingModule } from '../demand-forecasting/demand-forecasting.module';
import { CooperativesController } from './cooperatives.controller';
import { CooperativesService } from './cooperatives.service';

@Module({
  imports: [AuthModule, DemandForecastingModule],
  controllers: [CooperativesController],
  providers: [CooperativesService],
  exports: [CooperativesService],
})
export class CooperativesModule {}
