/* ==========================================================================
   Hero 3D — glow system: core/halo/streak sprites, corona rays, ignition shock ring,
   stardust. Sprites are depth-TESTED, so a planet passing in front of the bulb
   genuinely eclipses it. No post-processing, no texture downloads.
   ========================================================================== */
import {
  Group, Sprite, SpriteMaterial, AdditiveBlending, Mesh, PlaneGeometry, ShaderMaterial, RingGeometry, MeshBasicMaterial,
  Points, BufferGeometry, Float32BufferAttribute, Color,
} from 'three';
import { radialTexture, mulberry32, DUST_VERT, DUST_FRAG } from './shared.js';

const CORONA_FRAG = /* glsl */ `
  uniform float uOn; uniform float uTime; uniform vec3 uColor;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  void main() {
    vec2 p = vUv - 0.5;
    float r = length(p) * 2.0;
    float a = atan(p.y, p.x);
    float rays = noise(vec2(a * 5.0 + uTime * 0.03, 1.0)) * noise(vec2(a * 11.0 - uTime * 0.02, 7.0));
    float fall = exp(-r * 3.6) * smoothstep(1.0, 0.12, r);
    float alpha = min(rays * 1.9 * fall * uOn, 0.28);
    gl_FragColor = vec4(uColor, alpha);
    #include <colorspace_fragment>
  }`;
const PLANE_VERT = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

export function createGlow({ scene, camera, gold, teal, white, dpr }) {
  const g = new Group();
  g.position.set(0, 0.12, 0);
  scene.add(g);

  const mk = (tex, w, h) => {
    const m = new SpriteMaterial({ map: tex, blending: AdditiveBlending, depthWrite: false, depthTest: true, transparent: true, opacity: 0 });
    const s = new Sprite(m);
    s.scale.set(w, h, 1);
    g.add(s);
    return s;
  };
  const core = mk(radialTexture([[0, 'rgba(255,248,230,1)'], [0.18, 'rgba(255,230,170,.75)'], [0.5, 'rgba(255,190,80,.18)'], [1, 'rgba(255,180,60,0)']]), 1.8, 1.8);
  const halo = mk(radialTexture([[0, 'rgba(255,200,110,.55)'], [0.35, 'rgba(250,182,5,.18)'], [1, 'rgba(250,182,5,0)']]), 7, 7);
  const streak = mk(radialTexture([[0, 'rgba(255,240,200,.9)'], [0.4, 'rgba(255,200,120,.25)'], [1, 'rgba(255,200,120,0)']]), 11, 0.32);

  const coronaMat = new ShaderMaterial({
    uniforms: { uOn: { value: 0 }, uTime: { value: 0 }, uColor: { value: gold.clone().lerp(white, 0.35) } },
    vertexShader: PLANE_VERT, fragmentShader: CORONA_FRAG,
    transparent: true, depthWrite: false, depthTest: true, blending: AdditiveBlending,
  });
  const corona = new Mesh(new PlaneGeometry(13, 13), coronaMat);
  g.add(corona);

  const shockMat = new MeshBasicMaterial({ color: teal.clone().lerp(white, 0.4), transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false });
  const shock = new Mesh(new RingGeometry(0.97, 1, 128), shockMat);
  shock.rotation.x = -Math.PI / 2;
  shock.visible = false;
  g.add(shock);

  /* stardust: a thin disc of motes around the system plane */
  const N = 400;
  const rng = mulberry32(7);
  const pos = new Float32Array(N * 3);
  const seed = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    const r = 2.5 + Math.sqrt(rng()) * 8.5;
    const th = rng() * Math.PI * 2;
    pos.set([Math.cos(th) * r, (rng() - 0.5) * 5, Math.sin(th) * r], i * 3);
    seed.set([rng(), rng(), rng(), rng()], i * 4);
  }
  const dustGeo = new BufferGeometry();
  dustGeo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  dustGeo.setAttribute('aSeed', new Float32BufferAttribute(seed, 4));
  const dustU = {
    uTime: { value: 0 }, uPx: { value: dpr }, uSize: { value: 2.2 },
    uTeal: { value: new Color(0x9ff5ee) }, uAmber: { value: gold.clone() }, uWarm: { value: 0 }, uIntensity: { value: 0.3 },
  };
  const dust = new Points(dustGeo, new ShaderMaterial({ uniforms: dustU, vertexShader: DUST_VERT, fragmentShader: DUST_FRAG, transparent: true, depthWrite: false, blending: AdditiveBlending }));
  dust.frustumCulled = false;
  scene.add(dust);

  let shockT0 = -1;
  return {
    setPixelRatio(v) { dustU.uPx.value = v; },
    ignite(nowMs) { shockT0 = nowMs; shock.visible = true; },
    /** f: bulb level 0..1; time: seconds; nowMs: performance.now() */
    update(f, time, nowMs) {
      const flick = 1 + 0.015 * Math.sin(time * 9);
      core.material.opacity = 0.95 * f;
      core.scale.setScalar(1.8 * (0.6 + 0.4 * f) * flick);
      halo.material.opacity = 0.85 * f;
      halo.scale.setScalar(7 * (0.8 + 0.2 * f));
      streak.material.opacity = 0.5 * f;
      coronaMat.uniforms.uOn.value = f;
      coronaMat.uniforms.uTime.value = time;
      corona.quaternion.copy(camera.quaternion);                   // billboard
      dustU.uTime.value = time;
      dustU.uWarm.value = f;
      dustU.uIntensity.value = 0.3 + 0.9 * f;
      if (shockT0 >= 0) {
        const x = (nowMs - shockT0) / 1100;
        if (x >= 1) { shockT0 = -1; shock.visible = false; shockMat.opacity = 0; }
        else {
          const e = 1 - Math.pow(1 - x, 3);                        // ease-out
          shock.scale.setScalar(0.9 + (9 - 0.9) * e);
          shockMat.opacity = 0.5 * (1 - x);
        }
      }
    },
    get animating() { return shockT0 >= 0; },
  };
}
