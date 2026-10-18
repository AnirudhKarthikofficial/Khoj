(() => {
const $ = (s) => document.querySelector(s);
const app = $('#app');
const UNSAFE = /\b(?:porn\w*|sex|sexy|sexual|sexually|sexting|xxx|nude\w*|nsfw|hentai|erotic\w*|fetish\w*|onlyfans|milf|boobs|nipples|penis|vagina|dildo|orgasm\w*|masturbat\w*|cum|slut\w*|whore|bitch\w*|fuck\w*|shit\w*|cock|pussy|dick|rape|raped|raping|rapist|gore|suicide|self.?harm|cocaine|heroin|meth|marijuana|cannabis|vape\w*|gambl\w*|casino\w*|betting|torture|beheading\w*)\b/i;
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let askToken = 0, featToken = 0;

const TOPICS = [['🦁','Animals'],['🚀','Space'],['🦖','Dinosaurs'],['🔬','Science'],['➗','Math'],['🎨','Art'],
  ['🏰','History'],['⚽','Sports'],['🎵','Music'],['🌋','Volcanoes'],['🫀','Human body'],['🌎','Countries']];
const FACTS = [
  ['An octopus has three hearts.', 'octopus'],
  ['Honey found in ancient Egyptian tombs was still good to eat.', 'honey'],
  ['A day on Venus is longer than a year on Venus.', 'Venus'],
  ['Bananas are berries, but strawberries are not!', 'berries'],
  ['Sharks are older than trees.', 'sharks'],
  ['Lightning can be about five times hotter than the surface of the Sun.', 'lightning'],
  ['Wombat poop is shaped like little cubes.', 'wombat'],
  ['Jupiter has a giant storm that is bigger than Earth.', 'Jupiter Great Red Spot'],
  ['A group of flamingos is called a flamboyance.', 'flamingo'],
  ['Butterflies taste with their feet.', 'butterfly'],
  ['Your heart beats about 100,000 times every day.', 'human heart'],
  ['Space is silent because sound needs air to travel.', 'sound in space'],
];

function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  for (const c of kids.flat()) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(c));
  }
  return el;
}

// Google Search Element hooks: block unsafe queries before Google sees them
function guard(_name, query) {
  if (UNSAFE.test(query || '')) {
    $('#blocked').hidden = false;
    document.body.classList.add('blocked');
    return 'kids';
  }
  return query;
}
window.__gcse = { parsetags: 'onload', searchCallbacks: { web: { starting: guard }, image: { starting: guard } } };

function exec(q, n = 0) {
  const el = window.google?.search?.cse?.element?.getElement('khoj');
  if (el) el.execute(q);
  else if (n < 30) setTimeout(() => exec(q, n + 1), 300);
}

function go(q) {
  history.pushState(null, '', q ? '?' + new URLSearchParams({ q }) : location.pathname);
  render();
  window.scrollTo(0, 0);
}

const logo = (size) => h('a', { class: 'logo ' + size, href: location.pathname, 'aria-label': 'Khoj home',
  onclick: (e) => { e.preventDefault(); go(''); } }, [...'Khoj'].map((c, i) => h('span', { class: 'l' + i }, c)));

function bar(q) {
  const input = h('input', { type: 'search', name: 'q', value: q || '', maxlength: 100, autocomplete: 'off',
    autocapitalize: 'off', enterkeyhint: 'search', placeholder: 'What do you want to find out?', 'aria-label': 'Search Khoj' });
  const form = h('form', { class: 'bar', role: 'search', onsubmit: (e) => {
    e.preventDefault();
    const v = input.value.trim();
    if (v) go(v);
  } }, input);
  if (SR) {
    const mic = h('button', { class: 'mic', type: 'button', 'aria-label': 'Search with your voice', title: 'Say it!' }, '🎤');
    mic.addEventListener('click', () => {
      const r = new SR();
      r.lang = 'en-US';
      r.onresult = (e) => { input.value = e.results[0][0].transcript; form.requestSubmit(); };
      r.onend = () => mic.classList.remove('on');
      mic.classList.add('on');
      try { r.start(); } catch { mic.classList.remove('on'); }
    });
    form.append(mic);
  }
  form.append(h('button', { class: 'go', type: 'submit' }, 'Search'));
  return form;
}

let player = null;
function stopSpeech() {
  if (player) { player.pause(); player = null; }
  window.speechSynthesis?.cancel();
  document.querySelectorAll('.say').forEach((b) => { b.dataset.on = ''; });
}

function browserSpeak(text, btn) {
  const s = window.speechSynthesis;
  if (!s) { btn.dataset.on = ''; return; }
  const en = s.getVoices().filter((v) => /^en/i.test(v.lang));
  const pick = en.find((v) => /natural|neural|online/i.test(v.name))
    || en.find((v) => /google us english|samantha|aria|jenny/i.test(v.name))
    || en.find((v) => /^en-US/i.test(v.lang));
  const u = new SpeechSynthesisUtterance(text);
  if (pick) u.voice = pick;
  u.rate = 0.95;
  u.onend = () => { btn.dataset.on = ''; };
  s.speak(u);
}

function speak(text, btn) {
  const wasOn = btn.dataset.on === '1';
  stopSpeech();
  if (wasOn) return;
  btn.dataset.on = '1';
  const a = new Audio('/api/speak?' + new URLSearchParams({ text: text.slice(0, 500) }));
  player = a;
  const fallback = () => { if (player === a) { player = null; browserSpeak(text, btn); } };
  a.onended = () => { btn.dataset.on = ''; if (player === a) player = null; };
  a.onerror = fallback;
  a.play().catch(fallback);
}

async function ask(q) {
  const my = ++askToken;
  const box = $('#answer'), ans = $('#ans'), srcs = $('#srcs'), say = $('#say');
  box.hidden = false;
  ans.textContent = 'Thinking… 🤔';
  srcs.replaceChildren();
  say.hidden = true;
  try {
    const r = await fetch('/api/ask?' + new URLSearchParams({ q }));
    const d = await r.json();
    if (my !== askToken) return;
    if (!d.answer) { box.hidden = true; return; }
    ans.textContent = d.answer;
    if (d.sources?.length) {
      srcs.append('Sources: ', ...d.sources.map((s) => h('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer' }, s.title)));
    }
    say.hidden = false;
    say.onclick = () => speak(d.answer, say);
  } catch { if (my === askToken) box.hidden = true; }
}

const fcard = (r, first) => h('article', { class: 'fcard' },
  r.thumb ? h('img', { src: r.thumb, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer', onerror: (e) => e.target.remove() }) : null,
  h('div', { class: 'fbody' },
    h('a', { class: 't', href: r.url, target: '_blank', rel: 'noopener noreferrer' }, r.title),
    first ? h('div', { class: 'badge' }, 'featured result') : null,
    h('p', null, r.snippet),
    h('div', { class: 'u' }, r.url)));

async function featured(q, offset = 0) {
  const my = offset ? featToken : ++featToken;
  const box = $('#featured'), list = $('#flist'), btn = $('#more');
  if (!offset) { list.replaceChildren(); box.hidden = true; }
  try {
    const d = await (await fetch('/api/featured?' + new URLSearchParams({ q, offset }))).json();
    if (my !== featToken || (!d.items?.length && !offset)) return;
    d.items.forEach((r, i) => list.append(fcard(r, !offset && i === 0)));
    box.hidden = false;
    btn.hidden = !d.more;
    btn.onclick = () => { btn.disabled = true; featured(q, d.next).finally(() => { btn.disabled = false; }); };
  } catch {}
}

function home() {
  const [fact, fq] = FACTS[Math.floor(Date.now() / 864e5) % FACTS.length];
  app.replaceChildren(h('main', { class: 'home' },
    logo('big'),
    h('img', { class: 'mascot', src: 'mascot.svg', alt: '', width: 120, height: 120 }),
    h('p', { class: 'tag' }, 'Search the web the safe way!'),
    bar(''),
    h('section', { class: 'topics', 'aria-label': 'Pick a topic' },
      TOPICS.map(([e, n], i) => h('button', { class: 'tile c' + (i % 6), type: 'button', onclick: () => go(n) },
        h('span', { class: 'em', 'aria-hidden': 'true' }, e), n))),
    h('section', { class: 'fact' }, h('b', null, 'Did you know?'), h('p', null, fact),
      h('button', { type: 'button', onclick: () => go(fq) }, 'Learn more'))));
  $('.bar input').focus();
}

function render() {
  const q = (new URLSearchParams(location.search).get('q') || '').trim().slice(0, 100);
  document.title = q ? q + ' – Khoj' : 'Khoj – Search made safe for kids';
  stopSpeech();
  document.body.classList.toggle('home', !q);
  if (!q) { home(); return; }
  app.replaceChildren(h('header', { class: 'top' }, logo('small'), bar(q)));
  const bad = UNSAFE.test(q);
  $('#blocked').hidden = !bad;
  document.body.classList.toggle('blocked', bad);
  $('#answer').hidden = true;
  $('#featured').hidden = true;
  if (bad) return;
  ask(q);
  featured(q);
  exec(q);
}

window.addEventListener('popstate', render);
render();
})();
