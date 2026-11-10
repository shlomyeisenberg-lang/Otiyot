// Levels follow your learning (GAME_DESIGN): every scene run takes a level, Easy, Standard or
// Hard, and builds its words only from the keys the active profile has learned on its track.
// Levels change word length, enemy count, speed pressure and how far ahead the player can read,
// never the letters. Harder levels open as the course goes on, and the hub suggests a level from
// recent accuracy and speed. Pure logic: the random source is passed in.

import { learnedWordSource, knownKeysOf } from '../learn';
import type { Profile } from '../save';
import type { Difficulty } from './difficulty';

export const LEVEL_IDS = ['easy', 'standard', 'hard'] as const;
export type LevelId = (typeof LEVEL_IDS)[number];

export interface Level {
  id: LevelId;
  /** Shortest and longest word, in letters, before the difficulty adds its extra length. */
  minLength: number;
  maxLength: number;
  /** Waves in one fight. */
  waves: number;
  /** Enemies in the first wave; each wave adds `growth`. */
  enemies: number;
  growth: number;
  /** Multiplies the difficulty's enemy pace (speed pressure). */
  pace: number;
  /** Added to the difficulty's most enemies at once. */
  extraOnField: number;
  /** Learned letters needed before the level opens. */
  needsLetters: number;
}

export const LEVELS: Readonly<Record<LevelId, Level>> = {
  easy: {
    id: 'easy',
    minLength: 2,
    maxLength: 4,
    waves: 3,
    enemies: 3,
    growth: 1,
    pace: 0.85,
    extraOnField: 0,
    needsLetters: 0,
  },
  standard: {
    id: 'standard',
    minLength: 3,
    maxLength: 5,
    waves: 4,
    enemies: 4,
    growth: 1,
    pace: 1,
    extraOnField: 0,
    needsLetters: 10,
  },
  hard: {
    id: 'hard',
    minLength: 4,
    maxLength: 7,
    waves: 5,
    enemies: 4,
    growth: 2,
    pace: 1.2,
    extraOnField: 1,
    needsLetters: 18,
  },
};

/** The letters (not space or punctuation) of a learned key set. */
export function learnedLetters(keys: ReadonlySet<string>): number {
  let n = 0;
  for (const k of keys) if (/\p{L}/u.test(k)) n += 1;
  return n;
}

/** Levels open as the course goes on. Easy is always open. */
export function unlockedLevels(letters: number): LevelId[] {
  return LEVEL_IDS.filter((id) => letters >= LEVELS[id].needsLetters);
}

export function levelsFor(profile: Profile): LevelId[] {
  return unlockedLevels(learnedLetters(knownKeysOf(profile)));
}

/** Word lengths for a level on a difficulty (longer on harder difficulties, never past 9). */
export function wordLengths(level: Level, difficulty: Difficulty): [number, number] {
  const min = Math.min(level.minLength + Math.floor(difficulty.extraLength / 2), 6);
  const max = Math.min(Math.max(min, level.maxLength + difficulty.extraLength), 9);
  return [min, max];
}

/**
 * Words for a run of this level, spelled only with keys the profile has learned (ARCHITECTURE
 * section 8). `keys` is the learned set the words were checked against.
 */
export function levelWordSource(
  profile: Profile,
  level: Level,
  difficulty: Difficulty,
  rng: () => number,
): { next(): string; readonly keys: ReadonlySet<string> } {
  const [minLength, maxLength] = wordLengths(level, difficulty);
  return learnedWordSource(profile, { rng, minLength, maxLength });
}

/** A recent run, as the level suggestion sees it. */
export interface RecentRun {
  accuracy: number;
  wpm: number;
}

/** About this accurate and getting faster: suggest a step up. */
export const SUGGEST_UP_ACCURACY = 90;
/** Under this: suggest a step down. */
export const SUGGEST_DOWN_ACCURACY = 82;

/**
 * The level to suggest now, from the last few runs (oldest first). About 90% accuracy with
 * rising speed moves the suggestion up; low accuracy moves it down; otherwise it stays.
 * Never suggests a level that is still locked.
 */
export function suggestLevel(
  recent: readonly RecentRun[],
  current: LevelId,
  unlocked: readonly LevelId[],
): LevelId {
  const open = LEVEL_IDS.filter((id) => unlocked.includes(id));
  if (open.length === 0) return 'easy';
  const at = Math.max(0, open.indexOf(open.includes(current) ? current : (open[0] as LevelId)));
  const runs = recent.slice(-6);
  if (runs.length === 0) return open[at] as LevelId;
  const acc = runs.reduce((s, r) => s + r.accuracy, 0) / runs.length;
  if (acc < SUGGEST_DOWN_ACCURACY) return open[Math.max(0, at - 1)] as LevelId;
  if (runs.length >= 2 && acc >= SUGGEST_UP_ACCURACY) {
    const half = Math.floor(runs.length / 2);
    const avg = (rs: readonly RecentRun[]): number =>
      rs.reduce((s, r) => s + r.wpm, 0) / Math.max(1, rs.length);
    const older = avg(runs.slice(0, half));
    const newer = avg(runs.slice(half));
    if (newer >= older) return open[Math.min(open.length - 1, at + 1)] as LevelId;
  }
  return open[at] as LevelId;
}
