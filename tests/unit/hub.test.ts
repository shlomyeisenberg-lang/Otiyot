import { describe, expect, it } from 'vitest';
import { DoorPicker, doorWords } from '../../src/game/doors';
import {
  learnPath,
  needMet,
  nextRegion,
  rankFromNumber,
  rankNumber,
  recordRegionRank,
  regionMode,
  regionStatuses,
  REGION_IDS,
  REGIONS,
  restoredShare,
  STORY_REGIONS,
  type RegionId,
} from '../../src/game/regions';
import { eligibleWords, getTrack, knownKeysOf, recordLessonResult } from '../../src/learn';
import { isAllowedWord } from '../../src/learn/content';
import { createProfile, type Profile } from '../../src/save';
import { fillLine, HUB_LINES, hubLine, partOfDay } from '../../src/story';

function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 48271) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function player(layout: 'he' | 'en' = 'en', track: 1 | 2 = 1): Profile {
  const p = createProfile('a', 'A', 0);
  p.layout = layout;
  p.track = track;
  p.settings.uiLanguage = layout;
  return p;
}

/** Passes the first `n` lessons of the track, in order. */
function pass(p: Profile, n: number): Profile {
  const t = getTrack(p.track);
  let done = 0;
  for (const lvl of t.levels(p.layout, p.layout)) {
    for (const l of t.lessons(lvl.id, p.layout, p.layout)) {
      if (done >= n) return p;
      recordLessonResult(p, l.id, { wpm: 20, accuracy: 100 });
      done += 1;
    }
  }
  return p;
}

function prefixFree(words: readonly string[]): boolean {
  return words.every((a, i) => words.every((b, j) => i === j || !b.startsWith(a)));
}

describe('door words: walking the hub by typing', () => {
  it('uses only learned letters, even for a brand-new player (learned letters only)', () => {
    for (const layout of ['en', 'he'] as const) {
      const p = player(layout);
      const keys = knownKeysOf(p);
      const letters = [...keys].filter((c) => /\p{L}/u.test(c));
      expect(letters.length).toBeGreaterThanOrEqual(2);
      const words = doorWords({
        letters,
        pool: eligibleWords({ language: layout, allowedChars: keys, minLength: 2, maxLength: 5 }),
        count: 7,
        rng: seeded(7),
        language: layout,
      });
      expect(words).toHaveLength(7);
      expect(new Set(words).size).toBe(7);
      expect(prefixFree(words)).toBe(true);
      for (const w of words) {
        for (const ch of w) expect(keys.has(ch), `${w}: ${ch}`).toBe(true);
        expect(w.length).toBeLessThanOrEqual(4);
      }
    }
  });

  it('prefers real words with different first letters once enough letters are learned', () => {
    for (const layout of ['en', 'he'] as const) {
      const p = pass(player(layout), 20);
      const keys = knownKeysOf(p);
      const pool = eligibleWords({
        language: layout,
        allowedChars: keys,
        minLength: 2,
        maxLength: 5,
      });
      const words = doorWords({
        letters: [...keys],
        pool,
        count: 7,
        rng: seeded(3),
        language: layout,
      });
      expect(words).toHaveLength(7);
      expect(prefixFree(words)).toBe(true);
      expect(new Set(words.map((w) => w[0])).size).toBe(7);
      for (const w of words) {
        expect(pool).toContain(w);
        for (const ch of w) expect(keys.has(ch)).toBe(true);
        expect(isAllowedWord(w, layout)).toBe(true);
      }
    }
  });

  it('is the same for the same random source', () => {
    const o = { letters: ['f', 'j', 'd', 'k'], pool: [], count: 7, language: 'en' as const };
    expect(doorWords({ ...o, rng: seeded(11) })).toEqual(doorWords({ ...o, rng: seeded(11) }));
  });

  it('the picker narrows the doors letter by letter and picks the one spelled whole', () => {
    const pick = new DoorPicker(['fjf', 'fjj', 'jff']);
    expect(pick.press('f')).toEqual({ kind: 'ok', typed: 'f' });
    expect(pick.matches(0)).toBe(true);
    expect(pick.matches(2)).toBe(false);
    expect(pick.nextOf(1)).toBe('j');
    expect(pick.press('k')).toEqual({ kind: 'miss', typed: 'f' });
    expect(pick.press('j')).toEqual({ kind: 'ok', typed: 'fj' });
    pick.back();
    expect(pick.typed).toBe('f');
    pick.press('j');
    expect(pick.press('j')).toEqual({ kind: 'done', index: 1, typed: 'fjj' });
    expect(pick.typed).toBe('');
  });
});

describe('regions: the map follows the course', () => {
  it('a brand-new player has the Meadow open and nothing else of the story', () => {
    const st = regionStatuses(player());
    expect(st.map((s) => s.id)).toEqual([...REGION_IDS]);
    expect(st.filter((s) => s.open).map((s) => s.id)).toEqual(['meadow']);
    expect(st.every((s) => !s.restored)).toBe(true);
    expect(st[0]?.levels).toEqual(['easy']);
  });

  it('a locked region names the lesson that opens it, and passing it opens the region', () => {
    for (const layout of ['en', 'he'] as const) {
      for (const track of [1, 2] as const) {
        const p = player(layout, track);
        const cliffs = REGIONS.find((r) => r.id === 'cliffs');
        if (!cliffs) throw new Error('no cliffs');
        const path = learnPath(p, cliffs.need);
        expect(path).not.toBeNull();
        if (!path) return;
        expect(path.remaining).toBeGreaterThan(0);
        // The next lesson on the way is one the player can take now.
        expect(path.nextId).toBe('L0-0');
        expect(needMet(pass(p, path.remaining), cliffs.need)).toBe(true);
        expect(needMet(pass(player(layout, track), path.remaining - 1), cliffs.need)).toBe(false);
      }
    }
  });

  it('the Forge waits for the number row, which no lesson teaches yet', () => {
    const p = pass(player(), 200);
    const forge = regionStatuses(p).find((s) => s.id === 'forge');
    expect(forge?.open).toBe(false);
    expect(forge?.learn).toBeNull();
  });

  it('levels open with learned letters, and later regions with later levels of the course', () => {
    const p = pass(player(), 45);
    const st = regionStatuses(p);
    const open = new Set(st.filter((s) => s.open).map((s) => s.id));
    expect(open.has('cliffs')).toBe(true);
    expect(open.has('ladder')).toBe(true);
    expect(open.has('scroll')).toBe(false);
    expect(st[0]?.levels).toEqual(['easy', 'standard', 'hard']);
    // The course has reached the Shuk, but Act Two waits for the Great Blot (T16).
    const shuk = st.find((s) => s.id === 'shuk');
    expect(shuk?.open).toBe(false);
    expect(shuk?.waitsFor).toBe('blot');
    expect(shuk?.learn).toBeNull();
    recordRegionRank(p, 'blot', 'B');
    expect(regionStatuses(p).find((s) => s.id === 'shuk')?.open).toBe(true);
  });

  it('the Great Blot opens once the Cliffs are restored', () => {
    const p = pass(player(), 45);
    expect(regionStatuses(p).find((s) => s.id === 'blot')?.open).toBe(false);
    recordRegionRank(p, 'cliffs', 'C');
    const blot = regionStatuses(p).find((s) => s.id === 'blot');
    expect(blot?.open).toBe(true);
    expect(blot?.act).toBe(1);
  });

  it('the Blank Scroll waits for the Arena', () => {
    const p = player();
    expect(regionStatuses(p).find((s) => s.id === 'scroll')?.open).toBe(false);
    recordRegionRank(p, 'arena', 'B');
    expect(regionStatuses(p).find((s) => s.id === 'scroll')?.open).toBe(true);
  });

  it('ranks are kept as numbers and only ever improve', () => {
    expect(rankNumber('S')).toBe(4);
    expect(rankFromNumber(1)).toBe('C');
    expect(rankFromNumber(0)).toBeNull();
    expect(rankFromNumber(undefined)).toBeNull();
    const p = player();
    recordRegionRank(p, 'meadow', 'A');
    recordRegionRank(p, 'meadow', 'C');
    expect(rankFromNumber(p.story.ranks.meadow)).toBe('A');
  });

  it('the share of the land restored counts story regions only', () => {
    const p = player();
    expect(restoredShare(p)).toBe(0);
    recordRegionRank(p, 'ladder', 'S');
    expect(restoredShare(p)).toBe(0);
    recordRegionRank(p, 'meadow', 'B');
    expect(restoredShare(p)).toBeCloseTo(1 / STORY_REGIONS.length);
  });

  it('"continue the story" leads to the first open region not yet restored', () => {
    const p = pass(player(), 45);
    recordRegionRank(p, 'meadow', 'A');
    recordRegionRank(p, 'blot', 'A');
    const st = regionStatuses(p);
    expect(nextRegion(st, new Set<RegionId>())?.id).toBe('cliffs');
    expect(nextRegion(st, new Set<RegionId>(['shuk']))?.id).toBe('shuk');
  });

  it('suggests a level from the region’s own runs', () => {
    const p = pass(player(), 45);
    for (let i = 0; i < 4; i++) {
      p.history.push({
        at: i,
        track: 1,
        mode: regionMode('meadow', 'easy', 'steady'),
        wpm: 20 + i * 3,
        accuracy: 96,
        durationMs: 60000,
        chars: 200,
      });
    }
    const meadow = regionStatuses(p).find((s) => s.id === 'meadow');
    expect(meadow?.suggested).toBe('standard');
  });
});

describe('hub lines', () => {
  it('every line exists in both languages and keeps to the content rules', () => {
    for (const lines of Object.values(HUB_LINES)) {
      expect(lines.length).toBeGreaterThan(0);
      for (const l of lines) {
        expect(['ezra', 'dyo', 'naftali']).toContain(l.who);
        for (const lang of ['he', 'en'] as const) {
          const text = fillLine(l.text[lang], { name: 'David', region: 'X' });
          expect(text.length).toBeGreaterThan(5);
          for (const w of text.split(/\s+/)) expect(isAllowedWord(w, lang), w).toBe(true);
        }
      }
    }
  });

  it('picks lines and parts of the day', () => {
    expect(hubLine('idle', 0)).toBe(HUB_LINES.idle[0]);
    expect(hubLine('idle', HUB_LINES.idle.length)).toBe(HUB_LINES.idle[0]);
    expect(partOfDay(7)).toBe('morning');
    expect(partOfDay(13)).toBe('day');
    expect(partOfDay(19)).toBe('evening');
    expect(partOfDay(23)).toBe('night');
    expect(partOfDay(-1)).toBe('night');
    expect(fillLine('{region} and {name}', { region: 'A', name: 'B' })).toBe('A and B');
  });
});
