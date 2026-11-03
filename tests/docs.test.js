const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const ORIGIN = 'https://gzw-data.dev';
const sitePages = [
  '/', '/docs/', '/datasets/', '/querying/', '/records/', '/responses/', '/limits/', '/docs/examples/', '/clients/',
  '/docs/sdk/', '/docs/python/', '/playground/', '/explorer/', '/status/', '/data-sources/', '/feedback/',
  '/privacy-policy/', '/terms-of-service/',
].map(route => ({ route, canonical: `${ORIGIN}${route}`, file: `web${route}index.html` }));
const docsPages = sitePages.filter(page => ['/docs/', '/docs/sdk/', '/docs/python/', '/docs/examples/'].includes(page.route));

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('every site page is routed, canonical, indexable and listed once in the sitemap', () => {
  const config = JSON.parse(read('vercel.json'));
  const sitemap = read('web/sitemap.xml');
  const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  const llms = read('web/llms.txt');

  for (const page of sitePages) {
    const html = read(page.file);
    if (page.route !== '/') {
      assert.ok(config.rewrites.some((rule) => rule.source === page.route && rule.destination === `/${page.file}`), `missing route ${page.route}`);
      assert.ok(config.redirects.some((rule) => rule.source === page.route.slice(0, -1) && rule.destination === page.route && rule.permanent), `missing canonical redirect to ${page.route}`);
    }
    assert.ok(html.includes(`<link rel="canonical" href="${page.canonical}">`), `missing canonical tag ${page.canonical}`);
    assert.doesNotMatch(html, /name="robots"/, `${page.route} must be indexable`);
    assert.doesNotMatch(html, /<style\b|\sstyle="/i, `${page.route} must not use inline styles (CSP)`);
    assert.match(html, /<h1[ >]/, `${page.route} needs an h1`);
    assert.equal(sitemapUrls.filter((url) => url === page.canonical).length, 1, `sitemap must list ${page.canonical} once`);
  }
  assert.equal(sitemapUrls.length, sitePages.length, 'sitemap must list only real pages');

  for (const route of ['/docs/sdk/', '/docs/python/', '/docs/examples/', '/datasets/', '/playground/']) {
    assert.ok(llms.includes(`${ORIGIN}${route}`), `llms.txt should link ${route}`);
  }
});

test('the custom 404 page is noindex and loads its suggestion script and index', () => {
  const html = read('404.html');
  assert.match(html, /name="robots" content="noindex"/);
  assert.match(html, /\/assets\/notfound\.js\?v=[0-9a-f]{8}/);
  assert.ok(fs.existsSync(path.join(root, 'web/assets/search-index.json')));
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
  assert.equal(agents.sdk_documentation, `${ORIGIN}/docs/sdk/`);
  assert.equal(agents.terms, `${ORIGIN}/terms-of-service/`);
  assert.equal(pricing.support.sdk_documentation, `${ORIGIN}/docs/sdk/`);
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
  for (const page of sitePages) {
    const html = read(page.file);
    const registries = [...html.matchAll(/data-pkg-version="([^"]+)"/g)].map((match) => match[1]);
    if (registries.length === 0) continue;
    pagesWithVersions += 1;
    assert.ok(registries.every((registry) => ['npm', 'pypi'].includes(registry)), `${page.file} uses an unknown registry`);
    assert.match(html, /<script src="\/assets\/versions\.js\?v=[0-9a-f]{8}" defer><\/script>/, `${page.file} must load versions.js`);
    for (const match of html.matchAll(/<[a-z]+ [^>]*data-pkg-version="[^"]+"[^>]*>([^<]*)</g)) {
      assert.match(match[1], /^\d+\.\d+\.\d+$/, `${page.file} needs a static fallback version`);
    }
  }
  assert.ok(pagesWithVersions >= 3, 'package pages should show live versions');
});

test('generated site files match their sources', () => {
  const { spawnSync } = require('node:child_process');
  const result = spawnSync(process.execPath, [path.join(root, 'scripts', 'build-site.js'), '--check'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || 'run "npm run build:site"');
});
