/* ==========================================================================
   ELECTRO — the range tour (DOM side).
   The six <article>s are real, crawlable markup in #tour (a normal grid without JS/3D).
   When the cinematic hero runs we MOVE them into the pinned stage and reveal one per beat.
   Native scroll only — we read it, we never hijack it.
   ========================================================================== */
import { prefersReduced } from './motion.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

/* hero height = pin + 40svh intro + 6 × 65svh beats + 40svh outro  (see .hero--chapter in hero.css) */
const TRAVEL = 470, A0 = 40 / TRAVEL, A1 = 430 / TRAVEL;

export function initTour({ hero, pin, onBeat }) {
  const sec = $('#tour');
  const inner = sec && $('[data-tour]', sec);
  if (!inner) return null;
  const arts = $$('.tour__beat', inner);
  const ids = arts.map((a) => a.dataset.cat);

  pin.appendChild(inner);
  inner.classList.add('tour--pinned');
  sec.hidden = true;                                   // its content now lives in the stage; the h2 stays in the a11y tree via .tour__head

  const dots = document.createElement('div');
  dots.className = 'tdots is-on';
  dots.setAttribute('role', 'group');
  dots.setAttribute('aria-label', 'Range tour');
  arts.forEach((a, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tdot';
    b.setAttribute('aria-label', `Show ${$('.tour__h', a).textContent}`);
    b.addEventListener('click', () => goTo(i));
    dots.appendChild(b);
  });
  pin.appendChild(dots);

  let beat = -2;
  const beatAt = (p) => (p < A0 ? -1 : p >= A1 ? 6 : Math.min(5, Math.floor(((p - A0) / (A1 - A0)) * 6)));
  function set(b) {
    if (b === beat) return;
    beat = b;
    arts.forEach((a, i) => {
      a.classList.toggle('is-active', i === b);
      a.classList.toggle('is-past', i < b);          // past beats leave upward; future ones wait below: same path back
    });
    $$('.tdot', dots).forEach((d, i) => d.setAttribute('aria-current', i === b ? 'true' : 'false'));
    onBeat && onBeat(b);
  }

  function goTo(i) {
    const travel = hero.offsetHeight - pin.offsetHeight;
    const top = hero.getBoundingClientRect().top + window.scrollY + (A0 + ((i + 0.5) / 6) * (A1 - A0)) * travel;
    window.scrollTo({ top, behavior: prefersReduced() ? 'auto' : 'smooth' });
  }

  /* any #range-* link (hero range links, planet clicks, dots) jumps to its beat instead of a dead anchor */
  const onClick = (e) => {
    const a = e.target.closest && e.target.closest('a[href^="#range-"]');
    if (!a) return;
    const i = ids.indexOf(a.getAttribute('href').slice('#range-'.length));
    if (i < 0) return;
    e.preventDefault();
    goTo(i);
  };
  document.addEventListener('click', onClick);
  // a focused link must always be visible: tabbing into a hidden beat scrolls to it
  inner.addEventListener('focusin', (e) => {
    const a = e.target.closest('.tour__beat');
    if (a && !a.classList.contains('is-active')) goTo(arts.indexOf(a));
  });
  if (location.hash.startsWith('#range-')) {
    const i = ids.indexOf(location.hash.slice('#range-'.length));
    if (i >= 0) setTimeout(() => window.scrollTo({ top: hero.getBoundingClientRect().top + window.scrollY + (A0 + ((i + 0.5) / 6) * (A1 - A0)) * (hero.offsetHeight - pin.offsetHeight), behavior: 'auto' }), 60);
  }

  set(-1);
  return {
    update(p) { set(beatAt(p)); },
    goTo: (id) => { const i = ids.indexOf(id); if (i >= 0) goTo(i); },
    /** 3D failed or reduced-motion flipped: put everything back as a normal section */
    destroy() {
      document.removeEventListener('click', onClick);
      sec.appendChild(inner);
      inner.classList.remove('tour--pinned');
      arts.forEach((a) => a.classList.remove('is-active', 'is-past'));
      sec.hidden = false;
      dots.remove();
    },
  };
}
