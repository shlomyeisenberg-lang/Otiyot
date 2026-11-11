// The Home Row Meadow's run, as plain data (no 3D here; unit-tested). A run is one fixed text of
// three chapters, typed once from start to finish with no timers:
//
//   hands  Reb Ezra's lesson: every learned home-row key tapped by its own finger, then small
//          rolls from finger to finger. Skippable, and left out once the Meadow is restored.
//   look   Short words: read the next word while the fingers finish this one.
//   flow   More words: keep the streak and the meadow sings.
//
// Every word is spelled only with keys the player has already learned (ARCHITECTURE section 8).
// The same file says how the meadow answers: how many flowers are open after so many letters,
// how far the green has spread after so many words, and when the birds come back.

import { HOME_ROW_KEYS, KEYS, LAYOUTS, type Finger, type LayoutId } from '../../core/layouts';
import { isAllowedWord } from '../../learn/content';
import type { LevelId } from '../../game/levels';

export const CHAPTER_IDS = ['hands', 'look', 'flow'] as const;
export type ChapterId = (typeof CHAPTER_IDS)[number];

export interface Chapter {
  id: ChapterId;
  /** Index of its first word, and one past its last. */
  from: number;
  to: number;
}

export interface MeadowPlan {
  words: readonly string[];
  /** The whole run as one line: the words with single spaces between them. */
  text: string;
  chapters: readonly Chapter[];
  /** Letters in all the words together (spaces not counted). */
  letters: number;
  level: LevelId;
  tutorial: boolean;
}

/** One bed of the home-row garden: a physical key, left to right. */
export interface Plot {
  code: string;
  char: string;
  finger: Finger;
  /** True for the two keys with the little bumps (the index fingers' homes). */
  bump: boolean;
  learned: boolean;
}

/** The eight beds of the garden, in the physical order of the keys (left pinky first). */
export function homePlots(layout: LayoutId, keys: ReadonlySet<string>): Plot[] {
  return HOME_ROW_KEYS.map((code) => {
    const char = LAYOUTS[layout].base[code] ?? '';
    const finger = KEYS[code]?.finger ?? 'li';
    return {
      code,
      char,
      finger,
      bump: finger === 'li' || finger === 'ri',
      learned: char !== '' && keys.has(char),
    };
  });
}

const isLetter = (ch: string): boolean => /\p{L}/u.test(ch);

/**
 * The letters Reb Ezra's lesson taps: the learned home-row letters, index fingers first and
 * outward from there, left and right in turn. A player whose track has taught no home-row
 * letters yet taps the letters he does know (up to eight), so the lesson is never empty.
 */
export function lessonLetters(layout: LayoutId, keys: ReadonlySet<string>): string[] {
  const plots = homePlots(layout, keys).filter((p) => p.learned && isLetter(p.char));
  const order = [3, 4, 2, 5, 1, 6, 0, 7];
  const home = order
    .map((i) => HOME_ROW_KEYS[i] as string)
    .map((code) => plots.find((p) => p.code === code)?.char)
    .filter((ch): ch is string => ch !== undefined);
  if (home.length >= 2) return home;
  const others = [...keys].filter((ch) => ch.trim() !== '' && isLetter(ch) && !home.includes(ch));
  return [...home, ...others].slice(0, 8);
}

/** Most words in the lesson chapter. */
export const LESSON_MAX_WORDS = 14;

/**
 * The lesson: each letter twice ("ff", "jj"), then rolls from one finger to the next ("fj",
 * "dk"), and one long roll over all of them. Only learned letters; nothing blocked.
 */
export function lessonWords(layout: LayoutId, keys: ReadonlySet<string>): string[] {
  const letters = lessonLetters(layout, keys);
  const out: string[] = [];
  const add = (w: string): void => {
    if (w.length === 0 || out.at(-1) === w || !isAllowedWord(w, layout)) return;
    out.push(w);
  };
  for (const ch of letters) add(ch + ch);
  for (let i = 0; i + 1 < letters.length; i += 2) {
    add(`${letters[i] as string}${letters[i + 1] as string}`);
    add(`${letters[i + 1] as string}${letters[i] as string}`);
  }
  if (letters.length >= 4) add(letters.slice(0, 4).join(''));
  if (out.length === 0 && letters.length > 0) out.push((letters[0] as string).repeat(2));
  return out.slice(0, LESSON_MAX_WORDS);
}

/** Words in the two word chapters, per level. */
export const CHAPTER_WORDS: Readonly<Record<LevelId, { look: number; flow: number }>> = {
  easy: { look: 8, flow: 12 },
  standard: { look: 10, flow: 16 },
  hard: { look: 12, flow: 20 },
};

export interface PlanOptions {
  layout: LayoutId;
  /** The learned keys (the words are checked against them). */
  keys: ReadonlySet<string>;
  level: LevelId;
  /** With Reb Ezra's lesson in front. */
  tutorial: boolean;
  /** Learned words of the level's lengths (`levelWordSource`). */
  words: { next(): string };
}

/** Lays out one run. Throws nothing: a word with an unlearned key is simply never taken. */
export function planMeadow(o: PlanOptions): MeadowPlan {
  const allowed = (w: string): boolean => w.length > 0 && [...w].every((ch) => o.keys.has(ch));
  const words: string[] = [];
  const chapters: Chapter[] = [];
  if (o.tutorial) {
    const lesson = lessonWords(o.layout, o.keys).filter(allowed);
    if (lesson.length > 0) {
      chapters.push({ id: 'hands', from: 0, to: lesson.length });
      words.push(...lesson);
    }
  }
  const take = (id: ChapterId, count: number): void => {
    const from = words.length;
    let tries = 0;
    while (words.length - from < count && tries < count * 12) {
      tries += 1;
      const w = o.words.next().trim();
      // Never the same word twice in a row, and never a key that was not learned.
      if (!allowed(w) || w === words.at(-1)) continue;
      words.push(w);
    }
    if (words.length > from) chapters.push({ id, from, to: words.length });
  };
  const n = CHAPTER_WORDS[o.level];
  take('look', n.look);
  take('flow', n.flow);
  let letters = 0;
  for (const w of words) letters += [...w].length;
  return { words, text: words.join(' '), chapters, letters, level: o.level, tutorial: o.tutorial };
}

/** The chapter a word index is in (the last chapter once the run is over). */
export function chapterAt(plan: MeadowPlan, wordIndex: number): ChapterId {
  for (const c of plan.chapters) if (wordIndex < c.to) return c.id;
  return plan.chapters.at(-1)?.id ?? 'flow';
}

/** True when the word at this index is the first of its chapter. */
export function chapterStartsAt(plan: MeadowPlan, wordIndex: number): ChapterId | null {
  return plan.chapters.find((c) => c.from === wordIndex)?.id ?? null;
}

// ---- how the meadow answers -----------------------------------------------------------------

/** Where the green reaches before the first word, and when the whole run is typed. */
export const GREEN_START = 6.5;
export const GREEN_END = 66;

/** How far the green has spread from the garden after `wordsDone` of `total` words. */
export function greenRadius(wordsDone: number, total: number): number {
  if (total <= 0) return GREEN_END;
  const t = Math.max(0, Math.min(1, wordsDone / total));
  // Early words matter most to the eye: the first steps are the biggest.
  return GREEN_START + (GREEN_END - GREEN_START) * Math.pow(t, 0.8);
}

/** Flowers open after `lettersDone` of `total` letters, out of `flowers` (all by the end). */
export function flowersOpen(lettersDone: number, total: number, flowers: number): number {
  if (total <= 0) return flowers;
  const t = Math.max(0, Math.min(1, lettersDone / total));
  if (t >= 1) return flowers;
  // Never fewer than one flower per letter while there are flowers left.
  return Math.min(flowers, Math.max(lettersDone, Math.floor(flowers * Math.pow(t, 1.15))));
}

/** Shares of the run at which a bird (and its song) comes back. */
export const BIRD_STAGES: readonly number[] = [0.18, 0.45, 0.75];

/** How many of the birdsongs are back (0..3) after `wordsDone` of `total` words. */
export function birdStage(wordsDone: number, total: number): number {
  if (total <= 0) return BIRD_STAGES.length;
  const t = wordsDone / total;
  let n = 0;
  for (const s of BIRD_STAGES) if (t >= s) n += 1;
  return n;
}
