import { describe, expect, it } from 'vitest';
import {
  ARCADE_GAMES,
  CLASSIC_GAMES,
  NEWGEN_GAMES,
  QUICK_GAMES,
  coinsOf,
  bankFrom,
  buildInit,
  clusters,
  emptyBlob,
  isArcadeGame,
  joinWords,
  parseMessage,
  readBlob,
} from '../../src/arcade';
import { createProfile } from '../../src/save/schema';
import { bestScore } from '../../src/ui/screens/arcade';
import { knownKeysOf } from '../../src/learn';

const theme = {
  dark: false,
  page: '#fff',
  ink: '#000',
  gold: '#c90',
  line: '#ccc',
  onGold: '#000',
};
const seeded = (): (() => number) => {
  let a = 7;
  return () => {
    a = (a * 48271) % 2147483647;
    return a / 2147483647;
  };
};

describe('arcade bridge payload', () => {
  for (const layout of ['he', 'en'] as const) {
    it(`uses only learned letters (${layout}, new player)`, () => {
      const profile = createProfile('p1', 'Test', 0);
      profile.layout = layout;
      const known = knownKeysOf(profile);
      const init = buildInit({
        layout,
        uiLang: layout,
        theme,
        known,
        weak: [],
        blob: null,
        game: 'galaxy',
        rng: seeded(),
      });
      const ok = new Set([...known, ' ']);
      const texts = [
        ...init.words.short,
        ...init.words.medium,
        ...init.words.long,
        ...init.words.advanced,
        ...init.sentences,
        ...init.paragraphs,
      ];
      expect(texts.length).toBeGreaterThan(10);
      for (const text of texts) {
        expect(text.length).toBeGreaterThan(0);
        for (const ch of text) expect(ok.has(ch)).toBe(true);
      }
      for (const k of ['short', 'medium', 'long', 'advanced'] as const) {
        expect(init.words[k].length).toBeGreaterThan(0);
      }
      expect(init.letters.every((c) => known.has(c))).toBe(true);
    });
  }

  it('keeps only learned letters among the weak keys', () => {
    const known = new Set(['a', 'b', 'c']);
    const init = buildInit({
      layout: 'en',
      uiLang: 'en',
      theme,
      known,
      weak: ['b', 'z', '1'],
      blob: null,
      game: 'race',
      rng: seeded(),
    });
    expect(init.weak).toEqual(['b']);
  });

  it('never leaves a word class empty', () => {
    const bank = bankFrom([], ['a', 'b'], seeded());
    for (const k of ['short', 'medium', 'long', 'advanced'] as const) {
      expect(bank[k].length).toBeGreaterThan(0);
    }
    expect(clusters([], 3, seeded())).toEqual([]);
    expect(joinWords([], 3, 1, 2, seeded())).toEqual([]);
    expect(joinWords(['ab'], 2, 3, 3, seeded())).toEqual(['ab ab ab', 'ab ab ab']);
  });
});

describe('arcade messages and saves', () => {
  it('checks the games list', () => {
    expect(ARCADE_GAMES).toHaveLength(16);
    expect(CLASSIC_GAMES).toHaveLength(5);
    expect(NEWGEN_GAMES).toHaveLength(8);
    expect(QUICK_GAMES).toHaveLength(3);
    expect(new Set(ARCADE_GAMES).size).toBe(16);
    expect(isArcadeGame('galaxy')).toBe(true);
    expect(isArcadeGame('runner')).toBe(true);
    expect(isArcadeGame('daily')).toBe(true);
    expect(isArcadeGame('shop')).toBe(true);
    expect(isArcadeGame('rain')).toBe(false);
  });

  it('reads coins and flat best scores safely', () => {
    expect(coinsOf(null)).toBe(0);
    expect(coinsOf({ games3d: { plus: { coins: 42.9 } } })).toBe(42);
    expect(coinsOf({ games3d: { plus: { coins: -3 } } })).toBe(0);
    expect(coinsOf({ games3d: { plus: 'x' } })).toBe(0);
    const blob = { games3d: {}, games: { stormBest: 900, rainBest: 'x' } };
    expect(bestScore(blob, 'storm')).toBe(900);
    expect(bestScore(blob, 'wordRain')).toBe(0);
    expect(bestScore(blob, 'letterRain')).toBe(0);
  });

  it('builds a learned-letters-only payload for every game', () => {
    const profile = createProfile('p2', 'Test', 0);
    const known = knownKeysOf(profile);
    for (const game of ARCADE_GAMES) {
      const init = buildInit({
        layout: 'he',
        uiLang: 'en',
        theme,
        known,
        weak: [],
        blob: null,
        game,
        rng: seeded(),
      });
      expect(init.game).toBe(game);
      const text = [
        ...init.words.short,
        ...init.words.medium,
        ...init.words.long,
        ...init.words.advanced,
        ...init.sentences,
        ...init.paragraphs,
      ].join(' ');
      for (const ch of text) if (ch !== ' ') expect(known.has(ch)).toBe(true);
    }
  });

  it('accepts only known messages', () => {
    expect(parseMessage({ type: 'otiyot:ready' })).toEqual({ type: 'otiyot:ready' });
    expect(parseMessage({ type: 'otiyot:exit' })).toEqual({ type: 'otiyot:exit' });
    expect(parseMessage({ type: 'other' })).toBeNull();
    expect(parseMessage(null)).toBeNull();
    expect(parseMessage('x')).toBeNull();
    const save = parseMessage({ type: 'otiyot:save', blob: { games3d: { a: 1 }, games: 'bad' } });
    expect(save).toEqual({ type: 'otiyot:save', blob: { games3d: { a: 1 }, games: {} } });
  });

  it('refuses a huge blob', () => {
    const big = { games3d: { x: 'y'.repeat(250_000) }, games: {} };
    expect(parseMessage({ type: 'otiyot:save', blob: big })).toBeNull();
  });

  it('reads a damaged blob as empty', () => {
    expect(readBlob(null)).toEqual(emptyBlob());
    expect(readBlob([1])).toEqual(emptyBlob());
    expect(readBlob(5)).toEqual(emptyBlob());
  });

  it('finds the best score over every mode', () => {
    const blob = {
      games3d: {
        scores: {
          galaxy: {
            'classic|normal': [{ score: 120 }, { score: 90 }],
            'timed|hard|120': [{ score: 300 }],
          },
        },
      },
      games: {},
    };
    expect(bestScore(blob, 'galaxy')).toBe(300);
    expect(bestScore(blob, 'race')).toBe(0);
    expect(bestScore(null, 'galaxy')).toBe(0);
  });
});
