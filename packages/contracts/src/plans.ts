export const PLAN_KEYS = ['FREE', 'PRO', 'ENTERPRISE'] as const;
export type PlanKey = (typeof PLAN_KEYS)[number];

export interface PlanDefinition {
  key: PlanKey;
  name: string;
  priceMonthlyUsd: number | null;
  description: string;
  memberLimit: number | null;
  features: string[];
}

export const PLANS: readonly PlanDefinition[] = [
  {
    key: 'FREE',
    name: 'Free',
    priceMonthlyUsd: 0,
    description: 'For small teams getting started.',
    memberLimit: 5,
    features: ['Up to 5 members', 'Default roles', '30-day audit log'],
  },
  {
    key: 'PRO',
    name: 'Pro',
    priceMonthlyUsd: 49,
    description: 'For growing organizations that need control.',
    memberLimit: 50,
    features: ['Up to 50 members', 'Custom roles', '1-year audit log', 'Priority support'],
  },
  {
    key: 'ENTERPRISE',
    name: 'Enterprise',
    priceMonthlyUsd: null,
    description: 'For organizations with advanced security needs.',
    memberLimit: null,
    features: [
      'Unlimited members',
      'SSO (planned)',
      'Unlimited audit retention',
      'Dedicated support',
    ],
  },
];
