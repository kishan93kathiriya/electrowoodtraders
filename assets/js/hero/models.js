/* ==========================================================================
   Hero 3D — the six planets (procedural products) and their 35 moons.
   Each planet is a model of its range's signature product, normalised so its
   largest dimension = 2 × planet size, always turned toward the camera with a
   slow sway (flat products spinning edge-on would look broken).
   Each also "reacts to power" through r (0..1) — the same value the orbit ring uses.
   ========================================================================== */
import {
  Group, Mesh, BoxGeometry, CylinderGeometry, TorusGeometry, CircleGeometry, RingGeometry, SphereGeometry, TubeGeometry,
  CatmullRomCurve3, Vector3, Box3, Quaternion, Euler, InstancedMesh, Color, Matrix4, PlaneGeometry, CanvasTexture,
  AdditiveBlending, SRGBColorSpace, MeshStandardMaterial, MeshPhysicalMaterial, MeshBasicMaterial, DynamicDrawUsage,
} from 'three';
import { rrShape, rrPath, extrude, FINISH, mulberry32, GOLDEN, ORBIT_R, ORBIT_INC, orbitPeriod, planetSize, Spring } from './shared.js';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const sstep = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };

export function createMaterials() {
  return {
    plastic: new MeshPhysicalMaterial({ color: 0xeef2f1, roughness: 0.42, clearcoat: 0.4, clearcoatRoughness: 0.38 }),
    soft: new MeshPhysicalMaterial({ color: 0xe3e9e8, roughness: 0.5, clearcoat: 0.2, clearcoatRoughness: 0.5 }),
    rocker: new MeshPhysicalMaterial({ color: 0xf6f8f8, roughness: 0.32, clearcoat: 0.75, clearcoatRoughness: 0.25 }),
    grey: new MeshStandardMaterial({ color: 0x8a9594, roughness: 0.62, metalness: 0.05 }),
    greyDark: new MeshStandardMaterial({ color: 0x5b6867, roughness: 0.7, metalness: 0.05 }),
    dark: new MeshStandardMaterial({ color: 0x252d2e, roughness: 0.55, metalness: 0.1 }),
    brass: new MeshStandardMaterial({ color: 0xc9a24b, roughness: 0.38, metalness: 0.8 }),
    copper: new MeshStandardMaterial({ color: 0xb8683a, roughness: 0.35, metalness: 0.8 }),
  };
}

/** scale a model so its largest dimension = 2 (radius 1), centred on its bounding box */
function fit(model) {
  model.updateMatrixWorld(true);
  const box = new Box3().setFromObject(model);
  const size = new Vector3();
  const center = new Vector3();
  box.getSize(size);
  box.getCenter(center);
  const wrap = new Group();
  model.position.sub(center);
  wrap.add(model);
  wrap.scale.setScalar(2 / Math.max(size.x, size.y, size.z));
  return wrap;
}
const hotMat = (hex) => new MeshBasicMaterial({ color: hex, toneMapped: false });

/* ---- 1 · Modular switches & plates: plate + 1-module frame + a real rocker ------------------- */
function plateModel(M) {
  const g = new Group();
  const shape = rrShape(2.2, 2.2, 0.3);
  shape.holes.push(rrPath(1.1, 1.72, 0.2));
  g.add(new Mesh(extrude(shape, 0.1, 0.035, 18), M.plastic));
  g.add(new Mesh(extrude(rrShape(1, 1.6, 0.17), 0.1, 0.012, 10), M.soft));
  const body = new Mesh(new BoxGeometry(0.92, 1.5, 0.3), M.grey);
  body.position.z = -0.17;
  g.add(body);
  const pivot = new Group();
  pivot.position.set(0, 0, 0.177);
  g.add(pivot);
  const rocker = new Mesh(extrude(rrShape(0.78, 1.3, 0.14), 0.07, 0.03, 12), M.rocker);
  rocker.position.z = -0.035;
  pivot.add(rocker);
  const led = hotMat(0x1c1608);
  const dot = new Mesh(new CircleGeometry(0.06, 16), led);
  dot.position.set(0, 0.5, 0.101);
  rocker.add(dot);
  return {
    group: g,
    react(r) {
      pivot.rotation.x = lerp(-0.17, 0.17, r);
      led.color.setRGB(lerp(0.05, 1, r), lerp(0.04, 0.72, r), lerp(0.01, 0.12, r));
    },
  };
}

/* ---- 2 · Concealed & surface boxes: open-front PVC box with knockouts ------------------------- */
function boxModel(M) {
  const g = new Group();
  const BW = 1.38, BH = 1.98, BD = 0.74, BT = 0.07;
  const wall = (w, h, d, x, y, z) => { const m = new Mesh(new BoxGeometry(w, h, d), M.grey); m.position.set(x, y, z); g.add(m); };
  wall(BW, BH, BT, 0, 0, -BD + BT / 2);
  wall(BT, BH, BD, -(BW / 2 - BT / 2), 0, -BD / 2);
  wall(BT, BH, BD, BW / 2 - BT / 2, 0, -BD / 2);
  wall(BW - 2 * BT, BT, BD, 0, BH / 2 - BT / 2, -BD / 2);
  wall(BW - 2 * BT, BT, BD, 0, -(BH / 2 - BT / 2), -BD / 2);
  const kp = [[0, 0], [0.3, 0], [-0.3, 0], [0, 0.34], [0, -0.34]];
  kp.forEach(([x, y]) => {
    const k = new Mesh(new CircleGeometry(0.1, 20), M.greyDark);
    k.position.set(x, y + 0.46, -BD + BT + 0.003);
    g.add(k);
  });
  for (const s of [1, -1]) {
    const ear = new Mesh(new BoxGeometry(0.36, 0.16, 0.06), M.grey);
    ear.position.set(0, s * (BH / 2 + 0.07), -0.04);
    g.add(ear);
  }
  const glint = hotMat(0x2a1a10);                                    // a copper knockout rim catches the light when powered
  const rim = new Mesh(new RingGeometry(0.1, 0.145, 28), glint);
  rim.position.set(0.3, 0.46, -BD + BT + 0.006);
  g.add(rim);
  return { group: g, react(r) { glint.color.setRGB(lerp(0.16, 1, r), lerp(0.1, 0.55, r), lerp(0.06, 0.2, r)); } };
}

/* ---- 3 · Wiring accessories: cable-tie bundling three wires -------------------------------------- */
function wiringModel(M) {
  const g = new Group();
  g.add(new Mesh(new TorusGeometry(0.62, 0.075, 14, 48), M.plastic));
  const head = new Mesh(new BoxGeometry(0.3, 0.22, 0.24), M.plastic);
  head.position.set(0.62, 0, 0);
  g.add(head);
  const tail = new Mesh(new BoxGeometry(0.75, 0.07, 0.035), M.plastic);
  tail.position.set(1.12, 0.06, 0);
  tail.rotation.z = 0.12;
  g.add(tail);
  const cols = [0x1c2222, 0x9aa5a4, 0xe8792a];
  const at = [[-0.2, -0.12], [0.2, -0.12], [0, 0.2]];
  const beads = [];
  at.forEach(([x, y], i) => {
    const w = new Mesh(new CylinderGeometry(0.14, 0.14, 1.7, 18), new MeshStandardMaterial({ color: cols[i], roughness: 0.55 }));
    w.rotation.x = Math.PI / 2;
    w.position.set(x, y, 0);
    g.add(w);
    for (const s of [-1, 1]) {
      const tip = new Mesh(new CylinderGeometry(0.085, 0.085, 0.24, 14), M.copper);
      tip.rotation.x = Math.PI / 2;
      tip.position.set(x, y, s * 0.9);
      g.add(tip);
    }
    const bead = new Mesh(new SphereGeometry(0.07, 12, 8), hotMat(0xffe2a6));
    bead.position.set(x, y, 0);
    bead.visible = false;
    g.add(bead);
    beads.push({ bead, x, y, ph: i * 0.33 });
  });
  return {
    group: g,
    react(r, time) {
      beads.forEach((b) => {
        b.bead.visible = r > 0.03;                                     // current runs along the wires only when powered
        b.bead.scale.setScalar(Math.max(0.001, r));
        b.bead.position.z = lerp(-0.85, 0.85, (time * 0.45 + b.ph) % 1);
      });
    },
  };
}

/* ---- 4 · Distribution & MCB boxes: enclosure, open door, six breakers ----------------------------- */
function distributionModel(M) {
  const g = new Group();
  const backPlate = new Mesh(new BoxGeometry(1.7, 1.9, 0.06), M.grey);
  backPlate.position.set(0, 0, -0.2);
  g.add(backPlate);
  const wall = (w, h, d, x, y) => { const m = new Mesh(new BoxGeometry(w, h, d), M.grey); m.position.set(x, y, -0.04); g.add(m); };
  wall(0.08, 1.9, 0.32, -0.81, 0);
  wall(0.08, 1.9, 0.32, 0.81, 0);
  wall(1.7, 0.08, 0.32, 0, 0.91);
  wall(1.7, 0.08, 0.32, 0, -0.91);
  const rail = new Mesh(new BoxGeometry(1.45, 0.07, 0.05), M.dark);
  rail.position.set(0, -0.02, -0.12);
  g.add(rail);
  const levers = [];
  for (let i = 0; i < 6; i++) {
    const x = (i - 2.5) * 0.245;
    const br = new Mesh(new BoxGeometry(0.2, 0.62, 0.2), M.soft);
    br.position.set(x, -0.02, -0.02);
    g.add(br);
    const pv = new Group();
    pv.position.set(x, 0.17, 0.09);
    const lv = new Mesh(new BoxGeometry(0.09, 0.17, 0.09), M.dark);
    lv.position.y = 0.04;
    pv.add(lv);
    g.add(pv);
    levers.push(pv);
  }
  const door = new Group();                                           // door swung open on its left hinge
  door.position.set(-0.85, 0, 0.12);
  const panel = new Mesh(new BoxGeometry(1.7, 1.9, 0.05), M.soft);
  panel.position.x = 0.85;
  door.add(panel);
  door.rotation.y = -1.3;
  g.add(door);
  return {
    group: g,
    react(r) { levers.forEach((pv, i) => { pv.rotation.x = lerp(0.55, -0.55, sstep((r - i * 0.09) / 0.45)); }); },   // flip ON in sequence
  };
}

/* ---- 5 · Power strips, flex boards & regulators: 4-socket strip with a lit master switch ------------ */
function powerModel(M) {
  const g = new Group();
  g.add(new Mesh(extrude(rrShape(2.2, 0.62, 0.2), 0.24, 0.03, 14), M.plastic));
  const FZ = 0.3;
  for (let i = 0; i < 4; i++) {
    const x = -0.9 + i * 0.5;
    const s = new Mesh(extrude(rrShape(0.4, 0.4, 0.08), 0.02, 0.005, 8), M.soft);
    s.position.set(x, 0, FZ - 0.02);
    g.add(s);
    for (const [px, py] of [[0, 0.1], [-0.09, -0.08], [0.09, -0.08]]) {
      const p = new Mesh(new CircleGeometry(0.035, 12), M.dark);
      p.position.set(x + px, py, FZ + 0.012);
      g.add(p);
    }
  }
  const sw = new Mesh(extrude(rrShape(0.2, 0.34, 0.05), 0.05, 0.01, 8), M.rocker);
  sw.position.set(0.98, -0.03, FZ - 0.03);
  g.add(sw);
  const led = hotMat(0x1c1608);
  const lamp = new Mesh(new CircleGeometry(0.04, 14), led);
  lamp.position.set(0.98, 0.2, FZ + 0.012);
  g.add(lamp);
  const cord = new Mesh(new TubeGeometry(new CatmullRomCurve3([
    new Vector3(-1.1, 0, 0.12), new Vector3(-1.25, -0.05, 0.14), new Vector3(-1.36, -0.26, 0.13), new Vector3(-1.3, -0.52, 0.09),
  ]), 20, 0.045, 8, false), M.dark);
  g.add(cord);
  return { group: g, react(r) { led.color.setRGB(lerp(0.05, 1, r), lerp(0.04, 0.66, r), lerp(0.01, 0.1, r)); } };
}

/* ---- 6 · LED foot lights & door bells: 2M plate with a glowing LED slot --------------------------- */
function lightingModel(M) {
  const g = new Group();
  g.add(new Mesh(extrude(rrShape(1.6, 0.82, 0.16), 0.12, 0.03, 14), M.plastic));
  const slotMat = hotMat(0x2a2414);
  const slot = new Mesh(extrude(rrShape(0.98, 0.13, 0.06), 0.01, 0.004, 8), slotMat);
  slot.position.set(0, 0.06, 0.15);
  g.add(slot);
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(64, 0, 0, 64, 0, 64);   // radius = half the canvas: alpha is 0 at every plane edge
  gr.addColorStop(0, 'rgba(255,214,140,.95)');
  gr.addColorStop(0.5, 'rgba(250,182,5,.28)');
  gr.addColorStop(1, 'rgba(250,182,5,0)');
  x.fillStyle = gr;
  x.fillRect(0, 0, 128, 128);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  const coneMat = new MeshBasicMaterial({ map: tex, transparent: true, blending: AdditiveBlending, depthWrite: false, opacity: 0 });
  const cone = new Mesh(new PlaneGeometry(1.5, 1.0), coneMat);
  cone.position.set(0, -0.5, 0.16);
  g.add(cone);
  return {
    group: g,
    react(r) { slotMat.color.setRGB(lerp(0.17, 1, r), lerp(0.14, 0.78, r), lerp(0.07, 0.35, r)); coneMat.opacity = 0.85 * r; },
  };
}

const BUILD = {
  'modular-switches-plates': plateModel,
  'concealed-surface-boxes': boxModel,
  'wiring-accessories': wiringModel,
  'distribution-mcb-boxes': distributionModel,
  'power-extension': powerModel,
  'lighting-doorbell': lightingModel,
};

/* ==========================================================================
   planets + moons
   ========================================================================== */
export function createPlanets({ sys, data, mats }) {
  const POSE = new Euler(0.28, -0.5, 0);                              // 3/4 view so every product reads as 3D
  const planets = data.map((d, i) => {
    const size = planetSize(d.families);
    const orbit = new Group();
    orbit.rotation.x = ORBIT_INC[i];
    sys.add(orbit);
    const holder = new Group();
    orbit.add(holder);
    const built = BUILD[d.id](mats);
    built.group.rotation.copy(POSE);
    const wrap = fit(built.group);
    wrap.scale.multiplyScalar(size);
    const facing = new Group();
    facing.add(wrap);
    holder.add(facing);
    const collider = new Mesh(new SphereGeometry(size * 1.3, 10, 8), new MeshBasicMaterial({ visible: false }));
    collider.userData.planet = i;
    holder.add(collider);
    return {
      i, id: d.id, size, data: d, orbit, holder, facing, collider, react: built.react,
      pos: new Vector3(), pop: new Spring({ stiffness: 300, damping: 30, mass: 1 }, 1), period: orbitPeriod(ORBIT_R[i]), r: ORBIT_R[i],
    };
  });

  /* moons: one per product family, coloured by the family's real finish */
  const total = data.reduce((a, d) => a + d.moons.length, 0);
  const moonMesh = new InstancedMesh(new BoxGeometry(0.09, 0.09, 0.09), new MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, metalness: 0.12 }), total);
  moonMesh.instanceMatrix.setUsage(DynamicDrawUsage);
  moonMesh.frustumCulled = false;
  const moons = [];
  let k = 0;
  data.forEach((d, i) => {
    d.moons.forEach((m, j) => {
      const rng = mulberry32(1000 + k * 31);
      moons.push({ planet: i, R: planets[i].size + 0.22 + 0.07 * (j % 3), T: 9 + rng() * 7, ph: rng() * Math.PI * 2, incl: (rng() - 0.5) * 1.2 });
      moonMesh.setColorAt(k, new Color(FINISH[m.finish].color));
      k++;
    });
  });
  moonMesh.instanceColor.needsUpdate = true;
  sys.add(moonMesh);

  const qa = new Quaternion();
  const qb = new Quaternion();
  const qsway = new Quaternion();
  const eul = new Euler();
  const up = new Vector3(0, 1, 0);
  const n = new Vector3();
  const e1 = new Vector3();
  const e2 = new Vector3();
  const m4 = new Matrix4();
  const v = new Vector3();

  return {
    planets, moonMesh,
    /** R: array of 6 reaction values; camQuat: camera world quaternion */
    update(simT, time, dt, R, camQuat, hoverIdx) {
      planets.forEach((p, i) => {
        const a = GOLDEN * i + (Math.PI * 2 * simT) / p.period;
        p.holder.position.set(p.r * Math.cos(a), 0, p.r * Math.sin(a));
        p.pos.copy(p.holder.position).applyEuler(p.orbit.rotation);
      });
      sys.updateMatrixWorld(true);
      planets.forEach((p, i) => {
        p.orbit.getWorldQuaternion(qa).invert();
        qb.copy(camQuat).premultiply(qa);                              // turn the product to face the camera…
        eul.set(0, 0.32 * Math.sin(time * 0.4 + i * 1.7), 0.05 * Math.sin(time * 0.3 + i));
        qsway.setFromEuler(eul);
        p.facing.quaternion.copy(qb).multiply(qsway);                  // …with a slow sway
        p.pop.to(hoverIdx === i ? 1.12 : 1);
        p.facing.scale.setScalar(p.pop.step(dt));
        p.react(R[i], time);
      });
      let q = 0;
      moons.forEach((mn) => {
        const p = planets[mn.planet];
        n.copy(p.pos);
        if (n.lengthSq() < 1e-6) n.set(1, 0, 0);
        n.normalize();
        e1.crossVectors(up, n).normalize();
        e2.crossVectors(n, e1);
        const th = mn.ph + (Math.PI * 2 * simT) / mn.T;
        const c = Math.cos(th) * mn.R;
        const s = Math.sin(th) * mn.R;
        v.copy(p.pos).addScaledVector(e1, c).addScaledVector(e2, s * Math.cos(mn.incl)).addScaledVector(n, s * Math.sin(mn.incl));
        m4.makeTranslation(v.x, v.y, v.z);
        moonMesh.setMatrixAt(q++, m4);
      });
      moonMesh.instanceMatrix.needsUpdate = true;
    },
  };
}
