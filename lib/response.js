const { RATE_LIMIT } = require('./config');

function setHeaders(res, rateInfo, cacheTTL) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('X-RateLimit-Limit', RATE_LIMIT.max);
  res.setHeader('X-RateLimit-Remaining', rateInfo.remaining);
  res.setHeader('X-RateLimit-Reset', Math.ceil(rateInfo.reset / 1000));
  if (cacheTTL > 0) {
    res.setHeader('Cache-Control', `public, max-age=${cacheTTL}, stale-while-revalidate=${cacheTTL * 2}`);
  }
}

function json(res, data, status = 200, extra = {}) {
  const body = { data, ...extra };
  if (Array.isArray(data)) body.count = data.length;
  body.source = 'GZW Data API';
  body.timestamp = new Date().toISOString();
  return res.status(status).json(body);
}

function errorResponse(res, status, code, message, details = {}) {
  return res.status(status).json({
    error: { code, message, ...details },
    source: 'GZW Data API',
    timestamp: new Date().toISOString(),
  });
}

module.exports = { setHeaders, json, errorResponse };
