// Prints the anonymous daily API usage counters stored by lib/usage.js.
// Usage: vercel env pull .env.local && node --env-file=.env.local scripts/usage-report.js [days=30]
const { redisConfig } = require('../lib/usage');

const config = redisConfig();
if (!config) {
  console.error('Missing KV_REST_API_URL / KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_*). Run `vercel env pull .env.local` first.');
  process.exit(1);
}

const days = Math.min(Math.max(parseInt(process.argv[2], 10) || 30, 1), 365);
const dates = Array.from({ length: days }, (_, i) => new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)).reverse();

async function main() {
  const res = await fetch(`${config.url}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(dates.map(day => ['HGETALL', `usage:${day}`])),
  });
  if (!res.ok) throw new Error(`Redis request failed: ${res.status}`);
  const results = await res.json();

  const totals = { endpoint: {}, status: {}, client: {} };
  let total = 0;
  console.log('date        requests  429  5xx');
  results.forEach((entry, i) => {
    const flat = entry.result || [];
    const day = {};
    for (let j = 0; j < flat.length; j += 2) day[flat[j]] = Number(flat[j + 1]);
    let limited = 0;
    let errors = 0;
    for (const [field, count] of Object.entries(day)) {
      const [kind, name] = [field.slice(0, field.indexOf(':')), field.slice(field.indexOf(':') + 1)];
      const bucket = { ep: 'endpoint', st: 'status', cl: 'client' }[kind];
      if (bucket) totals[bucket][name] = (totals[bucket][name] || 0) + count;
      if (kind === 'st' && name === '429') limited += count;
      if (kind === 'st' && name.startsWith('5')) errors += count;
    }
    total += day.total || 0;
    if (day.total) console.log(`${dates[i]}  ${String(day.total).padStart(8)}  ${String(limited).padStart(3)}  ${String(errors).padStart(3)}`);
  });

  console.log(`\nTotal requests that reached the function in ${days} days: ${total}`);
  console.log('(CDN-cached responses are not counted, so this is a lower bound.)');
  for (const [title, counts] of Object.entries(totals)) {
    console.log(`\nTop ${title}s`);
    Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([name, n]) => console.log(`  ${String(n).padStart(8)}  ${name}`));
  }
}

main().catch(err => { console.error(err.message); process.exit(1); });
