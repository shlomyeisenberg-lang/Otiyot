// One-shot sounds: key clicks, errors, impacts, rewards and the menu sounds. All made in code.
// Key clicks are tuned to the music: their pitch climbs the theme's pentatonic ladder as the
// combo grows, so a good streak plays a melody on top of the score.

import type { Synth } from './synth';
import { charSeed, ladderSemitones, midiToHz, type ModeName } from './theory';

/** Sounds a scene or screen can ask for by name. */
export const SFX_NAMES = [
  'key',
  'space',
  'error',
  'word',
  'perfect',
  'restore',
  'tier',
  'impact',
  'impact-small',
  'shatter',
  'whoosh',
  'thunder',
  'thrust',
  'laser',
  'scan',
  'unlock',
  'gust',
  'camel-bell',
  'success',
  'ui-move',
  'ui-click',
  'ui-back',
  'ui-open',
  'ui-toggle',
  'ui-error',
] as const;
export type SfxName = (typeof SFX_NAMES)[number];

export function isSfxName(v: string): v is SfxName {
  return (SFX_NAMES as readonly string[]).includes(v);
}

/** The key the clicks are tuned to (follows the music theme playing). */
export interface Tuning {
  root: number;
  mode: ModeName;
}

export interface SfxArgs {
  /** For 'key' the combo, for 'tier' the tier; otherwise a scale step. */
  pitch: number;
  /** For 'key': the character typed (each key has its own click). */
  variant: string;
  /** Combo tier 0..4 (brighter clicks higher up). */
  tier: number;
}

export function playSfx(
  s: Synth,
  name: SfxName,
  dest: AudioNode,
  t: number,
  tuning: Tuning,
  a: SfxArgs,
): void {
  const ladder = (step: number, octave = 1): number =>
    midiToHz(tuning.root + 12 * octave + ladderSemitones(tuning.mode, step));
  switch (name) {
    case 'key': {
      // Wood and quill: a filtered tap whose colour is the key's own.
      const seed = charSeed(a.variant);
      const tapHz = 1700 + (seed % 13) * 120;
      const n = s.noiseSrc(t, t + 0.05, seed * 0.013);
      const f = s.filter('bandpass', tapHz, 2.5 + (seed % 5) * 0.6);
      const g = s.decay(t, 0.34 * (0.9 + (seed % 3) * 0.06), 0.035);
      n.connect(f).connect(g).connect(dest);
      const body = s.osc('triangle', 360 + (seed % 7) * 28, t, t + 0.07);
      const bg = s.decay(t, 0.1, 0.05);
      body.connect(bg).connect(dest);
      // The note on the ladder: louder and longer as the combo tier rises.
      const hz = ladder(a.pitch, 1);
      const tone = s.osc('sine', hz, t, t + 0.5);
      const tg = s.decay(t, 0.07 + a.tier * 0.022, 0.16 + a.tier * 0.06);
      tone.connect(tg).connect(dest);
      if (a.tier >= 2) {
        const sh = s.osc('sine', hz * 2.76, t, t + 0.3);
        const sg = s.decay(t, 0.012 * a.tier, 0.12 + a.tier * 0.03);
        sh.connect(sg).connect(dest);
      }
      return;
    }
    case 'space': {
      const n = s.noiseSrc(t, t + 0.08, 0.3);
      const f = s.filter('bandpass', 900, 1.6);
      const g = s.decay(t, 0.25, 0.06);
      n.connect(f).connect(g).connect(dest);
      const body = s.osc('triangle', 210, t, t + 0.1);
      body.connect(s.decay(t, 0.14, 0.08)).connect(dest);
      return;
    }
    case 'error': {
      // A low, muted knock: clear, brief and never harsh.
      const o = s.osc('sine', 150, t, t + 0.25);
      o.frequency.exponentialRampToValueAtTime(82, t + 0.09);
      o.connect(s.decay(t, 0.32, 0.18)).connect(dest);
      const n = s.noiseSrc(t, t + 0.08, 0.7);
      const f = s.filter('lowpass', 420, 0.8);
      n.connect(f)
        .connect(s.decay(t, 0.22, 0.06))
        .connect(dest);
      return;
    }
    case 'word':
    case 'perfect': {
      const steps = name === 'perfect' ? [0, 2, 4, 5] : [0, 2, 4];
      steps.forEach((st, i) => {
        s.note('bell', dest, t + i * 0.035, ladder(st + 5, 1), 0.3, 0.55, 0.6);
      });
      return;
    }
    case 'restore': {
      for (let i = 0; i < 6; i++) {
        s.note('bell', dest, t + i * 0.07, ladder(i + 2, 1), 0.4, 0.5 - i * 0.04, 0.7);
      }
      const n = s.noiseSrc(t, t + 0.9, 1.1);
      const f = s.filter('highpass', 5000, 0.7);
      f.frequency.setValueAtTime(3000, t);
      f.frequency.exponentialRampToValueAtTime(9000, t + 0.8);
      n.connect(f)
        .connect(s.env(t, 0.05, 0.4, 0, 0.5))
        .connect(dest);
      return;
    }
    case 'tier': {
      const base = Math.max(0, Math.min(4, Math.round(a.pitch))) * 2;
      for (let i = 0; i < 3; i++) {
        s.note('kanun', dest, t + i * 0.06, ladder(base + i * 2, 1), 0.3, 0.9, 0.9);
      }
      s.note('bell', dest, t + 0.18, ladder(base + 5, 1), 0.6, 0.5, 0.8);
      return;
    }
    case 'impact':
    case 'impact-small': {
      const big = name === 'impact';
      const o = s.osc('sine', big ? 110 : 160, t, t + 0.8);
      o.frequency.exponentialRampToValueAtTime(big ? 32 : 60, t + (big ? 0.4 : 0.2));
      o.connect(s.decay(t, big ? 0.6 : 0.35, big ? 0.6 : 0.3)).connect(dest);
      const n = s.noiseSrc(t, t + 0.3, 1.7);
      const f = s.filter('lowpass', big ? 900 : 1600, 0.7);
      n.connect(f)
        .connect(s.decay(t, big ? 0.3 : 0.18, big ? 0.25 : 0.12))
        .connect(dest);
      return;
    }
    case 'shatter': {
      for (let i = 0; i < 6; i++) {
        const hz = 2400 + ((i * 977) % 1900);
        const o = s.osc('sine', hz, t + i * 0.018, t + 0.4);
        o.frequency.exponentialRampToValueAtTime(hz * 0.8, t + 0.3);
        o.connect(s.decay(t + i * 0.018, 0.05, 0.22)).connect(dest);
      }
      const n = s.noiseSrc(t, t + 0.2, 0.9);
      n.connect(s.filter('highpass', 4000))
        .connect(s.decay(t, 0.12, 0.15))
        .connect(dest);
      return;
    }
    case 'whoosh': {
      const n = s.noiseSrc(t, t + 0.45, 0.2);
      const f = s.filter('bandpass', 400, 1.8);
      f.frequency.setValueAtTime(400, t);
      f.frequency.exponentialRampToValueAtTime(3200, t + 0.35);
      n.connect(f)
        .connect(s.env(t, 0.22, 0.15, 0, 0.25))
        .connect(dest);
      return;
    }
    case 'thrust': {
      // A thruster puff: a short breath of filtered noise that rises and falls.
      const n = s.noiseSrc(t, t + 0.35, 0.2);
      const f = s.filter('bandpass', 700, 0.8);
      f.frequency.setValueAtTime(500, t);
      f.frequency.exponentialRampToValueAtTime(1600, t + 0.12);
      f.frequency.exponentialRampToValueAtTime(400, t + 0.32);
      n.connect(f)
        .connect(s.env(t, 0.22, 0.03, 0.05, 0.22))
        .connect(dest);
      return;
    }
    case 'laser': {
      // The turret: a bright falling zap over a soft thump.
      const o = s.osc('square', 1900, t, t + 0.3);
      o.frequency.exponentialRampToValueAtTime(240, t + 0.25);
      o.connect(s.filter('lowpass', 3200, 1))
        .connect(s.decay(t, 0.09, 0.26))
        .connect(dest);
      const z = s.osc('sine', 3100, t, t + 0.18, 7);
      z.frequency.exponentialRampToValueAtTime(900, t + 0.16);
      z.connect(s.decay(t, 0.05, 0.16)).connect(dest);
      const low = s.osc('sine', 110, t, t + 0.25);
      low.frequency.exponentialRampToValueAtTime(55, t + 0.2);
      low.connect(s.decay(t, 0.18, 0.22)).connect(dest);
      return;
    }
    case 'scan': {
      // A patrol drone's searchlight sweeping: a thin rising whine with a slow wobble.
      const o = s.osc('triangle', 600, t, t + 0.9);
      o.frequency.exponentialRampToValueAtTime(1500, t + 0.7);
      const w = s.osc('sine', 7, t, t + 0.9);
      const wg = s.ctx.createGain();
      wg.gain.value = 40;
      w.connect(wg).connect(o.frequency);
      o.connect(s.filter('bandpass', 1100, 2))
        .connect(s.env(t, 0.09, 0.2, 0.4, 0.3))
        .connect(dest);
      return;
    }
    case 'unlock': {
      // A vault giving way: two heavy clunks of the bolts, then a bright little rising chime.
      for (const at of [t, t + 0.12]) {
        const n = s.noiseSrc(at, at + 0.08, 0.5);
        n.connect(s.filter('lowpass', 900, 1.5))
          .connect(s.decay(at, 0.3, 0.07))
          .connect(dest);
        const k = s.osc('sine', 140, at, at + 0.12);
        k.frequency.exponentialRampToValueAtTime(70, at + 0.1);
        k.connect(s.decay(at, 0.25, 0.1)).connect(dest);
      }
      let at = t + 0.26;
      for (const hz of [1046.5, 1318.5, 1568]) {
        s.osc('sine', hz, at, at + 0.5)
          .connect(s.decay(at, 0.07, 0.45))
          .connect(dest);
        at += 0.07;
      }
      return;
    }
    case 'gust': {
      // A gust of sand: a rushing swell of noise sweeping down from bright to dark.
      const n = s.noiseSrc(t, t + 1.1, 0.5);
      const f = s.filter('bandpass', 1800, 0.6);
      f.frequency.setValueAtTime(2400, t);
      f.frequency.exponentialRampToValueAtTime(380, t + 1);
      n.connect(f)
        .connect(s.env(t, 0.3, 0.35, 0.2, 0.5))
        .connect(dest);
      return;
    }
    case 'camel-bell': {
      // A brass camel bell: a clonk with a slightly out-of-tune second partial, ringing out.
      for (const [hz, v] of [
        [620, 0.12],
        [1013, 0.06],
        [1690, 0.03],
      ] as const) {
        s.osc('sine', hz, t, t + 1.2)
          .connect(s.decay(t, v, 1.1))
          .connect(dest);
      }
      const k = s.noiseSrc(t, t + 0.03, 0.4);
      k.connect(s.filter('bandpass', 2500, 2))
        .connect(s.decay(t, 0.06, 0.03))
        .connect(dest);
      return;
    }
    case 'thunder': {
      // A crack, then a long low roll that grumbles away.
      const crack = s.noiseSrc(t, t + 0.25, 0.4);
      crack
        .connect(s.filter('highpass', 1800))
        .connect(s.decay(t, 0.18, 0.2))
        .connect(dest);
      const roll = s.noiseSrc(t + 0.05, t + 2.6, 1.1);
      const f = s.filter('lowpass', 420, 0.9);
      f.frequency.setValueAtTime(420, t);
      f.frequency.exponentialRampToValueAtTime(90, t + 2.4);
      roll
        .connect(f)
        .connect(s.env(t + 0.05, 0.7, 0.08, 0.4, 2))
        .connect(dest);
      const low = s.osc('sine', 52, t + 0.05, t + 2);
      low.frequency.exponentialRampToValueAtTime(34, t + 1.6);
      low.connect(s.decay(t + 0.05, 0.35, 1.6)).connect(dest);
      return;
    }
    case 'success': {
      [0, 2, 4, 2, 5].forEach((st, i) => {
        s.note('harp', dest, t + i * 0.11, ladder(st, 1), 0.4, 0.9, 0.8);
      });
      s.note('bell', dest, t + 0.55, ladder(5, 1), 1, 0.6, 0.7);
      return;
    }
    case 'ui-move': {
      s.osc('sine', 1760, t, t + 0.05)
        .connect(s.decay(t, 0.035, 0.03))
        .connect(dest);
      return;
    }
    case 'ui-click':
    case 'ui-toggle': {
      const n = s.noiseSrc(t, t + 0.04, 0.5);
      n.connect(s.filter('bandpass', 2400, 2))
        .connect(s.decay(t, 0.14, 0.025))
        .connect(dest);
      const hz = name === 'ui-toggle' ? ladder(4, 1) : ladder(2, 1);
      s.osc('sine', hz, t, t + 0.2)
        .connect(s.decay(t, 0.06, 0.12))
        .connect(dest);
      return;
    }
    case 'ui-open': {
      s.note('harp', dest, t, ladder(2, 1), 0.2, 0.55, 0.7);
      s.note('harp', dest, t + 0.07, ladder(4, 1), 0.2, 0.55, 0.7);
      return;
    }
    case 'ui-back': {
      s.note('harp', dest, t, ladder(4, 1), 0.2, 0.5, 0.6);
      s.note('harp', dest, t + 0.07, ladder(2, 1), 0.2, 0.5, 0.6);
      return;
    }
    case 'ui-error': {
      for (const dt of [0, 0.1]) {
        const o = s.osc('sine', 140, t + dt, t + dt + 0.15);
        o.connect(s.decay(t + dt, 0.18, 0.1)).connect(dest);
      }
      return;
    }
  }
}
