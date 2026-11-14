// Cliffs of Ein Gedi (T15): the second region of Act 1.
//
// A golden afternoon over a dry canyon in the Judean desert. The Fading has stopped the four
// waterfalls and drained the color from the rock. A line of stepping stones leads across the
// canyon to the summit, where Reb Ezra waits. Every word is one stone: a word that lives on the
// top row makes the scribe reach UP (the next stone stands higher and the camera lifts its eyes
// to it), a word on the bottom row makes him reach DOWN (the next stone is lower, the camera
// looks down), a home-row word is a level step. Every right letter sends ink up the stone's
// pillar; every finished word hops the scribe to the next stone and the color sweeps ahead of
// him; at the end of each quarter of the run a waterfall starts again and an ibex returns to
// the ledges. The last word restores the whole canyon.
//
// There are no timers and nothing attacks: the only thing in the way is the grey itself. The
// typing is judged by the host (PlayController); this scene only reacts, and learns the shape of
// the run from `begin(plan)`.

import {
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  BoxGeometry,
  DodecahedronGeometry,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  Object3D,
  PlaneGeometry,
  Quaternion,
  TorusGeometry,
  Vector3,
  type Material,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  burstStyle,
  Character,
  damp,
  easeOutBack,
  Rng,
  smoothstep,
  WorldText,
  type AmbienceHandle,
  type BurstStyle,
  type GameScene,
  type QualityPreset,
  type SceneContext,
  type Trail,
  type TypedKey,
} from '../../engine';
import { tierIntensity } from '../../audio/composer';
import { Dyo } from '../../game/dyo';
import { TypingFeedback } from '../../game/feedback';
import { Flyers } from '../meadow/flyers';
import { SKY, TINT } from './palette';
import {
  fallsFlowing,
  ibexBack,
  SECTIONS,
  type ChapterId,
  type CliffsPlan,
  type Reach,
} from './plan';

export interface CliffsSetup {
  /** The apprentice's robe (the profile's avatar). */
  look: {
    robe: number;
    hem: number;
    trim: number;
    headwear: 'cap' | 'hat' | 'turban';
    feather?: number;
    shaft?: number;
  };
}

/** Things the screen may want to say something about. */
export type CliffsMoment = 'fall' | 'fallAgain' | 'ibex' | 'reachUp' | 'reachDown';

// --- The lay of the land.
const FLOOR = -7;
const RIVER_Y = -6.2;
const STONE_Z0 = -0.4;
const STONE_DZ = 2.75;
const MAX_STONES = 21;
const PILLAR_R = 1.05;
const WORD_UP = 3.5;
const LETTER_SIZE = 1.0;
const FALL_STREAKS = 44;
const FALL_PROFILE = 33;
const IBEX_MAX = SECTIONS + 1;
const BIRDS = 5;
const BOULDERS = 46;
const TREES = 16;
const REEDS = 90;
const HOP_SECONDS = 0.5;
const UP = new Vector3(0, 1, 0);

/** The middle line of the canyon at depth z. */
function center(z: number): number {
  return 2.2 * Math.sin(z * 0.06);
}

function terrain(x: number, z: number): number {
  const d = Math.abs(x - center(z));
  // The start ledge: level ground at the near end, sloping down into the canyon.
  const floor = FLOOR + 7 * smoothstep(-0.8, 2.4, z);
  const ridge = 22 + 4 * Math.sin(z * 0.11 + x * 0.05) + 2.5 * Math.sin(x * 0.21 + 1);
  const wall = smoothstep(7.5, 18, d);
  let h = floor + wall * (ridge - floor);
  // Terraces: the sandstone breaks into steps.
  h += wall * (1 - wall) * 1.6 * Math.sin(h * 0.9 + z * 0.05);
  // The canyon closes at the far end, and a low rim runs along the near end.
  h += smoothstep(-70, -98, z) * 34;
  if (z > 12) h += smoothstep(12, 30, z) * 16;
  return h;
}

/** The ground of a stone's pillar and where it stands. */
function stoneX(i: number, z: number): number {
  return center(z) + Math.sin(i * 0.9 + 0.4) * 1.5;
}
function stoneZ(i: number): number {
  return STONE_Z0 - i * STONE_DZ;
}

function painted(geo: BufferGeometry, hex: number): BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (g !== geo) geo.dispose();
  const n = g.getAttribute('position').count;
  const c = new Color(hex);
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new BufferAttribute(colors, 3));
  g.deleteAttribute('uv');
  return g;
}

function merged(parts: BufferGeometry[]): BufferGeometry {
  const out = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  return out ?? new BufferGeometry();
}

/** Collects instances while the scene is built; one draw call when done. */
class Batch {
  private readonly mats: Matrix4[] = [];
  private readonly cols: number[] = [];
  add(p: Vector3, q: Quaternion, s: Vector3, color = 0xffffff): void {
    this.mats.push(new Matrix4().compose(p, q, s));
    this.cols.push(color);
  }
  build(geo: BufferGeometry, mat: Material): InstancedMesh {
    const mesh = new InstancedMesh(geo, mat, Math.max(1, this.mats.length));
    const c = new Color();
    this.mats.forEach((m, i) => {
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, c.setHex(this.cols[i] as number));
    });
    mesh.count = this.mats.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    return mesh;
  }
}

export class CliffsScene implements GameScene {
  readonly id = 'cliffs';
  /** Told when something worth a line happens (a waterfall starts, an ibex comes back). */
  onMoment: ((moment: CliffsMoment) => void) | null = null;

  private ctx!: SceneContext;
  private readonly rng = new Rng(2030);
  private plan: CliffsPlan | null = null;
  private apprentice!: Character;
  private ezra!: Character;
  private dyo!: Dyo;
  private text!: WorldText;
  private feedback!: TypingFeedback;
  private quillTrail: Trail | null = null;
  private shownLetters: readonly string[] | null = null;

  // The stones: pillars (scaled in y to reach their height) and their caps.
  private pillars!: InstancedMesh;
  private caps!: InstancedMesh;
  private summit!: Group;
  private beacon!: Mesh;
  private readonly stoneY = new Float32Array(MAX_STONES);
  private stones = 0;
  private stone = 0;

  // The apprentice's hop from stone to stone.
  private hopT = 1;
  private readonly hopFrom = new Vector3();
  private readonly hopTo = new Vector3();
  private hopHeight = 0.7;

  // Waterfalls and ibex.
  private falls!: InstancedMesh;
  private readonly fallX = new Float32Array(SECTIONS);
  private readonly fallZ = new Float32Array(SECTIONS);
  private readonly fallSide = new Float32Array(SECTIONS);
  private readonly fallLip = new Float32Array(SECTIONS);
  private readonly fallProfile = new Float32Array(SECTIONS * FALL_PROFILE);
  private readonly fallFlow = new Float32Array(SECTIONS);
  private readonly fallPhase = new Float32Array(FALL_STREAKS);
  private readonly fallAmbience: (AmbienceHandle | null)[] = [];
  private flowing = 0;
  private ibexMesh!: InstancedMesh;
  private readonly ibexX = new Float32Array(IBEX_MAX);
  private readonly ibexZ = new Float32Array(IBEX_MAX);
  private readonly ibexSide = new Float32Array(IBEX_MAX);
  private readonly ibexShown = new Float32Array(IBEX_MAX);
  private ibexWant = 0;
  private birds!: Flyers;

  private lettersDone = 0;
  private wordsDone = 0;
  private chapter: ChapterId | 'finale' = 'ledge';
  private finished = false;
  private heardTier = 0;
  private time = 0;
  private finaleT = -1;
  private dustTimer = 0;
  private spoke = { up: false, down: false };
  private dyoRest = 0;

  private readonly camTarget = new Object3D();
  private tilt = 0;
  private orbit = 0;

  private gold = 0;
  private techelet = 0;
  private paper = 0;
  private inkDark = 0;
  private sparks!: BurstStyle;
  private fountain!: BurstStyle;
  private motes!: BurstStyle;
  private mist!: BurstStyle;
  private spray!: BurstStyle;
  private dust!: BurstStyle;

  private readonly v = new Vector3();
  private readonly v2 = new Vector3();
  private readonly m4 = new Matrix4();
  private readonly q = new Quaternion();
  private readonly s = new Vector3();

  constructor(private readonly setup: CliffsSetup) {}

  // ---- probes (the screen and the smoke test read these) -------------------------------------

  /** Waterfalls flowing right now (0..SECTIONS). */
  get fallsRunning(): number {
    return this.flowing;
  }

  /** Ibex back on the ledges. */
  get ibexOut(): number {
    return this.ibexWant;
  }

  /** The stone the scribe stands on (0 is the first). */
  get stoneIndex(): number {
    return this.stone;
  }

  /** Height of that stone. */
  get stoneHeight(): number {
    return this.stoneY[this.stone] as number;
  }

  get restored(): boolean {
    return this.finished;
  }

  /** The way the scribe is reaching for the word he is typing. */
  get reaching(): Reach {
    return this.plan?.reaches[this.wordsDone] ?? 'level';
  }

  // ---- loading ------------------------------------------------------------------------------

  async load(ctx: SceneContext): Promise<void> {
    this.ctx = ctx;
    const { materials: kit, tracker, root } = ctx;
    const r = this.rng;
    this.gold = ctx.color('gold');
    this.techelet = ctx.color('techelet');
    this.paper = ctx.theme === 'light' ? ctx.color('surface') : ctx.color('ink');
    this.inkDark = ctx.theme === 'light' ? ctx.color('ink') : ctx.color('bg');

    // Sound: the cliffs theme (its layers follow the streak) and a dry desert wind. Water is
    // silent until the waterfalls start again.
    ctx.audio.music('cliffs');
    ctx.audio.intensity(0);
    ctx.audio.ambience('wind');

    ctx.atmosphere.setPalette({ ...SKY[ctx.theme], fade: ctx.color('fade'), ink: this.gold });
    ctx.atmosphere.groundAt = terrain;
    ctx.atmosphere.setShadowRange(34);
    ctx.post.setGrade(
      ctx.theme === 'dark'
        ? { exposure: 1.2, saturation: 1.05, vignette: 0.5, godRays: 0.9 }
        : { exposure: 1.02, saturation: 1.12, vignette: 0.34, godRays: 0.95 },
    );
    ctx.rig.groundAt = terrain;

    this.sparks = burstStyle({
      count: 14,
      color: this.gold,
      color2: 0xfff2c0,
      intensity: 2.6,
      speed: [1.2, 3.6],
      life: [0.4, 0.9],
      size: [0.05, 0.13],
      gravity: 3,
    });
    this.fountain = burstStyle({
      count: 110,
      color: this.gold,
      color2: TINT.foam,
      intensity: 3,
      speed: [4, 11],
      spread: 0.4,
      life: [1, 2.1],
      size: [0.07, 0.2],
      gravity: 5,
    });
    this.motes = burstStyle({
      count: 1,
      color: 0xfff0c8,
      color2: this.gold,
      intensity: 1.7,
      speed: [0.05, 0.35],
      life: [3, 6],
      size: [0.035, 0.08],
      gravity: -0.1,
      radius: 12,
    });
    this.mist = burstStyle({
      count: 4,
      color: TINT.mist,
      speed: [0.3, 1.2],
      spread: 0.8,
      life: [1.1, 2.2],
      size: [0.25, 0.6],
      gravity: -0.7,
      radius: 0.9,
    });
    this.spray = burstStyle({
      count: 5,
      color: TINT.foam,
      color2: TINT.water,
      intensity: 1.6,
      speed: [0.6, 2.4],
      spread: 0.9,
      life: [0.6, 1.4],
      size: [0.1, 0.3],
      gravity: -0.3,
      radius: 1.2,
    });
    this.dust = burstStyle({
      count: 2,
      color: TINT.dust,
      color2: 0xffffff,
      intensity: 0.9,
      speed: [0.8, 2],
      spread: 0.5,
      life: [3, 6],
      size: [0.18, 0.5],
      gravity: 0,
      radius: 14,
    });

    this.buildGround();
    this.buildStones();
    this.buildFalls();
    this.buildScenery();
    this.buildIbex();

    this.birds = new Flyers(
      kit,
      tracker,
      root,
      {
        count: BIRDS,
        kind: 'bird',
        colors: [TINT.birdWing, TINT.bird],
        body: TINT.bird,
        size: 1.4,
        centerX: 0,
        centerZ: -22,
        roam: [10, 34],
        height: [14, 22],
        groundAt: terrain,
      },
      r,
    );

    // --- The people. The apprentice starts on the near ledge; Reb Ezra waits at the summit.
    const l = this.setup.look;
    this.apprentice = new Character(kit, {
      robe: l.robe,
      hem: l.hem,
      trim: l.trim,
      skin: TINT.skin,
      ink: TINT.ink,
      headwear: l.headwear,
      feather: l.feather,
      shaft: l.shaft,
      quill: true,
      height: 0.92,
      seed: 4,
    });
    this.ezra = new Character(kit, {
      robe: TINT.ezraRobe,
      hem: TINT.ezraHem,
      trim: TINT.ezraTrim,
      skin: TINT.skin,
      ink: TINT.ink,
      headwear: 'hat',
      beard: TINT.ezraBeard,
      quill: true,
      height: 1.02,
      seed: 8,
    });
    this.dyo = new Dyo(kit, {
      body: TINT.dyo,
      shine: TINT.dyoShine,
      eye: TINT.dyoEye,
      pupil: TINT.ink,
    });
    this.dyo.root.scale.setScalar(0.62);
    root.add(this.apprentice.root, this.ezra.root, this.dyo.root);
    ctx.atmosphere.addBlob(this.apprentice.root, 0.5);
    ctx.atmosphere.addBlob(this.ezra.root, 0.55);
    ctx.atmosphere.addBlob(this.dyo.root, 0.25);

    // --- The word to type, on a parchment banner above the next stone.
    this.text = new WorldText({
      atlas: ctx.engine.atlas,
      materials: kit,
      billboard: ctx.vfx.billboard,
      colors: {
        ink: this.inkDark,
        paper: this.paper,
        stone: ctx.color('fade'),
        gold: this.gold,
        techelet: this.techelet,
        err: ctx.color('err-fg'),
      },
      style: 'banner',
      size: LETTER_SIZE,
    });
    root.add(this.text.root);
    this.feedback = new TypingFeedback(ctx, {
      gold: this.gold,
      ink: this.inkDark,
      techelet: this.techelet,
    });

    // --- Camera: follows the scribe from behind and above, looking up or down with the reach.
    root.add(this.camTarget);
    this.camTarget.position.set(0, 0, 3);
    ctx.rig.follow(this.camTarget, {
      distance: 17,
      height: 9.5,
      lookHeight: 0.4,
      stiffness: 2.6,
    });
    ctx.rig.cut();
    this.onQuality(ctx.quality);
    this.place(0);
  }

  private buildGround(): void {
    const { materials: kit, tracker, root } = this.ctx;
    const r = this.rng;
    const land = new PlaneGeometry(300, 300, 130, 130).rotateX(-Math.PI / 2);
    land.translate(0, 0, -35);
    const pos = land.getAttribute('position');
    const colors = new Float32Array(pos.count * 3);
    const a = new Color();
    const b = new Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = terrain(x, z);
      pos.setY(i, h);
      // Bands of sandstone by height, pale on the rim, dark and damp at the river.
      const band = Math.sin(h * 1.7 + Math.sin(x * 0.07) * 2) * 0.5 + 0.5;
      a.setHex(TINT.rockA).lerp(b.setHex(TINT.rockB), band);
      a.lerp(b.setHex(TINT.rockC), smoothstep(0.6, 1, Math.sin(h * 0.45 + z * 0.02)) * 0.7);
      a.lerp(b.setHex(TINT.rockTop), smoothstep(16, 26, h) * 0.65);
      a.lerp(b.setHex(TINT.riverBed), (1 - smoothstep(FLOOR, FLOOR + 1.6, h)) * 0.8);
      a.lerp(b.setHex(TINT.rockShade), r.next() * 0.12);
      colors[i * 3] = a.r;
      colors[i * 3 + 1] = a.g;
      colors[i * 3 + 2] = a.b;
    }
    land.setAttribute('color', new BufferAttribute(colors, 3));
    land.computeVertexNormals();
    const mesh = new Mesh(tracker.track(land), tracker.track(kit.surface({ vertexColors: true })));
    mesh.receiveShadow = true;
    root.add(mesh);

    // --- The river: a ribbon of water along the canyon floor.
    const segs = 70;
    const ribbon = new Float32Array((segs + 1) * 2 * 3);
    const index: number[] = [];
    for (let i = 0; i <= segs; i++) {
      const z = 4 - (i / segs) * 96;
      const c = center(z);
      const w = 3.4 + Math.sin(z * 0.2) * 0.8;
      ribbon.set([c - w, RIVER_Y, z, c + w, RIVER_Y, z], i * 6);
      if (i < segs) {
        const k = i * 2;
        index.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
      }
    }
    const water = new BufferGeometry();
    water.setAttribute('position', new BufferAttribute(ribbon, 3));
    water.setIndex(index);
    water.computeVertexNormals();
    const river = new Mesh(
      tracker.track(painted(water, TINT.water)),
      tracker.track(
        kit.surface({
          vertexColors: true,
          side: DoubleSide,
          emissive: TINT.waterDeep,
          emissiveIntensity: 0.12,
        }),
      ),
    );
    root.add(river);
  }

  private buildStones(): void {
    const { materials: kit, tracker, root } = this.ctx;
    const mat = tracker.track(kit.surface({ vertexColors: true }));
    const pillarGeo = painted(
      new CylinderGeometry(PILLAR_R * 0.9, PILLAR_R * 1.25, 1, 9, 1),
      TINT.stoneDark,
    );
    this.pillars = new InstancedMesh(tracker.track(pillarGeo), mat, MAX_STONES);
    this.pillars.count = 0;
    const capGeo = painted(
      new CylinderGeometry(PILLAR_R * 1.12, PILLAR_R * 1.02, 0.28, 9, 1),
      TINT.stone,
    );
    this.caps = new InstancedMesh(tracker.track(capGeo), mat, MAX_STONES);
    this.caps.count = 0;
    for (const m of [this.pillars, this.caps]) {
      m.receiveShadow = true;
      m.frustumCulled = false;
      kit.caster(m, true);
      root.add(tracker.track(m));
    }

    // The summit: a broad slab with a low cairn of gold-lit stones.
    this.summit = new Group();
    const slab = new Mesh(
      tracker.track(painted(new CylinderGeometry(3.4, 3.8, 0.5, 10, 1), TINT.summit)),
      tracker.track(kit.surface({ vertexColors: true })),
    );
    slab.position.y = -0.25;
    slab.receiveShadow = true;
    const cairn = new Mesh(
      tracker.track(
        merged([
          painted(new DodecahedronGeometry(0.55, 0).translate(0, 0.3, 0), TINT.stone),
          painted(new DodecahedronGeometry(0.4, 0).translate(0.1, 0.95, 0.05), TINT.stoneDark),
          painted(new DodecahedronGeometry(0.28, 0).translate(-0.05, 1.45, 0), TINT.stone),
        ]),
      ),
      tracker.track(kit.surface({ vertexColors: true })),
    );
    cairn.position.set(2.1, 0, -1);
    kit.caster(cairn, true);
    this.summit.add(slab, cairn);
    this.summit.visible = false;
    root.add(this.summit);

    // A gold ring floats on the next stone: where the next word will land.
    this.beacon = new Mesh(
      tracker.track(new TorusGeometry(0.8, 0.07, 6, 28).rotateX(Math.PI / 2)),
      tracker.track(kit.ink(this.gold, 1.6)),
    );
    this.beacon.visible = false;
    root.add(this.beacon);
  }

  private buildFalls(): void {
    const { materials: kit, tracker, root } = this.ctx;
    const streak = new BoxGeometry(0.62, 1.5, 0.12);
    this.falls = new InstancedMesh(
      tracker.track(streak),
      tracker.track(kit.ink(TINT.foam, 1.05)),
      SECTIONS * FALL_STREAKS,
    );
    this.falls.count = SECTIONS * FALL_STREAKS;
    this.falls.frustumCulled = false;
    const zero = this.m4.makeScale(0, 0, 0);
    for (let i = 0; i < SECTIONS * FALL_STREAKS; i++) this.falls.setMatrixAt(i, zero);
    root.add(tracker.track(this.falls));
    for (let i = 0; i < FALL_STREAKS; i++) this.fallPhase[i] = this.rng.next();
    for (let k = 0; k < SECTIONS; k++) this.fallAmbience.push(null);
  }

  private buildIbex(): void {
    const { materials: kit, tracker, root } = this.ctx;
    const body = (
      x: number,
      y: number,
      z: number,
      sx: number,
      sy: number,
      sz: number,
      c: number,
    ): BufferGeometry => painted(new BoxGeometry(sx, sy, sz).translate(x, y, z), c);
    const parts: BufferGeometry[] = [
      body(0, 0.85, 0, 0.42, 0.5, 1.15, TINT.ibex),
      body(0, 1.25, 0.62, 0.26, 0.55, 0.3, TINT.ibex),
      body(0, 1.55, 0.78, 0.24, 0.26, 0.4, TINT.ibex),
      body(0, 1.4, 0.98, 0.14, 0.1, 0.12, TINT.ibexDark),
      body(0, 0.95, -0.62, 0.1, 0.25, 0.1, TINT.ibexDark),
    ];
    for (const sx of [-0.14, 0.14]) {
      for (const sz of [-0.42, 0.42]) parts.push(body(sx, 0.3, sz, 0.1, 0.62, 0.1, TINT.ibexDark));
      // The long backswept horns, in three segments.
      parts.push(
        body(sx * 0.9, 1.78, 0.7, 0.07, 0.3, 0.07, TINT.horn),
        body(sx * 1.1, 2.0, 0.55, 0.07, 0.3, 0.07, TINT.horn),
        body(sx * 1.2, 2.1, 0.32, 0.07, 0.07, 0.3, TINT.horn),
      );
    }
    this.ibexMesh = new InstancedMesh(
      tracker.track(merged(parts)),
      tracker.track(kit.surface({ vertexColors: true })),
      IBEX_MAX,
    );
    this.ibexMesh.count = IBEX_MAX;
    this.ibexMesh.frustumCulled = false;
    kit.caster(this.ibexMesh, true);
    this.ibexMesh.castShadow = true;
    root.add(tracker.track(this.ibexMesh));
  }

  private buildScenery(): void {
    const { materials: kit, tracker, root } = this.ctx;
    const r = this.rng;
    const p = this.v;
    const q = this.q;
    const s = this.s;

    // Boulders on the ledges and the floor.
    const rocks = new Batch();
    for (let i = 0; i < BOULDERS; i++) {
      const z = r.range(8, -78);
      const side = r.next() < 0.5 ? -1 : 1;
      const x = center(z) + side * r.range(8, 16);
      p.set(x, terrain(x, z) - 0.2, z);
      q.setFromAxisAngle(UP, r.range(0, 6));
      const size = r.range(0.4, 1.3);
      s.set(size * r.range(0.9, 1.4), size, size * r.range(0.9, 1.4));
      rocks.add(p, q, s, r.next() < 0.5 ? TINT.rockB : TINT.rockC);
    }
    const rockMesh = rocks.build(
      painted(new DodecahedronGeometry(1, 0), 0xffffff),
      kit.surface({ vertexColors: true }),
    );
    kit.caster(rockMesh, true);
    rockMesh.receiveShadow = true;
    tracker.track(rockMesh.geometry);
    tracker.track(rockMesh.material as Material);
    root.add(tracker.track(rockMesh));

    // Acacias and reeds where the water is: the oasis that comes back with the color.
    const trunk = painted(new CylinderGeometry(0.1, 0.17, 2.2, 5).translate(0, 1.1, 0), TINT.bark);
    const crown = painted(
      new IcosahedronGeometry(1, 0).scale(1.7, 0.45, 1.7).translate(0, 2.5, 0),
      TINT.acacia,
    );
    const crown2 = painted(
      new IcosahedronGeometry(1, 0).scale(1.1, 0.35, 1.1).translate(0.4, 3.0, 0.1),
      TINT.acaciaLight,
    );
    const trees = new Batch();
    for (let i = 0; i < TREES; i++) {
      const z = r.range(10, -80);
      const side = i % 2 === 0 ? -1 : 1;
      const x = center(z) + side * r.range(5.4, 7.6);
      p.set(x, terrain(x, z), z);
      q.setFromAxisAngle(UP, r.range(0, 6));
      const size = r.range(0.8, 1.5);
      s.setScalar(size);
      trees.add(p, q, s);
    }
    const treeMesh = trees.build(
      merged([trunk, crown, crown2]),
      kit.surface({ vertexColors: true }),
    );
    kit.caster(treeMesh, true);
    tracker.track(treeMesh.geometry);
    tracker.track(treeMesh.material as Material);
    root.add(tracker.track(treeMesh));

    const reeds = new Batch();
    for (let i = 0; i < REEDS; i++) {
      const z = r.range(2, -85);
      const side = r.next() < 0.5 ? -1 : 1;
      const x = center(z) + side * r.range(3.6, 6.2);
      p.set(x, Math.max(terrain(x, z), RIVER_Y) - 0.05, z);
      q.setFromAxisAngle(UP, r.range(0, 6));
      const size = r.range(0.7, 1.4);
      s.set(size * 0.6, size, size * 0.6);
      reeds.add(p, q, s, r.next() < 0.5 ? TINT.reed : TINT.reedTip);
    }
    const reedGeo = painted(
      new CylinderGeometry(0.02, 0.09, 1.6, 4).translate(0, 0.8, 0),
      0xffffff,
    );
    const reedMesh = reeds.build(reedGeo, kit.surface({ vertexColors: true }));
    tracker.track(reedMesh.geometry);
    tracker.track(reedMesh.material as Material);
    root.add(tracker.track(reedMesh));
  }

  onQuality(preset: QualityPreset): void {
    const full = preset.shadows === 'cascaded';
    this.apprentice?.shadowDetail(full);
    this.ezra?.shadowDetail(full);
  }

  // ---- a run --------------------------------------------------------------------------------

  start(): void {
    this.reset();
  }

  /** Forgets everything: grey canyon, dry falls, no ibex, the scribe on the first stone. */
  private reset(): void {
    const { materials } = this.ctx;
    materials.clearSweeps();
    materials.restoreAll(0, 0);
    this.stones = 0;
    this.stone = 0;
    this.lettersDone = 0;
    this.wordsDone = 0;
    this.finished = false;
    this.finaleT = -1;
    this.heardTier = 0;
    this.shownLetters = null;
    this.flowing = 0;
    this.ibexWant = 0;
    this.spoke.up = false;
    this.spoke.down = false;
    this.fallFlow.fill(0);
    this.ibexShown.fill(0);
    this.birds.reset();
    for (let k = 0; k < SECTIONS; k++) {
      this.fallAmbience[k]?.stop();
      this.fallAmbience[k] = null;
    }
    this.summit.visible = false;
    this.beacon.visible = false;
    this.orbit = 0;
    this.ctx.rig.orbit = Math.PI;
    this.ctx.audio.intensity(0);
  }

  /** A new run with this plan (the screen calls it before the first key, and for every retry). */
  begin(plan: CliffsPlan): void {
    this.reset();
    this.plan = plan;
    this.chapter = plan.chapters[0]?.id ?? 'ledge';
    this.stones = Math.min(MAX_STONES, plan.heights.length);
    const n = this.stones;
    for (let i = 0; i < n; i++) this.stoneY[i] = plan.heights[i] as number;
    // Pillars and caps.
    this.pillars.count = n;
    this.caps.count = n;
    for (let i = 0; i < n; i++) this.writeStone(i, 1);
    this.pillars.instanceMatrix.needsUpdate = true;
    this.caps.instanceMatrix.needsUpdate = true;
    // The summit slab on the last stone, and Reb Ezra waiting on it.
    const last = n - 1;
    const sx = stoneX(last, stoneZ(last));
    const sz = stoneZ(last);
    this.summit.position.set(sx, this.stoneY[last] as number, sz);
    this.summit.visible = true;
    this.ezra.root.position.set(sx - 1.6, this.stoneY[last] as number, sz - 1.4);
    this.ezra.root.rotation.y = Math.atan2(0.8, 3);
    // The four waterfalls: at the end of each quarter, alternating sides.
    const total = plan.words.length;
    for (let k = 0; k < SECTIONS; k++) {
      const at = Math.max(1, Math.round(((k + 1) * total) / SECTIONS));
      const z = stoneZ(at) - 2;
      this.fallZ[k] = z;
      this.fallSide[k] = k % 2 === 0 ? -1 : 1;
      this.fallX[k] = center(z);
      this.buildProfile(k);
    }
    // Ibex stand on the ledges beside the falls, the last one near the summit.
    for (let k = 0; k < IBEX_MAX; k++) {
      const z = k < SECTIONS ? (this.fallZ[k] as number) + 4 : stoneZ(last) + 2;
      const side = k % 2 === 0 ? 1 : -1;
      this.ibexSide[k] = side;
      this.ibexZ[k] = z;
      this.ibexX[k] = center(z) + side * (8.6 + (k % 3));
    }
    this.place(0);
    this.setChapter(this.chapter);
  }

  /** Where the wall of fall `k` stands at each height (distance from the canyon's middle). */
  private buildProfile(k: number): void {
    const z = this.fallZ[k] as number;
    const side = this.fallSide[k] as number;
    const c = center(z);
    const lip = 15;
    this.fallLip[k] = lip;
    for (let j = 0; j < FALL_PROFILE; j++) {
      const y = RIVER_Y + ((lip - RIVER_Y) * j) / (FALL_PROFILE - 1);
      let d = 3;
      while (d < 24 && terrain(c + side * d, z) < y) d += 0.2;
      this.fallProfile[k * FALL_PROFILE + j] = d;
    }
  }

  private writeStone(i: number, grow: number): void {
    const y = this.stoneY[i] as number;
    const z = stoneZ(i);
    const x = stoneX(i, z);
    const height = Math.max(0.2, (y - FLOOR) * grow);
    this.v.set(x, FLOOR + height / 2, z);
    this.q.identity();
    this.s.set(1, height, 1);
    this.m4.compose(this.v, this.q, this.s);
    this.pillars.setMatrixAt(i, this.m4);
    this.v.set(x, FLOOR + height - 0.14, z);
    this.s.set(1, 1, 1);
    this.m4.compose(this.v, this.q, this.s);
    this.caps.setMatrixAt(i, this.m4);
  }

  /** Puts the scribe (and Dyo) on stone `i` at once. */
  private place(i: number): void {
    this.stone = i;
    const z = i === 0 && this.stones === 0 ? 2.8 : stoneZ(i);
    const x = i === 0 && this.stones === 0 ? center(z) : stoneX(i, z);
    const y = this.stones === 0 ? terrain(x, z) : (this.stoneY[i] as number);
    this.apprentice.root.position.set(x, y, z);
    this.apprentice.root.rotation.y = Math.PI;
    this.dyo.root.position.set(x + 1.1, y, z + 0.4);
    this.dyo.face(x, z - 3);
    this.hopT = 1;
    this.camTarget.position.set(x, y, z + 2);
    this.ctx.rig.cut();
  }

  private setChapter(id: ChapterId | 'finale'): void {
    this.chapter = id;
  }

  /** The chapter the camera is showing. */
  get view(): ChapterId | 'finale' {
    return this.chapter;
  }

  onKey(ev: TypedKey): void {
    const { typing, audio } = this.ctx;
    if (!ev.correct) {
      // A slip is soft: a stumble, a blink of grey, and on with the word.
      this.text.miss();
      this.feedback.wrong();
      audio.play('error');
      this.hearTier(typing.tier);
      return;
    }
    if (ev.kind !== 'char') return;
    if (ev.expected === ' ') {
      audio.play('space');
      return;
    }
    const at = this.text.letterPosition(ev.index, this.v2);
    this.text.hit(ev.index);
    this.feedback.correct(at.x, at.y, at.z, LETTER_SIZE, typing.tier);
    this.apprentice.play('write');
    audio.play('key', typing.combo, ev.expected);
    this.hearTier(typing.tier);
    this.lettersDone += 1;

    // A spark of ink on the next stone for every right letter.
    const next = Math.min(this.stones - 1, this.stone + 1);
    const z = stoneZ(next);
    this.ctx.vfx.burst(
      this.sparks,
      stoneX(next, z),
      (this.stoneY[next] as number) + 0.3,
      z,
      0,
      1,
      0,
    );
    // The first up- or down-reach of the run gets a word from Reb Ezra.
    if (ev.index === 0) {
      const reach = this.reaching;
      if (reach === 'up' && !this.spoke.up) {
        this.spoke.up = true;
        this.onMoment?.('reachUp');
      } else if (reach === 'down' && !this.spoke.down) {
        this.spoke.down = true;
        this.onMoment?.('reachDown');
      }
    }
  }

  /** The music builds with the combo tier; a new tier rings a chime. */
  private hearTier(tier: number): void {
    if (tier > this.heardTier) {
      this.ctx.audio.play('tier', tier);
      this.dyo.cheer(2 + tier);
      this.ctx.vfx.burst(
        this.fountain,
        this.apprentice.root.position.x,
        this.apprentice.root.position.y + 1,
        this.apprentice.root.position.z,
        0,
        1,
        0,
      );
    }
    this.heardTier = tier;
    this.ctx.audio.intensity(tierIntensity(tier));
  }

  onWord(_word: string, perfect: boolean): void {
    const plan = this.plan;
    if (!plan) return;
    const { vfx, audio } = this.ctx;
    this.wordsDone += 1;
    const total = plan.words.length;
    const reach = plan.reaches[this.wordsDone - 1] ?? 'level';
    // Hop to the next stone, higher or lower.
    const to = Math.min(this.stones - 1, this.stone + 1);
    const fromY = this.stoneY[this.stone] as number;
    const toY = this.stoneY[to] as number;
    const tz = stoneZ(to);
    const tx = stoneX(to, tz);
    this.hopFrom.copy(this.apprentice.root.position);
    this.hopTo.set(tx, toY, tz);
    this.hopHeight = 0.7 + Math.abs(toY - fromY) * 0.55 + (reach === 'up' ? 0.4 : 0);
    this.hopT = 0;
    this.stone = to;
    this.apprentice.root.rotation.y = Math.atan2(tx - this.hopFrom.x, tz - this.hopFrom.z);
    if (this.dyoRest <= 0) {
      this.dyo.hop(tx + 1.1, toY, tz + 0.5, 0.5, 0.55, tx, tz - 3);
      this.dyoRest = 0.6;
    }

    // Color sweeps out from the new stone, farther ahead as the run goes on.
    const radius = 14 + 4 * this.wordsDone;
    vfx.restore(tx, toY, tz, radius, 1.4);
    for (let k = 0; k < 5; k++) {
      const a = this.rng.range(0, Math.PI * 2);
      vfx.burst(
        this.mist,
        tx + Math.cos(a) * radius * 0.6,
        toY + 0.5,
        tz + Math.sin(a) * radius * 0.6,
        0,
        1,
        0,
        true,
      );
    }
    const a = this.text.anchor;
    this.feedback.word(a.x, a.y, a.z, perfect);
    audio.play('restore');
    audio.play(perfect ? 'perfect' : 'word');
    if (perfect && this.ctx.typing.tier >= 2) this.ezra.play('cheer');

    // At the end of each quarter, a waterfall starts again and an ibex comes back.
    const falls = fallsFlowing(this.wordsDone, total);
    if (falls > this.flowing) {
      const k = this.flowing;
      this.flowing = falls;
      const x =
        (this.fallX[k] as number) +
        (this.fallSide[k] as number) * ((this.fallProfile[k * FALL_PROFILE + 12] as number) - 0.4);
      this.fallAmbience[k] = audio.ambience('water', x, RIVER_Y + 2, this.fallZ[k] as number);
      vfx.burst(this.fountain, x, RIVER_Y + 1, this.fallZ[k] as number, 0, 1, 0);
      this.birds.show(Math.min(BIRDS, 1 + k * 2));
      this.onMoment?.(k === 0 ? 'fall' : 'fallAgain');
    }
    const ibex = ibexBack(this.wordsDone, total);
    if (ibex > this.ibexWant) {
      this.ibexWant = ibex;
      if (ibex === 1) this.onMoment?.('ibex');
    }
    if (this.wordsDone < total) this.setChapter(this.chapterNow());
  }

  private chapterNow(): ChapterId {
    const plan = this.plan;
    if (!plan) return 'ledge';
    for (const c of plan.chapters) if (this.wordsDone < c.to) return c.id;
    return plan.chapters.at(-1)?.id ?? 'summit';
  }

  /** The run is over. A whole run restores the canyon; a failed trial leaves it as it is. */
  finale(failed: boolean): void {
    if (this.finished || this.finaleT >= 0) return;
    if (failed) {
      this.ezra.play('stagger');
      return;
    }
    const { vfx, materials, audio } = this.ctx;
    this.finished = true;
    this.finaleT = 0;
    this.setChapter('finale');
    materials.restoreAll(1, 2.8);
    const p = this.apprentice.root.position;
    vfx.shockwave(p.x, p.y + 0.3, p.z, 90, this.gold, 2.4);
    vfx.burst(this.fountain, p.x, p.y + 1.4, p.z, 0, 1, 0);
    this.flowing = SECTIONS;
    this.ibexWant = IBEX_MAX;
    this.birds.show(BIRDS);
    audio.play('success');
    audio.intensity(1);
    this.apprentice.play('cheer');
    this.ezra.play('cheer');
    this.dyo.cheer(6);
    this.ctx.rig.pushIn(0.35, 0.4);
  }

  update(dt: number): void {
    this.time += dt;
    const { vfx } = this.ctx;
    this.dyoRest -= dt;

    // The scribe's hop: a smooth arc from one stone to the next.
    if (this.hopT < 1) {
      this.hopT = Math.min(1, this.hopT + dt / HOP_SECONDS);
      const t = this.hopT;
      const e = t * t * (3 - 2 * t);
      const p = this.apprentice.root.position;
      p.x = this.hopFrom.x + (this.hopTo.x - this.hopFrom.x) * e;
      p.z = this.hopFrom.z + (this.hopTo.z - this.hopFrom.z) * e;
      p.y =
        this.hopFrom.y +
        (this.hopTo.y - this.hopFrom.y) * e +
        Math.sin(Math.PI * t) * this.hopHeight;
      if (this.hopT >= 1) {
        p.y = this.hopTo.y;
        vfx.shockwave(p.x, p.y + 0.2, p.z, 1.6, this.gold, 0.5, true, 1.3);
        vfx.burst(this.dust, p.x, p.y + 0.2, p.z, 0, 0.4, 0);
        this.ctx.audio.playAt('impact', p.x, p.y, p.z, 0.3);
        this.apprentice.root.rotation.y = Math.PI;
      }
    }

    // Stones rise with their glow; waterfalls ramp up and fall.
    for (let k = 0; k < SECTIONS; k++) {
      const want = k < this.flowing ? 1 : 0;
      this.fallFlow[k] = damp(this.fallFlow[k] as number, want, 1.6, dt);
    }
    this.writeFalls();
    this.updateIbex(dt);
    this.birds.update(dt);

    this.apprentice.update(dt);
    this.ezra.update(dt);
    this.dyo.update(dt);

    // Ink flows from the quill while the apprentice writes.
    if (this.apprentice.anim.action === 'write') {
      if (!this.quillTrail) this.quillTrail = vfx.trail(this.gold, 0.14, 0.7, 2.4);
      this.apprentice.quillTip.getWorldPosition(this.v);
      this.quillTrail.emit(this.v.x, this.v.y, this.v.z);
    } else if (this.quillTrail) {
      this.quillTrail.stop();
      this.quillTrail = null;
    }

    // Dust drifts down the canyon in the low sun; spray rises where the water lands.
    const ap = this.apprentice.root.position;
    if ((this.dustTimer -= dt) <= 0) {
      this.dustTimer = this.finished ? 0.12 : 0.35;
      vfx.burst(this.motes, ap.x, ap.y + 2.4, ap.z - 3);
      vfx.burst(this.dust, ap.x, ap.y + 1, ap.z - 6);
      for (let k = 0; k < this.flowing; k++) {
        const x =
          (this.fallX[k] as number) +
          (this.fallSide[k] as number) * ((this.fallProfile[k * FALL_PROFILE] as number) - 1.2);
        vfx.burst(this.spray, x, RIVER_Y + 0.3, this.fallZ[k] as number, 0, 1, 0);
      }
    }
    if (this.finaleT >= 0) {
      const before = this.finaleT;
      this.finaleT += dt;
      if (before < 0.7 && this.finaleT >= 0.7)
        vfx.burst(this.fountain, ap.x - 3, ap.y + 1.4, ap.z - 4, 0, 1, 0);
      if (before < 1.4 && this.finaleT >= 1.4)
        vfx.burst(this.fountain, ap.x + 3, ap.y + 1.4, ap.z - 7, 0, 1, 0);
    }
  }

  /** The streaks of every running waterfall slide down the wall and fade at the pool. */
  private writeFalls(): void {
    let any = false;
    for (let k = 0; k < SECTIONS; k++) {
      const flow = this.fallFlow[k] as number;
      const side = this.fallSide[k] as number;
      const cx = this.fallX[k] as number;
      const z = this.fallZ[k] as number;
      const lip = this.fallLip[k] as number;
      for (let i = 0; i < FALL_STREAKS; i++) {
        const idx = k * FALL_STREAKS + i;
        if (flow < 0.01) {
          this.m4.makeScale(0, 0, 0);
          this.falls.setMatrixAt(idx, this.m4);
          continue;
        }
        any = true;
        const tt = ((this.fallPhase[i] as number) + this.time * 0.55) % 1;
        // tt 0 at the lip, 1 at the pool.
        const j = (1 - tt) * (FALL_PROFILE - 1);
        const j0 = Math.floor(j);
        const j1 = Math.min(FALL_PROFILE - 1, j0 + 1);
        const f = j - j0;
        const d0 = this.fallProfile[k * FALL_PROFILE + j0] as number;
        const d1 = this.fallProfile[k * FALL_PROFILE + j1] as number;
        const d = d0 + (d1 - d0) * f - 0.35;
        const spread = ((i * 7) % FALL_STREAKS) / FALL_STREAKS - 0.5;
        const y = lip - tt * (lip - RIVER_Y);
        this.v.set(cx + side * d, y, z + spread * 2.4);
        this.q.identity();
        const len = 0.8 + (0.7 * ((i * 5) % 7)) / 7;
        this.s.set(1, len * flow, 1);
        this.m4.compose(this.v, this.q, this.s);
        this.falls.setMatrixAt(idx, this.m4);
      }
    }
    if (any || this.flowing === 0) this.falls.instanceMatrix.needsUpdate = true;
  }

  private updateIbex(dt: number): void {
    for (let i = 0; i < IBEX_MAX; i++) {
      const shown = damp(this.ibexShown[i] as number, i < this.ibexWant ? 1 : 0, 2.4, dt);
      this.ibexShown[i] = shown;
      const x = this.ibexX[i] as number;
      const z = this.ibexZ[i] as number;
      const side = this.ibexSide[i] as number;
      this.v.set(x, terrain(x, z), z);
      this.q.setFromAxisAngle(UP, side > 0 ? -Math.PI / 2 : Math.PI / 2);
      const size = shown < 0.01 ? 0 : 0.95 * easeOutBack(Math.min(1, shown));
      this.s.setScalar(size);
      this.m4.compose(this.v, this.q, this.s);
      this.ibexMesh.setMatrixAt(i, this.m4);
    }
    this.ibexMesh.instanceMatrix.needsUpdate = true;
  }

  frame(dt: number): void {
    const { rig, typing } = this.ctx;
    const ap = this.apprentice.root.position;
    const reach = this.finished ? 'level' : this.reaching;

    // The camera rides behind the scribe and lifts or lowers its eyes with the reach.
    const want = reach === 'up' ? 1.8 : reach === 'down' ? -1.6 : 0;
    this.tilt = damp(this.tilt, want, 2.2, dt);
    const t = this.camTarget.position;
    t.x = damp(t.x, ap.x, 3, dt);
    t.y = damp(t.y, ap.y + this.tilt - 0.8, 2.4, dt);
    t.z = damp(t.z, ap.z - 1.2, 3, dt);
    this.orbit = damp(this.orbit, this.finished ? 0.55 : 0, 0.6, dt);
    // The follow camera looks toward +z by default; half a turn puts it behind the scribe.
    rig.orbit = Math.PI + this.orbit + Math.sin(this.time * 0.19) * 0.03;

    // The beacon rests on the stone that comes next; the banner floats above it.
    const next = Math.min(this.stones - 1, this.stone + 1);
    const nz = stoneZ(next);
    const nx = stoneX(next, nz);
    const ny = this.stoneY[next] as number;
    if (!this.finished && this.stones > 1 && this.stone < this.stones - 1) {
      this.beacon.visible = true;
      this.beacon.position.set(nx, ny + 0.38 + Math.sin(this.time * 3) * 0.05, nz);
      this.beacon.rotation.y = this.time;
    } else {
      this.beacon.visible = false;
    }
    const a = this.text.anchor;
    a.x = damp(a.x, nx * 0.6 + ap.x * 0.4, 3, dt);
    a.y = damp(a.y, Math.max(ap.y, ny) + WORD_UP - 0.6, 3, dt);
    a.z = damp(a.z, nz - 1.2, 3, dt);

    // The word to type: a new one rises when the driver moves on.
    if (typing.letters !== this.shownLetters) {
      this.shownLetters = typing.letters;
      const n = typing.letters.length;
      const end = n > 0 && typing.letters[n - 1] === ' ' ? n - 1 : n;
      this.text.setWord(typing.letters.slice(0, end), /[֐-׿]/.test(typing.word));
    }
    this.text.frame(dt, typing.states);
    this.feedback.frame(dt);
  }

  dispose(): void {
    this.quillTrail?.stop();
    this.quillTrail = null;
    for (let k = 0; k < this.fallAmbience.length; k++) {
      this.fallAmbience[k]?.stop();
      this.fallAmbience[k] = null;
    }
    if (this.ctx) {
      for (const c of [this.apprentice, this.ezra]) {
        if (!c) continue;
        this.ctx.atmosphere.removeBlob(c.root);
        c.dispose();
      }
      if (this.dyo) {
        this.ctx.atmosphere.removeBlob(this.dyo.root);
        this.dyo.dispose();
      }
    }
    this.text?.dispose();
    this.feedback?.dispose();
    this.shownLetters = null;
    this.onMoment = null;
    this.plan = null;
  }
}
