// The two built-in lesson tracks and the rules they share (levels, lesson lists, unlocking).
//
// Track 1 "Letter by letter"  : ported from reference/plugin-3.3.0.
// Track 2 "Words from the start": ported from reference/plugin-4.2.0.

import { KEYS, type LayoutId } from '../core';
import { HE_LEVELS_TRACK1, HE_LEVELS_TRACK2 } from './data/curriculum';
import { exercise1, keyOrder1, knownKeys1, level1LessonId1, level1Text1 } from './text1';
import {
  exercise2,
  keyOrder2,
  knownKeys2,
  level1LessonCount2,
  level1LessonId2,
  level1LessonKeys2,
  level1Text2,
} from './text2';
import type { Lesson, LevelInfo, TextContext, Track, TrackId } from './types';
import { fingerName, keyChar, repeatToLength } from './util';

/** Default accuracy (percent) needed to pass a lesson. */
export const DEFAULT_PASS_ACCURACY = 90;

/** Fraction of the previous level that must be passed before a level opens. */
export const LEVEL_OPEN_FRACTION = 0.7;

function level0Len(ctx: TextContext): number {
  return Math.max(30, Number(ctx.practiceLength) || 50);
}

const EN_LEVELS_BASE: readonly [string, string][] = [
  ['Getting Started', 'Keyboard and hand positioning'],
  ['', ''], // Level 1 differs per track
  ['Key Combinations', 'Combine keys you have learned'],
  ['Short Words', 'Real short English words'],
  ['Words & Sentences', 'Longer words and short sentences'],
  ['Paragraphs', 'Continuous English text with punctuation'],
  ['Advanced English', 'Expanded vocabulary and complex sentences'],
  ['Mastery', 'Long realistic typing without assistance'],
];

function levelsFor(trackId: TrackId, language: LayoutId, ui: LayoutId): LevelInfo[] {
  if (language === 'en') {
    const lvl1: [string, string] =
      trackId === 1
        ? ['Individual Keys', 'Learn each key individually, home row first']
        : ['First Keys & Words', 'Two new keys per lesson, mixed with real words'];
    return EN_LEVELS_BASE.map(([name, desc], id) =>
      id === 1 ? { id, name: lvl1[0], desc: lvl1[1] } : { id, name, desc },
    );
  }
  const src = trackId === 1 ? HE_LEVELS_TRACK1 : HE_LEVELS_TRACK2;
  return src.map((l) =>
    ui === 'en'
      ? { id: l.id, name: l.en, desc: l.enDesc }
      : { id: l.id, name: l.he, desc: l.heDesc },
  );
}

function level0Lessons(language: LayoutId, ui: LayoutId): Lesson[] {
  const en = language === 'en';
  const u = ui === 'en';
  const mk = (
    n: number,
    title: [string, string],
    tip: string | undefined,
    groups: () => readonly string[],
  ): Lesson => ({
    id: `L0-${n}`,
    levelId: 0,
    title: u ? title[1] : title[0],
    tip,
    niqud: false,
    text: (ctx) => repeatToLength(groups(), level0Len(ctx)),
  });
  const tip0 = en
    ? u
      ? '🖐️ Left fingers on A S D F, right fingers on J K L ; — feel the bumps on F and J. Thumbs on the space bar.'
      : '🖐️ אצבעות יד שמאל על A S D F, יד ימין על J K L ; — הרגישו את הבליטות על F ו-J. האגודלים על מקש הרווח.'
    : u
      ? '🖐️ Left fingers on ש ד ג כ, right fingers on ח ל ך ף — feel the bumps on כ and ח. Thumbs on the space bar.'
      : '🖐️ אצבעות יד שמאל על ש ד ג כ, יד ימין על ח ל ך ף — הרגישו את הבליטות על כ ו-ח. האגודלים על מקש הרווח.';
  const tip1 = u
    ? '🖐️ Each finger has its own keys. Keep your wrists relaxed and return to the home row after every key.'
    : '🖐️ לכל אצבע המקשים שלה. פרקי כף היד רפויים, וחוזרים לשורת הבית אחרי כל הקשה.';
  const tip2 = u
    ? '🖐️ All eight fingers on the home row. Look at the screen, not your hands.'
    : '🖐️ כל שמונה האצבעות על שורת הבית. הסתכלו על המסך, לא על הידיים.';
  return [
    mk(0, ['היכרות עם שורת הבית', 'Meet the home row'], tip0, () =>
      en ? ['fj', 'jf', 'ff', 'jj', 'fjf', 'jfj'] : ['כח', 'חכ', 'ככ', 'חח', 'כחכ', 'חכח'],
    ),
    mk(1, ['מיקום ידיים ואצבעות', 'Hand and finger position'], tip1, () =>
      en ? ['fjdk', 'dkfj', 'slsl', 'asdf', 'jkl;'] : ['כחגל', 'גלכח', 'דךדך', 'שדגכ', 'חלךף'],
    ),
    mk(2, ['כל שורת הבית', 'The whole home row'], tip2, () =>
      en
        ? ['asdf', 'jkl;', 'fdsa', ';lkj', 'ads', 'lkj', 'fall', 'dad', 'sad']
        : ['שדגכ', 'חלךף', 'כגדש', 'ףךלח', 'שדג', 'חלך', 'לך', 'דג', 'גל'],
    ),
  ];
}

function fingerOf(code: string) {
  return KEYS[code]?.finger;
}

function track1Level1(language: LayoutId, ui: LayoutId): Lesson[] {
  const u = ui === 'en';
  return keyOrder1(language).map((code, idx) => {
    const ch = keyChar(language, code);
    const finger = fingerName(fingerOf(code), ui);
    return {
      id: level1LessonId1(idx),
      levelId: 1,
      title: u ? `Key: ${ch}` : `אות: ${ch}`,
      keyCodes: [code],
      tip: u
        ? `New key: "${ch}" — use your ${finger.toLowerCase()}.`
        : `אות חדשה: "${ch}" — הקלידו עם ${finger}.`,
      niqud: false,
      text: (ctx) => level1Text1(idx, level0Len(ctx), ctx),
    };
  });
}

function track2Level1(language: LayoutId, ui: LayoutId): Lesson[] {
  const u = ui === 'en';
  const out: Lesson[] = [];
  for (let j = 0; j < level1LessonCount2(language); j++) {
    const codes = level1LessonKeys2(language, j);
    const show = codes
      .map((c) => (keyChar(language, c) === ' ' ? '␣' : keyChar(language, c)))
      .join(' ');
    const fingers = Array.from(new Set(codes.map((c) => fingerName(fingerOf(c), ui)))).join(' / ');
    out.push({
      id: level1LessonId2(j),
      levelId: 1,
      title: u ? `Keys: ${show}` : `אותיות: ${show}`,
      keyCodes: codes,
      tip: u
        ? `New keys: ${show} — ${fingers.toLowerCase()}. Mixed with the keys you already know, and real words.`
        : `אותיות חדשות: ${show} — ${fingers}. משולבות עם האותיות שכבר למדתם, ובמילים אמיתיות.`,
      niqud: false,
      text: (ctx) => level1Text2(j, Math.round(level0Len(ctx) * 1.2), ctx),
    });
  }
  return out;
}

function exerciseLessons(
  levelId: number,
  levelName: string,
  language: LayoutId,
  ui: LayoutId,
  exercise: (level: number, ctx: TextContext) => string,
): Lesson[] {
  const out: Lesson[] = [];
  for (let i = 0; i < 6; i++) {
    out.push({
      id: `L${levelId}-${i}`,
      levelId,
      title: ui === 'en' ? `${levelName} — Exercise ${i + 1}` : `${levelName} — תרגיל ${i + 1}`,
      niqud: language !== 'en' && levelId === 7,
      text: (ctx) => exercise(levelId, ctx),
    });
  }
  return out;
}

function makeTrack(id: TrackId): Track {
  const t1 = id === 1;
  const level1 = t1 ? track1Level1 : track2Level1;
  const exercise = t1 ? exercise1 : exercise2;
  const track: Track = {
    id,
    name: t1
      ? { he: 'אות אחר אות', en: 'Letter by letter' }
      : { he: 'מילים מההתחלה', en: 'Words from the start' },
    passAccuracy: DEFAULT_PASS_ACCURACY,
    levels: (language, ui) => levelsFor(id, language, ui),
    lessons(levelId, language, ui) {
      if (levelId === 0) return level0Lessons(language, ui);
      if (levelId === 1) return level1(language, ui);
      const info = levelsFor(id, language, ui)[levelId];
      if (!info) return [];
      return exerciseLessons(levelId, info.name, language, ui, exercise);
    },
    keyOrder: (language) => (t1 ? keyOrder1(language) : keyOrder2(language)),
    knownKeys: (ctx) => (t1 ? knownKeys1(ctx) : knownKeys2(ctx)),
    exercise,
  };
  return track;
}

export const TRACK_1: Track = makeTrack(1);
export const TRACK_2: Track = makeTrack(2);

export function getTrack(id: TrackId): Track {
  return id === 2 ? TRACK_2 : TRACK_1;
}

// ---- unlocking and "continue" ----------------------------------------------------------------

/** A lesson is open when it was passed, belongs to Level 0, or the one before it was passed. */
export function isLessonUnlocked(
  track: Track,
  language: LayoutId,
  ui: LayoutId,
  levelId: number,
  idx: number,
  completed: readonly string[],
): boolean {
  const lessons = track.lessons(levelId, language, ui);
  const lesson = lessons[idx];
  if (!lesson) return false;
  const done = new Set(completed);
  if (done.has(lesson.id)) return true;
  if (levelId === 0) return true;
  if (idx === 0) {
    if (levelId === 1) return true;
    const prev = track.lessons(levelId - 1, language, ui);
    const count = prev.filter((l) => done.has(l.id)).length;
    return count >= Math.ceil(prev.length * LEVEL_OPEN_FRACTION);
  }
  const before = lessons[idx - 1];
  return before !== undefined && done.has(before.id);
}

export interface NextLesson {
  levelId: number;
  index: number;
  lesson: Lesson;
}

/** First open lesson that has not been passed yet (the "Continue" button). */
export function findNextLesson(
  track: Track,
  language: LayoutId,
  ui: LayoutId,
  completed: readonly string[],
): NextLesson | null {
  const done = new Set(completed);
  for (const lvl of track.levels(language, ui)) {
    const lessons = track.lessons(lvl.id, language, ui);
    for (let i = 0; i < lessons.length; i++) {
      const lesson = lessons[i] as Lesson;
      if (!done.has(lesson.id) && isLessonUnlocked(track, language, ui, lvl.id, i, completed)) {
        return { levelId: lvl.id, index: i, lesson };
      }
    }
  }
  return null;
}

/** Highest level that has a passed lesson (replaces the old stored "active level"). */
export function levelOfLessonId(id: string): number {
  const m = /^L(\d+)/.exec(id);
  return m ? Number(m[1]) : 0;
}

export function activeLevelOf(completed: readonly string[]): number {
  let max = 0;
  for (const id of completed) max = Math.max(max, levelOfLessonId(id));
  return max;
}

/** True when a finished run passes the lesson. */
export function lessonPassed(accuracy: number, threshold: number = DEFAULT_PASS_ACCURACY): boolean {
  return accuracy >= threshold;
}
