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
