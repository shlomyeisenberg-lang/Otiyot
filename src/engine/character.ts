// The procedural character rig (DESIGN, "3D art direction"): simple stylized, modest figures in
// long robes with caps, hats or head scarves, built from a few low-poly shapes and animated
// entirely by code (see characterAnim.ts). One material, about ten draw calls per figure.

import {
  BoxGeometry,
  BufferAttribute,
  Color,
  CylinderGeometry,
  Group,
  LatheGeometry,
  Mesh,
  Object3D,
  SphereGeometry,
  Vector2,
  type BufferGeometry,
  type MeshLambertMaterial,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Animator, J, type ActionName } from './characterAnim';
import { Tracker } from './disposal';
import type { MaterialKit } from './materials';
import { makeSpring, stepSpring } from './motion';

/** All figures are men (ARCHITECTURE section 8): a cap, a brimmed hat or a wound turban. */
export type Headwear = 'cap' | 'hat' | 'turban';

export interface CharacterLook {
  robe: number;
  /** Darker tone at the hem; the robe fades into it. */
  hem: number;
  /** Scarf, cuffs and head covering. */
  trim: number;
  skin: number;
  /** Eyes and shoes. */
  ink: number;
  headwear: Headwear;
  /** A beard, for elders: its color. */
  beard?: number;
  /** Carries a quill in the right hand (the scribe). */
  quill?: boolean;
  /** The quill's feather and shaft colors (default: a white goose feather, an ink-dark shaft). */
  feather?: number;
  shaft?: number;
  /** 1 = adult (about 1.75 units tall). */
  height?: number;
  /** Starts the idle sway at a different moment, so a crowd does not breathe in step. */
  seed?: number;
}

const tmpColor = new Color();
const tmpColor2 = new Color();

/** Gives a shape one flat color (or a bottom-to-top gradient) and drops what we do not use. */
function paint(g: BufferGeometry, color: number, bottom?: number): BufferGeometry {
  const pos = g.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  tmpColor.setHex(color);
  let lo = Infinity;
  let hi = -Infinity;
  if (bottom !== undefined) {
    tmpColor2.setHex(bottom);
    for (let i = 0; i < pos.count; i++) {
      lo = Math.min(lo, pos.getY(i));
      hi = Math.max(hi, pos.getY(i));
    }
  }
  for (let i = 0; i < pos.count; i++) {
    let r = tmpColor.r;
    let gr = tmpColor.g;
    let b = tmpColor.b;
    if (bottom !== undefined) {
      const t = Math.pow((pos.getY(i) - lo) / (hi - lo || 1), 0.7);
      r = tmpColor2.r + (r - tmpColor2.r) * t;
      gr = tmpColor2.g + (gr - tmpColor2.g) * t;
      b = tmpColor2.b + (b - tmpColor2.b) * t;
    }
    colors[i * 3] = r;
    colors[i * 3 + 1] = gr;
    colors[i * 3 + 2] = b;
  }
  g.setAttribute('color', new BufferAttribute(colors, 3));
  g.deleteAttribute('uv');
  return g;
}

function merged(parts: BufferGeometry[]): BufferGeometry {
  const out = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  return out ?? parts[0]!;
}

export class Character {
  /** Place and turn this. The figure faces +Z. */
  readonly root = new Group();
  readonly anim: Animator;
  /** The tip of the quill (or the right hand): where ink trails start. */
  readonly quillTip = new Object3D();
  /** A point at chest height, for effects and for the camera. */
  readonly chestPoint = new Object3D();

  private readonly tracker = new Tracker();
  private readonly hips = new Group();
  private readonly chest = new Group();
  private readonly head = new Group();
  private readonly armL = new Group();
  private readonly armR = new Group();
  private readonly elbowL = new Group();
  private readonly elbowR = new Group();
  private readonly footL: Mesh;
  private readonly footR: Mesh;
  private readonly tail = new Group();
  private readonly scarfSpring = makeSpring(0, 70, 0.4);
  private readonly material: MeshLambertMaterial;
  /** Thin parts (arms, feet, scarf, quill): they cast shadows only when asked to. */
  private readonly minor: Mesh[] = [];

  constructor(kit: MaterialKit, look: CharacterLook) {
    this.anim = new Animator(look.seed ?? 0);
    this.material = this.tracker.track(
      kit.surface({ vertexColors: true, restore: false, lift: 0.2 }),
    );
    const mesh = (g: BufferGeometry): Mesh => {
      return kit.caster(new Mesh(this.tracker.track(g), this.material));
    };

    // Robe: a long flared skirt from the hips to the ankles, fading to a darker hem.
    const robe = paint(
      new LatheGeometry(
        [
          new Vector2(0.0, -0.84),
          new Vector2(0.43, -0.84),
          new Vector2(0.4, -0.7),
          new Vector2(0.29, -0.1),
          new Vector2(0.27, 0.12),
        ],
        8,
      ),
      look.robe,
      look.hem,
    );
    this.hips.add(mesh(robe));

    // Torso with a scarf wrapped at the neck.
    const torso = paint(
      new LatheGeometry(
        [
          new Vector2(0.275, 0.0),
          new Vector2(0.285, 0.2),
          new Vector2(0.24, 0.4),
          new Vector2(0.11, 0.47),
          new Vector2(0.0, 0.47),
        ],
        8,
      ),
      look.robe,
    );
    const wrap = paint(new CylinderGeometry(0.135, 0.165, 0.1, 8, 1, true), look.trim).translate(
      0,
      0.47,
      0,
    );
    this.chest.position.set(0, 0.08, 0);
    this.chest.add(mesh(merged([torso, wrap])));
    this.chestPoint.position.set(0, 0.3, 0);
    this.chest.add(this.chestPoint);
    this.hips.add(this.chest);

    // Head: face, eyes, optional beard, and a head covering.
    const headParts: BufferGeometry[] = [
      paint(new SphereGeometry(0.2, 8, 6), look.skin).scale(0.94, 1.04, 0.96),
      paint(new SphereGeometry(0.024, 5, 4), look.ink).translate(0.075, 0.015, 0.178),
      paint(new SphereGeometry(0.024, 5, 4), look.ink).translate(-0.075, 0.015, 0.178),
    ];
    if (look.beard !== undefined) {
      headParts.push(
        paint(new CylinderGeometry(0.125, 0.03, 0.24, 6), look.beard)
          .rotateX(0.2)
          .translate(0, -0.2, 0.09),
      );
    }
    if (look.headwear === 'cap') {
      headParts.push(
        paint(new SphereGeometry(0.21, 8, 3, 0, Math.PI * 2, 0, 0.72), look.trim)
          .scale(1, 1.02, 1)
          .rotateX(-0.22)
          .translate(0, 0.02, -0.01),
      );
    } else if (look.headwear === 'hat') {
      headParts.push(
        paint(new CylinderGeometry(0.33, 0.33, 0.025, 10), look.trim).translate(0, 0.12, 0),
        paint(new CylinderGeometry(0.16, 0.19, 0.17, 8), look.trim).translate(0, 0.21, 0),
      );
    } else {
      // A wound turban: a low dome over a thick rolled band.
      headParts.push(
        paint(new SphereGeometry(0.2, 8, 3, 0, Math.PI * 2, 0, 1.25), look.trim)
          .scale(1, 0.8, 1)
          .translate(0, 0.07, -0.01),
        paint(new CylinderGeometry(0.235, 0.225, 0.085, 9), look.trim)
          .rotateX(-0.12)
          .translate(0, 0.085, -0.012),
      );
    }
    this.head.position.set(0, 0.68, 0);
    this.head.add(mesh(merged(headParts)));
    this.chest.add(this.head);

    // Arms: sleeve, forearm with a cuff, hand.
    const upper = (): BufferGeometry =>
      paint(new CylinderGeometry(0.075, 0.085, 0.32, 6), look.robe).translate(0, -0.15, 0);
    const fore = (): BufferGeometry =>
      merged([
        paint(new CylinderGeometry(0.085, 0.1, 0.27, 6), look.robe).translate(0, -0.13, 0),
        paint(new CylinderGeometry(0.102, 0.102, 0.035, 6), look.trim).translate(0, -0.262, 0),
        paint(new SphereGeometry(0.055, 6, 4), look.skin).translate(0, -0.31, 0),
      ]);
    this.armL.position.set(0.27, 0.36, 0);
    this.armR.position.set(-0.27, 0.36, 0);
    this.elbowL.position.set(0, -0.3, 0);
    this.elbowR.position.set(0, -0.3, 0);
    const thin = (g: BufferGeometry): Mesh => {
      const m = mesh(g);
      this.minor.push(m);
      return m;
    };
    this.armL.add(thin(upper()), this.elbowL);
    this.armR.add(thin(upper()), this.elbowR);
    this.elbowL.add(thin(fore()));
    this.elbowR.add(thin(fore()));
    this.chest.add(this.armL, this.armR);

    this.quillTip.position.set(0, -0.33, 0.04);
    if (look.quill) {
      const quill = merged([
        paint(new CylinderGeometry(0.004, 0.012, 0.3, 4), look.shaft ?? look.ink).translate(
          0,
          0.15,
          0,
        ),
        paint(new CylinderGeometry(0.035, 0.008, 0.3, 4), look.feather ?? 0xf4ecd8)
          .scale(1, 1, 0.25)
          .translate(0, -0.12, 0),
      ]).rotateX(1.9);
      const q = thin(quill);
      q.position.set(0, -0.31, 0.03);
      this.elbowR.add(q);
      this.quillTip.position.set(0, -0.41, 0.31);
    }
    this.elbowR.add(this.quillTip);

    // Feet peek out from under the robe.
    const foot = (): BufferGeometry =>
      paint(new BoxGeometry(0.13, 0.085, 0.25), look.ink).translate(0, 0, 0.05);
    this.footL = thin(foot());
    this.footR = thin(foot());
    this.hips.add(this.footL, this.footR);

    // The loose end of the scarf, swinging behind.
    this.tail.position.set(0.05, 0.47, -0.14);
    this.tail.add(
      thin(paint(new BoxGeometry(0.13, 0.46, 0.028), look.trim).translate(0, -0.23, 0)),
    );
    this.chest.add(this.tail);

    this.root.add(this.hips);
    this.root.scale.setScalar(look.height ?? 1);
    this.apply(0);
  }

  /** Ground speed in units per second: the figure walks or runs to match. */
  set speed(v: number) {
    this.anim.speed = v;
  }

  /**
   * Full shadows (every part) or cheap ones (robe, torso and head only). Each shadow-casting
   * part is one more draw call per shadow map, so medium quality uses the cheap kind.
   */
  shadowDetail(full: boolean): void {
    for (const m of this.minor) m.castShadow = full;
  }

  play(action: ActionName): void {
    this.anim.play(action);
  }

  update(dt: number): void {
    this.anim.update(dt);
    this.apply(dt);
  }

  private apply(dt: number): void {
    const p = this.anim.pose;
    const st = p[J.stretch] as number;
    this.hips.position.y = 0.9 + (p[J.rootY] as number) * 1.5;
    this.hips.rotation.set(p[J.lean] as number, (p[J.twist] as number) * 0.5, p[J.roll] as number);
    this.hips.scale.set(1 - st * 0.5, 1 + st, 1 - st * 0.5);
    this.chest.rotation.set(p[J.spine] as number, (p[J.twist] as number) * 0.5, 0);
    this.head.rotation.set(
      p[J.headPitch] as number,
      p[J.headYaw] as number,
      p[J.headRoll] as number,
    );
    this.armL.rotation.set(-(p[J.lRaise] as number), 0, p[J.lOut] as number);
    this.armR.rotation.set(-(p[J.rRaise] as number), 0, -(p[J.rOut] as number));
    this.elbowL.rotation.x = -(p[J.lBend] as number);
    this.elbowR.rotation.x = -(p[J.rBend] as number);
    this.footL.position.set(0.12, -0.855 + (p[J.lFootY] as number), p[J.lFootZ] as number);
    this.footR.position.set(-0.12, -0.855 + (p[J.rFootY] as number), p[J.rFootZ] as number);
    // The scarf lags behind the body on a loose spring, so it never looks stiff.
    this.scarfSpring.target = p[J.scarf] as number;
    this.tail.rotation.x = dt > 0 ? stepSpring(this.scarfSpring, dt) : this.scarfSpring.target;
  }

  dispose(): void {
    this.root.removeFromParent();
    this.tracker.dispose();
  }
}
