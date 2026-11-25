import { QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Toaster } from 'sonner';

import { ErrorBoundary } from '@/components/feedback/ErrorBoundary';
import { I18nProvider } from '@/i18n/I18nProvider';
import { AuthProvider } from './AuthProvider';
import { createQueryClient } from './query-client';
import { ThemeProvider, useTheme } from './ThemeProvider';

function AppContent({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  const { resolvedTheme } = useTheme();

  return (
    <>
      <I18nProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>{children}</AuthProvider>
        </QueryClientProvider>
      </I18nProvider>

      <Toaster
        position="top-right"
        closeButton
        richColors
        theme={resolvedTheme}
        toastOptions={{ duration: 4000 }}
      />
    </>
  );
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AppContent>{children}</AppContent>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
