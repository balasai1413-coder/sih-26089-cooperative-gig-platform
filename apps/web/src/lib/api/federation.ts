import { apiRequest } from './client';
import type {
  FederationCooperative,
  FederationOverview,
  FederationSummary,
  FederationWelfare,
  FederationWorkforce,
} from '@/types/federation';

export const federationApi = {
  list: (accessToken: string) =>
    apiRequest<FederationSummary[]>('/federations/me', { accessToken }),
  overview: (accessToken: string, federationId: string) =>
    apiRequest<FederationOverview>(`/federations/${federationId}`, { accessToken }),
  cooperatives: (accessToken: string, federationId: string) =>
    apiRequest<FederationCooperative[]>(`/federations/${federationId}/cooperatives`, {
      accessToken,
    }),
  workforce: (accessToken: string, federationId: string) =>
    apiRequest<FederationWorkforce>(`/federations/${federationId}/analytics/workforce`, {
      accessToken,
    }),
  welfare: (accessToken: string, federationId: string) =>
    apiRequest<FederationWelfare>(`/federations/${federationId}/analytics/welfare`, {
      accessToken,
    }),
};
