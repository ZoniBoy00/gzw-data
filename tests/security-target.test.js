const test = require('node:test');
const assert = require('node:assert/strict');
const { validateTarget } = require('./security/target');

test('security suite defaults to loopback and accepts only this project\'s previews', () => {
  assert.equal(validateTarget().local, true);
  assert.equal(validateTarget('https://gzw-data-ab123cd-zoniboy00s-projects.vercel.app').local, false);
  for (const url of [
    'https://gzw-data.dev', 'https://example.com', 'http://169.254.169.254',
    'https://gzw-data-ab123cd-zoniboy00s-projects.vercel.app.example.com',
    'https://other-project-ab123cd-zoniboy00s-projects.vercel.app',
    'https://gzw-data-ab123cd-zoniboy00s-projects.vercel.app:444',
    'http://user:password@127.0.0.1:4173', 'http://127.0.0.1:4173/?secret=x',
  ]) assert.throws(() => validateTarget(url), undefined, url);
});


test('preview workflow validates deployment payload URLs before accepting any secret', () => {
  const { previewTarget } = require('../scripts/security-preview-target');
  const allowed = 'https://gzw-data-ab123cd-zoniboy00s-projects.vercel.app';
  assert.equal(previewTarget({ deployment_status: { environment_url: allowed } }), allowed);
  assert.equal(previewTarget({}, allowed), allowed);
  for (const value of ['http://127.0.0.1:4173', 'https://gzw-data.dev', 'https://example.com']) {
    assert.throws(() => previewTarget({ deployment_status: { environment_url: value } }));
  }
  assert.throws(() => previewTarget({}));
});


test('preview deployment trust uses a read-only repository lookup and fails closed', async () => {
  const { verifyDeployment } = require('../scripts/security-preview-target');
  const sha = 'a'.repeat(40);
  const options = { repository: 'ZoniBoy00/gzw-data', token: 'fixture-read-token' };
  let called = false;
  await verifyDeployment({ sha }, { ...options, fetchImpl: async (url, init) => {
    called = true;
    assert.equal(url, `https://api.github.com/repos/ZoniBoy00/gzw-data/commits/${sha}/branches-where-head`);
    assert.equal(init.redirect, 'error');
    assert.equal(init.headers.Authorization, 'Bearer fixture-read-token');
    return { ok: true, json: async () => [{ name: 'feature' }] };
  } });
  assert.equal(called, true);
  await assert.rejects(verifyDeployment({ sha }, { ...options, fetchImpl: async () => ({ ok: true, json: async () => [] }) }));
  await assert.rejects(verifyDeployment({ sha }, { ...options, fetchImpl: async () => ({ ok: false }) }));
  await assert.rejects(verifyDeployment({ sha }, { ...options, repository: 'fork/gzw-data' }));
  await assert.rejects(verifyDeployment({ sha: 'bad' }, options));
});
