import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { authApi } from '@/features/auth/auth.api';
import type { RegisterInput, UserProfile } from '@/features/auth/auth.types';
import { refreshSession } from '@/lib/auth/refresh';
import { sessionEvents } from '@/lib/auth/session-events';
import { tokenStore } from '@/lib/auth/token-store';
import type { LoginIdentifier } from '@/lib/validation/auth.schemas';
import {
  AuthContext,
  type AuthContextValue,
  type AuthStatus,
  type SessionNotice,
} from './auth-context';

interface AuthState {
  status: AuthStatus;
  profile: UserProfile | null;
  notice: SessionNotice;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({ status: 'loading', profile: null, notice: null });
  const [attempt, setAttempt] = useState(0);

  const signOutLocally = useCallback(
    (notice: SessionNotice) => {
      tokenStore.clear();
      queryClient.clear();
      setState({ status: 'unauthenticated', profile: null, notice });
    },
    [queryClient],
  );

  // Restore the session on page load: a stored refresh token becomes a fresh access token.
  useEffect(() => {
    let cancelled = false;

    async function restore() {
      if (!tokenStore.hasRefreshToken()) {
        setState({ status: 'unauthenticated', profile: null, notice: null });

        return;
      }

      const outcome = await refreshSession();

      if (cancelled) return;

      if (outcome === 'invalid') {
        setState({ status: 'unauthenticated', profile: null, notice: 'expired' });

        return;
      }

      if (outcome === 'unavailable') {
        setState({ status: 'error', profile: null, notice: null });

        return;
      }

      try {
        const profile = await authApi.getMe();

        if (!cancelled) setState({ status: 'authenticated', profile, notice: null });
      } catch {
        if (!cancelled) setState({ status: 'error', profile: null, notice: null });
      }
    }

    void restore();

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  // The API layer reports a dead session (refresh rejected); other tabs can sign out too.
  useEffect(() => {
    const offExpired = sessionEvents.onExpired(() => signOutLocally('expired'));
    const offRemote = tokenStore.onRemoteSignOut(() => signOutLocally(null));

    return () => {
      offExpired();
      offRemote();
    };
  }, [signOutLocally]);

  const establishSession = useCallback(
    async (tokens: { accessToken: string; refreshToken: string }) => {
      tokenStore.setTokens(tokens.accessToken, tokens.refreshToken);

      try {
        const profile = await authApi.getMe();

        queryClient.clear();
        setState({ status: 'authenticated', profile, notice: null });
      } catch (error) {
        tokenStore.clear();
        throw error;
      }
    },
    [queryClient],
  );

  const login = useCallback(
    async (identifier: LoginIdentifier, password: string) => {
      await establishSession(await authApi.login(identifier, password));
    },
    [establishSession],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      await establishSession(await authApi.register(input));
    },
    [establishSession],
  );

  const logout = useCallback(async () => {
    const refreshToken = tokenStore.getRefreshToken();

    if (refreshToken) {
      try {
        await authApi.logout(refreshToken);
      } catch {
        // Signing out locally must always succeed, even if the server cannot be reached.
      }
    }

    signOutLocally(null);
  }, [signOutLocally]);

  const refreshProfile = useCallback(async () => {
    const profile = await authApi.getMe();

    setState((current) => ({ ...current, profile }));
  }, []);

  const retry = useCallback(() => {
    setState({ status: 'loading', profile: null, notice: null });
    setAttempt((value) => value + 1);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, login, register, logout, signOutLocally, refreshProfile, retry }),
    [state, login, register, logout, signOutLocally, refreshProfile, retry],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
