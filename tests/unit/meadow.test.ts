import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, DIFFICULTY_IDS } from '../../src/game/difficulty';
import { LEVEL_IDS, LEVELS, levelWordSource, levelsFor } from '../../src/game/levels';
import { getTrack, knownKeysOf, recordLessonResult } from '../../src/learn';
import { isAllowedWord } from '../../src/learn/content';
import { createProfile, type Profile } from '../../src/save';
import {
  BIRD_STAGES,
  birdStage,
  CHAPTER_WORDS,
  chapterAt,
  chapterStartsAt,
  flowersOpen,
  GREEN_END,
  GREEN_START,
  greenRadius,
  homePlots,
  LESSON_MAX_WORDS,
  lessonLetters,
  lessonWords,
  planMeadow,
} from '../../src/scenes/meadow/plan';
import { MEADOW_LINES, meadowLine } from '../../src/story';
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

/** Passes the first `n` lessons of the track, in order. */
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

describe('the home-row garden', () => {
  it('has eight beds in the physical order of the keys, with the bumps on the index fingers', () => {
    const en = homePlots('en', new Set('fj'));
    expect(en.map((p) => p.char).join('')).toBe('asdfjkl;');
    expect(en.filter((p) => p.bump).map((p) => p.char)).toEqual(['f', 'j']);
    expect(en.filter((p) => p.learned).map((p) => p.char)).toEqual(['f', 'j']);
    expect(en.map((p) => p.finger)).toEqual(['lp', 'lr', 'lm', 'li', 'ri', 'rm', 'rr', 'rp']);
    const he = homePlots('he', new Set('שדגכחלךף'));
    expect(he.map((p) => p.char).join('')).toBe('שדגכחלךף');
    expect(he.every((p) => p.learned)).toBe(true);
  });

  it('teaches the index fingers first and works outward', () => {
    expect(lessonLetters('en', new Set('asdfjkl;'))).toEqual(['f', 'j', 'd', 'k', 's', 'l', 'a']);
    expect(lessonLetters('en', new Set('fj'))).toEqual(['f', 'j']);
  });

  it('falls back to the letters a player knows when none are on the home row', () => {
    const letters = lessonLetters('en', new Set('etq '));
    expect(letters.length).toBeGreaterThanOrEqual(2);
    expect(letters.every((ch) => 'etq'.includes(ch))).toBe(true);
  });
});

describe('the Meadow run: learned letters only', () => {
  it('never asks for a key the player has not learned, at any point in either course', () => {
    for (const layout of ['en', 'he'] as const) {
      for (const track of [1, 2] as const) {
        for (const lessons of [0, 1, 3, 8, 20, 60]) {
          const p = pass(player(layout, track), lessons);
          const keys = knownKeysOf(p);
          for (const level of levelsFor(p)) {
            for (const id of DIFFICULTY_IDS) {
              for (const tutorial of [true, false]) {
                const rng = seeded(lessons * 31 + 7);
                const words = levelWordSource(p, LEVELS[level], DIFFICULTIES[id], rng);
                const plan = planMeadow({ layout, keys, level, tutorial, words });
                expect(plan.words.length).toBeGreaterThan(0);
                for (const w of plan.words) {
                  expect(w.length).toBeGreaterThan(0);
                  for (const ch of w) expect(keys.has(ch), `${layout} ${track} ${w}`).toBe(true);
                  expect(isAllowedWord(w, layout)).toBe(true);
                }
                expect(plan.text).toBe(plan.words.join(' '));
                expect(plan.letters).toBe(plan.words.reduce((n, w) => n + [...w].length, 0));
              }
            }
          }
        }
      }
    }
  });

  it('lays out the lesson, then the two word chapters, with no gaps', () => {
    const p = player('en');
    const keys = knownKeysOf(p);
    const words = levelWordSource(p, LEVELS.easy, DIFFICULTIES.calm, seeded(3));
    const plan = planMeadow({ layout: 'en', keys, level: 'easy', tutorial: true, words });
    expect(plan.chapters.map((c) => c.id)).toEqual(['hands', 'look', 'flow']);
    expect(plan.chapters[0]?.from).toBe(0);
    for (let i = 1; i < plan.chapters.length; i++) {
      expect(plan.chapters[i]?.from).toBe(plan.chapters[i - 1]?.to);
    }
    expect(plan.chapters.at(-1)?.to).toBe(plan.words.length);
    const [, look, flow] = plan.chapters;
    expect((look?.to ?? 0) - (look?.from ?? 0)).toBe(CHAPTER_WORDS.easy.look);
    expect((flow?.to ?? 0) - (flow?.from ?? 0)).toBe(CHAPTER_WORDS.easy.flow);
    expect(chapterAt(plan, 0)).toBe('hands');
    expect(chapterAt(plan, look?.from ?? 0)).toBe('look');
    expect(chapterAt(plan, plan.words.length)).toBe('flow');
    expect(chapterStartsAt(plan, flow?.from ?? 0)).toBe('flow');
    expect(chapterStartsAt(plan, (flow?.from ?? 0) + 1)).toBeNull();
    // Never the same word twice in a row.
    for (let i = 1; i < plan.words.length; i++) expect(plan.words[i]).not.toBe(plan.words[i - 1]);
  });

  it('leaves the lesson out when it is skipped, and keeps it short when it runs', () => {
    const p = pass(player('he'), 12);
    const keys = knownKeysOf(p);
    const words = levelWordSource(p, LEVELS.easy, DIFFICULTIES.steady, seeded(5));
    const plan = planMeadow({ layout: 'he', keys, level: 'easy', tutorial: false, words });
    expect(plan.chapters.map((c) => c.id)).toEqual(['look', 'flow']);
    expect(plan.tutorial).toBe(false);
    const lesson = lessonWords('he', keys);
    expect(lesson.length).toBeGreaterThan(0);
    expect(lesson.length).toBeLessThanOrEqual(LESSON_MAX_WORDS);
  });

  it('has more words on harder levels', () => {
    for (let i = 1; i < LEVEL_IDS.length; i++) {
      const a = CHAPTER_WORDS[LEVEL_IDS[i - 1] as 'easy'];
      const b = CHAPTER_WORDS[LEVEL_IDS[i] as 'easy'];
      expect(b.look + b.flow).toBeGreaterThan(a.look + a.flow);
    }
  });
});

describe('how the meadow answers', () => {
  it('spreads the green with every word, all the way by the end', () => {
    let last = 0;
    for (let w = 0; w <= 24; w++) {
      const r = greenRadius(w, 24);
      expect(r).toBeGreaterThan(last);
      last = r;
    }
    expect(greenRadius(0, 24)).toBe(GREEN_START);
    expect(greenRadius(24, 24)).toBe(GREEN_END);
    expect(greenRadius(3, 0)).toBe(GREEN_END);
  });

  it('opens at least one flower per letter and every flower by the last letter', () => {
    let last = 0;
    for (let n = 0; n <= 90; n++) {
      const open = flowersOpen(n, 90, 640);
      expect(open).toBeGreaterThanOrEqual(last);
      expect(open).toBeGreaterThanOrEqual(Math.min(n, 640));
      expect(open).toBeLessThanOrEqual(640);
      last = open;
    }
    expect(flowersOpen(90, 90, 640)).toBe(640);
    expect(flowersOpen(5, 2000, 10)).toBe(5);
  });

  it('brings the birds back in three steps', () => {
    expect(birdStage(0, 24)).toBe(0);
    expect(birdStage(24, 24)).toBe(BIRD_STAGES.length);
    let last = 0;
    for (let w = 0; w <= 24; w++) {
      const s = birdStage(w, 24);
      expect(s - last).toBeLessThanOrEqual(1);
      expect(s).toBeGreaterThanOrEqual(last);
      last = s;
    }
  });
});

describe('what Reb Ezra and Dyo say in the Meadow', () => {
  it('has a line in both languages for every moment, spoken by Reb Ezra or Dyo', () => {
    for (const [moment, lines] of Object.entries(MEADOW_LINES)) {
      expect(lines.length, moment).toBeGreaterThan(0);
      for (const line of lines) {
        expect(['ezra', 'dyo']).toContain(line.who);
        expect(line.text.he.trim().length).toBeGreaterThan(0);
        expect(line.text.en.trim().length).toBeGreaterThan(0);
        expect(/[֐-׿]/.test(line.text.he)).toBe(true);
      }
    }
    expect(meadowLine('slip', 0)).not.toBe(meadowLine('slip', 1));
    expect(meadowLine('slip', 2)).toBe(meadowLine('slip', 0));
  });
});

describe('the Meadow on the map', () => {
  it('is playable from the hub and leads back to it', () => {
    expect(SCENE_ROUTES.meadow).toBe('meadow');
    expect(playableRegions().has('meadow')).toBe(true);
    expect(PARENT.meadow).toBe('hub');
  });
});
