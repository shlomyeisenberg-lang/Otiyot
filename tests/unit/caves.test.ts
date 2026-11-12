import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, DIFFICULTY_IDS } from '../../src/game/difficulty';
import { LEVEL_IDS, LEVELS } from '../../src/game/levels';
import { THEME_IDS, THEMES } from '../../src/audio/themes';
import { AMBIENCE_IDS } from '../../src/audio/ambience';
import { SFX_NAMES } from '../../src/audio/sfx';
import { REGIONS } from '../../src/game/regions';
import {
  BURN_WPM,
  burnRate,
  CALM_FLOOR,
  CHAMBERS_PER_LEVEL,
  chamberAt,
  chamberChars,
  chapterAt,
  chapterStartsAt,
  colorShare,
  KEY_GAIN,
  Lantern,
  LANTERN_START,
  lampsLit,
  LOOK_BRIGHT,
  LOOK_DIM,
  LOOK_FULL,
  lookaheadAt,
  NICHE_GAIN,
  PASSAGE_WORDS,
  PERFECT_GAIN,
  planCaves,
  RELIGHT,
  RELIGHT_SLOW,
  SHADOW_FAR,
  SHADOW_NEAR,
  shadowReach,
  SLIP,
  STREAK_GAIN,
  STREAK_STEP,
  walkAim,
  wordsAhead,
  type CavesPlan,
} from '../../src/scenes/caves/plan';
import { CAVES_LINES, cavesLine } from '../../src/story';
import { PARENT } from '../../src/ui/app';
import { playableRegions, SCENE_ROUTES } from '../../src/ui/playable';
import en from '../../locales/en.json';
import he from '../../locales/he.json';

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
let seed = 1;
const rng = (): number => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};

function plan(
  level: keyof typeof LEVELS = 'standard',
  letters = LETTERS + 'hgt',
  difficulty = steady,
  extra: string[] = [],
): CavesPlan {
  return planCaves({
    keys: keysOf(letters),
    level: LEVELS[level],
    difficulty,
    words: wordSource(extra),
    rng,
  });
}

describe('the run', () => {
  it('has one passage for every chamber, on every level', () => {
    for (const id of LEVEL_IDS) {
      const p = plan(id);
      expect(p.chambers.length).toBe(CHAMBERS_PER_LEVEL[id]);
      const [lo, hi] = PASSAGE_WORDS[id];
      p.chambers.forEach((c, i) => {
        expect(c.index).toBe(i);
        expect(c.to - c.from).toBeGreaterThanOrEqual(lo);
        expect(c.to - c.from).toBeLessThanOrEqual(hi);
      });
      expect(p.chambers[0]?.from).toBe(0);
      expect(p.chambers.at(-1)?.to).toBe(p.words.length);
      for (let i = 1; i < p.chambers.length; i++)
        expect(p.chambers[i]?.from).toBe(p.chambers[i - 1]?.to);
      expect(p.text).toBe(p.words.join(' '));
      expect(p.level).toBe(id);
    }
  });

  it('uses only learned keys on every level and difficulty, whatever the source offers', () => {
    const bad = ['zebra', 'qq', 'hello world', '', 'fl!ask', 'שלום', 'Salad'];
    for (const level of LEVEL_IDS) {
      for (const d of DIFFICULTY_IDS) {
        for (const letters of [LETTERS, LETTERS + 'gh', 'asd']) {
          const keys = keysOf(letters);
          const p = planCaves({
            keys,
            level: LEVELS[level],
            difficulty: DIFFICULTIES[d],
            words: wordSource(bad),
            rng,
          });
          expect(p.words.length).toBeGreaterThan(0);
          for (const ch of p.text) expect(keys.has(ch), ch).toBe(true);
        }
      }
    }
  });

  it('uses only learned Hebrew letters too', () => {
    const keys = new Set('שדגכעיחלךהםבו '.split(''));
    const words = {
      next: (): string =>
        ['שדה', 'גשם', 'דג', 'כלב', 'חלב', 'שלום', 'abc'][Math.floor(rng() * 7)] as string,
    };
    for (const level of LEVEL_IDS) {
      const p = planCaves({ keys, level: LEVELS[level], difficulty: calm, words, rng });
      expect(p.words.length).toBeGreaterThan(0);
      for (const ch of p.text) expect(keys.has(ch), ch).toBe(true);
    }
  });

  it('never repeats a word twice in a row and has no empty word', () => {
    for (const id of LEVEL_IDS) {
      const p = plan(id);
      for (let i = 0; i < p.words.length; i++) {
        expect(p.words[i]?.length).toBeGreaterThan(0);
        if (i > 0) expect(p.words[i]).not.toBe(p.words[i - 1]);
      }
    }
  });

  it('gives up gracefully when no word can be spelled (never loops forever)', () => {
    const p = planCaves({
      keys: keysOf('q'),
      level: LEVELS.easy,
      difficulty: calm,
      words: wordSource(),
      rng,
    });
    expect(p.words).toEqual([]);
    expect(p.chambers).toEqual([]);
    expect(p.text).toBe('');
    expect(chamberAt(p, 0)).toBe(-1);
  });

  it('copes with a single learned word (it may repeat, but never side by side)', () => {
    const p = planCaves({
      keys: keysOf('dag'),
      level: LEVELS.easy,
      difficulty: calm,
      words: { next: () => 'dag' },
      rng,
    });
    // One word only: it can never follow itself, so each chamber holds a single word.
    expect(p.words.length).toBeGreaterThan(0);
    for (let i = 1; i < p.words.length; i++) expect(p.words[i]).not.toBe(p.words[i - 1]);
  });

  it('has chapters that cover the run in order: the mouth, the galleries, the hall', () => {
    for (const id of LEVEL_IDS) {
      const p = plan(id);
      expect(p.chapters.map((c) => c.id)).toEqual(['mouth', 'galleries', 'hall']);
      expect(p.chapters[0]?.from).toBe(0);
      expect(p.chapters.at(-1)?.to).toBe(p.words.length);
      expect(chapterAt(p, 0)).toBe('mouth');
      expect(chapterAt(p, p.words.length)).toBe('hall');
      expect(chapterStartsAt(p, p.chapters[1]?.from ?? -1)).toBe('galleries');
      expect(chapterStartsAt(p, 1)).toBe(null);
    }
  });

  it('finds the chamber of every word, and counts the characters each asks for', () => {
    const p = plan('hard');
    for (const c of p.chambers) {
      expect(chamberAt(p, c.from)).toBe(c.index);
      expect(chamberAt(p, c.to - 1)).toBe(c.index);
    }
    expect(chamberAt(p, 9999)).toBe(p.chambers.length - 1);
    let sum = 0;
    for (let i = 0; i < p.chambers.length; i++) sum += chamberChars(p, i);
    expect(sum).toBe(p.text.length);
    expect(chamberChars(p, 99)).toBe(1);
  });

  it('burns down only on difficulties with timers, faster on harder ones', () => {
    for (const id of LEVEL_IDS) {
      const p = plan(id, LETTERS, calm);
      expect(p.timers).toBe(false);
      expect(p.burn).toBe(0);
      expect(p.slip).toBe(SLIP.calm);
    }
    const s = burnRate(steady, LEVELS.standard);
    const f = burnRate(DIFFICULTIES.fierce, LEVELS.standard);
    expect(s).toBeGreaterThan(0);
    expect(f).toBeGreaterThan(s);
    expect(burnRate(steady, LEVELS.hard)).toBeGreaterThan(burnRate(steady, LEVELS.easy));
    expect(SLIP.fierce).toBeGreaterThan(SLIP.steady);
  });
});

describe('the lantern', () => {
  it('is fed by right letters and flares on every clean streak', () => {
    const l = new Lantern();
    l.reset(0, true);
    expect(l.light).toBe(LANTERN_START);
    expect(l.key(true, 0.15)).toBe('none');
    expect(l.light).toBeCloseTo(LANTERN_START + KEY_GAIN);
    for (let i = 1; i < STREAK_STEP - 1; i++) l.key(true, 0.15);
    const before = l.light;
    expect(l.key(true, 0.15)).toBe('flare');
    expect(l.light).toBeCloseTo(Math.min(1, before + KEY_GAIN + STREAK_GAIN));
    expect(l.flares).toBe(1);
    for (let i = 0; i < 200; i++) l.key(true, 0.15);
    expect(l.light).toBe(1);
  });

  it('dims on a stumble, breaks the streak, and the shadows creep in', () => {
    const l = new Lantern();
    l.reset(0.01, false);
    for (let i = 0; i < 5; i++) l.key(true, 0.15);
    const before = l.light;
    expect(l.key(false, 0.15)).toBe('creep');
    expect(l.streak).toBe(0);
    expect(l.light).toBeCloseTo(before - 0.15);
    expect(shadowReach(l.light)).toBeLessThan(shadowReach(before));
  });

  it('on Calm never burns down and never goes out, however many stumbles', () => {
    const l = new Lantern();
    l.reset(0, true);
    l.key(true, SLIP.calm);
    for (let i = 0; i < 100; i++) expect(l.key(false, SLIP.calm)).toBe('creep');
    expect(l.light).toBe(CALM_FLOOR);
    expect(l.step(1000)).toBe('none');
    expect(l.outs).toBe(0);
  });

  it('waits for the first key of a passage before it burns', () => {
    const l = new Lantern();
    l.reset(0.05, false);
    l.step(10);
    expect(l.light).toBe(LANTERN_START);
    l.key(true, 0.15);
    const lit = l.light;
    l.step(0.2);
    expect(l.light).toBeCloseTo(lit - 0.05 * 0.2);
    l.chamber(0.05);
    expect(l.released).toBe(false);
    const now = l.light;
    l.step(5);
    expect(l.light).toBe(now);
  });

  it('goes out once, is struck alight again, and burns slower after', () => {
    const l = new Lantern();
    l.reset(0.1, false);
    l.key(true, 0.15);
    let outs = 0;
    for (let i = 0; i < 400 && outs === 0; i++) if (l.step(0.1) === 'out') outs += 1;
    expect(outs).toBe(1);
    expect(l.outs).toBe(1);
    expect(l.outsHere).toBe(1);
    expect(l.light).toBe(RELIGHT);
    expect(l.rate).toBeCloseTo(0.1 / RELIGHT_SLOW);
    // A stumble at the very bottom also puts it out.
    l.light = 0.05;
    expect(l.key(false, 0.15)).toBe('out');
    expect(l.outs).toBe(2);
    l.chamber(0.1);
    expect(l.outsHere).toBe(0);
  });

  it('is fair: a typist at the difficulty pace, without slips, keeps it alight', () => {
    for (const d of DIFFICULTY_IDS) {
      if (!DIFFICULTIES[d].timers) continue;
      for (const id of LEVEL_IDS) {
        const l = new Lantern();
        l.reset(burnRate(DIFFICULTIES[d], LEVELS[id]), false);
        const cps = (BURN_WPM[d] * 5) / 60;
        let acc = 0;
        for (let t = 0; t < 120; t += 0.05) {
          acc += cps * 0.05;
          while (acc >= 1) {
            acc -= 1;
            l.key(true, SLIP[d]);
          }
          expect(l.step(0.05)).toBe('none');
        }
        expect(l.outs).toBe(0);
        expect(l.light).toBeGreaterThan(LOOK_FULL);
      }
    }
  });

  it('is topped up by a niche lamp and by a perfect word, never past full', () => {
    const l = new Lantern();
    l.reset(0, true);
    l.topUp();
    expect(l.light).toBeCloseTo(Math.min(1, LANTERN_START + NICHE_GAIN));
    l.light = 0.5;
    l.perfect();
    expect(l.light).toBeCloseTo(0.5 + PERFECT_GAIN);
    l.topUp();
    l.topUp();
    expect(l.light).toBe(1);
  });

  it('copes with odd numbers', () => {
    const l = new Lantern();
    l.reset(Number.NaN, false);
    expect(l.rate).toBe(0);
    expect(l.calm).toBe(true);
    l.reset(-3, false);
    expect(l.rate).toBe(0);
    expect(l.step(Number.NaN)).toBe('none');
    expect(l.step(-1)).toBe('none');
  });
});

describe('the shadows and the light', () => {
  it('stand far off when the light is full and close when it is out', () => {
    expect(shadowReach(1)).toBe(SHADOW_FAR);
    expect(shadowReach(0)).toBe(SHADOW_NEAR);
    let last = -Infinity;
    for (let l = 0; l <= 1.0001; l += 0.1) {
      const r = shadowReach(l);
      expect(r).toBeGreaterThanOrEqual(last);
      last = r;
    }
    expect(shadowReach(5)).toBe(SHADOW_FAR);
    expect(shadowReach(Number.NaN)).toBe(SHADOW_NEAR);
  });

  it('lets a bright lantern read ahead, a dim one less, a guttering one not at all (but Easy)', () => {
    for (const id of LEVEL_IDS) {
      expect(lookaheadAt(1, id)).toBe(LOOK_BRIGHT[id]);
      expect(lookaheadAt(LOOK_FULL, id)).toBe(LOOK_BRIGHT[id]);
      expect(lookaheadAt(LOOK_DIM, id)).toBe(1);
      expect(lookaheadAt(0.1, id)).toBe(id === 'easy' ? 1 : 0);
      expect(lookaheadAt(Number.NaN, id)).toBe(id === 'easy' ? 1 : 0);
    }
  });

  it('shows the words after the one in hand, never past the end', () => {
    const p = plan('standard');
    expect(wordsAhead(p, 0, 1)).toEqual(p.words.slice(1, 1 + LOOK_BRIGHT.standard));
    expect(wordsAhead(p, 0, 0.5)).toEqual(p.words.slice(1, 2));
    expect(wordsAhead(p, 0, 0)).toEqual([]);
    expect(wordsAhead(p, p.words.length - 1, 1)).toEqual([]);
  });
});

describe('the lamps', () => {
  it('brings the color back and counts the lamps lit', () => {
    expect(colorShare(0, 10)).toBe(0);
    expect(colorShare(5, 10)).toBe(0.5);
    expect(colorShare(12, 10)).toBe(1);
    expect(colorShare(0, 0)).toBe(1);
    const p = plan('easy');
    expect(lampsLit(p, 0)).toBe(0);
    expect(lampsLit(p, p.chambers[0]?.to ?? 0)).toBe(1);
    expect(lampsLit(p, p.words.length)).toBe(p.chambers.length);
    expect(walkAim(5, 10)).toBe(0.5);
    expect(walkAim(20, 10)).toBe(1);
    expect(walkAim(1, 0)).toBe(1);
  });
});

describe('the Lantern Caves on the map', () => {
  it('is a region with a screen, a route, a theme and sounds of its own', () => {
    expect(REGIONS.find((r) => r.id === 'caves')?.act).toBe(3);
    expect(SCENE_ROUTES.caves).toBe('caves');
    expect(PARENT.caves).toBe('hub');
    expect(playableRegions()).toContain('caves');
    expect(THEME_IDS).toContain('caves');
    expect(THEMES.caves.voices.melody).toBe('kalimba');
    expect(THEMES.caves.pulse.length).toBe(THEMES.caves.beats * THEMES.caves.sub);
    expect(AMBIENCE_IDS).toContain('cave');
    for (const s of ['flare', 'creep', 'lamp']) expect(SFX_NAMES).toContain(s);
  });

  it('has every one of its words in English and Hebrew', () => {
    const keys = Object.keys(en).filter((k) => k.startsWith('caves.') || k.endsWith('.caves'));
    expect(keys.length).toBeGreaterThan(20);
    for (const k of keys) expect((he as Record<string, string>)[k], k).toBeTruthy();
  });
});

describe('what Reb Ezra and Dyo say', () => {
  it('has Hebrew and English for every moment, and only men or Dyo speak', () => {
    for (const lines of Object.values(CAVES_LINES)) {
      expect(lines.length).toBeGreaterThan(0);
      for (const l of lines) {
        expect(['ezra', 'dyo']).toContain(l.who);
        expect(l.text.he.length).toBeGreaterThan(5);
        expect(l.text.en.length).toBeGreaterThan(5);
        expect(/[֐-׿]/.test(l.text.he)).toBe(true);
      }
    }
  });

  it('keeps the story clean and gentle: nothing about women, nothing suggestive or gory', () => {
    const all = Object.values(CAVES_LINES)
      .flat()
      .map((l) => `${l.text.en} ${l.text.he}`)
      .join(' ');
    expect(all).not.toMatch(/\b(she|her|woman|women|girl|lady|wife|kiss|love|sexy)\b/i);
    expect(all).not.toMatch(/\b(blood|kill|dead|die|monster|scream)\b/i);
    expect(all).not.toMatch(/יהוה|אלוהים/);
  });

  it('picks a line by counter and wraps around', () => {
    const lines = CAVES_LINES.out;
    expect(cavesLine('out', 0)).toBe(lines[0]);
    expect(cavesLine('out', lines.length)).toBe(lines[0]);
    expect(cavesLine('out', -1)).toBe(lines[1 % lines.length]);
  });
});
