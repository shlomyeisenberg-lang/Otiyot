// The Cliffs of Ein Gedi's run, as plain data (no 3D here; unit-tested). A run is one fixed text
// of three chapters, typed once from start to finish with no timers. Every word is one stepping
// stone over the canyon. A word that lives mostly on the top row makes the scribe reach UP (the
// next stone stands higher), a word that lives mostly on the bottom row makes him reach DOWN
// (the next stone stands lower), and a home-row word is a level step. The run is cut into four
// sections; when a section's last word is typed, its waterfall starts to flow again.
//
// Every word is spelled only with keys the player has already learned (ARCHITECTURE section 8).
// A player who has not learned the top or bottom row yet gets level steps only: the run is
// always completable.

import { KEYS, LAYOUTS, type KeyRow, type LayoutId } from '../../core/layouts';
import type { LevelId } from '../../game/levels';

export const CHAPTER_IDS = ['ledge', 'canyon', 'summit'] as const;
export type ChapterId = (typeof CHAPTER_IDS)[number];

export interface Chapter {
  id: ChapterId;
  /** Index of its first word, and one past its last. */
  from: number;
  to: number;
}

/** Which way the scribe reaches for a word. */
export type Reach = 'up' | 'level' | 'down';

/** Waterfalls (and sections of the run). */
export const SECTIONS = 4;

/** Words per level (always a multiple of SECTIONS). */
export const WORDS_PER_LEVEL: Readonly<Record<LevelId, number>> = {
  easy: 12,
  standard: 16,
  hard: 20,
};

/** How much one step up or down moves the next stone, and how far the stones may climb. */
export const STEP = 0.8;
export const STONE_MIN = -2.4;
export const STONE_MAX = 2.8;

export interface CliffsPlan {
  words: readonly string[];
  /** How the scribe reaches for each word. */
  reaches: readonly Reach[];
  /** Height of the stone the scribe stands on after each word; `heights[0]` is the first stone. */
  heights: readonly number[];
  /** The whole run as one line: the words with single spaces between them. */
  text: string;
  chapters: readonly Chapter[];
  /** Letters in all the words together (spaces not counted). */
  letters: number;
  level: LevelId;
}

const rowCache = new Map<LayoutId, Map<string, KeyRow>>();

/** The keyboard row a character lives on in this layout (null when it is on no letter row). */
export function rowOf(layout: LayoutId, char: string): KeyRow | null {
  let map = rowCache.get(layout);
  if (!map) {
    map = new Map();
    for (const [code, ch] of Object.entries(LAYOUTS[layout].base)) {
      const info = KEYS[code];
      if (info && ch && !map.has(ch)) map.set(ch, info.row);
    }
    rowCache.set(layout, map);
  }
  return map.get(char) ?? null;
}

/** Up when the top row weighs more than the bottom row in the word, down when less, else level. */
export function reachOf(layout: LayoutId, word: string): Reach {
  let top = 0;
  let bottom = 0;
  for (const ch of word) {
    const row = rowOf(layout, ch);
    if (row === 'top') top += 1;
    else if (row === 'bottom') bottom += 1;
  }
  return top > bottom ? 'up' : bottom > top ? 'down' : 'level';
}

/** The heights of the stones for a list of reaches: each step moves one STEP, kept in range. */
export function stoneHeights(reaches: readonly Reach[]): number[] {
  const out: number[] = [0];
  let y = 0;
  for (const r of reaches) {
    const dy = r === 'up' ? STEP : r === 'down' ? -STEP : 0;
    y = Math.max(STONE_MIN, Math.min(STONE_MAX, y + dy));
    out.push(y);
  }
  return out;
}

export interface PlanOptions {
  layout: LayoutId;
  /** The learned keys (the words are checked against them). */
  keys: ReadonlySet<string>;
  level: LevelId;
  /** Learned words of the level's lengths (`levelWordSource`). */
  words: { next(): string };
}

/** How many words are drawn from the source for each stone, to pick the best-fitting one. */
export const CANDIDATES = 8;

/**
 * How well a word's reach fits the run so far (lower is better). It keeps the climb varied and
 * playable: in English most words hold a top-row vowel, so taking words as they come made the
 * scribe climb to the top and then stand still on flat stones (the "reach up" never showed).
 * This turns the run back down before the stones reach their limit, avoids three of the same
 * reach in a row, and favours the reach used least so far, so both rows get practised.
 */
export function reachCost(
  r: Reach,
  y: number,
  recent: readonly Reach[],
  used: Record<Reach, number>,
): number {
  const dy = r === 'up' ? STEP : r === 'down' ? -STEP : 0;
  const ny = y + dy;
  let cost = 0;
  // A step that would push past the limits does not move the stone at all: avoid it strongly,
  // and lean away from the edges before getting there.
  if (ny > STONE_MAX + 1e-6 || ny < STONE_MIN - 1e-6) cost += 10;
  else if (ny > STONE_MAX - STEP + 1e-6 || ny < STONE_MIN + STEP - 1e-6) cost += 2;
  if (recent.length >= 2 && recent.at(-1) === r && recent.at(-2) === r) cost += 4;
  cost += used[r] * 0.5;
  return cost;
}

/** Lays out one run. Throws nothing: a word with an unlearned key is simply never taken. */
export function planCliffs(o: PlanOptions): CliffsPlan {
  const allowed = (w: string): boolean => w.length > 0 && [...w].every((ch) => o.keys.has(ch));
  const count = WORDS_PER_LEVEL[o.level];
  const words: string[] = [];
  const picked: Reach[] = [];
  const used: Record<Reach, number> = { up: 0, level: 0, down: 0 };
  let y = 0;
  let tries = 0;
  const budget = count * 14 * CANDIDATES;
  while (words.length < count && tries < budget) {
    // Draw a few learned words and keep the one whose reach fits the climb best.
    let best = '';
    let bestReach: Reach = 'level';
    let bestCost = Infinity;
    let drawn = 0;
    while (drawn < CANDIDATES && tries < budget) {
      tries += 1;
      const w = o.words.next().trim();
      // Never the same word twice in a row, and never a key that was not learned.
      if (!allowed(w) || w === words.at(-1)) continue;
      drawn += 1;
      const r = reachOf(o.layout, w);
      const c = reachCost(r, y, picked, used) + (words.includes(w) ? 1 : 0);
      if (c < bestCost) {
        best = w;
        bestReach = r;
        bestCost = c;
      }
    }
    if (!best) break;
    words.push(best);
    picked.push(bestReach);
    used[bestReach] += 1;
    y = Math.max(
      STONE_MIN,
      Math.min(STONE_MAX, y + (bestReach === 'up' ? STEP : bestReach === 'down' ? -STEP : 0)),
    );
  }
  const reaches = words.map((w) => reachOf(o.layout, w));
  const chapters: Chapter[] = [];
  const a = Math.round(words.length * 0.25);
  const b = Math.round(words.length * 0.75);
  if (a > 0) chapters.push({ id: 'ledge', from: 0, to: a });
  if (b > a) chapters.push({ id: 'canyon', from: a, to: b });
  if (words.length > b) chapters.push({ id: 'summit', from: b, to: words.length });
  let letters = 0;
  for (const w of words) letters += [...w].length;
  return {
    words,
    reaches,
    heights: stoneHeights(reaches),
    text: words.join(' '),
    chapters,
    letters,
    level: o.level,
  };
}

/** The chapter a word index is in (the last chapter once the run is over). */
export function chapterAt(plan: CliffsPlan, wordIndex: number): ChapterId {
  for (const c of plan.chapters) if (wordIndex < c.to) return c.id;
  return plan.chapters.at(-1)?.id ?? 'summit';
}

/** The chapter that begins at this word index, if one does. */
export function chapterStartsAt(plan: CliffsPlan, wordIndex: number): ChapterId | null {
  return plan.chapters.find((c) => c.from === wordIndex)?.id ?? null;
}

// ---- how the cliffs answer ------------------------------------------------------------------

/** Waterfalls running again after `wordsDone` of `total` words (0..SECTIONS; all at the end). */
export function fallsFlowing(wordsDone: number, total: number): number {
  if (total <= 0) return SECTIONS;
  if (wordsDone >= total) return SECTIONS;
  return Math.max(0, Math.min(SECTIONS, Math.floor((wordsDone * SECTIONS) / total)));
}

/** How far (0..1) the color has spread along the canyon after so many words. */
export function colorShare(wordsDone: number, total: number): number {
  if (total <= 0) return 1;
  return Math.max(0, Math.min(1, wordsDone / total));
}

/** Ibex that have come back after so many words (one per waterfall flowing, plus one at the end). */
export function ibexBack(wordsDone: number, total: number): number {
  const falls = fallsFlowing(wordsDone, total);
  return wordsDone >= total && total > 0 ? falls + 1 : falls;
}

/** Share of letters typed that opens the golden light (rock glow) on the cliffs, 0..1. */
export function glowShare(lettersDone: number, total: number): number {
  if (total <= 0) return 1;
  return Math.max(0, Math.min(1, lettersDone / total));
}
