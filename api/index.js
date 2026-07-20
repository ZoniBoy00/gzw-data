// GZW Data API — Vercel serverless function
// Serves all game data with filtering, CORS & rate limiting

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Data root detection ──
const CWD = process.cwd();
const PARENT = join(CWD, '..');
const SELF_DIR = dirname(fileURLToPath(import.meta.url));

function findDataRoot() {
  const candidates = [
    join(SELF_DIR, '..'),
    CWD,
    PARENT,
  ];
  for (const p of candidates) {
    if (existsSync(join(p, 'armor.json'))) return p;
  }
  return CWD;
}

const ROOT = findDataRoot();

// ── Rate limiter ──
const RATE_LIMIT = 100;
const RATE_WINDOW_MS = 60_000;
const rateMap = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const record = rateMap.get(ip);
  if (!record || now - record.windowStart > RATE_WINDOW_MS) {
    rateMap.set(ip, { windowStart: now, count: 1 });
    return { allowed: true, remaining: RATE_LIMIT - 1, reset: now + RATE_WINDOW_MS };
  }
  record.count++;
  if (record.count > RATE_LIMIT) {
    return { allowed: false, remaining: 0, reset: record.windowStart + RATE_WINDOW_MS };
  }
  return { allowed: true, remaining: RATE_LIMIT - record.count, reset: record.windowStart + RATE_WINDOW_MS };
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, rec] of rateMap) {
    if (now - rec.windowStart > RATE_WINDOW_MS * 2) rateMap.delete(ip);
  }
}, 300_000);

// ── Data loaders ──
function loadJSON(name) {
  try {
    return JSON.parse(readFileSync(join(ROOT, name), 'utf-8'));
  } catch { return null; }
}

const DATA = {
  armor: () => loadJSON('armor.json'),
  weapons: () => loadJSON('weapons.json'),
  backpacks: () => loadJSON('backpacks.json'),
  rigs: () => loadJSON('rigs.json'),
  keys: () => loadJSON('keys.json'),
  tasks: () => loadJSON('tasks.json'),
  throwables: () => loadJSON('throwables.json'),
  images: () => loadJSON('images.json'),
};

// ── Helpers ──
const CACHE = 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400';
let _rateInfo = null;

function json(data, status = 200) {
  const r = _rateInfo;
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Cache-Control': CACHE,
  };
  if (r) {
    headers['X-RateLimit-Limit'] = RATE_LIMIT;
    headers['X-RateLimit-Remaining'] = r.remaining;
    headers['X-RateLimit-Reset'] = Math.ceil(r.reset / 1000);
  }
  return new Response(JSON.stringify({
    data,
    count: Array.isArray(data) ? data.length : undefined,
    source: 'GZW Data API',
    timestamp: new Date().toISOString(),
  }, null, 2), { status, headers });
}

// ── Parse URL from Vercel's relative path ──
function parseUrl(rawUrl) {
  const idx = rawUrl.indexOf('?');
  const pathname = idx === -1 ? rawUrl : rawUrl.slice(0, idx);
  const search = idx === -1 ? '' : rawUrl.slice(idx);
  const params = new URLSearchParams(search);
  return { pathname, searchParams: params };
}

// ── OpenAPI spec ──
function openAPI() {
  return {
    openapi: '3.0.3',
    info: {
      title: 'GZW Data API',
      version: '1.0.0',
      description: 'Public REST API for Gray Zone Warfare game data.\n\nData scraped from the GZW Fandom Wiki.\n\n[GitHub Repo](https://github.com/ZoniBoy00/gzw-data)',
      license: { name: 'MIT' },
    },
    servers: [{ url: 'https://gzw-data.vercel.app', description: 'Production' }],
    paths: {
      '/api': { get: { summary: 'API root', responses: { '200': { description: 'API info' } } } },
      '/api/armor': { get: { summary: 'All armor items', parameters: [
        { name: 'type', in: 'query', schema: { type: 'string' } },
        { name: 'material', in: 'query', schema: { type: 'string' } },
        { name: 'nij', in: 'query', schema: { type: 'string' } },
      ], responses: { '200': { description: 'Array' } } } },
      '/api/weapons': { get: { summary: 'All weapons', parameters: [
        { name: 'type', in: 'query', schema: { type: 'string' } },
        { name: 'caliber', in: 'query', schema: { type: 'string' } },
        { name: 'search', in: 'query', schema: { type: 'string' } },
      ], responses: { '200': { description: 'Array' } } } },
      '/api/backpacks': { get: { summary: 'Backpacks & rigs', parameters: [
        { name: 'type', in: 'query', schema: { type: 'string' } },
      ], responses: { '200': { description: 'Object or array' } } } },
      '/api/keys': { get: { summary: 'All keys & keycards', parameters: [
        { name: 'location', in: 'query', schema: { type: 'string' } },
      ], responses: { '200': { description: 'Object' } } } },
      '/api/tasks': { get: { summary: 'All tasks', parameters: [
        { name: 'vendor', in: 'query', schema: { type: 'string' } },
        { name: 'area', in: 'query', schema: { type: 'string' } },
        { name: 'search', in: 'query', schema: { type: 'string' } },
      ], responses: { '200': { description: 'Array' } } } },
      '/api/throwables': { get: { summary: 'Throwables', responses: { '200': { description: 'Array' } } } },
      '/api/images': { get: { summary: 'Image URL lookup', responses: { '200': { description: 'Object' } } } },
      '/api/stats': { get: { summary: 'Statistics', responses: { '200': { description: 'Object' } } } },
      '/api/search': { get: { summary: 'Unified search', parameters: [
        { name: 'q', in: 'query', required: true, schema: { type: 'string' } },
      ], responses: { '200': { description: 'Object' } } } },
    },
  };
}

// ── Request handler ──
export default async function handler(req) {
  try {
    // Parse URL from Vercel's relative path (/api/spec or /api)
    const { pathname, searchParams } = parseUrl(req.url || '/');
    const path = pathname.replace(/^\/api\/?/, '').replace(/\/$/, '') || 'root';

    // CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400' },
      });
    }

    // Rate limit
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'anonymous';
    const rate = checkRateLimit(ip);
    _rateInfo = rate;
    if (!rate.allowed) {
      return json({ error: 'Rate limit exceeded. Try again in 60s.', limit: RATE_LIMIT, windowMs: RATE_WINDOW_MS }, 429);
    }

    // Routes
    if (path === 'spec' || path === 'openapi.json') {
      return new Response(JSON.stringify(openAPI(), null, 2), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': CACHE, 'X-RateLimit-Limit': RATE_LIMIT, 'X-RateLimit-Remaining': rate.remaining, 'X-RateLimit-Reset': Math.ceil(rate.reset / 1000) },
      });
    }

    if (path === 'debug' || path === 'health') {
      return json({ status: 'ok', root: ROOT, cwd: CWD, dataFiles: ['armor.json', 'weapons.json', 'backpacks.json', 'keys.json', 'tasks.json'].map(f => ({ name: f, exists: existsSync(join(ROOT, f)) })) });
    }

    if (path === 'root') {
      const spec = openAPI();
      return json({ name: 'GZW Data API', version: '1.0.0', endpoints: Object.keys(spec.paths).map(p => ({ path: p, summary: spec.paths[p].get.summary })) });
    }

    if (path === 'armor') {
      let d = DATA.armor() || [];
      const t = searchParams.get('type'), m = searchParams.get('material'), n = searchParams.get('nij');
      if (t) d = d.filter(x => x.type?.toLowerCase() === t.toLowerCase());
      if (m) d = d.filter(x => x.material?.toLowerCase() === m.toLowerCase());
      if (n) d = d.filter(x => x.nij === n);
      return json(d);
    }

    if (path === 'weapons') {
      let d = DATA.weapons() || [];
      const t = searchParams.get('type'), c = searchParams.get('caliber'), s = searchParams.get('search');
      if (t) d = d.filter(x => x.type?.toLowerCase() === t.toLowerCase());
      if (c) d = d.filter(x => x.caliber === c);
      if (s) { const q = s.toLowerCase(); d = d.filter(x => x.name.toLowerCase().includes(q) || x.caliber?.includes(q)); }
      return json(d);
    }

    if (path === 'backpacks') {
      const bps = DATA.backpacks() || [], rigs = (DATA.rigs() || []).filter(r => r.weight);
      const t = searchParams.get('type');
      if (t === 'Backpack') return json(bps);
      if (t === 'Tactical Rig') return json(rigs);
      return json({ backpacks: bps, rigs });
    }

    if (path === 'keys') {
      let d = DATA.keys() || [];
      const l = searchParams.get('location');
      if (l) d = d.filter(x => x.location?.toLowerCase() === l.toLowerCase());
      return json({ keys: d, locations: [...new Set((DATA.keys() || []).map(k => k.location))].sort() });
    }

    if (path === 'tasks') {
      let d = DATA.tasks() || [];
      const v = searchParams.get('vendor'), a = searchParams.get('area'), s = searchParams.get('search');
      if (v) d = d.filter(x => x.vendor?.toLowerCase() === v.toLowerCase());
      if (a) d = d.filter(x => x.area?.toLowerCase().includes(a.toLowerCase()));
      if (s) { const q = s.toLowerCase(); d = d.filter(x => x.name?.toLowerCase().includes(q) || x.area?.toLowerCase().includes(q)); }
      return json(d);
    }

    if (path === 'throwables') return json(DATA.throwables() || []);
    if (path === 'images') return json(DATA.images() || {});

    if (path === 'stats') {
      const a = DATA.armor() || [], w = DATA.weapons() || [], b = DATA.backpacks() || [], r = (DATA.rigs() || []).filter(x => x.weight), k = DATA.keys() || [], t = DATA.tasks() || [];
      return json({ armor: { total: a.length, vests: a.filter(x => x.category === 'vests').length, helmets: a.filter(x => x.category === 'helmets').length, plateCarriers: a.filter(x => x.category === 'plate_carriers').length }, weapons: { total: w.length, types: [...new Set(w.map(x => x.type))] }, backpacks: { total: b.length }, rigs: { total: r.length }, keys: { total: k.length, locations: [...new Set(k.map(x => x.location))].sort() }, tasks: { total: t.length, vendors: [...new Set(t.map(x => x.vendor).filter(Boolean))] }, images: { total: Object.keys(DATA.images() || {}).length } });
    }

    if (path === 'search') {
      const q = searchParams.get('q');
      if (!q) return json({ error: 'Missing ?q' }, 400);
      const query = q.toLowerCase();
      return json({ query: q, weapons: (DATA.weapons() || []).filter(x => x.name.toLowerCase().includes(query)), armor: (DATA.armor() || []).filter(x => x.name.toLowerCase().includes(query)), keys: (DATA.keys() || []).filter(x => x.name.toLowerCase().includes(query) || x.location?.toLowerCase().includes(query)), tasks: (DATA.tasks() || []).filter(x => x.name?.toLowerCase().includes(query) || x.area?.toLowerCase().includes(query)) });
    }

    return json({ error: 'Not found', path: `/api/${path}` }, 404);

  } catch (err) {
    // Global error handler — log and return 500
    console.error('[GZW Data API] Error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error', message: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-cache' },
    });
  }
}
