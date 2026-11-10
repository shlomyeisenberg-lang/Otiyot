// Scoring and per-key statistics computed from judged keys. Pure functions.

import { HOME_ROW_KEYS, KEYS, type Finger } from './layouts';
import type { TypedKey } from './session';

export interface Metrics {
  keystrokes: number;
  correct: number;
  incorrect: number;
  /** Gross words per minute: every keystroke / 5. */
  grossWpm: number;
  /** Gross WPM minus one word per mistake per minute. */
  netWpm: number;
  /** 0-100, one decimal. 100 when nothing has been typed. */
  accuracy: number;
  /** 0-100 rhythm score, null until there are enough correct keys. */
  consistency: number | null;
  elapsedMs: number;
}

export interface KeyStat {
  hits: number;
  misses: number;
  /** Average ms for correct presses of this expected character (first keys excluded). */
  avgMs: number;
}

export interface FingerStat {
  hits: number;
  misses: number;
  avgMs: number;
}

export interface Confusion {
  expected: string;
  typed: string;
  count: number;
}

export type HintKind = 'wrong-finger' | 'home-row-drift' | 'slow-key';

export interface Hint {
  kind: HintKind;
  /** The key or finger the hint is about. */
  subject: string;
  /** 0-1: how strongly the evidence points at it. */
  strength: number;
}

const MIN_CONSISTENCY_SAMPLES = 8;

export function computeMetrics(keys: readonly TypedKey[], elapsedMs: number): Metrics {
  let correct = 0;
  let incorrect = 0;
  const intervals: number[] = [];
  for (const k of keys) {
    if (k.correct) {
      correct++;
      if (k.ms !== null && k.kind === 'char') intervals.push(k.ms);
    } else incorrect++;
  }
  const total = correct + incorrect;
  const minutes = elapsedMs / 60000;
  const gross = minutes > 0 ? total / 5 / minutes : 0;
  const net = minutes > 0 ? Math.max(0, gross - incorrect / minutes) : 0;
  return {
    keystrokes: total,
    correct,
    incorrect,
    grossWpm: Math.round(gross),
    netWpm: Math.round(net),
    accuracy: total ? Math.round((correct / total) * 1000) / 10 : 100,
    consistency: consistency(intervals),
    elapsedMs,
  };
}

/** 100 minus the coefficient of variation (as a percentage) of the gaps between keys. */
export function consistency(intervals: readonly number[]): number | null {
  const n = intervals.length;
  if (n < MIN_CONSISTENCY_SAMPLES) return null;
  const mean = intervals.reduce((a, b) => a + b, 0) / n;
  if (mean === 0) return null;
  const variance = intervals.reduce((a, b) => a + (b - mean) * (b - mean), 0) / n;
  const cv = Math.sqrt(variance) / mean;
  return Math.max(0, Math.min(100, Math.round(100 - cv * 100)));
}

/** Net WPM samples at whole seconds, for a results sparkline. */
export function wpmTimeline(keys: readonly TypedKey[]): [number, number][] {
  const out: [number, number][] = [];
  let correct = 0;
  let wrong = 0;
  let lastSec = 0;
  for (const k of keys) {
    if (k.correct) correct++;
    else wrong++;
    const sec = Math.floor(k.at / 1000);
    if (sec > lastSec) {
      lastSec = sec;
      const min = sec / 60;
      out.push([sec, Math.max(0, Math.round((correct + wrong) / 5 / min - wrong / min))]);
    }
  }
  return out;
}

/** Rolling WPM over the last `windowMs`, based on correct keys only. */
export function rollingWpm(keys: readonly TypedKey[], nowAt: number, windowMs = 15000): number {
  const from = Math.max(0, nowAt - windowMs);
  let n = 0;
  for (const k of keys) if (k.correct && k.at >= from && k.at <= nowAt) n++;
  const minutes = Math.max((nowAt - from) / 60000, 2 / 60);
  return Math.round(n / 5 / minutes);
}

/** Per expected-character stats. Marks are folded into their own entries. */
export function perKeyStats(keys: readonly TypedKey[]): Map<string, KeyStat> {
  const sums = new Map<string, { hits: number; misses: number; ms: number; timed: number }>();
  for (const k of keys) {
    const s = sums.get(k.expected) ?? { hits: 0, misses: 0, ms: 0, timed: 0 };
    if (k.correct) {
      s.hits++;
      if (k.ms !== null) {
        s.ms += k.ms;
        s.timed++;
      }
    } else s.misses++;
    sums.set(k.expected, s);
  }
  const out = new Map<string, KeyStat>();
  for (const [ch, s] of sums) {
    out.set(ch, { hits: s.hits, misses: s.misses, avgMs: s.timed ? s.ms / s.timed : 0 });
  }
  return out;
}

/** Per expected-finger stats. */
export function perFingerStats(keys: readonly TypedKey[]): Map<Finger, FingerStat> {
  const sums = new Map<Finger, { hits: number; misses: number; ms: number; timed: number }>();
  for (const k of keys) {
    if (!k.expectedFinger) continue;
    const s = sums.get(k.expectedFinger) ?? { hits: 0, misses: 0, ms: 0, timed: 0 };
    if (k.correct) {
      s.hits++;
      if (k.ms !== null) {
        s.ms += k.ms;
        s.timed++;
      }
    } else s.misses++;
    sums.set(k.expectedFinger, s);
  }
  const out = new Map<Finger, FingerStat>();
  for (const [f, s] of sums) {
    out.set(f, { hits: s.hits, misses: s.misses, avgMs: s.timed ? s.ms / s.timed : 0 });
  }
  return out;
}

/** Most common expected->typed mistakes, most frequent first. */
export function confusionPairs(keys: readonly TypedKey[], limit = 10): Confusion[] {
  const counts = new Map<string, Confusion>();
  for (const k of keys) {
    if (k.correct || k.kind !== 'char') continue;
    const id = `${k.expected}\u0000${k.typed}`;
    const c = counts.get(id);
    if (c) c.count++;
    else counts.set(id, { expected: k.expected, typed: k.typed, count: 1 });
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.expected.localeCompare(b.expected))
    .slice(0, limit);
}

/**
 * Habits inferred from timing and error patterns:
 *  - wrong-finger: a finger that keeps hitting a neighbouring key instead of its own (the
 *    mistaken physical key belongs to a different finger than the expected one, over and over);
 *  - home-row-drift: mistakes on keys next to home row that are mostly home-row neighbours,
 *    suggesting the hands have slid off the home position;
 *  - slow-key: a key that is much slower than the learner's own average.
 */
export function inferHints(keys: readonly TypedKey[]): Hint[] {
  const hints: Hint[] = [];
  const typedKeys = keys.filter((k) => k.kind === 'char');
  const wrong = typedKeys.filter((k) => !k.correct);

  // wrong-finger
  const byFinger = new Map<Finger, { wrongFinger: number; total: number }>();
  for (const k of typedKeys) {
    if (!k.expectedFinger) continue;
    const e = byFinger.get(k.expectedFinger) ?? { wrongFinger: 0, total: 0 };
    e.total++;
    if (!k.correct && k.finger !== null && k.finger !== k.expectedFinger) e.wrongFinger++;
    byFinger.set(k.expectedFinger, e);
  }
  for (const [f, e] of byFinger) {
    if (e.wrongFinger >= 3 && e.wrongFinger / e.total >= 0.15) {
      hints.push({
        kind: 'wrong-finger',
        subject: f,
        strength: Math.min(1, e.wrongFinger / e.total + e.wrongFinger / 20),
      });
    }
  }

  // home-row drift: wrong presses landing on a home-row key when the expected key is a
  // different row, or the reverse, in a consistent direction.
  let rowMiss = 0;
  for (const k of wrong) {
    const exp = k.expectedKey ? KEYS[k.expectedKey.code] : undefined;
    const got = KEYS[k.pressed.code];
    if (!exp || !got || exp.row === got.row) continue;
    if (HOME_ROW_KEYS.includes(got.code) || exp.home) rowMiss++;
  }
  if (wrong.length >= 5 && rowMiss >= 4 && rowMiss / wrong.length >= 0.5) {
    hints.push({ kind: 'home-row-drift', subject: 'home', strength: rowMiss / wrong.length });
  }

  // slow keys
  const timed = typedKeys.filter((k) => k.correct && k.ms !== null);
  if (timed.length >= 20) {
    const mean = timed.reduce((a, k) => a + (k.ms ?? 0), 0) / timed.length;
    const per = new Map<string, { sum: number; n: number }>();
    for (const k of timed) {
      const e = per.get(k.expected) ?? { sum: 0, n: 0 };
      e.sum += k.ms ?? 0;
      e.n++;
      per.set(k.expected, e);
    }
    for (const [ch, e] of per) {
      if (e.n >= 3 && e.sum / e.n > mean * 1.6) {
        hints.push({
          kind: 'slow-key',
          subject: ch,
          strength: Math.min(1, e.sum / e.n / mean / 3),
        });
      }
    }
  }
  return hints.sort((a, b) => b.strength - a.strength);
}
