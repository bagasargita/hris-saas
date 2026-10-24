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
    name: 'Gratis',
    priceMonthlyUsd: 0,
    description: 'Untuk tim kecil yang baru memulai.',
    memberLimit: 5,
    features: ['Hingga 5 anggota', 'Peran bawaan', 'Log audit 30 hari'],
  },
  {
    key: 'PRO',
    name: 'Pro',
    priceMonthlyUsd: 49,
    description: 'Untuk organisasi yang sedang berkembang dan membutuhkan kontrol.',
    memberLimit: 50,
    features: ['Hingga 50 anggota', 'Peran kustom', 'Log audit 1 tahun', 'Dukungan prioritas'],
  },
  {
    key: 'ENTERPRISE',
    name: 'Enterprise',
    priceMonthlyUsd: null,
    description: 'Untuk organisasi dengan kebutuhan keamanan lanjutan.',
    memberLimit: null,
    features: [
      'Anggota tanpa batas',
      'SSO (direncanakan)',
      'Retensi audit tanpa batas',
      'Dukungan khusus',
    ],
  },
];
