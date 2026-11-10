// The pure-logic parts of the 3D engine kit (T08): the fixed-step clock, quality presets and the
// first-run benchmark, motion helpers, the character animator and disposal tracking.
// The GPU side is covered by tests/e2e/range.spec.ts (zero leaked GPU objects after dispose).

import { describe, expect, it } from 'vitest';
import {
  ACTIONS,
  ACTION_SECONDS,
  Animator,
  CLIP_NAMES,
  POSE_SIZE,
  sampleClip,
} from '../../src/engine/characterAnim';
import { Tracker, leaked } from '../../src/engine/disposal';
import { FIXED_STEP, FixedLoop } from '../../src/engine/loop';
import {
  Rng,
  ballistic,
  damp,
  dampAngle,
  makeSpring,
  noise1,
  pulse,
  stepSpring,
} from '../../src/engine/motion';
import {
  BUDGET,
  QUALITY,
  QUALITY_NAMES,
  isQualityName,
  medianFrameMs,
  pickPreset,
  resolveQuality,
  scaledCount,
} from '../../src/engine/quality';

function run(loop: FixedLoop, frames: number, dt: number): { steps: number; frames: number } {
  const seen = { steps: 0, frames: 0 };
  const handlers = {
    update: (step: number): void => {
      expect(step).toBe(FIXED_STEP);
      seen.steps += 1;
    },
    frame: (): void => {
      seen.frames += 1;
    },
  };
  for (let i = 0; i < frames; i++) loop.advance(dt, handlers);
  return seen;
}

describe('fixed-step loop', () => {
  it('runs the same number of logic steps at 30, 60 and 144 fps', () => {
    for (const fps of [30, 60, 144]) {
      const seen = run(new FixedLoop(), fps * 2, 1 / fps);
      expect(seen.frames).toBe(fps * 2);
      expect(Math.abs(seen.steps - 120)).toBeLessThanOrEqual(1);
    }
  });

  it('never spirals after a long stall', () => {
    const loop = new FixedLoop();
    const seen = run(loop, 1, 10);
    expect(seen.steps).toBe(loop.maxSteps);
    // What could not be caught up is dropped: the next normal frame is normal again.
    expect(run(loop, 1, 1 / 60).steps).toBeLessThanOrEqual(2);
  });

  it('hit-stop freezes the world while frames keep coming, then lets go', () => {
    const loop = new FixedLoop();
    loop.hitStop(0.1);
    expect(loop.stopped).toBe(true);
    const frozen = run(loop, 6, 1 / 60);
    expect(frozen.steps).toBe(0);
    expect(frozen.frames).toBe(6);
    run(loop, 1, 1 / 60);
    expect(loop.stopped).toBe(false);
    expect(run(loop, 60, 1 / 60).steps).toBeGreaterThanOrEqual(59);
  });

  it('keeps the longer of two hit-stops and ignores negative time', () => {
    const loop = new FixedLoop();
    loop.hitStop(0.2);
    loop.hitStop(0.05);
    run(loop, 6, 1 / 60);
    expect(loop.stopped).toBe(true);
    loop.reset();
    expect(run(loop, 5, -1).steps).toBe(0);
    expect(loop.time).toBe(0);
  });
});

describe('quality presets', () => {
  it('get richer from low to ultra and keep blob shadows on low', () => {
    expect(QUALITY.low.shadows).toBe('blob');
    expect(QUALITY.high.shadows).toBe('cascaded');
    expect(QUALITY.low.ssao).toBe(false);
    expect(QUALITY.medium.ssao).toBe(false);
    expect(QUALITY.high.ssao).toBe(true);
    for (let i = 1; i < QUALITY_NAMES.length; i++) {
      const a = QUALITY[QUALITY_NAMES[i - 1] as (typeof QUALITY_NAMES)[number]];
      const b = QUALITY[QUALITY_NAMES[i] as (typeof QUALITY_NAMES)[number]];
      expect(b.pixelRatio).toBeGreaterThanOrEqual(a.pixelRatio);
      expect(b.particles).toBeGreaterThanOrEqual(a.particles);
      expect(b.maxParticles).toBeGreaterThanOrEqual(a.maxParticles);
      expect(b.shadowMapSize).toBeGreaterThanOrEqual(a.shadowMapSize);
      expect(b.fog).toBeGreaterThanOrEqual(a.fog);
    }
    for (const name of QUALITY_NAMES) expect(QUALITY[name].name).toBe(name);
  });

  it('resolves the player choice, the benchmark pick, then medium', () => {
    expect(resolveQuality('high', 'low')).toBe('high');
    expect(resolveQuality('auto', 'low')).toBe('low');
    expect(resolveQuality('auto', null)).toBe('medium');
    expect(isQualityName('ultra')).toBe(true);
    expect(isQualityName('auto')).toBe(false);
    expect(isQualityName(3)).toBe(false);
  });

  it('the benchmark picks a preset from measured frame times', () => {
    const steady = (ms: number): number[] => Array.from({ length: 100 }, () => ms);
    expect(pickPreset(steady(33))).toBe('low');
    expect(pickPreset(steady(16.7))).toBe('high');
    expect(pickPreset(steady(8.3))).toBe('ultra');
    // 60 fps on average, but one frame in ten stutters: stay on medium.
    expect(pickPreset(steady(16.7).map((ms, i) => (i % 10 === 0 ? 30 : ms)))).toBe('medium');
    // Nothing usable measured (hidden tab): keep the safe default.
    expect(pickPreset([])).toBe('medium');
    expect(pickPreset([0, 0, 5000])).toBe('medium');
  });

  it('median ignores absurd samples; particle counts scale but never reach zero', () => {
    expect(medianFrameMs([10, 0, 20, 5000, 30])).toBe(20);
    expect(medianFrameMs([10, 20])).toBe(15);
    expect(scaledCount(QUALITY.low, 1)).toBe(1);
    expect(scaledCount(QUALITY.ultra, 100)).toBeGreaterThanOrEqual(scaledCount(QUALITY.low, 100));
    expect(BUDGET).toEqual({ drawCalls: 150, triangles: 300_000 });
  });
});

describe('motion helpers', () => {
  it('damp moves the same distance at any frame rate', () => {
    let a = 0;
    let b = 0;
    for (let i = 0; i < 30; i++) a = damp(a, 10, 6, 1 / 30);
    for (let i = 0; i < 144; i++) b = damp(b, 10, 6, 1 / 144);
    expect(a).toBeCloseTo(b, 6);
    expect(a).toBeGreaterThan(9.9);
  });

  it('dampAngle turns the short way round', () => {
    const next = dampAngle(3.0, -3.0, 10, 0.05);
    expect(next).toBeGreaterThan(3.0);
  });

  it('a critically damped spring settles without overshoot, even through a hitch', () => {
    const s = makeSpring(0, 120, 1);
    s.target = 1;
    let peak = 0;
    for (let i = 0; i < 120; i++) peak = Math.max(peak, stepSpring(s, i === 5 ? 0.5 : 1 / 60));
    expect(peak).toBeLessThanOrEqual(1.001);
    expect(s.value).toBeCloseTo(1, 3);
    expect(Number.isFinite(s.velocity)).toBe(true);
  });

  it('seeded random numbers repeat and stay in range', () => {
    const a = new Rng(7);
    const b = new Rng(7);
    for (let i = 0; i < 200; i++) {
      const x = a.next();
      expect(x).toBe(b.next());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
    expect(new Rng(8).next()).not.toBe(new Rng(7).next());
    expect(['a', 'b', 'c']).toContain(a.pick(['a', 'b', 'c']));
    expect(a.int(5)).toBeLessThan(5);
  });

  it('pulse, noise and ballistic arcs behave', () => {
    expect(pulse(0)).toBe(0);
    expect(pulse(1)).toBe(0);
    expect(pulse(0.2)).toBeCloseTo(1, 5);
    for (let x = 0; x < 20; x += 0.37) expect(Math.abs(noise1(x, 3))).toBeLessThanOrEqual(1);
    expect(noise1(4.2, 1)).toBe(noise1(4.2, 1));
    expect(ballistic(1, 4, 10, 0)).toBe(1);
    expect(ballistic(0, 5, 10, 1)).toBeCloseTo(0, 6);
  });
});

function finite(pose: Float32Array): boolean {
  return pose.every((v) => Number.isFinite(v));
}

function distance(a: Float32Array, b: Float32Array): number {
  let d = 0;
  for (let i = 0; i < a.length; i++) d = Math.max(d, Math.abs((a[i] as number) - (b[i] as number)));
  return d;
}

describe('character animator', () => {
  it('every clip gives a full, finite pose over its whole length', () => {
    const pose = new Float32Array(POSE_SIZE);
    for (const name of CLIP_NAMES) {
      for (let t = -0.5; t < 4; t += 0.05) {
        sampleClip(name, t, pose);
        expect(finite(pose)).toBe(true);
      }
    }
    expect(CLIP_NAMES).toEqual(['idle', 'walk', 'run', 'write', 'hit', 'stagger', 'fall', 'cheer']);
  });

  it('blends idle, walk and run by speed with weights that add up to 1', () => {
    const anim = new Animator();
    for (const [speed, lead] of [
      [0, 'idle'],
      [1.4, 'walk'],
      [6, 'run'],
    ] as const) {
      anim.speed = speed;
      for (let i = 0; i < 120; i++) anim.update(FIXED_STEP);
      const w = anim.weights;
      expect(w.idle + w.walk + w.run).toBeCloseTo(1, 5);
      expect(w[lead]).toBeGreaterThan(0.6);
      expect(finite(anim.pose)).toBe(true);
    }
  });

  it('never snaps: no joint jumps between two steps, even when actions interrupt each other', () => {
    const anim = new Animator(1.3);
    const before = new Float32Array(POSE_SIZE);
    let worst = 0;
    const step = (): void => {
      before.set(anim.pose);
      anim.update(FIXED_STEP);
      worst = Math.max(worst, distance(before, anim.pose));
    };
    anim.speed = 3;
    for (let i = 0; i < 60; i++) step();
    for (const name of ACTIONS) {
      anim.play(name);
      for (let i = 0; i < 14; i++) step(); // cut every action short with the next one
    }
    anim.play('cheer');
    for (let i = 0; i < 200; i++) step();
    expect(worst).toBeLessThan(0.5);
    expect(anim.action).toBeNull();
  });

  it('actions end by themselves; a fall stays down until told to get up', () => {
    const anim = new Animator();
    anim.play('hit');
    for (let i = 0; i < Math.ceil((ACTION_SECONDS.hit + 0.6) * 60); i++) anim.update(FIXED_STEP);
    expect(anim.action).toBeNull();

    anim.play('fall');
    for (let i = 0; i < Math.ceil((ACTION_SECONDS.fall + 2) * 60); i++) anim.update(FIXED_STEP);
    expect(anim.action).toBe('fall');
    expect(anim.down).toBe(true);
    expect(anim.actionProgress).toBe(1);
    anim.getUp();
    expect(anim.down).toBe(false);
    for (let i = 0; i < 90; i++) anim.update(FIXED_STEP);
    expect(anim.action).toBeNull();
  });
});

describe('disposal tracking', () => {
  class Res {
    freed = 0;
    isTexture?: boolean;
    dispose(): void {
      this.freed += 1;
    }
  }

  it('frees everything tracked exactly once and can be called twice', () => {
    const tracker = new Tracker();
    const a = tracker.track(new Res());
    const b = tracker.track(new Res());
    tracker.track(a);
    expect(tracker.size).toBe(2);
    tracker.dispose();
    tracker.dispose();
    expect(a.freed).toBe(1);
    expect(b.freed).toBe(1);
    expect(tracker.size).toBe(0);
  });

  it('walks an object tree and finds geometries, materials and their textures', () => {
    const geometry = new Res();
    const map = new Res();
    map.isTexture = true;
    const material = Object.assign(new Res(), { map, color: 0xffffff });
    const second = new Res();
    const child = { geometry, material: [material, second] };
    const bare = {};
    const root = {
      traverse(visit: (obj: unknown) => void): void {
        visit(root);
        visit(child);
        visit(bare);
      },
    };
    const tracker = new Tracker();
    tracker.trackObject(root as unknown as Parameters<Tracker['trackObject']>[0]);
    expect(tracker.size).toBe(4);
    tracker.dispose();
    for (const r of [geometry, map, material, second]) expect(r.freed).toBe(1);
  });

  it('counts what the renderer still holds', () => {
    expect(leaked({ geometries: 0, textures: 0, programs: 0 })).toBe(0);
    expect(leaked({ geometries: 1, textures: 2, programs: 3 })).toBe(6);
  });
});
