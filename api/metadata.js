function typeOf(value) {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  return 'string';
}

function stableValueKey(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return JSON.stringify(value, Object.keys(value).sort());
  }
  return JSON.stringify(value);
}

function describeDataset(name, asArray) {
  const items = asArray(name);
  const valuesByField = Object.create(null);
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

function describeDatasetSummary(name, asArray) {
  let items = [];
  try {
    items = asArray(name);
  } catch {
    return { name, file: `${name}.json`, itemCount: 0, fields: [] };
  }
  const fields = new Set();
  for (const item of items) {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      for (const field of Object.keys(item)) fields.add(field);
    }
  }
  return { name, file: `${name}.json`, itemCount: items.length, fields: [...fields].sort() };
}

function datasetNames(datasets) {
  return Object.keys(datasets).filter(name => !name.startsWith('_')).sort();
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
    datasetCount: datasetNames(datasets).length,
    datasets: datasetNames(datasets).map(name => describeDataset(name, asArray)),
  };
  if (lastScrapedAt) metadata.lastScrapedAt = lastScrapedAt;
  return metadata;
}

function buildSummaryMetadata(datasets, asArray, lastScrapedAt) {
  const metadata = {
    source: datasets._metadata?.source || 'gzw-scraper',
    datasetCount: datasetNames(datasets).length,
    datasets: datasetNames(datasets).map(name => describeDatasetSummary(name, asArray)),
  };
  if (lastScrapedAt) metadata.lastScrapedAt = lastScrapedAt;
  return metadata;
}

let metadataCache;
let summaryCache;

function getMetadata(datasets, asArray, lastScrapedAt) {
  if (!metadataCache) metadataCache = buildMetadata(datasets, asArray, lastScrapedAt);
  return metadataCache;
}

function getSummaryMetadata(datasets, asArray, lastScrapedAt) {
  if (!summaryCache) summaryCache = buildSummaryMetadata(datasets, asArray, lastScrapedAt);
  return summaryCache;
}

function getDatasetMetadata(metadata, name) {
  return metadata.datasets.find(dataset => dataset.name === name);
}

function getSingleDatasetMetadata(datasets, asArray, lastScrapedAt, name) {
  const generated = datasets._metadata;
  if (generated && Array.isArray(generated.datasets)) {
    const existing = generated.datasets.find(dataset => dataset.name === name);
    if (existing) return existing;
  }
  if (!Object.prototype.hasOwnProperty.call(datasets, name)) return undefined;
  const dataset = describeDataset(name, asArray);
  return lastScrapedAt ? { ...dataset, lastScrapedAt } : dataset;
}

module.exports = {
  buildMetadata,
  getMetadata,
  getSummaryMetadata,
  getDatasetMetadata,
  getSingleDatasetMetadata,
  summarizeMetadata: buildSummaryMetadata,
};
