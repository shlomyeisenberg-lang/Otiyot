// The Great Blot (T16): the first boss, in the Silent Arena. Its four phases as data, and the
// plan of one fight from the player's learned letters (pure, unit-tested).
//
//   I   Spatter  — single words. The Blot flings globs of ink; each word bursts one in the air.
//   II  Tendrils — sentences. An ink tendril reaches for the scribe while a sentence is typed;
//                  its last word is the weak point that cuts it.
//   III Flood    — one punctuated passage. A ring of ink closes in from the edge of the stage;
//                  steady typing holds it back. Words carrying punctuation are the weak points.
//   IV  Mirror   — the twist. The Blot turns the world inside out and gives back the words it
//                  swallowed in Phase I in the mirrored order (last first), as mirror shards.
//
// Every word comes from `levelWordSource`, so it is spelled only with learned keys; punctuation
// is added only when the player has learned it (ARCHITECTURE section 8). A player who knows no
// punctuation still gets a passage: one long stretch with no breaks, in groups of three words.

import type { LayoutId } from '../../core/layouts';
import {
  joinWords,
  type BossDef,
  type BossPhaseDef,
  type BossPlan,
  type PlannedPhase,
} from '../../game/boss';
import type { LevelId } from '../../game/levels';

export const GREAT_BLOT: BossDef = {
  id: 'blot',
  phases: [
    { id: 'p1', text: 'words', attack: 'spatter', music: 'phase1', grace: 2.6 },
    { id: 'p2', text: 'sentences', attack: 'tendril', music: 'phase2', grace: 3.2 },
    { id: 'p3', text: 'passage', attack: 'flood', music: 'phase3', grace: 3.6 },
    { id: 'p4', text: 'twist', attack: 'mirror', music: 'phase4', grace: 3 },
  ],
};

export type BlotPhaseId = 'p1' | 'p2' | 'p3' | 'p4';

/** How long each phase is, per level. */
export interface PhaseSizes {
  /** Phase I: single words. */
  words: number;
  /** Phase II: sentences, and words in each (from, to). */
  sentences: number;
  sentenceWords: readonly [number, number];
  /** Phase III: words in the passage. */
  passage: number;
  /** Phase IV: words given back (at most the words of Phase I). */
  twist: number;
}

export const SIZES: Readonly<Record<LevelId, PhaseSizes>> = {
  easy: { words: 6, sentences: 2, sentenceWords: [3, 3], passage: 8, twist: 5 },
  standard: { words: 8, sentences: 3, sentenceWords: [3, 4], passage: 11, twist: 6 },
  hard: { words: 10, sentences: 3, sentenceWords: [4, 5], passage: 14, twist: 8 },
};

/** Punctuation the passage may use, in order of preference (only the learned ones are used). */
export const PASSAGE_MARKS: readonly string[] = [',', '.', ';', '!', '?', ':', '-'];
/** Marks that end a passage (the first learned one closes the last word). */
const END_MARKS: readonly string[] = ['.', '!', '?'];

export interface BlotInput {
  layout: LayoutId;
  /** The keys the player has learned (letters, and any punctuation). */
  keys: ReadonlySet<string>;
  level: LevelId;
  /** Words from learned letters (levelWordSource). */
  words: { next(): string };
  /** 0..1 random numbers (where the punctuation falls). */
  rng: () => number;
}

/** The words of a phase are all different from their neighbours, so the strip never stutters. */
function take(src: { next(): string }, n: number, avoid: Set<string>): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    let w = src.next();
    for (let tries = 0; tries < 6 && (avoid.has(w) || w === out.at(-1)); tries++) w = src.next();
    out.push(w);
    avoid.add(w);
    // Keep the memory short: a small learned set has few words, and repeats are fine later.
    if (avoid.size > 12) avoid.delete(avoid.values().next().value as string);
  }
  return out;
}

function phase(
  def: BossPhaseDef,
  words: string[],
  groups: number[],
  weak: boolean[],
): PlannedPhase {
  return { def, words, groups, weak, text: joinWords(words) };
}

/** Plans the whole fight. Same input, same fight. */
export function planGreatBlot(o: BlotInput): BossPlan {
  const size = SIZES[o.level];
  const defs = GREAT_BLOT.phases;
  const avoid = new Set<string>();

  // I. Spatter: one glob per word; every third glob glints gold (its weak point).
  const w1 = take(o.words, size.words, avoid);
  const p1 = phase(
    defs[0] as BossPhaseDef,
    w1,
    w1.map((_, i) => i),
    w1.map((_, i) => i % 3 === 2),
  );

  // II. Tendrils: one tendril per sentence; the sentence's last word cuts it.
  const w2: string[] = [];
  const g2: number[] = [];
  const k2: boolean[] = [];
  const [lo, hi] = size.sentenceWords;
  for (let s = 0; s < size.sentences; s++) {
    const n = lo + Math.floor(o.rng() * (hi - lo + 1));
    const words = take(o.words, n, avoid);
    words.forEach((w, i) => {
      w2.push(w);
      g2.push(s);
      k2.push(i === words.length - 1);
    });
  }
  // A sentence ends with a full stop when the player knows one.
  const stop = END_MARKS.find((m) => o.keys.has(m));
  if (stop) {
    for (let i = 0; i < w2.length; i++) {
      if (g2[i] !== g2[i + 1]) w2[i] = `${w2[i] as string}${stop}`;
    }
  }
  const p2 = phase(defs[1] as BossPhaseDef, w2, g2, k2);

  // III. Flood: one passage in stretches; punctuation (only learned marks) ends a stretch.
  const marks = PASSAGE_MARKS.filter((m) => o.keys.has(m));
  const w3 = take(o.words, size.passage, avoid);
  const g3: number[] = [];
  const k3: boolean[] = [];
  let group = 0;
  let run = 0;
  for (let i = 0; i < w3.length; i++) {
    g3.push(group);
    run += 1;
    const lastWord = i === w3.length - 1;
    let marked = false;
    if (marks.length > 0) {
      if (lastWord) {
        const end = END_MARKS.find((m) => o.keys.has(m)) ?? marks[0];
        w3[i] = `${w3[i] as string}${end as string}`;
        marked = true;
      } else if (run >= 2 && (run >= 4 || o.rng() < 0.45)) {
        const m = marks[Math.floor(o.rng() * marks.length)] as string;
        w3[i] = `${w3[i] as string}${m}`;
        marked = true;
      }
    }
    k3.push(marks.length > 0 ? marked : run === 3 || lastWord);
    if ((marks.length > 0 ? marked : run === 3) && !lastWord) {
      group += 1;
      run = 0;
    }
  }
  const p3 = phase(defs[2] as BossPhaseDef, w3, g3, k3);

  // IV. Mirror: the swallowed words of Phase I come back last first; the very last is the core.
  const w4 = [...w1].reverse().slice(0, Math.min(size.twist, w1.length));
  const p4 = phase(
    defs[3] as BossPhaseDef,
    w4,
    w4.map((_, i) => i),
    w4.map((_, i) => i === w4.length - 1 || i % 2 === 1),
  );

  return { boss: GREAT_BLOT.id, phases: [p1, p2, p3, p4] };
}

/** Every character a plan asks the player to type (tests check them against the learned keys). */
export function planChars(plan: BossPlan): Set<string> {
  const out = new Set<string>();
  for (const p of plan.phases) for (const ch of p.text) out.add(ch);
  return out;
}
