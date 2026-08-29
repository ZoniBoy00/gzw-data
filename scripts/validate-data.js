const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const metadata = JSON.parse(fs.readFileSync(path.join(DATA_DIR, '_metadata.json'), 'utf8'));
const listed = new Map(Array.isArray(metadata.datasets) ? metadata.datasets.map(dataset => [dataset.name, dataset]) : []);
const files = fs.readdirSync(DATA_DIR).filter(file => file.endsWith('.json') && !file.startsWith('_'));
const errors = [];

function countRecords(value) {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === 'object') return Object.values(value).filter(item => item && typeof item === 'object').length;
  return 0;
}

function valueType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

for (const file of files) {
  const name = file.slice(0, -5);
  let value;
  try {
    value = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
  } catch (error) {
    errors.push(`${file}: invalid JSON (${error.message})`);
    continue;
  }
  const entry = listed.get(name);
  if (!entry && Array.isArray(metadata.datasets)) {
    errors.push(`${file}: missing from _metadata.json`);
    continue;
  }
  if (!entry) continue;
  const count = countRecords(value);
  if (Number(entry.itemCount) !== count) errors.push(`${name}: metadata count ${entry.itemCount} != actual count ${count}`);
  const fields = new Map(Object.entries(entry.fields || {}));
  for (const item of Array.isArray(value) ? value : Object.values(value)) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    for (const [field, fieldValue] of Object.entries(item)) {
      const definition = fields.get(field);
      if (!definition) {
        errors.push(`${name}.${field}: missing from metadata fields`);
        continue;
      }
      const declared = definition.types || [];
      if (!declared.includes(valueType(fieldValue))) errors.push(`${name}.${field}: type ${valueType(fieldValue)} not declared`);
    }
  }
}

for (const [name, entry] of listed) {
  if (!fs.existsSync(path.join(DATA_DIR, `${name}.json`))) errors.push(`${name}: listed in metadata but dataset file is missing`);
  if (!entry || typeof entry.itemCount !== 'number') errors.push(`${name}: metadata itemCount is not numeric`);
}

if (errors.length) {
  console.error(`Data drift validation failed (${errors.length} issue(s))`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Data drift validation passed (${files.length} dataset(s)).`);
}
