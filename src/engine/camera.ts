// The camera rig. Three ways to carry the camera (third-person follow with collision, on a rail,
// in a cockpit) and three ways to make a moment land (shake, push-in, and hit-stop, which lives
// in the loop). Switching mode glides; nothing is allocated per frame.

import {
  MathUtils,
  Ray,
  Vector3,
  type Box3,
  type Curve,
  type Object3D,
  type PerspectiveCamera,
} from 'three';
import { clamp01, damp, makeSpring, noise1, stepSpring } from './motion';

export type CameraMode = 'fixed' | 'follow' | 'rail' | 'cockpit';

export interface FollowOptions {
  /** Distance behind and height above the target. */
  distance?: number;
  height?: number;
  /** Height above the target's origin that the camera looks at. */
  lookHeight?: number;
  /** Turn with the target's facing (0 = never, 1 = locked behind it). */
  turnWith?: number;
  /** How quickly the camera catches up (higher is stiffer). */
  stiffness?: number;
}

export interface RailOptions {
  /** What to look at; without it the camera looks ahead along the rail. */
  lookAt?: Object3D;
  lookAhead?: number;
  stiffness?: number;
}

export interface CockpitOptions {
  /** Seat position in the vehicle's own space. */
  seat?: Vector3;
  /** Gentle head sway, 0..1. */
  sway?: number;
}

const UP = new Vector3(0, 1, 0);

export class CameraRig {
  mode: CameraMode = 'fixed';
  /** 0..1 from the player's settings; reduce motion sets both to 0. */
  shakeScale = 1;
  pushScale = 1;
  /** Where on the rail the camera should be, 0..1. The scene moves this. */
  railT = 0;
  /** Extra orbit around the follow target, radians. */
  orbit = 0;
  /** Boxes the follow camera must not pass through. */
  colliders: readonly Box3[] = [];
  /** Ground height under a point: the camera never sinks below it. */
  groundAt: (x: number, z: number) => number = () => -Infinity;
  /** The point the camera is looking at (shadows and effects centre on it). */
  readonly focus = new Vector3();

  private baseFov: number;
  private target: Object3D | null = null;
  private curve: Curve<Vector3> | null = null;
  private fo: Required<FollowOptions> = {
    distance: 9,
    height: 4.2,
    lookHeight: 1.4,
    turnWith: 0,
    stiffness: 5,
  };
  private ro: { lookAt: Object3D | null; lookAhead: number; stiffness: number } = {
    lookAt: null,
    lookAhead: 0.04,
    stiffness: 4,
  };
  private readonly seat = new Vector3(0, 1.2, 0.4);
  private sway = 0.4;
  private heading = 0;
  private railNow = 0;
  private trauma = 0;
  private time = 0;
  private readonly push = makeSpring(0, 90, 1);
  private pushHold = 0;
  private dist = 9;

  private readonly pos = new Vector3();
  private readonly look = new Vector3();
  private readonly wantPos = new Vector3();
  private readonly wantLook = new Vector3();
  private readonly tmp = new Vector3();
  private readonly tmp2 = new Vector3();
  private readonly ray = new Ray();
  private snap = true;

  constructor(readonly camera: PerspectiveCamera) {
    this.baseFov = camera.fov;
    this.pos.copy(camera.position);
  }

  /** Places the camera and holds it there. */
  fixed(position: Vector3, lookAt: Vector3): void {
    this.mode = 'fixed';
    this.wantPos.copy(position);
    this.wantLook.copy(lookAt);
  }

  /** Third person: behind and above `target`, sliding in when a collider is in the way. */
  follow(target: Object3D, o: FollowOptions = {}): void {
    this.mode = 'follow';
    this.target = target;
    this.fo = { distance: 9, height: 4.2, lookHeight: 1.4, turnWith: 0, stiffness: 5, ...o };
    this.dist = this.fo.distance;
  }

  /** On rails: the camera rides `curve`; the scene drives `railT` from 0 to 1. */
  rail(curve: Curve<Vector3>, o: RailOptions = {}): void {
    this.mode = 'rail';
    this.curve = curve;
    this.ro = {
      lookAt: o.lookAt ?? null,
      lookAhead: o.lookAhead ?? 0.04,
      stiffness: o.stiffness ?? 4,
    };
    this.railNow = this.railT;
  }

  /** First person from inside `vehicle`, looking along its +Z. */
  cockpit(vehicle: Object3D, o: CockpitOptions = {}): void {
    this.mode = 'cockpit';
    this.target = vehicle;
    if (o.seat) this.seat.copy(o.seat);
    else this.seat.set(0, 1.2, 0.4);
    this.sway = o.sway ?? 0.4;
  }

  /** Jumps straight to where the camera wants to be (use after a cut or a scene load). */
  cut(): void {
    this.snap = true;
  }

  /** Adds camera shake. `amount` 0..1; shakes stack and die away on their own. */
  shake(amount: number): void {
    this.trauma = clamp01(this.trauma + amount);
  }

  /** A quick push toward the subject: `amount` 0..1, held for `hold` seconds, then released. */
  pushIn(amount = 0.5, hold = 0.25): void {
    this.push.target = clamp01(amount) * this.pushScale;
    this.pushHold = hold;
  }

  setFov(fov: number): void {
    this.baseFov = fov;
  }

  /** Per frame, with real (unscaled) time. */
  update(dt: number): void {
    this.time += dt;
    this.solve(dt);

    if (this.snap) {
      this.pos.copy(this.wantPos);
      this.look.copy(this.wantLook);
      this.snap = false;
    } else {
      const k =
        this.mode === 'cockpit'
          ? 30
          : this.mode === 'rail'
            ? this.ro.stiffness * 2
            : this.fo.stiffness;
      this.pos.x = damp(this.pos.x, this.wantPos.x, k, dt);
      this.pos.y = damp(this.pos.y, this.wantPos.y, k, dt);
      this.pos.z = damp(this.pos.z, this.wantPos.z, k, dt);
      const kl = k * 1.6;
      this.look.x = damp(this.look.x, this.wantLook.x, kl, dt);
      this.look.y = damp(this.look.y, this.wantLook.y, kl, dt);
      this.look.z = damp(this.look.z, this.wantLook.z, kl, dt);
    }
    const floor = this.groundAt(this.pos.x, this.pos.z) + 0.35;
    if (this.pos.y < floor) this.pos.y = floor;
    this.focus.copy(this.look);

    // Push-in: narrow the lens and lean toward the subject, then let go.
    if (this.pushHold > 0) {
      this.pushHold -= dt;
      if (this.pushHold <= 0) this.push.target = 0;
    }
    const p = stepSpring(this.push, dt);
    const cam = this.camera;
    cam.position.copy(this.pos);
    if (p > 0.0005) {
      this.tmp.copy(this.look).sub(this.pos);
      cam.position.addScaledVector(this.tmp, p * 0.16);
    }
    const fov = this.baseFov * (1 - 0.14 * p);
    if (Math.abs(fov - cam.fov) > 0.01) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
    cam.up.copy(UP);
    cam.lookAt(this.look);

    // Shake: trauma squared feels right (small hits barely move, big ones jolt).
    if (this.trauma > 0) {
      const s = this.trauma * this.trauma * this.shakeScale;
      const t = this.time * 26;
      cam.rotateX(noise1(t, 1) * 0.035 * s);
      cam.rotateY(noise1(t, 2) * 0.035 * s);
      cam.rotateZ(noise1(t, 3) * 0.05 * s);
      cam.position.x += noise1(t, 4) * 0.12 * s;
      cam.position.y += noise1(t, 5) * 0.12 * s;
      this.trauma = Math.max(0, this.trauma - dt * 1.6);
    }
    cam.updateMatrixWorld();
  }

  private solve(dt: number): void {
    if (this.mode === 'follow' && this.target) {
      const f = this.fo;
      this.target.getWorldPosition(this.tmp);
      this.wantLook.copy(this.tmp);
      this.wantLook.y += f.lookHeight;
      if (f.turnWith > 0) {
        this.target.getWorldDirection(this.tmp2);
        const facing = Math.atan2(this.tmp2.x, this.tmp2.z);
        let d = (facing - this.heading) % (Math.PI * 2);
        if (d > Math.PI) d -= Math.PI * 2;
        else if (d < -Math.PI) d += Math.PI * 2;
        this.heading += d * (1 - Math.exp(-f.turnWith * 3 * dt));
      }
      const a = this.heading + this.orbit + Math.PI;
      this.tmp2.set(Math.sin(a) * f.distance, f.height, Math.cos(a) * f.distance);
      const full = this.tmp2.length();
      this.tmp2.divideScalar(full);
      // Collision: cast from the subject toward the camera; stop short of the first box.
      let reach = full;
      this.ray.origin.copy(this.wantLook);
      this.ray.direction.copy(this.tmp2);
      for (let i = 0; i < this.colliders.length; i++) {
        const hit = this.ray.intersectBox(this.colliders[i] as Box3, this.tmp);
        if (hit) {
          const d = hit.distanceTo(this.wantLook) - 0.4;
          if (d < reach) reach = d;
        }
      }
      if (reach < 1.2) reach = 1.2;
      // Slide in at once (never show the inside of a wall), ease back out.
      this.dist = reach < this.dist ? reach : damp(this.dist, reach, 3, dt);
      this.wantPos.copy(this.wantLook).addScaledVector(this.tmp2, this.dist);
      if (reach < full - 0.01 && this.dist <= reach + 0.01) this.pos.copy(this.wantPos);
    } else if (this.mode === 'rail' && this.curve) {
      this.railNow = damp(this.railNow, this.railT, this.ro.stiffness, dt);
      const t = MathUtils.clamp(this.railNow, 0, 1);
      this.curve.getPointAt(t, this.wantPos);
      if (this.ro.lookAt) {
        this.ro.lookAt.getWorldPosition(this.wantLook);
        this.wantLook.y += 1.2;
      } else {
        this.curve.getPointAt(Math.min(1, t + this.ro.lookAhead), this.wantLook);
      }
    } else if (this.mode === 'cockpit' && this.target) {
      this.target.updateWorldMatrix(true, false);
      this.wantPos.copy(this.seat);
      const s = this.sway;
      this.wantPos.x += noise1(this.time * 0.7, 7) * 0.04 * s;
      this.wantPos.y += noise1(this.time * 0.9, 8) * 0.03 * s;
      this.target.localToWorld(this.wantPos);
      this.wantLook.copy(this.seat);
      this.wantLook.z += 12;
      this.wantLook.x += noise1(this.time * 0.35, 9) * 0.5 * s;
      this.target.localToWorld(this.wantLook);
    }
  }
}
