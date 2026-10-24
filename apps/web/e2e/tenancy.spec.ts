import { expect, test } from '@playwright/test';
import { login, USERS } from './helpers';

test.describe('tenant isolation and permissions', () => {
  test('a workspace the user does not belong to is indistinguishable from a missing one', async ({
    page,
  }) => {
    await login(page, USERS.owner);
    await page.goto('/t/globex');
    await expect(
      page.getByText('Workspace ini tidak ada atau Anda tidak memiliki akses ke dalamnya.'),
    ).toBeVisible();
    await page.goto('/t/does-not-exist');
    await expect(
      page.getByText('Workspace ini tidak ada atau Anda tidak memiliki akses ke dalamnya.'),
    ).toBeVisible();
  });

  test('the API rejects cross-tenant requests even when called directly from the browser', async ({
    page,
  }) => {
    await login(page, USERS.owner);
    const tenants = await page.request.get('/api/v1/tenants');
    const acmeId = ((await tenants.json()) as { tenant: { id: string; slug: string } }[]).find(
      (m) => m.tenant.slug === 'acme',
    )?.tenant.id;
    expect(acmeId).toBeDefined();

    await page.getByRole('button', { name: 'Menu akun' }).click();
    await page.getByRole('menuitem', { name: 'Keluar' }).click();
    await login(page, USERS.globexOwner);

    const res = await page.request.get(`/api/v1/tenants/${acmeId}/members`, {
      headers: { 'X-Tenant-Id': acmeId ?? '' },
    });
    expect(res.status()).toBe(403);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
      'TENANT_ACCESS_DENIED',
    );
  });

  test('members only see navigation for what their role allows', async ({ page }) => {
    await login(page, USERS.member);
    await page.goto('/t/acme');
    const nav = page.getByRole('navigation', { name: 'Utama' }).first();
    await expect(nav.getByRole('link', { name: 'Anggota' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Peran' })).toHaveCount(0);
    await expect(nav.getByRole('link', { name: 'Log audit' })).toHaveCount(0);

    await page.goto('/t/acme/audit-logs');
    await expect(page.getByText('Anda tidak memiliki akses')).toBeVisible();
  });

  test('a member cannot change roles through the API', async ({ page }) => {
    await login(page, USERS.member);
    const tenants = (await (await page.request.get('/api/v1/tenants')).json()) as {
      tenant: { id: string; slug: string };
    }[];
    const acmeId = tenants.find((m) => m.tenant.slug === 'acme')?.tenant.id ?? '';
    const roles = await page.request.get(`/api/v1/tenants/${acmeId}/roles`);
    expect(roles.status()).toBe(403);
  });

  test('switching workspaces only offers workspaces the user belongs to', async ({ page }) => {
    await login(page, USERS.member);
    await page.goto('/t/acme');
    await page.getByRole('button', { name: 'Ganti ruang kerja' }).first().click();
    const items = page.getByRole('menuitem');
    await expect(items.filter({ hasText: 'Acme' })).toHaveCount(1);
    await expect(items.filter({ hasText: 'Globex' })).toHaveCount(1);
    await items.filter({ hasText: 'Globex' }).click();
    await expect(page).toHaveURL('/t/globex');
  });
});

test.describe('platform administration', () => {
  test('is hidden from tenant owners', async ({ page }) => {
    await login(page, USERS.owner);
    await page.goto('/admin');
    await expect(
      page.getByText('Konsol platform hanya tersedia untuk administrator platform.'),
    ).toBeVisible();
    expect((await page.request.get('/api/v1/platform/tenants')).status()).toBe(403);
  });

  test('is available to super admins', async ({ page }) => {
    await login(page, USERS.superAdmin);
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Tenant' })).toBeVisible();
    await expect(page.getByText('/t/acme')).toBeVisible();
  });
});
