// Local / any-Node-host server. No dependencies. Run: npm start
const http = require('http');
const fs = require('fs');
const path = require('path');
const { handle } = require('./lib/search');

const PUB = path.join(__dirname, 'public') + path.sep;
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };
const SEC = {
  'Content-Security-Policy': "default-src 'self'; img-src 'self' https: data:; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};

http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost');
  for (const [k, v] of Object.entries(SEC)) res.setHeader(k, v);

  if (u.pathname === '/api/search') {
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress;
    const out = await handle(Object.fromEntries(u.searchParams), ip);
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
