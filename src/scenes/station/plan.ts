// The Star Station's run, as plain data (no 3D here; unit-tested). High above the land floats the
// old observatory where the stars are counted. The Fading has dimmed the stars and broken the
// station apart: its modules hang dark and silent, far from one another, and grey debris drifts
// around them. The apprentice comes up in a thruster pack. Every module is two sentences:
//
//   DRIFT  - the sentence fires the thrusters. Each right letter is a push; the apprentice floats
//            along an arc to the module's hatch and docks when the sentence is done (no timer:
//            this is the calm part, the long weightless float between modules).
//   TURRET - at the hatch he takes the module's turret. One rock of debris per word of the
//            sentence drifts in at the module; finishing the word fires the turret and breaks it.
//
// Calm has no timers (DIFFICULTIES.calm.timers): a rock stops a little way out and waits. On every
// other difficulty a rock that reaches the hull strikes: the streak drops, the rock bounces off
// the hull and comes in again, slower. Nothing is lost and the run always reaches its end.
//
// Every word lights more stars; the last module is the observatory itself, and at the end its
// dome opens and the whole sky is counted again.
//
// Every character is one the player has already learned (ARCHITECTURE section 8): words come from
// the learned word source and are checked again here. The scene's band is "sentences": a sentence
// starts with a capital only when the learned set holds that capital itself, and ends with a full
// stop only when the full stop has been learned.

import type { Difficulty, DifficultyId } from '../../game/difficulty';
import type { Level, LevelId } from '../../game/levels';

export const CHAPTER_IDS = ['outer', 'ring', 'observatory'] as const;
export type ChapterId = (typeof CHAPTER_IDS)[number];

export type LegKind = 'drift' | 'turret';

export interface Leg {
  kind: LegKind;
  /** The module this leg flies to (drift) or defends (turret). */
  module: number;
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

/** Modules per level; the last one is always the observatory. */
export const MODULES_PER_LEVEL: Readonly<Record<LevelId, number>> = {
  easy: 3,
  standard: 4,
  hard: 4,
};

/** Shortest and longest sentence, in words. */
export const SENTENCE_WORDS: Readonly<Record<LevelId, readonly [number, number]>> = {
  easy: [3, 3],
  standard: [3, 4],
  hard: [4, 5],
};

/** Marks that end a sentence, in the order they are tried (only learned ones are used). */
export const STOPS: readonly string[] = ['.', '!'];

// ---- the debris -----------------------------------------------------------------------------

/**
 * The typing speed (WPM) a rock's approach is measured for, per difficulty. Gentle: the rock also
 * gives a moment to read the word first (REACT_S), so a typist at this pace always wins.
 */
export const DEBRIS_WPM: Readonly<Record<DifficultyId, number>> = {
  calm: 0,
  steady: 9,
  swift: 16,
  fierce: 24,
  trial: 14,
};
/** Seconds to read the word before the approach counts against the typing. */
export const REACT_S = 2;
/** No rock comes in faster than this, whatever the word. */
export const MIN_APPROACH_S = 3.2;
/** On Calm a rock stops this far out (1 = where it starts, 0 = the hull) and waits. */
export const CALM_HOLD = 0.45;
/** A rock that struck bounces back out to this distance... */
export const BOUNCE = 0.6;
/** ...and comes in the rest of the way this much slower. */
export const BOUNCE_SLOW = 1.35;

/**
 * How long the rock with this word takes to reach the hull, in seconds, or null on a difficulty
 * without timers (the rock holds and waits). Longer words take longer; harder levels press harder.
 */
export function approachSeconds(
  word: string,
  difficulty: Pick<Difficulty, 'id' | 'timers'>,
  level: Pick<Level, 'pace'>,
): number | null {
  if (!difficulty.timers) return null;
  const wpm = DEBRIS_WPM[difficulty.id] || DEBRIS_WPM.steady;
  const chars = [...word].length + 1;
  // 5 characters a word: one character takes 12 / wpm seconds.
  const typing = (chars * 12) / wpm;
  return Math.max(MIN_APPROACH_S, REACT_S + typing / Math.max(0.5, level.pace));
}

/** What a rock did in one step. */
export type RockStep = 'waiting' | 'coming' | 'held' | 'struck';

/**
 * One rock's approach. Pure and allocation-free: the scene steps it every logic tick. `distance`
 * runs from 1 (far out) to 0 (it hits the hull). Before `release` it waits far out (the leg has
 * not begun); with no approach time (Calm) it drifts in to CALM_HOLD and waits there.
 */
export class Rock {
  distance = 1;
  /** Seconds the whole approach takes now (null: no timer). */
  time: number | null = null;
  strikes = 0;
  released = false;

  /** A new rock, far out. */
  start(time: number | null): void {
    this.distance = 1;
    this.time = time;
    this.strikes = 0;
  }

  /** The leg has begun: the rock may come in. */
  release(): void {
    this.released = true;
  }

  step(dt: number): RockStep {
    if (!this.released) return 'waiting';
    if (this.time === null) {
      // No timers: drift in to the hold distance and stay there.
      if (this.distance <= CALM_HOLD) return 'held';
      this.distance = Math.max(CALM_HOLD, this.distance - dt / 7);
      return this.distance <= CALM_HOLD ? 'held' : 'coming';
    }
    this.distance -= dt / this.time;
    if (this.distance > 0) return 'coming';
    // It hit the hull: a strike. It bounces back out, and the rest of the way is slower.
    this.strikes += 1;
    this.distance = BOUNCE;
    this.time *= BOUNCE_SLOW;
    return 'struck';
  }

  /** Back to the start of a run. */
  reset(): void {
    this.distance = 1;
    this.time = null;
    this.strikes = 0;
    this.released = false;
  }
}

// ---- the drift ---------------------------------------------------------------------------------

/** How hard the thrusters pull toward the aim, and how much the suit's stabilizers damp. */
export const THRUST_PULL = 9;
export const THRUST_DAMP = 5.2;

/**
 * Weightless drift along a leg, 0 (the last hatch) .. 1 (the next one). Every right letter moves
 * the aim forward; the apprentice floats after it with a little inertia, never past the hatch
 * and never backward. Pure and allocation-free.
 */
export class Drift {
  at = 0;
  speed = 0;
  aim = 0;

  /** A new leg, at its start. */
  reset(): void {
    this.at = 0;
    this.speed = 0;
    this.aim = 0;
  }

  /** Moves the aim (it only ever goes forward, and never past the hatch). */
  push(aim: number): void {
    const a = Number.isFinite(aim) ? Math.max(0, Math.min(1, aim)) : 0;
    if (a > this.aim) this.aim = a;
  }

  step(dt: number): void {
    if (!(dt > 0)) return;
    const d = Math.min(dt, 0.1);
    const accel = (this.aim - this.at) * THRUST_PULL - this.speed * THRUST_DAMP;
    this.speed = Math.max(0, this.speed + accel * d);
    this.at = Math.min(this.aim, this.at + this.speed * d);
    if (this.at >= this.aim) this.speed *= 0.5;
  }

  /** True once the apprentice has floated (almost) all the way to the aim. */
  get settled(): boolean {
    return this.aim - this.at < 0.01;
  }
}

/** How far along its leg the drift aims, with `typed` of the leg's `chars` characters typed. */
export function driftAim(typed: number, chars: number): number {
  if (!(chars > 0)) return 1;
  return Math.max(0, Math.min(1, typed / chars));
}

// ---- the run --------------------------------------------------------------------------------

export interface StationPlan {
  /** Every word of the run, with its capital and full stop where they belong. */
  words: readonly string[];
  /** For each word: seconds its rock takes to reach the hull (null on a drift leg, or on Calm). */
  approach: readonly (number | null)[];
  legs: readonly Leg[];
  chapters: readonly Chapter[];
  modules: number;
  /** The whole run as one line: the words with single spaces between them. */
  text: string;
  level: LevelId;
  /** False on Calm: no rock ever strikes. */
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
  // The turret's sentences end with a shout when "!" is known; everything else with a full stop.
  const order = kind === 'turret' ? ['!', '.'] : STOPS;
  return order.find((m) => keys.has(m)) ?? '';
}

/** Lays out one run. A word that is not fully learned is simply never taken. */
export function planStation(o: PlanOptions): StationPlan {
  const spelled = (w: string): boolean => w.length > 0 && [...w].every((ch) => o.keys.has(ch));
  const modules = MODULES_PER_LEVEL[o.level.id];
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
  const approach: (number | null)[] = [];
  const legs: Leg[] = [];
  outer: for (let m = 0; m < modules; m++) {
    for (const kind of ['drift', 'turret'] as const) {
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
        approach.push(kind === 'turret' ? approachSeconds(w, o.difficulty, o.level) : null);
      }
      legs.push({ kind, module: m, from, to: words.length });
    }
  }

  // Chapters by module: the first is the outer arm, the last the observatory, the rest the ring.
  const moduleCount = legs.length > 0 ? (legs.at(-1) as Leg).module + 1 : 0;
  const chapterOf = (m: number): ChapterId =>
    m === moduleCount - 1 && moduleCount > 1 ? 'observatory' : m === 0 ? 'outer' : 'ring';
  const chapters: Chapter[] = [];
  for (const leg of legs) {
    const id = chapterOf(leg.module);
    const last = chapters.at(-1);
    if (last && last.id === id) last.to = leg.to;
    else chapters.push({ id, from: leg.from, to: leg.to });
  }
  return {
    words,
    approach,
    legs,
    chapters,
    modules: moduleCount,
    text: words.join(' '),
    level: o.level.id,
    timers: o.difficulty.timers,
  };
}

/** The leg a word index is in (the last leg once the run is over); -1 for an empty plan. */
export function legAt(plan: StationPlan, index: number): number {
  for (let i = 0; i < plan.legs.length; i++) if (index < (plan.legs[i] as Leg).to) return i;
  return plan.legs.length - 1;
}

/** The chapter a word index is in (the last chapter once the run is over). */
export function chapterAt(plan: StationPlan, index: number): ChapterId {
  for (const c of plan.chapters) if (index < c.to) return c.id;
  return plan.chapters.at(-1)?.id ?? 'observatory';
}

/** The chapter that begins at this word index, if one does. */
export function chapterStartsAt(plan: StationPlan, index: number): ChapterId | null {
  return plan.chapters.find((c) => c.from === index)?.id ?? null;
}

/** Characters a leg asks for: its words and the spaces between them (and after it, but the last). */
export function legChars(plan: StationPlan, leg: Leg): number {
  let n = 0;
  for (let i = leg.from; i < leg.to; i++) n += [...(plan.words[i] as string)].length + 1;
  // The run's very last word has no space after it.
  if (leg.to >= plan.words.length) n -= 1;
  return Math.max(1, n);
}

// ---- how the sky answers ---------------------------------------------------------------------

/** Stars in the sky (all of them are lit by the end). */
export const STARS = 1800;

/** How many stars are lit after so many words (a few are always there; all at the end). */
export function starsLit(done: number, total: number): number {
  const base = 60;
  if (total <= 0 || done >= total) return STARS;
  const share = Math.max(0, Math.min(1, done / total));
  return Math.round(base + (STARS * 0.85 - base) * share);
}

/** How far (0..1) the color has come back after so many words. */
export function colorShare(done: number, total: number): number {
  if (total <= 0) return 1;
  return Math.max(0, Math.min(1, done / total));
}

/** Modules brought back online (docked and defended) after so many words. */
export function modulesOnline(plan: StationPlan, done: number): number {
  let n = 0;
  for (const leg of plan.legs) if (leg.kind === 'turret' && done >= leg.to) n += 1;
  return n;
}

/** Rocks broken before they ever struck, as a whole percent. */
export function clearPercent(cleared: number, total: number): number {
  if (total <= 0) return 100;
  return Math.round(Math.max(0, Math.min(1, cleared / total)) * 100);
}

/** Rocks in the whole run (one per turret word). */
export function rocksIn(plan: StationPlan): number {
  let n = 0;
  for (const leg of plan.legs) if (leg.kind === 'turret') n += leg.to - leg.from;
  return n;
}
