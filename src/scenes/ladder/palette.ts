// The Ladder's own palette (DESIGN: "Each scene adds a small palette of its own"). High above the
// clouds, so it is all sky. Three moods the climb passes through: the faded morning (a lavender-grey
// mist, a pale sun, every color gone), the clear day the color comes back to (deep blue overhead,
// a peach horizon over the cloud sea), and, higher still, the golden dusk with the first stars.
// No other scene lives this high: no ground at all, only clouds below. The dark theme is the same
// sky, a shade deeper.

import type { ScenePalette, ThemeName } from '../../engine';

type Sky = Omit<ScenePalette, 'fade' | 'ink'>;

export const FADED: Readonly<Record<ThemeName, Sky>> = {
  light: {
    skyTop: 0x9a98aa,
    skyHorizon: 0xd4d0d8,
    sun: 0xe8e4ec,
    sunIntensity: 1.1,
    sunFrom: [0.6, 0.55, 0.4],
    fillSky: 0xb8b6c4,
    fillGround: 0xd0ccd0,
    fillIntensity: 0.75,
    fog: 0xc8c4cc,
    fogDensity: 0.012,
    fogBase: -6,
    fogFalloff: 0.05,
    inscatter: 0.3,
  },
  dark: {
    skyTop: 0x4a4858,
    skyHorizon: 0x8a8692,
    sun: 0xc8c4d0,
    sunIntensity: 0.9,
    sunFrom: [0.6, 0.55, 0.4],
    fillSky: 0x7a7888,
    fillGround: 0x8a8690,
    fillIntensity: 0.65,
    fog: 0x7a7684,
    fogDensity: 0.014,
    fogBase: -6,
    fogFalloff: 0.05,
    inscatter: 0.3,
  },
};

export const DAY: Readonly<Record<ThemeName, Sky>> = {
  light: {
    skyTop: 0x2f7ae0,
    skyHorizon: 0xffd8b8,
    sun: 0xfff2d8,
    sunIntensity: 2.3,
    sunFrom: [0.6, 0.55, 0.4],
    fillSky: 0x8ec4ff,
    fillGround: 0xfff0e0,
    fillIntensity: 1.05,
    fog: 0xf4e4dc,
    fogDensity: 0.006,
    fogBase: -6,
    fogFalloff: 0.05,
    inscatter: 0.6,
  },
  dark: {
    skyTop: 0x1a4a9a,
    skyHorizon: 0xd8a888,
    sun: 0xffe6c8,
    sunIntensity: 2,
    sunFrom: [0.6, 0.55, 0.4],
    fillSky: 0x6a98d8,
    fillGround: 0xd8c4b4,
    fillIntensity: 0.95,
    fog: 0xc8b0a8,
    fogDensity: 0.007,
    fogBase: -6,
    fogFalloff: 0.05,
    inscatter: 0.6,
  },
};

/** High up: the sun low and gold, the sky violet overhead, the first stars. */
export const DUSK: Readonly<Record<ThemeName, Sky>> = {
  light: {
    skyTop: 0x2a2a78,
    skyHorizon: 0xffa868,
    sun: 0xffc080,
    sunIntensity: 2,
    sunFrom: [0.8, 0.22, 0.3],
    fillSky: 0x8a78c8,
    fillGround: 0xffc8a0,
    fillIntensity: 0.95,
    fog: 0xe8a888,
    fogDensity: 0.006,
    fogBase: -6,
    fogFalloff: 0.05,
    inscatter: 0.85,
  },
  dark: {
    skyTop: 0x141448,
    skyHorizon: 0xd88050,
    sun: 0xffb070,
    sunIntensity: 1.8,
    sunFrom: [0.8, 0.22, 0.3],
    fillSky: 0x6a5aa8,
    fillGround: 0xd8a080,
    fillIntensity: 0.85,
    fog: 0xb87860,
    fogDensity: 0.007,
    fogBase: -6,
    fogFalloff: 0.05,
    inscatter: 0.85,
  },
};

export const TINT = {
  // The tower: letter tiles of parchment and sandstone, with a few colored courses.
  parchment: 0xf2e6c8,
  sandstone: 0xe0c49a,
  terracotta: 0xd07a52,
  techelet: 0x3a6ec8,
  olive: 0x8aa050,
  rose: 0xe8a0a0,
  mortar: 0xb09a80,
  tileInk: 0x3a2618,
  // The stair: cedar planks, brass posts, a rope rail.
  cedar: 0xa0643a,
  cedarDark: 0x6a3e22,
  brass: 0xd8a83a,
  rope: 0xe8d4a8,
  // Landings: a stone ring with a blue-and-gold pennant.
  landing: 0xe8dcc4,
  landingEdge: 0xb8a68a,
  pennant: 0x2f62c0,
  pennantGold: 0xf0c050,
  // Sky things.
  cloud: 0xfffaf4,
  cloudShade: 0xe8dce8,
  star: 0xfff6dc,
  wind: 0xffffff,
  // The challenges.
  glass: 0xbfe8ff,
  glassGlow: 0x7ac8ff,
  blot: 0x1a1428,
  blotEye: 0xf4f0ff,
  amber: 0xffb84a,
  gold: 0xffd27a,
  goldDust: 0xffe6a0,
  // People and Dyo.
  skin: 0xe0b48c,
  ink: 0x14100c,
  dyo: 0x18204a,
  dyoShine: 0x3a5cc0,
  dyoEye: 0xfdf8ec,
} as const;
