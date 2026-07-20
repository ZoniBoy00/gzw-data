// GZW Data API — Vercel serverless (Node.js runtime, req/res pattern)
const { createRequire } = require('node:module');
const require2 = createRequire(__filename);

const armor = require2('../armor.json');
const weapons = require2('../weapons.json');
const backpacks = require2('../backpacks.json');
const rigs = require2('../rigs.json');
const keys = require2('../keys.json');
const tasks = require2('../tasks.json');
const throwables = require2('../throwables.json');
const images = require2('../images.json');

// Rate limiter
const RATE = { max: 100, ms: 60000 };
const hits = {};

function rate(ip) {
  const now = Date.now();
  const r = hits[ip];
  if (!r || now - r.t > RATE.ms) { hits[ip] = { t: now, c: 1 }; return { rem: RATE.max - 1, reset: now + RATE.ms }; }
  r.c++;
  if (r.c > RATE.max) return { rem: 0, reset: r.t + RATE.ms };
  return { rem: RATE.max - r.c, reset: r.t + RATE.ms };
}

function json(res, data, status = 200, headers = {}) {
  res.status(status).json({ data, count: Array.isArray(data) ? data.length : undefined, source: 'GZW Data API', timestamp: new Date().toISOString() });
}

function pathAndQuery(url) {
  const i = url.indexOf('?');
  return { path: (i === -1 ? url : url.slice(0, i)).replace(/^\/api\/?/, '').replace(/\/$/, '') || 'root', params: new URLSearchParams(i === -1 ? '' : url.slice(i)) };
}

module.exports = (req, res) => {
  try {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    if (req.method === 'OPTIONS') return res.status(204).end();

    // Rate limit
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.headers['x-real-ip'] || req.socket?.remoteAddress || 'anon';
    const r = rate(ip);
    res.setHeader('X-RateLimit-Limit', RATE.max);
    res.setHeader('X-RateLimit-Remaining', r.rem);
    res.setHeader('X-RateLimit-Reset', Math.ceil(r.reset / 1000));
    if (r.rem === 0) return res.status(429).json({ error: 'Rate limit exceeded. Try again later.' });

    const { path, params } = pathAndQuery(req.url || '/');

    // Handle case where Vercel rewrite changes req.url
    const forwardedUrl = req.headers['x-vercel-forwarded-url'];
    const actualPath = forwardedUrl ? pathAndQuery(forwardedUrl).path : path;
    const p = actualPath;

    // ── Routes ──
    if (p === 'spec' || p === 'openapi.json') {
      return res.json({
        openapi: '3.0.3', info: { title: 'GZW Data API', version: '1.0.0', description: 'Gray Zone Warfare game data API.' },
        servers: [{ url: 'https://gzw-data.vercel.app' }],
        paths: {
          '/api': { get: { summary: 'API root' } },
          '/api/armor': { get: { summary: 'Armor (61)', parameters: [{ name: 'type', in: 'query' }, { name: 'material', in: 'query' }, { name: 'nij', in: 'query' }] } },
          '/api/weapons': { get: { summary: 'Weapons (51)', parameters: [{ name: 'type', in: 'query' }, { name: 'caliber', in: 'query' }, { name: 'search', in: 'query' }] } },
          '/api/backpacks': { get: { summary: 'Backpacks & rigs', parameters: [{ name: 'type', in: 'query' }] } },
          '/api/keys': { get: { summary: 'Keys (124)', parameters: [{ name: 'location', in: 'query' }] } },
          '/api/tasks': { get: { summary: 'Tasks (278)', parameters: [{ name: 'vendor', in: 'query' }, { name: 'area', in: 'query' }, { name: 'search', in: 'query' }] } },
          '/api/throwables': { get: { summary: 'Throwables (8)' } },
          '/api/images': { get: { summary: 'Image URLs (199)' } },
          '/api/stats': { get: { summary: 'Stats' } },
          '/api/search': { get: { summary: 'Search', parameters: [{ name: 'q', in: 'query', required: true }] } },
        },
      });
    }

    if (p === 'health' || p === 'debug') return res.json({ ok: true, version: '1.0.0', dataLoaded: { armor: !!armor, weapons: !!weapons, backpacks: !!backpacks, keys: !!keys, tasks: !!tasks } });
    if (p === 'root') return res.json({ name: 'GZW Data API', version: '1.0.0', endpoints: ['armor', 'weapons', 'backpacks', 'keys', 'tasks', 'throwables', 'images', 'stats', 'search'] });

    if (p === 'armor') {
      let d = [...armor];
      for (const k of ['type', 'material', 'nij']) {
        const v = params.get(k);
        if (v) d = d.filter(x => (x[k] || '').toLowerCase() === v.toLowerCase());
      }
      return json(res, d);
    }

    if (p === 'weapons') {
      let d = [...weapons];
      const t = params.get('type'), c = params.get('caliber'), s = params.get('search');
      if (t) d = d.filter(x => x.type?.toLowerCase() === t.toLowerCase());
      if (c) d = d.filter(x => x.caliber === c);
      if (s) { const q = s.toLowerCase(); d = d.filter(x => x.name.toLowerCase().includes(q) || (x.caliber || '').includes(q)); }
      return json(res, d);
    }

    if (p === 'backpacks') {
      const bps = [...backpacks], rgs = rigs.filter(r => r.weight);
      const t = params.get('type');
      if (t === 'Backpack') return json(res, bps);
      if (t === 'Tactical Rig') return json(res, rgs);
      return json(res, { backpacks: bps, rigs: rgs });
    }

    if (p === 'keys') {
      let d = [...keys];
      const l = params.get('location');
      if (l) d = d.filter(x => x.location?.toLowerCase() === l.toLowerCase());
      return json(res, { keys: d, locations: [...new Set(keys.map(k => k.location))].sort() });
    }

    if (p === 'tasks') {
      let d = [...tasks];
      const v = params.get('vendor'), a = params.get('area'), s = params.get('search');
      if (v) d = d.filter(x => x.vendor?.toLowerCase() === v.toLowerCase());
      if (a) d = d.filter(x => (x.area || '').toLowerCase().includes(a.toLowerCase()));
      if (s) { const q = s.toLowerCase(); d = d.filter(x => (x.name || '').toLowerCase().includes(q) || (x.area || '').toLowerCase().includes(q)); }
      return json(res, d);
    }

    if (p === 'throwables') return json(res, throwables);
    if (p === 'images') return json(res, images);

    if (p === 'stats') {
      return json(res, {
        armor: { total: armor.length, vests: armor.filter(x => x.category === 'vests').length, helmets: armor.filter(x => x.category === 'helmets').length, plateCarriers: armor.filter(x => x.category === 'plate_carriers').length },
        weapons: { total: weapons.length, types: [...new Set(weapons.map(x => x.type))] },
        backpacks: { total: backpacks.length },
        rigs: { total: rigs.filter(r => r.weight).length },
        keys: { total: keys.length, locations: [...new Set(keys.map(k => k.location))].sort() },
        tasks: { total: tasks.length, vendors: [...new Set(tasks.map(t => t.vendor).filter(Boolean))] },
        images: { total: Object.keys(images).length },
      });
    }

    if (p === 'search') {
      const q = params.get('q');
      if (!q) return res.status(400).json({ error: 'Missing ?q' });
      const query = q.toLowerCase();
      return json(res, {
        query: q,
        weapons: weapons.filter(x => x.name.toLowerCase().includes(query)),
        armor: armor.filter(x => x.name.toLowerCase().includes(query)),
        keys: keys.filter(x => x.name.toLowerCase().includes(query) || (x.location || '').toLowerCase().includes(query)),
        tasks: tasks.filter(x => (x.name || '').toLowerCase().includes(query) || (x.area || '').toLowerCase().includes(query)),
      });
    }

    res.status(404).json({ error: `Not found: /api/${p}` });

  } catch (err) {
    console.error('GZW API Error:', err);
    res.status(500).json({ error: 'Internal error', message: err.message });
  }
};
