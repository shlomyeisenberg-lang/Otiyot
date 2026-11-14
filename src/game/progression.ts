// Progression (T33): XP and levels, the skill tree and its abilities, the shop's catalogue and
// crafting, and the hidden letter of every scene. Pure logic over the saved profile; the screens
// call `bankRun` once per run and read everything else from here. Light on purpose: a level
// every few runs, one skill point per level, and a shelf that fills as the player climbs.

import type { Profile } from '../save';
import { apprenticeLook, type ApprenticeLook } from '../story/cast';
import type { ComboPolicy } from './combo';
import type { DifficultyId } from './difficulty';
import type { LevelId } from './levels';
import type { RunRewards, RunStats } from './results';

// ---------------------------------------------------------------------------------------------
// XP and levels

/** The highest level. Past it XP still counts, the bar just stays full. */
export const MAX_LEVEL = 40;
/** XP from level L to L+1: 100, 160, 220, ... (a level every few runs at first). */
export const XP_BASE = 100;
export const XP_STEP = 60;

export function xpToNext(level: number): number {
  return XP_BASE + XP_STEP * Math.max(0, Math.floor(level) - 1);
}

/** Total XP needed to reach `level` from level 1. */
export function xpForLevel(level: number): number {
  const l = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  const n = l - 1;
  return XP_BASE * n + (XP_STEP * n * (n - 1)) / 2;
}

export interface LevelInfo {
  level: number;
  /** XP into the current level, and what the next level needs. */
  into: number;
  need: number;
  /** 0..1 along the bar. */
  share: number;
}

export function levelOf(xp: number): LevelInfo {
  const x = Math.max(0, Math.floor(xp));
  let level = 1;
  while (level < MAX_LEVEL && x >= xpForLevel(level + 1)) level++;
  if (level >= MAX_LEVEL) return { level, into: 0, need: 0, share: 1 };
  const into = x - xpForLevel(level);
  const need = xpToNext(level);
  return { level, into, need, share: into / need };
}

// ---------------------------------------------------------------------------------------------
// The skill tree: three short branches. Every level after the first gives one point.

export const ABILITY_IDS = [
  'echo',
  'gilded',
  'scholar',
  'steady',
  'warm',
  'steady2',
  'soft',
  'second',
  'deepwell',
] as const;
export type AbilityId = (typeof ABILITY_IDS)[number];
export type Branch = 'eye' | 'hand' | 'heart';

export interface SkillNode {
  id: AbilityId;
  branch: Branch;
  /** 1..3 down the branch; a node needs the one above it. */
  step: 1 | 2 | 3;
  /** The player level the node waits for. */
  level: number;
  /** Changes how a run plays (true) or only what it pays (false). */
  inRun: boolean;
}

export const SKILLS: readonly SkillNode[] = [
  { id: 'echo', branch: 'eye', step: 1, level: 2, inRun: true },
  { id: 'gilded', branch: 'eye', step: 2, level: 4, inRun: false },
  { id: 'scholar', branch: 'eye', step: 3, level: 8, inRun: false },
  { id: 'steady', branch: 'hand', step: 1, level: 2, inRun: true },
  { id: 'warm', branch: 'hand', step: 2, level: 4, inRun: true },
  { id: 'steady2', branch: 'hand', step: 3, level: 8, inRun: true },
  { id: 'soft', branch: 'heart', step: 1, level: 3, inRun: true },
  { id: 'second', branch: 'heart', step: 2, level: 5, inRun: true },
  { id: 'deepwell', branch: 'heart', step: 3, level: 9, inRun: false },
];

export const BRANCHES: readonly Branch[] = ['eye', 'hand', 'heart'];

export function skillNode(id: string): SkillNode | undefined {
  return SKILLS.find((s) => s.id === id);
}

export function skillPoints(profile: Profile): { total: number; spent: number; free: number } {
  const total = levelOf(profile.progress.xp).level - 1;
  const spent = profile.progress.skills.filter((s) => skillNode(s)).length;
  return { total, spent, free: Math.max(0, total - spent) };
}

export type SkillState = 'learned' | 'ready' | 'needsLevel' | 'needsPrev' | 'needsPoint';

export function skillState(profile: Profile, id: AbilityId): SkillState {
  const node = skillNode(id);
  if (!node) return 'needsPrev';
  if (profile.progress.skills.includes(id)) return 'learned';
  const prev = SKILLS.find((s) => s.branch === node.branch && s.step === node.step - 1);
  if (prev && !profile.progress.skills.includes(prev.id)) return 'needsPrev';
  if (levelOf(profile.progress.xp).level < node.level) return 'needsLevel';
  if (skillPoints(profile).free <= 0) return 'needsPoint';
  return 'ready';
}

/** Spends a point on a skill. Returns false when it cannot be learned yet. */
export function learnSkill(profile: Profile, id: AbilityId): boolean {
  if (skillState(profile, id) !== 'ready') return false;
  profile.progress.skills.push(id);
  return true;
}

/** Turns a learned in-run ability off for a while (or back on). */
export function toggleSkill(profile: Profile, id: AbilityId): boolean {
  if (!profile.progress.skills.includes(id) || !skillNode(id)?.inRun) return false;
  const off = profile.progress.off;
  const i = off.indexOf(id);
  if (i >= 0) off.splice(i, 1);
  else off.push(id);
  return true;
}

/** What the learned abilities do in a run (PlayController and bankRun read this). */
export interface Perks {
  /** Words shown ahead of the current one (1 normally, 2 with Echo). */
  ahead: number;
  /** Errors Steady Hand absorbs per combo tier. */
  steadyHand: number;
  /** The streak a run starts at (Warm Hands: the second tier). */
  startCombo: number;
  /** Tiers an error costs fewer (Soft Fall). */
  softer: number;
  /** Once a run, a broken streak comes back with the next perfect word. */
  secondWind: boolean;
  /** Extra glyphs per perfect word. */
  glyphsPerPerfect: number;
  /** Multipliers on XP and ink. */
  xpBoost: number;
  inkBoost: number;
}

export const NO_PERKS: Perks = {
  ahead: 1,
  steadyHand: 0,
  startCombo: 0,
  softer: 0,
  secondWind: false,
  glyphsPerPerfect: 0,
  xpBoost: 1,
  inkBoost: 1,
};

/** Warm Hands starts the streak here: the floor of the second tier (COMBO_TIERS). */
export const WARM_COMBO = 10;

export function perksOf(profile: Profile): Perks {
  const has = (id: AbilityId): boolean =>
    profile.progress.skills.includes(id) && !profile.progress.off.includes(id);
  return {
    ahead: has('echo') ? 2 : 1,
    steadyHand: has('steady') ? (has('steady2') ? 2 : 1) : 0,
    startCombo: has('warm') ? WARM_COMBO : 0,
    softer: has('soft') ? 1 : 0,
    secondWind: has('second'),
    glyphsPerPerfect: has('gilded') ? 1 : 0,
    xpBoost: has('scholar') ? 1.15 : 1,
    inkBoost: has('deepwell') ? 1.25 : 1,
  };
}

/** Abilities the player has on in runs (for the little row on the HUD and the results). */
export function activeAbilities(profile: Profile): AbilityId[] {
  return ABILITY_IDS.filter(
    (id) => profile.progress.skills.includes(id) && !profile.progress.off.includes(id),
  );
}

// ---------------------------------------------------------------------------------------------
// Second Wind: a combo policy wrapper. Pure; the play controller feeds it words.

export class SecondWind implements ComboPolicy {
  /** The streak that was lost and can still come back (0 = none). */
  lost = 0;
  used = false;

  constructor(private readonly inner: ComboPolicy) {}

  onHit(combo: number): void {
    this.inner.onHit(combo);
  }

  onMiss(combo: number): number {
    const kept = this.inner.onMiss(combo);
    if (!this.used && kept < combo && combo >= WARM_COMBO && combo > this.lost) this.lost = combo;
    return kept;
  }

  /**
   * A word was finished. A perfect one brings a lost streak back (once a run): returns the
   * streak to set, or null.
   */
  onWord(perfect: boolean, combo: number): number | null {
    if (this.used || this.lost <= 0 || !perfect) return null;
    this.used = true;
    const back = Math.max(combo, this.lost);
    this.lost = 0;
    return back;
  }
}

// ---------------------------------------------------------------------------------------------
// The shop: cosmetics (robes, quills, inks) and decorations for the house.

export type ItemSlot = 'robe' | 'quill' | 'ink' | 'decor';
export const SLOTS: readonly ItemSlot[] = ['robe', 'quill', 'ink', 'decor'];

export interface ItemCost {
  glyphs: number;
  ink: number;
}

export interface ShopItem {
  id: string;
  slot: ItemSlot;
  /** Player level the item comes onto the shelf at. */
  level: number;
  cost: ItemCost;
  /** Free gift at this level (Reb Ezra or Dyo leaves it), instead of a price. */
  gift?: boolean;
  /** Made at the crafting table, never sold. */
  crafted?: boolean;
  /** Colors for the 3D apprentice, the house and the shop's little figure. */
  colors: readonly number[];
}

/**
 * The catalogue. Robe colors are [robe, hem, trim]; quills [feather, shaft]; inks [nib and Dyo,
 * Dyo's shine]. Decorations carry the colors they are built with. Every figure is the male
 * apprentice (ARCHITECTURE section 8); nothing here is sacred.
 */
export const ITEMS: readonly ShopItem[] = [
  // Robes.
  {
    id: 'robe:linen',
    slot: 'robe',
    level: 2,
    cost: { glyphs: 60, ink: 0 },
    colors: [0xd8c7a0, 0x9e8a62, 0x6e5a3a],
  },
  {
    id: 'robe:cedar',
    slot: 'robe',
    level: 3,
    cost: { glyphs: 90, ink: 0 },
    colors: [0x7a5a3a, 0x3e2c1c, 0xe6c36a],
  },
  {
    id: 'robe:sea',
    slot: 'robe',
    level: 5,
    cost: { glyphs: 140, ink: 10 },
    colors: [0x2e8a8a, 0x15484a, 0xf0e2c0],
  },
  {
    id: 'robe:pomegranate',
    slot: 'robe',
    level: 7,
    cost: { glyphs: 200, ink: 20 },
    colors: [0x9a2a3a, 0x4e1420, 0xe0b354],
  },
  {
    id: 'robe:night',
    slot: 'robe',
    level: 10,
    cost: { glyphs: 280, ink: 30 },
    colors: [0x23284a, 0x0f1226, 0xe0b354],
  },
  {
    id: 'robe:royal',
    slot: 'robe',
    level: 6,
    crafted: true,
    cost: { glyphs: 0, ink: 80 },
    colors: [0x1f5fa8, 0x0f2f5a, 0xf4d27a],
  },
  // Quills.
  {
    id: 'quill:hawk',
    slot: 'quill',
    level: 2,
    gift: true,
    cost: { glyphs: 0, ink: 0 },
    colors: [0x8a5a32, 0x2a1a10],
  },
  {
    id: 'quill:dove',
    slot: 'quill',
    level: 3,
    cost: { glyphs: 50, ink: 0 },
    colors: [0xb9bcc4, 0x3a3a44],
  },
  {
    id: 'quill:peacock',
    slot: 'quill',
    level: 6,
    cost: { glyphs: 160, ink: 15 },
    colors: [0x1f8a72, 0x15306a],
  },
  {
    id: 'quill:raven',
    slot: 'quill',
    level: 9,
    cost: { glyphs: 220, ink: 25 },
    colors: [0x1c1c26, 0x5a4f86],
  },
  {
    id: 'quill:gold',
    slot: 'quill',
    level: 4,
    crafted: true,
    cost: { glyphs: 0, ink: 40 },
    colors: [0xf0c050, 0x8a5a12],
  },
  // Inks (the nib, and Dyo, who lives in the inkwell, takes the color).
  {
    id: 'ink:sepia',
    slot: 'ink',
    level: 3,
    gift: true,
    cost: { glyphs: 0, ink: 0 },
    colors: [0x5a3418, 0x9a6a3a],
  },
  {
    id: 'ink:techelet',
    slot: 'ink',
    level: 4,
    cost: { glyphs: 40, ink: 15 },
    colors: [0x1f5fa8, 0x7ab4f0],
  },
  {
    id: 'ink:crimson',
    slot: 'ink',
    level: 6,
    cost: { glyphs: 60, ink: 25 },
    colors: [0x8a1f2a, 0xe0707a],
  },
  {
    id: 'ink:emerald',
    slot: 'ink',
    level: 8,
    cost: { glyphs: 80, ink: 35 },
    colors: [0x1f6a3a, 0x7ad09a],
  },
  {
    id: 'ink:gold',
    slot: 'ink',
    level: 8,
    crafted: true,
    cost: { glyphs: 0, ink: 120 },
    colors: [0xb8862b, 0xffe08a],
  },
  // Decorations for the House of the Scribe.
  {
    id: 'decor:lamp',
    slot: 'decor',
    level: 2,
    cost: { glyphs: 70, ink: 0 },
    colors: [0xb8862b, 0xffd27a],
  },
  {
    id: 'decor:pomegranate',
    slot: 'decor',
    level: 4,
    cost: { glyphs: 120, ink: 5 },
    colors: [0x3e6a2a, 0xb02a2a],
  },
  {
    id: 'decor:banners',
    slot: 'decor',
    level: 5,
    gift: true,
    cost: { glyphs: 0, ink: 0 },
    colors: [0x1f5fa8, 0xb8862b, 0x9a2a3a, 0x2f6b3a],
  },
  {
    id: 'decor:map',
    slot: 'decor',
    level: 7,
    cost: { glyphs: 180, ink: 10 },
    colors: [0xe8d8b0, 0x8a5a32],
  },
  {
    id: 'decor:chimes',
    slot: 'decor',
    level: 9,
    cost: { glyphs: 150, ink: 20 },
    colors: [0xc8a050, 0x8a6a2a],
  },
  {
    id: 'decor:dovecote',
    slot: 'decor',
    level: 11,
    cost: { glyphs: 260, ink: 30 },
    colors: [0xe8e0d0, 0x8a7a6a],
  },
  {
    id: 'decor:fountain',
    slot: 'decor',
    level: 10,
    crafted: true,
    cost: { glyphs: 0, ink: 150 },
    colors: [0xd8cdb4, 0x5fa4e8],
  },
];

export function shopItem(id: string): ShopItem | undefined {
  return ITEMS.find((i) => i.id === id);
}

/** What the apprentice wears when nothing is equipped in a slot. */
export const DEFAULT_QUILL: readonly number[] = [0xf4ecd8, 0x14100c];
export const DEFAULT_INK: readonly number[] = [0x18204a, 0x5fa4e8];

export type ItemState = 'owned' | 'equipped' | 'buy' | 'poor' | 'locked' | 'craft';

export function owns(profile: Profile, id: string): boolean {
  return profile.cosmetics.owned.includes(id);
}

export function canAfford(profile: Profile, cost: ItemCost): boolean {
  return profile.wallet.glyphs >= cost.glyphs && profile.wallet.ink >= cost.ink;
}

export function itemState(profile: Profile, item: ShopItem): ItemState {
  if (owns(profile, item.id)) {
    if (item.slot === 'decor') return 'owned';
    return profile.cosmetics.equipped[item.slot] === item.id ? 'equipped' : 'owned';
  }
  if (item.crafted) return 'craft';
  if (levelOf(profile.progress.xp).level < item.level) return 'locked';
  return canAfford(profile, item.cost) ? 'buy' : 'poor';
}

/** Buys an item from the shelf (and puts it on). False when it cannot be bought. */
export function buyItem(profile: Profile, id: string): boolean {
  const item = shopItem(id);
  if (!item || item.crafted || item.gift || itemState(profile, item) !== 'buy') return false;
  profile.wallet.glyphs -= item.cost.glyphs;
  profile.wallet.ink -= item.cost.ink;
  profile.cosmetics.owned.push(id);
  if (item.slot !== 'decor') profile.cosmetics.equipped[item.slot] = id;
  return true;
}

/** Wears an owned item, or takes it off (back to the apprentice's own look). */
export function equipItem(profile: Profile, id: string | null, slot: ItemSlot): boolean {
  if (slot === 'decor') return false;
  if (id === null) {
    delete profile.cosmetics.equipped[slot];
    return true;
  }
  const item = shopItem(id);
  if (!item || item.slot !== slot || !owns(profile, id)) return false;
  profile.cosmetics.equipped[slot] = id;
  return true;
}

/** Decorations shown in the house (all owned ones, unless the player put one away). */
export function decorShown(profile: Profile): string[] {
  return ITEMS.filter(
    (i) =>
      i.slot === 'decor' &&
      owns(profile, i.id) &&
      profile.cosmetics.equipped[`hide:${i.id}`] !== 'yes',
  ).map((i) => i.id);
}

export function toggleDecor(profile: Profile, id: string): boolean {
  const item = shopItem(id);
  if (!item || item.slot !== 'decor' || !owns(profile, id)) return false;
  const key = `hide:${id}`;
  if (profile.cosmetics.equipped[key] === 'yes') delete profile.cosmetics.equipped[key];
  else profile.cosmetics.equipped[key] = 'yes';
  return true;
}

export interface Dress {
  robe: readonly number[] | null;
  /** [feather, shaft] */
  quill: readonly number[];
  /** [nib and Dyo, Dyo's shine] */
  ink: readonly number[];
}

/** The colors the apprentice and Dyo wear, from what is equipped. */
export function dressOf(profile: Profile): Dress {
  const eq = (slot: ItemSlot): ShopItem | undefined => {
    const id = profile.cosmetics.equipped[slot];
    const item = id ? shopItem(id) : undefined;
    return item && item.slot === slot && owns(profile, item.id) ? item : undefined;
  };
  return {
    robe: eq('robe')?.colors ?? null,
    quill: eq('quill')?.colors ?? DEFAULT_QUILL,
    ink: eq('ink')?.colors ?? DEFAULT_INK,
  };
}

// ---------------------------------------------------------------------------------------------
// Crafting: an owned piece, hidden letters found, and ink make something finer.

export interface Recipe {
  makes: string;
  /** The owned piece it starts from (it is kept). */
  from: string;
  letters: number;
}

export const RECIPES: readonly Recipe[] = [
  { makes: 'quill:gold', from: 'quill:hawk', letters: 2 },
  { makes: 'robe:royal', from: 'robe:sea', letters: 4 },
  { makes: 'ink:gold', from: 'ink:sepia', letters: 7 },
  { makes: 'decor:fountain', from: 'decor:pomegranate', letters: 10 },
];

export type RecipeState =
  'made' | 'ready' | 'needsPiece' | 'needsLetters' | 'needsInk' | 'needsLevel';

export function recipeState(profile: Profile, r: Recipe): RecipeState {
  const item = shopItem(r.makes);
  if (!item) return 'needsPiece';
  if (owns(profile, r.makes)) return 'made';
  if (levelOf(profile.progress.xp).level < item.level) return 'needsLevel';
  if (!owns(profile, r.from)) return 'needsPiece';
  if (profile.progress.secrets.length < r.letters) return 'needsLetters';
  if (!canAfford(profile, item.cost)) return 'needsInk';
  return 'ready';
}

export function craft(profile: Profile, makes: string): boolean {
  const r = RECIPES.find((x) => x.makes === makes);
  const item = shopItem(makes);
  if (!r || !item || recipeState(profile, r) !== 'ready') return false;
  profile.wallet.glyphs -= item.cost.glyphs;
  profile.wallet.ink -= item.cost.ink;
  profile.cosmetics.owned.push(makes);
  if (item.slot !== 'decor') profile.cosmetics.equipped[item.slot] = makes;
  return true;
}

// ---------------------------------------------------------------------------------------------
// Hidden letters: one per scene, found by playing it a particular way. The riddles (in the
// locales) hint at the way; the letter appears on the results card when it is found.

export interface RunFacts extends RunStats {
  difficulty: DifficultyId;
  level: LevelId;
  rank: RunRewards['rank'];
}

export interface Secret {
  region: string;
  letter: string;
  test: (f: RunFacts) => boolean;
}

const HARDER: ReadonlySet<DifficultyId> = new Set(['swift', 'fierce', 'trial']);
const HARDEST: ReadonlySet<DifficultyId> = new Set(['fierce', 'trial']);

/** One letter per scene, all different. A failed run never finds one. */
export const SECRETS: readonly Secret[] = [
  // A garden nobody trampled: not a single slip.
  { region: 'meadow', letter: 'פ', test: (f) => f.accuracy >= 100 && f.words >= 10 },
  // The spring: a long unbroken streak (silver).
  { region: 'cliffs', letter: 'ע', test: (f) => f.bestCombo >= 50 },
  // The Great Blot fought quickly: Swift or harder.
  { region: 'blot', letter: 'ד', test: (f) => HARDER.has(f.difficulty) },
  // The anvil rings for the hard metal: the Hard level.
  { region: 'forge', letter: 'ב', test: (f) => f.level === 'hard' },
  // The market rewards quick hands: 30 words a minute.
  { region: 'shuk', letter: 'ש', test: (f) => f.wpm >= 30 },
  // The train is never late: no Blot reaches the scribe, 15 words or more.
  { region: 'rail', letter: 'ר', test: (f) => f.smudges === 0 && f.words >= 15 },
  // The old pages answer the best hand: rank S.
  { region: 'geniza', letter: 'ג', test: (f) => f.rank === 'S' },
  // The summit wind: a streak of the light tier (100).
  { region: 'hermon', letter: 'ח', test: (f) => f.bestCombo >= 100 },
  // Out among the stars: Fierce or the Sofer's Trial.
  { region: 'station', letter: 'כ', test: (f) => HARDEST.has(f.difficulty) },
  // The mirror city: 97% or better, above Easy.
  { region: 'atbash', letter: 'ת', test: (f) => f.accuracy >= 97 && f.level !== 'easy' },
  // The long road: 40 words in one crossing.
  { region: 'midbar', letter: 'מ', test: (f) => f.words >= 40 },
  // The lantern keeps burning: 25 perfect words.
  { region: 'caves', letter: 'נ', test: (f) => f.perfect >= 25 },
  // The arena's crowd: rank S on Swift or harder.
  { region: 'arena', letter: 'ז', test: (f) => f.rank === 'S' && HARDER.has(f.difficulty) },
  // The last page: written back without a failed trial, rank A or better.
  { region: 'scroll', letter: 'ק', test: (f) => f.rank === 'S' || f.rank === 'A' },
  // The top of the tower: 60 words in one climb.
  { region: 'ladder', letter: 'ס', test: (f) => f.words >= 60 },
];

export function secretOf(region: string): Secret | undefined {
  return SECRETS.find((s) => s.region === region);
}

// ---------------------------------------------------------------------------------------------
// Banking a run.

/** Free gifts for reaching a level (items with `gift`). */
export function giftsAt(level: number): ShopItem[] {
  return ITEMS.filter((i) => i.gift && i.level === level);
}

export interface RunGain {
  xp: number;
  glyphs: number;
  ink: number;
  /** Extra from abilities (already inside the totals above). */
  bonus: { xp: number; glyphs: number; ink: number };
  levelBefore: number;
  level: number;
  /** Skill points that came with the new levels. */
  points: number;
  /** Items given for the new levels, and items that came onto the shelf. */
  gifts: string[];
  shelf: string[];
  /** The hidden letter found this run, if any (first time only). */
  letter: string | null;
}

export interface BankInput {
  /** Region id ('' for runs that are not a scene, like the range or a mode). */
  region: string;
  stats: RunStats;
  rewards: RunRewards;
  difficulty: DifficultyId;
  level: LevelId;
}

/** Adds XP and levels, gifts and newly shelved items, without touching the wallet. */
function addXp(profile: Profile, xp: number, gain: RunGain): void {
  const before = levelOf(profile.progress.xp).level;
  profile.progress.xp += xp;
  const after = levelOf(profile.progress.xp).level;
  gain.levelBefore = before;
  gain.level = after;
  gain.points = after - before;
  for (let l = before + 1; l <= after; l++) {
    for (const g of giftsAt(l)) {
      if (!owns(profile, g.id)) {
        profile.cosmetics.owned.push(g.id);
        if (g.slot !== 'decor' && !profile.cosmetics.equipped[g.slot]) {
          profile.cosmetics.equipped[g.slot] = g.id;
        }
        gain.gifts.push(g.id);
      }
    }
    for (const i of ITEMS) if (!i.gift && !i.crafted && i.level === l) gain.shelf.push(i.id);
  }
}

function emptyGain(level: number): RunGain {
  return {
    xp: 0,
    glyphs: 0,
    ink: 0,
    bonus: { xp: 0, glyphs: 0, ink: 0 },
    levelBefore: level,
    level,
    points: 0,
    gifts: [],
    shelf: [],
    letter: null,
  };
}

/**
 * Puts what a run earned into the profile: XP (and levels, gifts), glyphs and ink, with the
 * abilities' bonuses, and the scene's hidden letter when the run found it. Call inside the
 * save update, once per run.
 */
export function bankRun(profile: Profile, input: BankInput): RunGain {
  const perks = perksOf(profile);
  const r = input.rewards;
  const xp = Math.round(r.xp * perks.xpBoost);
  const glyphs = r.glyphs + (input.stats.failed ? 0 : perks.glyphsPerPerfect * input.stats.perfect);
  const ink = Math.round(r.ink * perks.inkBoost);
  const gain = emptyGain(levelOf(profile.progress.xp).level);
  gain.xp = xp;
  gain.glyphs = glyphs;
  gain.ink = ink;
  gain.bonus = { xp: xp - r.xp, glyphs: glyphs - r.glyphs, ink: ink - r.ink };
  profile.wallet.glyphs += glyphs;
  profile.wallet.ink += ink;
  addXp(profile, xp, gain);
  const secret = secretOf(input.region);
  if (secret && !input.stats.failed && !profile.progress.secrets.includes(secret.region)) {
    const facts: RunFacts = {
      ...input.stats,
      difficulty: input.difficulty,
      level: input.level,
      rank: r.rank,
    };
    if (secret.test(facts)) {
      profile.progress.secrets.push(secret.region);
      gain.letter = secret.letter;
    }
  }
  return gain;
}

/** XP for a lesson (the lesson screen): characters typed, weighed by accuracy. */
export function lessonXp(chars: number, accuracy: number, passed: boolean): number {
  const acc = Math.max(0, Math.min(100, accuracy)) / 100;
  return Math.round((chars / 4) * acc * acc * (passed ? 1.2 : 0.8));
}

/** Banks a lesson: XP and a few glyphs (lessons are where letters are learned). */
export function bankLesson(
  profile: Profile,
  chars: number,
  accuracy: number,
  passed: boolean,
): RunGain {
  const perks = perksOf(profile);
  const base = lessonXp(chars, accuracy, passed);
  const xp = Math.round(base * perks.xpBoost);
  const gain = emptyGain(levelOf(profile.progress.xp).level);
  const glyphs = Math.round(base / 5);
  gain.xp = xp;
  gain.glyphs = glyphs;
  gain.bonus.xp = xp - base;
  profile.wallet.glyphs += glyphs;
  addXp(profile, xp, gain);
  return gain;
}

/** The player's apprentice as he is dressed now: his own look with the robe and quill on. */
export function dressedLook(profile: Profile): ApprenticeLook {
  const base = apprenticeLook(profile.avatar);
  const d = dressOf(profile);
  const [robe, hem, trim] = d.robe ?? [base.robe, base.hem, base.trim];
  return {
    ...base,
    robe: robe ?? base.robe,
    hem: hem ?? base.hem,
    trim: trim ?? base.trim,
    feather: d.quill[0] ?? base.feather,
    shaft: d.ink[0] ?? base.shaft,
  };
}
