// Combo rules shared by every action scene. The streak climbs through five tiers (ink, techelet,
// silver, gold, light; COMBO_TIERS in typing.ts). Each tier raises power, the size of the effects
// and the music layers. An error breaks the streak softly: it falls back to the floor of a lower
// tier instead of to zero, and the ability Steady Hand can absorb errors outright. Pure logic.

import { COMBO_TIERS, comboTier } from './typing';

/** What the typing driver asks on every judged character (see DriverOptions.combo). */
export interface ComboPolicy {
  /** A correct letter brought the streak to `combo`. */
  onHit(combo: number): void;
  /** A wrong key at streak `combo`: returns the streak to keep. */
  onMiss(combo: number): number;
}

export interface ComboRulesOptions {
  /** Tiers lost on an error (0 = back to the floor of the current tier). Default 1. */
  errorTiers?: number;
  /** Errors Steady Hand absorbs per streak (0 = no ability). Refills at every new tier. */
  steadyHand?: number;
}

/** Hit strength per tier: how hard a letter lands and how much a broken shield is worth. */
export const TIER_POWER: readonly number[] = [1, 1.25, 1.5, 2, 3];
/** Visual strength per tier, 0..1 (sparks, flashes, shake). */
export const TIER_VFX: readonly number[] = [0.2, 0.4, 0.6, 0.8, 1];

export function tierPower(tier: number): number {
  return TIER_POWER[Math.max(0, Math.min(TIER_POWER.length - 1, tier))] as number;
}

export function tierVfx(tier: number): number {
  return TIER_VFX[Math.max(0, Math.min(TIER_VFX.length - 1, tier))] as number;
}

/** The streak left after losing `tiers` tiers from `combo`: the floor of the lower tier. */
export function dropTiers(combo: number, tiers: number): number {
  const t = Math.max(0, comboTier(combo) - Math.max(0, Math.floor(tiers)));
  return Math.min(combo, COMBO_TIERS[t] as number);
}

export class ComboRules implements ComboPolicy {
  errorTiers: number;
  steadyHand: number;
  /** Errors Steady Hand can still absorb in this streak. */
  charges: number;
  /** Errors absorbed in the whole run. */
  absorbed = 0;
  /** Told when Steady Hand absorbs an error (the scene shows a little shield). */
  onAbsorb: (() => void) | null = null;
  private tier = 0;

  constructor(o: ComboRulesOptions = {}) {
    this.errorTiers = o.errorTiers ?? 1;
    this.steadyHand = Math.max(0, Math.floor(o.steadyHand ?? 0));
    this.charges = this.steadyHand;
  }

  /**
   * Abilities (T33): Steady Hand charges per tier and Soft Fall (an error costs `softer` tiers
   * fewer, never below 0). Only raises what the difficulty gave.
   */
  grant(steadyHand: number, softer: number): void {
    if (steadyHand > this.steadyHand) {
      this.steadyHand = Math.floor(steadyHand);
      this.charges = this.steadyHand;
    }
    if (softer > 0) this.errorTiers = Math.max(0, this.errorTiers - Math.floor(softer));
  }

  onHit(combo: number): void {
    const t = comboTier(combo);
    if (t > this.tier) this.charges = this.steadyHand;
    this.tier = t;
  }

  onMiss(combo: number): number {
    if (this.charges > 0) {
      this.charges -= 1;
      this.absorbed += 1;
      this.onAbsorb?.();
      return combo;
    }
    const kept = dropTiers(combo, this.errorTiers);
    this.tier = comboTier(kept);
    return kept;
  }
}
