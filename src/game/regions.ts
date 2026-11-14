// The regions of the Land of Letters, as the hub's map sees them (GAME_DESIGN "Scenes" and
// "Levels follow your learning"). Each region opens when its key band is learned in the active
// lesson track, not by a fixed list, so the story never runs ahead of the typist. A locked
// region names what to learn first and the lesson to take next. Restored regions are the ones
// with a rank in `profile.story.ranks`. Pure logic.

import {
  activeLevelOf,
  findNextLesson,
  getProgress,
  getTrack,
  isLessonUnlocked,
  knownKeysOf,
  progressKey,
} from '../learn';
import type { Profile } from '../save';
import { learnedLetters, LEVEL_IDS, levelsFor, suggestLevel, type LevelId } from './levels';
import type { RunRank } from './results';

export const REGION_IDS = [
  'meadow',
  'cliffs',
  'blot',
  'forge',
  'shuk',
  'rail',
  'geniza',
  'hermon',
  'station',
  'atbash',
  'midbar',
  'caves',
  'arena',
  'scroll',
  'ladder',
] as const;
export type RegionId = (typeof REGION_IDS)[number];

/** What a region needs before it opens. */
export type RegionNeed =
  /** Open from the start (the Meadow teaches the home row). */
  | { kind: 'start' }
  /** At least this many learned letters on the active track. */
  | { kind: 'letters'; count: number }
  /** A lesson passed in this level of the track (or a later one). */
  | { kind: 'level'; level: number }
  /** These characters learned (the Forge: the number row). */
  | { kind: 'keys'; band: 'numbers'; chars: string }
  /** Another region restored first (the Blank Scroll waits for the Arena). */
  | { kind: 'region'; region: RegionId };

export interface Region {
  id: RegionId;
  /** Story act: 1, 2 or 3; 0 for free play (the Ladder). */
  act: 0 | 1 | 2 | 3;
  need: RegionNeed;
  /**
   * The story gate on top of the course: this region also waits for that one to be restored.
   * Act Two opens once the Great Blot is beaten (T16), so the story never skips its first boss.
   */
  after?: RegionId;
}

export const REGIONS: readonly Region[] = [
  { id: 'meadow', act: 1, need: { kind: 'start' } },
  { id: 'cliffs', act: 1, need: { kind: 'letters', count: 12 } },
  { id: 'blot', act: 1, need: { kind: 'region', region: 'cliffs' } },
  {
    id: 'forge',
    act: 2,
    need: { kind: 'keys', band: 'numbers', chars: '1234567890' },
    after: 'blot',
  },
  { id: 'shuk', act: 2, need: { kind: 'level', level: 2 }, after: 'blot' },
  { id: 'rail', act: 2, need: { kind: 'level', level: 3 }, after: 'blot' },
  { id: 'geniza', act: 2, need: { kind: 'level', level: 3 }, after: 'blot' },
  { id: 'hermon', act: 2, need: { kind: 'level', level: 4 }, after: 'blot' },
  { id: 'station', act: 2, need: { kind: 'level', level: 4 }, after: 'blot' },
  { id: 'atbash', act: 2, need: { kind: 'level', level: 5 }, after: 'blot' },
  { id: 'midbar', act: 2, need: { kind: 'level', level: 5 }, after: 'blot' },
  { id: 'caves', act: 3, need: { kind: 'level', level: 6 }, after: 'blot' },
  { id: 'arena', act: 3, need: { kind: 'level', level: 6 }, after: 'blot' },
  { id: 'scroll', act: 3, need: { kind: 'region', region: 'arena' } },
  { id: 'ladder', act: 0, need: { kind: 'letters', count: 10 } },
];

/** The regions the story restores (the Ladder is free play and restores nothing). */
export const STORY_REGIONS: readonly RegionId[] = REGION_IDS.filter((id) => id !== 'ladder');

// ---- ranks ----------------------------------------------------------------------------------

const RANKS: readonly RunRank[] = ['C', 'B', 'A', 'S'];

/** How a rank is kept in `profile.story.ranks`: C = 1, B = 2, A = 3, S = 4 (0: not restored). */
export function rankNumber(rank: RunRank): number {
  return RANKS.indexOf(rank) + 1;
}

export function rankFromNumber(n: number | undefined): RunRank | null {
  if (n === undefined || !Number.isFinite(n) || n < 1) return null;
  return RANKS[Math.min(RANKS.length, Math.floor(n)) - 1] ?? null;
}

/** Keeps the better of the stored rank and a new one. Mutates the profile. */
export function recordRegionRank(profile: Profile, id: RegionId, rank: RunRank): void {
  const old = profile.story.ranks[id] ?? 0;
  profile.story.ranks[id] = Math.max(old, rankNumber(rank));
}

// ---- what is open --------------------------------------------------------------------------

export function isRestored(profile: Profile, id: RegionId): boolean {
  return rankFromNumber(profile.story.ranks[id]) !== null;
}

/** The save flag the number-row lessons set (a later task) when the digits are learned. */
export const NUMBER_ROW_FLAG = 'numberRow';
export const DIGITS = '1234567890';

/**
 * The keys a profile may be asked to type in a scene that needs a key band: the keys of its
 * lessons, plus the whole number row once the player has learned it (no lesson teaches the
 * digits yet, so the save flag is how the Forge opens). Pure.
 */
export function sceneKeysOf(profile: Profile): Set<string> {
  const keys = knownKeysOf(profile);
  if (profile.story.flags[NUMBER_ROW_FLAG] === true) for (const d of DIGITS) keys.add(d);
  return keys;
}

/** True when the need is met by this profile right now. */
export function needMet(profile: Profile, need: RegionNeed): boolean {
  switch (need.kind) {
    case 'start':
      return true;
    case 'letters':
      return learnedLetters(knownKeysOf(profile)) >= need.count;
    case 'level':
      return activeLevelOf(getProgress(profile).completed) >= need.level;
    case 'keys': {
      const keys = sceneKeysOf(profile);
      return [...need.chars].every((c) => keys.has(c));
    }
    case 'region':
      return isRestored(profile, need.region);
  }
}

/** The lesson that opens a region, and the lesson to take next on the way there. */
export interface LearnPath {
  /** The first lesson after which the need is met (passing every lesson before it, in order). */
  targetId: string;
  targetTitle: string;
  targetLevel: number;
  /** The lesson the player can take now on the way (the target itself when it is open). */
  nextId: string;
  nextTitle: string;
  /** Lessons still to pass up to and including the target. */
  remaining: number;
}

/**
 * Walks the active track in order, as if the player passed each lesson, and finds the first one
 * after which `need` is met. Null when no lesson in the track teaches it (or it is already met,
 * or it waits for a region instead of a lesson).
 */
export function learnPath(profile: Profile, need: RegionNeed): LearnPath | null {
  if (need.kind === 'start' || need.kind === 'region' || needMet(profile, need)) return null;
  const track = getTrack(profile.track);
  const lang = profile.layout;
  const ui = profile.settings.uiLanguage;
  const key = progressKey(profile.track, lang);
  const done = [...getProgress(profile).completed];
  const doneSet = new Set(done);
  const sim: Profile = {
    ...profile,
    lessons: { ...profile.lessons, [key]: { completed: done, best: {} } },
  };
  let remaining = 0;
  for (const level of track.levels(lang, ui)) {
    for (const lesson of track.lessons(level.id, lang, ui)) {
      if (doneSet.has(lesson.id)) continue;
      done.push(lesson.id);
      remaining += 1;
      if (!needMet(sim, need)) continue;
      const lessons = track.lessons(level.id, lang, ui);
      const index = lessons.findIndex((l) => l.id === lesson.id);
      const real = getProgress(profile).completed;
      const open = isLessonUnlocked(track, lang, ui, level.id, index, real);
      const next = open ? null : findNextLesson(track, lang, ui, real);
      return {
        targetId: lesson.id,
        targetTitle: lesson.title,
        targetLevel: level.id,
        nextId: next?.lesson.id ?? lesson.id,
        nextTitle: next?.lesson.title ?? lesson.title,
        remaining,
      };
    }
  }
  return null;
}

export interface RegionStatus {
  id: RegionId;
  act: Region['act'];
  need: RegionNeed;
  open: boolean;
  /** The course need is met but the story still waits for this region (null otherwise). */
  waitsFor: RegionId | null;
  restored: boolean;
  rank: RunRank | null;
  /** For a locked region: what to learn first (null when no lesson teaches it yet). */
  learn: LearnPath | null;
  /** Levels open in this region (from the learned letters) and the one suggested now. */
  levels: LevelId[];
  suggested: LevelId;
}

/** History modes a region's runs are written under: `scene:<id>:<level>:<difficulty>`. */
export function regionMode(id: RegionId, level: LevelId, difficulty: string): string {
  return `scene:${id}:${level}:${difficulty}`;
}

function suggestionFor(profile: Profile, id: RegionId, levels: readonly LevelId[]): LevelId {
  const own = profile.history.filter((e) => e.mode.startsWith(`scene:${id}:`));
  // A region never played yet borrows the player's other fights and scenes.
  const runs =
    own.length > 0
      ? own
      : profile.history.filter((e) => e.mode.startsWith('scene:') || e.mode.startsWith('fight:'));
  const lastLevel = runs.at(-1)?.mode.split(':')[own.length > 0 ? 2 : 1] ?? 'easy';
  const current = (LEVEL_IDS as readonly string[]).includes(lastLevel)
    ? (lastLevel as LevelId)
    : 'easy';
  return suggestLevel(runs.slice(-6), current, levels);
}

/** Every region with what is open, what is restored, and what to learn first. */
export function regionStatuses(profile: Profile): RegionStatus[] {
  const levels = levelsFor(profile);
  return REGIONS.map((r) => {
    const course = needMet(profile, r.need);
    const gate = r.after && !isRestored(profile, r.after) ? r.after : null;
    const open = course && gate === null;
    const rank = rankFromNumber(profile.story.ranks[r.id]);
    return {
      id: r.id,
      act: r.act,
      need: r.need,
      open,
      waitsFor: course ? gate : null,
      restored: rank !== null,
      rank,
      learn: course ? null : learnPath(profile, r.need),
      levels,
      suggested: suggestionFor(profile, r.id, levels),
    };
  });
}

/** 0..1: how much of the land is restored (story regions only). */
export function restoredShare(profile: Profile): number {
  const n = STORY_REGIONS.filter((id) => isRestored(profile, id)).length;
  return n / STORY_REGIONS.length;
}

/**
 * Where "Continue the story" leads: the first open story region that is not restored yet and
 * can be played (`playable`: the regions whose scene is built). Null when there is none.
 */
export function nextRegion(
  statuses: readonly RegionStatus[],
  playable: ReadonlySet<RegionId>,
): RegionStatus | null {
  return (
    statuses.find((s) => s.act > 0 && s.open && !s.restored && playable.has(s.id)) ??
    statuses.find((s) => s.act > 0 && s.open && !s.restored) ??
    null
  );
}
