// Vercel serverless entry point
const { handle } = require('../lib/search');

module.exports = async (req, res) => {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'x';
  const out = await handle(req.query || {}, ip);
  res.setHeader('Cache-Control', 'no-store');
  res.status(out.status).json(out.body);
};
