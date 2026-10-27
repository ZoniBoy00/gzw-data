const fs = require('node:fs');
const { request } = require('@playwright/test');
const { validateTarget } = require('./target');

module.exports = async () => {
  const { baseURL, local } = validateTarget(process.env.SECURITY_BASE_URL);
  fs.mkdirSync('.tmp', { recursive: true });
  fs.writeFileSync('.tmp/security-auth.json', JSON.stringify({ cookies: [], origins: [] }));
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (local) return;
  const context = await request.newContext({ baseURL });
  try {
    // Send the bypass header only once, to a validated project preview, without following redirects.
    if (bypass) {
      const response = await context.get('/', {
        headers: { 'x-vercel-protection-bypass': bypass, 'x-vercel-set-bypass-cookie': 'true' },
        maxRedirects: 0,
        timeout: 15000,
      });
      if (!response.ok()) throw new Error('Preview protection bypass failed');
    }
    const health = await context.get('/api/v1/health', { maxRedirects: 0 });
    if (!health.ok() || !(health.headers()['content-type'] || '').includes('application/json')) {
      throw new Error('Preview health check failed or requires VERCEL_AUTOMATION_BYPASS_SECRET; no tests were skipped');
    }
    await context.storageState({ path: '.tmp/security-auth.json' });
  } finally {
    await context.dispose();
  }
};
