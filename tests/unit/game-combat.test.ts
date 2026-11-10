// The combat kit (T11): difficulties, levels that follow the learning, soft combo breaks with
// Steady Hand, seeded wave plans, word-shield targeting and run results.

import { describe, expect, it } from 'vitest';
import {
  CONTACT,
  ComboRules,
  DIFFICULTIES,
  DIFFICULTY_IDS,
  LEVELS,
  LEVEL_IDS,
  TypingDriver,
  WaveFight,
  dropTiers,
  levelWordSource,
  levelsFor,
  planWaves,
  rankOf,
  rewardsOf,
  seeded,
  suggestLevel,
  unlockedLevels,
  wordLengths,
  type CombatListener,
} from '../../src/game';
import { getTrack, knownKeysOf, recordLessonResult } from '../../src/learn';
import { createProfile, type Profile } from '../../src/save';
import { mulberry32 } from './learn-harness';

const T0 = 1_700_000_000_000;

function profile(layout: 'he' | 'en', track: 1 | 2, lessonsPassed: number): Profile {
  const p = createProfile('p1', 'Test', T0);
  p.layout = layout;
  p.track = track;
  p.settings.uiLanguage = layout;
  const lessons = getTrack(track).lessons(1, layout, layout);
  for (const lesson of lessons.slice(0, lessonsPassed)) {
    recordLessonResult(p, lesson.id, { accuracy: 100, wpm: 30 });
  }
  return p;
}

/** A word source that counts from a list, for predictable fights. */
function listSource(words: string[]): { next(): string } {
  let i = 0;
  return { next: () => words[i++ % words.length] as string };
}

const WORDS = ['alef', 'bet', 'gimel', 'dalet', 'hei', 'vav', 'zayin', 'chet', 'tet', 'yud'];

describe('difficulties', () => {
  it('has five, from Calm (no timers) to the Trial (errors fail)', () => {
    expect(DIFFICULTY_IDS).toEqual(['calm', 'steady', 'swift', 'fierce', 'trial']);
    expect(DIFFICULTIES.calm.timers).toBe(false);
    for (const id of DIFFICULTY_IDS.slice(1)) expect(DIFFICULTIES[id].timers).toBe(true);
    expect(DIFFICULTIES.trial.failOnError).toBe(true);
    expect(DIFFICULTY_IDS.filter((id) => DIFFICULTIES[id].failOnError)).toEqual(['trial']);
    // Pace and error cost rise from Steady to Fierce.
    expect(DIFFICULTIES.swift.enemyPace).toBeGreaterThan(DIFFICULTIES.steady.enemyPace);
    expect(DIFFICULTIES.fierce.enemyPace).toBeGreaterThan(DIFFICULTIES.swift.enemyPace);
    expect(DIFFICULTIES.fierce.errorTiers).toBeGreaterThan(DIFFICULTIES.steady.errorTiers);
  });
});

describe('levels follow your learning', () => {
  for (const layout of ['he', 'en'] as const) {
    for (const track of [1, 2] as const) {
      for (const passed of [0, 2, 6, 14, 40]) {
        it(`${layout} track ${track}, ${passed} lessons: shields never ask for an unlearned key`, () => {
          const p = profile(layout, track, passed);
          const known = knownKeysOf(p);
          for (const lv of LEVEL_IDS) {
            for (const d of DIFFICULTY_IDS) {
              const source = levelWordSource(
                p,
                LEVELS[lv],
                DIFFICULTIES[d],
                mulberry32(passed + 3),
              );
              const fight = new WaveFight({
                level: LEVELS[lv],
                difficulty: DIFFICULTIES[d],
                seed: 99,
                words: source,
              });
              // Play the whole fight: every shield that appears, typed or reserved.
              const seen: string[] = [];
              fight.listener = { spawn: (b) => seen.push(b.word) };
              for (let step = 0; step < 6000 && !fight.done; step++) {
                fight.update(1 / 60);
                const t = fight.auto('');
                if (t && step % 20 === 0) fight.wordDone(t.word, true);
              }
              expect(fight.done).toBe(true);
              expect(seen.length).toBeGreaterThanOrEqual(fight.total);
              for (const w of seen) {
                for (const ch of w) expect(known.has(ch), `"${ch}" in "${w}"`).toBe(true);
              }
            }
          }
        });
      }
    }
  }

  it('opens Standard and Hard as letters are learned', () => {
    expect(unlockedLevels(0)).toEqual(['easy']);
    expect(unlockedLevels(LEVELS.standard.needsLetters)).toEqual(['easy', 'standard']);
    expect(unlockedLevels(30)).toEqual(['easy', 'standard', 'hard']);
    expect(levelsFor(profile('en', 1, 0))).toEqual(['easy']);
    expect(levelsFor(profile('en', 2, 40)).length).toBe(3);
  });

  it('makes words longer on harder levels and difficulties', () => {
    const [eMin, eMax] = wordLengths(LEVELS.easy, DIFFICULTIES.calm);
    const [hMin, hMax] = wordLengths(LEVELS.hard, DIFFICULTIES.fierce);
    expect(hMin).toBeGreaterThan(eMin);
    expect(hMax).toBeGreaterThan(eMax);
    expect(hMax).toBeLessThanOrEqual(9);
  });

  it('suggests a level from recent accuracy and speed', () => {
    const all = ['easy', 'standard', 'hard'] as const;
    expect(suggestLevel([], 'easy', all)).toBe('easy');
    // About 90% and getting faster: up.
    const rising = [
      { accuracy: 93, wpm: 18 },
      { accuracy: 95, wpm: 20 },
      { accuracy: 94, wpm: 24 },
    ];
    expect(suggestLevel(rising, 'easy', all)).toBe('standard');
    expect(suggestLevel(rising, 'hard', all)).toBe('hard');
    // Accurate but slowing: stay.
    expect(suggestLevel([...rising].reverse(), 'standard', all)).toBe('standard');
    // Low accuracy: down.
    expect(suggestLevel([{ accuracy: 70, wpm: 30 }], 'standard', all)).toBe('easy');
    // Never a locked level.
    expect(suggestLevel(rising, 'easy', ['easy'])).toBe('easy');
    expect(suggestLevel(rising, 'hard', ['easy', 'standard'])).toBe('standard');
  });
});

describe('combo rules', () => {
  it('breaks softly: back to the floor of a lower tier', () => {
    expect(dropTiers(7, 1)).toBe(0);
    expect(dropTiers(30, 0)).toBe(25);
    expect(dropTiers(30, 1)).toBe(10);
    expect(dropTiers(120, 1)).toBe(50);
    expect(dropTiers(120, 2)).toBe(25);
    expect(dropTiers(120, 9)).toBe(0);
  });

  it('Steady Hand absorbs one error per streak and refills at a new tier', () => {
    const rules = new ComboRules({ errorTiers: 1, steadyHand: 1 });
    let absorbed = 0;
    rules.onAbsorb = () => (absorbed += 1);
    expect(rules.onMiss(5)).toBe(5);
    expect(absorbed).toBe(1);
    expect(rules.onMiss(5)).toBe(0);
    for (let c = 1; c <= 12; c++) rules.onHit(c);
    expect(rules.charges).toBe(1);
    expect(rules.onMiss(12)).toBe(12);
  });

  it('drives the typing driver: an error no longer resets the streak to zero', () => {
    const d = new TypingDriver(listSource(['aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa']), {
      layout: 'en',
      combo: new ComboRules({ errorTiers: 0 }),
    });
    for (let i = 0; i < 12; i++) d.press({ code: 'KeyA', key: 'a', shift: false }, i * 100);
    expect(d.combo).toBe(12);
    d.press({ code: 'KeyS', key: 's', shift: false }, 2000);
    expect(d.combo).toBe(10);
    expect(d.bestCombo).toBe(12);
  });
});

describe('typing driver retarget', () => {
  it('swaps the word only before its first letter', () => {
    const d = new TypingDriver(listSource(['one', 'two']), { layout: 'en' });
    expect(d.word).toBe('one');
    expect(d.retarget('tet', 'bet')).toBe(true);
    expect(d.word).toBe('tet');
    expect(d.lookahead).toBe('bet');
    d.press({ code: 'KeyT', key: 't', shift: false }, 0);
    expect(d.retarget('vav')).toBe(false);
    expect(d.word).toBe('tet');
  });
});

describe('wave fights', () => {
  it('plans the same waves from the same seed, different ones from another', () => {
    const a = planWaves(LEVELS.standard, DIFFICULTIES.swift, 7);
    const b = planWaves(LEVELS.standard, DIFFICULTIES.swift, 7);
    const c = planWaves(LEVELS.standard, DIFFICULTIES.swift, 8);
    expect(a).toEqual(b);
    expect(JSON.stringify(a)).not.toEqual(JSON.stringify(c));
    expect(a.length).toBe(LEVELS.standard.waves);
    expect(a[0]?.pattern).toBe('arc');
    // Each wave has more Blots than the last.
    for (let i = 1; i < a.length; i++) {
      expect(a[i]?.spawns.length).toBeGreaterThan(a[i - 1]?.spawns.length ?? 0);
    }
  });

  it('gives Blots on the field different first letters, so one key picks one target', () => {
    const fight = new WaveFight({
      level: LEVELS.hard,
      difficulty: DIFFICULTIES.calm,
      seed: 3,
      words: listSource(WORDS),
    });
    for (let i = 0; i < 60 * 30; i++) fight.update(1 / 60);
    const firsts = fight.blots.filter((b) => b.active).map((b) => b.word[0]);
    expect(firsts.length).toBeGreaterThan(1);
    expect(new Set(firsts).size).toBe(firsts.length);
  });

  it('locks onto the Blot whose shield starts with the typed letter', () => {
    const fight = new WaveFight({
      level: LEVELS.easy,
      difficulty: DIFFICULTIES.calm,
      seed: 1,
      words: listSource(['bet', 'vav', 'tet']),
    });
    for (let i = 0; i < 60 * 12; i++) fight.update(1 / 60);
    expect(fight.onField).toBe(3);
    expect(fight.pick('v')?.word).toBe('vav');
    expect(fight.pick('x')).toBeNull();
    const events: string[] = [];
    fight.listener = {
      lock: (b) => events.push(`lock ${b.word}`),
      hit: (b) => events.push(`hit ${b.word} ${b.typed}`),
      broken: (b, perfect) => events.push(`break ${b.word} ${perfect}`),
    };
    fight.letter('vav', 0);
    fight.letter('vav', 1);
    fight.letter('vav', 2);
    fight.wordDone('vav', true);
    expect(events).toEqual(['lock vav', 'hit vav 1', 'hit vav 2', 'hit vav 3', 'break vav true']);
    expect(fight.onField).toBe(2);
    expect(fight.broken).toBe(1);
    expect(fight.perfect).toBe(1);
    // The driver's word stays on a Blot that is there; a gone one is replaced by the nearest.
    expect(fight.auto('bet')?.word).toBe('bet');
    expect(['bet', 'tet']).toContain(fight.auto('vav')?.word);
  });

  it('on Calm nothing ever reaches the scribe', () => {
    const fight = new WaveFight({
      level: LEVELS.standard,
      difficulty: DIFFICULTIES.calm,
      seed: 5,
      words: listSource(WORDS),
    });
    for (let i = 0; i < 60 * 300; i++) fight.update(1 / 60);
    expect(fight.smudges).toBe(0);
    for (const b of fight.blots) if (b.active) expect(b.dist).toBeGreaterThan(CONTACT);
  });

  it('on timed difficulties an ignored Blot smudges the scribe and is thrown back', () => {
    const fight = new WaveFight({
      level: LEVELS.easy,
      difficulty: DIFFICULTIES.fierce,
      seed: 5,
      words: listSource(WORDS),
    });
    let smudged = 0;
    fight.listener = { smudge: () => (smudged += 1) };
    for (let i = 0; i < 60 * 30; i++) fight.update(1 / 60);
    expect(smudged).toBeGreaterThan(0);
    expect(fight.smudges).toBe(smudged);
    expect(fight.done).toBe(false);
  });

  it('runs every wave in order and ends when the last Blot breaks', () => {
    const fight = new WaveFight({
      level: LEVELS.easy,
      difficulty: DIFFICULTIES.steady,
      seed: 11,
      words: listSource(WORDS),
    });
    const waves: number[] = [];
    let cleared = 0;
    const listener: CombatListener = {
      wave: (i) => waves.push(i),
      cleared: () => (cleared += 1),
    };
    fight.listener = listener;
    for (let step = 0; step < 60 * 400 && !fight.done; step++) {
      fight.update(1 / 60);
      for (const b of fight.blots) if (b.active && b.age > 1) fight.wordDone(b.word, false);
    }
    expect(fight.done).toBe(true);
    expect(cleared).toBe(1);
    expect(waves).toEqual([0, 1, 2]);
    expect(fight.broken).toBe(fight.total);
    expect(fight.remaining).toBe(0);
  });

  it('typing the shield of a Blot about to appear brings it in and breaks it', () => {
    const fight = new WaveFight({
      level: LEVELS.easy,
      difficulty: DIFFICULTIES.steady,
      seed: 2,
      words: listSource(WORDS),
    });
    const first = fight.auto('')?.word as string;
    expect(fight.onField).toBe(0);
    fight.letter(first, 0);
    expect(fight.onField).toBe(1);
    expect(fight.wordDone(first, true)?.word).toBe(first);
  });

  it('allocates nothing per step once the field is full (same objects)', () => {
    const fight = new WaveFight({
      level: LEVELS.easy,
      difficulty: DIFFICULTIES.calm,
      seed: 4,
      words: listSource(WORDS),
    });
    const before = fight.blots.slice();
    for (let i = 0; i < 600; i++) fight.update(1 / 60);
    expect(fight.blots).toHaveLength(before.length);
    fight.blots.forEach((b, i) => expect(b).toBe(before[i]));
  });

  it('seeded() repeats', () => {
    const a = seeded(42);
    const b = seeded(42);
    for (let i = 0; i < 5; i++) expect(a()).toBe(b());
  });
});

describe('run results', () => {
  const base = {
    accuracy: 99,
    wpm: 40,
    bestCombo: 60,
    words: 30,
    perfect: 25,
    broken: 30,
    smudges: 0,
    failed: false,
  };

  it('ranks by accuracy first, speed second', () => {
    expect(rankOf(99, 40, DIFFICULTIES.swift)).toBe('S');
    expect(rankOf(99, 10, DIFFICULTIES.swift)).toBe('A');
    expect(rankOf(99, 0, DIFFICULTIES.calm)).toBe('S');
    expect(rankOf(95, 80, DIFFICULTIES.swift)).toBe('A');
    expect(rankOf(90, 80, DIFFICULTIES.swift)).toBe('B');
    expect(rankOf(80, 120, DIFFICULTIES.swift)).toBe('C');
    expect(rankOf(100, 100, DIFFICULTIES.trial, true)).toBe('C');
  });

  it('pays glyphs for accuracy, ink for combos, more on harder settings', () => {
    const r = rewardsOf(base, DIFFICULTIES.steady, 'standard');
    expect(r.rank).toBe('S');
    expect(r.xp).toBeGreaterThan(0);
    const sloppy = rewardsOf({ ...base, accuracy: 85 }, DIFFICULTIES.steady, 'standard');
    expect(sloppy.glyphs).toBeLessThan(r.glyphs);
    const shortStreak = rewardsOf({ ...base, bestCombo: 8 }, DIFFICULTIES.steady, 'standard');
    expect(shortStreak.ink).toBeLessThan(r.ink);
    const fierce = rewardsOf(base, DIFFICULTIES.fierce, 'hard');
    expect(fierce.xp).toBeGreaterThan(r.xp);
    const failed = rewardsOf({ ...base, failed: true }, DIFFICULTIES.trial, 'standard');
    expect(failed.rank).toBe('C');
  });
});
