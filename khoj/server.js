// Local / any-Node-host server. No dependencies. Run: npm start
const http = require('http');
const fs = require('fs');
const path = require('path');
const { handle } = require('./lib/search');
const ask = require('./lib/ask');
const featured = require('./lib/featured');
const speak = require('./lib/speak');

const PUB = path.join(__dirname, 'public') + path.sep;
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };

http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress;

  if (u.pathname === '/api/speak') {
    const buf = await speak.handle(Object.fromEntries(u.searchParams), ip);
    if (!buf) { res.writeHead(503); return res.end(); }
    res.writeHead(200, { 'Content-Type': 'audio/wav', 'Cache-Control': 'public, max-age=86400' });
    return res.end(buf);
  }

  if (['/api/search', '/api/ask', '/api/featured'].includes(u.pathname)) {
    const params = Object.fromEntries(u.searchParams);
    const out = u.pathname === '/api/ask' ? { status: 200, body: await ask.handle(params, ip) }
      : u.pathname === '/api/featured' ? { status: 200, body: await featured.handle(params, ip) }
      : await handle(params, ip);
    res.writeHead(out.status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify(out.body));
  }

  const file = path.normalize(path.join(PUB, u.pathname === '/' ? 'index.html' : u.pathname));
  if (!file.startsWith(PUB)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(process.env.PORT || 3000, () => {
  console.log(`Khoj is running → http://localhost:${process.env.PORT || 3000}`);
});
