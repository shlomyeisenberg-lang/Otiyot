import { describe, expect, it } from 'vitest';
import {
  TypingSession,
  computeMetrics,
  confusionPairs,
  consistency,
  inferHints,
  keyForChar,
  perFingerStats,
  perKeyStats,
  resolveTypedChar,
  rollingWpm,
  wpmTimeline,
  type KeyInput,
  type LayoutId,
  charForKey,
} from '../../src/core';

/** A key event as the OS would produce it with the learner's keyboard set to `os`. */
function ev(ch: string, layout: LayoutId, os: LayoutId = layout): KeyInput {
  const ref = keyForChar(ch, layout);
  if (!ref) throw new Error(`no key for ${ch}`);
  return { code: ref.code, shift: ref.shift, key: charForKey(os, ref.code, ref.shift) ?? ch };
}

/** Type `text` with a steady gap; returns the time after the last key. */
function typeAll(
  s: TypingSession,
  text: string,
  layout: LayoutId,
  gap = 200,
  start = 1000,
): number {
  let t = start;
  for (const ch of text) {
    s.press(ev(ch, layout), t);
    t += gap;
  }
  return t - gap;
}

describe('judging keys', () => {
  it('judges a clean Hebrew line and finishes', () => {
    const s = new TypingSession('שלום עולם', { layout: 'he' });
    expect(s.status).toBe('idle');
    const end = typeAll(s, 'שלום עולם', 'he');
    expect(s.status).toBe('finished');
    expect(s.keys.every((k) => k.correct)).toBe(true);
    expect(s.keys).toHaveLength(9);
    expect(s.keys[0]?.ms).toBeNull();
    expect(s.keys[1]?.ms).toBe(200);
    expect(s.elapsed(end + 5000)).toBe(end - 1000);
  });

  it('judges a clean English line with capitals and punctuation', () => {
    const text = 'Hello, World!';
    const s = new TypingSession(text, { layout: 'en' });
    typeAll(s, text, 'en');
    expect(s.status).toBe('finished');
    expect(s.keys.every((k) => k.correct)).toBe(true);
  });

  it('never blocks on an error: it advances and records expected vs typed', () => {
    const s = new TypingSession('אבג', { layout: 'he' });
    s.press(ev('א', 'he'), 0);
    const bad = s.press(ev('ד', 'he'), 100);
    expect(bad).toMatchObject({ correct: false, expected: 'ב', typed: 'ד', index: 1 });
    expect(s.pos).toBe(2);
    expect(s.errorPositions.has(1)).toBe(true);
    s.press(ev('ג', 'he'), 200);
    expect(s.status).toBe('finished');
  });

  it('records finger info and wrongKey', () => {
    const s = new TypingSession('ל', { layout: 'he' });
    const k = s.press(ev('כ', 'he'), 0)!;
    expect(k.correct).toBe(false);
    expect(k.expectedFinger).toBe('rm');
    expect(k.finger).toBe('li');
    expect(k.wrongKey).toBe(true);
  });

  it('handles a mixed Hebrew / English line', () => {
    const text = 'שלום hello 123';
    const s = new TypingSession(text, { layout: 'he' });
    let t = 0;
    for (const ch of text) {
      const k = s.press(ev(ch, 'he'), (t += 150))!;
      expect(k.correct, ch).toBe(true);
    }
    expect(s.status).toBe('finished');
  });

  it('ignores presses after the end and modifier keys', () => {
    const s = new TypingSession('א', { layout: 'he' });
    expect(s.press({ code: 'ShiftLeft', key: 'Shift', shift: true }, 0)).toBeNull();
    expect(s.status).toBe('idle');
    s.press(ev('א', 'he'), 0);
    expect(s.press(ev('א', 'he'), 10)).toBeNull();
  });
});

describe('OS keyboard language independence', () => {
  it('translates by physical key when the OS is on English but the lesson is Hebrew', () => {
    const s = new TypingSession('שלום', { layout: 'he' });
    let t = 0;
    for (const ch of 'שלום') s.press(ev(ch, 'he', 'en'), (t += 100));
    expect(s.keys.map((k) => k.typed).join('')).toBe('שלום');
    expect(s.status).toBe('finished');
  });
  it('translates when the OS is on Hebrew but the lesson is English', () => {
    const s = new TypingSession('cat', { layout: 'en' });
    let t = 0;
    for (const ch of 'cat') s.press(ev(ch, 'en', 'he'), (t += 100));
    expect(s.keys.every((k) => k.correct)).toBe(true);
  });
  it('trusts the key once the OS layout is detected', () => {
    const r = resolveTypedChar({ code: 'KeyA', key: 'ש', shift: false }, 'ש', 'he', null);
    expect(r).toEqual({ char: 'ש', detected: 'he' });
  });
});

describe('backspace policies', () => {
  it('allowed: steps back and clears the error, but stats keep the mistake', () => {
    const s = new TypingSession('אב', { layout: 'he' });
    s.press(ev('ד', 'he'), 0);
    expect(s.backspace()).toBe(true);
    expect(s.pos).toBe(0);
    expect(s.errorPositions.size).toBe(0);
    s.press(ev('א', 'he'), 100);
    s.press(ev('ב', 'he'), 200);
    expect(s.status).toBe('finished');
    expect(computeMetrics(s.keys, 200).incorrect).toBe(1);
  });
  it('disabled: backspace does nothing', () => {
    const s = new TypingSession('אב', { layout: 'he', backspace: 'disabled' });
    s.press(ev('ד', 'he'), 0);
    expect(s.backspace()).toBe(false);
    expect(s.pos).toBe(1);
  });
  it('mustFix: typing is blocked until the mistake is erased', () => {
    const s = new TypingSession('אב', { layout: 'he', backspace: 'mustFix' });
    s.press(ev('ד', 'he'), 0);
    expect(s.mustFix).toBe(true);
    expect(s.press(ev('ב', 'he'), 50)).toBeNull();
    s.backspace();
    expect(s.mustFix).toBe(false);
    s.press(ev('א', 'he'), 100);
    s.press(ev('ב', 'he'), 150);
    expect(s.status).toBe('finished');
  });
  it('mustFix: cannot finish on an uncorrected last letter', () => {
    const s = new TypingSession('א', { layout: 'he', backspace: 'mustFix' });
    s.press(ev('ב', 'he'), 0);
    expect(s.status).toBe('running');
    s.backspace();
    s.press(ev('א', 'he'), 10);
    expect(s.status).toBe('finished');
  });
  it('backspace at the start does nothing', () => {
    expect(new TypingSession('א', { layout: 'he' }).backspace()).toBe(false);
  });
});

describe('hardcore', () => {
  it('fails on the first mistake and disables backspace', () => {
    const s = new TypingSession('אבג', { layout: 'he', hardcore: true });
    s.press(ev('א', 'he'), 0);
    s.press(ev('ג', 'he'), 100);
    expect(s.status).toBe('failed');
    expect(s.backspace()).toBe(false);
    expect(s.press(ev('ג', 'he'), 200)).toBeNull();
  });
});

describe('niqqud', () => {
  it('ignores niqqud keys by default', () => {
    const s = new TypingSession('שָׁלוֹם', { layout: 'he' });
    typeAll(s, 'שלום', 'he');
    expect(s.status).toBe('finished');
    expect(s.press({ code: 'Digit1', key: 'ָ', shift: false }, 9999)).toBeNull();
  });
  it('requires marks in required mode', () => {
    const s = new TypingSession('בָּ', { layout: 'he', niqqud: 'required' });
    s.press(ev('ב', 'he'), 0);
    expect(s.status).toBe('running');
    s.press({ code: 'Digit1', key: 'ּ', shift: false }, 50);
    const last = s.press({ code: 'Digit2', key: 'ָ', shift: false }, 100)!;
    expect(last).toMatchObject({ kind: 'mark', correct: true });
    expect(s.status).toBe('finished');
  });
  it('a letter while marks are owed counts as a missed mark and moves on', () => {
    const s = new TypingSession('בָא', { layout: 'he', niqqud: 'required' });
    s.press(ev('ב', 'he'), 0);
    const k = s.press(ev('א', 'he'), 50)!;
    expect(k.correct).toBe(true);
    expect(s.errorPositions.has(0)).toBe(true);
    expect(s.status).toBe('finished');
  });
});

describe('metrics', () => {
  it('computes WPM and accuracy for a recorded Hebrew session', () => {
    const text = 'שלום עולם טוב מאוד לכולם'; // 24 chars
    const s = new TypingSession(text, { layout: 'he' });
    const end = typeAll(s, text, 'he', 200);
    const m = computeMetrics(s.keys, s.elapsed(end));
    expect(m.keystrokes).toBe(24);
    expect(m.accuracy).toBe(100);
    // 24 keys over 23 gaps of 200 ms = 4.6 s
    expect(m.grossWpm).toBe(Math.round(24 / 5 / (4600 / 60000)));
    expect(m.netWpm).toBe(m.grossWpm);
    expect(m.consistency).toBe(100);
  });
  it('computes WPM and accuracy for a recorded English session with mistakes', () => {
    const text = 'the quick brown fox';
    const s = new TypingSession(text, { layout: 'en' });
    let t = 0;
    for (let i = 0; i < text.length; i++) {
      const ch = i === 4 ? 'x' : text[i]!; // one mistake at "q"
      s.press(ev(ch, 'en'), (t += 240));
    }
    const m = computeMetrics(s.keys, s.elapsed(t));
    expect(m.incorrect).toBe(1);
    expect(m.correct).toBe(text.length - 1);
    expect(m.accuracy).toBe(Math.round(((text.length - 1) / text.length) * 1000) / 10);
    expect(m.netWpm).toBeLessThan(m.grossWpm);
  });
  it('is safe with no keys or no time', () => {
    expect(computeMetrics([], 0)).toMatchObject({ grossWpm: 0, netWpm: 0, accuracy: 100 });
  });
  it('consistency drops with uneven rhythm and is null with few samples', () => {
    expect(consistency([200, 200, 200])).toBeNull();
    expect(consistency(Array(10).fill(200))).toBe(100);
    expect(consistency([100, 400, 100, 400, 100, 400, 100, 400, 100, 400])).toBeLessThan(70);
  });
  it('builds a timeline and a rolling WPM', () => {
    const s = new TypingSession('a'.repeat(40), { layout: 'en' });
    const end = typeAll(s, 'a'.repeat(40), 'en', 250);
    const tl = wpmTimeline(s.keys);
    expect(tl.length).toBeGreaterThan(5);
    expect(tl[0]?.[0]).toBe(1);
    expect(rollingWpm(s.keys, end - 1000)).toBeGreaterThan(0);
  });
});

describe('per-key, per-finger, confusions and hints', () => {
  it('collects per-key and per-finger stats', () => {
    const s = new TypingSession('אאאב', { layout: 'he' });
    let t = 0;
    for (const ch of 'אאדב') s.press(ev(ch, 'he'), (t += 100));
    const keys = perKeyStats(s.keys);
    expect(keys.get('א')).toMatchObject({ hits: 2, misses: 1 });
    expect(keys.get('א')?.avgMs).toBe(100);
    expect(keys.get('א')?.hits).toBe(2);
    const fingers = perFingerStats(s.keys);
    expect(fingers.get('li')?.misses).toBe(1);
  });
  it('ranks confusion pairs', () => {
    const s = new TypingSession('אאאבב', { layout: 'he' });
    let t = 0;
    for (const ch of 'דדדגב') s.press(ev(ch, 'he'), (t += 100));
    const c = confusionPairs(s.keys);
    expect(c[0]).toEqual({ expected: 'א', typed: 'ד', count: 3 });
    expect(c[1]).toEqual({ expected: 'ב', typed: 'ג', count: 1 });
  });
  it('infers a wrong-finger habit', () => {
    // Expected ל (right middle) but the learner keeps hitting כ (left index).
    const text = 'ללללללללללללללללללללללללללללללללללללללל'.slice(0, 20);
    const s = new TypingSession(text, { layout: 'he' });
    let t = 0;
    for (let i = 0; i < text.length; i++) s.press(ev(i % 3 === 0 ? 'כ' : 'ל', 'he'), (t += 150));
    const h = inferHints(s.keys);
    expect(h.some((x) => x.kind === 'wrong-finger' && x.subject === 'rm')).toBe(true);
  });
  it('infers home-row drift', () => {
    // Expected top-row keys; the hands pressed the home row below them.
    const text = 'קרטוןםפקרטו';
    const wrongs = 'שדגכעיחלךףש';
    const s = new TypingSession(text, { layout: 'he' });
    let t = 0;
    for (const ch of wrongs) s.press(ev(ch, 'he'), (t += 150));
    expect(inferHints(s.keys).some((x) => x.kind === 'home-row-drift')).toBe(true);
  });
  it('infers a slow key', () => {
    const text = 'אבאבאבאבאבאבאבאבאבאבאבאבאבגגג';
    const s = new TypingSession(text, { layout: 'he' });
    let t = 0;
    for (const ch of text) s.press(ev(ch, 'he'), (t += ch === 'ג' ? 900 : 150));
    expect(inferHints(s.keys).some((x) => x.kind === 'slow-key' && x.subject === 'ג')).toBe(true);
  });
  it('gives no hints for clean typing', () => {
    const s = new TypingSession('שלום עולם', { layout: 'he' });
    typeAll(s, 'שלום עולם', 'he');
    expect(inferHints(s.keys)).toEqual([]);
  });
});
