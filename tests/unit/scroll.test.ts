// The Blank Scroll (T27): the final's plan, the Keeper's eraser, the allies' calls, the typed
// credits and the ending's words.

import { describe, expect, it } from 'vitest';
import { THEMES } from '../../src/audio/themes';
import { BossFight, CALM_ERASE, ERASE_CAP, type BossPlan } from '../../src/game/boss';
import { DIFFICULTIES, DIFFICULTY_IDS } from '../../src/game/difficulty';
import { LEVEL_IDS, LEVELS, levelWordSource, levelsFor, type LevelId } from '../../src/game/levels';
import { getTrack, knownKeysOf, recordLessonResult } from '../../src/learn';
import { isAllowedWord } from '../../src/learn/content';
import { createProfile, type Profile } from '../../src/save';
import { planChars } from '../../src/scenes/arena/plan';
import { scrollLights, SCROLL_LIGHTS } from '../../src/scenes/scroll/palette';
import {
  allyAt,
  BLANK_SCROLL,
  CROSSING,
  isKeeperPhase,
  planCredits,
  planScroll,
  SCROLL_SIZES,
} from '../../src/scenes/scroll/plan';
import { SCROLL_ENDING, SCROLL_LINES, SCROLL_NAMES, SCROLL_PHASE_LINES } from '../../src/story';
import { CREDIT_LINES, NEW_GAME_PLUS } from '../../src/ui/screens/scroll';
import en from '../../locales/en.json';
import he from '../../locales/he.json';

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

function input(p: Profile, level: LevelId, seed = 7, diff = DIFFICULTIES.steady) {
  const rng = seeded(seed);
  return {
    layout: p.layout,
    keys: knownKeysOf(p),
    level,
    words: levelWordSource(p, LEVELS[level], diff, rng),
    rng,
  };
}

function planFor(p: Profile, level: LevelId, seed = 7): BossPlan {
  return planScroll(input(p, level, seed));
}

/** Types every character of the current phase, word by word. */
function typePhase(f: BossFight, perfect = true): void {
  const p = f.current;
  for (let i = 0; i < p.words.length; i++) {
    const w = p.words[i] as string;
    for (let k = 0; k < w.length + (i < p.words.length - 1 ? 1 : 0); k++) f.letter();
    f.wordDone(perfect);
  }
}

describe('the Blank Scroll', () => {
  it('is nine phases: five crossing columns, then the Keeper’s four', () => {
    expect(BLANK_SCROLL.phases).toHaveLength(9);
    expect(CROSSING).toBe(5);
    for (let i = 0; i < 9; i++) expect(isKeeperPhase(i)).toBe(i >= 5);
    // Only the Keeper's last phase erases.
    const erasing = BLANK_SCROLL.phases.filter((p) => (p.erase ?? 0) > 0).map((p) => p.id);
    expect(erasing).toEqual(['k4']);
    // Every phase's music is in the final's own theme.
    const final = THEMES.final;
    for (const ph of BLANK_SCROLL.phases) {
      const sections = final.phases?.[ph.music];
      expect(sections, ph.music).toBeDefined();
      for (const s of sections ?? []) expect(final.sections[s], s).toBeDefined();
    }
  });

  it('types only learned keys, in every layout, track, level and difficulty (section 8)', () => {
    for (const layout of ['en', 'he'] as const) {
      for (const track of [1, 2] as const) {
        for (const lessons of [14, 30, 60]) {
          const p = pass(player(layout, track), lessons);
          const keys = knownKeysOf(p);
          for (const level of levelsFor(p)) {
            for (const id of DIFFICULTY_IDS) {
              const o = input(p, level, lessons + level.length, DIFFICULTIES[id]);
              const plan = planScroll(o);
              const credits = planCredits(o);
              const chars = [...planChars(plan), ...credits.join('')];
              for (const ch of chars) {
                if (ch === ' ') continue;
                expect(keys.has(ch), `${layout} t${track} ${lessons}: '${ch}'`).toBe(true);
              }
              const words = [...plan.phases.flatMap((ph) => ph.words), ...credits];
              for (const w of words) {
                const bare = w.replace(/[^\p{L}]/gu, '');
                if (bare.length > 1) expect(isAllowedWord(bare, layout), bare).toBe(true);
              }
            }
          }
        }
      }
    }
  });

  it('grows with the level; the crossing has no calls, every Keeper phase has some', () => {
    const p = pass(player('en'), 60);
    let last = 0;
    for (const level of LEVEL_IDS) {
      const plan = planFor(p, level);
      expect(plan.boss).toBe('scroll');
      expect(plan.phases).toHaveLength(9);
      const n = plan.phases.reduce((k, ph) => k + ph.words.length, 0);
      expect(n).toBeGreaterThan(last);
      last = n;
      plan.phases.forEach((ph, i) => {
        expect(ph.text).toBe(ph.words.join(' '));
        expect(ph.groups).toHaveLength(ph.words.length);
        expect(ph.weak).toHaveLength(ph.words.length);
        expect(ph.weak.some(Boolean), `phase ${i}`).toBe(isKeeperPhase(i));
      });
      expect(planCredits(input(p, level))).toHaveLength(SCROLL_SIZES[level].credits);
    }
  });

  it('the allies take turns calling the Keeper’s weak points, Naftali first', () => {
    const plan = planFor(pass(player('he'), 40), 'standard');
    for (let p = 0; p < CROSSING; p++) {
      plan.phases[p]!.words.forEach((_, w) => expect(allyAt(plan, p, w)).toBeNull());
    }
    for (let p = CROSSING; p < 9; p++) {
      const ph = plan.phases[p]!;
      const calls = ph.words.map((_, w) => allyAt(plan, p, w)).filter((a) => a !== null);
      expect(calls.length).toBe(ph.weak.filter(Boolean).length);
      expect(calls[0]).toBe('naftali');
      calls.forEach((a, i) => expect(a).toBe(i % 2 === 0 ? 'naftali' : 'ezra'));
      ph.words.forEach((_, w) => {
        if (!ph.weak[w]) expect(allyAt(plan, p, w)).toBeNull();
      });
    }
  });

  it('can be finished on every difficulty, eraser and all, with no soft-lock', () => {
    const p = pass(player('he'), 40);
    for (const id of DIFFICULTY_IDS) {
      const f = new BossFight(planFor(p, 'standard', 3), DIFFICULTIES[id]);
      let guard = 0;
      while (f.state !== 'victory' && guard++ < 30) {
        for (let i = 0; i < 300; i++) f.update(1 / 60);
        for (let k = 0; k < 3; k++) f.slip();
        typePhase(f, guard % 2 === 0);
        if (f.state === 'transition') f.nextPhase();
      }
      expect(f.state, id).toBe('victory');
      expect(f.health).toBe(0);
    }
  });

  it('the same seed plans the same final', () => {
    const p = pass(player('en'), 40);
    expect(planFor(p, 'standard', 11)).toEqual(planFor(p, 'standard', 11));
  });
});

describe('the Keeper’s eraser', () => {
  const p = pass(player('en'), 40);

  /** A fight already on the Keeper's last phase. */
  function atLastPhase(diff: (typeof DIFFICULTY_IDS)[number]): BossFight {
    const f = new BossFight(planFor(p, 'standard'), DIFFICULTIES[diff]);
    for (let i = 0; i < 8; i++) {
      typePhase(f);
      f.nextPhase();
    }
    expect(f.current.def.id).toBe('k4');
    return f;
  }

  it('erases only on the last phase, never more than what was written, up to the cap', () => {
    const first = new BossFight(planFor(p, 'standard'), DIFFICULTIES.swift);
    for (let k = 0; k < 5; k++) first.letter();
    for (let i = 0; i < 600; i++) first.update(1 / 60);
    expect(first.erasing).toBe(false);
    expect(first.erasedShare).toBe(0);

    const f = atLastPhase('swift');
    expect(f.erasing).toBe(true);
    f.update(5);
    expect(f.healed).toBe(0); // nothing written yet: nothing to erase
    for (let k = 0; k < 12; k++) f.letter();
    const before = f.health;
    for (let i = 0; i < 60 * 10; i++) f.update(1 / 60);
    expect(f.health).toBeGreaterThan(before);
    expect(f.healed).toBeLessThanOrEqual(12);
    expect(f.healed).toBeLessThanOrEqual(f.current.text.length * ERASE_CAP + 1e-9);
    expect(f.erasedShare).toBeGreaterThan(0);
    expect(f.erasedShare).toBeLessThanOrEqual(1);
  });

  it('on Calm it still erases, slowly and only a little', () => {
    const f = atLastPhase('calm');
    const n = Math.min(40, f.current.text.length - 2);
    for (let k = 0; k < n; k++) f.letter();
    for (let i = 0; i < 60 * 60; i++) f.update(1 / 60);
    expect(f.healed).toBeGreaterThan(0);
    expect(f.healed).toBeLessThanOrEqual(f.current.text.length * CALM_ERASE.cap + 1e-9);
  });

  it('a clean ally call writes back everything he erased', () => {
    const f = atLastPhase('steady');
    const ph = f.current;
    const weakAt = ph.weak.findIndex(Boolean);
    expect(weakAt).toBeGreaterThanOrEqual(0);
    for (let i = 0; i < weakAt; i++) {
      for (let k = 0; k < (ph.words[i] as string).length + 1; k++) f.letter();
      f.wordDone(true);
    }
    for (let i = 0; i < 60 * 4; i++) f.update(1 / 60);
    expect(f.healed).toBeGreaterThan(0);
    for (let k = 0; k < (ph.words[weakAt] as string).length + 1; k++) f.letter();
    f.wordDone(true);
    expect(f.healed).toBe(0);
  });
});

describe('the Blank Scroll’s look and words', () => {
  it('has a sky for every moment in both themes, and the night never goes black', () => {
    for (const theme of ['light', 'dark'] as const) {
      const skies = scrollLights(theme);
      for (const id of SCROLL_LIGHTS) {
        const s = skies[id];
        expect(s, `${theme} ${id}`).toBeDefined();
        const lum = (c: number): number => ((c >> 16) & 255) + ((c >> 8) & 255) + (c & 255);
        expect(lum(s.fillGround), `${theme} ${id} ground`).toBeGreaterThan(80);
      }
    }
  });

  it('every line is in both languages, from the cast, and family-safe', () => {
    const lines = [
      ...Object.values(SCROLL_PHASE_LINES),
      ...Object.values(SCROLL_LINES).flat(),
      ...SCROLL_ENDING.beats.flatMap((b) => (b.say ? [b.say] : [])),
    ];
    expect(lines.length).toBeGreaterThan(10);
    for (const line of lines) {
      expect(['ezra', 'dyo', 'naftali', 'keeper', 'narrator']).toContain(line.who);
      for (const lang of ['he', 'en'] as const) {
        expect(line.text[lang].length).toBeGreaterThan(3);
        for (const raw of line.text[lang].split(/\s+/)) {
          const w = raw.replace(/[^\p{L}']/gu, '');
          if (w) expect(isAllowedWord(w, lang), `${line.who}: ${w}`).toBe(true);
        }
      }
    }
    expect(SCROLL_NAMES.keeper.he.length).toBeGreaterThan(2);
    expect(NEW_GAME_PLUS).toBe('ngplus');
  });

  it('every phase name, hint and credit line is in both locales', () => {
    const keys = [
      ...BLANK_SCROLL.phases.flatMap((ph) => [
        `scroll.phase.${ph.id}`,
        `scroll.phase.how.${ph.id}`,
      ]),
      ...Array.from({ length: CREDIT_LINES }, (_, i) => `scroll.credits.${i + 1}`),
      'scroll.call',
      'scroll.victory',
      'scroll.credits.title',
      'scroll.credits.hint',
      'scroll.results.written',
    ];
    for (const k of keys) {
      expect((en as Record<string, string>)[k], k).toBeTruthy();
      expect((he as Record<string, string>)[k], k).toBeTruthy();
    }
  });
});
