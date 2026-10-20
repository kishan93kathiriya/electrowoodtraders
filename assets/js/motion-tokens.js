/* ==========================================================================
   ELECTRO — motion tokens (single source of truth)
   Mirrored as CSS custom properties in assets/css/src/tailwind.css (@theme),
   and consumed by assets/js/motion.js, home.js, hero-three.js and by
   build/gen-springs.mjs (which turns the spring configs into CSS linear()
   curves). No duration, easing or spring is hard-coded anywhere else.
   ========================================================================== */

/** milliseconds */
export const duration = Object.freeze({
  instant: 80,    // tooltip, focus ring, badge
  fast: 180,      // button feedback, icon swap
  normal: 350,    // element enter, card state
  slow: 600,      // hero entrance
  crawl: 1000,    // deliberate storytelling — use sparingly
});

/** cubic-bezier control points */
export const easing = Object.freeze({
  smooth: [0.22, 1, 0.36, 1],
  sharp: [0.4, 0, 0.2, 1],
  apple: [0.25, 0.1, 0.25, 1],
  linear: [0, 0, 1, 1],
});

/** damped-spring configs (mass defaults to 1) */
export const springs = Object.freeze({
  snappy:  Object.freeze({ stiffness: 300, damping: 30, mass: 1, restDelta: 0.001 }), // default UI
  gentle:  Object.freeze({ stiffness: 120, damping: 14, mass: 1, restDelta: 0.001 }), // things landing softly
  bouncy:  Object.freeze({ stiffness: 400, damping: 10, mass: 1, restDelta: 0.001 }), // playful, rare
  instant: Object.freeze({ stiffness: 600, damping: 35, mass: 1, restDelta: 0.001 }), // popovers
  release: Object.freeze({ stiffness: 200, damping: 20, mass: 1, restDelta: 0.001 }), // drag release
  camera:  Object.freeze({ stiffness: 90,  damping: 19, mass: 1, restDelta: 0.001 }), // ζ≈1.0 — cinematic camera follow (hero)
  spin:    Object.freeze({ stiffness: 60,  damping: 15.5, mass: 1, restDelta: 0.001 }), // ζ≈1.0 — system spin settling (hero)
});

/** px */
export const distance = Object.freeze({ xs: 4, sm: 8, md: 16, lg: 24, xl: 48 });

export const scale = Object.freeze({ subtle: 0.98, press: 0.95, pop: 1.04 });

/* --------------------------------------------------------------------------
   Spring maths — analytic unit-step response of a damped harmonic oscillator
   released from rest. t is in seconds. Used to generate CSS linear() curves
   and to compute settle times.
   -------------------------------------------------------------------------- */
export function springStep({ stiffness: k, damping: c, mass: m = 1 }, t) {
  const w0 = Math.sqrt(k / m);
  const z = c / (2 * Math.sqrt(k * m));
  if (z < 1) {
    const wd = w0 * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + ((z * w0) / wd) * Math.sin(wd * t));
  }
  if (z === 1) return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
  const s = w0 * Math.sqrt(z * z - 1);
  const r1 = -z * w0 + s;
  const r2 = -z * w0 - s;
  return 1 - (r2 * Math.exp(r1 * t) - r1 * Math.exp(r2 * t)) / (r2 - r1);
}

/** seconds until the response stays within `eps` of 1 */
export function springSettleTime(cfg, eps = cfg.restDelta ?? 0.001) {
  let last = 0;
  for (let t = 0; t < 8; t += 0.001) {
    if (Math.abs(1 - springStep(cfg, t)) > eps) last = t;
  }
  return last + 0.001;
}
