// Kiddle-style "featured results" from Simple English Wikipedia (free, no key).
const { UNSAFE } = require('./search');
const NONE = { items: [], more: false, next: 0 };
const UA = 'KhojKidsSearch/1.0 (kid-friendly search; https://github.com/AnirudhKarthikofficial/Khoj)';
const cache = new Map();
const hits = new Map();

function limited(ip) {
  const now = Date.now();
  const w = (hits.get(ip) || []).filter((t) => now - t < 60000);
  w.push(now);
  hits.set(ip, w);
  if (hits.size > 5000) hits.clear();
  return w.length > 40;
}

async function featured(params, ip) {
  const q = String(params.q || '').replace(/\s+/g, ' ').trim().slice(0, 100);
  const offset = Math.min(Math.max(parseInt(params.offset, 10) || 0, 0), 30);
  if (!q || UNSAFE.test(q) || limited(ip || 'x')) return NONE;

  const key = q.toLowerCase() + '|' + offset;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < 6 * 3600e3) return hit.v;

  const p = new URLSearchParams({
    action: 'query', format: 'json', generator: 'search', gsrsearch: q, gsrnamespace: '0',
    gsrlimit: String(offset ? 5 : 3), gsroffset: String(offset),
    prop: 'pageimages|extracts|info', piprop: 'thumbnail', pithumbsize: '300',
    exintro: '1', explaintext: '1', exsentences: '3', exlimit: 'max', inprop: 'url',
  });
  const r = await fetch('https://simple.wikipedia.org/w/api.php?' + p, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  });
  if (!r.ok) { console.error('wikipedia error', r.status); return NONE; }
  const d = await r.json();

  const items = Object.values(d.query?.pages || {})
    .sort((a, b) => a.index - b.index)
    .filter((pg) => pg.extract && /^https:\/\//.test(pg.fullurl || '')
      && !/may (also )?refer to/i.test(pg.extract) && !UNSAFE.test(pg.title + ' ' + pg.extract))
    .map((pg) => ({ title: pg.title, url: pg.fullurl, snippet: pg.extract.replace(/\s+/g, ' ').trim(),
      thumb: /^https:\/\//.test(pg.thumbnail?.source || '') ? pg.thumbnail.source : undefined }));

  const next = d.continue?.gsroffset;
  const v = { items, more: typeof next === 'number' && next <= 30, next: next || 0 };
  if (cache.size > 500) cache.delete(cache.keys().next().value);
  cache.set(key, { t: Date.now(), v });
  return v;
}

async function handle(params, ip) {
  try { return await featured(params, ip); } catch (e) { console.error('featured error', e.message); return NONE; }
}

module.exports = { handle };
