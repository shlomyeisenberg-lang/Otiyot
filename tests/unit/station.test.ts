import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, DIFFICULTY_IDS } from '../../src/game/difficulty';
import { LEVEL_IDS, LEVELS } from '../../src/game/levels';
import { THEME_IDS, THEMES } from '../../src/audio/themes';
import { REGIONS } from '../../src/game/regions';
import {
  approachSeconds,
  BOUNCE,
  BOUNCE_SLOW,
  CALM_HOLD,
  capitalized,
  chapterAt,
  chapterStartsAt,
  clearPercent,
  colorShare,
  Drift,
  driftAim,
  legAt,
  legChars,
  MIN_APPROACH_S,
  MODULES_PER_LEVEL,
  modulesOnline,
  planStation,
  Rock,
  rocksIn,
  SENTENCE_WORDS,
  STARS,
  starsLit,
  stopFor,
  type StationPlan,
} from '../../src/scenes/station/plan';
import { STATION_LINES, stationLine } from '../../src/story';
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
): StationPlan {
  return planStation({
    keys: keysOf(letters),
    level: LEVELS[level],
    difficulty,
    words: wordSource(extra),
    rng,
  });
}

describe('the run', () => {
  it('has a drift and a turret sentence for every module, on every level', () => {
    for (const id of LEVEL_IDS) {
      const p = plan(id);
      expect(p.modules).toBe(MODULES_PER_LEVEL[id]);
      expect(p.legs.length).toBe(MODULES_PER_LEVEL[id] * 2);
      p.legs.forEach((leg, i) => {
        expect(leg.kind).toBe(i % 2 === 0 ? 'drift' : 'turret');
        expect(leg.module).toBe(Math.floor(i / 2));
        const n = leg.to - leg.from;
        const [lo, hi] = SENTENCE_WORDS[id];
        expect(n).toBeGreaterThanOrEqual(Math.min(lo, 2));
        expect(n).toBeLessThanOrEqual(hi);
      });
      // The legs cover every word, in order, without gaps.
      expect(p.legs[0]?.from).toBe(0);
      expect(p.legs.at(-1)?.to).toBe(p.words.length);
      for (let i = 1; i < p.legs.length; i++) expect(p.legs[i]?.from).toBe(p.legs[i - 1]?.to);
      expect(p.text).toBe(p.words.join(' '));
      expect(p.approach.length).toBe(p.words.length);
    }
  });

  it('uses only learned keys on every level and difficulty, whatever the source offers', () => {
    const bad = ['zebra', 'qq', 'hello world', '', 'fl!ask', 'שלום'];
    for (const level of LEVEL_IDS) {
      for (const d of DIFFICULTY_IDS) {
        for (const letters of [LETTERS, LETTERS + '.', LETTERS + '!.', LETTERS + 'S']) {
          const keys = keysOf(letters);
          const p = planStation({
            keys,
            level: LEVELS[level],
            difficulty: DIFFICULTIES[d],
            words: wordSource(bad),
            rng,
          });
          expect(p.words.length).toBeGreaterThan(0);
          for (const ch of p.text) expect(keys.has(ch)).toBe(true);
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
    const p = planStation({ keys, level: LEVELS.easy, difficulty: calm, words, rng });
    expect(p.words.length).toBeGreaterThan(0);
    for (const ch of p.text) expect(keys.has(ch)).toBe(true);
  });

  it('ends a sentence with a full stop or a shout only when it has been learned', () => {
    const none = plan('standard', LETTERS);
    expect(none.text).not.toMatch(/[.!]/);
    const dot = plan('standard', LETTERS + '.');
    for (const leg of dot.legs) {
      const last = dot.words[leg.to - 1] as string;
      expect(last.endsWith('.')).toBe(true);
      for (let i = leg.from; i < leg.to - 1; i++) expect(dot.words[i]).not.toMatch(/[.!]/);
    }
    const both = plan('standard', LETTERS + '.!');
    for (const leg of both.legs) {
      const last = both.words[leg.to - 1] as string;
      expect(last.endsWith(leg.kind === 'turret' ? '!' : '.')).toBe(true);
    }
    expect(stopFor('turret', keysOf('a.'))).toBe('.');
    expect(stopFor('drift', keysOf('a!'))).toBe('!');
    expect(stopFor('drift', keysOf('a'))).toBe('');
  });

  it('starts a sentence with a capital only when the capital itself has been learned', () => {
    expect(capitalized('dag', keysOf('dag'))).toBe('dag');
    expect(capitalized('dag', keysOf('dagD'))).toBe('Dag');
    expect(capitalized('שדה', keysOf('שדה'))).toBe('שדה');
    expect(capitalized('', keysOf('a'))).toBe('');
    const caps = plan('standard', LETTERS + 'DFLS');
    for (const leg of caps.legs) {
      const first = caps.words[leg.from] as string;
      const up = (first[0] as string).toUpperCase();
      if ('DFLS'.includes(up)) expect(first[0]).toBe(up);
    }
    const plain = plan('standard', LETTERS);
    expect(plain.text).toBe(plain.text.toLowerCase());
  });

  it('never repeats a word twice in a row and has no empty word', () => {
    for (const id of LEVEL_IDS) {
      const p = plan(id);
      for (let i = 0; i < p.words.length; i++) {
        expect((p.words[i] as string).length).toBeGreaterThan(0);
        expect(p.words[i]).not.toContain(' ');
        if (i > 0) expect(p.words[i]).not.toBe(p.words[i - 1]);
      }
    }
  });

  it('gives up gracefully when no word can be spelled (never loops forever)', () => {
    const p = planStation({
      keys: keysOf('x'),
      level: LEVELS.hard,
      difficulty: steady,
      words: wordSource(),
      rng,
    });
    expect(p.words.length).toBe(0);
    expect(p.legs.length).toBe(0);
    expect(p.chapters.length).toBe(0);
    expect(p.text).toBe('');
  });

  it('copes with a single learned word (it may repeat, but never side by side)', () => {
    const p = planStation({
      keys: keysOf('dag'),
      level: LEVELS.easy,
      difficulty: steady,
      words: { next: () => 'dag' },
      rng,
    });
    for (let i = 1; i < p.words.length; i++) expect(p.words[i]).not.toBe(p.words[i - 1]);
  });

  it('has chapters that cover the run in order: the outer arm, the ring, the observatory', () => {
    for (const id of LEVEL_IDS) {
      const p = plan(id);
      expect(p.chapters.map((c) => c.id)).toEqual(['outer', 'ring', 'observatory']);
      expect(p.chapters[0]?.from).toBe(0);
      expect(p.chapters.at(-1)?.to).toBe(p.words.length);
      for (let i = 1; i < p.chapters.length; i++)
        expect(p.chapters[i]?.from).toBe(p.chapters[i - 1]?.to);
      expect(chapterAt(p, 0)).toBe('outer');
      expect(chapterAt(p, p.words.length)).toBe('observatory');
      expect(chapterStartsAt(p, p.chapters[1]?.from ?? -1)).toBe('ring');
      expect(chapterStartsAt(p, 1)).toBeNull();
    }
  });

  it('finds the leg of every word, and counts the characters each leg asks for', () => {
    const p = plan('easy');
    p.legs.forEach((leg, i) => {
      for (let w = leg.from; w < leg.to; w++) expect(legAt(p, w)).toBe(i);
    });
    expect(legAt(p, p.words.length + 5)).toBe(p.legs.length - 1);
    let sum = 0;
    for (const leg of p.legs) sum += legChars(p, leg);
    // Every character of the run, spaces included, belongs to exactly one leg.
    expect(sum).toBe([...p.text].length);
  });
});

describe('the debris', () => {
  it('has no timer on Calm or on a drift leg, and a timer on every turret word otherwise', () => {
    const c = plan('standard', LETTERS, calm);
    expect(c.timers).toBe(false);
    expect(c.approach.every((a) => a === null)).toBe(true);
    for (const d of DIFFICULTY_IDS) {
      if (d === 'calm') continue;
      const p = plan('standard', LETTERS, DIFFICULTIES[d]);
      expect(p.timers).toBe(true);
      for (const leg of p.legs) {
        for (let i = leg.from; i < leg.to; i++) {
          if (leg.kind === 'drift') expect(p.approach[i]).toBeNull();
          else expect(p.approach[i]).toBeGreaterThanOrEqual(MIN_APPROACH_S);
        }
      }
    }
    expect(rocksIn(c)).toBe(
      c.legs.filter((l) => l.kind === 'turret').reduce((n, l) => n + l.to - l.from, 0),
    );
  });

  it('gives longer words more time, and harder difficulties and levels less', () => {
    const lv = LEVELS.standard;
    const a = approachSeconds('dag', steady, lv) as number;
    const b = approachSeconds('flasks', steady, lv) as number;
    expect(b).toBeGreaterThan(a);
    expect(approachSeconds('salads', DIFFICULTIES.fierce, lv)).toBeLessThan(
      approachSeconds('salads', steady, lv) as number,
    );
    expect(approachSeconds('salads', steady, LEVELS.hard)).toBeLessThan(
      approachSeconds('salads', steady, LEVELS.easy) as number,
    );
  });

  it('is fair: a typist at the difficulty pace breaks the rock before it hits', () => {
    for (const d of ['steady', 'swift', 'fierce', 'trial'] as const) {
      for (const w of ['ask', 'salad', 'flasks!']) {
        const t = approachSeconds(w, DIFFICULTIES[d], LEVELS.hard) as number;
        const wpm = { steady: 9, swift: 16, fierce: 24, trial: 14 }[d];
        const typing = ((w.length + 1) * 12) / wpm;
        expect(t).toBeGreaterThan(typing * 0.82);
      }
    }
  });

  it('waits far out until the leg begins', () => {
    const r = new Rock();
    r.start(4);
    expect(r.step(1)).toBe('waiting');
    expect(r.distance).toBe(1);
  });

  it('on Calm comes in to its hold and waits there forever', () => {
    const r = new Rock();
    r.start(null);
    r.release();
    let last = r.step(0.5);
    expect(last).toBe('coming');
    for (let i = 0; i < 2000; i++) last = r.step(0.05);
    expect(last).toBe('held');
    expect(r.distance).toBeCloseTo(CALM_HOLD);
    expect(r.strikes).toBe(0);
  });

  it('comes in its time, strikes once, bounces back out and comes in slower', () => {
    const r = new Rock();
    r.start(4);
    r.release();
    let struck = 0;
    let t = 0;
    while (struck === 0 && t < 10) {
      if (r.step(0.05) === 'struck') struck += 1;
      t += 0.05;
    }
    expect(t).toBeCloseTo(4, 0);
    expect(r.strikes).toBe(1);
    expect(r.distance).toBe(BOUNCE);
    expect(r.time).toBeCloseTo(4 * BOUNCE_SLOW);
    // The rest of the way takes BOUNCE of the slower time.
    let t2 = 0;
    while (r.step(0.05) !== 'struck' && t2 < 20) t2 += 0.05;
    expect(t2).toBeCloseTo(BOUNCE * 4 * BOUNCE_SLOW, 0);
  });

  it('starts every rock fresh, and a reset waits for the run again', () => {
    const r = new Rock();
    r.start(3);
    r.release();
    for (let i = 0; i < 100; i++) r.step(0.05);
    r.start(5);
    expect(r.distance).toBe(1);
    expect(r.strikes).toBe(0);
    expect(r.released).toBe(true);
    r.reset();
    expect(r.released).toBe(false);
    expect(r.step(1)).toBe('waiting');
  });
});

describe('the drift', () => {
  it('floats after the aim, never past it and never backward, and settles there', () => {
    const d = new Drift();
    d.push(0.5);
    let last = 0;
    for (let i = 0; i < 200; i++) {
      d.step(1 / 60);
      expect(d.at).toBeGreaterThanOrEqual(last);
      expect(d.at).toBeLessThanOrEqual(0.5);
      last = d.at;
    }
    expect(d.settled).toBe(true);
    d.push(0.2);
    expect(d.aim).toBe(0.5);
    d.push(7);
    expect(d.aim).toBe(1);
    for (let i = 0; i < 400; i++) d.step(1 / 60);
    expect(d.at).toBeCloseTo(1, 2);
    d.push(Number.NaN);
    d.step(Number.NaN);
    expect(Number.isFinite(d.at)).toBe(true);
    d.reset();
    expect(d.at).toBe(0);
    expect(d.aim).toBe(0);
  });

  it('has inertia: a push moves the apprentice over time, not at once', () => {
    const d = new Drift();
    d.push(1);
    d.step(1 / 60);
    expect(d.at).toBeGreaterThan(0);
    expect(d.at).toBeLessThan(0.1);
  });

  it('aims by the share of the leg typed', () => {
    expect(driftAim(0, 20)).toBe(0);
    expect(driftAim(10, 20)).toBe(0.5);
    expect(driftAim(30, 20)).toBe(1);
    expect(driftAim(3, 0)).toBe(1);
  });
});

describe('the stars', () => {
  it('light more stars with every word, and all of them at the end', () => {
    let last = -1;
    for (let d = 0; d <= 20; d++) {
      const n = starsLit(d, 20);
      expect(n).toBeGreaterThan(last);
      last = n;
    }
    expect(starsLit(20, 20)).toBe(STARS);
    expect(starsLit(0, 20)).toBeGreaterThan(0);
    expect(starsLit(0, 0)).toBe(STARS);
  });

  it('brings the color back, counts modules online and rocks cleared', () => {
    expect(colorShare(0, 10)).toBe(0);
    expect(colorShare(5, 10)).toBe(0.5);
    expect(colorShare(12, 10)).toBe(1);
    expect(colorShare(0, 0)).toBe(1);
    const p = plan('easy');
    expect(modulesOnline(p, 0)).toBe(0);
    expect(modulesOnline(p, p.legs[1]?.to ?? 0)).toBe(1);
    expect(modulesOnline(p, p.words.length)).toBe(p.modules);
    expect(clearPercent(6, 9)).toBe(67);
    expect(clearPercent(0, 0)).toBe(100);
  });
});

describe('the Star Station on the map', () => {
  it('is a region with a screen, a route and a theme of its own', () => {
    expect(REGIONS.find((r) => r.id === 'station')?.act).toBe(2);
    expect(SCENE_ROUTES.station).toBe('station');
    expect(PARENT.station).toBe('hub');
    expect(playableRegions()).toContain('station');
    expect(THEME_IDS).toContain('station');
    expect(THEMES.station.id).toBe('station');
    expect(THEMES.station.voices.melody).toBe('glass');
  });
});

describe('what Reb Ezra and Dyo say', () => {
  it('has Hebrew and English for every moment, and only men or Dyo speak', () => {
    for (const lines of Object.values(STATION_LINES)) {
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
    const all = Object.values(STATION_LINES)
      .flat()
      .map((l) => `${l.text.en} ${l.text.he}`)
      .join(' ');
    expect(all).not.toMatch(/\b(she|her|woman|women|girl|lady|wife|kiss|love|sexy)\b/i);
    expect(all).not.toMatch(/יהוה|אלוהים/);
  });

  it('picks a line by counter and wraps around', () => {
    const lines = STATION_LINES.strike;
    expect(stationLine('strike', 0)).toBe(lines[0]);
    expect(stationLine('strike', lines.length)).toBe(lines[0]);
    expect(stationLine('strike', -1)).toBe(lines[1 % lines.length]);
  });
});
