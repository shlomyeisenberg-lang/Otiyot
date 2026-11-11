// The Silent Arena's own palette (DESIGN: "Each scene adds a small palette of its own"). An old
// stone theatre under a white sky: the Fading has bleached the air itself. Each phase of the
// Great Blot shifts the light: a flat white noon (Spatter), a bruised overcast (Tendrils), a
// slate storm as the ink rises (Flood), and the world turned inside out (Mirror: an ink sky over
// pale stone). The victory brings a clear blue afternoon. The night-ink theme is the same theatre
// by moonlight.

import type { ScenePalette, ThemeName } from '../../engine';

export type Sky = Omit<ScenePalette, 'fade' | 'ink'>;

/** One sky per phase (p1..p4), then the restored arena. */
export type ArenaLight = 'p1' | 'p2' | 'p3' | 'p4' | 'restored';

const DAY: Readonly<Record<ArenaLight, Sky>> = {
  p1: {
    skyTop: 0xe8e6e1,
    skyHorizon: 0xfbfaf6,
    sun: 0xfffaf0,
    sunIntensity: 2.2,
    sunFrom: [0.35, 0.8, 0.45],
    fillSky: 0xf2f0ec,
    fillGround: 0xb9b2a4,
    fillIntensity: 1.9,
    fog: 0xf1efe9,
    fogDensity: 0.0105,
    fogBase: -2,
    fogFalloff: 0.06,
    inscatter: 0.4,
  },
  p2: {
    skyTop: 0xb9b4c4,
    skyHorizon: 0xe6e0e4,
    sun: 0xf3e6f0,
    sunIntensity: 1.9,
    sunFrom: [-0.45, 0.6, 0.35],
    fillSky: 0xd6d0e0,
    fillGround: 0x9a8f96,
    fillIntensity: 1.8,
    fog: 0xd9d3dc,
    fogDensity: 0.0125,
    fogBase: -2,
    fogFalloff: 0.07,
    inscatter: 0.5,
  },
  p3: {
    skyTop: 0x5b6474,
    skyHorizon: 0xb7c0c8,
    sun: 0xd8e6f4,
    sunIntensity: 2,
    sunFrom: [0.2, 0.5, 0.6],
    fillSky: 0x9eaebd,
    fillGround: 0x55585e,
    fillIntensity: 1.9,
    fog: 0x8f99a6,
    fogDensity: 0.014,
    fogBase: -1,
    fogFalloff: 0.12,
    inscatter: 0.7,
  },
  p4: {
    skyTop: 0x0b0a12,
    skyHorizon: 0x3c3458,
    sun: 0xcfe8ff,
    sunIntensity: 2.4,
    sunFrom: [-0.3, 0.75, 0.55],
    fillSky: 0x7f86c8,
    fillGround: 0x2a2433,
    fillIntensity: 2.3,
    fog: 0x2b2640,
    fogDensity: 0.012,
    fogBase: -2,
    fogFalloff: 0.08,
    inscatter: 0.9,
  },
  restored: {
    skyTop: 0x3f86d6,
    skyHorizon: 0xffe0b0,
    sun: 0xffe4b8,
    sunIntensity: 2.9,
    sunFrom: [0.5, 0.42, 0.55],
    fillSky: 0xcfe2ff,
    fillGround: 0xc8a272,
    fillIntensity: 1.7,
    fog: 0xf0dcbc,
    fogDensity: 0.0068,
    fogBase: -2,
    fogFalloff: 0.06,
    inscatter: 0.95,
  },
};

const NIGHT: Readonly<Record<ArenaLight, Sky>> = {
  p1: {
    ...DAY.p1,
    skyTop: 0x2a2a33,
    skyHorizon: 0x77757c,
    sun: 0xe4e8f4,
    sunIntensity: 1.9,
    fillSky: 0x9a9cb4,
    fillGround: 0x4a4648,
    fillIntensity: 2.2,
    fog: 0x5e5d66,
  },
  p2: {
    ...DAY.p2,
    skyTop: 0x262236,
    skyHorizon: 0x6c6178,
    sun: 0xe6d8f2,
    sunIntensity: 1.8,
    fillSky: 0x9d92c0,
    fillGround: 0x433a48,
    fillIntensity: 2.2,
    fog: 0x584e66,
  },
  p3: {
    ...DAY.p3,
    skyTop: 0x161c28,
    skyHorizon: 0x4a5668,
    sun: 0xc6dcf4,
    sunIntensity: 1.9,
    fillSky: 0x7e94b4,
    fillGround: 0x2e3238,
    fillIntensity: 2.2,
    fog: 0x3c4656,
  },
  p4: { ...DAY.p4, skyTop: 0x050409, skyHorizon: 0x2a2440, fog: 0x1f1b30 },
  restored: {
    ...DAY.restored,
    skyTop: 0x1c1a4c,
    skyHorizon: 0xe58a70,
    sun: 0xffb27f,
    sunIntensity: 2.2,
    fillSky: 0x9a8fe0,
    fillGround: 0x6a4c4a,
    fillIntensity: 2.1,
    fog: 0x6a4e72,
    fogDensity: 0.0085,
  },
};

export const LIGHTS: Readonly<Record<ThemeName, Readonly<Record<ArenaLight, Sky>>>> = {
  light: DAY,
  dark: NIGHT,
};

/** Colors of the things in the arena. */
export const TINT = {
  // Limestone of the theatre, in tiers; the orchestra floor is paved in rings.
  stone: 0xe4d6b8,
  stoneLight: 0xf1e6cc,
  stoneDark: 0xb7a37e,
  stoneShade: 0x8e7c5c,
  paving: 0xd9c8a4,
  pavingDark: 0xbfa985,
  column: 0xeee2c6,
  hill: 0xb9a57c,
  hillGreen: 0x8fa463,
  olive: 0x6f8a4a,
  oliveDark: 0x4f6a36,
  // The Great Blot: ink, with a cold sheen; its eyes are the pale of an empty page.
  blot: 0x0d0c14,
  blotSheen: 0x2a3a7a,
  blotMirror: 0xf2efe6,
  eye: 0xfdf8ec,
  pupil: 0x0d0c14,
  // Attacks.
  glob: 0x100e18,
  tide: 0x0a0912,
  shard: 0xdfe8ff,
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
