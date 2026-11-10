// SaveManager: loads (with recovery), keeps the live Save in memory, debounced autosave,
// profile operations and JSON export/import. No DOM; time and timers are injected.

import { LEGACY_KEY, legacyToProfile } from './legacy';
import { CURRENT_VERSION, migrate, SaveTooNewError, SaveUnreadableError } from './migrations';
import {
  cleanName,
  createProfile,
  createSave,
  DEFAULT_NAME,
  normalizeProfile,
  normalizeSave,
  type Profile,
  type Save,
} from './schema';
import type { SaveStore } from './store';

export const SAVE_KEY = 'otiyot_save';
export const BACKUP_KEY = 'otiyot_save_backup';
/** A save that could not be read is kept here instead of being overwritten. */
export const UNREADABLE_KEY = 'otiyot_save_unreadable';

export const EXPORT_APP = 'otiyot';

export type LoadSource = 'primary' | 'backup' | 'fresh';
export interface LoadResult {
  source: LoadSource;
  /** True when the primary copy existed but could not be used. */
  recovered: boolean;
  tooNew: boolean;
  legacyImported: boolean;
}

export class SaveImportError extends Error {
  constructor(
    public readonly code: 'not-json' | 'not-otiyot' | 'too-new' | 'empty',
    message: string,
  ) {
    super(message);
    this.name = 'SaveImportError';
  }
}

export interface ManagerOptions {
  debounceMs?: number;
  now?: () => number;
  newId?: () => string;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  /** Called when a background write fails (the save stays in memory and is retried on the next change). */
  onError?: (e: unknown) => void;
}

function defaultId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export class SaveManager {
  private readonly debounceMs: number;
  private readonly now: () => number;
  private readonly newId: () => string;
  private readonly setTimer: (fn: () => void, ms: number) => unknown;
  private readonly clearTimer: (h: unknown) => void;
  private readonly onError: (e: unknown) => void;

  private current: Save;
  private timer: unknown = null;
  private lastWritten: string | null = null;
  private chain: Promise<void> = Promise.resolve();
  private blockWrites = false;

  constructor(
    private readonly store: SaveStore,
    opts: ManagerOptions = {},
  ) {
    this.debounceMs = opts.debounceMs ?? 800;
    this.now = opts.now ?? Date.now;
    this.newId = opts.newId ?? defaultId;
    this.setTimer = opts.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer = opts.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
    this.onError = opts.onError ?? (() => undefined);
    this.current = this.freshSave();
  }

  get save(): Save {
    return this.current;
  }

  get activeProfile(): Profile {
    return (
      this.current.profiles.find((p) => p.id === this.current.activeProfileId) ??
      (this.current.profiles[0] as Profile)
    );
  }

  private freshSave(): Save {
    return createSave(CURRENT_VERSION, createProfile(this.newId(), DEFAULT_NAME, this.now()));
  }

  private parse(text: string | null): { save: Save; text: string } | 'missing' | 'bad' | 'tooNew' {
    if (text === null) return 'missing';
    try {
      const migrated = migrate(JSON.parse(text) as unknown);
      const save = normalizeSave(migrated, CURRENT_VERSION, this.newId, this.now());
      return save ? { save, text } : 'bad';
    } catch (e) {
      return e instanceof SaveTooNewError ? 'tooNew' : 'bad';
    }
  }

  /** Loads the save: primary copy, else last good copy, else a fresh save. Never throws. */
  async load(): Promise<LoadResult> {
    const readSafe = async (key: string): Promise<string | null> => {
      try {
        return await this.store.get(key);
      } catch {
        return null;
      }
    };
    const primaryText = await readSafe(SAVE_KEY);
    const primary = this.parse(primaryText);
    let result: LoadResult;

    if (typeof primary === 'object') {
      this.current = primary.save;
      this.lastWritten = primary.text;
      result = { source: 'primary', recovered: false, tooNew: false, legacyImported: false };
    } else {
      const recovered = primary !== 'missing';
      const tooNew = primary === 'tooNew';
      if (recovered && primaryText !== null) await this.keepUnreadable(primaryText);
      const backup = this.parse(await readSafe(BACKUP_KEY));
      if (typeof backup === 'object') {
        this.current = backup.save;
        this.lastWritten = backup.text;
        result = { source: 'backup', recovered, tooNew, legacyImported: false };
      } else {
        this.current = this.freshSave();
        this.lastWritten = null;
        // A newer-version save must not be overwritten by a fresh one.
        this.blockWrites = tooNew;
        result = { source: 'fresh', recovered, tooNew, legacyImported: false };
      }
    }

    if (!this.blockWrites && !this.current.meta.legacyChecked) {
      result.legacyImported = await this.importLegacy(result.source === 'fresh');
    }
    return result;
  }

  private async keepUnreadable(text: string): Promise<void> {
    try {
      await this.store.set(UNREADABLE_KEY, text);
    } catch (e) {
      this.onError(e);
    }
  }

  private async readLegacy(): Promise<unknown> {
    try {
      const text = await this.store.get(LEGACY_KEY);
      return text === null ? null : (JSON.parse(text) as unknown);
    } catch {
      return null;
    }
  }

  private async importLegacy(replaceEmptyDefault: boolean): Promise<boolean> {
    const raw = await this.readLegacy();
    const prof = legacyToProfile(raw, this.newId(), this.now());
    this.current.meta.legacyChecked = true;
    if (prof) {
      if (replaceEmptyDefault && this.current.profiles.length === 1) {
        this.current.profiles = [prof];
      } else {
        this.current.profiles.push(prof);
      }
      this.current.activeProfileId = prof.id;
    }
    await this.flush();
    return prof !== null;
  }

  // ---- autosave ----

  /** Call after changing the live save. Writes after `debounceMs` of quiet. */
  changed(): void {
    if (this.timer !== null) this.clearTimer(this.timer);
    this.timer = this.setTimer(() => {
      this.timer = null;
      void this.flush();
    }, this.debounceMs);
  }

  /** Runs `fn` on the active profile, then schedules a save. */
  update(fn: (profile: Profile) => void): void {
    fn(this.activeProfile);
    this.changed();
  }

  /** Writes now (cancels the pending timer). Writes are queued so they never interleave. */
  flush(): Promise<void> {
    if (this.timer !== null) {
      this.clearTimer(this.timer);
      this.timer = null;
    }
    if (this.blockWrites) return this.chain;
    const text = JSON.stringify(this.current);
    this.chain = this.chain.then(async () => {
      try {
        if (text === this.lastWritten) return;
        // Keep the previous good copy before replacing it.
        if (this.lastWritten !== null) await this.store.set(BACKUP_KEY, this.lastWritten);
        await this.store.set(SAVE_KEY, text);
        this.lastWritten = text;
      } catch (e) {
        this.onError(e);
      }
    });
    return this.chain;
  }

  // ---- profiles ----

  private find(id: string): Profile | undefined {
    return this.current.profiles.find((p) => p.id === id);
  }

  createProfile(name: string): Profile {
    const p = createProfile(this.newId(), name, this.now());
    this.current.profiles.push(p);
    this.current.activeProfileId = p.id;
    this.changed();
    return p;
  }

  renameProfile(id: string, name: string): boolean {
    const p = this.find(id);
    if (!p) return false;
    p.name = cleanName(name);
    this.changed();
    return true;
  }

  /** Deleting the last profile leaves one fresh profile, so there is always a player. */
  deleteProfile(id: string): boolean {
    const idx = this.current.profiles.findIndex((p) => p.id === id);
    if (idx < 0) return false;
    this.current.profiles.splice(idx, 1);
    if (this.current.profiles.length === 0) {
      this.current.profiles.push(createProfile(this.newId(), DEFAULT_NAME, this.now()));
    }
    if (!this.find(this.current.activeProfileId)) {
      this.current.activeProfileId = (
        this.current.profiles[Math.min(idx, this.current.profiles.length - 1)] as Profile
      ).id;
    }
    this.changed();
    return true;
  }

  switchProfile(id: string): boolean {
    if (!this.find(id)) return false;
    this.current.activeProfileId = id;
    this.changed();
    return true;
  }

  // ---- export / import ----

  /** JSON text of every profile (default) or just one. */
  exportJson(profileId?: string): string {
    const profiles = profileId
      ? this.current.profiles.filter((p) => p.id === profileId)
      : this.current.profiles;
    return JSON.stringify(
      {
        app: EXPORT_APP,
        version: CURRENT_VERSION,
        exportedAt: this.now(),
        profiles,
        activeProfileId: profiles.some((p) => p.id === this.current.activeProfileId)
          ? this.current.activeProfileId
          : profiles[0]?.id,
      },
      null,
      2,
    );
  }

  /**
   * Imports an export file. By default the profiles are ADDED (ids that already exist get new ones,
   * so nothing is overwritten) and the first imported profile becomes active. With replace=true the
   * whole save is replaced. Throws SaveImportError for files that are not usable.
   */
  importJson(text: string, opts: { replace?: boolean } = {}): number {
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new SaveImportError('not-json', 'The file is not valid JSON');
    }
    if (typeof raw !== 'object' || raw === null || (raw as { app?: unknown }).app !== EXPORT_APP) {
      throw new SaveImportError('not-otiyot', 'The file is not an Otiyot export');
    }
    let save: Save | null;
    try {
      const migrated = migrate(raw);
      save = normalizeSave(migrated, CURRENT_VERSION, this.newId, this.now());
    } catch (e) {
      if (e instanceof SaveTooNewError) {
        throw new SaveImportError('too-new', 'The file was made by a newer version of Otiyot');
      }
      if (e instanceof SaveUnreadableError) throw new SaveImportError('not-otiyot', e.message);
      throw e;
    }
    const incoming = (raw as { profiles?: unknown }).profiles;
    if (!save || !Array.isArray(incoming) || incoming.length === 0) {
      throw new SaveImportError('empty', 'The file has no profiles');
    }
    if (opts.replace) {
      save.meta.legacyChecked = true;
      this.current = save;
    } else {
      const have = new Set(this.current.profiles.map((p) => p.id));
      const added = save.profiles.map((p) => {
        const copy = normalizeProfile(p, this.newId(), this.now());
        if (have.has(copy.id)) copy.id = this.newId();
        have.add(copy.id);
        return copy;
      });
      this.current.profiles.push(...added);
      this.current.activeProfileId = (added[0] as Profile).id;
    }
    this.changed();
    return save.profiles.length;
  }
}
