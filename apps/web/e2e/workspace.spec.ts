import { expect, test } from '@playwright/test';
import { login, USERS } from './helpers';

test.describe('workspace management', () => {
  test('owner sees the dashboard and members list', async ({ page }) => {
    await login(page, USERS.owner);
    await page.goto('/t/acme');
    await expect(page.getByRole('heading', { name: /Selamat datang di Acme/ })).toBeVisible();
    await expect(page.getByText('Anggota aktif')).toBeVisible();

    await page.getByRole('link', { name: 'Anggota' }).first().click();
    await expect(page.getByText(USERS.admin)).toBeVisible();
    await page.getByLabel('Cari anggota').fill('maya');
    await expect(page.getByText(USERS.manager)).toBeVisible();
    await expect(page.getByText(USERS.admin)).toHaveCount(0);
  });

  test('a manager can invite with a lower role but is refused an admin invitation', async ({
    page,
  }) => {
    await login(page, USERS.manager);
    await page.goto('/t/acme/invitations?new=1');
    await page.getByLabel('Alamat email').fill(`e2e-${Date.now()}@example.test`);
    await page.getByRole('combobox', { name: 'Peran' }).click();
    await page.getByRole('option', { name: 'Admin' }).click();
    await page.getByRole('button', { name: 'Kirim undangan' }).click();
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText(/cannot grant|owner/i);

    await page.getByRole('combobox', { name: 'Peran' }).click();
    await page.getByRole('option', { name: /Pengamat|Viewer/ }).click();
    await page.getByRole('button', { name: 'Kirim undangan' }).click();
    await expect(page.getByText(/Undangan dikirim ke/)).toBeVisible();
  });

  test('creating a workspace makes the creator its owner', async ({ page }) => {
    await login(page, USERS.member);
    await page.goto('/tenants');
    const slug = `e2e-${Date.now()}`;
    await page.getByLabel('Nama workspace').fill('E2E Workspace');
    await page.getByLabel('URL (opsional)').fill(slug);
    await page.getByRole('button', { name: 'Buat workspace' }).click();
    await expect(page).toHaveURL(`/t/${slug}`);
    await expect(page.getByText(/Pemilik|Owner/).first()).toBeVisible();
  });

  test('theme can be switched to dark mode', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Ubah tema' }).click();
    await page.getByRole('menuitem', { name: 'Gelap' }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
  });
});
