function parseRoute(url) {
  const queryIndex = url.indexOf('?');
  const rawPath = (queryIndex === -1 ? url : url.slice(0, queryIndex)).replace(/^\/api\/?/, '');
  const versionMatch = rawPath.match(/^v1(?:\/|$)/);
  const path = (versionMatch ? rawPath.slice(2).replace(/^\/+/, '') : rawPath).replace(/\/$/, '') || 'root';
  const params = new URLSearchParams(queryIndex === -1 ? '' : url.slice(queryIndex));
  return { path, params, version: versionMatch ? 'v1' : 'legacy' };
}

function decodeRoutePart(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

module.exports = { parseRoute, decodeRoutePart };
