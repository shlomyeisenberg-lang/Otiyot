// The Home Row Meadow's own palette (DESIGN: "Each scene adds a small palette of its own").
// A cool, clear spring morning for the parchment theme: a low sun through the almond tree, mint
// haze in the valley, new green and anemone red. The night-ink theme is the same meadow in the
// last blue hour before sunrise, with a rose horizon.

import type { ScenePalette, ThemeName } from '../../engine';

type Sky = Omit<ScenePalette, 'fade' | 'ink'>;

export const SKY: Readonly<Record<ThemeName, Sky>> = {
  light: {
    skyTop: 0x3f8fe0,
    skyHorizon: 0xfbe9c6,
    sun: 0xfff0cf,
    sunIntensity: 2.55,
    sunFrom: [-0.46, 0.4, -0.79],
    fillSky: 0xbfe0ff,
    fillGround: 0x8fae6a,
    fillIntensity: 1.85,
    fog: 0xe4f0d2,
    fogDensity: 0.0068,
    fogBase: -1,
    fogFalloff: 0.12,
    inscatter: 0.8,
  },
  dark: {
    skyTop: 0x101a44,
    skyHorizon: 0xd98a8e,
    sun: 0xffc4a0,
    sunIntensity: 1.95,
    sunFrom: [-0.46, 0.22, -0.79],
    fillSky: 0x8fa2e6,
    fillGround: 0x4a5c58,
    fillIntensity: 2.25,
    fog: 0x56507c,
    fogDensity: 0.0085,
    fogBase: -1,
    fogFalloff: 0.11,
    inscatter: 0.9,
  },
};

/** Colors of the things in the meadow. */
export const TINT = {
  // The ground: new grass, a yellower sunlit green, clover, and bare earth under the garden.
  grassA: 0x6fae3c,
  grassB: 0xa6cf4e,
  grassC: 0x4f9440,
  earth: 0xb99a66,
  path: 0xdcc9a0,
  hillFar: 0x7fa08a,
  // Grass blades.
  bladeRoot: 0x5d9a3c,
  bladeTip: 0xd2ea84,
  // The home-row garden.
  soil: 0x5a3d28,
  soilWet: 0x3f2a1c,
  stone: 0xe6d9bc,
  stoneDark: 0xb5a586,
  // Anemones (kalaniyot): mostly red, with white, violet and pink among them.
  anemone: 0xe02a24,
  anemoneDeep: 0xb81a26,
  anemoneWhite: 0xfaf3e6,
  anemoneViolet: 0x8d55c4,
  anemonePink: 0xf07a9c,
  stem: 0x4d8a3a,
  heart: 0x1c1420,
  // The almond tree.
  bark: 0x5c4030,
  blossom: 0xffe6ee,
  blossomPink: 0xf7b4cc,
  // Cypresses, rocks, clouds.
  cypress: 0x2f7448,
  cypressLight: 0x4f9a58,
  rock: 0xb3a892,
  cloud: 0xffffff,
  // Birds and butterflies.
  bird: 0x3a342e,
  birdWing: 0x6d6258,
  butterflyA: 0xffd24a,
  butterflyB: 0xffffff,
  butterflyC: 0x7ec8ff,
  butterflyD: 0xff9a5c,
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
  // The mist of the Fading that lifts when a patch is restored.
  mist: 0xb9b4ac,
} as const;
