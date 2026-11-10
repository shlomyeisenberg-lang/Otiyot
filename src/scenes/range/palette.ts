// The test range's own small palette (DESIGN: "Each scene adds a small palette of its own").
// A late golden afternoon for the parchment theme, blue dusk for the night-ink theme.

import type { ScenePalette, ThemeName } from '../../engine';

type Sky = Omit<ScenePalette, 'fade' | 'ink'>;

export const SKY: Readonly<Record<ThemeName, Sky>> = {
  light: {
    skyTop: 0x2f6fd0,
    skyHorizon: 0xf7dcae,
    sun: 0xffd9a3,
    sunIntensity: 2.4,
    sunFrom: [-0.62, 0.42, -0.66],
    fillSky: 0xb9d0ff,
    fillGround: 0xa08a62,
    fillIntensity: 1.75,
    fog: 0xf0d6ac,
    fogDensity: 0.0075,
    fogBase: 0,
    fogFalloff: 0.16,
    inscatter: 0.75,
  },
  dark: {
    skyTop: 0x0c1433,
    skyHorizon: 0x7a5a86,
    sun: 0xffb37a,
    sunIntensity: 1.9,
    sunFrom: [-0.7, 0.24, -0.68],
    fillSky: 0x8a96d8,
    fillGround: 0x6a5566,
    fillIntensity: 2.3,
    fog: 0x5c4a70,
    fogDensity: 0.0095,
    fogBase: 0,
    fogFalloff: 0.14,
    inscatter: 0.85,
  },
};

/** Colors of the things in the range. */
export const TINT = {
  earthA: 0xc9b178,
  earthB: 0x8fb04e,
  earthC: 0xb08a55,
  path: 0xe6d6b0,
  stone: 0xe9dcc0,
  stoneDark: 0xb7a888,
  cypress: 0x2c7a4b,
  cypressLight: 0x5fae5a,
  olive: 0x9ab85e,
  trunk: 0x6b4a2e,
  rock: 0xa89c88,
  hill: 0x8e9a78,
  scribeRobe: 0x3a78c8,
  scribeHem: 0x1f4a86,
  scribeTrim: 0xe6c36a,
  walkerRobe: 0xb05c44,
  walkerHem: 0x5a2c22,
  walkerTrim: 0xf0e2c0,
  walkerBeard: 0x4a3626,
  elderRobe: 0x6a6480,
  elderHem: 0x403a54,
  elderTrim: 0x2a2420,
  childRobe: 0x58a890,
  childHem: 0x2c5c50,
  childTrim: 0xf3c9a0,
  skin: 0xe3b48c,
  skinDeep: 0xb98a62,
  beard: 0xe8e2d6,
  anemone: 0xd8362e,
  anemoneWhite: 0xf4ece2,
  anemoneViolet: 0x8a4fb0,
} as const;
