export type UserRole = 'CUSTOMER' | 'WORKER' | 'COOPERATIVE_ADMIN';

export interface AuthUser {
  id: string;
  mobile: string;
  email: string | null;
  role: UserRole;
  createdAt?: string;
}

export interface AuthSession {
  user: AuthUser;
  accessToken: string;
}

export interface RegisterPayload {
  mobile: string;
  email?: string;
  password: string;
}

export interface LoginPayload {
  mobile: string;
  password: string;
}
