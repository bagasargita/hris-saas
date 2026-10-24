import { Skeleton } from '@/components/ui/misc';

export default function TenantLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Memuat">
      <Skeleton className="h-8 w-56" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}
