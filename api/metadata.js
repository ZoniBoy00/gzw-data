function typeOf(value) {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  return 'string';
}

function stableValueKey(value) {
  return JSON.stringify(value, Object.keys(value || {}).sort());
}

function describeDataset(name, asArray) {
  const items = asArray(name);
  const valuesByField = {};
  for (const item of items) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    for (const [field, value] of Object.entries(item)) {
      if (!valuesByField[field]) valuesByField[field] = [];
      valuesByField[field].push(value);
    }
  }

  const fields = {};
  for (const field of Object.keys(valuesByField).sort()) {
    const values = valuesByField[field];
    const nonNull = values.filter(value => value !== null);
    const examples = [...nonNull].sort((left, right) => stableValueKey(left).localeCompare(stableValueKey(right)));
    fields[field] = {
      types: [...new Set(values.map(typeOf))].sort(),
      presentCount: values.length,
      optional: values.length < items.length,
      nullable: values.some(value => value === null),
      example: examples.length ? examples[0] : null,
    };
  }

  return { name, file: `${name}.json`, itemCount: items.length, fields };
}

function buildMetadata(datasets, asArray, lastScrapedAt) {
  const generated = datasets._metadata;
  if (generated && Array.isArray(generated.datasets)) {
    return {
      source: generated.source || 'gzw-scraper',
      datasetCount: generated.datasets.length,
      datasets: generated.datasets,
      ...(lastScrapedAt ? { lastScrapedAt } : {}),
    };
  }

  const metadata = {
    source: 'gzw-scraper',
    datasetCount: Object.keys(datasets).filter(name => !name.startsWith('_')).length,
    datasets: Object.keys(datasets)
      .filter(name => !name.startsWith('_'))
      .sort()
      .map(name => describeDataset(name, asArray)),
  };
  if (lastScrapedAt) metadata.lastScrapedAt = lastScrapedAt;
  return metadata;
}

let metadataCache;

function getMetadata(datasets, asArray, lastScrapedAt) {
  if (!metadataCache) metadataCache = buildMetadata(datasets, asArray, lastScrapedAt);
  return metadataCache;
}

function getDatasetMetadata(metadata, name) {
  return metadata.datasets.find(dataset => dataset.name === name);
}

module.exports = { buildMetadata, getMetadata, getDatasetMetadata };
