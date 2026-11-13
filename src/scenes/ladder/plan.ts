// The Ladder's climb, as plain data (no 3D here; unit-tested). Free play: a tower of letters
// rising through the clouds, climbed for as long as the hands hold on. Every floor is one short
// challenge drawn from the mechanics of the other scenes:
//
//   - steps    (the Meadow)  plain words, a breather.
//   - gale     (Hermon)      the wind tugs at the climber: the grip drains faster.
//   - lantern  (the Caves)   a cloud swallows the tower: the next word cannot be read ahead.
//   - glass    (the Scroll)  crystal rungs: a slip costs twice the grip, a clean floor pays double.
//   - long     (the Rail)    longer words.
//   - swarm    (the Arena)   ink Blots cling to the rungs: one more word, every word knocks one off.
//
// The grip is the heart of it (like the Caves' lantern): every right letter feeds it, every clean
// streak tightens it, every slip loosens it. On every difficulty but Calm it also tires while a
// floor is open, a little faster the higher one climbs (capped, so a typist at the difficulty's
// pace always holds on for a long while). When it gives out the first time, Dyo catches the
// climber; the next time he slips down onto the clouds and the run ends: that is the end of an
// endless run, and the height is banked. On Calm the grip never gives out; the player ends the
// run by resting at a landing (every fifth floor), whenever he likes. Nothing soft-locks.
//
// Before a climb the player may pick modifiers (fog, brittle rungs, long words, a steep tower);
// each multiplies the score. Scores go into a small high-score table per profile.
//
// Text is fully adaptive: words come from the learned word source (only learned letters, checked
// again here) and lean toward the player's weakest keys.

import type { Difficulty, DifficultyId } from '../../game/difficulty';
import type { Level, LevelId } from '../../game/levels';
import type { LadderRecord } from '../../save';

export const FLOOR_KINDS = ['steps', 'gale', 'lantern', 'glass', 'long', 'swarm'] as const;
export type FloorKind = (typeof FLOOR_KINDS)[number];

export const MODIFIERS = ['fog', 'brittle', 'long', 'steep'] as const;
export type ModifierId = (typeof MODIFIERS)[number];

/** A landing every this many floors: the grip is refilled and the climber may rest. */
export const LANDING_EVERY = 5;
/** The first floors are always plain steps. */
export const WARMUP_FLOORS = 2;

/** Words on a floor, per level (a swarm floor has one more). */
export const FLOOR_WORDS: Readonly<Record<LevelId, readonly [number, number]>> = {
  easy: [3, 4],
  standard: [4, 5],
  hard: [5, 6],
};

/** Score multipliers. */
export const MODIFIER_SCORE: Readonly<Record<ModifierId, number>> = {
  fog: 1.25,
  brittle: 1.25,
  long: 1.2,
  steep: 1.3,
};
export const DIFFICULTY_SCORE: Readonly<Record<DifficultyId, number>> = {
  calm: 0.6,
  steady: 1,
  swift: 1.3,
  fierce: 1.7,
  trial: 1.5,
};
export const LEVEL_SCORE: Readonly<Record<LevelId, number>> = {
  easy: 1,
  standard: 1.25,
  hard: 1.5,
};
export const KIND_SCORE: Readonly<Record<FloorKind, number>> = {
  steps: 1,
  gale: 1.2,
  lantern: 1.2,
  glass: 1.1,
  long: 1.2,
  swarm: 1.2,
};

/** True for modifiers that only mean something when the grip can tire (not on Calm). */
export function modifierNeedsTimers(id: ModifierId): boolean {
  return id === 'steep' || id === 'brittle';
}

/** The modifiers that count on this difficulty (the rest are dropped). */
export function activeModifiers(
  mods: readonly ModifierId[],
  difficulty: Pick<Difficulty, 'timers'>,
): ModifierId[] {
  const out: ModifierId[] = [];
  for (const m of MODIFIERS)
    if (mods.includes(m) && (difficulty.timers || !modifierNeedsTimers(m))) out.push(m);
  return out;
}

/** The score multiplier of a climb: difficulty × level × every modifier. */
export function scoreMultiplier(
  difficulty: DifficultyId,
  level: LevelId,
  mods: readonly ModifierId[],
): number {
  let k = (DIFFICULTY_SCORE[difficulty] ?? 1) * (LEVEL_SCORE[level] ?? 1);
  for (const m of mods) k *= MODIFIER_SCORE[m] ?? 1;
  return Math.round(k * 1000) / 1000;
}

// ---- the grip --------------------------------------------------------------------------------

export const GRIP_START = 1;
export const KEY_GAIN = 0.012;
export const STREAK_STEP = 10;
export const STREAK_GAIN = 0.08;
export const PERFECT_GAIN = 0.03;
/** A slip loosens the grip this much (harder difficulties more). */
export const SLIP: Readonly<Record<DifficultyId, number>> = {
  calm: 0.1,
  steady: 0.12,
  swift: 0.15,
  fierce: 0.19,
  trial: 0.15,
};
/** The typing speed (WPM) the tiring is measured for, per difficulty (0: it never tires). */
export const TIRE_WPM: Readonly<Record<DifficultyId, number>> = {
  calm: 0,
  steady: 9,
  swift: 16,
  fierce: 24,
  trial: 14,
};
/** How fast the grip tires (per second) at 9 WPM, pace 1, on the first floor. */
export const TIRE_BASE = 0.01;
/** Every floor climbed tires it this much faster... */
export const HEIGHT_STEP = 0.03;
/** ...up to this many times the first floor's rate. */
export const HEIGHT_CAP = 2;
/** The gale tugs this much harder; a steep tower this much. */
export const GALE_TIRE = 1.6;
export const STEEP_TIRE = 1.4;
/** Glass rungs and brittle rungs: a slip costs this many times more. */
export const GLASS_SLIP = 2;
export const BRITTLE_SLIP = 1.5;
/** On Calm the grip never sinks below this. */
export const CALM_FLOOR = 0.25;
/** After Dyo's catch the grip is this full. */
export const CAUGHT = 0.55;
/** Dyo catches the climber this many times per climb. */
export const CATCHES = 1;

/** How fast the grip tires on this floor (per second); 0 on a difficulty without timers. */
export function tireRate(
  difficulty: Pick<Difficulty, 'id' | 'timers'>,
  level: Pick<Level, 'pace'>,
  floor: number,
  kind: FloorKind,
  mods: readonly ModifierId[],
): number {
  if (!difficulty.timers) return 0;
  const wpm = TIRE_WPM[difficulty.id] || TIRE_WPM.steady;
  const height = Math.min(HEIGHT_CAP, 1 + HEIGHT_STEP * Math.max(0, floor - 1));
  let r = TIRE_BASE * (wpm / 9) * Math.max(0.5, level.pace) * height;
  if (kind === 'gale') r *= GALE_TIRE;
  if (mods.includes('steep')) r *= STEEP_TIRE;
  return r;
}

/** What a slip costs on this floor. */
export function slipCost(
  difficulty: DifficultyId,
  kind: FloorKind,
  mods: readonly ModifierId[],
): number {
  let s = SLIP[difficulty] ?? SLIP.steady;
  if (kind === 'glass') s *= GLASS_SLIP;
  if (mods.includes('brittle')) s *= BRITTLE_SLIP;
  return s;
}

export type GripEvent = 'none' | 'tighten' | 'slip' | 'caught' | 'fall';

/**
 * The climber's grip. Pure and allocation-free: the scene feeds it every judged key and steps it
 * every logic tick. 0 = the hands give out; 1 = a firm hold.
 */
export class Grip {
  value = GRIP_START;
  streak = 0;
  tightens = 0;
  /** Catches left (Dyo), and times the grip gave out. */
  catches = CATCHES;
  slips = 0;
  fallen = false;
  rate = 0;
  calm = true;
  /** The grip only tires once the floor's first key is down. */
  released = false;

  reset(calm: boolean): void {
    this.value = GRIP_START;
    this.streak = 0;
    this.tightens = 0;
    this.catches = CATCHES;
    this.slips = 0;
    this.fallen = false;
    this.rate = 0;
    this.calm = calm;
    this.released = false;
  }

  /** A new floor, tiring at this rate. */
  floor(rate: number): void {
    this.rate = Math.max(0, Number.isFinite(rate) ? rate : 0);
    this.released = false;
  }

  /** A landing: the grip is refilled. */
  landing(): void {
    this.value = GRIP_START;
  }

  private get min(): number {
    return this.calm ? CALM_FLOOR : 0;
  }

  private add(v: number): void {
    this.value = Math.max(this.min, Math.min(1, this.value + v));
  }

  key(correct: boolean, slip: number): GripEvent {
    if (this.fallen) return 'none';
    this.released = true;
    if (correct) {
      this.streak += 1;
      this.add(KEY_GAIN);
      if (this.streak % STREAK_STEP === 0) {
        this.add(STREAK_GAIN);
        this.tightens += 1;
        return 'tighten';
      }
      return 'none';
    }
    this.streak = 0;
    this.add(-Math.max(0, slip));
    if (!this.calm && this.value <= 0) return this.giveOut();
    return 'slip';
  }

  perfect(): void {
    if (!this.fallen) this.add(PERFECT_GAIN);
  }

  step(dt: number): GripEvent {
    if (this.fallen || !this.released || this.rate <= 0 || !(dt > 0)) return 'none';
    this.add(-this.rate * Math.min(dt, 0.25));
    if (!this.calm && this.value <= 0) return this.giveOut();
    return 'none';
  }

  private giveOut(): GripEvent {
    this.slips += 1;
    this.streak = 0;
    if (this.catches > 0) {
      this.catches -= 1;
      this.value = CAUGHT;
      return 'caught';
    }
    this.value = 0;
    this.fallen = true;
    return 'fall';
  }
}

// ---- the floors ------------------------------------------------------------------------------

export interface Floor {
  /** 1-based. */
  number: number;
  kind: FloorKind;
  /** Index of its first word in the climb, and one past its last. */
  from: number;
  to: number;
  /** True when a landing waits at its top. */
  landing: boolean;
}

/** The kind of floor `n`, given the previous one: never the same twice in a row. */
export function floorKind(n: number, prev: FloorKind | null, rng: () => number): FloorKind {
  if (n <= WARMUP_FLOORS) return 'steps';
  // Right after a landing, a breather.
  if ((n - 1) % LANDING_EVERY === 0) return 'steps';
  const pool = FLOOR_KINDS.filter((k) => k !== prev && k !== 'steps');
  const r = Math.max(0, Math.min(0.999, rng()));
  return pool[Math.floor(r * pool.length)] as FloorKind;
}

/** How many words after the one in hand can be read on this floor. */
export function lookahead(kind: FloorKind, level: LevelId, mods: readonly ModifierId[]): number {
  if (mods.includes('fog') || kind === 'lantern') return 0;
  return level === 'easy' ? 2 : 1;
}

export interface ClimbOptions {
  keys: ReadonlySet<string>;
  level: Level;
  difficulty: Pick<Difficulty, 'id' | 'timers'>;
  mods: readonly ModifierId[];
  /** Words for the level. */
  words: { next(): string };
  /** Longer words (long floors, the long modifier). */
  longWords: { next(): string };
  /** The player's weakest keys, weakest first: words with them are preferred. */
  weak: readonly string[];
  rng: () => number;
}

/** How many of the weak keys a word holds (each weak key counted once). */
export function weakScore(word: string, weak: readonly string[]): number {
  let n = 0;
  for (const ch of weak) if (word.includes(ch)) n += 1;
  return n;
}

/**
 * The climb: floors are laid out one at a time, as far up as the player goes. Every word is
 * spelled only with learned keys; a word that is not is simply never taken.
 */
export class Climb {
  readonly words: string[] = [];
  readonly floors: Floor[] = [];
  readonly level: LevelId;
  readonly timers: boolean;
  readonly mods: readonly ModifierId[];
  readonly multiplier: number;
  private readonly o: ClimbOptions;
  private readonly recent: string[] = [];

  constructor(o: ClimbOptions) {
    this.o = o;
    this.level = o.level.id;
    this.timers = o.difficulty.timers;
    this.mods = activeModifiers(o.mods, o.difficulty);
    this.multiplier = scoreMultiplier(o.difficulty.id, o.level.id, this.mods);
  }

  private spelled(w: string): boolean {
    return w.length > 0 && !w.includes(' ') && [...w].every((ch) => this.o.keys.has(ch));
  }

  /** One word: a few candidates are drawn, and the one with the most weak keys wins. */
  private take(long: boolean): string | null {
    const src = long ? this.o.longWords : this.o.words;
    let best: string | null = null;
    let bestScore = -1;
    let fallback: string | null = null;
    let seen = 0;
    for (let tries = 0; tries < 40 && seen < 3; tries++) {
      const w = src.next().trim();
      if (!this.spelled(w)) continue;
      if (w === this.words.at(-1)) continue;
      fallback ??= w;
      if (this.recent.includes(w)) continue;
      seen += 1;
      const s = weakScore(w, this.o.weak);
      if (s > bestScore) {
        best = w;
        bestScore = s;
      }
    }
    const w = best ?? fallback;
    if (w !== null) {
      this.recent.push(w);
      if (this.recent.length > 12) this.recent.shift();
    }
    return w;
  }

  /** Lays out the next floor. Returns null when no word can be found (no learned word at all). */
  addFloor(): Floor | null {
    const n = this.floors.length + 1;
    const prev = this.floors.at(-1)?.kind ?? null;
    const kind = floorKind(n, prev, this.o.rng);
    const [lo, hi] = FLOOR_WORDS[this.level];
    const r = Math.max(0, Math.min(0.999, this.o.rng()));
    const count = lo + Math.floor(r * (hi - lo + 1)) + (kind === 'swarm' ? 1 : 0);
    const long = kind === 'long' || this.mods.includes('long');
    const from = this.words.length;
    for (let i = 0; i < count; i++) {
      const w = this.take(long) ?? (long ? this.take(false) : null);
      if (w !== null) this.words.push(w);
    }
    if (this.words.length === from) return null;
    const floor: Floor = {
      number: n,
      kind,
      from,
      to: this.words.length,
      landing: n % LANDING_EVERY === 0,
    };
    this.floors.push(floor);
    return floor;
  }

  /** Makes sure the climb holds at least `index + 1` words (laying out more floors as needed). */
  ensure(index: number): boolean {
    let guard = 0;
    while (this.words.length <= index && guard++ < index + 50) if (!this.addFloor()) return false;
    return this.words.length > index;
  }

  /** The floor a word index is on (0-based into `floors`). */
  floorAt(index: number): number {
    for (let i = this.floors.length - 1; i >= 0; i--)
      if (index >= (this.floors[i] as Floor).from) return i;
    return 0;
  }

  /** Characters a floor asks for: its words and the spaces after them. */
  floorChars(i: number): number {
    const f = this.floors[i];
    if (!f) return 1;
    let n = 0;
    for (let k = f.from; k < f.to; k++) n += [...(this.words[k] as string)].length + 1;
    return Math.max(1, n);
  }

  tire(floor: Floor): number {
    return tireRate(this.o.difficulty, this.o.level, floor.number, floor.kind, this.mods);
  }

  slip(floor: Floor): number {
    return slipCost(this.o.difficulty.id, floor.kind, this.mods);
  }

  lookahead(floor: Floor): number {
    return lookahead(floor.kind, this.level, this.mods);
  }
}

/** A text source for the typing driver that reads the climb word by word, forever. */
export function climbSource(climb: Climb): { next(): string } {
  let i = 0;
  return {
    next(): string {
      if (!climb.ensure(i)) return climb.words.at(-1) ?? '';
      const w = climb.words[i] as string;
      i += 1;
      return w;
    },
  };
}

// ---- the score -------------------------------------------------------------------------------

/** Points for a finished word. */
export function wordPoints(
  word: string,
  tier: number,
  kind: FloorKind,
  multiplier: number,
): number {
  const letters = [...word].length;
  const t = Math.max(0, Math.min(4, Math.floor(tier)));
  return Math.round(letters * 10 * (1 + t * 0.1) * KIND_SCORE[kind] * multiplier);
}

/** Points for reaching the top of a floor; a clean floor pays more (glass pays double). */
export function floorPoints(
  n: number,
  kind: FloorKind,
  clean: boolean,
  multiplier: number,
): number {
  const base = 100 + 20 * Math.max(0, n - 1);
  const bonus = clean ? (kind === 'glass' ? 2 : 1.5) : 1;
  return Math.round(base * bonus * KIND_SCORE[kind] * multiplier);
}

// ---- high scores -----------------------------------------------------------------------------

/** One row of the table (kept in the profile; see src/save/schema.ts). */
export type LadderScore = LadderRecord;

/** Rows kept in the table. */
export const TABLE_SIZE = 10;

/** Inserts a score, best first; returns the new table and the row's place (-1: not kept). */
export function addScore(
  table: readonly LadderScore[],
  entry: LadderScore,
): { table: LadderScore[]; place: number } {
  const next = [...table, entry].sort(
    (a, b) => b.score - a.score || b.floors - a.floors || a.at - b.at,
  );
  const kept = next.slice(0, TABLE_SIZE);
  return { table: kept, place: kept.indexOf(entry) };
}

/** 0..1: how much color the sky has after so many floors (fully restored by the tenth). */
export function colorAt(floorsDone: number): number {
  return Math.max(0, Math.min(1, floorsDone / 10));
}
