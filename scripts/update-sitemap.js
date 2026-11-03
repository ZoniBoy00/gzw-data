#!/usr/bin/env node
// Refreshes <lastmod> in web/sitemap.xml from each page's last git commit date (file mtime if git is
// unavailable). Run `npm run sitemap`; `--check` fails if any date is stale.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const SITEMAP = path.join(ROOT, 'web', 'sitemap.xml');
const ORIGIN = 'https://gzw-data.dev';
const FILES = {
  '/': 'web/index.html',
  '/privacy-policy/': 'web/legal/privacy-policy/index.html',
  '/terms-of-service/': 'web/legal/terms-of-service/index.html',
};

function sourceFor(pathname) {
  return FILES[pathname] || `web${pathname}index.html`;
}

function lastModified(file) {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cs', '--', file], { cwd: ROOT, encoding: 'utf8' }).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(out)) return out;
  } catch { /* not a git checkout */ }
  return fs.statSync(path.join(ROOT, file)).mtime.toISOString().slice(0, 10);
}

function update(xml) {
  return xml.replace(/<url><loc>([^<]+)<\/loc><lastmod>[^<]*<\/lastmod><\/url>/g, (_match, loc) => {
    const file = sourceFor(loc.slice(ORIGIN.length));
    return `<url><loc>${loc}</loc><lastmod>${lastModified(file)}</lastmod></url>`;
  });
}

if (require.main === module) {
  const before = fs.readFileSync(SITEMAP, 'utf8');
  const after = update(before);
  if (process.argv.includes('--check')) {
    if (before !== after) {
      console.error('Sitemap lastmod dates are stale. Run "npm run sitemap".');
      process.exit(1);
    }
    console.log('Sitemap is current.');
  } else {
    if (before !== after) fs.writeFileSync(SITEMAP, after);
    console.log(before === after ? 'Sitemap already current.' : 'Sitemap updated.');
  }
}

module.exports = { update };
