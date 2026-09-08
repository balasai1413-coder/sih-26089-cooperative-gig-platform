import { apiRequest } from './client';
import type { AuthSession, AuthUser, LoginPayload, RegisterPayload } from '@/types/auth';

export const authApi = {
  registerCustomer: (payload: RegisterPayload) =>
    apiRequest<AuthSession>('/auth/register/customer', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  registerWorker: (payload: RegisterPayload) =>
    apiRequest<AuthSession>('/auth/register/worker', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  login: (payload: LoginPayload) =>
    apiRequest<AuthSession>('/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  refresh: () => apiRequest<AuthSession>('/auth/refresh', { method: 'POST' }),
  me: (accessToken: string) => apiRequest<AuthUser>('/auth/me', { accessToken }),
  logout: (accessToken: string) =>
    apiRequest<{ success: true }>('/auth/logout', { method: 'POST', accessToken }),
};
