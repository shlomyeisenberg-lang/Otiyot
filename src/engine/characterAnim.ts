// Character animation, as pure math: no Three.js, no DOM. A pose is a short list of joint
// angles and offsets; a clip is a function that fills a pose for a moment in time; the Animator
// blends clips smoothly and allocates nothing per frame. `character.ts` puts poses on a figure.

import { clamp01, damp, easeInOut, easeOut, lerp, smoothstep } from './motion';

/** Indexes into a pose. Angles are radians; offsets are in units of body height (~1.7). */
export const J = {
  rootY: 0,
  /** Whole body leaning forward (+) or back (-). */
  lean: 1,
  roll: 2,
  twist: 3,
  spine: 4,
  headPitch: 5,
  headYaw: 6,
  headRoll: 7,
  /** Arms: raise swings the arm forward and up; out lifts it sideways; bend closes the elbow. */
  lRaise: 8,
  lOut: 9,
  lBend: 10,
  rRaise: 11,
  rOut: 12,
  rBend: 13,
  /** Feet: forward/back and lift. */
  lFootZ: 14,
  lFootY: 15,
  rFootZ: 16,
  rFootY: 17,
  /** Scarf tail swing back (+). */
  scarf: 18,
  /** Squash (below 0) and stretch (above 0). */
  stretch: 19,
} as const;

export const POSE_SIZE = 20;
export type Pose = Float32Array;

export const ACTIONS = ['write', 'hit', 'stagger', 'fall', 'cheer'] as const;
export type ActionName = (typeof ACTIONS)[number];
export const CLIP_NAMES = ['idle', 'walk', 'run', ...ACTIONS] as const;
export type ClipName = (typeof CLIP_NAMES)[number];

/** Seconds each action lasts. `fall` ends lying down and holds until `getUp`. */
export const ACTION_SECONDS: Readonly<Record<ActionName, number>> = {
  write: 0.9,
  hit: 0.4,
  stagger: 1.0,
  fall: 1.1,
  cheer: 1.8,
};

const TAU = Math.PI * 2;

function rest(p: Pose): void {
  p.fill(0);
  p[J.lOut] = 0.14;
  p[J.rOut] = 0.14;
  p[J.lBend] = 0.22;
  p[J.rBend] = 0.22;
}

function idle(t: number, p: Pose): void {
  rest(p);
  const breath = Math.sin(t * 1.7);
  p[J.rootY] = breath * 0.008;
  p[J.spine] = 0.02 + breath * 0.018;
  p[J.stretch] = breath * 0.012;
  p[J.headYaw] = Math.sin(t * 0.45) * 0.16 + Math.sin(t * 1.13) * 0.04;
  p[J.headPitch] = Math.sin(t * 0.8 + 1) * 0.05;
  p[J.lRaise] = Math.sin(t * 1.7 + 0.6) * 0.04;
  p[J.rRaise] = Math.sin(t * 1.7 + 1.1) * 0.04;
  p[J.roll] = Math.sin(t * 0.6) * 0.012;
  p[J.scarf] = 0.05 + Math.sin(t * 1.2) * 0.05;
}

/** `ph` is the stride phase in radians (one full turn = two steps). */
function walk(ph: number, p: Pose): void {
  rest(p);
  const s = Math.sin(ph);
  const c = Math.cos(ph);
  p[J.lFootZ] = s * 0.2;
  p[J.rFootZ] = -s * 0.2;
  p[J.lFootY] = Math.max(0, c) * 0.07;
  p[J.rFootY] = Math.max(0, -c) * 0.07;
  p[J.rootY] = -Math.cos(ph * 2) * 0.018;
  p[J.lean] = 0.07;
  p[J.roll] = s * 0.035;
  p[J.twist] = s * 0.07;
  p[J.spine] = 0.03;
  p[J.lRaise] = -s * 0.5;
  p[J.rRaise] = s * 0.5;
  p[J.lBend] = 0.3 + Math.max(0, -s) * 0.25;
  p[J.rBend] = 0.3 + Math.max(0, s) * 0.25;
  p[J.headPitch] = -0.04;
  p[J.scarf] = 0.3 + Math.cos(ph * 2) * 0.08;
}

function run(ph: number, p: Pose): void {
  rest(p);
  const s = Math.sin(ph);
  const c = Math.cos(ph);
  p[J.lFootZ] = s * 0.36;
  p[J.rFootZ] = -s * 0.36;
  p[J.lFootY] = Math.max(0, c) * 0.2 + 0.02;
  p[J.rFootY] = Math.max(0, -c) * 0.2 + 0.02;
  p[J.rootY] = -Math.cos(ph * 2) * 0.05 + 0.02;
  p[J.lean] = 0.26;
  p[J.roll] = s * 0.05;
  p[J.twist] = s * 0.16;
  p[J.spine] = 0.08;
  p[J.lRaise] = -s * 1.0;
  p[J.rRaise] = s * 1.0;
  p[J.lBend] = 1.35;
  p[J.rBend] = 1.35;
  p[J.lOut] = 0.2;
  p[J.rOut] = 0.2;
  p[J.headPitch] = -0.16;
  p[J.scarf] = 0.95 + Math.cos(ph * 2) * 0.12;
  p[J.stretch] = -Math.cos(ph * 2) * 0.03;
}

/** The scribe's cast: wind up, sweep the quill through the air, let it settle. `u` is 0..1. */
function write(u: number, p: Pose): void {
  rest(p);
  const up = smoothstep(0, 0.22, u) * (1 - smoothstep(0.78, 1, u));
  const stroke = smoothstep(0.18, 0.7, u);
  p[J.rRaise] = up * (1.55 + Math.sin(stroke * Math.PI) * 0.5);
  p[J.rOut] = 0.14 + up * (0.55 - stroke * 1.0);
  p[J.rBend] = 0.22 + up * (0.9 - Math.sin(stroke * Math.PI) * 0.75);
  p[J.lRaise] = -up * 0.3;
  p[J.lOut] = 0.14 + up * 0.25;
  p[J.twist] = up * (0.3 - stroke * 0.55);
  p[J.lean] = up * 0.08;
  p[J.spine] = up * 0.06;
  p[J.headYaw] = up * (-0.25 + stroke * 0.4);
  p[J.headPitch] = -up * 0.12;
  p[J.rootY] = up * 0.02;
  p[J.stretch] = Math.sin(stroke * Math.PI) * up * 0.04;
  p[J.scarf] = up * 0.3;
}

/** A flinch: knocked back for a moment, then upright again. */
function hit(u: number, p: Pose): void {
  rest(p);
  const k = u < 0.18 ? easeOut(u / 0.18) : 1 - easeInOut((u - 0.18) / 0.82);
  p[J.lean] = -0.32 * k;
  p[J.spine] = -0.18 * k;
  p[J.headPitch] = -0.3 * k;
  p[J.rootY] = -0.04 * k;
  p[J.lRaise] = 0.5 * k;
  p[J.rRaise] = 0.5 * k;
  p[J.lOut] = 0.14 + 0.5 * k;
  p[J.rOut] = 0.14 + 0.5 * k;
  p[J.lFootZ] = -0.12 * k;
  p[J.stretch] = -0.06 * k;
  p[J.scarf] = -0.5 * k;
}

/** A stumble: thrown off balance, a few shuffling steps, arms out, recover. */
function stagger(u: number, p: Pose): void {
  rest(p);
  const k = u < 0.15 ? easeOut(u / 0.15) : 1 - easeInOut((u - 0.15) / 0.85);
  const wob = Math.sin(u * TAU * 2.5);
  p[J.lean] = -0.34 * k + wob * 0.08 * k;
  p[J.roll] = wob * 0.22 * k;
  p[J.twist] = Math.sin(u * TAU * 1.5) * 0.3 * k;
  p[J.spine] = -0.1 * k;
  p[J.headRoll] = -wob * 0.2 * k;
  p[J.headPitch] = -0.15 * k;
  p[J.lRaise] = (0.5 + wob * 0.5) * k;
  p[J.rRaise] = (0.5 - wob * 0.5) * k;
  p[J.lOut] = 0.14 + (0.9 + wob * 0.3) * k;
  p[J.rOut] = 0.14 + (0.9 - wob * 0.3) * k;
  p[J.lBend] = 0.22 + 0.4 * k;
  p[J.rBend] = 0.22 + 0.4 * k;
  p[J.lFootZ] = -wob * 0.18 * k;
  p[J.rFootZ] = wob * 0.18 * k;
  p[J.lFootY] = Math.max(0, wob) * 0.08 * k;
  p[J.rFootY] = Math.max(0, -wob) * 0.08 * k;
  p[J.rootY] = -0.03 * k;
  p[J.scarf] = -0.4 * k + wob * 0.3 * k;
}

/** Falls onto the back and stays down (u = 1 is lying still). */
function fall(u: number, p: Pose): void {
  rest(p);
  const drop = easeInOut(clamp01(u / 0.62));
  // A small bounce when the ground arrives.
  const b = u > 0.62 ? Math.sin(clamp01((u - 0.62) / 0.38) * Math.PI) * (1 - u) * 0.5 : 0;
  p[J.lean] = -1.5 * drop + b * 0.25;
  p[J.rootY] = -0.5 * drop + b * 0.2;
  p[J.spine] = -0.1 * drop;
  p[J.headPitch] = -0.25 * drop + b;
  p[J.lRaise] = 0.9 * drop * (1 - drop * 0.4);
  p[J.rRaise] = 0.9 * drop * (1 - drop * 0.4);
  p[J.lOut] = 0.14 + 1.1 * drop;
  p[J.rOut] = 0.14 + 1.1 * drop;
  p[J.lBend] = 0.22 + 0.3 * drop;
  p[J.rBend] = 0.22 + 0.3 * drop;
  p[J.lFootZ] = 0.1 * drop;
  p[J.rFootZ] = 0.16 * drop;
  p[J.lFootY] = 0.05 * drop;
  p[J.scarf] = -0.6 * drop;
}

/** Arms up, three happy hops. */
function cheer(u: number, p: Pose): void {
  rest(p);
  const k = smoothstep(0, 0.12, u) * (1 - smoothstep(0.85, 1, u));
  const hop = Math.abs(Math.sin(u * Math.PI * 3));
  const pump = Math.sin(u * TAU * 3);
  p[J.rootY] = hop * 0.2 * k;
  p[J.stretch] = (hop - 0.4) * 0.1 * k;
  p[J.lRaise] = (2.75 + pump * 0.18) * k;
  p[J.rRaise] = (2.75 - pump * 0.18) * k;
  p[J.lOut] = 0.14 + 0.38 * k;
  p[J.rOut] = 0.14 + 0.38 * k;
  p[J.lBend] = 0.22 + (0.25 + pump * 0.2) * k;
  p[J.rBend] = 0.22 + (0.25 - pump * 0.2) * k;
  p[J.headPitch] = -0.32 * k;
  p[J.headRoll] = pump * 0.08 * k;
  p[J.spine] = -0.08 * k;
  p[J.lFootY] = hop * 0.06 * k;
  p[J.rFootY] = hop * 0.06 * k;
  p[J.scarf] = (0.2 + hop * 0.6) * k;
}

const ACTION_CLIPS: Readonly<Record<ActionName, (u: number, p: Pose) => void>> = {
  write,
  hit,
  stagger,
  fall,
  cheer,
};

/** Fills `out` with one clip at time `t` (seconds for idle and actions; phase for walk/run). */
export function sampleClip(name: ClipName, t: number, out: Pose): void {
  if (name === 'idle') idle(t, out);
  else if (name === 'walk') walk(t, out);
  else if (name === 'run') run(t, out);
  else ACTION_CLIPS[name](clamp01(t / ACTION_SECONDS[name]), out);
}

const BLEND_IN = 0.12;
const BLEND_OUT = 0.22;

/** Blends idle / walk / run by speed and lays one action over them, always smoothly. */
export class Animator {
  /** The finished pose, refreshed by `update`. */
  readonly pose: Pose = new Float32Array(POSE_SIZE);
  /** Ground speed in units per second; the walk and run cycles follow it. */
  speed = 0;
  /** Locomotion weights after smoothing (they always add up to 1). */
  readonly weights = { idle: 1, walk: 0, run: 0 };
  action: ActionName | null = null;
  /** 0..1 progress through the current action. */
  actionProgress = 0;
  /** True while lying down after a fall. */
  down = false;

  private readonly a: Pose = new Float32Array(POSE_SIZE);
  private readonly b: Pose = new Float32Array(POSE_SIZE);
  private readonly from: Pose = new Float32Array(POSE_SIZE);
  private time = 0;
  private phase = 0;
  private smooth = 0;
  private actionTime = 0;
  private actionWeight = 0;
  private blendFrom = 0;
  private leaving = false;

  constructor(seedTime = 0) {
    this.time = seedTime;
    idle(this.time, this.pose);
  }

  /** Starts an action from wherever the body is now. */
  play(name: ActionName): void {
    this.from.set(this.pose);
    this.blendFrom = 1;
    this.action = name;
    this.actionTime = 0;
    this.actionProgress = 0;
    this.leaving = false;
    this.down = false;
  }

  /** Stands up after a fall (or cuts any action short). */
  getUp(): void {
    if (this.action) this.leaving = true;
    this.down = false;
  }

  update(dt: number): void {
    this.time += dt;
    this.smooth = damp(this.smooth, this.speed, 8, dt);
    const v = this.smooth;
    const wIdle = 1 - smoothstep(0.05, 0.7, v);
    const wRun = smoothstep(2.2, 4.4, v);
    const wWalk = Math.max(0, 1 - wIdle - wRun);
    this.weights.idle = wIdle;
    this.weights.walk = wWalk;
    this.weights.run = wRun;
    // Stride rate rises with speed so feet do not slide.
    this.phase += dt * TAU * lerp(1.5, 2.7, wRun) * (wIdle > 0.99 ? 0 : 1);

    const out = this.pose;
    idle(this.time, out);
    if (wWalk > 0.001) {
      walk(this.phase, this.a);
      for (let i = 0; i < POSE_SIZE; i++) {
        out[i] = (out[i] as number) * (1 - wWalk) + (this.a[i] as number) * wWalk;
      }
    }
    if (wRun > 0.001) {
      run(this.phase, this.a);
      const total = wIdle + wWalk + wRun;
      const w = wRun / total;
      for (let i = 0; i < POSE_SIZE; i++) {
        out[i] = (out[i] as number) * (1 - w) + (this.a[i] as number) * w;
      }
    }

    if (this.action) {
      const len = ACTION_SECONDS[this.action];
      const holds = this.action === 'fall';
      if (!this.leaving) {
        this.actionTime += dt;
        this.actionWeight = Math.min(1, this.actionWeight + dt / BLEND_IN);
        if (this.actionTime >= len) {
          this.actionTime = len;
          if (holds) this.down = true;
          else this.leaving = true;
        }
      } else {
        this.actionWeight -= dt / (holds ? 0.7 : BLEND_OUT);
      }
      this.actionProgress = this.actionTime / len;
      ACTION_CLIPS[this.action](this.actionProgress, this.b);
      // Start from the pose the body was in, so an interrupted action never snaps.
      if (this.blendFrom > 0) {
        this.blendFrom = Math.max(0, this.blendFrom - dt / BLEND_IN);
        const f = this.blendFrom;
        for (let i = 0; i < POSE_SIZE; i++) {
          this.b[i] = (this.b[i] as number) * (1 - f) + (this.from[i] as number) * f;
        }
      }
      if (this.actionWeight <= 0) {
        this.actionWeight = 0;
        this.action = null;
        this.leaving = false;
      } else {
        const w = this.blendFrom > 0 ? 1 : easeInOut(this.actionWeight);
        for (let i = 0; i < POSE_SIZE; i++) {
          out[i] = (out[i] as number) * (1 - w) + (this.b[i] as number) * w;
        }
      }
    }
  }
}
