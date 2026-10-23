'use client';

import { MailIcon, ShieldCheckIcon, UserCheckIcon, UserXIcon, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PageHeader } from '@/components/layout/page-header';
import { ErrorState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/misc';
import { useTenantStats } from '@/lib/api/hooks';
import { useTenant } from './tenant-context';

function StatCard({
  label,
  value,
  icon: Icon,
  href,
}: {
  label: string;
  value: number | undefined;
  icon: LucideIcon;
  href?: string;
}) {
  const body = (
    <Card className="gap-2 py-5 transition-colors hover:border-primary/30">
      <CardHeader className="flex flex-row items-center justify-between px-5">
        <CardDescription>{label}</CardDescription>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="px-5">
        {value === undefined ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <p className="text-3xl font-semibold tabular-nums">{value}</p>
        )}
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

const tooltipStyle = {
  backgroundColor: 'var(--popover)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--popover-foreground)',
  fontSize: 12,
};

export function Dashboard() {
  const { tenant, can, basePath } = useTenant();
  const stats = useTenantStats(tenant.id);
  const data = stats.data;

  return (
    <>
      <PageHeader
        title={`Welcome to ${tenant.name}`}
        description="An overview of your workspace activity and membership."
        actions={
          can('members.invite') && (
            <Button asChild>
              <Link href={`${basePath}/invitations?new=1`}>
                <MailIcon /> Invite people
              </Link>
            </Button>
          )
        }
      />
      {stats.isError ? (
        <ErrorState onRetry={() => void stats.refetch()} />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Active members"
              value={data?.activeMembers}
              icon={UserCheckIcon}
              href={can('members.read') ? `${basePath}/members` : undefined}
            />
            <StatCard label="Suspended" value={data?.suspendedMembers} icon={UserXIcon} />
            <StatCard
              label="Pending invitations"
              value={data?.pendingInvitations}
              icon={MailIcon}
              href={can('members.read') ? `${basePath}/invitations` : undefined}
            />
            <StatCard
              label="Roles"
              value={data?.roles}
              icon={ShieldCheckIcon}
              href={can('roles.read') ? `${basePath}/roles` : undefined}
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>Activity</CardTitle>
                <CardDescription>Audit events over the last 14 days</CardDescription>
              </CardHeader>
              <CardContent className="h-64">
                {data ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.activityByDay} margin={{ left: -20, right: 8 }}>
                      <defs>
                        <linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--border)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(d: string) => d.slice(5)}
                        stroke="var(--muted-foreground)"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        allowDecimals={false}
                        stroke="var(--muted-foreground)"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Area
                        type="monotone"
                        dataKey="count"
                        name="Events"
                        stroke="var(--chart-1)"
                        strokeWidth={2}
                        fill="url(#activityFill)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <Skeleton className="h-full w-full" />
                )}
              </CardContent>
            </Card>
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Members by role</CardTitle>
                <CardDescription>Active members per assigned role</CardDescription>
              </CardHeader>
              <CardContent className="h-64">
                {data ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.membersByRole}
                      layout="vertical"
                      margin={{ left: 8, right: 16 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--border)"
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        allowDecimals={false}
                        stroke="var(--muted-foreground)"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="role"
                        width={80}
                        stroke="var(--muted-foreground)"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--muted)' }} />
                      <Bar
                        dataKey="count"
                        name="Members"
                        fill="var(--chart-2)"
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <Skeleton className="h-full w-full" />
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
