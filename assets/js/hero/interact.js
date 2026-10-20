/* ==========================================================================
   Hero 3D — direct manipulation (Apple fluid-interface rules):
   · response on pointer-down, 1:1 tracking while dragging (grab offset respected)
   · release → project momentum with decelerationRate .998, then hand the release
     velocity to a critically-damped spring (no seam between drag and settle)
   · hover opens a liquid-glass card that materialises (blur + scale) from the planet
   Decoration only: every fact shown here also exists as real HTML links/articles.
   ========================================================================== */
import { Raycaster, Vector2, Vector3 } from 'three';
import { Spring } from './shared.js';
import { springs } from '../motion-tokens.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** Apple's momentum projection: where a flick WILL come to rest (v in units/s) */
const project = (v, d = 0.998) => ((v / 1000) * d) / (1 - d);

export function createInteract({ canvas, camera, sys, S, planets, bulb, layout, data, labelsEl, popEl, poke, coarse, onToggle, onPlanetClick }) {
  const ray = new Raycaster();
  const ndc = new Vector2(9, 9);
  const colliders = [...planets.map((p) => p.collider), bulb.collider];
  bulb.collider.userData.planet = 6;
  const azSpring = new Spring(springs.spin, 0);
  const tx = new Spring(springs.gentle, 0);
  const ty = new Spring(springs.gentle, 0);
  const v3 = new Vector3(), v3b = new Vector3(), right = new Vector3();
  let inside = false, down = null, dragging = false, samples = [], popIdx = -1, popTimer = 0;

  /* planet name tags (aria-hidden decoration; the real links are .hero__cats and the tour) */
  const tags = planets.map((p) => {
    const el = document.createElement('span');
    el.className = 'plabel';
    el.textContent = p.data.short;
    labelsEl.appendChild(el);
    return el;
  });

  const screen = (world, out = {}) => {
    v3.copy(world).project(camera);
    out.x = (v3.x * 0.5 + 0.5) * layout.cur.cw;
    out.y = (-v3.y * 0.5 + 0.5) * layout.cur.ch;
    return out;
  };

  const rectXY = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height };
  };
  const dragAz = (dx) => (dx / Math.max(320, layout.cur.aw)) * Math.PI;      // pointer travel → azimuth, 1:1
  const onMove = (e) => {
    const r = rectXY(e);
    // "inside" = the pointer is over the canvas itself (not a button / caption layered above it)
    inside = (e.target === canvas || dragging) && r.x >= 0 && r.y >= 0 && r.x <= r.w && r.y <= r.h;
    if (r.w) ndc.set((r.x / r.w) * 2 - 1, -((r.y / r.h) * 2 - 1));
    if (inside) poke(2600);
    const overview = S.beat < 0 || S.beat > 5;
    if (dragging && down) {
      azSpring.set(down.az + dragAz(e.clientX - down.x));                    // glued to the pointer, grab offset respected
      samples.push([performance.now(), e.clientX]);
      if (samples.length > 6) samples.shift();
    } else if (down && overview) {
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {                // hysteresis, then commit to a horizontal drag
        dragging = true;
        S.dragging = true;
        try { canvas.setPointerCapture(down.id); } catch (err) { /* synthetic events */ }
        canvas.style.cursor = 'grabbing';
        samples = [[performance.now(), down.x], [performance.now(), e.clientX]];
        azSpring.set(down.az + dragAz(dx));                                  // continuous: no jump when the drag commits
      }
    }
  };
  const onDown = (e) => {
    if (e.button > 0) return;
    onMove(e);
    down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId, az: azSpring.x };
    poke(2600);
  };
  const onUp = (e) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const quick = performance.now() - down.t < 450;
    if (dragging) {
      // momentum: project where the flick lands, hand the release velocity to the spring
      const a = samples[0], b = samples[samples.length - 1];
      const px = b && a && b[0] > a[0] ? ((b[1] - a[1]) / (b[0] - a[0])) * 1000 : 0;            // px/s
      const w = (px / Math.max(320, layout.cur.aw)) * Math.PI;                                   // rad/s
      azSpring.v = Math.max(-9, Math.min(9, w));
      azSpring.to(azSpring.x + project(Math.max(-9, Math.min(9, w))));
      dragging = false;
      S.dragging = false;
      try { canvas.releasePointerCapture(down.id); } catch (err) { /* noop */ }
    } else if (moved < 8 && quick) {
      onMove(e);
      const hit = pick();
      if (hit === 6) onToggle(!S.on);
      else if (hit >= 0) onPlanetClick(planets[hit].id);
    }
    down = null;
    poke(2600);
  };
  const onLeave = () => { inside = false; ndc.set(9, 9); };

  const pick = () => {
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(colliders, false)[0];
    return hit ? hit.object.userData.planet : -1;
  };

  const cardHtml = (d, i) =>
    `<p class="pop__n">0${6 - i} / 06</p><h3 class="pop__h">${esc(d.name)}</h3><p class="pop__meta">${d.families} ranges · ${d.skus} products</p>` +
    `<ul class="pop__fams">${d.top.map((t) => `<li>${esc(t)}</li>`).join('')}</ul><p class="pop__cta">Explore →</p>`;

  function showCard(i) {
    if (popIdx === i) return;
    popIdx = i;
    clearTimeout(popTimer);
    if (i < 0) {
      popEl.classList.remove('is-on');
      popTimer = setTimeout(() => { if (popIdx < 0) popEl.hidden = true; }, 200);
      return;
    }
    popEl.innerHTML = cardHtml(planets[i].data, i);
    popEl.hidden = false;
    void popEl.offsetWidth;                                              // commit the hidden state so the transition plays
    popEl.classList.add('is-on');
  }
  function placeCard(i) {
    const p = planets[i];
    const c = screen(sys.localToWorld(v3b.copy(p.pos)), {});
    right.setFromMatrixColumn(camera.matrixWorld, 0).multiplyScalar(p.size);
    const edge = screen(v3b.add(right), {});
    const rpx = Math.abs(edge.x - c.x);
    const W = 272;
    const rightSide = c.x + rpx + 20 + W < layout.cur.cw - 8;
    const cx = rightSide ? c.x + rpx + 18 : c.x - rpx - 18 - W;
    popEl.style.setProperty('--cx', cx.toFixed(1) + 'px');
    popEl.style.setProperty('--cy', (c.y - 96).toFixed(1) + 'px');
    popEl.style.setProperty('--ox', rightSide ? '0%' : '100%');
    popEl.style.setProperty('--oy', '38%');
  }

  function setHover(i, fromDom = false) {
    const planet = i >= 0 && i <= 5 ? i : -1;
    const bulbHot = i === 6;
    if (S.hover === planet && S.hoverBulb === bulbHot) return;
    S.hover = planet;
    S.hoverBulb = bulbHot;
    tags.forEach((t, k) => t.classList.toggle('is-hot', k === planet));
    showCard(planet);
    if (!fromDom) canvas.style.cursor = planet >= 0 || bulbHot ? 'pointer' : (S.beat < 0 || S.beat > 5) && !coarse ? 'grab' : '';
    poke(1800);
  }

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', () => { down = null; dragging = false; S.dragging = false; });
  canvas.addEventListener('pointerleave', onLeave);
  window.addEventListener('pointermove', onMove, { passive: true });
  if (!coarse) canvas.style.cursor = 'grab';

  return {
    /** hover/focus on a real DOM link drives the same highlight (DOM ↔ 3D stay in sync) */
    highlight(id) {
      const i = id ? planets.findIndex((p) => p.id === id) : -1;
      S.domHover = i >= 0;
      setHover(i, true);
    },
    /** phase 1 — before the planets move: system rotation (drag 1:1 lands in the same frame) */
    update(dt) {
      const overview = S.beat < 0 || S.beat > 5;
      // tilt: a few degrees toward the pointer (fine pointers only), springs keep it calm
      tx.to(!coarse && inside && overview ? ndc.x * 0.06 : 0);
      ty.to(!coarse && inside && overview ? -ndc.y * 0.06 : 0);
      sys.rotation.x = ty.step(dt);
      sys.rotation.z = -tx.step(dt);
      S.az = azSpring.step(dt);
      sys.rotation.y = S.az;
    },
    /** phase 2 — after the camera moved: hover test + card + name tags in screen space */
    project() {
      const overview = S.beat < 0 || S.beat > 5;
      if (!overview) { if (S.hover >= 0 || S.hoverBulb) { S.domHover = false; setHover(-1); } }       // close-ups have their own caption
      else if (!coarse && inside && !dragging && !S.domHover) setHover(pick());
      else if (!coarse && !inside && !S.domHover && (S.hover >= 0 || S.hoverBulb)) setHover(-1);
      if (popIdx >= 0) placeCard(popIdx);
      // planet name tags: below each planet, overview only
      planets.forEach((p, i) => {
        const c = screen(sys.localToWorld(v3b.copy(p.pos)), {});
        right.setFromMatrixColumn(camera.matrixWorld, 0).multiplyScalar(p.size);
        const e = screen(v3b.add(right), {});
        const rpx = Math.abs(e.x - c.x);
        tags[i].style.setProperty('--lx', c.x.toFixed(1) + 'px');
        tags[i].style.setProperty('--ly', (c.y + rpx + 8).toFixed(1) + 'px');
        tags[i].style.setProperty('--lo', overview ? '1' : '0');
      });
    },
    get moving() { return azSpring.moving || tx.moving || ty.moving || dragging; },
    destroy() { window.removeEventListener('pointermove', onMove); },
  };
}
