import type { ReactNode } from 'react';
import { Logo } from '@/components/layout/logo';
import { ThemeToggle } from '@/components/layout/theme-toggle';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-svh flex-col">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(50%_40%_at_50%_0%,color-mix(in_oklch,var(--primary)_12%,transparent),transparent)]" />
      <header className="flex h-16 items-center justify-between px-4 md:px-8">
        <Logo />
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pt-8 pb-16 md:items-center md:pt-0">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
