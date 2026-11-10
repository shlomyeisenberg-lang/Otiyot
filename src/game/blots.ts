// BlotField: how the combat kit looks. It draws the Blots of a WaveFight (src/game/combat.ts)
// in any scene: dark ink creatures that float in from the edge of the arena, each behind a
// glass word shield with its word on a banner above it. The first letter of every shield glows,
// so the player sees what to type to lock on. The locked Blot gets a turning gold ring, every
// correct letter fires an ink bolt from the quill, cracks the shield and makes the Blot flinch,
// and a finished word breaks the shield: the letters shatter in gold, the Blot bursts into ink
// drops and color sweeps back over the ground where it stood. Effects grow with the combo tier.
// One draw call each for body, eyes, shield and banner per Blot; no allocations per frame.

import {
  AdditiveBlending,
  BufferAttribute,
  Color,
  DoubleSide,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  burstStyle,
  FX_LAYER,
  WorldText,
  type BurstStyle,
  type SceneContext,
  type Trail,
  type WorldLetterState,
} from '../engine';
import { CONTACT, MAX_BLOTS, type Blot, type CombatListener, type WaveFight } from './combat';
import { tierVfx } from './combo';

export interface BlotFieldOptions {
  /** Where the Blots close in on (the scribe's feet). */
  center: Vector3;
  /** Radians: the direction "straight ahead" from the centre (0 = +Z). */
  facing: number;
  /** Distance from the centre where Blots appear. */
  radius: number;
  /** Ground height, so Blots float above the terrain. */
  groundAt(x: number, z: number): number;
  /** Where ink bolts start (the quill tip); read every time a bolt is fired. */
  muzzle(out: Vector3): Vector3;
}

/** Body scale per Blot size (small, normal, large). */
const SIZES = [0.85, 1.1, 1.55] as const;
const HOVER = 1.05;
const TEXT_SIZE = 0.9;
const DIE_TIME = 0.42;
const BOLTS = 8;
const BOLT_TIME = 0.13;

interface Slot {
  body: Mesh;
  shield: Mesh<BufferGeometry, MeshBasicMaterial>;
  text: WorldText;
  states: WorldLetterState[];
  word: string;
  shownLetters: readonly string[] | null;
  /** 'off', alive, or bursting. */
  mode: 0 | 1 | 2;
  die: number;
  flinch: number;
  crack: number;
  appear: number;
  size: number;
  phase: number;
  locked: boolean;
}

interface Bolt {
  trail: Trail | null;
  t: number;
  slot: number;
  fx: number;
  fy: number;
  fz: number;
  strength: number;
}

export class BlotField implements CombatListener {
  /** Told about every event after the field has drawn it (sound, HUD, probes). */
  relay: CombatListener | null = null;
  /** The combo tier, for how big effects are (the scene keeps it current). */
  tier = 0;

  private fight: WaveFight | null = null;
  private readonly slots: Slot[] = [];
  private readonly bolts: Bolt[] = [];
  private nextBolt = 0;
  private readonly reticle: Mesh<BufferGeometry, MeshBasicMaterial>;
  private readonly owned: { dispose(): void }[] = [];
  private lockedSlot = -1;
  private reticleScale = 0;
  private time = 0;

  private readonly gold: number;
  private readonly techelet: number;
  private readonly smoke: BurstStyle;
  private readonly drops: BurstStyle;
  private readonly sparks: BurstStyle;
  private readonly bigSparks: BurstStyle;
  private readonly chips: BurstStyle;

  private readonly v = new Vector3();
  private readonly v2 = new Vector3();
  private readonly goldColor = new Color();
  private readonly techeletColor = new Color();

  constructor(
    private readonly ctx: SceneContext,
    private readonly o: BlotFieldOptions,
  ) {
    const kit = ctx.materials;
    this.gold = ctx.color('gold');
    this.techelet = ctx.color('techelet');
    this.goldColor.setHex(this.gold);
    this.techeletColor.setHex(this.techelet);
    const inkDark = ctx.theme === 'light' ? ctx.color('ink') : ctx.color('bg');
    const fade = ctx.color('fade');
    const paper = ctx.theme === 'light' ? ctx.color('surface') : ctx.color('ink');

    const own = <T extends { dispose(): void }>(x: T): T => {
      this.owned.push(x);
      return x;
    };
    // An ink body: lumpy, glossy-dark, a little self-lit so it reads against any ground.
    const bodyGeo = new IcosahedronGeometry(1, 1);
    const pos = bodyGeo.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const k = 1 + 0.16 * Math.sin(x * 5.1 + y * 2.3) * Math.cos(z * 4.7 - y * 1.9);
      pos.setXYZ(i, x * k, y * k * 0.92, z * k);
    }
    bodyGeo.computeVertexNormals();
    // Two pale eyes in the same mesh (vertex colors): the Fading looking out of the ink.
    const eyeL = new SphereGeometry(0.2, 8, 6).translate(-0.32, 0.24, 0.97);
    const eyeR = new SphereGeometry(0.2, 8, 6).translate(0.32, 0.24, 0.97);
    const ink = new Color(inkDark);
    const pale = new Color(fade).multiplyScalar(1.6);
    const paint = (g: BufferGeometry, c: Color): BufferGeometry => {
      const n = g.getAttribute('position').count;
      const arr = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        arr[i * 3] = c.r;
        arr[i * 3 + 1] = c.g;
        arr[i * 3 + 2] = c.b;
      }
      g.setAttribute('color', new BufferAttribute(arr, 3));
      return g;
    };
    const blob = paint(bodyGeo.toNonIndexed(), ink);
    blob.deleteAttribute('uv');
    eyeL.deleteAttribute('uv');
    eyeR.deleteAttribute('uv');
    const merged = own(
      mergeGeometries([
        blob,
        paint(eyeL.toNonIndexed(), pale),
        paint(eyeR.toNonIndexed(), pale),
      ]) as BufferGeometry,
    );
    blob.dispose();
    bodyGeo.dispose();
    eyeL.dispose();
    eyeR.dispose();
    const bodyMat = own(
      kit.surface({
        vertexColors: true,
        emissive: this.techelet,
        emissiveIntensity: 0.06,
        lift: 0.25,
        restore: false,
      }),
    );
    const shieldGeo = own(new IcosahedronGeometry(1, 1));

    for (let i = 0; i < MAX_BLOTS; i++) {
      const body = new Mesh(merged, bodyMat);
      kit.caster(body, true);
      const shieldMat = own(
        new MeshBasicMaterial({
          color: this.techelet,
          transparent: true,
          opacity: 0.5,
          wireframe: true,
          blending: AdditiveBlending,
          depthWrite: false,
          side: DoubleSide,
          fog: false,
          toneMapped: false,
        }),
      );
      const shield = new Mesh(shieldGeo, shieldMat);
      shield.layers.set(FX_LAYER);
      shield.renderOrder = 3;
      const text = new WorldText({
        atlas: ctx.engine.atlas,
        materials: kit,
        billboard: ctx.vfx.billboard,
        colors: {
          ink: inkDark,
          paper,
          stone: fade,
          gold: this.gold,
          techelet: this.techelet,
          err: ctx.color('err-fg'),
        },
        style: 'banner',
        size: TEXT_SIZE,
        capacity: 12,
      });
      body.visible = false;
      shield.visible = false;
      text.root.visible = false;
      ctx.root.add(body, shield, text.root);
      this.slots.push({
        body,
        shield,
        text,
        states: [],
        word: '',
        shownLetters: null,
        mode: 0,
        die: 0,
        flinch: 0,
        crack: 0,
        appear: 0,
        size: 1,
        phase: i * 1.7,
        locked: false,
      });
    }

    const ringMat = own(kit.ink(this.gold, 2.6));
    ringMat.transparent = true;
    ringMat.depthWrite = false;
    this.reticle = new Mesh(own(new RingGeometry(0.9, 1.05, 40, 1).rotateX(-Math.PI / 2)), ringMat);
    this.reticle.visible = false;
    ctx.root.add(this.reticle);

    for (let i = 0; i < BOLTS; i++) {
      this.bolts.push({ trail: null, t: -1, slot: 0, fx: 0, fy: 0, fz: 0, strength: 0 });
    }

    this.smoke = burstStyle({
      count: 14,
      color: fade,
      color2: inkDark,
      speed: [0.4, 1.6],
      spread: 0.9,
      life: [0.6, 1.2],
      size: [0.25, 0.55],
      gravity: -0.6,
      radius: 0.4,
    });
    this.drops = burstStyle({
      count: 46,
      color: inkDark,
      speed: [2.5, 7.5],
      spread: 0.8,
      life: [0.6, 1.2],
      size: [0.1, 0.3],
      gravity: 10,
    });
    this.sparks = burstStyle({
      count: 10,
      color: this.techelet,
      color2: 0xffffff,
      intensity: 3,
      speed: [1.5, 4],
      life: [0.25, 0.5],
      size: [0.05, 0.12],
      gravity: 3,
    });
    this.bigSparks = burstStyle({
      count: 70,
      color: this.gold,
      color2: 0xfff2c0,
      intensity: 3.4,
      speed: [3, 9],
      spread: 0.9,
      life: [0.6, 1.4],
      size: [0.07, 0.2],
      gravity: 5,
    });
    this.chips = burstStyle({
      count: 18,
      color: this.techelet,
      color2: this.gold,
      intensity: 2.6,
      speed: [2, 5],
      spread: 1,
      life: [0.4, 0.9],
      size: [0.06, 0.16],
      gravity: 7,
    });
  }

  /** Draws this fight from now on (null: none). */
  attach(fight: WaveFight | null): void {
    if (this.fight) this.fight.listener = {};
    this.fight = fight;
    for (const s of this.slots) {
      s.mode = 0;
      s.body.visible = false;
      s.shield.visible = false;
      s.text.root.visible = false;
    }
    for (const b of this.bolts) {
      b.trail?.stop();
      b.trail = null;
      b.t = -1;
    }
    this.lockedSlot = -1;
    this.reticle.visible = false;
    if (fight) fight.listener = this;
  }

  /** World position of a Blot (its body centre). */
  positionOf(b: Blot, out: Vector3): Vector3 {
    const { center, facing, radius } = this.o;
    const a = facing + b.angle;
    const r = radius * b.dist;
    const x = center.x + Math.sin(a) * r;
    const z = center.z + Math.cos(a) * r;
    const size = SIZES[b.size];
    return out.set(x, this.o.groundAt(x, z) + HOVER + size * 0.6, z);
  }

  /** Where the locked Blot is (for the scribe to face it). False when nothing is locked. */
  lockedPosition(out: Vector3): boolean {
    const f = this.fight;
    if (!f || this.lockedSlot < 0) return false;
    this.positionOf(f.blots[this.lockedSlot] as Blot, out);
    return true;
  }

  /** Centre of letter `i` on the banner of the Blot whose word is `word`. */
  letterPosition(word: string, i: number, out: Vector3): Vector3 | null {
    const b = this.fight?.find(word);
    if (!b) return null;
    return (this.slots[b.id] as Slot).text.letterPosition(i, out);
  }

  /** A wrong key while a Blot is locked: its banner stumbles. */
  miss(): void {
    if (this.lockedSlot >= 0) (this.slots[this.lockedSlot] as Slot).text.miss();
  }

  // --- CombatListener -------------------------------------------------------------------------

  spawn(b: Blot): void {
    const s = this.slots[b.id] as Slot;
    s.mode = 1;
    s.appear = 0;
    s.crack = 0;
    s.flinch = 0;
    s.locked = false;
    s.size = SIZES[b.size];
    s.word = b.word;
    s.shownLetters = null;
    const letters = [...b.word];
    s.text.setWord(letters, /[֐-׿]/.test(b.word));
    s.states.length = letters.length;
    for (let i = 0; i < letters.length; i++) s.states[i] = i === 0 ? 'next' : 'todo';
    s.body.visible = true;
    s.shield.visible = true;
    s.text.root.visible = true;
    const p = this.positionOf(b, this.v);
    this.ctx.vfx.burst(this.smoke, p.x, p.y - 0.6, p.z, 0, 1, 0, true);
    this.ctx.audio.playAt('whoosh', p.x, p.y, p.z);
    this.relay?.spawn?.(b);
  }

  lock(b: Blot): void {
    for (const s of this.slots) s.locked = false;
    (this.slots[b.id] as Slot).locked = true;
    this.lockedSlot = b.id;
    this.reticleScale = 1.8;
    this.relay?.lock?.(b);
  }

  hit(b: Blot): void {
    const s = this.slots[b.id] as Slot;
    s.flinch = 1;
    s.crack = b.word.length > 0 ? b.typed / b.word.length : 1;
    this.fire(b.id, tierVfx(this.tier));
    this.relay?.hit?.(b);
  }

  broken(b: Blot, perfect: boolean): void {
    const s = this.slots[b.id] as Slot;
    const { vfx, audio } = this.ctx;
    const k = tierVfx(this.tier);
    const p = this.positionOf(b, this.v);
    // The shield's letters shatter in gold.
    const n = Math.min(s.word.length, 12);
    let i = 0;
    for (const ch of s.word) {
      if (i >= n) break;
      const at = s.text.letterPosition(i, this.v2);
      vfx.shatter(ch, at.x, at.y, at.z, TEXT_SIZE, this.gold, 2.4 + k, 2.2 + 2 * k);
      i += 1;
    }
    vfx.burst(this.drops, p.x, p.y, p.z, 0, 1, 0, true);
    vfx.burst(this.bigSparks, p.x, p.y, p.z, 0, 1, 0);
    vfx.shockwave(p.x, p.y, p.z, 2.6 + 2 * k, this.gold, 0.5, false);
    // Color comes back to the ground where the Blot stood.
    const gx = p.x;
    const gz = p.z;
    vfx.restore(gx, this.o.groundAt(gx, gz) + 0.1, gz, 4.5 + 5 * k * (perfect ? 1.3 : 1), 1.3);
    vfx.impact(0.35 + 0.6 * k, this.gold);
    if (perfect) vfx.flash(this.gold, 0.12 + 0.12 * k, 0.22);
    audio.playAt('shatter', p.x, p.y, p.z);
    if (b.id === this.lockedSlot) this.lockedSlot = -1;
    s.mode = 2;
    s.die = 0;
    s.locked = false;
    s.shield.visible = false;
    s.text.root.visible = false;
    this.relay?.broken?.(b, perfect);
  }

  smudge(b: Blot): void {
    const p = this.positionOf(b, this.v);
    const { vfx, audio } = this.ctx;
    vfx.burst(this.drops, p.x, p.y, p.z, 0, 0.6, 0, true);
    vfx.impact(0.55, this.ctx.color('fade'));
    audio.playAt('impact-small', p.x, p.y, p.z);
    (this.slots[b.id] as Slot).flinch = 1.6;
    this.relay?.smudge?.(b);
  }

  wave(index: number, total: number): void {
    this.relay?.wave?.(index, total);
  }

  cleared(): void {
    this.relay?.cleared?.();
  }

  // --- drawing ----------------------------------------------------------------------------------

  /** Once per drawn frame. `typingWord` and `states` are the typing view's (for the locked Blot). */
  frame(dt: number, typingWord: string, typingStates: readonly WorldLetterState[]): void {
    this.time += dt;
    const f = this.fight;
    const t = this.time;
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i] as Slot;
      if (s.mode === 0 || !f) continue;
      const b = f.blots[i] as Blot;
      const p = this.positionOf(b, this.v);
      if (s.mode === 2) {
        // Bursting: swell, then shrink to nothing.
        s.die += dt;
        const k = s.die / DIE_TIME;
        if (k >= 1) {
          s.mode = 0;
          s.body.visible = false;
          continue;
        }
        const sc = s.size * (k < 0.25 ? 1 + k * 1.6 : 1.4 * (1 - (k - 0.25) / 0.75));
        s.body.position.set(p.x, p.y + k * 0.4, p.z);
        s.body.scale.setScalar(Math.max(0.001, sc));
        continue;
      }
      s.appear = Math.min(1, s.appear + dt * 2.2);
      if (s.flinch > 0) s.flinch = Math.max(0, s.flinch - dt * 5);
      const appear = s.appear * s.appear * (3 - 2 * s.appear);
      // Lean back when hit; wobble like a drop of ink; bob in the air.
      const bob = Math.sin(t * 2.1 + s.phase) * 0.12;
      const back = s.flinch * 0.35;
      const dx = this.o.center.x - p.x;
      const dz = this.o.center.z - p.z;
      const len = Math.hypot(dx, dz) || 1;
      const x = p.x - (dx / len) * back;
      const z = p.z - (dz / len) * back;
      const y = p.y + bob - (1 - appear) * 1.2;
      const wob = Math.sin(t * 5.3 + s.phase) * 0.06;
      const sq = s.flinch * 0.18;
      const sc = s.size * appear;
      s.body.position.set(x, y, z);
      s.body.scale.set(sc * (1 + wob + sq), sc * (1 - wob - sq), sc * (1 + wob + sq));
      s.body.rotation.set(
        Math.sin(t * 0.9 + s.phase) * 0.12 - s.flinch * 0.25,
        Math.atan2(dx, dz),
        0,
      );

      // The shield: a glass bubble that turns gold and thins as its word is typed.
      const shield = s.shield;
      const crack = b.typed / Math.max(1, b.word.length);
      s.crack += (crack - s.crack) * Math.min(1, dt * 12);
      shield.position.set(x, y, z);
      const ss = sc * (1.32 + 0.04 * Math.sin(t * 3 + s.phase) + s.flinch * 0.08);
      shield.scale.setScalar(Math.max(0.001, ss));
      shield.rotation.y = t * 0.3 + s.phase;
      const mat = shield.material;
      mat.color.copy(this.techeletColor).lerp(this.goldColor, s.crack);
      mat.opacity = (0.32 + 0.5 * s.flinch + (s.locked ? 0.2 : 0)) * (1 - 0.45 * s.crack);

      // The word on a banner above it. The locked Blot shows the typing states.
      s.text.anchor.set(x, y + sc * 1.55 + 0.75, z);
      const states = s.locked && typingWord === s.word ? typingStates : s.states;
      s.text.frame(dt, states);

      // Close to the scribe: it swells and shudders.
      if (b.dist < CONTACT * 3) s.body.scale.multiplyScalar(1 + 0.08 * Math.sin(t * 18));
    }

    // The gold ring under the locked Blot.
    if (f && this.lockedSlot >= 0) {
      const b = f.blots[this.lockedSlot] as Blot;
      const s = this.slots[this.lockedSlot] as Slot;
      const p = this.positionOf(b, this.v);
      this.reticleScale += (1 - this.reticleScale) * Math.min(1, dt * 10);
      this.reticle.visible = true;
      const gy = this.o.groundAt(p.x, p.z);
      this.reticle.position.set(p.x, gy + 0.08, p.z);
      this.reticle.rotation.y = t * 1.6;
      this.reticle.scale.setScalar(s.size * 1.5 * this.reticleScale);
    } else {
      this.reticle.visible = false;
    }

    // Ink bolts in flight.
    for (const bolt of this.bolts) {
      if (bolt.t < 0 || !bolt.trail || !f) continue;
      bolt.t += dt;
      const k = Math.min(1, bolt.t / BOLT_TIME);
      const s = this.slots[bolt.slot] as Slot;
      const to = s.mode === 0 ? this.v.set(bolt.fx, bolt.fy, bolt.fz) : s.body.position;
      const arc = Math.sin(k * Math.PI) * 0.8;
      bolt.trail.emit(
        bolt.fx + (to.x - bolt.fx) * k,
        bolt.fy + (to.y - bolt.fy) * k + arc,
        bolt.fz + (to.z - bolt.fz) * k,
      );
      if (k >= 1) {
        bolt.trail.stop();
        bolt.trail = null;
        bolt.t = -1;
        if (s.mode === 1) {
          const n = 1 + Math.round(bolt.strength * 2);
          for (let j = 0; j < n; j++) {
            this.ctx.vfx.burst(this.sparks, to.x, to.y, to.z, 0, 1, 0);
          }
          this.ctx.vfx.burst(this.chips, to.x, to.y, to.z, 0, 1, 0);
          this.ctx.vfx.shockwave(to.x, to.y, to.z, 1.2 + bolt.strength, this.techelet, 0.25, false);
        }
      }
    }
  }

  dispose(): void {
    this.attach(null);
    for (const s of this.slots) {
      s.body.removeFromParent();
      s.shield.removeFromParent();
      s.text.dispose();
    }
    this.reticle.removeFromParent();
    for (const o of this.owned) o.dispose();
    this.owned.length = 0;
    this.slots.length = 0;
    this.relay = null;
  }

  private fire(slot: number, strength: number): void {
    const bolt = this.bolts[this.nextBolt] as Bolt;
    this.nextBolt = (this.nextBolt + 1) % BOLTS;
    bolt.trail?.stop();
    const from = this.o.muzzle(this.v2);
    bolt.fx = from.x;
    bolt.fy = from.y;
    bolt.fz = from.z;
    bolt.slot = slot;
    bolt.t = 0;
    bolt.strength = strength;
    bolt.trail = this.ctx.vfx.trail(this.gold, 0.12 + 0.12 * strength, 0.35, 2 + 2 * strength);
    bolt.trail.emit(from.x, from.y, from.z);
  }
}
