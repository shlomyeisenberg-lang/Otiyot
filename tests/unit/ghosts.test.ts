import { describe, expect, it } from 'vitest';
import {
  addToBoard,
  bestGhost,
  boardKey,
  boardKeys,
  deviceBoard,
  exportGhost,
  ghostProgress,
  GhostImportError,
  GhostRecorder,
  kindOfBoard,
  makeRecord,
  parseGhost,
} from '../../src/game/ghosts';
import {
  CURRENT_VERSION,
  createProfile,
  migrate,
  normalizeProfile,
  normalizeSave,
} from '../../src/save';
import { MAX_BOARD, MAX_GHOST_MARKS } from '../../src/save/schema';
import { counter } from './save-helpers';

const rec = (score: number, at = 1, marks = [1000, 2000, 3000]) =>
  makeRecord({ score, wpm: 30, accuracy: 97, durationMs: 3000, marks }, 'Dov', at);

describe('ghost recorder', () => {
  it('keeps only finish times since the first key, never text', () => {
    const r = new GhostRecorder();
    r.word(50); // before any key: ignored
    r.key(100);
    r.key(150);
    r.word(1100);
    r.word(2600);
    expect(r.trace()).toEqual([1000, 2500]);
    expect(r.trace().every((n) => typeof n === 'number')).toBe(true);
    r.reset();
    expect(r.trace()).toEqual([]);
  });

  it('caps the length of a trace', () => {
    const r = new GhostRecorder();
    r.key(0);
    for (let i = 0; i < MAX_GHOST_MARKS + 50; i++) r.word(i);
    expect(r.trace()).toHaveLength(MAX_GHOST_MARKS);
  });
});

describe('ghostProgress', () => {
  const marks = [1000, 2000, 4000];
  it('counts finished words and the part of the next one', () => {
    expect(ghostProgress(marks, 0)).toBe(0);
    expect(ghostProgress(marks, 500)).toBeCloseTo(0.5);
    expect(ghostProgress(marks, 1500)).toBeCloseTo(1.5);
    expect(ghostProgress(marks, 3000)).toBeCloseTo(2.5);
    expect(ghostProgress(marks, 9000)).toBe(3);
    expect(ghostProgress([], 500)).toBe(0);
  });
});

describe('boards', () => {
  it('orders by score, keeps the best five and reports the place', () => {
    const p = createProfile('a', 'Dov', 0);
    const key = boardKey('rail', 'standard:steady');
    expect(addToBoard(p, key, rec(100))).toEqual({ place: 1, newBest: false });
    expect(addToBoard(p, key, rec(300))).toEqual({ place: 1, newBest: true });
    expect(addToBoard(p, key, rec(200))).toEqual({ place: 2, newBest: false });
    expect(bestGhost(p, key)?.score).toBe(300);
    for (const s of [50, 60, 70, 80]) addToBoard(p, key, rec(s));
    expect(p.ghosts[key]).toHaveLength(MAX_BOARD);
    expect(addToBoard(p, key, rec(1))).toEqual({ place: 0, newBest: false });
    expect(p.ghosts[key]?.map((r) => r.score)).toEqual([300, 200, 100, 80, 70]);
  });

  it('beating the best ghost replaces it as the ghost to race', () => {
    const p = createProfile('a', 'Dov', 0);
    const key = boardKey('timeattack', 'mode:timeattack:meadow:easy:steady');
    addToBoard(p, key, rec(100, 1, [500, 900]));
    addToBoard(p, key, rec(150, 2, [400, 800]));
    expect(bestGhost(p, key)?.marks).toEqual([400, 800]);
  });

  it('a tie goes to the earlier run', () => {
    const p = createProfile('a', 'Dov', 0);
    const key = boardKey('daily', 'mode:daily:2026-11-14');
    addToBoard(p, key, rec(100, 5));
    addToBoard(p, key, rec(100, 9));
    expect(p.ghosts[key]?.map((r) => r.at)).toEqual([5, 9]);
  });

  it('shows every profile of the device on one board', () => {
    const a = createProfile('a', 'Dov', 0);
    const b = createProfile('b', 'Eli', 0);
    const key = boardKey('rail', 'easy:calm');
    addToBoard(a, key, rec(100));
    addToBoard(b, key, rec(250));
    const lines = deviceBoard({ profiles: [a, b] }, key);
    expect(lines.map((l) => l.profile)).toEqual(['Eli', 'Dov']);
    expect(boardKeys(a)).toEqual([key]);
    expect(kindOfBoard(key)).toBe('rail');
    expect(kindOfBoard('nope|x')).toBeNull();
  });
});

describe('ghost files', () => {
  it('round-trips a ghost and marks it imported', () => {
    const key = boardKey('rail', 'hard:steady');
    const { key: k2, record } = parseGhost(exportGhost(key, rec(222)));
    expect(k2).toBe(key);
    expect(record.imported).toBe(true);
    expect(record.score).toBe(222);
    expect(record.marks).toEqual([1000, 2000, 3000]);
  });

  it('holds no text: the file keys are only numbers and names', () => {
    const text = exportGhost(boardKey('rail', 'easy:calm'), rec(10));
    const f = JSON.parse(text) as { record: Record<string, unknown> };
    expect(Object.keys(f.record).sort()).toEqual(
      ['accuracy', 'at', 'durationMs', 'imported', 'marks', 'name', 'score', 'wpm'].sort(),
    );
  });

  it('rejects files that are not ghosts', () => {
    expect(() => parseGhost('not json')).toThrow(GhostImportError);
    expect(() => parseGhost('{"format":"other"}')).toThrow(GhostImportError);
    expect(() =>
      parseGhost(
        JSON.stringify({
          format: 'otiyot-ghost',
          version: 1,
          key: 'evil|x',
          record: { marks: [] },
        }),
      ),
    ).toThrow(GhostImportError);
    expect(() =>
      parseGhost(
        JSON.stringify({
          format: 'otiyot-ghost',
          version: 1,
          key: 'rail|x',
          record: { marks: [] },
        }),
      ),
    ).toThrow(GhostImportError);
  });

  it('cleans the numbers of a hostile file', () => {
    const text = JSON.stringify({
      format: 'otiyot-ghost',
      version: 1,
      key: 'rail|easy:calm',
      record: { marks: [10, 'x', -5, 20], score: 1e12, accuracy: 900, name: '  A   B ', wpm: -3 },
    });
    const { record } = parseGhost(text);
    expect(record.marks).toEqual([10, 20]);
    expect(record.accuracy).toBe(100);
    expect(record.score).toBe(1e6);
    expect(record.wpm).toBe(0);
    expect(record.name).toBe('A B');
  });
});

describe('save v11', () => {
  it('migrates a v10 save by adding empty ghost boards', () => {
    const old = { version: 10, profiles: [{ id: 'a', name: 'Dov' }], activeProfileId: 'a' };
    const m = migrate(old);
    expect(m.version).toBe(CURRENT_VERSION);
    const save = normalizeSave(m, CURRENT_VERSION, counter(), 0);
    expect(save?.profiles[0]?.ghosts).toEqual({});
  });

  it('keeps valid boards and drops broken ones', () => {
    const p = normalizeProfile(
      {
        id: 'a',
        ghosts: {
          'rail|easy:calm': [
            { score: 5, marks: [1, 2], name: 'X', accuracy: 90 },
            { score: 9, marks: [3], name: 'Y' },
            { score: 99, marks: [] },
            'junk',
          ],
          bad: 'nope',
        },
      },
      'a',
      0,
    );
    expect(p.ghosts['rail|easy:calm']?.map((r) => r.score)).toEqual([9, 5]);
    expect(p.ghosts.bad).toBeUndefined();
  });
});
