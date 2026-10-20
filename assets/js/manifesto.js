/* ==========================================================================
   ELECTRO — manifesto: the sentence lights up word by word as you scroll.
   Words are spans from the build (the text is plain, readable markup). We toggle a
   class per word only when its state changes — never a per-frame CSS variable on the parent.
   ========================================================================== */
import { prefersReduced, clamp } from './motion.js';

export function initManifesto() {
  const p = document.querySelector('[data-manifesto]');
  if (!p) return;
  const words = Array.from(p.querySelectorAll('.w'));
  const burn = p.querySelector('.burn');
  if (prefersReduced()) { words.forEach((w) => w.classList.add('is-lit')); burn && burn.classList.add('is-lit'); return; }
  let lit = -1, queued = false;
  const update = () => {
    queued = false;
    const r = p.getBoundingClientRect();
    const vh = innerHeight;
    const prog = clamp((vh * 0.85 - r.top) / (r.height + vh * 0.3));      // 0 as the paragraph enters, 1 once its bottom passes 55% of the viewport
    const n = Math.round(prog * words.length);
    if (n === lit) return;
    words.forEach((w, i) => w.classList.toggle('is-lit', i < n));
    if (burn) burn.classList.toggle('is-lit', n >= words.length);
    lit = n;
  };
  const onScroll = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  update();
}
