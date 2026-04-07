import { test, expect } from '@playwright/test';

// Helper to set up API mocks for store admin pages
async function mockStoreAPIs(page) {
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
}

// Helper to mock admin APIs
async function mockAdminAPIs(page) {
  await page.route('**/api/admin/stats', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ totalStores: 3, totalAppointments: 120, totalCalls: 45, totalCustomers: 80 }),
    });
  });

  await page.route('**/api/admin/stores', route => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'store1', name: "Mike's Barber Shop", owner_email: 'mike@shop.com', appointment_count: 50, customer_count: 30, call_count: 20, created_at: '2026-01-15T00:00:00Z' },
          { id: 'store2', name: "Joe's Cuts", owner_email: 'joe@cuts.com', appointment_count: 70, customer_count: 50, call_count: 25, created_at: '2026-02-10T00:00:00Z' },
        ]),
      });
    } else {
      route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ store_id: 'store_new', message: 'Store created.' }) });
    }
  });

  await page.route('**/api/admin/stores/*', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'store1', name: "Mike's Barber Shop", owner_email: 'mike@shop.com',
        phone: '+15551111111', address: '123 Main St', timezone: 'America/New_York',
        services: [{ id: 'svc1', name: 'Haircut', duration_minutes: 30 }],
        barbers: [{ id: 'b1', name: 'Mike' }],
        stats: { appointments: 50, customers: 30, calls: 20 },
      }),
    });
  });
}

// Inject fake Cognito localStorage tokens
function buildFakeToken(overrides = {}) {
  const poolId = 'us-east-1_AntyLz5r2';
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    sub: 'fake-sub-123',
    email: 'test@barbershop.com',
    'custom:store_id': 'store_test123',
    'custom:store_name': "Mike's Barber Shop",
    'cognito:groups': [],
    iss: `https://cognito-idp.us-east-1.amazonaws.com/${poolId}`,
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    token_use: 'id',
    ...overrides,
  }));
  return `${header}.${payload}.fakesig`;
}

async function injectSession(page, tokenOverrides = {}) {
  const clientId = '24sdog41lofq4r17qg5n542rbe';
  const fakeUser = tokenOverrides.email || 'test@barbershop.com';
  const fakeToken = buildFakeToken({ email: fakeUser, ...tokenOverrides });
  const lastAuthUserKey = `CognitoIdentityServiceProvider.${clientId}.LastAuthUser`;
  const idTokenKey = `CognitoIdentityServiceProvider.${clientId}.${fakeUser}.idToken`;
  const accessTokenKey = `CognitoIdentityServiceProvider.${clientId}.${fakeUser}.accessToken`;
  const refreshTokenKey = `CognitoIdentityServiceProvider.${clientId}.${fakeUser}.refreshToken`;

  await page.addInitScript(({ lastAuthUserKey, idTokenKey, accessTokenKey, refreshTokenKey, fakeUser, fakeToken }) => {
    localStorage.setItem(lastAuthUserKey, fakeUser);
    localStorage.setItem(idTokenKey, fakeToken);
    localStorage.setItem(accessTokenKey, fakeToken);
    localStorage.setItem(refreshTokenKey, 'fake-refresh-token');
  }, { lastAuthUserKey, idTokenKey, accessTokenKey, refreshTokenKey, fakeUser, fakeToken });
}

// ─── Store Admin Tests ────────────────────────────────────────────

test.describe('Dashboard (store admin)', () => {
  test.beforeEach(async ({ page }) => {
    await mockStoreAPIs(page);
    await injectSession(page);
  });

  test('renders dashboard with stats', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h2:has-text("Dashboard")')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('5', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('42', { exact: true })).toBeVisible();
    await expect(page.getByText('18', { exact: true })).toBeVisible();
    await expect(page.getByText('30', { exact: true })).toBeVisible();
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

test.describe('Appointments Page (store admin)', () => {
  test.beforeEach(async ({ page }) => {
    await mockStoreAPIs(page);
    await injectSession(page);
  });

  test('renders appointments table', async ({ page }) => {
    await page.goto('/appointments');
    await expect(page.locator('h2:has-text("Appointments")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=John Doe')).toBeVisible();
  });

  test('has filter buttons', async ({ page }) => {
    await page.goto('/appointments');
    await expect(page.locator('button:has-text("upcoming")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button:has-text("confirmed")')).toBeVisible();
  });

  test('opens new appointment modal', async ({ page }) => {
    await page.goto('/appointments');
    await page.click('button:has-text("New Appointment")');
    await expect(page.locator('h3:has-text("New Appointment")')).toBeVisible();
  });
});

test.describe('Call Log Page (store admin)', () => {
  test.beforeEach(async ({ page }) => {
    await mockStoreAPIs(page);
    await injectSession(page);
  });

  test('renders call log and opens transcript', async ({ page }) => {
    await page.goto('/calls');
    await expect(page.locator('h2:has-text("Call Log")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Jane')).toBeVisible();
    await page.click('text=View');
    await expect(page.locator('h3:has-text("Call Transcript")')).toBeVisible();
    await expect(page.locator('text=I want a beard trim')).toBeVisible();
  });
});

test.describe('Services Page (store admin)', () => {
  test.beforeEach(async ({ page }) => {
    await mockStoreAPIs(page);
    await injectSession(page);
  });

  test('renders services and opens add modal', async ({ page }) => {
    await page.goto('/services');
    await expect(page.locator('text=Haircut')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Beard Trim')).toBeVisible();
    await page.click('button:has-text("Add Service")');
    await expect(page.locator('h3:has-text("Add Service")')).toBeVisible();
  });
});

test.describe('Business Hours & Settings (store admin)', () => {
  test.beforeEach(async ({ page }) => {
    await mockStoreAPIs(page);
    await injectSession(page);
  });

  test('renders business hours', async ({ page }) => {
    await page.goto('/hours');
    await expect(page.locator('h2:has-text("Business Hours")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Monday')).toBeVisible();
    await expect(page.locator('button:has-text("Save Changes")')).toBeVisible();
  });

  test('renders settings with integrations', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.locator('h3:has-text("Business Information")')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Google Calendar', { exact: true })).toBeVisible();
    await expect(page.getByText('Twilio SMS', { exact: true })).toBeVisible();
    await expect(page.getByText('Vapi Voice AI', { exact: true })).toBeVisible();
  });
});

test.describe('Navigation (store admin)', () => {
  test.beforeEach(async ({ page }) => {
    await mockStoreAPIs(page);
    await injectSession(page);
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

// ─── Super Admin Tests ────────────────────────────────────────────

test.describe('Admin Dashboard (super admin)', () => {
  test.beforeEach(async ({ page }) => {
    await mockAdminAPIs(page);
    await injectSession(page, {
      email: 'admin@receiver.app',
      'cognito:groups': ['super_admin'],
      'custom:store_id': undefined,
      'custom:store_name': undefined,
    });
  });

  test('renders admin panel with stats', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.locator('text=Receiver Admin')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Super Admin Panel')).toBeVisible();
    await expect(page.getByText('3', { exact: true }).first()).toBeVisible(); // totalStores
  });

  test('shows stores table', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.locator('h2:has-text("Stores")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Mike's Barber Shop")).toBeVisible();
    await expect(page.locator("text=Joe's Cuts")).toBeVisible();
    await expect(page.locator('text=mike@shop.com')).toBeVisible();
  });

  test('has add store button', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.locator('button:has-text("Add Store")')).toBeVisible({ timeout: 10000 });
  });

  test('opens create store modal', async ({ page }) => {
    await page.goto('/admin');
    await page.click('button:has-text("Add Store")');
    await expect(page.locator('h3:has-text("Add New Store")')).toBeVisible();
    await expect(page.locator('input[placeholder="Mike\'s Barber Shop"]')).toBeVisible();
    await expect(page.locator('input[placeholder="owner@barbershop.com"]')).toBeVisible();
  });

  test('opens store detail modal', async ({ page }) => {
    await page.goto('/admin');
    // Click the first Eye icon
    await page.locator('button[title="View details"]').first().click();
    await expect(page.locator("h3:has-text(\"Mike's Barber Shop\")")).toBeVisible({ timeout: 5000 });
  });

  test('has sign out button', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.locator('text=Sign Out')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Role-based routing', () => {
  test('super admin accessing / gets redirected to /admin', async ({ page }) => {
    await mockAdminAPIs(page);
    await injectSession(page, {
      email: 'admin@receiver.app',
      'cognito:groups': ['super_admin'],
      'custom:store_id': undefined,
      'custom:store_name': undefined,
    });
    await page.goto('/');
    await expect(page).toHaveURL(/\/admin/, { timeout: 5000 });
  });

  test('store admin accessing /admin gets redirected to /', async ({ page }) => {
    await mockStoreAPIs(page);
    await injectSession(page);
    await page.goto('/admin');
    // Store admin should not see the admin panel — redirected to / or stayed at /
    await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/$/, { timeout: 5000 });
  });
});
