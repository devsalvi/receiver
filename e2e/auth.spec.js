import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
  });

  test('login page renders correctly', async ({ page }) => {
    await page.goto('/login');

    // Logo and branding
    await expect(page.locator('h1')).toContainText('Receiver');
    await expect(page.locator('text=AI Voice Booking Agent')).toBeVisible();

    // Login form — no registration option
    await expect(page.locator('h2')).toContainText('Sign in');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toContainText('Sign In');
  });

  test('does not show self-registration option', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('text=Create account')).not.toBeVisible();
    await expect(page.locator('text=Sign up')).not.toBeVisible();
  });

  test('shows error on invalid login', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[type="email"]', 'fake@example.com');
    await page.fill('input[type="password"]', 'WrongPass1');
    await page.click('button[type="submit"]');

    await expect(page.locator('.text-red-600')).toBeVisible({ timeout: 10000 });
  });

  test('login form validates required fields', async ({ page }) => {
    await page.goto('/login');
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toHaveAttribute('required', '');
  });

  test('all protected routes redirect to login', async ({ page }) => {
    const routes = ['/', '/appointments', '/calls', '/services', '/hours', '/settings', '/admin'];
    for (const route of routes) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
    }
  });
});
