// Save versioning. Every schema change adds ONE entry to MIGRATIONS (from-version -> next version)
// and bumps CURRENT_VERSION, plus a test in tests/unit/save-migrations.test.ts.

export const CURRENT_VERSION = 10;

type Rec = Record<string, unknown>;
export type Migration = (raw: Rec) => Rec;

export class SaveTooNewError extends Error {
  constructor(public readonly found: number) {
    super(`Save version ${found} is newer than this game understands`);
    this.name = 'SaveTooNewError';
  }
}

export class SaveUnreadableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SaveUnreadableError';
  }
}

/**
 * v0 -> v1. Version 0 is the unversioned shape of early builds: either a bare single profile
 * ({ name, lang, ... }) or { profiles, active }. It becomes the versioned { profiles, activeProfileId }.
 */
const v0ToV1: Migration = (raw) => {
  const upgradeProfile = (p: unknown): unknown => {
    if (typeof p !== 'object' || p === null || Array.isArray(p)) return p;
    const r = { ...(p as Rec) };
    if (r.layout === undefined && (r.lang === 'he' || r.lang === 'en')) r.layout = r.lang;
    delete r.lang;
    return r;
  };
  if (Array.isArray(raw.profiles)) {
    const profiles = raw.profiles.map(upgradeProfile);
    const active = raw.activeProfileId ?? raw.active;
    return { version: 1, profiles, activeProfileId: active, meta: raw.meta };
  }
  const profile = upgradeProfile(raw) as Rec;
  return { version: 1, profiles: [profile], activeProfileId: profile.id };
};

/** v1 -> v2 (T05). Profiles gain `customLists` (the player's own word lists), empty to start. */
const v1ToV2: Migration = (raw) => {
  const profiles = Array.isArray(raw.profiles)
    ? raw.profiles.map((p) =>
        typeof p === 'object' && p !== null && !Array.isArray(p)
          ? { customLists: {}, ...(p as Rec) }
          : p,
      )
    : raw.profiles;
  return { ...raw, version: 2, profiles };
};

/**
 * v2 -> v3 (T07). Settings gain the display options: theme ('auto'), colorblind palette, high
 * contrast, large text and the dyslexia-friendly font (all off). Values already present are kept.
 */
const v2ToV3: Migration = (raw) => {
  const display = {
    theme: 'auto',
    colorblind: false,
    highContrast: false,
    largeText: false,
    dyslexiaFont: false,
  };
  const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
  const profiles = Array.isArray(raw.profiles)
    ? raw.profiles.map((p) =>
        isRec(p) ? { ...p, settings: { ...display, ...(isRec(p.settings) ? p.settings : {}) } } : p,
      )
    : raw.profiles;
  return { ...raw, version: 3, profiles };
};

/**
 * v3 -> v4 (T08). Settings gain `quality` ('auto': let the first-run benchmark decide) and the
 * save remembers what the benchmark picked for this device in `meta.autoQuality` (null until it
 * has run). Values already present are kept.
 */
const v3ToV4: Migration = (raw) => {
  const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
  const profiles = Array.isArray(raw.profiles)
    ? raw.profiles.map((p) =>
        isRec(p)
          ? { ...p, settings: { quality: 'auto', ...(isRec(p.settings) ? p.settings : {}) } }
          : p,
      )
    : raw.profiles;
  const meta = { autoQuality: null, ...(isRec(raw.meta) ? raw.meta : {}) };
  return { ...raw, version: 4, profiles, meta };
};

/**
 * v4 -> v5 (T09). Settings gain `keyboardGuide`: the keyboard under the play view shows the keys
 * ('keys', the default), the keys with hands ('hands'), or is hidden ('off'). Kept if present.
 */
const v4ToV5: Migration = (raw) => {
  const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
  const profiles = Array.isArray(raw.profiles)
    ? raw.profiles.map((p) =>
        isRec(p)
          ? { ...p, settings: { keyboardGuide: 'keys', ...(isRec(p.settings) ? p.settings : {}) } }
          : p,
      )
    : raw.profiles;
  return { ...raw, version: 5, profiles };
};

/**
 * v5 -> v6 (T10). The sound mixer gains two more volumes: spoken lines (`voiceVolume`) and menu
 * sounds (`uiVolume`). Both start at the defaults; music and effects volumes are kept.
 */
const v5ToV6: Migration = (raw) => {
  const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
  const profiles = Array.isArray(raw.profiles)
    ? raw.profiles.map((p) =>
        isRec(p)
          ? {
              ...p,
              settings: {
                voiceVolume: 0.9,
                uiVolume: 0.6,
                ...(isRec(p.settings) ? p.settings : {}),
              },
            }
          : p,
      )
    : raw.profiles;
  return { ...raw, version: 6, profiles };
};

/**
 * v6 -> v7 (T12). Story settings: how fast lines appear (`textSpeed`, normal) and whether the
 * device reads them aloud (`storyVoices`, off). Everything else is kept.
 */
const v6ToV7: Migration = (raw) => {
  const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
  const profiles = Array.isArray(raw.profiles)
    ? raw.profiles.map((p) =>
        isRec(p)
          ? {
              ...p,
              settings: {
                textSpeed: 'normal',
                storyVoices: false,
                ...(isRec(p.settings) ? p.settings : {}),
              },
            }
          : p,
      )
    : raw.profiles;
  return { ...raw, version: 7, profiles };
};

/** v7 -> v8 (T28). Profiles gain `ladder`, the Ladder's high-score table, empty to start. */
const v7ToV8: Migration = (raw) => {
  const profiles = Array.isArray(raw.profiles)
    ? raw.profiles.map((p) =>
        typeof p === 'object' && p !== null && !Array.isArray(p)
          ? { ladder: [], ...(p as Rec) }
          : p,
      )
    : raw.profiles;
  return { ...raw, version: 8, profiles };
};

/**
 * v8 -> v9 (T33). Profiles gain `progress` (XP, skills, abilities off, hidden letters). Play
 * from before progression existed still counts: one XP per ten characters in the history, and a
 * glyph per forty, so a returning player can visit the shop at once.
 */
const v8ToV9: Migration = (raw) => {
  const profiles = Array.isArray(raw.profiles)
    ? raw.profiles.map((p) => {
        if (typeof p !== 'object' || p === null || Array.isArray(p)) return p;
        const rec = p as Rec;
        if (typeof rec.progress === 'object' && rec.progress !== null) return rec;
        let chars = 0;
        if (Array.isArray(rec.history)) {
          for (const e of rec.history) {
            const c = typeof e === 'object' && e !== null ? (e as Rec).chars : 0;
            if (typeof c === 'number' && Number.isFinite(c) && c > 0) chars += c;
          }
        }
        const w = typeof rec.wallet === 'object' && rec.wallet !== null ? (rec.wallet as Rec) : {};
        const glyphs = typeof w.glyphs === 'number' && Number.isFinite(w.glyphs) ? w.glyphs : 0;
        return {
          ...rec,
          wallet: { ...w, glyphs: glyphs + Math.round(chars / 40) },
          progress: { xp: Math.round(chars / 10), skills: [], off: [], secrets: [] },
        };
      })
    : raw.profiles;
  return { ...raw, version: 9, profiles };
};

/**
 * v9 -> v10 (T36). Settings gain shake, flash, captions, breakMinutes, postureTips, menuKey and
 * difficulty. Nothing to rewrite: normalizeSettings fills each with its default, so a player who
 * never opened settings keeps breaks on at 30 minutes and everything else as it was.
 */
const v9ToV10: Migration = (raw) => ({ ...raw, version: 10 });

export const MIGRATIONS: Readonly<Record<number, Migration>> = {
  0: v0ToV1,
  1: v1ToV2,
  2: v2ToV3,
  3: v3ToV4,
  4: v4ToV5,
  5: v5ToV6,
  6: v6ToV7,
  7: v7ToV8,
  8: v8ToV9,
  9: v9ToV10,
};

export function versionOf(raw: Rec): number {
  const v = raw.version;
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : 0;
}

/** Runs every migration from the save's version up to `target`. Throws SaveTooNewError if newer. */
export function migrate(
  raw: unknown,
  migrations: Readonly<Record<number, Migration>> = MIGRATIONS,
  target: number = CURRENT_VERSION,
): Rec {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new SaveUnreadableError('Save is not an object');
  }
  let cur = raw as Rec;
  let v = versionOf(cur);
  if (v > target) throw new SaveTooNewError(v);
  while (v < target) {
    const step = migrations[v];
    if (!step) throw new SaveUnreadableError(`No migration from version ${v}`);
    cur = step(cur);
    v += 1;
    cur = { ...cur, version: v };
  }
  return cur;
}
