const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const docsPages = [
  { route: '/docs/', canonical: 'https://gzw-data.dev/docs/', file: 'web/docs/index.html' },
  { route: '/docs/sdk/', canonical: 'https://gzw-data.dev/docs/sdk/', file: 'web/docs/sdk/index.html' },
  { route: '/docs/python/', canonical: 'https://gzw-data.dev/docs/python/', file: 'web/docs/python/index.html' },
  { route: '/docs/examples/', canonical: 'https://gzw-data.dev/docs/examples/', file: 'web/docs/examples/index.html' },
];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('developer documentation pages are routed, canonical, and discoverable', () => {
  const config = JSON.parse(read('vercel.json'));
  const sitemap = read('web/sitemap.xml');
  const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  const llms = read('web/llms.txt');

  for (const page of docsPages) {
    const html = read(page.file);
    assert.ok(fs.existsSync(path.join(root, page.file)), `missing page ${page.file}`);
    assert.ok(config.rewrites.some((rule) => rule.source === page.route && rule.destination === `/${page.file}`), `missing route ${page.route}`);
    assert.ok(config.redirects.some((rule) => rule.destination === page.route && rule.permanent), `missing canonical redirect to ${page.route}`);
    assert.ok(html.includes(`<link rel="canonical" href="${page.canonical}">`), `missing canonical tag ${page.canonical}`);
    assert.equal(sitemapUrls.filter((url) => url === page.canonical).length, 1, `sitemap must list ${page.canonical} once`);

    const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
    for (const match of html.matchAll(/data-copy-target="([^"]+)"/g)) {
      assert.ok(ids.has(match[1]), `${page.route} copy button targets missing #${match[1]}`);
    }
  }

  assert.ok(llms.includes('https://gzw-data.dev/docs/sdk/'));
  assert.ok(llms.includes('https://gzw-data.dev/docs/python/'));
  assert.ok(llms.includes('https://gzw-data.dev/docs/examples/'));
});

test('SDK documentation explains live registry versus static autocomplete', () => {
  const sdk = read('web/docs/sdk/index.html');
  const apiReference = read('web/docs/index.html');
  const examples = read('web/docs/examples/index.html');
  const agents = JSON.parse(read('web/agents.json'));
  const pricing = JSON.parse(read('web/pricing.json'));

  assert.match(sdk, /gzw\.metadata\(\)/);
  assert.match(sdk, /autocomplete list is only a snapshot/i);
  assert.match(sdk, /without an npm update/i);
  assert.match(sdk, /@zoniboy\/gzw-data-client/);
  assert.match(apiReference, /href="\/docs\/sdk\/"/);
  assert.match(examples, /id="sdk"/);
  assert.equal(agents.sdk_documentation, 'https://gzw-data.dev/docs/sdk/');
  assert.equal(pricing.support.sdk_documentation, 'https://gzw-data.dev/docs/sdk/');
});

test('pages with auto-updating package versions load the script and the CSP allows both registries', () => {
  const csp = JSON.parse(read('vercel.json')).headers
    .flatMap((rule) => rule.headers)
    .find((header) => header.key === 'Content-Security-Policy').value;
  const connectSrc = csp.split(';').map((part) => part.trim()).find((part) => part.startsWith('connect-src'));
  const script = read('web/assets/versions.js');

  for (const origin of ['https://registry.npmjs.org', 'https://pypi.org']) {
    assert.ok(connectSrc.split(' ').includes(origin), `CSP connect-src must allow ${origin}`);
    assert.ok(script.includes(origin), `versions.js should fetch from ${origin}`);
  }

  let pagesWithVersions = 0;
  for (const page of docsPages) {
    const html = read(page.file);
    const registries = [...html.matchAll(/data-pkg-version="([^"]+)"/g)].map((match) => match[1]);
    if (registries.length === 0) continue;
    pagesWithVersions += 1;
    assert.ok(registries.every((registry) => ['npm', 'pypi'].includes(registry)), `${page.file} uses an unknown registry`);
    assert.match(html, /<script src="\/assets\/versions\.js\?v=[0-9a-f]{8}" type="module"><\/script>/, `${page.file} must load versions.js`);
    for (const match of html.matchAll(/<[a-z]+ [^>]*data-pkg-version="[^"]+"[^>]*>([^<]*)</g)) {
      assert.match(match[1], /^\d+\.\d+\.\d+$/, `${page.file} needs a static fallback version`);
    }
  }
  assert.equal(pagesWithVersions, 3);
});
