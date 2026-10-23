'use client';

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { useState, type ReactNode } from 'react';
import { Toaster } from 'sonner';
import { ApiError } from '@/lib/api/errors';

/** Full page load on purpose: it discards every in-memory cache of the expired session. */
function redirectToLogin(): void {
  const login = new URL('/login', window.location.origin);
  login.searchParams.set('next', `${window.location.pathname}${window.location.search}`);
  login.searchParams.set('reason', 'expired');
  window.location.replace(login.toString());
}

export function makeQueryClient(): QueryClient {
  const onError = (error: unknown) => {
    if (
      error instanceof ApiError &&
      error.status === 401 &&
      !window.location.pathname.startsWith('/login')
    ) {
      redirectToLogin();
    }
  };
  return new QueryClient({
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: true,
        // Never retry authorization or validation failures; only transient server/network errors.
        retry: (failureCount, error) =>
          failureCount < 2 &&
          (!(error instanceof ApiError) || error.status === 0 || error.status >= 500),
      },
      // Mutations are not idempotent in general and are never retried automatically.
      mutations: { retry: false },
    },
  });
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(makeQueryClient);
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster richColors closeButton position="top-right" />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
