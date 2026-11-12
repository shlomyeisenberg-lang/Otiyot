import { describe, expect, it } from 'vitest';
import {
  BossFight,
  HEAL_CAP,
  STAGGER_SECONDS,
  windupSeconds,
  type BossPlan,
} from '../../src/game/boss';
import { DIFFICULTIES, DIFFICULTY_IDS } from '../../src/game/difficulty';
import { LEVEL_IDS, LEVELS, levelWordSource, levelsFor, type LevelId } from '../../src/game/levels';
import { regionStatuses } from '../../src/game/regions';
import {
  nextTrial,
  recordTrialRank,
  trialKey,
  trialRank,
  TRIAL_IDS,
  type TrialId,
} from '../../src/game/trials';
import { getTrack, knownKeysOf, recordLessonResult } from '../../src/learn';
import { isAllowedWord } from '../../src/learn/content';
import { THEMES } from '../../src/audio/themes';
import { createProfile, type Profile } from '../../src/save';
import { planChars } from '../../src/scenes/arena/plan';
import { lightsFor, LOOKS } from '../../src/scenes/arena/palette';
import { planTrial, TRIAL_SIZES, TRIALS } from '../../src/scenes/arena/trials';
import { TRIAL_LINES, TRIAL_NAMES, TRIAL_VICTORY, ARENA_WHOLE } from '../../src/story';
import { PARENT } from '../../src/ui/app';
import { SCENE_ROUTES } from '../../src/ui/playable';
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

function planFor(p: Profile, trial: TrialId, level: LevelId, seed = 7): BossPlan {
  const rng = seeded(seed);
  return planTrial(trial, {
    layout: p.layout,
    keys: knownKeysOf(p),
    level,
    words: levelWordSource(p, LEVELS[level], DIFFICULTIES.steady, rng),
    rng,
  });
}

/** Types every character of the current phase's text, word by word. */
function typePhase(f: BossFight, perfect = true): void {
  const p = f.current;
  for (let i = 0; i < p.words.length; i++) {
    const w = p.words[i] as string;
    for (let k = 0; k < w.length + (i < p.words.length - 1 ? 1 : 0); k++) f.letter();
    f.wordDone(perfect);
  }
}

describe('the trials', () => {
  it('are three bosses of three phases, each testing its own skill', () => {
    expect(TRIAL_IDS).toEqual(['storm', 'glass', 'tide']);
    for (const id of TRIAL_IDS) expect(TRIALS[id].phases).toHaveLength(3);
    // Speed: faster and in bursts. Precision: slips heal. Endurance: a tide.
    expect(TRIALS.storm.phases.every((p) => (p.pace ?? 1) > 1 && (p.rest ?? 0) > 0)).toBe(true);
    expect(TRIALS.glass.phases.every((p) => (p.heal ?? 0) > 0)).toBe(true);
    expect(TRIALS.tide.phases.every((p) => (p.tide ?? 0) > 0)).toBe(true);
    // Each boss has its own music sections in the boss theme.
    const phases = THEMES.boss.phases ?? {};
    for (const id of TRIAL_IDS) {
      for (const p of TRIALS[id].phases) {
        const sections = phases[p.music];
        expect(sections, p.music).toBeDefined();
        for (const s of sections ?? []) expect(THEMES.boss.sections[s]).toBeDefined();
      }
    }
  });

  it('types only learned keys, in every layout, track, level and difficulty (section 8)', () => {
    for (const layout of ['en', 'he'] as const) {
      for (const track of [1, 2] as const) {
        for (const lessons of [14, 30, 60]) {
          const p = pass(player(layout, track), lessons);
          const keys = knownKeysOf(p);
          for (const trial of TRIAL_IDS) {
            for (const level of levelsFor(p)) {
              for (const id of DIFFICULTY_IDS) {
                const rng = seeded(lessons + level.length);
                const plan = planTrial(trial, {
                  layout,
                  keys,
                  level,
                  words: levelWordSource(p, LEVELS[level], DIFFICULTIES[id], rng),
                  rng,
                });
                for (const ch of planChars(plan)) {
                  if (ch === ' ') continue;
                  expect(keys.has(ch), `${trial} ${layout} t${track} ${lessons}: '${ch}'`).toBe(
                    true,
                  );
                }
                for (const ph of plan.phases) {
                  for (const w of ph.words) {
                    const bare = w.replace(/[^\p{L}]/gu, '');
                    if (bare.length > 1) expect(isAllowedWord(bare, layout)).toBe(true);
                  }
                }
              }
            }
          }
        }
      }
    }
  });

  it('sizes each phase by level, longer on harder levels; every phase has weak points', () => {
    const p = pass(player('en'), 60);
    for (const trial of TRIAL_IDS) {
      let last = 0;
      for (const level of LEVEL_IDS) {
        const plan = planFor(p, trial, level);
        expect(plan.boss).toBe(TRIALS[trial].id);
        const n = plan.phases.reduce((k, ph) => k + ph.words.length, 0);
        expect(n).toBeGreaterThanOrEqual(last);
        last = n;
        for (const ph of plan.phases) {
          expect(ph.text).toBe(ph.words.join(' '));
          expect(ph.groups).toHaveLength(ph.words.length);
          expect(ph.weak).toHaveLength(ph.words.length);
          expect(ph.weak.some(Boolean)).toBe(true);
        }
      }
    }
    const storm = planFor(p, 'storm', 'standard');
    // The Storm Bird's first phase comes in bursts of two words.
    expect(storm.phases[0]!.words).toHaveLength(
      TRIAL_SIZES.standard.bursts * TRIAL_SIZES.standard.burst,
    );
    // The Long Tide's last passage is the longest text of all three trials.
    const tide = planFor(p, 'tide', 'hard');
    expect(tide.phases[2]!.words).toHaveLength(TRIAL_SIZES.hard.tideLong);
  });

  it('is winnable on every difficulty, even with slips healing the Golem', () => {
    const p = pass(player('he'), 40);
    for (const trial of TRIAL_IDS) {
      for (const id of DIFFICULTY_IDS) {
        const plan = planFor(p, trial, 'standard', 3);
        const f = new BossFight(plan, DIFFICULTIES[id]);
        let guard = 0;
        while (f.state !== 'victory' && guard++ < 10) {
          for (let i = 0; i < 600; i++) f.update(1 / 60);
          for (let k = 0; k < 5; k++) f.slip();
          typePhase(f, guard % 2 === 0);
          if (f.state === 'transition') f.nextPhase();
        }
        expect(f.state, `${trial} ${id}`).toBe('victory');
        expect(f.health).toBe(0);
      }
    }
  });

  it('the same seed plans the same fight', () => {
    const p = pass(player('en'), 40);
    for (const trial of TRIAL_IDS) {
      expect(planFor(p, trial, 'standard', 11)).toEqual(planFor(p, trial, 'standard', 11));
    }
  });
});

describe('the boss kit for the trials', () => {
  const p = pass(player('en'), 40);

  it('pace makes attacks faster; Calm still has no timers', () => {
    const d = DIFFICULTIES.swift;
    expect(windupSeconds(20, d, 1, 1.5)).toBeLessThan(windupSeconds(20, d, 1));
    expect(windupSeconds(20, DIFFICULTIES.calm, 1, 2)).toBe(Infinity);
  });

  it('the Storm Bird rests after a parried burst before it winds up again', () => {
    const f = new BossFight(planFor(p, 'storm', 'standard'), DIFFICULTIES.swift);
    const ph = f.current;
    // Finish the first burst: the next group's attack waits for the rest to pass.
    let i = 0;
    while (ph.groups[i] === 0) (f.wordDone(true), (i += 1));
    expect(f.resting).toBe(true);
    expect(f.windup).toBe(0);
    // (The burst's last word was a weak point: the stun holds the windup too.)
    const wait = (TRIALS.storm.phases[0]!.rest ?? 0) + STAGGER_SECONDS;
    for (let k = 0; k < 60 * wait + 6; k++) f.update(1 / 60);
    expect(f.resting).toBe(false);
    f.update(0.2);
    expect(f.windup).toBeGreaterThan(0);
  });

  it('a slip heals the Glass Golem, never past what was written, and right letters repay it', () => {
    const f = new BossFight(planFor(p, 'glass', 'standard'), DIFFICULTIES.steady);
    expect(f.slip()).toBe(0); // nothing written yet: nothing to mend
    for (let k = 0; k < 6; k++) f.letter();
    const before = f.health;
    expect(f.slip()).toBeGreaterThan(0);
    expect(f.health).toBeGreaterThan(before);
    for (let k = 0; k < 20; k++) f.slip();
    expect(f.healed).toBeLessThanOrEqual(6);
    expect(f.healed).toBeLessThanOrEqual(f.current.text.length * HEAL_CAP);
    const healed = f.healed;
    f.letter();
    expect(f.healed).toBeLessThan(healed);
    // Other bosses never heal.
    const s = new BossFight(planFor(p, 'storm', 'standard'), DIFFICULTIES.steady);
    s.letter();
    expect(s.slip()).toBe(0);
  });

  it('the Long Tide swings the windup speed up and down', () => {
    const f = new BossFight(planFor(p, 'tide', 'standard'), DIFFICULTIES.steady);
    const seen = new Set<number>();
    for (let k = 0; k < 60 * 8; k++) {
      f.update(1 / 60);
      seen.add(Math.sign(Math.round(f.tideNow * 10)));
      if (f.windup >= 1) break;
    }
    expect(seen.has(1)).toBe(true);
    const g = new BossFight(planFor(p, 'storm', 'standard'), DIFFICULTIES.steady);
    g.update(1);
    expect(g.tideNow).toBe(0);
  });
});

describe('the trials’ ranks', () => {
  it('keeps the best rank per trial, and restores the Arena with the lowest once all are beaten', () => {
    const p = player('en');
    expect(nextTrial(p)).toBe('storm');
    expect(recordTrialRank(p, 'storm', 'S')).toBe(false);
    expect(recordTrialRank(p, 'storm', 'C')).toBe(false);
    expect(trialRank(p, 'storm')).toBe('S');
    expect(nextTrial(p)).toBe('glass');
    expect(recordTrialRank(p, 'glass', 'A')).toBe(false);
    expect(p.story.ranks.arena).toBeUndefined();
    expect(recordTrialRank(p, 'tide', 'B')).toBe(true);
    expect(p.story.ranks.arena).toBe(2);
    expect(nextTrial(p)).toBeNull();
    // A better run later lifts the Arena's rank, but it was already restored.
    expect(recordTrialRank(p, 'tide', 'S')).toBe(false);
    expect(p.story.ranks.arena).toBe(3);
    expect(p.story.ranks[trialKey('tide')]).toBe(4);
  });

  it('the Blank Scroll waits for the restored Arena', () => {
    const p = player('en');
    const scroll = () => regionStatuses(p).find((s) => s.id === 'scroll');
    expect(scroll()?.open).toBe(false);
    for (const id of TRIAL_IDS) recordTrialRank(p, id, 'B');
    expect(scroll()?.open).toBe(true);
  });

  it('the map opens the trials board, and the board leads back to the house', () => {
    expect(SCENE_ROUTES.arena).toBe('trials');
    expect(PARENT.trials).toBe('hub');
    expect(PARENT.trial).toBe('trials');
  });
});

describe('the trials’ look and words', () => {
  it('each boss has its own look and its own skies in both themes', () => {
    const bodies = new Set(['blot', ...TRIAL_IDS].map((id) => LOOKS[id as 'blot'].body));
    expect(bodies.size).toBe(4);
    for (const id of TRIAL_IDS) {
      for (const theme of ['light', 'dark'] as const) {
        const l = lightsFor(id, theme);
        expect(l.p1.skyTop).not.toBe(lightsFor('blot', theme).p1.skyTop);
        expect(l.restored).toBeDefined();
      }
    }
  });

  it('every line is in both languages, from Reb Ezra, Dyo or the narrator, and family-safe', () => {
    const lines = [
      ...TRIAL_IDS.flatMap((id) => Object.values(TRIAL_LINES[id])),
      ...TRIAL_IDS.flatMap((id) => TRIAL_VICTORY[id].beats.flatMap((b) => (b.say ? [b.say] : []))),
    ];
    for (const line of lines) {
      expect(['ezra', 'dyo', 'narrator']).toContain(line.who);
      for (const lang of ['he', 'en'] as const) {
        expect(line.text[lang].length).toBeGreaterThan(3);
        for (const raw of line.text[lang].split(/\s+/)) {
          const w = raw.replace(/[^\p{L}']/gu, '');
          if (w) expect(isAllowedWord(w, lang), `${line.who}: ${w}`).toBe(true);
        }
      }
    }
    for (const id of TRIAL_IDS) {
      expect(TRIAL_NAMES[id].he.length).toBeGreaterThan(2);
      const cues = TRIAL_VICTORY[id].beats.map((b) => b.cue).filter(Boolean);
      expect(cues[0]).toBe('shatter');
      expect(cues.at(-1)).toBe('card');
    }
    expect(ARENA_WHOLE.en.length).toBeGreaterThan(3);
  });

  it('every phase name and hint is in both locales', () => {
    const keys = TRIAL_IDS.flatMap((id) =>
      ['p1', 'p2', 'p3'].flatMap((ph) => [`trials.${id}.${ph}`, `trials.${id}.how.${ph}`]),
    );
    for (const k of [...keys, 'trials.title', 'trials.whole', 'trials.results.whole']) {
      expect((en as Record<string, string>)[k], k).toBeTruthy();
      expect((he as Record<string, string>)[k], k).toBeTruthy();
    }
  });
});
