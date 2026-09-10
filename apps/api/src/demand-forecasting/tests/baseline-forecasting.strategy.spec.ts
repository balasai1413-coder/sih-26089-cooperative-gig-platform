import { BaselineForecastingStrategy } from '../baseline-forecasting.strategy';
import type { HistoricalDemandRecord } from '../demand-forecasting.types';

const forecastStart = new Date('2026-09-01T00:00:00.000Z');
const forecastEnd = new Date('2026-09-07T00:00:00.000Z');

function recordsFor(days: number, perDay = 1): HistoricalDemandRecord[] {
  const start = new Date('2026-08-01T00:00:00.000Z');
  return Array.from({ length: days * perDay }, (_, index) => {
    const day = Math.floor(index / perDay);
    return {
      serviceRequestId: `request-${index}`,
      occurredAt: new Date(start.getTime() + day * 24 * 60 * 60 * 1000),
      skill: { id: 'skill-1', name: 'Electrical', category: { id: 'cat-1', name: 'Home' } },
      location: 'Sector 17',
    };
  });
}

describe('BaselineForecastingStrategy', () => {
  const strategy = new BaselineForecastingStrategy();
  const dimensions = { skill: null, category: null, location: null };

  it('returns no-data and insufficient-data states instead of fabricating a forecast', () => {
    const noData = strategy.forecast({
      records: [],
      historicalEnd: forecastStart,
      forecastStart,
      forecastEnd,
      dimensions,
    });
    const insufficient = strategy.forecast({
      records: recordsFor(5),
      historicalEnd: forecastStart,
      forecastStart,
      forecastEnd,
      dimensions,
    });

    expect(noData.status).toBe('NO_HISTORICAL_DATA');
    expect(noData.predictedDemand).toBeNull();
    expect(insufficient.status).toBe('INSUFFICIENT_DATA');
    expect(insufficient.predictedDemand).toBeNull();
    expect(insufficient.dataSufficiency.message).toMatch(/requires at least/i);
  });

  it('generates a deterministic weekday-pattern forecast from qualifying history', () => {
    const input = {
      records: recordsFor(28, 2),
      historicalEnd: forecastStart,
      forecastStart,
      forecastEnd,
      dimensions,
    };
    const first = strategy.forecast(input);
    const second = strategy.forecast(input);

    expect(first).toEqual(second);
    expect(first.status).toBe('READY');
    expect(first.predictedDemand).toBe(13);
    expect(first.historicalBaseline).toBe(13);
    expect(first.explanation).toMatch(/weekday-pattern demand/i);
  });

  it('classifies demand using historical period quartiles', () => {
    const classifier = strategy as unknown as {
      classifyDemandLevel(value: number, history: number[]): string;
    };
    const historicalPeriods = [1, 2, 3, 4];

    expect(classifier.classifyDemandLevel(1, historicalPeriods)).toBe('LOW');
    expect(classifier.classifyDemandLevel(2, historicalPeriods)).toBe('MEDIUM');
    expect(classifier.classifyDemandLevel(3, historicalPeriods)).toBe('HIGH');
    expect(classifier.classifyDemandLevel(4, historicalPeriods)).toBe('CRITICAL');
  });
});
