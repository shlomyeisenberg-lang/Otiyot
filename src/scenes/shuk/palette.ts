// The Night Shuk's own palette (DESIGN: "Each scene adds a small palette of its own"). A market
// square after dark: deep indigo sky with a thin moon, limestone walls, and everything lit by
// lanterns in amber, with teal, madder and saffron cloth on the stalls. The day theme is the same
// market at blue hour, the lanterns just lit.

import type { ScenePalette, ThemeName } from '../../engine';

type Sky = Omit<ScenePalette, 'fade' | 'ink'>;

export const SKY: Readonly<Record<ThemeName, Sky>> = {
  light: {
    skyTop: 0x2c3a78,
    skyHorizon: 0xe08a72,
    sun: 0xbfc8ff,
    sunIntensity: 0.55,
    sunFrom: [-0.4, 0.8, 0.3],
    fillSky: 0xb8bde8,
    fillGround: 0x8a7468,
    fillIntensity: 2.6,
    fog: 0x4a4468,
    fogDensity: 0.014,
    fogBase: -2,
    fogFalloff: 0.06,
    inscatter: 0.8,
  },
  dark: {
    skyTop: 0x070a24,
    skyHorizon: 0x3a2a5a,
    sun: 0x8a96ff,
    sunIntensity: 0.5,
    sunFrom: [-0.4, 0.8, 0.3],
    fillSky: 0x6a70d0,
    fillGround: 0x54403c,
    fillIntensity: 2.3,
    fog: 0x1a1830,
    fogDensity: 0.019,
    fogBase: -2,
    fogFalloff: 0.06,
    inscatter: 0.9,
  },
};

/** Colors of the things in the market. */
export const TINT = {
  // Cobbles and walls.
  cobbleA: 0x9a8a78,
  cobbleB: 0xb8a68e,
  wallA: 0xb39a80,
  wallB: 0x8f7a68,
  wallDark: 0x5a4a44,
  roof: 0x4a3a46,
  window: 0xffc870,
  // Wood and cloth.
  wood: 0x6a4630,
  woodDark: 0x41291c,
  clothA: 0x1f8a8a,
  clothB: 0xc2493c,
  clothC: 0xe0a53a,
  clothCream: 0xeee0c0,
  // Light.
  lantern: 0xffb84a,
  lanternHot: 0xfff0b8,
  lanternOff: 0x6a6270,
  wire: 0x2a2630,
  // A trade closed: coin gold, and the haggle won.
  coin: 0xffd04a,
  haggle: 0xfff2c8,
  spark: 0xffd27a,
  mist: 0xb8b4d8,
  // People.
  skin: 0xe3b48c,
  ink: 0x14100c,
  merchantRobe: 0x2e5a62,
  merchantHem: 0x1c3a40,
  merchantTrim: 0xe0a53a,
  merchantRobe2: 0x7a3a3a,
  merchantHem2: 0x4a2222,
  merchantRobe3: 0x5a4a7a,
  merchantHem3: 0x362c50,
  merchantBeard: 0x3a2c22,
  merchantBeard2: 0x8a8a90,
  ezraRobe: 0x2e2a3a,
  ezraHem: 0x1a1724,
  ezraTrim: 0x24202c,
  ezraBeard: 0xeeeae2,
  dyo: 0x18204a,
  dyoShine: 0x3a5cc0,
  dyoEye: 0xfdf8ec,
} as const;
