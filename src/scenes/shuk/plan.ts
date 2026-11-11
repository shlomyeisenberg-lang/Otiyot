// The Night Shuk's run, as plain data (no 3D here; unit-tested). The market is a ring of stalls
// and every stall is one trade: a learned word, with a punctuation mark on its tail when the
// player has learned one ("dag," or "lev."). Punctuation is the coin of the Shuk: a trade pays
// one coin for the word and one more for every mark, so typing the marks wins the money. A trade
// closed without a slip is a clean deal, and clean deals in a row are a haggle won.
//
// Every character is one the player has already learned (ARCHITECTURE section 8): words come from
// the learned word source, and a mark is used only when its key is in the learned set. A player
// who has learned no mark yet simply trades plain words, so the run is always completable.

import type { LevelId } from '../../game/levels';

export const CHAPTER_IDS = ['lane', 'bazaar', 'square'] as const;
export type ChapterId = (typeof CHAPTER_IDS)[number];

export interface Chapter {
  id: ChapterId;
  /** Index of its first trade, and one past its last. */
  from: number;
  to: number;
}

/** Lanterns along the wire above the lanes (and sections of the run). */
export const SECTIONS = 4;

/** Trades per level (always a multiple of SECTIONS). */
export const TRADES_PER_LEVEL: Readonly<Record<LevelId, number>> = {
  easy: 8,
  standard: 12,
  hard: 16,
};

/** The marks that can be currency, in the order they are taught to a player. */
export const MARKS = ['.', ',', ';', ':', '!', '?', "'", '-'] as const;

/** How many different marks each level may use at most, and how often a trade carries one. */
export const MARK_KINDS: Readonly<Record<LevelId, number>> = { easy: 1, standard: 2, hard: 4 };
export const MARK_SHARE: Readonly<Record<LevelId, number>> = {
  easy: 0.4,
  standard: 0.55,
  hard: 0.75,
};

/** A haggle is won after this many clean deals in a row. */
export const HAGGLE_AT = 3;

export interface Trade {
  /** The word and the mark on its tail, exactly as typed ("dag,"). */
  token: string;
  word: string;
  /** The mark that ends the token, or '' for a plain word. */
  mark: string;
  /** Coins the trade pays: one for the word, one for the mark. */
  coins: number;
}

export interface ShukPlan {
  trades: readonly Trade[];
  /** The whole run as one line: the tokens with single spaces between them. */
  text: string;
  chapters: readonly Chapter[];
  /** Coins in the whole run, and the marks in it. */
  coins: number;
  marks: number;
  /** The marks this run may use (learned ones only). */
  usable: readonly string[];
  level: LevelId;
}

export interface PlanOptions {
  /** The learned keys (every word and mark is checked against them). */
  keys: ReadonlySet<string>;
  level: LevelId;
  /** Learned words of the level's lengths (`levelWordSource`). */
  words: { next(): string };
  /** A random number in [0, 1). */
  rng: () => number;
}

/** The marks a player may be asked to type: the learned ones, as many kinds as the level allows. */
export function usableMarks(keys: ReadonlySet<string>, level: LevelId): string[] {
  return MARKS.filter((m) => keys.has(m)).slice(0, MARK_KINDS[level]);
}

/** Coins a token pays: one for the word, one for each mark in it. */
export function coinsOf(token: string): number {
  let coins = 1;
  for (const ch of token) if ((MARKS as readonly string[]).includes(ch)) coins += 1;
  return coins;
}

/** Lays out one run. A word or mark that is not learned is simply never taken. */
export function planShuk(o: PlanOptions): ShukPlan {
  const spelled = (w: string): boolean => w.length > 0 && [...w].every((ch) => o.keys.has(ch));
  const count = TRADES_PER_LEVEL[o.level];
  const usable = usableMarks(o.keys, o.level);
  const words: string[] = [];
  let tries = 0;
  while (words.length < count && tries < count * 14) {
    tries += 1;
    const w = o.words.next().trim();
    // Never the same word twice in a row, never a key that was not learned, never a space.
    if (!spelled(w) || w.includes(' ') || w === words.at(-1)) continue;
    words.push(w);
  }
  const trades: Trade[] = words.map((word, i) => {
    let mark = '';
    if (usable.length > 0) {
      const last = i === words.length - 1;
      // The last trade always closes with a mark, so a run with a mark ends on a coin.
      if (last || o.rng() < MARK_SHARE[o.level]) {
        mark = usable[Math.min(usable.length - 1, Math.floor(o.rng() * usable.length))] as string;
      }
    }
    const token = word + mark;
    return { token, word, mark, coins: coinsOf(token) };
  });
  const chapters: Chapter[] = [];
  const a = Math.round(trades.length * 0.25);
  const b = Math.round(trades.length * 0.75);
  if (a > 0) chapters.push({ id: 'lane', from: 0, to: a });
  if (b > a) chapters.push({ id: 'bazaar', from: a, to: b });
  if (trades.length > b) chapters.push({ id: 'square', from: b, to: trades.length });
  let coins = 0;
  let marks = 0;
  for (const t of trades) {
    coins += t.coins;
    if (t.mark) marks += 1;
  }
  return {
    trades,
    text: trades.map((t) => t.token).join(' '),
    chapters,
    coins,
    marks,
    usable,
    level: o.level,
  };
}

/** The chapter a trade index is in (the last chapter once the run is over). */
export function chapterAt(plan: ShukPlan, index: number): ChapterId {
  for (const c of plan.chapters) if (index < c.to) return c.id;
  return plan.chapters.at(-1)?.id ?? 'square';
}

/** The chapter that begins at this index, if one does. */
export function chapterStartsAt(plan: ShukPlan, index: number): ChapterId | null {
  return plan.chapters.find((c) => c.from === index)?.id ?? null;
}

// ---- the haggle -----------------------------------------------------------------------------

/** The streak after a deal: a clean one adds to it, a deal with a slip breaks it. */
export function haggleStreak(streak: number, clean: boolean): number {
  return clean ? streak + 1 : 0;
}

/** True on the deal that wins a haggle (every HAGGLE_AT clean deals in a row). */
export function haggleWon(streak: number): boolean {
  return streak > 0 && streak % HAGGLE_AT === 0;
}

/** The coins a deal puts in the purse: a haggle won doubles the mark coins. */
export function purseAfter(purse: number, trade: Trade, won: boolean): number {
  const marks = trade.coins - 1;
  return purse + 1 + marks * (won ? 2 : 1);
}

// ---- how the shuk answers -------------------------------------------------------------------

/** Lanterns lit after so many trades (0..SECTIONS; all at the end). */
export function lanternsLit(done: number, total: number): number {
  if (total <= 0) return SECTIONS;
  if (done >= total) return SECTIONS;
  return Math.max(0, Math.min(SECTIONS, Math.floor((done * SECTIONS) / total)));
}

/** How far (0..1) the color has spread through the market after so many trades. */
export function colorShare(done: number, total: number): number {
  if (total <= 0) return 1;
  return Math.max(0, Math.min(1, done / total));
}
