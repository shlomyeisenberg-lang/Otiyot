// The Blank Scroll's own palette (DESIGN: "Each scene adds a small palette of its own"). The
// scroll is white because nothing is written on it yet: a pale sky with no sun to speak of. Each
// column of the crossing lets a little of its regions' light back in, the Keeper's archive is
// grey and still, and the ending is a gold morning. The night-ink theme is the same scroll by
// lamplight (the same skies, dimmed toward ink).

import type { ScenePalette, ThemeName } from '../../engine';

export type Sky = Omit<ScenePalette, 'fade' | 'ink'>;

/** One light per phase (c1..c5, k1..k4), then the restored scroll. */
export const SCROLL_LIGHTS = [
  'c1',
  'c2',
  'c3',
  'c4',
  'c5',
  'k1',
  'k2',
  'k3',
  'k4',
  'restored',
] as const;
export type ScrollLight = (typeof SCROLL_LIGHTS)[number];

function sky(
  skyTop: number,
  skyHorizon: number,
  sun: number,
  sunIntensity: number,
  sunFrom: [number, number, number],
  fillSky: number,
  fillGround: number,
  fog: number,
  fogDensity: number,
  inscatter = 0.45,
): Sky {
  return {
    skyTop,
    skyHorizon,
    sun,
    sunIntensity,
    sunFrom,
    fillSky,
    fillGround,
    fillIntensity: 1.85,
    fog,
    fogDensity,
    fogBase: -2,
    fogFalloff: 0.07,
    inscatter,
  };
}

const DAY: Readonly<Record<ScrollLight, Sky>> = {
  // The Garden: the white of an empty page, a soft morning sun.
  c1: sky(0xe9e7e2, 0xfbfaf6, 0xfff8ea, 2.2, [0.4, 0.8, 0.4], 0xf2f0ec, 0xbdb6a8, 0xf2f0ea, 0.0105),
  // The Workshop: the forge's warmth creeps in.
  c2: sky(
    0xe6dfd2,
    0xfaf3e6,
    0xffe9c4,
    2.2,
    [-0.4, 0.7, 0.45],
    0xf0e8da,
    0xb8a890,
    0xefe6d6,
    0.011,
  ),
  // The Race: a high clear dawn.
  c3: sky(
    0xcfdcec,
    0xf4f1ea,
    0xfff0d8,
    2.3,
    [0.55, 0.55, 0.3],
    0xdde6f0,
    0xa9a69c,
    0xe4e8ec,
    0.011,
  ),
  // The Deep: sea-green and starlight.
  c4: sky(
    0x7f97a8,
    0xcfdcdc,
    0xdcefee,
    2,
    [0.2, 0.6, 0.55],
    0xa9c2c8,
    0x5f6f74,
    0xa6babd,
    0.0135,
    0.6,
  ),
  // The Dark: dusk; the lantern is the scribe's clean hand.
  c5: sky(
    0x3c3e58,
    0x8f8aa0,
    0xcfc8e8,
    1.7,
    [-0.3, 0.45, 0.6],
    0x7c7c9c,
    0x3c3a4a,
    0x66647c,
    0.016,
    0.7,
  ),
  // The Empty Shelves: grey and still.
  k1: sky(0xc9c8cc, 0xecebe8, 0xf4f2ee, 2, [0.3, 0.75, 0.5], 0xdcdcde, 0x9c9a98, 0xdddcda, 0.012),
  // The Scorched Pages: the memory of the fire.
  k2: sky(
    0x8e7466,
    0xe2c8a8,
    0xffd9a0,
    2.1,
    [-0.5, 0.45, 0.4],
    0xcfb49a,
    0x6c5448,
    0xc4a88c,
    0.0135,
    0.6,
  ),
  // The Long Silence: deep blue, nothing moves.
  k3: sky(
    0x39486a,
    0x93a3bc,
    0xcfdcf2,
    1.9,
    [0.15, 0.5, 0.6],
    0x7f90ae,
    0x3a4050,
    0x6c7c96,
    0.015,
    0.7,
  ),
  // The Lost Words: night, and the great page glows.
  k4: sky(
    0x1c2034,
    0x5a5c78,
    0xe8dcc0,
    1.8,
    [0, 0.6, 0.75],
    0x6a7096,
    0x403e54,
    0x3c4058,
    0.0165,
    0.8,
  ),
  // Written: a gold morning over the whole scroll.
  restored: sky(
    0x5f9fe0,
    0xfbe6bc,
    0xfff0c8,
    2.5,
    [0.35, 0.5, -0.55],
    0xbfd8f4,
    0xb89a6a,
    0xf0dcb8,
    0.0085,
    0.95,
  ),
};

function mix(a: number, b: number, t: number): number {
  const ch = (s: number): number =>
    Math.round(((a >> s) & 255) + (((b >> s) & 255) - ((a >> s) & 255)) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

const INK = 0x10121e;

/** The same sky by lamplight. */
function night(s: Sky, k: number): Sky {
  return {
    ...s,
    skyTop: mix(s.skyTop, INK, k),
    skyHorizon: mix(s.skyHorizon, INK, k * 0.8),
    fillSky: mix(s.fillSky, INK, k * 0.55),
    fillGround: mix(s.fillGround, INK, k * 0.5),
    fog: mix(s.fog, INK, k * 0.8),
    sunIntensity: s.sunIntensity * 0.9,
  };
}

const NIGHT = Object.fromEntries(
  // Skies that are already dark (the Long Silence, the Lost Words) take less ink, or the night
  // theme turns the archive into black shapes.
  SCROLL_LIGHTS.map((id) => [
    id,
    night(DAY[id], id === 'restored' ? 0.35 : id === 'k4' ? 0.2 : id === 'k3' ? 0.4 : 0.6),
  ]),
) as Record<ScrollLight, Sky>;

export function scrollLights(theme: ThemeName): Readonly<Record<ScrollLight, Sky>> {
  return theme === 'light' ? DAY : NIGHT;
}

export const TINT = {
  // The scroll and its rollers.
  parchment: 0xf3e6c4,
  parchmentShade: 0xe2d0a4,
  rule: 0xc9b282,
  blank: 0xf3f1ec,
  wood: 0x7a5232,
  woodDark: 0x4e3320,
  woodLight: 0xa67848,
  brass: 0xd9b25a,
  // The white that erases: pale, with a cold core.
  white: 0xeef2ff,
  whiteCore: 0x8c94b4,
  // The archive.
  shelf: 0x5c4630,
  shelfDark: 0x3c2c1e,
  page: 0xf8f2e2,
  dais: 0xcfc6b4,
  // People.
  skin: 0xe3b48c,
  ink: 0x14100c,
  ezraRobe: 0x2e2a3a,
  ezraHem: 0x1a1724,
  ezraTrim: 0x24202c,
  ezraBeard: 0xeeeae2,
  naftaliRobe: 0x8a3a52,
  naftaliHem: 0x4e2030,
  naftaliTrim: 0xf2e4c8,
  naftaliBeard: 0x2a1e18,
  keeperRobe: 0x8f8d9a,
  keeperHem: 0x5c5a68,
  keeperTrim: 0xdad6ca,
  keeperBeard: 0xf4f1ea,
  dyo: 0x18204a,
  dyoShine: 0x3a5cc0,
  dyoEye: 0xfdf8ec,
} as const;

/** Book spines for the shelves that fill at the ending. */
export const BOOKS: readonly number[] = [
  0x8a3a2e, 0x2e5a8a, 0x3e6e4a, 0xb08a3a, 0x5a3e7a, 0x9a5a2e, 0x2e6a70, 0x7a2e44,
];
