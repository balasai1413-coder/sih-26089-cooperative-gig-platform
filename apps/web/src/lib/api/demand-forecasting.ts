import { apiRequest } from './client';
import type { DemandForecastFilters, DemandForecastResponse } from '@/types/demand-forecasting';

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
};
