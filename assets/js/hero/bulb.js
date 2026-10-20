/* ==========================================================================
   Hero 3D — the bulb (the sun). A60 glass, LED-filament strands, B22 brass cap,
   seated in a white PVC angle holder (the Electro product — the bulb itself is
   never presented as one). One PointLight sits at the filament and lights the system.
   ========================================================================== */
import {
  Group, Mesh, LatheGeometry, Vector2, Vector3, CatmullRomCurve3, TubeGeometry, CylinderGeometry, TorusGeometry,
  ShaderMaterial, AdditiveBlending, MeshBasicMaterial, MeshStandardMaterial, MeshPhysicalMaterial, PointLight,
  DirectionalLight, SphereGeometry, Color,
} from 'three';
import { rrShape, extrude } from './shared.js';

const GLASS_VERT = /* glsl */ `
  varying vec3 vN; varying vec3 vV;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }`;
const GLASS_FRAG = /* glsl */ `
  uniform vec3 uColor; uniform float uAlpha;
  varying vec3 vN; varying vec3 vV;
  void main() {
    float fr = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
    gl_FragColor = vec4(uColor, (0.06 + 0.5 * fr) * uAlpha);
    #include <colorspace_fragment>
  }`;

export function createBulb({ scene, teal, gold, white, plastic }) {
  const group = new Group();
  group.scale.setScalar(1.15);                                       // the sun is a little larger than life
  scene.add(group);

  /* glass — fresnel shader instead of physical transmission (far cheaper, same read) */
  const profile = [
    [0.26, -0.62], [0.27, -0.55], [0.30, -0.42], [0.38, -0.28], [0.5, -0.12], [0.62, 0.05], [0.7, 0.22],
    [0.74, 0.42], [0.73, 0.6], [0.66, 0.76], [0.52, 0.88], [0.32, 0.94], [0.12, 0.965], [0, 0.97],
  ].map(([x, y]) => new Vector2(x, y));
  const glassMat = new ShaderMaterial({
    uniforms: { uColor: { value: teal.clone().lerp(white, 0.5) }, uAlpha: { value: 1 } },
    vertexShader: GLASS_VERT, fragmentShader: GLASS_FRAG,
    transparent: true, depthWrite: false, blending: AdditiveBlending,
  });
  const glass = new Mesh(new LatheGeometry(profile, 40), glassMat);
  glass.renderOrder = 3;
  group.add(glass);

  /* filament: four LED strands + a thin support stem */
  const filMat = new MeshBasicMaterial({ color: 0x2a2210, toneMapped: false });
  for (const x0 of [-0.14, -0.05, 0.05, 0.14]) {
    const curve = new CatmullRomCurve3([
      new Vector3(x0 * 0.7, -0.2, 0), new Vector3(x0 * 1.25, 0.02, 0.035), new Vector3(x0, 0.24, -0.035), new Vector3(x0 * 0.8, 0.42, 0),
    ]);
    group.add(new Mesh(new TubeGeometry(curve, 24, 0.014, 6, false), filMat));
  }
  const stem = new Mesh(new CylinderGeometry(0.035, 0.05, 0.42, 12), new MeshBasicMaterial({ color: 0x6a8e8a, transparent: true, opacity: 0.55 }));
  stem.position.y = -0.42;
  group.add(stem);

  /* B22 brass cap + bayonet pins + thread rings */
  const brass = new MeshStandardMaterial({ color: 0xd3a64c, roughness: 0.4, metalness: 0.65 });
  const cap = new Mesh(new CylinderGeometry(0.27, 0.27, 0.36, 36), brass);
  cap.position.y = -0.8;
  group.add(cap);
  for (const y of [-0.9, -0.82, -0.74]) {
    const ring = new Mesh(new TorusGeometry(0.275, 0.018, 8, 36), brass);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    group.add(ring);
  }
  for (const s of [-1, 1]) {
    const pin = new Mesh(new CylinderGeometry(0.03, 0.03, 0.12, 10), brass);
    pin.rotation.z = Math.PI / 2;
    pin.position.set(s * 0.29, -0.72, 0);
    group.add(pin);
  }

  /* the Electro angle holder: PVC socket body on a flat PVC plate */
  const holderProfile = [[0, -1.34], [0.58, -1.34], [0.58, -1.27], [0.44, -1.18], [0.4, -1.06], [0.4, -0.97], [0, -0.97]].map(([x, y]) => new Vector2(x, y));
  group.add(new Mesh(new LatheGeometry(holderProfile, 36), plastic));
  const plate = new Mesh(extrude(rrShape(1.7, 1.7, 0.3), 0.1, 0.03, 18), plastic);
  plate.rotation.x = -Math.PI / 2;                                  // local +z → world +y: lies flat, thickness upward
  plate.position.y = -1.5;
  group.add(plate);

  /* the sun's light */
  const warm = gold.clone().lerp(white, 0.5);                       // keep it low in green: teal + amber turns white plastic mint
  const light = new PointLight(warm, 0, 0, 1.2);
  light.position.set(0, 0.12, 0);
  scene.add(light);
  const rim = new DirectionalLight(teal, 1.1);                      // silhouettes the system when the bulb is off
  rim.position.set(0, 4, -9);
  scene.add(rim);

  /* invisible collider so the bulb itself is clickable */
  const collider = new Mesh(new SphereGeometry(1.15, 12, 8), new MeshBasicMaterial({ visible: false }));
  collider.position.y = 0.1;
  group.add(collider);

  const offFil = new Color(0x2a2210);
  const onFil = new Color(0xffd58a);
  const tealGlass = teal.clone().lerp(white, 0.5);
  const warmGlass = new Color(0xffe6b8);
  const I_ON = 34;

  return {
    group, light, rim, collider,
    /** f: filament/light level 0..1 */
    update(f) {
      filMat.color.lerpColors(offFil, onFil, f);
      glassMat.uniforms.uColor.value.lerpColors(tealGlass, warmGlass, f);
      light.intensity = f * I_ON;
      rim.intensity = 1.1 + (0.45 - 1.1) * f;
    },
  };
}

/** Ignition curve (ms since toggle). From the plan: 0–60 inrush .25, 60–110 flicker dip .12,
 *  110–420 ramp to 1; off: afterglow 1→.15 in 120 ms, then exponential to 0. Interruptible: always starts from `from`. */
export function filamentOn(tt, from) {
  const lift = (a, b, t) => a + (b - a) * Math.min(1, Math.max(0, t));
  const ease = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
  if (from > 0.45) return lift(from, 1, ease(tt / 220));                         // interrupted mid-off: no flicker, just recover
  if (tt < 60) return lift(from, 0.25, tt / 60);
  if (tt < 110) return lift(0.25, 0.12, (tt - 60) / 50);
  return lift(0.12, 1, ease((tt - 110) / 310));
}
export function filamentOff(tt, from) {
  if (tt < 120) return from + (Math.min(from, 0.15) - from) * (1 - Math.pow(1 - tt / 120, 2));
  return Math.min(from, 0.15) * Math.exp(-(tt - 120) / 220);
}
