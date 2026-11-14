import { describe, expect, it } from 'vitest';
import {
  achievementsOf,
  activityOf,
  dayIndex,
  errorPatterns,
  journalCounts,
  journalOf,
  keyHeat,
  keysMastered,
  recordRegionRank,
  sessionRows,
  splitDuration,
  summarizeHistory,
  trackSummary,
  trendSeries,
  ACHIEVEMENT_IDS,
} from '../../src/game';
import { getTrack, recordLessonResult } from '../../src/learn';
import { createProfile, type HistoryEntry, type Profile } from '../../src/save';
import { JOURNAL_PEOPLE, PEOPLE_NOTES, TIPS } from '../../src/story';

const DAY = 86_400_000;

function player(): Profile {
  const p = createProfile('a', 'A', 0);
  p.layout = 'en';
  p.settings.uiLanguage = 'en';
  return p;
}

function run(at: number, wpm: number, accuracy: number, extra: Partial<HistoryEntry> = {}) {
  return {
    at,
    track: 1,
    mode: 'lesson:1.1',
    wpm,
    accuracy,
    durationMs: 60_000,
    chars: 100,
    ...extra,
  } as HistoryEntry;
}

/** Passes the first `n` lessons of the track, in order. */
function pass(p: Profile, n: number): void {
  const t = getTrack(p.track);
  let left = n;
  for (const lv of t.levels(p.layout, p.settings.uiLanguage))
    for (const l of t.lessons(lv.id, p.layout, p.settings.uiLanguage)) {
      if (left-- <= 0) return;
      recordLessonResult(p, l.id, { wpm: 30, accuracy: 96, stars: 2 });
    }
}

describe('summarizeHistory', () => {
  it('is all zero for no runs', () => {
    expect(summarizeHistory([])).toEqual({
      sessions: 0,
      totalMs: 0,
      chars: 0,
      avgWpm: 0,
      bestWpm: 0,
      avgAccuracy: 0,
      bestAccuracy: 0,
    });
  });

  it('adds up time and characters and averages speed and accuracy', () => {
    const s = summarizeHistory([run(1, 20, 90), run(2, 30, 100), run(3, 25, 95.5)]);
    expect(s.sessions).toBe(3);
    expect(s.totalMs).toBe(180_000);
    expect(s.chars).toBe(300);
    expect(s.avgWpm).toBe(25);
    expect(s.bestWpm).toBe(30);
    expect(s.avgAccuracy).toBe(95.2);
    expect(s.bestAccuracy).toBe(100);
  });
});

describe('trendSeries', () => {
  it('keeps the newest runs, oldest first', () => {
    const h = [10, 20, 30, 40].map((w, i) => run(i, w, 90 + i));
    expect(trendSeries(h, 3)).toEqual({ wpm: [20, 30, 40], accuracy: [91, 92, 93] });
  });

  it('skips runs shorter than the minimum', () => {
    const h = [run(1, 10, 90, { durationMs: 1000 }), run(2, 20, 95)];
    expect(trendSeries(h, 10, 5000).wpm).toEqual([20]);
  });
});

describe('time and activity', () => {
  it('splits a duration into hours and minutes', () => {
    expect(splitDuration(0)).toEqual({ hours: 0, minutes: 0 });
    expect(splitDuration(59_999)).toEqual({ hours: 0, minutes: 0 });
    expect(splitDuration(3_725_000)).toEqual({ hours: 1, minutes: 2 });
    expect(splitDuration(-5)).toEqual({ hours: 0, minutes: 0 });
  });

  it('counts a local day from the time-zone offset', () => {
    // 23:30 UTC is already the next day in a zone 60 minutes ahead (offset -60).
    const t = 10 * DAY + 23.5 * 3_600_000;
    expect(dayIndex(t, 0)).toBe(10);
    expect(dayIndex(t, -60)).toBe(11);
  });

  it('counts active days and the current streak', () => {
    const now = 20 * DAY + 5_000;
    const h = [run(17 * DAY, 10, 90), run(18 * DAY, 10, 90), run(19 * DAY, 10, 90)];
    expect(activityOf(h, now)).toEqual({ days: 3, streak: 3 });
    // A run today extends it; two runs on one day count once.
    const withToday = [...h, run(20 * DAY, 10, 90), run(20 * DAY + 10, 10, 90)];
    expect(activityOf(withToday, now)).toEqual({ days: 4, streak: 4 });
    // A gap breaks it.
    expect(activityOf([run(15 * DAY, 10, 90)], now)).toEqual({ days: 1, streak: 0 });
    expect(activityOf([], now)).toEqual({ days: 0, streak: 0 });
  });
});

describe('keys: mastery, heat and errors', () => {
  function withKeys(): Profile {
    const p = player();
    pass(p, 3);
    return p;
  }

  it('has nothing to report before any key is typed', () => {
    const p = withKeys();
    expect(keysMastered(p).mastered).toBe(0);
    expect(keysMastered(p).known).toBeGreaterThan(0);
    expect(keyHeat(p)).toEqual({});
  });

  it('counts mastered keys and builds heat by physical key', () => {
    const p = withKeys();
    p.keys.f = { hits: 50, misses: 0, avgMs: 200, lastSeen: 1, ease: 2.5, due: 0, confusions: {} };
    p.keys.j = {
      hits: 10,
      misses: 10,
      avgMs: 800,
      lastSeen: 1,
      ease: 2.5,
      due: 0,
      confusions: { d: 4, f: 2 },
    };
    expect(keysMastered(p).mastered).toBe(1);
    const heat = keyHeat(p);
    expect(heat.KeyF).toBeLessThan(0.2);
    expect(heat.KeyJ).toBeGreaterThan(0.5);
    expect(heat.KeyD).toBeUndefined();
    expect(errorPatterns(p, 1)).toEqual([{ expected: 'j', typed: 'd', count: 4 }]);
  });

  it('ignores keys with too few attempts', () => {
    const p = withKeys();
    p.keys.f = { hits: 1, misses: 0, avgMs: 200, lastSeen: 1, ease: 2.5, due: 0, confusions: {} };
    expect(keyHeat(p)).toEqual({});
  });
});

describe('trackSummary', () => {
  it('counts passed lessons and stars per level, per track and language', () => {
    const p = player();
    pass(p, 4);
    const s = trackSummary(p, 1, 'en');
    expect(s.done).toBe(4);
    expect(s.total).toBeGreaterThan(4);
    expect(s.levels[0]).toMatchObject({ done: 3, total: 3, stars: 6, bestWpm: 30 });
    expect(s.levels[1]).toMatchObject({ done: 1, stars: 2 });
    // Another track and another language start empty.
    expect(trackSummary(p, 2, 'en').done).toBe(0);
    expect(trackSummary(p, 1, 'he').done).toBe(0);
  });
});

describe('sessionRows', () => {
  it('lists the newest first and splits the kind of run', () => {
    const rows = sessionRows(
      [
        run(1, 10, 90, { mode: 'lesson:1.1' }),
        run(2, 20, 95, { mode: 'scene:cliffs:easy' }),
        run(3, 30, 99, { mode: 'practice' }),
        run(4, 40, 99, { mode: 'weird' }),
      ],
      3,
    );
    expect(rows.map((r) => r.at)).toEqual([4, 3, 2]);
    expect(rows[1]).toMatchObject({ kind: 'practice', detail: '' });
    expect(rows[2]).toMatchObject({ kind: 'scene', detail: 'cliffs:easy' });
    expect(rows[0]).toMatchObject({ kind: 'other', detail: 'weird' });
  });
});

describe('achievements', () => {
  const ctx = { now: 20 * DAY };
  const earned = (p: Profile): string[] =>
    achievementsOf(p, ctx)
      .filter((a) => a.earned)
      .map((a) => a.id);

  it('lists every achievement and earns none for a new player', () => {
    const list = achievementsOf(player(), ctx);
    expect(list.map((a) => a.id)).toEqual([...ACHIEVEMENT_IDS]);
    expect(earned(player())).toEqual([]);
  });

  it('earns from lessons, speed, runs and a clean run', () => {
    const p = player();
    pass(p, 1);
    p.history = Array.from({ length: 10 }, (_, i) => run(i, 41, 100, { chars: 40 }));
    const got = earned(p);
    expect(got).toEqual(
      expect.arrayContaining(['firstLesson', 'tenRuns', 'speed20', 'speed40', 'steady']),
    );
    expect(got).not.toContain('speed60');
    expect(got).not.toContain('fiftyRuns');
  });

  it('shows partial progress without going over the goal', () => {
    const p = player();
    p.history = Array.from({ length: 60 }, (_, i) => run(i, 10, 90));
    const runs = achievementsOf(p, ctx).find((a) => a.id === 'fiftyRuns');
    expect(runs).toMatchObject({ earned: true, progress: 50, goal: 50 });
    const ten = achievementsOf(player(), ctx).find((a) => a.id === 'tenRuns');
    expect(ten).toMatchObject({ earned: false, progress: 0, goal: 10 });
  });

  it('earns the streak and the region achievements', () => {
    const p = player();
    p.history = [17, 18, 19].map((d) => run(d * DAY, 10, 90));
    recordRegionRank(p, 'meadow', 'S');
    const got = earned(p);
    expect(got).toEqual(expect.arrayContaining(['streak3', 'firstRegion', 'rankS']));
    expect(got).not.toContain('fiveRegions');
  });
});

describe('journal', () => {
  it('opens only what the player has reached', () => {
    const p = player();
    const j = journalOf(p);
    expect(j.people.filter((e) => e.open)).toEqual([]);
    expect(j.places.find((e) => e.id === 'meadow')).toMatchObject({ open: true, restored: false });
    expect(j.places.find((e) => e.id === 'shuk')?.open).toBe(false);
    expect(j.tips.filter((t) => t.open).map((t) => t.level)).toEqual([1, 1, 1]);
  });

  it('opens people with the intro and with restored regions', () => {
    const p = player();
    p.story.flags.intro = true;
    recordRegionRank(p, 'rail', 'B');
    const open = journalOf(p)
      .people.filter((e) => e.open)
      .map((e) => e.id);
    expect(open).toEqual(['ezra', 'dyo', 'naftali']);
    expect(journalOf(p).places.find((e) => e.id === 'rail')).toMatchObject({ restored: true });
  });

  it('opens more tips as the course goes on and counts entries', () => {
    const p = player();
    const before = journalCounts(journalOf(p));
    pass(p, 30);
    const after = journalCounts(journalOf(p));
    expect(after.total).toBe(before.total);
    expect(after.open).toBeGreaterThan(before.open);
  });

  it('has a note for every person and clean text in both languages', () => {
    const lines = [
      ...JOURNAL_PEOPLE.flatMap((id) => [PEOPLE_NOTES[id].he, PEOPLE_NOTES[id].en]),
      ...TIPS.flatMap((t) => [t.text.he, t.text.en]),
    ];
    for (const line of lines) expect(line.trim().length).toBeGreaterThan(10);
    // No woman, nothing suggestive (ARCHITECTURE section 8).
    expect(lines.join(' ')).not.toMatch(/\b(she|her|woman|women|girl|lady)\b|אישה|נשים|בחורה/i);
    expect(new Set(TIPS.map((t) => t.id)).size).toBe(TIPS.length);
  });
});
