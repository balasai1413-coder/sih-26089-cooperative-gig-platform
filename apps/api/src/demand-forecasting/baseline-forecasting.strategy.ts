import {
  DemandLevel,
  ForecastingInput,
  ForecastingStrategy,
  ForecastResult,
  ForecastTrend,
} from './demand-forecasting.types';

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function addUtcDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * DAY_MS);
}

function dayKey(value: Date): string {
  return startOfUtcDay(value).toISOString().slice(0, 10);
}

function periodFor(start: Date, end: Date) {
  const startDay = startOfUtcDay(start);
  const endDay = startOfUtcDay(end);
  return {
    startDate: dayKey(startDay),
    endDate: dayKey(endDay),
    days: Math.floor((endDay.getTime() - startDay.getTime()) / DAY_MS) + 1,
  };
}

function quantile(values: number[], fraction: number): number {
  if (!values.length) return 0;
  const index = Math.ceil(fraction * values.length) - 1;
  return values[Math.max(0, Math.min(values.length - 1, index))] ?? 0;
}

/**
 * Deterministic, ML-ready baseline. It uses historical demand on matching
 * weekdays, so a Monday is compared with prior Mondays rather than with a
 * fabricated global rate. Demand levels are data-relative: quartiles of
 * historical rolling totals for the same forecast length, not fixed business
 * volume cut-offs.
 */
export class BaselineForecastingStrategy implements ForecastingStrategy {
  forecast(input: ForecastingInput): ForecastResult {
    const period = periodFor(input.forecastStart, input.forecastEnd);
    const requiredHistoricalDays = Math.max(14, period.days * 2);
    const requiredRequestCount = Math.max(7, period.days);
    const base = {
      forecastPeriod: period,
      dimensions: input.dimensions,
    };

    if (!input.records.length) {
      return {
        ...base,
        predictedDemand: null,
        historicalBaseline: null,
        trend: null,
        demandLevel: null,
        explanation:
          'No qualifying historical demand is available for these filters. More completed or active cooperative bookings are required.',
        status: 'NO_HISTORICAL_DATA',
        dataSufficiency: {
          historicalRequestCount: 0,
          historicalDays: 0,
          requiredHistoricalDays,
          requiredRequestCount,
          message: 'No qualifying historical demand records were found.',
        },
      };
    }

    const historyEnd = startOfUtcDay(input.historicalEnd);
    const firstRecordDay = startOfUtcDay(input.records[0]!.occurredAt);
    const historicalDays = Math.max(
      1,
      Math.floor((historyEnd.getTime() - firstRecordDay.getTime()) / DAY_MS),
    );

    if (historicalDays < requiredHistoricalDays || input.records.length < requiredRequestCount) {
      return {
        ...base,
        predictedDemand: null,
        historicalBaseline: null,
        trend: null,
        demandLevel: null,
        explanation:
          'There is not enough qualifying history to produce a meaningful forecast for this period.',
        status: 'INSUFFICIENT_DATA',
        dataSufficiency: {
          historicalRequestCount: input.records.length,
          historicalDays,
          requiredHistoricalDays,
          requiredRequestCount,
          message: `Forecasting requires at least ${requiredHistoricalDays} completed historical days and ${requiredRequestCount} qualifying requests.`,
        },
      };
    }

    const countsByDay = new Map<string, number>();
    for (const record of input.records) {
      const key = dayKey(record.occurredAt);
      countsByDay.set(key, (countsByDay.get(key) ?? 0) + 1);
    }

    const dailyCounts = Array.from({ length: historicalDays }, (_, index) => {
      const date = addUtcDays(firstRecordDay, index);
      return countsByDay.get(dayKey(date)) ?? 0;
    });
    const weekdayTotals = Array.from({ length: 7 }, () => ({ total: 0, days: 0 }));
    for (let index = 0; index < historicalDays; index += 1) {
      const date = addUtcDays(firstRecordDay, index);
      const weekday = weekdayTotals[date.getUTCDay()]!;
      weekday.total += dailyCounts[index] ?? 0;
      weekday.days += 1;
    }

    let predictedDemand = 0;
    for (let index = 0; index < period.days; index += 1) {
      const targetDate = addUtcDays(startOfUtcDay(input.forecastStart), index);
      const weekday = weekdayTotals[targetDate.getUTCDay()]!;
      predictedDemand += weekday.days ? weekday.total / weekday.days : 0;
    }
    predictedDemand = Math.round(predictedDemand);

    const historicalBaseline = Math.round((input.records.length / historicalDays) * period.days);
    const recentDays = Math.min(7, Math.floor(historicalDays / 2));
    const recentAverage =
      dailyCounts.slice(-recentDays).reduce((sum, count) => sum + count, 0) / recentDays;
    const previousAverage =
      dailyCounts.slice(-recentDays * 2, -recentDays).reduce((sum, count) => sum + count, 0) /
      recentDays;
    const trend: ForecastTrend =
      recentAverage > previousAverage
        ? 'INCREASING'
        : recentAverage < previousAverage
          ? 'DECREASING'
          : 'STABLE';

    const rollingTotals = Array.from(
      { length: Math.max(1, dailyCounts.length - period.days + 1) },
      (_, start) =>
        dailyCounts.slice(start, start + period.days).reduce((sum, count) => sum + count, 0),
    ).sort((left, right) => left - right);
    const demandLevel = this.classifyDemandLevel(predictedDemand, rollingTotals);
    const comparison =
      predictedDemand > historicalBaseline
        ? 'above'
        : predictedDemand < historicalBaseline
          ? 'below'
          : 'in line with';

    return {
      ...base,
      predictedDemand,
      historicalBaseline,
      trend,
      demandLevel,
      explanation: `Weekday-pattern demand is expected to be ${comparison} the historical baseline (${predictedDemand} forecast versus ${historicalBaseline} baseline).`,
      status: 'READY',
      dataSufficiency: {
        historicalRequestCount: input.records.length,
        historicalDays,
        requiredHistoricalDays,
        requiredRequestCount,
        message: 'Historical demand meets the baseline forecasting requirement.',
      },
    };
  }

  private classifyDemandLevel(predictedDemand: number, rollingTotals: number[]): DemandLevel {
    const lowerQuartile = quantile(rollingTotals, 0.25);
    const median = quantile(rollingTotals, 0.5);
    const upperQuartile = quantile(rollingTotals, 0.75);
    if (predictedDemand <= lowerQuartile) return 'LOW';
    if (predictedDemand <= median) return 'MEDIUM';
    if (predictedDemand <= upperQuartile) return 'HIGH';
    return 'CRITICAL';
  }
}
