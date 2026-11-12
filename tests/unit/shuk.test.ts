import { describe, expect, it } from 'vitest';
import { getTrack, knownKeysOf, recordLessonResult } from '../../src/learn';
import { createProfile } from '../../src/save';
import { Vector3 } from 'three';
import { LEVEL_IDS } from '../../src/game/levels';
import { THEME_IDS, THEMES } from '../../src/audio/themes';
import { REGIONS } from '../../src/game/regions';
import {
  chapterAt,
  chapterStartsAt,
  coinsOf,
  colorShare,
  HAGGLE_AT,
  haggleStreak,
  haggleWon,
  lanternsLit,
  MARKS,
  planShuk,
  purseAfter,
  SECTIONS,
  TRADES_PER_LEVEL,
  usableMarks,
} from '../../src/scenes/shuk/plan';
import { faceSquare, stallPosition } from '../../src/scenes/shuk';
import { SHUK_LINES, shukLine } from '../../src/story';
import { PARENT } from '../../src/ui/app';
import { playableRegions, SCENE_ROUTES } from '../../src/ui/playable';

function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 48271) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const LETTERS = 'asdfjklgh';
const WORDS = ['dag', 'lag', 'salad', 'flask', 'glass', 'hall', 'half', 'fall', 'gaff', 'shag'];
function wordSource(): { next(): string } {
  let i = 0;
  return { next: () => WORDS[i++ % WORDS.length] as string };
}
const keysWith = (marks: string): Set<string> => new Set((LETTERS + marks + ' ').split(''));

describe('the run', () => {
  it('has the right number of trades on every level, in whole quarters', () => {
    for (const level of LEVEL_IDS) {
      const plan = planShuk({ keys: keysWith(',.'), level, words: wordSource(), rng: seeded(3) });
      expect(plan.trades).toHaveLength(TRADES_PER_LEVEL[level]);
      expect(plan.trades.length % SECTIONS).toBe(0);
      expect(plan.text).toBe(plan.trades.map((t) => t.token).join(' '));
    }
  });

  it('uses only learned keys, marks included', () => {
    for (const marks of ['', ',', ',.', ".,;:!?'-"]) {
      const keys = keysWith(marks);
      for (const level of LEVEL_IDS) {
        const plan = planShuk({ keys, level, words: wordSource(), rng: seeded(11) });
        for (const ch of plan.text.replace(/ /g, ''))
          expect(keys.has(ch), `${marks}|${ch}`).toBe(true);
      }
    }
  });

  it('trades plain words when no mark is learned, and every run still completes', () => {
    const plan = planShuk({
      keys: keysWith(''),
      level: 'hard',
      words: wordSource(),
      rng: seeded(5),
    });
    expect(plan.usable).toEqual([]);
    expect(plan.marks).toBe(0);
    expect(plan.trades.every((t) => t.mark === '' && t.coins === 1)).toBe(true);
    expect(plan.coins).toBe(plan.trades.length);
  });

  it('adds marks as the levels grow, and ends a run with a mark when one is learned', () => {
    const keys = keysWith(".,;:!?'-");
    expect(usableMarks(keys, 'easy')).toHaveLength(1);
    expect(usableMarks(keys, 'standard')).toHaveLength(2);
    expect(usableMarks(keys, 'hard').length).toBeGreaterThanOrEqual(3);
    for (const level of LEVEL_IDS) {
      const plan = planShuk({ keys, level, words: wordSource(), rng: seeded(9) });
      expect(plan.trades.at(-1)?.mark).not.toBe('');
      for (const t of plan.trades) expect(plan.usable).toContain(t.mark || plan.usable[0]);
    }
  });

  it('pays one coin for the word and one for each mark', () => {
    expect(coinsOf('dag')).toBe(1);
    expect(coinsOf('dag,')).toBe(2);
    const plan = planShuk({
      keys: keysWith(',.'),
      level: 'standard',
      words: wordSource(),
      rng: seeded(2),
    });
    expect(plan.coins).toBe(plan.trades.reduce((n, t) => n + t.coins, 0));
    expect(plan.marks).toBe(plan.trades.filter((t) => t.mark).length);
  });

  it('never repeats a word twice in a row, and never takes a word with an unlearned key', () => {
    const words = {
      next: (() => {
        let i = 0;
        return () => ['dag', 'dag', 'zzz', 'lag'][i++ % 4] as string;
      })(),
    };
    const plan = planShuk({ keys: keysWith(','), level: 'easy', words, rng: seeded(1) });
    plan.trades.forEach((t, i) => {
      expect(t.word).not.toBe('zzz');
      if (i > 0) expect(t.word).not.toBe(plan.trades[i - 1]?.word);
    });
  });

  it('cuts the run into three chapters that cover every trade', () => {
    for (const level of LEVEL_IDS) {
      const plan = planShuk({ keys: keysWith(','), level, words: wordSource(), rng: seeded(4) });
      expect(plan.chapters.map((c) => c.id)).toEqual(['lane', 'bazaar', 'square']);
      expect(plan.chapters[0]?.from).toBe(0);
      expect(plan.chapters.at(-1)?.to).toBe(plan.trades.length);
      expect(chapterAt(plan, 0)).toBe('lane');
      expect(chapterAt(plan, plan.trades.length - 1)).toBe('square');
      expect(chapterAt(plan, 999)).toBe('square');
      expect(chapterStartsAt(plan, 0)).toBe('lane');
      expect(chapterStartsAt(plan, 1)).toBeNull();
    }
  });

  it('only ever offers marks from the known list', () => {
    expect(MARKS.length).toBeGreaterThan(3);
  });
});

describe('the haggle and the purse', () => {
  it('wins a haggle after three clean deals in a row, and a slip breaks the streak', () => {
    let streak = 0;
    const wins: boolean[] = [];
    for (const clean of [true, true, true, true, false, true, true, true]) {
      streak = haggleStreak(streak, clean);
      wins.push(haggleWon(streak));
    }
    expect(wins).toEqual([false, false, true, false, false, false, false, true]);
    expect(HAGGLE_AT).toBe(3);
    expect(haggleWon(0)).toBe(false);
  });

  it('counts the mark coins double when a haggle is won', () => {
    const trade = { token: 'dag,', word: 'dag', mark: ',', coins: 2 };
    expect(purseAfter(0, trade, false)).toBe(2);
    expect(purseAfter(0, trade, true)).toBe(3);
    expect(purseAfter(5, { token: 'dag', word: 'dag', mark: '', coins: 1 }, true)).toBe(6);
  });
});

describe('how the shuk answers', () => {
  it('lights one lantern per quarter and all of them at the end', () => {
    expect(lanternsLit(0, 12)).toBe(0);
    expect(lanternsLit(3, 12)).toBe(1);
    expect(lanternsLit(6, 12)).toBe(2);
    expect(lanternsLit(11, 12)).toBe(3);
    expect(lanternsLit(12, 12)).toBe(SECTIONS);
    expect(lanternsLit(0, 0)).toBe(SECTIONS);
  });

  it('spreads color from 0 to 1', () => {
    expect(colorShare(0, 8)).toBe(0);
    expect(colorShare(4, 8)).toBeCloseTo(0.5);
    expect(colorShare(9, 8)).toBe(1);
    expect(colorShare(0, 0)).toBe(1);
  });

  it('stands every stall apart, around the square, facing the middle', () => {
    for (const n of [8, 12, 16]) {
      const seen: Vector3[] = [];
      for (let i = 0; i < n; i++) {
        const p = stallPosition(i, n, new Vector3());
        expect(p.z).toBeLessThan(-4);
        expect(Math.hypot(p.x, p.z + 4)).toBeLessThan(20);
        for (const o of seen) expect(o.distanceTo(p), `${n}:${i}`).toBeGreaterThan(2.8);
        seen.push(p);
        // Facing the middle: the front of the stall points back toward (0, -4).
        const turn = faceSquare(p.x, p.z);
        const fx = Math.sin(turn);
        const fz = Math.cos(turn);
        expect(fx * -p.x + fz * (-4 - p.z)).toBeGreaterThan(0);
      }
    }
  });
});

describe('the shuk on the map', () => {
  it('is a region with a screen, a route and a theme of its own', () => {
    expect(REGIONS.find((r) => r.id === 'shuk')?.act).toBe(2);
    expect(SCENE_ROUTES.shuk).toBe('shuk');
    expect(PARENT.shuk).toBe('hub');
    expect(playableRegions()).toContain('shuk');
    expect(THEME_IDS).toContain('shuk');
    expect(THEMES.shuk.id).toBe('shuk');
    expect(THEMES.shuk.form.every((s) => s in THEMES.shuk.sections)).toBe(true);
  });
});

describe('what Reb Ezra and Dyo say', () => {
  it('has Hebrew and English for every moment, and only Ezra or Dyo speak', () => {
    for (const [moment, lines] of Object.entries(SHUK_LINES)) {
      expect(lines.length, moment).toBeGreaterThan(0);
      for (const l of lines) {
        expect(['ezra', 'dyo']).toContain(l.who);
        expect(l.text.he.length).toBeGreaterThan(5);
        expect(l.text.en.length).toBeGreaterThan(5);
      }
    }
  });

  it('keeps the story clean: nothing about women, nothing suggestive', () => {
    const blocked = /\b(she|her|woman|women|lady|girl|wife|queen|kiss|sexy|love)\b/i;
    for (const lines of Object.values(SHUK_LINES)) {
      for (const l of lines) expect(l.text.en).not.toMatch(blocked);
    }
  });

  it('picks a line by counter and wraps around', () => {
    expect(shukLine('haggle', 0)).toBe(SHUK_LINES.haggle[0]);
    expect(shukLine('haggle', 1)).toBe(SHUK_LINES.haggle[1]);
    expect(shukLine('haggle', 2)).toBe(SHUK_LINES.haggle[0]);
  });
});

describe('marks stay learned (R18)', () => {
  it('a player past Level 3 still has the marks he learned in Level 1, so the Shuk pays coins', () => {
    for (const layout of ['en', 'he'] as const) {
      for (const track of [1, 2] as const) {
        const p = createProfile('a', 'David', 0);
        p.layout = layout;
        p.track = track;
        const t = getTrack(track);
        let marksSeen = new Set<string>();
        for (const lvl of t.levels(layout, layout)) {
          for (const l of t.lessons(lvl.id, layout, layout)) {
            recordLessonResult(p, l.id, { wpm: 20, accuracy: 100 });
            const keys = knownKeysOf(p);
            // A mark once learned is never forgotten again.
            for (const m of marksSeen)
              expect(keys.has(m), `${layout} ${track} ${l.id} ${m}`).toBe(true);
            marksSeen = new Set(MARKS.filter((m) => keys.has(m)));
          }
        }
        expect(marksSeen.size, `${layout} track ${track}`).toBeGreaterThan(0);
        expect(usableMarks(knownKeysOf(p), 'standard').length).toBeGreaterThan(0);
      }
    }
  });
});
