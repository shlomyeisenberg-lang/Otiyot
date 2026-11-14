// Ghosts and local leaderboards (T37). A ghost is only the moments a run finished each word, in
// milliseconds since its first key, plus the numbers on its board line. It never holds any typed
// text. Pure logic: no DOM, no Three.js. The save keeps up to MAX_BOARD lines per board.

import type { GhostRecord, Profile, Save } from '../save/schema';
import { MAX_BOARD, MAX_GHOST_MARKS } from '../save/schema';

export type GhostKind = 'rail' | 'timeattack' | 'daily';

export const GHOST_KINDS: readonly GhostKind[] = ['rail', 'timeattack', 'daily'];

/** The board a run is written to: the rail's level and difficulty, or the mode's history key. */
export function boardKey(kind: GhostKind, detail: string): string {
  return `${kind}|${detail}`;
}

export function kindOfBoard(key: string): GhostKind | null {
  const k = key.split('|', 1)[0] ?? '';
  return (GHOST_KINDS as readonly string[]).includes(k) ? (k as GhostKind) : null;
}

/** Collects the finish time of every word while a run is on. */
export class GhostRecorder {
  private marks: number[] = [];
  private t0 = -1;

  /** Call on every key; the clock starts at the first one. */
  key(now: number): void {
    if (this.t0 < 0) this.t0 = now;
  }

  /** Call when a word is finished. */
  word(now: number): void {
    if (this.t0 < 0) return;
    if (this.marks.length < MAX_GHOST_MARKS)
      this.marks.push(Math.max(0, Math.round(now - this.t0)));
  }

  reset(): void {
    this.marks = [];
    this.t0 = -1;
  }

  /** What was recorded so far (a copy). */
  trace(): number[] {
    return [...this.marks];
  }
}

/** Words the ghost had finished after `ms` milliseconds, with the part of the next one in between. */
export function ghostProgress(marks: readonly number[], ms: number): number {
  if (marks.length === 0 || ms <= 0) return 0;
  let prev = 0;
  for (let i = 0; i < marks.length; i++) {
    const at = marks[i] as number;
    if (ms < at) return i + (at > prev ? (ms - prev) / (at - prev) : 0);
    prev = at;
  }
  return marks.length;
}

/** True when `a` should rank above `b`: the higher score wins, the earlier run breaks a tie. */
export function ranksAbove(
  a: Pick<GhostRecord, 'score' | 'at'>,
  b: Pick<GhostRecord, 'score' | 'at'>,
): boolean {
  return a.score > b.score || (a.score === b.score && a.at < b.at);
}

/** The line a run adds to a board. */
export function makeRecord(
  input: Pick<GhostRecord, 'score' | 'wpm' | 'accuracy' | 'durationMs'> & {
    marks: readonly number[];
  },
  name: string,
  at: number,
): GhostRecord {
  return {
    at,
    name,
    score: Math.max(0, Math.round(input.score)),
    wpm: Math.max(0, Math.round(input.wpm)),
    accuracy: Math.max(0, Math.min(100, input.accuracy)),
    durationMs: Math.max(0, Math.round(input.durationMs)),
    marks: input.marks.slice(0, MAX_GHOST_MARKS),
    imported: false,
  };
}

export interface BoardResult {
  /** 1-based place on the board, or 0 when the run did not make it. */
  place: number;
  /** True when it took first place from an earlier best. */
  newBest: boolean;
}

/** Inserts a record into the profile's board and keeps the best MAX_BOARD lines. */
export function addToBoard(p: Pick<Profile, 'ghosts'>, key: string, rec: GhostRecord): BoardResult {
  const board = [...(p.ghosts[key] ?? [])];
  const hadBest = board.length > 0;
  let idx = board.findIndex((x) => ranksAbove(rec, x));
  if (idx < 0) idx = board.length;
  if (idx >= MAX_BOARD) return { place: 0, newBest: false };
  board.splice(idx, 0, rec);
  p.ghosts[key] = board.slice(0, MAX_BOARD);
  return { place: idx + 1, newBest: idx === 0 && hadBest };
}

/** The ghost to race: the profile's best line on this board (an imported one counts). */
export function bestGhost(p: Pick<Profile, 'ghosts'>, key: string): GhostRecord | null {
  return p.ghosts[key]?.[0] ?? null;
}

export interface DeviceLine extends GhostRecord {
  profile: string;
}

/** Every profile's lines for one board, best first: the board of this device. */
export function deviceBoard(save: Pick<Save, 'profiles'>, key: string): DeviceLine[] {
  const out: DeviceLine[] = [];
  for (const p of save.profiles) {
    for (const r of p.ghosts[key] ?? []) out.push({ ...r, profile: p.name });
  }
  out.sort((a, b) => (ranksAbove(a, b) ? -1 : ranksAbove(b, a) ? 1 : 0));
  return out.slice(0, MAX_BOARD * 2);
}

/** Boards that hold at least one line, in a steady order. */
export function boardKeys(p: Pick<Profile, 'ghosts'>): string[] {
  return Object.keys(p.ghosts)
    .filter((k) => (p.ghosts[k]?.length ?? 0) > 0)
    .sort();
}

// ---- sharing a ghost as a file ---------------------------------------------------------------

export const GHOST_FILE_FORMAT = 'otiyot-ghost';

export interface GhostFile {
  format: typeof GHOST_FILE_FORMAT;
  version: 1;
  key: string;
  record: GhostRecord;
}

export function exportGhost(key: string, rec: GhostRecord): string {
  const file: GhostFile = { format: GHOST_FILE_FORMAT, version: 1, key, record: rec };
  return JSON.stringify(file);
}

export class GhostImportError extends Error {}

/** Reads a ghost file; throws GhostImportError when it is not one. Nothing in it is trusted. */
export function parseGhost(text: string): { key: string; record: GhostRecord } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new GhostImportError('not-json');
  }
  if (typeof raw !== 'object' || raw === null) throw new GhostImportError('not-ghost');
  const f = raw as Record<string, unknown>;
  if (f.format !== GHOST_FILE_FORMAT || f.version !== 1) throw new GhostImportError('not-ghost');
  const key = f.key;
  if (typeof key !== 'string' || key.length > 120 || kindOfBoard(key) === null) {
    throw new GhostImportError('bad-key');
  }
  const r = f.record as Record<string, unknown> | null;
  if (typeof r !== 'object' || r === null) throw new GhostImportError('bad-record');
  const marks = Array.isArray(r.marks)
    ? r.marks.filter((x): x is number => typeof x === 'number' && Number.isFinite(x) && x >= 0)
    : [];
  if (marks.length === 0) throw new GhostImportError('bad-record');
  const num = (v: unknown, max: number): number =>
    typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(0, v)) : 0;
  const name = typeof r.name === 'string' ? r.name.replace(/\s+/g, ' ').trim().slice(0, 40) : '';
  return {
    key,
    record: {
      at: num(r.at, 8.64e15),
      name: name || 'Friend',
      score: Math.round(num(r.score, 1e6)),
      wpm: Math.round(num(r.wpm, 1000)),
      accuracy: num(r.accuracy, 100),
      durationMs: Math.round(num(r.durationMs, 1e9)),
      marks: marks.slice(0, MAX_GHOST_MARKS).map(Math.round),
      imported: true,
    },
  };
}
