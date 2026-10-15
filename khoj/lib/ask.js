// "Khoj says" - short kid-friendly answer from Gemini, grounded with Google Search.
const { UNSAFE, badDomain } = require('./search');
const env = process.env;
const MODEL = env.GEMINI_MODEL || 'gemini-2.5-flash';
const NONE = { answer: null, sources: [] };

const SYSTEM = 'You are Khoj, a friendly helper for kids aged 6 to 12. Use Google Search, then answer the ' +
  "question in 2 to 4 short, simple sentences a third grader can read. Be accurate and upbeat. Never include " +
  'anything scary, violent, sexual, or about drugs or gambling. If the question is not suitable for kids, ' +
  'reply with exactly: NOT_FOR_KIDS. Do not use markdown, lists, or emojis.';

const cache = new Map();
const hits = new Map();
let budget = { day: '', used: 0 };

function limited(ip) {
  const now = Date.now();
  const w = (hits.get(ip) || []).filter((t) => now - t < 60000);
  w.push(now);
  hits.set(ip, w);
  if (hits.size > 5000) hits.clear();
  return w.length > 10;
}

function spend(max) {
  const day = new Date().toISOString().slice(0, 10);
  if (budget.day !== day) budget = { day, used: 0 };
  if (budget.used >= max) return false;
  budget.used++;
  return true;
}

async function ask(params, ip) {
  const q = String(params.q || '').replace(/\s+/g, ' ').trim().slice(0, 100);
  if (!q || UNSAFE.test(q) || !env.GEMINI_API_KEY) return NONE;
  if (limited(ip || 'x')) return NONE;

  const key = q.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < 6 * 3600e3) return hit.v;
  if (!spend(parseInt(env.ASK_DAILY_LIMIT, 10) || 100)) return NONE;

  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: 'user', parts: [{ text: q }] }],
      tools: [{ google_search: {} }],
      safetySettings: ['HARM_CATEGORY_HARASSMENT', 'HARM_CATEGORY_HATE_SPEECH',
        'HARM_CATEGORY_SEXUALLY_EXPLICIT', 'HARM_CATEGORY_DANGEROUS_CONTENT']
        .map((category) => ({ category, threshold: 'BLOCK_LOW_AND_ABOVE' })),
      generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
    }),
  });
  if (!r.ok) { console.error('gemini error', r.status); return NONE; }

  const d = await r.json();
  const c = d.candidates?.[0];
  const text = (c?.content?.parts || []).map((p) => p.text || '').join('')
    .replace(/\*+/g, '').replace(/\s+/g, ' ').trim();
  if (!text || /NOT_FOR_KIDS/.test(text) || UNSAFE.test(text)) return NONE;

  const seen = new Set();
  const sources = (c.groundingMetadata?.groundingChunks || []).map((g) => g.web).filter(Boolean)
    .map((w) => ({ title: w.title || 'source', url: w.uri }))
    .filter((s) => /^https:\/\//.test(s.url) && !badDomain('https://' + s.title) && !seen.has(s.title) && seen.add(s.title))
    .slice(0, 3);

  const v = { answer: text, sources };
  if (cache.size > 500) cache.delete(cache.keys().next().value);
  cache.set(key, { t: Date.now(), v });
  return v;
}

async function handle(params, ip) {
  try { return await ask(params, ip); } catch (e) { console.error('ask error', e.message); return NONE; }
}

module.exports = { handle };
