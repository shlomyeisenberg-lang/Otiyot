// TypingDriver: the bridge between the text a scene asks for and the typing core. It turns a
// TextSource into a stream of words, judges every key press with a TypingSession, and keeps
// what the HUD, the keyboard guide and the scene need: the letter states of the current word,
// the lookahead word, the next key to press (also right after a mistake), the combo, WPM and
// accuracy. Pure logic: no DOM, no Three.js, no clock (the caller passes `now` in ms).

import {
  KEYS,
  TypingSession,
  computeMetrics,
  keyForChar,
  rollingWpm,
  shiftKeyFor,
  stripNiqqud,
  toGraphemes,
  type BackspacePolicy,
  type Finger,
  type KeyInput,
  type LayoutId,
  type Metrics,
  type NiqqudMode,
  type TypedKey,
} from '../core';

/** Words to type. Same shape as the scene contract's TextSource (engine/scene.ts). */
export interface WordSource {
  next(): string;
}

/** How a letter of the current word looks: waiting, the one to type, right, fixed, or wrong. */
export type LetterState = 'todo' | 'next' | 'ok' | 'fixed' | 'err';

/** The key the finger guide shows. */
export interface GuideKey {
  /** KeyboardEvent.code of the key to press ('Backspace' when a mistake must be fixed first). */
  code: string;
  /** The Shift key to hold with it (always the other hand), or null. */
  shift: 'ShiftLeft' | 'ShiftRight' | null;
  finger: Finger;
  /** The character it should produce (' ' for space, '' for Backspace). */
  char: string;
  /** True when the guide asks for Backspace because the mistake must be fixed. */
  fix: boolean;
}

export interface WordResult {
  word: string;
  /** No mistake anywhere in the word (fixed mistakes still count as mistakes). */
  perfect: boolean;
  /** 0-based count of words finished in this run, including this one. */
  count: number;
}

export interface PressResult {
  /** The judged key, or null when the press was ignored. */
  key: TypedKey | null;
  /** Set when this press finished a word. */
  word: WordResult | null;
  /** True when the run ended with this press (a lesson finished, or hardcore failed). */
  ended: boolean;
}

export interface DriverOptions {
  layout: LayoutId;
  backspace?: BackspacePolicy;
  hardcore?: boolean;
  niqqud?: NiqqudMode;
  /**
   * 'endless' keeps asking the source for more words. 'once' takes one text from the source
   * (a whole lesson) and ends the run when its last word is typed.
   */
  mode?: 'endless' | 'once';
}

/** Combo thresholds: the meter changes material at each one (ink, techelet, silver, gold, light). */
export const COMBO_TIERS: readonly number[] = [0, 10, 25, 50, 100];

export function comboTier(combo: number): number {
  let t = 0;
  for (let i = 0; i < COMBO_TIERS.length; i++) if (combo >= (COMBO_TIERS[i] as number)) t = i;
  return t;
}

/** 0..1 progress from the current tier toward the next one (1 at the top tier). */
export function comboProgress(combo: number): number {
  const t = comboTier(combo);
  const lo = COMBO_TIERS[t] as number;
  const hi = COMBO_TIERS[t + 1];
  if (hi === undefined) return 1;
  return (combo - lo) / (hi - lo);
}

const WPM_WINDOW_MS = 15000;

export class TypingDriver {
  readonly layout: LayoutId;
  readonly mode: 'endless' | 'once';
  /** Every judged key of the run, `at` measured from the run's first key. */
  readonly keys: TypedKey[] = [];

  /** The word being typed (without the space that ends it). */
  word = '';
  /** The word after it, shown dimmed; '' when the lesson has no more. */
  lookahead = '';
  /** Letters of the word plus the trailing space, and how each one looks. */
  letters: string[] = [];
  states: LetterState[] = [];

  combo = 0;
  bestCombo = 0;
  wordsDone = 0;
  /** Words in the whole lesson ('once' mode), or 0 when endless. */
  totalWords = 0;
  ended = false;
  failed = false;

  private session: TypingSession;
  private readonly queue: string[] = [];
  private hadError: boolean[] = [];
  private startAt = -1;
  private lastAt = 0;
  private readonly opts: DriverOptions;

  constructor(
    private readonly source: WordSource,
    opts: DriverOptions,
  ) {
    this.opts = opts;
    this.layout = opts.layout;
    this.mode = opts.mode ?? 'endless';
    if (this.mode === 'once') {
      this.fill();
      this.totalWords = this.queue.length;
    }
    this.session = this.load();
  }

  /** The letter index the player is on inside `letters`. */
  get position(): number {
    return this.session.pos;
  }

  /** True while a mistake blocks typing until Backspace (backspace policy 'mustFix'). */
  get mustFix(): boolean {
    return this.session.mustFix;
  }

  /** 0..1 through the lesson ('once' mode); 0 when endless. */
  get progress(): number {
    return this.totalWords > 0 ? Math.min(1, this.wordsDone / this.totalWords) : 0;
  }

  get tier(): number {
    return comboTier(this.combo);
  }

  /** Judge one key press. Backspace is handled here too. */
  press(input: KeyInput, now: number): PressResult {
    if (this.ended) return { key: null, word: null, ended: false };
    if (input.code === 'Backspace') {
      const pos = this.session.pos;
      if (this.session.backspace()) {
        this.states[pos] = 'todo';
        const back = this.session.pos;
        if (back < pos) this.states[back] = 'next';
        this.markNext();
      }
      return { key: null, word: null, ended: false };
    }
    const k = this.session.press(input, now);
    if (!k) return { key: null, word: null, ended: false };
    if (this.startAt < 0) this.startAt = now;
    this.lastAt = now;
    const key: TypedKey = { ...k, at: now - this.startAt };
    this.keys.push(key);

    if (key.correct) {
      this.states[key.index] = this.hadError[key.index] ? 'fixed' : 'ok';
      if (key.kind === 'char') {
        this.combo += 1;
        if (this.combo > this.bestCombo) this.bestCombo = this.combo;
      }
    } else {
      this.states[key.index] = 'err';
      this.hadError[key.index] = true;
      this.combo = 0;
    }

    if (this.session.status === 'failed') {
      this.failed = true;
      this.ended = true;
      return { key, word: null, ended: true };
    }

    let word: WordResult | null = null;
    if (this.session.status === 'finished') {
      this.wordsDone += 1;
      word = {
        word: this.word,
        perfect: !this.hadError.some(Boolean),
        count: this.wordsDone,
      };
      if (this.mode === 'once' && this.queue.length === 0) {
        this.ended = true;
        return { key, word, ended: true };
      }
      this.session = this.load();
    } else {
      this.markNext();
    }
    return { key, word, ended: false };
  }

  /** The key the finger guide shows: the next letter, or Backspace when a fix is required. */
  guide(): GuideKey | null {
    if (this.ended) return null;
    if (this.session.mustFix) {
      return { code: 'Backspace', shift: null, finger: 'rp', char: '', fix: true };
    }
    const g = this.letters[this.session.pos];
    if (g === undefined) return null;
    const ch = stripNiqqud(g);
    const ref = keyForChar(ch, this.layout);
    if (!ref) return null;
    const finger = KEYS[ref.code]?.finger ?? 'th';
    return {
      code: ref.code,
      shift: ref.shift ? shiftKeyFor(ref.code) : null,
      finger,
      char: ch,
      fix: false,
    };
  }

  /** Words per minute over the last 15 seconds of typing. */
  wpm(now: number): number {
    if (this.startAt < 0) return 0;
    const at = (this.ended ? this.lastAt : now) - this.startAt;
    return rollingWpm(this.keys, at, WPM_WINDOW_MS);
  }

  /** 0-100 over the whole run (100 before the first key). */
  accuracy(): number {
    if (this.keys.length === 0) return 100;
    let ok = 0;
    for (const k of this.keys) if (k.correct) ok++;
    return Math.round((ok / this.keys.length) * 1000) / 10;
  }

  /** The run's full metrics (for the end-of-lesson card). */
  metrics(now: number): Metrics {
    const end = this.ended ? this.lastAt : now;
    return computeMetrics(this.keys, this.startAt < 0 ? 0 : end - this.startAt);
  }

  private fill(): void {
    // Endless sources give a word or a short line at a time; a lesson gives all of it at once.
    for (let tries = 0; tries < 8 && this.queue.length < 2; tries++) {
      const text = this.source.next().trim();
      for (const w of text.split(/\s+/)) if (w) this.queue.push(w);
      if (this.mode === 'once') break;
    }
  }

  private load(): TypingSession {
    if (this.mode === 'endless' && this.queue.length < 2) this.fill();
    this.word = this.queue.shift() ?? '';
    this.lookahead = this.queue[0] ?? '';
    // The space after a word is part of it: pressing it is what finishes the word. The last
    // word of a lesson has none.
    const last = this.mode === 'once' && this.queue.length === 0;
    const text = last ? this.word : `${this.word} `;
    const session = new TypingSession(text, {
      layout: this.layout,
      backspace: this.opts.backspace,
      hardcore: this.opts.hardcore,
      niqqud: this.opts.niqqud,
    });
    this.letters = toGraphemes(text);
    this.states = this.letters.map((): LetterState => 'todo');
    this.hadError = this.letters.map(() => false);
    this.session = session;
    this.markNext();
    return session;
  }

  private markNext(): void {
    const p = this.session.pos;
    for (let i = p + 1; i < this.states.length; i++) {
      if (this.states[i] === 'next') this.states[i] = 'todo';
    }
    if (p < this.states.length && this.states[p] === 'todo') this.states[p] = 'next';
  }
}
