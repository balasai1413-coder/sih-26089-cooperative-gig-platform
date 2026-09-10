export type ForecastStatus = 'READY' | 'NO_HISTORICAL_DATA' | 'INSUFFICIENT_DATA';
export type ForecastTrend = 'INCREASING' | 'DECREASING' | 'STABLE';
export type DemandLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface HistoricalDemandRecord {
  serviceRequestId: string;
  occurredAt: Date;
  skill: { id: string; name: string; category: { id: string; name: string } | null } | null;
  location: string | null;
}

export interface HistoricalDemandFilter {
  cooperativeId: string;
  startDate: Date;
  endDate: Date;
  skillId?: string;
  categoryId?: string;
  location?: string;
}

export interface ForecastPeriod {
  startDate: string;
  endDate: string;
  days: number;
}

export interface ForecastDimensions {
  skill: { id: string; name: string } | null;
  category: { id: string; name: string } | null;
  location: string | null;
}

export interface ForecastDataSufficiency {
  historicalRequestCount: number;
  historicalDays: number;
  requiredHistoricalDays: number;
  requiredRequestCount: number;
  message: string;
}

export interface ForecastResult {
  forecastPeriod: ForecastPeriod;
  dimensions: ForecastDimensions;
  predictedDemand: number | null;
  historicalBaseline: number | null;
  trend: ForecastTrend | null;
  demandLevel: DemandLevel | null;
  explanation: string;
  status: ForecastStatus;
  dataSufficiency: ForecastDataSufficiency;
}

export interface ForecastingInput {
  records: HistoricalDemandRecord[];
  /** Exclusive end of observed history; forecast dates must never become zero-valued history. */
  historicalEnd: Date;
  forecastStart: Date;
  forecastEnd: Date;
  dimensions: ForecastDimensions;
}

export interface ForecastingStrategy {
  forecast(input: ForecastingInput): ForecastResult;
}
