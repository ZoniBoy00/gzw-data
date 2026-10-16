const { test } = require('node:test');
const assert = require('node:assert/strict');
const { run, stamp } = require('../scripts/stamp-assets');

test('HTML pages reference CSS/JS with a current content hash', () => {
  assert.deepEqual(run(true), [], 'run "npm run stamp" after changing web/assets');
});

test('stamp adds and replaces versions for relative and absolute asset paths', () => {
  const out = stamp('<link href="/assets/site.css"><script src="../assets/site.js?v=deadbeef"></script><img src="/assets/gzw-data-logo.png">');
  assert.match(out, /href="\/assets\/site\.css\?v=[0-9a-f]{8}"/);
  assert.match(out, /src="\.\.\/assets\/site\.js\?v=[0-9a-f]{8}"/);
  assert.doesNotMatch(out, /deadbeef/);
  assert.match(out, /src="\/assets\/gzw-data-logo\.png"/);
});
