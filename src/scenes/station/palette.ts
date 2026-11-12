// The Star Station's own palette (DESIGN: "Each scene adds a small palette of its own"). Two skies:
// the dimmed one (a flat grey-violet haze where the Fading has put the stars out, a weak cold sun)
// and the clear one after it (deep space blue going to a teal-and-violet nebula at the horizon,
// a bright white sun). The scene blends from the first to the second as the stars come back. The
// light theme is the same place a little brighter, so the station reads well on a light screen.

import type { ScenePalette, ThemeName } from '../../engine';

type Sky = Omit<ScenePalette, 'fade' | 'ink'>;

export const DIM: Readonly<Record<ThemeName, Sky>> = {
  light: {
    skyTop: 0x2a2c3a,
    skyHorizon: 0x5c5a6c,
    sun: 0xd8dce8,
    sunIntensity: 2.2,
    sunFrom: [0.55, 0.5, 0.65],
    fillSky: 0x7a7e98,
    fillGround: 0x3a3a48,
    fillIntensity: 1.9,
    fog: 0x4a4a5c,
    fogDensity: 0.0035,
    fogBase: -200,
    fogFalloff: 0.001,
    inscatter: 0.3,
  },
  dark: {
    skyTop: 0x0c0e18,
    skyHorizon: 0x2a2a3c,
    sun: 0xc8cee0,
    sunIntensity: 2,
    sunFrom: [0.55, 0.5, 0.65],
    fillSky: 0x5a6080,
    fillGround: 0x24242e,
    fillIntensity: 2,
    fog: 0x22222e,
    fogDensity: 0.0035,
    fogBase: -200,
    fogFalloff: 0.001,
    inscatter: 0.25,
  },
};

export const CLEAR: Readonly<Record<ThemeName, Sky>> = {
  light: {
    skyTop: 0x0e1640,
    skyHorizon: 0x3a5aa0,
    sun: 0xfff4e0,
    sunIntensity: 3.4,
    sunFrom: [0.55, 0.45, 0.7],
    fillSky: 0x7a9ae0,
    fillGround: 0x3a3060,
    fillIntensity: 2.2,
    fog: 0x283a78,
    fogDensity: 0.0016,
    fogBase: -200,
    fogFalloff: 0.001,
    inscatter: 0.7,
  },
  dark: {
    skyTop: 0x04061a,
    skyHorizon: 0x1c2a64,
    sun: 0xfff0dc,
    sunIntensity: 3.2,
    sunFrom: [0.55, 0.45, 0.7],
    fillSky: 0x6080d0,
    fillGround: 0x2a2048,
    fillIntensity: 2.3,
    fog: 0x141c48,
    fogDensity: 0.0016,
    fogBase: -200,
    fogFalloff: 0.001,
    inscatter: 0.6,
  },
};

/** Colors of the things in the station. */
export const TINT = {
  // The station: white hull plates, brass ribs, blue solar cells with gold frames.
  hull: 0xe8eaf0,
  hullShade: 0xb8bcc8,
  rib: 0xc8a050,
  ribDark: 0x8a6a30,
  panel: 0x1c3a8a,
  panelLine: 0x4a7ae0,
  panelFrame: 0xd8b060,
  truss: 0x9aa0b0,
  dish: 0xf0f0f4,
  window: 0xffd890,
  beacon: 0xff5a4a,
  beaconGreen: 0x5aff9a,
  dome: 0xd0d8e8,
  domeInside: 0x2a3050,
  scope: 0xc89040,
  scopeDark: 0x5a4020,
  // The planet below: the land, its seas and its clouds.
  sea: 0x2a6ac0,
  seaDeep: 0x1a4a90,
  land: 0x5a9a4a,
  landDry: 0xb8a070,
  cloud: 0xf4f8ff,
  rim: 0x6ab0ff,
  // The sky.
  star: 0xffffff,
  starBlue: 0xb8d0ff,
  starGold: 0xffe0a0,
  starDim: 0x8a8a9a,
  nebulaA: 0x3a6ad0,
  nebulaB: 0x8a4ac0,
  nebulaC: 0x2aa0a0,
  sunGlow: 0xfff0d0,
  line: 0xffe6b0,
  // The debris: grey rock crusted with ink, torn metal.
  rock: 0x6a6670,
  rockDark: 0x3a3840,
  scrap: 0x8a8c94,
  // The apprentice's thruster pack and his flame.
  pack: 0xd8dce4,
  packTrim: 0xc8a050,
  flame: 0x7ac8ff,
  flameCore: 0xe8f6ff,
  helmet: 0xc8e4ff,
  beam: 0x8ae0ff,
  gold: 0xffd27a,
  goldDust: 0xffe6a0,
  spark: 0xe8f4ff,
  // People and Dyo.
  skin: 0xe0b48c,
  ink: 0x14100c,
  dyo: 0x18204a,
  dyoShine: 0x3a5cc0,
  dyoEye: 0xfdf8ec,
} as const;
