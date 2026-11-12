// The Jaffa Line's own palette (DESIGN: "Each scene adds a small palette of its own"). A clockwork
// railway at dawn: a pale gold sky over a rose horizon, cool steel and brass on the machines, olive
// and sand on the land. The dark theme is the same line before sunrise, the first light at the rim.

import type { ScenePalette, ThemeName } from '../../engine';

type Sky = Omit<ScenePalette, 'fade' | 'ink'>;

export const SKY: Readonly<Record<ThemeName, Sky>> = {
  light: {
    skyTop: 0x7fa4d8,
    skyHorizon: 0xf6c8a0,
    sun: 0xffd9a0,
    sunIntensity: 3.4,
    sunFrom: [0.9, 0.35, -0.6],
    fillSky: 0xcfe0f4,
    fillGround: 0xb59a78,
    fillIntensity: 2.2,
    fog: 0xf0cdb4,
    fogDensity: 0.011,
    fogBase: -1,
    fogFalloff: 0.05,
    inscatter: 0.9,
  },
  dark: {
    skyTop: 0x141a40,
    skyHorizon: 0xc8707a,
    sun: 0xffb27a,
    sunIntensity: 2.2,
    sunFrom: [0.9, 0.25, -0.6],
    fillSky: 0x7088c8,
    fillGround: 0x4a3c3c,
    fillIntensity: 1.9,
    fog: 0x4a3a54,
    fogDensity: 0.015,
    fogBase: -1,
    fogFalloff: 0.05,
    inscatter: 1,
  },
};

/** Colors of the things on the line. */
export const TINT = {
  // Land.
  grassA: 0x9aa65a,
  grassB: 0xc2b270,
  sand: 0xd8c08e,
  ballast: 0x8a7e72,
  hillA: 0xa89a62,
  hillB: 0x7f8a4c,
  rock: 0x9a8670,
  olive: 0x5f7040,
  trunk: 0x5a4430,
  // Rails and sleepers.
  rail: 0x9aa4b0,
  sleeper: 0x5e4632,
  // The machines.
  steel: 0x6c7886,
  steelDark: 0x3a4452,
  brass: 0xd7a84a,
  coal: 0x2a2630,
  red: 0xb8483c,
  // Naftali's train: rose and cream.
  rival: 0xc4647a,
  rivalDark: 0x7a3448,
  cream: 0xf2e4c8,
  // Light and effects.
  lamp: 0xffd36a,
  lampOff: 0x66707e,
  steam: 0xf4ece0,
  spark: 0xffd27a,
  boost: 0xfff0b8,
  wire: 0x2a2630,
  // People.
  skin: 0xe3b48c,
  ink: 0x14100c,
  naftaliRobe: 0x8a3a52,
  naftaliHem: 0x4e2030,
  naftaliTrim: 0xf2e4c8,
  naftaliBeard: 0x2a1e18,
  ezraRobe: 0x2e2a3a,
  ezraHem: 0x1a1724,
  ezraTrim: 0x24202c,
  ezraBeard: 0xeeeae2,
  dyo: 0x18204a,
  dyoShine: 0x3a5cc0,
  dyoEye: 0xfdf8ec,
} as const;
