// Per-track progress kept on the profile. Switching tracks only changes `profile.track`;
// each track (and curriculum language) keeps its own list of passed lessons.

import type { LayoutId } from '../core';
import type { LessonBest, Profile, TrackProgress } from '../save';
import { DEFAULT_PASS_ACCURACY, lessonPassed } from './track';
import type { TrackId } from './types';

/**
 * Key under `profile.lessons`. Hebrew keeps the plain track number ("1", "2"); English adds
 * a suffix ("1-en", "2-en") because both languages reuse the same lesson ids.
 */
export function progressKey(track: TrackId, language: LayoutId): string {
  return language === 'en' ? `${track}-en` : String(track);
}

const EMPTY: TrackProgress = Object.freeze({ completed: [], best: {} }) as TrackProgress;

/** Progress of a track (defaults to the profile's own track and language); never creates it. */
export function getProgress(
  profile: Profile,
  track: TrackId = profile.track,
  language: LayoutId = profile.layout,
): TrackProgress {
  return profile.lessons[progressKey(track, language)] ?? EMPTY;
}

export interface LessonResult {
  wpm: number;
  accuracy: number;
  stars?: number;
}

export interface RecordOutcome {
  passed: boolean;
  /** True when this run replaced the stored best for the lesson. */
  newBest: boolean;
}

function better(a: LessonBest, b: LessonBest | undefined): boolean {
  if (!b) return true;
  if (a.stars !== b.stars) return a.stars > b.stars;
  return a.wpm > b.wpm;
}

/**
 * Stores a finished lesson run on the profile's current track and language. Passing adds the
 * lesson to `completed`; the best result is kept. Mutates the profile (use inside
 * `SaveManager.update`).
 */
export function recordLessonResult(
  profile: Profile,
  lessonId: string,
  result: LessonResult,
  passAccuracy: number = DEFAULT_PASS_ACCURACY,
): RecordOutcome {
  const key = progressKey(profile.track, profile.layout);
  const prog = profile.lessons[key] ?? { completed: [], best: {} };
  profile.lessons[key] = prog;
  const passed = lessonPassed(result.accuracy, passAccuracy);
  if (passed && !prog.completed.includes(lessonId)) prog.completed.push(lessonId);
  const run: LessonBest = {
    wpm: Math.max(0, Math.round(result.wpm)),
    accuracy: Math.max(0, Math.min(100, result.accuracy)),
    stars: Math.max(0, Math.min(3, Math.round(result.stars ?? 0))),
  };
  const newBest = better(run, prog.best[lessonId]);
  if (newBest) prog.best[lessonId] = run;
  return { passed, newBest };
}

/** Selects the profile's lesson track. Never touches progress, so switching loses nothing. */
export function switchTrack(profile: Profile, track: TrackId): void {
  profile.track = track === 2 ? 2 : 1;
}
