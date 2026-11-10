// Shared types for the lesson tracks. Pure logic: no DOM, no Three.js, no clock.

import type { LayoutId } from '../core';

/** Returns a number in [0, 1). Injected so lessons are reproducible in tests. */
export type Rng = () => number;

/** Everything a lesson needs to generate its text. */
export interface TextContext {
  /** Curriculum language (which keys and words are taught). */
  language: LayoutId;
  /** Interface language (decides titles and tips). */
  uiLanguage: LayoutId;
  /** Ids of the lessons already passed on this track and language. */
  completed: readonly string[];
  /** Highest level reached so far. */
  activeLevel: number;
  /** Target exercise length in characters (the old "practice length" setting). */
  practiceLength: number;
  /** Weakest keys first; supplied by the adaptive engine (T06). */
  weakChars: readonly string[];
  /** Weakest two-letter transitions first; supplied by the adaptive engine (T06). */
  weakBigrams: readonly string[];
  /** Challenge level 0..1 (Track 2 difficulty controller). */
  difficulty: number;
  rng: Rng;
}

export const DEFAULT_PRACTICE_LENGTH = 50;
export const DEFAULT_DIFFICULTY = 0.3;

export function makeContext(partial: Partial<TextContext> = {}): TextContext {
  return {
    language: 'he',
    uiLanguage: 'he',
    completed: [],
    activeLevel: 0,
    practiceLength: DEFAULT_PRACTICE_LENGTH,
    weakChars: [],
    weakBigrams: [],
    difficulty: DEFAULT_DIFFICULTY,
    rng: Math.random,
    ...partial,
  };
}

export interface LevelInfo {
  id: number;
  name: string;
  desc: string;
}

export interface Lesson {
  id: string;
  levelId: number;
  title: string;
  tip?: string;
  /** Physical keys introduced by this lesson (Level 1 only). */
  keyCodes?: readonly string[];
  /** True when the text keeps its vowel marks (Hebrew niqqud level). */
  niqud: boolean;
  /** Generates a fresh text for this lesson. */
  text(ctx: TextContext): string;
}

export type TrackId = 1 | 2;

export interface Track {
  readonly id: TrackId;
  readonly name: { he: string; en: string };
  /** Accuracy (percent) needed to pass a lesson and unlock the next. */
  readonly passAccuracy: number;
  levels(language: LayoutId, ui: LayoutId): LevelInfo[];
  lessons(levelId: number, language: LayoutId, ui: LayoutId): Lesson[];
  /** Physical keys in the order Level 1 teaches them. */
  keyOrder(language: LayoutId): readonly string[];
  /** Characters the learner has been introduced to so far. */
  knownKeys(ctx: TextContext): Set<string>;
  /** Free exercise for a level (what levels 2+ use). */
  exercise(levelId: number, ctx: TextContext): string;
}
