// TypingFeedback: what every key press feels like in 3D, so all scenes share one language.
//   correct key -> a gold ink stroke across the letter, a spray of ink and sparks, and a small
//                  impact that grows with the combo tier;
//   wrong key   -> a short stumble (tiny shake) and a desaturate flicker: the world loses its
//                  color for a blink and gets it back. Never blocks, never punishes;
//   word done   -> a full impact and a ring of gold;
//   new tier    -> (T34) one flourish every scene shares, bigger at every tier: a halo in the
//                  tier's material (ink, techelet, silver, gold, light) bursts from the last
//                  letter, a ring of light opens around it, the lens leans in, and from silver
//                  up the screen breathes the tier's color.
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

/** Silver and the white-gold of the top tier, the two tier materials the theme has no token for. */
const SILVER = 0xdfe6ee;
const LIGHT = 0xfff1c9;

/** The flourish for reaching `tier` (1..4): how big and how bright. Pure, so it is tested. */
export function tierFlourish(tier: number): {
  count: number;
  speed: number;
  ring: number;
  push: number;
  flash: number;
} {
  const t = Math.max(1, Math.min(4, Math.floor(tier)));
  return {
    count: 18 + t * 12,
    speed: 3 + t * 1.1,
    ring: 2 + t * 0.9,
    push: 0.12 + t * 0.07,
    flash: t >= 2 ? 0.08 + (t - 2) * 0.06 : 0,
  };
}
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
  /** One halo per tier (index 0 unused: nobody reaches tier 0). */
  private readonly halos: BurstStyle[];
  private readonly tierColors: readonly number[];
  private lastX = 0;
  private lastY = 1;
  private lastZ = 0;
  private lastSize = 1;

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
    this.tierColors = [colors.ink, colors.techelet, SILVER, colors.gold, LIGHT];
    this.halos = [0, 1, 2, 3, 4].map((tier) => {
      const f = tierFlourish(tier);
      const c = this.tierColors[tier] as number;
      return burstStyle({
        count: f.count,
        color: c,
        color2: tier >= 3 ? colors.techelet : c,
        intensity: 2 + tier * 0.4,
        speed: [f.speed * 0.5, f.speed],
        life: [0.6, 1.2 + tier * 0.1],
        size: [0.07, 0.15 + tier * 0.02],
        gravity: -0.6,
        radius: 0.25,
      });
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
    this.lastX = x;
    this.lastY = y;
    this.lastZ = z;
    this.lastSize = size;
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

  /**
   * The streak just reached a new combo `tier` (1..4): the same flourish in every scene, from the
   * last letter written (or from (x, y, z) when given). Reduce motion keeps the halo and drops
   * the lean and the screen tint (the engine scales both to zero).
   */
  tierUp(tier: number, x = this.lastX, y = this.lastY, z = this.lastZ): void {
    if (tier < 1) return;
    const t = Math.min(4, Math.floor(tier));
    const f = tierFlourish(t);
    const color = this.tierColors[t] as number;
    this.vfx.burst(this.halos[t] as BurstStyle, x, y + this.lastSize * 0.2, z, 0, 1, 0);
    this.vfx.shockwave(x, y - this.lastSize * 0.4, z, f.ring, color, 0.7, false, 1.2 + t * 0.2);
    this.rig.pushIn(f.push, 0.18 + t * 0.05);
    if (f.flash > 0) this.vfx.flash(color, f.flash, 0.3 + t * 0.05);
    this.post.pulseChroma(0.2 + 0.1 * t);
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
