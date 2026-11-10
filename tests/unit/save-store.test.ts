import { describe, expect, it } from 'vitest';
import { detectStore, LocalStorageStore, MemoryStore, OtzariaStore } from '../../src/save';
import { FakeStorage, fakeOtzaria } from './save-helpers';

describe('LocalStorageStore', () => {
  it('round-trips and removes', async () => {
    const s = new LocalStorageStore(new FakeStorage());
    expect(await s.get('k')).toBeNull();
    await s.set('k', 'v');
    expect(await s.get('k')).toBe('v');
    await s.remove('k');
    expect(await s.get('k')).toBeNull();
  });

  it('rejects a failed write and returns null on a failed read', async () => {
    const broken = {
      getItem: () => {
        throw new Error('no');
      },
      setItem: () => {
        throw new Error('full');
      },
      removeItem: () => {
        throw new Error('no');
      },
    };
    const s = new LocalStorageStore(broken);
    expect(await s.get('k')).toBeNull();
    await expect(s.set('k', 'v')).rejects.toThrow();
    await expect(s.remove('k')).resolves.toBeUndefined();
  });
});

describe('OtzariaStore (mocked bridge)', () => {
  it('writes through storage.set and reads through storage.get', async () => {
    const { bridge, data, calls } = fakeOtzaria();
    const s = new OtzariaStore(bridge, null);
    await s.set('k', '{"a":1}');
    expect(data.get('k')).toBe('{"a":1}');
    expect(await s.get('k')).toBe('{"a":1}');
    expect(calls).toEqual(['storage.set', 'storage.get']);
  });

  it('returns object data as JSON text (old plugin stored objects)', async () => {
    const { bridge, data } = fakeOtzaria();
    data.set('old', { a: 1 });
    expect(await new OtzariaStore(bridge).get('old')).toBe('{"a":1}');
  });

  it('keeps a local mirror and reads it when Otzaria is down or empty', async () => {
    const { bridge } = fakeOtzaria();
    const mirror = new FakeStorage();
    const s = new OtzariaStore(bridge, mirror);
    await s.set('k', 'v1');
    expect(mirror.getItem('otzaria-mirror:k')).toBe('v1');
    bridge.fail = true;
    expect(await s.get('k')).toBe('v1');
    await expect(s.set('k', 'v2')).rejects.toThrow('bridge down');
    expect(mirror.getItem('otzaria-mirror:k')).toBe('v2');
  });

  it('treats success:false as a failed write', async () => {
    const s = new OtzariaStore({ call: () => Promise.resolve({ success: false }) });
    await expect(s.set('k', 'v')).rejects.toThrow();
  });
});

describe('detectStore', () => {
  it('prefers Otzaria when its bridge exists', () => {
    const { bridge } = fakeOtzaria();
    expect(detectStore({ Otzaria: bridge, localStorage: new FakeStorage() }).kind).toBe('otzaria');
  });
  it('uses localStorage on the web', () => {
    expect(detectStore({ localStorage: new FakeStorage() }).kind).toBe('local');
  });
  it('falls back to memory when storage is blocked or absent', () => {
    expect(detectStore({}).kind).toBe('memory');
    const blocked = {
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(detectStore({ localStorage: blocked }).kind).toBe('memory');
    expect(new MemoryStore().kind).toBe('memory');
  });
});
