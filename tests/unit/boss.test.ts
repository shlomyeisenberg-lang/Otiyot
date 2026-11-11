import { describe, expect, it } from 'vitest';
import type { Metrics } from '../../src/core';
import {
  BOSS_PACE,
  BossFight,
  CALM_HOVER,
  checkpointFlag,
  checkpointOf,
  clearCheckpoints,
  groupCount,
  groupSpan,
  keepsCheckpoints,
  mergeMetrics,
  STAGGER_SECONDS,
  windupSeconds,
  type BossPlan,
} from '../../src/game/boss';
import { DIFFICULTIES, DIFFICULTY_IDS } from '../../src/game/difficulty';
import { LEVEL_IDS, LEVELS, levelWordSource, levelsFor } from '../../src/game/levels';
import { REGIONS } from '../../src/game/regions';
import { getTrack, knownKeysOf, recordLessonResult } from '../../src/learn';
import { isAllowedWord } from '../../src/learn/content';
import { createProfile, type Profile } from '../../src/save';
import { GREAT_BLOT, planChars, planGreatBlot, SIZES } from '../../src/scenes/arena/plan';
import { ARENA_LINES, arenaLine, BLOT_VICTORY, PHASE_NAMES } from '../../src/story';
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

function planFor(p: Profile, level: 'easy' | 'standard' | 'hard', seed = 7): BossPlan {
  const rng = seeded(seed);
  const d = DIFFICULTIES.steady;
  return planGreatBlot({
    layout: p.layout,
    keys: knownKeysOf(p),
    level,
    words: levelWordSource(p, LEVELS[level], d, rng),
    rng,
  });
}

/** A tiny hand-made plan: two phases, two groups each. */
function tiny(): BossPlan {
  const defs = GREAT_BLOT.phases;
  return {
    boss: 'test',
    phases: [
      {
        def: defs[0]!,
        words: ['ab', 'cd', 'ef'],
        groups: [0, 0, 1],
        weak: [false, true, false],
        text: 'ab cd ef',
      },
      {
        def: defs[1]!,
        words: ['gh', 'ij'],
        groups: [0, 1],
        weak: [false, false],
        text: 'gh ij',
      },
    ],
  };
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

describe('the boss kit', () => {
  it('splits a phase into attack groups', () => {
    const p = tiny().phases[0]!;
    expect(groupCount(p)).toBe(2);
    expect(groupSpan(p, 0)).toEqual([0, 2]);
    expect(groupSpan(p, 1)).toEqual([2, 3]);
  });

  it('times attacks by the difficulty; Calm has no timers', () => {
    expect(BOSS_PACE.calm).toBeNull();
    expect(windupSeconds(20, DIFFICULTIES.calm, 2)).toBe(Infinity);
    const steady = windupSeconds(20, DIFFICULTIES.steady, 2);
    const fierce = windupSeconds(20, DIFFICULTIES.fierce, 2);
    expect(steady).toBeGreaterThan(fierce);
    expect(fierce).toBeGreaterThan(2);
  });

  it('health is the share of the text still unwritten, with a notch per phase', () => {
    const f = new BossFight(tiny(), DIFFICULTIES.steady);
    expect(f.health).toBe(1);
    expect(f.notches).toHaveLength(1);
    expect(f.notches[0]).toBeCloseTo(8 / 13);
    f.letter();
    f.letter();
    expect(f.health).toBeCloseTo(11 / 13);
  });

  it('a finished group parries the attack; a perfect weak point staggers the boss', () => {
    const f = new BossFight(tiny(), DIFFICULTIES.steady);
    expect(f.wordDone(true).kind).toBe('none');
    expect(f.weakNow).toBe(true);
    f.update(1);
    const e = f.wordDone(true);
    expect(e).toEqual({ kind: 'parry', group: 0, weak: true });
    expect(f.stagger).toBe(STAGGER_SECONDS);
    expect(f.weakHits).toBe(1);
    // A staggered boss holds its attack.
    const before = f.wind;
    f.update(1);
    expect(f.wind).toBe(before);
  });

  it('an imperfect weak point does not stagger', () => {
    const f = new BossFight(tiny(), DIFFICULTIES.steady);
    f.wordDone(true);
    f.wordDone(false);
    expect(f.weakHits).toBe(0);
    expect(f.stagger).toBe(0);
  });

  it('an attack lands when the windup runs out, then winds up again (never a soft-lock)', () => {
    const f = new BossFight(tiny(), DIFFICULTIES.fierce);
    let lands = 0;
    for (let i = 0; i < 60 * 30; i++) if (f.update(1 / 60).kind === 'land') lands += 1;
    expect(lands).toBeGreaterThan(1);
    expect(f.state).toBe('fight');
    // The fight still ends when the text is typed.
    typePhase(f);
    expect(f.state).toBe('transition');
    f.nextPhase();
    typePhase(f);
    expect(f.state).toBe('victory');
    expect(f.health).toBe(0);
  });

  it('on Calm nothing ever lands: the attack comes close and waits', () => {
    const f = new BossFight(tiny(), DIFFICULTIES.calm);
    for (let i = 0; i < 60 * 120; i++) expect(f.update(1 / 60).kind).toBe('none');
    expect(f.windup).toBeGreaterThan(0.6);
    expect(f.windup).toBeLessThanOrEqual(CALM_HOVER);
  });

  it('phases follow each other through a transition', () => {
    const f = new BossFight(tiny(), DIFFICULTIES.steady);
    typePhase(f);
    expect(f.state).toBe('transition');
    expect(f.windup).toBe(0);
    // Keys and time do nothing between phases.
    expect(f.wordDone(true).kind).toBe('none');
    expect(f.update(5).kind).toBe('none');
    f.nextPhase();
    expect(f.phase).toBe(1);
    expect(f.state).toBe('fight');
    expect(f.health).toBeCloseTo(5 / 13);
  });

  it('starts from a checkpoint with the earlier phases already written', () => {
    const f = new BossFight(tiny(), DIFFICULTIES.steady, 1);
    expect(f.phase).toBe(1);
    expect(f.health).toBeCloseTo(5 / 13);
  });

  it('keeps checkpoints on gentler difficulties only, and forgets them', () => {
    expect(keepsCheckpoints('calm')).toBe(true);
    expect(keepsCheckpoints('swift')).toBe(true);
    expect(keepsCheckpoints('fierce')).toBe(false);
    expect(keepsCheckpoints('trial')).toBe(false);
    const flags: Record<string, boolean> = { intro: true };
    expect(checkpointOf(flags, 'blot', 4)).toBe(0);
    flags[checkpointFlag('blot', 1)] = true;
    flags[checkpointFlag('blot', 2)] = true;
    expect(checkpointOf(flags, 'blot', 4)).toBe(2);
    clearCheckpoints(flags, 'blot');
    expect(checkpointOf(flags, 'blot', 4)).toBe(0);
    expect(flags.intro).toBe(true);
  });

  it('a failed trial ends the fight', () => {
    const f = new BossFight(tiny(), DIFFICULTIES.trial);
    f.fail();
    expect(f.state).toBe('failed');
    expect(f.update(10).kind).toBe('none');
  });

  it('merges the numbers of every phase into one result', () => {
    const m = (keys: number, wrong: number, ms: number): Metrics => ({
      keystrokes: keys,
      correct: keys - wrong,
      incorrect: wrong,
      grossWpm: 0,
      netWpm: 0,
      accuracy: 0,
      consistency: 80,
      elapsedMs: ms,
    });
    const all = mergeMetrics([m(100, 0, 60000), m(100, 10, 60000)]);
    expect(all.keystrokes).toBe(200);
    expect(all.accuracy).toBe(95);
    expect(all.grossWpm).toBeCloseTo(20);
    expect(all.netWpm).toBeCloseTo(15);
    expect(all.consistency).toBe(80);
    expect(mergeMetrics([]).accuracy).toBe(100);
  });
});

describe('the Great Blot', () => {
  it('has four phases: words, sentences, a passage, the twist', () => {
    expect(GREAT_BLOT.phases.map((p) => p.text)).toEqual([
      'words',
      'sentences',
      'passage',
      'twist',
    ]);
    expect(new Set(GREAT_BLOT.phases.map((p) => p.attack)).size).toBe(4);
    expect(GREAT_BLOT.phases.map((p) => p.music)).toEqual(['phase1', 'phase2', 'phase3', 'phase4']);
  });

  it('types only learned keys, in every layout, track, level and difficulty (section 8)', () => {
    for (const layout of ['en', 'he'] as const) {
      for (const track of [1, 2] as const) {
        for (const lessons of [14, 30, 60]) {
          const p = pass(player(layout, track), lessons);
          const keys = knownKeysOf(p);
          for (const level of levelsFor(p)) {
            for (const id of DIFFICULTY_IDS) {
              const rng = seeded(lessons + level.length);
              const plan = planGreatBlot({
                layout,
                keys,
                level,
                words: levelWordSource(p, LEVELS[level], DIFFICULTIES[id], rng),
                rng,
              });
              for (const ch of planChars(plan)) {
                if (ch === ' ') continue;
                expect(keys.has(ch), `${layout} t${track} ${lessons}: '${ch}'`).toBe(true);
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
  });

  it('sizes each phase by level, and gives back Phase I in the mirrored order', () => {
    const p = pass(player('en'), 60);
    for (const level of LEVEL_IDS) {
      const plan = planFor(p, level);
      const [p1, p2, p3, p4] = plan.phases;
      expect(p1!.words).toHaveLength(SIZES[level].words);
      expect(groupCount(p2!)).toBe(SIZES[level].sentences);
      expect(p3!.words).toHaveLength(SIZES[level].passage);
      expect(p4!.words).toEqual([...p1!.words].reverse().slice(0, SIZES[level].twist));
      for (const ph of plan.phases) {
        expect(ph.text).toBe(ph.words.join(' '));
        expect(ph.groups).toHaveLength(ph.words.length);
        expect(ph.weak).toHaveLength(ph.words.length);
        expect(ph.weak.some(Boolean)).toBe(true);
      }
    }
  });

  it('a sentence ends on its weak point; punctuation marks the passage only when learned', () => {
    const fresh = pass(player('en'), 14);
    const keys = knownKeysOf(fresh);
    const plan = planFor(fresh, 'easy');
    const p2 = plan.phases[1]!;
    for (let i = 0; i < p2.words.length; i++) {
      const ends = p2.groups[i] !== p2.groups[i + 1];
      expect(p2.weak[i]).toBe(ends);
    }
    const marks = [',', '.', ';', '!', '?', ':', '-'].filter((m) => keys.has(m));
    const p3 = plan.phases[2]!;
    const punctuated = p3.words.filter((w) => /[,.;!?:-]$/.test(w));
    if (marks.length === 0) expect(punctuated).toHaveLength(0);
    else expect(punctuated.length).toBeGreaterThan(0);
  });

  it('is winnable on every difficulty: typing the whole text always ends in victory', () => {
    const p = pass(player('he'), 40);
    for (const id of DIFFICULTY_IDS) {
      const plan = planFor(p, 'standard', 3);
      const f = new BossFight(plan, DIFFICULTIES[id]);
      let guard = 0;
      while (f.state !== 'victory' && guard++ < 10) {
        // The player dawdles: attacks land, but nothing stops the fight.
        for (let i = 0; i < 600; i++) f.update(1 / 60);
        typePhase(f, guard % 2 === 0);
        if (f.state === 'transition') f.nextPhase();
      }
      expect(f.state).toBe('victory');
      expect(f.health).toBe(0);
    }
  });

  it('the same seed plans the same fight', () => {
    const p = pass(player('en'), 40);
    expect(planFor(p, 'standard', 11)).toEqual(planFor(p, 'standard', 11));
  });
});

describe('the arena on the map', () => {
  it('the Great Blot is Act One’s last region and opens after the Cliffs', () => {
    const blot = REGIONS.find((r) => r.id === 'blot');
    expect(blot?.act).toBe(1);
    expect(blot?.need).toEqual({ kind: 'region', region: 'cliffs' });
    for (const r of REGIONS.filter((x) => x.act === 2)) expect(r.after).toBe('blot');
  });

  it('has a route back to the house and a playable entry', () => {
    expect(SCENE_ROUTES.blot).toBe('arena');
    expect(PARENT.arena).toBe('hub');
    expect(playableRegions().has('blot')).toBe(true);
  });
});

describe('what is said in the arena', () => {
  it('every line is in both languages, from Reb Ezra, Dyo or the narrator, and family-safe', () => {
    const lines = [
      ...Object.values(ARENA_LINES).flat(),
      ...BLOT_VICTORY.beats.flatMap((b) => (b.say ? [b.say] : [])),
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
    expect(arenaLine('land', 0)).not.toBe(arenaLine('land', 1));
    expect(Object.keys(PHASE_NAMES)).toEqual(['p1', 'p2', 'p3', 'p4']);
  });

  it('the victory cutscene shatters the Blot, restores the arena, then shows the act card', () => {
    const cues = BLOT_VICTORY.beats.map((b) => b.cue).filter(Boolean);
    expect(cues[0]).toBe('shatter');
    expect(cues.indexOf('restore')).toBeGreaterThan(0);
    expect(cues.at(-1)).toBe('card');
  });
});
