import { UserRole } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  mobile: string;
  email: string | null;
  role: UserRole;
}

export interface JwtPayload {
  sub: string;
  role: UserRole;
  type: 'access' | 'refresh';
}
