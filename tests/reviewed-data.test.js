const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const handler = require('../api');
const { datasets } = require('../lib/datasets');

function recordAt(url) {
  let status = 200;
  let body;
  const res = {
    status(code) { status = code; return this; },
    setHeader() {},
    json(value) { body = value; },
    end() {},
  };
  handler({ url, method: 'GET', headers: {}, socket: { remoteAddress: '127.0.0.1' } }, res);
  assert.equal(status, 200);
  return body.data;
}

test('reviewed display-name changes preserve existing public record URLs', () => {
  assert.equal(recordAt('/api/v1/helmets/lshz-1+-black').name, 'LShZ 1+');
  for (const dataset of ['vices', 'loot_items']) {
    assert.equal(recordAt(`/api/v1/${dataset}/hyperborea-cigarettes`).name, 'Noir Mist Cigarettes');
  }
});

test('the published Ibalin summary agrees with the current duration', () => {
  const record = recordAt('/api/v1/medical/ibalin');
  assert.ok(record.effect.includes(`duration: ${record.duration}`));
  assert.ok(!record.effect.includes('150s'));
});

test('liquid capacities are not published as squared hydration totals', () => {
  for (const id of ['riminda-green-bubbly-bliss', 'sunrise-cola-(2-l)', 'white-orchid-crystal-water-2-l']) {
    const record = datasets.provisions.find(item => item.id === id);
    assert.ok(record);
    assert.ok(!Object.hasOwn(record, 'total_hydration_per_grid'));
  }
});

test('manifest checksums identify the dataset bytes shipped in this snapshot', () => {
  for (const entry of Object.values(datasets._manifest.datasets)) {
    const bytes = fs.readFileSync(path.join(__dirname, '..', 'data', entry.file));
    // Git checkouts on Windows may use CRLF; published repository blobs use LF.
    const digest = crypto.createHash('sha256').update(bytes.toString('utf8').replace(/\r\n/g, '\n')).digest('hex');
    assert.equal(digest, entry.sha256, entry.file);
  }
});
