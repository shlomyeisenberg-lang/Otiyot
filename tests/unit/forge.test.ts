import { describe, expect, it } from 'vitest';
import { LEVEL_IDS } from '../../src/game/levels';
import { createProfile } from '../../src/save';
import { needMet, NUMBER_ROW_FLAG, REGIONS, sceneKeysOf } from '../../src/game/regions';
import { THEME_IDS, THEMES } from '../../src/audio/themes';
import {
  alphabetOf,
  BAND_HIGH,
  BAND_LOW,
  brightCount,
  chapterAt,
  chapterStartsAt,
  clampHeat,
  colorShare,
  cooled,
  STEADY_PACE,
  flared,
  HEAT_PER_KEY,
  HEAT_START,
  lampsLit,
  LETTERS_PER_LEVEL,
  planForge,
  SECTIONS,
  spelledFrom,
  stoked,
  temperOf,
  valueAt,
} from '../../src/scenes/forge/plan';
import { slotPosition } from '../../src/scenes/forge';
import { FORGE_LINES, forgeLine } from '../../src/story';
import { PARENT } from '../../src/ui/app';
import { playableRegions, SCENE_ROUTES } from '../../src/ui/playable';
import { Vector3 } from 'three';

function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 48271) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const ALL_DIGITS = new Set('0123456789 '.split(''));

describe('gematria values', () => {
  it('counts 1-9, then 10-90, then 100 and up', () => {
    expect([0, 8, 9, 17, 18, 21].map(valueAt)).toEqual([1, 9, 10, 90, 100, 400]);
  });

  it('gives alef 1, yod 10 and tav 400 in Hebrew, and a 1, j 10, s 100 in English', () => {
    const he = alphabetOf('he');
    expect(he).toHaveLength(22);
    expect(he[0]).toEqual({ glyph: 'א', value: 1 });
    expect(he[9]).toEqual({ glyph: 'י', value: 10 });
    expect(he[10]).toEqual({ glyph: 'כ', value: 20 });
    expect(he.at(-1)).toEqual({ glyph: 'ת', value: 400 });
    const en = alphabetOf('en');
    expect(en).toHaveLength(26);
    expect(en[0]?.value).toBe(1);
    expect(en[9]?.value).toBe(10);
    expect(en[18]?.value).toBe(100);
  });
});

describe('the run', () => {
  it('has the right number of letters on every level, one number each', () => {
    for (const level of LEVEL_IDS) {
      for (const layout of ['he', 'en'] as const) {
        const plan = planForge({ layout, keys: ALL_DIGITS, level, rng: seeded(7) });
        expect(plan.letters).toHaveLength(LETTERS_PER_LEVEL[level]);
        expect(plan.numbers).toHaveLength(plan.letters.length);
        expect(plan.letters.length % SECTIONS).toBe(0);
        expect(plan.text).toBe(plan.numbers.join(' '));
        plan.letters.forEach((l, i) => expect(plan.numbers[i]).toBe(String(l.value)));
      }
    }
  });

  it('keeps Easy short and lets Hard reach the hundreds', () => {
    const easy = planForge({ layout: 'he', keys: ALL_DIGITS, level: 'easy', rng: seeded(3) });
    expect(easy.numbers.every((n) => n.length <= 2)).toBe(true);
    const hard = planForge({ layout: 'he', keys: ALL_DIGITS, level: 'hard', rng: seeded(3) });
    expect(hard.numbers.some((n) => n.length === 3)).toBe(true);
  });

  it('uses only learned digits, whatever is learned', () => {
    const keys = new Set(['1', '2', '3', ' ']);
    for (const level of LEVEL_IDS) {
      for (const layout of ['he', 'en'] as const) {
        for (let seed = 1; seed <= 20; seed++) {
          const plan = planForge({ layout, keys, level, rng: seeded(seed) });
          expect(plan.numbers.length).toBeGreaterThan(0);
          for (const ch of plan.text) expect(keys.has(ch)).toBe(true);
          for (const n of plan.numbers) expect(spelledFrom(n, keys)).toBe(true);
        }
      }
    }
  });

  it('is empty, not broken, when no digit is learned', () => {
    const plan = planForge({
      layout: 'en',
      keys: new Set('asdfjkl; '.split('')),
      level: 'easy',
      rng: seeded(1),
    });
    expect(plan.numbers).toHaveLength(0);
    expect(plan.text).toBe('');
    expect(plan.chapters).toHaveLength(0);
  });

  it('never repeats a letter twice in a row', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const plan = planForge({ layout: 'he', keys: ALL_DIGITS, level: 'hard', rng: seeded(seed) });
      plan.letters.forEach((l, i) => {
        if (i > 0) expect(l.glyph).not.toBe(plan.letters[i - 1]?.glyph);
      });
    }
  });

  it('cuts the run into three chapters that cover every number', () => {
    for (const level of LEVEL_IDS) {
      const plan = planForge({ layout: 'en', keys: ALL_DIGITS, level, rng: seeded(5) });
      expect(plan.chapters.map((c) => c.id)).toEqual(['stoke', 'forge', 'quench']);
      expect(plan.chapters[0]?.from).toBe(0);
      expect(plan.chapters.at(-1)?.to).toBe(plan.numbers.length);
      expect(chapterAt(plan, 0)).toBe('stoke');
      expect(chapterAt(plan, plan.numbers.length - 1)).toBe('quench');
      expect(chapterStartsAt(plan, 0)).toBe('stoke');
      expect(chapterStartsAt(plan, 1)).toBeNull();
    }
  });
});

describe('the furnace', () => {
  it('keeps the heat between 0 and 1', () => {
    expect(clampHeat(-3)).toBe(0);
    expect(clampHeat(4)).toBe(1);
    expect(stoked(0.99)).toBe(1);
    expect(flared(1)).toBe(1);
    expect(cooled(0, 10)).toBe(0);
  });

  it('warms on a right key, flares on a slip more than on a key, and cools with time', () => {
    expect(stoked(0.3)).toBeCloseTo(0.3 + HEAT_PER_KEY);
    expect(flared(0.3)).toBeGreaterThan(stoked(0.3));
    expect(cooled(0.5, 2)).toBeLessThan(0.5);
    expect(cooled(0.5, 2, 'hard')).toBeLessThan(cooled(0.5, 2, 'easy'));
    expect(cooled(0.5, -4)).toBe(0.5);
  });

  it('calls the fire cold, good or hot against the band', () => {
    expect(BAND_LOW).toBeLessThan(BAND_HIGH);
    expect(temperOf(HEAT_START)).toBe('good');
    expect(temperOf(BAND_LOW - 0.01)).toBe('cold');
    expect(temperOf(BAND_LOW)).toBe('good');
    expect(temperOf((BAND_LOW + BAND_HIGH) / 2)).toBe('good');
    expect(temperOf(BAND_HIGH)).toBe('good');
    expect(temperOf(BAND_HIGH + 0.01)).toBe('hot');
  });

  it('counts bright letters', () => {
    expect(brightCount(['good', 'cold', 'good', 'hot'])).toBe(2);
    expect(brightCount([])).toBe(0);
  });

  it('settles inside the band for a steady typist at the pace of each level', () => {
    for (const level of LEVEL_IDS) {
      let heat = HEAT_START;
      const every = Math.round(1 / (STEADY_PACE[level] * 0.05));
      for (let step = 0; step < 2400; step++) {
        heat = cooled(heat, 0.05, level);
        if (step % every === 0) heat = stoked(heat);
        if (step > 1200) expect(temperOf(heat), `${level} at step ${step}`).toBe('good');
      }
    }
  });

  it('forges bright letters for a steady typist when every key of the real text stokes (R17)', () => {
    // The scene stokes the fire on every right key, the spaces between numbers included; a
    // careful player at the level's pace must get bright letters, not a run of cold ones.
    for (const layout of ['en', 'he'] as const) {
      for (const level of LEVEL_IDS) {
        const keys = new Set('0123456789');
        let seed = 7;
        const rng = (): number => ((seed = (seed * 16807) % 2147483647) / 2147483647);
        const plan = planForge({ layout, keys, level, rng });
        const gap = 1 / STEADY_PACE[level];
        let heat = HEAT_START;
        const tempers: ReturnType<typeof temperOf>[] = [];
        for (let i = 0; i < plan.text.length; i++) {
          heat = stoked(cooled(heat, gap, level));
          // A number is forged on its last digit.
          if (plan.text[i + 1] === ' ' || i === plan.text.length - 1) tempers.push(temperOf(heat));
        }
        expect(tempers).toHaveLength(plan.numbers.length);
        expect(brightCount(tempers), `${layout} ${level}`).toBeGreaterThanOrEqual(
          Math.ceil(plan.numbers.length * 0.75),
        );
      }
    }
  });

  it('runs cold for a very slow typist and hot for a very fast one, and never past 0..1', () => {
    let slow = HEAT_START;
    let fast = HEAT_START;
    for (let step = 0; step < 2400; step++) {
      slow = cooled(slow, 0.05, 'standard');
      fast = cooled(fast, 0.05, 'standard');
      if (step % 60 === 0) slow = stoked(slow);
      if (step % 5 === 0) fast = stoked(fast);
    }
    expect(temperOf(slow)).toBe('cold');
    expect(temperOf(fast)).toBe('hot');
    expect(slow).toBeGreaterThanOrEqual(0);
    expect(fast).toBeLessThanOrEqual(1);
  });
});

describe('how the forge answers', () => {
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

  it('hangs every slot of the rack apart and in the cave', () => {
    for (const n of [8, 12, 16]) {
      const seen = new Set<string>();
      for (let i = 0; i < n; i++) {
        const p = slotPosition(i, n, new Vector3());
        seen.add(`${p.x.toFixed(2)},${p.y.toFixed(2)}`);
        expect(Math.abs(p.x)).toBeLessThan(10);
        expect(p.y).toBeGreaterThan(3);
      }
      expect(seen.size).toBe(n);
    }
  });
});

describe('the forge on the map', () => {
  it('is a region that opens on the number row, and has a screen and a theme', () => {
    const forge = REGIONS.find((r) => r.id === 'forge');
    expect(forge?.need).toEqual({ kind: 'keys', band: 'numbers', chars: '1234567890' });
    expect(SCENE_ROUTES.forge).toBe('forge');
    expect(playableRegions().has('forge')).toBe(true);
    expect(PARENT.forge).toBe('hub');
    expect(THEME_IDS).toContain('forge');
    expect(THEMES.forge.id).toBe('forge');
  });
});

describe('what Reb Ezra and Dyo say', () => {
  it('has Hebrew and English for every moment, and only Ezra or Dyo speak', () => {
    for (const lines of Object.values(FORGE_LINES)) {
      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) {
        expect(['ezra', 'dyo']).toContain(line.who);
        expect(line.text.he.length).toBeGreaterThan(5);
        expect(line.text.en.length).toBeGreaterThan(5);
      }
    }
  });

  it('keeps the story clean: nothing about women, nothing suggestive', () => {
    const bad = /\b(she|her|woman|women|girl|lady|sexy|kiss|naked)\b/i;
    for (const lines of Object.values(FORGE_LINES))
      for (const line of lines) expect(bad.test(line.text.en)).toBe(false);
  });

  it('picks a line by counter and wraps around', () => {
    expect(forgeLine('lamp', 0)).toBe(FORGE_LINES.lamp[0]);
    expect(forgeLine('lamp', 1)).toBe(FORGE_LINES.lamp[1]);
    expect(forgeLine('lamp', 2)).toBe(FORGE_LINES.lamp[0]);
  });
});

describe('the number row', () => {
  it('is not learned until the save says so, and then every digit counts', () => {
    const p = createProfile('a', 'A', 0);
    p.layout = 'en';
    const forge = REGIONS.find((r) => r.id === 'forge');
    expect(sceneKeysOf(p).has('5')).toBe(false);
    expect(forge && needMet(p, forge.need)).toBe(false);
    p.story.flags[NUMBER_ROW_FLAG] = true;
    for (const d of '1234567890') expect(sceneKeysOf(p).has(d)).toBe(true);
    expect(forge && needMet(p, forge.need)).toBe(true);
  });

  it('makes a full run from nothing but those digits', () => {
    const p = createProfile('a', 'A', 0);
    p.layout = 'en';
    p.story.flags[NUMBER_ROW_FLAG] = true;
    const keys = sceneKeysOf(p);
    for (const level of LEVEL_IDS) {
      const plan = planForge({ layout: 'en', keys, level, rng: seeded(11) });
      expect(plan.numbers).toHaveLength(LETTERS_PER_LEVEL[level]);
      for (const n of plan.numbers) expect(spelledFrom(n, keys)).toBe(true);
    }
  });
});
