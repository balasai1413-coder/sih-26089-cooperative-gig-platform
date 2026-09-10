import { apiRequest } from './client';
import type {
  CooperativeDemandBySkillRow,
  CooperativeDemandCapacity,
  CooperativeDemandOverview,
  CooperativeDemandRecommendation,
  CooperativeDemandTrends,
  DemandForecastFilters,
  DemandForecastResponse,
} from '@/types/demand-forecasting';

export const demandForecastingApi = {
  get: (accessToken: string, cooperativeId: string, filters: DemandForecastFilters = {}) => {
    const query = new URLSearchParams();
    if (filters.forecastStart) query.set('forecastStart', filters.forecastStart);
    if (filters.forecastEnd) query.set('forecastEnd', filters.forecastEnd);
    if (filters.skillId) query.set('skillId', filters.skillId);
    if (filters.categoryId) query.set('categoryId', filters.categoryId);
    if (filters.location) query.set('location', filters.location);
    const suffix = query.size ? `?${query.toString()}` : '';
    return apiRequest<DemandForecastResponse>(
      `/cooperatives/${cooperativeId}/demand-forecast${suffix}`,
      { accessToken },
    );
  },
  overview: (accessToken: string, cooperativeId: string, days = 30) =>
    apiRequest<CooperativeDemandOverview>(
      `/cooperatives/${cooperativeId}/demand/overview?days=${days}`,
      { accessToken },
    ),
  bySkill: (accessToken: string, cooperativeId: string, days = 30) =>
    apiRequest<CooperativeDemandBySkillRow[]>(
      `/cooperatives/${cooperativeId}/demand/by-skill?days=${days}`,
      { accessToken },
    ),
  trends: (accessToken: string, cooperativeId: string, days = 30) =>
    apiRequest<CooperativeDemandTrends>(
      `/cooperatives/${cooperativeId}/demand/trends?days=${days}`,
      { accessToken },
    ),
  forecast: (accessToken: string, cooperativeId: string, days = 30) =>
    apiRequest<DemandForecastResponse>(
      `/cooperatives/${cooperativeId}/demand/forecast?days=${days}`,
      { accessToken },
    ),
  capacity: (accessToken: string, cooperativeId: string, days = 30) =>
    apiRequest<CooperativeDemandCapacity>(
      `/cooperatives/${cooperativeId}/demand/capacity?days=${days}`,
      { accessToken },
    ),
  recommendations: (accessToken: string, cooperativeId: string, days = 30) =>
    apiRequest<CooperativeDemandRecommendation[]>(
      `/cooperatives/${cooperativeId}/demand/recommendations?days=${days}`,
      { accessToken },
    ),
};
