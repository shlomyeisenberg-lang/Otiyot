import { describe, expect, it } from 'vitest';
import { createProfile } from '../../src/save';
import {
  activeLevelOf,
  contextFor,
  getProgress,
  lessonForBand,
  lessonPassed,
  makeContext,
  nextContinueText,
  nextText,
  progressKey,
  recordLessonResult,
  switchTrack,
  TRACK_1,
  TRACK_2,
} from '../../src/learn';
import { mulberry32 } from './learn-harness';
import {
  EN_PARAGRAPHS,
  EN_SENTENCES,
  EN_WORD_BANK,
  HE_PARAGRAPHS,
  HE_SENTENCES,
  HE_WORD_BANK,
} from '../../src/learn/data/banks';
import {
  EN_AFFIX_CHUNKS,
  EN_LEXICON,
  EN_TOP_WORDS,
  HE_AFFIX_CHUNKS,
  HE_LEXICON,
  HE_TOP_WORDS,
} from '../../src/learn/data/lexicon';
import { NIQUD_SAMPLES } from '../../src/learn';

const fresh = () => createProfile('p1', 'Test', 0);

describe('progress per track', () => {
  it('passing needs the accuracy threshold (default 90%)', () => {
    expect(lessonPassed(90)).toBe(true);
    expect(lessonPassed(89.9)).toBe(false);
    expect(lessonPassed(95, 97)).toBe(false);
  });

  it('records passes and keeps the best run', () => {
    const p = fresh();
    expect(recordLessonResult(p, 'L1-0', { wpm: 10, accuracy: 80 })).toEqual({
      passed: false,
      newBest: true,
    });
    expect(getProgress(p).completed).toEqual([]);
    expect(recordLessonResult(p, 'L1-0', { wpm: 12, accuracy: 95, stars: 2 }).passed).toBe(true);
    recordLessonResult(p, 'L1-0', { wpm: 30, accuracy: 91, stars: 1 });
    expect(getProgress(p).completed).toEqual(['L1-0']);
    expect(getProgress(p).best['L1-0']).toMatchObject({ stars: 2, wpm: 12 });
  });

  it('switching tracks never loses progress', () => {
    const p = fresh();
    recordLessonResult(p, 'L1-0', { wpm: 20, accuracy: 96 });
    recordLessonResult(p, 'L1-1', { wpm: 20, accuracy: 96 });
    switchTrack(p, 2);
    expect(p.track).toBe(2);
    expect(getProgress(p).completed).toEqual([]);
    recordLessonResult(p, 'L1p-0', { wpm: 20, accuracy: 96 });
    switchTrack(p, 1);
    expect(getProgress(p).completed).toEqual(['L1-0', 'L1-1']);
    switchTrack(p, 2);
    expect(getProgress(p).completed).toEqual(['L1p-0']);
  });

  it('keeps Hebrew and English progress apart', () => {
    const p = fresh();
    recordLessonResult(p, 'L1p-0', { wpm: 20, accuracy: 96 });
    p.layout = 'en';
    expect(getProgress(p).completed).toEqual([]);
    expect(progressKey(2, 'en')).toBe('2-en');
    expect(progressKey(1, 'he')).toBe('1');
  });

  it('derives the active level from passed lessons', () => {
    expect(activeLevelOf([])).toBe(0);
    expect(activeLevelOf(['L0-0', 'L1p-3', 'L4-1'])).toBe(4);
  });
});

describe('TextSource', () => {
  it('serves text from the active track and switches with it', () => {
    const p = fresh();
    const rng = () => mulberry32(3);
    const one = nextText(p, { level: 1, lesson: 0 }, { rng: rng() });
    switchTrack(p, 2);
    const two = nextText(p, { level: 1, lesson: 0 }, { rng: rng() });
    expect(one.length).toBeGreaterThan(0);
    expect(two.length).toBeGreaterThan(0);
    expect(one).not.toBe(two);
    // Track 1 lesson 0 teaches only כ ח; Track 2 lesson 0 adds real-word mixing.
    expect(one.replace(/ /g, '')).toMatch(/^[כח]+$/);
  });

  it('gives a free exercise above Level 1 and respects the language', () => {
    const p = fresh();
    p.layout = 'en';
    const t = nextText(p, { level: 5 }, { rng: mulberry32(9) });
    expect(t).toMatch(/[a-z]/);
    expect(t).not.toMatch(/[א-ת]/);
  });

  it('clamps a band beyond the last level', () => {
    const p = fresh();
    p.layout = 'en';
    expect(nextText(p, { level: 99 }, { rng: mulberry32(2) }).length).toBeGreaterThan(0);
    expect(lessonForBand(p, { level: 99 })?.levelId).toBe(7);
  });

  it('follows the learner: the current lesson is the first one not yet passed', () => {
    const p = fresh();
    expect(lessonForBand(p, { level: 1 })?.id).toBe('L1-0');
    recordLessonResult(p, 'L1-0', { wpm: 10, accuracy: 100 });
    expect(lessonForBand(p, { level: 1 })?.id).toBe('L1-1');
    expect(contextFor(p).completed).toEqual(['L1-0']);
  });

  it('continue text is null once the whole course is passed', () => {
    const p = fresh();
    expect(nextContinueText(p, { rng: mulberry32(1) })).toContain('כ');
    for (const lvl of TRACK_1.levels('he', 'he')) {
      for (const l of TRACK_1.lessons(lvl.id, 'he', 'he'))
        recordLessonResult(p, l.id, { wpm: 1, accuracy: 100 });
    }
    expect(nextContinueText(p)).toBeNull();
  });

  it('every lesson of both tracks produces non-empty typeable text', () => {
    for (const track of [TRACK_1, TRACK_2]) {
      for (const language of ['he', 'en'] as const) {
        const done: string[] = [];
        for (const lvl of track.levels(language, 'en')) {
          for (const lesson of track.lessons(lvl.id, language, 'en')) {
            const ctx = makeContext({
              language,
              completed: done,
              activeLevel: lvl.id,
              rng: mulberry32(7),
            });
            const text = lesson.text(ctx);
            expect(text.trim().length, `${track.id} ${language} ${lesson.id}`).toBeGreaterThan(5);
            expect(text).not.toMatch(/undefined|NaN/);
            done.push(lesson.id);
          }
        }
      }
    }
  });
});

describe('content rules (ARCHITECTURE section 8)', () => {
  const blocked = ['יהוה', 'אלהים', 'אלוהים', 'אלוקים', 'אדני', 'YHWH', 'Jehovah'];
  const strip = (s: string) => s.replace(/[֑-ׇ]/g, '');
  const all: string[] = [
    ...Object.values(HE_WORD_BANK).flat(),
    ...Object.values(EN_WORD_BANK).flat(),
    ...HE_SENTENCES,
    ...EN_SENTENCES,
    ...HE_PARAGRAPHS,
    ...EN_PARAGRAPHS,
    ...HE_LEXICON,
    ...EN_LEXICON,
    ...HE_TOP_WORDS,
    ...EN_TOP_WORDS,
    ...HE_AFFIX_CHUNKS.clusters,
    ...EN_AFFIX_CHUNKS.clusters,
    ...[
      ...HE_AFFIX_CHUNKS.prefixes,
      ...HE_AFFIX_CHUNKS.suffixes,
      ...EN_AFFIX_CHUNKS.prefixes,
      ...EN_AFFIX_CHUNKS.suffixes,
    ].flatMap(([, w]) => [...w]),
    ...NIQUD_SAMPLES,
  ];

  it('holds no holy Names in any word, sentence or sample', () => {
    expect(all.length).toBeGreaterThan(1000);
    for (const text of all) {
      const plain = strip(text);
      for (const b of blocked) expect(plain, text).not.toContain(b);
    }
  });
});
