const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const legalPages = [
  {
    path: '/privacy-policy/',
    file: 'web/legal/privacy-policy/index.html',
    canonical: 'https://gzw-data.dev/privacy-policy/',
  },
  {
    path: '/terms-of-service/',
    file: 'web/legal/terms-of-service/index.html',
    canonical: 'https://gzw-data.dev/terms-of-service/',
  },
];

for (const page of legalPages) {
  test(`${page.path} declares its sitemap URL as the canonical`, () => {
    const html = fs.readFileSync(path.join(root, page.file), 'utf8');
    const sitemap = fs.readFileSync(path.join(root, 'web/sitemap.xml'), 'utf8');

    assert.match(html, new RegExp(`<link\\s+rel=["']canonical["']\\s+href=["']${page.canonical}["']`));
    assert.match(html, /<link\s+rel=["']stylesheet["']\s+href=["']\/assets\/legal\.css(?:\?v=[0-9a-f]+)?["']/);
    assert.doesNotMatch(html, /<style\b/i);
    assert.ok(fs.existsSync(path.join(root, 'web/assets/legal.css')));
    assert.equal(sitemap.split(page.canonical).length - 1, 1);
  });
}

test('non-trailing-slash legal URLs permanently redirect to their canonical paths', () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));

  for (const page of legalPages) {
    assert.ok(config.redirects?.some(redirect => (
      redirect.source === page.path.slice(0, -1)
      && redirect.destination === page.path
      && redirect.permanent === true
    )), `missing permanent redirect for ${page.path}`);
  }
});
