import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, DIFFICULTY_IDS } from '../../src/game/difficulty';
import { LEVEL_IDS, LEVELS } from '../../src/game/levels';
import { THEME_IDS, THEMES } from '../../src/audio/themes';
import { REGIONS, STORY_REGIONS } from '../../src/game/regions';
import {
  activeModifiers,
  addScore,
  CALM_FLOOR,
  CAUGHT,
  Climb,
  climbSource,
  colorAt,
  FLOOR_KINDS,
  FLOOR_WORDS,
  floorKind,
  floorPoints,
  Grip,
  KEY_GAIN,
  LANDING_EVERY,
  lookahead,
  MODIFIERS,
  scoreMultiplier,
  SLIP,
  slipCost,
  STREAK_GAIN,
  STREAK_STEP,
  TABLE_SIZE,
  TIRE_WPM,
  tireRate,
  WARMUP_FLOORS,
  weakScore,
  wordPoints,
  type FloorKind,
  type LadderScore,
  type ModifierId,
} from '../../src/scenes/ladder/plan';
import { LADDER_LINES, ladderLine } from '../../src/story';
import { PARENT } from '../../src/ui/app';
import { playableRegions, SCENE_ROUTES } from '../../src/ui/playable';
import en from '../../locales/en.json';
import he from '../../locales/he.json';

const LETTERS = 'asdfjkl';
const WORDS = ['dag', 'lag', 'salad', 'flask', 'ask', 'fall', 'dad', 'sad', 'flash', 'ska'];
const LONG = ['salads', 'flasks', 'falafel', 'kalash'];
function source(list: string[]): { next(): string } {
  let i = 0;
  return { next: () => list[i++ % list.length] as string };
}
const keysOf = (letters: string): Set<string> => new Set((letters + ' ').split(''));
let seed = 1;
const rng = (): number => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};

function climb(
  o: {
    level?: keyof typeof LEVELS;
    letters?: string;
    difficulty?: keyof typeof DIFFICULTIES;
    mods?: ModifierId[];
    words?: string[];
    weak?: string[];
  } = {},
): Climb {
  return new Climb({
    keys: keysOf(o.letters ?? LETTERS + 'hgte'),
    level: LEVELS[o.level ?? 'standard'],
    difficulty: DIFFICULTIES[o.difficulty ?? 'steady'],
    mods: o.mods ?? [],
    words: source(o.words ?? WORDS),
    longWords: source(LONG),
    weak: o.weak ?? [],
    rng,
  });
}

describe('the climb', () => {
  it('lays out floors one at a time, as far up as one goes', () => {
    for (const level of LEVEL_IDS) {
      const c = climb({ level });
      expect(c.ensure(200)).toBe(true);
      expect(c.words.length).toBeGreaterThan(200);
      const [lo, hi] = FLOOR_WORDS[level];
      let at = 0;
      for (const f of c.floors) {
        expect(f.from).toBe(at);
        const n = f.to - f.from;
        expect(n).toBeGreaterThanOrEqual(lo);
        expect(n).toBeLessThanOrEqual(hi + (f.kind === 'swarm' ? 1 : 0));
        expect(f.landing).toBe(f.number % LANDING_EVERY === 0);
        at = f.to;
      }
      expect(at).toBe(c.words.length);
    }
  });

  it('uses only learned keys on every level, difficulty and modifier, whatever the source offers', () => {
    const offered = [...WORDS, 'zebra', 'quiz', 'hello world', '', 'dagz', 'שלום'];
    for (const level of LEVEL_IDS)
      for (const d of DIFFICULTY_IDS) {
        const c = climb({
          level,
          difficulty: d,
          mods: [...MODIFIERS],
          words: offered,
          letters: LETTERS,
        });
        c.ensure(80);
        const keys = keysOf(LETTERS);
        for (const w of c.words) {
          expect(w.length).toBeGreaterThan(0);
          for (const ch of w) expect(keys.has(ch), `${w} on ${level}/${d}`).toBe(true);
        }
      }
  });

  it('uses only learned Hebrew letters too', () => {
    const letters = 'שדגכעיחלךה';
    const c = new Climb({
      keys: keysOf(letters),
      level: LEVELS.easy,
      difficulty: DIFFICULTIES.calm,
      mods: ['long'],
      words: source(['שד', 'כלה', 'דג', 'גדי', 'שלום', 'חלה', 'עכה']),
      longWords: source(['כלכלה', 'שלום']),
      weak: ['ע'],
      rng,
    });
    c.ensure(40);
    for (const w of c.words) for (const ch of w) expect(letters).toContain(ch);
  });

  it('leans toward the weakest keys', () => {
    const plain = climb({ words: WORDS });
    const weak = climb({ words: WORDS, weak: ['k'] });
    plain.ensure(120);
    weak.ensure(120);
    const share = (c: Climb): number =>
      c.words.filter((w) => w.includes('k')).length / c.words.length;
    expect(share(weak)).toBeGreaterThan(share(plain));
    expect(weakScore('flask', ['k', 'f', 'z'])).toBe(2);
  });

  it('never puts the same word twice in a row', () => {
    const c = climb();
    c.ensure(150);
    for (let i = 1; i < c.words.length; i++) expect(c.words[i]).not.toBe(c.words[i - 1]);
  });

  it('gives up gracefully when nothing can be spelled (never loops forever)', () => {
    const c = climb({ letters: 'qz' });
    expect(c.ensure(0)).toBe(false);
    expect(c.floors.length).toBe(0);
    expect(climbSource(c).next()).toBe('');
  });

  it('feeds the typing driver word by word, forever', () => {
    const c = climb();
    const src = climbSource(c);
    const got: string[] = [];
    for (let i = 0; i < 120; i++) got.push(src.next());
    expect(got).toEqual(c.words.slice(0, 120));
  });

  it('starts with plain steps, rests after a landing, and never repeats a challenge', () => {
    const c = climb();
    c.ensure(400);
    for (const f of c.floors) {
      if (f.number <= WARMUP_FLOORS) expect(f.kind).toBe('steps');
      if (f.number > 1 && (f.number - 1) % LANDING_EVERY === 0) expect(f.kind).toBe('steps');
    }
    for (let i = 1; i < c.floors.length; i++)
      if (c.floors[i]?.kind !== 'steps') expect(c.floors[i]?.kind).not.toBe(c.floors[i - 1]?.kind);
    const kinds = new Set(c.floors.map((f) => f.kind));
    for (const k of FLOOR_KINDS) expect(kinds).toContain(k);
    expect(floorKind(3, 'gale', () => 0.999)).not.toBe('gale');
  });

  it('finds the floor of every word and counts the characters a floor asks for', () => {
    const c = climb();
    c.ensure(60);
    c.floors.forEach((f, i) => {
      expect(c.floorAt(f.from)).toBe(i);
      expect(c.floorAt(f.to - 1)).toBe(i);
      let n = 0;
      for (let k = f.from; k < f.to; k++) n += (c.words[k] as string).length + 1;
      expect(c.floorChars(i)).toBe(n);
    });
    expect(c.floorChars(999)).toBe(1);
  });

  it('uses longer words on long floors and with the long modifier', () => {
    const c = climb({ mods: ['long'] });
    c.ensure(40);
    for (const w of c.words) expect(LONG).toContain(w);
  });

  it('hides the words ahead in the cloud, in the fog, and nowhere else', () => {
    expect(lookahead('lantern', 'easy', [])).toBe(0);
    expect(lookahead('steps', 'hard', ['fog'])).toBe(0);
    expect(lookahead('steps', 'easy', [])).toBe(2);
    expect(lookahead('gale', 'standard', [])).toBe(1);
  });
});

describe('the grip', () => {
  it('is tightened by right letters and by every clean streak', () => {
    const g = new Grip();
    g.reset(false);
    g.value = 0.5;
    for (let i = 1; i < STREAK_STEP; i++) expect(g.key(true, 0.1)).toBe('none');
    expect(g.key(true, 0.1)).toBe('tighten');
    expect(g.value).toBeCloseTo(0.5 + STREAK_STEP * KEY_GAIN + STREAK_GAIN, 5);
    expect(g.tightens).toBe(1);
  });

  it('loosens on a slip, and Dyo catches the climber once before he falls', () => {
    const g = new Grip();
    g.reset(false);
    expect(g.key(false, 0.4)).toBe('slip');
    expect(g.streak).toBe(0);
    g.key(false, 0.4);
    expect(g.key(false, 0.4)).toBe('caught');
    expect(g.value).toBe(CAUGHT);
    expect(g.catches).toBe(0);
    g.key(false, 0.3);
    expect(g.key(false, 0.3)).toBe('fall');
    expect(g.fallen).toBe(true);
    expect(g.key(true, 0.3)).toBe('none');
    expect(g.step(1)).toBe('none');
  });

  it('on Calm never tires and never gives out, however many slips', () => {
    const g = new Grip();
    g.reset(true);
    g.floor(0);
    for (let i = 0; i < 100; i++) expect(g.key(false, 0.3)).toBe('slip');
    expect(g.value).toBe(CALM_FLOOR);
    expect(g.step(10)).toBe('none');
    expect(tireRate(DIFFICULTIES.calm, LEVELS.hard, 40, 'gale', ['steep'])).toBe(0);
  });

  it('waits for the first key of a floor before it tires', () => {
    const g = new Grip();
    g.reset(false);
    g.floor(0.1);
    g.step(0.2);
    expect(g.value).toBe(1);
    g.key(true, 0.1);
    g.step(0.2);
    expect(g.value).toBeLessThan(1);
  });

  it('tires faster higher up (capped), in a gale, and on a steep tower', () => {
    const s = DIFFICULTIES.steady;
    const r1 = tireRate(s, LEVELS.standard, 1, 'steps', []);
    expect(tireRate(s, LEVELS.standard, 10, 'steps', [])).toBeGreaterThan(r1);
    expect(tireRate(s, LEVELS.standard, 500, 'steps', [])).toBeCloseTo(r1 * 2, 6);
    expect(tireRate(s, LEVELS.standard, 1, 'gale', [])).toBeGreaterThan(r1);
    expect(tireRate(s, LEVELS.standard, 1, 'steps', ['steep'])).toBeGreaterThan(r1);
    expect(tireRate(DIFFICULTIES.fierce, LEVELS.standard, 1, 'steps', [])).toBeGreaterThan(r1);
    expect(slipCost('steady', 'glass', [])).toBe(SLIP.steady * 2);
    expect(slipCost('steady', 'steps', ['brittle'])).toBeGreaterThan(SLIP.steady);
  });

  it('is fair: a typist at the difficulty pace, without slips, climbs at least ten floors', () => {
    for (const d of DIFFICULTY_IDS) {
      if (!DIFFICULTIES[d].timers) continue;
      for (const id of LEVEL_IDS) {
        const c = climb({ level: id, difficulty: d });
        c.ensure(100);
        const g = new Grip();
        g.reset(false);
        const cps = (TIRE_WPM[d] * 5) / 60;
        for (let fi = 0; fi < 10; fi++) {
          const f = c.floors[fi];
          if (!f) break;
          g.floor(c.tire(f));
          const chars = c.floorChars(fi);
          let acc = 0;
          let typed = 0;
          while (typed < chars) {
            acc += cps * 0.05;
            while (acc >= 1 && typed < chars) {
              acc -= 1;
              typed += 1;
              g.key(true, c.slip(f));
            }
            expect(g.step(0.05), `${d}/${id} floor ${f.number} (${f.kind})`).toBe('none');
          }
          if (f.landing) g.landing();
        }
        expect(g.slips).toBe(0);
      }
    }
  });
});

describe('the score', () => {
  it('pays more for harder climbs and every modifier, and drops modifiers that mean nothing on Calm', () => {
    expect(scoreMultiplier('steady', 'easy', [])).toBe(1);
    expect(scoreMultiplier('fierce', 'hard', [])).toBeGreaterThan(
      scoreMultiplier('steady', 'hard', []),
    );
    expect(scoreMultiplier('steady', 'easy', ['fog'])).toBeGreaterThan(1);
    expect(activeModifiers(['steep', 'fog', 'brittle'], DIFFICULTIES.calm)).toEqual(['fog']);
    expect(activeModifiers(['steep', 'fog'], DIFFICULTIES.swift)).toEqual(['fog', 'steep']);
    expect(climb({ difficulty: 'calm', mods: ['steep'] }).multiplier).toBe(
      scoreMultiplier('calm', 'standard', []),
    );
  });

  it('pays for letters, the streak tier, higher floors and clean floors', () => {
    expect(wordPoints('salad', 0, 'steps', 1)).toBe(50);
    expect(wordPoints('salad', 4, 'steps', 1)).toBeGreaterThan(50);
    expect(floorPoints(10, 'steps', false, 1)).toBeGreaterThan(floorPoints(1, 'steps', false, 1));
    expect(floorPoints(3, 'steps', true, 1)).toBeGreaterThan(floorPoints(3, 'steps', false, 1));
    expect(floorPoints(3, 'glass', true, 1)).toBeGreaterThan(floorPoints(3, 'steps', true, 1));
    const kinds: FloorKind[] = [...FLOOR_KINDS];
    for (const k of kinds) expect(wordPoints('a', 0, k, 1)).toBeGreaterThan(0);
  });

  it('keeps the ten best climbs, best first, and says where the new one landed', () => {
    const row = (score: number, at: number): LadderScore => ({
      at,
      score,
      floors: Math.floor(score / 100),
      accuracy: 95,
      wpm: 20,
      difficulty: 'steady',
      level: 'easy',
      mods: [],
    });
    let table: LadderScore[] = [];
    for (let i = 0; i < 12; i++) table = addScore(table, row(i * 100, i)).table;
    expect(table).toHaveLength(TABLE_SIZE);
    expect(table[0]?.score).toBe(1100);
    const best = addScore(table, row(5000, 99));
    expect(best.place).toBe(0);
    expect(addScore(table, row(1, 100)).place).toBe(-1);
    expect(addScore(table, row(650, 100)).place).toBe(5);
  });

  it('brings the color back floor by floor', () => {
    expect(colorAt(0)).toBe(0);
    expect(colorAt(5)).toBeCloseTo(0.5);
    expect(colorAt(40)).toBe(1);
  });
});

describe('the Ladder on the map', () => {
  it('is free play with a screen, a route and a theme of its own', () => {
    expect(REGIONS.find((r) => r.id === 'ladder')?.act).toBe(0);
    expect(STORY_REGIONS).not.toContain('ladder');
    expect(SCENE_ROUTES.ladder).toBe('ladder');
    expect(PARENT.ladder).toBe('hub');
    expect(playableRegions()).toContain('ladder');
    expect(THEME_IDS).toContain('ladder');
    expect(THEMES.ladder.pulse.length).toBe(THEMES.ladder.beats * THEMES.ladder.sub);
  });

  it('has every one of its words in English and Hebrew', () => {
    const keys = Object.keys(en).filter((k) => k.startsWith('ladder.') || k.endsWith('.ladder'));
    expect(keys.length).toBeGreaterThan(20);
    for (const k of keys) expect((he as Record<string, string>)[k], k).toBeTruthy();
  });
});

describe('what Reb Ezra and Dyo say on the Ladder', () => {
  it('has Hebrew and English for every moment, and only men or Dyo speak', () => {
    for (const lines of Object.values(LADDER_LINES)) {
      expect(lines.length).toBeGreaterThan(0);
      for (const l of lines) {
        expect(['ezra', 'dyo']).toContain(l.who);
        expect(l.text.he.length).toBeGreaterThan(5);
        expect(/[֐-׿]/.test(l.text.he)).toBe(true);
        expect(l.text.en.length).toBeGreaterThan(5);
      }
    }
  });

  it('keeps it clean and gentle', () => {
    const all = Object.values(LADDER_LINES)
      .flat()
      .map((l) => `${l.text.en} ${l.text.he}`)
      .join(' ');
    expect(all).not.toMatch(/\b(she|her|woman|women|girl|lady|wife|kiss|love|sexy)\b/i);
    expect(all).not.toMatch(/\b(blood|kill|dead|die|monster|scream)\b/i);
    expect(all).not.toMatch(/יהוה|אלוהים/);
  });

  it('picks a line by counter and wraps around', () => {
    const lines = LADDER_LINES.fall;
    expect(ladderLine('fall', 0)).toBe(lines[0]);
    expect(ladderLine('fall', lines.length)).toBe(lines[0]);
  });
});
