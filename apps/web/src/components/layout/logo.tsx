import Link from 'next/link';
import { APP_NAME } from '@/lib/config';
import { cn } from '@/lib/utils';

export function Logo({
  href = '/',
  className,
  compact = false,
}: {
  href?: string;
  className?: string;
  compact?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn('flex items-center gap-2 font-semibold tracking-tight', className)}
    >
      <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground shadow-sm">
        {APP_NAME.charAt(0)}
      </span>
      {!compact && <span>{APP_NAME}</span>}
    </Link>
  );
}
