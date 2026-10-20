/* ==========================================================================
   ELECTRO — homepage behaviour
   Order of importance: (1) content is already in the HTML, nothing here is
   needed to read it; (2) reveals, counters, index filter, manifesto are progressive
   enhancement; (3) the 3D orrery is lazy, optional, and has a static fallback.
   ========================================================================== */
import {
  shouldAnimate, prefersReduced, inView, countUp, magnetic, springValue, scrollProgress,
  onFrame, clamp, lerp, remap, smoothstep,
} from './motion.js';
import { initTour } from './tour.js';
import { initIndex } from './index-filter.js';
import { initManifesto } from './manifesto.js';

window.__electroReady = true;

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

/* ---- 1 · scroll reveals + counters ----------------------------------------------- */
const startCount = (el) => countUp(el, Number(el.dataset.countTo), { format: (n) => String(Math.round(n)) });
const reveals = $$('[data-reveal]');
if (reveals.length) {
  inView(
    reveals,
    (el) => {
      el.classList.add('is-in');
      $$('[data-count-to]', el).forEach(startCount);
    },
    { rootMargin: '0px 0px -8% 0px' }
  );
}

/* ---- 2 · direct manipulation: magnetic CTAs ------------------------------------------ */
if (matchMedia('(hover: hover) and (pointer: fine)').matches && shouldAnimate()) {
  $$('[data-magnetic]').forEach((el) => magnetic(el));
}

/* ---- 3 · index filter + manifesto ----------------------------------------------------- */
initIndex();
initManifesto();

/* ---- 4 · the orrery hero ----------------------------------------------------------------- */
const hero = $('#hero');
if (hero) initHero(hero);

function webglViable() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return false;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
    const lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
    return !/swiftshader|llvmpipe|software|basic render/i.test(renderer);   // software GL = bad experience → still image
  } catch (e) {
    return false;
  }
}

function initHero(hero) {
  const btn = $('[data-switch]', hero);
  const pauseBtn = $('[data-pause]', hero);
  const status = $('[data-status]', hero);
  const stateText = $('[data-state-text]', hero);
  const pin = $('[data-pin]', hero);
  const fade = $('[data-fade]', hero);
  let on = true;                                   // the system opens LIT: lit products are highlighted products
  let paused = false;
  let beat = -1;
  let three = null;
  let tour = null;

  /* The switch: DOM is the source of truth; the 3D bulb mirrors it. Haptic only for the person who flipped it. */
  const setLight = (v, byUser = false) => {
    if (v === on) return;
    on = v;
    hero.dataset.light = v ? 'on' : 'off';
    hero.dataset.touched = 'true';
    btn.setAttribute('aria-checked', String(v));
    stateText.textContent = v ? 'On' : 'Off';
    status.textContent = v ? 'Light on' : 'Light off';
    if (byUser && navigator.vibrate) navigator.vibrate(8);
    if (three) three.setLight(v);
  };
  btn.addEventListener('click', () => setLight(!on, true));

  /* Pause (WCAG 2.2.2: motion that runs > 5 s needs a way to stop it) */
  const setPaused = (p) => {
    paused = p;
    pauseBtn.setAttribute('aria-pressed', String(p));
    pauseBtn.setAttribute('aria-label', p ? 'Resume orbit motion' : 'Pause orbit motion');
    if (three) three.setPaused(p);
  };
  pauseBtn.addEventListener('click', () => setPaused(!paused));

  /* The real range links in the hero highlight their planet (DOM ↔ 3D stay in sync) */
  $$('[data-planet]', hero).forEach((a) => {
    const hi = () => three && three.highlight(a.dataset.planet);
    const lo = () => three && three.highlight(null);
    a.addEventListener('pointerenter', hi);
    a.addEventListener('focus', hi);
    a.addEventListener('pointerleave', lo);
    a.addEventListener('blur', lo);
  });

  /* Can the cinematic version run? reduced-motion → low-end → save-data → software GL all say no. */
  const saveData = !!(navigator.connection && navigator.connection.saveData);
  const cinematic = shouldAnimate() && !saveData && webglViable();
  if (!cinematic) return;                          // static lit still + a normal stacked tour; the switch still works (CSS bloom)

  hero.classList.add('hero--chapter');
  tour = initTour({ hero, pin, onBeat: (b) => { beat = b; if (three) three.setBeat(b); } });

  /* Scroll story: native scroll → smoothed progress for the CSS fade; raw progress picks the tour beat */
  const smooth = springValue(0, 'snappy', (p) => {
    pin.style.setProperty('--p', p.toFixed(4));
    fade.dataset.away = p > 0.1 ? 'true' : 'false';
  });
  scrollProgress(hero, pin, (p) => {
    smooth.to(p);
    if (tour) tour.update(p);
    if (three) three.setProgress(p);
  });

  const fallBack = () => {
    hero.classList.remove('hero--chapter', 'is-3d');
    if (tour) { tour.destroy(); tour = null; }
    three = null;
    const top = hero.getBoundingClientRect().top;
    if (top < 0 && top > -hero.offsetHeight) window.scrollTo({ top: window.scrollY + top, behavior: 'auto' });   // never leave the reader mid-nowhere
  };
  const load3D = () => {
    import(/* @vite-ignore */ new URL(hero.dataset.heroSrc, document.baseURI).href)
      .then((m) =>
        m.mountHero({
          hero, pin,
          canvas: $('[data-canvas]', hero),
          anchor: $('[data-anchor]', hero),
          labelsEl: $('[data-plabels]', hero),
          popEl: $('[data-pop]', hero),
          motion: { onFrame, springValue, clamp, lerp, remap, smoothstep, prefersReduced },
          onToggle: (v) => setLight(v, true),
          onPlanetClick: (id) => (tour ? tour.goTo(id) : (location.hash = '#range-' + id)),
          onReady: () => hero.classList.add('is-3d'),
          onFail: fallBack,
        })
      )
      .then((ctrl) => {
        three = ctrl;
        ctrl.setLight(on);
        ctrl.setPaused(paused);
        ctrl.setBeat(beat);
      })
      .catch(fallBack);
  };

  /* The 3D never competes with first paint. It starts on the first sign of intent
     (pointer / touch / key / wheel / scroll) or after ~6 s idle, whichever is first.
     The chunk is prefetched at idle so it is already in cache when that moment comes. */
  let started = false;
  const intent = ['pointerdown', 'pointermove', 'touchstart', 'keydown', 'wheel', 'scroll'];
  const go = () => {
    if (started) return;
    started = true;
    intent.forEach((t) => removeEventListener(t, go));
    load3D();
  };
  const arm = () => {
    intent.forEach((t) => addEventListener(t, go, { passive: true }));
    setTimeout(go, 6000);
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.as = 'script';
    link.href = new URL(hero.dataset.heroSrc, document.baseURI).href;
    link.crossOrigin = '';
    ('requestIdleCallback' in window ? requestIdleCallback : setTimeout)(() => document.head.appendChild(link));
  };
  if (document.readyState === 'complete') arm();
  else addEventListener('load', arm, { once: true });
}

/* ---- 5 · dealer band: the wire arrives, the button powers on ------------------------------ */
const dealer = $('#dealer');
if (dealer && shouldAnimate({ essential: true }) && !prefersReduced()) initWire(dealer);

function initWire(sec) {
  const svg = $('[data-wire]', sec);
  const target = $('[data-wire-target]', sec);
  const copy = $('.dealer__copy', sec);
  const rail = $('.rail', svg);
  const live = $('.live', svg);
  if (!svg || !target || !copy) return;
  live.style.strokeDasharray = '1';
  live.style.strokeDashoffset = '1';
  let len = 1;
  let powered = false;

  const build = () => {
    const s = sec.getBoundingClientRect();
    const t = target.getBoundingClientRect();
    const c = copy.getBoundingClientRect();
    const tx = t.left - s.left + t.width / 2;
    const ty = t.top - s.top;
    svg.setAttribute('viewBox', `0 0 ${s.width} ${s.height}`);
    const crossesCopy = tx > c.left - s.left - 8 && tx < c.right - s.left + 8 && ty > c.top - s.top;
    const d = crossesCopy
      ? `M10 0V${ty + t.height / 2}H${t.left - s.left}`        // narrow screens: run down the gutter, turn into the button
      : `M${tx} 0V${ty}`;                                       // wide screens: straight down into the button
    rail.setAttribute('d', d);
    live.setAttribute('d', d);
    len = Math.max(1, live.getTotalLength());
    update();
  };
  const update = () => {
    const top = sec.getBoundingClientRect().top;
    const p = clamp((innerHeight * 0.72 - top) / len);
    live.style.strokeDashoffset = String(1 - p);
    if (p >= 0.999 && !powered) { powered = true; target.classList.add('is-powered'); }
    else if (p < 0.9 && powered) { powered = false; target.classList.remove('is-powered'); }
  };
  build();
  let q = false;
  addEventListener('scroll', () => { if (!q) { q = true; requestAnimationFrame(() => { q = false; update(); }); } }, { passive: true });
  addEventListener('resize', debounce(build, 150));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(build);
}
