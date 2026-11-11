// Optional spoken story lines (T12): the device's own speech voices, one pitch and pace per
// character (CAST). Off by default (settings.storyVoices). Only voices that run on the device
// itself are used (`localService`), so nothing is ever sent over the network; when the device has
// none for the language, lines are simply not read. Captions are always on screen anyway.

import type { LayoutId } from '../core';
import { CAST, type Speaker } from '../story';

export class StoryVoice {
  private readonly synth: SpeechSynthesis | null;

  constructor(
    private readonly enabled: boolean,
    private readonly volume: number,
    win: Window = window,
  ) {
    this.synth = 'speechSynthesis' in win ? win.speechSynthesis : null;
  }

  /** Reads a line aloud in the speaker's voice (and stops whatever was being read). */
  say(who: Speaker, text: string, lang: LayoutId): void {
    this.stop();
    const v = CAST[who].voice;
    const synth = this.synth;
    if (!this.enabled || !synth || !v || this.volume <= 0 || !text) return;
    const want = lang === 'he' ? /^(he|iw)/i : /^en/i;
    const voice = synth.getVoices().find((x) => x.localService && want.test(x.lang));
    if (!voice) return;
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice;
    u.lang = voice.lang;
    u.pitch = v.pitch;
    u.rate = v.rate;
    u.volume = Math.max(0, Math.min(1, this.volume));
    synth.speak(u);
  }

  stop(): void {
    if (this.synth?.speaking || this.synth?.pending) this.synth.cancel();
  }
}
