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

function buildRegistryMetadata(registry, lastScrapedAt) {
  const datasets = [];
  for (const name of Object.keys(registry).sort()) {
    const info = registry[name] || {};
    const fields = new Set(['id', 'name']);
    if (Array.isArray(info.filters)) {
      for (const field of info.filters) fields.add(String(field));
    }
    datasets.push({
      name,
      file: `${name}.json`,
      itemCount: Number(info.count) || 0,
      fields: [...fields].sort(),
    });
  }

  const metadata = {
    source: 'gzw-scraper',
    datasetCount: datasets.length,
    datasets,
  };
  if (lastScrapedAt) metadata.lastScrapedAt = lastScrapedAt;
  return metadata;
}

function buildBasicMetadata(datasets, lastScrapedAt) {
  const datasetList = [];
  for (const name of Object.keys(datasets).filter(key => !key.startsWith('_')).sort()) {
    const raw = datasets[name];
    const items = Array.isArray(raw)
      ? raw
      : raw && typeof raw === 'object'
        ? Object.values(raw).filter(value => value && typeof value === 'object')
        : [];
    const sample = items.find(item => item && typeof item === 'object' && !Array.isArray(item));
    datasetList.push({
      name,
      file: `${name}.json`,
      itemCount: items.length,
      fields: sample ? Object.keys(sample).sort() : [],
    });
  }
  const metadata = {
    source: datasets._metadata?.source || 'gzw-scraper',
    datasetCount: datasetList.length,
    datasets: datasetList,
  };
  if (lastScrapedAt) metadata.lastScrapedAt = lastScrapedAt;
  return metadata;
}

function openApiFieldSchema(field) {
  const types = Array.isArray(field?.types) && field.types.length ? field.types : ['string'];
  const schemas = types.filter(type => type !== 'null').map(type => {
    if (type === 'boolean' || type === 'number' || type === 'integer' || type === 'array' || type === 'object' || type === 'string') {
      return { type };
    }
    return {};
  });
  const schema = schemas.length === 1 ? schemas[0] : { oneOf: schemas };
  if (types.includes('null') || field?.nullable) schema.nullable = true;
  return schema;
}

function buildOpenApiSchemas(metadata) {
  const schemas = {};
  for (const dataset of metadata.datasets) {
    const properties = {};
    const required = [];
    for (const fieldName of Object.keys(dataset.fields || {}).sort()) {
      const field = dataset.fields[fieldName];
      properties[fieldName] = openApiFieldSchema(field);
      if (field && field.optional === false && field.nullable !== true && !field.types?.includes('null')) {
        required.push(fieldName);
      }
    }
    schemas[dataset.name] = {
      type: 'object',
      properties,
      ...(required.length ? { required } : {}),
      additionalProperties: true,
    };
  }
  return schemas;
}

module.exports = {
  buildMetadata,
  buildBasicMetadata,
  buildRegistryMetadata,
  getMetadata,
  getSummaryMetadata,
  getDatasetMetadata,
  getSingleDatasetMetadata,
  buildOpenApiSchemas,
  summarizeMetadata: buildSummaryMetadata,
};
