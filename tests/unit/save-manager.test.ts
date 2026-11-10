import { describe, expect, it } from 'vitest';
import {
  BACKUP_KEY,
  CURRENT_VERSION,
  LEGACY_KEY,
  OtzariaStore,
  SAVE_KEY,
  SaveImportError,
  SaveManager,
  UNREADABLE_KEY,
  MemoryStore,
} from '../../src/save';
import { counter, fakeOtzaria, fakeTimers } from './save-helpers';

function make(store = new MemoryStore()) {
  const timers = fakeTimers();
  const errors: unknown[] = [];
  const m = new SaveManager(store, {
    newId: counter(),
    now: () => 1000,
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
    onError: (e) => errors.push(e),
  });
  return { m, store, timers, errors };
}

describe('load and round-trip', () => {
  it('starts fresh on an empty store', async () => {
    const { m } = make();
    const r = await m.load();
    expect(r).toMatchObject({ source: 'fresh', recovered: false });
    expect(m.save.profiles).toHaveLength(1);
    expect(m.save.version).toBe(CURRENT_VERSION);
  });

  it('saves and loads back the same data', async () => {
    const a = make();
    await a.m.load();
    a.m.update((p) => {
      p.name = 'Miriam';
      p.track = 2;
      p.keys['ש'] = {
        hits: 5,
        misses: 1,
        avgMs: 300,
        lastSeen: 9,
        ease: 2.6,
        due: 3,
        confusions: { ד: 1 },
      };
      p.wallet.glyphs = 12;
    });
    await a.m.flush();
    const b = make(a.store);
    const r = await b.m.load();
    expect(r.source).toBe('primary');
    expect(b.m.save).toEqual(a.m.save);
  });
});

describe('autosave', () => {
  it('debounces many changes into one write', async () => {
    const { m, store, timers } = make();
    await m.load();
    const writes: string[] = [];
    const orig = store.set.bind(store);
    store.set = (k, v) => {
      writes.push(k);
      return orig(k, v);
    };
    m.update((p) => (p.wallet.ink = 1));
    m.update((p) => (p.wallet.ink = 2));
    m.update((p) => (p.wallet.ink = 3));
    expect(timers.pending).toBe(1);
    expect(writes).toEqual([]);
    timers.fire();
    await m.flush();
    expect(JSON.parse((await store.get(SAVE_KEY)) ?? '{}').profiles[0].wallet.ink).toBe(3);
    expect(writes.filter((k) => k === SAVE_KEY)).toHaveLength(1);
  });

  it('does not write when nothing changed and reports write failures without throwing', async () => {
    const { m, store, errors } = make();
    await m.load();
    await m.flush();
    const before = (store as MemoryStore).data.size;
    await m.flush();
    expect((store as MemoryStore).data.size).toBe(before);
    store.set = () => Promise.reject(new Error('disk full'));
    m.update((p) => (p.wallet.ink = 9));
    await m.flush();
    expect(errors).toHaveLength(1);
    expect(m.activeProfile.wallet.ink).toBe(9);
  });
});

describe('corrupt-save recovery', () => {
  it('falls back to the last good copy and keeps the broken text', async () => {
    const { m, store } = make();
    await m.load();
    m.update((p) => (p.name = 'First'));
    await m.flush();
    m.update((p) => (p.name = 'Second'));
    await m.flush();
    await store.set(SAVE_KEY, '{"version":1,"profiles":[{"id":"x"'); // truncated write
    const b = make(store);
    const r = await b.m.load();
    expect(r).toMatchObject({ source: 'backup', recovered: true });
    expect(b.m.activeProfile.name).toBe('First');
    expect(await store.get(UNREADABLE_KEY)).toContain('"profiles"');
  });

  it('starts fresh when both copies are broken, never throws', async () => {
    const store = new MemoryStore();
    await store.set(SAVE_KEY, 'garbage');
    await store.set(BACKUP_KEY, '[1,2]');
    const { m } = make(store);
    const r = await m.load();
    expect(r).toMatchObject({ source: 'fresh', recovered: true });
    expect(m.save.profiles).toHaveLength(1);
  });

  it('never overwrites a save written by a newer version', async () => {
    const store = new MemoryStore();
    const future = JSON.stringify({ version: CURRENT_VERSION + 5, profiles: [] });
    await store.set(SAVE_KEY, future);
    const { m } = make(store);
    const r = await m.load();
    expect(r.tooNew).toBe(true);
    m.update((p) => (p.name = 'x'));
    await m.flush();
    expect(await store.get(SAVE_KEY)).toBe(future);
    expect(await store.get(UNREADABLE_KEY)).toBe(future);
  });

  it('upgrades an older stored save on load', async () => {
    const store = new MemoryStore();
    await store.set(SAVE_KEY, JSON.stringify({ id: 'old', name: 'Old', lang: 'en' }));
    const { m } = make(store);
    expect((await m.load()).source).toBe('primary');
    expect(m.activeProfile).toMatchObject({ id: 'old', name: 'Old', layout: 'en' });
  });
});

describe('profiles', () => {
  it('creates, renames, switches and deletes', async () => {
    const { m } = make();
    await m.load();
    const first = m.activeProfile.id;
    const b = m.createProfile('  Sara  ');
    expect(b.name).toBe('Sara');
    expect(m.activeProfile.id).toBe(b.id);
    expect(m.switchProfile(first)).toBe(true);
    expect(m.switchProfile('nope')).toBe(false);
    expect(m.renameProfile(b.id, 'Sarah')).toBe(true);
    expect(m.save.profiles.find((p) => p.id === b.id)?.name).toBe('Sarah');
    expect(m.renameProfile(b.id, '')).toBe(true);
    expect(m.save.profiles.find((p) => p.id === b.id)?.name).toBe('Player');
    expect(m.deleteProfile(first)).toBe(true);
    expect(m.activeProfile.id).toBe(b.id);
    expect(m.deleteProfile('nope')).toBe(false);
  });

  it('always keeps one profile', async () => {
    const { m } = make();
    await m.load();
    const only = m.activeProfile.id;
    m.deleteProfile(only);
    expect(m.save.profiles).toHaveLength(1);
    expect(m.activeProfile.id).not.toBe(only);
  });

  it('keeps profiles separate', async () => {
    const { m } = make();
    await m.load();
    m.update((p) => (p.wallet.glyphs = 5));
    m.createProfile('Two');
    expect(m.activeProfile.wallet.glyphs).toBe(0);
  });
});

describe('export and import', () => {
  it('round-trips a whole export into another install (replace)', async () => {
    const a = make();
    await a.m.load();
    a.m.update((p) => (p.wallet.glyphs = 7));
    a.m.createProfile('Two');
    const text = a.m.exportJson();
    const b = make();
    await b.m.load();
    expect(b.m.importJson(text, { replace: true })).toBe(2);
    expect(b.m.save.profiles.map((p) => p.name)).toEqual(['Player', 'Two']);
    expect(b.m.save.profiles[0]?.wallet.glyphs).toBe(7);
  });

  it('adds imported profiles without overwriting same-id ones', async () => {
    const a = make();
    await a.m.load();
    const text = a.m.exportJson(a.m.activeProfile.id);
    a.m.importJson(text);
    expect(a.m.save.profiles).toHaveLength(2);
    expect(new Set(a.m.save.profiles.map((p) => p.id)).size).toBe(2);
    expect(a.m.activeProfile.id).toBe(a.m.save.profiles[1]?.id);
  });

  it('rejects bad files with clear codes', async () => {
    const { m } = make();
    await m.load();
    const code = (t: string) => {
      try {
        m.importJson(t);
      } catch (e) {
        return e instanceof SaveImportError ? e.code : 'other';
      }
      return 'ok';
    };
    expect(code('{{')).toBe('not-json');
    expect(code('{"a":1}')).toBe('not-otiyot');
    expect(code(JSON.stringify({ app: 'otiyot', version: 99, profiles: [{}] }))).toBe('too-new');
    expect(code(JSON.stringify({ app: 'otiyot', version: 1, profiles: [] }))).toBe('empty');
  });
});

describe('Otzaria home and legacy import', () => {
  it('works end to end through a mocked Otzaria bridge', async () => {
    const { bridge, data } = fakeOtzaria();
    const a = make(new OtzariaStore(bridge) as never);
    await a.m.load();
    a.m.update((p) => (p.name = 'Plugin'));
    await a.m.flush();
    expect(typeof data.get(SAVE_KEY)).toBe('string');
    const b = make(new OtzariaStore(bridge) as never);
    await b.m.load();
    expect(b.m.activeProfile.name).toBe('Plugin');
  });

  it('imports old plugin progress once', async () => {
    const { bridge, data } = fakeOtzaria();
    data.set(LEGACY_KEY, {
      charStats: { ש: { attempts: 10, correct: 8, totalMs: 4000, lastSeen: 5 }, junk: 3 },
      progress: { completedLessonsByLanguage: { he: ['L1p-0', 'L1p-1'], en: [] } },
      sessions: [
        { timestamp: 99, netWpm: 21, accuracy: 96, durationMs: 60000, chars: 100, lang: 'he' },
      ],
    });
    const a = make(new OtzariaStore(bridge) as never);
    const r = await a.m.load();
    expect(r.legacyImported).toBe(true);
    expect(a.m.save.profiles).toHaveLength(1);
    const p = a.m.activeProfile;
    expect(p.keys['ש']).toMatchObject({ hits: 8, misses: 2, avgMs: 500 });
    expect(p.lessons['1']?.completed).toEqual(['L1p-0', 'L1p-1']);
    expect(p.history[0]).toMatchObject({ wpm: 21, accuracy: 96 });
    const b = make(new OtzariaStore(bridge) as never);
    expect((await b.m.load()).legacyImported).toBe(false);
    expect(b.m.save.profiles).toHaveLength(1);
  });

  it('marks legacy as checked when there is nothing to import', async () => {
    const a = make();
    expect((await a.m.load()).legacyImported).toBe(false);
    expect(a.m.save.meta.legacyChecked).toBe(true);
  });
});
