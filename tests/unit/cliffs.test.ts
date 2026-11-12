import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, DIFFICULTY_IDS } from '../../src/game/difficulty';
import { LEVEL_IDS, LEVELS, levelWordSource, levelsFor } from '../../src/game/levels';
import { REGIONS } from '../../src/game/regions';
import { getTrack, knownKeysOf, recordLessonResult } from '../../src/learn';
import { isAllowedWord } from '../../src/learn/content';
import { createProfile, type Profile } from '../../src/save';
import {
  chapterAt,
  chapterStartsAt,
  colorShare,
  fallsFlowing,
  ibexBack,
  planCliffs,
  reachCost,
  reachOf,
  rowOf,
  SECTIONS,
  STEP,
  STONE_MAX,
  STONE_MIN,
  stoneHeights,
  WORDS_PER_LEVEL,
} from '../../src/scenes/cliffs/plan';
import { CLIFFS_LINES, cliffsLine } from '../../src/story';
import { PARENT } from '../../src/ui/app';
import { playableRegions, SCENE_ROUTES } from '../../src/ui/playable';

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

describe('the stepping stones', () => {
  it('knows which row a letter lives on, in both layouts', () => {
    expect(rowOf('en', 'q')).toBe('top');
    expect(rowOf('en', 'a')).toBe('home');
    expect(rowOf('en', 'z')).toBe('bottom');
    expect(rowOf('en', '7')).toBe('number');
    expect(rowOf('en', '€')).toBeNull();
    expect(rowOf('he', 'ק')).toBe('top');
    expect(rowOf('he', 'ש')).toBe('home');
    expect(rowOf('he', 'ז')).toBe('bottom');
  });

  it('reaches up for top-row words, down for bottom-row words, level otherwise', () => {
    expect(reachOf('en', 'quit')).toBe('up');
    expect(reachOf('en', 'zinc')).toBe('down');
    expect(reachOf('en', 'sad')).toBe('level');
    expect(reachOf('en', 'qz')).toBe('level');
    expect(reachOf('en', '')).toBe('level');
  });

  it('moves one step up or down per word and keeps the stones in range', () => {
    expect(stoneHeights([])).toEqual([0]);
    expect(stoneHeights(['up', 'up', 'level', 'down'])).toEqual([
      0,
      STEP,
      2 * STEP,
      2 * STEP,
      STEP,
    ]);
    const long = stoneHeights(Array.from({ length: 40 }, () => 'up' as const));
    expect(Math.max(...long)).toBe(STONE_MAX);
    const deep = stoneHeights(Array.from({ length: 40 }, () => 'down' as const));
    expect(Math.min(...deep)).toBe(STONE_MIN);
    expect(long).toHaveLength(41);
  });
});

describe('the Cliffs run: learned letters only', () => {
  it('never asks for a key the player has not learned, at any point in either course', () => {
    for (const layout of ['en', 'he'] as const) {
      for (const track of [1, 2] as const) {
        for (const lessons of [0, 1, 3, 8, 20, 60]) {
          const p = pass(player(layout, track), lessons);
          const keys = knownKeysOf(p);
          for (const level of levelsFor(p)) {
            for (const id of DIFFICULTY_IDS) {
              const rng = seeded(lessons * 31 + 11);
              const words = levelWordSource(p, LEVELS[level], DIFFICULTIES[id], rng);
              const plan = planCliffs({ layout, keys, level, words });
              expect(plan.words.length).toBeGreaterThan(0);
              expect(plan.reaches).toHaveLength(plan.words.length);
              expect(plan.heights).toHaveLength(plan.words.length + 1);
              for (const w of plan.words) {
                expect(w.length).toBeGreaterThan(0);
                for (const ch of w) expect(keys.has(ch), `${layout} ${track} ${w}`).toBe(true);
                expect(isAllowedWord(w, layout)).toBe(true);
              }
              // A player who has not learned the top and bottom rows only takes level steps.
              plan.words.forEach((w, i) => {
                const rows = [...w].map((ch) => rowOf(layout, ch));
                if (!rows.includes('top') && !rows.includes('bottom')) {
                  expect(plan.reaches[i]).toBe('level');
                }
              });
              expect(plan.text).toBe(plan.words.join(' '));
              expect(plan.letters).toBe(plan.words.reduce((n, w) => n + [...w].length, 0));
            }
          }
        }
      }
    }
  });

  it('has more words on harder levels, in whole quarters', () => {
    for (let i = 1; i < LEVEL_IDS.length; i++) {
      expect(WORDS_PER_LEVEL[LEVEL_IDS[i] as 'easy']).toBeGreaterThan(
        WORDS_PER_LEVEL[LEVEL_IDS[i - 1] as 'easy'],
      );
    }
    for (const id of LEVEL_IDS) expect(WORDS_PER_LEVEL[id] % SECTIONS).toBe(0);
  });

  it('uses the top and bottom rows once they are learned, and lays chapters out with no gaps', () => {
    const p = pass(player('en'), 60);
    const keys = knownKeysOf(p);
    const words = levelWordSource(p, LEVELS.standard, DIFFICULTIES.steady, seeded(9));
    const plan = planCliffs({ layout: 'en', keys, level: 'standard', words });
    expect(plan.reaches).toContain('up');
    expect(plan.reaches).toContain('down');
    expect(plan.chapters.map((c) => c.id)).toEqual(['ledge', 'canyon', 'summit']);
    expect(plan.chapters[0]?.from).toBe(0);
    for (let i = 1; i < plan.chapters.length; i++) {
      expect(plan.chapters[i]?.from).toBe(plan.chapters[i - 1]?.to);
    }
    expect(plan.chapters.at(-1)?.to).toBe(plan.words.length);
    expect(chapterAt(plan, 0)).toBe('ledge');
    expect(chapterAt(plan, plan.words.length)).toBe('summit');
    expect(chapterStartsAt(plan, plan.chapters[1]?.from ?? 0)).toBe('canyon');
    expect(chapterStartsAt(plan, 1)).toBeNull();
    for (let i = 1; i < plan.words.length; i++) expect(plan.words[i]).not.toBe(plan.words[i - 1]);
    // The stones always follow the reaches.
    expect(plan.heights).toEqual(stoneHeights(plan.reaches));
  });
});

describe('the climb stays varied (R15)', () => {
  it('keeps the climb moving for a fluent player: almost every reach lands higher or lower', () => {
    for (const layout of ['en', 'he'] as const) {
      const p = pass(player(layout), 60);
      const keys = knownKeysOf(p);
      for (const level of LEVEL_IDS) {
        for (let seed = 1; seed <= 12; seed++) {
          const words = levelWordSource(p, LEVELS[level], DIFFICULTIES.steady, seeded(seed));
          const plan = planCliffs({ layout, keys, level, words });
          let ups = 0;
          let downs = 0;
          let flat = 0;
          plan.reaches.forEach((r, k) => {
            if (r === 'up') ups += 1;
            if (r === 'down') downs += 1;
            // A reach up or down should land on a stone that really is higher or lower.
            if (r !== 'level' && plan.heights[k + 1] === plan.heights[k]) flat += 1;
          });
          expect(flat, `${layout} ${level} ${seed} ${plan.reaches.join(',')}`).toBeLessThanOrEqual(
            1,
          );
          // Both rows are practised, and neither crowds the other out.
          expect(downs, `${layout} ${level} ${seed} ${plan.reaches.join(',')}`).toBeGreaterThan(0);
          expect(ups).toBeGreaterThan(0);
          expect(Math.abs(ups - downs)).toBeLessThanOrEqual(Math.ceil(plan.words.length / 2));
        }
      }
    }
  });

  it('scores a step past the limit or a third same reach in a row as a poor fit', () => {
    const none = { up: 0, level: 0, down: 0 };
    expect(reachCost('up', STONE_MAX, [], none)).toBeGreaterThan(
      reachCost('down', STONE_MAX, [], none),
    );
    expect(reachCost('down', STONE_MIN, [], none)).toBeGreaterThan(
      reachCost('up', STONE_MIN, [], none),
    );
    expect(reachCost('up', 0, ['up', 'up'], none)).toBeGreaterThan(
      reachCost('down', 0, ['up', 'up'], none),
    );
  });
});

describe('how the cliffs answer', () => {
  it('starts one more waterfall at the end of each quarter, all of them by the end', () => {
    expect(fallsFlowing(0, 16)).toBe(0);
    expect(fallsFlowing(3, 16)).toBe(0);
    expect(fallsFlowing(4, 16)).toBe(1);
    expect(fallsFlowing(8, 16)).toBe(2);
    expect(fallsFlowing(12, 16)).toBe(3);
    expect(fallsFlowing(16, 16)).toBe(SECTIONS);
    expect(fallsFlowing(3, 0)).toBe(SECTIONS);
    let last = 0;
    for (let w = 0; w <= 20; w++) {
      const n = fallsFlowing(w, 20);
      expect(n - last).toBeLessThanOrEqual(1);
      expect(n).toBeGreaterThanOrEqual(last);
      last = n;
    }
  });

  it('brings an ibex back with each waterfall and one more at the summit', () => {
    expect(ibexBack(0, 12)).toBe(0);
    expect(ibexBack(3, 12)).toBe(1);
    expect(ibexBack(11, 12)).toBe(SECTIONS - 1);
    expect(ibexBack(12, 12)).toBe(SECTIONS + 1);
  });

  it('spreads the color evenly from none to all', () => {
    expect(colorShare(0, 12)).toBe(0);
    expect(colorShare(6, 12)).toBe(0.5);
    expect(colorShare(12, 12)).toBe(1);
    expect(colorShare(5, 0)).toBe(1);
  });
});

describe('what Reb Ezra and Dyo say on the Cliffs', () => {
  it('has a line in both languages for every moment, spoken by Reb Ezra or Dyo', () => {
    for (const [moment, lines] of Object.entries(CLIFFS_LINES)) {
      expect(lines.length, moment).toBeGreaterThan(0);
      for (const line of lines) {
        expect(['ezra', 'dyo']).toContain(line.who);
        expect(line.text.he.trim().length).toBeGreaterThan(0);
        expect(line.text.en.trim().length).toBeGreaterThan(0);
        expect(/[֐-׿]/.test(line.text.he)).toBe(true);
      }
    }
    expect(cliffsLine('slip', 0)).not.toBe(cliffsLine('slip', 1));
    expect(cliffsLine('slip', 2)).toBe(cliffsLine('slip', 0));
  });
});

describe('the Cliffs on the map', () => {
  it('is playable from the hub, leads back to it, and opens once letters are learned', () => {
    expect(SCENE_ROUTES.cliffs).toBe('cliffs');
    expect(playableRegions().has('cliffs')).toBe(true);
    expect(PARENT.cliffs).toBe('hub');
    expect(REGIONS.find((r) => r.id === 'cliffs')?.act).toBe(1);
  });
});
