// The Jaffa Line's run, as plain data (no 3D here; unit-tested). The Line is a race: the
// apprentice's train and Naftali's run side by side up from the coast to the hills. Every stretch
// of track is one short word. Typing a stretch clean builds boost; boost carries the train through
// the bend that follows every third stretch, and a train carried through a bend gains on Naftali.
//
// Every character is one the player has already learned (ARCHITECTURE section 8): words come from
// the learned word source and are checked again here, so the run can never ask for a key that was
// not taught. There are no timers and nothing counts down; a slip only costs boost.

import type { LevelId } from '../../game/levels';

export const CHAPTER_IDS = ['coast', 'plain', 'hills'] as const;
export type ChapterId = (typeof CHAPTER_IDS)[number];

export interface Chapter {
  id: ChapterId;
  /** Index of its first stretch, and one past its last. */
  from: number;
  to: number;
}

/** Station lamps along the line (and sections of the run). */
export const SECTIONS = 4;

/** Stretches per level (always a multiple of SECTIONS). */
export const STRETCHES_PER_LEVEL: Readonly<Record<LevelId, number>> = {
  easy: 8,
  standard: 12,
  hard: 16,
};

/** A bend follows every third stretch. */
export const BEND_EVERY = 3;
/** Boost needed to carry the train through a bend (0..1). */
export const BEND_BOOST = 0.5;
/** Boost a clean stretch adds, and what a slip takes away. */
export const BOOST_UP = 0.34;
export const BOOST_DOWN = 0.5;
/** How many stretches Naftali may lead or trail by at most. */
export const LEAD_LIMIT = 3;

export interface Stretch {
  word: string;
  /** True when a bend follows this stretch. */
  bend: boolean;
}

export interface RailPlan {
  stretches: readonly Stretch[];
  /** The whole run as one line: the words with single spaces between them. */
  text: string;
  chapters: readonly Chapter[];
  /** Bends in the whole run. */
  bends: number;
  level: LevelId;
}

export interface PlanOptions {
  /** The learned keys (every word is checked against them). */
  keys: ReadonlySet<string>;
  level: LevelId;
  /** Learned words of the level's lengths (`levelWordSource`). */
  words: { next(): string };
  /** A random number in [0, 1) (kept for symmetry with the other scenes). */
  rng: () => number;
}

/** True when the stretch at this index is followed by a bend (never the last one). */
export function bendAfter(index: number, total: number): boolean {
  return (index + 1) % BEND_EVERY === 0 && index < total - 1;
}

/** Lays out one run. A word that is not fully learned is simply never taken. */
export function planRail(o: PlanOptions): RailPlan {
  const spelled = (w: string): boolean => w.length > 0 && [...w].every((ch) => o.keys.has(ch));
  const count = STRETCHES_PER_LEVEL[o.level];
  const words: string[] = [];
  let tries = 0;
  while (words.length < count && tries < count * 14) {
    tries += 1;
    const w = o.words.next().trim();
    // Never the same word twice in a row, never a key that was not learned, never a space.
    if (!spelled(w) || w.includes(' ') || w === words.at(-1)) continue;
    words.push(w);
  }
  const stretches: Stretch[] = words.map((word, i) => ({
    word,
    bend: bendAfter(i, words.length),
  }));
  const chapters: Chapter[] = [];
  const a = Math.round(stretches.length * 0.25);
  const b = Math.round(stretches.length * 0.75);
  if (a > 0) chapters.push({ id: 'coast', from: 0, to: a });
  if (b > a) chapters.push({ id: 'plain', from: a, to: b });
  if (stretches.length > b) chapters.push({ id: 'hills', from: b, to: stretches.length });
  return {
    stretches,
    text: stretches.map((s) => s.word).join(' '),
    chapters,
    bends: stretches.filter((s) => s.bend).length,
    level: o.level,
  };
}

/** The chapter a stretch index is in (the last chapter once the run is over). */
export function chapterAt(plan: RailPlan, index: number): ChapterId {
  for (const c of plan.chapters) if (index < c.to) return c.id;
  return plan.chapters.at(-1)?.id ?? 'hills';
}

/** The chapter that begins at this index, if one does. */
export function chapterStartsAt(plan: RailPlan, index: number): ChapterId | null {
  return plan.chapters.find((c) => c.from === index)?.id ?? null;
}

// ---- boost and the race ---------------------------------------------------------------------

/** Boost after a stretch: a clean one adds to it, a stretch with a slip takes a good part away. */
export function boostAfter(boost: number, clean: boolean): number {
  return clean ? Math.min(1, boost + BOOST_UP) : Math.max(0, boost - BOOST_DOWN);
}

/** True when the boost is enough to carry the train through a bend. */
export function bendCarried(boost: number): boolean {
  return boost >= BEND_BOOST;
}

/**
 * The lead over Naftali, in stretches (positive: the apprentice is ahead). Every stretch moves it
 * a little, and a bend moves it a lot: carried at speed it gains, taken slowly it loses.
 */
export function leadAfter(lead: number, clean: boolean, bend: boolean, carried: boolean): number {
  let next = lead + (clean ? 0.1 : -0.1);
  if (bend) next += carried ? 0.6 : -0.4;
  return Math.max(-LEAD_LIMIT, Math.min(LEAD_LIMIT, next));
}

/** The race is won with a lead of nothing or better (a tie goes to the apprentice). */
export function raceWon(lead: number): boolean {
  return lead >= 0;
}

// ---- how the line answers -------------------------------------------------------------------

/** Station lamps lit after so many stretches (0..SECTIONS; all at the end). */
export function lampsLit(done: number, total: number): number {
  if (total <= 0) return SECTIONS;
  if (done >= total) return SECTIONS;
  return Math.max(0, Math.min(SECTIONS, Math.floor((done * SECTIONS) / total)));
}

/** How far (0..1) the color has spread along the line after so many stretches. */
export function colorShare(done: number, total: number): number {
  if (total <= 0) return 1;
  return Math.max(0, Math.min(1, done / total));
}
