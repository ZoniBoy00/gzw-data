// GZW Data API — Minimal Vercel serverless
// Serves all game data with CORS + rate limiting

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Find where JSON files live
const CWD = process.cwd();
let ROOT = CWD;
for (const p of [CWD, join(CWD, '..')]) {
  if (existsSync(join(p, 'armor.json'))) { ROOT = p; break; }
}

// Data loaders
const load = (f) => { try { return JSON.parse(readFileSync(join(ROOT, f), 'utf-8')); } catch { return null; } };
const D = {
  armor: () => load('armor.json'),
  weapons: () => load('weapons.json'),
  bps: () => load('backpacks.json'),
  rigs: () => load('rigs.json'),
  keys: () => load('keys.json'),
  tasks: () => load('tasks.json'),
  throws: () => load('throwables.json'),
  images: () => load('images.json'),
};

// Rate limiter (simple, per-instance)
const RATE = { limit: 100, window: 60000 };
const hits = new Map();

function checkRate(ip) {
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now - rec.t > RATE.window) {
    hits.set(ip, { t: now, c: 1 });
    return { ok: true, remain: RATE.limit - 1, reset: now + RATE.window };
  }
  rec.c++;
  if (rec.c > RATE.limit) return { ok: false, remain: 0, reset: rec.t + RATE.window };
  return { ok: true, remain: RATE.limit - rec.c, reset: rec.t + RATE.window };
}

// Helpers
const H = (s, h) => new Response(s, { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=3600', ...h } });

function respond(data, status = 200, extra = {}) {
  return H(JSON.stringify({ data, count: Array.isArray(data) ? data.length : undefined, source: 'GZW Data API', timestamp: new Date().toISOString() }), { status, ...extra });
}

export default async function handler(req) {
  try {
    // Parse path from req.url
    const qIdx = req.url.indexOf('?');
    const p = (qIdx === -1 ? req.url : req.url.slice(0, qIdx)).replace(/^\/api\/?/, '').replace(/\/$/, '') || 'r';
    const params = new URLSearchParams(qIdx === -1 ? '' : req.url.slice(qIdx));

    // CORS
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': '*', 'Access-Control-Max-Age': '86400' } });
    }

    // Rate limit
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || 'anon';
    const rate = checkRate(ip);
    const rlHeaders = { 'X-RateLimit-Limit': RATE.limit, 'X-RateLimit-Remaining': rate.remain, 'X-RateLimit-Reset': Math.ceil(rate.reset / 1000) };
    if (!rate.ok) return respond({ error: 'Rate limit exceeded' }, 429, rlHeaders);

    // ── Routes ──
    if (p === 'spec' || p === 'openapi.json') {
      return H(JSON.stringify({ openapi: '3.0.3', info: { title: 'GZW Data API', version: '1.0.0' }, servers: [{ url: 'https://gzw-data.vercel.app' }], paths: { '/api': { get: { summary: 'Root' } }, '/api/armor': { get: { summary: 'Armor items' } }, '/api/weapons': { get: { summary: 'Weapons' } }, '/api/backpacks': { get: { summary: 'Backpacks & rigs' } }, '/api/keys': { get: { summary: 'Keys' } }, '/api/tasks': { get: { summary: 'Tasks' } }, '/api/throwables': { get: { summary: 'Throwables' } }, '/api/images': { get: { summary: 'Image lookup' } }, '/api/stats': { get: { summary: 'Stats' } }, '/api/search': { get: { summary: 'Search' } } } }), rlHeaders);
    }

    if (p === 'debug' || p === 'health') {
      return respond({ ok: true, root: ROOT, cwd: CWD, files: ['armor.json', 'weapons.json', 'backpacks.json', 'keys.json', 'tasks.json'].map(f => ({ f, exists: existsSync(join(ROOT, f)) })) }, 200, rlHeaders);
    }

    if (p === 'r') return respond({ name: 'GZW Data API', version: '1.0.0' }, 200, rlHeaders);

    if (p === 'armor') {
      let d = D.armor() || [];
      ['type', 'material', 'nij'].forEach(k => { const v = params.get(k); if (v) d = d.filter(x => (x[k] || '').toLowerCase() === v.toLowerCase()); });
      return respond(d, 200, rlHeaders);
    }

    if (p === 'weapons') {
      let d = D.weapons() || [];
      const t = params.get('type'), c = params.get('caliber'), s = params.get('search');
      if (t) d = d.filter(x => x.type?.toLowerCase() === t.toLowerCase());
      if (c) d = d.filter(x => x.caliber === c);
      if (s) { const q = s.toLowerCase(); d = d.filter(x => x.name.toLowerCase().includes(q) || (x.caliber || '').includes(q)); }
      return respond(d, 200, rlHeaders);
    }

    if (p === 'backpacks') {
      const bps = D.bps() || [], rigs = (D.rigs() || []).filter(r => r.weight);
      const t = params.get('type');
      if (t === 'Backpack') return respond(bps, 200, rlHeaders);
      if (t === 'Tactical Rig') return respond(rigs, 200, rlHeaders);
      return respond({ backpacks: bps, rigs }, 200, rlHeaders);
    }

    if (p === 'keys') {
      let d = D.keys() || [];
      const l = params.get('location');
      if (l) d = d.filter(x => x.location?.toLowerCase() === l.toLowerCase());
      return respond({ keys: d, locations: [...new Set((D.keys() || []).map(k => k.location))].sort() }, 200, rlHeaders);
    }

    if (p === 'tasks') {
      let d = D.tasks() || [];
      const v = params.get('vendor'), a = params.get('area'), s = params.get('search');
      if (v) d = d.filter(x => x.vendor?.toLowerCase() === v.toLowerCase());
      if (a) d = d.filter(x => (x.area || '').toLowerCase().includes(a.toLowerCase()));
      if (s) { const q = s.toLowerCase(); d = d.filter(x => (x.name || '').toLowerCase().includes(q) || (x.area || '').toLowerCase().includes(q)); }
      return respond(d, 200, rlHeaders);
    }

    if (p === 'throwables') return respond(D.throws() || [], 200, rlHeaders);
    if (p === 'images') return respond(D.images() || {}, 200, rlHeaders);

    if (p === 'stats') {
      const a = D.armor() || [], w = D.weapons() || [], b = D.bps() || [], r = (D.rigs() || []).filter(x => x.weight), k = D.keys() || [], t = D.tasks() || [];
      return respond({ armor: { total: a.length, vests: a.filter(x => x.category === 'vests').length, helmets: a.filter(x => x.category === 'helmets').length, plateCarriers: a.filter(x => x.category === 'plate_carriers').length }, weapons: { total: w.length, types: [...new Set(w.map(x => x.type))] }, backpacks: { total: b.length }, rigs: { total: r.length }, keys: { total: k.length, locations: [...new Set(k.map(x => x.location))].sort() }, tasks: { total: t.length, vendors: [...new Set(t.map(x => x.vendor).filter(Boolean))] }, images: { total: Object.keys(D.images() || {}).length } }, 200, rlHeaders);
    }

    if (p === 'search') {
      const q = params.get('q');
      if (!q) return respond({ error: 'Missing ?q' }, 400, rlHeaders);
      const query = q.toLowerCase();
      return respond({ query: q, weapons: (D.weapons() || []).filter(x => x.name.toLowerCase().includes(query)), armor: (D.armor() || []).filter(x => x.name.toLowerCase().includes(query)), keys: (D.keys() || []).filter(x => x.name.toLowerCase().includes(query) || (x.location || '').toLowerCase().includes(query)), tasks: (D.tasks() || []).filter(x => (x.name || '').toLowerCase().includes(query) || (x.area || '').toLowerCase().includes(query)) }, 200, rlHeaders);
    }

    return respond({ error: 'Not found', path: `/api/${p}` }, 404, rlHeaders);

  } catch (err) {
    console.error('GZW API Error:', err.message);
    return new Response(JSON.stringify({ error: 'Internal error', message: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-cache' },
    });
  }
}
