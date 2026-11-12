// The Lantern Caves' run, as plain data (no 3D here; unit-tested). Under the hills lie old chalk
// caves where the scribes once hid their lamps. The Fading has crept in and filled them with
// shadows. The apprentice goes in with one lantern, and every chamber of the caves is one passage
// of words:
//
//   - Every right letter feeds the lantern a little; every clean streak of letters makes it flare,
//     and the shadows at the edge of its light shrink back.
//   - Every stumble dims it, and the shadows creep one step closer.
//   - On every difficulty but Calm the flame also burns down slowly while the passage is open,
//     so steady, accurate typing is what keeps the dark away. If the light goes out, the shadows
//     touch the apprentice: the streak drops, the lantern is struck alight again (half full) and
//     for the rest of that chamber it burns down slower. Nothing is lost and the run always reaches
//     the Hall of Lamps (no soft-locks). On Calm the flame never burns down and never goes out.
//   - At the end of every chamber an old oil lamp waits in a niche of the wall: it is lit from the
//     lantern, the color comes back around it, and the lantern is topped up.
//
// How far one can read ahead follows the light: a bright lantern shows the next words written on
// the chalk ahead, a dim one only the word in hand.
//
// Every character is one the player has already learned (ARCHITECTURE section 8): words come from
// the learned word source and are checked again here. The scene's band is accuracy, so the text is
// plain learned words, no capitals or marks.

import type { Difficulty, DifficultyId } from '../../game/difficulty';
import type { Level, LevelId } from '../../game/levels';

export const CHAPTER_IDS = ['mouth', 'galleries', 'hall'] as const;
export type ChapterId = (typeof CHAPTER_IDS)[number];

export interface Chamber {
  /** 0 .. chambers - 1; the last one opens into the Hall of Lamps. */
  index: number;
  /** Index of its first word, and one past its last. */
  from: number;
  to: number;
}

export interface Chapter {
  id: ChapterId;
  from: number;
  to: number;
}

/** Chambers per level; the last one always opens into the Hall of Lamps. */
export const CHAMBERS_PER_LEVEL: Readonly<Record<LevelId, number>> = {
  easy: 3,
  standard: 4,
  hard: 5,
};

/** Shortest and longest passage, in words. */
export const PASSAGE_WORDS: Readonly<Record<LevelId, readonly [number, number]>> = {
  easy: [5, 6],
  standard: [6, 8],
  hard: [8, 10],
};

// ---- the lantern ------------------------------------------------------------------------------

/** How full the lantern is when the run begins (0 out .. 1 blazing). */
export const LANTERN_START = 0.7;
/** Every right letter feeds the flame this much. */
export const KEY_GAIN = 0.012;
/** Every this many right letters in a row the flame flares... */
export const STREAK_STEP = 8;
/** ...by this much, and the shadows shrink back. */
export const STREAK_GAIN = 0.1;
/** A word typed without a single slip feeds it this much more. */
export const PERFECT_GAIN = 0.04;
/** The niche lamp at the end of a chamber tops the lantern up by this much. */
export const NICHE_GAIN = 0.3;
/** A stumble dims the flame this much (harder difficulties more). */
export const SLIP: Readonly<Record<DifficultyId, number>> = {
  calm: 0.12,
  steady: 0.15,
  swift: 0.18,
  fierce: 0.22,
  trial: 0.18,
};
/** The typing speed (WPM) the burning-down is measured for, per difficulty (0: it never burns down). */
export const BURN_WPM: Readonly<Record<DifficultyId, number>> = {
  calm: 0,
  steady: 9,
  swift: 16,
  fierce: 24,
  trial: 14,
};
/** How fast the flame burns down (per second) at 9 WPM and pace 1. */
export const BURN_BASE = 0.011;
/** On Calm the flame never sinks below this: the shadows stay at a distance and wait. */
export const CALM_FLOOR = 0.22;
/** A lantern that went out is struck alight again this full... */
export const RELIGHT = 0.5;
/** ...and burns down this much slower for the rest of the chamber. */
export const RELIGHT_SLOW = 1.4;

/**
 * How fast the flame burns down while a passage is open (per second), or 0 on a difficulty
 * without timers. Harder difficulties and levels press harder; a typist at the difficulty's pace
 * always feeds it faster than it burns (see the test "is fair").
 */
export function burnRate(
  difficulty: Pick<Difficulty, 'id' | 'timers'>,
  level: Pick<Level, 'pace'>,
): number {
  if (!difficulty.timers) return 0;
  const wpm = BURN_WPM[difficulty.id] || BURN_WPM.steady;
  return BURN_BASE * (wpm / 9) * Math.max(0.5, level.pace);
}

/** What the lantern did with one key or one step of time. */
export type LanternEvent = 'none' | 'flare' | 'creep' | 'out';

/**
 * The lantern. Pure and allocation-free: the scene feeds it every judged key and steps it every
 * logic tick. `light` runs from 0 (out: the shadows touch the apprentice) to 1 (blazing: they
 * stand far off at the edge of the light).
 */
export class Lantern {
  light = LANTERN_START;
  /** Right letters in a row. */
  streak = 0;
  /** Times the light went out, and times the shadows were made to shrink back. */
  outs = 0;
  flares = 0;
  /** Seconds of burning per second (0: it never burns down). */
  rate = 0;
  /** The flame only burns down once the passage has begun. */
  released = false;
  /** On Calm the flame has a floor and never goes out. */
  calm = true;
  /** Times it went out in the chamber being walked. */
  outsHere = 0;

  /** A new run. */
  reset(rate: number, calm: boolean): void {
    this.light = LANTERN_START;
    this.streak = 0;
    this.outs = 0;
    this.flares = 0;
    this.outsHere = 0;
    this.rate = Math.max(0, Number.isFinite(rate) ? rate : 0);
    this.calm = calm || this.rate === 0;
    this.released = false;
  }

  /** A new chamber: the burning waits for its first key again, at the run's own rate. */
  chamber(rate: number): void {
    this.rate = Math.max(0, Number.isFinite(rate) ? rate : 0);
    this.released = false;
    this.outsHere = 0;
  }

  private get floor(): number {
    return this.calm ? CALM_FLOOR : 0;
  }

  private add(v: number): void {
    this.light = Math.max(this.floor, Math.min(1, this.light + v));
  }

  /** A judged key. `slip` is how much a stumble costs on this difficulty. */
  key(correct: boolean, slip: number): LanternEvent {
    this.released = true;
    if (correct) {
      this.streak += 1;
      this.add(KEY_GAIN);
      if (this.streak % STREAK_STEP === 0) {
        this.add(STREAK_GAIN);
        this.flares += 1;
        return 'flare';
      }
      return 'none';
    }
    this.streak = 0;
    this.add(-Math.max(0, slip));
    if (!this.calm && this.light <= 0) {
      this.goOut();
      return 'out';
    }
    return 'creep';
  }

  /** A word typed without a slip. */
  perfect(): void {
    this.add(PERFECT_GAIN);
  }

  /** The niche lamp of a chamber tops it up. */
  topUp(): void {
    this.add(NICHE_GAIN);
  }

  step(dt: number): LanternEvent {
    if (!this.released || this.rate <= 0 || !(dt > 0)) return 'none';
    this.add(-this.rate * Math.min(dt, 0.25));
    if (!this.calm && this.light <= 0) {
      this.goOut();
      return 'out';
    }
    return 'none';
  }

  /** The dark reached the apprentice: strike the lantern alight again, and burn slower. */
  private goOut(): void {
    this.outs += 1;
    this.outsHere += 1;
    this.streak = 0;
    this.light = RELIGHT;
    this.rate /= RELIGHT_SLOW;
  }
}

// ---- the shadows and the light ------------------------------------------------------------------

/** How close the shadows stand (world units from the apprentice) with the light out and blazing. */
export const SHADOW_NEAR = 1.2;
export const SHADOW_FAR = 11;

/** Where the shadows stand for this much light. */
export function shadowReach(light: number): number {
  const l = Math.max(0, Math.min(1, Number.isFinite(light) ? light : 0));
  // A bright lantern pushes them away fast; a dim one lets them gather close.
  const k = 1 - (1 - l) * (1 - l);
  return SHADOW_NEAR + (SHADOW_FAR - SHADOW_NEAR) * k;
}

/** The most words after the one in hand a blazing lantern shows, per level. */
export const LOOK_BRIGHT: Readonly<Record<LevelId, number>> = { easy: 3, standard: 2, hard: 2 };
/** Light needed to read one word ahead, and to read as far as the level allows. */
export const LOOK_DIM = 0.33;
export const LOOK_FULL = 0.66;

/** How many words after the one in hand can be read on the chalk ahead with this much light. */
export function lookaheadAt(light: number, level: LevelId): number {
  const l = Number.isFinite(light) ? light : 0;
  if (l >= LOOK_FULL) return LOOK_BRIGHT[level];
  if (l >= LOOK_DIM) return 1;
  // Easy always keeps one word of warning.
  return level === 'easy' ? 1 : 0;
}

// ---- the run --------------------------------------------------------------------------------

export interface CavesPlan {
  words: readonly string[];
  chambers: readonly Chamber[];
  chapters: readonly Chapter[];
  /** The whole run as one line: the words with single spaces between them. */
  text: string;
  level: LevelId;
  /** False on Calm: the flame never burns down or goes out. */
  timers: boolean;
  /** How fast the flame burns down while a passage is open (0 on Calm). */
  burn: number;
  /** How much one stumble dims it. */
  slip: number;
}

export interface PlanOptions {
  keys: ReadonlySet<string>;
  level: Level;
  difficulty: Pick<Difficulty, 'id' | 'timers'>;
  words: { next(): string };
  rng: () => number;
}

/** Lays out one run. A word that is not fully learned is simply never taken. */
export function planCaves(o: PlanOptions): CavesPlan {
  const spelled = (w: string): boolean => w.length > 0 && [...w].every((ch) => o.keys.has(ch));
  const count = CHAMBERS_PER_LEVEL[o.level.id];
  const [lo, hi] = PASSAGE_WORDS[o.level.id];
  const used = new Set<string>();
  const take = (avoid: string | undefined): string | null => {
    let fallback: string | null = null;
    for (let tries = 0; tries < 40; tries++) {
      const w = o.words.next().trim();
      if (!spelled(w) || w.includes(' ') || w === avoid) continue;
      if (!used.has(w)) {
        used.add(w);
        return w;
      }
      fallback ??= w;
    }
    return fallback;
  };

  const words: string[] = [];
  const chambers: Chamber[] = [];
  for (let c = 0; c < count; c++) {
    const r = Math.max(0, Math.min(0.999, o.rng()));
    const n = lo + Math.floor(r * (hi - lo + 1));
    const from = words.length;
    for (let i = 0; i < n; i++) {
      const w = take(words.at(-1));
      if (w !== null) words.push(w);
    }
    if (words.length === from) break;
    chambers.push({ index: c, from, to: words.length });
  }

  const last = chambers.length - 1;
  const chapterOf = (c: number): ChapterId =>
    c === last && last > 0 ? 'hall' : c === 0 ? 'mouth' : 'galleries';
  const chapters: Chapter[] = [];
  for (const ch of chambers) {
    const id = chapterOf(ch.index);
    const prev = chapters.at(-1);
    if (prev && prev.id === id) prev.to = ch.to;
    else chapters.push({ id, from: ch.from, to: ch.to });
  }
  return {
    words,
    chambers,
    chapters,
    text: words.join(' '),
    level: o.level.id,
    timers: o.difficulty.timers,
    burn: burnRate(o.difficulty, o.level),
    slip: SLIP[o.difficulty.id] ?? SLIP.steady,
  };
}

/** The chamber a word index is in (the last once the run is over); -1 for an empty plan. */
export function chamberAt(plan: CavesPlan, index: number): number {
  for (let i = 0; i < plan.chambers.length; i++)
    if (index < (plan.chambers[i] as Chamber).to) return i;
  return plan.chambers.length - 1;
}

export function chapterAt(plan: CavesPlan, index: number): ChapterId {
  for (const c of plan.chapters) if (index < c.to) return c.id;
  return plan.chapters.at(-1)?.id ?? 'hall';
}

export function chapterStartsAt(plan: CavesPlan, index: number): ChapterId | null {
  return plan.chapters.find((c) => c.from === index)?.id ?? null;
}

/** Characters a chamber asks for: its words and the spaces after them (the run's last has none). */
export function chamberChars(plan: CavesPlan, chamber: number): number {
  const c = plan.chambers[chamber];
  if (!c) return 1;
  let n = 0;
  for (let i = c.from; i < c.to; i++) n += [...(plan.words[i] as string)].length + 1;
  if (c.to >= plan.words.length) n -= 1;
  return Math.max(1, n);
}

/** The words after `index` that the lantern lets one read, never past the end of the run. */
export function wordsAhead(plan: CavesPlan, index: number, light: number): readonly string[] {
  const n = lookaheadAt(light, plan.level);
  return plan.words.slice(index + 1, Math.min(plan.words.length, index + 1 + n));
}

/** How far (0..1) the color has come back after so many words. */
export function colorShare(done: number, total: number): number {
  if (total <= 0) return 1;
  return Math.max(0, Math.min(1, done / total));
}

/** Niche lamps lit after so many words (the Hall counts as the last). */
export function lampsLit(plan: CavesPlan, done: number): number {
  let n = 0;
  for (const c of plan.chambers) if (done >= c.to) n += 1;
  return n;
}

/** How far along its chamber the apprentice has crept, with `typed` of its `chars` typed. */
export function walkAim(typed: number, chars: number): number {
  if (!(chars > 0)) return 1;
  return Math.max(0, Math.min(1, typed / chars));
}
