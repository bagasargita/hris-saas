import { CheckIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PLANS } from '@saas/contracts';
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
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Pricing' };

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-20 md:px-6">
      <div className="mx-auto mb-14 max-w-2xl text-center">
        <h1 className="text-4xl font-semibold tracking-tight">Simple, predictable pricing</h1>
        <p className="mt-4 text-muted-foreground">
          Start free and upgrade when your team grows. Every plan includes the full security model.
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {PLANS.map((plan) => {
          const featured = plan.key === 'PRO';
          return (
            <Card
              key={plan.key}
              className={cn(
                'relative',
                featured && 'border-primary shadow-md ring-1 ring-primary/20',
              )}
            >
              {featured && <Badge className="absolute -top-2.5 left-6">Most popular</Badge>}
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="pt-4">
                  {plan.priceMonthlyUsd === null ? (
                    <span className="text-3xl font-semibold">Custom</span>
                  ) : (
                    <>
                      <span className="text-4xl font-semibold">${plan.priceMonthlyUsd}</span>
                      <span className="text-muted-foreground"> / month</span>
                    </>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <ul className="grid gap-2.5 text-sm">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button className="w-full" variant={featured ? 'default' : 'outline'} asChild>
                  <Link href="/register">
                    {plan.priceMonthlyUsd === null ? 'Contact sales' : 'Get started'}
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
      <p className="mt-10 text-center text-xs text-muted-foreground">
        Paid plans are activated by connecting a payment provider. Until one is configured,
        workspaces run on the Free plan.
      </p>
    </div>
  );
}
