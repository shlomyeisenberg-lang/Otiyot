import { describe, expect, it } from 'vitest';
import { LEVEL_IDS } from '../../src/game/levels';
import { THEME_IDS, THEMES } from '../../src/audio/themes';
import { REGIONS } from '../../src/game/regions';
import {
  BEND_BOOST,
  BEND_EVERY,
  bendAfter,
  bendCarried,
  boostAfter,
  chapterAt,
  chapterStartsAt,
  colorShare,
  LEAD_LIMIT,
  lampsLit,
  leadAfter,
  planRail,
  raceWon,
  SECTIONS,
  STRETCHES_PER_LEVEL,
} from '../../src/scenes/rail/plan';
import {
  BEND_ANGLE,
  buildTrack,
  headingAt,
  pointAt,
  STRETCH_LENGTH,
  type TrackPoint,
} from '../../src/scenes/rail/track';
import { RAIL_LINES, railLine } from '../../src/story';
import { PARENT } from '../../src/ui/app';
import { playableRegions, SCENE_ROUTES } from '../../src/ui/playable';

function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 48271) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const LETTERS = 'asdfjkl';
const WORDS = ['dag', 'lag', 'salad', 'flask', 'ask', 'fall', 'dad', 'sad', 'flash', 'ska'];
function wordSource(extra: string[] = []): { next(): string } {
  const all = [...extra, ...WORDS];
  let i = 0;
  return { next: () => all[i++ % all.length] as string };
}
const keysOf = (letters: string): Set<string> => new Set((letters + ' ').split(''));

describe('the run', () => {
  it('has the right number of stretches on every level, in whole quarters', () => {
    for (const level of LEVEL_IDS) {
      const plan = planRail({ keys: keysOf(LETTERS), level, words: wordSource(), rng: seeded(3) });
      expect(plan.stretches).toHaveLength(STRETCHES_PER_LEVEL[level]);
      expect(plan.stretches.length % SECTIONS).toBe(0);
      expect(plan.text).toBe(plan.stretches.map((s) => s.word).join(' '));
    }
  });

  it('uses only learned letters, even if the word source offers others', () => {
    for (const letters of ['asdfjkl', 'asdf', 'dafsl']) {
      const keys = keysOf(letters);
      for (const level of LEVEL_IDS) {
        const plan = planRail({
          keys,
          level,
          words: wordSource(['qwerty', 'ghost', 'zebra', 'a b']),
          rng: seeded(11),
        });
        for (const ch of plan.text.replace(/ /g, ''))
          expect(keys.has(ch), `${letters}|${ch}`).toBe(true);
        expect(plan.text).not.toMatch(/[qwertyzbghoe]/);
      }
    }
  });

  it('never repeats a word twice in a row and has no empty stretch', () => {
    const plan = planRail({
      keys: keysOf(LETTERS),
      level: 'hard',
      words: wordSource(['dag', 'dag']),
      rng: seeded(5),
    });
    plan.stretches.forEach((s, i) => {
      expect(s.word.length).toBeGreaterThan(0);
      if (i > 0) expect(s.word).not.toBe(plan.stretches[i - 1]?.word);
    });
  });

  it('puts a bend after every third stretch, never after the last', () => {
    const plan = planRail({
      keys: keysOf(LETTERS),
      level: 'standard',
      words: wordSource(),
      rng: seeded(2),
    });
    plan.stretches.forEach((s, i) => {
      expect(s.bend).toBe((i + 1) % BEND_EVERY === 0 && i < plan.stretches.length - 1);
    });
    expect(plan.bends).toBe(plan.stretches.filter((s) => s.bend).length);
    expect(bendAfter(plan.stretches.length - 1, plan.stretches.length)).toBe(false);
  });

  it('cuts the run into coast, plain and hills that cover every stretch once', () => {
    const plan = planRail({
      keys: keysOf(LETTERS),
      level: 'standard',
      words: wordSource(),
      rng: seeded(9),
    });
    expect(plan.chapters.map((c) => c.id)).toEqual(['coast', 'plain', 'hills']);
    expect(plan.chapters[0]?.from).toBe(0);
    expect(plan.chapters.at(-1)?.to).toBe(plan.stretches.length);
    expect(chapterAt(plan, 0)).toBe('coast');
    expect(chapterAt(plan, plan.stretches.length - 1)).toBe('hills');
    expect(chapterAt(plan, 999)).toBe('hills');
    expect(chapterStartsAt(plan, 0)).toBe('coast');
    expect(chapterStartsAt(plan, 1)).toBeNull();
  });

  it('plans nothing when no word is learned, instead of failing', () => {
    const plan = planRail({
      keys: keysOf('q'),
      level: 'easy',
      words: wordSource(),
      rng: seeded(1),
    });
    expect(plan.stretches).toHaveLength(0);
    expect(plan.text).toBe('');
  });
});

describe('boost and the race', () => {
  it('builds boost with clean stretches and loses a good part of it to a slip', () => {
    let boost = 0;
    boost = boostAfter(boost, true);
    expect(bendCarried(boost)).toBe(boost >= BEND_BOOST);
    boost = boostAfter(boostAfter(boost, true), true);
    expect(boost).toBe(1);
    expect(bendCarried(boost)).toBe(true);
    const slipped = boostAfter(boost, false);
    expect(slipped).toBeLessThan(boost);
    expect(slipped).toBeGreaterThanOrEqual(0);
    expect(boostAfter(0, false)).toBe(0);
  });

  it('carries a bend only with enough boost', () => {
    expect(bendCarried(0)).toBe(false);
    expect(bendCarried(BEND_BOOST - 0.01)).toBe(false);
    expect(bendCarried(BEND_BOOST)).toBe(true);
  });

  it('gains on Naftali in a carried bend, loses ground in a slow one, and stays in range', () => {
    expect(leadAfter(0, true, true, true)).toBeGreaterThan(leadAfter(0, true, false, true));
    expect(leadAfter(0, true, true, false)).toBeLessThan(0.1);
    expect(leadAfter(0, false, true, false)).toBeLessThan(0);
    let lead = 0;
    for (let i = 0; i < 99; i++) lead = leadAfter(lead, true, true, true);
    expect(lead).toBe(LEAD_LIMIT);
    for (let i = 0; i < 99; i++) lead = leadAfter(lead, false, true, false);
    expect(lead).toBe(-LEAD_LIMIT);
  });

  it('is won with a clean run and lost with a run of slips; a tie goes to the apprentice', () => {
    const plan = planRail({
      keys: keysOf(LETTERS),
      level: 'standard',
      words: wordSource(),
      rng: seeded(4),
    });
    for (const clean of [true, false]) {
      let boost = 0;
      let lead = 0;
      for (const s of plan.stretches) {
        boost = boostAfter(boost, clean);
        lead = leadAfter(lead, clean, s.bend, bendCarried(boost));
      }
      expect(raceWon(lead)).toBe(clean);
    }
    expect(raceWon(0)).toBe(true);
  });

  it('can always be finished: a run of slips still ends the run', () => {
    // The race may be lost, but nothing in the plan ever blocks the last stretch.
    const plan = planRail({
      keys: keysOf(LETTERS),
      level: 'hard',
      words: wordSource(),
      rng: seeded(8),
    });
    let boost = 0;
    let lead = 0;
    let done = 0;
    for (const s of plan.stretches) {
      boost = boostAfter(boost, false);
      lead = leadAfter(lead, false, s.bend, bendCarried(boost));
      done += 1;
    }
    expect(done).toBe(plan.stretches.length);
  });
});

describe('how the line answers', () => {
  it('lights one lamp per quarter and all of them at the end', () => {
    expect(lampsLit(0, 12)).toBe(0);
    expect(lampsLit(3, 12)).toBe(1);
    expect(lampsLit(6, 12)).toBe(2);
    expect(lampsLit(11, 12)).toBe(3);
    expect(lampsLit(12, 12)).toBe(SECTIONS);
    expect(lampsLit(0, 0)).toBe(SECTIONS);
  });

  it('spreads color from 0 to 1', () => {
    expect(colorShare(0, 8)).toBe(0);
    expect(colorShare(4, 8)).toBeCloseTo(0.5);
    expect(colorShare(9, 8)).toBe(1);
    expect(colorShare(0, 0)).toBe(1);
  });
});

describe('the track', () => {
  it('runs straight until the first bend and bends back to straight', () => {
    expect(headingAt(0, 12)).toBe(0);
    expect(headingAt(STRETCH_LENGTH, 12)).toBe(0);
    // After the first bend it has turned; after the second it is straight again.
    expect(headingAt(BEND_EVERY * STRETCH_LENGTH + 20, 12)).toBeCloseTo(BEND_ANGLE);
    expect(headingAt(2 * BEND_EVERY * STRETCH_LENGTH + 20, 12)).toBeCloseTo(0);
  });

  it('is as long as the run, with a run-in before the start', () => {
    for (const n of [8, 12, 16]) {
      const track = buildTrack(n);
      expect(track.length).toBe(n * STRETCH_LENGTH);
      const out: TrackPoint = { x: 0, z: 0, heading: 0 };
      const start = pointAt(track, 0, { ...out });
      expect(start.x).toBeCloseTo(0);
      expect(start.z).toBeCloseTo(0);
      // The end is far up the line (toward -z) and the sample never jumps.
      const end = pointAt(track, track.length, { ...out });
      expect(end.z).toBeLessThan(-track.length * 0.7);
      let prev = pointAt(track, -24, { ...out });
      for (let s = -23; s <= track.length; s += 1) {
        const p = pointAt(track, s, { ...out });
        expect(Math.hypot(p.x - prev.x, p.z - prev.z)).toBeLessThan(1.2);
        prev = { ...p };
      }
    }
  });

  it('clamps beyond both ends', () => {
    const track = buildTrack(8);
    const a = pointAt(track, -999, { x: 0, z: 0, heading: 0 });
    const b = pointAt(track, 99999, { x: 0, z: 0, heading: 0 });
    expect(Number.isFinite(a.z)).toBe(true);
    expect(Number.isFinite(b.z)).toBe(true);
    expect(b.z).toBeLessThan(a.z);
  });
});

describe('the Jaffa Line on the map', () => {
  it('is a region with a screen, a route and a theme of its own', () => {
    expect(REGIONS.find((r) => r.id === 'rail')?.act).toBe(2);
    expect(SCENE_ROUTES.rail).toBe('rail');
    expect(PARENT.rail).toBe('hub');
    expect(playableRegions()).toContain('rail');
    expect(THEME_IDS).toContain('rail');
    expect(THEMES.rail.id).toBe('rail');
    expect(THEMES.rail.form.every((s) => s in THEMES.rail.sections)).toBe(true);
  });
});

describe('what Reb Ezra, Dyo and Naftali say', () => {
  it('has Hebrew and English for every moment, and only men or Dyo speak', () => {
    for (const [moment, lines] of Object.entries(RAIL_LINES)) {
      expect(lines.length, moment).toBeGreaterThan(0);
      for (const l of lines) {
        expect(['ezra', 'dyo', 'naftali']).toContain(l.who);
        expect(l.text.he.length).toBeGreaterThan(5);
        expect(l.text.en.length).toBeGreaterThan(5);
      }
    }
  });

  it('keeps the story clean: nothing about women, nothing suggestive', () => {
    const blocked = /\b(she|her|woman|women|lady|girl|wife|queen|kiss|sexy|love)\b/i;
    for (const lines of Object.values(RAIL_LINES)) {
      for (const l of lines) expect(l.text.en).not.toMatch(blocked);
    }
  });

  it('picks a line by counter and wraps around', () => {
    expect(railLine('bend', 0)).toBe(RAIL_LINES.bend[0]);
    expect(railLine('bend', 1)).toBe(RAIL_LINES.bend[1]);
    expect(railLine('bend', 2)).toBe(RAIL_LINES.bend[0]);
  });
});
