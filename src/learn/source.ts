// TextSource: the text a scene (or practice mode) asks for. Given a profile and a "band" of
// the active track, it returns the next words or sentences.

import { activeLevelOf, findNextLesson, getTrack } from './track';
import { getProgress } from './progress';
import type { Profile } from '../save';
import { adaptiveOptions, knownKeysOf } from './adaptive';
import { cleanText, isAllowedWord } from './content';
import { eligibleWords } from './library';
import { DEFAULT_PRACTICE_LENGTH, type Lesson, type Rng, type TextContext } from './types';

/** A slice of the track a scene teaches: a level, optionally one lesson of it. */
export interface SceneBand {
  level: number;
  /** Index of a lesson inside the level; omitted = the learner's current lesson. */
  lesson?: number;
}

export interface TextSourceOptions {
  rng?: Rng;
  practiceLength?: number;
  /** From the adaptive engine (T06): weakest keys first. */
  weakChars?: readonly string[];
  weakBigrams?: readonly string[];
  difficulty?: number;
}

export function contextFor(profile: Profile, opts: TextSourceOptions = {}): TextContext {
  const completed = getProgress(profile).completed;
  // Weak keys, weak transitions and difficulty come from the adaptive engine unless given.
  const adaptive = adaptiveOptions(profile);
  return {
    language: profile.layout,
    uiLanguage: profile.settings.uiLanguage,
    completed,
    activeLevel: activeLevelOf(completed),
    practiceLength: opts.practiceLength ?? DEFAULT_PRACTICE_LENGTH,
    weakChars: opts.weakChars ?? adaptive.weakChars,
    weakBigrams: opts.weakBigrams ?? adaptive.weakBigrams,
    difficulty: opts.difficulty ?? adaptive.difficulty,
    rng: opts.rng ?? Math.random,
  };
}

/** The lesson a band points at for this profile (undefined above Level 1: free exercise). */
export function lessonForBand(profile: Profile, band: SceneBand): Lesson | undefined {
  const track = getTrack(profile.track);
  const ctx = contextFor(profile);
  const levels = track.levels(ctx.language, ctx.uiLanguage);
  const levelId = Math.max(0, Math.min(levels.length - 1, Math.floor(band.level)));
  const lessons = track.lessons(levelId, ctx.language, ctx.uiLanguage);
  if (band.lesson !== undefined)
    return lessons[Math.max(0, Math.min(lessons.length - 1, band.lesson))];
  const done = new Set(ctx.completed);
  return lessons.find((l) => !done.has(l.id)) ?? lessons[lessons.length - 1];
}

/** Next text for a scene band from the profile's active track. */
export function nextText(profile: Profile, band: SceneBand, opts: TextSourceOptions = {}): string {
  const track = getTrack(profile.track);
  const ctx = contextFor(profile, opts);
  const levels = track.levels(ctx.language, ctx.uiLanguage);
  const levelId = Math.max(0, Math.min(levels.length - 1, Math.floor(band.level)));
  if (levelId >= 2 && band.lesson === undefined)
    return cleanText(track.exercise(levelId, ctx), ctx.language);
  const lesson = lessonForBand(profile, { level: levelId, lesson: band.lesson });
  return lesson ? cleanText(lesson.text(ctx), ctx.language) : '';
}

/** Text for the learner's next unfinished lesson ("Continue"); null when the course is done. */
export function nextContinueText(profile: Profile, opts: TextSourceOptions = {}): string | null {
  const track = getTrack(profile.track);
  const ctx = contextFor(profile, opts);
  const next = findNextLesson(track, ctx.language, ctx.uiLanguage, ctx.completed);
  return next ? cleanText(next.lesson.text(ctx), ctx.language) : null;
}

export interface LearnedWordOptions {
  rng: Rng;
  /** Shortest and longest word, in letters. Defaults 2 and 7. */
  minLength?: number;
  maxLength?: number;
}

/** Fewer real words than this and letter drills are mixed in, so the text does not repeat. */
const MIN_WORD_POOL = 12;

/**
 * Single words built only from the keys this profile has already learned on its active track
 * (ARCHITECTURE section 8, "Learned letters only"). Real words from the library when the learned
 * set can spell enough of them; otherwise short drills made of the learned letters themselves.
 * The learned set is read once, when the source is made.
 */
export function learnedWordSource(
  profile: Profile,
  opts: LearnedWordOptions,
): { next(): string; readonly keys: ReadonlySet<string> } {
  const { rng } = opts;
  const min = Math.max(1, opts.minLength ?? 2);
  const max = Math.max(min, opts.maxLength ?? 7);
  const language = profile.layout;
  const keys = knownKeysOf(profile);
  const letters = [...keys].filter((c) => c.trim() !== '' && /\p{L}/u.test(c));
  const pool = eligibleWords({ language, allowedChars: keys, minLength: min, maxLength: max });
  const pick = <T>(items: readonly T[]): T =>
    items[Math.min(items.length - 1, Math.floor(rng() * items.length))] as T;

  const drill = (): string => {
    if (letters.length === 0) return '';
    const top = Math.min(max, Math.max(min, 4));
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const length = min + Math.floor(rng() * (top - min + 1));
      let word = '';
      for (let i = 0; i < length; i += 1) word += pick(letters);
      if (isAllowedWord(word, language)) return word;
    }
    return pick(letters).repeat(min);
  };

  return {
    keys,
    next(): string {
      if (pool.length >= MIN_WORD_POOL) return pick(pool);
      if (pool.length > 0 && rng() < 0.5) return pick(pool);
      return drill();
    },
  };
}
