// GZW Data API — Vercel serverless function
// Serves all game data with filtering, CORS & rate limiting

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), '..');

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

// Clean stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, rec] of rateMap) {
    if (now - rec.windowStart > RATE_WINDOW_MS * 2) rateMap.delete(ip);
  }
}, 300_000);

// ── Data loaders ──
function loadJSON(name) {
  try {
    const p = join(ROOT, name);
    return JSON.parse(readFileSync(p, 'utf-8'));
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
  const body = JSON.stringify({
    data,
    count: Array.isArray(data) ? data.length : undefined,
    source: 'GZW Data API',
    timestamp: new Date().toISOString(),
  }, null, 2);
  return new Response(body, { status, headers });
}

function jsonHeaders(extra = {}) {
  const r = _rateInfo;
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': CACHE,
    'X-RateLimit-Limit': RATE_LIMIT,
    'X-RateLimit-Remaining': r ? r.remaining : RATE_LIMIT,
    'X-RateLimit-Reset': r ? Math.ceil(r.reset / 1000) : Math.ceil((Date.now() + RATE_WINDOW_MS) / 1000),
    ...extra,
  };
}

// ── OpenAPI spec ──
function openAPI() {
  return {
    openapi: '3.0.3',
    info: {
      title: 'GZW Data API',
      version: '1.0.0',
      description: 'Public REST API for [Gray Zone Warfare](https://grayzonewarfare.com) game data.\n\nData scraped from the [GZW Fandom Wiki](https://gray-zone-warfare.fandom.com).\n\n📦 [GitHub Repo](https://github.com/ZoniBoy00/gzw-data)',
      license: { name: 'MIT' },
    },
    servers: [
      { url: 'https://gzw-data.vercel.app', description: 'Production' },
      { url: 'http://localhost:3000', description: 'Local dev' },
    ],
    paths: {
      '/api': { get: { summary: 'API root', description: 'Returns API metadata and available endpoints.', responses: { '200': { description: 'API info' } } } },
      '/api/armor': { get: { summary: 'All armor items', description: 'Returns 61 armor items with NIJ class, material, weight, source.', parameters: [
        { name: 'type', in: 'query', schema: { type: 'string' }, description: 'Filter by type' },
        { name: 'material', in: 'query', schema: { type: 'string' }, description: 'Filter by material' },
        { name: 'nij', in: 'query', schema: { type: 'string' }, description: 'Filter by NIJ class' },
      ], responses: { '200': { description: 'Array of armor items' } } } },
      '/api/weapons': { get: { summary: 'All weapons', description: 'Returns 51 weapons with type, caliber, mag size, source.', parameters: [
        { name: 'type', in: 'query', schema: { type: 'string' }, description: 'Filter by type' },
        { name: 'caliber', in: 'query', schema: { type: 'string' }, description: 'Filter by caliber' },
        { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Text search' },
      ], responses: { '200': { description: 'Array of weapon items' } } } },
      '/api/backpacks': { get: { summary: 'Backpacks & rigs', description: 'Returns 16 backpacks and 11 tactical rigs.', parameters: [
        { name: 'type', in: 'query', schema: { type: 'string' }, description: 'Backpack or Tactical Rig' },
      ], responses: { '200': { description: 'Object or array' } } } },
      '/api/keys': { get: { summary: 'All keys & keycards', description: '124 keys across 12 locations.', parameters: [
        { name: 'location', in: 'query', schema: { type: 'string' }, description: 'Filter by location' },
      ], responses: { '200': { description: 'Object with keys + locations' } } } },
      '/api/tasks': { get: { summary: 'All tasks', description: '278 missions from 7 vendors.', parameters: [
        { name: 'vendor', in: 'query', schema: { type: 'string' }, description: 'Filter by vendor' },
        { name: 'area', in: 'query', schema: { type: 'string' }, description: 'Filter by area' },
        { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Text search' },
      ], responses: { '200': { description: 'Array of tasks' } } } },
      '/api/throwables': { get: { summary: 'Throwables', description: '8 grenade types.', responses: { '200': { description: 'Array' } } } },
      '/api/images': { get: { summary: 'Image URL lookup', description: '199 item → wiki image URL entries.', responses: { '200': { description: 'Object mapping' } } } },
      '/api/stats': { get: { summary: 'Aggregate statistics', description: 'Counts for all categories.', responses: { '200': { description: 'Stats object' } } } },
      '/api/search': { get: { summary: 'Unified search', description: 'Search across weapons, armor, keys, tasks.', parameters: [
        { name: 'q', in: 'query', required: true, schema: { type: 'string' }, description: 'Search query' },
      ], responses: { '200': { description: 'Grouped results' } } } },
    },
  };
}

// ── Request handler ──
export default async function handler(req) {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api\/?/, '').replace(/\/$/, '') || 'root';

  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400' },
    });
  }

  // Rate limit check
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'anonymous';
  const rate = checkRateLimit(ip);
  _rateInfo = rate;
  if (!rate.allowed) {
    return json({ error: 'Rate limit exceeded. Try again in 60s.', limit: RATE_LIMIT, windowMs: RATE_WINDOW_MS }, 429);
  }

  // OpenAPI spec
  if (path === 'spec' || path === 'openapi.json') {
    return new Response(JSON.stringify(openAPI(), null, 2), { headers: jsonHeaders() });
  }

  // Root: endpoint list
  if (path === 'root') {
    const spec = openAPI();
    const endpoints = Object.keys(spec.paths).map(p => ({ path: p, summary: spec.paths[p].get.summary }));
    return json({ name: 'GZW Data API', version: '1.0.0', endpoints });
  }

  // ── Data endpoints ──

  if (path === 'armor') {
    let data = DATA.armor() || [];
    const type = url.searchParams.get('type');
    const material = url.searchParams.get('material');
    const nij = url.searchParams.get('nij');
    if (type) data = data.filter(d => d.type?.toLowerCase() === type.toLowerCase());
    if (material) data = data.filter(d => d.material?.toLowerCase() === material.toLowerCase());
    if (nij) data = data.filter(d => d.nij === nij);
    return json(data);
  }

  if (path === 'weapons') {
    let data = DATA.weapons() || [];
    const type = url.searchParams.get('type');
    const caliber = url.searchParams.get('caliber');
    const search = url.searchParams.get('search');
    if (type) data = data.filter(d => d.type?.toLowerCase() === type.toLowerCase());
    if (caliber) data = data.filter(d => d.caliber === caliber);
    if (search) { const q = search.toLowerCase(); data = data.filter(d => d.name.toLowerCase().includes(q) || d.caliber?.includes(q)); }
    return json(data);
  }

  if (path === 'backpacks') {
    const bps = DATA.backpacks() || [];
    const rigs = (DATA.rigs() || []).filter(r => r.weight);
    const type = url.searchParams.get('type');
    if (type === 'Backpack') return json(bps);
    if (type === 'Tactical Rig') return json(rigs);
    return json({ backpacks: bps, rigs });
  }

  if (path === 'keys') {
    let data = DATA.keys() || [];
    const location = url.searchParams.get('location');
    if (location) data = data.filter(d => d.location?.toLowerCase() === location.toLowerCase());
    return json({ keys: data, locations: [...new Set((DATA.keys() || []).map(k => k.location))].sort() });
  }

  if (path === 'tasks') {
    let data = DATA.tasks() || [];
    const vendor = url.searchParams.get('vendor');
    const area = url.searchParams.get('area');
    const search = url.searchParams.get('search');
    if (vendor) data = data.filter(d => d.vendor?.toLowerCase() === vendor.toLowerCase());
    if (area) data = data.filter(d => d.area?.toLowerCase().includes(area.toLowerCase()));
    if (search) { const q = search.toLowerCase(); data = data.filter(d => d.name?.toLowerCase().includes(q) || d.area?.toLowerCase().includes(q)); }
    return json(data);
  }

  if (path === 'throwables') return json(DATA.throwables() || []);
  if (path === 'images') return json(DATA.images() || {});

  if (path === 'stats') {
    const armor = DATA.armor() || [];
    const weapons = DATA.weapons() || [];
    const bps = DATA.backpacks() || [];
    const rigs = (DATA.rigs() || []).filter(r => r.weight);
    const keys = DATA.keys() || [];
    const tasks = DATA.tasks() || [];
    return json({
      armor: { total: armor.length, vests: armor.filter(d => d.category === 'vests').length, helmets: armor.filter(d => d.category === 'helmets').length, plateCarriers: armor.filter(d => d.category === 'plate_carriers').length },
      weapons: { total: weapons.length, types: [...new Set(weapons.map(w => w.type))] },
      backpacks: { total: bps.length },
      rigs: { total: rigs.length },
      keys: { total: keys.length, locations: [...new Set(keys.map(k => k.location))].sort() },
      tasks: { total: tasks.length, vendors: [...new Set(tasks.map(t => t.vendor).filter(Boolean))] },
      images: { total: Object.keys(DATA.images() || {}).length },
    });
  }

  if (path === 'search') {
    const q = url.searchParams.get('q');
    if (!q) return json({ error: 'Missing required parameter: q' }, 400);
    const query = q.toLowerCase();
    return json({
      query: q,
      weapons: (DATA.weapons() || []).filter(d => d.name.toLowerCase().includes(query)),
      armor: (DATA.armor() || []).filter(d => d.name.toLowerCase().includes(query)),
      keys: (DATA.keys() || []).filter(d => d.name.toLowerCase().includes(query) || d.location?.toLowerCase().includes(query)),
      tasks: (DATA.tasks() || []).filter(d => d.name?.toLowerCase().includes(query) || d.area?.toLowerCase().includes(query)),
    });
  }

  return json({ error: 'Not found', path: `/api/${path}` }, 404);
}
