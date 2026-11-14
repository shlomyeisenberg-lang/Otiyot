// Achievements (T32): small goals read straight from the saved statistics. Nothing is stored:
// whether one is earned is worked out from the profile each time, so a later change to the
// rules never loses or duplicates anything. Pure logic.

import type { Profile } from '../save';
import { rankFromNumber, STORY_REGIONS } from './regions';
import { activityOf, keysMastered, summarizeHistory } from './stats';

export const ACHIEVEMENT_IDS = [
  'firstLesson',
  'tenRuns',
  'fiftyRuns',
  'hourPlayed',
  'streak3',
  'speed20',
  'speed40',
  'speed60',
  'steady',
  'keys10',
  'keys20',
  'firstRegion',
  'fiveRegions',
  'rankS',
  'allRegions',
  'ladder10',
] as const;
export type AchievementId = (typeof ACHIEVEMENT_IDS)[number];

export interface AchievementState {
  id: AchievementId;
  earned: boolean;
  /** How far along, in the unit of `goal` (never above `goal`). */
  progress: number;
  goal: number;
}

export interface AchievementContext {
  now: number;
  tzOffsetMin?: number;
}

const HOUR_MS = 3_600_000;

function lessonsPassed(profile: Profile): number {
  let n = 0;
  for (const p of Object.values(profile.lessons)) n += p.completed.length;
  return n;
}

function restoredCount(profile: Profile): number {
  return STORY_REGIONS.filter((id) => rankFromNumber(profile.story.ranks[id]) !== null).length;
}

/** A run of at least 30 letters with no mistake at all. */
function hasCleanRun(profile: Profile): boolean {
  return profile.history.some((e) => e.accuracy >= 100 && e.chars >= 30);
}

function bestFloors(profile: Profile): number {
  return profile.ladder.reduce((m, r) => Math.max(m, r.floors), 0);
}

interface Rule {
  goal: number;
  value(profile: Profile, ctx: AchievementContext): number;
}

const RULES: Readonly<Record<AchievementId, Rule>> = {
  firstLesson: { goal: 1, value: (p) => lessonsPassed(p) },
  tenRuns: { goal: 10, value: (p) => p.history.length },
  fiftyRuns: { goal: 50, value: (p) => p.history.length },
  hourPlayed: {
    goal: 60,
    value: (p) => Math.floor(summarizeHistory(p.history).totalMs / (HOUR_MS / 60)),
  },
  streak3: {
    goal: 3,
    value: (p, c) => activityOf(p.history, c.now, c.tzOffsetMin ?? 0).streak,
  },
  speed20: { goal: 20, value: (p) => summarizeHistory(p.history).bestWpm },
  speed40: { goal: 40, value: (p) => summarizeHistory(p.history).bestWpm },
  speed60: { goal: 60, value: (p) => summarizeHistory(p.history).bestWpm },
  steady: { goal: 1, value: (p) => (hasCleanRun(p) ? 1 : 0) },
  keys10: { goal: 10, value: (p) => keysMastered(p).mastered },
  keys20: { goal: 20, value: (p) => keysMastered(p).mastered },
  firstRegion: { goal: 1, value: (p) => restoredCount(p) },
  fiveRegions: { goal: 5, value: (p) => restoredCount(p) },
  rankS: {
    goal: 1,
    value: (p) => (Object.values(p.story.ranks).some((n) => rankFromNumber(n) === 'S') ? 1 : 0),
  },
  allRegions: { goal: STORY_REGIONS.length, value: (p) => restoredCount(p) },
  ladder10: { goal: 10, value: (p) => bestFloors(p) },
};

export function achievementState(
  id: AchievementId,
  profile: Profile,
  ctx: AchievementContext,
): AchievementState {
  const rule = RULES[id];
  const value = Math.max(0, rule.value(profile, ctx));
  return { id, earned: value >= rule.goal, progress: Math.min(rule.goal, value), goal: rule.goal };
}

/** Every achievement with how far the player is, in a fixed order. */
export function achievementsOf(profile: Profile, ctx: AchievementContext): AchievementState[] {
  return ACHIEVEMENT_IDS.map((id) => achievementState(id, profile, ctx));
}
