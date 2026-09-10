export type ForecastStatus = 'READY' | 'NO_HISTORICAL_DATA' | 'INSUFFICIENT_DATA';
export type ForecastTrend = 'INCREASING' | 'DECREASING' | 'STABLE';
export type DemandLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ForecastResult {
  forecastPeriod: { startDate: string; endDate: string; days: number };
  dimensions: {
    skill: { id: string; name: string } | null;
    category: { id: string; name: string } | null;
    location: string | null;
  };
  predictedDemand: number | null;
  historicalBaseline: number | null;
  trend: ForecastTrend | null;
  demandLevel: DemandLevel | null;
  explanation: string;
  status: ForecastStatus;
  dataSufficiency: {
    historicalRequestCount: number;
    historicalDays: number;
    requiredHistoricalDays: number;
    requiredRequestCount: number;
    message: string;
  };
}

export interface DemandForecastResponse {
  status: ForecastStatus;
  generatedAt: string;
  forecastPeriod: { startDate: string; endDate: string; days: number };
  filters: {
    cooperativeId: string;
    skillId: string | null;
    categoryId: string | null;
    location: string | null;
  };
  source: { description: string; excluded: string[] };
  overview: ForecastResult;
  highDemandSkills: ForecastResult[];
  highDemandCategories: ForecastResult[];
  highDemandAreas: ForecastResult[];
}

export interface DemandForecastFilters {
  forecastStart?: string;
  forecastEnd?: string;
  skillId?: string;
  categoryId?: string;
  location?: string;
}
