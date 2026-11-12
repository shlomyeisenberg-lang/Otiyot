// The Long Midbar's run, as plain data (no 3D here; unit-tested). Far to the south the old
// caravan road crosses the Midbar to the oasis of the scribes. The Fading has greyed the sand and
// stirred up the storms. The apprentice leads a little caravan of camels from well to well, and
// every stage of the road is two sentences:
//
//   TREK  - clear sky. Every right letter is a step of the caravan along the road; the next words
//           stand out plainly on the stone markers ahead (a long lookahead). No timer.
//   STORM - a sandstorm rolls in from the side. The air turns to sand, the markers vanish a few
//           steps ahead (the lookahead shrinks, on the harder levels to nothing but the word in
//           hand) and every word brings a gust: finish the word before the gust reaches the
//           caravan, and the camels walk on through it.
//
// Calm has no timers (DIFFICULTIES.calm.timers): a gust stops a little way off and waits. On
// every other difficulty a gust that reaches the caravan buffets it: the streak drops, the camels
// kneel for a moment and the gust rolls back to come again, slower. Nothing is lost and the run
// always reaches the oasis (no soft-locks).
//
// Every character is one the player has already learned (ARCHITECTURE section 8): words come from
// the learned word source and are checked again here. The scene's band is "sentences": a sentence
// starts with a capital only when the learned set holds that capital itself, and ends with a full
// stop only when the full stop has been learned.

import type { Difficulty, DifficultyId } from '../../game/difficulty';
import type { Level, LevelId } from '../../game/levels';

export const CHAPTER_IDS = ['dunes', 'wadi', 'oasis'] as const;
export type ChapterId = (typeof CHAPTER_IDS)[number];

export type LegKind = 'trek' | 'storm';

export interface Leg {
  kind: LegKind;
  /** The stage of the road this leg belongs to (it ends at well `stage`; the last at the oasis). */
  stage: number;
  /** Index of its first word, and one past its last. */
  from: number;
  to: number;
}

export interface Chapter {
  id: ChapterId;
  /** Index of its first word, and one past its last. */
  from: number;
  to: number;
}

/** Stages of the road per level; the last one always ends at the oasis. */
export const STAGES_PER_LEVEL: Readonly<Record<LevelId, number>> = {
  easy: 3,
  standard: 4,
  hard: 5,
};

/** Shortest and longest sentence, in words. */
export const SENTENCE_WORDS: Readonly<Record<LevelId, readonly [number, number]>> = {
  easy: [3, 4],
  standard: [4, 5],
  hard: [5, 6],
};

/** Marks that end a sentence, in the order they are tried (only learned ones are used). */
export const STOPS: readonly string[] = ['.', '!'];

// ---- how far ahead the road can be read -------------------------------------------------------

/**
 * How many words after the one in hand can be read on the markers ahead. In clear weather the
 * road is open; in a sandstorm the markers vanish into the sand, on Standard and Hard all of them
 * (only the word being typed can be seen). Easy always keeps one word of warning.
 */
export const LOOKAHEAD: Readonly<Record<LegKind, Readonly<Record<LevelId, number>>>> = {
  trek: { easy: 3, standard: 3, hard: 2 },
  storm: { easy: 1, standard: 0, hard: 0 },
};

export function lookaheadOf(kind: LegKind, level: LevelId): number {
  return LOOKAHEAD[kind][level];
}

/** How far one can see (world units) in clear air and in the thick of a storm. */
export const SIGHT_CLEAR = 140;
export const SIGHT_STORM = 16;

/** How far one can see with the storm at `storm` (0 clear .. 1 at its thickest). */
export function sightAt(storm: number): number {
  const s = Math.max(0, Math.min(1, Number.isFinite(storm) ? storm : 0));
  // The sight closes fast at first and then slowly: a storm feels thick from its first minute.
  const k = 1 - (1 - s) * (1 - s);
  return SIGHT_CLEAR + (SIGHT_STORM - SIGHT_CLEAR) * k;
}

// ---- the gusts --------------------------------------------------------------------------------

/**
 * The typing speed (WPM) a gust is measured for, per difficulty. Gentle: the gust also gives a
 * moment to read the word first (REACT_S), so a typist at this pace always walks through.
 */
export const GUST_WPM: Readonly<Record<DifficultyId, number>> = {
  calm: 0,
  steady: 9,
  swift: 16,
  fierce: 24,
  trial: 14,
};
/** Seconds to read the word first (in a storm the word appears only when its turn comes). */
export const REACT_S = 2.2;
/** No gust arrives faster than this, whatever the word. */
export const MIN_GUST_S = 3.4;
/** On Calm a gust stops this far off (1 = where it rises, 0 = at the caravan) and waits. */
export const CALM_HOLD = 0.4;
/** A gust that buffeted the caravan rolls back out to this distance... */
export const BOUNCE = 0.6;
/** ...and comes in the rest of the way this much slower. */
export const BOUNCE_SLOW = 1.35;

/**
 * Seconds the gust carrying this word takes to reach the caravan, or null on a difficulty
 * without timers (the gust holds off and waits). Longer words take longer; harder levels press.
 */
export function gustSeconds(
  word: string,
  difficulty: Pick<Difficulty, 'id' | 'timers'>,
  level: Pick<Level, 'pace'>,
): number | null {
  if (!difficulty.timers) return null;
  const wpm = GUST_WPM[difficulty.id] || GUST_WPM.steady;
  const chars = [...word].length + 1;
  // 5 characters a word: one character takes 12 / wpm seconds.
  const typing = (chars * 12) / wpm;
  return Math.max(MIN_GUST_S, REACT_S + typing / Math.max(0.5, level.pace));
}

/** What a gust did in one step. */
export type GustStep = 'waiting' | 'coming' | 'held' | 'buffeted';

/**
 * One gust of the storm. Pure and allocation-free: the scene steps it every logic tick.
 * `distance` runs from 1 (where it rises, out in the dunes) to 0 (it reaches the caravan). Before
 * `release` it waits (the word has not begun); with no time (Calm) it rolls in to CALM_HOLD and
 * stays there.
 */
export class Gust {
  distance = 1;
  /** Seconds the whole approach takes now (null: no timer). */
  time: number | null = null;
  hits = 0;
  released = false;

  /** A new gust, far off. */
  start(time: number | null): void {
    this.distance = 1;
    this.time = time;
    this.hits = 0;
  }

  /** The word has begun: the gust may come. */
  release(): void {
    this.released = true;
  }

  step(dt: number): GustStep {
    if (!this.released) return 'waiting';
    if (this.time === null) {
      if (this.distance <= CALM_HOLD) return 'held';
      this.distance = Math.max(CALM_HOLD, this.distance - dt / 6);
      return this.distance <= CALM_HOLD ? 'held' : 'coming';
    }
    this.distance -= dt / this.time;
    if (this.distance > 0) return 'coming';
    // It reached the caravan: a buffet. It rolls back out, and the rest of the way is slower.
    this.hits += 1;
    this.distance = BOUNCE;
    this.time *= BOUNCE_SLOW;
    return 'buffeted';
  }

  /** Back to the start of a run. */
  reset(): void {
    this.distance = 1;
    this.time = null;
    this.hits = 0;
    this.released = false;
  }
}

// ---- the march ----------------------------------------------------------------------------------

/** How hard the caravan leans into its walk, and how quickly it stops when the typing stops. */
export const MARCH_PULL = 6;
export const MARCH_DAMP = 4.2;

/**
 * The caravan's walk along a stage, 0 (the last well) .. 1 (the next one). Every right letter
 * moves the aim forward; the caravan walks after it at a camel's pace, never past the aim and
 * never backward. Pure and allocation-free.
 */
export class March {
  at = 0;
  speed = 0;
  aim = 0;

  /** A new stage, at its start. */
  reset(): void {
    this.at = 0;
    this.speed = 0;
    this.aim = 0;
  }

  /** Moves the aim (it only ever goes forward, and never past the well). */
  push(aim: number): void {
    const a = Number.isFinite(aim) ? Math.max(0, Math.min(1, aim)) : 0;
    if (a > this.aim) this.aim = a;
  }

  step(dt: number): void {
    if (!(dt > 0)) return;
    const d = Math.min(dt, 0.1);
    const accel = (this.aim - this.at) * MARCH_PULL - this.speed * MARCH_DAMP;
    this.speed = Math.max(0, this.speed + accel * d);
    this.at = Math.min(this.aim, this.at + this.speed * d);
    if (this.at >= this.aim) this.speed *= 0.5;
  }

  /** True once the caravan has walked (almost) all the way to the aim. */
  get settled(): boolean {
    return this.aim - this.at < 0.01;
  }
}

/** How far along its stage the march aims, with `typed` of the stage's `chars` characters typed. */
export function marchAim(typed: number, chars: number): number {
  if (!(chars > 0)) return 1;
  return Math.max(0, Math.min(1, typed / chars));
}

// ---- the run --------------------------------------------------------------------------------

export interface MidbarPlan {
  /** Every word of the run, with its capital and full stop where they belong. */
  words: readonly string[];
  /** For each word: seconds its gust takes to reach the caravan (null on a trek, or on Calm). */
  gust: readonly (number | null)[];
  legs: readonly Leg[];
  chapters: readonly Chapter[];
  /** Stages of the road; the last one ends at the oasis. */
  stages: number;
  /** The whole run as one line: the words with single spaces between them. */
  text: string;
  level: LevelId;
  /** False on Calm: no gust ever buffets the caravan. */
  timers: boolean;
}

export interface PlanOptions {
  /** The learned keys (every word is checked against them). */
  keys: ReadonlySet<string>;
  level: Level;
  difficulty: Pick<Difficulty, 'id' | 'timers'>;
  /** Learned words of the level's lengths (`levelWordSource`). */
  words: { next(): string };
  /** 0..1 random numbers (sentence lengths). */
  rng: () => number;
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

/** The mark that ends a sentence of this kind, or '' when none has been learned. */
export function stopFor(kind: LegKind, keys: ReadonlySet<string>): string {
  // A storm sentence ends with a shout into the wind when "!" is known; a trek with a full stop.
  const order = kind === 'storm' ? ['!', '.'] : STOPS;
  return order.find((m) => keys.has(m)) ?? '';
}

/** Lays out one run. A word that is not fully learned is simply never taken. */
export function planMidbar(o: PlanOptions): MidbarPlan {
  const spelled = (w: string): boolean => w.length > 0 && [...w].every((ch) => o.keys.has(ch));
  const stages = STAGES_PER_LEVEL[o.level.id];
  const [lo, hi] = SENTENCE_WORDS[o.level.id];
  const used = new Set<string>();
  /** A learned word, new to this run when it can be; never `avoid` (the word before it). */
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
  const gust: (number | null)[] = [];
  const legs: Leg[] = [];
  outer: for (let s = 0; s < stages; s++) {
    for (const kind of ['trek', 'storm'] as const) {
      const r = Math.max(0, Math.min(0.999, o.rng()));
      const n = lo + Math.floor(r * (hi - lo + 1));
      const sentence: string[] = [];
      for (let i = 0; i < n; i++) {
        // Never the same word twice in a row.
        const prev = sentence.length > 0 ? sentence.at(-1) : words.at(-1)?.replace(/[.!]$/, '');
        const w = take(prev);
        if (w === null) continue;
        sentence.push(w);
      }
      if (sentence.length === 0) break outer;
      sentence[0] = capitalized(sentence[0] as string, o.keys);
      const stop = stopFor(kind, o.keys);
      sentence[sentence.length - 1] = `${sentence.at(-1) as string}${stop}`;
      const from = words.length;
      for (const w of sentence) {
        words.push(w);
        gust.push(kind === 'storm' ? gustSeconds(w, o.difficulty, o.level) : null);
      }
      legs.push({ kind, stage: s, from, to: words.length });
    }
  }

  // Chapters by stage: the first crosses the dunes, the last reaches the oasis, the rest the wadi.
  const stageCount = legs.length > 0 ? (legs.at(-1) as Leg).stage + 1 : 0;
  const chapterOf = (s: number): ChapterId =>
    s === stageCount - 1 && stageCount > 1 ? 'oasis' : s === 0 ? 'dunes' : 'wadi';
  const chapters: Chapter[] = [];
  for (const leg of legs) {
    const id = chapterOf(leg.stage);
    const last = chapters.at(-1);
    if (last && last.id === id) last.to = leg.to;
    else chapters.push({ id, from: leg.from, to: leg.to });
  }
  return {
    words,
    gust,
    legs,
    chapters,
    stages: stageCount,
    text: words.join(' '),
    level: o.level.id,
    timers: o.difficulty.timers,
  };
}

/** The leg a word index is in (the last leg once the run is over); -1 for an empty plan. */
export function legAt(plan: MidbarPlan, index: number): number {
  for (let i = 0; i < plan.legs.length; i++) if (index < (plan.legs[i] as Leg).to) return i;
  return plan.legs.length - 1;
}

/** The chapter a word index is in (the last chapter once the run is over). */
export function chapterAt(plan: MidbarPlan, index: number): ChapterId {
  for (const c of plan.chapters) if (index < c.to) return c.id;
  return plan.chapters.at(-1)?.id ?? 'oasis';
}

/** The chapter that begins at this word index, if one does. */
export function chapterStartsAt(plan: MidbarPlan, index: number): ChapterId | null {
  return plan.chapters.find((c) => c.from === index)?.id ?? null;
}

/** First and one-past-last word of a stage (both of its legs). */
export function stageWords(plan: MidbarPlan, stage: number): [number, number] {
  let from = -1;
  let to = -1;
  for (const leg of plan.legs) {
    if (leg.stage !== stage) continue;
    if (from < 0) from = leg.from;
    to = leg.to;
  }
  return from < 0 ? [0, 0] : [from, to];
}

/** Characters a stage asks for: its words and the spaces after them (the run's last has none). */
export function stageChars(plan: MidbarPlan, stage: number): number {
  const [from, to] = stageWords(plan, stage);
  let n = 0;
  for (let i = from; i < to; i++) n += [...(plan.words[i] as string)].length + 1;
  if (to >= plan.words.length) n -= 1;
  return Math.max(1, n);
}

/**
 * The words after `index` that can be read on the road ahead right now: as many as the leg of
 * that word allows (`lookaheadOf`), never past the end of the run. Pure; allocates its result.
 */
export function wordsAhead(plan: MidbarPlan, index: number): readonly string[] {
  const leg = plan.legs[legAt(plan, index)];
  if (!leg) return [];
  const n = lookaheadOf(leg.kind, plan.level);
  return plan.words.slice(index + 1, Math.min(plan.words.length, index + 1 + n));
}

// ---- how the desert answers -------------------------------------------------------------------

/** How far (0..1) the color has come back after so many words. */
export function colorShare(done: number, total: number): number {
  if (total <= 0) return 1;
  return Math.max(0, Math.min(1, done / total));
}

/** Wells reached after so many words (the oasis counts as the last one). */
export function wellsReached(plan: MidbarPlan, done: number): number {
  let n = 0;
  for (let s = 0; s < plan.stages; s++) if (done >= stageWords(plan, s)[1]) n += 1;
  return n;
}

/** Gusts walked through before they ever buffeted the caravan, as a whole percent. */
export function steadyPercent(steady: number, total: number): number {
  if (total <= 0) return 100;
  return Math.round(Math.max(0, Math.min(1, steady / total)) * 100);
}

/** Gusts in the whole run (one per storm word). */
export function gustsIn(plan: MidbarPlan): number {
  let n = 0;
  for (const leg of plan.legs) if (leg.kind === 'storm') n += leg.to - leg.from;
  return n;
}

/** Palms at the oasis, and how many are green after so many wells (all of them at the end). */
export const PALMS = 9;
export function palmsGreen(wells: number, stages: number, finished: boolean): number {
  if (finished) return PALMS;
  if (stages <= 0) return 0;
  return Math.min(PALMS - 1, Math.floor((PALMS * Math.max(0, wells)) / (stages + 1)));
}
