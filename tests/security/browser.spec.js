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
  await page.goto('/');
  await expect(page.locator('#explorer-body td.mono').first()).toBeVisible();
  await expect(page.locator('#explorer-body .error-message')).toHaveCount(0);
});

test('explorer search updates the table without a full navigation', async ({ page }) => {
  await mockApi(page);
  await page.goto('/');
  await expect(page.locator('#explorer-body tr')).toHaveCount(2);
  await page.locator('#explorer-search').fill('Medical');
  await expect(page.locator('#explorer-body tr')).toHaveCount(1);
  await expect(page.locator('#explorer-body')).toContainText('Medical fixture');
});

test('scraped-looking HTML remains text in explorer cells', async ({ page }) => {
  await mockApi(page, { malicious: true });
  await page.goto('/');
  await expect(page.locator('#explorer-body')).toContainText(payload);
  await expect(page.locator('#explorer-body img')).toHaveCount(0);
  expect(await page.evaluate(() => globalThis.__securityInjected)).toBe(0);
});

test('API failure is displayed safely and the explorer can recover', async ({ page }) => {
  await mockApi(page, { failed: true });
  await page.goto('/');
  await expect(page.locator('#explorer-body .error-message')).toBeVisible();
  await expect(page.locator('#explorer-body img')).toHaveCount(0);
  await page.unroute('**/api/v1/**');
  await mockApi(page);
  await page.locator('#explorer-search').fill('AK');
  await expect(page.locator('#explorer-body')).toContainText('AK fixture');
});

test('playground sends a same-origin API request and renders hostile JSON as text', async ({ page }) => {
  await mockApi(page, { malicious: true });
  await page.goto('/playground/');
  await expect(page.locator('#playground-output')).toContainText('onerror');
  await expect(page.locator('#playground-output img')).toHaveCount(0);
  await page.locator('#playground-endpoint').selectOption('health');
  await page.locator('#playground-run').click();
  await expect(page.locator('#playground-output')).toContainText('"status": "ok"');
  await expect(page.locator('#playground-url')).toHaveText('/api/v1/health');
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

test('mobile explorer and navigation remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApi(page);
  await page.goto('/');
  await page.locator('#dataset-trigger').click();
  await expect(page.locator('#dataset-menu')).toHaveClass(/open/);
  await page.locator('#dataset-menu [data-value="weapons"]').click();
  await expect(page.locator('#explorer-body')).toContainText('AK fixture');
});
