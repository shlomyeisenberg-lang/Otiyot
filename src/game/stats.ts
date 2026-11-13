// Statistics for the dashboard (T32): every number on the screen is computed here, from the
// profile's saved statistics only (never typed text). Pure logic: no DOM, no clock (the caller
// passes `now` and the time-zone offset).

import { keyForChar } from '../core';
import {
  charMastery,
  getProgress,
  getTrack,
  knownKeysOf,
  topErrorPairs,
  type ErrorPair,
} from '../learn';
import type { HistoryEntry, Profile, Track } from '../save';
import type { LayoutId } from '../core';

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;

/** Mastery (0-100) from which a key counts as mastered. */
export const MASTERED_AT = 80;

export interface HistorySummary {
  sessions: number;
  totalMs: number;
  chars: number;
  avgWpm: number;
  bestWpm: number;
  avgAccuracy: number;
  bestAccuracy: number;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

/** Totals over a list of finished runs. Averages are weighted equally per run. */
export function summarizeHistory(history: readonly HistoryEntry[]): HistorySummary {
  let totalMs = 0;
  let chars = 0;
  let wpm = 0;
  let acc = 0;
  let bestWpm = 0;
  let bestAccuracy = 0;
  for (const e of history) {
    totalMs += Math.max(0, e.durationMs);
    chars += Math.max(0, e.chars);
    wpm += e.wpm;
    acc += e.accuracy;
    bestWpm = Math.max(bestWpm, e.wpm);
    bestAccuracy = Math.max(bestAccuracy, e.accuracy);
  }
  const n = history.length;
  return {
    sessions: n,
    totalMs,
    chars,
    avgWpm: n === 0 ? 0 : round1(wpm / n),
    bestWpm: Math.round(bestWpm),
    avgAccuracy: n === 0 ? 0 : round1(acc / n),
    bestAccuracy: round1(bestAccuracy),
  };
}

export interface Trend {
  wpm: number[];
  accuracy: number[];
}

/** The last `limit` runs, oldest first, rounded for the charts. Runs shorter than `minMs` are skipped. */
export function trendSeries(history: readonly HistoryEntry[], limit = 30, minMs = 0): Trend {
  const runs = history.filter((e) => e.durationMs >= minMs).slice(-Math.max(0, limit));
  return {
    wpm: runs.map((e) => Math.round(e.wpm)),
    accuracy: runs.map((e) => Math.round(e.accuracy)),
  };
}

/** Whole hours and minutes of a duration (for "Time played"). */
export function splitDuration(ms: number): { hours: number; minutes: number } {
  const total = Math.floor(Math.max(0, ms) / MINUTE_MS);
  return { hours: Math.floor(total / 60), minutes: total % 60 };
}

/** Local day number of a time. `tzOffsetMin` is `Date.getTimezoneOffset()` (minutes behind UTC). */
export function dayIndex(at: number, tzOffsetMin = 0): number {
  return Math.floor((at - tzOffsetMin * MINUTE_MS) / DAY_MS);
}

export interface Activity {
  /** Different days with at least one run. */
  days: number;
  /** Days in a row up to today (or up to yesterday, if nothing was played yet today). */
  streak: number;
}

export function activityOf(
  history: readonly HistoryEntry[],
  now: number,
  tzOffsetMin = 0,
): Activity {
  const days = new Set(history.map((e) => dayIndex(e.at, tzOffsetMin)));
  const today = dayIndex(now, tzOffsetMin);
  let d = days.has(today) ? today : today - 1;
  let streak = 0;
  while (days.has(d)) {
    streak += 1;
    d -= 1;
  }
  return { days: days.size, streak };
}

export interface KeySkill {
  ch: string;
  /** 0-100, or null while there are too few attempts. */
  mastery: number | null;
  attempts: number;
}

/** Every key the player has been taught on the active track, with its mastery. Sorted by character. */
export function keySkills(profile: Profile): KeySkill[] {
  const rows: KeySkill[] = [];
  for (const ch of knownKeysOf(profile)) {
    if (ch === ' ') continue;
    const stat = profile.keys[ch];
    rows.push({
      ch,
      mastery: charMastery(stat),
      attempts: stat ? stat.hits + stat.misses : 0,
    });
  }
  return rows.sort((a, b) => a.ch.localeCompare(b.ch));
}

export interface KeysMastered {
  mastered: number;
  known: number;
}

export function keysMastered(profile: Profile): KeysMastered {
  const skills = keySkills(profile);
  return {
    known: skills.length,
    mastered: skills.filter((k) => k.mastery !== null && k.mastery >= MASTERED_AT).length,
  };
}

/**
 * Heat per physical key code for the keyboard heatmap: 0 is fine, 1 is weakest. Keys with too
 * little data get no entry (they stay plain on the map).
 */
export function keyHeat(
  profile: Profile,
  layout: LayoutId = profile.layout,
): Record<string, number> {
  const heat: Record<string, number> = {};
  for (const k of keySkills(profile)) {
    if (k.mastery === null) continue;
    const ref = keyForChar(k.ch, layout);
    if (!ref) continue;
    const h = Math.max(0, Math.min(1, 1 - k.mastery / 100));
    // Two characters can share a key (letter and its shifted form): the weaker one shows.
    heat[ref.code] = Math.max(heat[ref.code] ?? 0, h);
  }
  return heat;
}

/** The mistakes made most often: what was meant, what was typed, how many times. */
export function errorPatterns(profile: Profile, limit = 6): ErrorPair[] {
  return topErrorPairs(profile, limit);
}

export interface LevelProgress {
  id: number;
  name: string;
  total: number;
  done: number;
  stars: number;
  bestWpm: number;
}

export interface TrackSummary {
  track: Track;
  levels: LevelProgress[];
  total: number;
  done: number;
}

/** Lesson progress of one track in one language, level by level. */
export function trackSummary(profile: Profile, track: Track, layout: LayoutId): TrackSummary {
  const t = getTrack(track);
  const ui = profile.settings.uiLanguage;
  const prog = getProgress(profile, track, layout);
  const done = new Set(prog.completed);
  const levels: LevelProgress[] = t.levels(layout, ui).map((lv) => {
    const lessons = t.lessons(lv.id, layout, ui);
    let stars = 0;
    let bestWpm = 0;
    let finished = 0;
    for (const l of lessons) {
      if (done.has(l.id)) finished += 1;
      const best = prog.best[l.id];
      if (best) {
        stars += best.stars;
        bestWpm = Math.max(bestWpm, best.wpm);
      }
    }
    return { id: lv.id, name: lv.name, total: lessons.length, done: finished, stars, bestWpm };
  });
  return {
    track,
    levels,
    total: levels.reduce((a, l) => a + l.total, 0),
    done: levels.reduce((a, l) => a + l.done, 0),
  };
}

export interface SessionRow {
  at: number;
  /** The kind of run: lesson, scene, mode, fight or practice. */
  kind: 'lesson' | 'scene' | 'mode' | 'fight' | 'practice' | 'other';
  /** The rest of the saved mode string (lesson id, scene id and level, ...). */
  detail: string;
  wpm: number;
  accuracy: number;
  durationMs: number;
}

function kindOf(mode: string): { kind: SessionRow['kind']; detail: string } {
  const [head = '', ...rest] = mode.split(':');
  const detail = rest.join(':');
  switch (head) {
    case 'lesson':
    case 'scene':
    case 'mode':
    case 'fight':
    case 'practice':
      return { kind: head, detail };
    default:
      return { kind: 'other', detail: mode };
  }
}

/** The newest runs first. */
export function sessionRows(history: readonly HistoryEntry[], limit = 12): SessionRow[] {
  return history
    .slice(-Math.max(0, limit))
    .reverse()
    .map((e) => ({
      at: e.at,
      ...kindOf(e.mode),
      wpm: Math.round(e.wpm),
      accuracy: Math.round(e.accuracy),
      durationMs: e.durationMs,
    }));
}
