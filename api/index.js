// GZW Data API — Vercel serverless function
// Serves all game data from /data/ with filtering & CORS

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), '..');

function loadJSON(name) {
  try {
    const p = join(ROOT, name);
    return JSON.parse(readFileSync(p, 'utf-8'));
  } catch {
    return null;
  }
}

// ── Data loaders (lazy via wrapper) ──
const DATA = {
  armor: () => loadJSON('armor.json'),
  weapons: () => loadJSON('weapons.json'),
  backpacks: () => loadJSON('backpacks.json'),
  rigs: () => loadJSON('rigs.json'),
  keys: () => loadJSON('keys.json'),
  tasks: () => loadJSON('tasks.json'),
  throwables: () => loadJSON('throwables.json'),
  images: () => loadJSON('images.json'),
  vests: () => loadJSON('vests.json'),
};

// ── Helpers ──
const CACHE = 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400';
const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Cache-Control': CACHE,
};

function json(data, status = 200) {
  const body = JSON.stringify({
    data,
    count: Array.isArray(data) ? data.length : undefined,
    source: 'GZW Data API',
    timestamp: new Date().toISOString(),
  }, null, 2);
  return new Response(body, {
    status,
    headers: HEADERS,
  });
}

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
      '/api': {
        get: {
          summary: 'API root',
          description: 'Returns API metadata and available endpoints.',
          responses: { '200': { description: 'API info' } },
        },
      },
      '/api/armor': {
        get: {
          summary: 'All armor items',
          description: 'Returns 61 armor items: vests, plate carriers, and helmets with NIJ class, material, weight, and source.',
          parameters: [
            { name: 'type', in: 'query', schema: { type: 'string' }, description: 'Filter by type (Ballistic Vest, Helmet, Plate Carrier)' },
            { name: 'material', in: 'query', schema: { type: 'string' }, description: 'Filter by material (Aramid, Steel, Ceramic, UHMWPE)' },
            { name: 'nij', in: 'query', schema: { type: 'string' }, description: 'Filter by NIJ class (IIIA, III, III+, etc.)' },
          ],
          responses: { '200': { description: 'Array of armor items' } },
        },
      },
      '/api/weapons': {
        get: {
          summary: 'All weapons',
          description: 'Returns 51 weapons with type, caliber, mag size, and source.',
          parameters: [
            { name: 'type', in: 'query', schema: { type: 'string' }, description: 'Filter by type (Assault Rifle, SMG, Pistol, etc.)' },
            { name: 'caliber', in: 'query', schema: { type: 'string' }, description: 'Filter by caliber' },
            { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Text search across name and caliber' },
          ],
          responses: { '200': { description: 'Array of weapon items' } },
        },
      },
      '/api/backpacks': {
        get: {
          summary: 'All backpacks & rigs',
          description: 'Returns 16 backpacks and 11 tactical rigs with weight, grid size, and images.',
          parameters: [
            { name: 'type', in: 'query', schema: { type: 'string' }, description: 'Filter by type (Backpack, Tactical Rig)' },
          ],
          responses: { '200': { description: 'Object with backpacks and rigs arrays' } },
        },
      },
      '/api/keys': {
        get: {
          summary: 'All keys & keycards',
          description: 'Returns 124 keys across 12 locations with wiki links and images.',
          parameters: [
            { name: 'location', in: 'query', schema: { type: 'string' }, description: 'Filter by location (Ban Pa, Fort Narith, Tiger Bay, etc.)' },
          ],
          responses: { '200': { description: 'Object with keys array and locations list' } },
        },
      },
      '/api/tasks': {
        get: {
          summary: 'All tasks',
          description: 'Returns 278 missions from 7 vendors with objectives and rewards.',
          parameters: [
            { name: 'vendor', in: 'query', schema: { type: 'string' }, description: 'Filter by vendor' },
            { name: 'area', in: 'query', schema: { type: 'string' }, description: 'Filter by area' },
            { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Text search across name/area/vendor' },
          ],
          responses: { '200': { description: 'Array of task items' } },
        },
      },
      '/api/throwables': {
        get: {
          summary: 'All throwables',
          description: 'Returns 8 grenade types (frag, smoke, stun) with weight and blast radius.',
          responses: { '200': { description: 'Array of throwable items' } },
        },
      },
      '/api/images': {
        get: {
          summary: 'Image URL lookup',
          description: 'Returns a flat mapping of item name → wiki image URL (199 entries).',
          responses: { '200': { description: 'Object mapping' } },
        },
      },
      '/api/stats': {
        get: {
          summary: 'Aggregate statistics',
          description: 'Returns counts and breakdowns for all data categories.',
          responses: { '200': { description: 'Stats object' } },
        },
      },
      '/api/search': {
        get: {
          summary: 'Unified search',
          description: 'Search across weapons, armor, keys, and tasks by keyword.',
          parameters: [
            { name: 'q', in: 'query', required: true, schema: { type: 'string' }, description: 'Search query' },
          ],
          responses: { '200': { description: 'Search results grouped by category' } },
        },
      },
    },
  };
}

// ── Request handler ──
export default async function handler(req) {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api\/?/, '').replace(/\/$/, '') || 'root';

  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: HEADERS });
  }

  // OpenAPI spec
  if (path === 'spec' || path === 'openapi.json') {
    return new Response(JSON.stringify(openAPI(), null, 2), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': CACHE },
    });
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
    const rigs = DATA.rigs() ? DATA.rigs().filter(r => r.weight) : [];
    const type = url.searchParams.get('type');
    if (type === 'Backpack') return json(bps);
    if (type === 'Tactical Rig') return json(rigs);
    return json({ backpacks: bps, rigs });
  }

  if (path === 'keys') {
    let data = DATA.keys() || [];
    const location = url.searchParams.get('location');
    if (location) data = data.filter(d => d.location?.toLowerCase() === location.toLowerCase());
    const locations = [...new Set(DATA.keys()?.map(k => k.location))].sort();
    return json({ keys: data, locations });
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
      armor: {
        total: armor.length,
        vests: armor.filter(d => d.category === 'vests').length,
        helmets: armor.filter(d => d.category === 'helmets').length,
        plateCarriers: armor.filter(d => d.category === 'plate_carriers').length,
      },
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
    if (!q) return json({ error: 'Missing ?q=' }, 400);
    const query = q.toLowerCase();
    const weapons = (DATA.weapons() || []).filter(d => d.name.toLowerCase().includes(query));
    const armor = (DATA.armor() || []).filter(d => d.name.toLowerCase().includes(query));
    const keys = (DATA.keys() || []).filter(d => d.name.toLowerCase().includes(query) || d.location?.toLowerCase().includes(query));
    const tasks = (DATA.tasks() || []).filter(d => d.name?.toLowerCase().includes(query) || d.area?.toLowerCase().includes(query));
    return json({ query: q, weapons, armor, keys, tasks });
  }

  // 404
  return json({ error: 'Not found', path: `/api/${path}` }, 404);
}
