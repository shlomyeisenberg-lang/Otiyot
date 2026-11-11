// Door words: the hub is walked by typing (GAME_DESIGN "House of the Scribe"). Every station
// carries a short word made only of letters the player has already learned (ARCHITECTURE 8,
// "learned letters only"), and the set is prefix-free, so the moment the typed letters spell one
// word whole, there is no doubt which station was meant. Real words from the library come first;
// with very few letters learned, short letter strings stand in. Pure logic.

import { isAllowedWord } from '../learn/content';
import type { Rng } from '../learn';

export interface DoorWordOptions {
  /** Learned letters to build words from (no space or punctuation). */
  letters: readonly string[];
  /** Real words already filtered to the learned set (the library's eligible words). */
  pool: readonly string[];
  count: number;
  rng: Rng;
  language: 'he' | 'en';
  /** Longest real word to use. Default 5. */
  maxLength?: number;
}

function prefixClash(a: string, b: string): boolean {
  return a.startsWith(b) || b.startsWith(a);
}

function fits(word: string, chosen: readonly string[]): boolean {
  return chosen.every((c) => !prefixClash(c, word));
}

/**
 * `count` different door words, none the start of another. Words with different first letters
 * are preferred (the first key then already picks the station). Deterministic for a given rng.
 */
export function doorWords(o: DoorWordOptions): string[] {
  const letters = [...new Set(o.letters.filter((c) => /\p{L}/u.test(c)))];
  const max = o.maxLength ?? 5;
  const chosen: string[] = [];
  const shuffled = [...new Set(o.pool)].filter((w) => w.length >= 2 && w.length <= max);
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(o.rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j] as string, shuffled[i] as string];
  }
  // Pass 1: real words, each starting with a letter no other door uses.
  const firsts = new Set<string>();
  for (const w of shuffled) {
    if (chosen.length >= o.count) break;
    const f = w[0] as string;
    if (firsts.has(f) || !fits(w, chosen)) continue;
    firsts.add(f);
    chosen.push(w);
  }
  // Pass 2: more real words, any first letter, still prefix-free.
  for (const w of shuffled) {
    if (chosen.length >= o.count) break;
    if (!chosen.includes(w) && fits(w, chosen)) chosen.push(w);
  }
  if (chosen.length >= o.count || letters.length === 0) return chosen.slice(0, o.count);

  // Pass 3: short strings of the learned letters, just long enough to give every door its own.
  const need = o.count - chosen.length;
  let length = 3;
  while (letters.length ** length < (need + chosen.length) * 1.5 && length < 8) length += 1;
  const pick = (): string => letters[Math.floor(o.rng() * letters.length)] as string;
  for (let attempt = 0; attempt < 400 && chosen.length < o.count; attempt++) {
    let w = '';
    for (let i = 0; i < length; i++) w += pick();
    // Not one letter repeated all the way: that reads as a drill, not a word.
    if (new Set(w).size < Math.min(2, letters.length)) continue;
    if (fits(w, chosen) && isAllowedWord(w, o.language)) chosen.push(w);
  }
  // Last resort: count through every string of that length in order.
  const total = letters.length ** length;
  for (let n = 0; n < total && chosen.length < o.count; n++) {
    let w = '';
    let k = n;
    for (let i = 0; i < length; i++) {
      w += letters[k % letters.length] as string;
      k = Math.floor(k / letters.length);
    }
    if (fits(w, chosen)) chosen.push(w);
  }
  return chosen;
}

export type DoorPress =
  | { kind: 'ok'; typed: string }
  | { kind: 'miss'; typed: string }
  | { kind: 'done'; index: number; typed: string };

/**
 * Matches typed letters against the door words. Each letter narrows the doors still possible;
 * a letter no door continues is a miss (the typed letters stay, so a slip costs one key). When
 * the letters spell a whole word, that door is chosen.
 */
export class DoorPicker {
  typed = '';

  constructor(private words: readonly string[]) {}

  setWords(words: readonly string[]): void {
    this.words = words;
    this.typed = '';
  }

  /** Doors still possible for the letters typed so far. */
  matches(index: number): boolean {
    return (this.words[index] ?? '').startsWith(this.typed);
  }

  /** The letter each door wants next ('' when it no longer matches). */
  nextOf(index: number): string {
    const w = this.words[index] ?? '';
    return w.startsWith(this.typed) ? (w[this.typed.length] ?? '') : '';
  }

  press(ch: string): DoorPress {
    const t = this.typed + ch;
    const hit = this.words.findIndex((w) => w === t);
    if (hit >= 0) {
      this.typed = '';
      return { kind: 'done', index: hit, typed: t };
    }
    if (this.words.some((w) => w.startsWith(t))) {
      this.typed = t;
      return { kind: 'ok', typed: t };
    }
    return { kind: 'miss', typed: this.typed };
  }

  back(): void {
    this.typed = this.typed.slice(0, -1);
  }

  reset(): void {
    this.typed = '';
  }
}
