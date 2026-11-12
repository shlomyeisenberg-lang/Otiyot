import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, DIFFICULTY_IDS } from '../../src/game/difficulty';
import { LEVEL_IDS, LEVELS } from '../../src/game/levels';
import { THEME_IDS, THEMES } from '../../src/audio/themes';
import { REGIONS } from '../../src/game/regions';
import {
  breaksOpen,
  CALM_HOLD,
  capitalized,
  caughtPercent,
  chapterAt,
  chapterStartsAt,
  colorShare,
  fallSeconds,
  flashGap,
  FLASH_GAP_MAX,
  FLASH_GAP_MIN,
  Hail,
  KNOCKBACK,
  KNOCK_SLOW,
  MIN_FALL_S,
  planHermon,
  REVEAL_FADE,
  REVEAL_HOLD,
  revealOf,
  SECTIONS,
  STONES_PER_LEVEL,
  stormAt,
} from '../../src/scenes/hermon/plan';
import { HERMON_LINES, hermonLine } from '../../src/story';
import { PARENT } from '../../src/ui/app';
import { playableRegions, SCENE_ROUTES } from '../../src/ui/playable';

const LETTERS = 'asdfjkl';
const WORDS = ['dag', 'lag', 'salad', 'flask', 'ask', 'fall', 'dad', 'sad', 'flash', 'ska'];
function wordSource(extra: string[] = []): { next(): string } {
  const all = [...extra, ...WORDS];
  let i = 0;
  return { next: () => all[i++ % all.length] as string };
}
const keysOf = (letters: string): Set<string> => new Set((letters + ' ').split(''));
const calm = DIFFICULTIES.calm;
const steady = DIFFICULTIES.steady;

describe('the run', () => {
  it('has the right number of stones on every level, in whole thirds', () => {
    for (const id of LEVEL_IDS) {
      const plan = planHermon({
        keys: keysOf(LETTERS),
        level: LEVELS[id],
        difficulty: steady,
        words: wordSource(),
      });
      expect(plan.stones).toHaveLength(STONES_PER_LEVEL[id]);
      expect(plan.stones.length % SECTIONS).toBe(0);
      expect(plan.text).toBe(plan.stones.map((s) => s.word).join(' '));
      expect(plan.level).toBe(id);
    }
  });

  it('uses only learned letters on every level and difficulty, whatever the source offers', () => {
    for (const letters of ['asdfjkl', 'asdf', 'dafsl']) {
      const keys = keysOf(letters);
      for (const id of LEVEL_IDS) {
        for (const d of DIFFICULTY_IDS) {
          const plan = planHermon({
            keys,
            level: LEVELS[id],
            difficulty: DIFFICULTIES[d],
            words: wordSource(['qwerty', 'ghost', 'Zebra', 'a b', 'Flask']),
          });
          for (const ch of plan.text.replace(/ /g, ''))
            expect(keys.has(ch), `${letters}|${ch}`).toBe(true);
          expect(plan.text).not.toMatch(/[qwertyzbghoeA-Z]/);
        }
      }
    }
  });

  it('uses only learned Hebrew letters too', () => {
    const keys = keysOf('שדגכע');
    const words = wordSource(['שלום', 'דג', 'גד', 'כעס', 'שד', 'עג']);
    const plan = planHermon({ keys, level: LEVELS.hard, difficulty: steady, words });
    expect(plan.stones.length).toBeGreaterThan(0);
    for (const ch of plan.text.replace(/ /g, '')) expect(keys.has(ch), ch).toBe(true);
  });

  it('never repeats a word twice in a row and has no empty stone', () => {
    const plan = planHermon({
      keys: keysOf(LETTERS),
      level: LEVELS.hard,
      difficulty: steady,
      words: wordSource(['dad', 'dad', 'dad']),
    });
    for (let i = 1; i < plan.stones.length; i++) {
      expect(plan.stones[i]?.word).not.toBe(plan.stones[i - 1]?.word);
    }
    for (const s of plan.stones) expect(s.word.length).toBeGreaterThan(0);
  });

  it('gives up gracefully when no word can be spelled (never loops forever)', () => {
    const plan = planHermon({
      keys: keysOf('x'),
      level: LEVELS.easy,
      difficulty: calm,
      words: wordSource(),
    });
    expect(plan.stones).toHaveLength(0);
    expect(plan.text).toBe('');
    expect(plan.chapters).toHaveLength(0);
  });

  it('has three chapters that cover the run in order', () => {
    for (const id of LEVEL_IDS) {
      const plan = planHermon({
        keys: keysOf(LETTERS),
        level: LEVELS[id],
        difficulty: calm,
        words: wordSource(),
      });
      expect(plan.chapters.map((c) => c.id)).toEqual(['gathering', 'heart', 'summit']);
      expect(plan.chapters[0]?.from).toBe(0);
      expect(plan.chapters.at(-1)?.to).toBe(plan.stones.length);
      for (let i = 1; i < plan.chapters.length; i++)
        expect(plan.chapters[i]?.from).toBe(plan.chapters[i - 1]?.to);
      expect(chapterAt(plan, 0)).toBe('gathering');
      expect(chapterAt(plan, plan.stones.length)).toBe('summit');
      expect(chapterStartsAt(plan, plan.chapters[1]?.from ?? -1)).toBe('heart');
      expect(chapterStartsAt(plan, 1)).toBeNull();
    }
  });
});

describe('words and capitals', () => {
  it('capitalizes only when the capital itself has been learned', () => {
    expect(capitalized('flask', keysOf(LETTERS))).toBe('flask');
    expect(capitalized('flask', keysOf(LETTERS + 'F'))).toBe('Flask');
    expect(capitalized('שלום', keysOf('שלום'))).toBe('שלום');
    expect(capitalized('', keysOf(LETTERS))).toBe('');
  });

  it('puts capitals over the summit on Hard, and only with learned capitals', () => {
    const keys = keysOf(LETTERS + 'ADFJKLS');
    const plan = planHermon({
      keys,
      level: LEVELS.hard,
      difficulty: steady,
      words: wordSource(),
    });
    const summit = plan.chapters.find((c) => c.id === 'summit');
    expect(summit).toBeDefined();
    const caps = plan.stones.filter((s) => /^[A-Z]/.test(s.word));
    expect(caps.length).toBeGreaterThan(0);
    plan.stones.forEach((s, i) => {
      if (/^[A-Z]/.test(s.word)) expect(i).toBeGreaterThanOrEqual(summit?.from ?? 0);
    });
    for (const ch of plan.text.replace(/ /g, '')) expect(keys.has(ch), ch).toBe(true);
    // Not on the easier levels.
    for (const id of ['easy', 'standard'] as const) {
      const easier = planHermon({
        keys,
        level: LEVELS[id],
        difficulty: steady,
        words: wordSource(),
      });
      expect(easier.text).not.toMatch(/[A-Z]/);
    }
  });
});

describe('the fall', () => {
  it('has no timer on Calm, and a timer on every other difficulty', () => {
    expect(fallSeconds('flask', calm, LEVELS.easy)).toBeNull();
    for (const d of DIFFICULTY_IDS.filter((x) => x !== 'calm')) {
      const s = fallSeconds('flask', DIFFICULTIES[d], LEVELS.standard);
      expect(s).not.toBeNull();
      expect(s as number).toBeGreaterThanOrEqual(MIN_FALL_S);
    }
    const plan = planHermon({
      keys: keysOf(LETTERS),
      level: LEVELS.easy,
      difficulty: calm,
      words: wordSource(),
    });
    expect(plan.timers).toBe(false);
    for (const s of plan.stones) expect(s.fall).toBeNull();
  });

  it('gives longer words more time, and harder difficulties and levels less', () => {
    const short = fallSeconds('ask', steady, LEVELS.standard) as number;
    const long = fallSeconds('salads', steady, LEVELS.standard) as number;
    expect(long).toBeGreaterThan(short);
    const fierce = fallSeconds('salads', DIFFICULTIES.fierce, LEVELS.standard) as number;
    expect(fierce).toBeLessThan(long);
    const hard = fallSeconds('salads', steady, LEVELS.hard) as number;
    expect(hard).toBeLessThan(long);
  });

  it('is fair: a typist at the difficulty pace finishes before the stone lands', () => {
    for (const d of ['steady', 'swift', 'fierce', 'trial'] as const) {
      for (const word of ['as', 'flask', 'salads']) {
        const fall = fallSeconds(word, DIFFICULTIES[d], LEVELS.hard) as number;
        const wpm = { steady: 9, swift: 16, fierce: 24, trial: 14 }[d];
        const typing = ((word.length + 1) * 12) / wpm;
        expect(fall, `${d} ${word}`).toBeGreaterThan(typing);
      }
    }
  });
});

describe('a hailstone', () => {
  it('waits at the top until the run begins', () => {
    const h = new Hail();
    h.start(4);
    for (let i = 0; i < 100; i++) expect(h.step(0.1)).toBe('waiting');
    expect(h.height).toBe(1);
  });

  it('on Calm comes down to its hold and waits there forever', () => {
    const h = new Hail();
    h.start(null);
    h.release();
    let last = h.height;
    for (let i = 0; i < 2000; i++) {
      const s = h.step(0.05);
      expect(s).not.toBe('struck');
      expect(h.height).toBeLessThanOrEqual(last);
      last = h.height;
    }
    expect(h.height).toBe(CALM_HOLD);
    expect(h.step(0.05)).toBe('held');
    expect(h.strikes).toBe(0);
  });

  it('falls in its time, strikes once, is thrown back up and falls slower', () => {
    const h = new Hail();
    h.start(4);
    h.release();
    let t = 0;
    let s = h.step(0);
    while (s !== 'struck') {
      s = h.step(0.01);
      t += 0.01;
      expect(t).toBeLessThan(4.2);
    }
    expect(t).toBeGreaterThan(3.9);
    expect(h.strikes).toBe(1);
    expect(h.height).toBe(KNOCKBACK);
    expect(h.fall).toBeCloseTo(4 * KNOCK_SLOW);
    // The rest of the way takes longer than the same distance did the first time.
    let t2 = 0;
    while (h.step(0.01) !== 'struck') t2 += 0.01;
    expect(t2).toBeGreaterThan(4 * KNOCKBACK);
    expect(h.strikes).toBe(2);
  });

  it('starts every stone fresh, and a reset waits for the run again', () => {
    const h = new Hail();
    h.start(2);
    h.release();
    for (let i = 0; i < 300; i++) h.step(0.01);
    expect(h.strikes).toBeGreaterThan(0);
    h.start(3);
    expect(h.height).toBe(1);
    expect(h.strikes).toBe(0);
    expect(h.released).toBe(true);
    h.reset();
    expect(h.released).toBe(false);
    expect(h.step(1)).toBe('waiting');
  });
});

describe('lightning and the storm', () => {
  it('flashes within its gaps, and less often as the storm breaks', () => {
    for (const r of [0, 0.3, 0.7, 1, -1, 2]) {
      const g = flashGap(r, 1);
      expect(g).toBeGreaterThanOrEqual(FLASH_GAP_MIN);
      expect(g).toBeLessThanOrEqual(FLASH_GAP_MAX);
      expect(flashGap(r, 0.2)).toBeGreaterThan(g);
    }
  });

  it('shows the next word for a moment after a flash, then fades', () => {
    expect(revealOf(0)).toBe(1);
    expect(revealOf(REVEAL_HOLD)).toBe(1);
    expect(revealOf(REVEAL_HOLD + REVEAL_FADE / 2)).toBeCloseTo(0.5);
    expect(revealOf(REVEAL_HOLD + REVEAL_FADE + 1)).toBe(0);
    expect(revealOf(-1)).toBe(0);
    expect(revealOf(Number.NaN)).toBe(0);
  });

  it('calms as the stones break, and is gone at the end', () => {
    expect(stormAt(0, 12)).toBe(1);
    let last = 1;
    for (let d = 1; d < 12; d++) {
      const s = stormAt(d, 12);
      expect(s).toBeLessThan(last);
      expect(s).toBeGreaterThan(0);
      last = s;
    }
    expect(stormAt(12, 12)).toBe(0);
    expect(stormAt(0, 0)).toBe(0);
  });

  it('opens the breaks in the clouds third by third, all of them at the end', () => {
    expect(breaksOpen(0, 12)).toBe(0);
    expect(breaksOpen(3, 12)).toBe(0);
    expect(breaksOpen(4, 12)).toBe(1);
    expect(breaksOpen(8, 12)).toBe(2);
    expect(breaksOpen(11, 12)).toBe(2);
    expect(breaksOpen(12, 12)).toBe(SECTIONS);
    expect(breaksOpen(0, 0)).toBe(SECTIONS);
  });

  it('brings the color back with the stones, and counts the ones caught in the air', () => {
    expect(colorShare(0, 9)).toBe(0);
    expect(colorShare(9, 9)).toBe(1);
    expect(colorShare(3, 0)).toBe(1);
    expect(caughtPercent(9, 9)).toBe(100);
    expect(caughtPercent(6, 9)).toBe(67);
    expect(caughtPercent(0, 0)).toBe(100);
  });
});

describe('Wings over Hermon on the map', () => {
  it('is a region with a screen, a route and a theme of its own', () => {
    expect(REGIONS.find((r) => r.id === 'hermon')?.act).toBe(2);
    expect(SCENE_ROUTES.hermon).toBe('hermon');
    expect(PARENT.hermon).toBe('hub');
    expect(playableRegions()).toContain('hermon');
    expect(THEME_IDS).toContain('hermon');
    expect(THEMES.hermon.id).toBe('hermon');
    expect(THEMES.hermon.voices.melody).toBe('horn');
  });
});

describe('what Reb Ezra and Dyo say', () => {
  it('has Hebrew and English for every moment, and only men or Dyo speak', () => {
    for (const lines of Object.values(HERMON_LINES)) {
      expect(lines.length).toBeGreaterThan(0);
      for (const l of lines) {
        expect(['ezra', 'dyo']).toContain(l.who);
        expect(l.text.he.length).toBeGreaterThan(5);
        expect(l.text.en.length).toBeGreaterThan(5);
        expect(/[֐-׿]/.test(l.text.he)).toBe(true);
      }
    }
  });

  it('keeps the story clean: nothing about women, nothing suggestive, no holy Names', () => {
    const all = Object.values(HERMON_LINES)
      .flat()
      .map((l) => `${l.text.en} ${l.text.he}`)
      .join(' ');
    expect(all).not.toMatch(/\b(she|her|woman|women|girl|lady|wife|kiss|love|sexy)\b/i);
    expect(all).not.toMatch(/יהוה|אלוהים/);
  });

  it('picks a line by counter and wraps around', () => {
    const lines = HERMON_LINES.strike;
    expect(hermonLine('strike', 0)).toBe(lines[0]);
    expect(hermonLine('strike', lines.length)).toBe(lines[0]);
    expect(hermonLine('strike', -1)).toBe(lines[1 % lines.length]);
  });
});
