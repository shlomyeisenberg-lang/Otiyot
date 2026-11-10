import { describe, expect, it } from 'vitest';
import { isTypeable, FINAL_LETTERS } from '../../src/core';
import { CLASSIC_PACK, sentencePackIds, sentencesOf, wordPackIds, wordsOf } from '../../src/learn';

// Content rules (ARCHITECTURE section 8): no holy Names, no pesukim or prayer text.
const HE_BLOCK = ['יהוה', 'אדני', 'אלוה', 'אלוק', 'שדי', 'השם', 'צבאות', 'ישראל ה'];
const EN_BLOCK = ['jehovah', 'adonai', 'hashem', 'yahweh', 'lord', 'god'];
const FINALS = new Set(Object.keys(FINAL_LETTERS));

function hebrewShapeOk(w: string): boolean {
  const cs = [...w];
  return cs.every((c, i) => /[א-ת]/.test(c) && (!FINALS.has(c) || i === cs.length - 1));
}

describe('library content', () => {
  it('has the required amount of material', () => {
    expect(wordsOf('he').length).toBeGreaterThanOrEqual(3000);
    expect(wordsOf('en').length).toBeGreaterThanOrEqual(3000);
    expect(sentencesOf('he').length).toBeGreaterThanOrEqual(300);
    expect(sentencesOf('en').length).toBeGreaterThanOrEqual(300);
  });

  it('has the themed packs', () => {
    for (const lang of ['he', 'en'] as const) {
      const ids = wordPackIds(lang);
      for (const p of [
        'everyday',
        'home',
        'market',
        'numbers',
        'travel',
        'sea',
        'sky',
        'desert',
        'holidays',
        CLASSIC_PACK,
      ]) {
        expect(ids).toContain(p);
      }
      expect(sentencePackIds(lang)).toContain('proverbs');
    }
  });

  it('has no duplicate words across packs', () => {
    for (const lang of ['he', 'en'] as const) {
      const all = wordsOf(lang);
      expect(new Set(all).size).toBe(all.length);
    }
  });

  it('every Hebrew word and sentence is typeable, plain and well-formed', () => {
    for (const w of wordsOf('he')) {
      expect(hebrewShapeOk(w), w).toBe(true);
      expect([...w].every(isTypeable), w).toBe(true);
    }
    for (const s of sentencesOf('he')) {
      for (const w of s.split(' ')) expect(hebrewShapeOk(w), s).toBe(true);
    }
  });

  it('every English word and sentence is lowercase letters only', () => {
    for (const w of wordsOf('en')) expect(w, w).toMatch(/^[a-z]+$/);
    for (const s of sentencesOf('en')) expect(s, s).toMatch(/^[a-z]+( [a-z]+)*$/);
  });

  it('blocklist: no holy Names or God terms in any pack', () => {
    for (const w of [...wordsOf('he'), ...sentencesOf('he')]) {
      for (const b of HE_BLOCK) expect(w.includes(b), `${w} ~ ${b}`).toBe(false);
    }
    for (const text of [...wordsOf('en'), ...sentencesOf('en')]) {
      for (const tok of text.split(' ')) expect(EN_BLOCK.includes(tok), text).toBe(false);
    }
  });
});
