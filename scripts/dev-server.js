const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const apiHandler = require('../api/index.js');
const deployment = require('../vercel.json');

const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 4173);
const webRoot = path.resolve(__dirname, '..', 'web');
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function send(res, statusCode, body, headers = {}) {
  res.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8', ...headers });
  res.end(body);
}

function adaptResponse(res) {
  res.status = statusCode => {
    res.statusCode = statusCode;
    return res;
  };
  res.json = body => {
    if (!res.headersSent) res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(body));
  };
  return res;
}

function serveStatic(req, res) {
  let requestPath;
  try {
    requestPath = decodeURIComponent(new URL(req.url, `http://${host}`).pathname);
  } catch {
    return send(res, 400, 'Bad request');
  }
  // Mirror the legal-page rewrites from vercel.json.
  const legalAlias = requestPath.replace(/\/+$/, '').match(/^\/(privacy-policy|terms-of-service)$/);
  const relativePath = legalAlias ? `legal/${legalAlias[1]}/index.html` : requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '');
  const candidates = [path.join(webRoot, relativePath)];
  if (!path.extname(relativePath)) candidates.push(path.join(webRoot, relativePath, 'index.html'));
  const filePath = candidates.find(candidate => candidate.startsWith(`${webRoot}${path.sep}`) && fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  if (!filePath) {
    const notFound = path.join(webRoot, '..', '404.html');
    if (!fs.existsSync(notFound)) return send(res, 404, 'Not found');
    res.writeHead(404, { 'Content-Type': mimeTypes['.html'] });
    return fs.createReadStream(notFound).pipe(res);
  }
  const extension = path.extname(filePath).toLowerCase();
  res.writeHead(200, { 'Content-Type': mimeTypes[extension] || 'application/octet-stream' });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(filePath).pipe(res);
}

function createServer() {
  return http.createServer((req, res) => {
    // Mirror production security headers so local browser tests exercise the same CSP.
    for (const entry of deployment.headers || []) {
      if (entry.source !== '/(.*)') continue;
      for (const header of entry.headers) res.setHeader(header.key, header.value);
    }
    const requestPath = req.url.split('?')[0];
    const redirect = deployment.redirects?.find(entry => entry.source === requestPath);
    if (redirect) {
      res.writeHead(redirect.permanent ? 308 : 307, { Location: redirect.destination });
      return res.end();
    }
    if (req.url.startsWith('/api')) return apiHandler(req, adaptResponse(res));
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
    return serveStatic(req, res);
  });
}

if (require.main === module) {
  const server = createServer();
  server.listen(port, host, () => {
    const actualPort = server.address().port;
    console.log(`GZW Data local server: http://${host}:${actualPort}`);
  });
}

module.exports = { createServer };
