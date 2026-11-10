import { describe, expect, it } from 'vitest';
import type { LayoutId } from '../../src/core';
import {
  NIQUD_SAMPLES,
  TRACK_1,
  TRACK_2,
  findNextLesson,
  isLessonUnlocked,
  makeContext,
  type Track,
} from '../../src/learn';
import { loadOriginal, mulberry32, type Original } from './learn-harness';

const ORIGINAL_NIQUD_SAMPLE = 'בְּרֵאשִׁית בָּרָא אֱלֹהִים';
const REPLACED_SAMPLE = 'שַׁבָּת שָׁלוֹם וּמְבֹרָךְ';

const setups: { name: string; track: Track; version: '3.3.0' | '4.2.0' }[] = [
  { name: 'Track 1 (3.3.0)', track: TRACK_1, version: '3.3.0' },
  { name: 'Track 2 (4.2.0)', track: TRACK_2, version: '4.2.0' },
];
const langs: LayoutId[] = ['he', 'en'];

function sync(orig: Original, lang: LayoutId, ui: LayoutId, completed: string[], level: number) {
  orig.state.lang = lang;
  orig.state.ui = ui;
  orig.state.completed = completed;
  orig.state.activeLevel = level;
  orig.state.practiceLength = 50;
  orig.state.weakChars = [];
  orig.state.weakBigrams = [];
  orig.state.difficulty = 0.3;
}

/** Original output, with the one replaced niqqud sample mapped to its new text. */
const fixNiqud = (s: string) => s.replace(ORIGINAL_NIQUD_SAMPLE, REPLACED_SAMPLE);

describe.each(setups)('$name matches the original plugin', ({ track, version }) => {
  const orig = loadOriginal(version);

  it.each(langs.flatMap((l) => (['he', 'en'] as LayoutId[]).map((u) => [l, u] as const)))(
    'levels and lesson lists (curriculum %s, ui %s)',
    (lang, ui) => {
      sync(orig, lang, ui, [], 0);
      const levels = orig.levels();
      expect(track.levels(lang, ui)).toEqual(levels);
      for (const lvl of levels) {
        const a = orig.lessons(lvl.id);
        const b = track.lessons(lvl.id, lang, ui);
        expect(b.map((l) => l.id)).toEqual(a.map((l) => l.id));
        expect(b.map((l) => l.title)).toEqual(a.map((l) => l.title));
        expect(b.map((l) => l.tip)).toEqual(a.map((l) => l.tip));
        expect(b.map((l) => !!l.niqud)).toEqual(a.map((l) => !!l.niqud));
        expect(b.every((l) => l.levelId === lvl.id)).toBe(true);
      }
    },
  );

  it('lesson text is identical for the same random numbers', () => {
    let checked = 0;
    for (const lang of langs) {
      sync(orig, lang, 'he', [], 0);
      for (const level of orig.levels().map((l) => l.id)) {
        for (const practiceLength of [50, 90]) {
          for (const done of [
            [],
            ['L1-0', 'L1-1', 'L1-2', 'L1p-0', 'L1p-1', 'L1p-2', 'L1p-3', 'L1p-4'],
          ]) {
            for (const [weakChars, weakBigrams] of [
              [[], []],
              [
                ['כ', 'ל', 'a', 's'],
                ['לכ', 'as'],
              ],
            ] as [string[], string[]][]) {
              for (const difficulty of [0.1, 0.3, 0.9]) {
                sync(orig, lang, 'he', done, Math.max(level, done.length ? 2 : 0));
                orig.state.practiceLength = practiceLength;
                orig.state.weakChars = weakChars;
                orig.state.weakBigrams = weakBigrams;
                orig.state.difficulty = difficulty;
                const ol = orig.lessons(level);
                const mine = track.lessons(level, lang, 'he');
                const pick = [0, Math.floor(ol.length / 2), ol.length - 1];
                for (const i of [...new Set(pick)]) {
                  const seed = 1000 + checked;
                  orig.seed(seed);
                  const expected = fixNiqud((ol[i] as { gen(): string }).gen());
                  const ctx = makeContext({
                    language: lang,
                    uiLanguage: 'he',
                    completed: done,
                    activeLevel: Math.max(level, done.length ? 2 : 0),
                    practiceLength,
                    weakChars,
                    weakBigrams,
                    difficulty,
                    rng: mulberry32(seed),
                  });
                  const got = (mine[i] as { text(c: typeof ctx): string }).text(ctx);
                  expect(got, `${lang} level ${level} lesson ${i}`).toBe(expected);
                  expect(got.length).toBeGreaterThan(0);
                  checked++;
                }
              }
            }
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(200);
  });

  it('free exercises match the original', () => {
    for (const lang of langs) {
      for (let level = 0; level <= (lang === 'en' ? 7 : 8); level++) {
        for (const seed of [5, 6, 7]) {
          sync(orig, lang, 'he', ['L1-0', 'L1p-0', 'L1p-1'], 2);
          orig.seed(seed);
          const expected = fixNiqud(orig.exercise(level));
          const ctx = makeContext({
            language: lang,
            completed: ['L1-0', 'L1p-0', 'L1p-1'],
            activeLevel: 2,
            rng: mulberry32(seed),
          });
          expect(track.exercise(level, ctx)).toBe(expected);
        }
      }
    }
  });

  it('unlock rule and "continue" match the original', () => {
    const states: string[][] = [
      [],
      ['L0-0', 'L0-1', 'L0-2'],
      version === '3.3.0'
        ? ['L1-0', 'L1-1', 'L1-2', 'L1-3']
        : ['L1p-0', 'L1p-1', 'L1p-2', 'L1p-3', 'L1p-4'],
      ['L2-0', 'L2-1', 'L2-2', 'L2-3', 'L2-4', 'L2-5', 'L3-0'],
    ];
    for (const lang of langs) {
      for (const done of states) {
        sync(orig, lang, 'he', done, 0);
        for (const lvl of orig.levels()) {
          const n = orig.lessons(lvl.id).length;
          for (let i = 0; i < n; i++) {
            expect(isLessonUnlocked(track, lang, 'he', lvl.id, i, done)).toBe(
              orig.unlocked(lvl.id, i),
            );
          }
        }
        const o = orig.next();
        const m = findNextLesson(track, lang, 'he', done);
        expect(m ? { levelId: m.levelId, lessonId: m.lesson.id } : null).toEqual(o);
      }
    }
  });
});

describe('content rules', () => {
  it('replaced the verse sample with a plain greeting', () => {
    expect(NIQUD_SAMPLES).toContain(REPLACED_SAMPLE);
    expect(NIQUD_SAMPLES).not.toContain(ORIGINAL_NIQUD_SAMPLE);
  });
});
