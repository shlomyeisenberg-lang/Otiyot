// T09: the typing driver (judged keys, letter states, the finger guide, combo, lessons), the hint
// coach, the world-text layout, and the owner rule that typing text uses learned letters only.

import { describe, expect, it } from 'vitest';
import { keyForChar, type KeyInput, type LayoutId } from '../../src/core';
import { letterOffset } from '../../src/engine/worldText';
import { HintCoach } from '../../src/game/hints';
import {
  comboProgress,
  comboTier,
  TypingDriver,
  type DriverOptions,
  type WordSource,
} from '../../src/game/typing';
import { getTrack, knownKeysOf, learnedWordSource, recordLessonResult } from '../../src/learn';
import { createProfile } from '../../src/save';
import { mulberry32 } from './learn-harness';

/** A source that hands out the given texts in turn, then repeats the last. */
function source(...texts: string[]): WordSource {
  let i = 0;
  return { next: () => texts[Math.min(i++, texts.length - 1)] as string };
}

/** The key event a learner's keyboard sends for `ch` (OS set to the same language). */
function keyOf(ch: string, layout: LayoutId): KeyInput {
  const ref = keyForChar(ch, layout);
  if (!ref) throw new Error(`no key for ${ch}`);
  return { code: ref.code, key: ch, shift: ref.shift };
}

function typeWord(d: TypingDriver, text: string, layout: LayoutId, now: { t: number }): void {
  for (const ch of text) {
    now.t += 200;
    d.press(keyOf(ch, layout), now.t);
  }
}

const opts = (o: Partial<DriverOptions> = {}): DriverOptions => ({ layout: 'en', ...o });

describe('TypingDriver', () => {
  it('splits text into words, each finished by its space, and lights the next letter', () => {
    const d = new TypingDriver(source('fad jak', 'lass'), opts());
    expect(d.word).toBe('fad');
    expect(d.lookahead).toBe('jak');
    expect(d.letters).toEqual(['f', 'a', 'd', ' ']);
    expect(d.states).toEqual(['next', 'todo', 'todo', 'todo']);
    const now = { t: 0 };
    typeWord(d, 'fad', 'en', now);
    expect(d.states).toEqual(['ok', 'ok', 'ok', 'next']);
    expect(d.guide()).toMatchObject({ code: 'Space', finger: 'th', char: ' ' });
    const r = d.press(keyOf(' ', 'en'), 1000);
    expect(r.word).toEqual({ word: 'fad', perfect: true, count: 1 });
    expect(d.word).toBe('jak');
    expect(d.lookahead).toBe('lass');
    expect(d.combo).toBe(4);
  });

  it('the finger guide shows the right key and finger, with the Shift on the other hand', () => {
    const d = new TypingDriver(source('Fa'), opts());
    expect(d.guide()).toEqual({
      code: 'KeyF',
      shift: 'ShiftRight',
      finger: 'li',
      char: 'F',
      fix: false,
    });
    const he = new TypingDriver(source('כחם'), opts({ layout: 'he' }));
    expect(he.guide()).toMatchObject({ code: 'KeyF', finger: 'li', shift: null });
    he.press(keyOf('כ', 'he'), 10);
    expect(he.guide()).toMatchObject({ code: 'KeyJ', finger: 'ri' });
    he.press(keyOf('ח', 'he'), 20);
    expect(he.guide()).toMatchObject({ code: 'KeyO', finger: 'rr', char: 'ם' });
  });

  it('a Hebrew key typed while the computer is set to English is judged by the physical key', () => {
    const d = new TypingDriver(source('כח'), opts({ layout: 'he' }));
    const r = d.press({ code: 'KeyF', key: 'f', shift: false }, 5);
    expect(r.key?.correct).toBe(true);
    expect(d.states[0]).toBe('ok');
  });

  it('after a mistake the guide still shows the next key and nothing blocks', () => {
    const d = new TypingDriver(source('fad'), opts());
    const r = d.press({ code: 'KeyJ', key: 'j', shift: false }, 10);
    expect(r.key?.correct).toBe(false);
    expect(d.states[0]).toBe('err');
    expect(d.combo).toBe(0);
    expect(d.guide()).toMatchObject({ code: 'KeyA', fix: false });
    // Backspace goes back to fix it; fixed letters are marked as such.
    d.press({ code: 'Backspace', key: 'Backspace', shift: false }, 20);
    expect(d.states[0]).toBe('next');
    expect(d.states[1]).toBe('todo');
    expect(d.guide()).toMatchObject({ code: 'KeyF' });
    d.press(keyOf('f', 'en'), 30);
    expect(d.states[0]).toBe('fixed');
    typeWord(d, 'ad ', 'en', { t: 40 });
    expect(d.wordsDone).toBe(1);
  });

  it('with "must fix" a mistake asks for Backspace first, then the letter again', () => {
    const d = new TypingDriver(source('fad'), opts({ backspace: 'mustFix' }));
    d.press(keyOf('j', 'en'), 10);
    expect(d.mustFix).toBe(true);
    expect(d.guide()).toEqual({
      code: 'Backspace',
      shift: null,
      finger: 'rp',
      char: '',
      fix: true,
    });
    // other keys are ignored while blocked
    expect(d.press(keyOf('a', 'en'), 20).key).toBeNull();
    d.press({ code: 'Backspace', key: 'Backspace', shift: false }, 30);
    expect(d.mustFix).toBe(false);
    expect(d.guide()).toMatchObject({ code: 'KeyF', fix: false });
    const now = { t: 40 };
    typeWord(d, 'fad ', 'en', now);
    expect(d.wordsDone).toBe(1);
    expect(d.states.length).toBeGreaterThan(0);
  });

  it('reports imperfect words and keeps the best combo', () => {
    const d = new TypingDriver(source('aa ss dd'), opts());
    const now = { t: 0 };
    typeWord(d, 'aa ', 'en', now);
    now.t += 100;
    d.press(keyOf('x', 'en'), now.t);
    const r = d.press(keyOf('s', 'en'), (now.t += 100));
    expect(r.key?.correct).toBe(true);
    const end = d.press(keyOf(' ', 'en'), (now.t += 100));
    expect(end.word).toMatchObject({ word: 'ss', perfect: false, count: 2 });
    expect(d.bestCombo).toBe(3);
    expect(d.combo).toBe(2);
    expect(d.accuracy()).toBeCloseTo(83.3, 1);
  });

  it('a lesson ("once") ends after its last word, with no space after it', () => {
    const d = new TypingDriver(source('fj jf', 'never asked'), opts({ mode: 'once' }));
    expect(d.totalWords).toBe(2);
    const now = { t: 0 };
    typeWord(d, 'fj ', 'en', now);
    expect(d.progress).toBe(0.5);
    expect(d.lookahead).toBe('');
    expect(d.letters).toEqual(['j', 'f']);
    now.t += 200;
    d.press(keyOf('j', 'en'), now.t);
    now.t += 200;
    const r = d.press(keyOf('f', 'en'), now.t);
    expect(r.ended).toBe(true);
    expect(r.word?.count).toBe(2);
    expect(d.ended).toBe(true);
    expect(d.progress).toBe(1);
    expect(d.guide()).toBeNull();
    expect(d.press(keyOf('f', 'en'), now.t + 10).key).toBeNull();
    const m = d.metrics(now.t + 5000);
    expect(m.accuracy).toBe(100);
    expect(m.keystrokes).toBe(5);
  });

  it('hardcore ends the run on the first mistake', () => {
    const d = new TypingDriver(source('fad'), opts({ hardcore: true }));
    d.press(keyOf('f', 'en'), 0);
    const r = d.press(keyOf('x', 'en'), 100);
    expect(r.ended).toBe(true);
    expect(d.failed).toBe(true);
  });

  it('WPM follows the last 15 seconds of typing', () => {
    const d = new TypingDriver(source('aaaaa'), opts());
    for (let i = 0; i < 30; i++) d.press(keyOf(i % 6 === 5 ? ' ' : 'a', 'en'), i * 200);
    // 30 correct keys in 6 seconds = 60 words per minute
    expect(d.wpm(30 * 200)).toBeGreaterThan(50);
    expect(d.wpm(30 * 200)).toBeLessThan(70);
  });
});

describe('combo tiers', () => {
  it('climb ink, techelet, silver, gold, light', () => {
    expect([0, 9, 10, 24, 25, 49, 50, 99, 100, 500].map(comboTier)).toEqual([
      0, 0, 1, 1, 2, 2, 3, 3, 4, 4,
    ]);
    expect(comboProgress(5)).toBeCloseTo(0.5);
    expect(comboProgress(10)).toBe(0);
    expect(comboProgress(300)).toBe(1);
  });
});

describe('HintCoach', () => {
  it('suggests the right finger after repeated wrong-finger mistakes, then stays quiet', () => {
    const d = new TypingDriver(source('fff fff fff fff fff fff'), opts());
    const coach = new HintCoach();
    let tip = null;
    let t = 0;
    for (let i = 0; i < 12 && !tip; i++) {
      d.press(keyOf('f', 'en'), (t += 200));
      // f wanted, d pressed: the middle finger did the index finger's work
      d.press({ code: 'KeyD', key: 'd', shift: false }, (t += 200));
      tip = coach.afterMistake(d.keys, t);
    }
    expect(tip).toEqual({ kind: 'wrong-finger', finger: 'li' });
    d.press({ code: 'KeyD', key: 'd', shift: false }, (t += 200));
    expect(coach.afterMistake(d.keys, t)).toBeNull();
  });

  it('gives no tip for a few honest slips', () => {
    const d = new TypingDriver(source('fad jak lass'), opts());
    const coach = new HintCoach();
    d.press(keyOf('x', 'en'), 100);
    expect(coach.afterMistake(d.keys, 100)).toBeNull();
  });
});

describe('world text', () => {
  it('lays a Hebrew word right to left and an English word left to right', () => {
    expect(letterOffset(0, 3, true)).toBeGreaterThan(0);
    expect(letterOffset(2, 3, true)).toBeLessThan(0);
    expect(letterOffset(0, 3, false)).toBeLessThan(0);
    expect(letterOffset(1, 3, false)).toBe(0);
  });
});

describe('learned letters only (ARCHITECTURE section 8)', () => {
  for (const layout of ['he', 'en'] as const) {
    it(`${layout}: every key the driver asks for is a learned key`, () => {
      const p = createProfile('p1', 'Test', 0);
      p.layout = layout;
      p.track = 2;
      p.settings.uiLanguage = layout;
      for (const lesson of getTrack(2).lessons(1, layout, layout).slice(0, 4)) {
        recordLessonResult(p, lesson.id, { accuracy: 100, wpm: 30 });
      }
      const known = knownKeysOf(p);
      const words = learnedWordSource(p, { rng: mulberry32(9), minLength: 3, maxLength: 7 });
      const d = new TypingDriver(words, { layout });
      let t = 0;
      for (let w = 0; w < 60; w++) {
        for (const ch of d.letters) {
          if (ch !== ' ') expect(known.has(ch), `${ch} in ${d.word}`).toBe(true);
          d.press(keyOf(ch, layout), (t += 150));
        }
      }
      expect(d.wordsDone).toBe(60);
    });
  }
});
