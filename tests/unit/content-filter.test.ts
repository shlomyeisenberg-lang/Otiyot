import { describe, expect, it } from 'vitest';
import { cleanText, isAllowedWord } from '../../src/learn/content';
import { nextContinueText, nextText } from '../../src/learn';

describe('content filter (no women, nothing romantic)', () => {
  it('blocks women, romance and she/her words in both languages', () => {
    for (const w of ['אישה', 'והילדה', 'באמא', 'אהבה', 'שמלה', 'היא', 'בת'])
      expect(isAllowedWord(w, 'he'), w).toBe(false);
    for (const w of ['woman', 'Girl', 'she,', 'love', 'Mother.'])
      expect(isAllowedWord(w, 'en'), w).toBe(false);
  });
  it('keeps ordinary words, including Shabbat and "to build"', () => {
    for (const w of ['שבת', 'לבנות', 'ספר', 'כלכלה', 'אבא'])
      expect(isAllowedWord(w, 'he'), w).toBe(true);
    for (const w of ['father', 'book', 'shabbat']) expect(isAllowedWord(w, 'en'), w).toBe(true);
  });
  it('cleans a text and leaves the rest', () => {
    expect(cleanText('הילד קורא ספר והאישה', 'he')).toBe('הילד קורא ספר');
    expect(cleanText('he sees her book', 'en')).toBe('he sees book');
  });
  it('exports exist for text sources', () => {
    expect(typeof nextText).toBe('function');
    expect(typeof nextContinueText).toBe('function');
  });
});
