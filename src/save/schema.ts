// Save schema (ARCHITECTURE section 4). Pure logic: no DOM, no clock, no Three.js.
// Typed text is never stored, only statistics.

import type { BackspacePolicy, LayoutId, NiqqudMode } from '../core';

export type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export type Track = 1 | 2;

export interface Settings {
  uiLanguage: LayoutId;
  musicVolume: number;
  sfxVolume: number;
  backspace: BackspacePolicy;
  niqqud: NiqqudMode;
  hardcore: boolean;
  reducedMotion: boolean;
}

export interface LessonBest {
  wpm: number;
  accuracy: number;
  stars: number;
}

export interface TrackProgress {
  completed: string[];
  best: Record<string, LessonBest>;
}

export interface KeyStat {
  hits: number;
  misses: number;
  avgMs: number;
  lastSeen: number;
  ease: number;
  due: number;
  confusions: Record<string, number>;
}

export interface HistoryEntry {
  at: number;
  track: Track;
  mode: string;
  wpm: number;
  accuracy: number;
  durationMs: number;
  chars: number;
}

export interface CustomList {
  name: string;
  language: LayoutId;
  words: string[];
}

export const MAX_CUSTOM_LISTS = 20;
export const MAX_CUSTOM_WORDS = 2000;
export const MAX_CUSTOM_WORD_LENGTH = 24;

export interface Profile {
  id: string;
  name: string;
  avatar: string;
  settings: Settings;
  track: Track;
  layout: LayoutId;
  lessons: Record<string, TrackProgress>;
  keys: Record<string, KeyStat>;
  /** Spaced-repetition state, shaped by the adaptive engine (T06). */
  srs: Record<string, JsonValue>;
  story: { ranks: Record<string, number>; flags: Record<string, boolean> };
  wallet: { glyphs: number; ink: number };
  unlocks: string[];
  cosmetics: { owned: string[]; equipped: Record<string, string> };
  history: HistoryEntry[];
  /** Opaque blob owned by the legacy arcade games. */
  arcade: JsonValue;
  /** The player's own word lists (typed in or imported from plain text). Words only, no typed history. */
  customLists: Record<string, CustomList>;
  createdAt: number;
}

export interface SaveMeta {
  /** True once the old plugin's progress has been looked for (imported or not found). */
  legacyChecked: boolean;
}

export interface Save {
  version: number;
  profiles: Profile[];
  activeProfileId: string;
  meta: SaveMeta;
}

export const MAX_HISTORY = 500;
export const MAX_NAME = 40;
export const DEFAULT_NAME = 'Player';

export function defaultSettings(): Settings {
  return {
    uiLanguage: 'he',
    musicVolume: 0.7,
    sfxVolume: 0.8,
    backspace: 'allowed',
    niqqud: 'ignore',
    hardcore: false,
    reducedMotion: false,
  };
}

export function createProfile(id: string, name: string, now: number): Profile {
  return {
    id,
    name: cleanName(name),
    avatar: 'scribe',
    settings: defaultSettings(),
    track: 1,
    layout: 'he',
    lessons: {},
    keys: {},
    srs: {},
    story: { ranks: {}, flags: {} },
    wallet: { glyphs: 0, ink: 0 },
    unlocks: [],
    cosmetics: { owned: [], equipped: {} },
    history: [],
    arcade: null,
    customLists: {},
    createdAt: now,
  };
}

export function createSave(version: number, firstProfile: Profile): Save {
  return {
    version,
    profiles: [firstProfile],
    activeProfileId: firstProfile.id,
    meta: { legacyChecked: false },
  };
}

export function cleanName(name: unknown): string {
  const s = typeof name === 'string' ? name.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME) : '';
  return s.length > 0 ? s : DEFAULT_NAME;
}

// ---- tolerant normalisation: any parsed JSON in, a valid Save/Profile out ----

type Rec = Record<string, unknown>;

function isRec(v: unknown): v is Rec {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function num(v: unknown, def: number, min = -Infinity, max = Infinity): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def;
}

function strList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

function mapOf<T>(v: unknown, f: (x: unknown) => T | null): Record<string, T> {
  const out: Record<string, T> = {};
  if (!isRec(v)) return out;
  for (const [k, x] of Object.entries(v)) {
    const r = f(x);
    if (r !== null) out[k] = r;
  }
  return out;
}

function toJson(v: unknown, depth = 0): JsonValue {
  if (v === null || typeof v === 'boolean' || typeof v === 'string') return v;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (depth > 20) return null;
  if (Array.isArray(v)) return v.map((x) => toJson(x, depth + 1));
  if (isRec(v)) {
    const out: { [key: string]: JsonValue } = {};
    for (const [k, x] of Object.entries(v)) out[k] = toJson(x, depth + 1);
    return out;
  }
  return null;
}

function layoutOf(v: unknown, def: LayoutId): LayoutId {
  return v === 'he' || v === 'en' ? v : def;
}

function normalizeSettings(raw: unknown): Settings {
  const d = defaultSettings();
  const r = isRec(raw) ? raw : {};
  return {
    uiLanguage: layoutOf(r.uiLanguage, d.uiLanguage),
    musicVolume: num(r.musicVolume, d.musicVolume, 0, 1),
    sfxVolume: num(r.sfxVolume, d.sfxVolume, 0, 1),
    backspace:
      r.backspace === 'allowed' || r.backspace === 'disabled' || r.backspace === 'mustFix'
        ? r.backspace
        : d.backspace,
    niqqud: r.niqqud === 'ignore' || r.niqqud === 'required' ? r.niqqud : d.niqqud,
    hardcore: r.hardcore === true,
    reducedMotion: r.reducedMotion === true,
  };
}

function normalizeKeyStat(raw: unknown): KeyStat | null {
  if (!isRec(raw)) return null;
  return {
    hits: num(raw.hits, 0, 0),
    misses: num(raw.misses, 0, 0),
    avgMs: num(raw.avgMs, 0, 0),
    lastSeen: num(raw.lastSeen, 0, 0),
    ease: num(raw.ease, 2.5, 1.3, 5),
    due: num(raw.due, 0, 0),
    confusions: mapOf(raw.confusions, (x) => (typeof x === 'number' && x >= 0 ? x : null)),
  };
}

function normalizeTrackProgress(raw: unknown): TrackProgress | null {
  if (!isRec(raw)) return null;
  return {
    completed: strList(raw.completed),
    best: mapOf(raw.best, (x) =>
      isRec(x)
        ? {
            wpm: num(x.wpm, 0, 0),
            accuracy: num(x.accuracy, 0, 0, 100),
            stars: Math.round(num(x.stars, 0, 0, 3)),
          }
        : null,
    ),
  };
}

function normalizeHistory(raw: unknown): HistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: HistoryEntry[] = [];
  for (const x of raw) {
    if (!isRec(x)) continue;
    out.push({
      at: num(x.at, 0, 0),
      track: x.track === 2 ? 2 : 1,
      mode: typeof x.mode === 'string' ? x.mode : 'practice',
      wpm: num(x.wpm, 0, 0),
      accuracy: num(x.accuracy, 0, 0, 100),
      durationMs: num(x.durationMs, 0, 0),
      chars: num(x.chars, 0, 0),
    });
  }
  return out.slice(-MAX_HISTORY);
}

function normalizeCustomLists(raw: unknown): Record<string, CustomList> {
  const out: Record<string, CustomList> = {};
  if (!isRec(raw)) return out;
  for (const [id, x] of Object.entries(raw)) {
    if (Object.keys(out).length >= MAX_CUSTOM_LISTS) break;
    if (!isRec(x)) continue;
    const words = strList(x.words)
      .filter((w) => w.length > 0 && w.length <= MAX_CUSTOM_WORD_LENGTH)
      .slice(0, MAX_CUSTOM_WORDS);
    out[id] = { name: cleanName(x.name), language: layoutOf(x.language, 'he'), words };
  }
  return out;
}

/** Turns anything into a valid Profile. `fallbackId` is used when the id is missing. */
export function normalizeProfile(raw: unknown, fallbackId: string, now: number): Profile {
  const r = isRec(raw) ? raw : {};
  const id = typeof r.id === 'string' && r.id.length > 0 ? r.id : fallbackId;
  const base = createProfile(id, cleanName(r.name), num(r.createdAt, now, 0));
  const story = isRec(r.story) ? r.story : {};
  const wallet = isRec(r.wallet) ? r.wallet : {};
  const cosmetics = isRec(r.cosmetics) ? r.cosmetics : {};
  return {
    ...base,
    avatar: typeof r.avatar === 'string' && r.avatar.length > 0 ? r.avatar : base.avatar,
    settings: normalizeSettings(r.settings),
    track: r.track === 2 ? 2 : 1,
    layout: layoutOf(r.layout, 'he'),
    lessons: mapOf(r.lessons, normalizeTrackProgress),
    keys: mapOf(r.keys, normalizeKeyStat),
    srs: isRec(r.srs) ? (toJson(r.srs) as Record<string, JsonValue>) : {},
    story: {
      ranks: mapOf(story.ranks, (x) => (typeof x === 'number' && Number.isFinite(x) ? x : null)),
      flags: mapOf(story.flags, (x) => (typeof x === 'boolean' ? x : null)),
    },
    wallet: { glyphs: num(wallet.glyphs, 0, 0), ink: num(wallet.ink, 0, 0) },
    unlocks: strList(r.unlocks),
    cosmetics: {
      owned: strList(cosmetics.owned),
      equipped: mapOf(cosmetics.equipped, (x) => (typeof x === 'string' ? x : null)),
    },
    history: normalizeHistory(r.history),
    arcade: toJson(r.arcade ?? null),
    customLists: normalizeCustomLists(r.customLists),
  };
}

/**
 * Turns a migrated save-shaped value into a valid Save. Returns null when it holds nothing usable
 * (not an object), so the caller can fall back. An empty profile list gets one fresh profile.
 */
export function normalizeSave(
  raw: unknown,
  version: number,
  newId: () => string,
  now: number,
): Save | null {
  if (!isRec(raw)) return null;
  const seen = new Set<string>();
  const profiles: Profile[] = [];
  if (Array.isArray(raw.profiles)) {
    for (const p of raw.profiles) {
      const prof = normalizeProfile(p, newId(), now);
      if (seen.has(prof.id)) prof.id = newId();
      seen.add(prof.id);
      profiles.push(prof);
    }
  }
  if (profiles.length === 0) profiles.push(createProfile(newId(), DEFAULT_NAME, now));
  const first = profiles[0] as Profile;
  const active =
    typeof raw.activeProfileId === 'string' && seen.has(raw.activeProfileId)
      ? raw.activeProfileId
      : first.id;
  const meta = isRec(raw.meta) ? raw.meta : {};
  return {
    version,
    profiles,
    activeProfileId: active,
    meta: { legacyChecked: meta.legacyChecked === true },
  };
}
