import { AlertTriangleIcon, InboxIcon, LockIcon, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function StateBlock({
  icon: Icon,
  title,
  description,
  action,
  tone = 'muted',
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  tone?: 'muted' | 'destructive';
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-14 text-center',
        className,
      )}
    >
      <div
        className={cn(
          'flex size-11 items-center justify-center rounded-full',
          tone === 'destructive'
            ? 'bg-destructive/10 text-destructive'
            : 'bg-muted text-muted-foreground',
        )}
      >
        <Icon className="size-5" />
      </div>
      <div className="space-y-1">
        <h3 className="font-medium">{title}</h3>
        {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState(props: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  icon?: LucideIcon;
  className?: string;
}) {
  return <StateBlock icon={props.icon ?? InboxIcon} {...props} />;
}

export function ErrorState({
  title = 'Something went wrong',
  description,
  onRetry,
}: {
  title?: string;
  description?: ReactNode;
  onRetry?: () => void;
}) {
  return (
    <StateBlock
      icon={AlertTriangleIcon}
      tone="destructive"
      title={title}
      description={description ?? 'We could not load this content. Please try again.'}
      action={
        onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Try again
          </Button>
        )
      }
    />
  );
}

export function AccessDenied({
  description,
  backHref = '/tenants',
}: {
  description?: ReactNode;
  backHref?: string;
}) {
  return (
    <StateBlock
      icon={LockIcon}
      title="You don't have access"
      description={
        description ??
        'Your role in this workspace does not allow this action. Ask a workspace administrator if you need access.'
      }
      action={
        <Button variant="outline" size="sm" asChild>
          <Link href={backHref}>Go back</Link>
        </Button>
      }
    />
  );
}
