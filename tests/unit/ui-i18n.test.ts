import { describe, expect, it } from 'vitest';
import en from '../../locales/en.json';
import he from '../../locales/he.json';
import { dirOf, format, I18n, isolate, otherLang, textDir, translate } from '../../src/ui/i18n';

const FSI = String.fromCharCode(0x2068);
const PDI = String.fromCharCode(0x2069);

describe('locale files', () => {
  it('have exactly the same keys in Hebrew and English', () => {
    expect(Object.keys(he).sort()).toEqual(Object.keys(en).sort());
  });

  it('have no empty strings and the same placeholders in both languages', () => {
    const slots = (s: string): string[] => (s.match(/\{\w+\}/g) ?? []).sort();
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(en[key].trim().length, key).toBeGreaterThan(0);
      expect(he[key].trim().length, key).toBeGreaterThan(0);
      expect(slots(he[key]), key).toEqual(slots(en[key]));
    }
  });

  it('Hebrew strings are really Hebrew (except names of languages and the frame label)', () => {
    const allowed = new Set(['lang.en', 'sg.frame']);
    for (const key of Object.keys(he) as (keyof typeof he)[]) {
      if (allowed.has(key)) continue;
      expect(textDir(he[key].replace(/\{\w+\}/g, '')), key).not.toBe('ltr');
    }
  });
});

describe('i18n', () => {
  it('knows the direction of each language', () => {
    expect(dirOf('he')).toBe('rtl');
    expect(dirOf('en')).toBe('ltr');
    expect(otherLang('he')).toBe('en');
    expect(otherLang('en')).toBe('he');
  });

  it('translates, falls back to the key, and fills slots', () => {
    expect(translate('en', 'menu.settings')).toBe('Settings');
    expect(translate('he', 'menu.settings')).toBe('הגדרות');
    expect(translate('en', 'no.such.key')).toBe('no.such.key');
    expect(translate('en', 'common.step', { n: 2, total: 3 })).toBe(
      `Step ${FSI}2${PDI} of ${FSI}3${PDI}`,
    );
  });

  it('isolates inserted values so a name in the other script cannot reorder the sentence', () => {
    expect(isolate('Eli')).toBe(`${FSI}Eli${PDI}`);
    expect(isolate('')).toBe('');
    expect(format('שלום, {name}', { name: 'Eli' })).toBe(`שלום, ${FSI}Eli${PDI}`);
    expect(format('Hi {missing}')).toBe('Hi {missing}');
  });

  it('finds the direction of mixed text from its first strong character', () => {
    expect(textDir('דבורה')).toBe('rtl');
    expect(textDir('Eli')).toBe('ltr');
    expect(textDir('123 אבג abc')).toBe('rtl');
    expect(textDir('42 abc אבג')).toBe('ltr');
    expect(textDir('123 !?')).toBeNull();
  });

  it('switches language, stamps lang and dir, and tells listeners once per change', () => {
    const i18n = new I18n('he');
    const root = { lang: '', dir: '' } as HTMLElement;
    const seen: string[] = [];
    const off = i18n.onChange((l) => seen.push(l));
    i18n.setLang('en', root);
    expect(i18n.t('common.back')).toBe('Back');
    expect([root.lang, root.dir, i18n.dir]).toEqual(['en', 'ltr', 'ltr']);
    i18n.setLang('en', root);
    i18n.setLang('he', root);
    expect([root.lang, root.dir]).toEqual(['he', 'rtl']);
    off();
    i18n.setLang('en');
    expect(seen).toEqual(['en', 'he']);
  });
});
