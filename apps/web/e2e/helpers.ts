import { expect, type Page } from '@playwright/test';

/** Seeded by `yarn db:seed` (see apps/api/prisma/seed.ts). Development-only credentials. */
export const SEED_PASSWORD = process.env.SEED_PASSWORD ?? 'ChangeMe-dev-only-1';

export const USERS = {
  owner: 'olivia.owner@acme.test',
  admin: 'adam.admin@acme.test',
  manager: 'maya.manager@acme.test',
  member: 'mike.member@acme.test',
  suspended: 'sam.suspended@acme.test',
  globexOwner: 'grace.owner@globex.test',
  superAdmin: 'superadmin@platform.test',
} as const;

export async function login(page: Page, email: string, next?: string): Promise<void> {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : '/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel(/^Password/).fill(SEED_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}
