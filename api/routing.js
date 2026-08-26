function parseRoute(url) {
  const queryIndex = url.indexOf('?');
  const path = (queryIndex === -1 ? url : url.slice(0, queryIndex))
    .replace(/^\/api\/?/, '')
    .replace(/\/$/, '') || 'root';
  const params = new URLSearchParams(queryIndex === -1 ? '' : url.slice(queryIndex));
  return { path, params };
}

function decodeRoutePart(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

module.exports = { parseRoute, decodeRoutePart };
