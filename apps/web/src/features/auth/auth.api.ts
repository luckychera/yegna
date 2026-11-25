import { api } from '@/lib/api/client';
import type { LoginIdentifier } from '@/lib/validation/auth.schemas';
import type { AuthPayload, RegisterInput, UpdateProfileInput, UserProfile } from './auth.types';
export const authApi = {
  async login(identifier: LoginIdentifier, password: string): Promise<AuthPayload> {
    const { data } = await api.post<AuthPayload>(
      '/auth/login',
      { ...identifier, password },
      { auth: false },
    );

    return data;
  },

  async register(input: RegisterInput): Promise<AuthPayload> {
    const { data } = await api.post<AuthPayload>('/auth/register', input, { auth: false });

    return data;
  },

  async logout(refreshToken: string): Promise<void> {
    await api.post('/auth/logout', { refreshToken });
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await api.post('/auth/change-password', { currentPassword, newPassword });
  },

  async getMe(): Promise<UserProfile> {
    const { data } = await api.get<UserProfile>('/users/me');

    return data;
  },

  async updateProfile(input: UpdateProfileInput): Promise<UserProfile> {
    const { data } = await api.patch<{
      success: boolean;
      message: string;
      data: UserProfile;
    }>('/users/me', input);

    return data.data;
  },
};
