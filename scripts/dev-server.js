const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const apiHandler = require('../api/index.js');

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
  const requestPath = decodeURIComponent(new URL(req.url, `http://${host}`).pathname);
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
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api')) return apiHandler(req, adaptResponse(res));
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
  return serveStatic(req, res);
});

server.listen(port, host, () => {
  console.log(`GZW Data local server: http://${host}:${port}`);
  console.log(`Playground: http://${host}:${port}/playground/`);
  console.log(`API: http://${host}:${port}/api/v1/health`);
});
