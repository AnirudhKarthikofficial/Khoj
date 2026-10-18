// Natural "Read to me" voice via Gemini text-to-speech. Returns a WAV Buffer, or null on any problem
// (the page then falls back to the browser's built-in voice).
const { UNSAFE } = require('./search');
const env = process.env;
const MODEL = env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts';
const VOICE = env.GEMINI_TTS_VOICE || 'Zephyr';

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

function wav(pcm, rate) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

async function speak(params, ip) {
  const text = String(params.text || '').replace(/\s+/g, ' ').trim().slice(0, 500);
  if (!text || UNSAFE.test(text) || !env.GEMINI_API_KEY || limited(ip || 'x')) return null;

  const hit = cache.get(text);
  if (hit) return hit;
  if (!spend(parseInt(env.SPEAK_DAILY_LIMIT, 10) || 100)) return null;

  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{ parts: [{ text: 'Say warmly and clearly, like a friendly teacher talking to a child: ' + text }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } },
      },
    }),
  });
  if (!r.ok) { console.error('gemini tts error', r.status); return null; }

  const d = await r.json();
  const part = d.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!part) return null;
  const rate = parseInt(/rate=(\d+)/.exec(part.inlineData.mimeType || '')?.[1], 10) || 24000;
  const buf = wav(Buffer.from(part.inlineData.data, 'base64'), rate);

  if (cache.size >= 30) cache.delete(cache.keys().next().value);
  cache.set(text, buf);
  return buf;
}

async function handle(params, ip) {
  try { return await speak(params, ip); } catch (e) { console.error('speak error', e.message); return null; }
}

module.exports = { handle };
