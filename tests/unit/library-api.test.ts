import { describe, expect, it } from 'vitest';
import {
  eligibleWords,
  parseWordList,
  pickWords,
  removeCustomList,
  setCustomList,
  tierOf,
  weightOf,
} from '../../src/learn';
import {
  CURRENT_VERSION,
  MAX_CUSTOM_LISTS,
  migrate,
  normalizeProfile,
  normalizeSave,
} from '../../src/save';
import { mulberry32 } from './learn-harness';
import { counter } from './save-helpers';

describe('tiers', () => {
  it('buckets by length', () => {
    expect(tierOf('abc')).toBe(1);
    expect(tierOf('abcd')).toBe(2);
    expect(tierOf('abcdef')).toBe(3);
    expect(tierOf('abcdefgh')).toBe(4);
  });
});

describe('filter API', () => {
  const home = new Set('asdfghjkl'.split(''));

  it('returns only words made of the allowed keys', () => {
    const w = eligibleWords({ language: 'en', allowedChars: home });
    expect(w.length).toBeGreaterThan(5);
    for (const x of w) expect([...x].every((c) => home.has(c))).toBe(true);
  });

  it('respects length, tier and pack limits', () => {
    for (const x of eligibleWords({ language: 'en', minLength: 4, maxLength: 5 })) {
      expect(x.length).toBeGreaterThanOrEqual(4);
      expect(x.length).toBeLessThanOrEqual(5);
    }
    for (const x of eligibleWords({ language: 'he', tier: 1 }))
      expect([...x].length).toBeLessThanOrEqual(3);
    const sea = eligibleWords({ language: 'en', pack: 'sea' });
    expect(sea.length).toBeGreaterThan(100);
    expect(eligibleWords({ language: 'en', pack: 'nope' })).toEqual([]);
  });

  it('picks the requested count without repeats when the pool is large', () => {
    const out = pickWords({ language: 'he', count: 40, rng: mulberry32(1) });
    expect(out).toHaveLength(40);
    expect(new Set(out).size).toBe(40);
  });

  it('repeats only when the pool is smaller than the count', () => {
    const out = pickWords({ language: 'en', source: ['aa', 'bb'], count: 5, rng: mulberry32(2) });
    expect(out).toHaveLength(5);
    expect(pickWords({ language: 'en', source: [], count: 3, rng: mulberry32(2) })).toEqual([]);
  });

  it('is reproducible for a seed', () => {
    const a = pickWords({ language: 'en', count: 10, rng: mulberry32(7) });
    const b = pickWords({ language: 'en', count: 10, rng: mulberry32(7) });
    expect(a).toEqual(b);
  });

  it('weights toward weak keys', () => {
    expect(weightOf('zebra', new Set(['z']))).toBe(4);
    expect(weightOf('zebra', new Set())).toBe(1);
    const count = (weak: string[]): number => {
      let hits = 0;
      for (let seed = 0; seed < 40; seed += 1) {
        const out = pickWords({
          language: 'en',
          source: ['aaa', 'bbb', 'ccc', 'ddd'],
          weakChars: weak,
          count: 4,
          rng: mulberry32(seed),
          allowRepeats: true,
        });
        hits += out.filter((w) => w === 'bbb').length;
      }
      return hits;
    };
    expect(count(['b'])).toBeGreaterThan(count([]));
  });
});

describe('custom lists', () => {
  it('parses plain text into clean unique words', () => {
    expect(parseWordList('Hello, hello World!\n  42 foo-bar', 'en')).toEqual([
      'hello',
      'world',
      'foobar',
    ]);
    expect(parseWordList('שלום שלום, עולם 12 abc', 'he')).toEqual(['שלום', 'עולם']);
  });

  it('adds, replaces and removes lists without mutating', () => {
    const empty = {};
    const r = setCustomList(empty, 'a', ' My  list ', 'en', 'one two');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Object.keys(empty)).toHaveLength(0);
    expect(r.lists.a).toEqual({ name: 'My list', language: 'en', words: ['one', 'two'] });
    expect(Object.keys(removeCustomList(r.lists, 'a'))).toHaveLength(0);
    expect(setCustomList(r.lists, 'b', 'x', 'en', '123 !!!')).toEqual({
      ok: false,
      reason: 'empty',
    });
  });

  it('refuses a list beyond the cap', () => {
    const lists: Record<string, { name: string; language: 'en'; words: string[] }> = {};
    for (let i = 0; i < MAX_CUSTOM_LISTS; i += 1) {
      lists[`l${i}`] = { name: 'n', language: 'en', words: ['a'] };
    }
    expect(setCustomList(lists, 'extra', 'n', 'en', 'abc')).toEqual({
      ok: false,
      reason: 'too-many',
    });
    expect(setCustomList(lists, 'l0', 'n', 'en', 'abc').ok).toBe(true);
  });
});

describe('save v2: customLists', () => {
  it('migrates a v1 save by adding empty customLists', () => {
    const v1 = { version: 1, profiles: [{ id: 'a', name: 'Dov' }], activeProfileId: 'a' };
    const m = migrate(v1);
    expect(m.version).toBe(CURRENT_VERSION);
    const save = normalizeSave(m, CURRENT_VERSION, counter(), 0);
    expect(save?.profiles[0]?.customLists).toEqual({});
  });

  it('keeps valid lists and drops bad ones', () => {
    const p = normalizeProfile(
      { id: 'a', customLists: { ok: { name: 'x', language: 'en', words: ['a', 5, ''] }, bad: 7 } },
      'f',
      0,
    );
    expect(p.customLists).toEqual({ ok: { name: 'x', language: 'en', words: ['a'] } });
  });
});
