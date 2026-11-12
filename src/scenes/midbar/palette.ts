// The Long Midbar's own palette (DESIGN: "Each scene adds a small palette of its own"). Three
// skies: the faded one (a flat grey haze over grey sand, a weak white sun), the clear one after it
// (a deep blue sky going to warm gold at the horizon, a low golden sun behind the dunes ahead) and
// the storm, laid over either of them (the air turned to blowing sand, the sun a pale disc). The
// scene blends faded to clear word by word, and the storm in and out with the weather. The dark
// theme is the same road at dusk.

import type { ScenePalette, ThemeName } from '../../engine';

type Sky = Omit<ScenePalette, 'fade' | 'ink'>;

export const FADED: Readonly<Record<ThemeName, Sky>> = {
  light: {
    skyTop: 0x8c9098,
    skyHorizon: 0xc4c0b8,
    sun: 0xe8e6e0,
    sunIntensity: 2.1,
    sunFrom: [-0.35, 0.32, 0.88],
    fillSky: 0xb0b4bc,
    fillGround: 0x9a968e,
    fillIntensity: 1.9,
    fog: 0xbcb8b0,
    fogDensity: 0.0085,
    fogBase: -1,
    fogFalloff: 0.1,
    inscatter: 0.4,
  },
  dark: {
    skyTop: 0x2a2c38,
    skyHorizon: 0x6a6670,
    sun: 0xd0ccd0,
    sunIntensity: 1.8,
    sunFrom: [-0.35, 0.22, 0.9],
    fillSky: 0x7a7e98,
    fillGround: 0x4a4848,
    fillIntensity: 2.1,
    fog: 0x5a5862,
    fogDensity: 0.0095,
    fogBase: -1,
    fogFalloff: 0.1,
    inscatter: 0.4,
  },
};

export const CLEAR: Readonly<Record<ThemeName, Sky>> = {
  light: {
    skyTop: 0x2c6ec8,
    skyHorizon: 0xf8cf92,
    sun: 0xffd8a0,
    sunIntensity: 3.1,
    sunFrom: [-0.35, 0.3, 0.88],
    fillSky: 0x9cc4ff,
    fillGround: 0xd8a868,
    fillIntensity: 2,
    fog: 0xf2d2a2,
    fogDensity: 0.0042,
    fogBase: -1,
    fogFalloff: 0.1,
    inscatter: 1,
  },
  dark: {
    skyTop: 0x161c4a,
    skyHorizon: 0xe8865a,
    sun: 0xffb072,
    sunIntensity: 2.6,
    sunFrom: [-0.35, 0.16, 0.9],
    fillSky: 0x8a90d8,
    fillGround: 0x8a5a3a,
    fillIntensity: 2.3,
    fog: 0x9a6a5a,
    fogDensity: 0.005,
    fogBase: -1,
    fogFalloff: 0.1,
    inscatter: 1.1,
  },
};

/** The sandstorm, laid over the sky in proportion to how thick it is. */
export const STORM: Readonly<Record<ThemeName, Sky>> = {
  light: {
    skyTop: 0xb08a5a,
    skyHorizon: 0xd8b07a,
    sun: 0xf0d8b0,
    sunIntensity: 1.4,
    sunFrom: [-0.35, 0.3, 0.88],
    fillSky: 0xe0b880,
    fillGround: 0xb08050,
    fillIntensity: 2.4,
    fog: 0xd2a86e,
    fogDensity: 0.07,
    fogBase: -1,
    fogFalloff: 0.02,
    inscatter: 0.2,
  },
  dark: {
    skyTop: 0x4a3420,
    skyHorizon: 0x8a6440,
    sun: 0xd8a878,
    sunIntensity: 1.2,
    sunFrom: [-0.35, 0.16, 0.9],
    fillSky: 0xa88058,
    fillGround: 0x5a3e28,
    fillIntensity: 2.4,
    fog: 0x7a5a3a,
    fogDensity: 0.09,
    fogBase: -1,
    fogFalloff: 0.02,
    inscatter: 0.2,
  },
};

/** Colors of the things in the desert. */
export const TINT = {
  // The sand: warm dune faces, pale wind-blown crests, deeper hollows, the trodden road.
  sand: 0xe2b072,
  sandCrest: 0xf6d6a0,
  sandDeep: 0xc08648,
  road: 0xd2a066,
  rock: 0xa8683e,
  rockDark: 0x7a4628,
  // Stone markers along the road.
  stone: 0xdcc8a2,
  stoneDark: 0xa8946e,
  // Camels and their gear: woven saddle rugs in red, indigo and saffron, brass bells.
  camel: 0xc8955c,
  camelDark: 0x9a6a3c,
  camelBelly: 0xe0b888,
  hoof: 0x4a3424,
  rugRed: 0xb43426,
  rugIndigo: 0x2c3c8c,
  rugSaffron: 0xe0a028,
  rugStripe: 0xf2e6c8,
  bag: 0x8a5a34,
  brass: 0xd8a83a,
  // Wells and the oasis.
  wellStone: 0xc0aa86,
  wellDark: 0x8a7656,
  wood: 0x7a5030,
  water: 0x2ea8c8,
  waterDeep: 0x16708e,
  waterShine: 0xbff4ff,
  trunk: 0x8a6036,
  trunkDark: 0x5e3e22,
  frond: 0x3e9a3a,
  frondLight: 0x86c84a,
  date: 0xa8461e,
  reed: 0x6aa04a,
  tent: 0xeedcbc,
  tentStripe: 0x8a2a24,
  // The storm and the light.
  sandAir: 0xdcae72,
  sandAirDark: 0x8a6440,
  gold: 0xffd27a,
  goldDust: 0xffe6a0,
  // People and Dyo.
  skin: 0xe0b48c,
  ink: 0x14100c,
  scarf: 0xf2e8d2,
  dyo: 0x18204a,
  dyoShine: 0x3a5cc0,
  dyoEye: 0xfdf8ec,
} as const;
