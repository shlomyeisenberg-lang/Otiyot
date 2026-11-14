// Decorations for the House of the Scribe (T33), bought in the ink shop or crafted: a brass
// lamp over the rug, a pomegranate tree in a pot, pennants on the pergola, a map of the Land of
// Letters on the wall, wind chimes, a dovecote with two doves, and a courtyard fountain. Each
// is a few painted shapes; all of them merge into one mesh (plus one for what glows).

import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import { Parts } from './build';

/** Where each decoration stands (x, z); the apprentice's paths stay clear of them. */
export const DECOR_SPOTS: Readonly<Record<string, readonly [number, number]>> = {
  'decor:lamp': [-5, 0.9],
  'decor:pomegranate': [1.6, 2.7],
  'decor:banners': [4.8, -4.7],
  'decor:map': [-8.86, 0.4],
  'decor:chimes': [3.6, -4.45],
  'decor:dovecote': [8.5, 0.9],
  'decor:fountain': [4.3, 0.7],
};

const BRASS = 0xb8862b;
const BRASS_DARK = 0x6e4c14;
const POT = 0xa85a3a;
const WOOD = 0x7a5432;
const STONE = 0xd8cdb4;
const STONE_DARK = 0x9a8e74;
const LEAF = 0x3e6a2a;
const LEAF_DARK = 0x24401a;
const FRUIT = 0xb02a2a;
const WHITE = 0xf2ece0;
const PARCH = 0xe8d8b0;
const WATER = 0x5fa4e8;

/**
 * Adds every decoration in `ids` to `solid` (lit, vertex colored) and `glow` (emissive).
 * `colors` come from the shop catalogue (banners use them as the pennant colors).
 */
export function buildDecor(
  ids: readonly string[],
  solid: Parts,
  glow: Parts,
  colorsOf: (id: string) => readonly number[],
): void {
  for (const id of ids) {
    const spot = DECOR_SPOTS[id];
    if (!spot) continue;
    const [x, z] = spot;
    switch (id) {
      case 'decor:lamp': {
        // A pierced brass lamp hanging from the beam on a chain, glowing warm.
        for (let k = 0; k < 5; k++) solid.box(0.03, 0.12, 0.03, BRASS_DARK, x, 3.55 - k * 0.13, z);
        solid.add(new CylinderGeometry(0.06, 0.3, 0.32, 8), BRASS, x, 2.82, z, BRASS_DARK);
        solid.add(new CylinderGeometry(0.3, 0.16, 0.22, 8), BRASS, x, 2.55, z, BRASS_DARK);
        solid.add(new ConeGeometry(0.06, 0.18, 6).rotateX(Math.PI), BRASS_DARK, x, 2.36, z);
        glow.add(new SphereGeometry(0.18, 8, 6), 0xffd27a, x, 2.62, z);
        break;
      }
      case 'decor:pomegranate': {
        solid.add(new CylinderGeometry(0.36, 0.26, 0.55, 9), POT, x, 0.27, z, 0x6a2c1a);
        solid.add(new CylinderGeometry(0.05, 0.07, 0.9, 6), WOOD, x, 0.95, z);
        for (const [dx, dy, dz, s] of [
          [0, 1.5, 0, 0.42],
          [0.25, 1.35, 0.1, 0.3],
          [-0.22, 1.38, -0.12, 0.3],
          [0.05, 1.7, -0.1, 0.28],
        ] as const) {
          solid.add(new IcosahedronGeometry(s, 0), LEAF, x + dx, dy, z + dz, LEAF_DARK);
        }
        for (const [dx, dy, dz] of [
          [0.3, 1.25, 0.25],
          [-0.28, 1.3, 0.2],
          [0.1, 1.6, 0.35],
          [-0.15, 1.55, -0.32],
          [0.36, 1.5, -0.12],
        ] as const) {
          solid.add(new SphereGeometry(0.09, 7, 5), FRUIT, x + dx, dy, z + dz, 0x6a1414);
          solid.add(new ConeGeometry(0.03, 0.05, 5), BRASS_DARK, x + dx, dy + 0.1, z + dz);
        }
        break;
      }
      case 'decor:banners': {
        // Pennants along the pergola beam, in the shop's colors.
        const cols = colorsOf(id);
        for (let k = 0; k < 14; k++) {
          const px = 0.9 + k * 0.58;
          const sag = Math.sin((k / 13) * Math.PI) * 0.18;
          const flag = new ConeGeometry(0.17, 0.42, 3).rotateX(Math.PI).scale(1, 1, 0.12);
          solid.add(flag, cols[k % cols.length] ?? WHITE, px, 2.82 - sag, z + 0.12);
        }
        solid.box(8.2, 0.02, 0.02, 0x3a2a1a, x - 0.1, 3.0, z + 0.12);
        break;
      }
      case 'decor:map': {
        // A framed map of the Land of Letters on the side wall: hills, a road, gold dots.
        solid.add(new BoxGeometry(0.06, 1.15, 1.75), WOOD, x, 2.15, z);
        solid.add(new BoxGeometry(0.07, 1.0, 1.6), PARCH, x + 0.01, 2.15, z, 0xd2bf94);
        for (const [dy, dz, s] of [
          [-0.15, -0.45, 0.22],
          [0.1, 0.2, 0.28],
          [-0.2, 0.5, 0.18],
        ] as const) {
          solid.add(
            new ConeGeometry(s, s * 0.9, 4).rotateZ(-Math.PI / 2),
            0x8aa060,
            x + 0.06,
            2.15 + dy,
            z + dz,
          );
        }
        for (let k = 0; k < 6; k++) {
          const dz = -0.65 + k * 0.26;
          const dy = Math.sin(k * 1.3) * 0.25;
          solid.add(new SphereGeometry(0.035, 6, 4), BRASS, x + 0.06, 2.15 + dy, z + dz);
        }
        break;
      }
      case 'decor:chimes': {
        solid.add(new CylinderGeometry(0.22, 0.22, 0.04, 10), WOOD, x, 2.85, z);
        solid.box(0.02, 0.3, 0.02, 0x3a2a1a, x, 3.03, z);
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          const len = 0.35 + (k % 3) * 0.12;
          solid.add(
            new CylinderGeometry(0.025, 0.025, len, 6),
            BRASS,
            x + Math.cos(a) * 0.16,
            2.8 - len / 2,
            z + Math.sin(a) * 0.16,
            BRASS_DARK,
          );
        }
        break;
      }
      case 'decor:dovecote': {
        solid.box(0.14, 2.0, 0.14, WOOD, x, 1.0, z);
        solid.box(0.75, 0.55, 0.6, WHITE, x, 2.25, z, 0xd8d0c0);
        solid.add(new ConeGeometry(0.62, 0.42, 4).rotateY(Math.PI / 4), 0x9a4a2a, x, 2.73, z);
        for (const dx of [-0.18, 0.18]) {
          solid.add(
            new CylinderGeometry(0.09, 0.09, 0.02, 8).rotateX(Math.PI / 2),
            0x2a2018,
            x + dx,
            2.3,
            z + 0.31,
          );
        }
        // Two doves on the ledge.
        for (const dx of [-0.22, 0.2]) {
          solid.add(new SphereGeometry(0.09, 7, 5).scale(1.3, 1, 1), WHITE, x + dx, 2.06, z + 0.36);
          solid.add(new SphereGeometry(0.055, 6, 4), WHITE, x + dx + 0.1, 2.15, z + 0.36);
          solid.add(
            new ConeGeometry(0.02, 0.05, 4).rotateZ(-Math.PI / 2),
            0xd09040,
            x + dx + 0.17,
            2.15,
            z + 0.36,
          );
        }
        solid.box(0.9, 0.04, 0.14, WOOD, x, 1.97, z + 0.36);
        break;
      }
      case 'decor:fountain': {
        solid.add(new CylinderGeometry(0.85, 0.95, 0.42, 14), STONE, x, 0.21, z, STONE_DARK);
        solid.add(new TorusGeometry(0.82, 0.07, 5, 18).rotateX(Math.PI / 2), STONE, x, 0.43, z);
        solid.add(new CylinderGeometry(0.12, 0.18, 0.8, 8), STONE, x, 0.75, z, STONE_DARK);
        solid.add(new CylinderGeometry(0.38, 0.12, 0.16, 10), STONE, x, 1.15, z, STONE_DARK);
        glow.add(new CylinderGeometry(0.76, 0.76, 0.03, 14), WATER, x, 0.38, z);
        glow.add(new CylinderGeometry(0.32, 0.32, 0.03, 10), WATER, x, 1.22, z);
        glow.add(new ConeGeometry(0.05, 0.35, 6), 0xbfe0ff, x, 1.4, z);
        break;
      }
      default:
        break;
    }
  }
}
