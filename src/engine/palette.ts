// The UI color tokens, mirrored for 3D (DESIGN: "Tokens live in src/ui/tokens.css and are mirrored
// for 3D in src/engine/palette.ts"). Pure data: no DOM, no Three.js. tests/unit/ui-tokens.test.ts
// fails if this file and tokens.css ever disagree, so change both together.

export type ThemeName = 'light' | 'dark';

export const COLOR_TOKENS = [
  'bg',
  'surface',
  'surface-2',
  'ink',
  'ink-soft',
  'line',
  'gold',
  'techelet',
  'ok-fg',
  'ok-bg',
  'warn-fg',
  'warn-bg',
  'err-fg',
  'err-bg',
  'fade',
  'finger-pinky',
  'finger-ring',
  'finger-middle',
  'finger-index',
  'finger-thumb',
] as const;

export type ColorToken = (typeof COLOR_TOKENS)[number];
export type Palette = Readonly<Record<ColorToken, string>>;

export const PALETTE: Readonly<Record<ThemeName, Palette>> = {
  light: {
    bg: '#f4ebd8',
    surface: '#fbf5e6',
    'surface-2': '#eadfc6',
    ink: '#1f1a14',
    'ink-soft': '#5e5546',
    line: '#d2c4a4',
    gold: '#b8862b',
    techelet: '#1f5fa8',
    'ok-fg': '#2f6b3a',
    'ok-bg': '#dcebd6',
    'warn-fg': '#8a5a12',
    'warn-bg': '#f3e3bf',
    'err-fg': '#9b2f24',
    'err-bg': '#f2d9d3',
    fade: '#b9b4a8',
    'finger-pinky': '#7a4e9a',
    'finger-ring': '#2e7d7a',
    'finger-middle': '#b0652a',
    'finger-index': '#4f7a2e',
    'finger-thumb': '#6b6253',
  },
  dark: {
    bg: '#14110d',
    surface: '#1e1a14',
    'surface-2': '#2a241b',
    ink: '#f1e7d2',
    'ink-soft': '#b3a68d',
    line: '#3a3226',
    gold: '#e0b354',
    techelet: '#5fa4e8',
    'ok-fg': '#8fd09a',
    'ok-bg': '#1b2e1f',
    'warn-fg': '#e6be72',
    'warn-bg': '#33270f',
    'err-fg': '#f08f82',
    'err-bg': '#3a1814',
    fade: '#56524a',
    'finger-pinky': '#b793d6',
    'finger-ring': '#6cc4be',
    'finger-middle': '#e59a5c',
    'finger-index': '#9cc870',
    'finger-thumb': '#a99c84',
  },
};

/** Colorblind palettes swap correct / wrong for blue / orange. */
export const COLORBLIND: Readonly<Record<ThemeName, Partial<Palette>>> = {
  light: { 'ok-fg': '#1f5fa8', 'ok-bg': '#d9e6f5', 'err-fg': '#a8480a', 'err-bg': '#f7e0cc' },
  dark: { 'ok-fg': '#5fa4e8', 'ok-bg': '#152538', 'err-fg': '#f0a050', 'err-bg': '#3a2410' },
};

/** A token as a 0xRRGGBB number, the form Three.js colors take. */
export function colorNumber(theme: ThemeName, token: ColorToken, colorblind = false): number {
  const hex = (colorblind ? COLORBLIND[theme][token] : undefined) ?? PALETTE[theme][token];
  return Number.parseInt(hex.slice(1), 16);
}
