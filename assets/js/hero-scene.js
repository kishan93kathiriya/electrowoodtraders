/**
 * ELECTRO — "Spotlight Wall" hero scene.
 * Purely decorative: carries no content that must be crawlable or read
 * by a screen reader. Lazy-loaded by site.js after first paint, and only
 * on capable, wide, motion-permitting viewports.
 */
import * as THREE from 'three';

const TEAL = 0x00b3a7;
const DEEP = 0x04302d;
const AMBER = 0xfab605;

/* ---------- procedural textures (no network requests) ------------------- */
function concreteTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 640;
  const x = c.getContext('2d');
  x.fillStyle = '#0c3a36';
  x.fillRect(0, 0, c.width, c.height);

  // vertical column grooves, like the concrete bays in the catalogue photos
  for (let i = 0; i < 9; i++) {
    const bx = (i / 9) * c.width + 18;
    const bw = c.width / 9 - 36;
    const g = x.createLinearGradient(bx, 0, bx + bw, 0);
    g.addColorStop(0, 'rgba(0,0,0,0.42)');
    g.addColorStop(0.18, 'rgba(255,255,255,0.05)');
    g.addColorStop(0.55, 'rgba(0,0,0,0.10)');
    g.addColorStop(1, 'rgba(0,0,0,0.46)');
    x.fillStyle = g;
    x.fillRect(bx, 0, bw, c.height);
  }
  // horizontal form-work seams
  x.strokeStyle = 'rgba(0,0,0,0.30)';
  x.lineWidth = 2;
  for (let i = 1; i < 5; i++) {
    const y = (i / 5) * c.height;
    x.beginPath(); x.moveTo(0, y); x.lineTo(c.width, y); x.stroke();
  }
  // grain
  const img = x.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 26;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  x.putImageData(img, 0, 0);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function beamAlphaTexture() {
  const c = document.createElement('canvas');
  c.width = 8; c.height = 256;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.30, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,1)');
  x.fillStyle = g; x.fillRect(0, 0, 8, 256);
  return new THREE.CanvasTexture(c);
}

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,236,190,1)');
  g.addColorStop(0.25, 'rgba(250,182,5,0.55)');
  g.addColorStop(1, 'rgba(250,182,5,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

/* ---------- geometry helpers ------------------------------------------- */
function roundedSquare(size, radius) {
  const h = size / 2, r = radius;
  const s = new THREE.Shape();
  s.moveTo(-h + r, -h);
  s.lineTo(h - r, -h); s.quadraticCurveTo(h, -h, h, -h + r);
  s.lineTo(h, h - r);  s.quadraticCurveTo(h, h, h - r, h);
  s.lineTo(-h + r, h); s.quadraticCurveTo(-h, h, -h, h - r);
  s.lineTo(-h, -h + r); s.quadraticCurveTo(-h, -h, -h + r, -h);
  return s;
}

function withHole(shape, r) {
  const p = new THREE.Path();
  p.absarc(0, 0, r, 0, Math.PI * 2, true);
  shape.holes.push(p);
  return shape;
}

const EXTRUDE = { depth: 0.05, bevelEnabled: true, bevelThickness: 0.014, bevelSize: 0.016, bevelSegments: 3, curveSegments: 32 };

/* ---------- mount ------------------------------------------------------- */
export async function mount(container, opts = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(DEEP);
  scene.fog = new THREE.FogExp2(DEEP, 0.085);

  const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 60);
  camera.position.set(0, 0.14, 6.3);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  container.appendChild(renderer.domElement);

  /* ---- materials: the three real finishes plus brass --------------- */
  const mat = {
    white: new THREE.MeshStandardMaterial({ name: 'finish-white', color: 0xeef2f1, roughness: 0.34, metalness: 0.02 }),
    black: new THREE.MeshStandardMaterial({ name: 'finish-matt-black', color: 0x14181a, roughness: 0.52, metalness: 0.06 }),
    grey:  new THREE.MeshStandardMaterial({ name: 'finish-matt-grey', color: 0x7e8785, roughness: 0.46, metalness: 0.04 }),
    brass: new THREE.MeshStandardMaterial({ name: 'brass-fitting', color: 0xc08b2c, roughness: 0.28, metalness: 0.92 }),
    filament: new THREE.MeshStandardMaterial({ name: 'filament', color: 0x2a2216, emissive: new THREE.Color(0xffc94a), emissiveIntensity: 0 }),
  };

  /* ---- backdrop + floor ------------------------------------------- */
  const wallTex = concreteTexture();
  wallTex.repeat.set(1.6, 1);
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 15),
    new THREE.MeshStandardMaterial({ map: wallTex, color: 0x0a302c, roughness: 0.96, metalness: 0 })
  );
  wall.name = 'backdrop';
  wall.position.set(0, 0.4, -2.9);
  wall.receiveShadow = true;
  scene.add(wall);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 12),
    new THREE.MeshStandardMaterial({ color: 0x041916, roughness: 0.78, metalness: 0.1 })
  );
  floor.name = 'floor';
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -2.7, -0.4);
  floor.receiveShadow = true;
  scene.add(floor);

  /* ---- the product wall -------------------------------------------- */
  const wallGroup = new THREE.Group();
  wallGroup.name = 'product-wall';
  scene.add(wallGroup);

  const filaments = [];   // { mesh, sprite }
  const glowMap = glowTexture();

  function makeRingPlate(size, finish) {
    const g = new THREE.ExtrudeGeometry(withHole(roundedSquare(size, size * 0.13), size * 0.27), EXTRUDE);
    g.center();
    const m = new THREE.Mesh(g, mat[finish]);
    m.name = 'square-modular-ring-plate';
    return m;
  }

  function makeRoundPlate(size, finish) {
    const disc = new THREE.Shape();
    disc.absarc(0, 0, size / 2, 0, Math.PI * 2, false);
    const g = new THREE.ExtrudeGeometry(withHole(disc, size * 0.19), EXTRUDE);
    g.center();
    const m = new THREE.Mesh(g, mat[finish]);
    m.name = 'round-modular-base-plate';
    return m;
  }

  function makeHolder(size, finish) {
    const grp = new THREE.Group();
    grp.name = 'batten-holder';

    const base = new THREE.Mesh(
      new THREE.ExtrudeGeometry(roundedSquare(size, size * 0.14), { ...EXTRUDE, depth: 0.045 }),
      mat[finish]
    );
    base.geometry.center();
    base.name = 'holder-base-plate';
    base.castShadow = true; base.receiveShadow = true;
    grp.add(base);

    // lathe-turned holder body
    const pts = [];
    const prof = [[0.00, 0.00], [0.155, 0.00], [0.150, 0.045], [0.112, 0.075],
                  [0.108, 0.135], [0.140, 0.170], [0.146, 0.235], [0.128, 0.262],
                  [0.104, 0.268], [0.100, 0.244]];
    prof.forEach(p => pts.push(new THREE.Vector2(p[0] * (size / 0.58), p[1] * (size / 0.58))));
    const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 40), mat[finish]);
    body.name = 'holder-body';
    body.position.z = 0.024;
    body.rotation.x = -Math.PI / 2;
    body.castShadow = true;
    grp.add(body);

    // brass interior + lamp-cap ring
    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(size * 0.152, size * 0.152, size * 0.09, 32, 1, true),
      mat.brass
    );
    ring.name = 'brass-lamp-ring';
    ring.rotation.x = Math.PI / 2;
    ring.position.z = size * 0.42;
    grp.add(ring);

    const fil = new THREE.Mesh(new THREE.SphereGeometry(size * 0.10, 20, 14), mat.filament.clone());
    fil.name = 'filament';
    fil.position.z = size * 0.40;
    grp.add(fil);

    const spr = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowMap, color: 0xffffff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    spr.name = 'filament-glow';
    spr.scale.setScalar(size * 2.1);
    spr.position.z = size * 0.46;
    grp.add(spr);

    filaments.push({ mesh: fil, sprite: spr });
    return grp;
  }

  // Staggered wall: 4 columns x 2 rows, mixed finishes and formats
  const layout = [
    { k: 'holder', x: -1.98, y: 0.60, s: 0.66, f: 'white', rz: -0.18, rY: 0.30 },
    { k: 'ring',   x: -0.70, y: 0.72, s: 0.74, f: 'white', rz: 0.10,  rY: -0.12 },
    { k: 'round',  x: 0.62,  y: 0.62, s: 0.78, f: 'grey',  rz: 0.00,  rY: 0.18 },
    { k: 'holder', x: 1.94,  y: 0.74, s: 0.62, f: 'black', rz: 0.22,  rY: -0.34 },
    { k: 'round',  x: -2.06, y: -0.66, s: 0.70, f: 'black', rz: -0.08, rY: 0.24 },
    { k: 'holder', x: -0.76, y: -0.74, s: 0.64, f: 'grey',  rz: 0.16,  rY: -0.22 },
    { k: 'ring',   x: 0.58,  y: -0.70, s: 0.72, f: 'white', rz: -0.14, rY: 0.14 },
    { k: 'holder', x: 1.90,  y: -0.62, s: 0.68, f: 'white', rz: 0.06,  rY: -0.28 },
  ];

  layout.forEach((u, i) => {
    const s = u.s * 0.72;
    const o = u.k === 'holder' ? makeHolder(s, u.f)
            : u.k === 'ring'   ? makeRingPlate(s, u.f)
            :                    makeRoundPlate(s, u.f);
    o.position.set(u.x * 1.5, u.y * 1.62, -0.35 + (i % 3) * 0.16);
    o.rotation.set(0.06, u.rY, u.rz);
    o.traverse(n => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
    o.userData.float = { amp: 0.016 + (i % 4) * 0.006, ph: i * 1.27, spin: (i % 2 ? 1 : -1) * 0.035 };
    wallGroup.add(o);
  });

  /* ---- light rig ---------------------------------------------------- */
  const ambient = new THREE.AmbientLight(0x0b3a36, 0.16);
  scene.add(ambient);

  const spot = new THREE.SpotLight(0xdcfffb, 240, 20, 0.34, 0.97, 1.4);
  spot.name = 'key-spotlight';
  spot.position.set(0, 4.2, 3.2);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.bias = -0.0006;
  spot.shadow.camera.near = 0.6;
  spot.shadow.camera.far = 12;
  scene.add(spot);
  scene.add(spot.target);
  spot.target.position.set(0, 0, 0);

  const rim = new THREE.DirectionalLight(TEAL, 0.5);
  rim.position.set(-5.4, 1.1, 1.2);
  scene.add(rim);

  const fill = new THREE.DirectionalLight(0x0d5f58, 0.2);
  fill.position.set(4.2, -0.6, 2.2);
  scene.add(fill);

  const warm = new THREE.PointLight(AMBER, 0.55, 7, 2);
  warm.position.set(2.0, -1.05, 1.3);
  scene.add(warm);

  /* ---- volumetric beam --------------------------------------------- */
  const beamLen = 5.8;
  const beamR = Math.tan(spot.angle) * beamLen;
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(beamR, beamLen, 48, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xbdfff8, transparent: true, opacity: 0.0,
      alphaMap: beamAlphaTexture(), blending: THREE.AdditiveBlending,
      depthWrite: false, side: THREE.DoubleSide,
    })
  );
  beam.name = 'light-shaft';
  scene.add(beam);

  /* ---- dust in the beam -------------------------------------------- */
  const DUST = 620;
  const dpos = new Float32Array(DUST * 3);
  const dvel = new Float32Array(DUST);
  for (let i = 0; i < DUST; i++) {
    dpos[i * 3]     = (Math.random() - 0.5) * 6.4;
    dpos[i * 3 + 1] = (Math.random() - 0.5) * 3.8;
    dpos[i * 3 + 2] = -2.2 + Math.random() * 3.2;
    dvel[i] = 0.02 + Math.random() * 0.05;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    color: 0xb6f2ec, size: 0.017, sizeAttenuation: true,
    transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  dust.name = 'dust';
  scene.add(dust);

  /* ---- pointer → spotlight target ---------------------------------- */
  const targetPt = new THREE.Vector3(0, 0, 0);
  const wantPt = new THREE.Vector3(0, 0, 0);
  let lastMove = -9999;
  let camSway = { x: 0, y: 0 };

  function onPointer(e) {
    const r = container.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
    const ny = -(((e.clientY - r.top) / r.height) * 2 - 1);
    wantPt.set(nx * 3.4, ny * 1.9, 0);
    camSway.x = nx * 0.10; camSway.y = ny * 0.06;
    lastMove = performance.now();
  }
  window.addEventListener('pointermove', onPointer, { passive: true });

  /* ---- master switch ------------------------------------------------ */
  let master = 0, masterWant = 0;
  function setMaster(on) { masterWant = on ? 1 : 0; }

  /* ---- resize + visibility ------------------------------------------ */
  function resize() {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  let visible = true;
  const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; }, { threshold: 0 });
  io.observe(container);
  const onVis = () => { visible = !document.hidden && visible; };
  document.addEventListener('visibilitychange', onVis);

  /* ---- loop --------------------------------------------------------- */
  const t0 = performance.now();
  let prev = t0;
  let intro = 0, raf = 0;
  const spotBase = 240;

  function frame() {
    raf = requestAnimationFrame(frame);
    const now = performance.now();
    const dt = Math.min((now - prev) / 1000, 0.05);
    prev = now;
    if (!visible || document.hidden) return;
    const t = (now - t0) / 1000;

    // intro: beam strikes, wall settles forward
    intro = Math.min(1, intro + dt / 1.7);
    const ei = 1 - Math.pow(1 - intro, 3);

    // idle sweep when the pointer is asleep, so the beam is always alive
    if (performance.now() - lastMove > 2400) {
      wantPt.set(Math.sin(t * 0.30) * 2.5, Math.cos(t * 0.21) * 0.8, 0);
      camSway.x *= 0.97; camSway.y *= 0.97;
    }
    targetPt.lerp(wantPt, 1 - Math.pow(0.001, dt));
    spot.target.position.copy(targetPt);
    spot.position.set(targetPt.x * 0.42, 4.2, 3.2);
    spot.intensity = spotBase * ei * (1 - master * 0.34);

    // beam follows the light
    const dir = new THREE.Vector3().subVectors(targetPt, spot.position).normalize();
    beam.position.copy(spot.position).addScaledVector(dir, beamLen / 2);
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
    beam.material.opacity = (0.1 + Math.sin(t * 1.7) * 0.008) * ei * (1 - master * 0.25);

    // master switch: filaments ignite in a staggered cascade
    master += (masterWant - master) * (1 - Math.pow(0.004, dt));
    filaments.forEach((f, i) => {
      const stag = Math.max(0, Math.min(1, (master - i * 0.055) / 0.42));
      const flick = 0.88 + Math.sin(t * (13 + i * 3.1)) * 0.12;
      f.mesh.material.emissiveIntensity = stag * 2.9 * flick;
      f.sprite.material.opacity = stag * 0.72 * flick;
    });
    ambient.intensity = 0.16 + master * 0.4;
    ambient.color.setHex(master > 0.5 ? 0x17403a : 0x0b3a36);
    warm.intensity = 0.55 + master * 2.2;
    rim.intensity = 0.5 - master * 0.12;

    // wall: gentle drift + intro settle
    wallGroup.position.z = (1 - ei) * -0.9;
    wallGroup.rotation.y = Math.sin(t * 0.13) * 0.028 + camSway.x * 0.16;
    wallGroup.children.forEach(o => {
      const f = o.userData.float;
      o.position.y += Math.sin(t * 0.55 + f.ph) * f.amp * dt;
      o.rotation.z += Math.sin(t * 0.4 + f.ph) * f.spin * dt;
    });

    // dust drift
    const dp = dustGeo.attributes.position.array;
    for (let i = 0; i < DUST; i++) {
      dp[i * 3 + 1] += dvel[i] * dt;
      dp[i * 3] += Math.sin(t * 0.3 + i) * 0.0006;
      if (dp[i * 3 + 1] > 2.0) dp[i * 3 + 1] = -2.0;
    }
    dustGeo.attributes.position.needsUpdate = true;

    // scroll parallax
    const p = opts.progress ? opts.progress() : 0;
    camera.position.x += (camSway.x - camera.position.x) * 0.05;
    camera.position.y += ((0.14 + camSway.y + p * 0.55) - camera.position.y) * 0.06;
    camera.position.z = 6.3 + p * 0.55;
    camera.lookAt(0, 0.05 + p * 0.35, 0);

    renderer.render(scene, camera);
  }
  frame();

  function dispose() {
    cancelAnimationFrame(raf);
    ro.disconnect(); io.disconnect();
    window.removeEventListener('pointermove', onPointer);
    document.removeEventListener('visibilitychange', onVis);
    scene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) [].concat(o.material).forEach(m => {
        Object.values(m).forEach(v => { if (v && v.isTexture) v.dispose(); });
        m.dispose();
      });
    });
    renderer.dispose();
    renderer.domElement.remove();
  }

  return { setMaster, dispose };
}
