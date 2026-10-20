/* ==========================================================================
   Hero 3D — shared helpers (no scene state in here)
   ========================================================================== */
import { Shape, Path, ExtrudeGeometry, Color, CanvasTexture, SRGBColorSpace } from 'three';

/** A damped spring stepped by hand inside the render tick (no extra rAF subscriptions).
 *  Same physics as motion.js springValue; configs come from motion-tokens.js. */
export class Spring {
  constructor(cfg, x = 0) {
    this.k = cfg.stiffness; this.c = cfg.damping; this.m = cfg.mass || 1;
    this.x = x; this.v = 0; this.t = x;
  }
  to(t) { this.t = t; return this; }
  set(x) { this.x = this.t = x; this.v = 0; return this; }
  step(dt) {
    if (!(dt > 0)) return this.x;
    const n = Math.max(1, Math.ceil(dt * 240));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      this.v += ((-this.k * (this.x - this.t) - this.c * this.v) / this.m) * h;
      this.x += this.v * h;
    }
    return this.x;
  }
  get moving() { return Math.abs(this.x - this.t) > 5e-4 || Math.abs(this.v) > 2e-3; }
}

/** deterministic RNG so every load (and every still capture) looks identical */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function roundedRect(Ctor, w, h, r) {
  const s = new Ctor();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r);
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h);
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}
export const rrShape = (w, h, r) => roundedRect(Shape, w, h, r);
export const rrPath = (w, h, r) => roundedRect(Path, w, h, r);

export const extrude = (shape, depth, bevel, seg = 14) =>
  new ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.9, bevelSegments: 4, curveSegments: seg });

export const cssColor = (name, fallback) => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return new Color(v || fallback);
};

/** soft radial sprite texture drawn at runtime — no image downloads */
export function radialTexture(stops, size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, col]) => grad.addColorStop(o, col));
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

/** The real product finishes (from products.json via build/templates.mjs finishKey) → moon materials */
export const FINISH = {
  white: { color: 0xeef2f1, rough: 0.45 },
  black: { color: 0x22292a, rough: 0.6 },
  gloss: { color: 0x1a1f20, rough: 0.2 },
  grey: { color: 0x8a9594, rough: 0.55 },
  orange: { color: 0xe8792a, rough: 0.45 },
  silver: { color: 0xc3cacc, rough: 0.3 },
  metal: { color: 0xa9b2b4, rough: 0.35 },
};

/** Orbit geometry — nearest the bulb first (matches build/templates.mjs ORBIT_ORDER) */
export const ORBIT_R = [2.1, 3.3, 4.5, 5.8, 7.3, 9.0];
export const ORBIT_INC = [3, -2, 4, -3, 2, -1.5].map((d) => (d * Math.PI) / 180);
export const GOLDEN = 2.39996;
export const orbitPeriod = (r) => 24 * Math.pow(r / 2.1, 1.25);
export const planetSize = (families) => 1.2 * (0.5 + 0.027 * families);   // 0.66 … 1.09 — the products are the point; neighbours may touch at a conjunction

/* stardust (the M1 dust shader, re-scaled for a far camera) */
export const DUST_VERT = /* glsl */ `
  attribute vec4 aSeed; uniform float uTime; uniform float uPx; uniform float uSize;
  varying vec4 vSeed;
  void main() {
    vSeed = aSeed;
    vec3 p = position;
    p.x += sin(uTime * 0.16 * (0.5 + aSeed.x) + aSeed.y * 6.2831) * 0.12;
    p.z += cos(uTime * 0.13 * (0.5 + aSeed.z) + aSeed.w * 6.2831) * 0.12;
    p.y += sin(uTime * 0.09 + aSeed.x * 6.2831) * 0.07;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uPx * (0.55 + aSeed.z) * (30.0 / max(0.1, -mv.z));
  }`;
export const DUST_FRAG = /* glsl */ `
  uniform vec3 uTeal; uniform vec3 uAmber; uniform float uWarm; uniform float uIntensity; uniform float uTime;
  varying vec4 vSeed;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float soft = smoothstep(0.5, 0.0, d);
    float tw = 0.45 + 0.55 * sin(uTime * (0.5 + vSeed.x) + vSeed.y * 40.0);
    float a = soft * soft * tw * uIntensity;
    gl_FragColor = vec4(mix(uTeal, uAmber, uWarm), a);
    #include <colorspace_fragment>
  }`;
