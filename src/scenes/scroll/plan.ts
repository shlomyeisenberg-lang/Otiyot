// The Blank Scroll and the Keeper (T27): the final sequence, as data, and the plan of one run
// from the player's learned letters (pure, unit-tested).
//
// The whole final is one long fight in the boss kit's terms (src/game/boss.ts), so health is
// the share of the scroll still unwritten and the run can always be finished. It has two parts:
//
// The Crossing — five short columns of white parchment, each one folding the mechanics of the
// regions behind you into the kit:
//   c1 The Garden    (Meadow, Cliffs)        single words, gentle: every word raises a drawing
//   c2 The Workshop  (Forge, Shuk)           words, and the marks you know: slips give ground
//   c3 The Race      (Jaffa Line, Hermon)    bursts of words at speed, a breath after each
//   c4 The Deep      (Geniza, Star Station)  sentences on a swinging tide
//   c5 The Dark      (Atbash, Midbar, Caves) one long passage; a clean hand keeps the lantern
//
// The Keeper — four phases before the great blank page of his archive:
//   k1 The Empty Shelves   single words; he wipes each one away as it is written
//   k2 The Scorched Pages  sentences, a little faster
//   k3 The Long Silence    one passage on a slow swinging tide; slips give ground
//   k4 The Lost Words      his own lost lines, typed back faster than he erases them
//
// In the Keeper's phases the weak points are the allies' prompts: Naftali and Reb Ezra call a
// word in turn; typed clean, Naftali holds the line (the Keeper's hand is stayed) and Reb Ezra
// writes back what was erased.
//
// Every word comes from `levelWordSource`, so it is spelled only with learned keys; punctuation
// is added only when the player has learned it (ARCHITECTURE section 8). The credits are typed
// too: each word (again from the learned set) inks one line of them.

import type { BossDef, BossPhaseDef, BossPlan, PlannedPhase } from '../../game/boss';
import type { LevelId } from '../../game/levels';
import { END_MARKS, PASSAGE_MARKS, phase, take, type BlotInput } from '../arena/plan';

export const CROSSING_IDS = ['c1', 'c2', 'c3', 'c4', 'c5'] as const;
export const KEEPER_IDS = ['k1', 'k2', 'k3', 'k4'] as const;
export type CrossingId = (typeof CROSSING_IDS)[number];
export type KeeperId = (typeof KEEPER_IDS)[number];
export type ScrollPhaseId = CrossingId | KeeperId;

/** How many phases cross the scroll before the Keeper. */
export const CROSSING = CROSSING_IDS.length;

export const BLANK_SCROLL: BossDef = {
  id: 'scroll',
  phases: [
    { id: 'c1', text: 'words', attack: 'spatter', music: 'cross1', grace: 4.5, pace: 0.7 },
    { id: 'c2', text: 'words', attack: 'spatter', music: 'cross1', grace: 3.6, pace: 0.8, heal: 2 },
    {
      id: 'c3',
      text: 'words',
      attack: 'tendril',
      music: 'cross2',
      grace: 1.6,
      pace: 1.3,
      rest: 1.6,
    },
    {
      id: 'c4',
      text: 'sentences',
      attack: 'flood',
      music: 'cross2',
      grace: 3.2,
      tide: 0.5,
      tidePeriod: 7,
    },
    { id: 'c5', text: 'passage', attack: 'flood', music: 'cross3', grace: 3.6, heal: 3 },
    { id: 'k1', text: 'words', attack: 'spatter', music: 'keeper1', grace: 2.6 },
    { id: 'k2', text: 'sentences', attack: 'tendril', music: 'keeper2', grace: 3, pace: 1.1 },
    {
      id: 'k3',
      text: 'passage',
      attack: 'flood',
      music: 'keeper3',
      grace: 3.4,
      heal: 3,
      tide: 0.4,
      tidePeriod: 9,
    },
    { id: 'k4', text: 'twist', attack: 'mirror', music: 'keeper4', grace: 3.2, erase: 0.4 },
  ],
};

/** True for the Keeper's phases (the last four). */
export function isKeeperPhase(i: number): boolean {
  return i >= CROSSING;
}

/** How long each part is, per level. */
export interface ScrollSizes {
  /** c1 and c2: single words. */
  garden: number;
  workshop: number;
  /** c3: bursts, and words in each. */
  bursts: number;
  burst: number;
  /** c4: sentences, and words in each (from, to). */
  sentences: number;
  sentenceWords: readonly [number, number];
  /** c5: words in the passage. */
  dark: number;
  /** k1: words; k2: sentences; k3: words in the passage; k4: lost lines and words in each. */
  shelves: number;
  pages: number;
  silence: number;
  lines: number;
  lineWords: number;
  /** Words that write the credits. */
  credits: number;
}

export const SCROLL_SIZES: Readonly<Record<LevelId, ScrollSizes>> = {
  easy: {
    garden: 4,
    workshop: 4,
    bursts: 2,
    burst: 2,
    sentences: 2,
    sentenceWords: [3, 3],
    dark: 6,
    shelves: 6,
    pages: 2,
    silence: 8,
    lines: 3,
    lineWords: 3,
    credits: 7,
  },
  standard: {
    garden: 5,
    workshop: 5,
    bursts: 3,
    burst: 2,
    sentences: 2,
    sentenceWords: [3, 4],
    dark: 8,
    shelves: 8,
    pages: 3,
    silence: 10,
    lines: 4,
    lineWords: 3,
    credits: 7,
  },
  hard: {
    garden: 6,
    workshop: 6,
    bursts: 3,
    burst: 3,
    sentences: 3,
    sentenceWords: [4, 5],
    dark: 10,
    shelves: 9,
    pages: 3,
    silence: 13,
    lines: 4,
    lineWords: 4,
    credits: 7,
  },
};

interface Built {
  words: string[];
  groups: number[];
  weak: boolean[];
}

/** Single words, one group each; every `every`-th is a weak point (0: none). */
function singles(o: BlotInput, avoid: Set<string>, n: number, every: number): Built {
  const words = take(o.words, n, avoid);
  return {
    words,
    groups: words.map((_, i) => i),
    weak: words.map((_, i) => every > 0 && i % every === every - 1),
  };
}

/** Groups of `size` words (bursts, lines); the last word of each group is its weak point. */
function runs(o: BlotInput, avoid: Set<string>, count: number, size: number, weak: boolean): Built {
  const out: Built = { words: [], groups: [], weak: [] };
  for (let g = 0; g < count; g++) {
    const words = take(o.words, size, avoid);
    words.forEach((w, i) => {
      out.words.push(w);
      out.groups.push(g);
      out.weak.push(weak && i === words.length - 1);
    });
  }
  return out;
}

/** Sentences of lo..hi words; a full stop only when it is learned; the last word is weak. */
function sentences(
  o: BlotInput,
  avoid: Set<string>,
  count: number,
  [lo, hi]: readonly [number, number],
): Built {
  const out: Built = { words: [], groups: [], weak: [] };
  const stop = END_MARKS.find((m) => o.keys.has(m));
  for (let s = 0; s < count; s++) {
    const n = lo + Math.floor(o.rng() * (hi - lo + 1));
    const words = take(o.words, n, avoid);
    words.forEach((w, i) => {
      const last = i === words.length - 1;
      out.words.push(last && stop ? `${w}${stop}` : w);
      out.groups.push(s);
      out.weak.push(last);
    });
  }
  return out;
}

/**
 * One passage in stretches. Learned punctuation ends a stretch and marks its weak point; with
 * none learned, stretches are three words long.
 */
function passage(o: BlotInput, avoid: Set<string>, n: number, marksOnly = false): Built {
  const marks = PASSAGE_MARKS.filter((m) => o.keys.has(m));
  const words = take(o.words, n, avoid);
  const out: Built = { words, groups: [], weak: [] };
  let group = 0;
  let run = 0;
  for (let i = 0; i < words.length; i++) {
    out.groups.push(group);
    run += 1;
    const lastWord = i === words.length - 1;
    let marked = false;
    if (marks.length > 0) {
      if (lastWord) {
        const end = END_MARKS.find((m) => o.keys.has(m)) ?? (marks[0] as string);
        words[i] = `${words[i] as string}${end}`;
        marked = true;
      } else if (run >= 2 && (run >= 4 || o.rng() < (marksOnly ? 0.7 : 0.45))) {
        words[i] = `${words[i] as string}${marks[Math.floor(o.rng() * marks.length)] as string}`;
        marked = true;
      }
    }
    const ends = marks.length > 0 ? marked : run === 3;
    out.weak.push(ends || lastWord);
    if (ends && !lastWord) {
      group += 1;
      run = 0;
    }
  }
  return out;
}

/** Plans the whole final. Same input, same run. */
export function planScroll(o: BlotInput): BossPlan {
  const size = SCROLL_SIZES[o.level];
  const defs = BLANK_SCROLL.phases;
  const avoid = new Set<string>();
  const built: Built[] = [
    // The Crossing: no weak points (the allies speak up only before the Keeper).
    singles(o, avoid, size.garden, 0),
    // The Workshop: the marks you know hang on the words, as prices did in the Shuk.
    passage(o, avoid, size.workshop, true),
    runs(o, avoid, size.bursts, size.burst, false),
    sentences(o, avoid, size.sentences, size.sentenceWords),
    passage(o, avoid, size.dark),
    // The Keeper.
    singles(o, avoid, size.shelves, 3),
    sentences(o, avoid, size.pages, size.sentenceWords),
    passage(o, avoid, size.silence),
    runs(o, avoid, size.lines, size.lineWords, true),
  ];
  const phases: PlannedPhase[] = built.map((b, i) => {
    // Before the Keeper nobody calls a word: the crossing has no weak points.
    const weak = isKeeperPhase(i) ? b.weak : b.weak.map(() => false);
    return phase(defs[i] as BossPhaseDef, b.words, b.groups, weak);
  });
  return { boss: BLANK_SCROLL.id, phases };
}

/** Who calls a word. Naftali holds the line; Reb Ezra writes back what was erased. */
export type Ally = 'naftali' | 'ezra';

/**
 * The ally whose prompt word `w` of phase `p` is (null: nobody's). The Keeper's weak points
 * alternate between Naftali and Reb Ezra, Naftali first.
 */
export function allyAt(plan: BossPlan, p: number, w: number): Ally | null {
  const ph = plan.phases[p];
  if (!ph || !isKeeperPhase(p) || !ph.weak[w]) return null;
  let n = 0;
  for (let i = 0; i < w; i++) if (ph.weak[i]) n += 1;
  return n % 2 === 0 ? 'naftali' : 'ezra';
}

/** The words that write the credits (one credit line per word), from the learned set. */
export function planCredits(o: BlotInput): string[] {
  return take(o.words, SCROLL_SIZES[o.level].credits, new Set<string>());
}
