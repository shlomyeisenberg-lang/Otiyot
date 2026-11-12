// Atbash City's run, as plain data (no 3D here; unit-tested). A rainy neon district of
// code-breakers. The Fading has scrambled every sign in the city into atbash (the alphabet turned
// backward: alef for tav, bet for shin, a for z, b for y) and shut the vault gates of its streets;
// grey patrol drones sweep the rain with their searchlights. The apprentice breaks the codes one
// gate at a time. Every gate is two legs:
//
//   CIPHER   - the gate's neon sign shows its code in atbash. The plain words are shown to type
//              (a typing tutor never hides what to type); every right letter flips one neon letter
//              back to its true face.
//   SEQUENCE - the vault's tumbler plays a short pattern of two codes (A B A B, A B B A, ...) and
//              the apprentice types it back in order; each word turns one ring of the lock. The
//              repetition is the memory part: the same two codes, in a pattern to hold in mind.
//
// When a leg begins, the gate's patrol drone leaves on its round. Finish the leg before it comes
// back and the apprentice is never seen. If it comes back first its light finds him: spotted (the
// streak drops), and it goes round again, slower. Calm has no timers: the drone circles far off.
// Nothing is lost and the run always reaches its end.
//
// Every character is one the player has already learned (ARCHITECTURE section 8): words come from
// the learned word source and are checked again here. The atbash face on the signs is only drawn,
// never typed, so it may show any letter.

import type { Difficulty, DifficultyId } from '../../game/difficulty';
import type { Level, LevelId } from '../../game/levels';

export const CHAPTER_IDS = ['market', 'towers', 'vault'] as const;
export type ChapterId = (typeof CHAPTER_IDS)[number];

export type LegKind = 'cipher' | 'sequence';

export interface Leg {
  kind: LegKind;
  /** The gate this leg opens. */
  gate: number;
  /** Index of its first word, and one past its last. */
  from: number;
  to: number;
  /** Seconds the patrol takes to come back (null on Calm: it never does). */
  patrol: number | null;
}

export interface Chapter {
  id: ChapterId;
  from: number;
  to: number;
}

/** Gates per level; the last one is always the great vault. */
export const GATES_PER_LEVEL: Readonly<Record<LevelId, number>> = {
  easy: 3,
  standard: 4,
  hard: 5,
};

/** Words in a cipher code (shortest, longest). */
export const CIPHER_WORDS: Readonly<Record<LevelId, readonly [number, number]>> = {
  easy: [2, 2],
  standard: [2, 3],
  hard: [3, 4],
};

/** The patterns a sequence can take (0 = the first code, 1 = the second), per level. */
export const PATTERNS: Readonly<Record<LevelId, readonly (readonly number[])[]>> = {
  easy: [
    [0, 1, 0],
    [0, 0, 1],
  ],
  standard: [
    [0, 1, 0, 1],
    [0, 1, 1, 0],
    [0, 0, 1, 1],
  ],
  hard: [
    [0, 1, 0, 1, 0],
    [0, 1, 1, 0, 1],
    [0, 0, 1, 0, 1],
  ],
};

// ---- the alphabet turned backward -------------------------------------------------------------

const HEBREW = 'אבגדהוזחטיכלמנסעפצקרשת';
const FINALS: Readonly<Record<string, string>> = { ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' };
const LATIN = 'abcdefghijklmnopqrstuvwxyz';

/**
 * One letter in atbash: the first letter of its alphabet for the last, the second for the one
 * before it, and so on. A final Hebrew letter counts as its plain form. Case is kept. Anything
 * else (digits, marks, spaces) stays as it is.
 */
export function atbashLetter(ch: string): string {
  const base = FINALS[ch] ?? ch;
  const h = HEBREW.indexOf(base);
  if (h >= 0) return HEBREW[HEBREW.length - 1 - h] as string;
  const low = ch.toLowerCase();
  const l = LATIN.indexOf(low);
  if (l >= 0) {
    const out = LATIN[LATIN.length - 1 - l] as string;
    return low === ch ? out : out.toUpperCase();
  }
  return ch;
}

/** A whole word in atbash, letter by letter. */
export function atbash(word: string): string {
  let out = '';
  for (const ch of word) out += atbashLetter(ch);
  return out;
}

// ---- the patrol -------------------------------------------------------------------------------

/**
 * The typing speed (WPM) a patrol's round is measured for, per difficulty. Gentle: the round
 * also gives a moment to read the code first (REACT_S), so a typist at this pace always wins.
 */
export const PATROL_WPM: Readonly<Record<DifficultyId, number>> = {
  calm: 0,
  steady: 9,
  swift: 16,
  fierce: 24,
  trial: 14,
};
/** Seconds to read the code before the round counts against the typing. */
export const REACT_S = 3;
/** No round is shorter than this. */
export const MIN_ROUND_S = 6;
/** A drone that spotted the apprentice goes back out to this far... */
export const BOUNCE = 0.55;
/** ...and comes round the rest of the way this much slower. */
export const BOUNCE_SLOW = 1.4;
/** On Calm the drone keeps this far off (1 = the far end of its round, 0 = right overhead). */
export const CALM_HOLD = 0.7;

/**
 * Seconds a patrol takes to come back while the apprentice types `chars` characters, or null on a
 * difficulty without timers.
 */
export function patrolSeconds(
  chars: number,
  difficulty: Pick<Difficulty, 'id' | 'timers'>,
  level: Pick<Level, 'pace'>,
): number | null {
  if (!difficulty.timers) return null;
  const wpm = PATROL_WPM[difficulty.id] || PATROL_WPM.steady;
  const typing = (Math.max(1, chars) * 12) / wpm;
  return Math.max(MIN_ROUND_S, REACT_S + typing / Math.max(0.5, level.pace));
}

export type PatrolStep = 'waiting' | 'out' | 'held' | 'spotted';

/**
 * One drone's round. Pure and allocation-free: the scene steps it every logic tick. `away` runs
 * from 1 (the far end of its round) to 0 (back overhead). It starts out at 1 and comes back once
 * released; with no time (Calm) it drifts to CALM_HOLD and circles there.
 */
export class Patrol {
  away = 1;
  time: number | null = null;
  spotted = 0;
  released = false;

  start(time: number | null): void {
    this.away = 1;
    this.time = time;
    this.spotted = 0;
    this.released = false;
  }

  release(): void {
    this.released = true;
  }

  step(dt: number): PatrolStep {
    if (!this.released) return 'waiting';
    if (this.time === null) {
      if (this.away <= CALM_HOLD) return 'held';
      this.away = Math.max(CALM_HOLD, this.away - dt / 8);
      return this.away <= CALM_HOLD ? 'held' : 'out';
    }
    this.away -= dt / this.time;
    if (this.away > 0) return 'out';
    this.spotted += 1;
    this.away = BOUNCE;
    this.time *= BOUNCE_SLOW;
    return 'spotted';
  }

  reset(): void {
    this.away = 1;
    this.time = null;
    this.spotted = 0;
    this.released = false;
  }
}

// ---- the run ----------------------------------------------------------------------------------

export interface AtbashPlan {
  words: readonly string[];
  /** For each word, its atbash face (what the neon shows before it is broken). */
  cipher: readonly string[];
  legs: readonly Leg[];
  chapters: readonly Chapter[];
  gates: number;
  text: string;
  level: LevelId;
  timers: boolean;
}

export interface PlanOptions {
  keys: ReadonlySet<string>;
  level: Level;
  difficulty: Pick<Difficulty, 'id' | 'timers'>;
  /** Learned words of the level's lengths (`levelWordSource`). */
  words: { next(): string };
  rng: () => number;
}

/** Characters a run of words asks for: the words and a space after each (but the run's last). */
export function charsOf(words: readonly string[], last: boolean): number {
  let n = 0;
  for (const w of words) n += [...w].length + 1;
  return Math.max(1, last ? n - 1 : n);
}

/** Lays out one run. A word that is not fully learned is never taken. */
export function planAtbash(o: PlanOptions): AtbashPlan {
  const spelled = (w: string): boolean => w.length > 0 && [...w].every((ch) => o.keys.has(ch));
  const gates = GATES_PER_LEVEL[o.level.id];
  const [lo, hi] = CIPHER_WORDS[o.level.id];
  const patterns = PATTERNS[o.level.id];
  const used = new Set<string>();
  const pick = (r: number, n: number): number => Math.floor(Math.max(0, Math.min(0.999, r)) * n);
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
  const legs: Leg[] = [];
  const pending: { kind: LegKind; gate: number; list: string[] }[] = [];
  outer: for (let g = 0; g < gates; g++) {
    // The cipher: a few learned words, never the same twice in a row.
    const n = lo + pick(o.rng(), hi - lo + 1);
    const code: string[] = [];
    for (let i = 0; i < n; i++) {
      const w = take(code.at(-1) ?? pending.at(-1)?.list.at(-1));
      if (w !== null) code.push(w);
    }
    if (code.length === 0) break outer;
    pending.push({ kind: 'cipher', gate: g, list: code });
    // The sequence: two codes in a pattern. With one word only it is that word, more than once
    // never twice in a row unless nothing else is learned.
    const a = take(code.at(-1));
    if (a === null) break outer;
    const b = take(a) ?? a;
    const pattern = patterns[pick(o.rng(), patterns.length)] as readonly number[];
    pending.push({ kind: 'sequence', gate: g, list: pattern.map((k) => (k === 0 ? a : b)) });
  }
  for (let i = 0; i < pending.length; i++) {
    const p = pending[i] as (typeof pending)[number];
    const from = words.length;
    words.push(...p.list);
    const last = i === pending.length - 1;
    legs.push({
      kind: p.kind,
      gate: p.gate,
      from,
      to: words.length,
      patrol: patrolSeconds(charsOf(p.list, last), o.difficulty, o.level),
    });
  }

  const gateCount = legs.length > 0 ? (legs.at(-1) as Leg).gate + 1 : 0;
  const chapterOf = (g: number): ChapterId =>
    g === gateCount - 1 && gateCount > 1 ? 'vault' : g === 0 ? 'market' : 'towers';
  const chapters: Chapter[] = [];
  for (const leg of legs) {
    const id = chapterOf(leg.gate);
    const lastC = chapters.at(-1);
    if (lastC && lastC.id === id) lastC.to = leg.to;
    else chapters.push({ id, from: leg.from, to: leg.to });
  }
  return {
    words,
    cipher: words.map(atbash),
    legs,
    chapters,
    gates: gateCount,
    text: words.join(' '),
    level: o.level.id,
    timers: o.difficulty.timers,
  };
}

/** The leg a word index is in (the last leg once the run is over); -1 for an empty plan. */
export function legAt(plan: AtbashPlan, index: number): number {
  for (let i = 0; i < plan.legs.length; i++) if (index < (plan.legs[i] as Leg).to) return i;
  return plan.legs.length - 1;
}

export function chapterAt(plan: AtbashPlan, index: number): ChapterId {
  for (const c of plan.chapters) if (index < c.to) return c.id;
  return plan.chapters.at(-1)?.id ?? 'vault';
}

export function chapterStartsAt(plan: AtbashPlan, index: number): ChapterId | null {
  return plan.chapters.find((c) => c.from === index)?.id ?? null;
}

/** How far (0..1) the color has come back after so many words. */
export function colorShare(done: number, total: number): number {
  if (total <= 0) return 1;
  return Math.max(0, Math.min(1, done / total));
}

/** Gates opened (both legs done) after so many words. */
export function gatesOpen(plan: AtbashPlan, done: number): number {
  let n = 0;
  for (const leg of plan.legs) if (leg.kind === 'sequence' && done >= leg.to) n += 1;
  return n;
}

/** Signs in the city (every one is lit at the end). */
export const SIGNS = 48;

/** Signs lit after so many words (a few still flicker from the start; all at the end). */
export function signsLit(done: number, total: number): number {
  const base = 3;
  if (total <= 0 || done >= total) return SIGNS;
  const share = Math.max(0, Math.min(1, done / total));
  return Math.round(base + (SIGNS * 0.85 - base) * share);
}

/**
 * The neon face of a word with `typed` of its letters broken: the broken ones in their true face,
 * the rest still in atbash.
 */
export function neonFace(word: string, typed: number): string[] {
  const out: string[] = [];
  let i = 0;
  for (const ch of word) {
    out.push(i < typed ? ch : atbashLetter(ch));
    i++;
  }
  return out;
}
