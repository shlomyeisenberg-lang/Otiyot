// The test range: a small plaza that shows every part of the engine kit at once (effects,
// animations, camera modes, fog, shadows, the restoration sweep) and doubles as the first real
// example of a GameScene. It is a developer's tool, reached by address only (#/range).
//
// The world starts forgotten (grey). The word to type stands above the dais as world text
// (carved, banner or hologram); every right key writes its letter in gold with an ink stroke,
// a wrong key makes the world blink grey, and finishing a word sends color racing outward from
// the scribe. The typing itself is judged by the host (PlayController); this scene only reacts.

import {
  Box3,
  BoxGeometry,
  CatmullRomCurve3,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  PlaneGeometry,
  Quaternion,
  Vector3,
  BufferAttribute,
  type BufferGeometry,
  type Material,
} from 'three';
import {
  ACTIONS,
  burstStyle,
  Character,
  Rng,
  smoothstep,
  type ActionName,
  type BurstStyle,
  type CameraMode,
  type GameScene,
  type QualityPreset,
  type RunConfig,
  type SceneContext,
  type Trail,
  type TextStyle,
  type TypedKey,
  WorldText,
} from '../../engine';
import { TypingFeedback } from '../../game/feedback';
import { SKY, TINT } from './palette';

export const RANGE_DEMOS = [
  'sweep',
  'shockwave',
  'sparks',
  'ink',
  'trail',
  'shatter',
  'flash',
  'impact',
  'pushIn',
  'forget',
] as const;
export type RangeDemo = (typeof RANGE_DEMOS)[number];

export const RANGE_CAMERAS: readonly CameraMode[] = ['follow', 'rail', 'cockpit'];

const LETTER_SIZE = 1.15;
const WORD_Y = 5.1;
const DAIS = 5.2;
const DAIS_TOP = 0.3;
const SWEEP_STAGES = [15, 30, 52] as const;

const UP = new Vector3(0, 1, 0);

/** Rolling ground outside the plaza, flat inside it. */
function terrain(x: number, z: number): number {
  const d = Math.hypot(x, z);
  const k = smoothstep(15, 42, d);
  return (
    k *
    (Math.sin(x * 0.085 + 1.3) * Math.cos(z * 0.07) * 2.4 +
      Math.sin(x * 0.19 - z * 0.16) * 0.7 +
      (d - 15) * 0.045)
  );
}

function ground(x: number, z: number): number {
  return x * x + z * z < DAIS * DAIS ? DAIS_TOP : terrain(x, z);
}

export class RangeScene implements GameScene {
  readonly id = 'range';
  /** Told which animation the elder is showing. */
  onAnimation: ((name: ActionName) => void) | null = null;

  private ctx!: SceneContext;
  private run: RunConfig | null = null;
  private readonly rng = new Rng(11);
  private scribe!: Character;
  private walker!: Character;
  private elder!: Character;
  private child!: Character;
  private text!: WorldText;
  private feedback!: TypingFeedback;
  private shownLetters: readonly string[] | null = null;
  private rail!: CatmullRomCurve3;
  private readonly colliders: Box3[] = [];

  private stage = 0;

  private time = 0;
  private walkerAngle = 0;
  private walkerSpeed = 0;
  private elderTimer = 1.2;
  private elderIndex = 0;
  private elderDown = 0;
  private moteTimer = 0;
  private penTime = -1;
  private penTrail: Trail | null = null;
  private quillTrail: Trail | null = null;
  private cameraMode: CameraMode = 'follow';

  private gold = 0;
  private techelet = 0;
  private paper = 0;
  private err = 0;
  private inkDark = 0;

  private sparks!: BurstStyle;
  private motes!: BurstStyle;
  private fountain!: BurstStyle;
  private droplets!: BurstStyle;
  private dust!: BurstStyle;

  private readonly v = new Vector3();
  private readonly v2 = new Vector3();
  private readonly seat = new Vector3(0, 1.66, 0.3);

  async load(ctx: SceneContext): Promise<void> {
    this.ctx = ctx;
    const { materials: kit, tracker, root } = ctx;
    this.gold = ctx.color('gold');
    this.techelet = ctx.color('techelet');
    this.err = ctx.color('err-fg');
    this.paper = ctx.theme === 'light' ? ctx.color('surface') : ctx.color('ink');
    this.inkDark = ctx.theme === 'light' ? ctx.color('ink') : ctx.color('bg');

    ctx.atmosphere.setPalette({ ...SKY[ctx.theme], fade: ctx.color('fade'), ink: this.gold });
    ctx.atmosphere.groundAt = ground;
    ctx.atmosphere.setShadowRange(24);
    ctx.post.setGrade(
      ctx.theme === 'dark' ? { exposure: 1.2, saturation: 0.96, vignette: 0.5, godRays: 0.7 } : {},
    );
    ctx.rig.groundAt = ground;

    this.sparks = burstStyle({
      count: 26,
      color: this.gold,
      color2: 0xfff2c0,
      intensity: 3,
      speed: [1.5, 5.5],
      life: [0.45, 1.0],
      size: [0.06, 0.16],
      gravity: 4,
    });
    this.fountain = burstStyle({
      count: 90,
      color: this.gold,
      color2: this.techelet,
      intensity: 3.2,
      speed: [4, 10],
      spread: 0.35,
      life: [0.9, 1.8],
      size: [0.07, 0.2],
      gravity: 6,
    });
    this.droplets = burstStyle({
      count: 60,
      color: this.inkDark,
      speed: [2, 7],
      spread: 0.7,
      life: [0.7, 1.3],
      size: [0.1, 0.3],
      gravity: 9,
    });
    this.motes = burstStyle({
      count: 1,
      color: this.gold,
      color2: 0xfff6d8,
      intensity: 2.2,
      speed: [0.05, 0.3],
      life: [2.5, 5],
      size: [0.04, 0.09],
      gravity: -0.15,
      radius: 9,
    });
    this.dust = burstStyle({
      count: 3,
      color: 0xd8c8a4,
      speed: [0.3, 1.1],
      spread: 0.9,
      life: [0.4, 0.8],
      size: [0.12, 0.26],
      gravity: -0.4,
    });

    // --- Ground: one sheet, colored per vertex.
    const land = new PlaneGeometry(190, 190, 64, 64).rotateX(-Math.PI / 2);
    const pos = land.getAttribute('position');
    const colors = new Float32Array(pos.count * 3);
    const a = new Color();
    const b = new Color();
    const r = this.rng;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = terrain(x, z);
      pos.setY(i, h);
      const d = Math.hypot(x, z);
      a.setHex(TINT.earthA).lerp(
        b.setHex(TINT.earthB),
        smoothstep(-0.5, 2.5, h + r.signed() * 0.6),
      );
      a.lerp(b.setHex(TINT.earthC), r.next() * 0.35);
      // A pale flagstone plaza around the dais.
      a.lerp(b.setHex(TINT.path), 1 - smoothstep(9, 15, d + r.signed() * 1.2));
      colors[i * 3] = a.r;
      colors[i * 3 + 1] = a.g;
      colors[i * 3 + 2] = a.b;
    }
    land.setAttribute('color', new BufferAttribute(colors, 3));
    land.computeVertexNormals();
    const earth = tracker.track(kit.surface({ vertexColors: true }));
    const landMesh = new Mesh(tracker.track(land), earth);
    landMesh.receiveShadow = true;
    root.add(landMesh);

    const stone = tracker.track(kit.surface({}));
    const dais = new Mesh(
      tracker.track(new CylinderGeometry(DAIS, DAIS + 0.45, DAIS_TOP, 16)),
      tracker.track(kit.surface({ color: TINT.stone })),
    );
    dais.position.y = DAIS_TOP / 2;
    dais.receiveShadow = true;
    root.add(dais);

    // --- Instanced scenery: each kind is one draw call.
    const m4 = new Matrix4();
    const q = new Quaternion();
    const s = new Vector3();
    const p = new Vector3();
    const tint = new Color();
    const scatter = (
      geo: BufferGeometry,
      mat: Material,
      count: number,
      place: (i: number) => boolean,
      shadow = true,
    ): InstancedMesh => {
      const mesh = new InstancedMesh(tracker.track(geo), mat, count);
      let n = 0;
      for (let i = 0; i < count; i++) {
        if (!place(i)) continue;
        m4.compose(p, q, s);
        mesh.setMatrixAt(n, m4);
        mesh.setColorAt(n, tint);
        n += 1;
      }
      mesh.count = n;
      kit.caster(mesh, shadow);
      mesh.receiveShadow = true;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
      root.add(tracker.track(mesh));
      return mesh;
    };

    // Standing stones around the dais; the camera must not pass through them.
    const heights: number[] = [];
    const pillarAt = (i: number): void => {
      const ang = (i / 7) * Math.PI * 2 + 0.3;
      p.set(Math.cos(ang) * 10.4, 0, Math.sin(ang) * 10.4);
    };
    scatter(new BoxGeometry(1, 1, 1), stone, 7, (i) => {
      const hgt = 2.6 + r.next() * 2.6;
      heights.push(hgt);
      pillarAt(i);
      p.y = hgt / 2;
      q.setFromAxisAngle(UP, r.signed() * 0.3);
      s.set(0.95, hgt, 0.95);
      tint.setHex(TINT.stone).lerp(b.setHex(TINT.stoneDark), r.next() * 0.6);
      this.colliders.push(
        new Box3(new Vector3(p.x - 0.7, 0, p.z - 0.7), new Vector3(p.x + 0.7, hgt, p.z + 0.7)),
      );
      return true;
    });
    scatter(new BoxGeometry(1, 1, 1), stone, 7, (i) => {
      pillarAt(i);
      p.y = (heights[i] as number) + 0.16;
      q.setFromAxisAngle(UP, r.signed() * 0.3);
      s.set(1.35, 0.32, 1.35);
      tint.setHex(TINT.stone);
      return true;
    });

    // A banner on each stone, facing the dais: techelet and gold in turn.
    scatter(
      new BoxGeometry(0.62, 1.7, 0.05),
      stone,
      7,
      (i) => {
        const ang = (i / 7) * Math.PI * 2 + 0.3;
        p.set(Math.cos(ang) * 9.86, (heights[i] as number) - 1.15, Math.sin(ang) * 9.86);
        q.setFromAxisAngle(UP, -ang + Math.PI / 2);
        s.set(1, 1, 1);
        tint.setHex(i % 2 === 0 ? this.techelet : this.gold);
        return true;
      },
      false,
    );

    const spot = (min: number, max: number): void => {
      const ang = r.next() * Math.PI * 2;
      const d = min + (max - min) * Math.sqrt(r.next());
      p.set(Math.cos(ang) * d, 0, Math.sin(ang) * d);
      p.y = terrain(p.x, p.z);
    };
    const leaf = tracker.track(kit.surface({}));
    const treeSpots: number[] = [];
    scatter(new ConeGeometry(1, 1, 6).translate(0, 0.5, 0), leaf, 54, () => {
      spot(13, 74);
      const hgt = 3.4 + r.next() * 3.6;
      treeSpots.push(p.x, p.y, p.z, hgt);
      p.y += 0.7;
      q.setFromAxisAngle(UP, r.next() * 6);
      s.set(0.75 + r.next() * 0.5, hgt, 0.75 + r.next() * 0.5);
      tint.setHex(TINT.cypress).lerp(b.setHex(TINT.cypressLight), r.next());
      return true;
    });
    scatter(new CylinderGeometry(0.16, 0.22, 1, 5).translate(0, 0.5, 0), leaf, 54, (i) => {
      p.set(
        treeSpots[i * 4] as number,
        (treeSpots[i * 4 + 1] as number) - 0.1,
        treeSpots[i * 4 + 2] as number,
      );
      q.identity();
      s.set(1, 1.1, 1);
      tint.setHex(TINT.trunk);
      return true;
    });
    scatter(new IcosahedronGeometry(1, 0), leaf, 38, () => {
      spot(11, 60);
      const k = 0.7 + r.next() * 1.1;
      p.y += k * 0.45;
      q.setFromAxisAngle(UP, r.next() * 6);
      s.set(k * 1.3, k * 0.8, k * 1.2);
      tint.setHex(TINT.olive).lerp(b.setHex(TINT.cypressLight), r.next() * 0.5);
      return true;
    });
    scatter(new DodecahedronGeometry(0.6, 0), stone, 46, () => {
      spot(6.5, 50);
      const k = 0.4 + r.next() * 1.3;
      p.y = ground(p.x, p.z) + k * 0.2;
      q.setFromAxisAngle(this.v.set(r.signed(), r.signed(), r.signed()).normalize(), r.next() * 3);
      s.set(k, k * 0.7, k * 1.1);
      tint.setHex(TINT.rock).lerp(b.setHex(TINT.stoneDark), r.next());
      return true;
    });
    // Anemones in the grass: the first thing to shine when color returns.
    scatter(
      new ConeGeometry(0.19, 0.17, 5).rotateX(Math.PI).translate(0, 0.26, 0),
      leaf,
      240,
      () => {
        spot(6.2, 40);
        p.y = ground(p.x, p.z) - 0.1;
        const k = 0.45 + r.next() * 0.4;
        q.setFromAxisAngle(UP, r.next() * 6);
        s.set(k, k, k);
        const pickTint = r.next();
        tint.setHex(
          pickTint < 0.7 ? TINT.anemone : pickTint < 0.86 ? TINT.anemoneWhite : TINT.anemoneViolet,
        );
        return true;
      },
      false,
    );

    // Far hills: big soft shapes for the fog to layer.
    scatter(
      new ConeGeometry(1, 1, 7).translate(0, 0.5, 0),
      leaf,
      16,
      (i) => {
        const ang = (i / 16) * Math.PI * 2 + r.signed() * 0.15;
        const d = 96 + r.next() * 40;
        p.set(Math.cos(ang) * d, -2, Math.sin(ang) * d);
        q.setFromAxisAngle(UP, r.next() * 6);
        s.set(26 + r.next() * 22, 12 + r.next() * 20, 26 + r.next() * 22);
        tint.setHex(TINT.hill).lerp(b.setHex(TINT.earthC), r.next() * 0.5);
        return true;
      },
      false,
    );

    // --- Characters.
    this.scribe = new Character(kit, {
      robe: TINT.scribeRobe,
      hem: TINT.scribeHem,
      trim: TINT.scribeTrim,
      skin: TINT.skin,
      ink: TINT.elderTrim,
      headwear: 'cap',
      quill: true,
    });
    this.walker = new Character(kit, {
      robe: TINT.walkerRobe,
      hem: TINT.walkerHem,
      trim: TINT.walkerTrim,
      skin: TINT.skinDeep,
      ink: TINT.elderTrim,
      headwear: 'turban',
      beard: TINT.walkerBeard,
      height: 0.95,
      seed: 3,
    });
    this.elder = new Character(kit, {
      robe: TINT.elderRobe,
      hem: TINT.elderHem,
      trim: TINT.elderTrim,
      skin: TINT.skin,
      ink: TINT.elderTrim,
      headwear: 'hat',
      beard: TINT.beard,
      height: 1.04,
      seed: 7,
    });
    this.child = new Character(kit, {
      robe: TINT.childRobe,
      hem: TINT.childHem,
      trim: TINT.childTrim,
      skin: TINT.skin,
      ink: TINT.elderTrim,
      headwear: 'cap',
      height: 0.68,
      seed: 5,
    });
    this.scribe.root.position.set(0, DAIS_TOP, 1.2);
    this.elder.root.position.set(-3.1, DAIS_TOP, -1.2);
    this.elder.root.rotation.y = 0.9;
    this.child.root.position.set(3.0, DAIS_TOP, -0.4);
    this.child.root.rotation.y = -0.8;
    for (const c of [this.scribe, this.walker, this.elder, this.child]) {
      root.add(c.root);
      ctx.atmosphere.addBlob(c.root, 0.62);
    }

    // --- The word to type, standing above the dais.
    this.text = new WorldText({
      atlas: ctx.engine.atlas,
      materials: kit,
      billboard: ctx.vfx.billboard,
      colors: {
        // A parchment banner and dark ink in both themes; light letters on the carved stone.
        ink: this.inkDark,
        paper: this.paper,
        stone: ctx.color('fade'),
        gold: this.gold,
        techelet: this.techelet,
        err: this.err,
      },
      style: 'banner',
      size: LETTER_SIZE,
    });
    this.text.anchor.set(0, WORD_Y, 0);
    root.add(this.text.root);
    this.feedback = new TypingFeedback(ctx, {
      gold: this.gold,
      ink: this.inkDark,
      techelet: this.techelet,
    });

    // --- Camera.
    this.onQuality(ctx.quality);

    this.rail = new CatmullRomCurve3(
      [
        new Vector3(15, 3.2, 10),
        new Vector3(6, 6.5, 19),
        new Vector3(-10, 4, 16),
        new Vector3(-19, 8, 2),
        new Vector3(-12, 3.4, -13),
        new Vector3(4, 5.5, -18),
        new Vector3(17, 9, -8),
      ],
      false,
      'catmullrom',
      0.5,
    );
    ctx.rig.colliders = this.colliders;
    this.setCamera('follow');
  }

  onQuality(preset: QualityPreset): void {
    // Thin limbs cast shadows only where there are draw calls to spare.
    const full = preset.shadows === 'cascaded';
    for (const c of [this.scribe, this.walker, this.elder, this.child]) c.shadowDetail(full);
  }

  start(run: RunConfig): void {
    this.run = run;
    this.rng.next();
    this.stage = 0;
    this.time = 0;
    this.shownLetters = null;
  }

  /** The word being typed (from the host's typing driver). */
  get currentWord(): string {
    return this.ctx.typing.word;
  }

  /** 0 (all forgotten) .. 4 (all restored). */
  get restoredStage(): number {
    return this.stage;
  }

  /** How the word to type stands in the world. */
  setTextStyle(style: TextStyle): void {
    this.text.setStyle(style);
  }

  get textStyle(): TextStyle {
    return this.text.style;
  }

  setCamera(mode: CameraMode): void {
    const rig = this.ctx.rig;
    this.cameraMode = mode;
    if (mode === 'rail') rig.rail(this.rail, { lookAt: this.scribe.root, stiffness: 3 });
    else if (mode === 'cockpit') rig.cockpit(this.walker.root, { seat: this.seat, sway: 0.5 });
    else
      rig.follow(this.scribe.root, { distance: 7.6, height: 2.2, lookHeight: 2.5, stiffness: 4 });
  }

  onKey(ev: TypedKey): void {
    const typing = this.ctx.typing;
    if (!ev.correct) {
      // Errors are brief and soft: a stumble and a blink of grey, never a block.
      this.text.miss();
      this.feedback.wrong();
      this.ctx.audio.play('error');
      return;
    }
    if (ev.kind !== 'char') return;
    if (ev.expected === ' ') {
      this.ctx.audio.play('space');
      return;
    }
    const at = this.text.letterPosition(ev.index, this.v);
    this.text.hit(ev.index);
    this.feedback.correct(at.x, at.y, at.z, LETTER_SIZE, typing.tier);
    this.scribe.play('write');
    this.ctx.audio.play('key', typing.combo);
  }

  onWord(word: string, perfect: boolean): void {
    const { vfx } = this.ctx;
    const o = this.scribe.root.position;
    if (this.stage < SWEEP_STAGES.length) {
      vfx.restore(o.x, 0.2, o.z, SWEEP_STAGES[this.stage] as number, 1.7);
    } else {
      this.ctx.materials.restoreAll(1, 2.2);
      vfx.shockwave(o.x, 0.4, o.z, 70, this.gold, 2.2);
    }
    this.stage = Math.min(this.stage + 1, SWEEP_STAGES.length + 1);
    vfx.burst(this.fountain, o.x, DAIS_TOP + 2, o.z, 0, 1, 0);
    const a = this.text.anchor;
    this.feedback.word(a.x, a.y, a.z, perfect);
    this.ctx.rig.pushIn(0.5, 0.35);
    this.child.play('cheer');
    this.ctx.audio.play('restore');
    if (perfect) this.ctx.hud.announce(word);
  }

  /** Shows one effect on request (the buttons of the test range). */
  demo(name: RangeDemo): void {
    const { vfx, rig } = this.ctx;
    const r = this.rng;
    const o = this.scribe.root.position;
    switch (name) {
      case 'sweep': {
        const ang = r.next() * Math.PI * 2;
        const d = 6 + r.next() * 16;
        vfx.restore(Math.cos(ang) * d, 0.3, Math.sin(ang) * d, 11 + r.next() * 6, 1.6);
        break;
      }
      case 'shockwave':
        vfx.shockwave(o.x, DAIS_TOP + 0.08, o.z, 16, this.techelet, 0.9);
        vfx.shockwave(o.x, 2.2, o.z, 4, this.gold, 0.6, false);
        break;
      case 'sparks':
        vfx.burst(this.fountain, o.x, DAIS_TOP + 0.4, o.z + 1.2, 0, 1, 0);
        break;
      case 'ink':
        vfx.burst(this.droplets, o.x, 2.4, o.z, 0, 1, 0, true);
        break;
      case 'trail':
        this.penTime = 0;
        this.penTrail = vfx.trail(this.gold, 0.34, 1.5, 2.4);
        break;
      case 'shatter':
        vfx.shatter(
          r.pick(this.ctx.typing.letters.length > 1 ? this.ctx.typing.letters.slice(0, -1) : ['א']),
          r.signed() * 3,
          2.2 + r.next() * 1.5,
          3 + r.signed(),
          2.6,
          r.next() < 0.5 ? this.gold : this.techelet,
          2.4,
          3.2,
        );
        break;
      case 'flash':
        vfx.flash(this.paper, 0.4, 0.4);
        break;
      case 'impact':
        vfx.impact(1, this.gold);
        this.elder.play('hit');
        break;
      case 'pushIn':
        rig.pushIn(1, 0.6);
        break;
      case 'forget':
        this.ctx.materials.clearSweeps();
        this.ctx.materials.restoreAll(0, 1.4);
        this.stage = 0;
        break;
    }
  }

  /** Plays one animation on the elder right away. */
  playAnimation(name: ActionName): void {
    this.elder.play(name);
    this.elderDown = 0;
    this.elderTimer = 3.2;
    this.onAnimation?.(name);
  }

  update(dt: number): void {
    this.time += dt;
    const { vfx } = this.ctx;

    // The walker circles the plaza: walk, run, rest.
    const cycle = this.time % 15;
    const want = cycle < 6 ? 1.5 : cycle < 11.5 ? 4.7 : 0;
    this.walkerSpeed += (want - this.walkerSpeed) * Math.min(1, dt * 2.5);
    this.walkerAngle += (this.walkerSpeed / 7.4) * dt;
    const wx = Math.cos(this.walkerAngle) * 7.4;
    const wz = Math.sin(this.walkerAngle) * 7.4;
    this.walker.root.position.set(wx, ground(wx, wz), wz);
    this.walker.root.rotation.y = -this.walkerAngle;
    this.walker.speed = this.walkerSpeed;
    if (this.walkerSpeed > 3.5 && (this.moteTimer += dt) > 0.12) {
      this.moteTimer = 0;
      vfx.burst(this.dust, wx, ground(wx, wz) + 0.1, wz, 0, 1, 0, true);
    }

    // The elder shows every action in turn.
    this.elderTimer -= dt;
    if (this.elder.anim.down) {
      this.elderDown += dt;
      if (this.elderDown > 1.3) {
        this.elder.anim.getUp();
        this.elderDown = 0;
        this.elderTimer = 1.6;
      }
    } else if (this.elderTimer <= 0 && !this.elder.anim.action) {
      const name = ACTIONS[this.elderIndex % ACTIONS.length] as ActionName;
      this.elderIndex += 1;
      this.elder.play(name);
      this.onAnimation?.(name);
      this.elderTimer = 2.4;
    }

    this.scribe.update(dt);
    this.walker.update(dt);
    this.elder.update(dt);
    this.child.update(dt);

    // Ink flows from the quill while the scribe writes.
    if (this.scribe.anim.action === 'write') {
      if (!this.quillTrail) this.quillTrail = vfx.trail(this.gold, 0.16, 0.7, 2.6);
      this.scribe.quillTip.getWorldPosition(this.v2);
      this.quillTrail.emit(this.v2.x, this.v2.y, this.v2.z);
    } else if (this.quillTrail) {
      this.quillTrail.stop();
      this.quillTrail = null;
    }

    // The demo pen draws a looping figure in the air.
    if (this.penTime >= 0 && this.penTrail) {
      this.penTime += dt;
      const t = this.penTime * 3.2;
      const x = Math.sin(t) * 4.2;
      const y = 2.9 + Math.sin(t * 2) * 1.3;
      const z = 2.6 + Math.cos(t) * 1.6;
      this.penTrail.emit(x, y, z);
      vfx.burst(this.motes, x, y, z);
      if (this.penTime > 2.6) {
        this.penTrail.stop();
        this.penTrail = null;
        this.penTime = -1;
      }
    }

    // Gold motes drift where the world has color again.
    if (this.stage > 0 && this.rng.next() < dt * 6 * this.stage) {
      vfx.burst(this.motes, 0, 2.5, 0);
    }
  }

  frame(dt: number): void {
    // Slow orbit in follow mode; a gentle glide along the rail.
    const rig = this.ctx.rig;
    if (this.cameraMode === 'follow') rig.orbit = Math.PI + 0.7 + 0.5 * Math.sin(this.time * 0.16);
    else if (this.cameraMode === 'rail') rig.railT = 0.5 - 0.5 * Math.cos(this.time * 0.11);

    // The word to type: a new one rises when the driver moves on.
    const typing = this.ctx.typing;
    if (typing.letters !== this.shownLetters) {
      this.shownLetters = typing.letters;
      const n = typing.letters.length;
      // The space that ends a word is typed but not drawn.
      const end = n > 0 && typing.letters[n - 1] === ' ' ? n - 1 : n;
      this.text.setWord(typing.letters.slice(0, end), /[\u0590-\u05ff]/.test(typing.word));
    }
    this.text.frame(dt, typing.states);
    this.feedback.frame(dt);
  }

  dispose(): void {
    this.quillTrail?.stop();
    this.penTrail?.stop();
    this.quillTrail = null;
    this.penTrail = null;
    for (const c of [this.scribe, this.walker, this.elder, this.child]) {
      if (!c) continue;
      this.ctx.atmosphere.removeBlob(c.root);
      c.dispose();
    }
    this.text?.dispose();
    this.feedback?.dispose();
    this.shownLetters = null;
    this.colliders.length = 0;
    this.onAnimation = null;
    this.run = null;
  }
}
