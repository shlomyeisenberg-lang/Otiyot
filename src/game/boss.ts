// The boss kit (T16): multi-phase fights as data, and the pure state of one fight.
//
// A boss has 3–4 phases. Each phase changes the kind of text (single words → sentences → a
// punctuated passage → a sudden twist), the attack the boss throws while the player types, and
// its weak points. The text of every phase is planned ahead (by the scene's plan, from learned
// letters only), and the fight ends when the last phase's text is typed: the boss's health is
// the share of the text still unwritten, so a fight can always be finished and never soft-locks.
//
// Attacks come in groups: one group is a word, a sentence or a stretch of the passage. While the
// player types a group the boss winds up an attack (the telegraph); finishing the group first
// parries it. When the windup completes the attack lands: the streak drops by the difficulty's
// smudge tiers and the boss winds up again for what is left. On Calm nothing lands: the attack
// comes close and waits. A perfectly typed weak point staggers the boss and calms the windup.
// Only Sofer's Trial can fail (on the first error, judged by the typing driver).
//
// Between phases the fight pauses for a cinematic transition (hit-stop, push-in, palette shift,
// the next music section); on Calm, Steady and Swift a checkpoint is kept at each new phase.
// Pure logic: no DOM, no Three.js, no clock (the caller passes dt).

import type { Metrics } from '../core';
import type { Difficulty, DifficultyId } from './difficulty';

/** The kind of text a phase asks for. */
export type PhaseText = 'words' | 'sentences' | 'passage' | 'twist';
/** What the boss throws while a group is being typed (the scene draws it). */
export type AttackKind = 'spatter' | 'tendril' | 'flood' | 'mirror';

/** A phase, as data. */
export interface BossPhaseDef {
  /** 'p1'..'p4'; also the checkpoint and probe name. */
  id: string;
  text: PhaseText;
  attack: AttackKind;
  /** The music section this phase plays ('phase1'...). */
  music: string;
  /** Seconds of windup added to every attack on top of the typing time (more for long groups). */
  grace: number;
}

export interface BossDef {
  id: string;
  phases: readonly BossPhaseDef[];
}

/** One phase of a planned fight: its words, which group each word belongs to, its weak points. */
export interface PlannedPhase {
  def: BossPhaseDef;
  words: readonly string[];
  /** The attack group of each word (groups are 0, 1, 2... in order). */
  groups: readonly number[];
  /** Words that are weak points (typed perfectly, they stagger the boss). */
  weak: readonly boolean[];
  /** The whole text of the phase, as the typing driver gets it. */
  text: string;
}

export interface BossPlan {
  boss: string;
  phases: readonly PlannedPhase[];
}

/** The text of a list of words, as the typing driver reads it. */
export function joinWords(words: readonly string[]): string {
  return words.join(' ');
}

/** Characters of a phase's text (spaces between words included). */
export function phaseLength(p: PlannedPhase): number {
  return p.text.length;
}

/** How many attack groups a phase has. */
export function groupCount(p: PlannedPhase): number {
  return p.groups.length === 0 ? 0 : (p.groups[p.groups.length - 1] as number) + 1;
}

/** The words of group `g`, from and to (exclusive) as word indexes. */
export function groupSpan(p: PlannedPhase, g: number): [number, number] {
  let from = -1;
  let to = -1;
  for (let i = 0; i < p.groups.length; i++) {
    if (p.groups[i] === g) {
      if (from < 0) from = i;
      to = i + 1;
    }
  }
  return from < 0 ? [0, 0] : [from, to];
}

// ---- pace -----------------------------------------------------------------------------------

/**
 * The typing speed (WPM) each difficulty's attacks are timed for. Calm has no timers. These are
 * gentle: an attack lands only when the player stops or slows well below the pace.
 */
export const BOSS_PACE: Readonly<Record<DifficultyId, number | null>> = {
  calm: null,
  steady: 9,
  swift: 15,
  fierce: 22,
  trial: 16,
};

/** Seconds of windup for a group of `chars` characters on this difficulty (Infinity on Calm). */
export function windupSeconds(chars: number, difficulty: Difficulty, grace: number): number {
  const wpm = difficulty.timers ? BOSS_PACE[difficulty.id] : null;
  if (!wpm) return Infinity;
  return grace + (Math.max(1, chars) * 60) / (wpm * 5);
}

/** How close an attack on Calm comes before it stops and waits (0..1 of the windup). */
export const CALM_HOVER = 0.72;
/** Seconds a staggered boss holds its attack. */
export const STAGGER_SECONDS = 2.2;
/** After an attack lands, the next windup starts this far along (the boss recovers first). */
export const RECOVER_SECONDS = 1.1;
/** Difficulties that keep a checkpoint at each new phase. */
export const CHECKPOINT_DIFFICULTIES: readonly DifficultyId[] = ['calm', 'steady', 'swift'];

export function keepsCheckpoints(id: DifficultyId): boolean {
  return CHECKPOINT_DIFFICULTIES.includes(id);
}

/** The story flag a checkpoint is kept under: `boss:<id>:<phase index>` (1-based, 2..n). */
export function checkpointFlag(boss: string, phase: number): string {
  return `boss:${boss}:${phase + 1}`;
}

/** The phase to start from: the furthest checkpoint kept for this boss (0 when none). */
export function checkpointOf(
  flags: Readonly<Record<string, boolean>>,
  boss: string,
  phases: number,
): number {
  for (let i = phases - 1; i > 0; i--) if (flags[checkpointFlag(boss, i)]) return i;
  return 0;
}

/** Forgets every checkpoint of a boss (on victory, or when the player starts over). Mutates. */
export function clearCheckpoints(flags: Record<string, boolean>, boss: string): void {
  for (const k of Object.keys(flags)) if (k.startsWith(`boss:${boss}:`)) delete flags[k];
}

// ---- the fight ------------------------------------------------------------------------------

export type FightState = 'fight' | 'transition' | 'victory' | 'failed';

/** What happened in a step of the fight (the screen and the scene react). */
export type BossEvent =
  | { kind: 'none' }
  /** The attack landed on the scribe (the streak drops). */
  | { kind: 'land'; group: number }
  /** A group was finished before its attack landed. */
  | { kind: 'parry'; group: number; weak: boolean }
  /** A weak point was typed perfectly: the boss staggers. */
  | { kind: 'stagger'; group: number }
  /** The phase's text is all typed: a transition begins (or the fight is won). */
  | { kind: 'phase-end'; phase: number; last: boolean };

const NONE: BossEvent = { kind: 'none' };

export class BossFight {
  /** Index of the current phase. */
  phase: number;
  state: FightState = 'fight';
  /** Words finished in the current phase. */
  word = 0;
  /** The current attack group in this phase. */
  group = 0;
  /** Seconds the current attack has been winding up. */
  wind = 0;
  /** Seconds the boss is still staggered (its windup holds). */
  stagger = 0;
  /** Attacks that landed, and attacks parried, in the whole fight. */
  landed = 0;
  parried = 0;
  /** Weak points struck. */
  weakHits = 0;
  /** Correct characters typed in the current phase (spaces included). */
  private typed = 0;
  /** Characters of every phase before the current one, and of the whole fight. */
  private before = 0;
  private readonly total: number;
  private windFor = Infinity;

  constructor(
    readonly plan: BossPlan,
    readonly difficulty: Difficulty,
    startPhase = 0,
  ) {
    this.total = plan.phases.reduce((n, p) => n + phaseLength(p), 0);
    this.phase = Math.max(0, Math.min(plan.phases.length - 1, startPhase));
    for (let i = 0; i < this.phase; i++) this.before += phaseLength(plan.phases[i] as PlannedPhase);
    this.armGroup();
  }

  get current(): PlannedPhase {
    return this.plan.phases[this.phase] as PlannedPhase;
  }

  get def(): BossPhaseDef {
    return this.current.def;
  }

  get last(): boolean {
    return this.phase >= this.plan.phases.length - 1;
  }

  /** 1 = the boss is whole (nothing written yet), 0 = fully erased (the land restored). */
  get health(): number {
    if (this.total === 0 || this.state === 'victory') return 0;
    return Math.max(0, 1 - (this.before + this.typed) / this.total);
  }

  /** Where each phase begins on the health bar (0..1 of the text restored), for its notches. */
  get notches(): number[] {
    const out: number[] = [];
    let at = 0;
    for (let i = 0; i < this.plan.phases.length - 1; i++) {
      at += phaseLength(this.plan.phases[i] as PlannedPhase);
      out.push(this.total > 0 ? at / this.total : 0);
    }
    return out;
  }

  /** 0..1: how far the current attack has wound up (the telegraph). Calm stops at CALM_HOVER. */
  get windup(): number {
    if (this.state !== 'fight') return 0;
    if (!Number.isFinite(this.windFor)) {
      // No timers: the attack creeps in and waits close by, as Blots do on Calm.
      return CALM_HOVER * (1 - Math.exp(-this.wind / 2.2));
    }
    return Math.min(1, this.wind / this.windFor);
  }

  /** Is the word being typed now a weak point? */
  get weakNow(): boolean {
    return this.state === 'fight' && (this.current.weak[this.word] ?? false);
  }

  /** A correct character was typed (spaces count: they are part of the text). */
  letter(): void {
    if (this.state !== 'fight') return;
    this.typed = Math.min(phaseLength(this.current), this.typed + 1);
  }

  /** A word was finished. Returns what that meant for the attack and the phase. */
  wordDone(perfect: boolean): BossEvent {
    if (this.state !== 'fight') return NONE;
    const p = this.current;
    const i = this.word;
    this.word += 1;
    const weak = (p.weak[i] ?? false) && perfect;
    if (weak) {
      this.weakHits += 1;
      this.stagger = STAGGER_SECONDS;
      this.wind = Math.min(this.wind, this.windFor * 0.35);
    }
    if (this.word >= p.words.length) {
      // Every word typed: the phase is over, whatever the character count says.
      this.typed = phaseLength(p);
      this.parried += 1;
      this.state = this.last ? 'victory' : 'transition';
      return { kind: 'phase-end', phase: this.phase, last: this.last };
    }
    const g = p.groups[this.word] as number;
    if (g !== this.group) {
      const done = this.group;
      this.group = g;
      this.parried += 1;
      this.armGroup();
      return { kind: 'parry', group: done, weak };
    }
    return weak ? { kind: 'stagger', group: this.group } : NONE;
  }

  /** Advances the attack. Returns a 'land' event when it reaches the scribe. */
  update(dt: number): BossEvent {
    if (this.state !== 'fight') return NONE;
    if (this.stagger > 0) {
      this.stagger = Math.max(0, this.stagger - dt);
      return NONE;
    }
    this.wind += dt;
    if (this.wind < this.windFor) return NONE;
    // The attack lands. The boss recovers, then winds up again for what is left of the group.
    this.landed += 1;
    const g = this.group;
    this.windFor = this.windupFor(this.remainingInGroup()) + RECOVER_SECONDS;
    this.wind = 0;
    return { kind: 'land', group: g };
  }

  /** The transition is over: the next phase begins. */
  nextPhase(): void {
    if (this.state !== 'transition') return;
    this.before += phaseLength(this.current);
    this.typed = 0;
    this.phase += 1;
    this.word = 0;
    this.group = 0;
    this.stagger = 0;
    this.state = 'fight';
    this.armGroup();
  }

  /** Sofer's Trial ended the fight. */
  fail(): void {
    this.state = 'failed';
  }

  private armGroup(): void {
    this.wind = 0;
    this.windFor = this.windupFor(this.remainingInGroup());
  }

  private windupFor(chars: number): number {
    return windupSeconds(chars, this.difficulty, this.def.grace);
  }

  /** Characters still to type in the current group (its words and the spaces after them). */
  private remainingInGroup(): number {
    const p = this.current;
    let n = 0;
    for (let i = this.word; i < p.words.length && p.groups[i] === this.group; i++) {
      n += (p.words[i] as string).length + 1;
    }
    return n;
  }
}

// ---- results across phases ----------------------------------------------------------------

/**
 * One set of numbers for a fight typed in several runs of the driver (one per phase). Speeds are
 * worked out again from the totals, so a long phase weighs more than a short one.
 */
export function mergeMetrics(parts: readonly Metrics[]): Metrics {
  let keystrokes = 0;
  let correct = 0;
  let incorrect = 0;
  let elapsedMs = 0;
  let consistencySum = 0;
  let consistencyWeight = 0;
  for (const m of parts) {
    keystrokes += m.keystrokes;
    correct += m.correct;
    incorrect += m.incorrect;
    elapsedMs += m.elapsedMs;
    if (m.consistency !== null) {
      consistencySum += m.consistency * m.keystrokes;
      consistencyWeight += m.keystrokes;
    }
  }
  const minutes = elapsedMs / 60000;
  const grossWpm = minutes > 0 ? keystrokes / 5 / minutes : 0;
  const netWpm = minutes > 0 ? Math.max(0, grossWpm - incorrect / minutes) : 0;
  const accuracy = keystrokes > 0 ? Math.round((correct / keystrokes) * 1000) / 10 : 100;
  return {
    keystrokes,
    correct,
    incorrect,
    grossWpm,
    netWpm,
    accuracy,
    consistency: consistencyWeight > 0 ? consistencySum / consistencyWeight : null,
    elapsedMs,
  };
}
