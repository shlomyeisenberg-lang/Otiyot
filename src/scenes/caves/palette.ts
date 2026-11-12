// The Lantern Caves' own palette (DESIGN: "Each scene adds a small palette of its own"). Under
// the hills, so there is no real sky: the "sky" is the deep dark of the caves. Two moods: the
// faded caves (cold blue-grey dark, thick still air, almost no light but the lantern) and the
// restored ones after the lamps are lit (a warm amber glow off white chalk, the air clearer).
// The finale lights the Hall of Lamps: honey-gold light everywhere. The dark theme is the same
// caves, a shade deeper.

import type { ScenePalette, ThemeName } from '../../engine';

type Sky = Omit<ScenePalette, 'fade' | 'ink'>;

export const DARK: Readonly<Record<ThemeName, Sky>> = {
  light: {
    skyTop: 0x0e1018,
    skyHorizon: 0x1c1e28,
    sun: 0x8a90a8,
    sunIntensity: 0.12,
    sunFrom: [0.2, 0.9, 0.3],
    fillSky: 0x4a5068,
    fillGround: 0x24222a,
    fillIntensity: 0.28,
    fog: 0x10121a,
    fogDensity: 0.07,
    fogBase: -2,
    fogFalloff: 0.02,
    inscatter: 0.1,
  },
  dark: {
    skyTop: 0x06070c,
    skyHorizon: 0x10121a,
    sun: 0x6a7090,
    sunIntensity: 0.08,
    sunFrom: [0.2, 0.9, 0.3],
    fillSky: 0x363c56,
    fillGround: 0x18161e,
    fillIntensity: 0.22,
    fog: 0x08090e,
    fogDensity: 0.08,
    fogBase: -2,
    fogFalloff: 0.02,
    inscatter: 0.1,
  },
};

export const LIT: Readonly<Record<ThemeName, Sky>> = {
  light: {
    skyTop: 0x2a1e14,
    skyHorizon: 0x5a3e22,
    sun: 0xffd8a0,
    sunIntensity: 0.35,
    sunFrom: [0.2, 0.9, 0.3],
    fillSky: 0xc8a070,
    fillGround: 0x5a4430,
    fillIntensity: 1.1,
    fog: 0x3a2818,
    fogDensity: 0.035,
    fogBase: -2,
    fogFalloff: 0.02,
    inscatter: 0.5,
  },
  dark: {
    skyTop: 0x1a120c,
    skyHorizon: 0x3a2818,
    sun: 0xffc88a,
    sunIntensity: 0.3,
    sunFrom: [0.2, 0.9, 0.3],
    fillSky: 0xa88058,
    fillGround: 0x3a2a1e,
    fillIntensity: 0.95,
    fog: 0x24180e,
    fogDensity: 0.04,
    fogBase: -2,
    fogFalloff: 0.02,
    inscatter: 0.5,
  },
};

/** The Hall of Lamps, every lamp burning. */
export const HALL: Readonly<Record<ThemeName, Sky>> = {
  light: {
    skyTop: 0x5a3a1c,
    skyHorizon: 0xc8904a,
    sun: 0xffe0a8,
    sunIntensity: 0.9,
    sunFrom: [0.1, 0.95, 0.2],
    fillSky: 0xfff0dc,
    fillGround: 0x8a7458,
    fillIntensity: 2.2,
    fog: 0x7a6650,
    fogDensity: 0.014,
    fogBase: -2,
    fogFalloff: 0.03,
    inscatter: 0.9,
  },
  dark: {
    skyTop: 0x3a2412,
    skyHorizon: 0x9a6a36,
    sun: 0xffd090,
    sunIntensity: 0.8,
    sunFrom: [0.1, 0.95, 0.2],
    fillSky: 0xf0dcc0,
    fillGround: 0x6a5a44,
    fillIntensity: 2,
    fog: 0x4a3a2a,
    fogDensity: 0.018,
    fogBase: -2,
    fogFalloff: 0.03,
    inscatter: 0.9,
  },
};

/** Colors of the things in the caves. */
export const TINT = {
  // Chalk: white and cream, warmer where light has soaked it, with bands of dark flint.
  chalk: 0xeae2cc,
  chalkWarm: 0xf4e4c4,
  chalkShade: 0xb6aa92,
  flint: 0x4a4652,
  ochre: 0xd0a878,
  floor: 0xb0a48c,
  floorDark: 0x86796a,
  // The scribes' things: clay lamps, brass, a stone shelf, old wood.
  clay: 0xb06a3c,
  clayDark: 0x7a4426,
  brass: 0xd8a83a,
  brassDark: 0x8a6420,
  glass: 0xfff0c8,
  wood: 0x6a4630,
  // Flames and light.
  flame: 0xffc25a,
  flameCore: 0xfff2c0,
  gold: 0xffd27a,
  goldDust: 0xffe6a0,
  lantern: 0xffb85a,
  lanternLight: 0xffd6a0,
  hallLight: 0xffe4bc,
  // The spring in the Hall.
  water: 0x2ea8c8,
  waterDeep: 0x125a78,
  waterShine: 0xbff4ff,
  // The shadows: soft ink-smoke with two pale, sleepy eyes. Tense, not frightening.
  shadow: 0x2a2434,
  shadowEdge: 0x4a4060,
  shadowEye: 0xd8d0ec,
  dust: 0xffe2b0,
  // People and Dyo.
  skin: 0xe0b48c,
  ink: 0x14100c,
  dyo: 0x18204a,
  dyoShine: 0x3a5cc0,
  dyoEye: 0xfdf8ec,
} as const;
