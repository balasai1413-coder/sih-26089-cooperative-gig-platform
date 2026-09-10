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

export interface CooperativeDemandOverview {
  cooperativeId: string;
  periodDays: number;
  generatedAt: string;
  status: string;
  dataStatus: string;
  totalHistoricalDemand: number;
  forecastDemand: number;
  averageDailyDemand: number;
  trend: string;
  highDemandSkills: Array<{
    skillId: string;
    skillName: string;
    predictedDemand: number;
    historicalDemand: number;
    trend: string;
    availableQualifiedWorkers: number;
  }>;
  availableQualifiedWorkers: number;
  capacityStatus: 'SUFFICIENT' | 'INSUFFICIENT';
}

export interface CooperativeDemandBySkillRow {
  skillId: string;
  skillName: string;
  historicalDemand: number;
  forecastDemand: number;
  trend: string;
  availableQualifiedWorkers: number;
  capacityStatus: 'SHORTAGE' | 'SUFFICIENT';
}

export interface CooperativeDemandTrends {
  cooperativeId: string;
  periodDays: number;
  generatedAt: string;
  dataPoints: Array<{
    date: string;
    demand: number;
  }>;
}

export interface CooperativeDemandCapacity {
  cooperativeId: string;
  periodDays: number;
  generatedAt: string;
  totalVerifiedWorkers: number;
  forecastDemand: number;
  bySkill: Array<{
    skillId: string;
    skillName: string;
    verifiedWorkers: number;
    forecastDemand: number;
    capacityStatus: 'SHORTAGE' | 'SUFFICIENT';
  }>;
}

export interface CooperativeDemandRecommendation {
  skillId: string;
  skillName: string;
  predictedDemand: number;
  availableWorkers: number;
  recommendedWorkers: number;
  severity: 'SHORTAGE' | 'SUFFICIENT';
  reason: string;
}
