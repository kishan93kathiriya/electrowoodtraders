/* ==========================================================================
   Hero 3D — the stage: renderer, camera, DOM-anchor layout, and the ON-DEMAND loop.
   (Carried over from M1, which Lighthouse-tested it: render only while something
   moves or the user is interacting; sleep otherwise; benchmark + watchdog bail out
   to the static still on slow / software GPUs.)
   ========================================================================== */
import { WebGLRenderer, Scene, PerspectiveCamera, Group, Color, ACESFilmicToneMapping, SRGBColorSpace } from 'three';

export const FOV = 28;
const SYSTEM_W = 20;                             // outer orbit diameter + the biggest planet

export function createStage({ canvas, anchor, onFail }) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  let dpr = Math.min(window.devicePixelRatio || 1, 1.75);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(new Color(getComputedStyle(document.documentElement).getPropertyValue('--color-teal-night').trim() || '#021B19'), 1);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;             // no shadow maps anywhere: the bulb is a point light and the system is small

  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 220);
  const sys = new Group();
  scene.add(sys);

  /* ---- layout: the DOM anchor decides where the system sits and how big it is ------------ */
  const layout = { cur: { cw: 1, ch: 1, aw: 1, ah: 1, dx: 0, dy: 0, dist: 30, mobile: false } };
  let onLayout = () => {};
  function doLayout() {
    const cr = canvas.getBoundingClientRect();
    if (!cr.width || !cr.height) return false;
    const ar = anchor.getBoundingClientRect();
    renderer.setPixelRatio(dpr);
    renderer.setSize(cr.width, cr.height, false);
    camera.aspect = cr.width / cr.height;
    const mobile = cr.width < 768 || (cr.width < 1024 && cr.width / cr.height < 0.9);   // phones and portrait tablets get the stacked composition
    // system diameter on screen: 1.55× the anchor on desktop (it bleeds under the copy; a scrim keeps text AA),
    // ~1.1× the viewport on a phone
    const targetPx = mobile ? 1.1 * cr.width : 1.7 * ar.width;
    const ppu = targetPx / SYSTEM_W;
    const dist = cr.height / (ppu * 2 * Math.tan((FOV * Math.PI) / 360));
    layout.cur = {
      cw: cr.width, ch: cr.height, aw: ar.width, ah: ar.height,
      dx: (ar.left + ar.width / 2 - (cr.left + cr.width / 2)) * (mobile ? 1 : 0.85), dy: ar.top + ar.height / 2 - (cr.top + cr.height / 2),
      dist, mobile, ppu,
    };
    onLayout();
    return true;
  }
  const ro = new ResizeObserver(() => { doLayout(); poke(900); });
  ro.observe(canvas);
  ro.observe(anchor);

  /* ---- the on-demand loop --------------------------------------------------------------- */
  let frameFn = () => {};
  let movingFn = () => false;
  let activeUntil = 0, lastInput = 0, off = null, visible = true, failed = false;
  let frames = 0, acc = 0, slowRuns = 0, flip = false;
  let subscribe = null;                          // injected: motion.onFrame (the shared rAF loop)

  function poke(ms = 3000) {
    const now = performance.now();
    lastInput = now;
    activeUntil = Math.max(activeUntil, now + ms);
    start();
  }
  function start() { if (!off && visible && !failed && subscribe) off = subscribe(tick); }
  function stop() { if (off) { off(); off = null; } }
  function fail() {
    if (failed) return;
    failed = true;
    stop();
    renderer.dispose();
    onFail && onFail();
  }
  function tick(dt) {
    if (!(dt > 0)) return;
    acc += dt; frames++;
    if (frames === 45) {                          // adaptive resolution first, then give up to the still
      const avg = acc / frames;
      if (avg > 0.034 && dpr > 1) { dpr = Math.max(1, dpr - 0.25); doLayout(); }
      else if (avg > 0.045 && ++slowRuns >= 2) { fail(); return; }
      acc = 0; frames = 0;
    }
    const now = performance.now();
    if (now - lastInput > 4000) {                 // nobody's touching it: 30 fps is plenty
      flip = !flip;
      if (flip) return;
      dt *= 2;
    }
    frameFn(Math.min(dt, 0.1), now);
    renderer.render(scene, camera);
    if (now > activeUntil && !movingFn(now)) stop();
  }

  const pinObserve = (el) => {
    const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) poke(1200); else stop(); }, { rootMargin: '120px 0px' });
    io.observe(el);
    return io;
  };

  return {
    renderer, scene, camera, sys, layout, poke,
    get dpr() { return dpr; },
    setLayoutHook(fn) { onLayout = fn; },
    setLoop(subscribeFn, frame, moving) { subscribe = subscribeFn; frameFn = frame; movingFn = moving; },
    layoutNow: doLayout,
    observe: pinObserve,
    /** 3 synchronous frames incl. the GPU (finish): a software rasteriser or weak GPU can't hold the hero */
    benchmark() {
      const gl = renderer.getContext();
      const t0 = performance.now();
      for (let i = 0; i < 3; i++) renderer.render(scene, camera);
      gl.finish();
      return (performance.now() - t0) / 3;
    },
    renderOnce() { renderer.render(scene, camera); },
    stop, start,
    onContextLost(fn) { canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); stop(); fn(); }); },
    destroy() { stop(); ro.disconnect(); renderer.dispose(); },
  };
}
