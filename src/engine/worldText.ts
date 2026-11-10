// WorldText: the word to type, standing in the world instead of on the paper strip. Three
// looks: 'carved' (letters inlaid in a stone tablet), 'banner' (ink on a hanging parchment
// banner) and 'hologram' (light letters in a glowing frame, for the Star Station and friends).
// Every letter follows the typing state: waiting, next (techelet glow), right (gold), fixed,
// wrong (a short red stumble). One draw call for the letters plus one or two for the backing.

import {
  AdditiveBlending,
  BoxGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Vector3,
  type Material,
} from 'three';
import type { LetterAtlas } from './letters';
import { LetterField, type Billboard } from './letters';
import type { MaterialKit } from './materials';
import { FX_LAYER } from './postfx';
import { smoothstep } from './motion';

export type TextStyle = 'carved' | 'banner' | 'hologram';
export const TEXT_STYLES: readonly TextStyle[] = ['carved', 'banner', 'hologram'];

/** The same states the typing driver reports (game/typing.ts). */
export type WorldLetterState = 'todo' | 'next' | 'ok' | 'fixed' | 'err';

/** Colors as 0xRRGGBB numbers, taken from the UI tokens by the scene (ctx.color). */
export interface WorldTextColors {
  ink: number;
  paper: number;
  stone: number;
  gold: number;
  techelet: number;
  err: number;
}

export interface WorldTextOptions {
  atlas: LetterAtlas;
  materials: MaterialKit;
  billboard: Billboard;
  colors: WorldTextColors;
  style?: TextStyle;
  /** Letter height in world units. */
  size?: number;
  capacity?: number;
}

/** Distance between letter centres, as a share of the letter size. */
export const LETTER_ADVANCE = 0.82;

/**
 * Where letter `i` of `n` sits along the line, in letter sizes from the centre. Right-to-left
 * text runs the other way, so the first letter of a Hebrew word is on the right.
 */
export function letterOffset(i: number, n: number, rtl: boolean): number {
  return (i - (n - 1) / 2) * LETTER_ADVANCE * (rtl ? -1 : 1);
}

interface StyleLook {
  todo: number;
  todoGlow: number;
  doneGlow: number;
  nextGlow: number;
}

export class WorldText {
  readonly root = new Group();
  /** Where the middle of the word stands. Move it freely. */
  readonly anchor = new Vector3();
  style: TextStyle;
  size: number;

  private readonly field: LetterField;
  private readonly billboard: Billboard;
  private readonly colors: WorldTextColors;
  private readonly plate: Mesh<BoxGeometry, Material>;
  private readonly rod: Mesh<BoxGeometry, Material>;
  private readonly glass: Mesh<PlaneGeometry, MeshBasicMaterial>;
  private readonly stoneMat: Material;
  private readonly paperMat: Material;
  private readonly rodMat: Material;
  private readonly capacity: number;
  private readonly looks: Readonly<Record<TextStyle, StyleLook>>;

  private letters: readonly string[] = [];
  private rtl = true;
  private age = 0;
  private time = 0;
  private stumble = 0;
  private readonly pop: Float32Array;
  private readonly tmp = new Vector3();

  constructor(o: WorldTextOptions) {
    this.style = o.style ?? 'banner';
    this.size = o.size ?? 1;
    this.capacity = o.capacity ?? 24;
    this.billboard = o.billboard;
    this.colors = o.colors;
    this.pop = new Float32Array(this.capacity);
    const c = o.colors;
    this.looks = {
      carved: { todo: c.paper, todoGlow: 1.05, doneGlow: 1.9, nextGlow: 2.4 },
      banner: { todo: c.ink, todoGlow: 1, doneGlow: 1.7, nextGlow: 2.2 },
      hologram: { todo: c.paper, todoGlow: 1.7, doneGlow: 2.6, nextGlow: 3 },
    };
    this.field = new LetterField(o.atlas, o.materials, o.billboard, this.capacity);

    // The text is always readable: its backing is never greyed by the Forgetting.
    this.stoneMat = o.materials.surface({ color: o.colors.stone, restore: false });
    // Parchment glows a little from within, so the banner reads as paper under any sky.
    this.paperMat = o.materials.surface({
      color: o.colors.paper,
      emissive: o.colors.paper,
      emissiveIntensity: 0.45,
      side: DoubleSide,
      restore: false,
    });
    this.rodMat = o.materials.surface({
      color: o.colors.gold,
      emissive: o.colors.gold,
      emissiveIntensity: 0.25,
      restore: false,
    });
    const box = new BoxGeometry(1, 1, 1);
    this.plate = o.materials.caster(new Mesh(box, this.stoneMat));
    this.rod = new Mesh(new BoxGeometry(1, 1, 1), this.rodMat);
    this.glass = new Mesh(
      new PlaneGeometry(1, 1),
      new MeshBasicMaterial({
        color: o.colors.techelet,
        transparent: true,
        opacity: 0.14,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
        fog: false,
      }),
    );
    this.glass.layers.set(FX_LAYER);
    this.glass.renderOrder = 4;
    this.root.add(this.plate, this.rod, this.glass, this.field.mesh);
    this.setStyle(this.style);
  }

  /** The word to show, as letters (graphemes), without the trailing space. */
  setWord(letters: readonly string[], rtl: boolean): void {
    this.letters = letters;
    this.rtl = rtl;
    this.age = 0;
    this.pop.fill(0);
    for (let i = 0; i < this.capacity; i++) this.field.hide(i);
  }

  setStyle(style: TextStyle): void {
    this.style = style;
    this.plate.visible = style === 'carved' || style === 'banner';
    this.plate.material = style === 'banner' ? this.paperMat : this.stoneMat;
    this.rod.visible = style === 'banner';
    this.glass.visible = style === 'hologram';
  }

  /** A correct letter: it pops and turns gold. */
  hit(i: number): void {
    if (i >= 0 && i < this.capacity) this.pop[i] = 1;
  }

  /** A wrong key: the next letter stumbles for a moment. */
  miss(): void {
    this.stumble = 1;
  }

  /** Centre of letter `i` in world space, right now. */
  letterPosition(i: number, out: Vector3): Vector3 {
    const n = Math.min(this.letters.length, this.capacity);
    const k = letterOffset(i, n, this.rtl) * this.size;
    const right = this.billboard.uRight.value;
    const bob =
      this.style === 'banner' ? Math.sin(this.time * 1.4 + i * 0.6) * 0.03 * this.size : 0;
    return out.set(this.anchor.x + right.x * k, this.anchor.y + bob, this.anchor.z + right.z * k);
  }

  /** Once per drawn frame: lay out the letters and color them by state. */
  frame(dt: number, states: readonly WorldLetterState[]): void {
    this.time += dt;
    this.age += dt;
    if (this.stumble > 0) this.stumble = Math.max(0, this.stumble - dt * 4);
    const c = this.colors;
    const look = this.looks[this.style];
    const n = Math.min(this.letters.length, this.capacity);
    const s = this.size;
    for (let i = 0; i < n; i++) {
      const p = this.letterPosition(i, this.tmp);
      const state = states[i] ?? 'todo';
      const appear = smoothstep(0, 0.3, this.age - i * 0.04);
      if ((this.pop[i] as number) > 0) this.pop[i] = Math.max(0, (this.pop[i] as number) - dt * 4);
      const pop = this.pop[i] as number;
      let x = p.x;
      let z = p.z;
      let scale = appear * (1 + pop * 0.35);
      let color: number;
      let glow: number;
      switch (state) {
        case 'next': {
          color = this.stumble > 0.25 ? c.err : c.techelet;
          glow = look.nextGlow;
          scale *= 1.06 + 0.05 * Math.sin(this.time * 6);
          const shake = Math.sin(this.time * 70) * 0.08 * s * this.stumble;
          const right = this.billboard.uRight.value;
          x += right.x * shake;
          z += right.z * shake;
          break;
        }
        case 'ok':
          color = c.gold;
          glow = look.doneGlow + pop * 1.5;
          break;
        case 'fixed':
          color = c.gold;
          glow = look.doneGlow * 0.7;
          break;
        case 'err':
          color = c.err;
          glow = 1.6;
          break;
        default:
          color = look.todo;
          glow = look.todoGlow;
      }
      if (this.style === 'hologram') glow *= 0.9 + 0.1 * Math.sin(this.time * 23 + i * 1.7);
      const lift = (1 - appear) * -0.5 * s + pop * 0.12 * s;
      this.field.set(i, this.letters[i] as string, x, p.y + lift, z, s * scale, color, glow);
    }
    for (let i = n; i < this.capacity; i++) this.field.hide(i);
    this.field.commit();
    this.layoutBacking(n);
  }

  dispose(): void {
    this.root.removeFromParent();
    this.field.dispose();
    this.plate.geometry.dispose();
    this.rod.geometry.dispose();
    this.glass.geometry.dispose();
    this.glass.material.dispose();
    this.stoneMat.dispose();
    this.paperMat.dispose();
    this.rodMat.dispose();
  }

  private layoutBacking(n: number): void {
    const s = this.size;
    const right = this.billboard.uRight.value;
    const yaw = Math.atan2(-right.z, right.x);
    const width = (Math.max(n, 2) * LETTER_ADVANCE + 0.9) * s;
    const height = 1.55 * s;
    const appear = smoothstep(0, 0.25, this.age + 0.25);
    const back = 0.32 * s;
    // Sit the backing just behind the letters, seen from the camera.
    const bx = this.anchor.x + right.z * back;
    const bz = this.anchor.z - right.x * back;
    const y = this.anchor.y;
    if (this.plate.visible) {
      const depth = this.style === 'banner' ? 0.04 * s : 0.3 * s;
      const wave = this.style === 'banner' ? Math.sin(this.time * 1.4) * 0.03 : 0;
      this.plate.position.set(bx, y - (this.style === 'banner' ? 0.05 * s : 0), bz);
      this.plate.rotation.set(wave, yaw, 0);
      this.plate.scale.set(width * appear, height, depth);
    }
    if (this.rod.visible) {
      this.rod.position.set(bx, y + height * 0.5 + 0.03 * s, bz);
      this.rod.rotation.set(0, yaw, 0);
      this.rod.scale.set((width + 0.5 * s) * appear, 0.09 * s, 0.09 * s);
    }
    if (this.glass.visible) {
      this.glass.position.set(bx, y, bz);
      this.glass.rotation.set(0, yaw, 0);
      this.glass.scale.set(width * appear, height * 0.92, 1);
      this.glass.material.opacity = 0.11 + 0.04 * Math.sin(this.time * 17);
    }
  }
}
