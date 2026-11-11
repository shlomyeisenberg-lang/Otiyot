// The land beyond the courtyard wall: terraced slopes falling into a green valley and the far
// ridges of the Land of Letters, where each region keeps a beacon. One mesh, finer where the
// terraces are, with the colors baked into its vertices.

import { BufferAttribute, BufferGeometry, Color } from 'three';
import { smoothstep } from '../../engine';
import { TINT } from './palette';

/** The courtyard's edge: past this (toward -Z) the ground drops away. */
export const EDGE_Z = -5.6;
const STEP = 1.1;

/** Ground height at a point. The house and courtyard stand on the flat top at y = 0. */
export function heightAt(x: number, z: number): number {
  if (z > EDGE_Z) return 0;
  const d = EDGE_Z - z;
  // The slope down into the valley, cut into terraces near the house.
  let y = -9 * smoothstep(0, 18, d);
  const terraced = Math.floor(y / STEP) * STEP;
  y += (terraced - y) * 0.8 * (1 - smoothstep(14, 20, d));
  // The far ridges rise beyond the valley floor.
  const ridge =
    smoothstep(24, 80, d) *
    (16 + 7 * Math.sin(x * 0.045 + 1.3) * Math.cos(d * 0.031) + 5 * Math.sin(x * 0.11 + d * 0.07));
  y += ridge;
  y += 0.7 * Math.sin(x * 0.27 + d * 0.21) * smoothstep(16, 30, d);
  return y;
}

/** Rows (along Z) of the land mesh: coarse behind the house, fine over the terraces. */
function rows(): number[] {
  const out: number[] = [];
  for (let z = 60; z > EDGE_Z + 1; z -= 4) out.push(z);
  for (let z = EDGE_Z + 1; z > -26; z -= 0.4) out.push(z);
  for (let z = -26; z >= -240; z -= 3) out.push(z);
  return out;
}

const c1 = new Color();
const c2 = new Color();

/** The land as one flat-shaded, vertex-colored mesh. */
export function landGeometry(): BufferGeometry {
  const zs = rows();
  const cols = 150;
  const half = 200;
  const nx = cols + 1;
  const nz = zs.length;
  const pos = new Float32Array(nx * nz * 3);
  for (let j = 0; j < nz; j++) {
    const z = zs[j] as number;
    for (let i = 0; i < nx; i++) {
      const x = -half + (i / cols) * half * 2;
      const k = (j * nx + i) * 3;
      pos[k] = x;
      pos[k + 1] = heightAt(x, z);
      pos[k + 2] = z;
    }
  }
  // Un-indexed triangles so every face keeps its own flat color.
  const tris = cols * (nz - 1) * 2;
  const out = new Float32Array(tris * 9);
  const col = new Float32Array(tris * 9);
  let o = 0;
  const put = (a: number): void => {
    out[o] = pos[a * 3] as number;
    out[o + 1] = pos[a * 3 + 1] as number;
    out[o + 2] = pos[a * 3 + 2] as number;
    o += 3;
  };
  for (let j = 0; j < nz - 1; j++) {
    for (let i = 0; i < cols; i++) {
      const a = j * nx + i;
      const b = a + 1;
      const c = a + nx;
      const d = c + 1;
      const start = o;
      put(a);
      put(c);
      put(b);
      put(b);
      put(c);
      put(d);
      faceColor(out, start, col);
      faceColor(out, start + 9, col);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(out, 3));
  g.setAttribute('color', new BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

/** Colors one triangle by where it is and how steep it is. */
function faceColor(p: Float32Array, at: number, out: Float32Array): void {
  const y0 = p[at + 1] as number;
  const y1 = p[at + 4] as number;
  const y2 = p[at + 7] as number;
  const x = ((p[at] as number) + (p[at + 3] as number) + (p[at + 6] as number)) / 3;
  const z = ((p[at + 2] as number) + (p[at + 5] as number) + (p[at + 8] as number)) / 3;
  const y = (y0 + y1 + y2) / 3;
  const steep = Math.max(y0, y1, y2) - Math.min(y0, y1, y2);
  const d = EDGE_Z - z;
  if (d < 0) {
    // The hilltop around the house: dry grass and soil.
    c1.setHex(TINT.terraceDry).lerp(c2.setHex(TINT.soil), 0.35 + 0.25 * Math.sin(x * 0.7 + z));
  } else if (d < 20) {
    // Terraces: alternating olive green and dry gold, with stone risers.
    const band = Math.floor(-y / STEP);
    c1.setHex(band % 2 === 0 ? TINT.terrace : TINT.terraceDry);
    if (steep > 0.45) c1.setHex(TINT.stone);
  } else if (d < 34) {
    c1.setHex(TINT.valley).lerp(c2.setHex(TINT.terrace), 0.3 + 0.3 * Math.sin(x * 0.2));
  } else {
    // The ridges: greener low, blue-grey high and far.
    const far = smoothstep(40, 200, d);
    c1.setHex(TINT.valley)
      .lerp(c2.setHex(TINT.ridge), smoothstep(-2, 14, y))
      .lerp(c2.setHex(TINT.ridgeFar), far * 0.7);
  }
  for (let v = 0; v < 3; v++) {
    out[at + v * 3] = c1.r;
    out[at + v * 3 + 1] = c1.g;
    out[at + v * 3 + 2] = c1.b;
  }
}

/**
 * Where each region's beacon stands on the land (x, z), in the order of REGION_IDS: the road
 * winds from the valley near the house out to the farthest ridge; the Ladder is a tower apart.
 */
export const BEACON_SPOTS: readonly (readonly [number, number])[] = [
  [8, -27],
  [22, -33],
  [34, -36],
  [-7, -39],
  [35, -45],
  [14, -51],
  [-19, -57],
  [41, -65],
  [2, -71],
  [28, -80],
  [-27, -88],
  [52, -97],
  [12, -106],
  [-6, -132],
  [46, -142],
];
