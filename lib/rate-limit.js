const { RATE_LIMIT } = require('./config');

// Vercel functions do not share memory across all instances. This limiter
// protects warm instances and helps absorb bursts, but it is not a strict
// global per-IP quota. Use a shared datastore if a hard quota is required.
const hits = new Map();
const MAX_TRACKED_IPS = 10000;

function checkRate(ip) {
  const now = Date.now();
  const window = RATE_LIMIT.ms;
  const key = String(ip || 'anon').slice(0, 128);
  let timestamps = hits.get(key);
  if (!timestamps) {
    if (hits.size >= MAX_TRACKED_IPS) {
      const cutoff = now - window;
      for (const [trackedIp, trackedTimestamps] of hits) {
        if (!trackedTimestamps.length || trackedTimestamps[trackedTimestamps.length - 1] < cutoff) {
          hits.delete(trackedIp);
        }
      }
      if (hits.size >= MAX_TRACKED_IPS) hits.delete(hits.keys().next().value);
    }
    timestamps = [];
    hits.set(key, timestamps);
  }

  const cutoff = now - window;
  while (timestamps.length > 0 && timestamps[0] < cutoff) timestamps.shift();

  if (timestamps.length >= RATE_LIMIT.max) {
    const oldest = timestamps[0];
    return { allowed: false, reset: oldest + window, remaining: 0 };
  }

  timestamps.push(now);
  return { allowed: true, reset: now + window, remaining: RATE_LIMIT.max - timestamps.length };
}

module.exports = { checkRate };
