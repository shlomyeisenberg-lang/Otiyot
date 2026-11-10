// TypingFeedback: what every key press feels like in 3D, so all scenes share one language.
//   correct key -> a gold ink stroke across the letter, a spray of ink and sparks, and a small
//                  impact that grows with the combo tier;
//   wrong key   -> a short stumble (tiny shake) and a desaturate flicker: the world loses its
//                  color for a blink and gets it back. Never blocks, never punishes;
//   word done   -> a full impact and a ring of gold.
// With reduce-motion on, shake, chroma and hit-stop are already off in the engine; the flicker
// becomes one soft, slow dip.

import {
  burstStyle,
  type BurstStyle,
  type Billboard,
  type CameraRig,
  type PostFx,
  type Trail,
  type VfxKit,
} from '../engine';

export interface FeedbackColors {
  gold: number;
  ink: number;
  techelet: number;
}

export interface FeedbackPorts {
  vfx: VfxKit;
  post: PostFx;
  rig: CameraRig;
}

const STROKES = 6;
const STROKE_TIME = 0.11;

interface Stroke {
  trail: Trail | null;
  t: number;
  x: number;
  y: number;
  z: number;
  size: number;
}

export class TypingFeedback {
  private readonly vfx: VfxKit;
  private readonly post: PostFx;
  private readonly rig: CameraRig;
  private readonly billboard: Billboard;
  private readonly strokes: Stroke[] = [];
  private next = 0;
  private drain = 0;
  private drainTime = 0;
  private readonly sparks: BurstStyle[];
  private readonly ink: BurstStyle;
  private readonly ring: BurstStyle;

  constructor(
    ports: FeedbackPorts,
    private readonly colors: FeedbackColors,
  ) {
    this.vfx = ports.vfx;
    this.post = ports.post;
    this.rig = ports.rig;
    this.billboard = ports.vfx.billboard;
    for (let i = 0; i < STROKES; i++) {
      this.strokes.push({ trail: null, t: 0, x: 0, y: 0, z: 0, size: 1 });
    }
    // One spark style per combo tier: more, brighter and bluer at the top.
    this.sparks = [0, 1, 2, 3, 4].map((tier) =>
      burstStyle({
        count: 8 + tier * 5,
        color: colors.gold,
        color2: tier >= 3 ? colors.techelet : colors.gold,
        intensity: 1.6 + tier * 0.35,
        speed: [1.2, 3 + tier * 0.6],
        life: [0.25, 0.6],
        size: [0.04, 0.11],
        gravity: 2.5,
        radius: 0.15,
      }),
    );
    this.ink = burstStyle({
      count: 6,
      color: colors.ink,
      speed: [0.6, 1.8],
      life: [0.35, 0.7],
      size: [0.05, 0.12],
      gravity: 7,
      radius: 0.1,
    });
    this.ring = burstStyle({
      count: 40,
      color: colors.gold,
      color2: colors.techelet,
      intensity: 2.2,
      speed: [2.5, 6],
      life: [0.5, 1.1],
      size: [0.06, 0.16],
      gravity: 1.5,
      radius: 0.3,
    });
  }

  /** A correct key: the letter at (x, y, z), `size` tall, was just written. `tier` 0..4. */
  correct(x: number, y: number, z: number, size: number, tier: number): void {
    const s = this.strokes[this.next] as Stroke;
    this.next = (this.next + 1) % STROKES;
    s.trail?.stop();
    s.trail = this.vfx.trail(this.colors.gold, 0.09 * size, 0.32, 1.8 + tier * 0.3);
    s.t = 0;
    s.x = x;
    s.y = y;
    s.z = z;
    s.size = size;
    this.emitStroke(s);
    this.vfx.burst(this.sparks[Math.min(4, Math.max(0, tier))] as BurstStyle, x, y, z, 0, 1, 0);
    this.vfx.burst(this.ink, x, y - size * 0.3, z, 0, -1, 0, true);
    // A small knock that grows with the combo; the big impact is saved for finished words.
    this.rig.shake(0.05 + 0.03 * tier);
    this.post.pulseChroma(0.1 + 0.06 * tier);
  }

  /** A wrong key: stumble and a blink of grey. Never blocks the player. */
  wrong(): void {
    this.rig.shake(0.1);
    this.drain = 1;
    this.drainTime = 0;
  }

  /** A finished word, centred at (x, y, z). `perfect` words ring brighter. */
  word(x: number, y: number, z: number, perfect: boolean): void {
    this.vfx.burst(this.ring, x, y, z, 0, 1, 0);
    this.vfx.shockwave(x, y, z, perfect ? 3.2 : 2.2, this.colors.gold, 0.6, false, 1.6);
    this.vfx.impact(perfect ? 0.5 : 0.3, this.colors.gold);
  }

  /** Once per drawn frame (real time). Allocates nothing. */
  frame(dt: number): void {
    for (const s of this.strokes) {
      if (!s.trail) continue;
      s.t += dt;
      this.emitStroke(s);
      if (s.t >= STROKE_TIME) {
        s.trail.stop();
        s.trail = null;
      }
    }
    if (this.drain > 0) {
      this.drainTime += dt;
      const calm = this.post.flashScale === 0;
      // Two quick blinks of grey, then color floods back; one slow dip with reduce-motion.
      const t = this.drainTime;
      let k: number;
      if (calm) k = 1 - 0.35 * Math.max(0, 1 - t / 0.5);
      else if (t < 0.06) k = 0.25;
      else if (t < 0.1) k = 0.8;
      else if (t < 0.15) k = 0.35;
      else k = Math.min(1, 0.35 + (t - 0.15) * 3.2);
      this.post.setSaturationScale(k);
      if (k >= 1) {
        this.drain = 0;
        this.post.setSaturationScale(1);
      }
    }
  }

  dispose(): void {
    for (const s of this.strokes) {
      s.trail?.stop();
      s.trail = null;
    }
    this.post.setSaturationScale(1);
  }

  /** The stroke runs from the lower start of the letter to its upper end, like a quill. */
  private emitStroke(s: Stroke): void {
    if (!s.trail) return;
    const k = Math.min(1, s.t / STROKE_TIME);
    const right = this.billboard.uRight.value;
    const up = this.billboard.uUp.value;
    const a = (k - 0.5) * 0.95 * s.size;
    const b = (k - 0.5) * 0.35 * s.size + Math.sin(k * Math.PI) * 0.08 * s.size;
    s.trail.emit(
      s.x + right.x * a + up.x * b,
      s.y + right.y * a + up.y * b,
      s.z + right.z * a + up.z * b,
    );
  }
}
