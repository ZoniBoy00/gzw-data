const NUMERIC_WITH_UNIT = /^\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*(kg|g|lbs?|rpm|moa|m\/s|km\/h|cm|mm|m|%)\s*$/i;

function normalizeNumericValues(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return record;

  const existing = record.numeric_values;
  if (existing !== undefined && existing !== null && (typeof existing !== 'object' || Array.isArray(existing))) {
    return { ...record };
  }

  const parsed = [];
  for (const [field, rawValue] of Object.entries(record)) {
    if (field === 'numeric_values' || typeof rawValue !== 'string') continue;
    const match = rawValue.match(NUMERIC_WITH_UNIT);
    if (!match) continue;
    const value = Number(match[1]);
    if (!Number.isFinite(value)) continue;
    parsed.push([field, { value, unit: match[2].toLowerCase() }]);
  }

  const values = Object.fromEntries([
    ...parsed,
    ...(existing && typeof existing === 'object' ? Object.entries(existing) : []),
  ]);
  if (parsed.length > 0 || (existing && typeof existing === 'object')) {
    return { ...record, numeric_values: values };
  }
  return { ...record };
}

function normalizeDataset(payload) {
  return Array.isArray(payload) ? payload.map(normalizeNumericValues) : payload;
}

module.exports = { normalizeNumericValues, normalizeDataset };
