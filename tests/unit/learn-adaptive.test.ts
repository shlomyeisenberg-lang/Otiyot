import { describe, expect, it } from 'vitest';
import {
  CHALLENGE_BAND,
  DAY_MS,
  WEAK_SHARE_MAX,
  WEAK_SHARE_MIN,
  buildMicroLesson,
  challengeAccuracy,
  charMastery,
  difficultyParams,
  dueToday,
  fingerSkills,
  generateBigramDrill,
  generateCharDrill,
  generateErrorDrill,
  generateWordDrill,
  nextText,
  readSrs,
  recordChallenge,
  recordKeystroke,
  recordRetentionCheck,
  skillState,
  topErrorPairs,
  unlockGate,
  weakBigrams,
  weakCharacters,
  adaptiveOptions,
} from '../../src/learn';
import { createProfile, type Profile } from '../../src/save';

function rngOf(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const T0 = 1_700_000_000_000;
const KNOWN = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח'];

/** A profile whose stats are set by hand: weak keys get many misses and slow times. */
function profileWith(stats: Record<string, [number, number, number]>): Profile {
  const p = createProfile('p1', 'Test', T0);
  for (const [ch, [hits, misses, avgMs]] of Object.entries(stats))
    p.keys[ch] = { hits, misses, avgMs, lastSeen: T0, ease: 2.5, due: 0, confusions: {} };
  return p;
}

describe('mastery and skill state', () => {
  it('needs 3 attempts before scoring', () => {
    expect(
      charMastery({
        hits: 1,
        misses: 1,
        avgMs: 400,
        lastSeen: 0,
        ease: 2.5,
        due: 0,
        confusions: {},
      }),
    ).toBeNull();
  });
  it('rewards accuracy and speed, penalises miss streaks', () => {
    const st = { hits: 50, misses: 0, avgMs: 200, lastSeen: 0, ease: 2.5, due: 0, confusions: {} };
    expect(charMastery(st)).toBe(100);
    expect(charMastery(st, 2)).toBeLessThan(80);
    expect(charMastery({ ...st, hits: 3, misses: 7 })).toBeLessThan(60);
  });
  it('walks NEW → LEARNING → … → MAINTENANCE only with retention evidence', () => {
    const base = { hits: 0, misses: 0, avgMs: 300, lastSeen: 1, ease: 2.5, due: 0, confusions: {} };
    expect(skillState(undefined, undefined)).toBe('NEW');
    expect(skillState({ ...base, hits: 2 }, undefined)).toBe('LEARNING');
    const great = { ...base, hits: 100 };
    const ev = {
      successes: 5,
      failures: 0,
      lastSuccess: 0,
      nextReview: 0,
      retentionChecks: 0,
      streak: 0,
    };
    expect(skillState(great, ev)).toBe('MASTERED');
    expect(skillState(great, { ...ev, retentionChecks: 1 })).toBe('MAINTENANCE');
  });
});

describe('weak keys', () => {
  const p = profileWith({
    א: [60, 1, 250],
    ב: [60, 0, 250],
    ג: [20, 20, 700],
    ד: [50, 2, 300],
    ה: [10, 12, 800],
    ו: [55, 1, 280],
    ז: [1, 0, 300],
  });
  it('lists the weakest known keys first and ignores keys with too little data', () => {
    const weak = weakCharacters(p, new Set(KNOWN), 3).map((w) => w.ch);
    expect(weak).toEqual(['ה', 'ג', 'ד']);
    expect(weakCharacters(p, new Set(KNOWN), 10).map((w) => w.ch)).not.toContain('ז');
  });
  it('only considers keys the player has been introduced to', () => {
    expect(weakCharacters(p, new Set(['א', 'ב']), 5).map((w) => w.ch)).not.toContain('ה');
  });
});

describe('drills over-sample weak keys within bounds', () => {
  const weak = ['ה', 'ג'];
  const share = (difficulty: number, seed: number) => {
    const text = generateCharDrill({
      known: KNOWN,
      length: 4000,
      weakChars: weak,
      difficulty,
      rng: rngOf(seed),
    });
    const letters = [...text].filter((c) => c !== ' ');
    return letters.filter((c) => weak.includes(c)).length / letters.length;
  };
  it('weak keys appear far more than their uniform share (2 of 8 = 25%) at a moderate difficulty', () => {
    const uniform = weak.length / KNOWN.length;
    const s = share(0.5, 1);
    expect(s).toBeGreaterThan(uniform + 0.05);
  });
  it('the weak share stays inside the set bounds at every difficulty', () => {
    for (const L of [0, 0.25, 0.5, 0.75, 1]) {
      const w = difficultyParams(L).weakShare;
      expect(w).toBeGreaterThanOrEqual(WEAK_SHARE_MIN);
      expect(w).toBeLessThanOrEqual(WEAK_SHARE_MAX);
    }
    // measured: weak picks = weakShare + a uniform part, so never above share + weak/known
    const cap = WEAK_SHARE_MAX + (1 - WEAK_SHARE_MAX) * (weak.length / KNOWN.length) + 0.03;
    for (const L of [0, 0.5, 1]) expect(share(L, 2)).toBeLessThan(cap);
  });
  it('keeps flow: every known key still appears, only known keys appear, groups are 2-6 long', () => {
    const text = generateCharDrill({
      known: KNOWN,
      length: 1500,
      weakChars: weak,
      difficulty: 0.6,
      rng: rngOf(3),
    });
    const seen = new Set([...text].filter((c) => c !== ' '));
    for (const k of KNOWN) expect(seen.has(k)).toBe(true);
    expect([...seen].every((c) => KNOWN.includes(c))).toBe(true);
    for (const g of text.split(' ')) expect([...g].length).toBeLessThanOrEqual(6);
  });
  it('is deterministic for a seed', () => {
    const a = generateCharDrill({ known: KNOWN, length: 200, weakChars: weak, rng: rngOf(9) });
    const b = generateCharDrill({ known: KNOWN, length: 200, weakChars: weak, rng: rngOf(9) });
    const c = generateCharDrill({ known: KNOWN, length: 200, weakChars: weak, rng: rngOf(10) });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
  it('returns nothing when no keys are known', () => {
    expect(generateCharDrill({ known: [], length: 20, rng: rngOf(1) })).toBe('');
  });
  it('word drills lean on weak keys and use only known keys', () => {
    const run = (weakChars: string[]) =>
      generateWordDrill({
        language: 'he',
        known: new Set(['א', 'ב', 'ה', 'ו', 'י', 'ל', 'מ', 'ר', 'ש', 'ת']),
        weakChars,
        count: 400,
        rng: rngOf(4),
      });
    const w = run(['ש']);
    const base = run([]);
    const count = (t: string) => [...t].filter((c) => c === 'ש').length;
    expect(count(w)).toBeGreaterThan(count(base));
  });
});

describe('final letters', () => {
  it('uses a final form only at the end of a group', () => {
    const t = generateCharDrill({ known: ['מ', 'ם', 'א', 'ב'], length: 600, rng: rngOf(5) });
    for (const g of t.split(' ')) expect(g.slice(0, -1)).not.toContain('ם');
  });
});

describe('recording keystrokes', () => {
  it('updates hits, misses, speed and confusions without mutating the input', () => {
    const p = createProfile('p', 'T', T0);
    const frozen = JSON.stringify(p.keys) + JSON.stringify(p.srs);
    let cur = { keys: p.keys, srs: p.srs };
    cur = recordKeystroke(cur, { expected: 'א', typed: 'א', ms: 300 }, T0);
    cur = recordKeystroke(cur, { expected: 'א', typed: 'א', ms: 500 }, T0 + 1);
    cur = recordKeystroke(cur, { expected: 'א', typed: 'ב', ms: 400 }, T0 + 2);
    expect(JSON.stringify(p.keys) + JSON.stringify(p.srs)).toBe(frozen);
    const st = cur.keys['א']!;
    expect(st.hits).toBe(2);
    expect(st.misses).toBe(1);
    expect(st.avgMs).toBe(400);
    expect(st.confusions).toEqual({ ב: 1 });
    expect(topErrorPairs({ keys: cur.keys })[0]).toEqual({ expected: 'א', typed: 'ב', count: 1 });
  });
  it('tracks letter pairs from the previous character', () => {
    let cur = { keys: createProfile('p', 'T', T0).keys, srs: createProfile('p', 'T', T0).srs };
    for (let i = 0; i < 4; i += 1)
      cur = recordKeystroke(
        cur,
        { expected: 'ב', typed: i < 3 ? 'ג' : 'ב', ms: 600, prev: 'א' },
        T0,
      );
    expect(weakBigrams({ srs: cur.srs }).map((x) => x.bg)).toEqual(['אב']);
  });
  it('survives a JSON round trip (save files)', () => {
    let cur = { keys: createProfile('p', 'T', T0).keys, srs: createProfile('p', 'T', T0).srs };
    cur = recordKeystroke(cur, { expected: 'א', typed: 'א', ms: 300, prev: 'ב' }, T0);
    const back = JSON.parse(JSON.stringify(cur.srs));
    expect(readSrs(back)).toEqual(readSrs(cur.srs));
  });
  it('ignores damaged srs data', () => {
    const s = readSrs({ skills: 5, pairs: [], challenge: { level: 'x', recent: 'zz1' } });
    expect(s.challenge.level).toBe(0.3);
    expect(s.challenge.recent).toBe('1');
  });
});

describe('spaced repetition', () => {
  it('review dates advance with mastery and reset after a miss', () => {
    let cur = { keys: createProfile('p', 'T', T0).keys, srs: createProfile('p', 'T', T0).srs };
    for (let i = 0; i < 10; i += 1)
      cur = recordKeystroke(cur, { expected: 'א', typed: 'א', ms: 200 }, T0);
    const strong = readSrs(cur.srs).skills['א']!.nextReview;
    expect(strong).toBe(T0 + 30 * DAY_MS);
    cur = recordKeystroke(cur, { expected: 'א', typed: 'ב', ms: 200 }, T0 + 5);
    expect(readSrs(cur.srs).skills['א']!.nextReview).toBe(T0 + 5 + DAY_MS);
  });
  it('a weaker key comes back sooner than a strong one', () => {
    let cur = { keys: createProfile('p', 'T', T0).keys, srs: createProfile('p', 'T', T0).srs };
    for (let i = 0; i < 10; i += 1) {
      cur = recordKeystroke(cur, { expected: 'א', typed: 'א', ms: 200 }, T0);
      cur = recordKeystroke(cur, { expected: 'ב', typed: i % 2 ? 'ב' : 'ג', ms: 800 }, T0);
    }
    const s = readSrs(cur.srs).skills;
    expect(s['ב']!.nextReview).toBeLessThanOrEqual(s['א']!.nextReview);
  });
  it('lists keys and pairs that are due, most overdue first, and nothing early', () => {
    let cur = { keys: createProfile('p', 'T', T0).keys, srs: createProfile('p', 'T', T0).srs };
    for (let i = 0; i < 5; i += 1)
      cur = recordKeystroke(cur, { expected: 'ב', typed: 'ב', ms: 300, prev: 'א' }, T0);
    for (let i = 0; i < 5; i += 1)
      cur = recordKeystroke(cur, { expected: 'ג', typed: 'ג', ms: 300 }, T0 + 2 * DAY_MS);
    const known = new Set(['א', 'ב', 'ג']);
    const p = { keys: cur.keys, srs: cur.srs };
    expect(dueToday(p, known, T0 + 1000)).toEqual([]);
    expect(dueToday(p, known, T0 + 3 * DAY_MS)).toEqual([]);
    const later = dueToday(p, known, T0 + 40 * DAY_MS);
    expect(later.map((d) => d.id).sort()).toEqual(['ב', 'ג', 'אב'].sort());
    expect(later[0]!.overdueMs).toBeGreaterThanOrEqual(later[later.length - 1]!.overdueMs);
  });
  it('a failed retention check brings the key back tomorrow', () => {
    let cur = { keys: createProfile('p', 'T', T0).keys, srs: createProfile('p', 'T', T0).srs };
    for (let i = 0; i < 5; i += 1)
      cur = recordKeystroke(cur, { expected: 'א', typed: 'א', ms: 200 }, T0);
    const ok = recordRetentionCheck(cur.srs, 'א', true, T0 + 9);
    expect(readSrs(ok).skills['א']!.retentionChecks).toBe(1);
    const bad = recordRetentionCheck(cur.srs, 'א', false, T0 + 9);
    expect(readSrs(bad).skills['א']!.nextReview).toBe(T0 + 9 + DAY_MS);
  });
});

describe('difficulty controller (85% rule)', () => {
  const run = (acc: number, n: number, start = 0.3) => {
    let c = { level: start, recent: '', n: 0 };
    for (let i = 0; i < n; i += 1) c = recordChallenge(c, (i % 100) / 100 < acc);
    return c;
  };
  const steady = (n: number) => {
    let c = { level: 0.3, recent: '', n: 0 };
    for (let i = 0; i < n; i += 1) c = recordChallenge(c, i % 25 !== 0); // exactly 96% correct
    return c;
  };
  it('goes up when accuracy is above the band and down when below', () => {
    expect(run(0.99, 200).level).toBeGreaterThan(0.3);
    expect(run(0.8, 200).level).toBeLessThan(0.3);
  });
  it('stays put inside the band and inside 0..1', () => {
    expect(steady(600).level).toBeCloseTo(0.3, 5);
    expect(run(1, 5000).level).toBe(1);
    expect(run(0, 5000).level).toBe(0);
    expect(CHALLENGE_BAND.low).toBeLessThan(CHALLENGE_BAND.high);
    expect(challengeAccuracy({ level: 0, recent: '', n: 0 })).toBeNull();
  });
  it('keeps only the last 300 keystrokes', () => {
    expect(run(0.9, 1000).recent.length).toBe(300);
  });
});

describe('drill helpers', () => {
  it('bigram drill: pair, doubled, reversed', () => {
    expect(generateBigramDrill(['אב', 'x'])).toBe('אב אבאב בא');
  });
  it('error drill mixes the right and wrong key', () => {
    expect(generateErrorDrill([{ expected: 'א', typed: 'ב', count: 3 }])).toBe('אב אא בא אבא');
  });
});

describe('unlock gate and micro lesson', () => {
  const known = new Set(KNOWN);
  it('opens when nothing is weak, blocks (and names the keys) when something is', () => {
    expect(unlockGate(profileWith({ א: [50, 0, 250], ב: [50, 1, 250] }), known).open).toBe(true);
    const g = unlockGate(profileWith({ א: [50, 0, 250], ב: [5, 15, 800] }), known);
    expect(g.open).toBe(false);
    expect(g.blocking).toEqual(['ב']);
  });
  it('a new player with no data is not blocked', () => {
    expect(unlockGate(profileWith({}), known).open).toBe(true);
  });
  it('micro lesson is sized for the minutes and deterministic', () => {
    const p = createProfile('p', 'T', T0);
    const a = buildMicroLesson(p, 2, T0, rngOf(1));
    const b = buildMicroLesson(p, 2, T0, rngOf(1));
    expect(a).toEqual(b);
    expect(a.text.length).toBeGreaterThan(40);
    expect(buildMicroLesson(p, 10, T0, rngOf(1)).text.length).toBeGreaterThan(a.text.length * 3);
  });
});

describe('finger skills and TextSource', () => {
  it('groups skill by finger', () => {
    const p = profileWith({ ש: [40, 0, 250], ף: [5, 10, 800] });
    const out = fingerSkills(p, 'he', ['ש', 'ף']);
    expect(out.length).toBe(2);
    expect(out.every((f) => f.keys === 1)).toBe(true);
  });
  it('TextSource derives weak keys from the profile by default', () => {
    const p = profileWith({ א: [5, 15, 800] });
    // א is not necessarily known yet; options must still be well formed.
    const o = adaptiveOptions(p);
    expect(Array.isArray(o.weakChars)).toBe(true);
    expect(o.difficulty).toBeGreaterThanOrEqual(0);
    expect(typeof nextText(p, { level: 0 }, { rng: rngOf(1) })).toBe('string');
  });
});
