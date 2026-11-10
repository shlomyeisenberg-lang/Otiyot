// TypingSession: expected text in, judged TypedKey out. Pure logic, no DOM, no clock:
// the caller passes a monotonic `now` (ms) with every call, so sessions are deterministic.

import {
  KEYS,
  type Finger,
  type KeyRef,
  type LayoutId,
  charForKey,
  isMark,
  keyForChar,
  stripNiqqud,
  toGraphemes,
} from './layouts';

/** What the learner may do about mistakes. Errors never block in 'allowed' / 'disabled'. */
export type BackspacePolicy = 'allowed' | 'disabled' | 'mustFix';
export type NiqqudMode = 'ignore' | 'required';
export type SessionStatus = 'idle' | 'running' | 'finished' | 'failed';

export interface KeyInput {
  /** KeyboardEvent.code (physical key). */
  code: string;
  /** KeyboardEvent.key (what the OS produced). */
  key: string;
  shift: boolean;
}

export interface SessionOptions {
  layout: LayoutId;
  backspace?: BackspacePolicy;
  /** Hardcore: the first mistake ends the session as 'failed'. Implies no backspace. */
  hardcore?: boolean;
  niqqud?: NiqqudMode;
}

export interface TypedKey {
  /** Index of the grapheme being judged. */
  index: number;
  /** Expected character without niqqud (or the expected mark, when kind is 'mark'). */
  expected: string;
  /** The character the learner meant to type (translated by physical key if needed). */
  typed: string;
  correct: boolean;
  kind: 'char' | 'mark';
  /** Physical key the learner pressed, and the one that was expected (null if untypeable). */
  pressed: KeyRef;
  expectedKey: KeyRef | null;
  finger: Finger | null;
  expectedFinger: Finger | null;
  /** Correct character but pressed with a different finger-column than expected. */
  wrongKey: boolean;
  /** ms since the previous accepted key; null for the first key of the session. */
  ms: number | null;
  /** Session time in ms at which this key was pressed (relative to the first key). */
  at: number;
}

const BASE_MARK_RE = /[֑-ׇ]/g;

/**
 * Translate a key event into the character the learner meant, whatever language the operating
 * system keyboard is set to. If the OS is on English while learning Hebrew (or the reverse), the
 * physical key decides.
 */
export function resolveTypedChar(
  input: KeyInput,
  expected: string,
  layout: LayoutId,
  detectedOs: LayoutId | null,
): { char: string | null; detected: LayoutId | null } {
  let detected = detectedOs;
  if (input.code === 'Space' || input.key === ' ') return { char: ' ', detected };
  const key = input.key;
  if (!key || [...key].length !== 1) return { char: null, detected };
  if (!input.shift) {
    if (/[א-ת]/.test(key)) detected = 'he';
    else if (/[a-zA-Z]/.test(key)) detected = 'en';
  }
  if (key === expected || isMark(key)) return { char: key, detected };
  const he = charForKey('he', input.code, input.shift);
  const en = charForKey('en', input.code, input.shift);
  const expectLatin = /[a-zA-Z]/.test(expected);
  const expectHeb = /[א-ת]/.test(expected);
  const wantHe = expectHeb || (!expectLatin && layout === 'he');
  if (wantHe && detected !== 'he' && he !== undefined) return { char: he, detected };
  if (!wantHe && detected !== 'en' && en !== undefined) return { char: en, detected };
  return { char: key, detected };
}

export class TypingSession {
  readonly graphemes: readonly string[];
  readonly layout: LayoutId;
  readonly backspacePolicy: BackspacePolicy;
  readonly hardcore: boolean;
  readonly niqqudMode: NiqqudMode;

  /** Every judged key, in order (backspaced keys stay: stats are honest). */
  readonly keys: TypedKey[] = [];

  pos = 0;
  status: SessionStatus = 'idle';
  /** True while an uncorrected mistake blocks typing (backspace policy 'mustFix'). */
  mustFix = false;

  private readonly errorAt = new Set<number>();
  private pendingMarks: string[] | null = null;
  private startAt = 0;
  private lastAt = 0;
  private endAt = 0;
  private detectedOs: LayoutId | null = null;

  constructor(text: string, opts: SessionOptions) {
    this.layout = opts.layout;
    this.hardcore = opts.hardcore === true;
    this.backspacePolicy = this.hardcore ? 'disabled' : (opts.backspace ?? 'allowed');
    this.niqqudMode = opts.niqqud ?? 'ignore';
    this.graphemes = toGraphemes(text);
  }

  get length(): number {
    return this.graphemes.length;
  }

  get done(): boolean {
    return this.status === 'finished' || this.status === 'failed';
  }

  /** Positions that are currently wrong (cleared when fixed with backspace). */
  get errorPositions(): ReadonlySet<number> {
    return this.errorAt;
  }

  /** Ms from the first key to `now` (or to the last key once the session is over). */
  elapsed(now: number): number {
    if (this.status === 'idle') return 0;
    return Math.max(0, (this.done ? this.endAt : now) - this.startAt);
  }

  /**
   * Judge one key press. Returns the judged key, or null when the press was ignored
   * (session over, blocked by mustFix, a stray modifier/niqqud mark, or text exhausted).
   */
  press(input: KeyInput, now: number): TypedKey | null {
    if (this.done || this.pos >= this.graphemes.length) return null;
    if (this.mustFix) return null;
    if (input.code.startsWith('Shift') || input.code.startsWith('Control')) return null;

    const grapheme = this.graphemes[this.pos] ?? '';
    const base = stripNiqqud(grapheme);
    const marks = grapheme.match(BASE_MARK_RE) ?? [];
    const requireMarks = this.niqqudMode === 'required' && marks.length > 0;

    const resolved = resolveTypedChar(
      input,
      this.pendingMarks && this.pendingMarks[0] ? this.pendingMarks[0] : base,
      this.layout,
      this.detectedOs,
    );
    this.detectedOs = resolved.detected;
    const typed = resolved.char;
    if (typed === null) return null;

    // Niqqud typed when it is not required is ignored.
    if (isMark(typed) && !(requireMarks && this.pendingMarks)) return null;

    // Inside a letter whose niqqud is still pending.
    if (this.pendingMarks) {
      if (isMark(typed)) {
        // Marks may be typed in any order.
        const at = this.pendingMarks.indexOf(typed);
        const ok = at >= 0;
        const want = ok ? typed : (this.pendingMarks[0] ?? '');
        const k = this.judge(input, want, typed, ok, 'mark', now);
        if (ok) this.pendingMarks.splice(at, 1);
        if (this.pendingMarks.length === 0) this.completeGrapheme(now, true);
        return k;
      }
      // A letter arrived while marks were still owed: the marks are missed (error), move on.
      this.errorAt.add(this.pos);
      this.pendingMarks = null;
      this.advance(now);
      if (this.pos >= this.graphemes.length)
        return this.judge(input, base, typed, false, 'char', now);
      return this.press(input, now);
    }

    const ok = typed === base;
    const k = this.judge(input, base, typed, ok, 'char', now);
    if (!ok) {
      this.errorAt.add(this.pos);
      if (this.hardcore) {
        this.status = 'failed';
        this.endAt = now;
        return k;
      }
      if (this.backspacePolicy === 'mustFix') this.mustFix = true;
    }
    if (ok && requireMarks) {
      this.pendingMarks = [...marks];
      return k;
    }
    this.advance(now);
    return k;
  }

  /** Step back one letter so a mistake can be fixed. Returns false when not allowed. */
  backspace(): boolean {
    if (this.done || this.backspacePolicy === 'disabled') return false;
    if (this.pos === 0) return false;
    this.pendingMarks = null;
    this.pos--;
    this.errorAt.delete(this.pos);
    this.mustFix = this.errorAt.has(this.pos - 1) && this.backspacePolicy === 'mustFix';
    if (this.status === 'finished') this.status = 'running';
    return true;
  }

  /** End the session early (time up, player left). */
  finish(now: number): void {
    if (this.done) return;
    this.status = 'finished';
    this.endAt = Math.max(now, this.lastAt);
  }

  private judge(
    input: KeyInput,
    expected: string,
    typed: string,
    correct: boolean,
    kind: 'char' | 'mark',
    now: number,
  ): TypedKey {
    if (this.status === 'idle') {
      this.status = 'running';
      this.startAt = now;
      this.lastAt = now;
    }
    const first = this.keys.length === 0;
    const ms = first ? null : now - this.lastAt;
    this.lastAt = now;
    const pressed: KeyRef = { code: input.code, shift: input.shift };
    const expectedKey = kind === 'char' ? keyForChar(expected, this.layout) : null;
    const finger = KEYS[input.code]?.finger ?? null;
    const expectedFinger = expectedKey ? (KEYS[expectedKey.code]?.finger ?? null) : null;
    const k: TypedKey = {
      index: this.pos,
      expected,
      typed,
      correct,
      kind,
      pressed,
      expectedKey,
      finger,
      expectedFinger,
      wrongKey: !correct && expectedKey !== null && expectedKey.code !== input.code,
      ms,
      at: now - this.startAt,
    };
    this.keys.push(k);
    return k;
  }

  private completeGrapheme(now: number, ok: boolean): void {
    this.pendingMarks = null;
    if (!ok) this.errorAt.add(this.pos);
    this.advance(now);
  }

  private advance(now: number): void {
    this.pos++;
    if (this.pos >= this.graphemes.length && !this.errorAt.has(this.pos - 1)) {
      this.status = 'finished';
      this.endAt = now;
    } else if (this.pos >= this.graphemes.length && this.backspacePolicy !== 'mustFix') {
      this.status = 'finished';
      this.endAt = now;
    }
  }
}
