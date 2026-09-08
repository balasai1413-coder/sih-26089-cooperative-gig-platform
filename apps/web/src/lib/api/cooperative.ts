import { apiRequest } from './client';
import type {
  CooperativeProfile,
  CooperativeSummary,
  CooperativeMember,
  MemberDetail,
  SkillCategory,
  AdminSkill,
  CreateSkillPayload,
  UpdateSkillPayload,
  UpdateCooperativePayload,
} from '@/types/cooperative';

function withToken(accessToken: string, method?: string, body?: unknown) {
  return {
    ...(method ? { method } : {}),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    accessToken,
  };
}

export const cooperativeApi = {
  list: (accessToken: string) =>
    apiRequest<CooperativeSummary[]>('/cooperatives/me', withToken(accessToken)),
  get: (accessToken: string, cooperativeId: string) =>
    apiRequest<CooperativeProfile>(`/cooperatives/${cooperativeId}`, withToken(accessToken)),
  update: (accessToken: string, cooperativeId: string, payload: UpdateCooperativePayload) =>
    apiRequest<CooperativeProfile>(
      `/cooperatives/${cooperativeId}`,
      withToken(accessToken, 'PATCH', payload),
    ),

  members: (
    accessToken: string,
    cooperativeId: string,
    params: { search?: string; status?: 'active' | 'former' } = {},
  ) => {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    if (params.status) query.set('status', params.status);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return apiRequest<CooperativeMember[]>(
      `/cooperatives/${cooperativeId}/members${suffix}`,
      withToken(accessToken),
    );
  },
  member: (accessToken: string, cooperativeId: string, workerId: string) =>
    apiRequest<MemberDetail>(
      `/cooperatives/${cooperativeId}/members/${workerId}`,
      withToken(accessToken),
    ),

  // The /skills endpoint returns the admin view (with active + workerCount) for
  // cooperative admins, and the lean active catalog for workers.
  skills: (
    accessToken: string,
    params: { search?: string; categoryId?: string; active?: boolean } = {},
  ) => {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    if (params.categoryId) query.set('categoryId', params.categoryId);
    if (params.active !== undefined) query.set('active', String(params.active));
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return apiRequest<AdminSkill[]>(`/skills${suffix}`, withToken(accessToken));
  },
  categories: (accessToken: string) =>
    apiRequest<SkillCategory[]>('/skills/categories', withToken(accessToken)),
  createSkill: (accessToken: string, payload: CreateSkillPayload) =>
    apiRequest<AdminSkill>('/skills', withToken(accessToken, 'POST', payload)),
  updateSkill: (accessToken: string, skillId: string, payload: UpdateSkillPayload) =>
    apiRequest<AdminSkill>(`/skills/${skillId}`, withToken(accessToken, 'PATCH', payload)),
  setSkillStatus: (accessToken: string, skillId: string, active: boolean) =>
    apiRequest<AdminSkill>(
      `/skills/${skillId}/status`,
      withToken(accessToken, 'PATCH', { active }),
    ),
};
