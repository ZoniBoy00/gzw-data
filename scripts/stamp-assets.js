#!/usr/bin/env node
// Appends a content hash (?v=...) to local CSS/JS references in the web pages so browsers and the CDN
// never serve a new page with stale cached assets. Run `npm run stamp`; `--check` fails if stamps are stale.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const WEB = path.join(__dirname, '..', 'web');
const ASSET_RE = /((?:src|href)=")((?:\.\.\/)*\/?assets\/([\w.-]+\.(?:css|js)))(?:\?v=[0-9a-f]+)?(")/g;

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.name.endsWith('.html') ? [full] : [];
  });
}

function hashOf(file) {
  const normalized = fs.readFileSync(path.join(WEB, 'assets', file), 'utf8').replace(/\r\n/g, '\n');
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 8);
}

function stamp(html) {
  return html.replace(ASSET_RE, (_match, open, ref, file, close) => `${open}${ref}?v=${hashOf(file)}${close}`);
}

function run(check) {
  const stale = [];
  for (const file of [...walk(WEB), path.join(__dirname, '..', '404.html')]) {
    const before = fs.readFileSync(file, 'utf8');
    const after = stamp(before);
    if (before === after) continue;
    stale.push(path.relative(path.join(__dirname, '..'), file));
    if (!check) fs.writeFileSync(file, after);
  }
  return stale;
}

if (require.main === module) {
  const check = process.argv.includes('--check');
  const changed = run(check);
  if (check && changed.length) {
    console.error(`Stale asset stamps in: ${changed.join(', ')}. Run "npm run stamp".`);
    process.exit(1);
  }
  console.log(check ? 'Asset stamps are current.' : `Stamped ${changed.length} page(s).`);
}

module.exports = { stamp, run };
