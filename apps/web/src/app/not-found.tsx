import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-sm font-medium text-primary">404</p>
      <h1 className="text-3xl font-semibold tracking-tight">Halaman tidak ditemukan</h1>
      <p className="max-w-sm text-muted-foreground">
        Halaman yang Anda cari tidak ada atau telah dipindahkan.
      </p>
      <Button asChild>
        <Link href="/">Ke beranda</Link>
      </Button>
    </div>
  );
}
