// Wings over Hermon's own palette (DESIGN: "Each scene adds a small palette of its own"). Two skies:
// the storm (slate and bruised violet, a low cold light, thick wet fog) and the clear evening
// after it (a washed blue sky, a warm low sun over the snow of Hermon). The scene blends from the
// first to the second as the storm breaks. The dark theme is the same flight by night: the storm
// lit by its lightning, then moonlight on the snow.

import type { ScenePalette, ThemeName } from '../../engine';

type Sky = Omit<ScenePalette, 'fade' | 'ink'>;

export const STORM: Readonly<Record<ThemeName, Sky>> = {
  light: {
    skyTop: 0x3c4458,
    skyHorizon: 0x8a90a2,
    sun: 0xd8deef,
    sunIntensity: 1.9,
    sunFrom: [-0.3, 0.7, 0.6],
    fillSky: 0x8088a0,
    fillGround: 0x3a3a44,
    fillIntensity: 2.2,
    fog: 0x6c7282,
    fogDensity: 0.0075,
    fogBase: 0,
    fogFalloff: 0.012,
    inscatter: 0.4,
  },
  dark: {
    skyTop: 0x0c0e18,
    skyHorizon: 0x262a3c,
    sun: 0x8a9ac8,
    sunIntensity: 1.1,
    sunFrom: [-0.3, 0.8, 0.6],
    fillSky: 0x4a5274,
    fillGround: 0x14141c,
    fillIntensity: 1.9,
    fog: 0x1c2030,
    fogDensity: 0.012,
    fogBase: 0,
    fogFalloff: 0.012,
    inscatter: 0.3,
  },
};

export const CLEAR: Readonly<Record<ThemeName, Sky>> = {
  light: {
    skyTop: 0x4f8fd8,
    skyHorizon: 0xffd6a8,
    sun: 0xfff0d0,
    sunIntensity: 3.2,
    sunFrom: [-0.35, 0.42, 0.85],
    fillSky: 0xa8c8f0,
    fillGround: 0x6a5a48,
    fillIntensity: 2.2,
    fog: 0xe6d2be,
    fogDensity: 0.0026,
    fogBase: 0,
    fogFalloff: 0.01,
    inscatter: 0.85,
  },
  dark: {
    skyTop: 0x1a2a58,
    skyHorizon: 0x6a5a8a,
    sun: 0xd8e4ff,
    sunIntensity: 2.2,
    sunFrom: [-0.35, 0.5, 0.85],
    fillSky: 0x6a7ab8,
    fillGround: 0x24202c,
    fillIntensity: 2,
    fog: 0x3a3c64,
    fogDensity: 0.005,
    fogBase: 0,
    fogFalloff: 0.01,
    inscatter: 1.1,
  },
};

/** Colors of the things in the flight. */
export const TINT = {
  // The land.
  grass: 0x6aa04a,
  grassDark: 0x3f7a3a,
  orchard: 0x2f6a34,
  rock: 0x9a8a78,
  rockDark: 0x6a5e54,
  snow: 0xf4f6fa,
  snowShade: 0xc8d4e8,
  river: 0x4aa0c8,
  roof: 0xc8784a,
  wall: 0xe8dcc0,
  // The storm.
  cloud: 0x6a6e7e,
  cloudDark: 0x7c8090,
  cloudClear: 0xfff2ea,
  rain: 0xc8d8f0,
  bolt: 0xe8f0ff,
  boltCore: 0xffffff,
  // The hail.
  ice: 0xd8f0ff,
  iceDeep: 0x6a9ac8,
  iceDark: 0x2a3a58,
  shard: 0xe8f8ff,
  // Gold that falls when a stone breaks, and the rainbow after the storm.
  gold: 0xffd27a,
  goldRain: 0xffe6a0,
  // The eagle.
  feather: 0x6e4c30,
  featherDark: 0x40291a,
  featherTip: 0x24160c,
  covert: 0x9a7040,
  nape: 0xc8902e,
  napeLight: 0xe0b058,
  beak: 0xe8c040,
  beakTip: 0x3a3028,
  eye: 0xe8a020,
  // Dyo.
  dyo: 0x18204a,
  dyoShine: 0x3a5cc0,
  dyoEye: 0xfdf8ec,
  ink: 0x14100c,
} as const;

/** The rainbow's bands, outside in. */
export const RAINBOW: readonly number[] = [
  0xff5a4a, 0xffa040, 0xffe060, 0x6ad06a, 0x4aa0f0, 0x7a6ae0,
];
