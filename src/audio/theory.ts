// Music theory for the procedural score (pure: no Web Audio, no DOM). Modes, scale degrees,
// pitches, a small seeded random generator, and the pitch ladder that key clicks climb.

/** Semitone steps of each mode from its root. */
export const MODES = {
  /** Freygish (Ahava Rabbah / Phrygian dominant): the sound of a klezmer doina. */
  freygish: [0, 1, 4, 5, 7, 8, 10],
  /** Natural minor. */
  minor: [0, 2, 3, 5, 7, 8, 10],
  /** Dorian: minor with a bright sixth; warm and hopeful. */
  dorian: [0, 2, 3, 5, 7, 9, 10],
  /** Mi sheberach (Ukrainian Dorian): minor with a raised fourth; restless. */
  misheberach: [0, 2, 3, 6, 7, 9, 10],
} as const;

export type ModeName = keyof typeof MODES;

/**
 * Five notes of each mode for the key-click ladder: always a pentatonic shape, so any run of
 * clicks sounds like a melody and never clashes with the music underneath.
 */
export const LADDERS: Readonly<Record<ModeName, readonly number[]>> = {
  freygish: [0, 1, 4, 7, 8],
  minor: [0, 3, 5, 7, 10],
  dorian: [0, 2, 3, 7, 9],
  misheberach: [0, 3, 6, 7, 9],
};

/** MIDI note of a scale degree (0 = root; negative and >6 wrap into other octaves). */
export function degreeToMidi(root: number, mode: ModeName, degree: number): number {
  const steps = MODES[mode];
  const n = steps.length;
  const octave = Math.floor(degree / n);
  const idx = degree - octave * n;
  return root + octave * 12 + (steps[idx] as number);
}

export function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Ten rungs (two octaves) up, then back down, so a long streak rises and falls like a wave. */
export const LADDER_RUNGS = 10;

/** Rung 0..9 for a combo count: climbs one rung per correct key and turns at the top. */
export function ladderRung(combo: number): number {
  const c = Math.max(0, Math.floor(combo));
  const period = (LADDER_RUNGS - 1) * 2;
  const p = c % period;
  return p < LADDER_RUNGS ? p : period - p;
}

/** Semitones above the root for a combo count, on the mode's pentatonic ladder. */
export function ladderSemitones(mode: ModeName, combo: number): number {
  const ladder = LADDERS[mode];
  const rung = ladderRung(combo);
  const n = ladder.length;
  return Math.floor(rung / n) * 12 + (ladder[rung % n] as number);
}

/** Small, fast, seeded random numbers (mulberry32). Same seed, same music. */
export class Rand {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0 || 1;
  }
  next(): number {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(lo: number, hi: number): number {
    return lo + Math.floor(this.next() * (hi - lo + 1));
  }
  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)] as T;
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
}

/** Mixes numbers into one 32-bit seed. */
export function hashSeed(...parts: number[]): number {
  let h = 2166136261;
  for (const p of parts) {
    h ^= p | 0;
    h = Math.imul(h, 16777619);
    h ^= h >>> 13;
  }
  return h >>> 0;
}

/** A stable small number for a typed character, so each key has its own click. */
export function charSeed(ch: string): number {
  let h = 0;
  for (let i = 0; i < ch.length; i++) h = (h * 31 + ch.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Slider value 0..1 to gain: a squared curve, which sounds even to the ear. */
export function volumeToGain(v: number): number {
  if (!Number.isFinite(v) || v <= 0) return 0;
  const c = Math.min(1, v);
  return c * c;
}
