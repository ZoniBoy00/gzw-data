// Only needed on Vercel, where it keeps the function alive until the write finishes. Loaded lazily so tools that
// check out this repo without installing dependencies (for example the client repos' CI) can still load the module.
function keepAlive(promise) {
  try { require('@vercel/functions').waitUntil(promise); } catch { /* not installed or not running on Vercel */ }
}

// Anonymous daily request counters kept in Upstash Redis (Vercel Marketplace). Only aggregate counts per
// endpoint, status code and client label are stored: never IP addresses, full URLs or query strings.
// Without Redis credentials this is a no-op, so local runs and tests are unaffected. Responses served from
// the CDN cache never reach the function, so these numbers are a lower bound of the real traffic.

const OWN_HOSTS = new Set(['gzw-data.dev', 'www.gzw-data.dev', 'gzw-data.vercel.app']);
const FIXED_ROUTES = ['root', 'spec', 'openapi.json', 'version', 'changes', 'health', 'ready', 'stats', 'search', 'images', 'metadata', 'schema'];
const MAX_LABELS_PER_INSTANCE = 200;
const labelsSeen = new Set();

function endpointLabel(route, known) {
  const first = String(route || '').split('/')[0];
  return known.has(first) ? first : 'other';
}

function hostOf(value) {
  try { return new URL(value).hostname.toLowerCase(); } catch { return ''; }
}

// Our own website calls the API too, so it is counted separately from outside use. Origin and Referer can be
// missing or forged, so this is a guide and not proof. Outside callers may identify themselves with X-Client
// (or a normal User-Agent); only a short sanitized product name is kept.
function clientLabel(headers = {}) {
  if (OWN_HOSTS.has(hostOf(headers.origin)) || OWN_HOSTS.has(hostOf(headers.referer))) return 'own-site';
  const raw = String(headers['x-client'] || headers['user-agent'] || '').split(/[\s/;(]/)[0];
  const label = raw.toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 40);
  if (!label) return 'unknown';
  if (!labelsSeen.has(label)) {
    if (labelsSeen.size >= MAX_LABELS_PER_INSTANCE) return 'other-client';
    labelsSeen.add(label);
  }
  return label;
}

function redisConfig(env = process.env) {
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ''), token } : null;
}

function buildCommands({ day, endpoint, status, client }) {
  const key = `usage:${day}`;
  return [
    ['HINCRBY', key, 'total', 1],
    ['HINCRBY', key, `ep:${endpoint}`, 1],
    ['HINCRBY', key, `st:${status}`, 1],
    ['HINCRBY', key, `cl:${client}`, 1],
  ];
}

function recordUsage({ route, status, headers, known }) {
  const config = redisConfig();
  if (!config) return;
  const commands = buildCommands({
    day: new Date().toISOString().slice(0, 10),
    endpoint: endpointLabel(route, known),
    status,
    client: clientLabel(headers),
  });
  const request = fetch(`${config.url}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
    signal: AbortSignal.timeout(2000),
  }).catch(() => {});
  keepAlive(request);
}

module.exports = { FIXED_ROUTES, endpointLabel, clientLabel, redisConfig, buildCommands, recordUsage };
