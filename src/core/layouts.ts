// Keyboard layouts (standard Israeli Hebrew + US QWERTY), keyed by KeyboardEvent.code.
// Pure logic: no DOM. Ported in behaviour from reference/plugin-4.2.0/js/constants.js.

export type LayoutId = 'he' | 'en';
export type Finger = 'lp' | 'lr' | 'lm' | 'li' | 'ri' | 'rm' | 'rr' | 'rp' | 'th';
export type Hand = 'left' | 'right' | 'both';
export type KeyRow = 'number' | 'top' | 'home' | 'bottom' | 'space';

export interface KeyInfo {
  code: string;
  finger: Finger;
  hand: Hand;
  row: KeyRow;
  home: boolean;
}

export interface KeyRef {
  code: string;
  shift: boolean;
}

export const HAND_OF_FINGER: Record<Finger, Hand> = {
  lp: 'left',
  lr: 'left',
  lm: 'left',
  li: 'left',
  ri: 'right',
  rm: 'right',
  rr: 'right',
  rp: 'right',
  th: 'both',
};

const ROWS: Record<Exclude<KeyRow, 'space'>, string[]> = {
  number: [
    'Backquote',
    'Digit1',
    'Digit2',
    'Digit3',
    'Digit4',
    'Digit5',
    'Digit6',
    'Digit7',
    'Digit8',
    'Digit9',
    'Digit0',
    'Minus',
    'Equal',
  ],
  top: [
    'KeyQ',
    'KeyW',
    'KeyE',
    'KeyR',
    'KeyT',
    'KeyY',
    'KeyU',
    'KeyI',
    'KeyO',
    'KeyP',
    'BracketLeft',
    'BracketRight',
    'Backslash',
  ],
  home: [
    'KeyA',
    'KeyS',
    'KeyD',
    'KeyF',
    'KeyG',
    'KeyH',
    'KeyJ',
    'KeyK',
    'KeyL',
    'Semicolon',
    'Quote',
  ],
  bottom: [
    'ShiftLeft',
    'KeyZ',
    'KeyX',
    'KeyC',
    'KeyV',
    'KeyB',
    'KeyN',
    'KeyM',
    'Comma',
    'Period',
    'Slash',
    'ShiftRight',
  ],
};

/** Physical key -> finger (same for both layouts). */
const FINGER_OF_KEY: Record<string, Finger> = {
  Backquote: 'lp',
  Digit1: 'lp',
  Digit2: 'lr',
  Digit3: 'lm',
  Digit4: 'li',
  Digit5: 'li',
  Digit6: 'ri',
  Digit7: 'ri',
  Digit8: 'rm',
  Digit9: 'rr',
  Digit0: 'rp',
  Minus: 'rp',
  Equal: 'rp',
  KeyQ: 'lp',
  KeyW: 'lr',
  KeyE: 'lm',
  KeyR: 'li',
  KeyT: 'li',
  KeyY: 'ri',
  KeyU: 'ri',
  KeyI: 'rm',
  KeyO: 'rr',
  KeyP: 'rp',
  BracketLeft: 'rp',
  BracketRight: 'rp',
  Backslash: 'rp',
  KeyA: 'lp',
  KeyS: 'lr',
  KeyD: 'lm',
  KeyF: 'li',
  KeyG: 'li',
  KeyH: 'ri',
  KeyJ: 'ri',
  KeyK: 'rm',
  KeyL: 'rr',
  Semicolon: 'rp',
  Quote: 'rp',
  ShiftLeft: 'lp',
  KeyZ: 'lp',
  KeyX: 'lr',
  KeyC: 'lm',
  KeyV: 'li',
  KeyB: 'li',
  KeyN: 'ri',
  KeyM: 'ri',
  Comma: 'rm',
  Period: 'rr',
  Slash: 'rp',
  ShiftRight: 'rp',
  Space: 'th',
};

export const HOME_ROW_KEYS: readonly string[] = [
  'KeyA',
  'KeyS',
  'KeyD',
  'KeyF',
  'KeyJ',
  'KeyK',
  'KeyL',
  'Semicolon',
];

export const KEYS: Readonly<Record<string, KeyInfo>> = (() => {
  const out: Record<string, KeyInfo> = {};
  for (const [row, codes] of Object.entries(ROWS)) {
    for (const code of codes) {
      const finger = FINGER_OF_KEY[code] ?? 'th';
      out[code] = {
        code,
        finger,
        hand: HAND_OF_FINGER[finger],
        row: row as KeyRow,
        home: HOME_ROW_KEYS.includes(code),
      };
    }
  }
  out['Space'] = { code: 'Space', finger: 'th', hand: 'both', row: 'space', home: false };
  return out;
})();

/** Rows in display order, for the on-screen keyboard. */
export const KEYBOARD_ROWS: readonly (readonly string[])[] = [
  ROWS.number,
  ROWS.top,
  ROWS.home,
  ROWS.bottom,
  ['Space'],
];

// --- Character layers -------------------------------------------------------------------

const LATIN_UPPER: Record<string, string> = Object.fromEntries(
  'QWERTYUIOPASDFGHJKLZXCVBNM'.split('').map((c) => [`Key${c}`, c]),
);
const LATIN_LOWER: Record<string, string> = Object.fromEntries(
  'qwertyuiopasdfghjklzxcvbnm'.split('').map((c) => [`Key${c.toUpperCase()}`, c]),
);
const DIGITS: Record<string, string> = Object.fromEntries(
  '1234567890'.split('').map((c) => [`Digit${c}`, c]),
);

/** Standard Israeli Hebrew layout, unshifted. Brackets are mirrored on this layout. */
const HE_BASE: Record<string, string> = {
  KeyQ: '/',
  KeyW: "'",
  KeyE: 'ק',
  KeyR: 'ר',
  KeyT: 'א',
  KeyY: 'ט',
  KeyU: 'ו',
  KeyI: 'ן',
  KeyO: 'ם',
  KeyP: 'פ',
  KeyA: 'ש',
  KeyS: 'ד',
  KeyD: 'ג',
  KeyF: 'כ',
  KeyG: 'ע',
  KeyH: 'י',
  KeyJ: 'ח',
  KeyK: 'ל',
  KeyL: 'ך',
  Semicolon: 'ף',
  KeyZ: 'ז',
  KeyX: 'ס',
  KeyC: 'ב',
  KeyV: 'ה',
  KeyB: 'נ',
  KeyN: 'מ',
  KeyM: 'צ',
  Comma: 'ת',
  Period: 'ץ',
  Slash: '.',
  Quote: ',',
  Backquote: ';',
  ...DIGITS,
  Minus: '-',
  Equal: '=',
  BracketLeft: ']',
  BracketRight: '[',
  Backslash: '\\',
  Space: ' ',
};

/** Shift layer on the Hebrew layout: Latin capitals and symbols (< > swapped vs QWERTY). */
const HE_SHIFT: Record<string, string> = {
  ...LATIN_UPPER,
  Backquote: '~',
  Digit1: '!',
  Digit2: '@',
  Digit3: '#',
  Digit4: '$',
  Digit5: '%',
  Digit6: '^',
  Digit7: '&',
  Digit8: '*',
  Digit9: '(',
  Digit0: ')',
  Minus: '_',
  Equal: '+',
  Semicolon: ':',
  Quote: '"',
  Comma: '>',
  Period: '<',
  Slash: '?',
  BracketLeft: '}',
  BracketRight: '{',
  Backslash: '|',
};

const EN_BASE: Record<string, string> = {
  ...LATIN_LOWER,
  ...DIGITS,
  Semicolon: ';',
  Comma: ',',
  Period: '.',
  Slash: '/',
  Quote: "'",
  Backquote: '`',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Space: ' ',
};

const EN_SHIFT: Record<string, string> = {
  ...HE_SHIFT,
  Comma: '<',
  Period: '>',
  BracketLeft: '{',
  BracketRight: '}',
};

export interface Layout {
  id: LayoutId;
  base: Readonly<Record<string, string>>;
  shift: Readonly<Record<string, string>>;
}

export const LAYOUTS: Readonly<Record<LayoutId, Layout>> = {
  he: { id: 'he', base: HE_BASE, shift: HE_SHIFT },
  en: { id: 'en', base: EN_BASE, shift: EN_SHIFT },
};

function invert(map: Readonly<Record<string, string>>): Map<string, string> {
  const out = new Map<string, string>();
  for (const [code, ch] of Object.entries(map)) if (!out.has(ch)) out.set(ch, code);
  return out;
}
const INV: Record<LayoutId, { base: Map<string, string>; shift: Map<string, string> }> = {
  he: { base: invert(HE_BASE), shift: invert(HE_SHIFT) },
  en: { base: invert(EN_BASE), shift: invert(EN_SHIFT) },
};

/** Character produced by a physical key on a layout, or undefined if the key has none. */
export function charForKey(layout: LayoutId, code: string, shift: boolean): string | undefined {
  const l = LAYOUTS[layout];
  return shift ? l.shift[code] : l.base[code];
}

/**
 * Which physical key (and Shift?) produces `ch`. The active layout is searched first, then the
 * other one, so an English word inside a Hebrew line still resolves.
 */
export function keyForChar(ch: string, layout: LayoutId): KeyRef | null {
  if (ch === ' ') return { code: 'Space', shift: false };
  const other: LayoutId = layout === 'he' ? 'en' : 'he';
  for (const id of [layout, other]) {
    const b = INV[id].base.get(ch);
    if (b) return { code: b, shift: false };
    const s = INV[id].shift.get(ch);
    if (s) return { code: s, shift: true };
  }
  return null;
}

/** The Shift key to use for a key: the one on the opposite hand. */
export function shiftKeyFor(code: string): 'ShiftLeft' | 'ShiftRight' {
  const k = KEYS[code];
  return k && k.hand === 'left' ? 'ShiftRight' : 'ShiftLeft';
}

export function fingerForChar(ch: string, layout: LayoutId): Finger | null {
  const ref = keyForChar(ch, layout);
  return ref ? (KEYS[ref.code]?.finger ?? null) : null;
}

// --- Hebrew helpers ---------------------------------------------------------------------

export const NIQQUD_MARKS: readonly string[] = [
  'ְ',
  'ֱ',
  'ֲ',
  'ֳ',
  'ִ',
  'ֵ',
  'ֶ',
  'ַ',
  'ָ',
  'ֹ',
  'ֻ',
  'ּ',
  'ׁ',
  'ׂ',
];

export const FINAL_LETTERS: Readonly<Record<string, string>> = {
  ך: 'כ',
  ם: 'מ',
  ן: 'נ',
  ף: 'פ',
  ץ: 'צ',
};

const MARK_RE = /[֑-ׇ]/;
const MARK_RE_G = /[֑-ׇ]/g;

export function isMark(ch: string): boolean {
  return ch.length === 1 && MARK_RE.test(ch);
}

export function stripNiqqud(s: string): string {
  return s.replace(MARK_RE_G, '');
}

/** Split into letters, keeping a base letter together with its attached niqqud marks. */
export function toGraphemes(s: string): string[] {
  const out: string[] = [];
  for (const ch of s) {
    if (MARK_RE.test(ch) && out.length > 0) out[out.length - 1] += ch;
    else out.push(ch);
  }
  return out;
}

/** True for a character the learner can type on at least one of the two layouts. */
export function isTypeable(ch: string): boolean {
  return keyForChar(ch, 'he') !== null;
}

/**
 * Turns pasted or generated text into something that can physically be typed: line breaks to
 * spaces, typographic quotes and dashes to ASCII, cantillation and invisible marks removed,
 * and characters with no key dropped. Niqqud is kept only when asked.
 */
export function normalizePracticeText(text: string, keepNiqqud = false): string {
  let t = text.normalize('NFKD');
  t = t
    .replace(/\r\n?/g, '\n')
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff\u200b-\u200d]/g, '')
    .replace(/[\n\t\u00a0\u2000-\u200a\u3000]+/g, ' ')
    .replace(/[\u05f4\u201c\u201d\u201e\u00ab\u00bb]/g, '"')
    .replace(/[\u05f3\u2018\u2019\u201a\u00b4]/g, "'")
    .replace(/[\u2013\u2014\u2010\u2011\u05be\u2212]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u05c3/g, ':')
    .replace(/[\u05c0\u05c6]/g, '')
    .replace(/[\u0591-\u05af\u05bd\u05bf\u05c4\u05c5\u05c7]/g, '');
  if (!keepNiqqud) t = t.replace(/[ְ-ּׁׂ]/g, '');
  t = t.normalize('NFC');
  const kept = toGraphemes(t).filter((g) => {
    const base = stripNiqqud(g);
    return base.length === 1 && isTypeable(base);
  });
  return kept.join('').replace(/ {2,}/g, ' ').trim();
}
