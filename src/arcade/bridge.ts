// The arcade bridge (T29), pure logic. The earlier plugin's games run in an iframe
// (public/arcade/arcade.html). This module builds what the page is told when it starts (the
// layout, the language, the colours, the letters the player has learned, his weak keys and the
// words and sentences the games may use) and checks every message the page sends back.
// ARCHITECTURE section 6. Learned letters only (section 8): the games never see a word that
// uses a letter the player has not learned.

import type { LayoutId } from '../core';
import { eligibleWords } from '../learn';

export const ARCADE_GAMES = ['galaxy', 'sefarim', 'race', 'arena', 'tower'] as const;
export type ArcadeGameId = (typeof ARCADE_GAMES)[number];

export function isArcadeGame(id: string): id is ArcadeGameId {
  return (ARCADE_GAMES as readonly string[]).includes(id);
}

export interface ArcadeTheme {
  dark: boolean;
  page: string;
  ink: string;
  gold: string;
  line: string;
  onGold: string;
}

export interface ArcadeBlob {
  games3d: Record<string, unknown>;
  games: Record<string, unknown>;
}

export interface ArcadeWords {
  short: string[];
  medium: string[];
  long: string[];
  advanced: string[];
}

export interface ArcadeInit {
  layout: LayoutId;
  uiLang: LayoutId;
  theme: ArcadeTheme;
  /** Letters (and only letters) the player has learned. */
  letters: string[];
  /** Weakest learned letters first. */
  weak: string[];
  words: ArcadeWords;
  sentences: string[];
  paragraphs: string[];
  blob: ArcadeBlob;
  game: ArcadeGameId;
}

export interface InitInput {
  layout: LayoutId;
  uiLang: LayoutId;
  theme: ArcadeTheme;
  known: ReadonlySet<string>;
  weak: readonly string[];
  blob: unknown;
  game: ArcadeGameId;
  rng?: () => number;
}

const LETTER = /^\p{L}$/u;

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(list: readonly T[], rng: () => number): T {
  return list[Math.floor(rng() * list.length)] as T;
}

/** Made-up letter groups for a player who has few letters: never a word he cannot type. */
export function clusters(letters: readonly string[], count: number, rng: () => number): string[] {
  const out: string[] = [];
  if (letters.length === 0) return out;
  for (let i = 0; i < count; i++) {
    const n = 2 + Math.floor(rng() * 3);
    let s = '';
    for (let j = 0; j < n; j++) s += pick(letters, rng);
    out.push(s);
  }
  return out;
}

/** Splits the allowed words into the four length classes the games ask for. */
export function bankFrom(
  pool: readonly string[],
  letters: readonly string[],
  rng: () => number,
): ArcadeWords {
  const words = [...new Set(pool)];
  const len = (w: string): number => [...w].length;
  const bank: ArcadeWords = {
    short: words.filter((w) => len(w) <= 3),
    medium: words.filter((w) => len(w) >= 4 && len(w) <= 5),
    long: words.filter((w) => len(w) >= 6 && len(w) <= 7),
    advanced: words.filter((w) => len(w) >= 8),
  };
  // Never empty (a game that picks from an empty bank would break): fall back on what exists.
  const any = words.length > 0 ? words : clusters(letters, 12, rng);
  for (const k of ['short', 'medium', 'long', 'advanced'] as const) {
    if (bank[k].length < 3) bank[k] = bank[k].concat(any.slice(0, 12));
    if (bank[k].length === 0) bank[k] = clusters(letters, 6, rng);
  }
  return bank;
}

/** Sentences are strings of allowed words: a "sentence" of 3 to 6 words, a paragraph of 12 to 18. */
export function joinWords(
  words: readonly string[],
  count: number,
  min: number,
  max: number,
  rng: () => number,
): string[] {
  const out: string[] = [];
  if (words.length === 0) return out;
  for (let i = 0; i < count; i++) {
    const n = min + Math.floor(rng() * (max - min + 1));
    const parts: string[] = [];
    for (let j = 0; j < n; j++) parts.push(pick(words, rng));
    out.push(parts.join(' '));
  }
  return out;
}

export function emptyBlob(): ArcadeBlob {
  return { games3d: {}, games: {} };
}

/** Reads the saved blob back safely: anything that is not the expected shape starts fresh. */
export function readBlob(raw: unknown): ArcadeBlob {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return emptyBlob();
  const o = raw as Record<string, unknown>;
  const obj = (v: unknown): Record<string, unknown> =>
    v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  return { games3d: obj(o.games3d), games: obj(o.games) };
}

export function buildInit(i: InitInput): ArcadeInit {
  const rng = i.rng ?? mulberry(Date.now() % 2147483647);
  const letters = [...i.known].filter((c) => LETTER.test(c));
  const pool = eligibleWords({
    language: i.layout,
    allowedChars: i.known,
    minLength: 2,
    maxLength: 12,
  });
  const words = bankFrom(pool, letters, rng);
  const all = [...words.short, ...words.medium, ...words.long, ...words.advanced];
  return {
    layout: i.layout,
    uiLang: i.uiLang,
    theme: i.theme,
    letters,
    weak: i.weak.filter((c) => LETTER.test(c) && i.known.has(c)),
    words,
    sentences: joinWords(all, 60, 3, 6, rng),
    paragraphs: joinWords(all, 24, 12, 18, rng),
    blob: readBlob(i.blob),
    game: i.game,
  };
}

export type ArcadeMessage =
  { type: 'otiyot:ready' } | { type: 'otiyot:save'; blob: ArcadeBlob } | { type: 'otiyot:exit' };

/** Checks a message from the page. Anything unexpected is ignored (returns null). */
export function parseMessage(data: unknown): ArcadeMessage | null {
  if (data === null || typeof data !== 'object') return null;
  const o = data as Record<string, unknown>;
  if (o.type === 'otiyot:ready') return { type: 'otiyot:ready' };
  if (o.type === 'otiyot:exit') return { type: 'otiyot:exit' };
  if (o.type === 'otiyot:save') {
    const blob = readBlob(o.blob);
    // The blob is statistics and scores only. A very large one is refused.
    if (JSON.stringify(blob).length > 200_000) return null;
    return { type: 'otiyot:save', blob };
  }
  return null;
}
