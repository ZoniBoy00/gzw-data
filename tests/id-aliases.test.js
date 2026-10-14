const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { resolveIdAlias, validateIdAliases } = require('../lib/id-aliases');

describe('reviewed record ID aliases', () => {
  const records = { weapons: [{ id: 'ak-12', name: 'AK-12' }] };

  it('resolves one legacy ID to an existing canonical ID', () => {
    const registry = {
      schemaVersion: 1,
      datasets: { weapons: { 'ak-12-legacy': 'ak-12' } },
    };

    assert.equal(resolveIdAlias(registry, 'weapons', 'ak-12-legacy'), 'ak-12');
    assert.equal(resolveIdAlias(registry, 'weapons', 'ak-12'), 'ak-12');
  });

  it('rejects alias chains, collisions, and missing canonical records', () => {
    const registry = {
      schemaVersion: 1,
      datasets: { weapons: { 'old-id': 'middle-id', 'middle-id': 'ak-12', 'ak-12': 'missing' } },
    };

    const errors = validateIdAliases(registry, records);
    assert.ok(errors.some(error => error.includes('alias chains are not allowed')));
    assert.ok(errors.some(error => error.includes('collides with a current record ID')));
    assert.ok(errors.some(error => error.includes("canonical record 'middle-id' does not exist")));
    assert.ok(errors.some(error => error.includes("canonical record 'missing' does not exist")));
  });

  it('rejects unknown datasets and malformed alias registries', () => {
    assert.ok(validateIdAliases({ schemaVersion: 1, datasets: { unknown: { old: 'new' } } }, records).length > 0);
    assert.ok(validateIdAliases({ schemaVersion: 2, datasets: [] }, records).length > 0);
  });

  it('does not resolve inherited property names as aliases', () => {
    const registry = { schemaVersion: 1, datasets: { weapons: JSON.parse('{"__proto__":{"toString":"ak-12"}}') } };

    assert.equal(resolveIdAlias(registry, 'weapons', 'toString'), 'toString');
  });
});
