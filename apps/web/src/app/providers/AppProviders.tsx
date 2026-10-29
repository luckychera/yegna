import { QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Toaster } from 'sonner';

import { ErrorBoundary } from '@/components/feedback/ErrorBoundary';
import { I18nProvider } from '@/i18n/I18nProvider';
import { AuthProvider } from './AuthProvider';
import { createQueryClient } from './query-client';

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);

  return (
    <ErrorBoundary>
      <I18nProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>{children}</AuthProvider>
          <Toaster position="top-right" closeButton richColors toastOptions={{ duration: 4000 }} />
        </QueryClientProvider>
      </I18nProvider>
    </ErrorBoundary>
  );
}
