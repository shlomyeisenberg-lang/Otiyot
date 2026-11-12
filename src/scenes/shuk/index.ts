// The Night Shuk (T18): the second region of Act Two.
//
// A market square after dark. The Fading has taken the color out of the cloth and put the
// lanterns out, and the stalls stand grey and shut around the square. Every stall is one trade:
// the word on your banner, with a punctuation mark on its tail when you have learned one. Marks
// are the coin of the Shuk, so typing them wins the money: a trade pays a coin for the word and
// a coin for every mark, and coins fly from the stall to the apprentice's purse. A deal closed
// without a slip is clean, and three clean deals in a row win a haggle (the awning flashes and
// the mark coins count double). Every quarter of the run a big lantern lights over the square,
// and the last trade restores the whole market.
//
// There are no timers and nothing attacks. The typing is judged by the host (PlayController);
// this scene only reacts, and learns the shape of the run from `begin(plan)`.

import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  Object3D,
  PlaneGeometry,
  PointLight,
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
  WorldText,
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
import { SKY, TINT } from './palette';
import {
  haggleStreak,
  haggleWon,
  lanternsLit,
  MARKS,
  purseAfter,
  SECTIONS,
  type ChapterId,
  type ShukPlan,
} from './plan';

export interface ShukSetup {
  /** The apprentice's robe (the profile's avatar). */
  look: { robe: number; hem: number; trim: number; headwear: 'cap' | 'hat' | 'turban' };
}

/** Things the screen may want to say something about. */
export type ShukMoment = 'coin' | 'haggle' | 'lantern';

// --- The lay of the land.
const PLAZA_Z = -4;
const APPRENTICE_Z = -1.4;
const MAX_SLOTS = 16;
const SIGN_SIZE = 1.15;
const LETTER_SIZE = 1.05;
const STALL_Y_SIGN = 4.5;
const COIN_POOL = 8;
const COIN_SECONDS = 0.7;
const MERCHANTS = 3;
const UP = new Vector3(0, 1, 0);
const RING_R = [11, 17] as const;
const RING_SPREAD = [124, 90] as const;

/** Where stall `i` of `n` stands: rows of at most eight, in an arc around the square. */
export function stallPosition(i: number, n: number, out: Vector3): Vector3 {
  const rows = n > 8 ? 2 : 1;
  const perRow = Math.ceil(n / rows);
  const row = Math.min(rows - 1, Math.floor(i / perRow));
  const col = i - row * perRow;
  const spread = ((RING_SPREAD[row] ?? 90) * Math.PI) / 180;
  const a = perRow > 1 ? (col / (perRow - 1) - 0.5) * spread : 0;
  const r = RING_R[row] ?? 11;
  return out.set(Math.sin(a) * r, 0, PLAZA_Z - Math.cos(a) * r);
}

/** The turn (about Y) that makes a thing at (x, z) face the middle of the square. */
export function faceSquare(x: number, z: number): number {
  return Math.atan2(-x, PLAZA_Z - z);
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

interface Coin {
  mesh: Mesh;
  t: number;
  from: Vector3;
}

export class ShukScene implements GameScene {
  readonly id = 'shuk';
  /** Told when something worth a line happens (the first coin, a haggle won, a lantern lit). */
  onMoment: ((moment: ShukMoment) => void) | null = null;

  private ctx!: SceneContext;
  private readonly rng = new Rng(1812);
  private plan: ShukPlan | null = null;
  private apprentice!: Character;
  private merchants: Character[] = [];
  private ezra!: Character;
  private dyo!: Dyo;
  private text!: WorldText;
  private feedback!: TypingFeedback;
  private quillTrail: Trail | null = null;
  private shownLetters: readonly string[] | null = null;

  // The stalls: bodies, awnings in three cloths, signs, and a lantern on each.
  private stalls!: InstancedMesh;
  private plates!: InstancedMesh;
  private readonly awnings: InstancedMesh[] = [];
  private readonly stallLantern: Mesh[] = [];
  private readonly lanternOn = new Float32Array(MAX_SLOTS);
  private field!: LetterField;
  private beacon!: Mesh;
  private matOff!: Material;
  private matOn!: Material;
  private stallLight!: PointLight;
  private readonly bigLanterns: Mesh[] = [];
  private readonly bigShown = new Float32Array(SECTIONS);
  private slots = 0;
  private readonly flash = new Float32Array(MAX_SLOTS);

  // The money.
  private purseCoins = 0;
  private streak = 0;
  private haggles = 0;
  private marksTyped = 0;
  private slipped = false;
  private readonly coins: Coin[] = [];
  private coinAt = 0;
  private coinGeo!: BufferGeometry;
  private coinMat!: Material;

  private wordsDone = 0;
  private chapter: ChapterId | 'finale' = 'lane';
  private finished = false;
  private heardTier = 0;
  private time = 0;
  private finaleT = -1;
  private moteTimer = 0;
  private dyoRest = 0;
  private spoken = false;

  private readonly camTarget = new Object3D();
  private orbit = 0;
  private gold = 0;
  private techelet = 0;
  private paper = 0;
  private inkDark = 0;
  private sparks!: BurstStyle;
  private fountain!: BurstStyle;
  private motes!: BurstStyle;

  private readonly v = new Vector3();
  private readonly w = new Vector3();
  private readonly m4 = new Matrix4();
  private readonly q = new Quaternion();
  private readonly s = new Vector3();
  private readonly purse = new Vector3(0, 1.3, APPRENTICE_Z);

  constructor(private readonly setup: ShukSetup) {}

  // ---- probes (the screen and the smoke test read these) -------------------------------------

  /** Coins in the purse. */
  get coinsEarned(): number {
    return this.purseCoins;
  }

  /** Clean deals in a row, and haggles won so far. */
  get cleanStreak(): number {
    return this.streak;
  }

  get hagglesWon(): number {
    return this.haggles;
  }

  /** Marks typed right so far. */
  get marks(): number {
    return this.marksTyped;
  }

  /** Lanterns lit over the square (0..SECTIONS). */
  get lanternsOn(): number {
    return this.finished ? SECTIONS : lanternsLit(this.wordsDone, this.plan?.trades.length ?? 0);
  }

  /** Stalls whose trade is closed (their own lantern is lit). */
  get stallsOpen(): number {
    return Math.min(this.wordsDone, this.slots);
  }

  get restored(): boolean {
    return this.finished;
  }

  /** The chapter the camera is showing. */
  get view(): ChapterId | 'finale' {
    return this.chapter;
  }

  // ---- loading ------------------------------------------------------------------------------

  async load(ctx: SceneContext): Promise<void> {
    this.ctx = ctx;
    const { materials: kit, root, tracker } = ctx;
    this.gold = ctx.color('gold');
    this.techelet = ctx.color('techelet');
    this.paper = ctx.theme === 'light' ? ctx.color('surface') : ctx.color('ink');
    this.inkDark = ctx.theme === 'light' ? ctx.color('ink') : ctx.color('bg');

    // Sound: the shuk theme (its layers follow the streak) and the murmur of the crowd's lamps.
    ctx.audio.music('shuk');
    ctx.audio.intensity(0);

    ctx.atmosphere.setPalette({ ...SKY[ctx.theme], fade: ctx.color('fade'), ink: this.gold });
    ctx.atmosphere.groundAt = () => 0;
    ctx.atmosphere.setShadowRange(30);
    ctx.post.setGrade(
      ctx.theme === 'dark'
        ? { exposure: 1.3, saturation: 1.15, vignette: 0.6, godRays: 0.3 }
        : { exposure: 1.1, saturation: 1.2, vignette: 0.5, godRays: 0.4 },
    );
    ctx.rig.groundAt = () => 0;

    this.sparks = burstStyle({
      count: 12,
      color: TINT.spark,
      color2: TINT.haggle,
      intensity: 3,
      speed: [2, 5],
      spread: 0.9,
      life: [0.35, 0.8],
      size: [0.04, 0.1],
      gravity: 6,
    });
    this.fountain = burstStyle({
      count: 90,
      color: TINT.coin,
      color2: TINT.haggle,
      intensity: 3,
      speed: [4, 10],
      spread: 0.5,
      life: [1, 2],
      size: [0.07, 0.18],
      gravity: 5,
    });
    this.motes = burstStyle({
      count: 2,
      color: TINT.mist,
      intensity: 1.4,
      speed: [0.2, 0.7],
      spread: 1,
      life: [3, 6],
      size: [0.05, 0.12],
      gravity: -0.15,
      radius: 14,
    });

    this.buildSquare();
    this.buildBuildings();
    this.buildStalls();
    this.buildBigLanterns();

    // A coin in flight, pooled so nothing is created while playing.
    this.coinGeo = tracker.track(new CylinderGeometry(0.2, 0.2, 0.05, 12).rotateX(Math.PI / 2));
    this.coinMat = tracker.track(kit.ink(TINT.coin, 2.2));
    for (let i = 0; i < COIN_POOL; i++) {
      const mesh = new Mesh(this.coinGeo, this.coinMat);
      mesh.visible = false;
      root.add(mesh);
      this.coins.push({ mesh, t: 1, from: new Vector3() });
    }

    this.stallLight = new PointLight(TINT.lantern, 0, 24, 1.5);
    root.add(this.stallLight);

    // --- The people: the apprentice in the square, three merchants, Reb Ezra, Dyo.
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
    const looks = [
      {
        robe: TINT.merchantRobe,
        hem: TINT.merchantHem,
        headwear: 'turban',
        beard: TINT.merchantBeard,
      },
      {
        robe: TINT.merchantRobe2,
        hem: TINT.merchantHem2,
        headwear: 'cap',
        beard: TINT.merchantBeard2,
      },
      {
        robe: TINT.merchantRobe3,
        hem: TINT.merchantHem3,
        headwear: 'hat',
        beard: TINT.merchantBeard,
      },
    ] as const;
    for (let k = 0; k < MERCHANTS; k++) {
      const look = looks[k] as (typeof looks)[number];
      this.merchants.push(
        new Character(kit, {
          robe: look.robe,
          hem: look.hem,
          trim: TINT.merchantTrim,
          skin: TINT.skin,
          ink: TINT.ink,
          headwear: look.headwear,
          beard: look.beard,
          quill: false,
          height: 1.0 + k * 0.04,
          seed: 30 + k,
        }),
      );
    }
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
    for (const m of this.merchants) {
      root.add(m.root);
      ctx.atmosphere.addBlob(m.root, 0.55);
    }

    // --- The trade to type, on a parchment banner above the square.
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

    // --- Camera: behind the apprentice, looking over the square to the stalls.
    root.add(this.camTarget);
    this.camTarget.position.set(0, 1.4, APPRENTICE_Z + 1);
    ctx.rig.follow(this.camTarget, {
      distance: 12.5,
      height: 5.2,
      lookHeight: 1.9,
      stiffness: 2.4,
    });
    ctx.rig.cut();
    this.onQuality(ctx.quality);
    this.place();
  }

  private buildSquare(): void {
    const { materials: kit, tracker, root } = this.ctx;
    const r = this.rng;
    // Cobbles: a big plane with a checker of two stones and a little noise.
    const land = new PlaneGeometry(120, 120, 120, 120).rotateX(-Math.PI / 2);
    land.translate(0, 0, PLAZA_Z);
    const pos = land.getAttribute('position');
    const colors = new Float32Array(pos.count * 3);
    const a = new Color();
    const b = new Color(TINT.cobbleB);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const flag = Math.sin(x * 0.5) * Math.sin(z * 0.5) * 0.35 + 0.5;
      a.setHex(TINT.cobbleA).lerp(b, flag);
      a.multiplyScalar(0.85 + r.next() * 0.3);
      colors[i * 3] = a.r;
      colors[i * 3 + 1] = a.g;
      colors[i * 3 + 2] = a.b;
    }
    land.setAttribute('color', new BufferAttribute(colors, 3));
    land.computeVertexNormals();
    const floor = new Mesh(tracker.track(land), tracker.track(kit.surface({ vertexColors: true })));
    floor.receiveShadow = true;
    root.add(floor);

    // A round carpet in the middle, where the apprentice stands.
    const carpet = new Mesh(
      tracker.track(new CylinderGeometry(4.4, 4.4, 0.06, 32)),
      tracker.track(kit.surface({ color: TINT.clothB })),
    );
    carpet.position.set(0, 0.03, PLAZA_Z + 1.5);
    carpet.receiveShadow = true;
    root.add(carpet);
    const rim = new Mesh(
      tracker.track(new TorusGeometry(4.2, 0.1, 6, 40).rotateX(Math.PI / 2)),
      tracker.track(kit.surface({ color: TINT.clothC })),
    );
    rim.position.set(0, 0.08, PLAZA_Z + 1.5);
    root.add(rim);

    // A moon over the rooftops.
    const moon = new Mesh(
      tracker.track(new SphereGeometry(3.2, 20, 12)),
      tracker.track(kit.ink(0xe8ecff, 1.1)),
    );
    moon.position.set(-22, 40, -85);
    root.add(moon);
  }

  /** A ring of limestone houses with lit windows, domes and minarets, closing the square. */
  private buildBuildings(): void {
    const { materials: kit, tracker, root } = this.ctx;
    const r = this.rng;
    const body: BufferGeometry[] = [];
    const glass: BufferGeometry[] = [];
    const count = 26;
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2 + r.range(-0.05, 0.05);
      const dist = r.range(30, 36);
      const cx = Math.sin(ang) * dist;
      const cz = PLAZA_Z + Math.cos(ang) * dist;
      const w = r.range(6, 9);
      const h = r.range(7, 14);
      const d = r.range(5, 7);
      const turn = Math.atan2(-cx, PLAZA_Z - cz);
      const box = new BoxGeometry(w, h, d);
      box.rotateY(turn);
      box.translate(cx, h / 2, cz);
      body.push(painted(box, r.next() < 0.5 ? TINT.wallA : TINT.wallB));
      // A flat roof lip, and now and then a dome or a minaret.
      const lip = new BoxGeometry(w + 0.5, 0.5, d + 0.5);
      lip.rotateY(turn);
      lip.translate(cx, h + 0.25, cz);
      body.push(painted(lip, TINT.wallDark));
      const pick = r.next();
      if (pick < 0.25) {
        const dome = new SphereGeometry(
          Math.min(w, d) * 0.38,
          14,
          8,
          0,
          Math.PI * 2,
          0,
          Math.PI / 2,
        );
        dome.translate(cx, h + 0.5, cz);
        body.push(painted(dome, TINT.roof));
      } else if (pick < 0.45) {
        const tower = new CylinderGeometry(0.7, 0.9, 7, 8);
        tower.translate(cx, h + 3.5, cz);
        body.push(painted(tower, TINT.wallA));
        const cap = new ConeGeometry(1.1, 2.4, 8);
        cap.translate(cx, h + 8.2, cz);
        body.push(painted(cap, TINT.roof));
      }
      // Lit windows on the side that faces the square: two rows.
      const fx = Math.sin(turn);
      const fz = Math.cos(turn);
      const rx = Math.cos(turn);
      const rz = -Math.sin(turn);
      const rows = Math.max(1, Math.floor((h - 2) / 3.2));
      const cols = Math.max(2, Math.floor(w / 2.4));
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          if (r.next() < 0.3) continue;
          const lx = (col - (cols - 1) / 2) * 2.1;
          const win = new BoxGeometry(0.8, 1.3, 0.12);
          win.rotateY(turn);
          win.translate(
            cx + fx * (d / 2 + 0.04) + rx * lx,
            2.4 + row * 3.1,
            cz + fz * (d / 2 + 0.04) + rz * lx,
          );
          glass.push(painted(win, TINT.window));
        }
      }
    }
    const houses = new Mesh(merged(body), tracker.track(kit.surface({ vertexColors: true })));
    tracker.track(houses.geometry);
    kit.caster(houses, true);
    root.add(houses);
    const windows = new Mesh(merged(glass), tracker.track(kit.ink(TINT.window, 1.1)));
    tracker.track(windows.geometry);
    root.add(windows);
  }

  private buildStalls(): void {
    const { materials: kit, tracker, root } = this.ctx;
    const parts: BufferGeometry[] = [];
    const add = (geo: BufferGeometry, x: number, y: number, z: number, hex: number): void => {
      geo.translate(x, y, z);
      parts.push(painted(geo, hex));
    };
    // The counter with goods on it, four posts and the back pole that carries the sign.
    add(new BoxGeometry(2.8, 1, 1.1), 0, 0.5, 0.2, TINT.wood);
    add(new BoxGeometry(3, 0.12, 1.3), 0, 1.02, 0.2, TINT.woodDark);
    const goods = [TINT.clothB, TINT.clothC, TINT.clothA, TINT.clothCream, TINT.clothC];
    goods.forEach((hex, i) => {
      add(new SphereGeometry(0.22, 8, 6), -1.05 + i * 0.52, 1.3, 0.2 + (i % 2) * 0.12, hex);
    });
    for (const sx of [-1.35, 1.35]) {
      add(new CylinderGeometry(0.07, 0.07, 3.3, 6), sx, 1.65, 0.8, TINT.woodDark);
      add(new CylinderGeometry(0.07, 0.07, 3.6, 6), sx, 1.8, -0.5, TINT.woodDark);
    }
    add(new CylinderGeometry(0.08, 0.08, 4.2, 6), 0, 2.1, -0.5, TINT.woodDark);
    add(new BoxGeometry(3, 0.8, 0.12), 0, 0.4, -0.55, TINT.wood);
    this.stalls = new InstancedMesh(
      merged(parts),
      tracker.track(kit.surface({ vertexColors: true })),
      MAX_SLOTS,
    );
    tracker.track(this.stalls.geometry);
    kit.caster(this.stalls, true);
    this.stalls.count = 0;
    root.add(this.stalls);

    // Awnings: stripes of cloth, tilted, in three colorways (grey while the Fading holds them).
    for (const [c1, c2] of [
      [TINT.clothA, TINT.clothCream],
      [TINT.clothB, TINT.clothCream],
      [TINT.clothC, TINT.clothCream],
    ] as const) {
      const strips: BufferGeometry[] = [];
      for (let k = 0; k < 6; k++) {
        const stripe = new BoxGeometry(0.5, 0.08, 2.5).rotateX(0.2);
        stripe.translate(-1.25 + k * 0.5, 3.35, 0.15);
        strips.push(painted(stripe, k % 2 === 0 ? c1 : c2));
      }
      const awning = new InstancedMesh(
        merged(strips),
        tracker.track(kit.surface({ vertexColors: true })),
        6,
      );
      tracker.track(awning.geometry);
      kit.caster(awning, false);
      awning.count = 0;
      root.add(awning);
      this.awnings.push(awning);
    }

    // The sign board above each stall, with the price mark (or the word's first letter) on it.
    this.plates = new InstancedMesh(
      tracker.track(new BoxGeometry(1.5, 1.5, 0.16)),
      tracker.track(kit.surface({ color: TINT.woodDark })),
      MAX_SLOTS,
    );
    kit.caster(this.plates, false);
    this.plates.count = 0;
    root.add(this.plates);
    this.field = tracker.track(
      new LetterField(this.ctx.engine.atlas, kit, this.ctx.vfx.billboard, MAX_SLOTS),
    );
    root.add(this.field.mesh);
    for (let i = 0; i < MAX_SLOTS; i++) this.field.hide(i);
    this.field.commit();

    // A little lantern on every stall: grey and cold until its trade is closed.
    this.matOff = tracker.track(kit.ink(TINT.lanternOff, 0.35));
    this.matOn = tracker.track(kit.ink(TINT.lantern, 2.4));
    const geo = tracker.track(new SphereGeometry(0.26, 10, 8));
    for (let i = 0; i < MAX_SLOTS; i++) {
      const m = new Mesh(geo, this.matOff);
      m.visible = false;
      root.add(m);
      this.stallLantern.push(m);
    }
    this.beacon = new Mesh(
      tracker.track(new TorusGeometry(0.95, 0.05, 6, 28)),
      tracker.track(kit.ink(this.gold, 1.6)),
    );
    this.beacon.visible = false;
    root.add(this.beacon);
  }

  /** Four big lanterns hanging over the square, one per quarter of the run. */
  private buildBigLanterns(): void {
    const { materials: kit, tracker, root } = this.ctx;
    const mat = tracker.track(kit.ink(TINT.lantern, 2.2));
    const geo = tracker.track(new SphereGeometry(0.55, 14, 10));
    const wire = tracker.track(new CylinderGeometry(0.03, 0.03, 5, 4));
    const wireMat = tracker.track(kit.surface({ color: TINT.wire }));
    for (let k = 0; k < SECTIONS; k++) {
      const x = (k - (SECTIONS - 1) / 2) * 5.6;
      const z = PLAZA_Z - 5 - Math.abs(x) * 0.2;
      const lamp = new Mesh(geo, mat);
      lamp.position.set(x, 8.2, z);
      lamp.scale.setScalar(0.001);
      root.add(lamp);
      this.bigLanterns.push(lamp);
      const c = new Mesh(wire, wireMat);
      c.position.set(x, 10.7, z);
      root.add(c);
    }
  }

  onQuality(preset: QualityPreset): void {
    const full = preset.shadows === 'cascaded';
    this.apprentice?.shadowDetail(full);
    this.ezra?.shadowDetail(full);
    for (const m of this.merchants) m.shadowDetail(full);
  }

  // ---- a run --------------------------------------------------------------------------------

  start(): void {
    this.reset();
  }

  /** Forgets everything: grey market, shut stalls, no lanterns, an empty purse. */
  private reset(): void {
    const { materials } = this.ctx;
    materials.clearSweeps();
    materials.restoreAll(0, 0);
    this.wordsDone = 0;
    this.finished = false;
    this.finaleT = -1;
    this.heardTier = 0;
    this.shownLetters = null;
    this.purseCoins = 0;
    this.streak = 0;
    this.haggles = 0;
    this.marksTyped = 0;
    this.slipped = false;
    this.spoken = false;
    this.lanternOn.fill(0);
    this.flash.fill(0);
    this.bigShown.fill(0);
    for (const c of this.coins) {
      c.t = 1;
      c.mesh.visible = false;
    }
    for (const m of this.stallLantern) m.material = this.matOff;
    this.beacon.visible = false;
    this.orbit = 0;
    this.ctx.rig.orbit = Math.PI;
    this.ctx.audio.intensity(0);
  }

  /** A new run with this plan (the screen calls it before the first key, and for every retry). */
  begin(plan: ShukPlan): void {
    this.reset();
    this.plan = plan;
    this.chapter = plan.chapters[0]?.id ?? 'lane';
    this.slots = Math.min(MAX_SLOTS, plan.trades.length);
    this.stalls.count = this.slots;
    this.plates.count = this.slots;
    const used = [0, 0, 0];
    for (let i = 0; i < this.slots; i++) {
      stallPosition(i, this.slots, this.v);
      const turn = faceSquare(this.v.x, this.v.z);
      this.q.setFromAxisAngle(UP, turn);
      this.s.set(1, 1, 1);
      this.m4.compose(this.v, this.q, this.s);
      this.stalls.setMatrixAt(i, this.m4);
      const kind = i % 3;
      const awning = this.awnings[kind];
      if (awning) awning.setMatrixAt(used[kind] as number, this.m4);
      used[kind] = (used[kind] as number) + 1;
      // The sign board stands on the back pole, above the awning.
      const sx = this.v.x - Math.sin(turn) * 0.5;
      const sz = this.v.z - Math.cos(turn) * 0.5;
      this.w.set(sx, STALL_Y_SIGN, sz);
      this.m4.compose(this.w, this.q, this.s);
      this.plates.setMatrixAt(i, this.m4);
      const trade = plan.trades[i];
      const glyph = trade ? trade.mark || [...trade.word][0] || '' : '';
      this.field.set(
        i,
        glyph,
        sx + Math.sin(turn) * 0.16,
        STALL_Y_SIGN,
        sz + Math.cos(turn) * 0.16,
        SIGN_SIZE,
        this.ctx.color('fade'),
        0.7,
      );
      const lamp = this.stallLantern[i];
      if (lamp) {
        lamp.visible = true;
        lamp.position.set(this.v.x + Math.sin(turn) * 1.1, 2.75, this.v.z + Math.cos(turn) * 1.1);
      }
    }
    for (let i = this.slots; i < MAX_SLOTS; i++) {
      this.field.hide(i);
      const lamp = this.stallLantern[i];
      if (lamp) lamp.visible = false;
    }
    this.stalls.instanceMatrix.needsUpdate = true;
    this.plates.instanceMatrix.needsUpdate = true;
    this.awnings.forEach((a, k) => {
      a.count = used[k] as number;
      a.instanceMatrix.needsUpdate = true;
    });
    this.field.commit();
    this.place();
  }

  /** Puts the people where they stand. */
  private place(): void {
    this.apprentice.root.position.set(0.2, 0, APPRENTICE_Z);
    this.apprentice.root.rotation.y = Math.PI;
    this.ezra.root.position.set(-3.6, 0, APPRENTICE_Z - 0.4);
    this.ezra.root.rotation.y = Math.atan2(3.4, -1.4);
    this.dyo.root.position.set(1.9, 0, APPRENTICE_Z + 0.4);
    this.dyo.face(0, APPRENTICE_Z - 4);
    this.merchants.forEach((m, k) => this.standBehind(m, k, 1));
    this.ctx.rig.cut();
  }

  /** The stall index merchant `k` is at when trade `cur` is the open one. */
  private stallOf(k: number): number {
    return Math.max(0, Math.min(this.slots - 1, this.wordsDone + k));
  }

  private standBehind(m: Character, k: number, rate: number): void {
    if (this.slots <= 0) return;
    stallPosition(this.stallOf(k), this.slots, this.v);
    const turn = faceSquare(this.v.x, this.v.z);
    const tx = this.v.x - Math.sin(turn) * 1.5 + (k - 1) * 0.0;
    const tz = this.v.z - Math.cos(turn) * 1.5;
    const p = m.root.position;
    p.x = rate >= 1 ? tx : damp(p.x, tx, 3, rate);
    p.z = rate >= 1 ? tz : damp(p.z, tz, 3, rate);
    m.root.rotation.y = turn;
  }

  onKey(ev: TypedKey): void {
    const { typing, audio } = this.ctx;
    if (!ev.correct) {
      // A slip is soft: a blink of grey, the deal is no longer clean, and on with the trade.
      this.slipped = true;
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
    const at = this.text.letterPosition(ev.index, this.v);
    this.text.hit(ev.index);
    this.feedback.correct(at.x, at.y, at.z, LETTER_SIZE, typing.tier);
    this.apprentice.play('write');
    audio.play('key', typing.combo, ev.expected);
    this.hearTier(typing.tier);
    if ((MARKS as readonly string[]).includes(ev.expected)) {
      // A mark is a coin: it jumps off the banner and into the purse.
      this.marksTyped += 1;
      this.ctx.vfx.burst(this.sparks, at.x, at.y, at.z, 0, 1, 0);
      this.launchCoin(at.x, at.y, at.z);
      if (!this.spoken) {
        this.spoken = true;
        this.onMoment?.('coin');
      }
    }
  }

  /** The music builds with the combo tier; a new tier rings a chime. */
  private hearTier(tier: number): void {
    if (tier > this.heardTier) {
      this.ctx.audio.play('tier', tier);
      this.dyo.cheer(2 + tier);
      this.ctx.vfx.burst(this.fountain, this.purse.x, this.purse.y + 1, this.purse.z, 0, 1, 0);
    }
    this.heardTier = tier;
    this.ctx.audio.intensity(tierIntensity(tier));
  }

  private launchCoin(x: number, y: number, z: number): void {
    const c = this.coins[this.coinAt];
    this.coinAt = (this.coinAt + 1) % COIN_POOL;
    if (!c) return;
    c.t = 0;
    c.from.set(x, y, z);
    c.mesh.visible = true;
    c.mesh.position.copy(c.from);
  }

  onWord(_word: string, perfect: boolean): void {
    const plan = this.plan;
    if (!plan) return;
    const { vfx, audio } = this.ctx;
    const i = this.wordsDone;
    this.wordsDone += 1;
    const total = plan.trades.length;
    const trade = plan.trades[i];
    const clean = perfect && !this.slipped;
    this.slipped = false;
    this.streak = haggleStreak(this.streak, clean);
    const won = haggleWon(this.streak);
    if (trade) this.purseCoins = purseAfter(this.purseCoins, trade, won);
    if (won) this.haggles += 1;

    if (i < this.slots) {
      // The stall opens: its sign turns gold, its lantern lights, its merchant cheers.
      stallPosition(i, this.slots, this.v);
      const turn = faceSquare(this.v.x, this.v.z);
      const sx = this.v.x - Math.sin(turn) * 0.5;
      const sz = this.v.z - Math.cos(turn) * 0.5;
      this.field.set(
        i,
        trade ? trade.mark || [...trade.word][0] || '' : '',
        sx + Math.sin(turn) * 0.16,
        STALL_Y_SIGN,
        sz + Math.cos(turn) * 0.16,
        SIGN_SIZE,
        won ? TINT.haggle : TINT.coin,
        won ? 3 : 2.2,
      );
      this.field.commit();
      const lamp = this.stallLantern[i];
      if (lamp) lamp.material = this.matOn;
      if (won) this.flash[i] = 1;
      vfx.shockwave(
        this.v.x,
        1.4,
        this.v.z,
        won ? 5 : 3,
        won ? TINT.haggle : TINT.coin,
        0.6,
        true,
        1.4,
      );
      vfx.burst(this.fountain, this.v.x, 1.8, this.v.z, 0, 1, 0);
      this.launchCoin(this.v.x, 1.6, this.v.z);
      // Color spreads out from the stall, farther as the run goes on.
      const radius = 8 + (36 * this.wordsDone) / Math.max(1, total);
      vfx.restore(this.v.x, 1, this.v.z, radius, 1.4);
      const m = this.merchants[0];
      if (m) m.play(won ? 'cheer' : 'write');
      audio.playAt('impact', this.v.x, 1.5, this.v.z, 0.3);
    }
    if (won) this.onMoment?.('haggle');
    const a = this.text.anchor;
    this.feedback.word(a.x, a.y, a.z, perfect);
    audio.play('restore');
    audio.play(perfect ? 'perfect' : 'word');

    const lit = lanternsLit(this.wordsDone, total);
    const before = lanternsLit(this.wordsDone - 1, total);
    if (lit > before && this.wordsDone < total) {
      const lamp = this.bigLanterns[lit - 1];
      if (lamp)
        vfx.burst(this.fountain, lamp.position.x, lamp.position.y, lamp.position.z, 0, 1, 0);
      this.onMoment?.('lantern');
    }
    if (this.wordsDone < total) this.chapter = this.chapterNow();
  }

  private chapterNow(): ChapterId {
    const plan = this.plan;
    if (!plan) return 'lane';
    for (const c of plan.chapters) if (this.wordsDone < c.to) return c.id;
    return plan.chapters.at(-1)?.id ?? 'square';
  }

  /** The run is over. A whole run restores the market; a failed trial leaves it as it is. */
  finale(failed: boolean): void {
    if (this.finished || this.finaleT >= 0) return;
    if (failed) {
      this.merchants[0]?.play('stagger');
      return;
    }
    const { vfx, materials, audio } = this.ctx;
    this.finished = true;
    this.finaleT = 0;
    this.chapter = 'finale';
    materials.restoreAll(1, 2.8);
    vfx.shockwave(0, 0.3, PLAZA_Z, 100, this.gold, 2.4);
    vfx.burst(this.fountain, 0, 2.5, PLAZA_Z, 0, 1, 0);
    audio.play('success');
    audio.intensity(1);
    this.apprentice.play('cheer');
    this.ezra.play('cheer');
    for (const m of this.merchants) m.play('cheer');
    this.dyo.cheer(6);
    this.ctx.rig.pushIn(0.35, 0.4);
    for (const lamp of this.stallLantern) lamp.material = this.matOn;
  }

  update(dt: number): void {
    this.time += dt;
    const { vfx } = this.ctx;
    this.dyoRest -= dt;

    // Coins fly from where they were earned into the apprentice's purse.
    for (const c of this.coins) {
      if (c.t >= 1) continue;
      c.t = Math.min(1, c.t + dt / COIN_SECONDS);
      const e = c.t * c.t * (3 - 2 * c.t);
      c.mesh.position.set(
        c.from.x + (this.purse.x - c.from.x) * e,
        c.from.y + (this.purse.y - c.from.y) * e + Math.sin(Math.PI * e) * 1.4,
        c.from.z + (this.purse.z - c.from.z) * e,
      );
      c.mesh.rotation.y += dt * 12;
      if (c.t >= 1) {
        c.mesh.visible = false;
        vfx.burst(this.sparks, this.purse.x, this.purse.y, this.purse.z, 0, 1, 0);
        this.ctx.audio.playAt('impact', this.purse.x, this.purse.y, this.purse.z, 0.15);
      }
    }

    // Stall lanterns swell as they light; a haggle won flashes the stall's light.
    for (let i = 0; i < this.slots; i++) {
      const lamp = this.stallLantern[i];
      if (!lamp) continue;
      const open = this.finished || i < this.wordsDone;
      this.lanternOn[i] = damp(this.lanternOn[i] as number, open ? 1 : 0, 5, dt);
      this.flash[i] = Math.max(0, (this.flash[i] as number) - dt * 1.2);
      lamp.scale.setScalar(0.8 + (this.lanternOn[i] as number) * 0.5 + (this.flash[i] as number));
    }
    // One warm light follows the open stall.
    if (this.slots > 0) {
      stallPosition(Math.min(this.slots - 1, this.wordsDone), this.slots, this.w);
      this.stallLight.position.set(this.w.x, 3, this.w.z + 1.6);
      this.stallLight.intensity = this.finished ? 10 : 6 + Math.sin(this.time * 9) * 0.6;
    }

    // Big lanterns swell as they light.
    for (let k = 0; k < SECTIONS; k++) {
      const want = k < this.lanternsOn ? 1 : 0;
      this.bigShown[k] = damp(this.bigShown[k] as number, want, 4, dt);
      const lamp = this.bigLanterns[k];
      if (lamp) {
        lamp.scale.setScalar(
          Math.max(0.001, 1.2 * easeOutBack(Math.min(1, this.bigShown[k] as number))),
        );
        lamp.position.y = 8.2 + Math.sin(this.time * 1.3 + k) * 0.12;
      }
    }

    this.apprentice.update(dt);
    this.ezra.update(dt);
    this.dyo.update(dt);
    this.merchants.forEach((m, k) => {
      this.standBehind(m, k, dt);
      m.update(dt);
    });

    // Ink flows from the quill while the apprentice writes.
    if (this.apprentice.anim.action === 'write') {
      if (!this.quillTrail) this.quillTrail = vfx.trail(this.gold, 0.14, 0.7, 2.4);
      this.apprentice.quillTip.getWorldPosition(this.v);
      this.quillTrail.emit(this.v.x, this.v.y, this.v.z);
    } else if (this.quillTrail) {
      this.quillTrail.stop();
      this.quillTrail = null;
    }

    // Lantern ash drifts over the square, thicker once the market is alive.
    if ((this.moteTimer -= dt) <= 0) {
      this.moteTimer = this.finished ? 0.08 : 0.4 - Math.min(0.25, this.wordsDone * 0.02);
      vfx.burst(this.motes, 0, 4, PLAZA_Z, 0, 1, 0);
    }
    if (this.finaleT >= 0) {
      const before = this.finaleT;
      this.finaleT += dt;
      if (before < 0.7 && this.finaleT >= 0.7)
        vfx.burst(this.fountain, -5, 2, PLAZA_Z - 4, 0, 1, 0);
      if (before < 1.4 && this.finaleT >= 1.4) vfx.burst(this.fountain, 5, 2, PLAZA_Z - 4, 0, 1, 0);
    }
  }

  frame(dt: number): void {
    const { rig, typing } = this.ctx;

    // The camera rides behind the apprentice, a little higher once the market is restored.
    const t = this.camTarget.position;
    t.x = damp(t.x, 0, 3, dt);
    t.y = damp(t.y, this.finished ? 2.4 : 1.7, 2, dt);
    t.z = damp(t.z, APPRENTICE_Z - 0.6, 3, dt);
    this.orbit = damp(this.orbit, this.finished ? 0.5 : 0, 0.6, dt);
    rig.orbit = Math.PI + this.orbit + Math.sin(this.time * 0.17) * 0.025;

    // The beacon ring rests on the sign of the open stall.
    if (!this.finished && this.plan && this.wordsDone < this.slots) {
      stallPosition(this.wordsDone, this.slots, this.w);
      const turn = faceSquare(this.w.x, this.w.z);
      this.beacon.visible = true;
      this.beacon.position.set(
        this.w.x - Math.sin(turn) * 0.34,
        STALL_Y_SIGN,
        this.w.z - Math.cos(turn) * 0.34,
      );
      this.beacon.rotation.y = turn;
      this.beacon.scale.setScalar(1 + Math.sin(this.time * 4) * 0.06);
    } else {
      this.beacon.visible = false;
    }

    // The banner floats over the carpet, between the apprentice and the stalls.
    const a = this.text.anchor;
    a.x = damp(a.x, 0, 3, dt);
    a.y = damp(a.y, 3.5, 3, dt);
    a.z = damp(a.z, APPRENTICE_Z - 4, 3, dt);

    // The trade to type: a new one rises when the driver moves on.
    if (typing.letters !== this.shownLetters) {
      this.shownLetters = typing.letters;
      const n = typing.letters.length;
      const end = n > 0 && typing.letters[n - 1] === ' ' ? n - 1 : n;
      this.text.setWord(typing.letters.slice(0, end), /[\u0590-\u05ff]/.test(typing.word));
    }
    this.text.frame(dt, typing.states);
    this.feedback.frame(dt);
  }

  dispose(): void {
    this.quillTrail?.stop();
    this.quillTrail = null;
    if (this.ctx) {
      for (const c of [this.apprentice, this.ezra, ...this.merchants]) {
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
    this.merchants = [];
  }
}
