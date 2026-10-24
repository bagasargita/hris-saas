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
        description="Halaman gagal dimuat. Jika masalah berlanjut, hubungi dukungan."
        onRetry={reset}
      />
    </div>
  );
}
