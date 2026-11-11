// The title (T12): a blank, forgotten parchment on a scribe's desk. Gold-ink letters fall from
// above, one by one, and land with a splash of ink; where each one lands, color comes back to the
// page. Together they spell the name, אותיות, with OTIYOT cascading in small letters beneath,
// while the camera flies in low across the sheet and rises to face the name. Loose grey letters
// drift above the desk, forgotten, until the name is whole; then they turn gold too.
// Any key (the screen calls `finish`) jumps straight to the finished picture.

import {
  BufferAttribute,
  CatmullRomCurve3,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Mesh,
  PlaneGeometry,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
} from 'three';
import {
  burstStyle,
  easeInOut,
  LetterField,
  Rng,
  smoothstep,
  type BurstStyle,
  type GameScene,
  type RunConfig,
  type SceneContext,
  type Trail,
  type TypedKey,
} from '../../engine';
import { SKY, TINT } from './palette';

export const TITLE_NAME = 'אותיות';
export const TITLE_LATIN = 'OTIYOT';

const HE_SIZE = 3.1;
const HE_ADVANCE = 1.9;
const LA_SIZE = 1.05;
const LA_ADVANCE = 0.92;
const LA_Z = 3.1;
const DROP_FROM = 17;
const GRAVITY = 42;
/** When the first letter starts to fall, and the gap between letters. */
const HE_START = 1.7;
const HE_GAP = 0.36;
const LA_GAP = 0.11;
const FLIGHT = 6.6;
const DRIFTERS = 18;
const SHEET_W = 36;
const SHEET_D = 21;

interface Drop {
  ch: string;
  x: number;
  z: number;
  size: number;
  /** Resting height of the glyph's middle. */
  rest: number;
  at: number;
  y: number;
  vy: number;
  landed: boolean;
  /** Squash on landing: 1 = still; grows briefly when it lands. */
  pop: number;
  big: boolean;
  trail: Trail | null;
}

interface Drifter {
  ch: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  phase: number;
  size: number;
  /** 0 = forgotten grey, 1 = gold. */
  gold: number;
  turnAt: number;
}

/** A flat-ish sheet that curls up a little at its short ends. */
function sheetHeight(x: number, z: number): number {
  const curl = smoothstep(SHEET_W * 0.36, SHEET_W * 0.5, Math.abs(x));
  return 0.02 + Math.sin(x * 0.45 + z * 0.2) * 0.05 + Math.cos(z * 0.6) * 0.03 + curl * curl * 0.4;
}

export class TitleScene implements GameScene {
  readonly id = 'title';
  /** Called once when the name is whole (or `finish` was called). */
  onReady: (() => void) | null = null;
  ready = false;
  /** Letters landed so far (for tests). */
  landed = 0;

  private ctx!: SceneContext;
  private readonly rng = new Rng(5779);
  private field!: LetterField;
  private readonly drops: Drop[] = [];
  private readonly drifters: Drifter[] = [];
  private flight!: CatmullRomCurve3;
  private readonly lookFrom = new Vector3(-6, 0.6, 0);
  private readonly lookTo = new Vector3(0, -0.9, 3.4);
  private readonly cam = new Vector3();
  private readonly look = new Vector3();
  private readonly finalCam = new Vector3(0, 7.4, 16.2);
  private time = 0;
  private readyAt = Infinity;
  private flame!: Mesh;
  private gold = 0;
  private fade = 0;
  private ink = 0;
  private splash!: BurstStyle;
  private sparks!: BurstStyle;
  private glints!: BurstStyle;
  private motes!: BurstStyle;

  constructor(private readonly reducedMotion = false) {}

  async load(ctx: SceneContext): Promise<void> {
    this.ctx = ctx;
    const { materials: kit, tracker, root } = ctx;
    this.gold = ctx.color('gold');
    this.fade = ctx.color('fade');
    this.ink = ctx.theme === 'light' ? ctx.color('ink') : ctx.color('bg');

    ctx.audio.music('title');
    ctx.audio.intensity(0);
    ctx.atmosphere.setPalette({ ...SKY[ctx.theme], fade: this.fade, ink: this.gold });
    ctx.atmosphere.groundAt = () => 0;
    ctx.atmosphere.setShadowRange(26);
    ctx.post.setGrade(
      ctx.theme === 'dark'
        ? { exposure: 1.2, bloom: 1.4, vignette: 0.52, godRays: 0.4, saturation: 1.0 }
        : { exposure: 1.2, bloom: 1.3, vignette: 0.45, godRays: 0.35, saturation: 1.0 },
    );
    // The page starts forgotten; each landing letter sweeps color back around itself.
    ctx.materials.restoreAll(0, 0);

    this.splash = burstStyle({
      count: 26,
      color: this.ink,
      speed: [2.5, 7.5],
      spread: 0.55,
      life: [0.5, 1.0],
      size: [0.1, 0.26],
      gravity: 16,
    });
    this.sparks = burstStyle({
      count: 34,
      color: this.gold,
      color2: 0xfff2c4,
      intensity: 3.2,
      speed: [2, 8],
      spread: 0.8,
      life: [0.5, 1.2],
      size: [0.06, 0.16],
      gravity: 5,
    });
    this.glints = burstStyle({
      count: 12,
      color: this.gold,
      color2: 0xffffff,
      intensity: 3,
      speed: [0.5, 2],
      life: [0.4, 0.9],
      size: [0.05, 0.12],
      gravity: -0.5,
    });
    this.motes = burstStyle({
      count: 1,
      color: this.gold,
      color2: 0xfff6d8,
      intensity: 2.2,
      speed: [0.05, 0.25],
      life: [3, 6],
      size: [0.04, 0.09],
      gravity: -0.12,
      radius: 12,
    });

    // --- The desk: dark wood with a soft grain, far beyond the sheet.
    const desk = new PlaneGeometry(170, 170, 40, 40).rotateX(-Math.PI / 2);
    this.paint(desk, (x, z, c) => {
      const grain = Math.sin(z * 1.7 + Math.sin(x * 0.11) * 3) * 0.5 + 0.5;
      c.setHex(TINT.desk).lerp(new Color(TINT.deskDark), grain * 0.55 + this.rng.next() * 0.1);
    });
    const deskMesh = new Mesh(
      tracker.track(desk),
      tracker.track(kit.surface({ vertexColors: true })),
    );
    deskMesh.position.y = -0.08;
    deskMesh.receiveShadow = true;
    root.add(deskMesh);

    // --- The parchment: warm, fibrous, darker at the edges.
    const sheet = new PlaneGeometry(SHEET_W, SHEET_D, 56, 34).rotateX(-Math.PI / 2);
    const pos = sheet.getAttribute('position');
    for (let i = 0; i < pos.count; i++) pos.setY(i, sheetHeight(pos.getX(i), pos.getZ(i)));
    const deep = new Color(TINT.parchmentDeep);
    const edge = new Color(TINT.parchmentEdge);
    this.paint(sheet, (x, z, c) => {
      const fiber = Math.sin(x * 2.3 + Math.sin(z * 4.1)) * Math.sin(z * 3.1 - x * 0.7);
      c.setHex(TINT.parchment).lerp(deep, 0.25 + fiber * 0.18 + this.rng.next() * 0.12);
      const ex = Math.abs(x) / (SHEET_W / 2);
      const ez = Math.abs(z) / (SHEET_D / 2);
      c.lerp(edge, smoothstep(0.72, 1, Math.max(ex, ez)) * 0.75);
    });
    sheet.computeVertexNormals();
    const sheetMesh = new Mesh(
      tracker.track(sheet),
      tracker.track(kit.surface({ vertexColors: true, flat: false })),
    );
    sheetMesh.receiveShadow = true;
    root.add(sheetMesh);

    // --- An inkwell with a quill in it, and a candle: the scribe's desk, for scale.
    const glass = tracker.track(
      kit.surface({ color: TINT.glass, emissive: TINT.glass, emissiveIntensity: 0.15 }),
    );
    const rim = tracker.track(
      kit.surface({ color: TINT.rim, emissive: TINT.rim, emissiveIntensity: 0.2 }),
    );
    const feather = tracker.track(kit.surface({ color: TINT.feather }));
    const well = new Mesh(tracker.track(new CylinderGeometry(1.0, 1.25, 1.5, 12)), glass);
    well.position.set(-14.5, 0.75, 6.2);
    kit.caster(well);
    const lip = new Mesh(tracker.track(new CylinderGeometry(0.62, 0.72, 0.3, 12)), rim);
    lip.position.set(0, 0.85, 0);
    well.add(lip);
    const quill = new Mesh(tracker.track(new SphereGeometry(1, 10, 6)), feather);
    quill.scale.set(0.42, 3.4, 0.08);
    quill.position.set(0.9, 3.1, -0.3);
    quill.rotation.set(0.15, 0.4, -0.38);
    kit.caster(quill);
    well.add(quill);
    const shaft = new Mesh(tracker.track(new CylinderGeometry(0.035, 0.05, 6.8, 5)), rim);
    shaft.position.copy(quill.position);
    shaft.rotation.copy(quill.rotation);
    well.add(shaft);
    root.add(well);

    const wax = tracker.track(kit.surface({ color: TINT.wax }));
    const candle = new Mesh(tracker.track(new CylinderGeometry(0.55, 0.6, 3.4, 10)), wax);
    candle.position.set(15.5, 1.7, -6.5);
    kit.caster(candle);
    root.add(candle);
    const fire = tracker.track(
      kit.surface({
        color: TINT.flame,
        emissive: TINT.flame,
        emissiveIntensity: 3.2,
        restore: false,
      }),
    );
    this.flame = new Mesh(tracker.track(new ConeGeometry(0.22, 0.75, 8)), fire);
    this.flame.position.set(15.5, 3.85, -6.5);
    root.add(this.flame);
    ctx.audio.ambience('fire', 15.5, 3.8, -6.5);

    // --- Letters: the name (Hebrew right to left), OTIYOT beneath, and the forgotten drifters.
    const he = Array.from(TITLE_NAME);
    const la = Array.from(TITLE_LATIN);
    this.field = new LetterField(
      ctx.engine.atlas,
      kit,
      ctx.vfx.billboard,
      he.length + la.length + DRIFTERS,
    );
    tracker.track(this.field);
    root.add(this.field.mesh);
    he.forEach((ch, i) => {
      const x = ((he.length - 1) / 2 - i) * HE_ADVANCE;
      this.drops.push(this.drop(ch, x, -0.4, HE_SIZE, HE_START + i * HE_GAP, true));
    });
    const laStart = HE_START + he.length * HE_GAP + 0.45;
    la.forEach((ch, i) => {
      const x = (i - (la.length - 1) / 2) * LA_ADVANCE;
      this.drops.push(this.drop(ch, x, LA_Z, LA_SIZE, laStart + i * LA_GAP, false));
    });
    const last = this.drops[this.drops.length - 1] as Drop;
    this.readyAt = last.at + 0.9;
    const pool = 'אבגדהוזחטיכלמנסעפצקרשת';
    for (let i = 0; i < DRIFTERS; i++) {
      const r = this.rng;
      this.drifters.push({
        ch: pool[r.int(pool.length)] as string,
        x: r.range(-20, 20),
        y: r.range(4, 10),
        z: r.range(-14, 1),
        vx: r.range(-0.25, 0.25),
        vy: r.range(0.05, 0.18),
        phase: r.range(0, 6.28),
        size: r.range(0.7, 1.4),
        gold: 0,
        turnAt: 0,
      });
    }

    // --- The camera flies in low across the page and rises to face the name.
    this.flight = new CatmullRomCurve3(
      [
        new Vector3(-31, 1.1, -3),
        new Vector3(-20, 1.5, 5),
        new Vector3(-9, 3.1, 13),
        new Vector3(2, 5.6, 17.5),
        this.finalCam,
      ],
      false,
      'catmullrom',
      0.5,
    );
  }

  start(run: RunConfig): void {
    void run;
    this.time = 0;
    if (this.reducedMotion) this.placeCamera(1);
    else this.placeCamera(0);
    this.ctx.rig.cut();
  }

  /** Jumps to the finished picture: every letter in place, the page restored, the menu due. */
  finish(): void {
    if (this.ready) return;
    for (const d of this.drops) {
      if (!d.landed) {
        d.trail?.stop();
        d.trail = null;
        d.landed = true;
        d.y = d.rest;
        d.pop = 1;
        this.landed++;
      }
    }
    this.time = Math.max(this.time, FLIGHT);
    this.ctx.materials.restoreAll(1, 0.8);
    this.ctx.audio.intensity(0.3);
    this.becomeReady();
  }

  update(dt: number): void {
    this.time += dt;
    const t = this.time;
    const vfx = this.ctx.vfx;
    for (const d of this.drops) {
      if (d.landed) {
        // A little squash and settle after landing.
        d.pop += (1 - d.pop) * Math.min(1, dt * 9);
        continue;
      }
      if (t < d.at) continue;
      if (!d.trail) {
        d.trail = vfx.trail(this.gold, d.big ? 0.32 : 0.14, 0.5, 2.6);
        d.vy = -6;
      }
      d.vy -= GRAVITY * dt;
      d.y += d.vy * dt;
      d.trail.emit(d.x, d.y, d.z);
      if (d.y <= d.rest) this.land(d);
    }
    // Once the name is whole, the forgotten letters turn gold one by one.
    for (const f of this.drifters) {
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      if (f.y > 12) f.y = 3;
      if (this.ready && f.gold < 1 && t >= f.turnAt) {
        if (f.gold === 0) vfx.burst(this.glints, f.x, f.y, f.z);
        f.gold = Math.min(1, f.gold + dt * 2.5);
      }
    }
    if (!this.ready && t >= this.readyAt) this.becomeReady();
    if (this.ready && this.rng.next() < dt * 5) vfx.burst(this.motes, 0, 4, -1);
  }

  frame(dt: number): void {
    const t = this.time;
    // Camera: the flight, then a slow breathing drift.
    if (!this.reducedMotion) this.placeCamera(Math.min(1, t / FLIGHT));
    // Letters.
    const glint = (t % 5.5) / 1.4;
    let i = 0;
    for (const d of this.drops) {
      if (t < d.at && !d.landed) {
        this.field.hide(i++);
        continue;
      }
      const s = d.size * (d.landed ? 0.8 + 0.2 / d.pop + (d.pop - 1) * 0.15 : 1);
      // A glint runs across the name every few seconds once it is whole.
      let glow = d.big ? 1.9 : 1.6;
      if (this.ready && d.big) {
        const k = (d.x / HE_ADVANCE + 2.5) / 5;
        const g = 1 - Math.min(1, Math.abs(glint - (1 - k)) * 3);
        glow += Math.max(0, g) * 1.4;
      }
      this.field.set(
        i++,
        d.ch,
        d.x,
        d.landed ? d.rest + (d.pop - 1) * 0.3 : d.y,
        d.z,
        s,
        this.gold,
        glow,
      );
    }
    for (const f of this.drifters) {
      const wob = Math.sin(t * 0.8 + f.phase) * 0.35;
      const color = f.gold > 0 ? this.gold : this.fade;
      this.field.set(
        i++,
        f.ch,
        f.x + wob,
        f.y,
        f.z,
        f.size,
        color,
        f.gold > 0 ? 0.6 + f.gold * 1.1 : 0.55,
      );
    }
    this.field.commit();
    // The candle flame flickers.
    const fl = 1 + Math.sin(t * 13) * 0.06 + Math.sin(t * 7.3) * 0.05;
    this.flame.scale.set(1, fl, 1);
    void dt;
  }

  onKey(ev: TypedKey): void {
    void ev;
  }

  dispose(): void {
    for (const d of this.drops) d.trail?.stop();
    this.drops.length = 0;
    this.drifters.length = 0;
    this.onReady = null;
  }

  private drop(ch: string, x: number, z: number, size: number, at: number, big: boolean): Drop {
    const rest = sheetHeight(x, z) + size * 0.44;
    return {
      ch,
      x,
      z,
      size,
      rest,
      at,
      y: DROP_FROM,
      vy: 0,
      landed: false,
      pop: 1,
      big,
      trail: null,
    };
  }

  private land(d: Drop): void {
    const { vfx, audio, rig, materials } = this.ctx;
    d.landed = true;
    d.y = d.rest;
    d.pop = d.big ? 1.35 : 1.2;
    d.trail?.stop();
    d.trail = null;
    this.landed++;
    const base = d.rest - d.size * 0.44;
    vfx.burst(this.splash, d.x, base + 0.1, d.z, 0, 1, 0, true);
    vfx.burst(this.sparks, d.x, base + 0.3, d.z, 0, 1, 0);
    vfx.shockwave(d.x, base + 0.06, d.z, d.big ? 4.5 : 1.8, this.gold, d.big ? 0.8 : 0.5);
    audio.play('key', this.landed * 3, d.ch);
    if (d.big) {
      vfx.restore(d.x, base, d.z, 10, 1.5);
      audio.play('impact-small');
      rig.shake(0.12);
      audio.intensity(Math.min(0.5, this.landed * 0.07));
      // The last Hebrew letter: the whole page remembers its color.
      if (this.drops.every((o) => !o.big || o.landed)) {
        materials.restoreAll(1, 2.2);
        audio.play('restore');
      }
    }
    if (this.landed === this.drops.length) audio.play('success');
  }

  private becomeReady(): void {
    if (this.ready) return;
    this.ready = true;
    const t = this.time;
    this.drifters.forEach((f, i) => (f.turnAt = t + 0.3 + i * 0.12));
    this.onReady?.();
  }

  /** Puts the camera at `u` (0..1) along the flight, held back on narrow screens. */
  private placeCamera(u: number): void {
    const k = easeInOut(u);
    this.flight.getPoint(k, this.cam);
    this.look.lerpVectors(this.lookFrom, this.lookTo, k);
    // Narrow screens (phones) need the camera further back to fit the whole name.
    const aspect = this.ctx.engine.camera.aspect || 1.6;
    const back = Math.min(2.6, Math.max(1, 1.55 / aspect));
    if (back > 1) {
      this.cam.sub(this.look).multiplyScalar(back).add(this.look);
      // Tall screens: the choices take the lower half, so the name rises into the upper one.
      this.look.y -= (back - 1) * 3.2 * k;
    }
    // After the flight, a slow breathing drift.
    if (u >= 1 && !this.reducedMotion) {
      this.cam.x += Math.sin(this.time * 0.21) * 0.9;
      this.cam.y += Math.sin(this.time * 0.17) * 0.25;
    }
    this.ctx.rig.fixed(this.cam, this.look);
  }

  private paint(g: BufferGeometry, fn: (x: number, z: number, c: Color) => void): void {
    const pos = g.getAttribute('position');
    const colors = new Float32Array(pos.count * 3);
    const c = new Color();
    for (let i = 0; i < pos.count; i++) {
      fn(pos.getX(i), pos.getZ(i), c);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new BufferAttribute(colors, 3));
  }
}
