(() => {
const $ = (s) => document.querySelector(s);
const app = $('#app'), lb = $('#lb');
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
};
const easy = () => store.get('khoj-easy') !== '0';
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let token = 0;

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

// tiny safe DOM builder (never uses innerHTML)
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

function go(s) {
  const u = new URLSearchParams();
  if (s.q) u.set('q', s.q);
  if (s.t === 'image') u.set('t', 'image');
  if (s.p > 1) u.set('p', s.p);
  const qs = u.toString();
  history.pushState(null, '', qs ? '?' + qs : location.pathname);
  render();
  window.scrollTo(0, 0);
}

const logo = (size) => h('a', { class: 'logo ' + size, href: location.pathname, 'aria-label': 'Khoj home',
  onclick: (e) => { e.preventDefault(); go({}); } }, [...'Khoj'].map((c, i) => h('span', { class: 'l' + i }, c)));

function bar(q) {
  const input = h('input', { type: 'search', name: 'q', value: q || '', maxlength: 100, autocomplete: 'off',
    autocapitalize: 'off', enterkeyhint: 'search', placeholder: 'What do you want to find out?', 'aria-label': 'Search Khoj' });
  const form = h('form', { class: 'bar', role: 'search', onsubmit: (e) => {
    e.preventDefault();
    const v = input.value.trim();
    if (v) go({ q: v, t: 'web', p: 1 });
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

function easyToggle() {
  const cb = h('input', { type: 'checkbox', id: 'easy', checked: easy() ? '' : null,
    onchange: (e) => { store.set('khoj-easy', e.target.checked ? '1' : '0'); if (new URLSearchParams(location.search).get('q')) render(); } });
  return h('label', { class: 'easy', for: 'easy', title: 'Finds pages that are easier to read' }, cb, 'Simple answers');
}

const foot = () => h('footer', { class: 'foot' },
  h('p', null, "Khoj has no accounts and doesn't save what you search for."),
  h('p', null, "Our filters are strong, but not perfect. If you see something weird, tell a grown-up."));

function speak(text, btn) {
  const s = window.speechSynthesis;
  if (!s) return;
  const wasOn = btn.dataset.on === '1';
  s.cancel();
  document.querySelectorAll('.say').forEach((b) => { b.dataset.on = ''; });
  if (wasOn) return;
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.9;
  u.onend = () => { btn.dataset.on = ''; };
  btn.dataset.on = '1';
  s.speak(u);
}

function openImage(r) {
  lb.replaceChildren(
    h('button', { class: 'x', type: 'button', 'aria-label': 'Close', onclick: () => lb.close() }, '✕'),
    h('img', { src: r.image || r.thumb, alt: r.title, referrerpolicy: 'no-referrer',
      onerror: (e) => { if (r.thumb && e.target.src !== r.thumb) e.target.src = r.thumb; } }),
    h('p', { class: 'cap' }, r.title),
    h('a', { class: 'go', href: r.url, target: '_blank', rel: 'noopener noreferrer' }, 'Visit website'));
  lb.showModal();
}
lb.addEventListener('click', (e) => { if (e.target === lb) lb.close(); });

function home() {
  const [fact, fq] = FACTS[Math.floor(Date.now() / 864e5) % FACTS.length];
  app.replaceChildren(h('main', { class: 'home' },
    logo('big'),
    h('img', { class: 'mascot', src: 'mascot.svg', alt: '', width: 120, height: 120 }),
    h('p', { class: 'tag' }, 'Search the web the safe way!'),
    bar(''), easyToggle(),
    h('section', { class: 'topics', 'aria-label': 'Pick a topic' },
      TOPICS.map(([e, n], i) => h('button', { class: 'tile c' + (i % 6), type: 'button', onclick: () => go({ q: n, t: 'web', p: 1 }) },
        h('span', { class: 'em', 'aria-hidden': 'true' }, e), n))),
    h('section', { class: 'fact' }, h('b', null, 'Did you know?'), h('p', null, fact),
      h('button', { type: 'button', onclick: () => go({ q: fq, t: 'web', p: 1 }) }, 'Learn more')),
    foot()));
  $('.bar input').focus();
}

function message(text, withTopics) {
  return h('div', { class: 'msg' },
    h('img', { src: 'mascot.svg', alt: '', width: 90, height: 90 }),
    h('p', null, text),
    withTopics ? h('div', { class: 'chips' }, TOPICS.slice(0, 6).map(([e, n]) =>
      h('button', { type: 'button', onclick: () => go({ q: n, t: 'web', p: 1 }) }, e + ' ' + n))) : null);
}

function card(r) {
  return h('article', { class: 'card' },
    h('div', { class: 'body' },
      h('a', { class: 'title', href: r.url, target: '_blank', rel: 'noopener noreferrer' }, r.title),
      h('div', { class: 'src' }, r.source),
      h('p', { class: 'snip' }, r.snippet),
      h('button', { class: 'say', type: 'button', onclick: (e) => speak(r.title + '. ' + r.snippet, e.currentTarget) }, '🔊 Read to me')),
    r.thumb ? h('img', { class: 'thumb', src: r.thumb, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer',
      onerror: (e) => e.target.remove() }) : null);
}

async function results(q, t, p) {
  const my = ++token;
  const tab = (label, type) => h('button', { type: 'button', 'aria-current': t === type ? 'page' : null,
    onclick: () => go({ q, t: type, p: 1 }) }, label);
  const main = h('main', { class: 'res' }, h('p', { class: 'status' }, 'Looking for answers… 🔎'));
  app.replaceChildren(
    h('header', { class: 'top' }, logo('small'), bar(q), easyToggle()),
    h('nav', { class: 'tabs', 'aria-label': 'Result type' }, tab('Web', 'web'), tab('Pictures', 'image')),
    main, foot());

  let d;
  try {
    const r = await fetch('/api/search?' + new URLSearchParams({ q, type: t, page: p, easy: easy() ? 1 : 0 }));
    d = await r.json();
  } catch { d = { error: "Can't reach Khoj right now. Check your internet and try again." }; }
  if (my !== token) return;

  if (d.blocked) return main.replaceChildren(message("Oops! Khoj can't search for that. Try one of these instead:", true));
  if (d.error) return main.replaceChildren(message(d.error, false));
  if (!d.results.length) return main.replaceChildren(message('Hmm, nothing found. Try different words!', true));

  const body = t === 'image'
    ? h('div', { class: 'grid' }, d.results.map((r) => h('button', { type: 'button', 'aria-label': r.title, onclick: () => openImage(r) },
        h('img', { src: r.thumb || r.image, alt: r.title, loading: 'lazy', referrerpolicy: 'no-referrer',
          onerror: (e) => e.target.closest('button').remove() }))))
    : h('div', { class: 'list' }, d.results.map(card));

  const more = t === 'web' ? h('div', { class: 'chips' }, ['facts about ' + q, 'how does ' + q + ' work', 'what is ' + q].map((s) =>
    h('button', { type: 'button', onclick: () => go({ q: s.slice(0, 100), t: 'web', p: 1 }) }, s))) : null;
  const pager = (p > 1 || d.hasMore) ? h('div', { class: 'pager' },
    p > 1 ? h('button', { type: 'button', onclick: () => go({ q, t, p: p - 1 }) }, '← Back') : null,
    h('span', null, 'Page ' + p),
    d.hasMore ? h('button', { type: 'button', onclick: () => go({ q, t, p: p + 1 }) }, 'Next →') : null) : null;
  main.replaceChildren(body, pager, more);
}

function render() {
  const P = new URLSearchParams(location.search);
  const q = (P.get('q') || '').trim().slice(0, 100);
  const t = P.get('t') === 'image' ? 'image' : 'web';
  const p = Math.max(1, parseInt(P.get('p'), 10) || 1);
  document.title = q ? q + ' – Khoj' : 'Khoj – Search made safe for kids';
  if (q) results(q, t, p); else home();
}

window.addEventListener('popstate', render);
render();
})();
