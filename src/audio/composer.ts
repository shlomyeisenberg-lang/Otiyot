// The composer (pure): turns a theme into notes, one bar at a time, forever, without repeating
// itself exactly. Melodies are built in 4-bar phrases (statement, answer, statement, cadence) from
// seeded motifs, so a theme is recognisable; every pass through the form adds new ornaments, so
// ten minutes of it never sound like a loop. Also the layering rules (which stems play at which
// intensity) and the bar clock that makes every change land on a bar line.

import { degreeToMidi, hashSeed, Rand } from './theory';
import { gridOf, type Section, type StemId, type ThemeSpec } from './themes';

export type DrumHit = 'D' | 'T' | 'k' | 'S';

export interface NoteEvent {
  stem: StemId;
  /** Grid step from the bar start (may be fractional after swing is applied by the player). */
  step: number;
  /** Length in grid steps. */
  len: number;
  /** MIDI note (pitched stems). */
  midi: number;
  /** 0..1. */
  vel: number;
  /** Drum letter (perc stem only). */
  hit?: DrumHit;
}

export interface BarPlace {
  section: string;
  /** Bar inside the section. */
  bar: number;
  /** How many times the form has gone round (0 the first time). */
  cycle: number;
  /** How many sections have been played before this one (counts repeats too). */
  visit: number;
}

/** Where bar `n` of a form falls. */
export function placeBar(theme: ThemeSpec, form: readonly string[], n: number): BarPlace {
  let total = 0;
  for (const name of form) total += sectionOf(theme, name).bars;
  const cycle = Math.floor(n / total);
  let r = n - cycle * total;
  for (let i = 0; i < form.length; i++) {
    const name = form[i] as string;
    const len = sectionOf(theme, name).bars;
    if (r < len) return { section: name, bar: r, cycle, visit: cycle * form.length + i };
    r -= len;
  }
  return { section: form[0] as string, bar: 0, cycle, visit: cycle * form.length };
}

function sectionOf(theme: ThemeSpec, name: string): Section {
  const s = theme.sections[name];
  if (!s) throw new Error(`Theme ${theme.id} has no section ${name}`);
  return s;
}

/** Scale degree of the chord root in a given bar of a section. */
export function chordAt(section: Section, bar: number): number {
  return section.chords[bar % section.chords.length] as number;
}

const CHORD_TONES = [0, 2, 4, 7];

/** Nearest chord tone (in degrees) to `deg` for a chord rooted on degree `c`. */
function nearestChordTone(deg: number, c: number): number {
  let best = deg;
  let dist = Infinity;
  for (let o = -14; o <= 14; o += 7) {
    for (let i = 0; i < 3; i++) {
      const cand = c + (CHORD_TONES[i] as number) + o;
      const d = Math.abs(cand - deg);
      if (d < dist || (d === dist && cand > best)) {
        dist = d;
        best = cand;
      }
    }
  }
  return best;
}

function nearestOf(deg: number, targets: readonly number[]): number {
  let best = deg;
  let dist = Infinity;
  for (const t0 of targets) {
    for (let o = -14; o <= 14; o += 7) {
      const d = Math.abs(t0 + o - deg);
      if (d < dist) {
        dist = d;
        best = t0 + o;
      }
    }
  }
  return best;
}

interface MelNote {
  step: number;
  len: number;
  deg: number;
  vel: number;
}

type Role = 'statement' | 'answer' | 'cadence';

/** The last phrase of a section always comes home; before it, statements and answers alternate. */
function roleOf(phrase: number, phrases: number): Role {
  if (phrase >= phrases - 1) return 'cadence';
  return phrase % 2 === 1 ? 'answer' : 'statement';
}

function sectionCode(name: string): number {
  let h = 7;
  for (let i = 0; i < name.length; i++) h = h * 31 + name.charCodeAt(i);
  return h;
}

/**
 * The shape a phrase follows, as scale degrees above the section's register, for x in 0..1.
 * A statement rises to a peak and settles; an answer starts high, dips and leans on the
 * dominant; a cadence lifts once and comes down home to the tonic.
 */
function contour(role: Role, x: number, peak: number): number {
  if (role === 'statement')
    return x < 0.6 ? (x / 0.6) * peak : peak - ((x - 0.6) / 0.4) * (peak - 2);
  if (role === 'answer') return x < 0.5 ? peak - 1 - (x / 0.5) * (peak - 1) : ((x - 0.5) / 0.5) * 2;
  return x < 0.3 ? 2 + (x / 0.3) * (peak - 2) : peak - ((x - 0.3) / 0.7) * peak;
}

/** One 4-bar melodic phrase, bar by bar. */
export function composePhrase(
  theme: ThemeSpec,
  sectionName: string,
  phrase: number,
  visit: number,
): MelNote[][] {
  const section = sectionOf(theme, sectionName);
  const role = roleOf(phrase, Math.max(1, Math.floor(section.bars / 4)));
  const motif = role === 'statement' ? 0 : role === 'answer' ? 1 : 2;
  // The skeleton (rhythm and contour) depends only on the motif, so a statement always returns
  // the same; ornaments depend on the visit (every time a section is played counts), so it is
  // never note-for-note the same twice.
  const rng = new Rand(hashSeed(theme.seed, sectionCode(sectionName), motif));
  const orn = new Rand(hashSeed(theme.seed, sectionCode(sectionName), phrase, visit, 77));
  const grid = gridOf(theme);
  const busy = section.density;
  const reg = section.register;
  const peak = 4 + Math.round(busy * 3);
  const ornamentChance = visit === 0 ? 0.06 : Math.min(0.3, 0.1 + 0.04 * visit);

  // 1. Rhythm: one cell per bar (busy sections prefer cells with more notes), a cadence last.
  const cells: (readonly number[])[] = [];
  let onsets = 0;
  for (let b = 0; b < 4; b++) {
    let cell = b === 3 ? rng.pick(theme.cadences) : rng.pick(theme.cells);
    if (b < 3 && cell.length < 3 && rng.chance(busy)) cell = rng.pick(theme.cells);
    cells.push(cell);
    for (const d of cell) if (d > 0) onsets++;
  }

  // 2. Pitches: follow the contour by step (leaps only on strong beats), chord tones on the
  // strong beats, never the same note three times running.
  const bars: MelNote[][] = [];
  let k = 0;
  let prev = reg + Math.round(contour(role, 0, peak));
  let same = 0;
  for (let b = 0; b < 4; b++) {
    const chord = chordAt(section, phrase * 4 + b);
    const cell = cells[b] as readonly number[];
    const notes: MelNote[] = [];
    let step = 0;
    for (let i = 0; i < cell.length; i++) {
      const raw = cell[i] as number;
      const len = Math.abs(raw);
      if (raw < 0) {
        step += len;
        continue;
      }
      const x = onsets > 1 ? k / (onsets - 1) : 0;
      k++;
      const strong = step === 0 || step * 2 === grid;
      const target = reg + contour(role, x, peak) + (rng.next() - 0.5) * 1.6;
      const maxMove = strong ? 3 : 2;
      let deg = prev + Math.max(-maxMove, Math.min(maxMove, Math.round(target - prev)));
      if (strong) deg = nearestChordTone(deg, chord);
      if (deg === prev) {
        same++;
        if (same >= 2) {
          deg += target >= prev ? 1 : -1;
          same = 0;
        }
      } else {
        same = 0;
      }
      const finalNote = b === 3 && i === cell.length - 1;
      if (finalNote && role === 'cadence') deg = nearestOf(deg, [0]);
      else if (finalNote && role === 'answer') deg = nearestOf(deg, [4, 1]);
      const vel = step === 0 ? 0.95 : strong ? 0.8 : 0.62 + rng.next() * 0.12;
      if (len >= 2 && !finalNote && orn.chance(ornamentChance)) {
        // A krekhts-like grace: the neighbour above, then the note.
        notes.push({ step, len: 1, deg: deg + 1, vel: vel * 0.7 });
        notes.push({ step: step + 1, len: len - 1, deg, vel });
      } else {
        notes.push({ step, len, deg, vel });
      }
      prev = deg;
      step += len;
    }
    bars.push(notes);
  }
  return bars;
}

export interface ComposeOptions {
  /** Busier drums and doubled lines (the top intensity level). */
  full: boolean;
}

/**
 * Every note of one bar for every stem. The player decides which stems are heard; the composer
 * always writes all of them so a stem can come in mid-phrase in the right place.
 */
export class Composer {
  private cacheKey = '';
  private cache: MelNote[][] = [];

  constructor(readonly theme: ThemeSpec) {}

  bar(place: BarPlace, opts: ComposeOptions): NoteEvent[] {
    const theme = this.theme;
    const section = sectionOf(theme, place.section);
    const grid = gridOf(theme);
    const root = theme.root + (section.transpose ?? 0);
    const mode = theme.mode;
    const chord = chordAt(section, place.bar);
    const out: NoteEvent[] = [];
    const midi = (deg: number): number => degreeToMidi(root, mode, deg);

    // Drone: the tonic pedal and its fifth an octave down, and the chord root in the bass.
    out.push({ stem: 'drone', step: 0, len: grid, midi: midi(-7), vel: 0.55 });
    out.push({ stem: 'drone', step: 0, len: grid, midi: midi(-3), vel: 0.4 });
    out.push({ stem: 'drone', step: 0, len: grid, midi: midi(chord - 14), vel: 0.7 });

    // Pulse: the arpeggio of the bar's chord.
    const tones = [chord, chord + 2, chord + 4, chord + 7];
    for (let s = 0; s < grid; s++) {
      const idx = theme.pulse[s % theme.pulse.length] as number;
      if (idx < 0) continue;
      const accent = s === 0 ? 1 : s % theme.sub === 0 ? 0.8 : 0.6;
      out.push({
        stem: 'pulse',
        step: s,
        len: 1,
        midi: midi((tones[idx] as number) - 7),
        vel: accent,
      });
    }

    // Melody: the bar out of its phrase.
    const phrase = Math.floor(place.bar / 4);
    const key = `${place.section}:${phrase}:${place.visit}`;
    if (key !== this.cacheKey) {
      this.cache = composePhrase(theme, place.section, phrase, place.visit);
      this.cacheKey = key;
    }
    const mel = this.cache[place.bar % 4] ?? [];
    for (const n of mel) {
      out.push({ stem: 'melody', step: n.step, len: n.len, midi: midi(n.deg), vel: n.vel });
    }

    // Counter-melody: long chord tones that move by step, a third away from the harmony.
    const half = grid / 2;
    const oct = theme.counterOctave * 7;
    const next = chordAt(section, place.bar + 1);
    if (theme.counterOctave > 0) {
      // A high bell answers the melody: sparse, on the off half.
      out.push({ stem: 'counter', step: half, len: half, midi: midi(chord + 4 + oct), vel: 0.5 });
      if (opts.full) {
        out.push({ stem: 'counter', step: 0, len: half, midi: midi(chord + 2 + oct), vel: 0.4 });
      }
    } else {
      out.push({ stem: 'counter', step: 0, len: half, midi: midi(chord + 2 + oct), vel: 0.6 });
      // Second half leans into the next chord: its nearest tone, reached by the smallest step.
      const lead = nearestChordTone(chord + 2 === next + 2 ? chord + 4 : chord + 2, next);
      out.push({ stem: 'counter', step: half, len: half, midi: midi(lead + oct), vel: 0.55 });
    }

    // Percussion: the section's pattern; the full level adds a fill at the end of each phrase.
    const names = section.drums ?? { base: 'base', full: 'full' };
    let pattern = theme.drums[opts.full ? names.full : names.base] ?? '';
    if (opts.full && place.bar % 4 === 3) pattern = fill(pattern);
    for (let s = 0; s < grid && s < pattern.length; s++) {
      const ch = pattern[s];
      if (ch === 'D' || ch === 'T' || ch === 'k' || ch === 'S') {
        const vel = ch === 'k' ? 0.45 : ch === 'S' ? 0.35 : s === 0 ? 1 : 0.8;
        out.push({ stem: 'perc', step: s, len: 1, midi: 0, vel, hit: ch });
      }
    }
    return out;
  }
}

/** The last quarter of a bar rolls on teks: the classic darbuka turn into the next phrase. */
export function fill(pattern: string): string {
  const n = pattern.length;
  const from = Math.floor((n * 3) / 4);
  let out = pattern.slice(0, from);
  for (let i = from; i < n; i++) out += i === n - 1 ? 'D' : 'T';
  return out;
}

/** Intensity at which each stem comes in. The drone and pulse are always there. */
export const LAYER_AT: Readonly<Record<StemId, number>> = {
  drone: 0,
  pulse: 0,
  melody: 0.25,
  perc: 0.5,
  counter: 0.75,
};
/** At this intensity the drums get busier and the phrase ends get fills. */
export const FULL_AT = 1;

/** Target loudness of each stem (0..1) at an intensity 0..1. */
export function stemLevels(intensity: number): Record<StemId, number> {
  const i = Math.max(0, Math.min(1, intensity));
  return {
    drone: 1,
    pulse: i < LAYER_AT.melody ? 0.6 : 1,
    melody: i >= LAYER_AT.melody ? 1 : 0,
    perc: i >= LAYER_AT.perc ? 1 : 0,
    counter: i >= LAYER_AT.counter ? 1 : 0,
  };
}

/** The music intensity for a combo tier (0 ink .. 4 light). */
export function tierIntensity(tier: number): number {
  return Math.max(0, Math.min(4, Math.floor(tier))) / 4;
}

/**
 * Counts bars and holds requested changes until the next bar line, so stems, sections and
 * boss phases always change on the beat.
 */
export class BarClock {
  bar = 0;
  intensity = 0;
  form: readonly string[];
  private pendingIntensity: number | null = null;
  private pendingForm: readonly string[] | null = null;

  constructor(readonly theme: ThemeSpec) {
    this.form = theme.form;
  }

  requestIntensity(level: number): void {
    this.pendingIntensity = Math.max(0, Math.min(1, Number.isFinite(level) ? level : 0));
  }

  /** A boss phase ('phase1'...) or a section name of the theme. Unknown names are ignored. */
  requestSection(name: string): boolean {
    const phase = this.theme.phases?.[name];
    if (phase) {
      this.pendingForm = phase;
      return true;
    }
    if (this.theme.sections[name]) {
      this.pendingForm = [name];
      return true;
    }
    return false;
  }

  /** Called at each bar line: applies what was asked for and says where the bar falls. */
  nextBar(): BarPlace {
    if (this.pendingIntensity !== null) {
      this.intensity = this.pendingIntensity;
      this.pendingIntensity = null;
    }
    if (this.pendingForm) {
      this.form = this.pendingForm;
      this.pendingForm = null;
      this.bar = 0;
    }
    const place = placeBar(this.theme, this.form, this.bar);
    this.bar += 1;
    return place;
  }
}
