// Khoj search core: safety filters, caching, rate limits, Google + Brave providers.
const env = process.env;

const BLOCKED = [
  'porn\\w*', 'sex', 'sexy', 'sexual', 'sexually', 'sexting', 'xxx', 'nude\\w*', 'nsfw', 'hentai',
  'erotic\\w*', 'fetish\\w*', 'onlyfans', 'milf', 'boobs', 'nipples', 'penis', 'vagina', 'dildo',
  'orgasm\\w*', 'masturbat\\w*', 'cum', 'slut\\w*', 'whore', 'bitch\\w*', 'fuck\\w*', 'shit\\w*',
  'cock', 'pussy', 'dick', 'rape', 'raped', 'raping', 'rapist', 'gore', 'suicide', 'self.?harm',
  'cocaine', 'heroin', 'meth', 'marijuana', 'cannabis', 'vape\\w*', 'gambl\\w*', 'casino\\w*',
  'betting', 'torture', 'beheading\\w*',
];
const UNSAFE = new RegExp('\\b(?:' + BLOCKED.join('|') + ')\\b', 'i');
const BAD_DOMAINS = [
  'pornhub.com', 'xvideos.com', 'xnxx.com', 'xhamster.com', 'redtube.com', 'onlyfans.com',
  '4chan.org', '8kun.top', 'liveleak.com', 'bestgore.com', 'reddit.com', 'urbandictionary.com',
];

const strip = (s) => (s || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
  .replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
const isHttp = (u) => /^https?:\/\//i.test(u || '');
const isHttps = (u) => /^https:\/\//i.test(u || '');
const badDomain = (u) => BAD_DOMAINS.some((d) => host(u) === d || host(u).endsWith('.' + d));

class KhojError extends Error {
  constructor(status, kid) { super(kid); this.status = status; this.kid = kid; }
}

// ---------- providers ----------
async function google(q, type, page) {
  const p = new URLSearchParams({
    key: env.GOOGLE_API_KEY, cx: env.GOOGLE_CX, q, safe: 'active', hl: 'en',
    num: '10', start: String((page - 1) * 10 + 1),
  });
  if (type === 'image') p.set('searchType', 'image');
  const r = await fetch('https://www.googleapis.com/customsearch/v1?' + p);
  if (!r.ok) throw Object.assign(new Error('google ' + r.status), { upstream: r.status });
  const d = await r.json();
  const items = d.items || [];
  return {
    hasMore: items.length === 10 && page < 9,
    results: items.map((i) => type === 'image'
      ? { title: i.title, url: i.image?.contextLink || i.link, image: i.link,
          thumb: i.image?.thumbnailLink || i.link, source: host(i.image?.contextLink || i.link) }
      : { title: i.title, url: i.link, snippet: strip(i.snippet), source: i.displayLink,
          thumb: i.pagemap?.cse_thumbnail?.[0]?.src }),
  };
}

async function brave(q, type, page) {
  const img = type === 'image';
  const p = new URLSearchParams({
    q, safesearch: 'strict', count: img ? '30' : '10', search_lang: 'en', country: 'us',
  });
  if (!img) p.set('offset', String(page - 1));
  const r = await fetch(`https://api.search.brave.com/res/v1/${img ? 'images' : 'web'}/search?` + p, {
    headers: { Accept: 'application/json', 'X-Subscription-Token': env.BRAVE_API_KEY },
  });
  if (!r.ok) throw Object.assign(new Error('brave ' + r.status), { upstream: r.status });
  const d = await r.json();
  if (img) {
    return { hasMore: false, results: (d.results || []).map((i) => ({
      title: i.title, url: i.url, image: i.properties?.url || i.thumbnail?.src,
      thumb: i.thumbnail?.src, source: i.source || host(i.url) })) };
  }
  return {
    hasMore: Boolean(d.query?.more_results_available) && page < 9,
    results: (d.web?.results || []).map((i) => ({
      title: strip(i.title), url: i.url, snippet: strip(i.description),
      source: i.meta_url?.hostname || host(i.url), thumb: i.thumbnail?.src })),
  };
}

function provider() {
  if (env.GOOGLE_API_KEY && env.GOOGLE_CX) return { run: google, limit: 95 };
  if (env.BRAVE_API_KEY) return { run: brave, limit: 30 };
  return null;
}

// ---------- cache, rate limit, daily budget ----------
const cache = new Map();
const hits = new Map();
let budget = { day: '', used: 0 };

function limited(ip) {
  const now = Date.now();
  const w = (hits.get(ip) || []).filter((t) => now - t < 60000);
  w.push(now);
  hits.set(ip, w);
  if (hits.size > 5000) hits.clear();
  return w.length > 30;
}

function spend(max) {
  const day = new Date().toISOString().slice(0, 10);
  if (budget.day !== day) budget = { day, used: 0 };
  if (budget.used >= max) return false;
  budget.used++;
  return true;
}

// ---------- main ----------
async function search(params, ip) {
  const q = String(params.q || '').replace(/\s+/g, ' ').trim().slice(0, 100);
  const type = params.type === 'image' ? 'image' : 'web';
  const page = Math.min(Math.max(parseInt(params.page, 10) || 1, 1), 9);
  const easy = params.easy === '1' && type === 'web' && !/\bkids?\b/i.test(q);
  if (!q) throw new KhojError(400, 'Type something to search for!');
  if (UNSAFE.test(q)) return { blocked: true };
  if (limited(ip || 'x')) throw new KhojError(429, 'Whoa, slow down! Wait a few seconds and try again.');

  const prov = provider();
  if (!prov) throw new KhojError(500, 'Khoj needs a search key. Ask a grown-up to add one (see README).');

  const sent = easy ? q + ' for kids' : q;
  const key = [type, page, sent.toLowerCase()].join('|');
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < 6 * 3600e3) return hit.v;

  const max = parseInt(env.DAILY_LIMIT, 10) || prov.limit;
  if (!spend(max)) {
    throw new KhojError(429, 'Khoj is resting after a big day of searching. Come back tomorrow! 😴');
  }

  let out;
  try { out = await prov.run(sent, type, page); } catch (e) {
    console.error('provider error:', e.message);
    if (e.upstream === 403 || e.upstream === 429) {
      throw new KhojError(429, 'Khoj is resting after a big day of searching. Come back tomorrow! 😴');
    }
    throw new KhojError(502, 'Oops! Khoj tripped over a wire. Try again in a moment.');
  }

  const results = out.results.filter((r) => {
    if (!r.title || !isHttp(r.url) || badDomain(r.url)) return false;
    if (UNSAFE.test(r.title + ' ' + (r.snippet || ''))) return false;
    if (type === 'image' && !(isHttps(r.image) || isHttps(r.thumb))) return false;
    return true;
  }).map((r) => ({
    ...r,
    image: isHttps(r.image) ? r.image : r.thumb,
    thumb: isHttps(r.thumb) ? r.thumb : undefined,
  }));

  const v = { results, page, hasMore: out.hasMore };
  if (cache.size > 1000) cache.delete(cache.keys().next().value);
  cache.set(key, { t: Date.now(), v });
  return v;
}

async function handle(params, ip) {
  try { return { status: 200, body: await search(params, ip) }; } catch (e) {
    if (e instanceof KhojError) return { status: e.status, body: { error: e.kid } };
    console.error(e.message);
    return { status: 500, body: { error: 'Oops! Khoj tripped over a wire. Try again in a moment.' } };
  }
}

module.exports = { handle, UNSAFE, badDomain };
