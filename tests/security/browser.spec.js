const { test: base, expect } = require('@playwright/test');
const payload = '<img src=x onerror="globalThis.__securityInjected=1">';
const rows = [{ id: 'fixture-ak', name: 'AK fixture', type: 'Assault Rifle' }, { id: 'fixture-med', name: 'Medical fixture', type: 'Medical' }];

const test = base.extend({
  page: async ({ page, baseURL }, use) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      globalThis.__securityInjected = 0;
      globalThis.__cspViolations = [];
      globalThis.document.addEventListener('securitypolicyviolation', event => {
        globalThis.__cspViolations.push({ directive: event.effectiveDirective, blocked: event.blockedURI });
      });
    });
    // Disable Vercel's preview-only toolbar using its supported automation header.
    // Keep CSP assertions strict; do not allow the toolbar's external script or ignore violations.
    await page.route('**/*', route => {
      const request = route.request();
      if (request.isNavigationRequest() && new URL(request.url()).origin === new URL(baseURL).origin) {
        return route.continue({ headers: { ...request.headers(), 'x-vercel-skip-toolbar': '1' } });
      }
      return route.continue();
    });
    // Registry calls are deterministic. Do not send preview cookies/headers to external test services.
    await page.route('https://registry.npmjs.org/**', route => route.fulfill({ json: { version: '1.2.3' } }));
    await page.route('https://pypi.org/**', route => route.fulfill({ json: { info: { version: '1.2.3' } } }));
    page.on('response', response => {
      if (response.url().startsWith(`${baseURL}/api/`) && response.status() === 429) errors.push('API rate limit reached');
    });
    await use(page);
    expect(errors, 'uncaught browser exceptions or API throttling').toEqual([]);
    expect(await page.evaluate(() => globalThis.__cspViolations || []), 'CSP violations').toEqual([]);
  },
});

async function mockApi(page, { malicious = false, failed = false } = {}) {
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/v1/weapons') {
      if (failed) return route.fulfill({ status: 503, json: { error: { message: payload } } });
      let items = malicious ? [{ id: payload, name: payload, type: payload }] : rows;
      const query = (url.searchParams.get('search') || '').toLowerCase();
      if (query) items = items.filter(item => item.name.toLowerCase().includes(query));
      return route.fulfill({ json: { data: items, total: items.length, count: items.length, page: 1, perPage: 10 } });
    }
    if (url.pathname === '/api/v1/stats') return route.fulfill({ json: { data: { weapons: { total: 2 }, items: { total: 1 } } } });
    if (url.pathname === '/api/v1/health') return route.fulfill({ json: { data: { ok: true, status: 'ok' } } });
    return route.fulfill({ json: { data: { hasHistory: false, snapshot: { datasets: { weapons: 2 }, capturedAt: '2026-01-01T00:00:00Z' } } } });
  });
}

test('real explorer loads and browser code runs under the deployed CSP', async ({ page }) => {
  await page.goto('/explorer/');
  await expect(page.locator('[data-ex-rows] tr').first()).toBeVisible();
  await expect(page.locator('[data-ex-summary].bad')).toHaveCount(0);
});

test('explorer search updates the table without a full navigation', async ({ page }) => {
  await mockApi(page);
  await page.goto('/explorer/');
  await expect(page.locator('[data-ex-rows] tr')).toHaveCount(2);
  await page.locator('#ex-search').fill('Medical');
  await expect(page.locator('[data-ex-rows] tr')).toHaveCount(1);
  await expect(page.locator('[data-ex-rows]')).toContainText('Medical fixture');
});

test('scraped-looking HTML remains text in explorer cells', async ({ page }) => {
  await mockApi(page, { malicious: true });
  await page.goto('/explorer/');
  await expect(page.locator('[data-ex-rows]')).toContainText(payload);
  await expect(page.locator('[data-ex-rows] img')).toHaveCount(0);
  expect(await page.evaluate(() => globalThis.__securityInjected)).toBe(0);
});

test('API failure is displayed safely and the explorer can recover', async ({ page }) => {
  await mockApi(page, { failed: true });
  await page.goto('/explorer/');
  await expect(page.locator('[data-ex-summary].bad')).toBeVisible();
  await expect(page.locator('[data-ex-rows] img')).toHaveCount(0);
  await page.unroute('**/api/v1/**');
  await mockApi(page);
  await page.locator('#ex-search').fill('AK');
  await expect(page.locator('[data-ex-rows]')).toContainText('AK fixture');
});

test('playground sends a same-origin API request and renders hostile JSON as text', async ({ page }) => {
  await mockApi(page, { malicious: true });
  await page.goto('/playground/');
  await page.locator('[data-pg-run]').click();
  await expect(page.locator('[data-pg-body]')).toContainText('onerror');
  await expect(page.locator('[data-pg-body] img')).toHaveCount(0);
  await page.locator('#pg-endpoint').selectOption('health');
  await page.locator('[data-pg-run]').click();
  await expect(page.locator('[data-pg-body]')).toContainText('"status": "ok"');
  await expect(page.locator('[data-pg-url]')).toContainText('/api/v1/health');
});

test('404 path is rendered as text and navigation remains same-origin', async ({ page, baseURL }) => {
  await mockApi(page);
  const response = await page.goto(`/missing-${encodeURIComponent(payload)}`);
  expect(response.status()).toBe(404);
  await expect(page.locator('#missing-path')).toContainText('/missing-');
  await expect(page.locator('#missing-path img')).toHaveCount(0);
  await page.locator('a[href="/"]').first().click();
  await expect(page).toHaveURL(`${baseURL}/`);
});

test('mobile navigation drawer and explorer remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApi(page);
  await page.goto('/explorer/');
  await page.locator('.menu-btn').click();
  await expect(page.locator('.sidebar')).toHaveClass(/open/);
  await page.locator('.scrim').click({ position: { x: 370, y: 400 } });
  await expect(page.locator('.sidebar')).not.toHaveClass(/open/);
  await expect(page.locator('[data-ex-rows]')).toContainText('AK fixture');
});

for (const width of [860, 1000, 1040, 1041, 1180]) {
  test(`header layout holds at ${width}px without overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await mockApi(page);
    await page.goto('/explorer/');
    await expect(page.locator('[data-ex-rows]')).toContainText('AK fixture');
    const overflow = await page.evaluate(() => globalThis.document.documentElement.scrollWidth - globalThis.document.documentElement.clientWidth);
    expect(overflow, 'horizontal page overflow').toBeLessThanOrEqual(0);
    // Between 861 and 1040px the pill text is visually hidden but must stay in the accessibility tree.
    if (width > 860) {
      const status = page.locator('.status [data-status]');
      await expect(status).toHaveText(/API/);
      expect(await status.evaluate(el => globalThis.getComputedStyle(el).display)).not.toBe('none');
    }
  });
}
