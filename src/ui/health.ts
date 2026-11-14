// Health and key-binding logic for T36. Pure: no DOM, no clock (the shell feeds it time).

import type { Settings } from '../save';
import type { MessageKey } from './i18n';

/** Counts play time and says when a break reminder is due. Off when `minutes` is 0. */
export class BreakTimer {
  private elapsed = 0;
  private minutes: number;

  constructor(minutes: number) {
    this.minutes = minutes;
  }

  /** Changing the interval starts the count again, so a new choice never fires at once. */
  setMinutes(minutes: number): void {
    if (minutes === this.minutes) return;
    this.minutes = minutes;
    this.elapsed = 0;
  }

  /** Adds `seconds` of play; true once when a reminder is due (and the count restarts). */
  tick(seconds: number): boolean {
    if (this.minutes <= 0 || seconds <= 0) return false;
    this.elapsed += seconds;
    if (this.elapsed < this.minutes * 60) return false;
    this.elapsed = 0;
    return true;
  }

  reset(): void {
    this.elapsed = 0;
  }
}

/**
 * True when this key press should act as Escape (pause / back): the player's own menu key.
 * Escape itself needs no help, so it never counts here.
 */
export function actsAsEscape(code: string, menuKey: string): boolean {
  return menuKey !== 'Escape' && code === menuKey;
}

/** Captions are optional, except while story lines are read aloud: then they stay on. */
export function captionsOn(s: Pick<Settings, 'captions' | 'storyVoices'>): boolean {
  return s.captions || s.storyVoices;
}

/** Which two lines a reminder shows: the break, and (when asked for) a posture tip. */
export function reminderKeys(
  postureTips: boolean,
  count: number,
): { title: MessageKey; tip: MessageKey | null } {
  const tips: MessageKey[] = ['health.tip0', 'health.tip1', 'health.tip2'];
  return { title: 'health.break', tip: postureTips ? (tips[count % tips.length] ?? null) : null };
}
