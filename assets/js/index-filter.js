/* ==========================================================================
   ELECTRO — product index: range chips + search, FLIP-animated.
   All 35 cards are real markup; this only hides/shows them. Without JS every card is visible.
   FLIP: record rects → change layout → invert with transform → play (WAAPI, compositor-only).
   ========================================================================== */
import { prefersReduced } from './motion.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';                  // --ease-smooth

export function initIndex() {
  const grid = $('[data-index-grid]');
  if (!grid) return;
  const q = $('[data-index-q]');
  const chips = $$('[data-chip]');
  const status = $('[data-index-status]');
  const empty = $('[data-index-empty]');
  const cards = $$('.pcard', grid);
  const total = cards.length;
  let cat = 'all', term = '', pending = null, timer = 0;

  const visibleFor = (c) => (cat === 'all' || c.dataset.cat === cat) && term.split(/\s+/).filter(Boolean).every((w) => c.dataset.search.includes(w));

  function commit(show, leaving) {
    const first = new Map();
    cards.forEach((c) => { if (!c.hidden && !leaving.includes(c)) first.set(c, c.getBoundingClientRect()); });
    leaving.forEach((c) => { c.hidden = true; c.classList.remove('is-out'); });
    const entering = cards.filter((c) => c.hidden && show.get(c));
    entering.forEach((c) => { c.hidden = false; });
    if (!prefersReduced()) {
      cards.forEach((c) => {
        const f = first.get(c);
        if (!f || c.hidden) return;
        const l = c.getBoundingClientRect();
        const dx = f.left - l.left, dy = f.top - l.top;
        if (dx || dy) c.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 300, easing: EASE });
      });
      entering.forEach((c, i) => c.animate([{ opacity: 0, transform: 'scale(0.96)' }, { opacity: 1, transform: 'none' }], { duration: 300, delay: Math.min(i, 10) * 30, easing: EASE, fill: 'backwards' }));
    }
    const n = cards.filter((c) => !c.hidden).length;
    status.textContent = `Showing ${n} of ${total} families`;
    empty.hidden = n > 0;
  }

  function apply() {
    if (pending) { clearTimeout(timer); pending(); pending = null; }       // interrupted: finish the previous change first
    const show = new Map(cards.map((c) => [c, visibleFor(c)]));
    const leaving = cards.filter((c) => !c.hidden && !show.get(c));
    if (leaving.length && !prefersReduced()) {
      leaving.forEach((c) => c.classList.add('is-out'));                   // exit fades first (140 ms), then the layout closes up
      pending = () => commit(show, leaving);
      timer = setTimeout(() => { const p = pending; pending = null; p && p(); }, 140);
    } else commit(show, leaving);
  }

  chips.forEach((b) =>
    b.addEventListener('click', () => {
      cat = b.dataset.chip;
      chips.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      apply();
    })
  );
  let deb = 0;
  q.addEventListener('input', () => { clearTimeout(deb); deb = setTimeout(() => { term = q.value.trim().toLowerCase(); apply(); }, 90); });

  /* pointer light on cards (fine pointers only) */
  if (matchMedia('(hover: hover) and (pointer: fine)').matches && !prefersReduced()) {
    cards.forEach((c) => {
      let r = null;
      c.addEventListener('pointerenter', () => { r = c.getBoundingClientRect(); });
      c.addEventListener('pointermove', (e) => {
        if (!r) r = c.getBoundingClientRect();
        c.style.setProperty('--px', (((e.clientX - r.left) / r.width) * 100).toFixed(1) + '%');
        c.style.setProperty('--py', (((e.clientY - r.top) / r.height) * 100).toFixed(1) + '%');
      });
      c.addEventListener('pointerleave', () => { r = null; c.style.removeProperty('--px'); c.style.removeProperty('--py'); });
    });
  }
}
