// The story's data shapes (T12). Pure: no DOM, no Three.js. A cutscene is a list of beats played
// in order; each beat may move the camera (a named shot the scene knows how to frame), make the
// characters act, fire a scene cue (an effect, a walk, a sign going blank) and say one line.

import type { LayoutId } from '../core';

/** Who can speak. Every human in the story is a man (ARCHITECTURE section 8); Dyo is an ink drop. */
export const SPEAKERS = ['narrator', 'ezra', 'dyo', 'naftali', 'keeper', 'apprentice'] as const;
export type Speaker = (typeof SPEAKERS)[number];

/** A line in both languages. Hebrew is the world's first language; English is a full second one. */
export type Localized = Readonly<Record<LayoutId, string>>;

export interface Line {
  who: Speaker;
  text: Localized;
}

/** Character actions a beat can ask for (the engine's Animator actions). */
export type StoryAction = 'write' | 'hit' | 'stagger' | 'fall' | 'cheer';

export interface Beat {
  /** Unique within the cutscene; tests and the scene refer to beats by it. */
  id: string;
  /** A camera shot the scene frames for this beat (moves across the beat's `seconds`). */
  shot?: string;
  /** A scene cue: something the scene does when the beat starts ('sign-fades', 'dyo-pops'). */
  cue?: string;
  /** Actions for named actors ('ezra' -> 'write'). */
  act?: Readonly<Record<string, StoryAction>>;
  /** A spoken line. The beat waits for the player once the line is fully shown. */
  say?: Line;
  /**
   * How long the beat lasts at least, in seconds. A beat without a line moves on by itself after
   * this; a beat with a line waits for the player (but never less than this).
   */
  seconds: number;
}

export interface Cutscene {
  id: string;
  /** Shown on the screen and to screen readers while it plays. */
  title: Localized;
  beats: readonly Beat[];
}
