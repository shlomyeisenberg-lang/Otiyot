// HintCoach: decides when a gentle tip is worth showing while the player types. It reads the
// core's own hint inference over the last few dozen keys and rate-limits it hard, so a tip is
// a rare, kind nudge and never a nag. Pure logic: time is passed in.

import { inferHints, type Finger, type TypedKey } from '../core';

export type CoachTip = { kind: 'wrong-finger'; finger: Finger } | { kind: 'home-row-drift' };

export interface CoachOptions {
  /** How many recent keys to look at. */
  window?: number;
  /** Quiet time after any tip (ms). */
  gapMs?: number;
  /** Quiet time before the same kind of tip may come back (ms). */
  repeatMs?: number;
  /** How sure the evidence must be (0..1). */
  minStrength?: number;
}

const FINGERS: readonly Finger[] = ['lp', 'lr', 'lm', 'li', 'ri', 'rm', 'rr', 'rp'];

export class HintCoach {
  private lastAny = -Infinity;
  private readonly lastKind = new Map<string, number>();
  private readonly window: number;
  private readonly gapMs: number;
  private readonly repeatMs: number;
  private readonly minStrength: number;

  constructor(opts: CoachOptions = {}) {
    this.window = opts.window ?? 40;
    this.gapMs = opts.gapMs ?? 25_000;
    this.repeatMs = opts.repeatMs ?? 90_000;
    this.minStrength = opts.minStrength ?? 0.3;
  }

  /**
   * Call after a wrong key (tips only ever follow a mistake). Returns a tip to show, or null.
   * `keys` is the run so far; only its tail is read.
   */
  afterMistake(keys: readonly TypedKey[], now: number): CoachTip | null {
    if (now - this.lastAny < this.gapMs) return null;
    const recent = keys.slice(-this.window);
    for (const h of inferHints(recent)) {
      if (h.strength < this.minStrength) continue;
      let tip: CoachTip | null = null;
      if (h.kind === 'wrong-finger') {
        const finger = FINGERS.find((f) => f === h.subject);
        if (finger) tip = { kind: 'wrong-finger', finger };
      } else if (h.kind === 'home-row-drift') {
        tip = { kind: 'home-row-drift' };
      }
      if (!tip) continue;
      const id = tip.kind === 'wrong-finger' ? `wf:${tip.finger}` : tip.kind;
      if (now - (this.lastKind.get(id) ?? -Infinity) < this.repeatMs) continue;
      this.lastAny = now;
      this.lastKind.set(id, now);
      return tip;
    }
    return null;
  }
}
