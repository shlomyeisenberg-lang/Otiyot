// The drawings that rise from the Blank Scroll as it is written (T27): six for each column of
// the crossing, each a small pop-up of the regions behind the player. They are built once from
// painted primitives merged into one geometry each (one draw call a drawing), standing on the
// parchment with their origin at the ground. They rise grey, as a sketch, and take their colors
// when the column is finished and color sweeps back over it.

import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  OctahedronGeometry,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Drawings in each column. */
export const DRAWINGS_PER_COLUMN = 6;

const C = new Color();

function paint(geo: BufferGeometry, hex: number): BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (g !== geo) geo.dispose();
  const n = g.getAttribute('position').count;
  C.setHex(hex);
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    colors[i * 3] = C.r;
    colors[i * 3 + 1] = C.g;
    colors[i * 3 + 2] = C.b;
  }
  g.setAttribute('color', new BufferAttribute(colors, 3));
  if (g.getAttribute('uv')) g.deleteAttribute('uv');
  return g;
}

const box = (w: number, h: number, d: number, x: number, y: number, z: number, c: number) =>
  paint(new BoxGeometry(w, h, d).translate(x, y + h / 2, z), c);
const cyl = (
  r1: number,
  r2: number,
  h: number,
  x: number,
  y: number,
  z: number,
  c: number,
  s = 8,
) => paint(new CylinderGeometry(r1, r2, h, s).translate(x, y + h / 2, z), c);
const cone = (r: number, h: number, x: number, y: number, z: number, c: number, s = 7) =>
  paint(new ConeGeometry(r, h, s).translate(x, y + h / 2, z), c);
const ball = (r: number, x: number, y: number, z: number, c: number, sx = 1, sy = 1, sz = 1) =>
  paint(new IcosahedronGeometry(r, 1).scale(sx, sy, sz).translate(x, y, z), c);
const gem = (r: number, x: number, y: number, z: number, c: number) =>
  paint(new OctahedronGeometry(r, 0).translate(x, y, z), c);
const arch = (r: number, tube: number, x: number, y: number, z: number, c: number) =>
  paint(new TorusGeometry(r, tube, 6, 14, Math.PI).translate(x, y, z), c);
const dome = (r: number, x: number, y: number, z: number, c: number) =>
  paint(new SphereGeometry(r, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(x, y, z), c);

function join(parts: BufferGeometry[]): BufferGeometry {
  const out = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  return out ?? new BufferGeometry();
}

// --- c1 The Garden (Home Row Meadow, Cliffs of Ein Gedi).

function anemones(): BufferGeometry {
  const parts: BufferGeometry[] = [ball(1.5, 0, 0, 0, 0x7fa650, 1, 0.22, 1)];
  const spots: readonly [number, number, number, number][] = [
    [-0.8, 0.2, 1.5, 0xd8402c],
    [0.1, -0.5, 1.9, 0xe8553a],
    [0.8, 0.4, 1.3, 0xd8402c],
    [-0.2, 0.8, 1.1, 0xf0f0f0],
    [1.1, -0.6, 1, 0xc8a0e0],
  ];
  for (const [x, z, h, c] of spots) {
    parts.push(cyl(0.05, 0.07, h, x, 0, z, 0x4f7a34, 5));
    parts.push(cone(0.36, 0.34, x, h - 0.05, z, c, 6).rotateX(0));
    parts.push(ball(0.11, x, h + 0.2, z, 0x1c1a22));
  }
  return join(parts);
}

function olive(): BufferGeometry {
  return join([
    cyl(0.28, 0.42, 2.2, 0, 0, 0, 0x6a5238, 6),
    cyl(0.14, 0.2, 1.2, 0.5, 1.6, 0, 0x6a5238, 5).rotateZ(-0.25),
    ball(1.5, 0, 3.2, 0, 0x6f8a4a, 1.25, 0.8, 1.1),
    ball(1.1, 1.2, 2.7, 0.3, 0x86a05a, 1.1, 0.75, 1),
    ball(1, -1.1, 2.8, -0.2, 0x5c7a40, 1.1, 0.7, 1),
  ]);
}

function cliffs(): BufferGeometry {
  return join([
    cone(2.2, 5.2, 0, 0, 0, 0xc9a070, 5),
    cone(1.6, 3.6, 1.9, 0, 0.4, 0xb88c5e, 5),
    cone(1.3, 2.6, -1.8, 0, 0.5, 0xd6b080, 5),
    box(1.4, 0.2, 1.2, 0.5, 2.6, 0.9, 0xe2c08e),
    // The waterfall of Ein Gedi.
    box(0.36, 2.6, 0.12, 0.5, 0, 1.52, 0x8fd0e8),
    ball(0.7, 0.5, 0.05, 1.7, 0x7cc4e0, 1, 0.2, 1),
  ]);
}

function ibex(): BufferGeometry {
  return join([
    box(1.3, 0.6, 0.5, 0, 0.9, 0, 0xb08a5c),
    box(0.4, 0.6, 0.4, 0.75, 1.4, 0, 0xb08a5c),
    cyl(0.07, 0.07, 0.9, -0.45, 0, 0.15, 0x7a5c3c, 4),
    cyl(0.07, 0.07, 0.9, -0.45, 0, -0.15, 0x7a5c3c, 4),
    cyl(0.07, 0.07, 0.9, 0.45, 0, 0.15, 0x7a5c3c, 4),
    cyl(0.07, 0.07, 0.9, 0.45, 0, -0.15, 0x7a5c3c, 4),
    arch(0.45, 0.06, 0.6, 2, 0.12, 0x5a4630),
    arch(0.45, 0.06, 0.6, 2, -0.12, 0x5a4630),
    ball(1, 0, 0, 0, 0xd0b888, 1.3, 0.3, 0.9),
  ]);
}

function well(): BufferGeometry {
  return join([
    cyl(0.9, 1, 0.9, 0, 0, 0, 0xd8caa8, 10),
    cyl(0.7, 0.7, 0.06, 0, 0.86, 0, 0x4c88b8, 10),
    box(0.14, 2, 0.14, -0.8, 0.9, 0, 0x6a4a2e),
    box(0.14, 2, 0.14, 0.8, 0.9, 0, 0x6a4a2e),
    box(2.1, 0.16, 0.5, 0, 2.9, 0, 0x8a3a2e),
    cone(1.4, 0.7, 0, 3, 0, 0xb04a34, 4),
  ]);
}

function homeRow(): BufferGeometry {
  // The home row: eight keycaps in a little arc, the two with the bumps in gold.
  const parts: BufferGeometry[] = [];
  for (let i = 0; i < 8; i++) {
    const x = (i - 3.5) * 0.62 + (i > 3 ? 0.3 : -0.3);
    const gold = i === 3 || i === 4;
    parts.push(
      box(0.5, 0.3, 0.5, x, 0.5 + Math.abs(i - 3.5) * 0.04, 0, gold ? 0xe0b354 : 0xf4ecd8),
    );
  }
  parts.push(box(6, 0.5, 1, 0, 0, 0, 0x8a6a48));
  return join(parts);
}

// --- c2 The Workshop (Gematria Forge, Night Shuk).

function anvil(): BufferGeometry {
  return join([
    box(1.2, 0.9, 0.9, 0, 0, 0, 0x6a5238),
    box(0.7, 0.5, 0.5, 0, 0.9, 0, 0x4a4a54),
    box(1.6, 0.36, 0.6, 0, 1.4, 0, 0x5c5c68),
    cone(0.3, 0.8, 1.2, 1.28, 0, 0x5c5c68, 6).rotateZ(0),
    box(0.16, 1.1, 0.16, -0.3, 1.76, 0, 0x8a6a48).rotateZ(0.5),
    box(0.5, 0.3, 0.3, -1.1, 2.3, 0, 0x3c3c46),
  ]);
}

function furnace(): BufferGeometry {
  return join([
    cyl(1.3, 1.6, 2.6, 0, 0, 0, 0xa8643c, 8),
    dome(1.3, 0, 2.6, 0, 0x8c5030),
    cyl(0.4, 0.5, 1.6, 0, 3.6, 0, 0x6c3c24, 6),
    box(0.9, 1, 0.2, 0, 0.3, 1.5, 0xffb040),
    ball(0.5, 0, 5.5, 0, 0xd8d0c8, 1.2, 0.9, 1.2),
    ball(0.36, 0.4, 6.2, 0.1, 0xe8e0d8),
  ]);
}

function numberStones(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const tones = [0xe0b354, 0xd8caa8, 0xc8a070, 0xe8dcc0, 0xe0b354, 0xd8caa8];
  for (let i = 0; i < 6; i++) {
    const row = i < 3 ? 0 : i < 5 ? 1 : 2;
    const col = i < 3 ? i : i < 5 ? i - 3 : 0;
    const x = (col - (2 - row) / 2) * 0.86;
    parts.push(box(0.8, 0.8, 0.8, x, row * 0.82, 0, tones[i] as number));
  }
  return join(parts);
}

function stall(): BufferGeometry {
  const parts: BufferGeometry[] = [
    box(2.6, 0.9, 1.2, 0, 0, 0, 0x8a6a48),
    box(0.12, 2.6, 0.12, -1.2, 0, 0.5, 0x5a4630),
    box(0.12, 2.6, 0.12, 1.2, 0, 0.5, 0x5a4630),
    box(0.12, 2.6, 0.12, -1.2, 0, -0.5, 0x5a4630),
    box(0.12, 2.6, 0.12, 1.2, 0, -0.5, 0x5a4630),
  ];
  for (let i = 0; i < 6; i++) {
    parts.push(box(0.46, 0.14, 1.7, (i - 2.5) * 0.46, 2.6, 0, i % 2 ? 0xf0e6d0 : 0xc8483a));
  }
  parts.push(ball(0.24, -0.7, 1.1, 0.2, 0xe08a2e), ball(0.24, -0.2, 1.1, 0.1, 0xe0b354));
  parts.push(ball(0.24, 0.4, 1.1, 0.25, 0x9a3a5a), ball(0.24, 0.85, 1.1, 0, 0x6f8a4a));
  return join(parts);
}

function lanterns(): BufferGeometry {
  const parts: BufferGeometry[] = [
    box(0.14, 3.6, 0.14, -1.6, 0, 0, 0x5a4630),
    box(0.14, 3.6, 0.14, 1.6, 0, 0, 0x5a4630),
    box(3.4, 0.08, 0.08, 0, 3.5, 0, 0x3c2c1e),
  ];
  const tones = [0xffc860, 0xff9a5a, 0xffe08a, 0xff8a70];
  for (let i = 0; i < 4; i++) {
    const x = (i - 1.5) * 0.8;
    parts.push(cyl(0.2, 0.26, 0.5, x, 2.7 - Math.abs(i - 1.5) * 0.08, 0, tones[i] as number, 6));
    parts.push(cone(0.26, 0.2, x, 3.2 - Math.abs(i - 1.5) * 0.08, 0, 0x3c2c1e, 6));
  }
  return join(parts);
}

function scales(): BufferGeometry {
  return join([
    cyl(0.5, 0.7, 0.24, 0, 0, 0, 0xb08a3a, 8),
    cyl(0.08, 0.1, 2.4, 0, 0.2, 0, 0xd9b25a, 6),
    box(2.6, 0.1, 0.1, 0, 2.5, 0, 0xd9b25a),
    cyl(0.5, 0.3, 0.16, -1.2, 1.5, 0, 0xe0b354, 8),
    cyl(0.5, 0.3, 0.16, 1.2, 1.7, 0, 0xe0b354, 8),
    box(0.04, 0.9, 0.04, -1.2, 1.6, 0, 0x8a6a2a),
    box(0.04, 0.7, 0.04, 1.2, 1.8, 0, 0x8a6a2a),
    gem(0.22, -1.2, 1.86, 0, 0xc8483a),
  ]);
}

// --- c3 The Race (Jaffa Line, Wings over Hermon).

function engine(): BufferGeometry {
  const parts: BufferGeometry[] = [
    box(3, 0.4, 1.3, 0, 0.5, 0, 0x3c3c46),
    cyl(0.7, 0.7, 2, 0.3, 0.9, 0, 0x2e6a70, 10).rotateX(0),
    box(1.1, 1.5, 1.3, -1, 0.9, 0, 0x8a3a2e),
    box(1.3, 0.14, 1.5, -1, 2.4, 0, 0x5a2420),
    cyl(0.2, 0.26, 0.9, 0.9, 2.2, 0, 0x2a2a30, 6),
    cone(0.36, 0.3, 0.9, 3.1, 0, 0x2a2a30, 6),
    ball(0.4, 1.1, 3.9, 0, 0xf0ece4),
    ball(0.3, 0.7, 4.5, 0, 0xf6f2ea),
    ball(0.16, 1.5, 1.6, 0, 0xffd36a),
  ];
  for (const x of [-1, 0, 1]) {
    parts.push(
      cyl(0.42, 0.42, 0.16, x, 0.08, 0.66, 0xd9b25a, 10)
        .rotateX(Math.PI / 2)
        .translate(0, 0.42, 0),
    );
  }
  return join(parts);
}

function rails(): BufferGeometry {
  const parts: BufferGeometry[] = [
    box(7, 0.12, 0.12, 0, 0.14, 0.45, 0x5c5c68),
    box(7, 0.12, 0.12, 0, 0.14, -0.45, 0x5c5c68),
  ];
  for (let i = 0; i < 9; i++) parts.push(box(0.26, 0.12, 1.4, (i - 4) * 0.8, 0, 0, 0x6a4a2e));
  // A signal post with its lamp.
  parts.push(box(0.14, 2.8, 0.14, 3, 0, 1.1, 0x3c3c46), ball(0.24, 3, 2.9, 1.1, 0x6fd08a));
  return join(parts);
}

function hermon(): BufferGeometry {
  return join([
    cone(3, 6.4, 0, 0, 0, 0x8a94a8, 6),
    cone(1.26, 2.7, 0, 3.7, 0, 0xf4f6fa, 6),
    cone(2.2, 4.4, 2.6, 0, 0.5, 0x7c8698, 6),
    cone(0.9, 1.8, 2.6, 2.6, 0.5, 0xf4f6fa, 6),
    cone(1.8, 3.4, -2.5, 0, 0.6, 0x98a2b4, 6),
  ]);
}

function eagle(): BufferGeometry {
  return join([
    box(0.12, 4.4, 0.12, 0, 0, 0, 0x8a94a8),
    ball(0.5, 0, 4.9, 0, 0x6a4a2e, 1.6, 0.8, 0.8),
    ball(0.3, 0.9, 5.1, 0, 0xf4f0e6),
    cone(0.14, 0.4, 1.3, 4.95, 0, 0xe0b354, 4).rotateZ(0),
    box(0.9, 0.08, 2.6, -0.1, 5, 1.6, 0x5a3e28).rotateX(0.25),
    box(0.9, 0.08, 2.6, -0.1, 5, -1.6, 0x5a3e28).rotateX(-0.25),
    box(0.9, 0.06, 0.7, -1, 4.9, 0, 0x4e3320),
  ]);
}

function clouds(): BufferGeometry {
  return join([
    box(0.1, 3.4, 0.1, -0.9, 0, 0, 0xb8c0cc),
    box(0.1, 4.6, 0.1, 1, 0, 0.3, 0xb8c0cc),
    ball(0.9, -0.9, 3.8, 0, 0xf6f8fc, 1.5, 0.7, 1),
    ball(0.6, -0.1, 4, 0.2, 0xeef2f8, 1.3, 0.7, 1),
    ball(0.8, 1, 5, 0.3, 0xf6f8fc, 1.6, 0.7, 1),
    gem(0.3, 1.7, 4.2, 0.3, 0xffe08a),
  ]);
}

function finish(): BufferGeometry {
  const parts: BufferGeometry[] = [
    box(0.2, 4, 0.2, -2, 0, 0, 0x8a3a52),
    box(0.2, 4, 0.2, 2, 0, 0, 0x8a3a52),
  ];
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 2; j++) {
      parts.push(
        box(0.5, 0.4, 0.08, (i - 3.5) * 0.5, 3.2 + j * 0.4, 0, (i + j) % 2 ? 0x1c1a22 : 0xf4f0e6),
      );
    }
  }
  return join(parts);
}

// --- c4 The Deep (Sunken Geniza, Star Station).

function waves(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  for (let i = 0; i < 4; i++) {
    parts.push(arch(0.9, 0.16, (i - 1.5) * 1.5, 0, 0.6, i % 2 ? 0x4c88b8 : 0x6fb0d0));
    parts.push(arch(0.7, 0.13, (i - 1.5) * 1.5 + 0.7, 0, -0.5, i % 2 ? 0x6fb0d0 : 0x3a6c98));
  }
  return join(parts);
}

function jars(): BufferGeometry {
  const jar = (x: number, z: number, s: number, c: number): BufferGeometry[] => [
    ball(0.7 * s, x, 0.8 * s, z, c, 1, 1.25, 1),
    cyl(0.26 * s, 0.34 * s, 0.5 * s, x, 1.5 * s, z, c, 8),
    cyl(0.34 * s, 0.3 * s, 0.1 * s, x, 1.96 * s, z, 0x8a5a3a, 8),
  ];
  return join([
    ...jar(-0.9, 0, 1.2, 0xc8824a),
    ...jar(0.7, 0.4, 0.9, 0xb86e3c),
    ...jar(0.1, -0.9, 0.7, 0xd8965a),
    box(0.9, 0.06, 0.7, 1.6, 0.02, -0.5, 0xf3e6c4),
  ]);
}

function sunkenArch(): BufferGeometry {
  return join([
    cyl(0.4, 0.46, 3.4, -1.5, 0, 0, 0xcfd8d4, 8),
    cyl(0.4, 0.46, 3.4, 1.5, 0, 0, 0xcfd8d4, 8),
    box(4, 0.5, 1, 0, 3.4, 0, 0xdfe6e0),
    box(1, 0.3, 1, -1.5, 3.9, 0, 0xcfd8d4),
    // Shelves of scroll cases in the flooded archive.
    cyl(0.16, 0.16, 1, 0, 0.9, 0, 0xe0b354, 6)
      .rotateZ(Math.PI / 2)
      .translate(0.9, 0.9, 0),
    cyl(0.16, 0.16, 1, 0, 1.3, 0, 0xc8483a, 6)
      .rotateZ(Math.PI / 2)
      .translate(1.3, 0.5, 0),
  ]);
}

function observatory(): BufferGeometry {
  return join([
    cyl(1.5, 1.7, 1.8, 0, 0, 0, 0xd8dce8, 10),
    dome(1.5, 0, 1.8, 0, 0x8c9cc0),
    cyl(0.26, 0.34, 2.4, 0, 2.2, 0, 0x4a5270, 8).rotateZ(-0.7).translate(1.2, 0.3, 0),
    box(0.5, 0.9, 0.1, 0, 0, 1.66, 0x4a5270),
  ]);
}

function stars(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const at: readonly [number, number, number, number][] = [
    [-1.6, 4.4, 0, 0.34],
    [-0.5, 5.6, 0.4, 0.26],
    [0.6, 4.8, -0.3, 0.4],
    [1.7, 5.9, 0.2, 0.28],
    [0.1, 3.6, 0.5, 0.22],
  ];
  for (const [x, y, z, r] of at) {
    parts.push(gem(r, x, y, z, 0xffe08a));
    parts.push(box(0.04, y, 0.04, x, 0, z, 0x8c9cc0));
  }
  return join(parts);
}

function drone(): BufferGeometry {
  return join([
    box(0.08, 2.6, 0.08, 0, 0, 0, 0x8c9cc0),
    ball(0.6, 0, 3, 0, 0xe8ecf4, 1.3, 0.7, 1.3),
    cyl(0.9, 0.9, 0.08, 0, 3, 0, 0x4a5270, 12),
    ball(0.2, 0, 2.7, 0.5, 0x6fd0e8),
    box(0.06, 0.6, 0.06, 0, 3.4, 0, 0x4a5270),
    gem(0.14, 0, 4.1, 0, 0xff8a70),
  ]);
}

// --- c5 The Dark (Atbash City, Long Midbar, Lantern Caves).

function towers(): BufferGeometry {
  const parts: BufferGeometry[] = [
    box(1.3, 5, 1.3, -1.2, 0, 0, 0x3c4660),
    box(1.5, 3.6, 1.4, 0.5, 0, 0.2, 0x4a5474),
    box(1, 6.2, 1, 1.8, 0, -0.3, 0x343c54),
    cone(0.9, 0.9, 1.8, 6.2, -0.3, 0x586488, 4),
  ];
  // Lit windows.
  for (let i = 0; i < 9; i++) {
    const tower = i % 3;
    const x = tower === 0 ? -1.2 : tower === 1 ? 0.5 : 1.8;
    const z = tower === 0 ? 0.66 : tower === 1 ? 0.91 : 0.21;
    parts.push(
      box(0.26, 0.36, 0.04, x + ((i % 2) - 0.5) * 0.5, 1 + Math.floor(i / 3) * 1.1, z, 0xffd36a),
    );
  }
  return join(parts);
}

function cipherWheel(): BufferGeometry {
  const parts: BufferGeometry[] = [
    cyl(0.16, 0.2, 2.2, 0, 0, 0, 0x4a5474, 6),
    cyl(1.4, 1.4, 0.16, 0, 0, 0, 0xb08a3a, 16)
      .rotateX(Math.PI / 2)
      .translate(0, 3.2, 0),
    cyl(0.9, 0.9, 0.2, 0, 0, 0, 0xe0b354, 12)
      .rotateX(Math.PI / 2)
      .translate(0, 3.2, 0.06),
  ];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    parts.push(box(0.18, 0.18, 0.1, Math.cos(a) * 1.15, 3.11 + Math.sin(a) * 1.15, 0.12, 0x1c1a22));
  }
  return join(parts);
}

function dunes(): BufferGeometry {
  return join([
    ball(2.6, 0, 0, 0, 0xe0c088, 1.4, 0.36, 1),
    ball(1.8, 2.4, 0, 0.6, 0xd4b078, 1.3, 0.34, 1),
    ball(1.5, -2.4, 0, 0.5, 0xe8cc98, 1.2, 0.3, 1),
    // A palm of the oasis.
    cyl(0.12, 0.18, 2.6, 0.4, 0.7, -0.2, 0x7a5c3c, 5),
    ball(0.9, 0.4, 3.5, -0.2, 0x4f8a4a, 1.5, 0.3, 1.5),
    ball(0.2, 0.3, 3.2, 0, 0xc8824a),
  ]);
}

function caravan(): BufferGeometry {
  const camel = (x: number): BufferGeometry[] => [
    box(1, 0.5, 0.4, x, 0.9, 0, 0xc8a070),
    ball(0.3, x - 0.1, 1.5, 0, 0xb89060),
    box(0.2, 0.7, 0.2, x + 0.55, 1.3, 0, 0xc8a070),
    box(0.3, 0.24, 0.22, x + 0.7, 1.9, 0, 0xc8a070),
    box(0.1, 0.9, 0.1, x - 0.35, 0, 0.1, 0x9a7a50),
    box(0.1, 0.9, 0.1, x + 0.35, 0, 0.1, 0x9a7a50),
    box(0.5, 0.2, 0.46, x - 0.1, 1.4, 0, 0x8a3a52),
  ];
  return join([...camel(-1.4), ...camel(0.3), ball(1.6, 0, 0, 0, 0xe0c088, 1.6, 0.2, 0.7)]);
}

function caveMouth(): BufferGeometry {
  return join([
    arch(2, 0.7, 0, 0, 0, 0xcfc8b8),
    ball(1.2, -2.4, 0.5, 0.2, 0xbdb6a4, 1, 0.9, 1),
    ball(1, 2.5, 0.4, 0.1, 0xd8d0c0, 1, 0.9, 1),
    box(2.6, 2, 0.2, 0, 0, -0.3, 0x22202c),
    cone(0.2, 0.7, -0.6, 1.3, 0, 0xe8e0d0, 5).rotateX(0),
    cone(0.16, 0.5, 0.5, 1.5, 0, 0xe8e0d0, 5),
  ]);
}

function caveLantern(): BufferGeometry {
  return join([
    box(0.12, 2.4, 0.12, 0, 0, 0, 0x5a4630),
    box(0.9, 0.1, 0.1, 0.4, 2.3, 0, 0x5a4630),
    cyl(0.28, 0.34, 0.7, 0.8, 1.5, 0, 0xffd36a, 6),
    cone(0.36, 0.26, 0.8, 2.2, 0, 0x3c2c1e, 6),
    cyl(0.36, 0.36, 0.06, 0.8, 1.46, 0, 0x3c2c1e, 6),
    // Fireflies of the caves.
    gem(0.1, -0.7, 1.4, 0.4, 0xd8ff8a),
    gem(0.08, -0.3, 2.4, -0.3, 0xd8ff8a),
    gem(0.09, 1.5, 2.9, 0.2, 0xd8ff8a),
  ]);
}

/** The builders, column by column (c1..c5), six each, in the order they are drawn. */
export const DRAWINGS: readonly (readonly (() => BufferGeometry)[])[] = [
  [anemones, olive, homeRow, cliffs, ibex, well],
  [numberStones, anvil, furnace, stall, scales, lanterns],
  [rails, engine, finish, hermon, clouds, eagle],
  [waves, jars, sunkenArch, observatory, drone, stars],
  [dunes, caravan, towers, cipherWheel, caveMouth, caveLantern],
];

/** Where the six drawings of a column stand: x, and z relative to the column's station. */
export const SLOTS: readonly (readonly [number, number])[] = [
  [-11, -5.5],
  [11.5, -6],
  [-6.5, -10.5],
  [7, -11.5],
  [-1.5, -14.5],
  [3.4, -8.2],
];
