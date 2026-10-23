import { expect, test } from '@playwright/test';
import { login, USERS } from './helpers';

test.describe('workspace management', () => {
  test('owner sees the dashboard and members list', async ({ page }) => {
    await login(page, USERS.owner);
    await page.goto('/t/acme');
    await expect(page.getByRole('heading', { name: /Welcome to Acme/ })).toBeVisible();
    await expect(page.getByText('Active members')).toBeVisible();

    await page.getByRole('link', { name: 'Members' }).first().click();
    await expect(page.getByText(USERS.admin)).toBeVisible();
    await page.getByLabel('Search members').fill('maya');
    await expect(page.getByText(USERS.manager)).toBeVisible();
    await expect(page.getByText(USERS.admin)).toHaveCount(0);
  });

  test('a manager can invite with a lower role but is refused an admin invitation', async ({
    page,
  }) => {
    await login(page, USERS.manager);
    await page.goto('/t/acme/invitations?new=1');
    await page.getByLabel('Email address').fill(`e2e-${Date.now()}@example.test`);
    await page.getByRole('combobox', { name: 'Role' }).click();
    await page.getByRole('option', { name: 'Admin' }).click();
    await page.getByRole('button', { name: 'Send invitation' }).click();
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText(/cannot grant|owner/i);

    await page.getByRole('combobox', { name: 'Role' }).click();
    await page.getByRole('option', { name: 'Viewer' }).click();
    await page.getByRole('button', { name: 'Send invitation' }).click();
    await expect(page.getByText(/Invitation sent to/)).toBeVisible();
  });

  test('creating a workspace makes the creator its owner', async ({ page }) => {
    await login(page, USERS.member);
    await page.goto('/tenants');
    const slug = `e2e-${Date.now()}`;
    await page.getByLabel('Workspace name').fill('E2E Workspace');
    await page.getByLabel('URL (optional)').fill(slug);
    await page.getByRole('button', { name: 'Create workspace' }).click();
    await expect(page).toHaveURL(`/t/${slug}`);
    await expect(page.getByText('Owner').first()).toBeVisible();
  });

  test('theme can be switched to dark mode', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Change theme' }).click();
    await page.getByRole('menuitem', { name: 'Dark' }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
  });
});
