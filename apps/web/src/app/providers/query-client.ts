import { QueryClient } from '@tanstack/react-query';

import { isApiError } from '@/lib/api/errors';

/**
 * Defaults tuned for a rate-limited API: no refetch on window focus, a short stale time and
 * no automatic retries for client errors (4xx) or rate limiting.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (isApiError(error) && error.status >= 400 && error.status < 500) {
            return false;
          }

          return failureCount < 1;
        },
      },
      mutations: { retry: false },
    },
  });
}
