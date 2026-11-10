// Save versioning. Every schema change adds ONE entry to MIGRATIONS (from-version -> next version)
// and bumps CURRENT_VERSION, plus a test in tests/unit/save-migrations.test.ts.

export const CURRENT_VERSION = 1;

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

export const MIGRATIONS: Readonly<Record<number, Migration>> = { 0: v0ToV1 };

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
