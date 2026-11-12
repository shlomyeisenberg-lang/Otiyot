// The Silent Arena's three trials (T26): the bosses that wait in the arena after the Great Blot.
// Each one tests a different skill, and each is three phases long. Their phases as data, and the
// plan of one fight from the player's learned letters (pure, unit-tested).
//
//   The Storm Bird (Speed)      — it strikes in bursts: short groups, attacks timed faster than
//                                 any other fight, and a rest after every parried burst. Type
//                                 fast, breathe, type fast again.
//   The Glass Golem (Precision) — every slip mends a crack: errors heal it. The attacks are slow;
//                                 a clean hand is what wins. Every perfect word stuns it.
//   The Long Tide (Endurance)   — long passages in long stretches, and the tide's pull swings:
//                                 at high tide the wave comes fast, at low tide it slows.
//
// Every word comes from `levelWordSource`, so it is spelled only with learned keys; punctuation
// is added only when the player has learned it (ARCHITECTURE section 8).

import type { BossDef, BossPhaseDef, BossPlan } from '../../game/boss';
import type { LevelId } from '../../game/levels';
import { TRIAL_IDS, type TrialId } from '../../game/trials';
import { END_MARKS, PASSAGE_MARKS, phase, take, type BlotInput } from './plan';

export { TRIAL_IDS, type TrialId };

/** The skill each trial tests (the board shows it). */
export const TRIAL_SKILL: Readonly<Record<TrialId, 'speed' | 'precision' | 'endurance'>> = {
  storm: 'speed',
  glass: 'precision',
  tide: 'endurance',
};

export const TRIALS: Readonly<Record<TrialId, BossDef>> = {
  storm: {
    id: 'trial-storm',
    phases: [
      { id: 'p1', text: 'words', attack: 'spatter', music: 'storm1', grace: 1.4, pace: 1.3, rest: 1.8 },
      { id: 'p2', text: 'words', attack: 'tendril', music: 'storm2', grace: 1.2, pace: 1.45, rest: 1.5 },
      { id: 'p3', text: 'sentences', attack: 'spatter', music: 'storm3', grace: 1.4, pace: 1.6, rest: 1.3 },
    ],
  },
  glass: {
    id: 'trial-glass',
    phases: [
      { id: 'p1', text: 'words', attack: 'mirror', music: 'glass1', grace: 3.4, pace: 0.8, heal: 3 },
      { id: 'p2', text: 'sentences', attack: 'spatter', music: 'glass2', grace: 3.6, pace: 0.8, heal: 4 },
      { id: 'p3', text: 'passage', attack: 'mirror', music: 'glass3', grace: 3.8, pace: 0.85, heal: 5 },
    ],
  },
  tide: {
    id: 'trial-tide',
    phases: [
      { id: 'p1', text: 'passage', attack: 'flood', music: 'tide1', grace: 3.2, tide: 0.45, tidePeriod: 8 },
      { id: 'p2', text: 'sentences', attack: 'tendril', music: 'tide2', grace: 3, tide: 0.55, tidePeriod: 6 },
      { id: 'p3', text: 'passage', attack: 'flood', music: 'tide3', grace: 3.4, pace: 1.05, tide: 0.65, tidePeriod: 7 },
    ],
  },
};

/** How long each trial's phases are, per level (words). */
export interface TrialSizes {
  /** Storm: words in bursts of `burst`; then sentences of 3–4 words. */
  burst: number;
  bursts: number;
  bursts2: number;
  stormSentences: number;
  /** Glass: single words, then sentences, then a passage. */
  glassWords: number;
  glassSentences: number;
  glassPassage: number;
  /** Tide: a passage, sentences, then the long passage. */
  tidePassage: number;
  tideSentences: number;
  tideLong: number;
}

export const TRIAL_SIZES: Readonly<Record<LevelId, TrialSizes>> = {
  easy: {
    burst: 2,
    bursts: 4,
    bursts2: 3,
    stormSentences: 2,
    glassWords: 6,
    glassSentences: 2,
    glassPassage: 8,
    tidePassage: 12,
    tideSentences: 3,
    tideLong: 16,
  },
  standard: {
    burst: 2,
    bursts: 5,
    bursts2: 4,
    stormSentences: 3,
    glassWords: 8,
    glassSentences: 3,
    glassPassage: 11,
    tidePassage: 16,
    tideSentences: 4,
    tideLong: 22,
  },
  hard: {
    burst: 3,
    bursts: 5,
    bursts2: 4,
    stormSentences: 3,
    glassWords: 10,
    glassSentences: 3,
    glassPassage: 14,
    tidePassage: 20,
    tideSentences: 5,
    tideLong: 28,
  },
};

interface Built {
  words: string[];
  groups: number[];
  weak: boolean[];
}

/** Words in groups of `size`; the last word of each group is its weak point. */
function bursts(o: BlotInput, avoid: Set<string>, count: number, size: number): Built {
  const out: Built = { words: [], groups: [], weak: [] };
  for (let g = 0; g < count; g++) {
    const ws = take(o.words, size, avoid);
    ws.forEach((w, i) => {
      out.words.push(w);
      out.groups.push(g);
      out.weak.push(i === ws.length - 1);
    });
  }
  return out;
}

/** Sentences of `lo`..`hi` words, one group each, ending with a learned stop when there is one. */
function sentences(
  o: BlotInput,
  avoid: Set<string>,
  count: number,
  lo: number,
  hi: number,
  weakAt: 'last' | 'longest',
): Built {
  const out: Built = { words: [], groups: [], weak: [] };
  const stop = END_MARKS.find((m) => o.keys.has(m));
  for (let s = 0; s < count; s++) {
    const n = lo + Math.floor(o.rng() * (hi - lo + 1));
    const ws = take(o.words, n, avoid);
    let longest = 0;
    ws.forEach((w, i) => {
      if (w.length > (ws[longest] as string).length) longest = i;
    });
    ws.forEach((w, i) => {
      const end = i === ws.length - 1;
      out.words.push(end && stop ? `${w}${stop}` : w);
      out.groups.push(s);
      out.weak.push(weakAt === 'last' ? end : i === longest);
    });
  }
  return out;
}

/**
 * A passage in stretches of about `run` words. With learned punctuation, a mark ends each
 * stretch (and is its weak point); without, the stretches are plain and their last word is weak.
 */
function passage(o: BlotInput, avoid: Set<string>, count: number, run: number): Built {
  const out: Built = { words: take(o.words, count, avoid), groups: [], weak: [] };
  const marks = PASSAGE_MARKS.filter((m) => o.keys.has(m));
  const end = END_MARKS.find((m) => o.keys.has(m)) ?? marks[0];
  let group = 0;
  let len = 0;
  for (let i = 0; i < out.words.length; i++) {
    out.groups.push(group);
    len += 1;
    const last = i === out.words.length - 1;
    const breaks = len >= run || (len >= run - 1 && o.rng() < 0.35);
    if (marks.length > 0 && (last || breaks)) {
      const m = last ? (end as string) : (marks[Math.floor(o.rng() * marks.length)] as string);
      out.words[i] = `${out.words[i] as string}${m}`;
    }
    out.weak.push(breaks || last);
    if (breaks && !last) {
      group += 1;
      len = 0;
    }
  }
  return out;
}

const def = (t: TrialId, i: number): BossPhaseDef => TRIALS[t].phases[i] as BossPhaseDef;
const built = (d: BossPhaseDef, b: Built) => phase(d, b.words, b.groups, b.weak);

/** Plans one trial. Same input, same fight. */
export function planTrial(trial: TrialId, o: BlotInput): BossPlan {
  const z = TRIAL_SIZES[o.level];
  const avoid = new Set<string>();
  const id = TRIALS[trial].id;
  switch (trial) {
    case 'storm': {
      // I. Bursts of two (three on Hard). II. More bursts, the pace higher. III. Quick sentences.
      const a = bursts(o, avoid, z.bursts, z.burst);
      const b = bursts(o, avoid, z.bursts2, z.burst + 1);
      const c = sentences(o, avoid, z.stormSentences, 3, 4, 'last');
      return { boss: id, phases: [built(def(trial, 0), a), built(def(trial, 1), b), built(def(trial, 2), c)] };
    }
    case 'glass': {
      // I. Single words, every other one a weak point (a perfect word stuns the golem).
      const words = take(o.words, z.glassWords, avoid);
      const a: Built = {
        words,
        groups: words.map((_, i) => i),
        weak: words.map((_, i) => i % 2 === 1),
      };
      // II. Sentences: the longest word is where the glass is thinnest. III. A passage.
      const b = sentences(o, avoid, z.glassSentences, 3, 4, 'longest');
      const c = passage(o, avoid, z.glassPassage, 3);
      return { boss: id, phases: [built(def(trial, 0), a), built(def(trial, 1), b), built(def(trial, 2), c)] };
    }
    case 'tide': {
      // I. A passage in long stretches. II. Sentences like waves. III. The long passage.
      const a = passage(o, avoid, z.tidePassage, 4);
      const b = sentences(o, avoid, z.tideSentences, 4, 5, 'last');
      const c = passage(o, avoid, z.tideLong, 5);
      return { boss: id, phases: [built(def(trial, 0), a), built(def(trial, 1), b), built(def(trial, 2), c)] };
    }
  }
}
