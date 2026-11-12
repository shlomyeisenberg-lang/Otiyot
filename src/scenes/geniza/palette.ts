// The Sunken Geniza's own palette (DESIGN: "Each scene adds a small palette of its own"). A flooded
// archive under green-blue water: the light comes from straight above in pale shafts, the stone is
// cool sandstone, the clay jars are terracotta and the pages are old parchment. The dark theme is
// the same hall at night, moonlight through the water and the lamps of the archive.

import type { ScenePalette, ThemeName } from '../../engine';

type Sky = Omit<ScenePalette, 'fade' | 'ink'>;

export const SKY: Readonly<Record<ThemeName, Sky>> = {
  light: {
    skyTop: 0x9fe0d8,
    skyHorizon: 0x2e7a86,
    sun: 0xe8fff4,
    sunIntensity: 3.0,
    sunFrom: [0.15, 1, 0.25],
    fillSky: 0x8fd8d0,
    fillGround: 0x3a6a6a,
    fillIntensity: 2.4,
    fog: 0x3f8c90,
    fogDensity: 0.026,
    fogBase: -1,
    fogFalloff: 0.02,
    inscatter: 1.2,
  },
  dark: {
    skyTop: 0x3a6a8a,
    skyHorizon: 0x0c2032,
    sun: 0xb8d8ff,
    sunIntensity: 2.0,
    sunFrom: [0.2, 1, 0.3],
    fillSky: 0x4a7aa8,
    fillGround: 0x1a2a34,
    fillIntensity: 2.0,
    fog: 0x123044,
    fogDensity: 0.03,
    fogBase: -1,
    fogFalloff: 0.02,
    inscatter: 1.1,
  },
};

/** Colors of the things in the hall. */
export const TINT = {
  // The hall.
  sand: 0xc8b48a,
  sandDark: 0x9a8a68,
  stone: 0xb8a684,
  stoneDark: 0x7a6c56,
  shelf: 0x6a4a32,
  jar: 0xb86a44,
  jarDark: 0x8a4a30,
  weed: 0x3f8a5a,
  weedDark: 0x2a5a44,
  coral: 0xd88a6a,
  // The water.
  surface: 0xc8fff0,
  shaft: 0xdcfff4,
  bubble: 0xe8fffa,
  silt: 0x8a7a5a,
  current: 0x7ff0e0,
  // Pages and light.
  page: 0xf0e2c0,
  pageEdge: 0xc8b088,
  lamp: 0xffe08a,
  lampOff: 0x5a6a70,
  whole: 0xfff0b0,
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
} as const;
