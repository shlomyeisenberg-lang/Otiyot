// The Sunken Geniza's run, as plain data (no 3D here; unit-tested). The Geniza is a flooded
// archive, and the pages of its old books lie on stone lecterns along the floor of the hall. Every
// page is one short word. The water moves with a tide, and the tide follows the player's own pace:
// keys typed at an even beat open a current that lifts the page up through the light to the
// surface, while a sudden burst of fast keys stirs the silt. Steadiness, not speed, is what counts.
//
// Every character is one the player has already learned (ARCHITECTURE section 8): words come from
// the learned word source and are checked again here, so the run can never ask for a key that was
// not taught. There are no timers and nothing counts down; an uneven page is still lifted, only
// slowly, and the run always reaches its end.

import type { LevelId } from '../../game/levels';

export const CHAPTER_IDS = ['shallows', 'stacks', 'vault'] as const;
export type ChapterId = (typeof CHAPTER_IDS)[number];

export interface Chapter {
  id: ChapterId;
  /** Index of its first page, and one past its last. */
  from: number;
  to: number;
}

/** Shafts of light that open over the hall (and sections of the run). */
export const SECTIONS = 4;

/** Pages per level (always a multiple of SECTIONS). */
export const PAGES_PER_LEVEL: Readonly<Record<LevelId, number>> = {
  easy: 8,
  standard: 12,
  hard: 16,
};

// ---- the tide -------------------------------------------------------------------------------

/** The tide's first guess of the player's beat, in ms between keys. */
export const TIDE_START_MS = 420;
/** The tide's beat never gets faster or slower than this. */
export const TIDE_MIN_MS = 90;
export const TIDE_MAX_MS = 1600;
/** A gap longer than this is a rest (a breath between words), not part of the rhythm. */
export const REST_MS = 2200;
/** How much one key moves the tide toward the player's pace (0..1). */
export const TIDE_FOLLOW = 0.18;
/** A key faster than this share of the tide's beat is a burst: it stirs the silt. */
export const BURST_RATIO = 0.5;
/** Average drift from the beat (as a share of it) at which a page counts as not steady at all. */
export const DRIFT_LIMIT = 0.6;
/** Steadiness a page needs to open the current. */
export const STEADY = 0.6;

/** Current: how strongly the water lifts (0..1). */
export const CURRENT_UP = 0.34;
export const CURRENT_DOWN = 0.3;
/** Current needed to carry a page up whole, in gold. */
export const LIFT_CURRENT = 0.5;
/** Silt (0..1): what one burst stirs, and what a steady page settles. */
export const SILT_PER_BURST = 0.16;
export const SILT_SETTLE = 0.3;

/** What one key did to the tide. */
export type Beat = 'rest' | 'steady' | 'burst';

/** The page's verdict once its word is done. */
export interface PageBeat {
  /** 0..1: how evenly its keys followed the tide. */
  steadiness: number;
  /** Keys typed in a sudden rush. */
  bursts: number;
}

/**
 * The tide: follows the player's own beat (a slow moving average of the gaps between keys) and
 * judges every key against it. Pure and allocation-free: the scene calls `key` on every key.
 */
export class Tide {
  /** The beat the water moves at now, in ms between keys. */
  period = TIDE_START_MS;
  private drift = 0;
  private keys = 0;
  private burstsNow = 0;

  /** Judges a key typed `ms` after the last one (null for the first key of a run). */
  key(ms: number | null): Beat {
    if (ms === null || !Number.isFinite(ms) || ms <= 0 || ms > REST_MS) return 'rest';
    const p = this.period;
    this.drift += Math.min(1, Math.abs(ms - p) / p);
    this.keys += 1;
    const burst = ms < p * BURST_RATIO;
    if (burst) this.burstsNow += 1;
    // The tide follows the player, slowly: one fast key barely moves it.
    this.period = Math.max(TIDE_MIN_MS, Math.min(TIDE_MAX_MS, p + (ms - p) * TIDE_FOLLOW));
    return burst ? 'burst' : 'steady';
  }

  /** Steadiness of the page so far (1 when no key could be judged yet). */
  get steadiness(): number {
    return steadinessOf(this.drift, this.keys);
  }

  get bursts(): number {
    return this.burstsNow;
  }

  /** Closes the page: returns its verdict into `out` and starts the next page fresh. */
  endPage(out: PageBeat): PageBeat {
    out.steadiness = this.steadiness;
    out.bursts = this.burstsNow;
    this.drift = 0;
    this.keys = 0;
    this.burstsNow = 0;
    return out;
  }

  /** Back to the start of a run. */
  reset(): void {
    this.period = TIDE_START_MS;
    this.drift = 0;
    this.keys = 0;
    this.burstsNow = 0;
  }
}

/** Steadiness (0..1) from the summed drift of `keys` keys. */
export function steadinessOf(drift: number, keys: number): number {
  if (keys <= 0) return 1;
  const avg = drift / keys;
  return Math.max(0, Math.min(1, 1 - avg / DRIFT_LIMIT));
}

/** True when a page was typed steadily and clean, so it opens the current. */
export function pageSteady(beat: PageBeat, clean: boolean): boolean {
  return clean && beat.bursts === 0 && beat.steadiness >= STEADY;
}

/** Current after a page: a steady page opens it, an uneven one lets it ebb. */
export function currentAfter(current: number, steady: boolean): number {
  return steady ? Math.min(1, current + CURRENT_UP) : Math.max(0, current - CURRENT_DOWN);
}

/** True when the current is strong enough to carry a page up whole. */
export function liftedWhole(current: number): boolean {
  return current >= LIFT_CURRENT;
}

/** Silt after a page: bursts stir it up, a steady page lets it settle. */
export function siltAfter(silt: number, bursts: number, steady: boolean): number {
  const next = silt + bursts * SILT_PER_BURST - (steady ? SILT_SETTLE : 0);
  return Math.max(0, Math.min(1, next));
}

// ---- the run --------------------------------------------------------------------------------

export interface Page {
  word: string;
}

export interface GenizaPlan {
  pages: readonly Page[];
  /** The whole run as one line: the words with single spaces between them. */
  text: string;
  chapters: readonly Chapter[];
  level: LevelId;
}

export interface PlanOptions {
  /** The learned keys (every word is checked against them). */
  keys: ReadonlySet<string>;
  level: LevelId;
  /** Learned words of the level's lengths (`levelWordSource`). */
  words: { next(): string };
}

/** Lays out one run. A word that is not fully learned is simply never taken. */
export function planGeniza(o: PlanOptions): GenizaPlan {
  const spelled = (w: string): boolean => w.length > 0 && [...w].every((ch) => o.keys.has(ch));
  const count = PAGES_PER_LEVEL[o.level];
  const words: string[] = [];
  let tries = 0;
  while (words.length < count && tries < count * 14) {
    tries += 1;
    const w = o.words.next().trim();
    // Never the same word twice in a row, never a key that was not learned, never a space.
    if (!spelled(w) || w.includes(' ') || w === words.at(-1)) continue;
    words.push(w);
  }
  const pages: Page[] = words.map((word) => ({ word }));
  const chapters: Chapter[] = [];
  const a = Math.round(pages.length * 0.25);
  const b = Math.round(pages.length * 0.75);
  if (a > 0) chapters.push({ id: 'shallows', from: 0, to: a });
  if (b > a) chapters.push({ id: 'stacks', from: a, to: b });
  if (pages.length > b) chapters.push({ id: 'vault', from: b, to: pages.length });
  return {
    pages,
    text: pages.map((p) => p.word).join(' '),
    chapters,
    level: o.level,
  };
}

/** The chapter a page index is in (the last chapter once the run is over). */
export function chapterAt(plan: GenizaPlan, index: number): ChapterId {
  for (const c of plan.chapters) if (index < c.to) return c.id;
  return plan.chapters.at(-1)?.id ?? 'vault';
}

/** The chapter that begins at this index, if one does. */
export function chapterStartsAt(plan: GenizaPlan, index: number): ChapterId | null {
  return plan.chapters.find((c) => c.from === index)?.id ?? null;
}

// ---- how the archive answers ----------------------------------------------------------------

/** Shafts of light open after so many pages (0..SECTIONS; all at the end). */
export function shaftsOpen(done: number, total: number): number {
  if (total <= 0) return SECTIONS;
  if (done >= total) return SECTIONS;
  return Math.max(0, Math.min(SECTIONS, Math.floor((done * SECTIONS) / total)));
}

/** How far (0..1) the color has come back after so many pages. */
export function colorShare(done: number, total: number): number {
  if (total <= 0) return 1;
  return Math.max(0, Math.min(1, done / total));
}

/** Average steadiness of a run, as a whole percent (100 when no page was judged). */
export function steadyPercent(sum: number, pages: number): number {
  if (pages <= 0) return 100;
  return Math.round(Math.max(0, Math.min(1, sum / pages)) * 100);
}
