import { test, expect } from '@playwright/test';

// These tests mock the auth state by injecting Cognito tokens into localStorage
// to test the authenticated dashboard experience.

// Helper to mock a logged-in session
async function mockAuth(page) {
  // We'll bypass Cognito by directly testing the UI components render
  // by intercepting API calls and returning mock data
  await page.route('**/api/business/stats', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        todayAppointments: 5,
        totalAppointments: 42,
        totalCalls: 18,
        totalCustomers: 30,
        recentCalls: [
          { id: 'call1', customer_phone: '+15551234567', status: 'completed', duration_seconds: 120, summary: 'Booked haircut', started_at: new Date().toISOString() },
        ],
        upcomingAppointments: [
          { id: 'apt1', customer_name: 'John', service_name: 'Haircut', start_time: new Date(Date.now() + 86400000).toISOString(), barber_name: 'Mike' },
        ],
      }),
    });
  });

  await page.route('**/api/appointments*', route => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          appointments: [
            {
              id: 'apt1', customer_name: 'John Doe', customer_phone: '+15551234567',
              service_name: 'Haircut', barber_name: 'Mike', status: 'confirmed',
              start_time: new Date(Date.now() + 86400000).toISOString(),
              end_time: new Date(Date.now() + 86400000 + 1800000).toISOString(),
            },
          ],
          total: 1,
        }),
      });
    } else {
      route.fulfill({ status: 201, contentType: 'application/json', body: '{}' });
    }
  });

  await page.route('**/api/services', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 'svc1', name: 'Haircut', duration_minutes: 30, price_cents: 3000, active: 1 },
        { id: 'svc2', name: 'Beard Trim', duration_minutes: 15, price_cents: 1500, active: 1 },
      ]),
    });
  });

  await page.route('**/api/barbers', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 'barber1', name: 'Any Available', active: 1 },
        { id: 'barber2', name: 'Mike', active: 1 },
      ]),
    });
  });

  await page.route('**/api/calls*', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        calls: [
          {
            id: 'call1', customer_name: 'Jane', customer_phone: '+15559876543',
            status: 'completed', duration_seconds: 95, summary: 'Booked beard trim',
            transcript: 'AI: Hi! How can I help?\nCaller: I want a beard trim.\nAI: Sure, when works for you?',
            started_at: new Date().toISOString(),
          },
        ],
        total: 1,
      }),
    });
  });

  await page.route('**/api/business', route => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'store1', name: "Mike's Barber Shop", phone: '+15551111111',
          address: '123 Main St', timezone: 'America/New_York',
          greeting_message: "Hi, this is {shop_name}. I'm an AI assistant.",
          hours: [
            { day_of_week: 0, open_time: '09:00', close_time: '17:00', is_closed: 1 },
            { day_of_week: 1, open_time: '09:00', close_time: '19:00', is_closed: 0 },
            { day_of_week: 2, open_time: '09:00', close_time: '19:00', is_closed: 0 },
            { day_of_week: 3, open_time: '09:00', close_time: '19:00', is_closed: 0 },
            { day_of_week: 4, open_time: '09:00', close_time: '19:00', is_closed: 0 },
            { day_of_week: 5, open_time: '09:00', close_time: '19:00', is_closed: 0 },
            { day_of_week: 6, open_time: '09:00', close_time: '17:00', is_closed: 0 },
          ],
        }),
      });
    } else {
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    }
  });

  await page.route('**/api/business/hours', route => {
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  await page.route('**/api/auth/google/status', route => {
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"connected": false}' });
  });

  // Mock Cognito session in localStorage
  const poolId = 'us-east-1_AntyLz5r2';
  const clientId = '24sdog41lofq4r17qg5n542rbe';
  const fakeUser = 'test@barbershop.com';
  const lastAuthUserKey = `CognitoIdentityServiceProvider.${clientId}.LastAuthUser`;
  const idTokenKey = `CognitoIdentityServiceProvider.${clientId}.${fakeUser}.idToken`;
  const accessTokenKey = `CognitoIdentityServiceProvider.${clientId}.${fakeUser}.accessToken`;
  const refreshTokenKey = `CognitoIdentityServiceProvider.${clientId}.${fakeUser}.refreshToken`;

  // Create a fake JWT (won't verify but enough for the frontend to parse)
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    sub: 'fake-sub-123',
    email: fakeUser,
    'custom:store_id': 'store_test123',
    'custom:store_name': "Mike's Barber Shop",
    iss: `https://cognito-idp.us-east-1.amazonaws.com/${poolId}`,
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    token_use: 'id',
  }));
  const fakeToken = `${header}.${payload}.fakesig`;

  await page.addInitScript(({ lastAuthUserKey, idTokenKey, accessTokenKey, refreshTokenKey, fakeUser, fakeToken }) => {
    localStorage.setItem(lastAuthUserKey, fakeUser);
    localStorage.setItem(idTokenKey, fakeToken);
    localStorage.setItem(accessTokenKey, fakeToken);
    localStorage.setItem(refreshTokenKey, 'fake-refresh-token');
  }, { lastAuthUserKey, idTokenKey, accessTokenKey, refreshTokenKey, fakeUser, fakeToken });
}

test.describe('Dashboard (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
  });

  test('renders dashboard with stats', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h2:has-text("Dashboard")')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('5', { exact: true }).first()).toBeVisible(); // todayAppointments
    await expect(page.getByText('42', { exact: true })).toBeVisible(); // totalAppointments
    await expect(page.getByText('18', { exact: true })).toBeVisible(); // totalCalls
    await expect(page.getByText('30', { exact: true })).toBeVisible(); // totalCustomers
  });

  test('shows upcoming appointments on dashboard', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=John')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Haircut', { exact: true }).first()).toBeVisible();
  });

  test('shows recent calls on dashboard', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=+15551234567')).toBeVisible({ timeout: 10000 });
  });

  test('sidebar shows store name', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator("text=Mike's Barber Shop")).toBeVisible({ timeout: 10000 });
  });

  test('sidebar shows agent active indicator', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Agent Active')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Appointments Page (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
  });

  test('renders appointments table', async ({ page }) => {
    await page.goto('/appointments');
    await expect(page.locator('h2:has-text("Appointments")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=John Doe')).toBeVisible();
    await expect(page.locator('text=Haircut')).toBeVisible();
  });

  test('has filter buttons', async ({ page }) => {
    await page.goto('/appointments');
    await expect(page.locator('button:has-text("upcoming")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button:has-text("confirmed")')).toBeVisible();
    await expect(page.locator('button:has-text("cancelled")')).toBeVisible();
  });

  test('has new appointment button', async ({ page }) => {
    await page.goto('/appointments');
    await expect(page.locator('button:has-text("New Appointment")')).toBeVisible({ timeout: 10000 });
  });

  test('opens new appointment modal', async ({ page }) => {
    await page.goto('/appointments');
    await page.click('button:has-text("New Appointment")');
    await expect(page.locator('h3:has-text("New Appointment")')).toBeVisible();
    await expect(page.locator('input[placeholder="+1234567890"]')).toBeVisible();
  });
});

test.describe('Call Log Page (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
  });

  test('renders call log table', async ({ page }) => {
    await page.goto('/calls');
    await expect(page.locator('h2:has-text("Call Log")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Jane')).toBeVisible();
    await expect(page.locator('text=completed')).toBeVisible();
  });

  test('can open transcript modal', async ({ page }) => {
    await page.goto('/calls');
    await page.click('text=View');
    await expect(page.locator('h3:has-text("Call Transcript")')).toBeVisible();
    await expect(page.locator('text=I want a beard trim')).toBeVisible();
  });
});

test.describe('Services Page (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
  });

  test('renders services', async ({ page }) => {
    await page.goto('/services');
    await expect(page.locator('h2:has-text("Services")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Haircut')).toBeVisible();
    await expect(page.locator('text=Beard Trim')).toBeVisible();
    await expect(page.locator('text=30 min')).toBeVisible();
  });

  test('has add service button', async ({ page }) => {
    await page.goto('/services');
    await expect(page.locator('button:has-text("Add Service")')).toBeVisible({ timeout: 10000 });
  });

  test('opens add service modal', async ({ page }) => {
    await page.goto('/services');
    await page.click('button:has-text("Add Service")');
    await expect(page.locator('h3:has-text("Add Service")')).toBeVisible();
    await expect(page.locator('input[placeholder="e.g. Haircut"]')).toBeVisible();
  });
});

test.describe('Business Hours Page (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
  });

  test('renders business hours', async ({ page }) => {
    await page.goto('/hours');
    await expect(page.locator('h2:has-text("Business Hours")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Monday')).toBeVisible();
    await expect(page.locator('text=Sunday')).toBeVisible();
    await expect(page.locator('text=Saturday')).toBeVisible();
  });

  test('has save button', async ({ page }) => {
    await page.goto('/hours');
    await expect(page.locator('button:has-text("Save Changes")')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Settings Page (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
  });

  test('renders settings with business info', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.locator('h2:has-text("Settings")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('h3:has-text("Business Information")')).toBeVisible();
    await expect(page.locator('h3:has-text("AI Agent Greeting")')).toBeVisible();
    await expect(page.locator('h3:has-text("Integrations")')).toBeVisible();
  });

  test('shows integration statuses', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByText('Google Calendar', { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Twilio SMS', { exact: true })).toBeVisible();
    await expect(page.getByText('Vapi Voice AI', { exact: true })).toBeVisible();
  });
});

test.describe('Navigation (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
  });

  test('sidebar navigation works for all pages', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h2:has-text("Dashboard")')).toBeVisible({ timeout: 10000 });

    await page.click('nav >> text=Appointments');
    await expect(page.locator('h2:has-text("Appointments")')).toBeVisible({ timeout: 5000 });

    await page.click('nav >> text=Call Log');
    await expect(page.locator('h2:has-text("Call Log")')).toBeVisible({ timeout: 5000 });

    await page.click('nav >> text=Services');
    await expect(page.locator('h2:has-text("Services")')).toBeVisible({ timeout: 5000 });

    await page.click('nav >> text=Hours');
    await expect(page.locator('h2:has-text("Business Hours")')).toBeVisible({ timeout: 5000 });

    await page.click('nav >> text=Settings');
    await expect(page.locator('h2:has-text("Settings")')).toBeVisible({ timeout: 5000 });

    await page.click('nav >> text=Dashboard');
    await expect(page.locator('h2:has-text("Dashboard")')).toBeVisible({ timeout: 5000 });
  });
});
