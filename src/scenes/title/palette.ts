// The title's own palette: a scribe's desk by candlelight. Warm amber by day, deep umber at night.

import type { ScenePalette, ThemeName } from '../../engine';

type Sky = Omit<ScenePalette, 'fade' | 'ink'>;

export const SKY: Readonly<Record<ThemeName, Sky>> = {
  light: {
    skyTop: 0x6b4a2a,
    skyHorizon: 0xf2d5a0,
    sun: 0xffe2b0,
    sunIntensity: 2.3,
    sunFrom: [0.55, 0.62, 0.42],
    fillSky: 0xf6e2c0,
    fillGround: 0x8a6a44,
    fillIntensity: 1.6,
    fog: 0xe9c99a,
    fogDensity: 0.012,
    fogBase: 0,
    fogFalloff: 0.12,
    inscatter: 0.8,
  },
  dark: {
    skyTop: 0x0d0a08,
    skyHorizon: 0x4a2f1a,
    sun: 0xffbd7a,
    sunIntensity: 2.2,
    sunFrom: [0.6, 0.5, 0.45],
    fillSky: 0x6a5a8a,
    fillGround: 0x3a2618,
    fillIntensity: 1.8,
    fog: 0x2a1c12,
    fogDensity: 0.016,
    fogBase: 0,
    fogFalloff: 0.1,
    inscatter: 0.9,
  },
};

export const TINT = {
  parchment: 0xf1e2bf,
  parchmentDeep: 0xd9c08e,
  parchmentEdge: 0xa9814f,
  desk: 0x5a3a22,
  deskDark: 0x3a2414,
  glass: 0x1a2440,
  rim: 0xd9a94a,
  feather: 0xf4ecdc,
  featherTip: 0x9a8a72,
  wax: 0xf3e6c8,
  flame: 0xffc46a,
} as const;
