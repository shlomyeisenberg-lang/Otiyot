// The intro (T12): Act 1 opens on a quiet street at night. The lamp-sign over the House of the
// Scribe ("בית הסופר") flickers and goes blank as the Forgetting drains the street of color; Reb
// Ezra comes out, gives the apprentice his spare quill, and Dyo climbs out of the inkwell. The
// apprentice writes the sign's first letter back, and color returns around the house.
// The cutscene itself (beats, lines, timing) is the pure CutscenePlayer from src/story; this
// scene frames each named shot, plays each cue, and moves the actors.

import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  Object3D,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Shape,
  SphereGeometry,
  Vector3,
  type Material,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  burstStyle,
  Character,
  easeInOut,
  LetterField,
  Rng,
  smoothstep,
  type BurstStyle,
  type GameScene,
  type QualityPreset,
  type RunConfig,
  type SceneContext,
  type Trail,
  type TypedKey,
} from '../../engine';
import { Dyo } from '../../game/dyo';
import { SIGN_TEXT, type ApprenticeLook, type Beat, type CutscenePlayer } from '../../story';
import { SKY, TINT } from './palette';

interface Shot {
  from: readonly [number, number, number];
  to: readonly [number, number, number];
  look: readonly [number, number, number];
  lookTo?: readonly [number, number, number];
}

/** The named camera shots the intro script asks for. */
export const SHOTS: Readonly<Record<string, Shot>> = {
  street: { from: [-24, 2.4, 13], to: [-11, 2.0, 11], look: [-6, 2.5, 0], lookTo: [-1, 2.6, 0] },
  'street-near': {
    from: [-9, 1.9, 10.5],
    to: [-5, 2.2, 9],
    look: [0, 2.6, 0],
    lookTo: [0, 2.9, 0],
  },
  sign: {
    from: [-2.6, 2.4, 6.6],
    to: [-1.2, 2.8, 5.4],
    look: [0, 3.2, 0.3],
    lookTo: [0, 3.3, 0.3],
  },
  'sign-close': { from: [-0.7, 3.0, 3.7], to: [0.5, 3.1, 3.3], look: [0, 3.3, 0.3] },
  door: {
    from: [2.3, 1.7, 6.3],
    to: [1.7, 1.6, 5.5],
    look: [-0.3, 1.6, 0.5],
    lookTo: [-0.5, 1.5, 1.2],
  },
  'two-shot': { from: [4.6, 1.9, 6.4], to: [4.1, 1.8, 5.9], look: [0.3, 1.45, 2.4] },
  'ezra-close': { from: [2.2, 1.85, 4.4], to: [1.9, 1.8, 4.1], look: [-0.8, 1.6, 1.9] },
  quill: { from: [1.5, 1.6, 5.6], to: [1.2, 1.5, 5.2], look: [0.3, 1.35, 2.5] },
  apprentice: { from: [-2.1, 1.85, 0.7], to: [-1.8, 1.8, 1.0], look: [1.5, 1.5, 3.2] },
  bench: { from: [4.7, 1.25, 3.3], to: [4.3, 1.1, 2.9], look: [3.0, 0.8, 1.0] },
  dyo: { from: [4.3, 1.3, 3.7], to: [4.0, 1.2, 3.35], look: [2.6, 0.8, 1.15] },
  'dyo-apprentice': { from: [4.0, 1.3, 5.4], to: [3.6, 1.35, 5.1], look: [1.9, 0.9, 3.0] },
  'sign-wide': { from: [3.5, 1.8, 7.2], to: [2.7, 2.0, 6.7], look: [0, 2.9, 0.3] },
  'crane-up': { from: [2, 2.4, 8], to: [7, 17, 27], look: [0, 2.6, 0], lookTo: [0, 0.5, -6] },
};

const SIGN_Y = 3.32;
const SIGN_Z = 0.36;
const LETTER = 0.64;
const ADVANCE = 0.41;
const EZRA_IN = new Vector3(0, 0, -1.2);
const EZRA_SPOT = new Vector3(-0.8, 0, 1.9);
const APPRENTICE_SPOT = new Vector3(1.5, 0, 3.2);
const INKWELL = new Vector3(3.1, 0.62, 1.0);
const BENCH_TOP = 0.62;
const DYO_SCALE = 0.62;

interface SignLetter {
  ch: string;
  x: number;
  /** 1 = lit gold, 0 = forgotten (hidden). */
  life: number;
  /** When it starts to flicker in the fading (seconds into the cue); -1: not fading. */
  goAt: number;
  back: boolean;
}

/** Gives a shape one color (or a gradient toward `bottom`), drops UVs, and un-indexes it for merging. */
function tint(g: BufferGeometry, color: number, bottom?: number): BufferGeometry {
  const geo = g.index ? g.toNonIndexed() : g;
  if (geo !== g) g.dispose();
  geo.deleteAttribute('uv');
  const pos = geo.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  const a = new Color(color);
  const b = new Color(bottom ?? color);
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    lo = Math.min(lo, pos.getY(i));
    hi = Math.max(hi, pos.getY(i));
  }
  const c = new Color();
  for (let i = 0; i < pos.count; i++) {
    c.copy(b).lerp(a, (pos.getY(i) - lo) / (hi - lo || 1));
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new BufferAttribute(colors, 3));
  return geo;
}

/** A gable roof: a triangle extruded front to back. */
function roof(w: number, h: number, d: number): BufferGeometry {
  const s = new Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(0, h);
  s.lineTo(-w / 2, 0);
  const g = new ExtrudeGeometry(s, { depth: d, bevelEnabled: false });
  g.translate(0, 0, -d);
  return g;
}

export class IntroScene implements GameScene {
  readonly id = 'intro';
  /** Lines and cues come from here; the scene reads its beat and progress each frame. */
  private player: CutscenePlayer | null = null;
  private ctx!: SceneContext;
  private readonly rng = new Rng(1948);
  private ezra!: Character;
  private apprentice!: Character;
  private dyo!: Dyo;
  private sign!: LetterField;
  private readonly letters: SignLetter[] = [];
  private door!: Group;
  private spillMat!: Material & { opacity: number };
  private quill!: Group;
  private readonly quillFrom = new Vector3();
  private readonly quillTo = new Vector3();
  private quillT = -1;
  private quillTrail: Trail | null = null;
  private strokeTrail: Trail | null = null;
  private strokeT = -1;
  private readonly strokeFrom = new Vector3();

  private time = 0;
  /** Seconds into the current cue. */
  private cueT = 0;
  private cue = '';
  private shot: Shot | null = null;
  private shotName = '';
  private shotLong = 1;
  private doorOpen = 0;
  private ezraWalk = -1;
  private ezraYaw = 0;
  private appYaw = 0;
  private dyoScale = 0;
  private dyoOut = false;
  private gold = 0;
  private fade = 0;
  private ink = 0;
  private readonly cam = new Vector3();
  private readonly look = new Vector3();
  private readonly v = new Vector3();
  private readonly v2 = new Vector3();
  private mist!: BurstStyle;
  private dust!: BurstStyle;
  private sparks!: BurstStyle;
  private fountain!: BurstStyle;
  private splash!: BurstStyle;
  private fireflies!: BurstStyle;

  constructor(private readonly look0: ApprenticeLook) {}

  /** Hands over the cutscene to frame. */
  direct(player: CutscenePlayer): void {
    this.player = player;
  }

  async load(ctx: SceneContext): Promise<void> {
    this.ctx = ctx;
    const { materials: kit, tracker, root } = ctx;
    this.gold = ctx.color('gold');
    this.fade = ctx.color('fade');
    this.ink = TINT.ink;

    ctx.audio.music('hub');
    ctx.audio.intensity(0.25);
    ctx.audio.ambience('crickets');
    ctx.audio.ambience('wind');
    ctx.audio.ambience('fire', 0, SIGN_Y, SIGN_Z);
    ctx.atmosphere.setPalette({ ...SKY[ctx.theme], fade: this.fade, ink: this.gold });
    ctx.atmosphere.groundAt = () => 0;
    ctx.atmosphere.setShadowRange(18);
    ctx.post.setGrade({
      exposure: ctx.theme === 'dark' ? 1.2 : 1.1,
      bloom: 1.35,
      bloomThreshold: 0.85,
      vignette: 0.58,
      godRays: 0.35,
      saturation: 1.05,
      shadowTint: 0xdcd8ff,
      lightTint: 0xfff0dc,
    });
    // The street starts with its colors; the Forgetting will drain them.
    ctx.materials.restoreAll(1, 0);

    this.mist = burstStyle({
      count: 6,
      color: this.fade,
      color2: 0xd8d4e8,
      intensity: 0.9,
      speed: [0.4, 1.4],
      spread: 0.6,
      life: [2.2, 3.6],
      size: [0.4, 0.9],
      gravity: -0.15,
      radius: 3,
    });
    this.dust = burstStyle({
      count: 14,
      color: this.fade,
      intensity: 1.1,
      speed: [0.3, 1.2],
      life: [0.8, 1.6],
      size: [0.05, 0.12],
      gravity: 1.2,
    });
    this.sparks = burstStyle({
      count: 28,
      color: this.gold,
      color2: 0xfff2c0,
      intensity: 3.2,
      speed: [1.5, 5],
      life: [0.45, 1.0],
      size: [0.04, 0.12],
      gravity: 3,
    });
    this.fountain = burstStyle({
      count: 70,
      color: this.gold,
      color2: ctx.color('techelet'),
      intensity: 3.2,
      speed: [3, 8],
      spread: 0.5,
      life: [0.9, 1.7],
      size: [0.05, 0.16],
      gravity: 5,
    });
    this.splash = burstStyle({
      count: 22,
      color: TINT.dyo,
      speed: [1.5, 3.5],
      spread: 0.5,
      life: [0.4, 0.8],
      size: [0.04, 0.1],
      gravity: 9,
    });
    this.fireflies = burstStyle({
      count: 1,
      color: 0xffe08a,
      color2: this.gold,
      intensity: 2.6,
      speed: [0.05, 0.3],
      life: [2, 4],
      size: [0.04, 0.08],
      gravity: -0.05,
      radius: 6,
    });

    this.buildWorld();
    this.buildHouse();

    // --- The sign's letters (one draw call), right to left.
    const chars = Array.from(SIGN_TEXT);
    this.sign = tracker.track(
      new LetterField(ctx.engine.atlas, kit, ctx.vfx.billboard, chars.length),
    );
    root.add(this.sign.mesh);
    chars.forEach((ch, i) => {
      if (ch === ' ') return;
      this.letters.push({
        ch,
        x: ((chars.length - 1) / 2 - i) * ADVANCE,
        life: 1,
        goAt: -1,
        back: false,
      });
    });

    // --- The cast.
    const l = this.look0;
    this.apprentice = new Character(kit, {
      robe: l.robe,
      hem: l.hem,
      trim: l.trim,
      skin: TINT.skin,
      ink: TINT.ink,
      headwear: l.headwear,
      height: 0.92,
      seed: 2,
    });
    this.ezra = new Character(kit, {
      robe: TINT.ezraRobe,
      hem: TINT.ezraHem,
      trim: TINT.ezraTrim,
      skin: TINT.skin,
      ink: TINT.ink,
      headwear: 'hat',
      beard: TINT.ezraBeard,
      height: 1.02,
      seed: 6,
    });
    this.apprentice.root.position.copy(APPRENTICE_SPOT);
    this.appYaw = Math.atan2(-APPRENTICE_SPOT.x, -APPRENTICE_SPOT.z);
    this.apprentice.root.rotation.y = this.appYaw;
    this.ezra.root.position.copy(EZRA_IN);
    this.ezraYaw = 0;
    for (const c of [this.apprentice, this.ezra]) {
      root.add(c.root);
      ctx.atmosphere.addBlob(c.root, 0.55);
    }
    this.dyo = new Dyo(kit, {
      body: TINT.dyo,
      shine: TINT.dyoShine,
      eye: TINT.dyoEye,
      pupil: TINT.ink,
    });
    this.dyo.root.position.copy(INKWELL);
    this.dyo.root.scale.setScalar(0.001);
    this.dyo.root.visible = false;
    root.add(this.dyo.root);

    // --- The spare quill: a long pale feather on a gold shaft, held by Ezra's hand at first.
    this.quill = new Group();
    const feather = tracker.track(kit.surface({ color: TINT.feather, restore: false, lift: 0.3 }));
    const rim = tracker.track(
      kit.surface({ color: TINT.rim, emissive: TINT.rim, emissiveIntensity: 0.6, restore: false }),
    );
    const vane = new Mesh(tracker.track(new SphereGeometry(1, 8, 5)), feather);
    vane.scale.set(0.05, 0.24, 0.012);
    vane.position.y = 0.2;
    const shaft = new Mesh(tracker.track(new CylinderGeometry(0.008, 0.012, 0.5, 5)), rim);
    shaft.position.y = 0.14;
    this.quill.add(vane, shaft);
    this.quill.visible = false;
    root.add(this.quill);

    this.onQuality(ctx.quality);
  }

  onQuality(preset: QualityPreset): void {
    const full = preset.shadows === 'cascaded';
    this.apprentice?.shadowDetail(full);
    this.ezra?.shadowDetail(full);
  }

  start(run: RunConfig): void {
    void run;
    this.time = 0;
    this.applyShot('street', 0);
    this.ctx.rig.cut();
  }

  /** A beat began: frame its shot, play its cue and its actions. */
  onBeat(beat: Beat): void {
    if (beat.shot && beat.shot !== this.shotName) {
      const next = SHOTS[beat.shot];
      if (next && this.shot) {
        // A big jump is a cut; a small one glides.
        const [ax, ay, az] = this.shot.to;
        const [bx, by, bz] = next.from;
        if (Math.hypot(ax - bx, ay - by, az - bz) > 5) this.ctx.rig.cut();
      }
      this.shotName = beat.shot;
      this.shot = next ?? null;
    }
    // Line beats wait for the player, so their camera drifts slowly over a longer time.
    this.shotLong = beat.say ? Math.max(beat.seconds, 7) : beat.seconds;
    if (beat.cue) this.startCue(beat.cue);
    for (const [who, action] of Object.entries(beat.act ?? {})) {
      if (who === 'ezra') this.ezra.play(action);
      else if (who === 'apprentice') this.apprentice.play(action);
    }
  }

  /** Every letter that is not written back yet is forgotten. */
  settle(): void {
    for (const l of this.letters) l.life = l.back ? 1 : 0;
  }

  update(dt: number): void {
    // The cutscene's clock runs with the world's, so cues and lines never drift apart.
    this.player?.update(dt);
    this.time += dt;
    this.cueT += dt;
    const vfx = this.ctx.vfx;
    const t = this.cueT;

    // Ezra walks out of the house to his spot, then turns to the sign.
    if (this.ezraWalk >= 0) {
      this.ezraWalk = Math.min(1, this.ezraWalk + dt / 2.3);
      const k = smoothstep(0, 1, this.ezraWalk);
      this.ezra.root.position.lerpVectors(EZRA_IN, EZRA_SPOT, k);
      this.ezra.speed = this.ezraWalk < 1 ? 1.25 : 0;
      this.ezraYaw = Math.atan2(EZRA_SPOT.x - EZRA_IN.x, EZRA_SPOT.z - EZRA_IN.z);
      if (this.ezraWalk >= 1) {
        this.ezraWalk = -1;
        this.ezraYaw = Math.atan2(-EZRA_SPOT.x, -EZRA_SPOT.z) + 0.35;
      }
    }
    this.turn(this.ezra.root, this.ezraYaw, dt);
    this.turn(this.apprentice.root, this.appYaw, dt);
    this.ezra.update(dt);
    this.apprentice.update(dt);

    // The door swings open and the warm light spills out.
    const doorWant = this.cue === 'ezra-out' || this.doorOpen > 0.5 ? 1 : 0;
    this.doorOpen += (doorWant - this.doorOpen) * Math.min(1, dt * 2.2);
    this.door.rotation.y = this.doorOpen * 1.75;
    this.spillMat.opacity = this.doorOpen * 0.3;

    // The Forgetting: each letter flickers, greys and is gone.
    if (this.cue === 'fading') {
      if (this.rng.next() < dt * 4) vfx.burst(this.mist, -6 + t * 2.4, 2.5, 1.5);
      for (const l of this.letters) {
        if (l.goAt < 0 || l.life <= 0) continue;
        const since = t - l.goAt;
        if (since > 0.45) {
          const before = l.life;
          l.life = Math.max(0, 1 - (since - 0.45) / 0.5);
          if (before > 0 && l.life === 0) {
            vfx.burst(this.dust, l.x, SIGN_Y, SIGN_Z + 0.1);
            this.ctx.audio.playAt('error', l.x, SIGN_Y, SIGN_Z);
          }
        }
      }
    }

    // The spare quill floats from Ezra's hand into the apprentice's.
    if (this.quillT >= 0) {
      this.quillT = Math.min(1, this.quillT + dt / 1.5);
      this.apprentice.quillTip.getWorldPosition(this.quillTo);
      const k = easeInOut(this.quillT);
      const q = this.quill;
      q.position.lerpVectors(this.quillFrom, this.quillTo, k);
      q.position.y += Math.sin(k * Math.PI) * 0.55;
      q.rotation.set(Math.sin(k * 9) * 0.3, k * Math.PI * 4, 0.4);
      this.quillTrail?.emit(q.position.x, q.position.y + 0.2, q.position.z);
      if (this.rng.next() < dt * 20)
        vfx.burst(this.fireflies, q.position.x, q.position.y, q.position.z);
      if (this.quillT >= 1) {
        this.quillT = -1;
        this.quillTrail?.stop();
        this.quillTrail = null;
        // From now on it is the apprentice's.
        this.apprentice.quillTip.add(q);
        q.position.set(0, -0.06, 0.06);
        q.rotation.set(0.9, 0, 0);
        vfx.burst(this.sparks, this.quillTo.x, this.quillTo.y, this.quillTo.z);
        this.ctx.audio.play('word');
        this.apprentice.play('cheer');
      }
    }

    // Dyo grows out of the inkwell, then lives his life.
    if (this.dyoOut) {
      this.dyoScale += (DYO_SCALE - this.dyoScale) * Math.min(1, dt * 6);
      this.dyo.root.scale.setScalar(this.dyoScale);
    }
    this.dyo.update(dt);

    // The first letter comes back: a gold stroke from the quill to the sign.
    if (this.strokeT >= 0) {
      this.strokeT += dt;
      const k = Math.min(1, this.strokeT / 0.9);
      const first = this.letters[0] as SignLetter;
      const x = this.strokeFrom.x + (first.x - this.strokeFrom.x) * k;
      const y = this.strokeFrom.y + (SIGN_Y - this.strokeFrom.y) * k + Math.sin(k * Math.PI) * 1.2;
      const z = this.strokeFrom.z + (SIGN_Z - this.strokeFrom.z) * k;
      this.strokeTrail?.emit(x, y, z);
      if (k >= 1 && !first.back) this.restoreFirst();
      if (this.strokeT > 1.4) {
        this.strokeTrail?.stop();
        this.strokeTrail = null;
        this.strokeT = -1;
      }
    }

    // Fireflies by the restored house; mist where the world is forgotten.
    if (this.letters[0]?.back && this.rng.next() < dt * 3) vfx.burst(this.fireflies, 0, 1.6, 2);
  }

  frame(dt: number): void {
    void dt;
    const p = this.player;
    // The camera: the beat's shot, eased along the beat.
    const s = this.shot;
    if (s && p) {
      const u = easeInOut(Math.min(1, p.time / Math.max(0.01, this.shotLong)));
      this.applyShotAt(s, u);
    }
    // The sign: lit letters glow and breathe; fading ones stutter like a failing lamp.
    const tt = this.time;
    for (let i = 0; i < this.letters.length; i++) {
      const l = this.letters[i] as SignLetter;
      if (l.life <= 0) {
        this.sign.hide(i);
        continue;
      }
      let glow = 1.7 + Math.sin(tt * 2.1 + i) * 0.12;
      let color = this.gold;
      if (this.cue === 'fading' && l.goAt >= 0 && !l.back) {
        const since = this.cueT - l.goAt;
        if (since > 0) {
          const flick = Math.sin(tt * 47 + i * 3.1) * Math.sin(tt * 23 + i) > 0.1 ? 1 : 0.25;
          glow = since < 0.45 ? glow * flick : 0.6 * l.life;
          if (since > 0.45) color = this.fade;
        }
      }
      if (l.back) glow = 2.6 + Math.sin(tt * 3) * 0.3;
      const size = LETTER * (0.75 + 0.25 * l.life);
      this.sign.set(i, l.ch, l.x, SIGN_Y, SIGN_Z, size, color, glow);
    }
    this.sign.commit();
  }

  onKey(ev: TypedKey): void {
    void ev;
  }

  dispose(): void {
    this.quillTrail?.stop();
    this.strokeTrail?.stop();
    this.quillTrail = null;
    this.strokeTrail = null;
    for (const c of [this.apprentice, this.ezra]) {
      if (!c) continue;
      this.ctx.atmosphere.removeBlob(c.root);
      c.dispose();
    }
    this.dyo?.dispose();
    this.letters.length = 0;
    this.player = null;
  }

  private startCue(cue: string): void {
    const { vfx, audio, materials } = this.ctx;
    // Whatever the fading had not finished is gone by the time anything else happens.
    if (this.cue === 'fading') this.settle();
    this.cue = cue;
    this.cueT = 0;
    switch (cue) {
      case 'night':
        audio.intensity(0.25);
        break;
      case 'fading': {
        // Right to left, the way the sign reads.
        this.letters.forEach((l, i) => (l.goAt = 0.9 + i * 0.5));
        materials.restoreAll(0, 4.2);
        audio.intensity(0);
        audio.play('whoosh');
        break;
      }
      case 'ezra-out':
        this.ezraWalk = 0;
        audio.play('ui-open');
        audio.intensity(0.12);
        break;
      case 'ezra-turns':
        this.ezraYaw = Math.atan2(APPRENTICE_SPOT.x - EZRA_SPOT.x, APPRENTICE_SPOT.z - EZRA_SPOT.z);
        this.appYaw = Math.atan2(EZRA_SPOT.x - APPRENTICE_SPOT.x, EZRA_SPOT.z - APPRENTICE_SPOT.z);
        break;
      case 'give-quill': {
        this.ezra.quillTip.getWorldPosition(this.quillFrom);
        this.quill.position.copy(this.quillFrom);
        this.quill.visible = true;
        this.quillT = 0;
        this.quillTrail = vfx.trail(this.gold, 0.08, 0.8, 2.4);
        audio.play('whoosh');
        break;
      }
      case 'inkwell-shakes':
        audio.playAt('key', INKWELL.x, INKWELL.y, INKWELL.z, 2);
        this.v.copy(INKWELL);
        vfx.burst(this.splash, this.v.x, this.v.y + 0.3, this.v.z, 0, 1, 0, true);
        break;
      case 'dyo-pops':
        this.dyo.root.visible = true;
        this.dyoOut = true;
        this.dyo.hop(2.55, BENCH_TOP, 1.15, 0.7, 0.6, 4.2, 3.6);
        vfx.burst(this.splash, INKWELL.x, INKWELL.y + 0.3, INKWELL.z, 0, 1, 0, true);
        audio.playAt('space', INKWELL.x, INKWELL.y, INKWELL.z);
        this.appYaw = Math.atan2(2.55 - APPRENTICE_SPOT.x, 1.15 - APPRENTICE_SPOT.z);
        break;
      case 'dyo-hops':
        this.dyo.hop(2.15, 0, 2.75, 0.8, 0.6, APPRENTICE_SPOT.x, APPRENTICE_SPOT.z);
        this.appYaw = Math.atan2(2.15 - APPRENTICE_SPOT.x, 2.75 - APPRENTICE_SPOT.z);
        break;
      case 'dyo-looks':
        this.dyo.face(0, 0);
        this.dyo.cheer(1);
        this.appYaw = Math.atan2(-APPRENTICE_SPOT.x, -APPRENTICE_SPOT.z);
        break;
      case 'first-letter': {
        this.appYaw = Math.atan2(-APPRENTICE_SPOT.x, -APPRENTICE_SPOT.z);
        this.apprentice.quillTip.getWorldPosition(this.strokeFrom);
        this.strokeT = 0;
        this.strokeTrail = vfx.trail(this.gold, 0.12, 1.0, 3);
        audio.play('whoosh');
        break;
      }
      case 'dyo-cheers':
        this.dyo.cheer(4);
        break;
      case 'act-title':
        audio.intensity(0.8);
        break;
    }
  }

  private restoreFirst(): void {
    const { vfx, audio, materials, rig } = this.ctx;
    const first = this.letters[0] as SignLetter;
    first.back = true;
    first.life = 1;
    vfx.burst(this.sparks, first.x, SIGN_Y, SIGN_Z);
    vfx.burst(this.fountain, first.x, SIGN_Y, SIGN_Z + 0.2, 0, 1, 0.4);
    vfx.shockwave(0, 0.05, 1.5, 24, this.gold, 2.2);
    vfx.impact(0.4, this.gold);
    rig.shake(0.1);
    // Color returns around the house; beyond it the town stays forgotten.
    materials.clearSweeps();
    vfx.restore(0, 0, 1.5, 22, 2.4);
    audio.play('restore');
    audio.play('perfect');
    audio.intensity(0.6);
    this.dyo.cheer(2);
  }

  private turn(o: Object3D, want: number, dt: number): void {
    let d = (want - o.rotation.y) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    else if (d < -Math.PI) d += Math.PI * 2;
    o.rotation.y += d * Math.min(1, dt * 5);
  }

  private applyShot(name: string, u: number): void {
    const s = SHOTS[name];
    if (!s) return;
    this.shot = s;
    this.shotName = name;
    this.applyShotAt(s, u);
  }

  private applyShotAt(s: Shot, u: number): void {
    this.cam.set(
      s.from[0] + (s.to[0] - s.from[0]) * u,
      s.from[1] + (s.to[1] - s.from[1]) * u,
      s.from[2] + (s.to[2] - s.from[2]) * u,
    );
    const lt = s.lookTo ?? s.look;
    this.look.set(
      s.look[0] + (lt[0] - s.look[0]) * u,
      s.look[1] + (lt[1] - s.look[1]) * u,
      s.look[2] + (lt[2] - s.look[2]) * u,
    );
    // Narrow screens (phones): step back a little so both people stay in the picture.
    const aspect = this.ctx.engine.camera.aspect || 1.6;
    const back = Math.min(1.8, Math.max(1, 1.4 / aspect));
    if (back > 1) this.cam.sub(this.look).multiplyScalar(back).add(this.look);
    this.ctx.rig.fixed(this.cam, this.look);
  }

  /** The street, the neighbors, the trees and the stars (a handful of draw calls). */
  private buildWorld(): void {
    const { materials: kit, tracker, root } = this.ctx;
    const r = this.rng;
    // Ground: a cobbled street in front, a patch of yard by the house, grass beyond.
    const land = new PlaneGeometry(150, 150, 60, 60).rotateX(-Math.PI / 2);
    const pos = land.getAttribute('position');
    const colors = new Float32Array(pos.count * 3);
    const a = new Color();
    const b = new Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const street = 1 - smoothstep(4.5, 6.5, Math.abs(z - 7));
      a.setHex(TINT.grass).lerp(b.setHex(TINT.yard), smoothstep(14, 4, Math.abs(z - 4)));
      a.lerp(b.setHex(r.next() < 0.5 ? TINT.street : TINT.streetDark), street * 0.9);
      void x;
      colors[i * 3] = a.r;
      colors[i * 3 + 1] = a.g;
      colors[i * 3 + 2] = a.b;
    }
    land.setAttribute('color', new BufferAttribute(colors, 3));
    const ground = new Mesh(
      tracker.track(land),
      tracker.track(kit.surface({ vertexColors: true })),
    );
    ground.receiveShadow = true;
    root.add(ground);

    // Neighbors: houses along both sides of the street, merged into one mesh; their lit
    // windows into another.
    const walls: BufferGeometry[] = [];
    const panes: BufferGeometry[] = [];
    const house = (
      x: number,
      z: number,
      w: number,
      hgt: number,
      d: number,
      back: boolean,
    ): void => {
      const flip = back ? -1 : 1;
      const wall = tint(new BoxGeometry(w, hgt, d), TINT.wall, TINT.wallDark);
      wall.translate(x, hgt / 2, z - (flip * d) / 2);
      walls.push(wall);
      const rf = tint(roof(w + 0.6, hgt * 0.5, d + 0.6), TINT.roof, TINT.roofDark);
      if (!back) rf.rotateY(Math.PI);
      rf.translate(x, hgt, back ? z + 0.3 : z - 0.3);
      walls.push(rf);
      const lit = r.next() < 0.75;
      if (lit) {
        const pane = new BoxGeometry(0.8, 0.95, 0.1);
        pane.deleteAttribute('uv');
        const pg = pane.toNonIndexed();
        pane.dispose();
        pg.translate(x + r.range(-w * 0.25, w * 0.25), hgt * 0.55, z + flip * 0.06);
        panes.push(pg);
      }
    };
    for (const x of [-25, -16.5, -9.5, 9.5, 16.5, 25]) {
      house(x, 0, r.range(5, 6.5), r.range(3.4, 4.6), 5.5, true);
    }
    for (const x of [-21, -11, 0, 11, 21]) {
      house(x + r.range(-1.5, 1.5), 14, r.range(5, 6.5), r.range(3.2, 4.2), 5, false);
    }
    // Cypress trees between the houses.
    for (const [x, z, s] of [
      [-6.4, -0.8, 1.1],
      [6.3, -1.2, 1.25],
      [-13.2, -1.5, 0.9],
      [13.4, -0.6, 1],
      [-4.5, 12.8, 0.9],
      [5.5, 13.2, 1.1],
    ] as const) {
      const cone = tint(new ConeGeometry(0.75 * s, 5.2 * s, 7), TINT.cypressLight, TINT.cypress);
      cone.translate(x, 2.6 * s + 0.3, z);
      walls.push(cone);
      const trunk = tint(new CylinderGeometry(0.12, 0.16, 0.6, 5), TINT.wood);
      trunk.translate(x, 0.3, z);
      walls.push(trunk);
    }
    const merged = mergeGeometries(walls, false);
    for (const g of walls) g.dispose();
    if (merged) {
      merged.computeVertexNormals();
      const m = new Mesh(tracker.track(merged), tracker.track(kit.surface({ vertexColors: true })));
      this.ctx.materials.caster(m);
      m.receiveShadow = true;
      root.add(m);
    }
    const lights = mergeGeometries(panes, false);
    for (const g of panes) g.dispose();
    if (lights) {
      const glow = tracker.track(
        kit.surface({
          color: TINT.window,
          emissive: TINT.window,
          emissiveIntensity: 1.3,
          restore: false,
        }),
      );
      root.add(new Mesh(tracker.track(lights), glow));
    }

    // Stars: one draw call of points, high on a dome.
    const n = 420;
    const stars = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const az = r.range(0, Math.PI * 2);
      const el = Math.asin(r.range(0.12, 1));
      stars[i * 3] = Math.cos(az) * Math.cos(el) * 260;
      stars[i * 3 + 1] = Math.sin(el) * 260;
      stars[i * 3 + 2] = Math.sin(az) * Math.cos(el) * 260;
    }
    const sg = new BufferGeometry();
    sg.setAttribute('position', new Float32BufferAttribute(stars, 3));
    const sm = new PointsMaterial({
      color: TINT.star,
      size: 1.6,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      fog: false,
    });
    root.add(new Points(tracker.track(sg), tracker.track(sm)));
  }

  /** The House of the Scribe: walls, roof, door, windows, the lamp-sign, the bench and inkwell. */
  private buildHouse(): void {
    const { materials: kit, tracker, root } = this.ctx;
    const parts: BufferGeometry[] = [];
    const add = (
      g: BufferGeometry,
      color: number,
      x: number,
      y: number,
      z: number,
      bottom?: number,
    ): void => {
      const t = tint(g, color, bottom);
      t.translate(x, y, z);
      parts.push(t);
    };
    add(new BoxGeometry(7.2, 4.4, 6), TINT.wall, 0, 2.2, -3, TINT.wallDark);
    const rf = roof(8.0, 2.3, 6.8);
    rf.translate(0, 0, 0.4);
    add(rf, TINT.roof, 0, 4.4, 0, TINT.roofDark);
    // Door frame, step, sign board and its bracket, the bench.
    add(new BoxGeometry(1.7, 2.75, 0.14), TINT.stone, 0, 1.37, 0.03);
    add(new BoxGeometry(2.0, 0.16, 0.8), TINT.stone, 0, 0.08, 0.35);
    add(new BoxGeometry(4.4, 0.92, 0.14), TINT.board, 0, SIGN_Y, SIGN_Z - 0.16, TINT.woodDark);
    add(new BoxGeometry(4.6, 0.08, 0.2), TINT.woodDark, 0, SIGN_Y + 0.5, SIGN_Z - 0.14);
    add(new BoxGeometry(1.9, 0.1, 0.62), TINT.wood, 2.7, BENCH_TOP - 0.05, 1.0);
    add(new BoxGeometry(0.12, 0.52, 0.5), TINT.woodDark, 1.9, 0.26, 1.0);
    add(new BoxGeometry(0.12, 0.52, 0.5), TINT.woodDark, 3.5, 0.26, 1.0);
    const merged = mergeGeometries(parts, false);
    for (const g of parts) g.dispose();
    if (merged) {
      merged.computeVertexNormals();
      const m = new Mesh(tracker.track(merged), tracker.track(kit.surface({ vertexColors: true })));
      kit.caster(m);
      m.receiveShadow = true;
      root.add(m);
    }

    // The two windows and the lanterns at the ends of the sign glow warm.
    const glow = tracker.track(
      kit.surface({
        color: TINT.window,
        emissive: TINT.window,
        emissiveIntensity: 1.5,
        restore: false,
      }),
    );
    const pane = tracker.track(new BoxGeometry(1.1, 1.2, 0.1));
    for (const x of [-2.4, 2.4]) {
      const w = new Mesh(pane, glow);
      w.position.set(x, 2.1, 0.03);
      root.add(w);
    }
    const lamp = tracker.track(
      kit.surface({
        color: TINT.lamp,
        emissive: TINT.lamp,
        emissiveIntensity: 2.6,
        restore: false,
      }),
    );
    const lantern = tracker.track(new BoxGeometry(0.22, 0.32, 0.22));
    for (const x of [-2.45, 2.45]) {
      const l = new Mesh(lantern, lamp);
      l.position.set(x, SIGN_Y, SIGN_Z - 0.05);
      root.add(l);
    }

    // The door, hinged on its left, and the warm room behind it.
    const inside = tracker.track(
      kit.surface({
        color: TINT.lamp,
        emissive: TINT.lamp,
        emissiveIntensity: 1.2,
        restore: false,
      }),
    );
    const room = new Mesh(tracker.track(new PlaneGeometry(1.3, 2.45)), inside);
    room.position.set(0, 1.25, -0.02);
    root.add(room);
    this.door = new Group();
    this.door.position.set(-0.65, 0, 0.1);
    const wood = tracker.track(kit.surface({ color: TINT.wood }));
    const slab = kit.caster(new Mesh(tracker.track(new BoxGeometry(1.3, 2.45, 0.1)), wood));
    slab.position.set(0.65, 1.25, 0);
    this.door.add(slab);
    root.add(this.door);
    this.spillMat = tracker.track(
      kit.surface({
        color: TINT.lamp,
        emissive: TINT.lamp,
        emissiveIntensity: 0.9,
        transparent: true,
        opacity: 0,
        restore: false,
      }),
    );
    const spill = new Mesh(
      tracker.track(new PlaneGeometry(1.6, 3.2).rotateX(-Math.PI / 2)),
      this.spillMat,
    );
    spill.position.set(0, 0.03, 1.8);
    root.add(spill);

    // The inkwell on the bench: Dyo's home.
    const glass = tracker.track(
      kit.surface({ color: TINT.glass, emissive: TINT.dyoShine, emissiveIntensity: 0.15 }),
    );
    const rim = tracker.track(
      kit.surface({ color: TINT.rim, emissive: TINT.rim, emissiveIntensity: 0.4 }),
    );
    const well = kit.caster(
      new Mesh(tracker.track(new CylinderGeometry(0.13, 0.17, 0.24, 10)), glass),
    );
    well.position.set(INKWELL.x, BENCH_TOP + 0.12, INKWELL.z);
    const lip = new Mesh(tracker.track(new CylinderGeometry(0.09, 0.1, 0.05, 10)), rim);
    lip.position.y = 0.14;
    well.add(lip);
    root.add(well);
  }
}
