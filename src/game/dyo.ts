// Dyo (דיו, "ink"): the apprentice's sidekick, a talking drop of ink who lives in the inkwell
// (GAME_DESIGN "Characters"). A glossy deep-blue teardrop with big pale eyes, animated in code:
// he breathes, blinks, hops with squash and stretch, and bounces when he cheers. Not a person, so
// the content rules about human figures do not apply; he is a he all the same.

import {
  Group,
  LatheGeometry,
  Mesh,
  SphereGeometry,
  Vector2,
  type MeshLambertMaterial,
} from 'three';
import { Tracker, type MaterialKit } from '../engine';

export interface DyoColors {
  body: number;
  /** The glossy rim light on his head. */
  shine: number;
  eye: number;
  pupil: number;
}

/** The shape of a drop: round at the bottom, a soft point at the top (about 0.6 tall). */
function dropProfile(): Vector2[] {
  const pts: Vector2[] = [];
  for (let i = 0; i <= 10; i++) {
    const a = -Math.PI / 2 + (i / 10) * Math.PI * 0.62;
    pts.push(new Vector2(Math.cos(a) * 0.3, 0.3 + Math.sin(a) * 0.3));
  }
  pts.push(new Vector2(0.17, 0.5), new Vector2(0.08, 0.6), new Vector2(0, 0.66));
  return pts;
}

export class Dyo {
  /** Place this; he faces +Z. */
  readonly root = new Group();
  /** Squash and stretch happen on this, around his base. */
  private readonly body = new Group();
  private readonly eyes = new Group();
  private readonly pupils: Mesh[] = [];
  private readonly tracker = new Tracker();

  private time = 0;
  private hopT = -1;
  private hopDur = 0.5;
  private hopH = 0.6;
  private readonly from = { x: 0, y: 0, z: 0 };
  private readonly to = { x: 0, y: 0, z: 0 };
  private cheers = 0;
  private cheerT = 0;
  private landSquash = 0;
  private blinkIn = 2.2;
  private yawTarget = 0;

  constructor(kit: MaterialKit, c: DyoColors) {
    const ink: MeshLambertMaterial = this.tracker.track(
      kit.surface({
        color: c.body,
        emissive: c.shine,
        emissiveIntensity: 0.35,
        restore: false,
        flat: false,
        lift: 0.25,
      }),
    );
    const white = this.tracker.track(
      kit.surface({
        color: c.eye,
        emissive: c.eye,
        emissiveIntensity: 0.5,
        restore: false,
        flat: false,
      }),
    );
    const dark = this.tracker.track(kit.surface({ color: c.pupil, restore: false, flat: false }));
    const shine = this.tracker.track(
      kit.surface({ color: c.eye, emissive: c.eye, emissiveIntensity: 1.6, restore: false }),
    );
    const drop = kit.caster(
      new Mesh(this.tracker.track(new LatheGeometry(dropProfile(), 14)), ink),
    );
    this.body.add(drop);
    const gleam = new Mesh(this.tracker.track(new SphereGeometry(0.05, 6, 4)), shine);
    gleam.scale.set(1, 1.6, 0.6);
    gleam.position.set(-0.12, 0.47, 0.17);
    this.body.add(gleam);
    const eyeGeo = this.tracker.track(new SphereGeometry(0.085, 10, 8));
    const pupilGeo = this.tracker.track(new SphereGeometry(0.045, 8, 6));
    for (const side of [-1, 1]) {
      const eye = new Mesh(eyeGeo, white);
      eye.scale.set(1, 1.2, 0.7);
      eye.position.set(side * 0.1, 0.33, 0.24);
      const pupil = new Mesh(pupilGeo, dark);
      pupil.position.set(side * 0.1, 0.32, 0.3);
      this.pupils.push(pupil);
      this.eyes.add(eye, pupil);
    }
    this.body.add(this.eyes);
    this.root.add(this.body);
  }

  /** Jumps to a point in a little arc. */
  hop(x: number, y: number, z: number, height = 0.6, seconds = 0.5): void {
    const p = this.root.position;
    this.from.x = p.x;
    this.from.y = p.y;
    this.from.z = p.z;
    this.to.x = x;
    this.to.y = y;
    this.to.z = z;
    this.hopH = height;
    this.hopDur = Math.max(0.1, seconds);
    this.hopT = 0;
    this.yawTarget = Math.atan2(x - p.x, z - p.z) || this.yawTarget;
  }

  /** Small happy hops on the spot. */
  cheer(times = 3): void {
    this.cheers = times;
    this.cheerT = 0;
  }

  /** Turns to face a point on the ground plane. */
  face(x: number, z: number): void {
    const p = this.root.position;
    this.yawTarget = Math.atan2(x - p.x, z - p.z);
  }

  update(dt: number): void {
    this.time += dt;
    const t = this.time;
    let lift = 0;
    let stretch = 0;
    if (this.hopT >= 0) {
      this.hopT += dt / this.hopDur;
      const k = Math.min(1, this.hopT);
      const p = this.root.position;
      p.x = this.from.x + (this.to.x - this.from.x) * k;
      p.y = this.from.y + (this.to.y - this.from.y) * k + Math.sin(k * Math.PI) * this.hopH;
      p.z = this.from.z + (this.to.z - this.from.z) * k;
      stretch = Math.sin(k * Math.PI) * 0.22;
      if (k >= 1) {
        this.hopT = -1;
        this.landSquash = 1;
      }
    } else if (this.cheers > 0) {
      this.cheerT += dt * 3.2;
      const k = this.cheerT % 1;
      lift = Math.sin(k * Math.PI) * 0.28;
      stretch = Math.sin(k * Math.PI) * 0.18;
      if (this.cheerT >= 1) {
        this.cheerT -= 1;
        this.cheers -= 1;
        this.landSquash = 0.8;
      }
    }
    this.landSquash = Math.max(0, this.landSquash - dt * 4);
    const breathe = Math.sin(t * 2.4) * 0.03;
    const squash = this.landSquash * 0.3 - stretch + breathe;
    this.body.position.y = lift;
    this.body.scale.set(1 + squash * 0.6, 1 - squash, 1 + squash * 0.6);
    // Turn toward where he is going (or looking), a little wobbly.
    let d = (this.yawTarget - this.root.rotation.y) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    else if (d < -Math.PI) d += Math.PI * 2;
    this.root.rotation.y += d * Math.min(1, dt * 7);
    this.body.rotation.z = Math.sin(t * 1.7) * 0.05;
    // Blink now and then; the pupils dart about.
    this.blinkIn -= dt;
    const blink = this.blinkIn < 0.12 ? 0.1 : 1;
    if (this.blinkIn < 0) this.blinkIn = 1.6 + ((t * 7.31) % 2.4);
    this.eyes.scale.y = blink;
    const dart = Math.sin(t * 0.9) > 0.6 ? 0.02 : -0.01;
    for (const p of this.pupils) p.position.x = Math.sign(p.position.x) * 0.1 + dart;
  }

  dispose(): void {
    this.root.removeFromParent();
    this.tracker.dispose();
  }
}
