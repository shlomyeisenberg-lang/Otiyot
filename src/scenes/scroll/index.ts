// The Blank Scroll and the Keeper (T27): the final sequence and the end of the story.
//
// An endless strip of white parchment between two great wooden rollers. Nothing is written on
// it yet, so the world has no color. The apprentice crosses it in five columns, Dyo hopping
// beside him; in each column the words he types raise drawings of the regions behind him (a
// sketch at first; color sweeps over them when the column is done), while "the white" (a pale
// knot of nothing hanging over the page) tries to wash him out with the attacks of the boss kit.
//
// At the far end stands the Keeper's archive: a ring of empty shelves, a great blank page, and
// the Keeper himself, grey and quiet. Naftali and Reb Ezra walk in beside the apprentice and
// call words in turn (the weak points). Every word typed inks a line on the great page; in the
// last phase the Keeper erases lines from the end while they are written. He is not destroyed:
// at the end the apprentice hands him the quill, he writes again, the page turns to gold, the
// shelves fill with books and color rolls back over the whole scroll. Then the credits are
// typed over the restored land.
//
// The typing is judged by the host; this scene only reacts. It reads the fight (BossFight) the
// screen gives it in `watch` and is told about lands, parries, staggers and transitions, exactly
// as the Silent Arena is (it is the same boss screen).

import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  PlaneGeometry,
  Quaternion,
  RingGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  type MeshBasicMaterial,
  type MeshLambertMaterial,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  burstStyle,
  Character,
  damp,
  easeInOut,
  easeOutBack,
  Rng,
  smoothstep,
  WorldText,
  type BurstStyle,
  type GameScene,
  type QualityPreset,
  type SceneContext,
  type ScenePalette,
  type Trail,
  type TypedKey,
} from '../../engine';
import { tierIntensity } from '../../audio/composer';
import type { AttackKind, BossFight, BossPlan } from '../../game/boss';
import { Dyo } from '../../game/dyo';
import { TypingFeedback } from '../../game/feedback';
import { DRAWINGS, DRAWINGS_PER_COLUMN, SLOTS } from './drawings';
import { BOOKS, SCROLL_LIGHTS, scrollLights, TINT, type ScrollLight, type Sky } from './palette';
import { allyAt, CROSSING, isKeeperPhase, type Ally } from './plan';

export interface ScrollSetup {
  /** The apprentice's robe (the profile's avatar). */
  look: { robe: number; hem: number; trim: number; headwear: 'cap' | 'hat' | 'turban' };
}

// --- The lay of the scroll. It runs away from the camera along -z.
const STRIP_HALF = 17;
const COLUMN_GAP = 18;
/** The archive's station (the fifth; columns are 0..4). */
const ARCHIVE = CROSSING;
const ARCHIVE_Z = -98;
const KEEPER_Z = -108;
const PAGE_Z = -115;
const PAGE_Y = 7.6;
const PAGE_W = 16;
const PAGE_H = 10.4;
const SCRIBE_X = -3;
const LETTER_SIZE = 1.05;
const TENDRIL = 24;
const SHARDS = 8;
const BOLTS = 3;
const BOLT_SECONDS = 0.3;
const ROWS = 10;
const PER_ROW = 6;
const LINES = ROWS * PER_ROW;
const CASES = 9;
const SHELVES = 5;
const BOOKS_PER_SHELF = 9;
const BOOK_COUNT = CASES * SHELVES * BOOKS_PER_SHELF;
const DRAWN = CROSSING * DRAWINGS_PER_COLUMN;
const TRANSITION_SECONDS = 3.2;

/** Where the scribe's station is for a stage (0..4 the columns, 5 the archive). */
function stationZ(stage: number): number {
  return stage >= ARCHIVE ? ARCHIVE_Z : -stage * COLUMN_GAP;
}
function stageOf(phase: number): number {
  return Math.min(ARCHIVE, phase);
}
function scribeZ(stage: number): number {
  return stationZ(stage) + 6;
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
  if (g.getAttribute('uv')) g.deleteAttribute('uv');
  return g;
}

function merged(parts: BufferGeometry[]): BufferGeometry {
  const out = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  return out ?? new BufferGeometry();
}

interface Shot {
  pos: Vector3;
  look: Vector3;
}

/** The ending's shots (the fight's own shot follows the stage). */
const SHOTS: Readonly<Record<string, Shot>> = {
  keeper: { pos: new Vector3(2.6, 3.3, KEEPER_Z + 6.6), look: new Vector3(0, 2.9, KEEPER_Z) },
  page: { pos: new Vector3(0, 6.6, KEEPER_Z + 13), look: new Vector3(0, PAGE_Y, PAGE_Z) },
  two: { pos: new Vector3(-6, 3.1, KEEPER_Z + 7.4), look: new Vector3(-0.7, 2.3, KEEPER_Z + 0.6) },
  allies: {
    pos: new Vector3(-1.2, 3.3, ARCHIVE_Z + 15),
    look: new Vector3(-1.2, 1.9, ARCHIVE_Z + 2.5),
  },
  wide: { pos: new Vector3(0, 36, PAGE_Z - 16), look: new Vector3(0, 0, -52) },
  credits: { pos: new Vector3(0, 15, 40), look: new Vector3(0, 2, -40) },
};

type Grade = Parameters<SceneContext['post']['setGrade']>[0];

const GRADES: Readonly<Record<ScrollLight, Grade>> = {
  c1: { saturation: 0.95, contrast: 1.04, vignette: 0.34, godRays: 0.4 },
  c2: { saturation: 1, contrast: 1.06, vignette: 0.38, godRays: 0.45 },
  c3: { saturation: 1, contrast: 1.08, vignette: 0.4, godRays: 0.6 },
  c4: { saturation: 1, contrast: 1.1, vignette: 0.46, shadowTint: 0xd0e8e8, godRays: 0.55 },
  c5: { saturation: 0.95, contrast: 1.16, vignette: 0.56, shadowTint: 0xc8c8f0, bloom: 1.3 },
  k1: { saturation: 0.85, contrast: 1.06, vignette: 0.42, godRays: 0.4 },
  k2: { saturation: 1, contrast: 1.12, vignette: 0.5, shadowTint: 0xf0d8c8, godRays: 0.6 },
  k3: { saturation: 0.95, contrast: 1.14, vignette: 0.54, shadowTint: 0xc8d4f4, godRays: 0.5 },
  k4: {
    saturation: 0.95,
    contrast: 1.2,
    vignette: 0.58,
    shadowTint: 0xc4c8f0,
    bloom: 1.45,
    godRays: 0.8,
    exposure: 1.06,
  },
  restored: { saturation: 1.16, contrast: 1.06, vignette: 0.32, godRays: 1, exposure: 1.04 },
};

export class ScrollScene implements GameScene {
  readonly id = 'scroll';
  /** Called first in every fixed step (the screen runs the fight's clock and the cutscene). */
  onStep: ((dt: number) => void) | null = null;
  /** A phase transition has finished playing. */
  onTransitionEnd: (() => void) | null = null;

  private ctx!: SceneContext;
  private readonly rng = new Rng(2727);
  private fight: BossFight | null = null;
  private plan: BossPlan | null = null;
  private apprentice!: Character;
  private ezra!: Character;
  private naftali!: Character;
  private keeper!: Character;
  private dyo!: Dyo;
  private text!: WorldText;
  private feedback!: TypingFeedback;
  private quillTrail: Trail | null = null;
  private shownLetters: readonly string[] | null = null;

  // The drawings of the crossing.
  private readonly drawings: Mesh[] = [];
  private readonly drawT = new Float32Array(DRAWN).fill(-1);
  private wordsDone = 0;

  // The white.
  private knot!: Mesh;
  private halo!: Mesh;
  private knotSize = 1;
  private flinch = 0;
  private flinchV = 0;
  private reel = 0;

  // The archive.
  private lines!: InstancedMesh;
  private lineMat!: MeshBasicMaterial;
  private readonly linePos = new Float32Array(LINES * 3);
  private readonly lineWidth = new Float32Array(LINES);
  private linesShown = 0;
  private wipe!: Mesh;
  private pageGlow!: MeshLambertMaterial;
  private books!: InstancedMesh;
  private booksT = -1;
  private gift!: Mesh;
  private giftT = -1;
  private readonly giftFrom = new Vector3();
  private quillGiven = false;
  private pageGold = 0;
  private pageGoldWant = 0;
  private keeperShare = 1;

  // Attacks.
  private attack: AttackKind = 'spatter';
  private shown = 0;
  private landT = -1;
  private snapT = -1;
  private orb!: Mesh;
  private ring!: Mesh;
  private tendril!: InstancedMesh;
  private tide!: Mesh;
  private shards!: InstancedMesh;
  private tideScale = 13;
  private shardSpin = 0;

  // Bolts of gold ink from the quill.
  private readonly bolts: Mesh[] = [];
  private readonly boltT = new Float32Array(BOLTS).fill(-1);
  private readonly boltFrom: Vector3[] = [];
  private readonly boltTo: Vector3[] = [];
  private readonly boltTrail: (Trail | null)[] = [];
  private nextBolt = 0;

  // Camera, light and the phase look.
  private readonly camPos = new Vector3();
  private readonly camLook = new Vector3();
  private readonly fightShot: Shot = { pos: new Vector3(), look: new Vector3() };
  private readonly bossShot: Shot = { pos: new Vector3(), look: new Vector3() };
  private shot: Shot = this.fightShot;
  private shotRate = 2;
  private push = 0;
  private palFrom!: Sky;
  private palTo!: Sky;
  private palT = 1;
  private palRate = 1 / 1.6;
  private readonly pal: ScenePalette = {
    skyTop: 0,
    skyHorizon: 0,
    sun: 0,
    sunIntensity: 1,
    sunFrom: [0, 1, 0],
    fillSky: 0,
    fillGround: 0,
    fillIntensity: 1,
    fog: 0,
    fogDensity: 0.01,
    fogBase: 0,
    fogFalloff: 0.1,
    inscatter: 0.5,
    fade: 0,
    ink: 0,
  };
  private readonly sunFrom: [number, number, number] = [0, 1, 0];

  // The run.
  private phase = 0;
  private stage = 0;
  private transT = -1;
  private transTo = 0;
  private heardTier = 0;
  private time = 0;
  private won = false;
  private restoredAll = false;
  private credits = false;
  private creditN = 0;
  private calling: Ally | null = null;
  /** The apprentice's walk: from, to (z), 0..1; and where he stands on x. */
  private walkT = -1;
  private walkFrom = 0;
  private walkTo = 0;
  private walkSeconds = 2.4;
  private walkFromX = SCRIBE_X;
  private walkToX = SCRIBE_X;
  /** The allies walking into the archive (0..1), and gathering round at the ending. */
  private alliesT = -1;
  private alliesIn = false;
  private gatherT = -1;
  private readonly allyStep = new Float32Array(2);

  private gold = 0;
  private techelet = 0;
  private paper = 0;
  private inkDark = 0;
  private errColor = 0;
  private sparks!: BurstStyle;
  private inkDrops!: BurstStyle;
  private splash!: BurstStyle;
  private fountain!: BurstStyle;
  private foam!: BurstStyle;
  private motes!: BurstStyle;
  private moteTimer = 0;

  private readonly v = new Vector3();
  private readonly v2 = new Vector3();
  private readonly v3 = new Vector3();
  private readonly m4 = new Matrix4();
  private readonly q = new Quaternion();
  private readonly s = new Vector3();
  private readonly cA = new Color();
  private readonly cB = new Color();

  constructor(private readonly setup: ScrollSetup) {}

  // ---- probes (the screen and the smoke test read these) -------------------------------------

  /** The phase the scroll is showing (0..8). */
  get phaseShown(): number {
    return this.phase;
  }

  /** 0..1: the attack as drawn (follows the fight's windup). */
  get attackShown(): number {
    return this.shown;
  }

  get transitioning(): boolean {
    return this.transT >= 0;
  }

  /** True once the ending restored the scroll. */
  get restored(): boolean {
    return this.restoredAll;
  }

  /** True once the Keeper holds a quill again (the boss screen's "boss is done"). */
  get blotBroken(): boolean {
    return this.quillGiven;
  }

  /** How many drawings stand on the scroll. */
  get drawn(): number {
    let n = 0;
    for (let i = 0; i < DRAWN; i++) if ((this.drawT[i] as number) >= 0) n += 1;
    return n;
  }

  /** How many lines are inked on the great page (0..60). */
  get pageLines(): number {
    return this.linesShown;
  }

  /** Who is calling a word right now (the Keeper's weak points), if anyone. */
  get caller(): Ally | null {
    return this.calling;
  }

  // ---- loading ------------------------------------------------------------------------------

  async load(ctx: SceneContext): Promise<void> {
    this.ctx = ctx;
    const { materials: kit, root } = ctx;
    this.gold = ctx.color('gold');
    this.techelet = ctx.color('techelet');
    this.paper = ctx.theme === 'light' ? ctx.color('surface') : ctx.color('ink');
    this.inkDark = ctx.theme === 'light' ? ctx.color('ink') : ctx.color('bg');
    this.errColor = ctx.color('err-fg');

    ctx.audio.music('final');
    ctx.audio.section('cross1');
    ctx.audio.intensity(0);
    ctx.audio.ambience('wind');

    this.palFrom = this.sky('c1');
    this.palTo = this.palFrom;
    this.applyPalette(1);
    ctx.atmosphere.groundAt = () => 0;
    ctx.atmosphere.setShadowRange(34);
    ctx.post.setGrade(GRADES.c1);
    ctx.rig.groundAt = () => 0;

    this.sparks = burstStyle({
      count: 14,
      color: this.gold,
      color2: 0xfff2c0,
      intensity: 2.6,
      speed: [1.4, 4.2],
      life: [0.35, 0.8],
      size: [0.05, 0.14],
      gravity: 3,
    });
    this.inkDrops = burstStyle({
      count: 12,
      color: 0x14121c,
      color2: 0x2a3a7a,
      speed: [1.5, 4.5],
      spread: 0.8,
      life: [0.5, 1.1],
      size: [0.08, 0.22],
      gravity: 7,
      radius: 0.5,
    });
    this.splash = burstStyle({
      count: 30,
      color: TINT.white,
      color2: TINT.whiteCore,
      intensity: 1.6,
      speed: [2.5, 7],
      spread: 0.9,
      life: [0.6, 1.3],
      size: [0.12, 0.3],
      gravity: 5,
      radius: 0.5,
    });
    this.fountain = burstStyle({
      count: 110,
      color: this.gold,
      color2: 0xfff6d8,
      intensity: 3,
      speed: [4, 12],
      spread: 0.45,
      life: [1, 2.2],
      size: [0.07, 0.2],
      gravity: 4,
    });
    this.foam = burstStyle({
      count: 10,
      color: this.gold,
      color2: 0xfff2c0,
      intensity: 2.2,
      speed: [0.8, 2.6],
      spread: 0.8,
      life: [0.5, 1.1],
      size: [0.08, 0.2],
      gravity: 2,
      radius: 0.4,
    });
    this.motes = burstStyle({
      count: 1,
      color: 0xffffff,
      color2: 0xd8d4cc,
      intensity: 1.2,
      speed: [0.05, 0.3],
      life: [3, 6],
      size: [0.04, 0.1],
      gravity: -0.08,
      radius: 14,
    });

    this.buildScroll();
    this.buildDrawings();
    this.buildArchive();
    this.buildAttacks();

    // --- The people. Every one of them is a man (ARCHITECTURE section 8); Dyo is an ink drop.
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
    this.naftali = new Character(kit, {
      robe: TINT.naftaliRobe,
      hem: TINT.naftaliHem,
      trim: TINT.naftaliTrim,
      skin: TINT.skin,
      ink: TINT.ink,
      headwear: 'cap',
      beard: TINT.naftaliBeard,
      height: 0.98,
      seed: 12,
    });
    // The Keeper: tall, grey, a long white beard. His hands are empty until the ending.
    this.keeper = new Character(kit, {
      robe: TINT.keeperRobe,
      hem: TINT.keeperHem,
      trim: TINT.keeperTrim,
      skin: TINT.skin,
      ink: TINT.ink,
      headwear: 'turban',
      beard: TINT.keeperBeard,
      height: 1.2,
      seed: 27,
    });
    this.dyo = new Dyo(kit, {
      body: TINT.dyo,
      shine: TINT.dyoShine,
      eye: TINT.dyoEye,
      pupil: TINT.ink,
    });
    this.dyo.root.scale.setScalar(0.62);
    root.add(
      this.apprentice.root,
      this.ezra.root,
      this.naftali.root,
      this.keeper.root,
      this.dyo.root,
    );
    ctx.atmosphere.addBlob(this.apprentice.root, 0.5);
    ctx.atmosphere.addBlob(this.ezra.root, 0.55);
    ctx.atmosphere.addBlob(this.naftali.root, 0.5);
    ctx.atmosphere.addBlob(this.keeper.root, 0.65);
    ctx.atmosphere.addBlob(this.dyo.root, 0.25);

    // --- The word to type, on a parchment banner over the scribe's column.
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
        err: this.errColor,
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

    this.onQuality(ctx.quality);
    this.setStage(0, true);
    this.placePeople();
  }

  private sky(light: ScrollLight): Sky {
    return scrollLights(this.ctx.theme)[light];
  }

  /** The parchment strip with its ruled lines, the white all round it, and the two rollers. */
  private buildScroll(): void {
    const { materials: kit, tracker, root } = this.ctx;
    const r = this.rng;
    const blank = new Mesh(
      tracker.track(new PlaneGeometry(520, 520, 1, 1).rotateX(-Math.PI / 2)),
      tracker.track(kit.surface({ color: TINT.blank, restore: false })),
    );
    blank.position.set(0, -0.06, -60);
    blank.receiveShadow = true;
    root.add(blank);

    const strip = new PlaneGeometry(STRIP_HALF * 2, 176, 10, 64).rotateX(-Math.PI / 2);
    strip.translate(0, 0, -62);
    const pos = strip.getAttribute('position');
    const colors = new Float32Array(pos.count * 3);
    const a = new Color();
    const b = new Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      // The edges of the parchment curl up a little.
      const edge = smoothstep(STRIP_HALF - 3, STRIP_HALF, Math.abs(x));
      pos.setY(i, edge * edge * 0.9);
      a.setHex(TINT.parchment).lerp(b.setHex(TINT.parchmentShade), edge * 0.6 + r.next() * 0.14);
      colors[i * 3] = a.r;
      colors[i * 3 + 1] = a.g;
      colors[i * 3 + 2] = a.b;
    }
    strip.setAttribute('color', new BufferAttribute(colors, 3));
    strip.computeVertexNormals();
    const sheet = new Mesh(
      tracker.track(strip),
      tracker.track(kit.surface({ vertexColors: true, flat: false, side: DoubleSide })),
    );
    sheet.receiveShadow = true;
    root.add(sheet);

    // The scribe's ruling: scored lines across the page, and the margins of each column.
    const rules: BufferGeometry[] = [];
    for (let z = 18; z > -146; z -= 3) {
      rules.push(
        painted(new BoxGeometry(STRIP_HALF * 2 - 7, 0.02, 0.07).translate(0, 0.03, z), TINT.rule),
      );
    }
    for (let i = 0; i <= CROSSING; i++) {
      const z = stationZ(i) + 9.4;
      rules.push(
        painted(new BoxGeometry(STRIP_HALF * 2 - 6, 0.03, 0.16).translate(0, 0.03, z), TINT.rule),
      );
    }
    const ruled = new Mesh(
      tracker.track(merged(rules)),
      tracker.track(kit.surface({ vertexColors: true })),
    );
    root.add(ruled);

    // The rollers: turned wood with brass caps, one behind the start and one beyond the archive.
    const roller = (z: number): BufferGeometry[] => {
      const rod = (len: number, rad: number, hex: number, x = 0): BufferGeometry =>
        painted(
          new CylinderGeometry(rad, rad, len, 16).rotateZ(Math.PI / 2).translate(x, 2.2, z),
          hex,
        );
      return [
        rod(STRIP_HALF * 2 - 1, 2.2, TINT.parchmentShade),
        rod(1.2, 2.8, TINT.wood, STRIP_HALF + 0.1),
        rod(1.2, 2.8, TINT.wood, -STRIP_HALF - 0.1),
        rod(5, 0.8, TINT.woodLight, STRIP_HALF + 3),
        rod(5, 0.8, TINT.woodLight, -STRIP_HALF - 3),
        rod(0.9, 1.3, TINT.brass, STRIP_HALF + 5.6),
        rod(0.9, 1.3, TINT.brass, -STRIP_HALF - 5.6),
      ];
    };
    const rollers = new Mesh(
      tracker.track(merged([...roller(27), ...roller(-151)])),
      tracker.track(kit.surface({ vertexColors: true, flat: false })),
    );
    kit.caster(rollers, true);
    rollers.receiveShadow = true;
    root.add(rollers);
  }

  /** The thirty drawings, hidden until they are written. */
  private buildDrawings(): void {
    const { materials: kit, tracker, root } = this.ctx;
    const mat = tracker.track(kit.surface({ vertexColors: true, flat: true }));
    for (let c = 0; c < CROSSING; c++) {
      const set = DRAWINGS[c] ?? [];
      for (let j = 0; j < DRAWINGS_PER_COLUMN; j++) {
        const build = set[j];
        const slot = SLOTS[j] as readonly [number, number];
        const mesh = new Mesh(tracker.track(build ? build() : new BufferGeometry()), mat);
        mesh.position.set(slot[0], 0.04, stationZ(c) + slot[1]);
        // Turned a little toward the scribe's side of the page.
        mesh.rotation.y = -slot[0] * 0.03;
        mesh.scale.setScalar(1.25);
        mesh.visible = false;
        kit.caster(mesh, true);
        mesh.receiveShadow = true;
        this.drawings.push(mesh);
        root.add(mesh);
      }
    }
  }

  /** The Keeper's archive: a dais, a ring of empty shelves, the great page and its lines. */
  private buildArchive(): void {
    const { materials: kit, tracker, root } = this.ctx;
    const r = this.rng;
    const wood: BufferGeometry[] = [];
    const m = new Matrix4();
    const q = new Quaternion();
    const up = new Vector3(0, 1, 0);
    const bookGeo = tracker.track(new BoxGeometry(0.34, 1.2, 0.7));
    this.books = new InstancedMesh(bookGeo, tracker.track(kit.surface({ flat: true })), BOOK_COUNT);
    const c = new Color();
    let b = 0;
    for (let k = 0; k < CASES; k++) {
      // An arc behind and beside the Keeper, open toward the scribe.
      const ang = Math.PI * (0.06 + (0.88 * k) / (CASES - 1));
      const cx = Math.cos(ang) * 24;
      const cz = KEEPER_Z - 2 - Math.sin(ang) * 15;
      const face = Math.atan2(-cx, KEEPER_Z + 8 - cz);
      q.setFromAxisAngle(up, face);
      const high = 9.5 + (k % 2) * 1.6;
      const at = (g: BufferGeometry): BufferGeometry =>
        g.applyMatrix4(m.compose(new Vector3(cx, 0, cz), q, new Vector3(1, 1, 1)));
      wood.push(
        at(painted(new BoxGeometry(5.4, high, 0.2).translate(0, high / 2, -0.5), TINT.shelfDark)),
      );
      wood.push(
        at(painted(new BoxGeometry(0.3, high, 1.2).translate(-2.7, high / 2, 0), TINT.shelf)),
      );
      wood.push(
        at(painted(new BoxGeometry(0.3, high, 1.2).translate(2.7, high / 2, 0), TINT.shelf)),
      );
      wood.push(
        at(painted(new BoxGeometry(5.9, 0.4, 1.5).translate(0, high + 0.2, 0), TINT.shelf)),
      );
      for (let s = 0; s < SHELVES; s++) {
        const y = 0.3 + s * 1.75;
        wood.push(at(painted(new BoxGeometry(5.2, 0.16, 1.1).translate(0, y, 0), TINT.shelf)));
        for (let i = 0; i < BOOKS_PER_SHELF; i++) {
          const lean = r.next() < 0.12 ? 0.25 : 0;
          const hgt = 0.8 + r.next() * 0.35;
          this.q.setFromAxisAngle(up, face);
          this.s.set(1 + r.next() * 0.5, hgt, 1);
          this.v.set(-2.2 + i * 0.55, y + 0.08 + 0.6 * hgt, 0.05).applyQuaternion(this.q);
          this.v.x += cx;
          this.v.z += cz;
          if (lean) this.q.multiply(q.clone().setFromAxisAngle(new Vector3(0, 0, 1), lean));
          this.books.setMatrixAt(b, this.m4.compose(this.v, this.q, this.s));
          this.books.setColorAt(b, c.setHex(BOOKS[Math.floor(r.next() * BOOKS.length)] as number));
          b += 1;
        }
      }
    }
    this.books.count = 0;
    this.books.instanceMatrix.needsUpdate = true;
    if (this.books.instanceColor) this.books.instanceColor.needsUpdate = true;
    this.books.frustumCulled = false;
    root.add(tracker.track(this.books));

    // The dais, the Keeper's desk, and the frame of the great page.
    wood.push(
      painted(new CylinderGeometry(6.4, 7, 0.5, 28).translate(0, 0.25, KEEPER_Z), TINT.dais),
    );
    wood.push(
      painted(new CylinderGeometry(4.6, 5, 0.3, 28).translate(0, 0.65, KEEPER_Z), TINT.dais),
    );
    wood.push(
      painted(new BoxGeometry(2.4, 0.2, 1.2).translate(2.6, 2.1, KEEPER_Z - 0.4), TINT.wood),
    );
    wood.push(
      painted(new BoxGeometry(0.3, 1.3, 0.3).translate(2.6, 1.45, KEEPER_Z - 0.4), TINT.woodDark),
    );
    const fy = PAGE_Y;
    wood.push(
      painted(
        new BoxGeometry(PAGE_W + 1.4, 0.6, 0.6).translate(0, fy + PAGE_H / 2 + 0.3, PAGE_Z),
        TINT.wood,
      ),
    );
    wood.push(
      painted(
        new BoxGeometry(PAGE_W + 1.4, 0.6, 0.6).translate(0, fy - PAGE_H / 2 - 0.3, PAGE_Z),
        TINT.wood,
      ),
    );
    wood.push(
      painted(
        new BoxGeometry(0.5, PAGE_H + 3.6, 0.5).translate(-PAGE_W / 2 - 0.5, fy - 1.2, PAGE_Z),
        TINT.woodDark,
      ),
    );
    wood.push(
      painted(
        new BoxGeometry(0.5, PAGE_H + 3.6, 0.5).translate(PAGE_W / 2 + 0.5, fy - 1.2, PAGE_Z),
        TINT.woodDark,
      ),
    );
    const frame = new Mesh(
      tracker.track(merged(wood)),
      tracker.track(kit.surface({ vertexColors: true, flat: true })),
    );
    kit.caster(frame, true);
    frame.receiveShadow = true;
    root.add(frame);

    this.pageGlow = tracker.track(
      kit.surface({
        color: TINT.page,
        restore: false,
        emissive: TINT.page,
        emissiveIntensity: 0.25,
        side: DoubleSide,
      }),
    );
    const page = new Mesh(tracker.track(new PlaneGeometry(PAGE_W, PAGE_H)), this.pageGlow);
    page.position.set(0, PAGE_Y, PAGE_Z + 0.05);
    root.add(page);

    // The lines of writing: sixty strokes, row by row.
    this.lineMat = tracker.track(kit.ink(this.inkDark, 1));
    this.lines = new InstancedMesh(
      tracker.track(new BoxGeometry(1, 0.24, 0.06)),
      this.lineMat,
      LINES,
    );
    this.lines.count = 0;
    this.lines.frustumCulled = false;
    root.add(tracker.track(this.lines));
    this.layLines(false);

    // The Keeper's eraser: a pale bar of light where the next line would be wiped.
    this.wipe = new Mesh(
      tracker.track(new PlaneGeometry(2.6, 0.7)),
      tracker.track(kit.ink(TINT.white, 2.4)),
    );
    this.wipe.visible = false;
    root.add(this.wipe);

    // The quill that is handed over at the ending.
    this.gift = new Mesh(
      tracker.track(new ConeGeometry(0.09, 0.9, 5).rotateX(Math.PI / 2)),
      tracker.track(kit.ink(this.gold, 2.8)),
    );
    this.gift.visible = false;
    root.add(this.gift);
  }

  /** Lays the sixty strokes on the page, from the right for Hebrew. */
  private layLines(rtl: boolean): void {
    const r = new Rng(60);
    const usable = PAGE_W - 2.4;
    const cell = usable / PER_ROW;
    for (let k = 0; k < LINES; k++) {
      const row = Math.floor(k / PER_ROW);
      const col = k % PER_ROW;
      const w = cell * (0.55 + r.next() * 0.32);
      const edge = -usable / 2 + col * cell + w / 2;
      const x = rtl ? -edge : edge;
      const y = PAGE_Y + PAGE_H / 2 - 1 - row * ((PAGE_H - 2) / (ROWS - 1));
      this.linePos[k * 3] = x;
      this.linePos[k * 3 + 1] = y;
      this.linePos[k * 3 + 2] = PAGE_Z + 0.12;
      this.lineWidth[k] = w;
      this.q.identity();
      this.lines.setMatrixAt(
        k,
        this.m4.compose(this.v.set(x, y, PAGE_Z + 0.12), this.q, this.s.set(w, 1, 1)),
      );
    }
    this.lines.instanceMatrix.needsUpdate = true;
  }

  private buildAttacks(): void {
    const { materials: kit, tracker, root } = this.ctx;
    const white = tracker.track(
      kit.surface({
        color: TINT.whiteCore,
        restore: false,
        emissive: TINT.white,
        emissiveIntensity: 0.75,
      }),
    );
    // The white itself: a knot of nothing over the page, with a slow halo.
    this.knot = new Mesh(tracker.track(new IcosahedronGeometry(1.5, 1)), white);
    kit.caster(this.knot, true);
    root.add(this.knot);
    this.halo = new Mesh(
      tracker.track(new TorusGeometry(2.3, 0.07, 6, 40)),
      tracker.track(kit.ink(TINT.white, 1.8)),
    );
    root.add(this.halo);
    // Spatter: one orb at a time, and the ring on the page that says where it lands.
    this.orb = new Mesh(tracker.track(new SphereGeometry(0.9, 14, 10)), white);
    this.orb.visible = false;
    kit.caster(this.orb, true);
    root.add(this.orb);
    this.ring = new Mesh(
      tracker.track(new TorusGeometry(1, 0.06, 6, 40).rotateX(Math.PI / 2)),
      tracker.track(kit.ink(this.errColor, 1.6)),
    );
    this.ring.visible = false;
    root.add(this.ring);
    // Tendrils: a chain of pale beads.
    this.tendril = new InstancedMesh(tracker.track(new IcosahedronGeometry(1, 1)), white, TENDRIL);
    this.tendril.count = 0;
    this.tendril.frustumCulled = false;
    root.add(tracker.track(this.tendril));
    // Flood: a ring of white closing on the scribe (scaled: inner radius = scale).
    this.tide = new Mesh(
      tracker.track(new RingGeometry(1, 30, 64, 1).rotateX(-Math.PI / 2)),
      tracker.track(
        kit.surface({
          color: TINT.blank,
          restore: false,
          emissive: TINT.white,
          emissiveIntensity: 0.4,
          side: DoubleSide,
        }),
      ),
    );
    this.tide.visible = false;
    root.add(this.tide);
    // Mirror: blank pages that circle the scribe.
    this.shards = new InstancedMesh(
      tracker.track(new PlaneGeometry(0.9, 1.2)),
      tracker.track(kit.ink(TINT.white, 1.5)),
      SHARDS,
    );
    this.shards.count = 0;
    this.shards.frustumCulled = false;
    root.add(tracker.track(this.shards));
    // Bolts of gold ink.
    const boltGeo = tracker.track(new SphereGeometry(0.2, 10, 8));
    const boltMat = tracker.track(kit.ink(this.gold, 3.2));
    for (let i = 0; i < BOLTS; i++) {
      const b = new Mesh(boltGeo, boltMat);
      b.visible = false;
      this.bolts.push(b);
      this.boltFrom.push(new Vector3());
      this.boltTo.push(new Vector3());
      this.boltTrail.push(null);
      root.add(b);
    }
  }

  onQuality(preset: QualityPreset): void {
    const full = preset.shadows === 'cascaded';
    this.apprentice?.shadowDetail(full);
    this.ezra?.shadowDetail(full);
    this.naftali?.shadowDetail(full);
    this.keeper?.shadowDetail(full);
  }

  // ---- where everyone stands -------------------------------------------------------------------

  private face(
    c: { root: { position: Vector3; rotation: { y: number } } },
    x: number,
    z: number,
  ): void {
    c.root.rotation.y = Math.atan2(x - c.root.position.x, z - c.root.position.z);
  }

  /** Where the scribe's words fly (and where the attacks come from) on a stage. */
  private targetPoint(stage: number, out: Vector3): Vector3 {
    if (stage >= ARCHIVE) return out.set(0.5, 3.6, KEEPER_Z + 0.8);
    return out.set(0, 6.2, stationZ(stage) - 9);
  }

  /** Points the fight's shot and the push-in at a stage. */
  private setStage(stage: number, cut: boolean): void {
    this.stage = stage;
    const z = stationZ(stage);
    if (stage >= ARCHIVE) {
      this.fightShot.pos.set(8.5, 9.6, z + 27);
      this.fightShot.look.set(-0.6, 4.4, KEEPER_Z);
      this.bossShot.pos.set(1.4, 3.4, KEEPER_Z + 8.5);
      this.bossShot.look.set(0, 3, KEEPER_Z);
    } else {
      this.fightShot.pos.set(7, 8.8, z + 23);
      this.fightShot.look.set(-0.6, 2.9, z - 6);
      this.bossShot.pos.set(1.8, 5, z + 3);
      this.bossShot.look.set(0, 5.6, z - 9);
    }
    this.targetPoint(stage, this.v);
    this.knot.position.copy(this.v);
    this.text.anchor.set(-0.4, stage >= ARCHIVE ? 8.2 : 9.4, scribeZ(stage) - 4.5);
    if (cut) this.frameShot(this.fightShot, true);
  }

  private placePeople(): void {
    const st = this.stage;
    const z = scribeZ(st);
    this.apprentice.root.position.set(SCRIBE_X, 0, z);
    this.targetPoint(st, this.v);
    this.face(this.apprentice, this.v.x, this.v.z);
    this.apprentice.anim.speed = 0;
    this.keeper.root.position.set(0, 0.8, KEEPER_Z);
    this.keeper.root.rotation.y = Math.atan2(SCRIBE_X, scribeZ(ARCHIVE) - KEEPER_Z);
    this.alliesIn = st >= ARCHIVE;
    this.alliesT = -1;
    this.gatherT = -1;
    this.allyStep.fill(0);
    this.placeAllies(this.alliesIn ? 1 : 0, 0);
    this.ezra.root.visible = this.alliesIn;
    this.naftali.root.visible = this.alliesIn;
    this.dyoHome();
  }

  /** Naftali on the scribe's left, Reb Ezra on his right; `k` walks them in, `g` gathers them. */
  private placeAllies(k: number, g: number): void {
    const z = scribeZ(ARCHIVE);
    const back = (1 - k) * 16;
    const nx = -9 + g * 3.4 + this.allyStep[0]! * 1.6;
    const nz = z - 1 + back - g * 6.5 - this.allyStep[0]! * 1.2;
    const ex = 4.6 - g * 1.4 - this.allyStep[1]! * 1.5;
    const ez = z + back * 1.1 - g * 6 - this.allyStep[1]! * 1.2;
    this.naftali.root.position.set(nx, 0, nz);
    this.ezra.root.position.set(ex, 0, ez);
    this.face(this.naftali, 0, KEEPER_Z);
    this.face(this.ezra, 0, KEEPER_Z);
  }

  private dyoHome(): void {
    const a = this.apprentice.root.position;
    if (this.stage >= ARCHIVE) this.dyo.root.position.set(a.x + 3.4, 0, a.z + 1.6);
    else this.dyo.root.position.set(a.x - 2, 0, a.z + 0.8);
    this.targetPoint(this.stage, this.v);
    this.dyo.face(this.v.x, this.v.z);
  }

  // ---- a fight ------------------------------------------------------------------------------

  start(): void {
    this.reset();
  }

  private reset(): void {
    const { materials } = this.ctx;
    materials.clearSweeps();
    materials.restoreAll(0, 0);
    this.won = false;
    this.restoredAll = false;
    this.credits = false;
    this.creditN = 0;
    this.quillGiven = false;
    this.gift.visible = false;
    this.gift.removeFromParent();
    this.ctx.root.add(this.gift);
    this.giftT = -1;
    this.pageGold = 0;
    this.pageGoldWant = 0;
    this.booksT = -1;
    this.books.count = 0;
    this.linesShown = 0;
    this.lines.count = 0;
    this.lineMat.color.setHex(this.inkDark);
    this.transT = -1;
    this.walkT = -1;
    this.landT = -1;
    this.snapT = -1;
    this.shown = 0;
    this.flinch = 0;
    this.flinchV = 0;
    this.reel = 0;
    this.heardTier = 0;
    this.shownLetters = null;
    this.calling = null;
    this.wordsDone = 0;
    this.drawT.fill(-1);
    for (const d of this.drawings) d.visible = false;
    this.ctx.audio.intensity(0);
    for (let i = 0; i < BOLTS; i++) {
      this.boltT[i] = -1;
      (this.bolts[i] as Mesh).visible = false;
      this.boltTrail[i]?.stop();
      this.boltTrail[i] = null;
    }
  }

  /** A new fight (or the same one from a checkpoint): the scene follows `fight`. */
  watch(fight: BossFight): void {
    this.reset();
    this.fight = fight;
    this.plan = fight.plan;
    // Where the Keeper's part begins on the health bar.
    const notches = fight.notches;
    this.keeperShare = 1 - (notches[CROSSING - 1] ?? 0.5);
    const first = fight.plan.phases[0]?.text ?? '';
    this.layLines(/[֐-׿]/.test(first));
    this.ctx.audio.music('final');
    this.setStage(stageOf(fight.phase), true);
    this.setPhaseLook(fight.phase, true);
    this.placePeople();
    this.ctx.audio.section(fight.def.music);
  }

  /** The look of phase `i`: its light and grade; what is already written stays written. */
  private setPhaseLook(i: number, now: boolean): void {
    this.phase = i;
    this.attack = this.plan?.phases[i]?.def.attack ?? 'spatter';
    const light = SCROLL_LIGHTS[i] ?? 'c1';
    this.toLight(light, now ? 0 : 1.8);
    this.ctx.post.setGrade(GRADES[light]);
    this.text.setStyle(i === this.lastPhase ? 'hologram' : 'banner');
    this.tideScale = 13;
    this.wordsDone = 0;
    if (now) {
      // From a checkpoint: the columns already crossed stand drawn and in color.
      const done = Math.min(CROSSING, i);
      for (let c = 0; c < done; c++) {
        for (let j = 0; j < DRAWINGS_PER_COLUMN; j++)
          this.showDrawing(c * DRAWINGS_PER_COLUMN + j, true);
        this.ctx.materials.sweep(0, 0, stationZ(c) - 8, 17, 0.05);
      }
    }
  }

  private get lastPhase(): number {
    return (this.plan?.phases.length ?? 9) - 1;
  }

  private showDrawing(k: number, now: boolean): void {
    const mesh = this.drawings[k];
    if (!mesh || (this.drawT[k] as number) >= 0) return;
    this.drawT[k] = now ? 1 : 0;
    mesh.visible = true;
    mesh.scale.setScalar(now ? 1.25 : 0.001);
  }

  private toLight(light: ScrollLight, seconds: number): void {
    const target = this.sky(light);
    this.palFrom = this.blendSnapshot();
    this.palTo = target;
    this.palT = seconds <= 0 ? 1 : 0;
    this.palRate = seconds <= 0 ? 1 : 1 / seconds;
    if (seconds <= 0) this.applyPalette(1);
  }

  /** The palette as it is right now (to blend away from). Allocates: only at a phase change. */
  private blendSnapshot(): Sky {
    const p = this.pal;
    return {
      skyTop: p.skyTop,
      skyHorizon: p.skyHorizon,
      sun: p.sun,
      sunIntensity: p.sunIntensity,
      sunFrom: [p.sunFrom[0], p.sunFrom[1], p.sunFrom[2]],
      fillSky: p.fillSky,
      fillGround: p.fillGround,
      fillIntensity: p.fillIntensity,
      fog: p.fog,
      fogDensity: p.fogDensity,
      fogBase: p.fogBase,
      fogFalloff: p.fogFalloff,
      inscatter: p.inscatter,
    };
  }

  private mix(a: number, b: number, t: number): number {
    return this.cA.setHex(a).lerp(this.cB.setHex(b), t).getHex();
  }

  private applyPalette(t: number): void {
    const a = this.palFrom;
    const b = this.palTo;
    const p = this.pal;
    const k = t * t * (3 - 2 * t);
    const n = (x: number, y: number): number => x + (y - x) * k;
    p.skyTop = this.mix(a.skyTop, b.skyTop, k);
    p.skyHorizon = this.mix(a.skyHorizon, b.skyHorizon, k);
    p.sun = this.mix(a.sun, b.sun, k);
    p.sunIntensity = n(a.sunIntensity, b.sunIntensity);
    this.sunFrom[0] = n(a.sunFrom[0], b.sunFrom[0]);
    this.sunFrom[1] = n(a.sunFrom[1], b.sunFrom[1]);
    this.sunFrom[2] = n(a.sunFrom[2], b.sunFrom[2]);
    p.sunFrom = this.sunFrom;
    p.fillSky = this.mix(a.fillSky, b.fillSky, k);
    p.fillGround = this.mix(a.fillGround, b.fillGround, k);
    p.fillIntensity = n(a.fillIntensity, b.fillIntensity);
    p.fog = this.mix(a.fog, b.fog, k);
    p.fogDensity = n(a.fogDensity, b.fogDensity);
    p.fogBase = n(a.fogBase, b.fogBase);
    p.fogFalloff = n(a.fogFalloff, b.fogFalloff);
    p.inscatter = n(a.inscatter, b.inscatter);
    p.fade = this.ctx.color('fade');
    p.ink = this.gold;
    this.ctx.atmosphere.setPalette(p);
  }

  private frameShot(s: Shot, cut = false, rate = 2): void {
    this.shot = s;
    this.shotRate = rate;
    if (cut) {
      this.camPos.copy(s.pos);
      this.camLook.copy(s.look);
      this.ctx.rig.fixed(this.camPos, this.camLook);
      this.ctx.rig.cut();
    }
  }

  private get motion(): boolean {
    return this.ctx.rig.pushScale > 0;
  }

  private get atKeeper(): boolean {
    return isKeeperPhase(this.phase);
  }

  // ---- typing -------------------------------------------------------------------------------

  onKey(ev: TypedKey): void {
    const { typing, audio, vfx } = this.ctx;
    if (!ev.correct) {
      this.text.miss();
      this.feedback.wrong();
      audio.play('error');
      this.hearTier(typing.tier);
      // A slip feeds the white: it swells a little.
      this.kick(-0.6);
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
    if (this.credits) return;
    // Every right letter drops ink on the page at the scribe's feet; the flood draws back.
    const p = this.apprentice.root.position;
    vfx.burst(
      this.inkDrops,
      p.x + this.rng.signed() * 1.6,
      0.2,
      p.z - 1.6 + this.rng.signed(),
      0,
      0.6,
      0,
      true,
    );
    if (this.attack === 'flood') this.tideScale = Math.min(13, this.tideScale + 0.35);
  }

  /** The music builds with the combo tier; a new tier rings a chime. */
  private hearTier(tier: number): void {
    if (tier > this.heardTier) {
      this.ctx.audio.play('tier', tier);
      this.dyo.cheer(2 + tier);
      const p = this.apprentice.root.position;
      this.ctx.vfx.burst(this.sparks, p.x, p.y + 1.4, p.z, 0, 1, 0);
    }
    this.heardTier = tier;
    if (!this.restoredAll) this.ctx.audio.intensity(Math.max(0.25, tierIntensity(tier)));
  }

  onWord(_word: string, perfect: boolean): void {
    const { vfx, audio } = this.ctx;
    const a = this.text.anchor;
    this.feedback.word(a.x, a.y, a.z, perfect);
    audio.play(perfect ? 'perfect' : 'word');
    if (this.credits) {
      // Every word of the credits sends gold up over another stretch of the written scroll.
      this.creditN += 1;
      const z = 6 - this.creditN * 13;
      vfx.burst(this.fountain, -6, 1, z, 0, 1, 0);
      vfx.burst(this.fountain, 6, 1, z - 5, 0, 1, 0);
      vfx.shockwave(0, 0.1, z, 14, this.gold, 1.2, true, 1.8);
      this.dyo.cheer(3);
      return;
    }
    this.wordsDone += 1;
    if (this.atKeeper) {
      // To the great page: the next line is inked.
      const k = Math.min(LINES - 1, this.linesShown);
      this.v.set(this.linePos[k * 3]!, this.linePos[k * 3 + 1]!, this.linePos[k * 3 + 2]!);
      this.fireBolt(perfect, this.v);
      return;
    }
    // A drawing rises for every share of the column that is written.
    const total = Math.max(1, this.plan?.phases[this.phase]?.words.length ?? 1);
    const want = Math.min(
      DRAWINGS_PER_COLUMN,
      Math.floor((this.wordsDone / total) * DRAWINGS_PER_COLUMN + 1e-6),
    );
    const base = this.phase * DRAWINGS_PER_COLUMN;
    let last: Mesh | null = null;
    for (let j = 0; j < want; j++) {
      if ((this.drawT[base + j] as number) < 0) {
        this.showDrawing(base + j, false);
        last = this.drawings[base + j] ?? null;
        if (last) {
          const p = last.position;
          vfx.burst(this.inkDrops, p.x, 0.6, p.z, 0, 1, 0, true);
          vfx.burst(this.sparks, p.x, 1.2, p.z, 0, 1, 0);
          vfx.shockwave(p.x, 0.08, p.z, 3.6, this.gold, 0.6, true, 1.4);
          audio.playAt('whoosh', p.x, 1, p.z, 0.3);
        }
      }
    }
    if (last) this.fireBolt(perfect, this.v.copy(last.position).setY(1.4));
    else this.fireBolt(perfect, this.targetPoint(this.stage, this.v));
  }

  /** A bolt of gold ink from the quill to `to`. */
  private fireBolt(strong: boolean, to: Vector3): void {
    const i = this.nextBolt;
    this.nextBolt = (i + 1) % BOLTS;
    this.apprentice.quillTip.getWorldPosition(this.boltFrom[i] as Vector3);
    (this.boltTo[i] as Vector3).copy(to);
    this.boltT[i] = 0;
    const b = this.bolts[i] as Mesh;
    b.visible = true;
    b.scale.setScalar(strong ? 1.5 : 1);
    this.boltTrail[i]?.stop();
    this.boltTrail[i] = this.ctx.vfx.trail(this.gold, strong ? 0.3 : 0.2, 0.45, 2.6);
    this.ctx.audio.play('whoosh');
  }

  /** Squash the white (positive: it is struck and shrinks back; negative: it swells). */
  private kick(amount: number): void {
    this.flinchV += amount * 6;
  }

  // ---- what the fight tells the scene ----------------------------------------------------------

  /** The attack reached the scribe. */
  land(): void {
    const { vfx, audio } = this.ctx;
    this.landT = 0;
    const p = this.apprentice.root.position;
    vfx.burst(this.splash, p.x, p.y + 1.6, p.z, 0, 1, 0);
    vfx.shockwave(p.x, 0.05, p.z, 4, TINT.white, 0.6, true, 1.4);
    vfx.impact(0.7, TINT.white);
    audio.playAt('impact', p.x, p.y, p.z, 0.2);
    this.apprentice.play('stagger');
    this.kick(-1.2);
    if (this.atKeeper) this.keeper.play('hit');
    this.dyo.cheer(1);
  }

  /** A group was finished before its attack landed: the white breaks in gold. */
  parry(weak: boolean): void {
    const { vfx, audio } = this.ctx;
    this.snapT = 0;
    const p = this.attackPoint(this.v3);
    vfx.burst(this.fountain, p.x, p.y, p.z, 0, 1, 0);
    vfx.shockwave(p.x, p.y, p.z, 3.2, this.gold, 0.5, false, 2);
    if (this.attack === 'flood') {
      const c = this.apprentice.root.position;
      vfx.shockwave(c.x, 0.08, c.z, this.tideScale + 6, this.gold, 0.7, true, 1.8);
    }
    audio.play('shatter');
    if (weak) this.stagger();
  }

  /** A slip gave ground back to the white (or the Keeper wiped a line). */
  heal(amount: number): void {
    if (amount <= 0) return;
    const { vfx, audio } = this.ctx;
    this.targetPoint(this.stage, this.v);
    this.kick(-0.9);
    vfx.burst(this.splash, this.v.x, this.v.y, this.v.z, 0, 0.5, 1);
    audio.playAt('whoosh', this.v.x, this.v.y, this.v.z, 0.4);
  }

  /** A weak point struck clean: an ally's word. Naftali stays the hand; Ezra writes back. */
  stagger(): void {
    const { vfx, audio } = this.ctx;
    this.reel = 1.4;
    this.kick(2.4);
    this.targetPoint(this.stage, this.v);
    vfx.burst(this.fountain, this.v.x, this.v.y, this.v.z, 0, 0.6, 1);
    vfx.shockwave(this.v.x, this.v.y, this.v.z, 5, this.gold, 0.6, false, 2.2);
    vfx.impact(0.6, this.gold);
    audio.play('impact');
    if (this.atKeeper) {
      this.keeper.play('stagger');
      const who = this.calling === 'ezra' ? this.ezra : this.naftali;
      who.play('cheer');
      const p = who.root.position;
      vfx.burst(this.sparks, p.x, 2, p.z, 0, 1, 0);
      vfx.shockwave(p.x, 0.08, p.z, 4, this.gold, 0.7, true, 1.6);
    }
    this.dyo.cheer(3);
  }

  /**
   * Between phases: a hit-stop and a flash; a crossed column takes its colors and the scribe
   * walks on to the next one (into the archive, the allies walk in beside him); the light and
   * the music move on. Runs on real time (`frame`).
   */
  transition(to: number): void {
    const { vfx, audio, loop } = this.ctx;
    this.transT = 0;
    this.transTo = to;
    this.snapT = 0;
    this.calling = null;
    if (this.motion) loop.hitStop(0.4, 0);
    vfx.flash(0xffffff, 0.45, 0.45);
    this.targetPoint(this.stage, this.v);
    vfx.burst(this.fountain, this.v.x, this.v.y, this.v.z, 0, 1, 0);
    vfx.burst(this.splash, this.v.x, this.v.y, this.v.z, 0, 1, 0);
    if (!this.atKeeper) {
      // The column is written: every drawing stands, and color sweeps over it.
      const base = this.phase * DRAWINGS_PER_COLUMN;
      for (let j = 0; j < DRAWINGS_PER_COLUMN; j++) this.showDrawing(base + j, false);
      vfx.restore(0, 0, stationZ(this.stage) - 8, 17, 2);
      vfx.shockwave(0, 0.1, stationZ(this.stage) - 8, 22, this.gold, 1.4, true, 2.2);
    } else {
      vfx.shockwave(0, 1, KEEPER_Z, 20, this.gold, 1.2, true, 2);
      this.keeper.play('stagger');
    }
    this.kick(3.5);
    audio.play('impact');
    audio.play('shatter');
    this.apprentice.play('cheer');
    this.dyo.cheer(4);
  }

  /** The last word: everything holds still before the ending. */
  victory(): void {
    if (this.won) return;
    this.won = true;
    this.snapT = 0;
    this.calling = null;
    const { vfx, audio, loop } = this.ctx;
    if (this.motion) loop.hitStop(0.7, 0.05);
    vfx.flash(0xffffff, 0.6, 0.6);
    vfx.impact(1, this.gold);
    audio.play('impact');
    this.linesShown = LINES;
    this.lines.count = LINES;
  }

  /** Sofer's Trial failed: the white swells, the scribe staggers. */
  failed(): void {
    this.kick(-2.5);
    this.apprentice.play('stagger');
  }

  /** A camera shot of the ending. */
  shotFor(name: string): void {
    const s = SHOTS[name];
    if (!s || this.shot === s) return;
    const glide = name === 'wide' || name === 'credits';
    this.frameShot(s, !glide, glide ? 0.7 : 2);
  }

  /** A cue of the ending (and of the typed credits). */
  cue(name: string): void {
    const { vfx, audio, materials } = this.ctx;
    switch (name) {
      case 'still':
        audio.intensity(0.2);
        this.keeper.play('stagger');
        break;
      case 'gather':
        this.gatherT = 0;
        break;
      case 'offer': {
        // The apprentice walks up to the dais and holds out the quill.
        const a = this.apprentice.root.position;
        this.walkFrom = a.z;
        this.walkTo = KEEPER_Z + 3.2;
        this.walkFromX = a.x;
        this.walkToX = -1.5;
        this.walkSeconds = 2.4;
        this.walkT = 0;
        break;
      }
      case 'shatter':
      case 'quill':
        if (this.quillGiven || this.giftT >= 0) break;
        this.apprentice.quillTip.getWorldPosition(this.giftFrom);
        this.giftT = name === 'shatter' ? 0.999 : 0;
        this.gift.visible = true;
        audio.play('whoosh');
        break;
      case 'write':
        this.pageGoldWant = 1;
        this.keeper.play('write');
        vfx.burst(this.fountain, 0, PAGE_Y, PAGE_Z + 1, 0, 0.3, 1);
        audio.play('perfect');
        break;
      case 'restore':
        if (this.restoredAll) break;
        this.restoredAll = true;
        this.pageGoldWant = 1;
        this.booksT = 0;
        materials.restoreAll(1, 3);
        vfx.restore(0, 0, KEEPER_Z, 150, 3.2);
        vfx.shockwave(0, 0.1, KEEPER_Z, 90, this.gold, 2.6, true, 2.4);
        this.toLight('restored', 2.6);
        this.ctx.post.setGrade(GRADES.restored);
        audio.play('success');
        audio.music('title');
        audio.intensity(1);
        this.apprentice.play('cheer');
        this.naftali.play('cheer');
        this.ezra.play('cheer');
        break;
      case 'sky':
        for (let k = 0; k < 7; k++) {
          vfx.burst(
            this.fountain,
            this.rng.range(-14, 14),
            this.rng.range(2, 8),
            this.rng.range(ARCHIVE_Z - 8, ARCHIVE_Z + 22),
            0,
            1,
            0,
          );
        }
        break;
      case 'credits':
        // The credits are typed over the written scroll, seen from its first column.
        this.credits = true;
        this.shownLetters = null;
        this.text.setStyle('banner');
        this.text.anchor.set(0, 9.6, 14);
        this.shotFor('credits');
        break;
      case 'credits-end':
        this.credits = false;
        break;
      default:
        break;
    }
  }

  // ---- the world moves ----------------------------------------------------------------------

  update(dt: number): void {
    this.onStep?.(dt);
    this.time += dt;
    const f = this.fight;
    this.flinchV += (-this.flinch * 60 - this.flinchV * 7) * dt;
    this.flinch += this.flinchV * dt;
    this.reel = Math.max(0, this.reel - dt);

    // The attack as drawn: it follows the fight's windup; after a parry it breaks and pulls back.
    const want = f && f.state === 'fight' ? f.windup : 0;
    if (this.snapT >= 0) {
      this.snapT += dt;
      this.shown = damp(this.shown, 0, 9, dt);
      if (this.snapT > 0.5 && f?.state === 'fight') this.snapT = -1;
    } else if (this.landT >= 0) {
      this.landT += dt;
      this.shown = Math.min(1, this.shown + dt * 4);
      if (this.landT > 0.45) {
        this.landT = -1;
        this.shown = 0;
      }
    } else {
      this.shown = damp(this.shown, want, 6, dt);
    }
    if (this.attack === 'flood') {
      this.tideScale = damp(this.tideScale, 13 - 11.6 * this.shown, 4, dt);
    }
    this.shardSpin += dt * (0.8 + this.shown * 1.6);
    // The white shrinks as the scroll is written (it is gone by the archive).
    const health = f ? f.health : 1;
    const size = this.stage >= ARCHIVE || this.won ? 0 : 0.55 + 0.45 * health;
    this.knotSize = damp(this.knotSize, size, 3, dt);

    // Who is calling a word (the Keeper's weak points alternate between the allies).
    this.calling =
      f && this.plan && f.state === 'fight' && f.weakNow && this.transT < 0
        ? allyAt(this.plan, f.phase, f.word)
        : null;
    this.allyStep[0] = damp(this.allyStep[0]!, this.calling === 'naftali' ? 1 : 0, 5, dt);
    this.allyStep[1] = damp(this.allyStep[1]!, this.calling === 'ezra' ? 1 : 0, 5, dt);

    // The great page: the lines written so far (the Keeper's eraser takes them from the end).
    if (!this.won && this.stage >= ARCHIVE && f) {
      const written = 1 - Math.min(1, health / Math.max(0.0001, this.keeperShare));
      this.linesShown = Math.max(0, Math.min(LINES, Math.round(written * LINES)));
    } else if (!this.won) {
      this.linesShown = 0;
    }
    this.lines.count = this.linesShown;
    this.pageGold = damp(this.pageGold, this.pageGoldWant, 1.2, dt);

    this.updateDrawings(dt);
    this.updateBolts(dt);
    this.updateWalks(dt);

    // The shelves fill, case by case.
    if (this.booksT >= 0 && this.booksT < 1) {
      this.booksT = Math.min(1, this.booksT + dt / 3);
      this.books.count = Math.round(easeInOut(this.booksT) * BOOK_COUNT);
    }
    // The quill crosses from the apprentice's hand to the Keeper's.
    if (this.giftT >= 0) {
      this.giftT = Math.min(1, this.giftT + dt / 1.1);
      this.keeper.quillTip.getWorldPosition(this.v);
      const k = easeInOut(this.giftT);
      this.gift.position.set(
        this.giftFrom.x + (this.v.x - this.giftFrom.x) * k,
        this.giftFrom.y + (this.v.y - this.giftFrom.y) * k + Math.sin(Math.PI * k) * 1.1,
        this.giftFrom.z + (this.v.z - this.giftFrom.z) * k,
      );
      this.gift.rotation.y += dt * 6;
      if (this.giftT >= 1) {
        this.giftT = -1;
        this.quillGiven = true;
        this.gift.position.set(0, 0.2, 0.2);
        this.gift.rotation.set(-0.6, 0, 0);
        this.keeper.quillTip.add(this.gift);
        this.ctx.vfx.burst(this.fountain, this.v.x, this.v.y, this.v.z, 0, 1, 0);
        this.ctx.vfx.shockwave(this.v.x, this.v.y, this.v.z, 5, this.gold, 0.8, false, 2.2);
        this.ctx.audio.play('perfect');
      }
    }

    this.apprentice.update(dt);
    this.ezra.update(dt);
    this.naftali.update(dt);
    this.keeper.update(dt);
    this.dyo.update(dt);
  }

  private updateDrawings(dt: number): void {
    for (let k = 0; k < DRAWN; k++) {
      const t = this.drawT[k] as number;
      if (t < 0 || t >= 1) continue;
      const n = Math.min(1, t + dt / 0.7);
      this.drawT[k] = n;
      (this.drawings[k] as Mesh).scale.setScalar(Math.max(0.001, easeOutBack(n)) * 1.25);
    }
  }

  private updateBolts(dt: number): void {
    const { vfx, audio } = this.ctx;
    for (let i = 0; i < BOLTS; i++) {
      const t0 = this.boltT[i] as number;
      if (t0 < 0) continue;
      const t = Math.min(1, t0 + dt / BOLT_SECONDS);
      this.boltT[i] = t;
      const from = this.boltFrom[i] as Vector3;
      const to = this.boltTo[i] as Vector3;
      const mesh = this.bolts[i] as Mesh;
      mesh.position.set(
        from.x + (to.x - from.x) * t,
        from.y + (to.y - from.y) * t + Math.sin(Math.PI * t) * 1.8,
        from.z + (to.z - from.z) * t,
      );
      this.boltTrail[i]?.emit(mesh.position.x, mesh.position.y, mesh.position.z);
      if (t >= 1) {
        this.boltT[i] = -1;
        mesh.visible = false;
        this.boltTrail[i]?.stop();
        this.boltTrail[i] = null;
        vfx.burst(this.sparks, to.x, to.y, to.z, 0, 0.5, 1);
        audio.playAt('impact-small', to.x, to.y, to.z, 0.4);
        this.kick(mesh.scale.x > 1.2 ? 1.4 : 0.8);
      }
    }
  }

  /** The apprentice walking to his next station, the allies walking in, the gathering. */
  private updateWalks(dt: number): void {
    if (this.walkT >= 0) {
      this.walkT = Math.min(1, this.walkT + dt / this.walkSeconds);
      const k = easeInOut(this.walkT);
      const a = this.apprentice.root.position;
      const z = this.walkFrom + (this.walkTo - this.walkFrom) * k;
      const x = this.walkFromX + (this.walkToX - this.walkFromX) * k;
      this.apprentice.root.rotation.y = Math.atan2(
        this.walkToX - this.walkFromX,
        this.walkTo - this.walkFrom,
      );
      a.set(x, this.won ? 0.8 * smoothstep(0.55, 0.9, k) : 0, z);
      this.apprentice.anim.speed =
        (Math.abs(this.walkTo - this.walkFrom) / this.walkSeconds) *
        Math.sin(Math.PI * this.walkT) *
        1.4;
      if (this.walkT >= 1) {
        this.walkT = -1;
        this.apprentice.anim.speed = 0;
        if (this.won) this.face(this.apprentice, 0, KEEPER_Z);
        else {
          this.targetPoint(this.stage, this.v);
          this.face(this.apprentice, this.v.x, this.v.z);
          this.dyoHome();
          const d = this.dyo.root.position;
          this.dyo.hop(d.x, 0, d.z, 0.7, 0.4, this.v.x, this.v.z);
        }
      } else if (!this.won) {
        // Dyo keeps up in hops.
        this.dyo.root.position.set(x - 2, 0, z + 1.4);
      }
    }
    if (this.alliesT >= 0) {
      this.alliesT = Math.min(1, this.alliesT + dt / 2.6);
      this.placeAllies(easeInOut(this.alliesT), 0);
      const sp = this.alliesT < 1 ? 3.2 : 0;
      this.ezra.anim.speed = sp;
      this.naftali.anim.speed = sp * 1.2;
      if (this.alliesT >= 1) this.alliesT = -1;
    } else if (this.gatherT >= 0) {
      this.gatherT = Math.min(1, this.gatherT + dt / 2.4);
      this.placeAllies(1, easeInOut(this.gatherT));
      const sp = this.gatherT < 1 ? 2.4 : 0;
      this.ezra.anim.speed = sp;
      this.naftali.anim.speed = sp;
      if (this.gatherT >= 1) {
        this.gatherT = -1;
        const e = this.ezra.root.position;
        this.dyo.hop(e.x + 1.6, 0, e.z + 0.6, 0.8, 0.5, 0, KEEPER_Z);
      }
    } else if (this.alliesIn && !this.won) {
      this.placeAllies(1, 0);
    }
  }

  /** Where the attack is right now (its head), for the parry's burst. */
  private attackPoint(out: Vector3): Vector3 {
    const a = this.apprentice.root.position;
    switch (this.attack) {
      case 'spatter':
        return this.orbPoint(this.shown, out);
      case 'tendril':
        return this.tendrilPoint(this.shown, this.shown, out);
      case 'flood':
        return out.set(a.x, 0.6, a.z - this.tideScale);
      case 'mirror':
        return out.set(a.x, 2.4, a.z - 2);
    }
  }

  /** The orb's arc from the white (or the Keeper's hand) to over the scribe. */
  private orbPoint(w: number, out: Vector3): Vector3 {
    const a = this.apprentice.root.position;
    this.targetPoint(this.stage, out);
    const k = smoothstep(0, 1, w);
    out.x += (a.x - out.x) * k;
    out.z += (a.z - out.z) * k;
    out.y += (3.4 - out.y) * k + Math.sin(Math.PI * k) * 2.2;
    return out;
  }

  /** A point `s` (0..1) along the tendril when it has reached `w` of the way. */
  private tendrilPoint(s: number, w: number, out: Vector3): Vector3 {
    const a = this.apprentice.root.position;
    this.targetPoint(this.stage, out);
    const k = s * w;
    const wob = Math.sin(this.time * 2.2 + s * 9) * 0.5 * (1 - k);
    out.x += (a.x - out.x) * k + wob;
    out.z += (a.z - out.z) * k;
    out.y +=
      (1.6 - out.y) * k + Math.sin(Math.PI * k) * 1.4 + Math.cos(this.time * 1.7 + s * 7) * 0.25;
    return out;
  }

  private writeAttacks(): void {
    const f = this.fight;
    const live = !!f && f.state === 'fight' && !this.won && this.transT < 0 && this.walkT < 0;
    const w = this.shown;
    const a = this.apprentice.root.position;
    const on = (kind: AttackKind): boolean => live && this.attack === kind && w > 0.02;

    // Spatter.
    this.orb.visible = on('spatter');
    this.ring.visible = this.orb.visible;
    if (this.orb.visible) {
      this.orbPoint(w, this.orb.position);
      this.orb.scale.setScalar(0.5 + 0.7 * w + Math.sin(this.time * 9) * 0.04);
      this.ring.position.set(a.x, 0.08, a.z);
      this.ring.scale.setScalar(3 - 2.1 * w);
    }
    // Tendril.
    if (on('tendril')) {
      const n = Math.max(2, Math.round(TENDRIL * Math.min(1, w + 0.15)));
      for (let i = 0; i < n; i++) {
        const s = i / (TENDRIL - 1);
        this.tendrilPoint(s, w, this.v);
        const size = 0.42 - 0.22 * s + Math.sin(this.time * 5 + i) * 0.04;
        this.q.identity();
        this.tendril.setMatrixAt(i, this.m4.compose(this.v, this.q, this.s.setScalar(size)));
      }
      this.tendril.count = n;
      this.tendril.instanceMatrix.needsUpdate = true;
    } else {
      this.tendril.count = 0;
    }
    // Flood.
    this.tide.visible = on('flood');
    if (this.tide.visible) {
      this.tide.position.set(a.x, 0.07 + Math.sin(this.time * 2) * 0.02, a.z);
      this.tide.scale.set(this.tideScale, 1, this.tideScale);
    }
    // Mirror: blank pages circling in.
    if (on('mirror')) {
      const rad = 8 - 6 * w;
      for (let i = 0; i < SHARDS; i++) {
        const ang = this.shardSpin + (i / SHARDS) * Math.PI * 2;
        this.v.set(
          a.x + Math.sin(ang) * rad,
          1.6 + Math.sin(this.time * 2 + i * 1.7) * 0.7 + (i % 3) * 0.5,
          a.z + Math.cos(ang) * rad,
        );
        this.q.setFromAxisAngle(UP, ang + Math.PI / 2 + Math.sin(this.time * 3 + i) * 0.4);
        this.shards.setMatrixAt(
          i,
          this.m4.compose(this.v, this.q, this.s.setScalar(0.8 + 0.5 * w)),
        );
      }
      this.shards.count = SHARDS;
      this.shards.instanceMatrix.needsUpdate = true;
    } else {
      this.shards.count = 0;
    }
  }

  frame(dt: number): void {
    const { rig, typing, vfx } = this.ctx;
    const f = this.fight;

    // The phase transition, in real time (it must run through the hit-stop).
    if (this.transT >= 0) {
      const before = this.transT;
      this.transT += dt;
      if (before < 0.55 && this.transT >= 0.55) {
        const from = this.stage;
        const to = stageOf(this.transTo);
        this.setPhaseLook(this.transTo, false);
        this.ctx.audio.section(this.plan?.phases[this.transTo]?.def.music ?? 'cross1');
        if (to !== from) {
          // On to the next column: the scribe walks, the camera glides with him.
          this.walkFrom = this.apprentice.root.position.z;
          this.walkTo = scribeZ(to);
          this.walkFromX = SCRIBE_X;
          this.walkToX = SCRIBE_X;
          this.walkSeconds = TRANSITION_SECONDS - 0.9;
          this.walkT = 0;
          this.setStage(to, false);
          this.frameShot(this.fightShot, !this.motion, 1.5);
          if (to >= ARCHIVE && !this.alliesIn) {
            this.alliesIn = true;
            this.alliesT = 0;
            this.ezra.root.visible = true;
            this.naftali.root.visible = true;
          }
        }
      }
      if (this.transT >= TRANSITION_SECONDS) {
        this.transT = -1;
        this.onTransitionEnd?.();
      }
    }
    // A push-in on the white (or the Keeper) between phases that stay on one stage.
    const staying = stageOf(this.transTo) === this.stage && this.walkT < 0;
    const pushWant =
      this.transT >= 0 && this.motion && staying
        ? smoothstep(0.1, 0.7, this.transT) * (1 - smoothstep(2.2, 3, this.transT))
        : 0;
    this.push = damp(this.push, pushWant, 6, dt);
    if (this.palT < 1) {
      this.palT = Math.min(1, this.palT + dt * this.palRate);
      this.applyPalette(this.palT);
    }

    // The camera glides to its shot, leaning in with the push; the credits drift up the scroll.
    const s = this.shot;
    const drift = this.credits || this.shot === SHOTS.credits ? -this.creditN * 9 : 0;
    this.camPos.x = damp(this.camPos.x, s.pos.x, this.shotRate, dt);
    this.camPos.y = damp(this.camPos.y, s.pos.y, this.shotRate, dt);
    this.camPos.z = damp(this.camPos.z, s.pos.z + drift, this.shotRate, dt);
    this.camLook.x = damp(this.camLook.x, s.look.x, this.shotRate, dt);
    this.camLook.y = damp(this.camLook.y, s.look.y, this.shotRate, dt);
    this.camLook.z = damp(this.camLook.z, s.look.z + drift, this.shotRate, dt);
    const sway = this.motion ? Math.sin(this.time * 0.23) * 0.25 : 0;
    this.v.copy(this.camPos).lerp(this.bossShot.pos, this.push * 0.85);
    this.v.x += sway;
    this.v2.copy(this.camLook).lerp(this.bossShot.look, this.push * 0.85);
    rig.fixed(this.v, this.v2);
    if (this.credits) this.text.anchor.z = this.camPos.z - 26;

    // The white: its size, squash, a reel after a weak point.
    const squash = Math.max(-0.35, Math.min(0.35, this.flinch * 0.08));
    const ks = Math.max(0.001, this.knotSize);
    this.knot.visible = this.knotSize > 0.03;
    this.halo.visible = this.knot.visible;
    if (this.knot.visible) {
      this.knot.scale.set(ks * (1 + squash * 0.6), ks * (1 - squash), ks * (1 + squash * 0.6));
      this.knot.rotation.set(
        this.time * 0.3,
        this.time * 0.5,
        this.reel > 0 ? Math.sin(this.time * 18) * 0.2 : 0,
      );
      this.halo.position.copy(this.knot.position);
      this.halo.scale.setScalar(ks * (1 + this.shown * 0.25));
      this.halo.rotation.set(Math.PI / 2 + Math.sin(this.time * 0.7) * 0.5, this.time * 0.6, 0);
    }

    // The great page: ink, or gold once the Keeper writes; the eraser's bar on the last line.
    this.lineMat.color
      .setHex(this.inkDark)
      .lerp(this.cA.setHex(this.gold).multiplyScalar(2.6), this.pageGold);
    this.pageGlow.emissiveIntensity =
      0.25 + this.pageGold * 0.5 + (this.phase === this.lastPhase ? 0.2 : 0);
    const erasing = !!f && f.erasing && !this.won && this.transT < 0;
    this.wipe.visible = erasing && this.linesShown > 0;
    if (this.wipe.visible) {
      const k = Math.min(LINES - 1, this.linesShown);
      this.wipe.position.set(
        this.linePos[k * 3]! + Math.sin(this.time * 7) * 0.5,
        this.linePos[k * 3 + 1]!,
        this.linePos[k * 3 + 2]! + 0.1,
      );
      this.wipe.scale.set(1 + Math.sin(this.time * 11) * 0.15, 1, 1);
    }

    this.writeAttacks();

    // A gold ring under the ally who is calling a word.
    if (this.calling && Math.floor(this.time * 3) !== Math.floor((this.time - dt) * 3)) {
      const p = (this.calling === 'ezra' ? this.ezra : this.naftali).root.position;
      vfx.shockwave(p.x, 0.08, p.z, 2.6, this.gold, 0.5, true, 1.6);
    }

    // Ink flows from the quill while the apprentice writes.
    if (this.apprentice.anim.action === 'write') {
      if (!this.quillTrail) this.quillTrail = vfx.trail(this.gold, 0.14, 0.7, 2.4);
      this.apprentice.quillTip.getWorldPosition(this.v);
      this.quillTrail.emit(this.v.x, this.v.y, this.v.z);
    } else if (this.quillTrail) {
      this.quillTrail.stop();
      this.quillTrail = null;
    }
    // Pale motes drift over the scribe (gold ones once the scroll is written).
    if ((this.moteTimer -= dt) <= 0) {
      this.moteTimer = this.restoredAll ? 0.07 : 0.3;
      const a = this.credits ? this.camLook : this.apprentice.root.position;
      vfx.burst(this.motes, a.x, 4, a.z);
    }

    // The word to type: a new one rises when the driver moves on.
    const showText = !this.won || this.credits;
    if (typing.letters !== this.shownLetters) {
      this.shownLetters = typing.letters;
      const n = typing.letters.length;
      const end = n > 0 && typing.letters[n - 1] === ' ' ? n - 1 : n;
      this.text.setWord(showText ? typing.letters.slice(0, end) : [], /[֐-׿]/.test(typing.word));
    }
    const a = this.text.anchor;
    if (!this.credits) {
      const rest = this.stage >= ARCHIVE ? 8.2 : 9.4;
      a.y = damp(a.y, this.transT >= 0 ? rest + 4 : rest, 3, dt);
    }
    this.text.root.visible = showText && this.walkT < 0;
    this.text.frame(dt, typing.states);
    this.feedback.frame(dt);
  }

  dispose(): void {
    this.quillTrail?.stop();
    this.quillTrail = null;
    for (let i = 0; i < BOLTS; i++) {
      this.boltTrail[i]?.stop();
      this.boltTrail[i] = null;
    }
    this.gift?.removeFromParent();
    if (this.ctx) {
      for (const c of [this.apprentice, this.ezra, this.naftali, this.keeper]) {
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
    this.fight = null;
    this.plan = null;
    this.onStep = null;
    this.onTransitionEnd = null;
  }
}

const UP = new Vector3(0, 1, 0);
