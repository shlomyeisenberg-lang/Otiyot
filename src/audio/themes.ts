// The music themes, as data (pure). Each region has its own mode, tempo, instruments and form,
// following DESIGN 'Sound direction': modal melodies (freygish / minor) on plucked and bowed
// voices, built in stems that layer in with the combo.

import type { ModeName } from './theory';

export type StemId = 'drone' | 'pulse' | 'melody' | 'counter' | 'perc';
export const STEMS: readonly StemId[] = ['drone', 'pulse', 'melody', 'counter', 'perc'];

/** Pitched voices the synth knows (src/audio/synth.ts). */
export type Voice =
  | 'pad'
  | 'harp'
  | 'oud'
  | 'kanun'
  | 'flute'
  | 'clarinet'
  | 'violin'
  | 'strings'
  | 'cello'
  | 'bell'
  | 'horn'
  | 'glass'
  | 'pluck';
/** Drum kits; each plays the same pattern letters with its own sounds. */
export type Kit = 'darbuka' | 'frame' | 'taiko' | 'brush';

export interface Section {
  /** Bars long (a multiple of 4: phrases are 4 bars). */
  bars: number;
  /** Chord per bar, as the scale degree of its root (cycled if shorter than `bars`). */
  chords: readonly number[];
  /** Melody centre, in scale degrees above the theme root. */
  register: number;
  /** 0..1: how busy the melody is. */
  density: number;
  /** Semitones added to everything (the boss's last phase climbs). */
  transpose?: number;
  /** Drum pattern names for this section (defaults: 'base' and 'full'). */
  drums?: { base: string; full: string };
}

export interface ThemeSpec {
  id: ThemeId;
  /** Shown in the sound room. */
  nameKey: string;
  seed: number;
  bpm: number;
  /** Beats per bar, and grid steps per beat (2 = eighths, 3 = compound 6/8 feel, 4 = 16ths). */
  beats: number;
  sub: number;
  /** MIDI note of scale degree 0 (the melody's tonic). */
  root: number;
  mode: ModeName;
  /** Delay of every off-beat grid step, as a share of a step. */
  swing: number;
  /** The order of sections; it repeats. */
  form: readonly string[];
  sections: Readonly<Record<string, Section>>;
  /** Boss themes: the form to switch to for each phase. */
  phases?: Readonly<Record<string, readonly string[]>>;
  voices: { drone: Voice; pulse: Voice; melody: Voice; counter: Voice };
  kit: Kit;
  /** Arpeggio per grid step: index into [root, third, fifth, octave] of the bar's chord, -1 rest. */
  pulse: readonly number[];
  /** Counter-melody octave relative to the melody (-1 below, 1 above). */
  counterOctave: number;
  /** Drum patterns, one letter per grid step: D doum, T tek, k ka (ghost), S shaker, . rest. */
  drums: Readonly<Record<string, string>>;
  /** Melodic rhythm cells (grid steps; negative = rest), each summing to one bar. */
  cells: readonly (readonly number[])[];
  /** Phrase endings (last bar of each phrase). */
  cadences: readonly (readonly number[])[];
  /** Mix: how much goes to the hall. */
  reverb: number;
  /** 0..1: overall tone colour (filter openness). */
  brightness: number;
  /** Master level of the theme, to keep themes even. */
  level: number;
}

export type ThemeId =
  | 'title'
  | 'hub'
  | 'meadow'
  | 'cliffs'
  | 'forge'
  | 'shuk'
  | 'rail'
  | 'geniza'
  | 'hermon'
  | 'station'
  | 'atbash'
  | 'boss';
export const THEME_IDS: readonly ThemeId[] = [
  'title',
  'hub',
  'meadow',
  'cliffs',
  'forge',
  'shuk',
  'rail',
  'geniza',
  'hermon',
  'station',
  'atbash',
  'boss',
];

// Compound (6/8) cells: 6 steps per bar.
const CELLS_6 = [
  [2, 1, 2, 1],
  [3, 2, 1],
  [2, 1, 3],
  [1, 1, 1, 2, 1],
  [3, 3],
  [2, 1, 1, 1, 1],
  [-1, 1, 1, 3],
] as const;
const CAD_6 = [[6], [3, 3], [2, 1, 3]] as const;

// Simple (4/4 in eighths) cells: 8 steps per bar.
const CELLS_8 = [
  [2, 2, 2, 2],
  [3, 1, 2, 2],
  [2, 1, 1, 4],
  [1, 1, 2, 2, 2],
  [4, 2, 2],
  [2, 2, 4],
  [3, 3, 2],
  [-2, 2, 1, 1, 2],
] as const;
const CAD_8 = [[8], [4, 4], [2, 2, 4], [6, 2]] as const;

// Driving (4/4 in sixteenths) cells: 16 steps per bar.
const CELLS_16 = [
  [4, 4, 4, 4],
  [2, 2, 4, 2, 2, 4],
  [6, 2, 4, 4],
  [3, 3, 2, 4, 4],
  [2, 2, 2, 2, 8],
  [4, 2, 2, 4, 2, 2],
  [-4, 2, 2, 4, 4],
] as const;
const CAD_16 = [[16], [8, 8], [4, 4, 8], [6, 2, 8]] as const;

export const THEMES: Readonly<Record<ThemeId, ThemeSpec>> = {
  // The title: a slow, mysterious doina in D freygish. A scroll unrolling in candlelight.
  title: {
    id: 'title',
    nameKey: 'sound.theme.title',
    seed: 1801,
    bpm: 60,
    beats: 2,
    sub: 3,
    root: 62,
    mode: 'freygish',
    swing: 0,
    form: ['A', 'A', 'B', 'A'],
    sections: {
      A: { bars: 8, chords: [0, 0, 3, 0, 1, 1, 0, 0], register: 2, density: 0.35 },
      B: { bars: 8, chords: [3, 3, 6, 6, 1, 1, 0, 0], register: 4, density: 0.5 },
    },
    voices: { drone: 'pad', pulse: 'harp', melody: 'clarinet', counter: 'strings' },
    kit: 'frame',
    pulse: [0, 2, 3, 1, 2, 3],
    counterOctave: -1,
    drums: { base: 'D.....', full: 'D..k.T' },
    cells: CELLS_6,
    cadences: CAD_6,
    reverb: 0.55,
    brightness: 0.45,
    level: 0.9,
  },
  // The hub, the House of the Scribe: cosy G minor, an oud by the fire, soft brushes.
  hub: {
    id: 'hub',
    nameKey: 'sound.theme.hub',
    seed: 2207,
    bpm: 80,
    beats: 4,
    sub: 2,
    root: 67,
    mode: 'minor',
    swing: 0.16,
    form: ['A', 'B', 'A', 'C'],
    sections: {
      A: { bars: 8, chords: [0, 0, 5, 5, 3, 3, 6, 6], register: 0, density: 0.4 },
      B: { bars: 8, chords: [2, 2, 6, 6, 3, 3, 4, 4], register: 2, density: 0.55 },
      C: { bars: 8, chords: [5, 6, 0, 0, 3, 4, 0, 0], register: 1, density: 0.3 },
    },
    voices: { drone: 'pad', pulse: 'harp', melody: 'oud', counter: 'cello' },
    kit: 'brush',
    pulse: [0, -1, 2, 3, 1, -1, 2, 3],
    counterOctave: -1,
    drums: { base: 'D.S.T.S.', full: 'D.SkT.Sk' },
    cells: CELLS_8,
    cadences: CAD_8,
    reverb: 0.35,
    brightness: 0.5,
    level: 0.95,
  },
  // Home Row Meadow: a bright, bouncing A dorian dance on flute and harp, with darbuka.
  meadow: {
    id: 'meadow',
    nameKey: 'sound.theme.meadow',
    seed: 3313,
    bpm: 112,
    beats: 4,
    sub: 2,
    root: 69,
    mode: 'dorian',
    swing: 0.1,
    form: ['A', 'A', 'B', 'A'],
    sections: {
      A: { bars: 8, chords: [0, 3, 0, 3, 6, 6, 3, 0], register: 2, density: 0.6 },
      B: { bars: 8, chords: [3, 3, 6, 6, 0, 0, 4, 4], register: 4, density: 0.7 },
    },
    voices: { drone: 'pad', pulse: 'harp', melody: 'flute', counter: 'strings' },
    kit: 'darbuka',
    pulse: [0, 2, 3, 2, 1, 2, 3, 2],
    counterOctave: -1,
    drums: { base: 'D..TD.T.', full: 'D.kTD.TS' },
    cells: CELLS_8,
    cadences: CAD_8,
    reverb: 0.28,
    brightness: 0.75,
    level: 0.85,
  },
  // Cliffs of Ein Gedi: a windy, climbing E mi-sheberach dance in 6/8, kanun and solo violin.
  cliffs: {
    id: 'cliffs',
    nameKey: 'sound.theme.cliffs',
    seed: 4421,
    bpm: 92,
    beats: 2,
    sub: 3,
    root: 64,
    mode: 'misheberach',
    swing: 0,
    form: ['A', 'B', 'A', 'B', 'C'],
    sections: {
      A: { bars: 8, chords: [0, 0, 1, 1, 0, 0, 6, 0], register: 1, density: 0.55 },
      B: { bars: 8, chords: [6, 6, 0, 0, 1, 1, 4, 0], register: 3, density: 0.7 },
      C: { bars: 8, chords: [4, 4, 6, 6, 1, 1, 0, 0], register: 5, density: 0.45 },
    },
    voices: { drone: 'pad', pulse: 'kanun', melody: 'violin', counter: 'clarinet' },
    kit: 'darbuka',
    pulse: [0, 2, 1, 3, 2, 1],
    counterOctave: -1,
    drums: { base: 'D.TD.T', full: 'DkTDkT' },
    cells: CELLS_6,
    cadences: CAD_6,
    reverb: 0.42,
    brightness: 0.65,
    level: 0.85,
  },
  // The Gematria Forge: a hammering D phrygian-dominant groove in 4/4, taiko on the anvil beat,
  // oud and cello under a lead of bells. It starts low and slow, then the fire catches.
  forge: {
    id: 'forge',
    nameKey: 'sound.theme.forge',
    seed: 5173,
    bpm: 104,
    beats: 4,
    sub: 2,
    root: 62,
    mode: 'freygish',
    swing: 0,
    form: ['A', 'B', 'A', 'C'],
    sections: {
      A: { bars: 8, chords: [0, 0, 1, 0, 0, 0, 6, 1], register: 1, density: 0.5 },
      B: { bars: 8, chords: [3, 3, 0, 0, 6, 6, 1, 0], register: 2, density: 0.65 },
      C: { bars: 8, chords: [0, 1, 0, 1, 3, 6, 1, 0], register: 3, density: 0.8 },
    },
    voices: { drone: 'pad', pulse: 'oud', melody: 'bell', counter: 'cello' },
    kit: 'taiko',
    pulse: [0, 2, 1, 2, 0, 3, 1, 2],
    counterOctave: -1,
    drums: { base: 'D..D..D.', full: 'DkTDkTDS' },
    cells: CELLS_8,
    cadences: CAD_8,
    reverb: 0.3,
    brightness: 0.6,
    level: 0.85,
  },
  // The Night Shuk: a swinging, chattering G minor groove in 4/4, kanun and clarinet over a frame
  // drum, with a bell for every coin. Busy and warm, like merchants talking over each other.
  shuk: {
    id: 'shuk',
    nameKey: 'sound.theme.shuk',
    seed: 6029,
    bpm: 118,
    beats: 4,
    sub: 2,
    root: 67,
    mode: 'minor',
    swing: 0.18,
    form: ['A', 'A', 'B', 'A', 'C'],
    sections: {
      A: { bars: 8, chords: [0, 0, 3, 3, 0, 0, 4, 0], register: 1, density: 0.6 },
      B: { bars: 8, chords: [3, 3, 0, 0, 4, 4, 0, 0], register: 2, density: 0.75 },
      C: { bars: 8, chords: [0, 4, 3, 4, 0, 3, 4, 0], register: 3, density: 0.5 },
    },
    voices: { drone: 'pad', pulse: 'oud', melody: 'kanun', counter: 'clarinet' },
    kit: 'frame',
    pulse: [0, 2, 1, 2, 0, 3, 1, 2],
    counterOctave: 1,
    drums: { base: 'D.kTD.kT', full: 'DkTkDkTS' },
    cells: CELLS_8,
    cadences: CAD_8,
    reverb: 0.3,
    brightness: 0.62,
    level: 0.85,
  },
  // The Jaffa Line: a driving D dorian groove in 4/4, a chugging kanun like pistons under a bright
  // harp melody and clarinet, brushes on the snare. It climbs in register as the line climbs to the hills.
  rail: {
    id: 'rail',
    nameKey: 'sound.theme.rail',
    seed: 7011,
    bpm: 132,
    beats: 4,
    sub: 2,
    root: 62,
    mode: 'dorian',
    swing: 0.06,
    form: ['A', 'A', 'B', 'A', 'C'],
    sections: {
      A: { bars: 8, chords: [0, 0, 3, 3, 0, 0, 4, 0], register: 1, density: 0.55 },
      B: { bars: 8, chords: [3, 3, 0, 0, 4, 4, 0, 0], register: 2, density: 0.7 },
      C: { bars: 8, chords: [0, 4, 3, 4, 0, 3, 4, 0], register: 4, density: 0.8 },
    },
    voices: { drone: 'pad', pulse: 'kanun', melody: 'harp', counter: 'clarinet' },
    kit: 'brush',
    pulse: [0, 2, 1, 2, 0, 2, 3, 2],
    counterOctave: 0,
    drums: { base: 'D.kTD.kT', full: 'DkTkDkTS' },
    cells: CELLS_8,
    cadences: CAD_8,
    reverb: 0.26,
    brightness: 0.7,
    level: 0.85,
  },
  // The Sunken Geniza: a slow, swaying A minor in 6/8, like water moving in a hall. A harp pulse
  // rolls like the tide under a singing cello, a soft flute above it, a quiet frame drum, and a
  // deep hall reverb.
  geniza: {
    id: 'geniza',
    nameKey: 'sound.theme.geniza',
    seed: 8123,
    bpm: 72,
    beats: 2,
    sub: 3,
    root: 57,
    mode: 'minor',
    swing: 0,
    form: ['A', 'A', 'B', 'A', 'C'],
    sections: {
      A: { bars: 8, chords: [0, 0, 5, 5, 3, 3, 4, 0], register: 1, density: 0.4 },
      B: { bars: 8, chords: [5, 5, 3, 3, 0, 0, 4, 4], register: 2, density: 0.5 },
      C: { bars: 8, chords: [3, 4, 5, 4, 3, 0, 4, 0], register: 3, density: 0.55 },
    },
    voices: { drone: 'pad', pulse: 'harp', melody: 'cello', counter: 'flute' },
    kit: 'frame',
    pulse: [0, 2, 3, 1, 2, 3],
    counterOctave: -1,
    drums: { base: 'D.....', full: 'D..T.S' },
    cells: CELLS_6,
    cadences: CAD_6,
    reverb: 0.5,
    brightness: 0.55,
    level: 0.88,
  },
  // Wings over Hermon: E minor in a soaring 3/4, like great wings beating. A horn calls over a
  // rolling kanun (the rain), strings hold the counter-line, and taiko drums roll like thunder.
  // It climbs as the storm breaks and the eagle rises toward the summit.
  hermon: {
    id: 'hermon',
    nameKey: 'sound.theme.hermon',
    seed: 9417,
    bpm: 100,
    beats: 3,
    sub: 2,
    root: 64,
    mode: 'minor',
    swing: 0,
    form: ['A', 'A', 'B', 'A', 'C'],
    sections: {
      A: { bars: 8, chords: [0, 0, 5, 5, 3, 3, 4, 4], register: 1, density: 0.45 },
      B: { bars: 8, chords: [5, 5, 6, 6, 0, 0, 4, 4], register: 2, density: 0.55 },
      C: { bars: 8, chords: [3, 4, 5, 6, 5, 3, 4, 0], register: 4, density: 0.65 },
    },
    voices: { drone: 'strings', pulse: 'kanun', melody: 'horn', counter: 'strings' },
    kit: 'taiko',
    pulse: [0, 2, 1, 3, 2, 1],
    counterOctave: -1,
    drums: { base: 'D...T.', full: 'D.kTDk' },
    cells: CELLS_6,
    cadences: CAD_6,
    reverb: 0.42,
    brightness: 0.6,
    level: 0.85,
  }, // The Star Station: slow and weightless, A dorian at 66 bpm. A glass harmonica sings the
  // stars over a harp that twinkles in steady eighths, a soft pad hangs underneath and a cello
  // walks below; only a frame drum, far away. It opens up as the stars come back.
  station: {
    id: 'station',
    nameKey: 'sound.theme.station',
    seed: 6610,
    bpm: 66,
    beats: 3,
    sub: 2,
    root: 69,
    mode: 'dorian',
    swing: 0,
    form: ['A', 'A', 'B', 'A', 'C'],
    sections: {
      A: { bars: 8, chords: [0, 0, 3, 3, 5, 5, 4, 4], register: 2, density: 0.35 },
      B: { bars: 8, chords: [3, 3, 0, 0, 6, 6, 4, 4], register: 3, density: 0.45 },
      C: { bars: 8, chords: [5, 3, 0, 4, 5, 3, 4, 0], register: 4, density: 0.5 },
    },
    voices: { drone: 'pad', pulse: 'harp', melody: 'glass', counter: 'cello' },
    kit: 'frame',
    pulse: [0, 2, 3, 1, 3, 2],
    counterOctave: -1,
    drums: { base: 'D.....', full: 'D..k.T' },
    cells: CELLS_6,
    cadences: CAD_6,
    reverb: 0.6,
    brightness: 0.55,
    level: 0.85,
  },

  // Atbash City: rain on neon, C sharp minor at 92 bpm in a straight, ticking 4/4. A synth pluck
  // spins arpeggios like a code-breaking machine, a bell carries the tune over it (the signs
  // flickering back on), a cello walks underneath, and brushes tick like the rain on the awnings.
  atbash: {
    id: 'atbash',
    nameKey: 'sound.theme.atbash',
    seed: 2323,
    bpm: 92,
    beats: 4,
    sub: 2,
    root: 61,
    mode: 'minor',
    swing: 0.08,
    form: ['A', 'A', 'B', 'A', 'C'],
    sections: {
      A: { bars: 8, chords: [0, 0, 5, 5, 3, 3, 4, 4], register: 1, density: 0.45 },
      B: { bars: 8, chords: [5, 5, 6, 6, 3, 3, 4, 4], register: 2, density: 0.55 },
      C: { bars: 8, chords: [0, 6, 5, 4, 3, 5, 4, 0], register: 3, density: 0.6 },
    },
    voices: { drone: 'pad', pulse: 'pluck', melody: 'bell', counter: 'cello' },
    kit: 'brush',
    pulse: [0, 2, 1, 3, 0, 2, 3, 1],
    counterOctave: -1,
    drums: { base: 'D.k.T.k.', full: 'D.kTDkTk' },
    cells: CELLS_8,
    cadences: CAD_8,
    reverb: 0.4,
    brightness: 0.65,
    level: 0.85,
  },

  // Boss: C freygish at full drive, taiko and cello ostinato. Four phases: each climbs, and the
  // fourth (the mirror) turns the tune over.
  boss: {
    id: 'boss',
    nameKey: 'sound.theme.boss',
    seed: 6661,
    bpm: 138,
    beats: 4,
    sub: 4,
    root: 60,
    mode: 'freygish',
    swing: 0,
    form: ['P1'],
    sections: {
      P1: { bars: 8, chords: [0, 0, 1, 0, 0, 0, 6, 1], register: 2, density: 0.5 },
      P2: {
        bars: 8,
        chords: [3, 3, 0, 0, 6, 6, 1, 1],
        register: 4,
        density: 0.7,
        drums: { base: 'full', full: 'storm' },
      },
      P3: {
        bars: 8,
        chords: [0, 1, 0, 1, 3, 6, 1, 0],
        register: 5,
        density: 0.85,
        transpose: 1,
        drums: { base: 'storm', full: 'storm' },
      },
      // The mirror (T16): the tune turned over, a minor third up, the drums thinned to a heartbeat
      // that fills back in with the streak.
      P4: {
        bars: 8,
        chords: [1, 0, 6, 0, 1, 3, 1, 0],
        register: 3,
        density: 0.6,
        transpose: 3,
        drums: { base: 'base', full: 'storm' },
      },
    },
    phases: { phase1: ['P1'], phase2: ['P2'], phase3: ['P3'], phase4: ['P4'] },
    voices: { drone: 'pad', pulse: 'cello', melody: 'strings', counter: 'bell' },
    kit: 'taiko',
    pulse: [0, 0, 3, 0, 0, 3, 0, 2, 0, 0, 3, 0, 1, 0, 2, 0],
    counterOctave: 1,
    drums: {
      base: 'D.......D...T...',
      full: 'D..kD...D.k.T..k',
      storm: 'D.kDD.k.D.kDT.TT',
    },
    cells: CELLS_16,
    cadences: CAD_16,
    reverb: 0.3,
    brightness: 0.6,
    level: 0.85,
  },
};

/** Grid steps in one bar. */
export function gridOf(t: ThemeSpec): number {
  return t.beats * t.sub;
}

/** Seconds in one bar. With sub 3 the beat is a dotted quarter (compound time). */
export function barSeconds(t: ThemeSpec): number {
  return (t.beats * 60) / t.bpm;
}

export function isThemeId(v: string): v is ThemeId {
  return (THEME_IDS as readonly string[]).includes(v);
}
