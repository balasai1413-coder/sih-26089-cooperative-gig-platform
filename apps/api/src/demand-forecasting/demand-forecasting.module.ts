import { Module } from '@nestjs/common';
import { CooperativesModule } from '../cooperatives/cooperatives.module';

@Module({
  imports: [CooperativesModule],
})
export class DemandForecastingModule {}
