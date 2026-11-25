import { createContext } from 'react';

import type { UserProfile } from '@/features/auth/auth.types';
import type { LoginIdentifier } from '@/lib/validation/auth.schemas';
import type { RegisterInput } from '@/features/auth/auth.types';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'error';
export type SessionNotice = 'expired' | 'password-changed' | null;

export interface AuthContextValue {
  status: AuthStatus;
  profile: UserProfile | null;
  /** Why the user was sent back to sign-in, shown once on the login screen. */
  notice: SessionNotice;
  login: (identifier: LoginIdentifier, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  /** Ends the local session without calling the API (e.g. after the backend revoked it). */
  signOutLocally: (notice: SessionNotice) => void;
  refreshProfile: () => Promise<void>;
  retry: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
