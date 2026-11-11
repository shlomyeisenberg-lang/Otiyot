// The cutscene player (T12): pure timing logic, unit-tested. It walks the beats of a cutscene,
// reveals each line letter by letter at the player's text speed (with small breaths after
// punctuation), waits for the player when a line is fully shown, and can be skipped at any time.
// The scene and the screen only listen to it: `beat` when a beat starts, `end` when it is over.

import type { LayoutId } from '../core';
import type { TextSpeed } from '../save/schema';
import type { Beat, Cutscene, Line } from './types';

export const TEXT_SPEEDS: readonly TextSpeed[] = ['slow', 'normal', 'fast', 'instant'];

/** Letters per second for each text speed. */
export const CHARS_PER_SECOND: Readonly<Record<TextSpeed, number>> = {
  slow: 18,
  normal: 38,
  fast: 85,
  instant: Infinity,
};

/** Extra pause after punctuation, counted in letters' worth of time. */
const BREATH: Readonly<Record<string, number>> = {
  ',': 3,
  '،': 3,
  ';': 4,
  ':': 4,
  '.': 7,
  '!': 7,
  '?': 7,
  '…': 9,
  '—': 5,
};

/** A press this soon after a line was shown in full is ignored (no accidental double skip). */
export const ADVANCE_GUARD = 0.18;

/**
 * Cumulative time cost (in letters) of each letter of `text`: entry i is the cost up to and
 * including letter i. Punctuation that is followed by a space (or ends the line) adds a breath.
 */
export function letterCosts(text: string): number[] {
  const chars = Array.from(text);
  const out: number[] = [];
  let total = 0;
  chars.forEach((ch, i) => {
    total += 1;
    const next = chars[i + 1];
    const pause = BREATH[ch];
    if (pause !== undefined && (next === undefined || next === ' ')) total += pause;
    out.push(total);
  });
  return out;
}

/** How many letters of a line are shown after `seconds` at `speed`. */
export function revealedCount(costs: readonly number[], seconds: number, speed: TextSpeed): number {
  const cps = CHARS_PER_SECOND[speed];
  if (!Number.isFinite(cps)) return costs.length;
  const budget = Math.max(0, seconds) * cps;
  // Costs only grow, so count from the start until one is over budget.
  let n = 0;
  while (n < costs.length && (costs[n] as number) <= budget) n++;
  return n;
}

export interface CutsceneListener {
  /** A beat starts (camera shot, cue, actions and line are the listener's to show). */
  beat?(beat: Beat, index: number): void;
  /** The cutscene is over: played to the end, or skipped. */
  end?(skipped: boolean): void;
}

export interface PlayerOptions {
  lang: LayoutId;
  speed: TextSpeed;
  listener?: CutsceneListener;
}

export type AdvanceResult = 'revealed' | 'next' | 'ignored';

export class CutscenePlayer {
  /** Index of the current beat (equals the beat count once it has ended). */
  index = -1;
  /** Seconds since the current beat began. */
  time = 0;
  /** True once ended (played out or skipped). */
  done = false;
  skipped = false;
  speed: TextSpeed;
  lang: LayoutId;
  listener: CutsceneListener;

  private costs: number[] = [];
  private chars: string[] = [];
  /** Time of the beat when its line was forced fully shown (-1: it was not). */
  private forcedAt = -1;

  constructor(
    readonly scene: Cutscene,
    o: PlayerOptions,
  ) {
    this.speed = o.speed;
    this.lang = o.lang;
    this.listener = o.listener ?? {};
  }

  get beat(): Beat | null {
    return this.scene.beats[this.index] ?? null;
  }

  get line(): Line | null {
    return this.beat?.say ?? null;
  }

  /** The current line's text in the player's language ('' between lines). */
  get text(): string {
    return this.line?.text[this.lang] ?? '';
  }

  /** Letters of the current line shown so far. */
  get shown(): number {
    if (!this.line) return 0;
    if (this.forcedAt >= 0) return this.costs.length;
    return revealedCount(this.costs, this.time, this.speed);
  }

  /** The visible part of the current line. */
  get shownText(): string {
    return this.chars.slice(0, this.shown).join('');
  }

  /** True when the whole line is on screen. */
  get lineDone(): boolean {
    return this.line !== null && this.shown >= this.costs.length;
  }

  /** True while a fully shown line waits for the player to continue. */
  get waiting(): boolean {
    return !this.done && this.lineDone;
  }

  /** 0..1 through the beat's own length (camera shots ease along it). */
  get progress(): number {
    const b = this.beat;
    if (!b) return this.done ? 1 : 0;
    return b.seconds <= 0 ? 1 : Math.min(1, this.time / b.seconds);
  }

  /** Begins the first beat. */
  start(): void {
    if (this.index >= 0) return;
    if (this.scene.beats.length === 0) {
      this.finish(false);
      return;
    }
    this.enter(0);
  }

  /** Advances time. Beats without a line move on by themselves. */
  update(dt: number): void {
    if (this.done || this.index < 0) return;
    this.time += dt;
    const b = this.beat;
    if (b && !b.say && this.time >= b.seconds) this.next();
  }

  /**
   * The player pressed continue: shows the rest of a line that is still appearing, or moves on
   * once it is all there. A beat without a line cannot be hurried (it is a camera move or an
   * effect), except by skipping the whole cutscene.
   */
  advance(): AdvanceResult {
    if (this.done || this.index < 0) return 'ignored';
    const b = this.beat;
    if (!b?.say) return 'ignored';
    if (!this.lineDone) {
      this.forcedAt = this.time;
      return 'revealed';
    }
    if (this.forcedAt >= 0 && this.time - this.forcedAt < ADVANCE_GUARD) return 'ignored';
    this.next();
    return 'next';
  }

  /** Ends the cutscene at once. */
  skip(): void {
    if (this.done) return;
    this.finish(true);
  }

  private next(): void {
    // Carry over the extra time, so a long frame does not stretch the next beat.
    const b = this.beat;
    const extra = b && !b.say ? Math.max(0, this.time - b.seconds) : 0;
    if (this.index + 1 >= this.scene.beats.length) {
      this.finish(false);
      return;
    }
    this.enter(this.index + 1);
    this.time = extra;
  }

  private enter(i: number): void {
    this.index = i;
    this.time = 0;
    this.forcedAt = -1;
    const say = this.scene.beats[i]?.say;
    const text = say ? say.text[this.lang] : '';
    this.chars = Array.from(text);
    this.costs = letterCosts(text);
    this.listener.beat?.(this.scene.beats[i] as Beat, i);
  }

  private finish(skipped: boolean): void {
    this.done = true;
    this.skipped = skipped;
    this.index = this.scene.beats.length;
    this.chars = [];
    this.costs = [];
    this.listener.end?.(skipped);
  }
}
