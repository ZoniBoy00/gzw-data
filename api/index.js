// GZW Data API — Vercel serverless
// Uses createRequire for maximum Node.js compatibility

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const armor = require('../armor.json');
const weapons = require('../weapons.json');
const backpacks = require('../backpacks.json');
const rigs = require('../rigs.json');
const keys = require('../keys.json');
const tasks = require('../tasks.json');
const throwables = require('../throwables.json');
const images = require('../images.json');

// Rate limiter
const RATE = { max: 100, ms: 60000 };
const hits = new Map();

function rate(ip) {
  const now = Date.now();
  let r = hits.get(ip);
  if (!r || now - r.t > RATE.ms) { hits.set(ip, { t: now, c: 1 }); return { rem: RATE.max - 1, reset: now + RATE.ms }; }
  r.c++;
  if (r.c > RATE.max) return { rem: 0, reset: r.t + RATE.ms };
  return { rem: RATE.max - r.c, reset: r.t + RATE.ms };
}

const j = (data, s = 200, extra = {}) => new Response(JSON.stringify({ data, count: Array.isArray(data) ? data.length : undefined, source: 'GZW Data API', timestamp: new Date().toISOString() }), {
  status: s,
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=3600', ...extra },
});

function pathAndQuery(url) {
  const i = url.indexOf('?');
  return { path: (i === -1 ? url : url.slice(0, i)).replace(/^\/api\/?/, '').replace(/\/$/, '') || 'root', params: new URLSearchParams(i === -1 ? '' : url.slice(i)) };
}

function filterBy(arr, params, fields) {
  let d = [...arr];
  for (const f of fields) {
    const v = params.get(f);
    if (v) d = d.filter(x => (x[f] || '').toLowerCase() === v.toLowerCase());
  }
  return d;
}

export default async function handler(req) {
  try {
    const { path, params } = pathAndQuery(req.url || '/');

    if (req.method === 'OPTIONS') return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': '*', 'Access-Control-Max-Age': '86400' } });

    const r = rate(req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || 'anon');
    const rl = { 'X-RateLimit-Limit': RATE.max, 'X-RateLimit-Remaining': r.rem, 'X-RateLimit-Reset': Math.ceil(r.reset / 1000) };
    if (r.rem === 0) return j({ error: 'Rate limit exceeded' }, 429, rl);

    if (path === 'spec') {
      return new Response(JSON.stringify({
        openapi: '3.0.3', info: { title: 'GZW Data API', version: '1.0.0' },
        servers: [{ url: 'https://gzw-data.vercel.app' }],
        paths: {
          '/api': { get: { summary: 'API root' } },
          '/api/armor': { get: { summary: 'Armor (61 items)', parameters: [{ name: 'type', in: 'query' }, { name: 'material', in: 'query' }, { name: 'nij', in: 'query' }] } },
          '/api/weapons': { get: { summary: 'Weapons (51)', parameters: [{ name: 'type', in: 'query' }, { name: 'caliber', in: 'query' }, { name: 'search', in: 'query' }] } },
          '/api/backpacks': { get: { summary: 'Backpacks & rigs', parameters: [{ name: 'type', in: 'query' }] } },
          '/api/keys': { get: { summary: 'Keys (124)', parameters: [{ name: 'location', in: 'query' }] } },
          '/api/tasks': { get: { summary: 'Tasks (278)', parameters: [{ name: 'vendor', in: 'query' }, { name: 'area', in: 'query' }, { name: 'search', in: 'query' }] } },
          '/api/throwables': { get: { summary: 'Throwables (8)' } },
          '/api/images': { get: { summary: 'Image URLs (199)' } },
          '/api/stats': { get: { summary: 'Statistics' } },
          '/api/search': { get: { summary: 'Search', parameters: [{ name: 'q', in: 'query', required: true }] } },
        },
      }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=3600', ...rl } });
    }

    if (path === 'health' || path === 'debug') return j({ ok: true, version: '1.0.0', dataLoaded: { armor: !!armor, weapons: !!weapons, backpacks: !!backpacks, keys: !!keys, tasks: !!tasks } }, 200, rl);
    if (path === 'root') return j({ name: 'GZW Data API', version: '1.0.0', endpoints: ['armor', 'weapons', 'backpacks', 'keys', 'tasks', 'throwables', 'images', 'stats', 'search'] }, 200, rl);

    if (path === 'armor') return j(filterBy(armor, params, ['type', 'material', 'nij']), 200, rl);

    if (path === 'weapons') {
      let d = [...weapons];
      const t = params.get('type'), c = params.get('caliber'), s = params.get('search');
      if (t) d = d.filter(x => x.type?.toLowerCase() === t.toLowerCase());
      if (c) d = d.filter(x => x.caliber === c);
      if (s) { const q = s.toLowerCase(); d = d.filter(x => x.name.toLowerCase().includes(q) || (x.caliber || '').includes(q)); }
      return j(d, 200, rl);
    }

    if (path === 'backpacks') {
      const bps = [...backpacks], rgs = rigs.filter(r => r.weight);
      const t = params.get('type');
      if (t === 'Backpack') return j(bps, 200, rl);
      if (t === 'Tactical Rig') return j(rgs, 200, rl);
      return j({ backpacks: bps, rigs: rgs }, 200, rl);
    }

    if (path === 'keys') {
      let d = [...keys];
      const l = params.get('location');
      if (l) d = d.filter(x => x.location?.toLowerCase() === l.toLowerCase());
      return j({ keys: d, locations: [...new Set(keys.map(k => k.location))].sort() }, 200, rl);
    }

    if (path === 'tasks') {
      let d = [...tasks];
      const v = params.get('vendor'), a = params.get('area'), s = params.get('search');
      if (v) d = d.filter(x => x.vendor?.toLowerCase() === v.toLowerCase());
      if (a) d = d.filter(x => (x.area || '').toLowerCase().includes(a.toLowerCase()));
      if (s) { const q = s.toLowerCase(); d = d.filter(x => (x.name || '').toLowerCase().includes(q) || (x.area || '').toLowerCase().includes(q)); }
      return j(d, 200, rl);
    }

    if (path === 'throwables') return j(throwables, 200, rl);
    if (path === 'images') return j(images, 200, rl);

    if (path === 'stats') {
      return j({
        armor: { total: armor.length, vests: armor.filter(x => x.category === 'vests').length, helmets: armor.filter(x => x.category === 'helmets').length, plateCarriers: armor.filter(x => x.category === 'plate_carriers').length },
        weapons: { total: weapons.length, types: [...new Set(weapons.map(x => x.type))] },
        backpacks: { total: backpacks.length },
        rigs: { total: rigs.filter(r => r.weight).length },
        keys: { total: keys.length, locations: [...new Set(keys.map(k => k.location))].sort() },
        tasks: { total: tasks.length, vendors: [...new Set(tasks.map(t => t.vendor).filter(Boolean))] },
        images: { total: Object.keys(images).length },
      }, 200, rl);
    }

    if (path === 'search') {
      const q = params.get('q');
      if (!q) return j({ error: 'Missing ?q' }, 400, rl);
      const query = q.toLowerCase();
      return j({
        query: q,
        weapons: weapons.filter(x => x.name.toLowerCase().includes(query)),
        armor: armor.filter(x => x.name.toLowerCase().includes(query)),
        keys: keys.filter(x => x.name.toLowerCase().includes(query) || (x.location || '').toLowerCase().includes(query)),
        tasks: tasks.filter(x => (x.name || '').toLowerCase().includes(query) || (x.area || '').toLowerCase().includes(query)),
      }, 200, rl);
    }

    return j({ error: `Not found: /api/${path}` }, 404, rl);

  } catch (err) {
    console.error('GZW API Error:', err.stack);
    return new Response(JSON.stringify({ error: 'Internal error', message: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-cache' },
    });
  }
}
