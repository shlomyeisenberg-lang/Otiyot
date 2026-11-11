// The Gematria Forge's own palette (DESIGN: "Each scene adds a small palette of its own"). A
// smithy inside a hill at evening: a round of dark red-brown rock, a high round window of
// twilight, and the furnace as the only real light, from ember red through orange to white-gold.
// The night-ink theme is the same cave with the evening gone deep blue and the fire stronger.

import type { ScenePalette, ThemeName } from '../../engine';

type Sky = Omit<ScenePalette, 'fade' | 'ink'>;

export const SKY: Readonly<Record<ThemeName, Sky>> = {
  light: {
    skyTop: 0x3a4f9a,
    skyHorizon: 0xf2a26a,
    sun: 0xffb877,
    sunIntensity: 0.7,
    sunFrom: [0.2, 0.9, 0.35],
    fillSky: 0xd8d0f0,
    fillGround: 0x9a8070,
    fillIntensity: 2.8,
    fog: 0x6a5a58,
    fogDensity: 0.012,
    fogBase: -2,
    fogFalloff: 0.06,
    inscatter: 0.8,
  },
  dark: {
    skyTop: 0x0c1030,
    skyHorizon: 0x5a3050,
    sun: 0x9aa4ff,
    sunIntensity: 0.6,
    sunFrom: [0.2, 0.9, 0.35],
    fillSky: 0x8a88e0,
    fillGround: 0x6a4040,
    fillIntensity: 2.6,
    fog: 0x2a1e34,
    fogDensity: 0.017,
    fogBase: -2,
    fogFalloff: 0.06,
    inscatter: 0.9,
  },
};

/** Colors of the things in the smithy. */
export const TINT = {
  // The hill: dark red-brown rock, paler where the window light falls.
  rockA: 0x8c7260,
  rockB: 0xa88a72,
  rockC: 0x6a5446,
  rockLit: 0xc8a888,
  floorA: 0x7a6a62,
  floorB: 0x9a8a80,
  roofA: 0x4e4040,
  roofB: 0x6a5450,
  // Iron, stone, wood.
  iron: 0x3a3d46,
  ironLight: 0x6a6f7c,
  brick: 0x8a4a3a,
  brickDark: 0x5a2f27,
  wood: 0x6a4630,
  woodDark: 0x41291c,
  rack: 0x5a3a28,
  // Fire, from a banked ember to a white-gold blaze.
  ember: 0xb3361c,
  fire: 0xff7a22,
  fireHot: 0xffc15a,
  fireWhite: 0xfff2c8,
  lamp: 0xffcf6a,
  // How a forged letter comes out.
  bright: 0xffd04a,
  cold: 0x9a6a58,
  scorched: 0xff5a30,
  // The safe band on the gauge.
  gaugeCold: 0x4f7fd0,
  gaugeGood: 0x62c26a,
  gaugeHot: 0xe0502c,
  needle: 0xfff2c8,
  // Sparks, smoke, steam.
  spark: 0xffd27a,
  smoke: 0x7a6a66,
  steam: 0xe9e2dc,
  // People.
  skin: 0xe3b48c,
  ink: 0x14100c,
  smithRobe: 0x5a3a2a,
  smithHem: 0x3a2418,
  smithApron: 0x2a2022,
  smithBeard: 0x4a3226,
  ezraRobe: 0x2e2a3a,
  ezraHem: 0x1a1724,
  ezraTrim: 0x24202c,
  ezraBeard: 0xeeeae2,
  dyo: 0x18204a,
  dyoShine: 0x3a5cc0,
  dyoEye: 0xfdf8ec,
} as const;
