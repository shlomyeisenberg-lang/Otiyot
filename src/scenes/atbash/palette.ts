// Atbash City's own palette (DESIGN: "Each scene adds a small palette of its own"). A rainy night
// street. Two skies: the scrambled one (a flat wet grey, the neon dead, the light a dull sodium
// smear behind the cloud) and the decoded one after it (a deep indigo night, the cloud lit from
// below in magenta and teal by the signs, the moon breaking through). The scene blends from the
// first to the second as the codes are broken. The light theme is the same street at dusk, a
// little brighter, so it reads well on a light screen.

import type { ScenePalette, ThemeName } from '../../engine';

type Sky = Omit<ScenePalette, 'fade' | 'ink'>;

export const GREY: Readonly<Record<ThemeName, Sky>> = {
  light: {
    skyTop: 0x3a3c44,
    skyHorizon: 0x6a6a70,
    sun: 0xc8c4b8,
    sunIntensity: 1.6,
    sunFrom: [-0.4, 0.75, 0.5],
    fillSky: 0x8a8c98,
    fillGround: 0x3a3a40,
    fillIntensity: 2,
    fog: 0x5a5c64,
    fogDensity: 0.017,
    fogBase: -1,
    fogFalloff: 0.06,
    inscatter: 0.2,
  },
  dark: {
    skyTop: 0x16171c,
    skyHorizon: 0x34343a,
    sun: 0xb0aca0,
    sunIntensity: 1.3,
    sunFrom: [-0.4, 0.75, 0.5],
    fillSky: 0x5a5c68,
    fillGround: 0x222226,
    fillIntensity: 1.9,
    fog: 0x2a2a30,
    fogDensity: 0.018,
    fogBase: -1,
    fogFalloff: 0.06,
    inscatter: 0.15,
  },
};

export const NEON: Readonly<Record<ThemeName, Sky>> = {
  light: {
    skyTop: 0x1a1648,
    skyHorizon: 0x8a3a8a,
    sun: 0xd8e0ff,
    sunIntensity: 2.4,
    sunFrom: [-0.4, 0.75, 0.5],
    fillSky: 0x8a7ad8,
    fillGround: 0x3a2050,
    fillIntensity: 2.4,
    fog: 0x4a2a6a,
    fogDensity: 0.011,
    fogBase: -1,
    fogFalloff: 0.06,
    inscatter: 0.65,
  },
  dark: {
    skyTop: 0x080622,
    skyHorizon: 0x5a1a5a,
    sun: 0xc8d4ff,
    sunIntensity: 2.1,
    sunFrom: [-0.4, 0.75, 0.5],
    fillSky: 0x6a5ac8,
    fillGround: 0x2a1438,
    fillIntensity: 2.3,
    fog: 0x2a1640,
    fogDensity: 0.012,
    fogBase: -1,
    fogFalloff: 0.06,
    inscatter: 0.6,
  },
};

/** The neon colors of the city's signs (each sign takes one). */
export const NEON_COLORS: readonly number[] = [
  0xff3aa8, // magenta
  0x2ae8ff, // cyan
  0xffb02a, // amber
  0x7aff5a, // lime
  0xa86aff, // violet
];

/** Colors of the things in the street. */
export const TINT = {
  // Buildings: wet concrete, dark brick, tin awnings, iron fire stairs.
  concrete: 0x8a8890,
  concreteDark: 0x5a5a62,
  brick: 0x7a5048,
  roof: 0x3a3a40,
  awning: 0x2a6a70,
  awningB: 0x8a3050,
  iron: 0x3a3c44,
  window: 0xffcf8a,
  windowCool: 0x9ad8ff,
  windowDark: 0x24262c,
  // The street: black wet asphalt, a stone kerb, painted lines.
  asphalt: 0x2a2a30,
  kerb: 0x6a6a70,
  stripe: 0xd8d4c8,
  puddle: 0x1a1a22,
  // The neon when it is dead.
  dead: 0x4a4a52,
  // The vault gates: dark steel, brass bolts, the tumbler rings.
  steel: 0x5a6070,
  steelDark: 0x2e323c,
  brass: 0xc8a050,
  brassDark: 0x7a5a28,
  ring: 0x9aa4b4,
  // The patrol drones: grey of the Fading, a cold red eye, the searchlight; gold once restored.
  drone: 0x5a5c64,
  droneDark: 0x2a2c32,
  eye: 0xff4a4a,
  light: 0xf4f0ff,
  lantern: 0xffd27a,
  // Rain and its splashes.
  rain: 0xb8c8e8,
  splash: 0xd8e4ff,
  // Bursts.
  gold: 0xffd27a,
  goldDust: 0xffe6a0,
  spark: 0xf4f8ff,
  // People and Dyo.
  skin: 0xe0b48c,
  ink: 0x14100c,
  dyo: 0x18204a,
  dyoShine: 0x3a5cc0,
  dyoEye: 0xfdf8ec,
  umbrella: 0xff3aa8,
} as const;
