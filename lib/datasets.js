const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const datasets = {};

function loadDatasets() {
  let dataFiles = [];
  try {
    dataFiles = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
    for (const file of dataFiles) {
      const key = file.replace('.json', '');
      try {
        datasets[key] = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf-8'));
      } catch (error) {
        console.error(`Failed to load ${file}:`, error.message);
        datasets[key] = null;
      }
    }
  } catch (error) {
    console.error('Failed to read data directory:', error.message);
  }
  return datasets;
}

function asArray(key) {
  const data = datasets[key];
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') return Object.values(data).filter(value => value && typeof value === 'object');
  return [];
}

function getLastScrapedAt() {
  const value = datasets._metadata?.lastScrapedAt;
  return typeof value === 'string' ? value : null;
}

function buildDatasetRegistry() {
  const registry = {};
  for (const key of Object.keys(datasets)) {
    if (key.startsWith('_')) continue;
    const items = asArray(key);
    if (items.length === 0) continue;

    const sample = items[0] || {};
    const filters = Object.keys(sample).filter(field =>
      !['id', 'name', 'image', '_image', 'description'].includes(field) &&
      typeof sample[field] === 'string'
    );

    registry[key] = {
      count: items.length,
      filters,
      isObject: !Array.isArray(datasets[key]),
    };
  }
  return registry;
}

module.exports = {
  datasets,
  loadDatasets,
  asArray,
  getLastScrapedAt,
  buildDatasetRegistry,
};
