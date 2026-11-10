import {
  MemoryStore,
  type KeyValueStorage,
  type OtzariaBridge,
  type OtzariaReply,
} from '../../src/save';

export function counter(prefix = 'id'): () => string {
  let i = 0;
  return () => `${prefix}${++i}`;
}

/** A manual timer so autosave tests need no real waiting. */
export function fakeTimers() {
  let next = 1;
  const pending = new Map<number, () => void>();
  return {
    setTimer: (fn: () => void) => {
      const h = next++;
      pending.set(h, fn);
      return h;
    },
    clearTimer: (h: unknown) => {
      pending.delete(h as number);
    },
    get pending() {
      return pending.size;
    },
    fire() {
      const fns = [...pending.values()];
      pending.clear();
      fns.forEach((f) => f());
    },
  };
}

export class FakeStorage implements KeyValueStorage {
  readonly data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

/** Otzaria bridge mock backed by a map. `fail` makes every call throw. */
export function fakeOtzaria() {
  const data = new Map<string, unknown>();
  const calls: string[] = [];
  const bridge: OtzariaBridge & { fail: boolean } = {
    fail: false,
    call(method, args): Promise<OtzariaReply | undefined> {
      calls.push(method);
      if (bridge.fail) return Promise.reject(new Error('bridge down'));
      const key = args.key as string;
      if (method === 'storage.get')
        return Promise.resolve({ success: true, data: data.get(key) ?? null });
      if (method === 'storage.set') {
        data.set(key, args.value);
        return Promise.resolve({ success: true });
      }
      if (method === 'storage.remove') {
        data.delete(key);
        return Promise.resolve({ success: true });
      }
      return Promise.resolve(undefined);
    },
  };
  return { bridge, data, calls };
}

export { MemoryStore };
