// Vercel serverless entry point
const { handle } = require('../lib/speak');

module.exports = async (req, res) => {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'x';
  const buf = await handle(req.query || {}, ip);
  if (!buf) return res.status(503).end();
  res.setHeader('Content-Type', 'audio/wav');
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
  res.status(200).send(buf);
};
