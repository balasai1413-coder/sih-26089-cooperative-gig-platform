import { BadRequestException, Injectable } from '@nestjs/common';
import { BaselineForecastingStrategy } from './baseline-forecasting.strategy';
import { GetDemandForecastDto } from './dto/get-demand-forecast.dto';
import {
  ForecastDimensions,
  ForecastResult,
  HistoricalDemandRecord,
} from './demand-forecasting.types';
import { HistoricalDemandService } from './historical-demand.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const HISTORICAL_LOOKBACK_DAYS = 56;
const MAX_FORECAST_DAYS = 31;

function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function addUtcDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * DAY_MS);
}

@Injectable()
export class DemandForecastingService {
  constructor(
    private readonly historicalDemand: HistoricalDemandService,
    private readonly strategy: BaselineForecastingStrategy,
  ) {}

  async getForecast(cooperativeId: string, query: GetDemandForecastDto) {
    const period = this.resolveForecastPeriod(query);
    const historicalEnd = startOfUtcDay(new Date());
    const records = await this.historicalDemand.getDemandRecords({
      cooperativeId,
      startDate: addUtcDays(historicalEnd, -HISTORICAL_LOOKBACK_DAYS),
      endDate: historicalEnd,
      skillId: query.skillId,
      categoryId: query.categoryId,
      location: query.location,
    });

    const overall = this.forecast(records, historicalEnd, period.start, period.end, {
      skill: null,
      category: null,
      location: query.location ?? null,
    });
    const skills = this.groupBySkill(records, historicalEnd, period.start, period.end);
    const categories = this.groupByCategory(records, historicalEnd, period.start, period.end);
    const areas = this.groupByLocation(records, historicalEnd, period.start, period.end);

    return {
      status: overall.status,
      generatedAt: new Date().toISOString(),
      forecastPeriod: overall.forecastPeriod,
      filters: {
        cooperativeId,
        skillId: query.skillId ?? null,
        categoryId: query.categoryId ?? null,
        location: query.location ?? null,
      },
      source: {
        description:
          'Non-cancelled service requests with an accepted, in-progress, or completed booking snapshotted to this cooperative at assignment time.',
        excluded: ['cancelled service requests', 'rejected bookings', 'cancelled bookings'],
      },
      overview: overall,
      highDemandSkills: skills,
      highDemandCategories: categories,
      highDemandAreas: areas,
    };
  }

  private resolveForecastPeriod(query: GetDemandForecastDto): { start: Date; end: Date } {
    const today = startOfUtcDay(new Date());
    const start = query.forecastStart
      ? startOfUtcDay(new Date(query.forecastStart))
      : addUtcDays(today, 1);
    const end = query.forecastEnd
      ? startOfUtcDay(new Date(query.forecastEnd))
      : addUtcDays(start, 6);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('Forecast dates must be valid ISO dates');
    }
    if (start < today) {
      throw new BadRequestException('Forecast start date must not be in the past');
    }
    if (end < start) {
      throw new BadRequestException('Forecast end date must be on or after the start date');
    }
    const days = Math.floor((end.getTime() - start.getTime()) / DAY_MS) + 1;
    if (days > MAX_FORECAST_DAYS) {
      throw new BadRequestException(`Forecast periods cannot exceed ${MAX_FORECAST_DAYS} days`);
    }
    return { start, end };
  }

  private forecast(
    records: HistoricalDemandRecord[],
    historicalEnd: Date,
    start: Date,
    end: Date,
    dimensions: ForecastDimensions,
  ): ForecastResult {
    return this.strategy.forecast({
      records,
      historicalEnd,
      forecastStart: start,
      forecastEnd: end,
      dimensions,
    });
  }

  private groupBySkill(
    records: HistoricalDemandRecord[],
    historicalEnd: Date,
    start: Date,
    end: Date,
  ): ForecastResult[] {
    const groups = new Map<
      string,
      { records: HistoricalDemandRecord[]; dimensions: ForecastDimensions }
    >();
    for (const record of records) {
      if (!record.skill) continue;
      const group = groups.get(record.skill.id) ?? {
        records: [],
        dimensions: {
          skill: { id: record.skill.id, name: record.skill.name },
          category: record.skill.category,
          location: null,
        },
      };
      group.records.push(record);
      groups.set(record.skill.id, group);
    }
    return this.rankGroups(groups, historicalEnd, start, end);
  }

  private groupByCategory(
    records: HistoricalDemandRecord[],
    historicalEnd: Date,
    start: Date,
    end: Date,
  ): ForecastResult[] {
    const groups = new Map<
      string,
      { records: HistoricalDemandRecord[]; dimensions: ForecastDimensions }
    >();
    for (const record of records) {
      if (!record.skill?.category) continue;
      const category = record.skill.category;
      const group = groups.get(category.id) ?? {
        records: [],
        dimensions: { skill: null, category, location: null },
      };
      group.records.push(record);
      groups.set(category.id, group);
    }
    return this.rankGroups(groups, historicalEnd, start, end);
  }

  private groupByLocation(
    records: HistoricalDemandRecord[],
    historicalEnd: Date,
    start: Date,
    end: Date,
  ): ForecastResult[] {
    const groups = new Map<
      string,
      { records: HistoricalDemandRecord[]; dimensions: ForecastDimensions }
    >();
    for (const record of records) {
      const location = record.location?.trim();
      if (!location) continue;
      const key = location.toLocaleLowerCase();
      const group = groups.get(key) ?? {
        records: [],
        dimensions: { skill: null, category: null, location },
      };
      group.records.push(record);
      groups.set(key, group);
    }
    return this.rankGroups(groups, historicalEnd, start, end);
  }

  private rankGroups(
    groups: Map<string, { records: HistoricalDemandRecord[]; dimensions: ForecastDimensions }>,
    historicalEnd: Date,
    start: Date,
    end: Date,
  ): ForecastResult[] {
    return [...groups.values()]
      .map((group) => this.forecast(group.records, historicalEnd, start, end, group.dimensions))
      .sort((left, right) => (right.predictedDemand ?? -1) - (left.predictedDemand ?? -1));
  }
}
