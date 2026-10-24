'use client';

import { CheckIcon, InfoIcon } from 'lucide-react';
import { PLANS } from '@saas/contracts';
import { PageHeader } from '@/components/layout/page-header';
import { AccessDenied, ErrorState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/misc';
import { useBilling } from '@/lib/api/hooks';
import { cn } from '@/lib/utils';
import { useTenant } from './tenant-context';

/**
 * Billing boundary. Plan and usage come from the API; plan changes require a payment provider,
 * which is not configured in this codebase. The UI says so instead of simulating a purchase.
 */
export function BillingPage() {
  const { tenant, can } = useTenant();
  const billing = useBilling(tenant.id);

  if (!can('billing.read')) return <AccessDenied />;

  return (
    <>
      <PageHeader title="Tagihan" description="Paket dan penggunaan Anda." />
      {billing.isError ? (
        <ErrorState onRetry={() => void billing.refetch()} />
      ) : billing.isPending ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="grid gap-6">
          {!billing.data.providerConfigured && (
            <div
              role="status"
              className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm"
            >
              <InfoIcon className="mt-0.5 size-4 shrink-0 text-primary" />
              <p>
                Perubahan paket online belum tersedia karena tidak ada penyedia pembayaran yang
                terhubung ke deployment ini. Hubungi dukungan untuk mengubah paket.
              </p>
            </div>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Penggunaan</CardTitle>
              <CardDescription>Anggota aktif pada paket saat ini</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold tabular-nums">
                {billing.data.memberCount}
                <span className="text-base font-normal text-muted-foreground">
                  {' '}
                  / {billing.data.memberLimit ?? 'tak terbatas'}
                </span>
              </p>
              {billing.data.memberLimit !== null && (
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{
                      width: `${Math.min(100, (billing.data.memberCount / billing.data.memberLimit) * 100)}%`,
                    }}
                  />
                </div>
              )}
            </CardContent>
          </Card>
          <div className="grid gap-4 md:grid-cols-3">
            {PLANS.map((plan) => {
              const current = plan.key === billing.data.plan;
              return (
                <Card
                  key={plan.key}
                  className={cn(current && 'border-primary ring-1 ring-primary/20')}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {plan.name} {current && <Badge>Saat ini</Badge>}
                    </CardTitle>
                    <CardDescription>
                      {plan.priceMonthlyUsd === null
                        ? 'Harga kustom'
                        : `$${plan.priceMonthlyUsd} / bulan`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <ul className="grid gap-2 text-sm">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex gap-2">
                          <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" /> {feature}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  <CardFooter>
                    <Button
                      className="w-full"
                      variant="outline"
                      disabled={
                        current || !billing.data.providerConfigured || !can('billing.manage')
                      }
                      title={
                        !billing.data.providerConfigured
                          ? 'Penyedia pembayaran belum dikonfigurasi'
                          : undefined
                      }
                    >
                      {current ? 'Paket saat ini' : `Beralih ke ${plan.name}`}
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
