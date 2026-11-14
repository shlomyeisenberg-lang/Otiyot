import { describe, expect, it } from 'vitest';
import en from '../../locales/en.json';
import he from '../../locales/he.json';
import { ComboRules } from '../../src/game/combo';
import { DIFFICULTIES } from '../../src/game/difficulty';
import {
  ABILITY_IDS,
  ITEMS,
  NO_PERKS,
  RECIPES,
  SECRETS,
  SKILLS,
  SecondWind,
  WARM_COMBO,
  bankLesson,
  bankRun,
  buyItem,
  craft,
  decorShown,
  dressOf,
  dressedLook,
  equipItem,
  itemState,
  learnSkill,
  lessonXp,
  levelOf,
  perksOf,
  recipeState,
  skillPoints,
  skillState,
  toggleDecor,
  toggleSkill,
  xpForLevel,
  xpToNext,
  type BankInput,
} from '../../src/game/progression';
import { rewardsOf, type RunStats } from '../../src/game/results';
import { TypingDriver } from '../../src/game/typing';
import { isAllowedWord } from '../../src/learn/content';
import { CURRENT_VERSION, migrate } from '../../src/save/migrations';
import { createProfile, normalizeSave, type Profile } from '../../src/save';
import { DECOR_SPOTS } from '../../src/scenes/hub/decor';

function player(xp = 0): Profile {
  const p = createProfile('a', 'A', 0);
  p.progress.xp = xp;
  return p;
}

function stats(o: Partial<RunStats> = {}): RunStats {
  return {
    accuracy: 95,
    wpm: 20,
    bestCombo: 30,
    words: 20,
    perfect: 14,
    broken: 20,
    smudges: 0,
    failed: false,
    ...o,
  };
}

function bank(p: Profile, region: string, s: RunStats, extra: Partial<BankInput> = {}) {
  const difficulty = extra.difficulty ?? 'calm';
  const level = extra.level ?? 'easy';
  return bankRun(p, {
    region,
    stats: s,
    rewards: rewardsOf(s, DIFFICULTIES[difficulty], level),
    difficulty,
    level,
    ...extra,
  });
}

describe('XP and levels', () => {
  it('climbs a gentle curve', () => {
    expect(xpToNext(1)).toBe(100);
    expect(xpToNext(2)).toBe(160);
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(100);
    expect(xpForLevel(3)).toBe(260);
    expect(levelOf(0).level).toBe(1);
    expect(levelOf(99).level).toBe(1);
    expect(levelOf(100).level).toBe(2);
    expect(levelOf(259)).toMatchObject({ level: 2, into: 159, need: 160 });
    expect(levelOf(1e9)).toMatchObject({ level: 40, share: 1 });
  });

  it('banks a run into the wallet and XP, with levels and gifts', () => {
    const p = player(xpForLevel(2) - 10);
    const g = bank(p, 'meadow', stats());
    expect(g.xp).toBeGreaterThan(10);
    expect(p.wallet.glyphs).toBe(g.glyphs);
    expect(p.wallet.ink).toBe(g.ink);
    expect(g.levelBefore).toBe(1);
    expect(g.level).toBeGreaterThanOrEqual(2);
    expect(g.points).toBe(g.level - 1);
    // Level 2 gives the hawk quill and puts it on.
    expect(g.gifts).toContain('quill:hawk');
    expect(p.cosmetics.equipped.quill).toBe('quill:hawk');
    expect(g.shelf.length).toBeGreaterThan(0);
  });

  it('banks a lesson: XP and a few glyphs, more when passed', () => {
    expect(lessonXp(200, 100, true)).toBeGreaterThan(lessonXp(200, 100, false));
    expect(lessonXp(200, 80, true)).toBeLessThan(lessonXp(200, 100, true));
    const p = player();
    const g = bankLesson(p, 200, 96, true);
    expect(p.progress.xp).toBe(g.xp);
    expect(p.wallet.glyphs).toBe(g.glyphs);
    expect(g.ink).toBe(0);
  });
});

describe('Skill tree and abilities', () => {
  it('one point per level, steps in order, level gates', () => {
    const p = player(xpForLevel(3));
    expect(skillPoints(p)).toEqual({ total: 2, spent: 0, free: 2 });
    expect(skillState(p, 'gilded')).toBe('needsPrev');
    expect(skillState(p, 'echo')).toBe('ready');
    expect(learnSkill(p, 'echo')).toBe(true);
    expect(learnSkill(p, 'echo')).toBe(false);
    expect(skillState(p, 'gilded')).toBe('needsLevel');
    expect(learnSkill(p, 'soft')).toBe(true);
    expect(skillState(p, 'steady')).toBe('needsPoint');
    expect(skillPoints(p).free).toBe(0);
  });

  it('every node has words in both languages, and the tree is three by three', () => {
    expect(SKILLS).toHaveLength(9);
    for (const id of ABILITY_IDS) {
      for (const k of [`ability.${id}.name`, `ability.${id}.desc`]) {
        expect((en as Record<string, string>)[k], k).toBeTruthy();
        expect((he as Record<string, string>)[k], k).toBeTruthy();
      }
    }
  });

  it('perks follow learned skills, and can be switched off', () => {
    const p = player(xpForLevel(10));
    expect(perksOf(p)).toEqual(NO_PERKS);
    for (const id of [
      'echo',
      'steady',
      'warm',
      'steady2',
      'soft',
      'second',
      'gilded',
      'scholar',
      'deepwell',
    ] as const) {
      expect(learnSkill(p, id), id).toBe(true);
    }
    const all = perksOf(p);
    expect(all).toMatchObject({
      ahead: 2,
      steadyHand: 2,
      startCombo: WARM_COMBO,
      softer: 1,
      secondWind: true,
      glyphsPerPerfect: 1,
    });
    expect(all.xpBoost).toBeGreaterThan(1);
    expect(all.inkBoost).toBeGreaterThan(1);
    expect(toggleSkill(p, 'echo')).toBe(true);
    expect(perksOf(p).ahead).toBe(1);
    // Economy skills are always on.
    expect(toggleSkill(p, 'scholar')).toBe(false);
  });

  it('Steady Hand and Soft Fall change the combo rules', () => {
    const r = new ComboRules({ errorTiers: 2 });
    r.grant(1, 1);
    expect(r.errorTiers).toBe(1);
    r.onHit(30);
    expect(r.onMiss(30)).toBe(30); // absorbed
    expect(r.onMiss(30)).toBe(10); // one tier down, not two
  });

  it('Second Wind gives a broken streak back once, on a perfect word', () => {
    const inner = new ComboRules({ errorTiers: 5 });
    const w = new SecondWind(inner);
    expect(w.onMiss(40)).toBe(0);
    expect(w.onWord(false, 2)).toBeNull();
    expect(w.onWord(true, 5)).toBe(40);
    expect(w.onMiss(30)).toBe(0);
    expect(w.onWord(true, 3)).toBeNull();
  });

  it('Echo keeps two words ready in an endless run', () => {
    let n = 0;
    const words = ['aa', 'bb', 'cc', 'dd', 'ee', 'ff'];
    const d = new TypingDriver(
      { next: () => words[n++ % words.length] as string },
      { layout: 'en', mode: 'endless', ahead: 2 },
    );
    expect(d.word).toBe('aa');
    expect(d.lookahead).toBe('bb');
    expect(d.peek(1)).toBe('cc');
  });

  it('gilded quill, scholar and deep well raise what a run pays', () => {
    const plain = player(xpForLevel(10));
    const rich = player(xpForLevel(10));
    for (const id of ['echo', 'gilded', 'scholar', 'soft', 'second', 'deepwell'] as const) {
      learnSkill(rich, id);
    }
    const a = bank(plain, '', stats());
    const b = bank(rich, '', stats());
    expect(b.xp).toBeGreaterThan(a.xp);
    expect(b.glyphs).toBe(a.glyphs + 14);
    expect(b.ink).toBeGreaterThanOrEqual(a.ink);
    expect(b.bonus.glyphs).toBe(14);
  });
});

describe('Shop, crafting and dress', () => {
  it('buys, wears, takes off; locked and poor items wait', () => {
    const p = player(xpForLevel(3));
    p.wallet = { glyphs: 100, ink: 0 };
    const linen = ITEMS.find((i) => i.id === 'robe:linen');
    const night = ITEMS.find((i) => i.id === 'robe:night');
    if (!linen || !night) throw new Error('catalogue');
    expect(itemState(p, night)).toBe('locked');
    expect(buyItem(p, 'robe:night')).toBe(false);
    expect(itemState(p, linen)).toBe('buy');
    expect(buyItem(p, 'robe:linen')).toBe(true);
    expect(p.wallet.glyphs).toBe(40);
    expect(itemState(p, linen)).toBe('equipped');
    expect(dressOf(p).robe).toEqual(linen.colors);
    expect(dressedLook(p).robe).toBe(linen.colors[0]);
    expect(buyItem(p, 'robe:cedar')).toBe(false); // 90 glyphs, only 40 left
    expect(equipItem(p, null, 'robe')).toBe(true);
    expect(dressOf(p).robe).toBeNull();
    expect(itemState(p, linen)).toBe('owned');
    expect(equipItem(p, 'robe:cedar', 'robe')).toBe(false);
  });

  it('crafts from an owned piece, found letters and ink', () => {
    const p = player(xpForLevel(5));
    const r = RECIPES.find((x) => x.makes === 'quill:gold');
    if (!r) throw new Error('recipe');
    expect(recipeState(p, r)).toBe('needsPiece');
    p.cosmetics.owned.push('quill:hawk');
    expect(recipeState(p, r)).toBe('needsLetters');
    p.progress.secrets.push('meadow', 'cliffs');
    expect(recipeState(p, r)).toBe('needsInk');
    p.wallet.ink = 45;
    expect(recipeState(p, r)).toBe('ready');
    expect(craft(p, 'quill:gold')).toBe(true);
    expect(p.wallet.ink).toBe(5);
    expect(p.cosmetics.equipped.quill).toBe('quill:gold');
    expect(recipeState(p, r)).toBe('made');
    expect(buyItem(p, 'quill:gold')).toBe(false);
  });

  it('decorations show in the house and can be put away', () => {
    const p = player();
    p.cosmetics.owned.push('decor:lamp');
    expect(decorShown(p)).toEqual(['decor:lamp']);
    expect(toggleDecor(p, 'decor:lamp')).toBe(true);
    expect(decorShown(p)).toEqual([]);
    expect(toggleDecor(p, 'decor:lamp')).toBe(true);
    expect(decorShown(p)).toEqual(['decor:lamp']);
  });

  it('every item has a name, a description and a place', () => {
    const ids = new Set<string>();
    for (const i of ITEMS) {
      expect(ids.has(i.id), i.id).toBe(false);
      ids.add(i.id);
      const k = i.id.replace(':', '.');
      for (const key of [`shop.item.${k}`, `shop.desc.${k}`]) {
        expect((en as Record<string, string>)[key], key).toBeTruthy();
        expect((he as Record<string, string>)[key], key).toBeTruthy();
      }
      if (i.slot === 'decor') expect(DECOR_SPOTS[i.id], i.id).toBeDefined();
      expect(i.colors.length).toBeGreaterThan(0);
    }
    for (const r of RECIPES) {
      expect(ids.has(r.from)).toBe(true);
      expect(ITEMS.find((i) => i.id === r.makes)?.crafted).toBe(true);
    }
  });

  it('the shop texts follow the content rules', () => {
    const words = Object.entries(en)
      .filter(([k]) => /^(shop|ability|secret|earned)\./.test(k))
      .flatMap(([, v]) => v.toLowerCase().match(/[a-z]+/g) ?? []);
    for (const w of words) expect(isAllowedWord(w, 'en'), w).toBe(true);
  });
});

describe('Hidden letters', () => {
  it('one different letter per scene, each with a riddle in both languages', () => {
    const letters = new Set(SECRETS.map((s) => s.letter));
    expect(letters.size).toBe(SECRETS.length);
    for (const s of SECRETS) {
      expect((en as Record<string, string>)[`secret.${s.region}`]).toBeTruthy();
      expect((he as Record<string, string>)[`secret.${s.region}`]).toBeTruthy();
    }
  });

  it('is found by playing the scene the right way, once, never on a failed run', () => {
    const p = player();
    expect(bank(p, 'meadow', stats({ accuracy: 99 })).letter).toBeNull();
    expect(bank(p, 'meadow', stats({ accuracy: 100, failed: true })).letter).toBeNull();
    expect(bank(p, 'meadow', stats({ accuracy: 100 })).letter).toBe('פ');
    expect(bank(p, 'meadow', stats({ accuracy: 100 })).letter).toBeNull();
    expect(p.progress.secrets).toEqual(['meadow']);
    expect(bank(p, 'forge', stats(), { level: 'hard' }).letter).toBe('ב');
    expect(bank(p, 'station', stats(), { difficulty: 'swift' }).letter).toBeNull();
    expect(bank(p, 'station', stats(), { difficulty: 'fierce' }).letter).toBe('כ');
    expect(bank(p, 'cliffs', stats({ bestCombo: 50 })).letter).toBe('ע');
  });
});

describe('Balance: the first two hours', () => {
  it('a new player gets something new every few runs', () => {
    // A plain new player: lessons and calm runs at 85-95%, about two to three minutes each.
    const p = player();
    let minutes = 0;
    const unlockAt: number[] = [];
    let lastLevel = 1;
    for (let i = 0; minutes < 120; i++) {
      if (i % 2 === 0) {
        bankLesson(p, 180, 92, true);
        minutes += 2;
      } else {
        bank(
          p,
          'meadow',
          stats({ accuracy: 92, words: 20, perfect: 12, broken: 20, bestCombo: 25 }),
        );
        minutes += 3;
      }
      const lvl = levelOf(p.progress.xp).level;
      if (lvl > lastLevel) {
        unlockAt.push(minutes);
        lastLevel = lvl;
      }
    }
    const level = levelOf(p.progress.xp).level;
    expect(level).toBeGreaterThanOrEqual(8);
    expect(level).toBeLessThanOrEqual(16);
    // The first level comes within ten minutes, and no gap is longer than 20 minutes.
    expect(unlockAt[0]).toBeLessThanOrEqual(10);
    for (let i = 1; i < unlockAt.length; i++) {
      expect((unlockAt[i] as number) - (unlockAt[i - 1] as number)).toBeLessThanOrEqual(20);
    }
    // Enough glyphs for several things on the shelf.
    const spendable = ITEMS.filter((i) => !i.crafted && !i.gift && i.level <= level);
    const cheapest = spendable.map((i) => i.cost.glyphs).sort((a, b) => a - b);
    const affordable = cheapest.reduce(
      (acc, c) => (acc.sum + c <= p.wallet.glyphs ? { n: acc.n + 1, sum: acc.sum + c } : acc),
      { n: 0, sum: 0 },
    );
    expect(affordable.n).toBeGreaterThanOrEqual(4);
  });
});

describe('Save v9', () => {
  it('v8 -> v9 adds progress and counts earlier play', () => {
    const v8 = {
      version: 8,
      profiles: [
        {
          id: 'a',
          name: 'A',
          history: [{ chars: 600 }, { chars: 400 }],
          wallet: { glyphs: 3, ink: 1 },
        },
        { id: 'b', name: 'B', progress: { xp: 5, skills: ['echo'], off: [], secrets: [] } },
      ],
      activeProfileId: 'a',
      meta: { legacyChecked: true, autoQuality: null },
    };
    const m = migrate(v8);
    expect(m.version).toBe(CURRENT_VERSION);
    const save = normalizeSave(m, CURRENT_VERSION, () => 'x', 0);
    expect(save?.profiles[0]?.progress).toEqual({ xp: 100, skills: [], off: [], secrets: [] });
    expect(save?.profiles[0]?.wallet).toEqual({ glyphs: 28, ink: 1 });
    expect(save?.profiles[1]?.progress.skills).toEqual(['echo']);
    const bad = normalizeSave(
      { version: 9, profiles: [{ id: 'c', progress: { xp: -4, skills: 'no' } }] },
      CURRENT_VERSION,
      () => 'y',
      0,
    );
    expect(bad?.profiles[0]?.progress).toEqual({ xp: 0, skills: [], off: [], secrets: [] });
  });
});
