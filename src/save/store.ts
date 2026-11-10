// SaveStore: where the save lives. Two real homes (browser localStorage, Otzaria plugin storage)
// plus an in-memory fallback. Values are strings (the save is stored as JSON text).

export interface SaveStore {
  readonly kind: 'local' | 'otzaria' | 'memory';
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface OtzariaReply {
  success?: boolean;
  data?: unknown;
}
export interface OtzariaBridge {
  call(method: string, args: Record<string, unknown>): Promise<OtzariaReply | undefined>;
}

/** The slice of the Web Storage API we use (so tests can pass a fake). */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class MemoryStore implements SaveStore {
  readonly kind = 'memory';
  readonly data = new Map<string, string>();
  get(key: string): Promise<string | null> {
    return Promise.resolve(this.data.get(key) ?? null);
  }
  set(key: string, value: string): Promise<void> {
    this.data.set(key, value);
    return Promise.resolve();
  }
  remove(key: string): Promise<void> {
    this.data.delete(key);
    return Promise.resolve();
  }
}

export class LocalStorageStore implements SaveStore {
  readonly kind = 'local';
  constructor(private readonly storage: KeyValueStorage) {}
  get(key: string): Promise<string | null> {
    try {
      return Promise.resolve(this.storage.getItem(key));
    } catch {
      return Promise.resolve(null);
    }
  }
  set(key: string, value: string): Promise<void> {
    try {
      this.storage.setItem(key, value);
      return Promise.resolve();
    } catch (e) {
      return Promise.reject(e instanceof Error ? e : new Error('localStorage write failed'));
    }
  }
  remove(key: string): Promise<void> {
    try {
      this.storage.removeItem(key);
    } catch {
      /* nothing to remove */
    }
    return Promise.resolve();
  }
}

/**
 * Otzaria plugin storage via Otzaria.call('storage.get' / 'storage.set'). Like the old plugin it
 * keeps a synchronous local mirror (when localStorage exists) so a crash or closed window loses
 * nothing, and reads fall back to that mirror when Otzaria has nothing.
 */
export class OtzariaStore implements SaveStore {
  readonly kind = 'otzaria';
  constructor(
    private readonly bridge: OtzariaBridge,
    private readonly mirror: KeyValueStorage | null = null,
  ) {}

  private mirrorKey(key: string): string {
    return `otzaria-mirror:${key}`;
  }

  async get(key: string): Promise<string | null> {
    try {
      const res = await this.bridge.call('storage.get', { key });
      if (res && res.success && res.data !== null && res.data !== undefined) {
        return typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
      }
    } catch {
      /* fall through to the mirror */
    }
    try {
      return this.mirror?.getItem(this.mirrorKey(key)) ?? null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: string): Promise<void> {
    try {
      this.mirror?.setItem(this.mirrorKey(key), value);
    } catch {
      /* mirror is best effort */
    }
    const res = await this.bridge.call('storage.set', { key, value });
    if (res && res.success === false) throw new Error('Otzaria storage.set failed');
  }

  async remove(key: string): Promise<void> {
    try {
      this.mirror?.removeItem(this.mirrorKey(key));
    } catch {
      /* ignore */
    }
    try {
      await this.bridge.call('storage.remove', { key });
    } catch {
      /* ignore */
    }
  }
}

export interface Environment {
  Otzaria?: unknown;
  localStorage?: unknown;
}

function isBridge(v: unknown): v is OtzariaBridge {
  return (
    typeof v === 'object' && v !== null && typeof (v as { call?: unknown }).call === 'function'
  );
}

function workingStorage(v: unknown): KeyValueStorage | null {
  if (typeof v !== 'object' || v === null) return null;
  const s = v as KeyValueStorage;
  try {
    const probe = '__otiyot_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

/** Picks the store at boot: Otzaria if its bridge exists, else localStorage, else memory. */
export function detectStore(env: Environment = globalThis as Environment): SaveStore {
  const local = workingStorage(env.localStorage);
  if (isBridge(env.Otzaria)) return new OtzariaStore(env.Otzaria, local);
  if (local) return new LocalStorageStore(local);
  return new MemoryStore();
}
