// Run results: a rank from accuracy first and speed second (GAME_DESIGN), and what the run
// earned: XP, glyphs (for accuracy) and ink (for combos). Pure logic.

import type { Difficulty } from './difficulty';
import type { LevelId } from './levels';

export type RunRank = 'S' | 'A' | 'B' | 'C';

export interface RunStats {
  /** 0-100. */
  accuracy: number;
  /** Net words per minute over the run. */
  wpm: number;
  bestCombo: number;
  /** Words finished. */
  words: number;
  /** Words finished without a mistake. */
  perfect: number;
  /** Shields broken. */
  broken: number;
  /** Times a Blot reached the scribe. */
  smudges: number;
  /** True when the run failed (Sofer's Trial: an error). */
  failed: boolean;
}

export interface RunRewards {
  rank: RunRank;
  xp: number;
  glyphs: number;
  ink: number;
}

/** Accuracy needed for each rank (speed decides only between S and A). */
export const RANK_ACCURACY: Readonly<Record<RunRank, number>> = { S: 98, A: 94, B: 88, C: 0 };

const LEVEL_BONUS: Readonly<Record<LevelId, number>> = { easy: 1, standard: 1.25, hard: 1.5 };

/**
 * Accuracy first: it alone decides A, B or C. S needs S-level accuracy and the difficulty's
 * speed as well; accurate but slow is A. A failed run is C.
 */
export function rankOf(
  accuracy: number,
  wpm: number,
  difficulty: Difficulty,
  failed = false,
): RunRank {
  if (failed) return 'C';
  if (accuracy >= RANK_ACCURACY.S) return wpm >= difficulty.rankWpm ? 'S' : 'A';
  if (accuracy >= RANK_ACCURACY.A) return 'A';
  if (accuracy >= RANK_ACCURACY.B) return 'B';
  return 'C';
}

export function rewardsOf(s: RunStats, difficulty: Difficulty, level: LevelId): RunRewards {
  const rank = rankOf(s.accuracy, s.wpm, difficulty, s.failed);
  const k = difficulty.reward * LEVEL_BONUS[level] * (s.failed ? 0.5 : 1);
  const acc = Math.max(0, Math.min(100, s.accuracy)) / 100;
  const rankBonus = { S: 1.5, A: 1.2, B: 1, C: 0.8 }[rank];
  const xp = Math.round((s.words * 4 + s.broken * 3 + s.perfect * 2) * k * rankBonus);
  // Glyphs reward accuracy: cubed, so the last few percent matter most.
  const glyphs = Math.round((s.broken * 2 + s.perfect) * acc * acc * acc * k);
  // Ink rewards the streak.
  const ink = Math.round((s.bestCombo / 4) * k);
  return { rank, xp: Math.max(0, xp), glyphs: Math.max(0, glyphs), ink: Math.max(0, ink) };
}
