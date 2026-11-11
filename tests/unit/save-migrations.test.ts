import { describe, expect, it } from 'vitest';
import {
  CURRENT_VERSION,
  migrate,
  normalizeSave,
  normalizeProfile,
  SaveTooNewError,
  SaveUnreadableError,
  createProfile,
  MIGRATIONS,
  type Migration,
} from '../../src/save';
import { counter } from './save-helpers';

describe('migrations', () => {
  it('migrates a bare unversioned profile (v0) to the current version', () => {
    const old = { id: 'a', name: 'Dov', lang: 'en', settings: { musicVolume: 0.2 } };
    const m = migrate(old);
    expect(m.version).toBe(CURRENT_VERSION);
    const save = normalizeSave(m, CURRENT_VERSION, counter(), 1000);
    expect(save?.profiles).toHaveLength(1);
    expect(save?.profiles[0]?.name).toBe('Dov');
    expect(save?.profiles[0]?.layout).toBe('en');
    expect(save?.profiles[0]?.settings.musicVolume).toBe(0.2);
    expect(save?.activeProfileId).toBe('a');
  });

  it('migrates an unversioned multi-profile save and keeps the active profile', () => {
    const old = {
      profiles: [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B', lang: 'en' },
      ],
      active: 'b',
    };
    const save = normalizeSave(migrate(old), CURRENT_VERSION, counter(), 0);
    expect(save?.profiles.map((p) => p.id)).toEqual(['a', 'b']);
    expect(save?.activeProfileId).toBe('b');
    expect(save?.profiles[1]?.layout).toBe('en');
  });

  it('runs a chain of migrations in order', () => {
    const chain: Record<number, Migration> = {
      0: (r) => ({ ...r, a: 1 }),
      1: (r) => ({ ...r, b: (r.a as number) + 1 }),
      2: (r) => ({ ...r, c: (r.b as number) * 10 }),
    };
    const m = migrate({}, chain, 3);
    expect(m).toMatchObject({ a: 1, b: 2, c: 20, version: 3 });
    // starting midway only runs the later steps
    expect(migrate({ version: 2, b: 5 }, chain, 3)).toMatchObject({ c: 50, version: 3 });
  });

  it('refuses saves from a newer version and non-objects', () => {
    expect(() => migrate({ version: CURRENT_VERSION + 1 })).toThrow(SaveTooNewError);
    expect(() => migrate('nope')).toThrow(SaveUnreadableError);
    expect(() => migrate([])).toThrow(SaveUnreadableError);
    expect(() => migrate({ version: 0 }, {}, 1)).toThrow(SaveUnreadableError);
  });
});

describe('normalisation', () => {
  it('repairs garbage fields instead of crashing', () => {
    const p = normalizeProfile(
      {
        id: 7,
        name: '   ',
        track: 9,
        layout: 'fr',
        settings: { musicVolume: 5, backspace: 'x', hardcore: 'yes' },
        keys: { a: { hits: -3, misses: 'x', ease: 99 }, b: 'bad' },
        history: [{ wpm: 'fast' }, 4],
        arcade: { score: NaN, list: [1, undefined] },
      },
      'fallback',
      50,
    );
    expect(p.id).toBe('fallback');
    expect(p.name).toBe('Player');
    expect(p.track).toBe(1);
    expect(p.layout).toBe('he');
    expect(p.settings.musicVolume).toBe(1);
    expect(p.settings.backspace).toBe('allowed');
    expect(p.settings.hardcore).toBe(false);
    expect(p.keys.a).toMatchObject({ hits: 0, misses: 0, ease: 5 });
    expect(p.keys.b).toBeUndefined();
    expect(p.history).toHaveLength(1);
    expect(p.arcade).toEqual({ score: null, list: [1, null] });
  });

  it('gives duplicate ids new ids and falls back to the first profile as active', () => {
    const s = normalizeSave(
      { profiles: [{ id: 'x' }, { id: 'x' }], activeProfileId: 'gone' },
      1,
      counter('n'),
      0,
    );
    expect(new Set(s?.profiles.map((p) => p.id)).size).toBe(2);
    expect(s?.activeProfileId).toBe('x');
  });

  it('adds a profile when none exist and rejects non-objects', () => {
    expect(normalizeSave({ profiles: [] }, 1, counter(), 0)?.profiles).toHaveLength(1);
    expect(normalizeSave(5, 1, counter(), 0)).toBeNull();
  });

  it('caps history length', () => {
    const p = createProfile('a', 'A', 0);
    const history = Array.from({ length: 600 }, (_, i) => ({ at: i, wpm: 1 }));
    expect(normalizeProfile({ ...p, history }, 'z', 0).history).toHaveLength(500);
  });

  it('v2 -> v3 adds the display settings and keeps what the player already chose', () => {
    const v2 = {
      version: 2,
      profiles: [
        { id: 'a', name: 'A', settings: { musicVolume: 0.3, reducedMotion: true } },
        { id: 'b', name: 'B' },
      ],
      activeProfileId: 'a',
    };
    const m = migrate(v2);
    expect(m.version).toBe(CURRENT_VERSION);
    const save = normalizeSave(m, CURRENT_VERSION, counter(), 0);
    const a = save?.profiles[0]?.settings;
    expect(a).toMatchObject({
      musicVolume: 0.3,
      reducedMotion: true,
      theme: 'auto',
      colorblind: false,
      highContrast: false,
      largeText: false,
      dyslexiaFont: false,
    });
    expect(save?.profiles[1]?.settings.theme).toBe('auto');
    // a later save keeps a chosen theme
    const kept = migrate({ version: 2, profiles: [{ id: 'c', settings: { theme: 'dark' } }] });
    expect(normalizeSave(kept, CURRENT_VERSION, counter(), 0)?.profiles[0]?.settings.theme).toBe(
      'dark',
    );
  });

  it('v3 -> v4 adds the graphics quality choice and the benchmark result', () => {
    const v3 = {
      version: 3,
      profiles: [
        { id: 'a', name: 'A', settings: { theme: 'dark' } },
        { id: 'b', name: 'B', settings: { quality: 'low' } },
      ],
      activeProfileId: 'a',
      meta: { legacyChecked: true },
    };
    const m = migrate(v3);
    expect(m.version).toBe(CURRENT_VERSION);
    const save = normalizeSave(m, CURRENT_VERSION, counter(), 0);
    expect(save?.profiles[0]?.settings).toMatchObject({ theme: 'dark', quality: 'auto' });
    expect(save?.profiles[1]?.settings.quality).toBe('low');
    expect(save?.meta).toEqual({ legacyChecked: true, autoQuality: null });
    // a result already stored is kept, and nonsense is dropped
    const kept = migrate({ version: 3, profiles: [{ id: 'c' }], meta: { autoQuality: 'high' } });
    expect(normalizeSave(kept, CURRENT_VERSION, counter(), 0)?.meta.autoQuality).toBe('high');
    const bad = {
      version: 4,
      profiles: [{ id: 'd', settings: { quality: 'x' } }],
      meta: { autoQuality: 7 },
    };
    const fixed = normalizeSave(bad, CURRENT_VERSION, counter(), 0);
    expect(fixed?.meta.autoQuality).toBeNull();
    expect(fixed?.profiles[0]?.settings.quality).toBe('auto');
  });

  it('v4 -> v5 adds the keyboard guide choice (keys by default, kept when set)', () => {
    const v4 = {
      version: 4,
      profiles: [
        { id: 'a', name: 'A', settings: { quality: 'low' } },
        { id: 'b', name: 'B', settings: { keyboardGuide: 'hands' } },
        { id: 'c', name: 'C' },
      ],
      activeProfileId: 'a',
      meta: { legacyChecked: true, autoQuality: null },
    };
    const m = migrate(v4, MIGRATIONS, 5);
    expect(m.version).toBe(5);
    const save = normalizeSave(m, CURRENT_VERSION, counter(), 0);
    expect(save?.profiles[0]?.settings).toMatchObject({ quality: 'low', keyboardGuide: 'keys' });
    expect(save?.profiles[1]?.settings.keyboardGuide).toBe('hands');
    expect(save?.profiles[2]?.settings.keyboardGuide).toBe('keys');
    const bad = { version: 5, profiles: [{ id: 'd', settings: { keyboardGuide: 'big' } }] };
    expect(
      normalizeSave(bad, CURRENT_VERSION, counter(), 0)?.profiles[0]?.settings.keyboardGuide,
    ).toBe('keys');
  });

  it('v5 -> v6 adds voice and menu volumes, keeping music and effects', () => {
    const v5 = {
      version: 5,
      profiles: [
        { id: 'a', name: 'A', settings: { musicVolume: 0.2, sfxVolume: 0.4 } },
        { id: 'b', name: 'B', settings: { uiVolume: 0.1 } },
        { id: 'c', name: 'C' },
      ],
      activeProfileId: 'a',
      meta: { legacyChecked: true, autoQuality: null },
    };
    const m = migrate(v5);
    expect(m.version).toBe(CURRENT_VERSION);
    const save = normalizeSave(m, CURRENT_VERSION, counter(), 0);
    expect(save?.profiles[0]?.settings).toMatchObject({
      musicVolume: 0.2,
      sfxVolume: 0.4,
      voiceVolume: 0.9,
      uiVolume: 0.6,
    });
    expect(save?.profiles[1]?.settings.uiVolume).toBe(0.1);
    expect(save?.profiles[2]?.settings.voiceVolume).toBe(0.9);
    const bad = {
      version: 6,
      profiles: [{ id: 'd', settings: { voiceVolume: 9, uiVolume: 'x' } }],
    };
    const fixed = normalizeSave(bad, CURRENT_VERSION, counter(), 0)?.profiles[0]?.settings;
    expect(fixed?.voiceVolume).toBe(1);
    expect(fixed?.uiVolume).toBe(0.6);
  });

  it('v6 -> v7 adds the story settings: normal text speed, voices off', () => {
    const v6 = {
      version: 6,
      profiles: [
        { id: 'a', name: 'A', settings: { musicVolume: 0.2, voiceVolume: 0.5 } },
        { id: 'b', name: 'B', settings: { textSpeed: 'fast' } },
        { id: 'c', name: 'C' },
      ],
      activeProfileId: 'a',
      meta: { legacyChecked: true, autoQuality: null },
    };
    const m = migrate(v6);
    expect(m.version).toBe(7);
    const save = normalizeSave(m, CURRENT_VERSION, counter(), 0);
    expect(save?.profiles[0]?.settings).toMatchObject({
      musicVolume: 0.2,
      voiceVolume: 0.5,
      textSpeed: 'normal',
      storyVoices: false,
    });
    expect(save?.profiles[1]?.settings.textSpeed).toBe('fast');
    expect(save?.profiles[2]?.settings.storyVoices).toBe(false);
    const bad = {
      version: 7,
      profiles: [{ id: 'd', settings: { textSpeed: 'warp', storyVoices: 'yes' } }],
    };
    const fixed = normalizeSave(bad, CURRENT_VERSION, counter(), 0)?.profiles[0]?.settings;
    expect(fixed?.textSpeed).toBe('normal');
    expect(fixed?.storyVoices).toBe(false);
  });
});
