// The five difficulties (GAME_DESIGN "Progression and economy") as data. Each one trades time
// pressure, error cost, word complexity and enemy pace. Calm has no timers at all: enemies come
// close and wait. Sofer's Trial ends the run on the first error. Pure data and helpers.

export const DIFFICULTY_IDS = ['calm', 'steady', 'swift', 'fierce', 'trial'] as const;
export type DifficultyId = (typeof DIFFICULTY_IDS)[number];

export interface Difficulty {
  id: DifficultyId;
  /** False on Calm: nothing in the run counts down, enemies never reach the scribe. */
  timers: boolean;
  /** Approach speed of enemies, in arena radii per second at pace 1. */
  enemyPace: number;
  /** Seconds between spawns inside a wave. */
  spawnGap: number;
  /** Most enemies on the field at once (the level may add one). */
  maxEnemies: number;
  /** Combo tiers lost on an error (0 = fall back to the floor of the current tier). */
  errorTiers: number;
  /** Tiers lost when a Blot reaches the scribe. */
  smudgeTiers: number;
  /** Extra letters added to the word lengths of the level (complexity). */
  extraLength: number;
  /** The run fails on the first wrong key. */
  failOnError: boolean;
  /** Multiplier on XP, glyphs and ink. */
  reward: number;
  /** The speed (WPM) that counts as "fast" for rank S on this difficulty. */
  rankWpm: number;
}

export const DIFFICULTIES: Readonly<Record<DifficultyId, Difficulty>> = {
  calm: {
    id: 'calm',
    timers: false,
    enemyPace: 0.05,
    spawnGap: 2.6,
    maxEnemies: 3,
    errorTiers: 0,
    smudgeTiers: 0,
    extraLength: 0,
    failOnError: false,
    reward: 0.8,
    rankWpm: 0,
  },
  steady: {
    id: 'steady',
    timers: true,
    enemyPace: 0.045,
    spawnGap: 2.4,
    maxEnemies: 3,
    errorTiers: 1,
    smudgeTiers: 1,
    extraLength: 0,
    failOnError: false,
    reward: 1,
    rankWpm: 15,
  },
  swift: {
    id: 'swift',
    timers: true,
    enemyPace: 0.07,
    spawnGap: 1.8,
    maxEnemies: 4,
    errorTiers: 1,
    smudgeTiers: 2,
    extraLength: 1,
    failOnError: false,
    reward: 1.3,
    rankWpm: 25,
  },
  fierce: {
    id: 'fierce',
    timers: true,
    enemyPace: 0.1,
    spawnGap: 1.3,
    maxEnemies: 5,
    errorTiers: 2,
    smudgeTiers: 4,
    extraLength: 2,
    failOnError: false,
    reward: 1.7,
    rankWpm: 35,
  },
  trial: {
    id: 'trial',
    timers: true,
    enemyPace: 0.08,
    spawnGap: 1.6,
    maxEnemies: 4,
    errorTiers: 4,
    smudgeTiers: 4,
    extraLength: 1,
    failOnError: true,
    reward: 2.2,
    rankWpm: 30,
  },
};

export function difficultyOf(id: string): Difficulty {
  return (DIFFICULTIES as Record<string, Difficulty | undefined>)[id] ?? DIFFICULTIES.steady;
}

/** 0 (Calm) .. 1 (Sofer's Trial): the RunConfig.difficulty number for a difficulty. */
export function difficultyNumber(id: DifficultyId): number {
  return DIFFICULTY_IDS.indexOf(id) / (DIFFICULTY_IDS.length - 1);
}
