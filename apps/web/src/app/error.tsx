'use client';

import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Terjadi kesalahan</h1>
      <p className="max-w-sm text-muted-foreground">
        Terjadi kesalahan yang tidak terduga.{' '}
        {error.digest && <span className="font-mono text-xs">Referensi: {error.digest}</span>}
      </p>
      <Button onClick={reset}>Coba lagi</Button>
    </div>
  );
}
