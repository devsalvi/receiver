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

    // Login form
    await expect(page.locator('h2')).toContainText('Sign in to your store');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toContainText('Sign In');
  });

  test('can switch to registration form', async ({ page }) => {
    await page.goto('/login');

    await page.click('text=Create account');
    await expect(page.locator('h2')).toContainText('Create your store');
    await expect(page.locator('input[placeholder="Mike\'s Barber Shop"]')).toBeVisible();
  });

  test('can switch back to login from registration', async ({ page }) => {
    await page.goto('/login');

    await page.click('text=Create account');
    await expect(page.locator('h2')).toContainText('Create your store');

    await page.click('text=Sign in');
    await expect(page.locator('h2')).toContainText('Sign in to your store');
  });

  test('shows error on invalid login', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[type="email"]', 'fake@example.com');
    await page.fill('input[type="password"]', 'WrongPass1');
    await page.click('button[type="submit"]');

    // Should show error message (Cognito will reject)
    await expect(page.locator('.text-red-600')).toBeVisible({ timeout: 10000 });
  });

  test('login form validates required fields', async ({ page }) => {
    await page.goto('/login');

    // Click submit without filling in fields — browser validation should prevent submission
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toHaveAttribute('required', '');
  });

  test('registration form validates required fields', async ({ page }) => {
    await page.goto('/login');
    await page.click('text=Create account');

    const storeNameInput = page.locator('input[placeholder="Mike\'s Barber Shop"]');
    await expect(storeNameInput).toHaveAttribute('required', '');
  });

  test('all protected routes redirect to login', async ({ page }) => {
    const routes = ['/', '/appointments', '/calls', '/services', '/hours', '/settings'];
    for (const route of routes) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
    }
  });
});
