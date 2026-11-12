import { describe, expect, it } from 'vitest';
import { LEVEL_IDS } from '../../src/game/levels';
import { THEME_IDS, THEMES } from '../../src/audio/themes';
import { REGIONS } from '../../src/game/regions';
import {
  BURST_RATIO,
  chapterAt,
  chapterStartsAt,
  colorShare,
  CURRENT_UP,
  currentAfter,
  DRIFT_LIMIT,
  LIFT_CURRENT,
  liftedWhole,
  PAGES_PER_LEVEL,
  pageSteady,
  planGeniza,
  REST_MS,
  SECTIONS,
  shaftsOpen,
  siltAfter,
  SILT_PER_BURST,
  STEADY,
  steadinessOf,
  steadyPercent,
  Tide,
  TIDE_MAX_MS,
  TIDE_MIN_MS,
  TIDE_START_MS,
  type PageBeat,
} from '../../src/scenes/geniza/plan';
import { GENIZA_LINES, genizaLine } from '../../src/story';
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
const beat = (): PageBeat => ({ steadiness: 0, bursts: 0 });

describe('the run', () => {
  it('has the right number of pages on every level, in whole quarters', () => {
    for (const level of LEVEL_IDS) {
      const plan = planGeniza({ keys: keysOf(LETTERS), level, words: wordSource() });
      expect(plan.pages).toHaveLength(PAGES_PER_LEVEL[level]);
      expect(plan.pages.length % SECTIONS).toBe(0);
      expect(plan.text).toBe(plan.pages.map((p) => p.word).join(' '));
      expect(plan.level).toBe(level);
    }
  });

  it('uses only learned letters, even if the word source offers others', () => {
    for (const letters of ['asdfjkl', 'asdf', 'dafsl']) {
      const keys = keysOf(letters);
      for (const level of LEVEL_IDS) {
        const plan = planGeniza({
          keys,
          level,
          words: wordSource(['qwerty', 'ghost', 'zebra', 'a b']),
        });
        for (const ch of plan.text.replace(/ /g, ''))
          expect(keys.has(ch), `${letters}|${ch}`).toBe(true);
        expect(plan.text).not.toMatch(/[qwertyzbghoe]/);
      }
    }
  });

  it('uses only learned Hebrew letters too', () => {
    const keys = keysOf('שדגכע');
    const words = wordSource(['שלום', 'דג', 'גד', 'כעס', 'שד', 'עג']);
    const plan = planGeniza({ keys, level: 'standard', words });
    expect(plan.pages.length).toBeGreaterThan(0);
    for (const ch of plan.text.replace(/ /g, '')) expect(keys.has(ch), ch).toBe(true);
  });

  it('never repeats a word twice in a row and has no empty page', () => {
    const plan = planGeniza({
      keys: keysOf(LETTERS),
      level: 'hard',
      words: wordSource(['dag', 'dag', 'dag']),
    });
    for (let i = 1; i < plan.pages.length; i++)
      expect(plan.pages[i]?.word).not.toBe(plan.pages[i - 1]?.word);
    for (const p of plan.pages) expect(p.word.length).toBeGreaterThan(0);
  });

  it('gives up gracefully when no word can be spelled (never loops forever)', () => {
    const plan = planGeniza({ keys: keysOf('q'), level: 'easy', words: wordSource() });
    expect(plan.pages).toHaveLength(0);
    expect(plan.text).toBe('');
    expect(plan.chapters).toHaveLength(0);
  });

  it('has three chapters that cover the run in order', () => {
    for (const level of LEVEL_IDS) {
      const plan = planGeniza({ keys: keysOf(LETTERS), level, words: wordSource() });
      expect(plan.chapters.map((c) => c.id)).toEqual(['shallows', 'stacks', 'vault']);
      expect(plan.chapters[0]?.from).toBe(0);
      expect(plan.chapters.at(-1)?.to).toBe(plan.pages.length);
      for (let i = 1; i < plan.chapters.length; i++)
        expect(plan.chapters[i]?.from).toBe(plan.chapters[i - 1]?.to);
      expect(chapterAt(plan, 0)).toBe('shallows');
      expect(chapterAt(plan, plan.pages.length - 1)).toBe('vault');
      expect(chapterAt(plan, plan.pages.length + 5)).toBe('vault');
      expect(chapterStartsAt(plan, plan.chapters[1]?.from ?? -1)).toBe('stacks');
      expect(chapterStartsAt(plan, 1)).toBeNull();
    }
  });
});

describe('the tide', () => {
  it('starts at its first guess and ignores the first key and long rests', () => {
    const tide = new Tide();
    expect(tide.period).toBe(TIDE_START_MS);
    expect(tide.key(null)).toBe('rest');
    expect(tide.key(REST_MS + 1)).toBe('rest');
    expect(tide.key(0)).toBe('rest');
    expect(tide.key(Number.NaN)).toBe('rest');
    expect(tide.period).toBe(TIDE_START_MS);
    expect(tide.steadiness).toBe(1);
  });

  it('rewards an even beat at any speed: the tide learns the pace', () => {
    for (const ms of [180, 300, 600, 900]) {
      const tide = new Tide();
      // Settle into the player's pace over a few pages.
      for (let k = 0; k < 40; k++) tide.key(ms);
      tide.endPage(beat());
      for (let k = 0; k < 6; k++) expect(tide.key(ms)).toBe('steady');
      const out = tide.endPage(beat());
      expect(out.bursts).toBe(0);
      expect(out.steadiness).toBeGreaterThan(0.9);
      expect(pageSteady(out, true)).toBe(true);
    }
  });

  it('marks a sudden rush as a burst and makes the page unsteady', () => {
    const tide = new Tide();
    for (let k = 0; k < 30; k++) tide.key(400);
    tide.endPage(beat());
    tide.key(400);
    expect(tide.key(400 * BURST_RATIO * 0.5)).toBe('burst');
    tide.key(60);
    tide.key(60);
    const out = tide.endPage(beat());
    expect(out.bursts).toBeGreaterThanOrEqual(2);
    expect(pageSteady(out, true)).toBe(false);
  });

  it('judges an uneven beat as unsteady even without a burst', () => {
    const tide = new Tide();
    for (let k = 0; k < 30; k++) tide.key(500);
    tide.endPage(beat());
    for (const ms of [500, 1400, 520, 1500, 480, 1300]) tide.key(ms);
    const out = tide.endPage(beat());
    expect(out.steadiness).toBeLessThan(STEADY);
    expect(pageSteady(out, true)).toBe(false);
  });

  it('moves only a little on one fast key and stays within its bounds', () => {
    const tide = new Tide();
    tide.key(50);
    expect(tide.period).toBeGreaterThan(TIDE_START_MS * 0.7);
    for (let k = 0; k < 200; k++) tide.key(20);
    expect(tide.period).toBeGreaterThanOrEqual(TIDE_MIN_MS);
    for (let k = 0; k < 200; k++) tide.key(REST_MS - 1);
    expect(tide.period).toBeLessThanOrEqual(TIDE_MAX_MS);
  });

  it('starts every page fresh, and a reset starts the run fresh', () => {
    const tide = new Tide();
    tide.key(400);
    tide.key(40);
    const out = tide.endPage(beat());
    expect(out.bursts).toBe(1);
    expect(tide.bursts).toBe(0);
    expect(tide.steadiness).toBe(1);
    tide.key(900);
    tide.reset();
    expect(tide.period).toBe(TIDE_START_MS);
    expect(tide.bursts).toBe(0);
  });

  it('turns drift into steadiness between 0 and 1', () => {
    expect(steadinessOf(0, 0)).toBe(1);
    expect(steadinessOf(0, 5)).toBe(1);
    expect(steadinessOf(DRIFT_LIMIT * 5, 5)).toBe(0);
    expect(steadinessOf(99, 1)).toBe(0);
    expect(steadinessOf((DRIFT_LIMIT / 2) * 4, 4)).toBeCloseTo(0.5);
  });

  it('needs a clean page to open the current', () => {
    expect(pageSteady({ steadiness: 1, bursts: 0 }, false)).toBe(false);
    expect(pageSteady({ steadiness: 1, bursts: 0 }, true)).toBe(true);
    expect(pageSteady({ steadiness: 1, bursts: 1 }, true)).toBe(false);
    expect(pageSteady({ steadiness: STEADY - 0.01, bursts: 0 }, true)).toBe(false);
  });
});

describe('the current and the silt', () => {
  it('opens on steady pages, ebbs on uneven ones, and stays within 0..1', () => {
    let c = 0;
    c = currentAfter(c, true);
    expect(c).toBeCloseTo(CURRENT_UP);
    expect(liftedWhole(c)).toBe(false);
    c = currentAfter(c, true);
    expect(liftedWhole(c)).toBe(true);
    for (let k = 0; k < 10; k++) c = currentAfter(c, true);
    expect(c).toBe(1);
    for (let k = 0; k < 10; k++) c = currentAfter(c, false);
    expect(c).toBe(0);
    expect(liftedWhole(LIFT_CURRENT)).toBe(true);
  });

  it('rises with bursts, settles on steady pages, and stays within 0..1', () => {
    expect(siltAfter(0, 2, false)).toBeCloseTo(2 * SILT_PER_BURST);
    expect(siltAfter(0.5, 0, true)).toBeLessThan(0.5);
    expect(siltAfter(0.1, 0, true)).toBe(0);
    expect(siltAfter(0.9, 40, false)).toBe(1);
    expect(siltAfter(0.4, 0, false)).toBeCloseTo(0.4);
  });

  it('a steady player carries most pages up whole; a rushing one carries none', () => {
    const total = PAGES_PER_LEVEL.standard;
    let steadyWhole = 0;
    let rushWhole = 0;
    let c1 = 0;
    let c2 = 0;
    for (let i = 0; i < total; i++) {
      c1 = currentAfter(c1, true);
      if (liftedWhole(c1)) steadyWhole += 1;
      c2 = currentAfter(c2, false);
      if (liftedWhole(c2)) rushWhole += 1;
    }
    expect(steadyWhole).toBe(total - 1);
    expect(rushWhole).toBe(0);
  });
});

describe('how the archive answers', () => {
  it('opens the shafts quarter by quarter, all of them at the end', () => {
    expect(shaftsOpen(0, 12)).toBe(0);
    expect(shaftsOpen(3, 12)).toBe(1);
    expect(shaftsOpen(11, 12)).toBe(3);
    expect(shaftsOpen(12, 12)).toBe(SECTIONS);
    expect(shaftsOpen(0, 0)).toBe(SECTIONS);
    let last = 0;
    for (let i = 0; i <= 16; i++) {
      const n = shaftsOpen(i, 16);
      expect(n).toBeGreaterThanOrEqual(last);
      last = n;
    }
  });

  it('brings the color back with the pages', () => {
    expect(colorShare(0, 8)).toBe(0);
    expect(colorShare(4, 8)).toBe(0.5);
    expect(colorShare(9, 8)).toBe(1);
    expect(colorShare(0, 0)).toBe(1);
  });

  it('averages steadiness as a whole percent', () => {
    expect(steadyPercent(0, 0)).toBe(100);
    expect(steadyPercent(3, 4)).toBe(75);
    expect(steadyPercent(9, 4)).toBe(100);
  });
});

describe('the Sunken Geniza on the map', () => {
  it('is a region with a screen, a route and a theme of its own', () => {
    expect(REGIONS.find((r) => r.id === 'geniza')?.act).toBe(2);
    expect(SCENE_ROUTES.geniza).toBe('geniza');
    expect(PARENT.geniza).toBe('hub');
    expect(playableRegions()).toContain('geniza');
    expect(THEME_IDS).toContain('geniza');
    expect(THEMES.geniza.id).toBe('geniza');
    expect(THEMES.geniza.form.every((s) => s in THEMES.geniza.sections)).toBe(true);
  });
});

describe('what Reb Ezra and Dyo say', () => {
  it('has Hebrew and English for every moment, and only men or Dyo speak', () => {
    for (const [moment, lines] of Object.entries(GENIZA_LINES)) {
      expect(lines.length, moment).toBeGreaterThan(0);
      for (const l of lines) {
        expect(['ezra', 'dyo']).toContain(l.who);
        expect(l.text.he.length).toBeGreaterThan(5);
        expect(l.text.en.length).toBeGreaterThan(5);
      }
    }
  });

  it('keeps the story clean: nothing about women, nothing suggestive, no holy Names', () => {
    const blocked = /\b(she|her|woman|women|lady|girl|wife|queen|kiss|sexy|love|god|lord)\b/i;
    for (const lines of Object.values(GENIZA_LINES)) {
      for (const l of lines) {
        expect(l.text.en).not.toMatch(blocked);
        expect(l.text.he).not.toMatch(/יהוה|אלוהים|השם/);
      }
    }
  });

  it('picks a line by counter and wraps around', () => {
    expect(genizaLine('whole', 0)).toBe(GENIZA_LINES.whole[0]);
    expect(genizaLine('whole', 1)).toBe(GENIZA_LINES.whole[1]);
    expect(genizaLine('whole', 2)).toBe(GENIZA_LINES.whole[0]);
  });
});
