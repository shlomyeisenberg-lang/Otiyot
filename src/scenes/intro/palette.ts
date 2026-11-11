// The intro's own palette: a quiet street at night, moonlight from the front, warm lamp light in
// the windows. A deep blue night on the night-ink theme; an indigo dusk on the parchment theme.

import type { ScenePalette, ThemeName } from '../../engine';

type Sky = Omit<ScenePalette, 'fade' | 'ink'>;

export const SKY: Readonly<Record<ThemeName, Sky>> = {
  light: {
    skyTop: 0x1a2350,
    skyHorizon: 0x9a6f8e,
    sun: 0xc9d6ff,
    sunIntensity: 1.7,
    sunFrom: [-0.45, 0.62, 0.64],
    fillSky: 0x8f9ce0,
    fillGround: 0x6a5060,
    fillIntensity: 2.2,
    fog: 0x6c5a82,
    fogDensity: 0.011,
    fogBase: 0,
    fogFalloff: 0.16,
    inscatter: 0.5,
  },
  dark: {
    skyTop: 0x060a1e,
    skyHorizon: 0x3a3060,
    sun: 0xb8c8ff,
    sunIntensity: 1.5,
    sunFrom: [-0.45, 0.62, 0.64],
    fillSky: 0x6a78c8,
    fillGround: 0x3a3048,
    fillIntensity: 2.1,
    fog: 0x2a2648,
    fogDensity: 0.013,
    fogBase: 0,
    fogFalloff: 0.15,
    inscatter: 0.5,
  },
};

export const TINT = {
  street: 0xb9a888,
  streetDark: 0x8e7f66,
  yard: 0x8a8a5e,
  grass: 0x5e7a44,
  wall: 0xe8d6b0,
  wallDark: 0xc4ae86,
  stone: 0xa89a80,
  roof: 0xa4553a,
  roofDark: 0x6e3424,
  wood: 0x6b4428,
  woodDark: 0x40281a,
  board: 0x5a3a20,
  lamp: 0xffa848,
  window: 0xff9a36,
  glass: 0x16203c,
  rim: 0xd9a94a,
  feather: 0xf4ecdc,
  cypress: 0x2c6a48,
  cypressLight: 0x4e8e5a,
  star: 0xf4f0ff,
  ezraRobe: 0x2e2a3a,
  ezraHem: 0x1a1724,
  ezraTrim: 0x24202c,
  ezraBeard: 0xeeeae2,
  skin: 0xe3b48c,
  ink: 0x14100c,
  dyo: 0x18204a,
  dyoShine: 0x3a5cc0,
  dyoEye: 0xfdf8ec,
} as const;
