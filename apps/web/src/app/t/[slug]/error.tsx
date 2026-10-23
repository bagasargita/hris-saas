'use client';

import { ErrorState } from '@/components/states';

export default function TenantError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg py-12">
      <ErrorState
        description="This page failed to load. If the problem persists, contact support."
        onRetry={reset}
      />
    </div>
  );
}
