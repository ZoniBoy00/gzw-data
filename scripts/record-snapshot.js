const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const METADATA_FILE = path.join(DATA_DIR, '_metadata.json');
const HISTORY_FILE = path.join(DATA_DIR, '_history.json');
const MAX_SNAPSHOTS = 30;

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function countRecords(value) {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === 'object') {
    return Object.values(value).filter(item => item && typeof item === 'object').length;
  }
  return 0;
}

function buildCurrentSnapshot() {
  const metadata = readJson(METADATA_FILE);
  const datasets = {};
  for (const file of fs.readdirSync(DATA_DIR).filter(name => name.endsWith('.json')).sort()) {
    if (file.startsWith('_')) continue;
    const count = countRecords(readJson(path.join(DATA_DIR, file)));
    if (count > 0) datasets[file.slice(0, -5)] = count;
  }
  return {
    version: metadata.lastScrapedAt,
    capturedAt: metadata.lastScrapedAt,
    datasets,
  };
}

const current = buildCurrentSnapshot();
const history = fs.existsSync(HISTORY_FILE) ? readJson(HISTORY_FILE) : [];
if (history.some(snapshot => snapshot.version === current.version)) {
  console.log(`Snapshot ${current.version} already exists; history is immutable.`);
  process.exit(0);
}
const withoutCurrent = history.filter(snapshot => snapshot.version !== current.version);
const next = [current, ...withoutCurrent].slice(0, MAX_SNAPSHOTS);
fs.writeFileSync(HISTORY_FILE, `${JSON.stringify(next, null, 2)}\n`);
console.log(`Recorded snapshot ${current.version}; retained ${next.length} snapshot(s).`);
