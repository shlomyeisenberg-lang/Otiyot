// Geometry helpers for the House of the Scribe: shapes painted with soft vertex gradients and
// merged, so the whole house, the courtyard and the hills are a handful of draw calls.

import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  ExtrudeGeometry,
  Path,
  Shape,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const ca = new Color();
const cb = new Color();
const cc = new Color();

/** Gives a shape one color (or a gradient toward `bottom`), drops UVs, and un-indexes it. */
export function tint(g: BufferGeometry, color: number, bottom?: number): BufferGeometry {
  const geo = g.index ? g.toNonIndexed() : g;
  if (geo !== g) g.dispose();
  geo.deleteAttribute('uv');
  const pos = geo.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  ca.setHex(color);
  cb.setHex(bottom ?? color);
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    lo = Math.min(lo, pos.getY(i));
    hi = Math.max(hi, pos.getY(i));
  }
  for (let i = 0; i < pos.count; i++) {
    cc.copy(cb).lerp(ca, (pos.getY(i) - lo) / (hi - lo || 1));
    colors[i * 3] = cc.r;
    colors[i * 3 + 1] = cc.g;
    colors[i * 3 + 2] = cc.b;
  }
  geo.setAttribute('color', new BufferAttribute(colors, 3));
  return geo;
}

/** Collects painted parts and merges them into one geometry. */
export class Parts {
  readonly list: BufferGeometry[] = [];

  add(
    g: BufferGeometry,
    color: number,
    x: number,
    y: number,
    z: number,
    bottom?: number,
    rotY = 0,
  ): BufferGeometry {
    const t = tint(g, color, bottom);
    if (rotY) t.rotateY(rotY);
    t.translate(x, y, z);
    this.list.push(t);
    return t;
  }

  box(
    w: number,
    h: number,
    d: number,
    color: number,
    x: number,
    y: number,
    z: number,
    bottom?: number,
    rotY = 0,
  ): void {
    this.add(new BoxGeometry(w, h, d), color, x, y, z, bottom, rotY);
  }

  /** Merges everything added so far (and frees the pieces). Null when empty. */
  merge(): BufferGeometry | null {
    if (this.list.length === 0) return null;
    const m = mergeGeometries(this.list, false);
    for (const g of this.list) g.dispose();
    this.list.length = 0;
    if (m) m.computeVertexNormals();
    return m;
  }
}

/**
 * A wall `length` long and `height` tall with round-topped arches cut through it, lying along +X
 * with its thickness along Z (centered). `arches`: [center, width, springing height].
 */
export function archWall(
  length: number,
  height: number,
  depth: number,
  arches: readonly (readonly [number, number, number])[],
): BufferGeometry {
  const s = new Shape();
  s.moveTo(-length / 2, 0);
  s.lineTo(length / 2, 0);
  s.lineTo(length / 2, height);
  s.lineTo(-length / 2, height);
  s.lineTo(-length / 2, 0);
  for (const [c, w, spring] of arches) {
    const p = new Path();
    const r = w / 2;
    p.moveTo(c - r, 0.001);
    p.lineTo(c + r, 0.001);
    p.lineTo(c + r, spring);
    p.absarc(c, spring, r, 0, Math.PI, false);
    p.lineTo(c - r, 0.001);
    s.holes.push(p);
  }
  const g = new ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 10 });
  g.translate(0, 0, -depth / 2);
  return g;
}

/** Writes per-vertex colors from a function of the vertex position. */
export function paintBy(
  g: BufferGeometry,
  fn: (x: number, y: number, z: number, out: Color) => void,
): BufferGeometry {
  const pos = g.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    fn(pos.getX(i), pos.getY(i), pos.getZ(i), cc);
    colors[i * 3] = cc.r;
    colors[i * 3 + 1] = cc.g;
    colors[i * 3 + 2] = cc.b;
  }
  g.setAttribute('color', new BufferAttribute(colors, 3));
  return g;
}
