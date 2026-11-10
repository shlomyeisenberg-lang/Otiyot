// "Every menu item can be chosen by typing its highlighted letter" (DESIGN, Layout).
// Pure logic: picks the letters and decides which item a key press means. No DOM.

import { charForKey, FINAL_LETTERS, isMark, type LayoutId } from '../core';

export interface Hotkey {
  /** The letter to type, lower-cased. */
  char: string;
  /** Where that letter sits in the label (UTF-16 index), for highlighting. */
  index: number;
}

export interface KeyPress {
  key: string;
  code: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}

const LETTER = /\p{L}/u;
const FINALS: ReadonlySet<string> = new Set(Object.keys(FINAL_LETTERS));

function candidates(label: string): Hotkey[] {
  const firsts: Hotkey[] = [];
  const rest: Hotkey[] = [];
  const finals: Hotkey[] = [];
  let index = 0;
  let wordStart = true;
  for (const ch of label) {
    if (LETTER.test(ch) && !isMark(ch)) {
      const hk = { char: ch.toLowerCase(), index };
      if (FINALS.has(ch)) finals.push(hk);
      else if (wordStart) firsts.push(hk);
      else rest.push(hk);
      wordStart = false;
    } else if (!isMark(ch)) {
      wordStart = true;
    }
    index += ch.length;
  }
  // First letters of words read best; final forms (ך ם ן ף ץ) are a last resort.
  return [...firsts, ...rest, ...finals];
}

/**
 * Gives each label its own letter: the first letter of a word when free, else any later letter.
 * A label with no free letter gets `null` (it is still reachable with the arrows and Enter).
 * `reserved` letters are never handed out.
 */
export function assignHotkeys(
  labels: readonly string[],
  reserved: readonly string[] = [],
): (Hotkey | null)[] {
  const used = new Set(reserved.map((c) => c.toLowerCase()));
  return labels.map((label) => {
    for (const c of candidates(label)) {
      if (!used.has(c.char)) {
        used.add(c.char);
        return c;
      }
    }
    return null;
  });
}

const LAYOUT_IDS: readonly LayoutId[] = ['he', 'en'];

/**
 * Which item a key press chooses, or -1. The typed character wins; if nothing matches, the
 * PHYSICAL key is tried on both layouts, so a Hebrew menu still answers when the computer's
 * keyboard is set to English (and the other way round). Presses with Ctrl/Alt/Meta never match.
 */
export function matchHotkey(ev: KeyPress, hotkeys: readonly (Hotkey | null)[]): number {
  if (ev.ctrlKey || ev.metaKey || ev.altKey) return -1;
  const typed = ev.key.length === 1 || ev.key.length === 2 ? ev.key.toLowerCase() : '';
  if (typed) {
    const i = hotkeys.findIndex((hk) => hk?.char === typed);
    if (i >= 0) return i;
  }
  for (const layout of LAYOUT_IDS) {
    const ch = charForKey(layout, ev.code, false)?.toLowerCase();
    if (!ch) continue;
    const i = hotkeys.findIndex((hk) => hk?.char === ch);
    if (i >= 0) return i;
  }
  return -1;
}

/** Splits a label around its hot letter: [before, letter, after]. */
export function splitLabel(label: string, hotkey: Hotkey | null): [string, string, string] {
  if (!hotkey) return [label, '', ''];
  const cp = label.codePointAt(hotkey.index);
  const len = cp !== undefined && cp > 0xffff ? 2 : 1;
  return [
    label.slice(0, hotkey.index),
    label.slice(hotkey.index, hotkey.index + len),
    label.slice(hotkey.index + len),
  ];
}
