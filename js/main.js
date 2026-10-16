// Steven Widinata — site scripts
'use strict';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

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
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
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


/* ---------- Hero constellation: stars link up near the pointer ---------- */
(() => {
  const canvas = $('.hero__sky');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const LINK = 130;   // max distance between linked stars
  const REACH = 200;  // pointer influence radius
  let w, h, dpr, stars = [], rgb = '226, 237, 247', running = false;
  const pointer = { x: -9999, y: -9999 };

  const readColor = () => {
    rgb = getComputedStyle(document.documentElement).getPropertyValue('--star').trim();
  };

  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.min(160, Math.round((w * h) / 9000));
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - .5) * .18,
      vy: (Math.random() - .5) * .18,
      r: Math.random() * 1.4 + .4,
      tw: Math.random() * Math.PI * 2,
    }));
  };

  const draw = (t = 0) => {
    ctx.clearRect(0, 0, w, h);
    for (const s of stars) {
      s.x = (s.x + s.vx + w) % w;
      s.y = (s.y + s.vy + h) % h;
      const near = Math.max(0, 1 - Math.hypot(s.x - pointer.x, s.y - pointer.y) / REACH);
      const alpha = .35 + .3 * Math.sin(t / 900 + s.tw) + near * .6;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r + near * 1.4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${rgb}, ${Math.min(alpha, 1)})`;
      ctx.fill();
      s.near = near;
    }
    // Lines only between stars near the pointer, so constellations "form" where you look
    for (let i = 0; i < stars.length; i++) {
      const a = stars[i];
      if (!a.near) continue;
      for (let j = i + 1; j < stars.length; j++) {
        const b = stars[j];
        if (!b.near) continue;
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d > LINK) continue;
        ctx.strokeStyle = `rgba(${rgb}, ${(1 - d / LINK) * Math.min(a.near, b.near) * .9})`;
        ctx.lineWidth = .8;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }
  };

  const loop = (t) => { if (!running) return; draw(t); requestAnimationFrame(loop); };
  let inView = true;
  const start = () => { if (running || reduceMotion || !inView || document.hidden) return; running = true; requestAnimationFrame(loop); };
  const stop = () => { running = false; };

  readColor(); resize(); draw();
  addEventListener('resize', () => { resize(); draw(); });
  new MutationObserver(() => { readColor(); if (!running) draw(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  const hero = canvas.parentElement;
  hero.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top;
  });
  hero.addEventListener('pointerleave', () => { pointer.x = pointer.y = -9999; });

  new IntersectionObserver(([en]) => { inView = en.isIntersecting; inView ? start() : stop(); }).observe(hero);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
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
    toast(`Copied “${btn.dataset.copy}” to clipboard`);
  } catch {
    toast(`Discord: ${btn.dataset.copy}`);
  }
}));

$$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
