// Home Row Meadow (T14): the first region of the story and the pattern for every scene after it.
//
// A spring morning in a valley the Fading has left grey. In front of the apprentice lies a small
// garden of eight stone-rimmed beds in an arc, one for each home-row key, laid out exactly like
// the fingers that rest on them (left pinky on the left, a gap between the two hands, a gold
// stud on the two index beds like the bumps on the keys). Every right letter opens an anemone:
// in its own bed when it is a home-row key, and out in the grass beyond, flower after flower.
// Every finished word sends the green a step farther out from the garden; birds come back one
// by one, butterflies follow the color, and when the last word is typed the almond tree on the
// hill blooms and the whole valley is restored.
//
// There are no timers and no enemies that attack: the only thing in the way is the grey itself,
// which lifts as mist where a word restores the ground. The typing is judged by the host
// (PlayController); this scene only reacts, and learns the shape of the run from `begin(plan)`.

import {
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  ConeGeometry,
  CylinderGeometry,
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
  SphereGeometry,
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
  LetterField,
  Rng,
  smoothstep,
  WorldText,
  type AmbienceHandle,
  type BurstStyle,
  type ColorToken,
  type GameScene,
  type QualityPreset,
  type SceneContext,
  type Trail,
  type TypedKey,
} from '../../engine';
import { tierIntensity } from '../../audio/composer';
import type { Finger } from '../../core/layouts';
import { Dyo } from '../../game/dyo';
import { TypingFeedback } from '../../game/feedback';
import { Flyers } from './flyers';
import { SKY, TINT } from './palette';
import {
  birdStage,
  chapterAt,
  flowersOpen,
  greenRadius,
  type ChapterId,
  type MeadowPlan,
  type Plot,
} from './plan';

export interface MeadowSetup {
  /** The apprentice's robe (the profile's avatar). */
  look: { robe: number; hem: number; trim: number; headwear: 'cap' | 'hat' | 'turban' };
  /** The eight beds of the garden, left to right (`homePlots`). */
  plots: readonly Plot[];
}

/** Things the screen may want to say something about. */
export type MeadowMoment = 'birds' | 'birdsAgain' | 'tree';

const FINGER_TOKEN: Readonly<Record<Finger, ColorToken>> = {
  lp: 'finger-pinky',
  lr: 'finger-ring',
  lm: 'finger-middle',
  li: 'finger-index',
  ri: 'finger-index',
  rm: 'finger-middle',
  rr: 'finger-ring',
  rp: 'finger-pinky',
  th: 'finger-thumb',
};

// --- The lay of the land.
/** The middle of the garden (the green spreads from here), and the centre of the beds' arc. */
const GARDEN_Z = -5.4;
const ARC_Z = -1.4;
const PLOT_RADIUS = 5.3;
const PLOT_ANGLES = [-50, -37, -24, -11, 11, 24, 37, 50] as const;
const PLOT_SIZE = 0.58;
const PLOT_FLOWERS = 6;
/** How far behind its bed a letter stone stands. */
const STONE_OUT = 0.95;
const MEADOW_FLOWERS = 640;
const GRASS = 3400;
const TREE_X = -10;
const TREE_Z = -31;
const WORD_Y = 2.95;
const WORD_Z = -7.6;
const LETTER_SIZE = 1.0;
const BLOOM_SECONDS = 0.6;
const MAX_BLOOMING = 128;
const BIRDS = 7;
const BIRDS_AT = [0, 2, 4, 6, BIRDS] as const;
const BUTTERFLIES = 14;

const UP = new Vector3(0, 1, 0);

/** The camera's place on its rail and the point it looks at, per chapter. */
const VIEW: Readonly<Record<ChapterId | 'finale', { t: number; look: readonly number[] }>> = {
  hands: { t: 0.02, look: [0, 0.3, -3.6] },
  look: { t: 0.38, look: [-0.6, 1.9, -9] },
  flow: { t: 0.7, look: [-2, 2.6, -13] },
  finale: { t: 1, look: [-6, 4.6, -20] },
};

function terrain(x: number, z: number): number {
  const d = Math.hypot(x, z);
  // Rolling ground, and the almond tree's hill.
  let h =
    Math.sin(x * 0.045 + 1.3) * Math.cos(z * 0.05 - 0.4) * 1.7 + Math.sin(x * 0.11 + z * 0.07) * 0.5;
  const hx = x - TREE_X;
  const hz = z - TREE_Z;
  h += 5.2 * Math.exp(-(hx * hx + hz * hz) / 360);
  // Level ground for the garden and the people standing by it.
  h *= smoothstep(8.5, 27, Math.hypot(x, z - GARDEN_Z + 2.5));
  // The valley's rim: far ridges all around.
  const a = Math.atan2(z, x);
  h += smoothstep(72, 135, d) * (13 + 6 * Math.sin(a * 3 + 0.7) + 3 * Math.sin(a * 7 + 2));
  return h;
}

/** A solid-colored, non-indexed copy of a geometry (so different parts can be merged). */
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
  get size(): number {
    return this.mats.length;
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

export class MeadowScene implements GameScene {
  readonly id = 'meadow';
  /** Told when something worth a line happens (a bird comes back, the green reaches the tree). */
  onMoment: ((moment: MeadowMoment) => void) | null = null;

  private ctx!: SceneContext;
  private readonly rng = new Rng(1414);
  private plan: MeadowPlan | null = null;
  private apprentice!: Character;
  private ezra!: Character;
  private dyo!: Dyo;
  private text!: WorldText;
  private feedback!: TypingFeedback;
  private quillTrail: Trail | null = null;
  private shownLetters: readonly string[] | null = null;

  // The garden.
  private readonly plotX = new Float32Array(8);
  private readonly plotZ = new Float32Array(8);
  private readonly plotOpen = new Uint8Array(8);
  private readonly plotGlow = new Float32Array(8);
  private readonly plotFlash = new Float32Array(8);
  private readonly plotColor: number[] = [];
  private readonly plotChar: string[] = [];
  private readonly plotOf = new Map<string, number>();
  private letters!: LetterField;
  private dyoRest = 0;

  // The flowers: the first 8 * PLOT_FLOWERS belong to the beds, the rest to the meadow, sorted
  // from the garden outward.
  private readonly flowers = 8 * PLOT_FLOWERS + MEADOW_FLOWERS;
  private readonly fx = new Float32Array(this.flowers);
  private readonly fy = new Float32Array(this.flowers);
  private readonly fz = new Float32Array(this.flowers);
  private readonly fh = new Float32Array(this.flowers);
  private readonly fq = new Float32Array(this.flowers * 4);
  private stems!: InstancedMesh;
  private petals!: InstancedMesh;
  private readonly blooming = new Int32Array(MAX_BLOOMING);
  private readonly bloomT = new Float32Array(MAX_BLOOMING);
  private bloomCount = 0;
  /** Meadow flowers open, and how many should be. */
  private open = 0;
  private openGoal = 0;
  private bloomRate = 2;

  private birds!: Flyers;
  private butterflies!: Flyers;
  private clouds!: Group;
  private readonly birdSong: AmbienceHandle[] = [];
  private birdsBack = 0;
  private treeReached = false;

  private lettersDone = 0;
  private wordsDone = 0;
  private green = 0;
  private chapter: ChapterId | 'finale' = 'hands';
  private finished = false;
  private heardTier = 0;
  private time = 0;
  private finaleT = -1;
  private petalTimer = 0;
  private moteTimer = 0;

  private rail!: CatmullRomCurve3;
  private readonly lookAt = new Object3D();
  private railT = 0;

  private gold = 0;
  private techelet = 0;
  private paper = 0;
  private inkDark = 0;
  private sparks!: BurstStyle;
  private fountain!: BurstStyle;
  private motes!: BurstStyle;
  private mist!: BurstStyle;
  private petalFall!: BurstStyle;
  private pop!: BurstStyle;

  private readonly v = new Vector3();
  private readonly v2 = new Vector3();
  private readonly m4 = new Matrix4();
  private readonly q = new Quaternion();
  private readonly s = new Vector3();
  private readonly col = new Color();
  private readonly col2 = new Color();

  constructor(private readonly setup: MeadowSetup) {}

  // ---- probes (the screen and the smoke test read these) -------------------------------------

  /** Flowers open right now, in the beds and in the meadow. */
  get bloomed(): number {
    let n = this.open;
    for (let i = 0; i < 8; i++) n += this.plotOpen[i] as number;
    return n;
  }

  get flowerCount(): number {
    return this.flowers;
  }

  /** How far the green reaches from the garden (0 before the first word). */
  get greenReach(): number {
    return this.green;
  }

  get birdsOut(): number {
    return this.birds.out;
  }

  get restored(): boolean {
    return this.finished;
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

    // Sound: the meadow theme (its layers follow the streak) and a light wind. The birds are
    // silent until the typing brings them back.
    ctx.audio.music('meadow');
    ctx.audio.intensity(0);
    ctx.audio.ambience('wind');

    ctx.atmosphere.setPalette({ ...SKY[ctx.theme], fade: ctx.color('fade'), ink: this.gold });
    ctx.atmosphere.groundAt = terrain;
    ctx.atmosphere.setShadowRange(30);
    ctx.post.setGrade(
      ctx.theme === 'dark'
        ? { exposure: 1.22, saturation: 1.02, vignette: 0.5, godRays: 0.8 }
        : { exposure: 1.04, saturation: 1.08, vignette: 0.32, godRays: 0.75 },
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
      color2: TINT.blossomPink,
      intensity: 3,
      speed: [4, 11],
      spread: 0.4,
      life: [1, 2.1],
      size: [0.07, 0.2],
      gravity: 5,
    });
    this.motes = burstStyle({
      count: 1,
      color: 0xfff6d8,
      color2: this.gold,
      intensity: 1.8,
      speed: [0.05, 0.35],
      life: [3, 6],
      size: [0.035, 0.08],
      gravity: -0.12,
      radius: 11,
    });
    this.mist = burstStyle({
      count: 4,
      color: TINT.mist,
      speed: [0.3, 1.2],
      spread: 0.8,
      life: [1.1, 2.2],
      size: [0.25, 0.6],
      gravity: -0.7,
      radius: 0.8,
    });
    this.petalFall = burstStyle({
      count: 10,
      color: TINT.blossom,
      color2: TINT.blossomPink,
      intensity: 1.5,
      speed: [0.4, 2.2],
      spread: 0.9,
      life: [2.2, 4.5],
      size: [0.07, 0.15],
      gravity: 0.55,
      radius: 3.2,
    });
    this.pop = burstStyle({
      count: 6,
      color: TINT.anemone,
      color2: this.gold,
      intensity: 2,
      speed: [0.8, 2.4],
      spread: 0.7,
      life: [0.35, 0.7],
      size: [0.04, 0.1],
      gravity: 3,
    });

    this.buildGround();
    this.buildGarden();
    this.buildFlowers();
    this.buildTrees();
    this.buildScenery();

    // --- Those who came back: birds over the meadow, butterflies near the garden.
    this.birds = new Flyers(
      kit,
      tracker,
      root,
      {
        count: BIRDS,
        kind: 'bird',
        colors: [TINT.birdWing, TINT.bird],
        body: TINT.bird,
        size: 1.05,
        centerX: -4,
        centerZ: -16,
        roam: [9, 24],
        height: [7, 13],
        groundAt: terrain,
      },
      r,
    );
    this.butterflies = new Flyers(
      kit,
      tracker,
      root,
      {
        count: BUTTERFLIES,
        kind: 'butterfly',
        colors: [TINT.butterflyA, TINT.butterflyB, TINT.butterflyC, TINT.butterflyD],
        size: 0.2,
        centerX: 0,
        centerZ: GARDEN_Z - 1,
        roam: [1.2, 6.5],
        height: [0.7, 2.1],
        groundAt: terrain,
      },
      r,
    );

    // --- The people. The apprentice faces the garden; Reb Ezra stands by the left-hand beds.
    const l = this.setup.look;
    this.apprentice = new Character(kit, {
      robe: l.robe,
      hem: l.hem,
      trim: l.trim,
      skin: TINT.skin,
      ink: TINT.ink,
      headwear: l.headwear,
      quill: true,
      height: 0.92,
      seed: 2,
    });
    this.apprentice.root.position.set(-4.7, 0, 0.9);
    this.apprentice.root.rotation.y = Math.atan2(4.7, -6.3);
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
      seed: 6,
    });
    this.ezra.root.position.set(5, 0, 0.3);
    this.ezra.root.rotation.y = Math.atan2(-5, -5.7);
    this.dyo = new Dyo(kit, {
      body: TINT.dyo,
      shine: TINT.dyoShine,
      eye: TINT.dyoEye,
      pupil: TINT.ink,
    });
    this.dyo.root.scale.setScalar(0.62);
    this.dyo.root.position.set(-3.2, 0, -0.6);
    this.dyo.face(0, GARDEN_Z);
    root.add(this.apprentice.root, this.ezra.root, this.dyo.root);
    ctx.atmosphere.addBlob(this.apprentice.root, 0.5);
    ctx.atmosphere.addBlob(this.ezra.root, 0.55);
    ctx.atmosphere.addBlob(this.dyo.root, 0.25);

    // --- The word to type, on a parchment banner over the garden.
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
    this.text.anchor.set(0, WORD_Y, WORD_Z);
    root.add(this.text.root);
    this.feedback = new TypingFeedback(ctx, {
      gold: this.gold,
      ink: this.inkDark,
      techelet: this.techelet,
    });

    // --- Camera: one slow rail from over the apprentice's shoulder up to the whole valley.
    this.rail = new CatmullRomCurve3(
      [
        new Vector3(0.3, 6.7, 9.4),
        new Vector3(1.6, 6.9, 11.6),
        new Vector3(0.6, 7.2, 14),
        new Vector3(-2, 9, 17),
        new Vector3(-4, 12.5, 21),
      ],
      false,
      'catmullrom',
      0.5,
    );
    const first = VIEW.hands;
    this.lookAt.position.set(first.look[0] as number, first.look[1] as number, first.look[2] as number);
    root.add(this.lookAt);
    this.railT = first.t;
    ctx.rig.railT = first.t;
    ctx.rig.rail(this.rail, { lookAt: this.lookAt, stiffness: 2.2 });
    this.onQuality(ctx.quality);
  }

  private buildGround(): void {
    const { materials: kit, tracker, root } = this.ctx;
    const r = this.rng;
    const land = new PlaneGeometry(330, 330, 116, 116).rotateX(-Math.PI / 2);
    const pos = land.getAttribute('position');
    const colors = new Float32Array(pos.count * 3);
    const a = new Color();
    const b = new Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = terrain(x, z);
      pos.setY(i, h);
      const d = Math.hypot(x, z - GARDEN_Z);
      const patch = Math.sin(x * 0.09 + 2) * Math.cos(z * 0.08) + r.signed() * 0.5;
      a.setHex(TINT.grassA).lerp(b.setHex(TINT.grassB), smoothstep(-0.6, 0.9, patch));
      a.lerp(b.setHex(TINT.grassC), r.next() * 0.4);
      // Turned earth under the garden, a pale path leading back to the house.
      a.lerp(b.setHex(TINT.earth), (1 - smoothstep(5.2, 8.2, d + r.signed() * 0.8)) * 0.85);
      if (z > 0.5 && Math.abs(x) < 2.6) {
        a.lerp(b.setHex(TINT.path), (1 - smoothstep(0.8, 2.6, Math.abs(x) + r.signed() * 0.5)) * 0.8);
      }
      // The far ridges go blue-green in the haze.
      a.lerp(b.setHex(TINT.hillFar), smoothstep(70, 140, Math.hypot(x, z)) * 0.75);
      colors[i * 3] = a.r;
      colors[i * 3 + 1] = a.g;
      colors[i * 3 + 2] = a.b;
    }
    land.setAttribute('color', new BufferAttribute(colors, 3));
    land.computeVertexNormals();
    const mesh = new Mesh(tracker.track(land), tracker.track(kit.surface({ vertexColors: true })));
    mesh.receiveShadow = true;
    root.add(mesh);

    // --- Grass: three crossed blades per tuft, one draw call for the whole meadow.
    const blade: number[] = [];
    const bladeColor: number[] = [];
    const rootC = new Color(TINT.bladeRoot);
    const tipC = new Color(TINT.bladeTip);
    for (let k = 0; k < 3; k++) {
      const ang = (k / 3) * Math.PI + 0.3;
      const cx = Math.cos(ang) * 0.075;
      const cz = Math.sin(ang) * 0.075;
      const lean = 0.12 * (k - 1);
      blade.push(-cx, 0, -cz, cx, 0, cz, lean, 1, lean * 0.6);
      bladeColor.push(rootC.r, rootC.g, rootC.b, rootC.r, rootC.g, rootC.b, tipC.r, tipC.g, tipC.b);
    }
    const tuft = new BufferGeometry();
    tuft.setAttribute('position', new BufferAttribute(new Float32Array(blade), 3));
    tuft.setAttribute('color', new BufferAttribute(new Float32Array(bladeColor), 3));
    // Lit like the ground under it, so a tuft never shows a dark side.
    const up = new Float32Array(blade.length);
    for (let i = 1; i < up.length; i += 3) up[i] = 1;
    tuft.setAttribute('normal', new BufferAttribute(up, 3));
    const grass = new Batch();
    const p = this.v;
    const q = this.q;
    const s = this.s;
    const c = new Color();
    for (let i = 0; i < GRASS; i++) {
      const d = 2.4 + 74 * Math.pow(r.next(), 1.45);
      const ang = r.range(0, Math.PI * 2);
      const x = Math.cos(ang) * d;
      const z = GARDEN_Z + Math.sin(ang) * d;
      if (this.inGarden(x, z, 0.75) || (z > 1 && Math.abs(x) < 1.3)) continue;
      p.set(x, terrain(x, z) - 0.02, z);
      q.setFromAxisAngle(UP, r.range(0, Math.PI));
      const size = r.range(0.3, 0.6) * (1 + d * 0.009);
      s.set(size * r.range(0.9, 1.5), size, size * r.range(0.9, 1.5));
      c.setHSL(0.24 + r.signed() * 0.035, 0.25, r.range(0.82, 1));
      grass.add(p, q, s, c.getHex());
    }
    const mat = tracker.track(kit.surface({ vertexColors: true, side: DoubleSide }));
    const tufts = grass.build(tracker.track(tuft), mat);
    kit.caster(tufts, false);
    tufts.receiveShadow = true;
    root.add(tracker.track(tufts));
  }

  /** True when (x, z) lies on one of the beds (with `pad` around it). */
  private inGarden(x: number, z: number, pad: number): boolean {
    for (let i = 0; i < 8; i++) {
      const dx = x - (this.plotX[i] as number);
      const dz = z - (this.plotZ[i] as number);
      if (dx * dx + dz * dz < (PLOT_SIZE + pad) * (PLOT_SIZE + pad)) return true;
    }
    return false;
  }

  private buildGarden(): void {
    const { materials: kit, tracker, root } = this.ctx;
    const rims = new Batch();
    const soil = new Batch();
    const stones = new Batch();
    const studs = new Batch();
    const p = this.v;
    const q = this.q;
    const s = this.s;
    this.letters = new LetterField(this.ctx.engine.atlas, kit, this.ctx.vfx.billboard, 8);
    for (let i = 0; i < 8; i++) {
      const plot = this.setup.plots[i];
      const a = ((PLOT_ANGLES[i] as number) * Math.PI) / 180;
      const x = Math.sin(a) * PLOT_RADIUS;
      const z = ARC_Z - Math.cos(a) * PLOT_RADIUS;
      this.plotX[i] = x;
      this.plotZ[i] = z;
      const color = this.ctx.color(FINGER_TOKEN[plot?.finger ?? 'li']);
      this.plotColor.push(color);
      const ch = plot && plot.learned ? plot.char : '';
      this.plotChar.push(ch);
      if (ch) this.plotOf.set(ch, i);
      q.identity();
      s.setScalar(1);
      rims.add(p.set(x, 0.07, z), q, s, color);
      soil.add(p.set(x, 0.035, z), q, s, TINT.soil);
      // A small standing stone behind each bed carries its letter.
      q.setFromAxisAngle(UP, -a);
      const bx = x + Math.sin(a) * STONE_OUT;
      const bz = z - Math.cos(a) * STONE_OUT;
      stones.add(p.set(bx, 0.35, bz), q, s.set(1, 1, 1), i % 2 ? TINT.stone : TINT.stoneDark);
      if (plot?.bump) {
        q.identity();
        studs.add(p.set(bx, 0.76, bz), q, s.setScalar(1), 0xffffff);
      }
    }
    const rimGeo = tracker.track(new TorusGeometry(PLOT_SIZE, 0.085, 5, 14).rotateX(Math.PI / 2));
    const rimMesh = rims.build(rimGeo, tracker.track(kit.surface({ restore: false, lift: 0.3 })));
    const soilGeo = tracker.track(new CylinderGeometry(PLOT_SIZE, PLOT_SIZE, 0.07, 14));
    const soilMesh = soil.build(soilGeo, tracker.track(kit.surface({ restore: false })));
    const stoneGeo = tracker.track(new CylinderGeometry(0.3, 0.36, 0.7, 6).scale(1, 1, 0.55));
    const stoneMesh = stones.build(stoneGeo, tracker.track(kit.surface({ restore: false, lift: 0.1 })));
    const studGeo = tracker.track(new SphereGeometry(0.07, 8, 6));
    const studMesh = studs.build(studGeo, tracker.track(kit.ink(this.gold, 2.4)));
    for (const mesh of [rimMesh, soilMesh, stoneMesh, studMesh]) {
      mesh.receiveShadow = true;
      root.add(tracker.track(mesh));
    }
    kit.caster(stoneMesh, true);
    kit.caster(rimMesh, false);
    kit.caster(soilMesh, false);
    kit.caster(studMesh, false);
    root.add(this.letters.mesh);
  }

  private buildFlowers(): void {
    const { materials: kit, tracker, root } = this.ctx;
    const r = this.rng;
    const n = this.flowers;
    // A flower is one unit tall; each instance is scaled to its own height.
    const stemGeo = merged([
      painted(new CylinderGeometry(0.022, 0.034, 1, 4, 1).translate(0, 0.5, 0), TINT.stem),
      painted(new ConeGeometry(0.11, 0.2, 4).rotateZ(1.2).translate(0.09, 0.42, 0), TINT.stem),
      painted(new IcosahedronGeometry(0.085, 0).translate(0, 1.03, 0), TINT.heart),
    ]);
    // The cup of petals: an open cone, wide end up.
    const petalGeo = new ConeGeometry(0.33, 0.24, 6, 1, true).rotateX(Math.PI).translate(0, 1.06, 0);
    const stemMat = tracker.track(kit.surface({ vertexColors: true, restore: false, lift: 0.15 }));
    const petalMat = tracker.track(kit.surface({ restore: false, lift: 0.4, side: DoubleSide }));
    this.stems = new InstancedMesh(tracker.track(stemGeo), stemMat, n);
    this.petals = new InstancedMesh(tracker.track(petalGeo), petalMat, n);
    const q = this.q;
    const lean = new Quaternion();
    const axis = new Vector3();
    const c = new Color();
    const zero = new Matrix4().makeScale(0, 0, 0);
    const place = (i: number, x: number, z: number, h: number, bed: boolean): void => {
      this.fx[i] = x;
      this.fz[i] = z;
      this.fy[i] = terrain(x, z) + (bed ? 0.06 : -0.02);
      this.fh[i] = h;
      q.setFromAxisAngle(UP, r.range(0, Math.PI * 2));
      axis.set(r.signed(), 0, r.signed()).normalize();
      q.premultiply(lean.setFromAxisAngle(axis, r.range(0.02, bed ? 0.22 : 0.3)));
      this.fq[i * 4] = q.x;
      this.fq[i * 4 + 1] = q.y;
      this.fq[i * 4 + 2] = q.z;
      this.fq[i * 4 + 3] = q.w;
      const pick = r.next();
      // Anemones are red, with a few white, violet and pink ones among them.
      c.setHex(
        pick < 0.62
          ? TINT.anemone
          : pick < 0.74
            ? TINT.anemoneDeep
            : pick < 0.85
              ? TINT.anemoneWhite
              : pick < 0.93
                ? TINT.anemoneViolet
                : TINT.anemonePink,
      );
      this.petals.setColorAt(i, c);
      this.stems.setMatrixAt(i, zero);
      this.petals.setMatrixAt(i, zero);
    };
    // The beds: one in the middle and a ring of five around it.
    let i = 0;
    for (let b = 0; b < 8; b++) {
      for (let k = 0; k < PLOT_FLOWERS; k++) {
        const ring = k === 0 ? 0 : 0.34;
        const a = (k / (PLOT_FLOWERS - 1)) * Math.PI * 2 + b;
        place(
          i++,
          (this.plotX[b] as number) + Math.cos(a) * ring,
          (this.plotZ[b] as number) + Math.sin(a) * ring,
          k === 0 ? 0.62 : r.range(0.4, 0.54),
          true,
        );
      }
    }
    // The meadow: drifts of flowers, thicker in front of the garden, sorted outward so the
    // blooming follows the green.
    const spots: { x: number; z: number; d: number }[] = [];
    let guard = 0;
    while (spots.length < MEADOW_FLOWERS && guard++ < 40000) {
      const d = 6.4 + 54 * Math.pow(r.next(), 1.25);
      const ang = r.range(0, Math.PI * 2);
      const x = Math.cos(ang) * d;
      const z = GARDEN_Z + Math.sin(ang) * d;
      // More of them where the apprentice is looking (toward -Z), fewer behind the camera.
      const front = 0.35 + 0.65 * smoothstep(0.4, -0.5, Math.sin(ang));
      const drift = 0.5 + 0.5 * Math.sin(x * 0.21 + 1.7) * Math.cos(z * 0.19 - 0.6);
      if (r.next() > front * (0.25 + 0.75 * drift)) continue;
      if (Math.hypot(x - TREE_X, z - TREE_Z) < 1.6) continue;
      if (z > 1 && Math.abs(x) < 1.5) continue;
      spots.push({ x, z, d: d + r.signed() * 2.2 });
    }
    spots.sort((a, b) => a.d - b.d);
    for (const sp of spots) {
      if (i >= n) break;
      // Far flowers are drawn a little larger, so the drifts still read as red from the garden.
      place(i++, sp.x, sp.z, r.range(0.42, 0.7) * (1 + sp.d * 0.02), false);
    }
    for (const mesh of [this.stems, this.petals]) {
      mesh.frustumCulled = false;
      kit.caster(mesh, false);
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      root.add(tracker.track(mesh));
    }
  }

  private buildTrees(): void {
    const { materials: kit, tracker, root } = this.ctx;
    const r = this.rng;
    const branches = new Batch();
    const blossoms = new Batch();
    const q = new Quaternion();
    const s = new Vector3();
    const p = new Vector3();
    const side = new Vector3();
    const flower = (at: Vector3, size: number, count: number): void => {
      for (let k = 0; k < count; k++) {
        p.set(
          at.x + r.signed() * size * 1.5,
          at.y + r.range(-0.3, 1) * size,
          at.z + r.signed() * size * 1.5,
        );
        q.setFromAxisAngle(UP, r.range(0, 6));
        s.set(size * r.range(0.6, 1.1), size * r.range(0.45, 0.8), size * r.range(0.6, 1.1));
        blossoms.add(p, q, s, r.next() < 0.55 ? TINT.blossom : TINT.blossomPink);
      }
    };
    const grow = (base: Vector3, dir: Vector3, len: number, rad: number, depth: number): void => {
      q.setFromUnitVectors(UP, dir);
      branches.add(base, q, s.set(rad, len, rad), TINT.bark);
      const tip = base.clone().addScaledVector(dir, len);
      if (depth === 0) {
        flower(tip, len * 0.52, 3);
        return;
      }
      if (depth === 1) flower(tip, len * 0.34, 1);
      const n = depth === 2 ? 4 : 3;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + r.range(0, 1.2);
        side.set(Math.cos(a), 0, Math.sin(a));
        const next = dir
          .clone()
          .multiplyScalar(0.55)
          .addScaledVector(side, r.range(0.6, 0.95))
          .addScaledVector(UP, r.range(0.15, 0.5))
          .normalize();
        grow(tip.clone().addScaledVector(dir, -len * 0.12), next, len * r.range(0.62, 0.74), rad * 0.58, depth - 1);
      }
    };
    const tree = (x: number, z: number, scale: number): void => {
      const lean = new Vector3(r.signed() * 0.12, 1, r.signed() * 0.12).normalize();
      grow(new Vector3(x, terrain(x, z) - 0.2, z), lean, 2.7 * scale, 0.36 * scale, 2);
    };
    // The old almond tree on its hill, and a few younger ones farther off.
    tree(TREE_X, TREE_Z, 1.55);
    tree(19, -27, 0.95);
    tree(-27, -13, 0.85);
    tree(27, -50, 1.1);
    tree(-34, -46, 1.2);
    tree(8, -58, 1.0);
    const branchGeo = tracker.track(new CylinderGeometry(0.55, 1, 1, 5).translate(0, 0.5, 0));
    const branchMesh = branches.build(branchGeo, tracker.track(kit.surface({})));
    const blossomGeo = tracker.track(new IcosahedronGeometry(1, 0));
    const blossomMesh = blossoms.build(blossomGeo, tracker.track(kit.surface({ lift: 0.22 })));
    for (const mesh of [branchMesh, blossomMesh]) {
      kit.caster(mesh, true);
      mesh.receiveShadow = true;
      root.add(tracker.track(mesh));
    }
  }

  private buildScenery(): void {
    const { materials: kit, tracker, root } = this.ctx;
    const r = this.rng;
    const p = this.v;
    const q = this.q;
    const s = this.s;
    // Cypresses in small stands on the slopes.
    const cypress = new Batch();
    const stands: readonly (readonly [number, number])[] = [
      [30, -20],
      [-22, -30],
      [40, -44],
      [-44, -20],
      [14, -46],
      [-30, 14],
      [36, 12],
    ];
    for (const [sx, sz] of stands) {
      const count = 2 + r.int(3);
      for (let k = 0; k < count; k++) {
        const x = sx + r.signed() * 4.5;
        const z = sz + r.signed() * 4.5;
        const hgt = r.range(5.5, 9);
        q.identity();
        cypress.add(
          p.set(x, terrain(x, z) - 0.2, z),
          q,
          s.set(r.range(0.9, 1.25), hgt, r.range(0.9, 1.25)),
          r.next() < 0.5 ? TINT.cypress : TINT.cypressLight,
        );
      }
    }
    const cypressMesh = cypress.build(
      tracker.track(new ConeGeometry(1, 1, 6).translate(0, 0.5, 0)),
      tracker.track(kit.surface({})),
    );
    kit.caster(cypressMesh, true);
    root.add(tracker.track(cypressMesh));

    // Field stones, and flat stepping stones on the path back to the house.
    const rocks = new Batch();
    for (let i = 0; i < 44; i++) {
      const d = 8 + 62 * r.next();
      const ang = r.range(0, Math.PI * 2);
      const x = Math.cos(ang) * d;
      const z = GARDEN_Z + Math.sin(ang) * d;
      if (z > 1 && Math.abs(x) < 3) continue;
      const size = r.range(0.25, 1.1);
      q.setFromAxisAngle(UP, r.range(0, 6));
      rocks.add(
        p.set(x, terrain(x, z) + size * 0.2, z),
        q,
        s.set(size * r.range(0.8, 1.4), size * r.range(0.5, 0.9), size),
        TINT.rock,
      );
    }
    for (let i = 0; i < 9; i++) {
      const z = 2.6 + i * 1.5;
      const x = Math.sin(i * 1.7) * 0.5;
      q.setFromAxisAngle(UP, i * 0.9);
      rocks.add(p.set(x, terrain(x, z) + 0.02, z), q, s.set(0.62, 0.07, 0.5), TINT.stone);
    }
    const rockMesh = rocks.build(
      tracker.track(new DodecahedronGeometry(1, 0)),
      tracker.track(kit.surface({})),
    );
    kit.caster(rockMesh, true);
    rockMesh.receiveShadow = true;
    root.add(tracker.track(rockMesh));

    // A few fair-weather clouds, drifting very slowly around the valley.
    const puffs = new Batch();
    for (let i = 0; i < 7; i++) {
      const ang = (i / 7) * Math.PI * 2 + r.range(0, 0.6);
      const d = r.range(120, 170);
      const cx = Math.cos(ang) * d;
      const cz = Math.sin(ang) * d;
      const cy = r.range(46, 70);
      const big = r.range(7, 12);
      for (let k = 0; k < 4; k++) {
        q.identity();
        puffs.add(
          p.set(cx + (k - 1.5) * big * 0.9 + r.signed() * 2, cy + r.signed() * 1.5, cz + r.signed() * 4),
          q,
          s.set(big * r.range(0.8, 1.2), big * r.range(0.32, 0.5), big * r.range(0.7, 1)),
          TINT.cloud,
        );
      }
    }
    const cloudMesh = puffs.build(
      tracker.track(new IcosahedronGeometry(1, 1)),
      tracker.track(kit.surface({ restore: false, lift: 0.75, flat: false })),
    );
    kit.caster(cloudMesh, false);
    cloudMesh.frustumCulled = false;
    this.clouds = new Group();
    this.clouds.add(tracker.track(cloudMesh));
    root.add(this.clouds);
  }

  onQuality(preset: QualityPreset): void {
    // Thin limbs cast shadows only where there are draw calls to spare.
    const full = preset.shadows === 'cascaded';
    this.apprentice?.shadowDetail(full);
    this.ezra?.shadowDetail(full);
  }

  // ---- a run --------------------------------------------------------------------------------

  start(): void {
    this.reset();
  }

  /** Forgets everything: grey ground, closed flowers, no birds. */
  private reset(): void {
    const { materials } = this.ctx;
    materials.clearSweeps();
    materials.restoreAll(0, 0);
    const zero = this.m4.makeScale(0, 0, 0);
    for (let i = 0; i < this.flowers; i++) {
      this.stems.setMatrixAt(i, zero);
      this.petals.setMatrixAt(i, zero);
    }
    this.stems.instanceMatrix.needsUpdate = true;
    this.petals.instanceMatrix.needsUpdate = true;
    this.plotOpen.fill(0);
    this.plotFlash.fill(0);
    this.bloomCount = 0;
    this.open = 0;
    this.openGoal = 0;
    this.bloomRate = 2;
    this.lettersDone = 0;
    this.wordsDone = 0;
    this.green = 0;
    this.finished = false;
    this.finaleT = -1;
    this.treeReached = false;
    this.birdsBack = 0;
    this.heardTier = 0;
    this.shownLetters = null;
    this.birds.reset();
    this.butterflies.reset();
    for (const h of this.birdSong) h.stop();
    this.birdSong.length = 0;
    this.ctx.audio.intensity(0);
  }

  /** A new run with this plan (the screen calls it before the first key, and for every retry). */
  begin(plan: MeadowPlan): void {
    this.reset();
    this.plan = plan;
    this.setChapter(plan.chapters[0]?.id ?? 'look');
  }

  private setChapter(id: ChapterId | 'finale'): void {
    this.chapter = id;
  }

  /** The chapter the camera is showing. */
  get view(): ChapterId | 'finale' {
    return this.chapter;
  }

  private bloom(i: number): void {
    if (this.bloomCount >= MAX_BLOOMING) {
      this.writeFlower(i, 1);
      return;
    }
    this.blooming[this.bloomCount] = i;
    this.bloomT[this.bloomCount] = 0;
    this.bloomCount += 1;
  }

  private writeFlower(i: number, scale: number): void {
    const k = i * 4;
    this.q.set(
      this.fq[k] as number,
      this.fq[k + 1] as number,
      this.fq[k + 2] as number,
      this.fq[k + 3] as number,
    );
    this.v.set(this.fx[i] as number, this.fy[i] as number, this.fz[i] as number);
    this.s.setScalar((this.fh[i] as number) * scale);
    this.m4.compose(this.v, this.q, this.s);
    this.stems.setMatrixAt(i, this.m4);
    this.petals.setMatrixAt(i, this.m4);
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

    // One more letter: flowers open in the meadow, and in the key's own bed.
    this.lettersDone += 1;
    const plan = this.plan;
    this.openGoal = Math.max(
      this.openGoal,
      flowersOpen(this.lettersDone, plan?.letters ?? 0, MEADOW_FLOWERS),
    );
    const bed = this.plotOf.get(ev.expected);
    if (bed !== undefined) {
      const x = this.plotX[bed] as number;
      const z = this.plotZ[bed] as number;
      const n = this.plotOpen[bed] as number;
      if (n < PLOT_FLOWERS) {
        this.plotOpen[bed] = n + 1;
        this.bloom(bed * PLOT_FLOWERS + n);
      } else {
        // A full bed nods: one of its flowers springs up again.
        this.bloom(bed * PLOT_FLOWERS + ((this.lettersDone + bed) % PLOT_FLOWERS));
      }
      this.plotFlash[bed] = 1;
      this.ctx.vfx.shockwave(x, 0.14, z, 1.25, this.plotColor[bed] as number, 0.5, true, 1.3);
      this.ctx.vfx.burst(this.pop, x, 0.6, z, 0, 1, 0);
      if (this.dyoRest <= 0) {
        // Dyo hops to the bed that was just watered.
        const a = ((PLOT_ANGLES[bed] as number) * Math.PI) / 180;
        this.dyo.hop(x - Math.sin(a) * 1.05, 0, z + Math.cos(a) * 1.05, 0.34, 0.5, x, z);
        this.dyoRest = 0.5;
      }
    }
  }

  /** The music builds with the combo tier; a new tier rings a chime. */
  private hearTier(tier: number): void {
    if (tier > this.heardTier) {
      this.ctx.audio.play('tier', tier);
      this.dyo.cheer(2 + tier);
      // A new tier sends a gust of petals up from the garden.
      this.ctx.vfx.burst(this.fountain, 0, 1.2, GARDEN_Z, 0, 1, 0);
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
    // The green spreads a step farther from the garden, and the grey lifts as mist at its edge.
    const reach = greenRadius(this.wordsDone, total);
    this.green = reach;
    vfx.restore(0, 0.15, GARDEN_Z, reach, 1.5);
    for (let k = 0; k < 7; k++) {
      const a = this.rng.range(Math.PI, Math.PI * 2);
      const x = Math.cos(a) * reach * 0.94;
      const z = GARDEN_Z + Math.sin(a) * reach * 0.94;
      vfx.burst(this.mist, x, terrain(x, z) + 0.5, z, 0, 1, 0, true);
    }
    const a = this.text.anchor;
    this.feedback.word(a.x, a.y, a.z, perfect);
    audio.play('restore');
    audio.play(perfect ? 'perfect' : 'word');
    if (perfect && this.ctx.typing.tier >= 2) this.ezra.play('cheer');

    // Butterflies follow the color; birds come back at their own moments.
    this.butterflies.show(Math.min(BUTTERFLIES, this.wordsDone));
    const stage = birdStage(this.wordsDone, total);
    if (stage > this.birdsBack) {
      this.birdsBack = stage;
      this.birds.show(BIRDS_AT[stage] ?? BIRDS);
      const where = [
        [TREE_X, 9, TREE_Z],
        [16, 7, -14],
        [-14, 7, 6],
      ][stage - 1] ?? [0, 8, -10];
      this.birdSong.push(
        audio.ambience('birds', where[0] as number, where[1] as number, where[2] as number),
      );
      this.onMoment?.(stage === 1 ? 'birds' : 'birdsAgain');
    }
    if (!this.treeReached && reach >= Math.hypot(TREE_X, TREE_Z - GARDEN_Z) + 3) {
      this.treeReached = true;
      this.petalTimer = 0;
      this.onMoment?.('tree');
    }
    if (this.wordsDone < total) this.setChapter(chapterAt(plan, this.wordsDone));
  }

  /** The run is over. A whole run restores the valley; a failed trial leaves it as it is. */
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
    this.green = 200;
    vfx.shockwave(0, 0.4, GARDEN_Z, 80, this.gold, 2.4);
    vfx.burst(this.fountain, 0, 1.4, GARDEN_Z, 0, 1, 0);
    this.openGoal = MEADOW_FLOWERS;
    this.bloomRate = 7;
    this.birds.show(BIRDS);
    this.butterflies.show(BUTTERFLIES);
    this.treeReached = true;
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

    // Meadow flowers open a few at a time, from the garden outward.
    let budget = this.bloomRate;
    while (this.open < this.openGoal && budget-- > 0) {
      this.bloom(8 * PLOT_FLOWERS + this.open);
      this.open += 1;
    }
    // Each opening flower springs up and settles.
    if (this.bloomCount > 0) {
      for (let k = this.bloomCount - 1; k >= 0; k--) {
        const t = (this.bloomT[k] as number) + dt / BLOOM_SECONDS;
        const i = this.blooming[k] as number;
        if (t >= 1) {
          this.writeFlower(i, 1);
          this.bloomCount -= 1;
          this.blooming[k] = this.blooming[this.bloomCount] as number;
          this.bloomT[k] = this.bloomT[this.bloomCount] as number;
        } else {
          this.bloomT[k] = t;
          this.writeFlower(i, Math.max(0.02, easeOutBack(t)));
        }
      }
      this.stems.instanceMatrix.needsUpdate = true;
      this.petals.instanceMatrix.needsUpdate = true;
    }

    this.birds.update(dt);
    this.butterflies.update(dt);
    this.clouds.rotation.y += dt * 0.0035;

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

    // Pollen in the light where the color is back; petals from the almond tree once it blooms.
    if (this.wordsDone > 0 && (this.moteTimer -= dt) <= 0) {
      this.moteTimer = this.finished ? 0.08 : 0.3;
      vfx.burst(this.motes, 0, 2.6, GARDEN_Z - 1);
    }
    if (this.treeReached && (this.petalTimer -= dt) <= 0) {
      this.petalTimer = this.finished ? 0.16 : 0.7;
      vfx.burst(this.petalFall, TREE_X, terrain(TREE_X, TREE_Z) + 7.5, TREE_Z, 0.5, -0.4, 0.4);
    }
    if (this.finaleT >= 0) {
      const before = this.finaleT;
      this.finaleT += dt;
      // Two more fountains as the color rolls out.
      if (before < 0.7 && this.finaleT >= 0.7) vfx.burst(this.fountain, -3, 1.4, GARDEN_Z - 5, 0, 1, 0);
      if (before < 1.4 && this.finaleT >= 1.4) vfx.burst(this.fountain, 3, 1.4, GARDEN_Z - 9, 0, 1, 0);
    }
  }

  frame(dt: number): void {
    const { rig, typing } = this.ctx;
    // The camera drifts along its rail toward the chapter's place, breathing a little.
    const view = VIEW[this.chapter];
    this.railT = damp(this.railT, view.t, 0.9, dt);
    rig.railT = Math.max(0, Math.min(1, this.railT + Math.sin(this.time * 0.21) * 0.018));
    const look = this.lookAt.position;
    const k = Math.min(1, dt * 0.9);
    look.x += ((view.look[0] as number) - look.x) * k;
    look.y += ((view.look[1] as number) - look.y) * k;
    look.z += ((view.look[2] as number) - look.z) * k;

    // The word to type: a new one rises when the driver moves on.
    if (typing.letters !== this.shownLetters) {
      this.shownLetters = typing.letters;
      const n = typing.letters.length;
      const end = n > 0 && typing.letters[n - 1] === ' ' ? n - 1 : n;
      this.text.setWord(typing.letters.slice(0, end), /[֐-׿]/.test(typing.word));
    }
    this.text.frame(dt, typing.states);
    this.feedback.frame(dt);

    // The bed of the key to press next lights up; a bed just watered flashes gold.
    const next = this.finished ? undefined : this.plotOf.get(typing.letters[typing.position] ?? '');
    for (let i = 0; i < 8; i++) {
      const ch = this.plotChar[i] as string;
      if (!ch) {
        this.letters.hide(i);
        continue;
      }
      const glow = damp(this.plotGlow[i] as number, i === next ? 1 : 0, 9, dt);
      const flash = Math.max(0, (this.plotFlash[i] as number) - dt * 2.2);
      this.plotGlow[i] = glow;
      this.plotFlash[i] = flash;
      const a = ((PLOT_ANGLES[i] as number) * Math.PI) / 180;
      const x = (this.plotX[i] as number) + Math.sin(a) * STONE_OUT;
      const z = (this.plotZ[i] as number) - Math.cos(a) * STONE_OUT;
      const y = 1.2 + glow * (0.18 + 0.05 * Math.sin(this.time * 6)) + flash * 0.12;
      this.col.setHex(this.paper).lerp(this.col2.setHex(this.techelet), glow);
      this.col.lerp(this.col2.setHex(this.gold), flash);
      this.letters.set(
        i,
        ch,
        x,
        y,
        z,
        0.88 + glow * 0.2 + flash * 0.12,
        this.col.getHex(),
        1 + glow * 1.5 + flash * 1.8,
      );
    }
    this.letters.commit();
  }

  dispose(): void {
    this.quillTrail?.stop();
    this.quillTrail = null;
    for (const h of this.birdSong) h.stop();
    this.birdSong.length = 0;
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
    this.letters?.dispose();
    this.text?.dispose();
    this.feedback?.dispose();
    this.shownLetters = null;
    this.onMoment = null;
    this.plan = null;
  }
}
