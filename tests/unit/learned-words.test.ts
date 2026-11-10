// Owner rule (ARCHITECTURE section 8): text to type uses only letters the player has learned.
// learnedWordSource feeds the 3D test range (T08) and is the building block for scene text.

import { describe, expect, it } from 'vitest';
import { getTrack, knownKeysOf, learnedWordSource, recordLessonResult } from '../../src/learn';
import { isAllowedWord } from '../../src/learn/content';
import { createProfile, type Profile } from '../../src/save';
import { mulberry32 } from './learn-harness';

const T0 = 1_700_000_000_000;

function profile(layout: 'he' | 'en', track: 1 | 2, lessonsPassed: number): Profile {
  const p = createProfile('p1', 'Test', T0);
  p.layout = layout;
  p.track = track;
  p.settings.uiLanguage = layout;
  const lessons = getTrack(track).lessons(1, layout, layout);
  for (const lesson of lessons.slice(0, lessonsPassed)) {
    recordLessonResult(p, lesson.id, { accuracy: 100, wpm: 30 });
  }
  return p;
}

describe('learned letters only', () => {
  for (const layout of ['he', 'en'] as const) {
    for (const track of [1, 2] as const) {
      for (const passed of [0, 1, 3, 6, 12, 40]) {
        it(`${layout} track ${track}, ${passed} lessons passed: never asks for an unlearned key`, () => {
          const p = profile(layout, track, passed);
          const known = knownKeysOf(p);
          expect(known.size).toBeGreaterThan(0);
          const source = learnedWordSource(p, {
            rng: mulberry32(passed * 7 + track),
            minLength: 3,
            maxLength: 7,
          });
          expect([...source.keys].sort()).toEqual([...known].sort());
          for (let i = 0; i < 300; i += 1) {
            const word = source.next();
            const chars = [...word];
            expect(chars.length).toBeGreaterThanOrEqual(3);
            expect(chars.length).toBeLessThanOrEqual(7);
            for (const c of chars) expect(known.has(c), `"${c}" in "${word}"`).toBe(true);
            expect(isAllowedWord(word, layout)).toBe(true);
          }
        });
      }
    }
  }

  it('gives real words once enough letters are learned, and repeats for the same seed', () => {
    const p = profile('he', 1, 40);
    const a = learnedWordSource(p, { rng: mulberry32(5) });
    const b = learnedWordSource(p, { rng: mulberry32(5) });
    const words = Array.from({ length: 40 }, () => a.next());
    expect(words).toEqual(Array.from({ length: 40 }, () => b.next()));
    expect(new Set(words).size).toBeGreaterThan(10);
  });
});
