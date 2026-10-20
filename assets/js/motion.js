/* ==========================================================================
   ELECTRO — motion engine (~3 KB min). Vanilla, dependency-free.
   Rules baked in (from the motion system):
     · transform / opacity / custom properties only — never layout props
     · one shared rAF loop that sleeps when idle and pauses when the tab hides
     · reduced-motion beats everything: springs snap, tweens jump to end
     · never reads window/navigator at module level
   ========================================================================== */
import { duration, easing, springs, distance, scale } from './motion-tokens.js';

export { duration, easing, springs, distance, scale };

/* ---------- environment gates -------------------------------------------- */
const mqReduce =
  typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;

export const prefersReduced = () => !!mqReduce && mqReduce.matches;
export const onReducedChange = (cb) => mqReduce && mqReduce.addEventListener('change', cb);
export const isLowEnd = () =>
  typeof navigator !== 'undefined' && (navigator.hardwareConcurrency || 8) <= 4;

/** reduced-motion → low-end (unless essential) → true */
export function shouldAnimate({ essential = false } = {}) {
  if (prefersReduced()) return false;
  if (!essential && isLowEnd()) return false;
  return true;
}

/* ---------- maths --------------------------------------------------------- */
export const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const lerp = (a, b, t) => a + (b - a) * t;
/** map v from [a,b] to [c,d], clamped */
export const remap = (v, a, b, c = 0, d = 1) => lerp(c, d, clamp((v - a) / (b - a)));
export const smoothstep = (a, b, v) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** cubic-bezier(x1,y1,x2,y2) → (t) => y   (Newton-Raphson + bisection fallback) */
export function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = (t) => ((ax * t + bx) * t + cx) * t;
  const Y = (t) => ((ay * t + by) * t + cy) * t;
  const dX = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 6; i++) {
      const e = X(t) - x;
      if (Math.abs(e) < 1e-5) return Y(t);
      const d = dX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    let lo = 0, hi = 1;
    t = x;
    for (let i = 0; i < 20; i++) {
      const e = X(t) - x;
      if (Math.abs(e) < 1e-5) break;
      if (e > 0) hi = t; else lo = t;
      t = (lo + hi) / 2;
    }
    return Y(t);
  };
}

const easeFn = (e) => (typeof e === 'function' ? e : bezier(...easing[e || 'smooth']));

/* ---------- shared frame loop --------------------------------------------- */
const subs = new Set();
let raf = 0;
let last = 0;

function tick(now) {
  raf = 0;
  // rAF timestamps can precede the performance.now() that seeded `last` → clamp at 0.
  // A negative dt would integrate a damped spring BACKWARDS (anti-damping → blow-up).
  const dt = Math.max(0, Math.min((now - last) / 1000, 1 / 20));
  last = now;
  for (const fn of subs) fn(dt, now);
  if (subs.size && !document.hidden) raf = requestAnimationFrame(tick);
}

function wake() {
  if (!raf && subs.size && !document.hidden) {
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }
}

/** subscribe to the shared loop; returns an unsubscribe fn. Loop sleeps at 0 subscribers. */
export function onFrame(fn) {
  subs.add(fn);
  wake();
  return () => subs.delete(fn);
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else wake();
  });
}

/* ---------- spring value (interrupt-safe, velocity-preserving) ------------- */
export function springValue(initial, cfg, onUpdate) {
  const c = typeof cfg === 'string' ? springs[cfg] : cfg;
  let x = initial, v = 0, target = initial, off = null;
  const rest = c.restDelta ?? 0.001;

  const stop = () => { if (off) { off(); off = null; } };
  const step = (dt) => {
    if (!(dt > 0)) return;
    const n = Math.max(1, Math.ceil(dt * 240));            // sub-step for stability
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      v += ((-c.stiffness * (x - target) - c.damping * v) / (c.mass || 1)) * h;
      x += v * h;
    }
    if (Math.abs(x - target) < rest && Math.abs(v) < 0.01) { x = target; v = 0; stop(); }
    onUpdate && onUpdate(x, v);
  };

  const api = {
    get value() { return x; },
    get velocity() { return v; },
    get target() { return target; },
    /** animate toward t from the CURRENT value and velocity */
    to(t) {
      target = t;
      if (prefersReduced()) { x = t; v = 0; stop(); onUpdate && onUpdate(x, 0); return api; }
      if (!off) off = onFrame(step);
      return api;
    },
    /** jump, no animation */
    set(val) { x = target = val; v = 0; stop(); onUpdate && onUpdate(x, 0); return api; },
    stop,
  };
  return api;
}

/* ---------- tween ----------------------------------------------------------- */
export function tween({ from = 0, to = 1, ms = duration.normal, ease = 'smooth', delay = 0, onUpdate, onDone }) {
  if (prefersReduced()) {
    onUpdate && onUpdate(to);
    onDone && onDone();
    return { stop() {} };
  }
  const fn = easeFn(ease);
  let t0 = null;
  const off = onFrame((dt, now) => {
    if (t0 === null) t0 = now + delay;
    if (now < t0) return;
    const t = clamp((now - t0) / ms);
    onUpdate && onUpdate(from + (to - from) * fn(t));
    if (t >= 1) { off(); onDone && onDone(); }
  });
  return { stop: off };
}

/* ---------- viewport / scroll ------------------------------------------------ */
/** fire cb(el) when an element enters the viewport (once by default) */
export function inView(els, cb, { rootMargin = '0px 0px -10% 0px', threshold = 0.01, once = true, onLeave } = {}) {
  const list = els instanceof Element ? [els] : Array.from(els);
  if (!list.length) return null;
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          cb(e.target, e);
          if (once) io.unobserve(e.target);
        } else if (onLeave) onLeave(e.target, e);
      }
    },
    { rootMargin, threshold }
  );
  list.forEach((el) => io.observe(el));
  return io;
}

/** 0→1 progress through a sticky section (section height − pin height of travel). Native scroll; never hijacked. */
export function scrollProgress(section, pin, cb) {
  let queued = false;
  const read = () => {
    const r = section.getBoundingClientRect();
    const travel = r.height - pin.offsetHeight;
    return travel <= 0 ? 0 : clamp(-r.top / travel);
  };
  const run = () => { queued = false; cb(read()); };
  const onScroll = () => { if (!queued) { queued = true; requestAnimationFrame(run); } };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  cb(read());
  return {
    read,
    destroy() {
      removeEventListener('scroll', onScroll);
      removeEventListener('resize', onScroll);
    },
  };
}

/* ---------- number counter ---------------------------------------------------- */
export function countUp(el, to, { ms = duration.crawl, ease = 'smooth', format = (n) => Math.round(n).toString() } = {}) {
  if (!shouldAnimate({ essential: true })) { el.textContent = format(to); return { stop() {} }; }
  return tween({ from: 0, to, ms, ease, onUpdate: (v) => { el.textContent = format(v); } });
}

/* ---------- magnetic pull (direct manipulation) -------------------------------- */
export function magnetic(el, { strength = 0.28, radius = 80, max = 6 } = {}) {
  if (!shouldAnimate()) return () => {};
  let rect = null;
  const sx = springValue(0, 'gentle', (x) => el.style.setProperty('--mx', x.toFixed(2) + 'px'));
  const sy = springValue(0, 'gentle', (y) => el.style.setProperty('--my', y.toFixed(2) + 'px'));
  const measure = () => { rect = el.getBoundingClientRect(); };
  const move = (e) => {
    if (!rect) measure();
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx, dy = e.clientY - cy;
    const d = Math.hypot(dx, dy);
    const reach = Math.max(rect.width, rect.height) / 2 + radius;
    if (d > reach) { sx.to(0); sy.to(0); return; }
    sx.to(clamp(dx * strength, -max, max));
    sy.to(clamp(dy * strength, -max, max));
  };
  const leave = () => { sx.to(0); sy.to(0); rect = null; };
  const enter = measure;
  el.addEventListener('pointerenter', enter);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerleave', leave);
  return () => {
    el.removeEventListener('pointerenter', enter);
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerleave', leave);
    sx.stop(); sy.stop();
  };
}
