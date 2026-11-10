// Adaptive engine (T06): per-key and per-finger skill model, weak-key and weak-transition
// selection, spaced repetition and the "85% rule" difficulty controller.
// Ported from reference/plugin-4.2.0/js/adaptive.js and pedagogy.js. Pure logic: no DOM, no
// clock (callers pass `now`), randomness is always an injected `Rng`.

import { fingerForChar, type LayoutId } from '../core';
import type { JsonValue, KeyStat, Profile } from '../save';
import { activeLevelOf, getTrack } from './track';
import { getProgress } from './progress';
import { pickWords } from './library';
import { isLetterChar, randomChoice } from './util';
import { makeContext, type Rng } from './types';

export const DAY_MS = 86400000;
/** Review gaps in days, by mastery stage (same ladder as the plugin). */
export const REVIEW_DAYS = [1, 3, 7, 14, 30] as const;
export const MIN_ATTEMPTS = 3;
/** Share of drill picks taken from weak keys is always inside these bounds. */
export const WEAK_SHARE_MIN = 0.15;
export const WEAK_SHARE_MAX = 0.5;
export const CHALLENGE_WINDOW = 300;
export const CHALLENGE_BAND = { low: 0.92, high: 0.96 } as const;
export const DEFAULT_UNLOCK_SCORE = 70;

export type SkillState =
  'NEW' | 'LEARNING' | 'PRACTICING' | 'DEVELOPING' | 'PROFICIENT' | 'MASTERED' | 'MAINTENANCE';

/** Evidence that a key is really learned: repeated successes plus delayed retention checks. */
export interface SkillEvidence {
  successes: number;
  failures: number;
  lastSuccess: number;
  nextReview: number;
  retentionChecks: number;
  /** Current run of misses in a row (feeds the mastery penalty). */
  streak: number;
}

export interface PairStat {
  hits: number;
  misses: number;
  avgMs: number;
  lastSeen: number;
  nextReview: number;
}

export interface Challenge {
  level: number;
  /** '1' = correct, '0' = wrong; newest last, capped at CHALLENGE_WINDOW. */
  recent: string;
  n: number;
}

/** Typed view of `profile.srs` (stored as plain JSON so no save migration is needed). */
export interface SrsState {
  skills: Record<string, SkillEvidence>;
  pairs: Record<string, PairStat>;
  challenge: Challenge;
}

function num(v: unknown, d = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : d;
}
function rec(v: unknown): Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

export function readSrs(raw: Profile['srs']): SrsState {
  const skills: Record<string, SkillEvidence> = {};
  for (const [k, v] of Object.entries(rec(raw.skills))) {
    const e = rec(v);
    skills[k] = {
      successes: num(e.successes),
      failures: num(e.failures),
      lastSuccess: num(e.lastSuccess),
      nextReview: num(e.nextReview),
      retentionChecks: num(e.retentionChecks),
      streak: num(e.streak),
    };
  }
  const pairs: Record<string, PairStat> = {};
  for (const [k, v] of Object.entries(rec(raw.pairs))) {
    const e = rec(v);
    pairs[k] = {
      hits: num(e.hits),
      misses: num(e.misses),
      avgMs: num(e.avgMs),
      lastSeen: num(e.lastSeen),
      nextReview: num(e.nextReview),
    };
  }
  const c = rec(raw.challenge);
  const level = Math.max(0, Math.min(1, num(c.level, 0.3)));
  const recent =
    typeof c.recent === 'string' ? c.recent.replace(/[^01]/g, '').slice(-CHALLENGE_WINDOW) : '';
  return { skills, pairs, challenge: { level, recent, n: num(c.n) } };
}

export function writeSrs(state: SrsState): Profile['srs'] {
  return {
    skills: state.skills as unknown as JsonValue,
    pairs: state.pairs as unknown as JsonValue,
    challenge: state.challenge as unknown as JsonValue,
  };
}

// ---- mastery ----

function score(hits: number, misses: number, avgMs: number, streak: number): number | null {
  const attempts = hits + misses;
  if (attempts < MIN_ATTEMPTS) return null;
  const accuracy = hits / attempts;
  const speed = Math.max(0, Math.min(1, (900 - avgMs) / 700));
  const penalty = Math.min(1, streak * 0.15);
  return Math.max(0, Math.round((accuracy * 0.7 + speed * 0.3) * 100 * (1 - penalty)));
}

/** 0-100 mastery of one key, or null when there is too little data. */
export function charMastery(stat: KeyStat | undefined, streak = 0): number | null {
  return stat ? score(stat.hits, stat.misses, stat.avgMs, streak) : null;
}

export function pairMastery(stat: PairStat | undefined): number | null {
  return stat ? score(stat.hits, stat.misses, stat.avgMs, 0) : null;
}

export function skillState(stat: KeyStat | undefined, ev: SkillEvidence | undefined): SkillState {
  if (!stat || stat.hits + stat.misses === 0) return 'NEW';
  const m = charMastery(stat, ev?.streak ?? 0);
  if (m === null) return 'LEARNING';
  const e = ev ?? emptyEvidence();
  if (m < 50 || e.failures > e.successes) return 'PRACTICING';
  if (m < 70) return 'DEVELOPING';
  if (m < 85) return 'PROFICIENT';
  if (m < 95 || e.successes < 3 || e.retentionChecks < 1) return 'MASTERED';
  return 'MAINTENANCE';
}

function emptyEvidence(): SkillEvidence {
  return {
    successes: 0,
    failures: 0,
    lastSuccess: 0,
    nextReview: 0,
    retentionChecks: 0,
    streak: 0,
  };
}

/** Index into REVIEW_DAYS for a mastery score. */
export function reviewStage(mastery: number): number {
  return Math.min(REVIEW_DAYS.length - 1, Math.max(0, Math.floor(mastery / 20)));
}

// ---- recording what the player typed ----

export interface Keystroke {
  /** Character that should have been typed. */
  expected: string;
  /** Character actually typed. */
  typed: string;
  /** Time since the previous key, in ms. */
  ms: number;
  /** Previous expected character (for the transition), if any. */
  prev?: string;
}

function mean(prevAvg: number, prevN: number, x: number): number {
  return (prevAvg * prevN + x) / (prevN + 1);
}

/** Returns the updated key stats and spaced-repetition state after one keystroke. Does not mutate. */
export function recordKeystroke(
  profile: Pick<Profile, 'keys' | 'srs'>,
  k: Keystroke,
  now: number,
): { keys: Profile['keys']; srs: Profile['srs'] } {
  const ok = k.expected === k.typed;
  const srs = readSrs(profile.srs);
  const old = profile.keys[k.expected];
  const stat: KeyStat = old
    ? { ...old, confusions: { ...old.confusions } }
    : { hits: 0, misses: 0, avgMs: 0, lastSeen: 0, ease: 2.5, due: 0, confusions: {} };
  const ev: SkillEvidence = { ...(srs.skills[k.expected] ?? emptyEvidence()) };
  if (ok) {
    stat.avgMs = mean(stat.avgMs, stat.hits, k.ms);
    stat.hits += 1;
    ev.successes += 1;
    ev.lastSuccess = now;
    ev.streak = 0;
  } else {
    stat.misses += 1;
    ev.failures += 1;
    ev.streak += 1;
    stat.confusions[k.typed] = (stat.confusions[k.typed] ?? 0) + 1;
  }
  stat.lastSeen = now;
  const m = charMastery(stat, ev.streak) ?? 0;
  ev.nextReview = now + (ok ? (REVIEW_DAYS[reviewStage(m)] as number) : 1) * DAY_MS;
  stat.due = ev.nextReview;
  srs.skills[k.expected] = ev;

  if (k.prev && k.prev !== ' ' && k.expected !== ' ') {
    const bg = k.prev + k.expected;
    const p = {
      ...(srs.pairs[bg] ?? { hits: 0, misses: 0, avgMs: 0, lastSeen: 0, nextReview: 0 }),
    };
    if (ok) {
      p.avgMs = mean(p.avgMs, p.hits, k.ms);
      p.hits += 1;
    } else p.misses += 1;
    p.lastSeen = now;
    const pm = pairMastery(p) ?? 0;
    p.nextReview = now + (ok ? (REVIEW_DAYS[reviewStage(pm)] as number) : 1) * DAY_MS;
    srs.pairs[bg] = p;
  }
  srs.challenge = recordChallenge(srs.challenge, ok);
  return { keys: { ...profile.keys, [k.expected]: stat }, srs: writeSrs(srs) };
}

/** A delayed "do you still know it?" check. A failed check brings the key back tomorrow. */
export function recordRetentionCheck(
  srsRaw: Profile['srs'],
  ch: string,
  retained: boolean,
  now: number,
): Profile['srs'] {
  const srs = readSrs(srsRaw);
  const ev: SkillEvidence = { ...(srs.skills[ch] ?? emptyEvidence()) };
  ev.retentionChecks += 1;
  if (!retained) {
    ev.failures += 1;
    ev.nextReview = now + DAY_MS;
  }
  srs.skills[ch] = ev;
  return writeSrs(srs);
}

// ---- weak keys, weak transitions, error pairs ----

/** Characters the learner has been introduced to on the active track. */
export function knownKeysOf(profile: Profile): Set<string> {
  const completed = getProgress(profile).completed;
  const ctx = makeContext({
    language: profile.layout,
    uiLanguage: profile.settings.uiLanguage,
    completed,
    activeLevel: activeLevelOf(completed),
  });
  return getTrack(profile.track).knownKeys(ctx);
}

export interface Weak {
  ch: string;
  score: number;
  attempts: number;
}

/** The weakest known keys, weakest first. Keys with fewer than 3 attempts are ignored. */
export function weakCharacters(
  profile: Pick<Profile, 'keys' | 'srs'>,
  known: ReadonlySet<string>,
  limit = 5,
): Weak[] {
  const srs = readSrs(profile.srs);
  const out: Weak[] = [];
  for (const ch of known) {
    const st = profile.keys[ch];
    const s = charMastery(st, srs.skills[ch]?.streak ?? 0);
    if (st && s !== null) out.push({ ch, score: s, attempts: st.hits + st.misses });
  }
  out.sort((a, b) => a.score - b.score || a.ch.localeCompare(b.ch));
  return out.slice(0, limit);
}

export interface WeakPair {
  bg: string;
  score: number;
  attempts: number;
}

export function weakBigrams(profile: Pick<Profile, 'srs'>, limit = 6): WeakPair[] {
  const out: WeakPair[] = [];
  for (const [bg, p] of Object.entries(readSrs(profile.srs).pairs)) {
    const s = pairMastery(p);
    if (s !== null) out.push({ bg, score: s, attempts: p.hits + p.misses });
  }
  out.sort((a, b) => a.score - b.score || a.bg.localeCompare(b.bg));
  return out.slice(0, limit);
}

export interface ErrorPair {
  expected: string;
  typed: string;
  count: number;
}

/** Most frequent "typed X instead of Y" mistakes. */
export function topErrorPairs(profile: Pick<Profile, 'keys'>, limit = 6): ErrorPair[] {
  const rows: ErrorPair[] = [];
  for (const [expected, st] of Object.entries(profile.keys))
    for (const [typed, count] of Object.entries(st.confusions))
      rows.push({ expected, typed, count });
  rows.sort(
    (a, b) =>
      b.count - a.count || a.expected.localeCompare(b.expected) || a.typed.localeCompare(b.typed),
  );
  return rows.slice(0, limit);
}

export interface FingerSkill {
  finger: string;
  keys: number;
  mastery: number | null;
  avgMs: number | null;
  accuracy: number | null;
}

/** Skill grouped by finger (accuracy, speed, mastery averaged over the known keys it types). */
export function fingerSkills(
  profile: Pick<Profile, 'keys' | 'srs'>,
  language: LayoutId,
  chars: readonly string[],
): FingerSkill[] {
  const srs = readSrs(profile.srs);
  const groups = new Map<string, string[]>();
  for (const ch of chars) {
    const f = fingerForChar(ch, language);
    if (!f) continue;
    const g = groups.get(f) ?? [];
    g.push(ch);
    groups.set(f, g);
  }
  const out: FingerSkill[] = [];
  for (const [finger, list] of groups) {
    let hits = 0,
      misses = 0,
      ms = 0,
      msN = 0,
      sum = 0,
      sumN = 0;
    for (const ch of list) {
      const st = profile.keys[ch];
      if (!st) continue;
      hits += st.hits;
      misses += st.misses;
      ms += st.avgMs * st.hits;
      msN += st.hits;
      const m = charMastery(st, srs.skills[ch]?.streak ?? 0);
      if (m !== null) {
        sum += m;
        sumN += 1;
      }
    }
    out.push({
      finger,
      keys: list.length,
      mastery: sumN ? Math.round(sum / sumN) : null,
      avgMs: msN ? Math.round(ms / msN) : null,
      accuracy: hits + misses ? hits / (hits + misses) : null,
    });
  }
  return out;
}

// ---- spaced repetition: what is due ----

export interface DueItem {
  id: string;
  kind: 'key' | 'pair';
  mastery: number;
  overdueMs: number;
  state?: SkillState;
}

/** Keys and letter pairs whose review date has passed, most overdue first. */
export function dueToday(
  profile: Pick<Profile, 'keys' | 'srs'>,
  known: ReadonlySet<string>,
  now: number,
  limit = 10,
): DueItem[] {
  const srs = readSrs(profile.srs);
  const out: DueItem[] = [];
  for (const ch of known) {
    const st = profile.keys[ch];
    if (!st || st.hits + st.misses < MIN_ATTEMPTS || !st.lastSeen) continue;
    const ev = srs.skills[ch];
    const m = charMastery(st, ev?.streak ?? 0) ?? 0;
    const dueAt = ev?.nextReview || st.lastSeen + (REVIEW_DAYS[reviewStage(m)] as number) * DAY_MS;
    if (now >= dueAt)
      out.push({
        id: ch,
        kind: 'key',
        mastery: m,
        overdueMs: now - dueAt,
        state: skillState(st, ev),
      });
  }
  for (const [bg, p] of Object.entries(srs.pairs)) {
    const m = pairMastery(p);
    if (m === null || !p.nextReview || now < p.nextReview) continue;
    if (![...bg].every((c) => known.has(c))) continue;
    out.push({ id: bg, kind: 'pair', mastery: m, overdueMs: now - p.nextReview });
  }
  out.sort((a, b) => b.overdueMs - a.overdueMs || a.id.localeCompare(b.id));
  return out.slice(0, limit);
}

// ---- the 85% rule difficulty controller ----

export function recordChallenge(c: Challenge, correct: boolean): Challenge {
  const recent = (c.recent + (correct ? '1' : '0')).slice(-CHALLENGE_WINDOW);
  const n = c.n + 1;
  let level = c.level;
  if (recent.length >= 60 && n % 20 === 0) {
    const acc = challengeAccuracy({ ...c, recent }) ?? 0;
    if (acc > CHALLENGE_BAND.high) level = Math.min(1, level + 0.035);
    else if (acc < CHALLENGE_BAND.low) level = Math.max(0, level - (acc < 0.88 ? 0.07 : 0.045));
  }
  return { level, recent, n };
}

export function challengeAccuracy(c: Challenge): number | null {
  if (!c.recent.length) return null;
  let ok = 0;
  for (const ch of c.recent) if (ch === '1') ok += 1;
  return ok / c.recent.length;
}

export interface DifficultyParams {
  level: number;
  lenShift: -1 | 0 | 1;
  weakShare: number;
  bigramShare: number;
  punctuation: number;
  groupMin: number;
  groupMax: number;
}

export function difficultyParams(level: number): DifficultyParams {
  const L = Math.max(0, Math.min(1, level));
  return {
    level: L,
    lenShift: L < 0.25 ? -1 : L > 0.7 ? 1 : 0,
    weakShare: Math.max(WEAK_SHARE_MIN, Math.min(WEAK_SHARE_MAX, 0.15 + 0.35 * L)),
    bigramShare: 0.1 + 0.3 * L,
    punctuation: L < 0.5 ? 0 : (L - 0.5) * 0.3,
    groupMin: L < 0.3 ? 2 : 3,
    groupMax: L < 0.3 ? 4 : L < 0.7 ? 5 : 6,
  };
}

export function challengeLabel(level: number): 'guarded' | 'growing' | 'challenging' | 'advanced' {
  return level < 0.25
    ? 'guarded'
    : level < 0.55
      ? 'growing'
      : level < 0.8
        ? 'challenging'
        : 'advanced';
}

// ---- drill generators ----

const FINAL_TO_BASE: Record<string, string> = { ם: 'מ', ן: 'נ', ך: 'כ', ף: 'פ', ץ: 'צ' };
const BASE_TO_FINAL: Record<string, string> = { מ: 'ם', נ: 'ן', כ: 'ך', פ: 'ף', צ: 'ץ' };

/** Hebrew final forms only at the end of a group, when the learner knows them. */
export function fixFinalLetters(
  group: string,
  known: ReadonlySet<string> | null,
  rng: Rng,
): string {
  const chars = [...group];
  if (!chars.some((c) => FINAL_TO_BASE[c] || BASE_TO_FINAL[c])) return group;
  const has = (c: string) => !known || known.has(c);
  for (let i = 0; i < chars.length - 1; i += 1) {
    const base = FINAL_TO_BASE[chars[i] as string];
    if (base) chars[i] = has(base) ? base : '';
  }
  const last = chars[chars.length - 1] as string;
  const fin = BASE_TO_FINAL[last];
  if (fin && known && known.has(fin) && rng() < 0.7) chars[chars.length - 1] = fin;
  return chars.join('') || group;
}

export interface CharDrillOptions {
  known: readonly string[];
  length: number;
  weakChars?: readonly string[];
  difficulty?: number;
  rng: Rng;
}

/** Character drill: weak keys appear more often (bounded share), the rest is a natural mix. */
export function generateCharDrill(o: CharDrillOptions): string {
  const known = o.known.filter((c) => c && c !== ' ');
  if (!known.length) return '';
  const weak = (o.weakChars ?? []).filter((c) => c && c !== ' ' && known.includes(c));
  const P = difficultyParams(o.difficulty ?? 0.3);
  const knownSet = new Set(known);
  const pick = () =>
    weak.length && o.rng() < P.weakShare ? randomChoice(o.rng, weak) : randomChoice(o.rng, known);
  const target = () => P.groupMin + Math.floor(o.rng() * (P.groupMax - P.groupMin + 1));
  const groups: string[] = [];
  let cur = '';
  let goal = target();
  for (let i = 0; i < o.length; i += 1) {
    cur += pick();
    if ([...cur].length >= goal) {
      groups.push(fixFinalLetters(cur, knownSet, o.rng));
      cur = '';
      goal = target();
    }
  }
  if (cur) groups.push(fixFinalLetters(cur, knownSet, o.rng));
  return groups.join(' ');
}

/** Transition drill: each weak pair alone, doubled and reversed. */
export function generateBigramDrill(pairs: readonly string[]): string {
  const out: string[] = [];
  for (const bg of pairs) {
    const c = [...bg];
    if (c.length !== 2) continue;
    out.push(bg, bg + bg, (c[1] as string) + (c[0] as string));
  }
  return out.join(' ');
}

/** Retraining for the player's most common slips: the right key next to the wrong one. */
export function generateErrorDrill(pairs: readonly ErrorPair[]): string {
  const out: string[] = [];
  for (const p of pairs) {
    if (!p.expected || !p.typed) continue;
    out.push(
      p.expected + p.typed,
      p.expected + p.expected,
      p.typed + p.expected,
      p.expected + p.typed + p.expected,
    );
  }
  return out.join(' ');
}

/** Real words that lean on the weak keys (weights come from the word library). */
export function generateWordDrill(o: {
  language: LayoutId;
  known: ReadonlySet<string>;
  weakChars: readonly string[];
  count: number;
  rng: Rng;
  minLength?: number;
  maxLength?: number;
}): string {
  return pickWords({
    language: o.language,
    allowedChars: o.known,
    weakChars: o.weakChars,
    count: o.count,
    rng: o.rng,
    minLength: o.minLength,
    maxLength: o.maxLength,
  }).join(' ');
}

// ---- micro lesson, recommendation, unlock gate ----

export const MICRO_LESSON_MINUTES = [2, 5, 10, 15, 20, 30] as const;
export const CHARS_PER_MINUTE = 40;

export interface MicroLesson {
  text: string;
  reviewKeys: string[];
  weakKeys: string[];
}

/** A drill sized for the minutes the player has: warm-up, review of due and weak keys, main part. */
export function buildMicroLesson(
  profile: Profile,
  minutes: number,
  now: number,
  rng: Rng,
): MicroLesson {
  const known = knownKeysOf(profile);
  const letters = [...known].filter(isLetterChar);
  const pool = letters.length ? letters : [...known];
  const level = challengeOf(profile).level;
  const weakKeys = weakCharacters(profile, known, 4).map((w) => w.ch);
  const due = dueToday(profile, known, now, 6)
    .filter((d) => d.kind === 'key')
    .map((d) => d.id);
  const reviewKeys = [...new Set([...due, ...weakKeys])];
  const total = Math.max(20, Math.round(minutes * CHARS_PER_MINUTE));
  const warm = Math.round(total * 0.15);
  const review = reviewKeys.length ? Math.round(total * 0.35) : 0;
  const main = Math.max(10, total - warm - review);
  const parts = [
    generateCharDrill({ known: pool, length: warm, difficulty: level, rng }),
    review
      ? generateCharDrill({
          known: pool,
          length: review,
          weakChars: reviewKeys,
          difficulty: level,
          rng,
        })
      : '',
    generateCharDrill({ known: pool, length: main, weakChars: weakKeys, difficulty: level, rng }),
  ];
  return { text: parts.filter(Boolean).join('  '), reviewKeys, weakKeys };
}

export function challengeOf(profile: Pick<Profile, 'srs'>): Challenge {
  return readSrs(profile.srs).challenge;
}

export interface UnlockGate {
  open: boolean;
  blocking: string[];
}

/**
 * Key-set unlock gate: new keys open when every key learned so far with enough data scores
 * at least `minScore`. Keys with too little data do not block (they are still being learned),
 * but at least `minKeysWithData` keys must have data, so a brand new player is not stalled.
 */
export function unlockGate(
  profile: Pick<Profile, 'keys' | 'srs'>,
  known: ReadonlySet<string>,
  minScore = DEFAULT_UNLOCK_SCORE,
): UnlockGate {
  const blocking = weakCharacters(profile, known, known.size)
    .filter((w) => w.score < minScore)
    .map((w) => w.ch);
  return { open: blocking.length === 0, blocking };
}

/** Options for TextSource: weak keys, weak transitions and difficulty from the profile. */
export function adaptiveOptions(profile: Profile): {
  weakChars: string[];
  weakBigrams: string[];
  difficulty: number;
} {
  const known = knownKeysOf(profile);
  return {
    weakChars: weakCharacters(profile, known, 5).map((w) => w.ch),
    weakBigrams: weakBigrams(profile, 6).map((w) => w.bg),
    difficulty: challengeOf(profile).level,
  };
}
