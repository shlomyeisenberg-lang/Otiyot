// Track 2 text generators ("Words from the start"), ported from reference/plugin-4.2.0
// (adaptive.js + lessons.js + lexicon.js). The order of random draws is kept identical to
// the original so a seeded run produces the same text.

import type { LayoutId } from '../core';
import {
  EN_PARAGRAPHS,
  EN_SENTENCES,
  EN_WORD_BANK,
  HE_PARAGRAPHS,
  HE_SENTENCES,
  HE_WORD_BANK,
} from './data/banks';
import { EN_KEY_ORDER, HE_KEY_ORDER_TRACK2 } from './data/curriculum';
import { EN_LEXICON, EN_TOP_WORDS, HE_LEXICON, HE_TOP_WORDS } from './data/lexicon';
import { NIQUD_SAMPLES } from './samples';
import type { TextContext } from './types';
import { isLetterChar, keyChar, lettersOf, randomChoice, stripNiqud } from './util';

export const KEYS_PER_LESSON = 2;

export function keyOrder2(language: LayoutId): readonly string[] {
  return language === 'en' ? EN_KEY_ORDER : HE_KEY_ORDER_TRACK2;
}

export function level1LessonId2(j: number): string {
  return `L1p-${j}`;
}
export function level1LessonCount2(language: LayoutId): number {
  return Math.ceil(keyOrder2(language).length / KEYS_PER_LESSON);
}
export function level1LessonKeys2(language: LayoutId, j: number): string[] {
  return keyOrder2(language).slice(j * KEYS_PER_LESSON, j * KEYS_PER_LESSON + KEYS_PER_LESSON);
}

/** Keys introduced so far: the keys of every passed Level 1 lesson. */
export function knownKeys2(ctx: TextContext): Set<string> {
  const order = keyOrder2(ctx.language);
  if (ctx.activeLevel >= 3) return new Set(lettersOf(ctx.language));
  const done = new Set(ctx.completed);
  const introduced = new Set<string>();
  for (let j = 0; j < level1LessonCount2(ctx.language); j++) {
    if (done.has(level1LessonId2(j))) {
      level1LessonKeys2(ctx.language, j).forEach((c) => introduced.add(keyChar(ctx.language, c)));
    }
  }
  return introduced.size
    ? introduced
    : new Set(order.slice(0, KEYS_PER_LESSON).map((c) => keyChar(ctx.language, c)));
}

// ---- difficulty controller -----------------------------------------------------------------

export interface DifficultyParams {
  level: number;
  lenShift: number;
  weakShare: number;
  bigramShare: number;
  punctuation: number;
  groupMin: number;
  groupMax: number;
}

export function difficultyParams(level: number): DifficultyParams {
  const L = Math.max(0, Math.min(1, Number.isFinite(level) ? level : 0.3));
  return {
    level: L,
    lenShift: L < 0.25 ? -1 : L > 0.7 ? 1 : 0,
    weakShare: 0.15 + 0.35 * L,
    bigramShare: 0.1 + 0.3 * L,
    punctuation: L < 0.5 ? 0 : (L - 0.5) * 0.3,
    groupMin: L < 0.3 ? 2 : 3,
    groupMax: L < 0.3 ? 4 : L < 0.7 ? 5 : 6,
  };
}

// ---- helpers ---------------------------------------------------------------------------------

const FINAL_TO_BASE: Readonly<Record<string, string>> = {
  ם: 'מ',
  ן: 'נ',
  ך: 'כ',
  ף: 'פ',
  ץ: 'צ',
};
const BASE_TO_FINAL: Readonly<Record<string, string>> = {
  מ: 'ם',
  נ: 'ן',
  כ: 'ך',
  פ: 'ף',
  צ: 'ץ',
};

/**
 * Final forms belong only at the end of a word: in the middle of a group a final letter turns
 * into its base form (when known), and a base letter at the end may turn into its final form.
 */
export function fixFinalLetters(
  group: string,
  known: ReadonlySet<string> | null,
  ctx: TextContext,
): string {
  const chars = Array.from(group);
  if (!chars.some((c) => FINAL_TO_BASE[c] || BASE_TO_FINAL[c])) return group;
  const has = (c: string) => !known || known.has(c);
  for (let i = 0; i < chars.length - 1; i++) {
    const base = FINAL_TO_BASE[chars[i] as string];
    if (base) chars[i] = has(base) ? base : '';
  }
  const last = chars[chars.length - 1] as string;
  const fin = BASE_TO_FINAL[last];
  if (fin && known && known.has(fin) && ctx.rng() < 0.7) chars[chars.length - 1] = fin;
  return chars.join('') || group;
}

const wordCache: Record<LayoutId, string[] | null> = { he: null, en: null };

/** All real words for the curriculum language: word bank + lexicon + frequent words. */
export function curriculumWords(language: LayoutId): readonly string[] {
  const cached = wordCache[language];
  if (cached) return cached;
  const en = language === 'en';
  const bank = en ? EN_WORD_BANK : HE_WORD_BANK;
  const lex = en ? EN_LEXICON : HE_LEXICON;
  const top = en ? EN_TOP_WORDS : HE_TOP_WORDS;
  const all = [
    ...bank.short,
    ...bank.medium,
    ...bank.long,
    ...bank.advanced,
    ...lex,
    ...top,
  ].filter((w) => w && !/\s/.test(w));
  const out = Array.from(new Set(all));
  wordCache[language] = out;
  return out;
}

export function wordUsesOnly(w: string, known: ReadonlySet<string>): boolean {
  return Array.from(stripNiqud(w)).every((ch) => known.has(ch));
}

/** Pronounceable stand-in when too few real words fit the known keys. */
export function pseudoword(
  knownChars: Iterable<string>,
  mustInclude: readonly string[],
  ctx: TextContext,
): string {
  const known = Array.from(knownChars).filter(isLetterChar);
  if (!known.length) return '';
  const en = ctx.language === 'en';
  const vowels = (en ? ['a', 'e', 'i', 'o', 'u', 'y'] : ['ו', 'י', 'א', 'ה']).filter((v) =>
    known.includes(v),
  );
  const cons = known.filter((c) => !vowels.includes(c) && !FINAL_TO_BASE[c]);
  const len = 2 + Math.floor(ctx.rng() * 3);
  const out: string[] = [];
  for (let i = 0; i < len; i++) {
    const wantVowel = vowels.length > 0 && (en ? i % 2 === 1 : i % 2 === 1 && ctx.rng() < 0.6);
    const pool = wantVowel ? vowels : cons.length ? cons : known.filter((c) => !FINAL_TO_BASE[c]);
    out.push(randomChoice(ctx.rng, pool.length ? pool : known));
  }
  const inc = mustInclude.filter((c) => known.includes(c) && isLetterChar(c));
  if (inc.length && !out.some((c) => inc.includes(c))) {
    out[Math.floor(ctx.rng() * out.length)] = randomChoice(ctx.rng, inc);
  }
  return en ? out.join('') : fixFinalLetters(out.join(''), new Set(known), ctx);
}

const PUNCT_KEYS = new Set(['.', ',', ';', '/', "'"]);
const GENDER_PAIRS = ['ו/או', 'הוא/היא', 'ילד/ה', 'תלמיד/ה', 'חבר/ה', 'מורה/ים'];

function punctuatedWord(
  p: string,
  words: readonly string[],
  known: ReadonlySet<string>,
  ctx: TextContext,
): string {
  const w = randomChoice(ctx.rng, words);
  if (p === '/') {
    if (ctx.language !== 'en') {
      const fit = GENDER_PAIRS.filter((x) => wordUsesOnly(x.replace('/', ''), known));
      if (fit.length && ctx.rng() < 0.6) return randomChoice(ctx.rng, fit);
    } else if (ctx.rng() < 0.5) return 'and/or';
    return w + '/' + randomChoice(ctx.rng, words);
  }
  if (p === "'") return w;
  return w + p;
}

// ---- drills ----------------------------------------------------------------------------------

/** Character drill: leans on weak keys, final letters only at the end of a group. */
export function charDrill2(
  knownChars: Iterable<string>,
  length: number,
  weakChars: readonly string[],
  ctx: TextContext,
): string {
  const known = Array.from(knownChars).filter((c) => c && c !== ' ');
  if (!known.length) return '';
  const weak = weakChars.filter((c) => c && c !== ' ');
  const P = difficultyParams(ctx.difficulty);
  const knownSet = new Set(known.concat(weak));
  const pick = () =>
    weak.length && ctx.rng() < P.weakShare
      ? randomChoice(ctx.rng, weak)
      : randomChoice(ctx.rng, known);
  const groups: string[] = [];
  let cur = '';
  let target = P.groupMin + Math.floor(ctx.rng() * (P.groupMax - P.groupMin + 1));
  for (let i = 0; i < length; i++) {
    cur += pick();
    if (cur.length >= target) {
      groups.push(fixFinalLetters(cur, knownSet, ctx));
      cur = '';
      target = P.groupMin + Math.floor(ctx.rng() * (P.groupMax - P.groupMin + 1));
    }
  }
  if (cur) groups.push(fixFinalLetters(cur, knownSet, ctx));
  return groups.join(' ');
}

type BankKey = 'short' | 'medium' | 'long' | 'advanced';
const BANK_LENGTH: Record<BankKey, [number, number]> = {
  short: [2, 3],
  medium: [3, 5],
  long: [4, 7],
  advanced: [5, 10],
};

/** Word drill: real words made only of known letters, widened with the lexicon. */
export function wordDrill2(
  knownChars: Iterable<string>,
  bankKey: BankKey,
  count: number,
  ctx: TextContext,
): string {
  const known = new Set(knownChars);
  const P = difficultyParams(ctx.difficulty);
  const source = ctx.language === 'en' ? EN_WORD_BANK : HE_WORD_BANK;
  const bank = source[bankKey] ?? source.short;
  const range = BANK_LENGTH[bankKey] ?? BANK_LENGTH.short;
  const lo = Math.max(1, range[0] + P.lenShift);
  const hi = range[1] + P.lenShift * 2;
  const fits = (w: string) =>
    stripNiqud(w)
      .split('')
      .every((ch) => known.has(ch) || ch === ' ');
  let candidates = bank.filter(fits);
  const extra = curriculumWords(ctx.language).filter((w) => {
    const n = Array.from(w).length;
    return n >= lo && n <= hi && fits(w);
  });
  const sized = candidates.concat(extra).filter((w) => {
    const n = Array.from(w.replace(/\s/g, '')).length;
    return n >= lo && n <= hi;
  });
  if (sized.length >= 8) candidates = Array.from(new Set(sized));
  else if (candidates.length < 8) candidates = Array.from(new Set(candidates.concat(extra)));
  const pool = candidates.length
    ? candidates
    : bank.filter((w) =>
        stripNiqud(w)
          .split('')
          .some((ch) => known.has(ch)),
      );
  if (!pool.length) return charDrill2(known, Math.max(10, count * 4), [], ctx);
  const weakBg = ctx.weakBigrams.slice(0, 6).filter((bg) => !/\s/.test(bg));
  const bgWords = weakBg.length ? pool.filter((w) => weakBg.some((bg) => w.includes(bg))) : [];
  const words: string[] = [];
  for (let i = 0; i < count; i++) {
    let w =
      bgWords.length && ctx.rng() < P.bigramShare
        ? randomChoice(ctx.rng, bgWords)
        : randomChoice(ctx.rng, pool);
    if (P.punctuation && i < count - 1 && ctx.rng() < P.punctuation) {
      w += ctx.rng() < 0.7 ? ',' : '.';
    }
    words.push(w);
  }
  return words.join(' ');
}

function niqudSample(ctx: TextContext): string {
  return NIQUD_SAMPLES.slice()
    .sort(() => ctx.rng() - 0.5)
    .slice(0, 3)
    .join(' ');
}

/** Exercise for a level (what Levels 2 and up use). */
export function exercise2(level: number, ctx: TextContext): string {
  const known = knownKeys2(ctx);
  const weak = ctx.weakChars.slice(0, 4);
  const minLen = Math.max(20, ctx.practiceLength || 50);
  const en = ctx.language === 'en';
  const sentences = en ? EN_SENTENCES : HE_SENTENCES;
  const paragraphs = en ? EN_PARAGRAPHS : HE_PARAGRAPHS;
  if (level <= 1) return charDrill2(known, Math.max(24, minLen), weak, ctx);
  if (level === 2) return charDrill2(known, Math.max(30, minLen), weak, ctx);
  if (level === 3) return wordDrill2(known, 'short', Math.max(8, Math.ceil(minLen / 4)), ctx);
  if (level === 4) {
    return (
      wordDrill2(known, 'medium', Math.max(6, Math.ceil(minLen / 6)), ctx) +
      '. ' +
      randomChoice(ctx.rng, sentences)
    );
  }
  if (level === 5) return randomChoice(ctx.rng, paragraphs);
  if (level === 6) {
    return (
      wordDrill2(known, 'advanced', Math.max(5, Math.ceil(minLen / 8)), ctx) +
      '. ' +
      randomChoice(ctx.rng, sentences)
    );
  }
  if (level === 7 && !en) return niqudSample(ctx);
  return randomChoice(ctx.rng, paragraphs) + ' ' + randomChoice(ctx.rng, paragraphs);
}

/** Level 1, Track 2: two new keys per lesson, about 40% drills and 60% real words. */
export function level1Text2(j: number, len: number, ctx: TextContext): string {
  const lang = ctx.language;
  const order = keyOrder2(lang);
  const newKeys = level1LessonKeys2(lang, j)
    .map((c) => keyChar(lang, c))
    .filter((c) => c !== '');
  const prevKeys = order.slice(0, j * KEYS_PER_LESSON).map((c) => keyChar(lang, c));
  const known = new Set(prevKeys.concat(newKeys));
  const P = difficultyParams(ctx.difficulty);
  const letters = Array.from(known).filter(isLetterChar);
  const newLetters = newKeys.filter(isLetterChar);
  const prevLetters = prevKeys.filter(isLetterChar);
  const newPunct = newKeys.filter((c) => PUNCT_KEYS.has(c));
  const weak = ctx.weakChars.slice(0, 3).filter((c) => known.has(c));
  const rng = ctx.rng;

  const drillGroup = (): string => {
    const n = P.groupMin + Math.floor(rng() * (P.groupMax - P.groupMin + 1));
    const g: string[] = [];
    const fresh = newLetters.length ? newLetters : letters.length ? letters : newKeys;
    const old = prevLetters.length ? prevLetters : fresh;
    for (let i = 0; i < n; i++) {
      const r = rng();
      g.push(
        r < 0.45
          ? randomChoice(rng, fresh)
          : weak.length && r < 0.45 + P.weakShare * 0.4
            ? randomChoice(rng, weak)
            : randomChoice(rng, old),
      );
    }
    if (!g.some((c) => fresh.includes(c))) g[Math.floor(rng() * n)] = randomChoice(rng, fresh);
    if (prevLetters.length && !g.some((c) => prevLetters.includes(c))) {
      g[Math.floor(rng() * n)] = randomChoice(rng, prevLetters);
    }
    let s = lang === 'en' ? g.join('') : fixFinalLetters(g.join(''), known, ctx);
    if (newPunct.length) {
      const p = randomChoice(rng, newPunct);
      if (p === "'") {
        const k = Math.max(1, Math.floor(s.length / 2));
        s = s.slice(0, k) + "'" + s.slice(k);
      } else if (p === '/') {
        const k = Math.max(1, Math.floor(s.length / 2));
        s = s.slice(0, k) + '/' + s.slice(k);
      } else s += p;
    }
    return s;
  };

  const lenOk = (w: string) => {
    const n = Array.from(w).length;
    return n >= 2 + Math.min(0, P.lenShift) && n <= 5 + P.lenShift * 2;
  };
  let words = curriculumWords(lang).filter((w) => wordUsesOnly(w, known));
  const withNew = words.filter((w) => Array.from(w).some((c) => newKeys.includes(c)));
  const sized = words.filter(lenOk);
  if (sized.length >= 6) words = sized;
  const pickWord = (last: string): string => {
    let w = '';
    for (let tries = 0; tries < 6; tries++) {
      if (newPunct.length && words.length && rng() < 0.5) {
        w = punctuatedWord(randomChoice(rng, newPunct), words, known, ctx);
      } else if (withNew.length && rng() < 0.6) w = randomChoice(rng, withNew);
      else if (words.length >= 4) w = randomChoice(rng, words);
      else w = pseudoword(known, newLetters, ctx);
      if (w && w !== last) break;
    }
    return w;
  };

  const drillTarget = Math.round(len * 0.4);
  const wordTarget = len - drillTarget;
  const out: string[] = [];
  let dLen = 0;
  let wLen = 0;
  let last = '';
  let guard = 0;
  while ((dLen < drillTarget || wLen < wordTarget) && guard++ < 400) {
    const nd = 1 + (rng() < 0.5 ? 1 : 0);
    for (let i = 0; i < nd && dLen < drillTarget; i++) {
      const g = drillGroup();
      out.push(g);
      dLen += g.length + 1;
    }
    const nw = 2 + (rng() < 0.5 ? 1 : 0);
    for (let i = 0; i < nw && wLen < wordTarget; i++) {
      const w = pickWord(last);
      if (!w) break;
      out.push(w);
      last = w;
      wLen += w.length + 1;
    }
  }
  return out.join(' ');
}
