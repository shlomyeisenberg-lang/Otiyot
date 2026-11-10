import { describe, expect, it } from 'vitest';
import {
  KEYS,
  LAYOUTS,
  charForKey,
  fingerForChar,
  keyForChar,
  normalizePracticeText,
  shiftKeyFor,
  stripNiqqud,
  toGraphemes,
} from '../../src/core';

describe('Hebrew layout', () => {
  it('maps the standard Israeli letters to physical keys', () => {
    expect(charForKey('he', 'KeyF', false)).toBe('כ');
    expect(charForKey('he', 'KeyJ', false)).toBe('ח');
    expect(charForKey('he', 'KeyA', false)).toBe('ש');
    expect(charForKey('he', 'Comma', false)).toBe('ת');
    expect(charForKey('he', 'Quote', false)).toBe(',');
    expect(charForKey('he', 'Slash', false)).toBe('.');
  });
  it('has the five final letters on their own keys', () => {
    expect(charForKey('he', 'KeyL', false)).toBe('ך');
    expect(charForKey('he', 'KeyO', false)).toBe('ם');
    expect(charForKey('he', 'KeyI', false)).toBe('ן');
    expect(charForKey('he', 'Semicolon', false)).toBe('ף');
    expect(charForKey('he', 'Period', false)).toBe('ץ');
  });
  it('swaps < and > relative to QWERTY and mirrors brackets', () => {
    expect(charForKey('he', 'Comma', true)).toBe('>');
    expect(charForKey('en', 'Comma', true)).toBe('<');
    expect(charForKey('he', 'BracketLeft', false)).toBe(']');
    expect(charForKey('en', 'BracketLeft', false)).toBe('[');
  });
  it('gives Latin capitals on the shift layer', () => {
    expect(charForKey('he', 'KeyA', true)).toBe('A');
  });
  it('has no duplicate letters in the unshifted Hebrew map', () => {
    const letters = Object.values(LAYOUTS.he.base).filter((c) => /[א-ת]/.test(c));
    expect(new Set(letters).size).toBe(letters.length);
    expect(letters.length).toBe(27);
  });
});

describe('English layout', () => {
  it('maps lower case, upper case and symbols', () => {
    expect(charForKey('en', 'KeyQ', false)).toBe('q');
    expect(charForKey('en', 'KeyQ', true)).toBe('Q');
    expect(charForKey('en', 'Digit1', true)).toBe('!');
    expect(charForKey('en', 'Semicolon', true)).toBe(':');
    expect(charForKey('en', 'Quote', true)).toBe('"');
  });
});

describe('keyForChar', () => {
  it('finds the key and shift for each layout', () => {
    expect(keyForChar('ש', 'he')).toEqual({ code: 'KeyA', shift: false });
    expect(keyForChar('a', 'en')).toEqual({ code: 'KeyA', shift: false });
    expect(keyForChar('A', 'en')).toEqual({ code: 'KeyA', shift: true });
    expect(keyForChar('?', 'he')).toEqual({ code: 'Slash', shift: true });
    expect(keyForChar(' ', 'he')).toEqual({ code: 'Space', shift: false });
  });
  it('falls back to the other layout (English word in a Hebrew line)', () => {
    expect(keyForChar('k', 'he')).toEqual({ code: 'KeyK', shift: false });
    expect(keyForChar('ל', 'en')).toEqual({ code: 'KeyK', shift: false });
  });
  it('prefers the active layout where both have the character', () => {
    expect(keyForChar('.', 'he')).toEqual({ code: 'Slash', shift: false });
    expect(keyForChar('.', 'en')).toEqual({ code: 'Period', shift: false });
    expect(keyForChar('<', 'he')).toEqual({ code: 'Period', shift: true });
    expect(keyForChar('<', 'en')).toEqual({ code: 'Comma', shift: true });
  });
  it('returns null for characters with no key', () => {
    expect(keyForChar('€', 'he')).toBeNull();
    expect(keyForChar('☃', 'en')).toBeNull();
  });
  it('round-trips every base character of both layouts', () => {
    for (const id of ['he', 'en'] as const) {
      for (const [code, ch] of Object.entries(LAYOUTS[id].base)) {
        const ref = keyForChar(ch, id);
        expect(ref).not.toBeNull();
        expect(charForKey(id, ref!.code, ref!.shift)).toBe(ch);
        expect(code.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('fingers and rows', () => {
  it('assigns the home-row fingers', () => {
    expect(KEYS['KeyA']).toMatchObject({ finger: 'lp', hand: 'left', row: 'home', home: true });
    expect(KEYS['KeyF']).toMatchObject({ finger: 'li', home: true });
    expect(KEYS['KeyJ']).toMatchObject({ finger: 'ri', home: true });
    expect(KEYS['Semicolon']).toMatchObject({ finger: 'rp', home: true });
    expect(KEYS['KeyG']).toMatchObject({ finger: 'li', home: false });
  });
  it('assigns rows and the thumb', () => {
    expect(KEYS['KeyQ']?.row).toBe('top');
    expect(KEYS['KeyZ']?.row).toBe('bottom');
    expect(KEYS['Digit5']?.row).toBe('number');
    expect(KEYS['Space']).toMatchObject({ finger: 'th', row: 'space' });
  });
  it('has a finger and row for every key of both layouts', () => {
    for (const id of ['he', 'en'] as const) {
      for (const code of [...Object.keys(LAYOUTS[id].base), ...Object.keys(LAYOUTS[id].shift)]) {
        expect(KEYS[code], code).toBeDefined();
      }
    }
  });
  it('picks the shift key on the opposite hand', () => {
    expect(shiftKeyFor('KeyA')).toBe('ShiftRight');
    expect(shiftKeyFor('KeyJ')).toBe('ShiftLeft');
  });
  it('finds the finger for a character', () => {
    expect(fingerForChar('ל', 'he')).toBe('rm');
    expect(fingerForChar('€', 'he')).toBeNull();
  });
});

describe('niqqud and normalising', () => {
  it('keeps marks attached to their letter', () => {
    expect(toGraphemes('שָׁלוֹם')).toHaveLength(4);
    expect(stripNiqqud('שָׁלוֹם')).toBe('שלום');
  });
  it('normalises pasted text into typeable text', () => {
    expect(normalizePracticeText('שלום\n\nעולם  “יפה” – כן…')).toBe('שלום עולם "יפה" - כן...');
  });
  it('drops cantillation and optionally niqqud', () => {
    const s = 'בְּרֵאשִׁ֖ית';
    expect(normalizePracticeText(s)).toBe('בראשית');
    expect(stripNiqqud(normalizePracticeText(s, true))).toBe('בראשית');
    expect(normalizePracticeText(s, true).length).toBeGreaterThan('בראשית'.length);
  });
  it('drops characters with no key', () => {
    expect(normalizePracticeText('abc ☃ שלום')).toBe('abc שלום');
  });
});
