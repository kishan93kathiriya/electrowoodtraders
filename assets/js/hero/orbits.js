/* ==========================================================================
   Hero 3D — orbits as wires: a hairline conductor per orbit with a current pulse
   travelling around it. Ring k ignites with its planet (same reaction value r).
   ========================================================================== */
import { LineLoop, BufferGeometry, Float32BufferAttribute, ShaderMaterial, AdditiveBlending } from 'three';
import { ORBIT_R } from './shared.js';

const VERT = /* glsl */ `attribute float aT; varying float vT; void main() { vT = aT; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FRAG = /* glsl */ `
  uniform vec3 uColor; uniform vec3 uPulseColor; uniform float uAlpha; uniform float uHead; uniform float uPulse;
  varying float vT;
  void main() {
    float d = abs(vT - uHead);
    d = min(d, 1.0 - d);
    float p = exp(-d * d / (2.0 * 0.035 * 0.035)) * uPulse;
    gl_FragColor = vec4(mix(uColor, uPulseColor, clamp(p, 0.0, 1.0)), uAlpha + p * 0.6);
    #include <colorspace_fragment>
  }`;

export function createOrbits({ orbitGroups, teal, gold, white }) {
  const SEG = 192;
  const rings = orbitGroups.map((grp, i) => {
    const pos = new Float32Array(SEG * 3);
    const t = new Float32Array(SEG);
    for (let s = 0; s < SEG; s++) {
      const a = (s / SEG) * Math.PI * 2;
      pos.set([ORBIT_R[i] * Math.cos(a), 0, ORBIT_R[i] * Math.sin(a)], s * 3);
      t[s] = s / SEG;
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
    geo.setAttribute('aT', new Float32BufferAttribute(t, 1));
    const mat = new ShaderMaterial({
      uniforms: {
        uColor: { value: teal.clone() }, uPulseColor: { value: gold.clone().lerp(white, 0.5) },
        uAlpha: { value: 0.05 }, uHead: { value: (i * 0.37) % 1 }, uPulse: { value: 0 },
      },
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: AdditiveBlending,
    });
    const line = new LineLoop(geo, mat);
    line.frustumCulled = false;
    grp.add(line);
    return mat;
  });
  return {
    /** R: 6 reaction values; simT: orbit clock (stops when paused); hot: hovered planet index */
    update(R, simT, hot) {
      rings.forEach((m, i) => {
        m.uniforms.uAlpha.value = 0.05 + 0.09 * R[i] + (hot === i ? 0.1 : 0);
        m.uniforms.uHead.value = ((i * 0.37) + simT * 0.07) % 1;
        m.uniforms.uPulse.value = 0.9 * R[i];
      });
    },
  };
}
