/* ==========================================================================
   Hero 3D — camera rig. All composition is the camera: the SAME scene serves the
   overview (system centred on the DOM anchor) and the tour (camera follows one planet).
   Every channel is a critically-damped spring from motion-tokens (`camera`), so scroll
   jitter is absorbed and any beat change redirects from the current pose + velocity.
   ========================================================================== */
import { Vector3 } from 'three';
import { Spring } from './shared.js';
import { springs } from '../motion-tokens.js';

export function createCameraRig({ camera, sys, S, planets, layout, tourOrder }) {
  const cfg = springs.camera;
  const px = new Spring(cfg), py = new Spring(cfg), pz = new Spring(cfg);
  const lx = new Spring(cfg), ly = new Spring(cfg), lz = new Spring(cfg);
  const ox = new Spring(cfg), oy = new Spring(cfg);
  const all = [px, py, pz, lx, ly, lz, ox, oy];
  const up = new Vector3(0, 1, 0);
  const P = new Vector3(), u = new Vector3(), t = new Vector3();
  let snapped = false;

  function target() {
    const Lo = layout.cur;
    const beat = S.beat;
    if (beat >= 0 && beat <= 5) {
      const pl = planets[tourOrder[beat]];
      sys.localToWorld(P.copy(pl.pos));
      u.set(P.x, 0, P.z);
      if (u.lengthSq() < 1e-6) u.set(1, 0, 0);
      u.normalize();
      t.crossVectors(up, u);
      const widen = Math.max(1, 0.85 / (Lo.cw / Lo.ch));            // portrait screens see less sideways: pull back so the product fits
      const s = pl.size * 3 * widen;
      return {
        pos: [P.x + u.x * 1.1 * s + t.x * 2.4 * s, P.y + 1.1 * s, P.z + u.z * 1.1 * s + t.z * 2.4 * s],
        look: [P.x, P.y, P.z],                                           // aim at the product itself
        ox: Lo.mobile ? 0 : -0.2 * Lo.cw,                             // subject sits right (desktop) / high (mobile): captions take the rest
        oy: Lo.mobile ? 0.14 * Lo.ch : 0,
      };
    }
    const el = (Lo.mobile ? 32 : 27) * (Math.PI / 180);
    return { pos: [0, Math.sin(el) * Lo.dist, Math.cos(el) * Lo.dist], look: [0, 0.1, 0], ox: -Lo.dx, oy: -Lo.dy };
  }

  function apply() {
    camera.position.set(px.x, py.x, pz.x);
    camera.lookAt(lx.x, ly.x, lz.x);
    const Lo = layout.cur;
    camera.setViewOffset(Lo.cw, Lo.ch, ox.x, oy.x, Lo.cw, Lo.ch);
  }

  return {
    /** jump to the current target (used at mount and after resize so nothing swings in) */
    snap() {
      const tg = target();
      px.set(tg.pos[0]); py.set(tg.pos[1]); pz.set(tg.pos[2]);
      lx.set(tg.look[0]); ly.set(tg.look[1]); lz.set(tg.look[2]);
      ox.set(tg.ox); oy.set(tg.oy);
      snapped = true;
      apply();
      camera.updateMatrixWorld(true);
    },
    update(dt) {
      if (!snapped) return this.snap();
      const tg = target();
      px.to(tg.pos[0]); py.to(tg.pos[1]); pz.to(tg.pos[2]);
      lx.to(tg.look[0]); ly.to(tg.look[1]); lz.to(tg.look[2]);
      ox.to(tg.ox); oy.to(tg.oy);
      all.forEach((s) => s.step(dt));
      apply();
      camera.updateMatrixWorld(true);
    },
    get moving() { return all.some((s) => s.moving); },
  };
}
