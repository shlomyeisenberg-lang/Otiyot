// The Cliffs of Ein Gedi's own palette (DESIGN: "Each scene adds a small palette of its own").
// A dry golden afternoon in the Judean desert: warm sandstone, hard blue sky, a low sun raking
// across the canyon, and the green of the oasis wherever the water runs again. The night-ink
// theme is the same canyon at dusk, rose and violet, with the rock still holding the heat.

import type { ScenePalette, ThemeName } from '../../engine';

type Sky = Omit<ScenePalette, 'fade' | 'ink'>;

export const SKY: Readonly<Record<ThemeName, Sky>> = {
  light: {
    skyTop: 0x2f7fd8,
    skyHorizon: 0xffd9a0,
    sun: 0xffe2b0,
    sunIntensity: 2.8,
    sunFrom: [0.55, 0.34, -0.5],
    fillSky: 0xcfe2ff,
    fillGround: 0xc99a62,
    fillIntensity: 1.7,
    fog: 0xf1d8b0,
    fogDensity: 0.0078,
    fogBase: -8,
    fogFalloff: 0.09,
    inscatter: 0.95,
  },
  dark: {
    skyTop: 0x1c1a4c,
    skyHorizon: 0xe58a70,
    sun: 0xffa87a,
    sunIntensity: 2.1,
    sunFrom: [0.55, 0.16, -0.5],
    fillSky: 0x9a8fe0,
    fillGround: 0x6a4c4a,
    fillIntensity: 2.1,
    fog: 0x6a4e72,
    fogDensity: 0.009,
    fogBase: -8,
    fogFalloff: 0.09,
    inscatter: 1,
  },
};

/** Colors of the things in the canyon. */
export const TINT = {
  // The cliffs: sandstone in bands, darker in the shade, pale on top.
  rockA: 0xc79a62,
  rockB: 0xdcb27a,
  rockC: 0xa87a4c,
  rockTop: 0xe9cf9c,
  rockShade: 0x7e5a3c,
  riverBed: 0x8d6d4a,
  // The stepping stones.
  stone: 0xe0c08a,
  stoneDark: 0xa98458,
  stoneMoss: 0x6f9a4a,
  summit: 0xf0dcae,
  // Water and the oasis.
  water: 0x3fb4d8,
  waterDeep: 0x1f7fb0,
  foam: 0xf4fbff,
  reed: 0x6aa23e,
  reedTip: 0xc2d968,
  acacia: 0x4f8a3a,
  acaciaLight: 0x7db048,
  bark: 0x5c4030,
  flower: 0xf0a23a,
  // Ibex (yaʿel), birds, dust.
  ibex: 0xb69468,
  ibexDark: 0x5a4430,
  horn: 0xe9dfc6,
  bird: 0x2f2a26,
  birdWing: 0x5a5148,
  dust: 0xf3dba8,
  // People.
  skin: 0xe3b48c,
  ink: 0x14100c,
  ezraRobe: 0x2e2a3a,
  ezraHem: 0x1a1724,
  ezraTrim: 0x24202c,
  ezraBeard: 0xeeeae2,
  dyo: 0x18204a,
  dyoShine: 0x3a5cc0,
  dyoEye: 0xfdf8ec,
  // The mist of the Fading that lifts when a stretch is restored.
  mist: 0xc2b6a4,
} as const;
