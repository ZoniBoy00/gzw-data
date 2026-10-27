const DEFAULT_TARGET = 'http://127.0.0.1:4173';

function validateTarget(value = DEFAULT_TARGET) {
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('SECURITY_BASE_URL must be an origin without credentials, path, query or fragment');
  }
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  const preview = /^gzw-data-[a-z0-9-]+-zoniboy00s-projects\.vercel\.app$/.test(url.hostname);
  if (!(local && url.protocol === 'http:') && !(preview && url.protocol === 'https:' && !url.port)) {
    throw new Error('Security tests accept loopback HTTP or this project\'s HTTPS Vercel previews only');
  }
  return { baseURL: url.origin, local };
}
module.exports = { DEFAULT_TARGET, validateTarget };
