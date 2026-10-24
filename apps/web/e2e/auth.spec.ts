import { expect, test } from '@playwright/test';
import { login, SEED_PASSWORD, USERS } from './helpers';

test.describe('authentication', () => {
  test('redirects anonymous visitors from app pages to login and back after sign-in', async ({
    page,
  }) => {
    await page.goto('/t/acme/members');
    await expect(page).toHaveURL(/\/login\?next=%2Ft%2Facme%2Fmembers/);

    await page.getByLabel('Email').fill(USERS.owner);
    await page.getByLabel(/^Kata sandi/).fill(SEED_PASSWORD);
    await page.getByRole('button', { name: 'Masuk' }).click();
    await expect(page).toHaveURL('/t/acme/members');
    await expect(page.getByRole('heading', { name: 'Anggota' })).toBeVisible();
  });

  test('sets an HttpOnly session cookie that scripts cannot read', async ({ page, context }) => {
    await login(page, USERS.owner);
    const cookies = await context.cookies();
    const sid = cookies.find((c) => c.name.endsWith('sid'));
    expect(sid?.httpOnly).toBe(true);
    expect(sid?.sameSite).toBe('Lax');
    const visible = await page.evaluate(() => document.cookie);
    expect(visible).not.toContain('sid=');
  });

  test('shows one generic error for wrong passwords and unknown accounts', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(USERS.owner);
    await page.getByLabel(/^Kata sandi/).fill('definitely-wrong-1');
    await page.getByRole('button', { name: 'Masuk' }).click();
    const first = await page.getByRole('alert').textContent();

    await page.getByLabel('Email').fill('nobody@nowhere.test');
    await page.getByLabel(/^Kata sandi/).fill('definitely-wrong-1');
    await page.getByRole('button', { name: 'Masuk' }).click();
    await expect(page.getByRole('alert')).toHaveText(first ?? '');
  });

  test('blocks suspended accounts', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(USERS.suspended);
    await page.getByLabel(/^Kata sandi/).fill(SEED_PASSWORD);
    await page.getByRole('button', { name: 'Masuk' }).click();
    await expect(page.getByRole('alert')).toContainText(/suspended/i);
  });

  test('ignores external redirect targets after login', async ({ page }) => {
    await login(page, USERS.owner, 'https://evil.example/steal');
    await expect(page).toHaveURL('/tenants');
  });

  test('logout ends the session on the server', async ({ page }) => {
    await login(page, USERS.owner);
    await page.getByRole('button', { name: 'Menu akun' }).click();
    await page.getByRole('menuitem', { name: 'Keluar' }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto('/tenants');
    await expect(page).toHaveURL(/\/login/);
    const me = await page.request.get('/api/v1/auth/me');
    expect(me.status()).toBe(401);
  });
});
