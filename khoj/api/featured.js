// Vercel serverless entry point
const { handle } = require('../lib/featured');

module.exports = async (req, res) => {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'x';
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json(await handle(req.query || {}, ip));
};
