export interface AuthUser {
  id: string;
  email: string | null;
  phone: string | null;
  status: string;
}

export interface AuthPayload {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

export type FaydaVerificationStatus = 'pending' | 'verified' | 'failed' | 'revoked';

/** Response of GET /users/me. */
export interface UserProfile {
  user: AuthUser & {
    emailVerifiedAt: string | null;
    phoneVerifiedAt: string | null;
    lastLoginAt: string | null;
    createdAt: string;
  };
  profile: {
    firstName: string | null;
    middleName: string | null;
    lastName: string | null;
    displayName: string | null;
    fullName: string | null;
    avatarUrl: string | null;
    preferredLanguage: string | null;
    timezone: string | null;
  } | null;
  identity: {
    provider: string;
    verificationStatus: FaydaVerificationStatus;
    verifiedAt: string | null;
  } | null;
}
export interface UpdateProfileInput {
  firstName?: string;
  middleName?: string | null;
  lastName?: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  preferredLanguage?: string;
  timezone?: string;
}
export interface RegisterInput {
  faydaIdentifier: string;
  faydaIdentifierType: 'fin' | 'fan';
  email?: string;
  phone?: string;
  password: string;
  firstName: string;
  middleName?: string;
  lastName: string;
}
