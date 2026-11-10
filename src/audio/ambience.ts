// Looping background sounds for places (wind, birds, water, fire, crickets, machine hum). Each one
// can stand at a point in the world (it then pans and fades with distance) or fill the room.

import type { Synth } from './synth';
import { Rand } from './theory';

export const AMBIENCE_IDS = ['wind', 'birds', 'water', 'fire', 'crickets', 'hum'] as const;
export type AmbienceId = (typeof AMBIENCE_IDS)[number];

export function isAmbienceId(v: string): v is AmbienceId {
  return (AMBIENCE_IDS as readonly string[]).includes(v);
}

/** What a scene holds on to: move the sound, or stop it. */
export interface AmbienceHandle {
  move(x: number, y: number, z: number): void;
  stop(): void;
}

export const NO_AMBIENCE: AmbienceHandle = { move() {}, stop() {} };

/** A running ambience. `tick` lets it sprinkle events (chirps, drips, crackles) ahead of time. */
export class AmbienceLoop implements AmbienceHandle {
  private readonly out: GainNode;
  private readonly sources: AudioScheduledSourceNode[] = [];
  private readonly rng: Rand;
  private nextEvent = 0;
  stopped = false;

  constructor(
    private readonly s: Synth,
    readonly id: AmbienceId,
    dest: AudioNode,
    readonly panner: PannerNode | null,
    seed: number,
  ) {
    const ctx = s.ctx;
    const t = ctx.currentTime;
    this.rng = new Rand(seed);
    this.out = ctx.createGain();
    this.out.gain.setValueAtTime(0.0001, t);
    this.out.gain.exponentialRampToValueAtTime(1, t + 1.5);
    if (panner) this.out.connect(panner).connect(dest);
    else this.out.connect(dest);
    this.nextEvent = t + 0.5;
    this.build(t);
  }

  private loopNoise(t: number): AudioBufferSourceNode {
    const n = this.s.ctx.createBufferSource();
    n.buffer = this.s.noise;
    n.loop = true;
    n.start(t, this.rng.next() * 1.5);
    this.sources.push(n);
    return n;
  }

  private lfo(hz: number, depth: number, param: AudioParam, t: number): void {
    const ctx = this.s.ctx;
    const o = ctx.createOscillator();
    o.frequency.value = hz;
    const g = ctx.createGain();
    g.gain.value = depth;
    o.connect(g).connect(param);
    o.start(t);
    this.sources.push(o);
  }

  private build(t: number): void {
    const s = this.s;
    const ctx = s.ctx;
    switch (this.id) {
      case 'wind': {
        const f = s.filter('bandpass', 500, 0.9);
        const g = ctx.createGain();
        g.gain.value = 0.11;
        this.loopNoise(t).connect(f).connect(g).connect(this.out);
        this.lfo(0.07, 260, f.frequency, t);
        this.lfo(0.11, 0.05, g.gain, t);
        return;
      }
      case 'water': {
        const f = s.filter('lowpass', 900, 0.5);
        const g = ctx.createGain();
        g.gain.value = 0.07;
        this.loopNoise(t).connect(f).connect(g).connect(this.out);
        this.lfo(0.3, 250, f.frequency, t);
        return;
      }
      case 'fire': {
        const f = s.filter('lowpass', 500, 0.6);
        const g = ctx.createGain();
        g.gain.value = 0.08;
        this.loopNoise(t).connect(f).connect(g).connect(this.out);
        this.lfo(0.9, 0.03, g.gain, t);
        return;
      }
      case 'hum': {
        for (const [hz, amp] of [
          [55, 0.05],
          [110.4, 0.03],
          [165.2, 0.012],
        ] as const) {
          const o = ctx.createOscillator();
          o.frequency.value = hz;
          const g = ctx.createGain();
          g.gain.value = amp;
          o.connect(g).connect(this.out);
          o.start(t);
          this.sources.push(o);
        }
        return;
      }
      case 'birds':
      case 'crickets':
        // Made only of events (see `tick`).
        return;
    }
  }

  /** Schedules this ambience's little events up to `until` (seconds of audio time). */
  tick(until: number): void {
    if (this.stopped) return;
    const s = this.s;
    const r = this.rng;
    while (this.nextEvent < until) {
      const t = this.nextEvent;
      switch (this.id) {
        case 'birds': {
          // A short phrase of two to five chirps.
          const base = 2300 + r.next() * 1800;
          const count = r.int(2, 5);
          for (let i = 0; i < count; i++) {
            const at = t + i * (0.09 + r.next() * 0.05);
            const o = s.osc('sine', base, at, at + 0.12);
            o.frequency.setValueAtTime(base * (0.9 + r.next() * 0.2), at);
            o.frequency.exponentialRampToValueAtTime(base * (1.2 + r.next() * 0.4), at + 0.06);
            o.connect(s.decay(at, 0.025 + r.next() * 0.02, 0.08)).connect(this.out);
          }
          this.nextEvent = t + 1.2 + r.next() * 4;
          break;
        }
        case 'water': {
          const hz = 900 + r.next() * 900;
          const o = s.osc('sine', hz, t, t + 0.12);
          o.frequency.exponentialRampToValueAtTime(hz * 0.55, t + 0.08);
          o.connect(s.decay(t, 0.03, 0.08)).connect(this.out);
          this.nextEvent = t + 0.4 + r.next() * 2.2;
          break;
        }
        case 'fire': {
          const n = s.noiseSrc(t, t + 0.03, r.next() * 1.8);
          n.connect(s.filter('highpass', 2500 + r.next() * 3000))
            .connect(s.decay(t, 0.05 + r.next() * 0.06, 0.02))
            .connect(this.out);
          this.nextEvent = t + 0.05 + r.next() * 0.5;
          break;
        }
        case 'crickets': {
          const hz = 4300 + r.next() * 400;
          for (let i = 0; i < 3; i++) {
            const at = t + i * 0.045;
            s.osc('sine', hz, at, at + 0.04)
              .connect(s.decay(at, 0.012, 0.03))
              .connect(this.out);
          }
          this.nextEvent = t + 0.5 + r.next() * 0.9;
          break;
        }
        default:
          this.nextEvent = until + 10;
      }
    }
  }

  move(x: number, y: number, z: number): void {
    const p = this.panner;
    if (!p) return;
    const t = this.s.ctx.currentTime;
    p.positionX.setTargetAtTime(x, t, 0.05);
    p.positionY.setTargetAtTime(y, t, 0.05);
    p.positionZ.setTargetAtTime(z, t, 0.05);
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    const t = this.s.ctx.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setValueAtTime(Math.max(0.0001, this.out.gain.value), t);
    this.out.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    for (const src of this.sources) {
      try {
        src.stop(t + 0.9);
      } catch {
        // Already stopped.
      }
    }
    setTimeout(() => {
      this.out.disconnect();
      this.panner?.disconnect();
    }, 1200);
  }
}
