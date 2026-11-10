// Small kinematics and easing helpers (ARCHITECTURE: "small custom kinematics in
// src/engine/motion.ts"). Pure math: no DOM, no Three.js, nothing allocated per call.

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/**
 * Frame-rate independent approach: moves `current` toward `target` so that the remaining distance
 * falls by `1 - e^(-rate * dt)`. The same motion at 30 and 144 fps.
 */
export function damp(current: number, target: number, rate: number, dt: number): number {
  return target + (current - target) * Math.exp(-rate * dt);
}

/** Like `damp`, for angles in radians: always turns the short way round. */
export function dampAngle(current: number, target: number, rate: number, dt: number): number {
  let d = (target - current) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  else if (d < -Math.PI) d += Math.PI * 2;
  return current + d * (1 - Math.exp(-rate * dt));
}

/** A damped spring on one number (semi-implicit Euler: stable for the stiffness we use). */
export interface Spring {
  value: number;
  velocity: number;
  target: number;
  /** Stiffness (higher snaps faster). */
  stiffness: number;
  /** 1 is critically damped (no overshoot); below 1 bounces. */
  damping: number;
}

export function makeSpring(value = 0, stiffness = 120, damping = 1): Spring {
  return { value, velocity: 0, target: value, stiffness, damping };
}

export function stepSpring(s: Spring, dt: number): number {
  // Sub-step long frames so a hitch can never make the spring explode.
  const steps = dt > 1 / 50 ? Math.ceil(dt * 50) : 1;
  const h = dt / steps;
  const c = 2 * s.damping * Math.sqrt(s.stiffness);
  for (let i = 0; i < steps; i++) {
    const a = s.stiffness * (s.target - s.value) - c * s.velocity;
    s.velocity += a * h;
    s.value += s.velocity * h;
  }
  return s.value;
}

/** The design's easing, `cubic-bezier(.2,.8,.2,1)`, approximated: fast out, soft landing. */
export function easeOut(t: number): number {
  const u = 1 - clamp01(t);
  return 1 - u * u * u * u;
}

export function easeInOut(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/** Overshoots a little, then settles: for things that pop into being. */
export function easeOutBack(t: number): number {
  const x = clamp01(t) - 1;
  const k = 1.70158;
  return 1 + (k + 1) * x * x * x + k * x * x;
}

/** 0 → 1 → 0 over t in 0..1, peaking at `peak`. For one-shot pulses. */
export function pulse(t: number, peak = 0.2): number {
  if (t <= 0 || t >= 1) return 0;
  return t < peak ? easeOut(t / peak) : 1 - easeInOut((t - peak) / (1 - peak));
}

/** Seeded random numbers (mulberry32): scenes must look the same for the same seed. */
export class Rng {
  private s: number;

  constructor(seed = 1) {
    this.s = seed >>> 0 || 1;
  }

  /** 0 ≤ x < 1 */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(lo: number, hi: number): number {
    return lo + (hi - lo) * this.next();
  }

  /** -1 ≤ x < 1 */
  signed(): number {
    return this.next() * 2 - 1;
  }

  int(n: number): number {
    return Math.floor(this.next() * n);
  }

  pick<T>(items: readonly T[]): T {
    return items[this.int(items.length)] as T;
  }
}

/** Smooth 1D value noise in -1..1 (for camera shake and idle sway; no tables, no allocation). */
export function noise1(x: number, seed = 0): number {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(hash1(i + seed * 57.3), hash1(i + 1 + seed * 57.3), u);
}

function hash1(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
}

/** Height of a ballistic arc at time t (start height h0, upward speed v, gravity g > 0). */
export function ballistic(h0: number, v: number, g: number, t: number): number {
  return h0 + v * t - 0.5 * g * t * t;
}
