import {
  ArrowRightIcon,
  Building2Icon,
  KeyRoundIcon,
  ScrollTextIcon,
  ShieldCheckIcon,
  UsersIcon,
  ZapIcon,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const FEATURES = [
  {
    icon: Building2Icon,
    title: 'Multi-workspace by design',
    text: 'Every team gets an isolated workspace. Users can belong to many and switch instantly.',
  },
  {
    icon: ShieldCheckIcon,
    title: 'Fine-grained roles',
    text: 'Owner, admin, manager, member and viewer out of the box, plus custom roles built from explicit permissions.',
  },
  {
    icon: UsersIcon,
    title: 'Invitations that just work',
    text: 'Invite by email with a pre-assigned role. Links are single-use, expire automatically and can be revoked.',
  },
  {
    icon: ScrollTextIcon,
    title: 'Complete audit trail',
    text: 'Sign-ins, role changes, invitations and settings changes are recorded with actor, time and origin.',
  },
  {
    icon: KeyRoundIcon,
    title: 'Session control',
    text: 'See every device signed in to your account and revoke any of them with one click.',
  },
  {
    icon: ZapIcon,
    title: 'Fast everywhere',
    text: 'Server-rendered pages, cached queries and a responsive interface for desktop and mobile.',
  },
];

const SECURITY = [
  'Passwords hashed with Argon2id',
  'HttpOnly, SameSite session cookies with server-side revocation',
  'CSRF protection on every state-changing request',
  'Tenant access verified on the server for every request',
  'Privilege escalation prevention for role and invitation changes',
  'Rate-limited authentication endpoints',
];

export default function LandingPage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,color-mix(in_oklch,var(--primary)_18%,transparent),transparent)]" />
        <div className="mx-auto max-w-6xl px-4 py-24 text-center md:px-6 md:py-32">
          <span className="inline-flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1 text-xs text-muted-foreground">
            <ShieldCheckIcon className="size-3.5 text-primary" /> Built for secure, multi-tenant
            teams
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-balance md:text-6xl">
            The workspace platform your security team will approve
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-pretty text-muted-foreground">
            Workspaces, members, roles, invitations and audit logs — with tenant isolation and
            access control enforced on the server, not just hidden in the UI.
          </p>
          <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/register">
                Start for free <ArrowRightIcon />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/pricing">View pricing</Link>
            </Button>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-4 py-20 md:px-6">
        <div className="mb-12 max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight">
            Everything a B2B product needs on day one
          </h2>
          <p className="mt-3 text-muted-foreground">
            Focus on your product. Accounts, workspaces and permissions are already solved.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <Card key={feature.title} className="gap-3">
              <CardHeader>
                <div className="mb-2 flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <feature.icon className="size-4.5" />
                </div>
                <CardTitle>{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{feature.text}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="security" className="border-y bg-muted/30">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 md:grid-cols-2 md:px-6">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">
              Security is the default, not an add-on
            </h2>
            <p className="mt-3 text-muted-foreground">
              The browser never decides who can see what. Every request is authenticated and
              authorized by the API against your actual membership and role.
            </p>
          </div>
          <ul className="grid gap-3">
            {SECURITY.map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 rounded-lg border bg-background px-4 py-3 text-sm"
              >
                <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-success" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 text-center md:px-6">
        <h2 className="text-3xl font-semibold tracking-tight">Ready to bring your team?</h2>
        <p className="mt-3 text-muted-foreground">
          Create a workspace in under a minute. No credit card required.
        </p>
        <Button size="lg" className="mt-8" asChild>
          <Link href="/register">Create your workspace</Link>
        </Button>
      </section>
    </>
  );
}
