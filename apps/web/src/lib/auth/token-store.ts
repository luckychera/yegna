/**
 * Where tokens live:
 *  - access token: memory only (gone on reload, never written to storage)
 *  - refresh token: localStorage, so a session survives reloads and new tabs
 */
const REFRESH_TOKEN_KEY = 'yegna.refreshToken';

let accessToken: string | null = null;

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export const tokenStore = {
  getAccessToken(): string | null {
    return accessToken;
  },

  getRefreshToken(): string | null {
    return storage()?.getItem(REFRESH_TOKEN_KEY) ?? null;
  },

  hasRefreshToken(): boolean {
    return this.getRefreshToken() !== null;
  },

  setTokens(access: string, refresh: string): void {
    accessToken = access;
    storage()?.setItem(REFRESH_TOKEN_KEY, refresh);
  },

  clear(): void {
    accessToken = null;
    storage()?.removeItem(REFRESH_TOKEN_KEY);
  },

  /** Fires when ANOTHER tab signs out (the refresh token key is removed). */
  onRemoteSignOut(listener: () => void): () => void {
    const handler = (event: StorageEvent) => {
      if (event.key === REFRESH_TOKEN_KEY && event.newValue === null) {
        accessToken = null;
        listener();
      }
    };

    window.addEventListener('storage', handler);

    return () => window.removeEventListener('storage', handler);
  },
};
