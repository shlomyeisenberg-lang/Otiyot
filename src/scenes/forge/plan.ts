// The Gematria Forge's run, as plain data (no 3D here; unit-tested). Every blank on the smith's
// rack is a letter to forge, and every letter is forged by typing its number (its gematria value:
// alef is 1, bet 2, yod 10, kuf 100 ...; in English a is 1, j is 10, s is 100). The furnace has a
// temperature: every right key stokes it, the quiet between keys cools it, a slip makes it flare.
// A letter forged while the fire sits in the safe band comes out bright gold; too cold or too hot
// it comes out dull or scorched, and is still a letter, so the run can never be lost.
//
// Every number is spelled only with digits the player has already learned (ARCHITECTURE section
// 8). The Forge opens on the map only after the whole number row is learned, but the plan still
// checks its keys, so a profile that knows fewer digits simply gets shorter numbers.

import type { LayoutId } from '../../core/layouts';
import type { LevelId } from '../../game/levels';

export const CHAPTER_IDS = ['stoke', 'forge', 'quench'] as const;
export type ChapterId = (typeof CHAPTER_IDS)[number];

export interface Chapter {
  id: ChapterId;
  /** Index of its first number, and one past its last. */
  from: number;
  to: number;
}

/** How a letter came out of the fire. */
export type Temper = 'cold' | 'good' | 'hot';

/** Lamps along the rack that light as the run goes on (and sections of the run). */
export const SECTIONS = 4;

/** Letters to forge per level (always a multiple of SECTIONS). */
export const LETTERS_PER_LEVEL: Readonly<Record<LevelId, number>> = {
  easy: 8,
  standard: 12,
  hard: 16,
};

export const HEBREW_ALPHABET = 'אבגדהוזחטיכלמנסעפצקרשת';
export const LATIN_ALPHABET = 'abcdefghijklmnopqrstuvwxyz';

/** The gematria value of the nth letter of an alphabet: 1-9, then 10-90, then 100 and up. */
export function valueAt(index: number): number {
  if (index < 9) return index + 1;
  if (index < 18) return (index - 8) * 10;
  return (index - 17) * 100;
}

export interface ForgeLetter {
  /** The letter on the rack. */
  glyph: string;
  /** Its value, as the player types it. */
  value: number;
}

/** The letters of an alphabet with their values. */
export function alphabetOf(layout: LayoutId): ForgeLetter[] {
  const abc = layout === 'he' ? HEBREW_ALPHABET : LATIN_ALPHABET;
  return [...abc].map((glyph, i) => ({ glyph, value: valueAt(i) }));
}

/** How many digits of a value each level allows at most (easy stays short). */
export const MAX_DIGITS: Readonly<Record<LevelId, number>> = { easy: 2, standard: 3, hard: 3 };

/** Hard asks for the long values more often. */
function weight(level: LevelId, value: number): number {
  const digits = String(value).length;
  if (level === 'hard') return digits === 3 ? 3 : digits === 2 ? 2 : 1;
  if (level === 'standard') return digits === 3 ? 2 : 1;
  return 1;
}

export interface ForgePlan {
  letters: readonly ForgeLetter[];
  /** The numbers to type, one per letter. */
  numbers: readonly string[];
  /** The whole run as one line: the numbers with single spaces between them. */
  text: string;
  chapters: readonly Chapter[];
  /** Digits in all the numbers together (spaces not counted). */
  digits: number;
  level: LevelId;
}

export interface PlanOptions {
  layout: LayoutId;
  /** The learned keys (the numbers are checked against them). */
  keys: ReadonlySet<string>;
  level: LevelId;
  /** A random number in [0, 1). */
  rng: () => number;
}

/** True when every character of the number has been learned. */
export function spelledFrom(text: string, keys: ReadonlySet<string>): boolean {
  return text.length > 0 && [...text].every((ch) => keys.has(ch));
}

/**
 * Lays out one run. A letter whose value needs an unlearned digit is never taken; with no usable
 * letter at all the plan is empty (the Forge stays shut then).
 */
export function planForge(o: PlanOptions): ForgePlan {
  const count = LETTERS_PER_LEVEL[o.level];
  const pool = alphabetOf(o.layout).filter(
    (l) => String(l.value).length <= MAX_DIGITS[o.level] && spelledFrom(String(l.value), o.keys),
  );
  const letters: ForgeLetter[] = [];
  if (pool.length > 0) {
    const bag = pool.flatMap((l) => Array.from({ length: weight(o.level, l.value) }, () => l));
    let tries = 0;
    while (letters.length < count && tries < count * 20) {
      tries += 1;
      const pick = bag[Math.min(bag.length - 1, Math.floor(o.rng() * bag.length))] as ForgeLetter;
      // Never the same letter twice in a row.
      if (pool.length > 1 && pick.glyph === letters.at(-1)?.glyph) continue;
      letters.push(pick);
    }
  }
  const numbers = letters.map((l) => String(l.value));
  const chapters: Chapter[] = [];
  const a = Math.round(letters.length * 0.25);
  const b = Math.round(letters.length * 0.75);
  if (a > 0) chapters.push({ id: 'stoke', from: 0, to: a });
  if (b > a) chapters.push({ id: 'forge', from: a, to: b });
  if (letters.length > b) chapters.push({ id: 'quench', from: b, to: letters.length });
  let digits = 0;
  for (const n of numbers) digits += n.length;
  return { letters, numbers, text: numbers.join(' '), chapters, digits, level: o.level };
}

/** The chapter a letter index is in (the last chapter once the run is over). */
export function chapterAt(plan: ForgePlan, index: number): ChapterId {
  for (const c of plan.chapters) if (index < c.to) return c.id;
  return plan.chapters.at(-1)?.id ?? 'quench';
}

/** The chapter that begins at this index, if one does. */
export function chapterStartsAt(plan: ForgePlan, index: number): ChapterId | null {
  return plan.chapters.find((c) => c.from === index)?.id ?? null;
}

// ---- the furnace ----------------------------------------------------------------------------

/** The safe band of the furnace's temperature (0 is cold iron, 1 is white-hot). */
export const BAND_LOW = 0.42;
export const BAND_HIGH = 0.78;
export const HEAT_START = 0.45;
/** What one right key adds, and what a slip adds (the fire flares). */
export const HEAT_PER_KEY = 0.06;
export const HEAT_PER_SLIP = 0.1;

/**
 * How fast the fire loses its heat: a share of the heat per second (so a hot fire cools faster
 * than a warm one and every steady pace has a temperature it settles at). The fire settles at
 * about HEAT_PER_KEY * keys-a-second / rate: in the middle of the band at one key a second on
 * Easy, one and a half on Standard and two on Hard. Typing faster runs it hotter, slower colder.
 */
export const COOL_RATE: Readonly<Record<LevelId, number>> = {
  easy: 0.1,
  standard: 0.15,
  hard: 0.2,
};

export function clampHeat(heat: number): number {
  return Math.max(0, Math.min(1, heat));
}

export function stoked(heat: number): number {
  return clampHeat(heat + HEAT_PER_KEY);
}

export function flared(heat: number): number {
  return clampHeat(heat + HEAT_PER_SLIP);
}

export function cooled(heat: number, seconds: number, level: LevelId = 'standard'): number {
  return clampHeat(heat * Math.exp(-COOL_RATE[level] * Math.max(0, seconds)));
}

/** How the fire stands: below the band, in it, or above it. */
export function temperOf(heat: number): Temper {
  return heat < BAND_LOW ? 'cold' : heat > BAND_HIGH ? 'hot' : 'good';
}

/** Letters forged bright (in the band) among the first `n` tempers. */
export function brightCount(tempers: readonly Temper[]): number {
  return tempers.filter((t) => t === 'good').length;
}

// ---- how the forge answers ------------------------------------------------------------------

/** Lamps lit after so many letters of the run (0..SECTIONS; all at the end). */
export function lampsLit(done: number, total: number): number {
  if (total <= 0) return SECTIONS;
  if (done >= total) return SECTIONS;
  return Math.max(0, Math.min(SECTIONS, Math.floor((done * SECTIONS) / total)));
}

/** How far (0..1) the color has spread through the cave after so many letters. */
export function colorShare(done: number, total: number): number {
  if (total <= 0) return 1;
  return Math.max(0, Math.min(1, done / total));
}
