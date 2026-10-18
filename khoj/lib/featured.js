// Kiddle-style "featured results" from a fixed list of kid-safe sites (via Brave Search).
// No BRAVE_API_KEY = this section stays hidden (the Google box still searches your kid sites).
const { UNSAFE } = require('./search');
const env = process.env;
const NONE = { items: [], more: false, next: 0 };

// Edit this list to add/remove kid-safe sites.
const ALLOW = [
  'kids.britannica.com', 'kids.nationalgeographic.com', 'natgeokids.com', 'spaceplace.nasa.gov',
  'climatekids.nasa.gov', 'dkfindout.com', 'ducksters.com', 'sciencekids.co.nz', 'mathsisfun.com',
  'kidskonnect.com', 'sciencenewsforstudents.org',
];

const strip = (s) => (s || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
  .replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
const allowed = (u) => /^https:\/\//.test(u || '') && ALLOW.some((d) => host(u) === d || host(u).endsWith('.' + d));

const cache = new Map();
const hits = new Map();
let budget = { day: '', used: 0 };

function limited(ip) {
  const now = Date.now();
  const w = (hits.get(ip) || []).filter((t) => now - t < 60000);
  w.push(now);
  hits.set(ip, w);
  if (hits.size > 5000) hits.clear();
  return w.length > 40;
}

function spend(max) {
  const day = new Date().toISOString().slice(0, 10);
  if (budget.day !== day) budget = { day, used: 0 };
  if (budget.used >= max) return false;
  budget.used++;
  return true;
}

async function featured(params, ip) {
  const q = String(params.q || '').replace(/\s+/g, ' ').trim().slice(0, 100);
  const offset = Math.min(Math.max(parseInt(params.offset, 10) || 0, 0), 30);
  if (!q || UNSAFE.test(q) || !env.BRAVE_API_KEY || limited(ip || 'x')) return NONE;

  let list;
  const hit = cache.get(q.toLowerCase());
  if (hit && Date.now() - hit.t < 6 * 3600e3) list = hit.list;
  else {
    if (!spend(parseInt(env.FEATURED_DAILY_LIMIT, 10) || 30)) return NONE;
    const p = new URLSearchParams({
      q: `${q} (${ALLOW.map((d) => 'site:' + d).join(' OR ')})`,
      count: '20', safesearch: 'strict', search_lang: 'en', country: 'us',
    });
    const r = await fetch('https://api.search.brave.com/res/v1/web/search?' + p, {
      headers: { Accept: 'application/json', 'X-Subscription-Token': env.BRAVE_API_KEY },
    });
    if (!r.ok) { console.error('brave featured error', r.status); return NONE; }
    const d = await r.json();
    list = (d.web?.results || [])
      .filter((i) => allowed(i.url))
      .map((i) => ({ title: strip(i.title), url: i.url, snippet: strip(i.description),
        thumb: /^https:\/\//.test(i.thumbnail?.src || '') ? i.thumbnail.src : undefined }))
      .filter((i) => i.title && i.snippet && !UNSAFE.test(i.title + ' ' + i.snippet));
    if (cache.size > 500) cache.delete(cache.keys().next().value);
    cache.set(q.toLowerCase(), { t: Date.now(), list });
  }

  const end = offset + (offset ? 5 : 3);
  return { items: list.slice(offset, end), more: list.length > end, next: end };
}

async function handle(params, ip) {
  try { return await featured(params, ip); } catch (e) { console.error('featured error', e.message); return NONE; }
}

module.exports = { handle };
