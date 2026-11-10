import { describe, expect, it } from 'vitest';
import en from '../../locales/en.json';
import he from '../../locales/he.json';
import { assignHotkeys, matchHotkey, splitLabel } from '../../src/ui/hotkeys';

const press = (key: string, code: string, extra: object = {}) => ({ key, code, ...extra });

describe('assignHotkeys', () => {
  it('prefers the first letter and moves on when it is taken', () => {
    const hk = assignHotkeys(['Players', 'Pause', 'Settings', 'Sound']);
    expect(hk.map((h) => h?.char)).toEqual(['p', 'a', 's', 'o']);
    expect(hk[1]?.index).toBe(1);
  });

  it('prefers the first letter of a later word over a letter inside the first word', () => {
    expect(assignHotkeys(['Lesson track', 'Layout'])[1]?.char).toBe('a');
    expect(assignHotkeys(['Layout', 'Lesson track'])[1]?.char).toBe('t');
  });

  it('gives every main menu item its own letter in both languages', () => {
    const keys = ['menu.players', 'menu.track', 'menu.layout', 'menu.settings'] as const;
    for (const dict of [en, he]) {
      const chars = assignHotkeys(keys.map((k) => dict[k])).map((h) => h?.char);
      expect(chars.every((c) => typeof c === 'string')).toBe(true);
      expect(new Set(chars).size).toBe(keys.length);
    }
    expect(assignHotkeys(keys.map((k) => he[k])).map((h) => h?.char)).toEqual(['ש', 'מ', 'ק', 'ה']);
  });

  it('avoids Hebrew final letters and vowel marks when it can', () => {
    expect(assignHotkeys(['ךם', 'םא'])[1]?.char).toBe('א');
    expect(assignHotkeys(['שָׁלוֹם'])[0]?.char).toBe('ש');
    expect(assignHotkeys(['ם'])[0]?.char).toBe('ם');
  });

  it('returns null when nothing is free, skips reserved letters and ignores digits', () => {
    expect(assignHotkeys(['a', 'A'])).toEqual([{ char: 'a', index: 0 }, null]);
    expect(assignHotkeys(['Back'], ['b'])[0]?.char).toBe('a');
    expect(assignHotkeys(['123', ''])).toEqual([null, null]);
  });
});

describe('matchHotkey', () => {
  const hebrew = assignHotkeys(['שחקנים', 'מקלדת', 'הגדרות']);
  const english = assignHotkeys(['Players', 'Keyboard', 'Settings']);

  it('matches the typed character, in either case', () => {
    expect(matchHotkey(press('ש', 'KeyA'), hebrew)).toBe(0);
    expect(matchHotkey(press('S', 'KeyS'), english)).toBe(2);
  });

  it('matches the physical key when the computer keyboard is in the other language', () => {
    // Hebrew menu, keyboard set to English: the key that carries ש is KeyA.
    expect(matchHotkey(press('a', 'KeyA'), hebrew)).toBe(0);
    // English menu, keyboard set to Hebrew: KeyP types פ.
    expect(matchHotkey(press('פ', 'KeyP'), english)).toBe(0);
  });

  it('lets the typed character win over the physical key', () => {
    // Mixed list (player names): "Dov" owns d, "גד" owns ג, which lives on KeyD.
    const mixed = assignHotkeys(['גד', 'Dov']);
    expect(matchHotkey(press('d', 'KeyD'), mixed)).toBe(1);
    expect(matchHotkey(press('ג', 'KeyD'), mixed)).toBe(0);
  });

  it('ignores shortcuts with modifiers, named keys and unknown letters', () => {
    expect(matchHotkey(press('s', 'KeyS', { ctrlKey: true }), english)).toBe(-1);
    expect(matchHotkey(press('Enter', 'Enter'), english)).toBe(-1);
    expect(matchHotkey(press('ArrowDown', 'ArrowDown'), hebrew)).toBe(-1);
    expect(matchHotkey(press('z', 'KeyZ'), english)).toBe(-1);
  });
});

describe('splitLabel', () => {
  it('splits around the hot letter', () => {
    const [hk] = assignHotkeys(['Lesson track'], ['l']);
    expect(splitLabel('Lesson track', hk ?? null)).toEqual(['Lesson ', 't', 'rack']);
    expect(splitLabel('Plain', null)).toEqual(['Plain', '', '']);
  });
});
