// Wings over Hermon's run, as plain data (no 3D here; unit-tested). The apprentice rides a great
// eagle up the valley to Mount Hermon through a thunderstorm. The Fading has frozen the words of
// the land into hailstones, and they come down one at a time out of the clouds toward the eagle.
// Every hailstone carries one word: finish it before the stone lands and it bursts into gold
// rain that brings the color back to the valley below. The next stone waits dark inside the
// cloud; a flash of lightning shows its word for a moment (lightning reveals the next word).
//
// Calm has no timers (DIFFICULTIES.calm.timers): a stone stops in the air and waits. On every
// other difficulty a stone that lands strikes the eagle: the streak drops, the stone is thrown
// back up by a beat of the wings, and it comes down again a little slower. Nothing is lost and
// the run always reaches its end.
//
// Every character is one the player has already learned (ARCHITECTURE section 8): words come from
// the learned word source and are checked again here. The scene's band is "words and capitals":
// a capital is used only when the learned set holds that capital itself, so a course that has not
// taught capitals never sees one.

import type { Difficulty, DifficultyId } from '../../game/difficulty';
import type { Level, LevelId } from '../../game/levels';

export const CHAPTER_IDS = ['gathering', 'heart', 'summit'] as const;
export type ChapterId = (typeof CHAPTER_IDS)[number];

export interface Chapter {
  id: ChapterId;
  /** Index of its first stone, and one past its last. */
  from: number;
  to: number;
}

/** Breaks in the clouds that open as the run goes on (and sections of the run). */
export const SECTIONS = 3;

/** Hailstones per level (always a multiple of SECTIONS). */
export const STONES_PER_LEVEL: Readonly<Record<LevelId, number>> = {
  easy: 9,
  standard: 12,
  hard: 15,
};

// ---- the fall --------------------------------------------------------------------------------

/**
 * The typing speed (WPM) a stone's fall is measured for, per difficulty. It is gentle: the stone
 * also gives a moment to read the word first (REACT_S), so a typist at this pace always wins.
 */
export const HAIL_WPM: Readonly<Record<DifficultyId, number>> = {
  calm: 0,
  steady: 9,
  swift: 16,
  fierce: 24,
  trial: 14,
};
/** Seconds to read the word before the fall counts against the typing. */
export const REACT_S = 1.8;
/** No stone falls faster than this, whatever the word. */
export const MIN_FALL_S = 3;
/** On Calm the stone stops at this height (1 = where it starts, 0 = where it lands) and waits. */
export const CALM_HOLD = 0.42;
/** A stone that struck is thrown back up to this height. */
export const KNOCKBACK = 0.6;
/** ...and falls the rest of the way this much slower. */
export const KNOCK_SLOW = 1.35;

/**
 * How long the stone with this word takes to land, in seconds, or null on a difficulty without
 * timers (the stone holds and waits). Longer words fall longer; harder levels press harder.
 */
export function fallSeconds(
  word: string,
  difficulty: Pick<Difficulty, 'id' | 'timers'>,
  level: Pick<Level, 'pace'>,
): number | null {
  if (!difficulty.timers) return null;
  const wpm = HAIL_WPM[difficulty.id] || HAIL_WPM.steady;
  const chars = [...word].length + 1;
  // 5 characters a word: one character takes 12 / wpm seconds.
  const typing = (chars * 12) / wpm;
  return Math.max(MIN_FALL_S, REACT_S + typing / Math.max(0.5, level.pace));
}

/** What a hailstone did in one step. */
export type HailStep = 'waiting' | 'falling' | 'held' | 'struck';

/**
 * One hailstone's fall. Pure and allocation-free: the scene steps it every logic tick. `height`
 * runs from 1 (just out of the cloud) to 0 (it lands). Before `release` it hangs at the top
 * (the run has not begun); with no fall time (Calm) it comes down to CALM_HOLD and waits there.
 */
export class Hail {
  height = 1;
  /** Seconds the whole fall takes now (null: no timer). */
  fall: number | null = null;
  strikes = 0;
  released = false;

  /** A new stone at the top of its fall. */
  start(fall: number | null): void {
    this.height = 1;
    this.fall = fall;
    this.strikes = 0;
  }

  /** The run has begun: stones may fall. */
  release(): void {
    this.released = true;
  }

  step(dt: number): HailStep {
    if (!this.released) return 'waiting';
    if (this.fall === null) {
      // No timers: drift down to the hold height and stay there.
      const goal = CALM_HOLD;
      if (this.height <= goal) return 'held';
      this.height = Math.max(goal, this.height - dt / 7);
      return this.height <= goal ? 'held' : 'falling';
    }
    this.height -= dt / this.fall;
    if (this.height > 0) return 'falling';
    // It landed: a strike. Thrown back up, and the rest of the way is slower.
    this.strikes += 1;
    this.height = KNOCKBACK;
    this.fall *= KNOCK_SLOW;
    return 'struck';
  }

  /** Back to the start of a run. */
  reset(): void {
    this.height = 1;
    this.fall = null;
    this.strikes = 0;
    this.released = false;
  }
}

// ---- lightning ---------------------------------------------------------------------------------

/** Seconds between flashes of lightning in the full storm, and once it starts to break. */
export const FLASH_GAP_MIN = 2.2;
export const FLASH_GAP_MAX = 5.5;
/** How long the next word stays readable after a flash, and how long it takes to fade. */
export const REVEAL_HOLD = 1.4;
export const REVEAL_FADE = 0.7;

/** Seconds to the next flash: `r` is a random number 0..1, `storm` how wild the storm is (0..1). */
export function flashGap(r: number, storm: number): number {
  const s = Math.max(0, Math.min(1, storm));
  const gap = FLASH_GAP_MIN + Math.max(0, Math.min(1, r)) * (FLASH_GAP_MAX - FLASH_GAP_MIN);
  // A calmer sky flashes less often.
  return gap * (1 + (1 - s) * 0.8);
}

/** How readable (0..1) the next word is, `t` seconds after the last flash. */
export function revealOf(t: number): number {
  if (!Number.isFinite(t) || t < 0) return 0;
  if (t <= REVEAL_HOLD) return 1;
  return Math.max(0, 1 - (t - REVEAL_HOLD) / REVEAL_FADE);
}

/** How wild the storm is (1 at the start .. 0.15 before the last word; 0 once restored). */
export function stormAt(done: number, total: number): number {
  if (total <= 0 || done >= total) return 0;
  return 1 - 0.85 * Math.max(0, Math.min(1, done / total));
}

// ---- the run --------------------------------------------------------------------------------

export interface Stone {
  word: string;
  /** Seconds the fall takes (null: no timer, the stone waits). */
  fall: number | null;
}

export interface HermonPlan {
  stones: readonly Stone[];
  /** The whole run as one line: the words with single spaces between them. */
  text: string;
  chapters: readonly Chapter[];
  level: LevelId;
  /** False on Calm: no stone ever lands. */
  timers: boolean;
}

export interface PlanOptions {
  /** The learned keys (every word is checked against them). */
  keys: ReadonlySet<string>;
  level: Level;
  difficulty: Pick<Difficulty, 'id' | 'timers'>;
  /** Learned words of the level's lengths (`levelWordSource`). */
  words: { next(): string };
}

/**
 * A capital for the first letter, only when the learned set holds that capital (a course that
 * has not taught capitals never gets one, and Hebrew has none).
 */
export function capitalized(word: string, keys: ReadonlySet<string>): string {
  const [first, ...rest] = [...word];
  if (!first) return word;
  const up = first.toUpperCase();
  if (up === first || !keys.has(up)) return word;
  return up + rest.join('');
}

/** Lays out one run. A word that is not fully learned is simply never taken. */
export function planHermon(o: PlanOptions): HermonPlan {
  const spelled = (w: string): boolean => w.length > 0 && [...w].every((ch) => o.keys.has(ch));
  const count = STONES_PER_LEVEL[o.level.id];
  const words: string[] = [];
  let tries = 0;
  while (words.length < count && tries < count * 14) {
    tries += 1;
    const w = o.words.next().trim();
    // Never the same word twice in a row, never a key that was not learned, never a space.
    if (!spelled(w) || w.includes(' ') || w === words.at(-1)) continue;
    words.push(w);
  }
  const a = Math.round(words.length / 3);
  const b = Math.round((words.length * 2) / 3);
  // Words and capitals: over the summit (the last third) every other word on the Hard level
  // starts with a capital, if the course has taught it.
  const stones: Stone[] = words.map((w, i) => {
    const word = o.level.id === 'hard' && i >= b && (i - b) % 2 === 0 ? capitalized(w, o.keys) : w;
    return { word, fall: fallSeconds(word, o.difficulty, o.level) };
  });
  const chapters: Chapter[] = [];
  if (a > 0) chapters.push({ id: 'gathering', from: 0, to: a });
  if (b > a) chapters.push({ id: 'heart', from: a, to: b });
  if (stones.length > b) chapters.push({ id: 'summit', from: b, to: stones.length });
  return {
    stones,
    text: stones.map((s) => s.word).join(' '),
    chapters,
    level: o.level.id,
    timers: o.difficulty.timers,
  };
}

/** The chapter a stone index is in (the last chapter once the run is over). */
export function chapterAt(plan: HermonPlan, index: number): ChapterId {
  for (const c of plan.chapters) if (index < c.to) return c.id;
  return plan.chapters.at(-1)?.id ?? 'summit';
}

/** The chapter that begins at this index, if one does. */
export function chapterStartsAt(plan: HermonPlan, index: number): ChapterId | null {
  return plan.chapters.find((c) => c.from === index)?.id ?? null;
}

// ---- how the sky answers ---------------------------------------------------------------------

/** Breaks in the clouds open after so many stones (0..SECTIONS; all at the end). */
export function breaksOpen(done: number, total: number): number {
  if (total <= 0 || done >= total) return SECTIONS;
  return Math.max(0, Math.min(SECTIONS, Math.floor((done * SECTIONS) / total)));
}

/** How far (0..1) the color has come back after so many stones. */
export function colorShare(done: number, total: number): number {
  if (total <= 0) return 1;
  return Math.max(0, Math.min(1, done / total));
}

/** Stones caught in the air (finished before they ever struck), as a whole percent. */
export function caughtPercent(caught: number, total: number): number {
  if (total <= 0) return 100;
  return Math.round(Math.max(0, Math.min(1, caught / total)) * 100);
}
