import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, DIFFICULTY_IDS } from '../../src/game/difficulty';
import { LEVEL_IDS, LEVELS } from '../../src/game/levels';
import { THEME_IDS, THEMES } from '../../src/audio/themes';
import { AMBIENCE_IDS } from '../../src/audio/ambience';
import { SFX_NAMES } from '../../src/audio/sfx';
import { REGIONS } from '../../src/game/regions';
import {
  atbash,
  atbashLetter,
  BOUNCE,
  BOUNCE_SLOW,
  CALM_HOLD,
  chapterAt,
  chapterStartsAt,
  charsOf,
  CIPHER_WORDS,
  colorShare,
  GATES_PER_LEVEL,
  gatesOpen,
  legAt,
  MIN_ROUND_S,
  neonFace,
  Patrol,
  PATROL_WPM,
  PATTERNS,
  patrolSeconds,
  planAtbash,
  SIGNS,
  signsLit,
  type AtbashPlan,
} from '../../src/scenes/atbash/plan';
import { ATBASH_LINES, atbashLine } from '../../src/story';
import { PARENT } from '../../src/ui/app';
import { playableRegions, SCENE_ROUTES } from '../../src/ui/playable';

const LETTERS = 'asdfjkl';
const WORDS = ['dag', 'lag', 'salad', 'flask', 'ask', 'fall', 'dad', 'sad', 'flash', 'ska'];
function wordSource(extra: string[] = []): { next(): string } {
  const all = [...extra, ...WORDS];
  let i = 0;
  return { next: () => all[i++ % all.length] as string };
}
const keysOf = (letters: string): Set<string> => new Set((letters + ' ').split(''));
const calm = DIFFICULTIES.calm;
const steady = DIFFICULTIES.steady;
let seed = 1;
const rng = (): number => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};

function plan(
  level: keyof typeof LEVELS = 'standard',
  letters = LETTERS + 'hgt',
  difficulty = steady,
  extra: string[] = [],
): AtbashPlan {
  return planAtbash({
    keys: keysOf(letters),
    level: LEVELS[level],
    difficulty,
    words: wordSource(extra),
    rng,
  });
}

describe('atbash', () => {
  it('turns the alphabet backward, in Hebrew and in English', () => {
    expect(atbashLetter('א')).toBe('ת');
    expect(atbashLetter('ב')).toBe('ש');
    expect(atbashLetter('ת')).toBe('א');
    expect(atbashLetter('a')).toBe('z');
    expect(atbashLetter('b')).toBe('y');
    expect(atbashLetter('Z')).toBe('A');
    expect(atbash('שלום')).toBe('בכפי');
    expect(atbash('abc')).toBe('zyx');
  });

  it('is its own reverse for every plain letter', () => {
    for (const ch of 'אבגדהוזחטיכלמנסעפצקרשתabcdefghijklmnopqrstuvwxyzABCXYZ') {
      expect(atbashLetter(atbashLetter(ch))).toBe(ch);
    }
  });

  it('reads a final letter as its plain form, and leaves everything else alone', () => {
    expect(atbashLetter('ם')).toBe(atbashLetter('מ'));
    expect(atbashLetter('ך')).toBe(atbashLetter('כ'));
    for (const ch of ['1', '.', ' ', ',', '-']) expect(atbashLetter(ch)).toBe(ch);
  });

  it('shows the broken letters in their true face and the rest in atbash', () => {
    expect(neonFace('flask', 0).join('')).toBe(atbash('flask'));
    expect(neonFace('flask', 2).join('')).toBe('fl' + atbash('ask'));
    expect(neonFace('flask', 9).join('')).toBe('flask');
    expect(neonFace('שלום', 1).join('')).toBe('ש' + atbash('לום'));
  });
});

describe('the run', () => {
  it('has a cipher and a sequence for every gate, on every level', () => {
    for (const id of LEVEL_IDS) {
      const p = plan(id);
      expect(p.gates).toBe(GATES_PER_LEVEL[id]);
      expect(p.legs.length).toBe(GATES_PER_LEVEL[id] * 2);
      p.legs.forEach((leg, i) => {
        expect(leg.kind).toBe(i % 2 === 0 ? 'cipher' : 'sequence');
        expect(leg.gate).toBe(Math.floor(i / 2));
        const n = leg.to - leg.from;
        if (leg.kind === 'cipher') {
          const [lo, hi] = CIPHER_WORDS[id];
          expect(n).toBeGreaterThanOrEqual(lo);
          expect(n).toBeLessThanOrEqual(hi);
        } else {
          expect(PATTERNS[id].map((pt) => pt.length)).toContain(n);
        }
      });
      expect(p.text).toBe(p.words.join(' '));
      expect(p.cipher).toEqual(p.words.map(atbash));
    }
  });

  it('plays a sequence as two codes in one of the level’s patterns', () => {
    for (const id of LEVEL_IDS) {
      const p = plan(id);
      for (const leg of p.legs.filter((l) => l.kind === 'sequence')) {
        const words = p.words.slice(leg.from, leg.to);
        const a = words[0] as string;
        const b = words.find((w) => w !== a) ?? a;
        const shape = words.map((w) => (w === a ? 0 : 1));
        expect(PATTERNS[id].some((pt) => pt.join() === shape.join())).toBe(true);
        expect(new Set(words).size).toBeLessThanOrEqual(2);
        expect(b).not.toBe('');
      }
    }
  });

  it('uses only learned keys on every level and difficulty, whatever the source offers', () => {
    const bad = ['zebra', 'quiz', 'jazz', 'xyz', 'Dog', 'a-b', 'two words'];
    for (const letters of ['asdf', 'asdfjkl', 'asdfjklgh', 'asdfjkleirtu']) {
      const keys = keysOf(letters);
      for (const level of LEVEL_IDS) {
        for (const d of DIFFICULTY_IDS) {
          const p = planAtbash({
            keys,
            level: LEVELS[level],
            difficulty: DIFFICULTIES[d],
            words: wordSource(bad),
            rng,
          });
          expect(p.words.length).toBeGreaterThan(0);
          for (const ch of p.text) expect(keys.has(ch)).toBe(true);
        }
      }
    }
  });

  it('uses only learned Hebrew letters too (the atbash face may show any letter)', () => {
    const keys = new Set('שדגכעיחלךהםבו '.split(''));
    const words = {
      next: (): string =>
        ['שדה', 'גשם', 'דג', 'כלב', 'חלב', 'שלום', 'abc'][Math.floor(rng() * 7)] as string,
    };
    for (const level of LEVEL_IDS) {
      const p = planAtbash({ keys, level: LEVELS[level], difficulty: calm, words, rng });
      expect(p.words.length).toBeGreaterThan(0);
      for (const ch of p.text) expect(keys.has(ch)).toBe(true);
      expect(p.cipher.every((c) => /^[א-ת]+$/.test(c))).toBe(true);
    }
  });

  it('never repeats a word twice in a row inside a cipher, and has no empty word', () => {
    for (let k = 0; k < 20; k++) {
      const p = plan('hard');
      for (const leg of p.legs.filter((l) => l.kind === 'cipher')) {
        for (let i = leg.from + 1; i < leg.to; i++) expect(p.words[i]).not.toBe(p.words[i - 1]);
      }
      for (const w of p.words) expect(w.length).toBeGreaterThan(0);
    }
  });

  it('gives up gracefully when no word can be spelled (never loops forever)', () => {
    const p = planAtbash({
      keys: keysOf('q'),
      level: LEVELS.standard,
      difficulty: steady,
      words: wordSource(),
      rng,
    });
    expect(p.words.length).toBe(0);
    expect(p.legs.length).toBe(0);
    expect(p.text).toBe('');
    expect(legAt(p, 0)).toBe(-1);
  });

  it('copes with a single learned word', () => {
    const p = planAtbash({
      keys: keysOf('ads'),
      level: LEVELS.easy,
      difficulty: steady,
      words: wordSource(),
      rng,
    });
    expect(p.words.length).toBeGreaterThan(0);
    for (const w of p.words) expect(['dad', 'sad', 'ads', 'add', 'sass']).toContain(w);
  });

  it('has chapters in order: the market, the towers, the great vault', () => {
    const p = plan('hard');
    expect(p.chapters.map((c) => c.id)).toEqual(['market', 'towers', 'vault']);
    expect(p.chapters[0]?.from).toBe(0);
    expect(p.chapters.at(-1)?.to).toBe(p.words.length);
    expect(chapterAt(p, 0)).toBe('market');
    expect(chapterAt(p, p.words.length + 3)).toBe('vault');
    const towers = p.chapters[1];
    expect(chapterStartsAt(p, towers?.from ?? -1)).toBe('towers');
    expect(chapterStartsAt(p, 1)).toBe(null);
  });

  it('finds the leg of every word and counts gates opened', () => {
    const p = plan('standard');
    p.legs.forEach((leg, i) => {
      for (let w = leg.from; w < leg.to; w++) expect(legAt(p, w)).toBe(i);
    });
    expect(gatesOpen(p, 0)).toBe(0);
    expect(gatesOpen(p, p.legs[1]?.to ?? 0)).toBe(1);
    expect(gatesOpen(p, p.words.length)).toBe(p.gates);
    expect(charsOf(['ab', 'cd'], true)).toBe(5);
    expect(charsOf(['ab', 'cd'], false)).toBe(6);
  });
});

describe('the patrol', () => {
  it('has no timer on Calm, and a timer on every leg otherwise', () => {
    for (const leg of plan('standard', LETTERS + 'hgt', calm).legs) expect(leg.patrol).toBe(null);
    for (const id of DIFFICULTY_IDS.filter((d) => d !== 'calm')) {
      for (const leg of plan('standard', LETTERS + 'hgt', DIFFICULTIES[id]).legs) {
        expect(leg.patrol).toBeGreaterThanOrEqual(MIN_ROUND_S);
      }
    }
  });

  it('gives longer legs more time, and harder difficulties and levels less', () => {
    const lv = LEVELS.standard;
    expect(patrolSeconds(60, steady, lv)).toBeGreaterThan(patrolSeconds(30, steady, lv) as number);
    const swift = DIFFICULTIES.swift;
    expect(patrolSeconds(60, swift, lv)).toBeLessThan(patrolSeconds(60, steady, lv) as number);
    expect(patrolSeconds(60, steady, LEVELS.hard)).toBeLessThanOrEqual(
      patrolSeconds(60, steady, LEVELS.easy) as number,
    );
  });

  it('is fair: a typist at the difficulty pace finishes before the drone is back', () => {
    for (const id of DIFFICULTY_IDS.filter((d) => d !== 'calm')) {
      const wpm = PATROL_WPM[id];
      for (const chars of [8, 20, 45]) {
        const typing = (chars * 12) / wpm;
        const round = patrolSeconds(chars, DIFFICULTIES[id], LEVELS.standard) as number;
        expect(round).toBeGreaterThan(typing / Math.max(0.5, LEVELS.standard.pace));
      }
    }
  });

  it('waits at the far end until it is sent out', () => {
    const p = new Patrol();
    p.start(10);
    expect(p.step(5)).toBe('waiting');
    expect(p.away).toBe(1);
  });

  it('on Calm drifts in to its hold and circles there forever', () => {
    const p = new Patrol();
    p.start(null);
    p.release();
    for (let i = 0; i < 2000; i++) expect(p.step(0.05)).not.toBe('spotted');
    expect(p.away).toBeCloseTo(CALM_HOLD);
    expect(p.spotted).toBe(0);
  });

  it('comes back in its time, spots once, goes round again slower', () => {
    const p = new Patrol();
    p.start(10);
    p.release();
    let t = 0;
    let step = p.step(0);
    while (step !== 'spotted' && t < 20) {
      step = p.step(0.1);
      t += 0.1;
    }
    expect(t).toBeGreaterThan(9.5);
    expect(t).toBeLessThan(10.6);
    expect(p.spotted).toBe(1);
    expect(p.away).toBeCloseTo(BOUNCE);
    expect(p.time).toBeCloseTo(10 * BOUNCE_SLOW);
    expect(p.step(0.1)).toBe('out');
  });

  it('starts every leg fresh, and a reset waits again', () => {
    const p = new Patrol();
    p.start(5);
    p.release();
    p.step(6);
    p.start(8);
    expect(p.away).toBe(1);
    expect(p.spotted).toBe(0);
    expect(p.released).toBe(false);
    p.reset();
    expect(p.time).toBe(null);
  });
});

describe('the city comes back', () => {
  it('lights more signs with every word, and all of them at the end', () => {
    let last = -1;
    for (let d = 0; d <= 20; d++) {
      const n = signsLit(d, 20);
      expect(n).toBeGreaterThanOrEqual(last);
      last = n;
    }
    expect(signsLit(0, 20)).toBeLessThan(SIGNS / 4);
    expect(signsLit(20, 20)).toBe(SIGNS);
    expect(colorShare(5, 10)).toBe(0.5);
    expect(colorShare(0, 0)).toBe(1);
  });
});

describe('Atbash City on the map', () => {
  it('is a region with a screen, a route, a theme, rain and sounds of its own', () => {
    expect(REGIONS.find((r) => r.id === 'atbash')?.act).toBe(2);
    expect(SCENE_ROUTES.atbash).toBe('atbash');
    expect(PARENT.atbash).toBe('hub');
    expect(playableRegions()).toContain('atbash');
    expect(THEME_IDS).toContain('atbash');
    expect(THEMES.atbash.id).toBe('atbash');
    expect(THEMES.atbash.voices.pulse).toBe('pluck');
    expect(AMBIENCE_IDS).toContain('rain');
    expect(SFX_NAMES).toContain('scan');
    expect(SFX_NAMES).toContain('unlock');
  });
});

describe('what Reb Ezra and Dyo say', () => {
  it('has Hebrew and English for every moment, and only men or Dyo speak', () => {
    for (const lines of Object.values(ATBASH_LINES)) {
      expect(lines.length).toBeGreaterThan(0);
      for (const l of lines) {
        expect(['ezra', 'dyo']).toContain(l.who);
        expect(l.text.he.length).toBeGreaterThan(5);
        expect(l.text.en.length).toBeGreaterThan(5);
        expect(/[֐-׿]/.test(l.text.he)).toBe(true);
      }
    }
  });

  it('keeps the story clean: nothing about women, nothing suggestive, no holy Names', () => {
    const all = Object.values(ATBASH_LINES)
      .flat()
      .map((l) => `${l.text.en} ${l.text.he}`)
      .join(' ');
    expect(all).not.toMatch(/\b(she|her|woman|women|girl|lady|wife|kiss|love|sexy)\b/i);
    expect(all).not.toMatch(/יהוה|אלוהים/);
  });

  it('picks a line by counter and wraps around', () => {
    const lines = ATBASH_LINES.spotted;
    expect(atbashLine('spotted', 0)).toBe(lines[0]);
    expect(atbashLine('spotted', lines.length)).toBe(lines[0]);
  });
});
