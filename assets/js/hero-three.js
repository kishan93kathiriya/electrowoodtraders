/* ==========================================================================
   ELECTRO — hero 3D: "The Electro System"
   A bulb is the sun. Six products orbit it (one planet per range, sized by how many
   families the range has); 35 moons — one per family — are coloured by their real
   finish. The switch is the bulb. Loaded lazily by home.js; DECORATION ONLY: the canvas
   is aria-hidden, carries no content, and a static still is the fallback.

   Modules (assets/js/hero/): scene (stage + on-demand loop) · bulb · glow · models
   (planets + moons) · orbits · camera (overview + tour rig) · interact · shared
   ========================================================================== */
import { Color, AmbientLight, HemisphereLight, DirectionalLight, Vector3 } from 'three';
import { createStage } from './hero/scene.js';
import { createMaterials, createPlanets } from './hero/models.js';
import { createBulb, filamentOn, filamentOff } from './hero/bulb.js';
import { createGlow } from './hero/glow.js';
import { createOrbits } from './hero/orbits.js';
import { createCameraRig } from './hero/camera.js';
import { createInteract } from './hero/interact.js';
import { Spring, cssColor } from './hero/shared.js';
import { springs } from './motion-tokens.js';

/** catalogue order — what the scroll tour walks through (plates → lighting) */
const CATALOGUE = ['modular-switches-plates', 'concealed-surface-boxes', 'wiring-accessories', 'distribution-mcb-boxes', 'power-extension', 'lighting-doorbell'];

export async function mountHero(o) {
  const { hero, pin, canvas, anchor, labelsEl, popEl, motion, onToggle, onPlanetClick, onReady, onFail } = o;
  const data = JSON.parse(document.getElementById('orrery-data').textContent);          // [{id,name,short,families,skus,top,moons}] inner→outer
  const FREEZE = /[?&]freeze\b/.test(location.search);                                // deterministic frame for stills / review shots
  const coarse = matchMedia('(pointer: coarse)').matches;

  const teal = cssColor('--color-teal', '#00B3A7');
  const gold = cssColor('--color-gold', '#FBC619');
  const white = new Color(0xffffff);

  const stage = createStage({ canvas, anchor, onFail });
  const { renderer, scene, camera, sys, layout } = stage;
  stage.layoutNow();

  /* lights: the bulb is the key; teal rim + soft fills keep the near side of every product readable */
  scene.add(new AmbientLight(0x0e5a54, 0.55));
  scene.add(new HemisphereLight(0x6fe3d6, 0x04201d, 0.5));
  const fill = new DirectionalLight(0xbff3ee, 0.4);                                    // follows the camera
  scene.add(fill);

  const mats = createMaterials();
  const bulb = createBulb({ scene, teal, gold, white, plastic: mats.plastic });
  const glow = createGlow({ scene, camera, gold, teal, white, dpr: stage.dpr });
  const world = createPlanets({ sys, data, mats });
  const { planets } = world;
  const orbits = createOrbits({ orbitGroups: planets.map((p) => p.orbit), teal, gold, white });
  const tourOrder = CATALOGUE.map((id) => data.findIndex((d) => d.id === id));

  /* ---- state: everything animated is a spring/target, so any change can be interrupted ---- */
  const S = { on: true, f: 1, f0: 1, t0: -1e9, paused: false, beat: -1, hover: -1, hoverBulb: false, domHover: false, dragging: false, az: 0 };
  const speed = new Spring(springs.gentle, 1);                                         // orbit time-scale
  const tourMix = new Spring(springs.gentle, 0);                                       // 0 overview → 1 close-up (fill light, etc.)
  const R = planets.map(() => new Spring(springs.gentle, 1));                          // per-ring/per-planet "powered" reaction
  let simT = 0, clock = 0;
  const timers = [];

  const rig = createCameraRig({ camera, sys, S, planets, layout, tourOrder });
  const interact = createInteract({
    canvas, camera, sys, S, planets, bulb, layout, data, labelsEl, popEl, poke: stage.poke, coarse,
    onToggle: (v) => onToggle(v), onPlanetClick: (id) => onPlanetClick(id),
  });
  stage.setLayoutHook(() => { rig.snap(); glow.setPixelRatio(stage.dpr); });

  const v = new Vector3();
  let bx = -1, by = -1;
  function frame(dt, now) {
    clock += dt;
    const target = S.paused || FREEZE ? 0 : S.beat >= 0 && S.beat <= 5 ? 0.12 : S.hover >= 0 ? 0.15 : 1;
    speed.to(target);
    simT += dt * speed.step(dt);

    interact.update(dt);                                                               // 1 · system rotation (drag lands this frame)
    const tt = now - S.t0;
    S.f = S.on ? filamentOn(tt, S.f0) : filamentOff(tt, S.f0);
    R.forEach((r) => r.step(dt));
    const Rv = R.map((r) => r.x);
    world.update(simT, clock, dt, Rv, camera.quaternion, S.hover);
    orbits.update(Rv, simT, S.hover);
    rig.update(dt);
    fill.position.copy(camera.position);
    tourMix.to(S.beat >= 0 && S.beat <= 5 ? 1 : 0);
    fill.intensity = 0.4 + 1.3 * tourMix.step(dt);                                    // close up, the product must read as white PVC
    bulb.update(S.f);
    glow.update(S.f, clock, now);
    interact.project();                                                                // 2 · hover test, card + tags in screen space

    // the CSS bloom (extra warm haze behind the canvas) follows the bulb on screen
    v.set(0, 0.12, 0).project(camera);
    const px = Math.round((v.x * 0.5 + 0.5) * 1000) / 10, py = Math.round((-v.y * 0.5 + 0.5) * 1000) / 10;
    if (px !== bx || py !== by) { bx = px; by = py; hero.style.setProperty('--bloom-x', px + '%'); hero.style.setProperty('--bloom-y', py + '%'); }
  }
  const moving = (now) =>
    speed.x > 0.002 || speed.moving || tourMix.moving || R.some((r) => r.moving) || rig.moving || interact.moving ||
    planets.some((p) => p.pop.moving) || now - S.t0 < 1700 || glow.animating;
  stage.setLoop(motion.onFrame, frame, moving);

  /* ---- mount: layout → first frame → async shader compile → benchmark → reveal -------------- */
  rig.snap();
  frame(0.016, performance.now());
  try { await renderer.compileAsync(scene, camera); } catch (err) { /* older drivers: the first render compiles */ }
  const perFrame = stage.benchmark();                                                  // software GL / weak GPU → refuse before the canvas ever shows
  if (perFrame > 45) {
    interact.destroy();
    stage.destroy();
    throw new Error(`hero-3d: ${perFrame.toFixed(0)} ms/frame — using the static still`);
  }
  const io = stage.observe(pin);
  stage.onContextLost(() => { hero.classList.remove('is-3d', 'hero--chapter'); onFail && onFail(); });
  stage.poke(5200);                                                                    // intro: a few seconds of life, then it may sleep
  requestAnimationFrame(() => requestAnimationFrame(() => onReady && onReady()));

  return {
    /** the bulb: ignition 0→1 / afterglow 1→0, rings ignite inner→outer, planets react in turn */
    setLight(next) {
      if (next === S.on) return;
      S.on = next;
      S.f0 = S.f;
      S.t0 = performance.now();
      timers.splice(0).forEach(clearTimeout);
      R.forEach((r, k) => {
        const d = next ? 120 + 70 * k : 40 * (R.length - 1 - k);                       // on: outward · off: dims inward
        timers.push(setTimeout(() => { r.to(next ? 1 : 0); stage.poke(1600); }, d));
      });
      if (next) glow.ignite(S.t0);
      stage.poke(2800);
    },
    setPaused(p) { S.paused = p; stage.poke(1600); },
    setBeat(b) { S.beat = b; stage.poke(2600); },
    setProgress() { stage.poke(1400); },
    highlight(id) { interact.highlight(id); },
    destroy() { timers.splice(0).forEach(clearTimeout); interact.destroy(); io.disconnect(); stage.destroy(); },
  };
}
