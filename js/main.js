// Steven Widinata — site scripts
'use strict';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Language (EN/ID) ---------- */
let lang = 'en';
const t = (s) => (lang === 'id' && ID[s]) || s;

(() => {
  const norm = (s) => s.replace(/\s+/g, ' ').trim();
  const EN_META = { title: document.title, description: $('meta[name="description"]').content };

  // 1. Elements whose inner markup is a key (e.g. headings with a gradient span)
  const els = $$('body *').filter((el) => el.children.length && !el.closest('svg, script') && ID[norm(el.innerHTML)]);
  els.forEach((el) => { el.dataset.i18nEl = ''; el._en = norm(el.innerHTML); });

  // 2. Plain text nodes outside those elements
  const texts = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = walker.nextNode());) {
    const key = norm(n.nodeValue);
    if (key && ID[key] && !n.parentElement.closest('[data-i18n-el], script')) {
      const [, lead, trail] = n.nodeValue.match(/^(\s*)[\s\S]*?(\s*)$/);
      texts.push({ n, key, lead, trail });
    }
  }

  // 3. Attributes
  const attrs = [];
  $$('[aria-label], img[alt]').forEach((el) => ['aria-label', 'alt'].forEach((a) => {
    const v = el.getAttribute(a);
    if (v && ID[v]) attrs.push({ el, a, key: v });
  }));

  const btn = $('.lang-toggle');
  const apply = (next) => {
    lang = next;
    const id = lang === 'id';
    document.documentElement.lang = lang;
    els.forEach((el) => { el.innerHTML = id ? ID[el._en] : el._en; });
    texts.forEach(({ n, key, lead, trail }) => { n.nodeValue = lead + (id ? ID[key] : key) + trail; });
    attrs.forEach(({ el, a, key }) => el.setAttribute(a, id ? ID[key] : key));
    const meta = id ? ID_META : EN_META;
    document.title = meta.title;
    $('meta[name="description"]').content = meta.description;
    btn.textContent = id ? 'ID' : 'EN';
    btn.setAttribute('aria-label', id ? 'Ganti bahasa ke English' : 'Switch language to Bahasa Indonesia');
  };

  btn.addEventListener('click', () => {
    const next = lang === 'id' ? 'en' : 'id';
    localStorage.setItem('lang', next);
    apply(next);
  });
  apply(localStorage.getItem('lang') || (navigator.language.toLowerCase().startsWith('id') ? 'id' : 'en'));
})();

/* ---------- Theme toggle (circular reveal via View Transitions) ---------- */
(() => {
  const btn = $('.theme-toggle');
  if (!btn) return;
  const root = document.documentElement;

  const setTheme = (theme) => {
    root.dataset.theme = theme;
    localStorage.setItem('theme', theme);
    btn.setAttribute('aria-pressed', theme === 'light');
  };
  btn.setAttribute('aria-pressed', root.dataset.theme === 'light');

  btn.addEventListener('click', (e) => {
    const next = root.dataset.theme === 'light' ? 'dark' : 'light';
    if (!document.startViewTransition || reduceMotion) return setTheme(next);

    const rect = btn.getBoundingClientRect();
    const x = e.clientX || rect.left + rect.width / 2;
    const y = e.clientY || rect.top + rect.height / 2;
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));

    document.startViewTransition(() => setTheme(next)).ready.then(() => {
      root.animate(
        { clipPath: [`circle(0 at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 650, easing: 'cubic-bezier(.22,1,.36,1)', pseudoElement: '::view-transition-new(root)' }
      );
    });
  });

  // Follow OS changes until the user picks a theme
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
    if (!localStorage.getItem('theme')) root.dataset.theme = e.matches ? 'light' : 'dark';
  });
})();


/* ---------- Header: scrolled state, mobile menu, active link ---------- */
(() => {
  const header = $('.header');
  const nav = $('#nav');
  const toggle = $('.menu-toggle');

  const onScroll = () => header.classList.toggle('is-scrolled', scrollY > 20);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const setMenu = (open) => {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', open);
    toggle.setAttribute('aria-label', t(open ? 'Close menu' : 'Open menu'));
    document.body.classList.toggle('menu-open', open);
  };
  toggle.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
  $$('.nav__link').forEach((a) => a.addEventListener('click', () => setMenu(false)));
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) { setMenu(false); toggle.focus(); }
  });

  // Highlight the link of the section currently in view
  const links = new Map($$('.nav__link').map((a) => [a.hash.slice(1), a]));
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      links.forEach((a) => { a.classList.remove('is-active'); a.removeAttribute('aria-current'); });
      const a = links.get(en.target.id);
      if (a) { a.classList.add('is-active'); a.setAttribute('aria-current', 'true'); }
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  $$('main section[id]').forEach((s) => spy.observe(s));
})();


/* ---------- Star sky (whole page): drag & throw stars; color follows height (top = rose, bottom = emerald) ---------- */
(() => {
  const canvas = $('.sky');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const LINK = 130, REACH = 200, GRAB = 22;
  let w, h, dpr, stars = [], base, top, bottom;
  const pointer = { x: -9999, y: -9999 };
  let held = null, prev = null;

  const triplet = (cs, k) => cs.getPropertyValue(k).split(',').map(Number);
  const readColors = () => {
    const cs = getComputedStyle(document.documentElement);
    base = triplet(cs, '--star'); top = triplet(cs, '--star-top'); bottom = triplet(cs, '--star-bottom');
  };
  // middle band stays neutral; colour ramps in toward the edges
  const colorFor = (y) => {
    const t = (y / h - .5) * 2;                    // -1 top … 1 bottom
    const k = Math.min(1, Math.max(0, (Math.abs(t) - .12) / .6));
    const f = k * k * (3 - 2 * k);                 // smoothstep
    const to = t < 0 ? top : bottom;
    return base.map((v, i) => Math.round(v + (to[i] - v) * f));
  };

  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    const ow = w, oh = h;
    w = innerWidth; h = innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (ow) { stars.forEach((s) => { s.x *= w / ow; s.y *= h / oh; }); return; }
    const count = Math.min(170, Math.round((w * h) / 8500));
    const drift = reduceMotion ? 0 : .18;
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: 0, vy: 0, dx: (Math.random() - .5) * drift, dy: (Math.random() - .5) * drift,
      r: Math.random() * 1.4 + .5, tw: Math.random() * Math.PI * 2,
    }));
  };

  const draw = (t) => {
    ctx.clearRect(0, 0, w, h);
    for (const s of stars) {
      if (s !== held) {
        // thrown velocity decays back to the gentle drift
        s.vx *= .95; s.vy *= .95;
        s.x += s.vx + s.dx; s.y += s.vy + s.dy;
        if (s.x < 0 || s.x > w) { s.vx *= -.7; s.x = Math.min(w, Math.max(0, s.x)); s.dx *= -1; }
        if (s.y < 0 || s.y > h) { s.vy *= -.7; s.y = Math.min(h, Math.max(0, s.y)); s.dy *= -1; }
      }
      s.near = s === held ? 1 : Math.max(0, 1 - Math.hypot(s.x - pointer.x, s.y - pointer.y) / REACH);
      s.c = colorFor(s.y).join(',');
      const alpha = Math.min(1, .45 + .3 * Math.sin(t / 900 + s.tw) + s.near * .5);
      const r = s.r + s.near * 1.4 + (s === held ? 2 : 0);
      if (s.near > .3 || s === held) { // halo
        ctx.beginPath(); ctx.arc(s.x, s.y, r * 4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${s.c}, ${s.near * .12})`; ctx.fill();
      }
      ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${s.c}, ${alpha})`; ctx.fill();
    }
    for (let i = 0; i < stars.length; i++) {
      const a = stars[i];
      if (!a.near) continue;
      for (let j = i + 1; j < stars.length; j++) {
        const b = stars[j];
        if (!b.near) continue;
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d > LINK) continue;
        const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y); // line blends both star colours
        const o = (1 - d / LINK) * Math.min(a.near, b.near) * .9;
        g.addColorStop(0, `rgba(${a.c}, ${o})`); g.addColorStop(1, `rgba(${b.c}, ${o})`);
        ctx.strokeStyle = g; ctx.lineWidth = .9;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }
  };

  let running = false;
  const loop = (t) => { if (!running) return; draw(t); requestAnimationFrame(loop); };
  const start = () => { if (!running && !document.hidden) { running = true; requestAnimationFrame(loop); } };
  document.addEventListener('visibilitychange', () => (document.hidden ? (running = false) : start()));

  // --- dragging (mouse, pen, touch) ---
  const hit = (x, y) => {
    let best = null, bd = GRAB;
    for (const s of stars) { const d = Math.hypot(s.x - x, s.y - y); if (d < bd) { bd = d; best = s; } }
    return best;
  };
  const interactive = (el) => el.closest('a, button, input, textarea, select, label, [data-no-drag]');
  const grab = (x, y, target) => {
    if (interactive(target)) return false;
    const s = hit(x, y);
    if (!s) return false;
    held = s; s.vx = s.vy = 0; prev = { x, y, t: performance.now() };
    document.documentElement.classList.add('is-dragging-star');
    return true;
  };
  const move = (x, y) => {
    pointer.x = x; pointer.y = y;
    document.documentElement.classList.toggle('over-star', !held && !!hit(x, y));
    if (!held) return;
    const now = performance.now(), dt = Math.max(16, now - prev.t);
    held.vx = (x - prev.x) / dt * 16; held.vy = (y - prev.y) / dt * 16;
    held.x = x; held.y = y; prev = { x, y, t: now };
  };
  const release = () => {
    if (!held) return;
    held.vx = Math.max(-25, Math.min(25, held.vx)); held.vy = Math.max(-25, Math.min(25, held.vy));
    held = null;
    document.documentElement.classList.remove('is-dragging-star');
  };

  addEventListener('pointerdown', (e) => { if (e.pointerType !== 'touch' && grab(e.clientX, e.clientY, e.target)) e.preventDefault(); });
  addEventListener('pointermove', (e) => { if (e.pointerType !== 'touch') move(e.clientX, e.clientY); }, { passive: true });
  addEventListener('pointerup', release);
  document.addEventListener('pointerleave', () => { pointer.x = pointer.y = -9999; release(); });
  // touch: only block scrolling when a star is actually grabbed
  addEventListener('touchstart', (e) => { const p = e.touches[0]; if (e.touches.length === 1 && grab(p.clientX, p.clientY, e.target)) e.preventDefault(); }, { passive: false });
  addEventListener('touchmove', (e) => { if (held) { e.preventDefault(); move(e.touches[0].clientX, e.touches[0].clientY); } }, { passive: false });
  addEventListener('touchend', () => { release(); pointer.x = pointer.y = -9999; });

  readColors(); resize(); start();
  addEventListener('resize', resize);
  new MutationObserver(readColors).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
})();
/* ---------- Journey: the path fills and stars light up as you scroll ---------- */
(() => {
  const line = $('.timeline');
  if (!line) return;
  const items = $$('.timeline__item', line);
  let ticking = false;

  const update = () => {
    ticking = false;
    const r = line.getBoundingClientRect();
    const mark = innerHeight * .6; // the "reading point" on screen
    const p = Math.min(1, Math.max(0, (mark - r.top) / r.height));
    line.style.setProperty('--progress', p.toFixed(4));
    items.forEach((it) => {
      const star = $('.timeline__star', it).getBoundingClientRect();
      it.classList.toggle('is-lit', star.top < mark);
    });
  };
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  update();
})();


/* ---------- Toast + copy-to-clipboard (Discord has no profile URL) ---------- */
const toast = (() => {
  const el = $('.toast');
  let timer;
  return (msg) => {
    el.textContent = msg;
    el.classList.add('is-visible');
    clearTimeout(timer);
    timer = setTimeout(() => el.classList.remove('is-visible'), 2200);
  };
})();

$$('[data-copy]').forEach((btn) => btn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(btn.dataset.copy);
    toast(`${t('Copied to clipboard')}: ${btn.dataset.copy}`);
  } catch {
    toast(`Discord: ${btn.dataset.copy}`);
  }
}));

$$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });

/* ---------- Scroll reveal + count-up stats ---------- */
(() => {
  const countUp = (el) => {
    const end = +el.dataset.count;
    if (reduceMotion) return;
    const t0 = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - t0) / 1200);
      el.textContent = Math.round(end * (1 - (1 - p) ** 3));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const io = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (!en.isIntersecting) return;
    en.target.classList.add('is-in');
    setTimeout(() => { en.target.style.transitionDelay = ''; }, 1200); // keep hover snappy afterwards
    $$('[data-count]', en.target).forEach(countUp);
    io.unobserve(en.target);
  }), { threshold: .12, rootMargin: '0px 0px -40px 0px' });

  // stagger siblings inside the same grid
  $$('.reveal').forEach((el) => {
    const i = [...el.parentElement.children].filter((c) => c.classList.contains('reveal')).indexOf(el);
    el.style.transitionDelay = `${Math.min(i, 4) * 80}ms`;
    io.observe(el);
  });
})();

/* ---------- Cursor spotlight on cards (pointer devices only) ---------- */
if (matchMedia('(hover: hover)').matches) {
  $$('.project, .award, .next__item, .about__story, .about__profile, .about__strengths').forEach((card) => {
    card.classList.add('spot');
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });
}

/* ---------- Cursor grid glow (whole page): cells light up and fade, colored by screen position ---------- */
(() => {
  const canvas = $('.grid-glow');
  if (!canvas || reduceMotion || !matchMedia('(hover: hover)').matches) return;
  const ctx = canvas.getContext('2d');
  const CELL = 64;
  const RADIUS = 2.6;  // in cells
  let cols, rows, heat, w, h, dpr, last = null, running = false, palette = [];

  const hex = (v) => { const n = parseInt(v.trim().slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const readPalette = () => {
    const cs = getComputedStyle(document.documentElement);
    palette = ['--cyan', '--violet', '--pink'].map((k) => hex(cs.getPropertyValue(k)));
  };
  // left→right: cyan → violet → pink
  const colorAt = (x) => {
    const t = Math.min(1, Math.max(0, x / w)) * 2;
    const [a, b] = t < 1 ? [palette[0], palette[1]] : [palette[1], palette[2]];
    const f = t < 1 ? t : t - 1;
    return a.map((v, i) => Math.round(v + (b[i] - v) * f)).join(',');
  };

  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    w = innerWidth; h = innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.ceil(w / CELL) + 1; rows = Math.ceil(h / CELL) + 1;
    heat = new Float32Array(cols * rows);
  };

  const heatAt = (x, y, strength) => {
    const cx = x / CELL, cy = y / CELL;
    for (let r = Math.max(0, Math.floor(cy - RADIUS)); r <= Math.min(rows - 1, cy + RADIUS); r++) {
      for (let c = Math.max(0, Math.floor(cx - RADIUS)); c <= Math.min(cols - 1, cx + RADIUS); c++) {
        // ring falloff measured from cell centre
        const d = Math.hypot(c + .5 - cx, r + .5 - cy) / RADIUS;
        if (d < 1) { const i = r * cols + c; heat[i] = Math.min(1, Math.max(heat[i], (1 - d) ** 1.6 * strength)); }
      }
    }
  };

  const frame = () => {
    ctx.clearRect(0, 0, w, h);
    const light = document.documentElement.dataset.theme === 'light';
    let alive = false;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c, v = heat[i];
        if (v < .01) { heat[i] = 0; continue; }
        alive = true;
        ctx.fillStyle = `rgba(${colorAt(c * CELL)}, ${v * (light ? .28 : .5)})`;
        ctx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 1, CELL - 1);
        heat[i] = v * .94; // fade → trail
      }
    }
    if (alive) requestAnimationFrame(frame); else running = false;
  };
  const kick = () => { if (!running) { running = true; requestAnimationFrame(frame); } };

  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    // faster movement = brighter, longer trail; interpolate so quick swipes leave no gaps
    const speed = last ? Math.hypot(e.clientX - last.x, e.clientY - last.y) : 0;
    const strength = Math.min(1, .55 + speed / 60);
    const steps = last ? Math.min(12, Math.ceil(speed / (CELL / 2))) : 1;
    for (let s = 1; s <= steps; s++) {
      const x = last ? last.x + (e.clientX - last.x) * (s / steps) : e.clientX;
      const y = last ? last.y + (e.clientY - last.y) * (s / steps) : e.clientY;
      heatAt(x, y, strength);
    }
    last = { x: e.clientX, y: e.clientY };
    kick();
  }, { passive: true });
  document.addEventListener('pointerleave', () => { last = null; });

  readPalette(); resize();
  addEventListener('resize', resize);
  new MutationObserver(readPalette).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
})();


/* ---------- Rolling tagline: letters spin like a slot machine and land left → right ---------- */
(() => {
  const groups = $$('[data-roll]');
  if (!groups.length) return;
  const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789*#%&@';
  const letters = [];

  groups.forEach((g) => {
    const text = g.textContent;
    g.textContent = '';
    g.setAttribute('aria-hidden', 'true'); // parent <p> carries the aria-label
    [...text].forEach((ch, i) => {
      const s = document.createElement('span');
      s.className = 'roll__ch';
      s.textContent = ch;
      s.dataset.ch = ch;
      if (g.classList.contains('roll--grad')) {
        // per-letter gradient (background-clip breaks on transformed children)
        const t = i / Math.max(1, text.length - 1);
        s.style.color = t < .5
          ? `color-mix(in oklab, var(--violet) ${t * 200}%, var(--cyan))`
          : `color-mix(in oklab, var(--pink) ${(t - .5) * 200}%, var(--violet))`;
      }
      g.append(s);
      letters.push(s);
    });
  });
  if (reduceMotion) return;

  // lock each slot's width to its real letter so random glyphs don't shift the line
  const lock = () => letters.forEach((s) => { s.style.width = ''; s.textContent = s.dataset.ch; s.style.width = `${s.getBoundingClientRect().width}px`; });
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(lock);
  addEventListener('resize', lock);
  const pick = (ch) => {
    const pool = ch === ch.toLowerCase() ? 'abcdefghijklmnopqrstuvwxyz' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    return /[a-z]/i.test(ch) ? pool[Math.floor(Math.random() * pool.length)] : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
  };

  const rollAll = () => {
    letters.forEach((s, i) => {
      if (s.dataset.ch === ' ') return;
      setTimeout(() => {
        s.classList.remove('is-rolling'); void s.offsetWidth; s.classList.add('is-rolling');
        let n = 0;
        const iv = setInterval(() => {
          s.textContent = ++n > 5 ? s.dataset.ch : pick(s.dataset.ch);
          if (n > 5) clearInterval(iv);
        }, 55);
      }, i * 38);
    });
  };
  setTimeout(rollAll, 600);
  setInterval(() => { if (!document.hidden) rollAll(); }, 7000);
  $('.hero__tagline').addEventListener('pointerenter', rollAll);
})();

/* ---------- Marquee: endless scroll that slows on hover ---------- */
(() => {
  const track = $('.marquee__track');
  if (!track || reduceMotion) return;
  // duplicate content so translating by -50% loops seamlessly
  track.innerHTML += track.innerHTML;
  const anim = track.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-50%)' }], { duration: 40000, iterations: Infinity });
  const band = track.parentElement;
  band.addEventListener('pointerenter', () => { anim.playbackRate = .25; });
  band.addEventListener('pointerleave', () => { anim.playbackRate = 1; });
})();

/* ---------- Scroll progress bar ---------- */
(() => {
  const bar = $('.progress');
  const set = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.setProperty('--p', max > 0 ? (scrollY / max).toFixed(4) : 0);
  };
  addEventListener('scroll', set, { passive: true });
  addEventListener('resize', set);
  set();
})();


/* ---------- Custom cursor: dot + lagging ring; grows on links, says "drag" over stars ---------- */
(() => {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const dot = $('.cursor-dot'), ring = $('.cursor-ring');
  const root = document.documentElement;
  root.classList.add('has-cursor');
  let x = -100, y = -100, rx = x, ry = y, shown = false;

  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    x = e.clientX; y = e.clientY;
    if (!shown) { rx = x; ry = y; shown = true; root.classList.add('cursor-on'); }
    dot.style.transform = `translate(${x}px, ${y}px)`;
    ring.classList.toggle('is-link', !!e.target.closest('a, button, [data-copy], .project'));
  }, { passive: true });
  document.addEventListener('pointerleave', () => { shown = false; root.classList.remove('cursor-on'); });
  addEventListener('pointerdown', () => ring.classList.add('is-down'));
  addEventListener('pointerup', () => ring.classList.remove('is-down'));

  const follow = () => {
    rx += (x - rx) * (reduceMotion ? 1 : .18);
    ry += (y - ry) * (reduceMotion ? 1 : .18);
    ring.style.transform = `translate(${rx}px, ${ry}px)`;
    requestAnimationFrame(follow);
  };
  follow();
})();


/* ---------- Magnetic buttons: pulled slightly toward the cursor ---------- */
if (matchMedia('(hover: hover) and (pointer: fine)').matches && !reduceMotion) {
  $$('.btn, .icon-btn').forEach((el) => {
    const STRENGTH = el.classList.contains('btn') ? .3 : .4;
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      el.style.transform = `translate(${dx * STRENGTH}px, ${dy * STRENGTH}px)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });
}


/* ---------- Project cards: 3D tilt + moving shine ---------- */
if (matchMedia('(hover: hover) and (pointer: fine)').matches && !reduceMotion) {
  $$('.project').forEach((card) => {
    const shine = document.createElement('span');
    shine.className = 'project__shine';
    shine.setAttribute('aria-hidden', 'true');
    card.append(shine);
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      card.style.transition = 'transform .12s ease-out, border-color .3s';
      card.style.transform = `perspective(900px) rotateX(${(.5 - py) * 10}deg) rotateY(${(px - .5) * 12}deg) translateY(-6px)`;
      shine.style.setProperty('--sx', `${px * 100}%`);
      shine.style.setProperty('--sy', `${py * 100}%`);
    });
    card.addEventListener('pointerleave', () => {
      card.style.transition = 'transform .6s cubic-bezier(.22,1,.36,1), border-color .3s';
      card.style.transform = '';
    });
  });
}
