// The instruments, built from Web Audio oscillators, filters and noise. No audio files: every
// sound is made on the spot, so the game stays tiny and works offline.

import type { DrumHit } from './composer';
import type { Kit, Voice } from './themes';

const SILENT = 0.0001;

export class Synth {
  readonly noise: AudioBuffer;
  /** One shared vibrato source; voices tap it while they sound. */
  private readonly vibrato: OscillatorNode;

  constructor(readonly ctx: BaseAudioContext) {
    const len = Math.floor(ctx.sampleRate * 2);
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    let seed = 12345;
    for (let i = 0; i < len; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      data[i] = (seed / 0x7fffffff) * 2 - 1;
    }
    this.vibrato = ctx.createOscillator();
    this.vibrato.frequency.value = 5.3;
    this.vibrato.start();
  }

  dispose(): void {
    try {
      this.vibrato.stop();
    } catch {
      // Already stopped.
    }
  }

  /** A hall made of decaying noise, for the reverb. */
  impulse(seconds: number, decay: number): AudioBuffer {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let seed = 777 + ch * 31;
      let lp = 0;
      for (let i = 0; i < len; i++) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        const white = (seed / 0x7fffffff) * 2 - 1;
        const tt = i / len;
        // Later reflections are darker: a one-pole filter that closes over time.
        const k = 0.75 - 0.6 * tt;
        lp = lp + k * (white - lp);
        d[i] = lp * Math.pow(1 - tt, decay);
      }
    }
    return buf;
  }

  // ---- building blocks -------------------------------------------------------------------

  osc(type: OscillatorType, hz: number, t: number, end: number, detune = 0): OscillatorNode {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(hz, t);
    if (detune) o.detune.setValueAtTime(detune, t);
    o.start(t);
    o.stop(end + 0.05);
    return o;
  }

  noiseSrc(t: number, end: number, offset = 0): AudioBufferSourceNode {
    const n = this.ctx.createBufferSource();
    n.buffer = this.noise;
    n.loop = true;
    n.start(t, offset % 1.9);
    n.stop(end + 0.05);
    return n;
  }

  filter(type: BiquadFilterType, hz: number, q = 0.7): BiquadFilterNode {
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = hz;
    f.Q.value = q;
    return f;
  }

  /** A gain envelope: attack, then hold, then release (exponential tails). */
  env(t: number, peak: number, attack: number, hold: number, release: number): GainNode {
    const g = this.ctx.createGain();
    const p = Math.max(SILENT * 2, peak);
    g.gain.setValueAtTime(SILENT, t);
    g.gain.exponentialRampToValueAtTime(p, t + Math.max(0.002, attack));
    if (hold > 0) g.gain.setValueAtTime(p, t + attack + hold);
    g.gain.exponentialRampToValueAtTime(SILENT, t + attack + hold + Math.max(0.01, release));
    return g;
  }

  /** A struck/plucked envelope: instant attack, exponential decay. */
  decay(t: number, peak: number, seconds: number): GainNode {
    return this.env(t, peak, 0.003, 0, seconds);
  }

  private vib(o: OscillatorNode, cents: number, t: number, delay: number): void {
    const depth = this.ctx.createGain();
    depth.gain.setValueAtTime(0, t);
    depth.gain.linearRampToValueAtTime(cents, t + delay);
    this.vibrato.connect(depth);
    depth.connect(o.detune);
    o.addEventListener('ended', () => {
      try {
        this.vibrato.disconnect(depth);
      } catch {
        // Already gone.
      }
    });
  }

  // ---- pitched voices ------------------------------------------------------------------

  /** Plays one note on a voice. `dur` is the written length in seconds. */
  note(
    voice: Voice,
    dest: AudioNode,
    t: number,
    hz: number,
    dur: number,
    vel: number,
    bright: number,
  ): void {
    const ctx = this.ctx;
    switch (voice) {
      case 'pad': {
        const end = t + dur + 1.4;
        const f = this.filter('lowpass', 260 + bright * 700, 0.6);
        const g = this.env(t, 0.05 * vel, 0.7, Math.max(0, dur - 0.7), 1.4);
        for (const d of [-7, 7]) this.osc('sawtooth', hz, t, end, d).connect(f);
        const sub = this.osc('triangle', hz / 2, t, end);
        const sg = ctx.createGain();
        sg.gain.value = 0.8;
        sub.connect(sg).connect(f);
        f.connect(g).connect(dest);
        return;
      }
      case 'harp': {
        const len = Math.min(2.6, dur + 1.2);
        const end = t + len;
        const g = this.decay(t, 0.16 * vel, len);
        const f = this.filter('lowpass', 1800 + bright * 2400);
        f.frequency.setValueAtTime(3500 + bright * 3000, t);
        f.frequency.exponentialRampToValueAtTime(900 + bright * 600, t + 0.4);
        this.osc('triangle', hz, t, end).connect(f);
        const h2 = this.osc('sine', hz * 2, t, end);
        const hg = ctx.createGain();
        hg.gain.value = 0.25;
        h2.connect(hg).connect(f);
        f.connect(g).connect(dest);
        return;
      }
      case 'oud': {
        const len = Math.min(1.4, dur + 0.6);
        const end = t + len;
        const o = this.osc('sawtooth', hz, t, end, 18);
        o.detune.setTargetAtTime(0, t, 0.02);
        const f = this.filter('lowpass', 600, 2.5);
        f.frequency.setValueAtTime(2600 + bright * 1500, t);
        f.frequency.exponentialRampToValueAtTime(520, t + 0.28);
        const g = this.decay(t, 0.13 * vel, len);
        o.connect(f).connect(g).connect(dest);
        return;
      }
      case 'kanun': {
        const len = Math.min(1.2, dur + 0.5);
        const end = t + len;
        const f = this.filter('lowpass', 2200 + bright * 2000, 1.2);
        f.frequency.setValueAtTime(4800, t);
        f.frequency.exponentialRampToValueAtTime(1200, t + 0.2);
        this.osc('square', hz, t, end, -4).connect(f);
        this.osc('triangle', hz * 2, t, end, 4).connect(f);
        const g = this.decay(t, 0.07 * vel, len);
        f.connect(g).connect(dest);
        return;
      }
      case 'flute': {
        const end = t + dur + 0.2;
        const o = this.osc('sine', hz, t, end);
        this.vib(o, 14, t, Math.min(0.4, dur * 0.6));
        const o2 = this.osc('triangle', hz * 2, t, end);
        const g2 = ctx.createGain();
        g2.gain.value = 0.12;
        const g = this.env(t, 0.14 * vel, 0.05, Math.max(0, dur - 0.08), 0.16);
        o.connect(g);
        o2.connect(g2).connect(g);
        // A breath at the start of each note.
        const b = this.noiseSrc(t, t + 0.12, hz);
        const bf = this.filter('bandpass', Math.min(8000, hz * 3), 1.5);
        const bg = this.decay(t, 0.05 * vel, 0.1);
        b.connect(bf).connect(bg).connect(dest);
        g.connect(dest);
        return;
      }
      case 'clarinet': {
        const end = t + dur + 0.25;
        const o = this.osc('square', hz, t, end);
        this.vib(o, 10, t, Math.min(0.5, dur * 0.7));
        const f = this.filter('lowpass', Math.min(5000, hz * (3 + bright * 2)), 0.8);
        const g = this.env(t, 0.06 * vel, 0.06, Math.max(0, dur - 0.1), 0.22);
        o.connect(f).connect(g).connect(dest);
        return;
      }
      case 'violin': {
        const end = t + dur + 0.3;
        const o = this.osc('sawtooth', hz, t, end);
        this.vib(o, 16, t, Math.min(0.35, dur * 0.5));
        const f = this.filter('lowpass', Math.min(7000, hz * (4 + bright * 3)), 1);
        const body = this.filter('peaking', 2800, 1.2);
        body.gain.value = 4;
        const g = this.env(t, 0.06 * vel, 0.06, Math.max(0, dur - 0.1), 0.25);
        o.connect(f).connect(body).connect(g).connect(dest);
        return;
      }
      case 'strings': {
        const end = t + dur + 0.6;
        const f = this.filter('lowpass', 1200 + bright * 1800, 0.7);
        for (const d of [-9, 9]) {
          const o = this.osc('sawtooth', hz, t, end, d);
          this.vib(o, 8, t, 0.3);
          o.connect(f);
        }
        const g = this.env(t, 0.045 * vel, 0.14, Math.max(0, dur - 0.14), 0.5);
        f.connect(g).connect(dest);
        return;
      }
      case 'cello': {
        const short = dur < 0.3;
        const end = t + dur + (short ? 0.15 : 0.4);
        const o = this.osc('sawtooth', hz, t, end);
        const f = this.filter('lowpass', 500 + bright * 700, 1.4);
        f.frequency.setValueAtTime(1400 + bright * 800, t);
        f.frequency.exponentialRampToValueAtTime(500 + bright * 400, t + 0.12);
        const g = short
          ? this.decay(t, 0.1 * vel, dur + 0.15)
          : this.env(t, 0.08 * vel, 0.04, dur - 0.04, 0.35);
        o.connect(f).connect(g).connect(dest);
        return;
      }
      case 'bell': {
        const len = Math.min(3, dur + 2);
        const end = t + len;
        const partials: [number, number, number][] = [
          [1, 1, len],
          [2.76, 0.4, len * 0.5],
          [5.4, 0.18, len * 0.25],
        ];
        for (const [ratio, amp, d] of partials) {
          const o = this.osc('sine', hz * ratio, t, end);
          const g = this.decay(t, 0.09 * vel * amp, d);
          o.connect(g).connect(dest);
        }
        return;
      }
    }
  }

  // ---- drums ---------------------------------------------------------------------------

  drum(kit: Kit, hit: DrumHit, dest: AudioNode, t: number, vel: number): void {
    if (hit === 'D') {
      const f0 = kit === 'taiko' ? 52 : kit === 'frame' ? 68 : kit === 'brush' ? 78 : 92;
      const len = kit === 'taiko' ? 0.9 : kit === 'frame' ? 0.55 : 0.35;
      const peak = (kit === 'taiko' ? 0.75 : kit === 'brush' ? 0.3 : 0.55) * vel;
      const o = this.osc('sine', f0 * 2.4, t, t + len);
      o.frequency.exponentialRampToValueAtTime(f0, t + 0.06);
      const g = this.decay(t, peak, len);
      o.connect(g).connect(dest);
      const n = this.noiseSrc(t, t + 0.05, t * 7);
      const nf = this.filter('lowpass', kit === 'taiko' ? 600 : 1200);
      const ng = this.decay(t, 0.18 * vel, 0.04);
      n.connect(nf).connect(ng).connect(dest);
      return;
    }
    if (hit === 'S') {
      const len = kit === 'brush' ? 0.16 : 0.06;
      const n = this.noiseSrc(t, t + len, t * 13);
      const f = this.filter('highpass', kit === 'brush' ? 3500 : 6500);
      const g = this.env(t, 0.12 * vel, kit === 'brush' ? 0.03 : 0.004, 0, len);
      n.connect(f).connect(g).connect(dest);
      return;
    }
    // Tek (T) and ka (k): the bright rim strokes.
    const soft = hit === 'k' ? 0.45 : 1;
    const brush = kit === 'brush';
    const freq = kit === 'taiko' ? 1300 : kit === 'frame' ? 2100 : brush ? 2600 : 3400;
    const len = (brush ? 0.14 : 0.07) * (hit === 'k' ? 0.7 : 1);
    const n = this.noiseSrc(t, t + len, t * 11);
    const f = this.filter('bandpass', freq, brush ? 0.6 : 1.6);
    // Brushes swish in softly; the darbuka and drums snap.
    const g = brush
      ? this.env(t, 0.13 * vel * soft, 0.025, 0, len)
      : this.decay(t, 0.32 * vel * soft, len);
    n.connect(f).connect(g).connect(dest);
    if (kit !== 'brush') {
      const o = this.osc('triangle', kit === 'taiko' ? 700 : 950, t, t + 0.04);
      const og = this.decay(t, 0.12 * vel * soft, 0.03);
      o.connect(og).connect(dest);
    }
  }
}
