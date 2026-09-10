import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Authorize } from '../auth/decorators/authorize.decorator';
import { GetDemandForecastDto } from './dto/get-demand-forecast.dto';
import { DemandForecastingService } from './demand-forecasting.service';

@Controller('cooperatives/:cooperativeId/demand-forecast')
export class DemandForecastingController {
  constructor(private readonly demandForecasting: DemandForecastingService) {}

  @Get()
  @Authorize({
    roles: [UserRole.COOPERATIVE_ADMIN],
    cooperativeScope: { scope: 'admin', param: 'cooperativeId' },
  })
  getForecast(
    @Param('cooperativeId', ParseUUIDPipe) cooperativeId: string,
    @Query() query: GetDemandForecastDto,
  ) {
    return this.demandForecasting.getForecast(cooperativeId, query);
  }
}
