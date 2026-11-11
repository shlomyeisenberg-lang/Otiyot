// The title's own palette: a parchment on a scribe's desk by candlelight, in a cool, dark room so
// the warm page and the gold ink glow against it. Slightly brighter on the parchment theme.

import type { ScenePalette, ThemeName } from '../../engine';

type Sky = Omit<ScenePalette, 'fade' | 'ink'>;

export const SKY: Readonly<Record<ThemeName, Sky>> = {
  light: {
    skyTop: 0x1e2038,
    skyHorizon: 0x5a5068,
    sun: 0xfff0d8,
    sunIntensity: 2.5,
    sunFrom: [0.55, 0.62, 0.42],
    fillSky: 0xc8cce8,
    fillGround: 0x6a5a4a,
    fillIntensity: 2.1,
    fog: 0x4a4458,
    fogDensity: 0.013,
    fogBase: 0,
    fogFalloff: 0.12,
    inscatter: 0.6,
  },
  dark: {
    skyTop: 0x0b0c18,
    skyHorizon: 0x2e2a3c,
    sun: 0xffe6c4,
    sunIntensity: 2.3,
    sunFrom: [0.55, 0.62, 0.42],
    fillSky: 0x8088b8,
    fillGround: 0x3a2e24,
    fillIntensity: 2.0,
    fog: 0x26222e,
    fogDensity: 0.015,
    fogBase: 0,
    fogFalloff: 0.1,
    inscatter: 0.6,
  },
};

export const TINT = {
  parchment: 0xf3e8cc,
  parchmentDeep: 0xdfc99a,
  parchmentEdge: 0xa9855a,
  desk: 0x4a4c56,
  deskDark: 0x33343e,
  glass: 0x1a2440,
  rim: 0xd9a94a,
  feather: 0xf4ecdc,
  featherTip: 0x9a8a72,
  wax: 0xf3e6c8,
  flame: 0xffc46a,
} as const;
