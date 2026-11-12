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

// ---- the trials (T26) ------------------------------------------------------------------------

/** Who stands on the stage: the Great Blot, or one of the three trials. */
export type BossLookId = 'blot' | 'storm' | 'glass' | 'tide';

/** How a boss looks: its colors and the shape of its skin. */
export interface BossLook {
  body: number;
  sheen: number;
  /** The color it turns to in its last phase (the Blot's mirror; the trials' fury). */
  turn: number;
  eye: number;
  pupil: number;
  /** Its attacks: thrown things, the tide's floor, shards. */
  glob: number;
  tide: number;
  shard: number;
  /** Shape: spikes (a crest of feathers), facets (cut glass), waves (a rolling back). */
  spikes: number;
  facets: boolean;
  waves: number;
  /** Stretch of its body (x, y, z). */
  stretch: readonly [number, number, number];
  /** Brow angle per phase. */
  brows: readonly number[];
  /** How much its skin breathes (1 = the Blot's wobble). */
  wobble: number;
  emissive: number;
}

export const LOOKS: Readonly<Record<BossLookId, BossLook>> = {
  blot: {
    body: TINT.blot,
    sheen: TINT.blotSheen,
    turn: TINT.blotMirror,
    eye: TINT.eye,
    pupil: TINT.pupil,
    glob: TINT.glob,
    tide: TINT.tide,
    shard: TINT.shard,
    spikes: 0,
    facets: false,
    waves: 0,
    stretch: [1, 1, 1],
    brows: [0.1, 0.32, 0.48, -0.25],
    wobble: 1,
    emissive: 0.25,
  },
  // The Storm Hawk: a thundercloud with a crest of lightning feathers; it throws sparks.
  storm: {
    body: 0x1b1f3a,
    sheen: 0x8fd0ff,
    turn: 0x3a2a6a,
    eye: 0xfff3a0,
    pupil: 0x1b1f3a,
    glob: 0x2a3466,
    tide: 0x161a33,
    shard: 0xbfe6ff,
    spikes: 1,
    facets: false,
    waves: 0,
    stretch: [1.25, 0.92, 0.95],
    brows: [0.35, 0.45, 0.55],
    wobble: 0.8,
    emissive: 0.55,
  },
  // The Glass Golem: a cut crystal with a cold glow; slips mend its cracks.
  glass: {
    body: 0x9fd8e8,
    sheen: 0x5fb8ff,
    turn: 0xd8f4ff,
    eye: 0x0e3a5a,
    pupil: 0xf4fbff,
    glob: 0xb8e8f4,
    tide: 0x6fb0c8,
    shard: 0xe8faff,
    spikes: 0,
    facets: true,
    waves: 0,
    stretch: [0.9, 1.22, 0.9],
    brows: [0.05, 0.2, 0.3],
    wobble: 0.25,
    emissive: 0.45,
  },
  // The Long Tide: a great sea-green whale of a wave, its back always rolling.
  tide: {
    body: 0x0f4a52,
    sheen: 0x3fd0c0,
    turn: 0x0a2e48,
    eye: 0xf4f8e8,
    pupil: 0x062a30,
    glob: 0x15606a,
    tide: 0x0c3f48,
    shard: 0xbff4ea,
    spikes: 0,
    facets: false,
    waves: 1,
    stretch: [1.4, 0.85, 1.05],
    brows: [0, 0.12, 0.25],
    wobble: 0.7,
    emissive: 0.3,
  },
};

const sky = (base: Sky, patch: Partial<Sky>): Sky => ({ ...base, ...patch });

/** The trials' skies by day: three phases each (p4 repeats p3), and the clear sky after. */
const TRIAL_DAY: Readonly<Record<Exclude<BossLookId, 'blot'>, Record<ArenaLight, Sky>>> = (() => {
  const storm = {
    p1: sky(DAY.p2, {
      skyTop: 0x6c7390,
      skyHorizon: 0xc8cad6,
      sun: 0xe6eeff,
      fillSky: 0xaab4d4,
      fog: 0xb4b8c8,
      fogDensity: 0.013,
    }),
    p2: sky(DAY.p3, {
      skyTop: 0x3e4462,
      skyHorizon: 0x9aa2bc,
      sun: 0xd8e8ff,
      fillSky: 0x8a96c0,
      fog: 0x7c84a0,
    }),
    p3: sky(DAY.p3, {
      skyTop: 0x22243c,
      skyHorizon: 0x6c6c94,
      sun: 0xfff0b0,
      sunIntensity: 2.4,
      fillSky: 0x8088c0,
      fillGround: 0x3c3a4c,
      fog: 0x50506e,
      fogDensity: 0.015,
      inscatter: 0.85,
    }),
  };
  const glass = {
    p1: sky(DAY.p1, {
      skyTop: 0xcfe6ee,
      skyHorizon: 0xf4fbfc,
      sun: 0xf4fcff,
      fillSky: 0xdff0f6,
      fillGround: 0xa8b8b8,
      fog: 0xe6f2f4,
    }),
    p2: sky(DAY.p1, {
      skyTop: 0x9ccbe0,
      skyHorizon: 0xe4f4f8,
      sun: 0xe8f8ff,
      sunFrom: [-0.4, 0.7, 0.4],
      fillSky: 0xc4e4f0,
      fillGround: 0x8aa4a8,
      fog: 0xcfe6ee,
      inscatter: 0.6,
    }),
    p3: sky(DAY.p3, {
      skyTop: 0x2c5a78,
      skyHorizon: 0xa8dcec,
      sun: 0xe0f6ff,
      sunIntensity: 2.3,
      fillSky: 0x8cc8e0,
      fillGround: 0x48606a,
      fog: 0x7eb0c4,
      fogDensity: 0.012,
      inscatter: 0.9,
    }),
  };
  const tide = {
    p1: sky(DAY.p1, {
      skyTop: 0xa8c4c4,
      skyHorizon: 0xe8eee4,
      sun: 0xfff4e0,
      fillSky: 0xcadede,
      fillGround: 0x8f9c8c,
      fog: 0xd4e0da,
      fogDensity: 0.012,
    }),
    p2: sky(DAY.p2, {
      skyTop: 0x6c9aa4,
      skyHorizon: 0xd0e0d8,
      sun: 0xf8eedc,
      fillSky: 0xa8c8cc,
      fillGround: 0x6c7a70,
      fog: 0xa8c0bc,
    }),
    p3: sky(DAY.p3, {
      skyTop: 0x1c4450,
      skyHorizon: 0x8ab8b4,
      sun: 0xffe8c4,
      sunFrom: [0.6, 0.35, 0.5],
      fillSky: 0x78a8b0,
      fillGround: 0x34484a,
      fog: 0x5a8a8c,
      fogDensity: 0.015,
      inscatter: 0.85,
    }),
  };
  const done = (l: { p1: Sky; p2: Sky; p3: Sky }): Record<ArenaLight, Sky> => ({
    ...l,
    p4: l.p3,
    restored: DAY.restored,
  });
  return { storm: done(storm), glass: done(glass), tide: done(tide) };
})();

/** One channel scaled toward black (night): keeps the hue, drops the light. */
function dim(hex: number, k: number): number {
  const r = Math.round(((hex >> 16) & 255) * k);
  const g = Math.round(((hex >> 8) & 255) * k);
  const b = Math.round((hex & 255) * k);
  return (r << 16) | (g << 8) | b;
}

/** The same sky by moonlight. */
function night(s: Sky): Sky {
  return {
    ...s,
    skyTop: dim(s.skyTop, 0.3),
    skyHorizon: dim(s.skyHorizon, 0.5),
    sunIntensity: s.sunIntensity * 0.85,
    fillSky: dim(s.fillSky, 0.75),
    fillGround: dim(s.fillGround, 0.5),
    fillIntensity: s.fillIntensity * 1.15,
    fog: dim(s.fog, 0.42),
  };
}

/** The lights of a boss's fight, for a theme. */
export function lightsFor(look: BossLookId, theme: ThemeName): Readonly<Record<ArenaLight, Sky>> {
  if (look === 'blot') return LIGHTS[theme];
  const day = TRIAL_DAY[look];
  if (theme === 'light') return day;
  return {
    p1: night(day.p1),
    p2: night(day.p2),
    p3: night(day.p3),
    p4: night(day.p3),
    restored: NIGHT.restored,
  };
}
