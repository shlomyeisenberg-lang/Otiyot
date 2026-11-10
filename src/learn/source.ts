// TextSource: the text a scene (or practice mode) asks for. Given a profile and a "band" of
// the active track, it returns the next words or sentences.

import { activeLevelOf, findNextLesson, getTrack } from './track';
import { getProgress } from './progress';
import type { Profile } from '../save';
import {
  DEFAULT_DIFFICULTY,
  DEFAULT_PRACTICE_LENGTH,
  type Lesson,
  type Rng,
  type TextContext,
} from './types';

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
  return {
    language: profile.layout,
    uiLanguage: profile.settings.uiLanguage,
    completed,
    activeLevel: activeLevelOf(completed),
    practiceLength: opts.practiceLength ?? DEFAULT_PRACTICE_LENGTH,
    weakChars: opts.weakChars ?? [],
    weakBigrams: opts.weakBigrams ?? [],
    difficulty: opts.difficulty ?? DEFAULT_DIFFICULTY,
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
  if (levelId >= 2 && band.lesson === undefined) return track.exercise(levelId, ctx);
  const lesson = lessonForBand(profile, { level: levelId, lesson: band.lesson });
  return lesson ? lesson.text(ctx) : '';
}

/** Text for the learner's next unfinished lesson ("Continue"); null when the course is done. */
export function nextContinueText(profile: Profile, opts: TextSourceOptions = {}): string | null {
  const track = getTrack(profile.track);
  const ctx = contextFor(profile, opts);
  const next = findNextLesson(track, ctx.language, ctx.uiLanguage, ctx.completed);
  return next ? next.lesson.text(ctx) : null;
}
