'use client';

import { useCallback, useEffect, useMemo, useState, createContext, useContext } from 'react';
import { authApi } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import type { AuthSession, AuthUser, LoginPayload, RegisterPayload, UserRole } from '@/types/auth';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  accessToken: string | null;
  login: (payload: LoginPayload) => Promise<AuthSession>;
  register: (
    role: Extract<UserRole, 'CUSTOMER' | 'WORKER'>,
    payload: RegisterPayload,
  ) => Promise<AuthSession>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const completeSession = useCallback(async (session: AuthSession): Promise<AuthSession> => {
    // The backend response contains a safe user, then /me confirms the current account.
    const currentUser = await authApi.me(session.accessToken);
    setUser(currentUser);
    setAccessToken(session.accessToken);
    setStatus('authenticated');
    return { ...session, user: currentUser };
  }, []);

  useEffect(() => {
    let active = true;
    void authApi
      .refresh()
      .then(async (session) => {
        const currentUser = await authApi.me(session.accessToken);
        if (!active) return;
        setUser(currentUser);
        setAccessToken(session.accessToken);
        setStatus('authenticated');
      })
      .catch(() => {
        if (!active) return;
        setUser(null);
        setAccessToken(null);
        setStatus('unauthenticated');
      });
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(
    async (payload: LoginPayload) => completeSession(await authApi.login(payload)),
    [completeSession],
  );

  const register = useCallback(
    async (role: Extract<UserRole, 'CUSTOMER' | 'WORKER'>, payload: RegisterPayload) =>
      completeSession(
        await (role === 'CUSTOMER'
          ? authApi.registerCustomer(payload)
          : authApi.registerWorker(payload)),
      ),
    [completeSession],
  );

  const logout = useCallback(async () => {
    try {
      if (accessToken) {
        try {
          await authApi.logout(accessToken);
        } catch (error) {
          // Access tokens are intentionally short lived. Retry logout once with
          // a cookie-backed refresh so the server can clear the refresh session.
          if (!(error instanceof ApiError) || error.status !== 401) throw error;
          const renewed = await authApi.refresh();
          await authApi.logout(renewed.accessToken);
        }
      }
    } finally {
      setUser(null);
      setAccessToken(null);
      setStatus('unauthenticated');
    }
  }, [accessToken]);

  const value = useMemo(
    () => ({ status, user, accessToken, login, register, logout }),
    [accessToken, login, logout, register, status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
