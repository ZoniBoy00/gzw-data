const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeNumericValues } = require('../lib/numeric-values');

describe('numeric value projections', () => {
  it('extracts only unit-bearing values that are unambiguous', () => {
    const record = {
      weight: '3.553 kg',
      fire_rate: '700 RPM',
      accuracy: '2.81 MOA',
      recoil_control: '+16%',
      muzzle_velocity: '970 m/s',
      caliber: '5.45x39mm',
      grid_size: '1x1',
      localized_weight: '3,780 kg',
      capacity: '30',
    };
    const original = JSON.parse(JSON.stringify(record));

    const normalized = normalizeNumericValues(record);

    assert.deepStrictEqual(normalized.numeric_values, {
      weight: { value: 3.553, unit: 'kg' },
      fire_rate: { value: 700, unit: 'rpm' },
      accuracy: { value: 2.81, unit: 'moa' },
      recoil_control: { value: 16, unit: '%' },
      muzzle_velocity: { value: 970, unit: 'm/s' },
    });
    assert.deepStrictEqual(record, original);
    assert.strictEqual(normalized.weight, '3.553 kg');
  });

  it('preserves source-provided numeric values over derived values', () => {
    const normalized = normalizeNumericValues({
      weight: '3.553 kg',
      numeric_values: {
        weight: { value: 3.5, unit: 'kg' },
        capacity: { value: 30, unit: 'rounds' },
      },
    });

    assert.deepStrictEqual(normalized.numeric_values, {
      weight: { value: 3.5, unit: 'kg' },
      capacity: { value: 30, unit: 'rounds' },
    });
  });

  it('does not replace a malformed source-provided numeric_values field', () => {
    const record = { weight: '3.553 kg', numeric_values: 'source text' };

    assert.deepStrictEqual(normalizeNumericValues(record), record);
  });
});
