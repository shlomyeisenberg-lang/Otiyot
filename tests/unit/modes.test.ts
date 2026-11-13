import { describe, expect, it } from 'vitest';
import { getTrack, knownKeysOf, recordKeystroke, recordLessonResult } from '../../src/learn';
import { createProfile, type HistoryEntry, type Profile } from '../../src/save';
import { levelWordSource, LEVELS } from '../../src/game/levels';
import { DIFFICULTIES, DIFFICULTY_IDS } from '../../src/game/difficulty';
import {
  bestScoreOf,
  dailyPlan,
  dailyRules,
  dailyScore,
  dateKey,
  entryScore,
  GRIP_MAX,
  learnedOnly,
  mirrorWord,
  MODE_IDS,
  MODIFIER_IDS,
  ModeRun,
  modeHistoryKey,
  modeScore,
  openLevels,
  practiceText,
  rulesFor,
  seededRng,
  seedOf,
  SETTING_REGIONS,
  suddenAfter,
  trackLessons,
  viewOf,
  withModifiers,
  type PracticePlan,
} from '../../src/game/modes';
import { PARENT } from '../../src/ui/app';
import en from '../../locales/en.json';
import he from '../../locales/he.json';

function player(layout: 'en' | 'he', lessons: number): Profile {
  const p = createProfile('a', 'T', 0);
  p.layout = layout;
  p.track = 1;
  p.settings.uiLanguage = layout;
  let done = 0;
  const t = getTrack(p.track);
  for (const lvl of t.levels(p.layout, p.layout)) {
    for (const l of t.lessons(lvl.id, p.layout, p.layout)) {
      if (done >= lessons) return p;
      recordLessonResult(p, l.id, { wpm: 20, accuracy: 100 });
      done += 1;
    }
  }
  return p;
}

/** Gives a few keys a shaky record so weak and due drills have something to lean on. */
function shaky(p: Profile): void {
  const known = [...knownKeysOf(p)].filter((c) => /\p{L}/u.test(c)).slice(0, 4);
  let now = 1_000;
  for (const ch of known) {
    for (let i = 0; i < 6; i += 1) {
      const wrong = i % 2 === 0;
      const r = recordKeystroke(p, { expected: ch, typed: wrong ? 'x' : ch, ms: 700 }, now);
      p.keys = r.keys;
      p.srs = r.srs;
      now += 1000;
    }
  }
}

const DAY = 86_400_000;

describe('seeds', () => {
  it('seedOf and seededRng are stable', () => {
    expect(seedOf('a')).toBe(seedOf('a'));
    expect(seedOf('a')).not.toBe(seedOf('b'));
    const a = seededRng(7);
    const b = seededRng(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it('dateKey is the local date', () => {
    expect(dateKey(new Date(2026, 10, 3))).toBe('2026-11-03');
  });
});

describe('rule sets', () => {
  it('Time Attack is a clock on timed difficulties and a word quota on Calm', () => {
    for (const id of DIFFICULTY_IDS) {
      const r = rulesFor('timeattack', 'standard', id);
      if (DIFFICULTIES[id].timers) {
        expect(r.seconds).toBeGreaterThan(0);
        expect(r.goalWords).toBe(0);
      } else {
        expect(r.seconds).toBe(0);
        expect(r.goalWords).toBeGreaterThan(0);
      }
    }
  });
  it('Time Attack ends when the clock runs out and keeps the words', () => {
    const run = new ModeRun(rulesFor('timeattack', 'easy', 'steady'));
    run.word(true);
    run.word(false);
    run.tick(59_000);
    expect(run.state.ended).toBe(false);
    expect(run.state.timeLeftMs).toBe(1000);
    run.tick(5_000);
    expect(run.state.outcome).toBe('time');
    expect(run.state.timeLeftMs).toBe(0);
    expect(run.finished).toBe(true);
    expect(run.state.words).toBe(2);
    expect(run.state.perfect).toBe(1);
  });
  it('Calm Time Attack ends at its quota with no clock', () => {
    const run = new ModeRun(rulesFor('timeattack', 'easy', 'calm'));
    expect(run.state.timeLeftMs).toBeNull();
    run.tick(10 * 60_000);
    run.key(false);
    expect(run.state.ended).toBe(false);
    for (let i = 0; i < 20; i += 1) run.word(false);
    expect(run.state.outcome).toBe('quota');
  });
  it('Survival drains the grip, words refill it, errors cost it', () => {
    const run = new ModeRun(rulesFor('survival', 'standard', 'steady'));
    expect(run.state.grip).toBe(GRIP_MAX);
    run.tick(10_000);
    const after = run.state.grip as number;
    expect(after).toBeLessThan(GRIP_MAX);
    run.word(true);
    expect(run.state.grip as number).toBeGreaterThan(after);
    const before = run.state.grip as number;
    run.key(false);
    expect(run.state.grip as number).toBeLessThan(before);
    run.key(true);
    expect(run.state.errors).toBe(1);
  });
  it('Survival ends tired when the grip is gone, and crossed at the distance', () => {
    const tired = new ModeRun(rulesFor('survival', 'easy', 'fierce'));
    tired.tick(60_000);
    expect(tired.state.outcome).toBe('tired');
    expect(tired.finished).toBe(false);
    const crossed = new ModeRun(rulesFor('survival', 'easy', 'steady'));
    for (let i = 0; i < 25; i += 1) crossed.word(true);
    expect(crossed.state.outcome).toBe('crossed');
    expect(crossed.finished).toBe(true);
  });
  it('Survival on Calm never tires and is always finishable', () => {
    const run = new ModeRun(rulesFor('survival', 'hard', 'calm'));
    run.tick(30 * 60_000);
    for (let i = 0; i < 100; i += 1) run.key(false);
    expect(run.state.ended).toBe(false);
    expect(run.state.grip).toBe(GRIP_MAX);
    for (let i = 0; i < 50; i += 1) run.word(false);
    expect(run.state.outcome).toBe('crossed');
  });
  it("Sofer's Trial fails on the first wrong key", () => {
    const run = new ModeRun(rulesFor('timeattack', 'easy', 'trial'));
    run.key(true);
    expect(run.state.ended).toBe(false);
    run.key(false);
    expect(run.state.outcome).toBe('failed');
    run.word(true);
    expect(run.state.words).toBe(0);
  });
  it('a steady typist can survive Steady: grip holds at about 14 words a minute', () => {
    const run = new ModeRun(rulesFor('survival', 'standard', 'steady'));
    for (let w = 0; w < 35; w += 1) {
      run.tick(4_300);
      run.word(true);
    }
    expect(run.state.outcome).toBe('crossed');
  });
});

describe('scores and the history', () => {
  it('a clean run beats a fast sloppy one', () => {
    expect(modeScore(500, 99)).toBeGreaterThan(modeScore(600, 85));
    expect(dailyScore(30, 99)).toBeGreaterThan(dailyScore(40, 80));
  });
  it('reads the best score from history entries of one mode', () => {
    const entry = (mode: string, wpm: number, accuracy: number, chars: number): HistoryEntry => ({
      at: 1,
      track: 1,
      mode,
      wpm,
      accuracy,
      durationMs: 1,
      chars,
    });
    const history = [
      entry(modeHistoryKey('timeattack', 'meadow:easy', 'steady'), 20, 95, 300),
      entry(modeHistoryKey('timeattack', 'meadow:easy', 'steady'), 25, 99, 400),
      entry(modeHistoryKey('daily', '2026-11-13'), 30, 97, 200),
      entry('lesson:L0-0', 99, 100, 999),
    ];
    expect(bestScoreOf(history, 'mode:timeattack:')).toBe(modeScore(400, 99));
    expect(bestScoreOf(history, 'mode:daily:2026-11-13')).toBe(dailyScore(30, 97));
    expect(bestScoreOf(history, 'mode:survival:')).toBe(0);
    expect(entryScore(entry('lesson:L0-0', 99, 100, 999))).toBe(0);
  });
});

describe('daily challenge', () => {
  const open = [...SETTING_REGIONS].slice(0, 4);
  it('is the same for the same date and differs across dates', () => {
    const a = dailyPlan('2026-11-13', open, ['easy', 'standard']);
    const b = dailyPlan('2026-11-13', open, ['easy', 'standard']);
    expect(a).toEqual(b);
    const dates = Array.from({ length: 30 }, (_, i) =>
      dailyPlan(`2026-12-${String(i + 1).padStart(2, '0')}`, open, ['easy', 'standard']),
    );
    expect(new Set(dates.map((d) => d.region)).size).toBeGreaterThan(1);
    expect(new Set(dates.map((d) => d.modifiers.join())).size).toBeGreaterThan(2);
  });
  it('only uses what is open, on Steady, with one or two modifiers', () => {
    for (let i = 1; i <= 60; i += 1) {
      const plan = dailyPlan(`2027-01-${String(i).padStart(2, '0')}`, open, ['easy']);
      expect(open).toContain(plan.region);
      expect(plan.level).toBe('easy');
      expect(plan.difficulty).toBe('steady');
      expect(plan.modifiers.length).toBeGreaterThanOrEqual(1);
      expect(plan.modifiers.length).toBeLessThanOrEqual(2);
      expect(new Set(plan.modifiers).size).toBe(plan.modifiers.length);
      const rules = dailyRules(plan);
      expect(rules.seconds).toBe(0);
      expect(rules.goalWords).toBe(plan.words);
    }
  });
  it('falls back to the Meadow when nothing else is open', () => {
    expect(dailyPlan('2026-11-13', [], []).region).toBe('meadow');
  });
});

describe('learned letters only', () => {
  for (const layout of ['en', 'he'] as const) {
    describe(layout, () => {
      for (const lessons of [4, 12, 30]) {
        it(`every typed word uses only learned keys (${lessons} lessons)`, () => {
          const p = player(layout, lessons);
          shaky(p);
          const known = knownKeysOf(p);
          const ok = (text: string): void => {
            for (const ch of text) if (ch !== ' ') expect(known.has(ch)).toBe(true);
          };
          const now = 40 * DAY;
          const plans: PracticePlan[] = [
            { kind: 'weak', minutes: 2 },
            { kind: 'review', minutes: 5 },
            { kind: 'lesson', minutes: 2, lessonId: trackLessons(p)[2]?.id },
            { kind: 'custom', minutes: 2, custom: 'dag lag zzz שלום 123 סלט' },
          ];
          for (const plan of plans) {
            const r = practiceText(p, plan, now, seededRng(3));
            ok(r.text);
          }
          // Time Attack / Survival / Daily words, plain and mirrored.
          const mods = ['mirror' as const];
          for (const level of Object.values(LEVELS)) {
            const base = levelWordSource(p, level, DIFFICULTIES.steady, seededRng(9));
            const src = withModifiers(base, mods, known, layout);
            for (let i = 0; i < 80; i += 1) ok(src.next());
          }
        });
      }
    });
  }
  it('learnedOnly drops words with an unlearned letter', () => {
    const known = new Set(['a', 'b', 's']);
    expect(learnedOnly('abs  sab zab b', known)).toBe('abs sab b');
  });
  it('custom text with no learned words comes back empty', () => {
    const p = player('en', 3);
    expect(
      practiceText(p, { kind: 'custom', minutes: 2, custom: 'qqq zzz' }, 0, seededRng(1)).text,
    ).toBe('');
  });
});

describe('practice drills', () => {
  it('weak keys lean on the weak keys', () => {
    const p = player('en', 12);
    shaky(p);
    const r = practiceText(p, { kind: 'weak', minutes: 2 }, 40 * DAY, seededRng(5));
    expect(r.fallback).toBe(false);
    expect(r.focus.length).toBeGreaterThan(0);
    const hits = [...r.text].filter((c) => r.focus.includes(c)).length;
    expect(hits).toBeGreaterThan(r.text.length / 8);
  });
  it('a fresh player gets a general drill, flagged as a fallback', () => {
    const p = player('en', 6);
    const w = practiceText(p, { kind: 'weak', minutes: 2 }, 0, seededRng(5));
    const d = practiceText(p, { kind: 'review', minutes: 2 }, 0, seededRng(5));
    expect(w.fallback).toBe(true);
    expect(d.fallback).toBe(true);
    expect(w.text.length).toBeGreaterThan(0);
  });
  it('review uses what is due', () => {
    const p = player('en', 12);
    shaky(p);
    const r = practiceText(p, { kind: 'review', minutes: 2 }, 400 * DAY, seededRng(2));
    expect(r.fallback).toBe(false);
    expect(r.text.length).toBeGreaterThan(0);
  });
  it('a lesson drill is that lesson', () => {
    const p = player('en', 20);
    const lesson = trackLessons(p)[1];
    expect(lesson).toBeDefined();
    const r = practiceText(
      p,
      { kind: 'lesson', minutes: 2, lessonId: lesson?.id },
      0,
      seededRng(1),
    );
    expect(r.text.length).toBeGreaterThan(0);
    expect(r.fallback).toBe(false);
  });
  it('is deterministic for a seed', () => {
    const p = player('en', 12);
    shaky(p);
    const plan: PracticePlan = { kind: 'weak', minutes: 2 };
    expect(practiceText(p, plan, 5, seededRng(4)).text).toBe(
      practiceText(p, plan, 5, seededRng(4)).text,
    );
  });
});

describe('modifiers', () => {
  it('mirror reverses the word and keeps Hebrew finals sensible', () => {
    const en = new Set([...'abcdef']);
    expect(mirrorWord('abc', en, 'en')).toBe('cba');
    const he = new Set([...'שלומ']);
    // "שלום" uses a final mem; reversed it starts with the plain mem (learned), never a final.
    const m = mirrorWord('שלום', he, 'he');
    expect(m).toBe('מולש');
    // A final letter that is not learned in its plain form is dropped, never typed.
    const m2 = mirrorWord('שלום', new Set([...'שלוםs']), 'he');
    for (const c of m2) expect(new Set([...'שלוםs']).has(c)).toBe(true);
  });
  it('mirror only changes the words, other modifiers do not', () => {
    const src = { next: () => 'abc' };
    const known = new Set([...'abc']);
    expect(withModifiers(src, ['fog'], known, 'en').next()).toBe('abc');
    expect(withModifiers(src, ['mirror'], known, 'en').next()).toBe('cba');
  });
  it('view flags and the sudden moment', () => {
    expect(viewOf(['noLookahead', 'fog'])).toEqual({ hideLookahead: true, fog: true });
    expect(viewOf(['mirror'])).toEqual({ hideLookahead: false, fog: false });
    for (let s = 0; s < 40; s += 1) {
      const n = suddenAfter(seededRng(s));
      expect(n).toBeGreaterThanOrEqual(4);
      expect(n).toBeLessThanOrEqual(10);
    }
  });
});

describe('mode data', () => {
  it('opens Easy for everyone', () => {
    expect(openLevels(player('en', 0))).toContain('easy');
  });
  it('has the four modes, four modifiers, and locale strings for both languages', () => {
    expect(MODE_IDS).toHaveLength(4);
    expect(MODIFIER_IDS).toHaveLength(4);
    const e = en as Record<string, string>;
    const h = he as Record<string, string>;
    for (const m of MODE_IDS)
      for (const k of [`modes.mode.${m}`, `modes.mode.${m}.body`]) {
        expect(e[k], k).toBeTruthy();
        expect(h[k], k).toBeTruthy();
      }
    for (const m of MODIFIER_IDS)
      for (const k of [`modes.mod.${m}`, `modes.mod.${m}.body`]) {
        expect(e[k], k).toBeTruthy();
        expect(h[k], k).toBeTruthy();
      }
  });
  it('the modes screen leads home to the hub', () => {
    expect(PARENT.modes).toBe('hub');
  });
});
