// The non-story modes (T31): Practice, Time Attack, Survival and the Daily Challenge. Pure logic:
// the rule sets, the challenge modifiers, the date-seeded daily plan, the scores and the practice
// drills. Everything a player is asked to type is made of letters the active profile has already
// learned (GAME_DESIGN "Levels follow your learning"); the random source is always passed in.

import type { LayoutId } from '../core';
import {
  buildMicroLesson,
  CHARS_PER_MINUTE,
  contextFor,
  dueToday,
  fixFinalLetters,
  generateBigramDrill,
  generateCharDrill,
  generateWordDrill,
  getTrack,
  knownKeysOf,
  weakCharacters,
  type Lesson,
} from '../learn';
import type { HistoryEntry, Profile } from '../save';
import { DIFFICULTIES, DIFFICULTY_IDS, type Difficulty, type DifficultyId } from './difficulty';
import { learnedLetters, LEVEL_IDS, levelsFor, type LevelId } from './levels';
import { REGION_IDS, type RegionId } from './regions';

export type ModeRng = () => number;

// ---- ids ------------------------------------------------------------------------------------

export const MODE_IDS = ['practice', 'timeattack', 'survival', 'daily'] as const;
export type ModeId = (typeof MODE_IDS)[number];

/** The two rule sets that run against the clock or the grip. */
export type RuleKind = 'timeattack' | 'survival';

export const PRACTICE_KINDS = ['weak', 'review', 'lesson', 'custom'] as const;
export type PracticeKind = (typeof PRACTICE_KINDS)[number];

/** Challenge modifiers: no lookahead, mirror, fog, sudden layout. */
export const MODIFIER_IDS = ['noLookahead', 'mirror', 'fog', 'sudden'] as const;
export type ModifierId = (typeof MODIFIER_IDS)[number];

export function isModifier(x: string): x is ModifierId {
  return (MODIFIER_IDS as readonly string[]).includes(x);
}

/**
 * The regions a run may be set in: the ones that have a scene to borrow a name and a place from
 * (the story bosses, the arena and the scroll are not settings).
 */
export const SETTING_REGIONS: readonly RegionId[] = REGION_IDS.filter(
  (id) => id !== 'blot' && id !== 'arena' && id !== 'scroll',
);

// ---- random source --------------------------------------------------------------------------

/** FNV-1a: a small, stable string hash for seeds. */
export function seedOf(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: the same seed always gives the same sequence. */
export function seededRng(seed: number): ModeRng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- the rule sets --------------------------------------------------------------------------

export interface RuleSet {
  kind: RuleKind;
  difficulty: Difficulty;
  level: LevelId;
  /** Time Attack with a clock: seconds to type as much as you can (0 when there is no clock). */
  seconds: number;
  /** Words that finish the run. Time Attack on Calm: the quota. Survival: the distance. 0: none. */
  goalWords: number;
  /** Survival: grip lost each second, and per wrong key; grip given back per word. */
  drainPerSec: number;
  errorCost: number;
  wordGain: number;
  /** Survival: bonus grip for a word without a mistake. */
  perfectGain: number;
}

const SECONDS: Readonly<Record<LevelId, number>> = { easy: 60, standard: 90, hard: 120 };
const QUOTA: Readonly<Record<LevelId, number>> = { easy: 20, standard: 30, hard: 40 };
const DISTANCE: Readonly<Record<LevelId, number>> = { easy: 25, standard: 35, hard: 50 };

/** Grip lost per second by difficulty (Calm: nothing counts down). */
const DRAIN: Readonly<Record<DifficultyId, number>> = {
  calm: 0,
  steady: 1.6,
  swift: 2.4,
  fierce: 3.4,
  trial: 2.4,
};
const ERROR_COST: Readonly<Record<DifficultyId, number>> = {
  calm: 0,
  steady: 5,
  swift: 7,
  fierce: 10,
  trial: 7,
};

/**
 * The rules for a run. Time Attack on a timed difficulty is a clock; on Calm it is a quota of
 * words with no clock. Survival drains the grip (never on Calm) and ends at its distance, so
 * every difficulty can be finished.
 */
export function rulesFor(kind: RuleKind, level: LevelId, difficulty: DifficultyId): RuleSet {
  const d = DIFFICULTIES[difficulty];
  return {
    kind,
    difficulty: d,
    level,
    seconds: kind === 'timeattack' && d.timers ? SECONDS[level] : 0,
    goalWords: kind === 'timeattack' ? (d.timers ? 0 : QUOTA[level]) : DISTANCE[level],
    drainPerSec: kind === 'survival' && d.timers ? DRAIN[difficulty] : 0,
    errorCost: kind === 'survival' && d.timers ? ERROR_COST[difficulty] : 0,
    wordGain: 8,
    perfectGain: 4,
  };
}

export type RunOutcome = 'time' | 'quota' | 'crossed' | 'tired' | 'failed';

export interface ModeState {
  elapsedMs: number;
  /** Time Attack: milliseconds left, or null when there is no clock. */
  timeLeftMs: number | null;
  /** Survival: grip 0..100, or null in Time Attack. */
  grip: number | null;
  words: number;
  perfect: number;
  errors: number;
  ended: boolean;
  outcome: RunOutcome | null;
}

export const GRIP_MAX = 100;

/** A run of Time Attack or Survival. Feed it the clock, the judged keys and the finished words. */
export class ModeRun {
  private elapsed = 0;
  private grip: number;
  private words = 0;
  private perfect = 0;
  private errors = 0;
  private outcome: RunOutcome | null = null;

  constructor(readonly rules: RuleSet) {
    this.grip = GRIP_MAX;
  }

  get state(): ModeState {
    const r = this.rules;
    return {
      elapsedMs: this.elapsed,
      timeLeftMs: r.seconds > 0 ? Math.max(0, r.seconds * 1000 - this.elapsed) : null,
      grip: r.kind === 'survival' ? this.grip : null,
      words: this.words,
      perfect: this.perfect,
      errors: this.errors,
      ended: this.outcome !== null,
      outcome: this.outcome,
    };
  }

  /** Time passes (milliseconds since the last tick). */
  tick(dtMs: number): void {
    if (this.outcome !== null || dtMs <= 0) return;
    const r = this.rules;
    this.elapsed += dtMs;
    if (r.seconds > 0 && this.elapsed >= r.seconds * 1000) {
      this.elapsed = r.seconds * 1000;
      this.outcome = 'time';
      return;
    }
    if (r.kind === 'survival' && r.drainPerSec > 0) {
      this.grip = Math.max(0, this.grip - (r.drainPerSec * dtMs) / 1000);
      if (this.grip <= 0) this.outcome = 'tired';
    }
  }

  /** A judged key. A wrong key costs grip in Survival and fails Sofer's Trial. */
  key(correct: boolean): void {
    if (this.outcome !== null || correct) return;
    const r = this.rules;
    this.errors += 1;
    if (r.difficulty.failOnError) {
      this.outcome = 'failed';
      return;
    }
    if (r.kind === 'survival' && r.errorCost > 0) {
      this.grip = Math.max(0, this.grip - r.errorCost);
      if (this.grip <= 0) this.outcome = 'tired';
    }
  }

  /** A finished word. */
  word(perfect: boolean): void {
    if (this.outcome !== null) return;
    const r = this.rules;
    this.words += 1;
    if (perfect) this.perfect += 1;
    if (r.kind === 'survival' && r.drainPerSec > 0) {
      this.grip = Math.min(GRIP_MAX, this.grip + r.wordGain + (perfect ? r.perfectGain : 0));
    }
    if (r.goalWords > 0 && this.words >= r.goalWords) {
      this.outcome = r.kind === 'survival' ? 'crossed' : 'quota';
    }
  }

  /** True when the run ended in a way that counts as finished (not a fall or a failed trial). */
  get finished(): boolean {
    return this.outcome === 'time' || this.outcome === 'quota' || this.outcome === 'crossed';
  }
}

// ---- scores and the history -----------------------------------------------------------------

/**
 * One number for a run, kept comparable across runs: words typed (characters / 5) weighted by
 * accuracy cubed, so a clean run beats a fast sloppy one. Derived from what the history keeps
 * (characters and accuracy), so no score needs saving.
 */
export function modeScore(chars: number, accuracy: number): number {
  const acc = Math.max(0, Math.min(100, accuracy)) / 100;
  return Math.max(0, Math.round((chars / 5) * acc * acc * acc));
}

/** The Daily Challenge is a fixed set of words, so speed decides: net WPM weighted by accuracy. */
export function dailyScore(wpm: number, accuracy: number): number {
  const acc = Math.max(0, Math.min(100, accuracy)) / 100;
  return Math.max(0, Math.round(wpm * acc * acc * acc * 10));
}

/** History modes the runs are written under. */
export function modeHistoryKey(mode: ModeId, detail: string, difficulty?: DifficultyId): string {
  return difficulty ? `mode:${mode}:${detail}:${difficulty}` : `mode:${mode}:${detail}`;
}

/** The score a history entry of a mode earned (0 for entries of other modes). */
export function entryScore(e: Pick<HistoryEntry, 'mode' | 'wpm' | 'accuracy' | 'chars'>): number {
  if (e.mode.startsWith('mode:daily:')) return dailyScore(e.wpm, e.accuracy);
  if (e.mode.startsWith('mode:timeattack:') || e.mode.startsWith('mode:survival:')) {
    return modeScore(e.chars, e.accuracy);
  }
  return 0;
}

/** The best score kept for the history entries whose mode starts with `prefix` (0: none yet). */
export function bestScoreOf(history: readonly HistoryEntry[], prefix: string): number {
  let best = 0;
  for (const e of history) {
    if (e.mode.startsWith(prefix)) best = Math.max(best, entryScore(e));
  }
  return best;
}

// ---- the daily challenge --------------------------------------------------------------------

/** The local date as `YYYY-MM-DD`. */
export function dateKey(d: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export interface DailyPlan {
  date: string;
  seed: number;
  /** The setting: an open region. */
  region: RegionId;
  level: LevelId;
  difficulty: DifficultyId;
  kind: RuleKind;
  modifiers: ModifierId[];
  /** Words to type; the run ends there (the daily is a fixed set, so every player has a fair one). */
  words: number;
}

/** Words in a daily run. */
export const DAILY_WORDS = 30;

/**
 * One plan per date: the same date always gives the same scene, level, modifiers and words
 * (for the same learned letters). It only ever uses what the player has open: regions that are
 * open and levels that are unlocked, on the fair Steady difficulty.
 */
export function dailyPlan(
  date: string,
  openRegions: readonly RegionId[],
  levels: readonly LevelId[],
): DailyPlan {
  const seed = seedOf(`otiyot-daily-${date}`);
  const rng = seededRng(seed);
  const pick = <T>(items: readonly T[], fallback: T): T =>
    items.length > 0
      ? (items[Math.min(items.length - 1, Math.floor(rng() * items.length))] as T)
      : fallback;
  const regions = SETTING_REGIONS.filter((r) => openRegions.includes(r));
  const region = pick(regions, 'meadow');
  const level = pick(levels.length > 0 ? levels : ['easy' as LevelId], 'easy');
  const kind: RuleKind = rng() < 0.5 ? 'timeattack' : 'survival';
  const count = rng() < 0.4 ? 1 : 2;
  const pool = [...MODIFIER_IDS];
  const modifiers: ModifierId[] = [];
  for (let i = 0; i < count && pool.length > 0; i += 1) {
    const [m] = pool.splice(Math.floor(rng() * pool.length), 1);
    if (m) modifiers.push(m);
  }
  return {
    date,
    seed,
    region,
    level,
    difficulty: 'steady',
    kind,
    modifiers,
    words: DAILY_WORDS,
  };
}

/** The rules of a daily run: a fixed number of words, Survival's grip or none, never a clock. */
export function dailyRules(plan: DailyPlan): RuleSet {
  const base = rulesFor(plan.kind, plan.level, plan.difficulty);
  return { ...base, seconds: 0, goalWords: plan.words };
}

// ---- modifiers ------------------------------------------------------------------------------

/**
 * Mirror: every word is typed backwards. The letters stay the learned ones; Hebrew final letters
 * are put right (a final form that lands mid-word becomes its plain letter, and only when that
 * letter is learned), so nothing unlearned ever appears.
 */
export function mirrorWord(word: string, known: ReadonlySet<string>, language: LayoutId): string {
  const reversed = [...word].reverse().join('');
  if (language !== 'he') return reversed;
  return fixFinalLetters(reversed, known, () => 1);
}

/** The seeded word count after which the "sudden layout" happens (the keyboard guide vanishes). */
export function suddenAfter(rng: ModeRng): number {
  return 4 + Math.floor(rng() * 7);
}

export interface ModifierView {
  /** Hide the dimmed next word. */
  hideLookahead: boolean;
  /** Blur the letters still to come. */
  fog: boolean;
}

export function viewOf(mods: readonly ModifierId[]): ModifierView {
  return { hideLookahead: mods.includes('noLookahead'), fog: mods.includes('fog') };
}

/** Wraps a word source so mirrored words come out (the other modifiers are shown, not typed). */
export function withModifiers(
  source: { next(): string },
  mods: readonly ModifierId[],
  known: ReadonlySet<string>,
  language: LayoutId,
): { next(): string } {
  if (!mods.includes('mirror')) return source;
  return {
    next(): string {
      return mirrorWord(source.next(), known, language);
    },
  };
}

// ---- choices open to a profile --------------------------------------------------------------

/** Levels open to the profile (Easy always). */
export function openLevels(profile: Profile): LevelId[] {
  const lv = levelsFor(profile);
  return lv.length > 0 ? lv : [LEVEL_IDS[0]];
}

/** Difficulties a mode offers: all five. */
export const MODE_DIFFICULTIES: readonly DifficultyId[] = DIFFICULTY_IDS;

/** True when the profile has learned enough letters for any run at all. */
export function hasLetters(profile: Profile): boolean {
  return learnedLetters(knownKeysOf(profile)) >= 2;
}

// ---- practice -------------------------------------------------------------------------------

export interface PracticePlan {
  kind: PracticeKind;
  /** Minutes to drill (2, 5 or 10) for the generated kinds. */
  minutes: number;
  /** The lesson to drill, for kind 'lesson'. */
  lessonId?: string;
  /** The player's own words, for kind 'custom'. */
  custom?: string;
}

export interface PracticeText {
  text: string;
  /** Keys the drill leans on (weak or due), for a line of explanation. */
  focus: string[];
  /** True when the plan could not be met and a general drill was made instead. */
  fallback: boolean;
}

/** Keeps only the words made entirely of learned keys. */
export function learnedOnly(text: string, known: ReadonlySet<string>): string {
  return text
    .split(/\s+/)
    .filter((w) => w !== '' && [...w].every((c) => known.has(c)))
    .join(' ');
}

/** The lessons of the active track, in order, for the lesson picker. */
export function trackLessons(profile: Profile): Lesson[] {
  const track = getTrack(profile.track);
  const out: Lesson[] = [];
  for (const lvl of track.levels(profile.layout, profile.settings.uiLanguage)) {
    out.push(...track.lessons(lvl.id, profile.layout, profile.settings.uiLanguage));
  }
  return out;
}

/** Practice text for a plan: targeted drills built only from learned keys. */
export function practiceText(
  profile: Profile,
  plan: PracticePlan,
  now: number,
  rng: ModeRng,
): PracticeText {
  const known = knownKeysOf(profile);
  const letters = [...known].filter((c) => /\p{L}/u.test(c));
  const length = Math.max(20, Math.round(plan.minutes * CHARS_PER_MINUTE));
  const language = profile.layout;
  const general = (focus: string[], fallback: boolean): PracticeText => {
    const text = buildMicroLesson(profile, plan.minutes, now, rng).text.replace(/\s+/g, ' ').trim();
    return { text: learnedOnly(text, known), focus, fallback };
  };

  if (plan.kind === 'weak') {
    const weak = weakCharacters(profile, known, 4).map((w) => w.ch);
    if (weak.length === 0) return general([], true);
    let text = generateWordDrill({
      language,
      known,
      weakChars: weak,
      count: Math.max(8, Math.round(length / 5)),
      rng,
    });
    if (text.trim() === '') {
      text = generateCharDrill({ known: letters, length, weakChars: weak, rng });
    }
    return { text: learnedOnly(text, known), focus: weak, fallback: false };
  }

  if (plan.kind === 'review') {
    const due = dueToday(profile, known, now, 8);
    const keys = due.filter((d) => d.kind === 'key').map((d) => d.id);
    const pairs = due.filter((d) => d.kind === 'pair').map((d) => d.id);
    if (keys.length === 0 && pairs.length === 0) return general([], true);
    const parts: string[] = [];
    if (pairs.length > 0) parts.push(generateBigramDrill(pairs));
    if (keys.length > 0) {
      parts.push(generateCharDrill({ known: letters, length, weakChars: keys, rng }));
    }
    return {
      text: learnedOnly(parts.join(' '), known),
      focus: [...keys, ...pairs],
      fallback: false,
    };
  }

  if (plan.kind === 'lesson') {
    const lesson = trackLessons(profile).find((l) => l.id === plan.lessonId);
    if (!lesson) return general([], true);
    const text = lesson.text(contextFor(profile));
    return { text: learnedOnly(text, known), focus: [], fallback: false };
  }

  // custom: the player's own words, kept only when they use learned keys.
  return { text: learnedOnly(plan.custom ?? '', known), focus: [], fallback: false };
}
