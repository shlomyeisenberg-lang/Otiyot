// Track 1 text generators ("Letter by letter"), ported from reference/plugin-3.3.0
// (adaptive.js + lessons.js). The order of random draws is kept identical to the original so
// a seeded run produces the same text.

import { EN_WORD_BANK, HE_WORD_BANK } from './data/banks';
import { EN_KEY_ORDER, HE_KEY_ORDER_TRACK1 } from './data/curriculum';
import { EN_PARAGRAPHS, EN_SENTENCES, HE_PARAGRAPHS, HE_SENTENCES } from './data/banks';
import { NIQUD_SAMPLES } from './samples';
import type { TextContext } from './types';
import type { LayoutId } from '../core';
import { keyChar, lettersOf, randomChoice, stripNiqud } from './util';

export function keyOrder1(language: LayoutId): readonly string[] {
  return language === 'en' ? EN_KEY_ORDER : HE_KEY_ORDER_TRACK1;
}

export function level1LessonId1(idx: number): string {
  return `L1-${idx}`;
}

/** Keys introduced so far: the letters of every passed Level 1 lesson. */
export function knownKeys1(ctx: TextContext): Set<string> {
  const order = keyOrder1(ctx.language);
  const done = new Set(ctx.completed);
  const introduced = new Set<string>();
  order.forEach((code, idx) => {
    if (done.has(level1LessonId1(idx))) introduced.add(keyChar(ctx.language, code));
  });
  // From Level 3 every letter counts as known, and the marks passed in Level 1 stay known too
  // (they used to drop out here, so the Night Shuk lost its punctuation coins).
  if (ctx.activeLevel >= 3) return new Set([...lettersOf(ctx.language), ...introduced]);
  return introduced.size
    ? introduced
    : new Set(order.slice(0, 2).map((c) => keyChar(ctx.language, c)));
}

/** Character drill: leans on weak keys but keeps a natural mix of all known keys. */
export function charDrill1(
  knownChars: Iterable<string>,
  length: number,
  weakChars: readonly string[],
  ctx: TextContext,
): string {
  const known = Array.from(knownChars);
  if (!known.length) return '';
  const pool: string[] = [...known];
  weakChars.forEach((c) => pool.push(c, c));
  const groups: string[] = [];
  let cur = '';
  for (let i = 0; i < length; i++) {
    cur += randomChoice(ctx.rng, pool);
    if (cur.length >= 3 && ctx.rng() < 0.35) {
      groups.push(cur);
      cur = '';
    }
  }
  if (cur) groups.push(cur);
  return groups.join(' ');
}

type BankKey = 'short' | 'medium' | 'long' | 'advanced';

/** Word drill: only words made of known letters. */
export function wordDrill1(
  knownChars: Iterable<string>,
  bankKey: BankKey,
  count: number,
  ctx: TextContext,
): string {
  const known = new Set(knownChars);
  const source = ctx.language === 'en' ? EN_WORD_BANK : HE_WORD_BANK;
  const bank = source[bankKey] ?? source.short;
  const candidates = bank.filter((w) =>
    stripNiqud(w)
      .split('')
      .every((ch) => known.has(ch) || ch === ' '),
  );
  const pool = candidates.length
    ? candidates
    : bank.filter((w) =>
        stripNiqud(w)
          .split('')
          .some((ch) => known.has(ch)),
      );
  if (!pool.length) return charDrill1(known, Math.max(10, count * 4), [], ctx);
  const words: string[] = [];
  for (let i = 0; i < count; i++) words.push(randomChoice(ctx.rng, pool));
  return words.join(' ');
}

function niqudSample(ctx: TextContext): string {
  return NIQUD_SAMPLES.slice()
    .sort(() => ctx.rng() - 0.5)
    .slice(0, 3)
    .join(' ');
}

/** Exercise for a level (what Levels 2 and up use). */
export function exercise1(level: number, ctx: TextContext): string {
  const known = knownKeys1(ctx);
  const weak = ctx.weakChars.slice(0, 4);
  const minLen = Math.max(20, ctx.practiceLength || 50);
  const en = ctx.language === 'en';
  const sentences = en ? EN_SENTENCES : HE_SENTENCES;
  const paragraphs = en ? EN_PARAGRAPHS : HE_PARAGRAPHS;
  if (level <= 1) return charDrill1(known, Math.max(24, minLen), weak, ctx);
  if (level === 2) return charDrill1(known, Math.max(30, minLen), weak, ctx);
  if (level === 3) return wordDrill1(known, 'short', Math.max(8, Math.ceil(minLen / 4)), ctx);
  if (level === 4) {
    return (
      wordDrill1(known, 'medium', Math.max(6, Math.ceil(minLen / 6)), ctx) +
      '. ' +
      randomChoice(ctx.rng, sentences)
    );
  }
  if (level === 5) return randomChoice(ctx.rng, paragraphs);
  if (level === 6) {
    return (
      wordDrill1(known, 'advanced', Math.max(5, Math.ceil(minLen / 8)), ctx) +
      '. ' +
      randomChoice(ctx.rng, sentences)
    );
  }
  if (level === 7 && !en) return niqudSample(ctx);
  return randomChoice(ctx.rng, paragraphs) + ' ' + randomChoice(ctx.rng, paragraphs);
}

/** Level 1, Track 1: one new key per lesson, mixed with the keys already learned. */
export function level1Text1(idx: number, len: number, ctx: TextContext): string {
  const code = keyOrder1(ctx.language)[idx];
  if (code === undefined) return '';
  const ch = keyChar(ctx.language, code);
  const chars = Array.from(knownKeys1(ctx)).concat([ch]);
  return charDrill1(chars, len, [ch, ch], ctx);
}
