import { charForKey, type Finger, type LayoutId } from '../core';
import { EN_LETTERS, HE_LETTERS } from './data/curriculum';
import type { Rng } from './types';

export function randomChoice<T>(rng: Rng, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)] as T;
}

export function isLetterChar(c: string): boolean {
  return /^[א-תa-zA-Z]$/.test(c);
}

/** Removes niqqud and cantillation marks (same range as the original plugin). */
export function stripNiqud(s: string): string {
  return s.replace(/[֑-ׇ]/g, '');
}

/** Character a physical key types in the curriculum language (empty if none). */
export function keyChar(language: LayoutId, code: string): string {
  return charForKey(language, code, false) ?? '';
}

/** All letters of a layout, in the original layout order. */
export function lettersOf(language: LayoutId): readonly string[] {
  return language === 'en' ? EN_LETTERS : HE_LETTERS;
}

/** Repeats the groups in order until the text reaches `len` characters. */
export function repeatToLength(groups: readonly string[], len: number): string {
  const out: string[] = [];
  let n = 0;
  let i = 0;
  while (n < len) {
    const g = groups[i % groups.length] as string;
    out.push(g);
    n += g.length + 1;
    i++;
  }
  return out.join(' ');
}

const FINGER_HE: Record<Finger, string> = {
  lp: 'זרת שמאל',
  lr: 'קמיצה שמאל',
  lm: 'אמה שמאל',
  li: 'אצבע שמאל',
  ri: 'אצבע ימין',
  rm: 'אמה ימין',
  rr: 'קמיצה ימין',
  rp: 'זרת ימין',
  th: 'אגודל',
};
const FINGER_EN: Record<Finger, string> = {
  lp: 'Left pinky',
  lr: 'Left ring',
  lm: 'Left middle',
  li: 'Left index',
  ri: 'Right index',
  rm: 'Right middle',
  rr: 'Right ring',
  rp: 'Right pinky',
  th: 'Thumb',
};

export function fingerName(finger: Finger | undefined, ui: LayoutId): string {
  if (!finger) return '';
  return (ui === 'en' ? FINGER_EN : FINGER_HE)[finger];
}
