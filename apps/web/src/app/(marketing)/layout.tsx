import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo } from '@/components/layout/logo';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Button } from '@/components/ui/button';
import { APP_NAME } from '@/lib/config';

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 md:px-6">
          <Logo />
          <nav
            className="hidden items-center gap-5 text-sm text-muted-foreground md:flex"
            aria-label="Pemasaran"
          >
            <Link href="/#features" className="hover:text-foreground">
              Fitur
            </Link>
            <Link href="/pricing" className="hover:text-foreground">
              Harga
            </Link>
            <Link href="/#security" className="hover:text-foreground">
              Keamanan
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" asChild>
              <Link href="/login">Masuk</Link>
            </Button>
            <Button asChild>
              <Link href="/register">Mulai</Link>
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-muted-foreground md:flex-row md:px-6">
          <p>
            © {new Date().getFullYear()} {APP_NAME}. Hak cipta dilindungi.
          </p>
          <div className="flex gap-4">
            <Link href="/pricing" className="hover:text-foreground">
              Harga
            </Link>
            <Link href="/login" className="hover:text-foreground">
              Masuk
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
