// Word and sentence library (T05). Pure logic: no DOM, no Three.js, no clock.
// Words are plain (no niqqud); Hebrew final letters only at the end of a word.

import type { LayoutId } from '../../core';
import { normalizePracticeText } from '../../core';
import type { Rng } from '../types';
import { EN_LEXICON, HE_LEXICON } from '../data/lexicon';
import { isAllowedText, isAllowedWord } from '../content';
import { EN_SENTENCE_PACKS, EN_WORD_PACKS } from './data-en';
import { HE_SENTENCE_PACKS, HE_WORD_PACKS } from './data-he';
import { MAX_CUSTOM_LISTS, MAX_CUSTOM_WORDS, MAX_CUSTOM_WORD_LENGTH } from '../../save/schema';
import type { CustomList } from '../../save/schema';

/** Pack that holds the older lexicon ported from the original plugin. */
export const CLASSIC_PACK = 'classic';

/** Difficulty tiers by word length: 1 = 1-3 letters, 2 = 4-5, 3 = 6-7, 4 = 8+. */
export type Tier = 1 | 2 | 3 | 4;

export function tierOf(word: string): Tier {
  const n = [...word].length;
  return n <= 3 ? 1 : n <= 5 ? 2 : n <= 7 ? 3 : 4;
}

const wordCache = new Map<string, Readonly<Record<string, readonly string[]>>>();

function buildWordPacks(language: LayoutId): Readonly<Record<string, readonly string[]>> {
  const raw = language === 'he' ? HE_WORD_PACKS : EN_WORD_PACKS;
  const classic = language === 'he' ? HE_LEXICON : EN_LEXICON;
  const seen = new Set<string>();
  const out: Record<string, string[]> = {};
  const plain = language === 'he' ? /^[א-ת]+$/ : /^[a-z]+$/;
  const take = (id: string, words: readonly string[]): void => {
    const list: string[] = [];
    for (const w of words) {
      if (!plain.test(w) || seen.has(w) || !isAllowedWord(w, language)) continue;
      seen.add(w);
      list.push(w);
    }
    out[id] = list;
  };
  for (const [id, text] of Object.entries(raw)) take(id, text.split(' '));
  take(CLASSIC_PACK, classic);
  return out;
}

function wordPacks(language: LayoutId): Readonly<Record<string, readonly string[]>> {
  let p = wordCache.get(language);
  if (!p) {
    p = buildWordPacks(language);
    wordCache.set(language, p);
  }
  return p;
}

export function wordPackIds(language: LayoutId): string[] {
  return Object.keys(wordPacks(language));
}

/** Words of one pack, or of every pack (deduplicated) when `pack` is omitted. */
export function wordsOf(language: LayoutId, pack?: string): readonly string[] {
  const packs = wordPacks(language);
  if (pack !== undefined) return packs[pack] ?? [];
  return Object.values(packs).flat();
}

export function sentencePackIds(language: LayoutId): string[] {
  return Object.keys(language === 'he' ? HE_SENTENCE_PACKS : EN_SENTENCE_PACKS);
}

export function sentencesOf(language: LayoutId, pack?: string): readonly string[] {
  const packs = language === 'he' ? HE_SENTENCE_PACKS : EN_SENTENCE_PACKS;
  const all = pack !== undefined ? (packs[pack] ?? []) : Object.values(packs).flat();
  return all.filter((x) => isAllowedText(x, language));
}

export interface WordFilter {
  language: LayoutId;
  /** Only words made entirely of these characters. Omit for no key limit. */
  allowedChars?: ReadonlySet<string> | readonly string[];
  /** Restrict to one pack (or a custom list passed as `source`). */
  pack?: string;
  /** Words to draw from instead of a built-in pack, e.g. a custom list. */
  source?: readonly string[];
  minLength?: number;
  maxLength?: number;
  tier?: Tier;
  /** Keys the player is weakest on; words containing them are chosen more often. */
  weakChars?: readonly string[];
  /** How many words to return. */
  count: number;
  rng: Rng;
  /** Allow the same word twice. Default: only when the pool is smaller than `count`. */
  allowRepeats?: boolean;
}

/** Every word that passes the filter's limits (no sampling). */
export function eligibleWords(f: Omit<WordFilter, 'count' | 'rng' | 'weakChars'>): string[] {
  const allowed = f.allowedChars ? new Set(f.allowedChars) : null;
  const pool = f.source ?? wordsOf(f.language, f.pack);
  const out: string[] = [];
  for (const w of pool) {
    const chars = [...w];
    if (f.minLength !== undefined && chars.length < f.minLength) continue;
    if (f.maxLength !== undefined && chars.length > f.maxLength) continue;
    if (f.tier !== undefined && tierOf(w) !== f.tier) continue;
    if (allowed && !chars.every((c) => allowed.has(c))) continue;
    out.push(w);
  }
  return out;
}

/** Weight of a word: 1 plus 3 for each distinct weak key it contains. */
export function weightOf(word: string, weak: ReadonlySet<string>): number {
  if (weak.size === 0) return 1;
  let n = 0;
  for (const c of new Set(word)) if (weak.has(c)) n += 1;
  return 1 + 3 * n;
}

/** Picks `count` words from the filtered pool, weighted toward the weak keys. */
export function pickWords(f: WordFilter): string[] {
  const pool = eligibleWords(f);
  if (pool.length === 0 || f.count <= 0) return [];
  const weak = new Set(f.weakChars ?? []);
  const weights = pool.map((w) => weightOf(w, weak));
  const repeats = f.allowRepeats ?? pool.length < f.count;
  const out: string[] = [];
  const taken = new Set<number>();
  let total = weights.reduce((a, b) => a + b, 0);
  while (out.length < f.count) {
    if (!repeats && taken.size === pool.length) break;
    let r = f.rng() * total;
    let idx = pool.length - 1;
    for (let i = 0; i < pool.length; i += 1) {
      if (!repeats && taken.has(i)) continue;
      r -= weights[i] as number;
      if (r < 0) {
        idx = i;
        break;
      }
    }
    if (!repeats) {
      if (taken.has(idx)) {
        idx = pool.findIndex((_, i) => !taken.has(i));
      }
      taken.add(idx);
      total -= weights[idx] as number;
    }
    out.push(pool[idx] as string);
  }
  return out;
}

// ---- custom lists ----

/** Splits plain text (typed or imported from a file) into clean, typeable words. */
export function parseWordList(text: string, language: LayoutId): string[] {
  const clean = normalizePracticeText(text, false);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of clean.split(' ')) {
    const w =
      language === 'en' ? raw.toLowerCase().replace(/[^a-z]/g, '') : raw.replace(/[^א-ת]/g, '');
    if (w.length === 0 || w.length > MAX_CUSTOM_WORD_LENGTH || seen.has(w)) continue;
    seen.add(w);
    out.push(w);
    if (out.length >= MAX_CUSTOM_WORDS) break;
  }
  return out;
}

export type CustomListResult =
  { ok: true; lists: Record<string, CustomList> } | { ok: false; reason: 'empty' | 'too-many' };

/** Returns a new lists object with the list added or replaced. Never mutates the input. */
export function setCustomList(
  lists: Readonly<Record<string, CustomList>>,
  id: string,
  name: string,
  language: LayoutId,
  text: string,
): CustomListResult {
  const words = parseWordList(text, language);
  if (words.length === 0) return { ok: false, reason: 'empty' };
  if (!(id in lists) && Object.keys(lists).length >= MAX_CUSTOM_LISTS) {
    return { ok: false, reason: 'too-many' };
  }
  const cleanName = name.replace(/\s+/g, ' ').trim().slice(0, 40) || id;
  return { ok: true, lists: { ...lists, [id]: { name: cleanName, language, words } } };
}

export function removeCustomList(
  lists: Readonly<Record<string, CustomList>>,
  id: string,
): Record<string, CustomList> {
  const out = { ...lists };
  delete out[id];
  return out;
}
