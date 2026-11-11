// Birds and butterflies: small winged things that come back to the meadow as it is restored.
// Each kind is two draw calls at most (all wings in one instanced mesh, all bodies in another),
// moved on the processor with no allocation per frame. Birds circle wide over the meadow;
// butterflies wander in loops near a point.

import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  InstancedMesh,
  Matrix4,
  OctahedronGeometry,
  Quaternion,
  Vector3,
  type Object3D,
} from 'three';
import { damp, type MaterialKit, type Rng, type Tracker } from '../../engine';

export interface FlyerOptions {
  count: number;
  kind: 'bird' | 'butterfly';
  /** Wing colors, picked per flyer. */
  colors: readonly number[];
  /** Body color (birds only). */
  body?: number;
  /** Size of one wing, in world units. */
  size: number;
  /** Centre of the area they keep to, and how far they roam from it. */
  centerX: number;
  centerZ: number;
  roam: readonly [number, number];
  /** Height above the ground, lowest and highest. */
  height: readonly [number, number];
  groundAt: (x: number, z: number) => number;
}

const UP = new Vector3(0, 1, 0);

function wingGeometry(kind: FlyerOptions['kind']): BufferGeometry {
  // A wing lies flat, root on the body's axis, tip toward +X.
  const pts =
    kind === 'bird'
      ? [0, 0, 0.34, 0, 0, -0.26, 1, 0, -0.18]
      : [0, 0, 0.42, 0, 0, -0.4, 0.95, 0, -0.62, 0, 0, 0.42, 0.95, 0, -0.62, 1.05, 0, 0.6];
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pts), 3));
  const normals = new Float32Array(pts.length);
  for (let i = 1; i < normals.length; i += 3) normals[i] = 1;
  g.setAttribute('normal', new BufferAttribute(normals, 3));
  return g;
}

export class Flyers {
  private readonly wings: InstancedMesh;
  private readonly bodies: InstancedMesh | null;
  private readonly n: number;
  private readonly radius: Float32Array;
  private readonly height: Float32Array;
  private readonly speed: Float32Array;
  private readonly phase: Float32Array;
  private readonly flap: Float32Array;
  private readonly cx: Float32Array;
  private readonly cz: Float32Array;
  private readonly shown: Float32Array;
  private wanted = 0;
  private time = 0;

  private readonly m = new Matrix4();
  private readonly rz = new Matrix4();
  private readonly mirror = new Matrix4().makeScale(-1, 1, 1);
  private readonly tmp = new Matrix4();
  private readonly p = new Vector3();
  private readonly s = new Vector3();
  private readonly q = new Quaternion();
  private readonly q2 = new Quaternion();
  private readonly fwd = new Vector3(0, 0, 1);

  constructor(
    kit: MaterialKit,
    tracker: Tracker,
    parent: Object3D,
    private readonly o: FlyerOptions,
    rng: Rng,
  ) {
    const n = o.count;
    this.n = n;
    this.radius = new Float32Array(n);
    this.height = new Float32Array(n);
    this.speed = new Float32Array(n);
    this.phase = new Float32Array(n);
    this.flap = new Float32Array(n);
    this.cx = new Float32Array(n);
    this.cz = new Float32Array(n);
    this.shown = new Float32Array(n);
    const bird = o.kind === 'bird';
    const wingMat = tracker.track(
      kit.surface({ restore: false, lift: bird ? 0.25 : 0.55, side: DoubleSide }),
    );
    this.wings = new InstancedMesh(tracker.track(wingGeometry(o.kind)), wingMat, n * 2);
    this.wings.frustumCulled = false;
    kit.caster(this.wings, false);
    const c = new Color();
    const zero = new Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < n; i++) {
      this.radius[i] = rng.range(o.roam[0], o.roam[1]);
      this.height[i] = rng.range(o.height[0], o.height[1]);
      this.speed[i] =
        (bird ? rng.range(5.5, 8) : rng.range(0.55, 1.1)) * (rng.next() < 0.5 ? -1 : 1);
      this.phase[i] = rng.range(0, Math.PI * 2);
      this.flap[i] = bird ? rng.range(7, 10) : rng.range(13, 19);
      this.cx[i] = o.centerX + (bird ? rng.signed() * 8 : rng.signed() * o.roam[1]);
      this.cz[i] = o.centerZ + (bird ? rng.signed() * 8 : rng.signed() * o.roam[1]);
      c.setHex(o.colors[i % o.colors.length] as number);
      this.wings.setMatrixAt(i * 2, zero);
      this.wings.setMatrixAt(i * 2 + 1, zero);
      this.wings.setColorAt(i * 2, c);
      this.wings.setColorAt(i * 2 + 1, c);
    }
    parent.add(tracker.track(this.wings));
    if (bird) {
      const geo = new OctahedronGeometry(1, 0).scale(0.13, 0.11, 0.42);
      const mat = tracker.track(
        kit.surface({ color: o.body ?? 0x333333, restore: false, lift: 0.2 }),
      );
      this.bodies = new InstancedMesh(tracker.track(geo), mat, n);
      this.bodies.frustumCulled = false;
      kit.caster(this.bodies, false);
      for (let i = 0; i < n; i++) this.bodies.setMatrixAt(i, zero);
      parent.add(tracker.track(this.bodies));
    } else {
      this.bodies = null;
    }
  }

  /** How many of them are out (the rest fold away). */
  show(count: number): void {
    this.wanted = Math.max(0, Math.min(this.n, count));
  }

  get out(): number {
    return this.wanted;
  }

  /** Hides all of them at once (a new run). */
  reset(): void {
    this.wanted = 0;
    this.shown.fill(0);
  }

  update(dt: number): void {
    this.time += dt;
    const t = this.time;
    const { m, rz, tmp, p, s, q, q2, o } = this;
    const bird = o.kind === 'bird';
    for (let i = 0; i < this.n; i++) {
      const want = i < this.wanted ? 1 : 0;
      const shown = damp(this.shown[i] as number, want, 2.2, dt);
      this.shown[i] = shown;
      if (shown < 0.002) {
        // Folded away: a zero matrix, written once more and then left alone.
        if (shown !== 0) {
          this.shown[i] = 0;
          tmp.makeScale(0, 0, 0);
          this.wings.setMatrixAt(i * 2, tmp);
          this.wings.setMatrixAt(i * 2 + 1, tmp);
          this.bodies?.setMatrixAt(i, tmp);
        }
        continue;
      }
      const r = this.radius[i] as number;
      const ph = this.phase[i] as number;
      const sp = this.speed[i] as number;
      let vx: number;
      let vz: number;
      let bank = 0;
      if (bird) {
        // A wide circle, rising and dipping a little.
        const a = ph + (t * sp) / r;
        const dir = sp > 0 ? 1 : -1;
        p.set(
          (this.cx[i] as number) + Math.cos(a) * r,
          0,
          (this.cz[i] as number) + Math.sin(a) * r,
        );
        vx = -Math.sin(a) * dir;
        vz = Math.cos(a) * dir;
        p.y = o.groundAt(p.x, p.z) * 0.5 + (this.height[i] as number) + Math.sin(a * 3 + ph) * 1.4;
        // Birds arrive from above and beyond.
        p.y += (1 - shown) * 14;
        bank = -0.35 * dir;
      } else {
        // A wandering loop near its own spot.
        const a = t * sp + ph;
        const b = t * sp * 1.31 + ph * 2;
        p.set(
          (this.cx[i] as number) + Math.sin(a) * r,
          0,
          (this.cz[i] as number) + Math.cos(b) * r,
        );
        vx = Math.cos(a) * sp;
        vz = -Math.sin(b) * sp * 1.31;
        p.y =
          o.groundAt(p.x, p.z) +
          (this.height[i] as number) +
          Math.sin(t * 2.3 + ph) * 0.25 +
          Math.sin(t * 5.1 + ph) * 0.08;
      }
      q.setFromAxisAngle(UP, Math.atan2(vx, vz));
      if (bank !== 0) q.multiply(q2.setFromAxisAngle(this.fwd, bank));
      s.setScalar(o.size * shown);
      m.compose(p, q, s);
      const beat = Math.sin(t * (this.flap[i] as number) + ph);
      // Birds glide between beats; butterflies never stop.
      const angle = bird ? 0.15 + beat * 0.75 : 0.55 + beat * 0.7;
      rz.makeRotationZ(angle);
      this.wings.setMatrixAt(i * 2, tmp.multiplyMatrices(m, rz));
      this.wings.setMatrixAt(i * 2 + 1, tmp.multiplyMatrices(m, this.mirror).multiply(rz));
      this.bodies?.setMatrixAt(i, m);
    }
    this.wings.instanceMatrix.needsUpdate = true;
    if (this.bodies) this.bodies.instanceMatrix.needsUpdate = true;
  }
}
