// The Gematria Forge (T17): the first region of Act Two.
//
// A smithy inside a hill at evening. The Fading has put the furnace out and drained the color
// from the rock, and the smith's rack of letters hangs blank and grey. Every number you type is
// the value of one letter (alef is 1, yod is 10, kuf 100): the smith forges that letter on the
// anvil, and it flies to its place on the rack. The furnace has a temperature, shown by a tall
// gauge with a green band: every right key stokes the fire, a pause cools it, a slip makes it
// flare. A letter forged inside the band comes out bright gold; too cold or too hot it comes out
// dull or scorched, and is still a letter, so nothing here can be lost. Every quarter of the
// run a lamp lights along the rack, and the last letter restores the whole cave.
//
// There are no timers and nothing attacks: the only thing in the way is the grey itself. The
// typing is judged by the host (PlayController); this scene only reacts, and learns the shape of
// the run from `begin(plan)`.

import {
  BackSide,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
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
  smoothstep,
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
  BAND_HIGH,
  BAND_LOW,
  cooled,
  flared,
  HEAT_START,
  lampsLit,
  SECTIONS,
  stoked,
  temperOf,
  type ChapterId,
  type ForgePlan,
  type Temper,
} from './plan';

export interface ForgeSetup {
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
export type ForgeMoment = 'cold' | 'hot' | 'bright' | 'lamp';

// --- The lay of the land.
const CAVE_R = 14;
const ANVIL_Z = -3.6;
const FURNACE_X = -5.4;
const FURNACE_Z = -9.2;
const GAUGE_X = 5.6;
const GAUGE_Z = -8.2;
const GAUGE_H = 4.6;
const RACK_Z = -13.2;
const MAX_SLOTS = 16;
const LETTER_SIZE = 1.05;
const SLOT_SIZE = 1.0;
const FLY_SECONDS = 0.65;
const UP = new Vector3(0, 1, 0);

/** Flat floor inside the cave, rising into the walls. */
function terrain(x: number, z: number): number {
  const r = Math.hypot(x, z + 4);
  return smoothstep(CAVE_R - 1, CAVE_R + 5, r) * 14;
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

function temperColor(t: Temper): number {
  return t === 'good' ? TINT.bright : t === 'hot' ? TINT.scorched : TINT.cold;
}

/** Where slot `i` of `n` hangs on the rack: rows of at most eight, curving with the wall. */
export function slotPosition(i: number, n: number, out: Vector3): Vector3 {
  const rows = n > 8 ? 2 : 1;
  const perRow = Math.ceil(n / rows);
  const row = Math.floor(i / perRow);
  const col = i % perRow;
  const x = (col - (perRow - 1) / 2) * 1.5;
  const y = 4.5 + (rows - 1 - row) * 1.7;
  return out.set(x, y, RACK_Z + x * x * 0.018);
}

export class ForgeScene implements GameScene {
  readonly id = 'forge';
  /** Told when something worth a line happens (the fire runs cold or hot, a lamp lights). */
  onMoment: ((moment: ForgeMoment) => void) | null = null;

  private ctx!: SceneContext;
  private readonly rng = new Rng(1704);
  private plan: ForgePlan | null = null;
  private apprentice!: Character;
  private smith!: Character;
  private ezra!: Character;
  private dyo!: Dyo;
  private text!: WorldText;
  private feedback!: TypingFeedback;
  private quillTrail: Trail | null = null;
  private shownLetters: readonly string[] | null = null;

  // The fire, the gauge, the lamps.
  private fire!: Mesh;
  private fireLight!: PointLight;
  private needle!: Mesh;
  private bulb!: Mesh;
  private readonly lamps: Mesh[] = [];
  private readonly lampShown = new Float32Array(SECTIONS);
  private heat = HEAT_START;
  private heatShown = HEAT_START;
  private started = false;
  private warned = { cold: false, hot: false };
  private coldFor = 0;
  private hotFor = 0;

  // The rack: dark plates, the letters on them, and the letter in flight.
  private plates!: InstancedMesh;
  private field!: LetterField;
  private beacon!: Mesh;
  private readonly tempers: Temper[] = [];
  private readonly slot = new Vector3();
  private slots = 0;
  private flying = -1;
  private flyT = 1;
  private readonly flyFrom = new Vector3();
  private readonly anvilTop = new Vector3(0, 1.75, ANVIL_Z);

  private lettersDone = 0;
  private wordsDone = 0;
  private chapter: ChapterId | 'finale' = 'stoke';
  private finished = false;
  private heardTier = 0;
  private time = 0;
  private finaleT = -1;
  private emberTimer = 0;
  private dyoRest = 0;
  private smithT = 0;

  private readonly camTarget = new Object3D();
  private orbit = 0;
  private gold = 0;
  private techelet = 0;
  private paper = 0;
  private inkDark = 0;
  private sparks!: BurstStyle;
  private fountain!: BurstStyle;
  private embers!: BurstStyle;
  private smoke!: BurstStyle;
  private steam!: BurstStyle;

  private readonly v = new Vector3();
  private readonly m4 = new Matrix4();
  private readonly q = new Quaternion();
  private readonly s = new Vector3();
  private readonly col = new Color();
  private readonly cFire = new Color(TINT.fire);
  private readonly cHot = new Color(TINT.fireHot);
  private readonly cWhite = new Color(TINT.fireWhite);

  constructor(private readonly setup: ForgeSetup) {}

  // ---- probes (the screen and the smoke test read these) -------------------------------------

  /** The furnace temperature (0 cold iron .. 1 white-hot). */
  get temperature(): number {
    return this.heat;
  }

  /** How the fire stands now. */
  get fireTemper(): Temper {
    return temperOf(this.heat);
  }

  /** Lamps lit along the rack (0..SECTIONS). */
  get lampsOn(): number {
    return this.finished ? SECTIONS : lampsLit(this.wordsDone, this.plan?.numbers.length ?? 0);
  }

  /** How each forged letter came out, in order. */
  get forged(): readonly Temper[] {
    return this.tempers;
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
    const { materials: kit, root } = ctx;
    this.gold = ctx.color('gold');
    this.techelet = ctx.color('techelet');
    this.paper = ctx.theme === 'light' ? ctx.color('surface') : ctx.color('ink');
    this.inkDark = ctx.theme === 'light' ? ctx.color('ink') : ctx.color('bg');

    // Sound: the forge theme (its layers follow the streak) and the crackle of the furnace.
    ctx.audio.music('forge');
    ctx.audio.intensity(0);
    ctx.audio.ambience('fire', FURNACE_X, 1.2, FURNACE_Z);

    ctx.atmosphere.setPalette({ ...SKY[ctx.theme], fade: ctx.color('fade'), ink: this.gold });
    ctx.atmosphere.groundAt = terrain;
    ctx.atmosphere.setShadowRange(26);
    ctx.post.setGrade(
      ctx.theme === 'dark'
        ? { exposure: 1.25, saturation: 1.1, vignette: 0.6, godRays: 0.6 }
        : { exposure: 1.1, saturation: 1.15, vignette: 0.5, godRays: 0.7 },
    );
    ctx.rig.groundAt = terrain;

    this.sparks = burstStyle({
      count: 16,
      color: TINT.spark,
      color2: TINT.fireWhite,
      intensity: 3,
      speed: [2, 6],
      spread: 0.9,
      life: [0.35, 0.8],
      size: [0.04, 0.11],
      gravity: 6,
    });
    this.fountain = burstStyle({
      count: 110,
      color: this.gold,
      color2: TINT.fireWhite,
      intensity: 3,
      speed: [4, 11],
      spread: 0.45,
      life: [1, 2.1],
      size: [0.07, 0.2],
      gravity: 5,
    });
    this.embers = burstStyle({
      count: 2,
      color: TINT.fire,
      color2: TINT.fireHot,
      intensity: 2.2,
      speed: [0.3, 1.2],
      spread: 0.6,
      life: [2, 4],
      size: [0.04, 0.09],
      gravity: -0.5,
      radius: 0.8,
    });
    this.smoke = burstStyle({
      count: 2,
      color: TINT.smoke,
      speed: [0.3, 0.9],
      spread: 0.4,
      life: [2.5, 4.5],
      size: [0.4, 0.9],
      gravity: -0.5,
      radius: 0.5,
    });
    this.steam = burstStyle({
      count: 6,
      color: TINT.steam,
      intensity: 1.2,
      speed: [0.6, 1.8],
      spread: 0.8,
      life: [0.8, 1.6],
      size: [0.25, 0.6],
      gravity: -0.8,
      radius: 0.6,
    });

    this.buildCave();
    this.buildFurnace();
    this.buildAnvil();
    this.buildGauge();
    this.buildRack();
    this.buildLamps();

    // --- The people: the apprentice at the anvil, the smith across it, Reb Ezra by the wall.
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
    this.smith = new Character(kit, {
      robe: TINT.smithRobe,
      hem: TINT.smithHem,
      trim: TINT.smithApron,
      skin: TINT.skin,
      ink: TINT.ink,
      headwear: 'cap',
      beard: TINT.smithBeard,
      quill: false,
      height: 1.08,
      seed: 21,
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
    root.add(this.apprentice.root, this.smith.root, this.ezra.root, this.dyo.root);
    ctx.atmosphere.addBlob(this.apprentice.root, 0.5);
    ctx.atmosphere.addBlob(this.smith.root, 0.55);
    ctx.atmosphere.addBlob(this.ezra.root, 0.55);
    ctx.atmosphere.addBlob(this.dyo.root, 0.25);

    // --- The number to type, on a parchment banner above the anvil.
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

    // --- Camera: behind the apprentice, looking over the anvil to the furnace and the rack.
    root.add(this.camTarget);
    this.camTarget.position.set(0, 1.4, ANVIL_Z + 1);
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

  private buildCave(): void {
    const { materials: kit, tracker, root } = this.ctx;
    const r = this.rng;

    // The floor and the foot of the walls.
    const land = new PlaneGeometry(90, 90, 90, 90).rotateX(-Math.PI / 2);
    land.translate(0, 0, -4);
    const pos = land.getAttribute('position');
    const colors = new Float32Array(pos.count * 3);
    const a = new Color();
    const b = new Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = terrain(x, z);
      pos.setY(i, h);
      const flag = Math.sin(x * 1.3) * Math.sin(z * 1.3) * 0.5 + 0.5;
      a.setHex(TINT.floorA).lerp(b.setHex(TINT.floorB), flag);
      a.lerp(b.setHex(TINT.rockA), smoothstep(0.5, 6, h));
      a.lerp(b.setHex(TINT.rockC), r.next() * 0.2);
      colors[i * 3] = a.r;
      colors[i * 3 + 1] = a.g;
      colors[i * 3 + 2] = a.b;
    }
    land.setAttribute('color', new BufferAttribute(colors, 3));
    land.computeVertexNormals();
    const floor = new Mesh(tracker.track(land), tracker.track(kit.surface({ vertexColors: true })));
    floor.receiveShadow = true;
    root.add(floor);

    // The dome of the hill, seen from inside, open at the top where the evening comes in.
    const dome = new SphereGeometry(CAVE_R + 7, 40, 18, 0, Math.PI * 2, 0.4, 1.17);
    dome.translate(0, -2, -4);
    const dp = dome.getAttribute('position');
    const dc = new Float32Array(dp.count * 3);
    for (let i = 0; i < dp.count; i++) {
      const y = dp.getY(i);
      const k = Math.sin(dp.getX(i) * 0.9) * Math.sin(dp.getZ(i) * 0.8) * 0.5 + 0.5;
      a.setHex(TINT.roofA).lerp(b.setHex(TINT.roofB), k);
      a.lerp(b.setHex(TINT.rockLit), smoothstep(14, 21, y) * 0.5);
      dc[i * 3] = a.r;
      dc[i * 3 + 1] = a.g;
      dc[i * 3 + 2] = a.b;
    }
    dome.setAttribute('color', new BufferAttribute(dc, 3));
    const roof = new Mesh(
      tracker.track(dome),
      tracker.track(kit.surface({ vertexColors: true, side: BackSide })),
    );
    root.add(roof);

    // Stalagmites and rock ribs standing around the edge.
    const parts: BufferGeometry[] = [];
    const lay = (geo: BufferGeometry, x: number, y: number, z: number, hex: number): void => {
      geo.translate(x, y, z);
      parts.push(painted(geo, hex));
    };
    for (let i = 0; i < 26; i++) {
      const ang = (i / 26) * Math.PI * 2 + r.range(-0.1, 0.1);
      const dist = r.range(CAVE_R - 4.5, CAVE_R - 0.5);
      const x = Math.sin(ang) * dist;
      const z = -4 + Math.cos(ang) * dist;
      if (z < ANVIL_Z + 1 && Math.abs(x) < 8 && z > RACK_Z + 3 && dist < CAVE_R - 3) continue;
      const hgt = r.range(1.2, 3.8);
      lay(
        new ConeGeometry(r.range(0.5, 1.1), hgt, 6).rotateY(r.range(0, 3)),
        x,
        terrain(x, z) + hgt / 2 - 0.1,
        z,
        r.next() < 0.5 ? TINT.rockA : TINT.rockB,
      );
    }
    const rocks = new Mesh(merged(parts), tracker.track(kit.surface({ vertexColors: true })));
    tracker.track(rocks.geometry);
    kit.caster(rocks, true);
    root.add(rocks);
  }

  private buildFurnace(): void {
    const { materials: kit, tracker, root } = this.ctx;
    const parts: BufferGeometry[] = [];
    const add = (geo: BufferGeometry, x: number, y: number, z: number, hex: number): void => {
      geo.translate(x, y, z);
      parts.push(painted(geo, hex));
    };
    // The brick body with its dark base, the hood, and the chimney up to the roof.
    add(new BoxGeometry(3.6, 0.5, 3), 0, 0.25, 0, TINT.brickDark);
    add(new BoxGeometry(3.2, 2.6, 2.6), 0, 1.8, 0, TINT.brick);
    add(new BoxGeometry(3.5, 0.35, 2.9), 0, 3.25, 0, TINT.brickDark);
    add(new CylinderGeometry(0.9, 1.3, 2.2, 8), 0, 4.5, -0.2, TINT.brick);
    add(new CylinderGeometry(0.7, 0.9, 9, 8), 0, 10.1, -0.3, TINT.brickDark);
    // Iron straps around the body.
    add(new BoxGeometry(3.3, 0.12, 2.7), 0, 1.1, 0, TINT.iron);
    add(new BoxGeometry(3.3, 0.12, 2.7), 0, 2.5, 0, TINT.iron);
    const body = new Mesh(merged(parts), tracker.track(kit.surface({ vertexColors: true })));
    tracker.track(body.geometry);
    kit.caster(body, true);
    const g = new Group();
    g.add(body);
    // The mouth: an arch of fire on the front, brighter and whiter as the temperature rises.
    this.fire = new Mesh(
      tracker.track(new BoxGeometry(1.7, 1.25, 0.18)),
      tracker.track(kit.ink(TINT.ember, 1.4)),
    );
    this.fire.position.set(0, 1.55, 1.34);
    g.add(this.fire);
    g.position.set(FURNACE_X, 0, FURNACE_Z);
    g.rotation.y = 0.35;
    root.add(g);
    this.fireLight = new PointLight(TINT.fire, 0, 30, 1.6);
    this.fireLight.position.set(FURNACE_X + 1, 3.6, FURNACE_Z + 2.6);
    root.add(this.fireLight);
  }

  private buildAnvil(): void {
    const { materials: kit, tracker, root } = this.ctx;
    const parts: BufferGeometry[] = [];
    const add = (geo: BufferGeometry, x: number, y: number, z: number, hex: number): void => {
      geo.translate(x, y, z);
      parts.push(painted(geo, hex));
    };
    // A stump, the anvil's waist, its face and its horn; a tool rack and a quench barrel.
    add(new CylinderGeometry(0.85, 1, 1, 10), 0, 0.5, 0, TINT.wood);
    add(new BoxGeometry(0.9, 0.55, 0.7), 0, 1.25, 0, TINT.iron);
    add(new BoxGeometry(1.7, 0.35, 0.95), 0, 1.65, 0, TINT.ironLight);
    add(new ConeGeometry(0.4, 1, 8).rotateZ(Math.PI / 2), -1.3, 1.65, 0, TINT.ironLight);
    add(new CylinderGeometry(0.75, 0.65, 1.3, 10), 2.6, 0.65, 0.3, TINT.woodDark);
    add(new TorusGeometry(0.72, 0.05, 6, 12).rotateX(Math.PI / 2), 2.6, 1.0, 0.3, TINT.iron);
    add(new BoxGeometry(0.2, 1.9, 0.2), -3.4, 0.95, 0.4, TINT.woodDark);
    add(new BoxGeometry(1.4, 0.14, 0.2), -3.4, 1.7, 0.4, TINT.wood);
    const mesh = new Mesh(merged(parts), tracker.track(kit.surface({ vertexColors: true })));
    tracker.track(mesh.geometry);
    kit.caster(mesh, true);
    mesh.position.set(0, 0, ANVIL_Z);
    root.add(mesh);
  }

  private buildGauge(): void {
    const { materials: kit, tracker, root } = this.ctx;
    const g = new Group();
    const col = (h0: number, h1: number, hex: number, width: number): Mesh => {
      const m = new Mesh(
        tracker.track(new BoxGeometry(width, (h1 - h0) * GAUGE_H, width * 0.6)),
        tracker.track(kit.ink(hex, 0.95)),
      );
      m.position.y = ((h0 + h1) / 2) * GAUGE_H + 0.5;
      return m;
    };
    g.add(col(0, BAND_LOW, TINT.gaugeCold, 0.34));
    g.add(col(BAND_LOW, BAND_HIGH, TINT.gaugeGood, 0.48));
    g.add(col(BAND_HIGH, 1, TINT.gaugeHot, 0.34));
    // The iron frame and its foot.
    const parts: BufferGeometry[] = [];
    const add = (geo: BufferGeometry, x: number, y: number, z: number, hex: number): void => {
      geo.translate(x, y, z);
      parts.push(painted(geo, hex));
    };
    add(new BoxGeometry(0.16, GAUGE_H + 0.7, 0.3), -0.4, (GAUGE_H + 0.7) / 2 + 0.15, 0, TINT.iron);
    add(new BoxGeometry(0.16, GAUGE_H + 0.7, 0.3), 0.4, (GAUGE_H + 0.7) / 2 + 0.15, 0, TINT.iron);
    add(new CylinderGeometry(0.9, 1.1, 0.4, 10), 0, 0.2, 0, TINT.iron);
    add(new BoxGeometry(1, 0.16, 0.3), 0, GAUGE_H + 0.62, 0, TINT.iron);
    const frame = new Mesh(merged(parts), tracker.track(kit.surface({ vertexColors: true })));
    tracker.track(frame.geometry);
    kit.caster(frame, true);
    g.add(frame);
    // The needle: a glowing bar that slides with the fire, and a bulb at the foot.
    this.needle = new Mesh(
      tracker.track(new BoxGeometry(0.95, 0.12, 0.36)),
      tracker.track(kit.ink(TINT.needle, 2)),
    );
    g.add(this.needle);
    this.bulb = new Mesh(
      tracker.track(new SphereGeometry(0.34, 12, 8)),
      tracker.track(kit.ink(TINT.fire, 1.6)),
    );
    this.bulb.position.set(0, 0.55, 0.05);
    g.add(this.bulb);
    g.position.set(GAUGE_X, 0, GAUGE_Z);
    g.rotation.y = -0.3;
    root.add(g);
    this.needle.position.y = 0.5 + HEAT_START * GAUGE_H;
  }

  private buildRack(): void {
    const { materials: kit, tracker, root } = this.ctx;
    // The back shelves, as dark plates with the blank letters on them.
    const plate = new BoxGeometry(1.2, 1.3, 0.16);
    this.plates = new InstancedMesh(
      tracker.track(plate),
      tracker.track(kit.surface({ color: TINT.rack })),
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
    this.beacon = new Mesh(
      tracker.track(new TorusGeometry(0.78, 0.045, 6, 28)),
      tracker.track(kit.ink(this.gold, 1.6)),
    );
    this.beacon.visible = false;
    root.add(this.beacon);
  }

  private buildLamps(): void {
    const { materials: kit, tracker, root } = this.ctx;
    const mat = tracker.track(kit.ink(TINT.lamp, 2));
    const geo = tracker.track(new SphereGeometry(0.32, 12, 8));
    const chain = tracker.track(new CylinderGeometry(0.03, 0.03, 4, 4));
    const chainMat = tracker.track(kit.surface({ color: TINT.iron }));
    for (let k = 0; k < SECTIONS; k++) {
      const x = (k - (SECTIONS - 1) / 2) * 4.4;
      const z = RACK_Z + 1.6 + x * x * 0.012;
      const lamp = new Mesh(geo, mat);
      lamp.position.set(x, 8.6, z);
      lamp.scale.setScalar(0.001);
      root.add(lamp);
      this.lamps.push(lamp);
      const c = new Mesh(chain, chainMat);
      c.position.set(x, 10.6, z);
      root.add(c);
    }
  }

  onQuality(preset: QualityPreset): void {
    const full = preset.shadows === 'cascaded';
    this.apprentice?.shadowDetail(full);
    this.smith?.shadowDetail(full);
    this.ezra?.shadowDetail(full);
  }

  // ---- a run --------------------------------------------------------------------------------

  start(): void {
    this.reset();
  }

  /** Forgets everything: grey cave, banked fire, blank rack, no lamps. */
  private reset(): void {
    const { materials } = this.ctx;
    materials.clearSweeps();
    materials.restoreAll(0, 0);
    this.lettersDone = 0;
    this.wordsDone = 0;
    this.finished = false;
    this.finaleT = -1;
    this.heardTier = 0;
    this.shownLetters = null;
    this.heat = HEAT_START;
    this.heatShown = HEAT_START;
    this.started = false;
    this.warned.cold = false;
    this.warned.hot = false;
    this.coldFor = 0;
    this.hotFor = 0;
    this.tempers.length = 0;
    this.flying = -1;
    this.flyT = 1;
    this.lampShown.fill(0);
    this.beacon.visible = false;
    this.orbit = 0;
    this.ctx.rig.orbit = Math.PI;
    this.ctx.audio.intensity(0);
  }

  /** A new run with this plan (the screen calls it before the first key, and for every retry). */
  begin(plan: ForgePlan): void {
    this.reset();
    this.plan = plan;
    this.chapter = plan.chapters[0]?.id ?? 'stoke';
    this.slots = Math.min(MAX_SLOTS, plan.letters.length);
    this.plates.count = this.slots;
    for (let i = 0; i < this.slots; i++) {
      slotPosition(i, this.slots, this.slot);
      this.q.setFromAxisAngle(UP, -this.slot.x * 0.04);
      this.v.copy(this.slot);
      this.s.set(1, 1, 1);
      this.m4.compose(this.v, this.q, this.s);
      this.plates.setMatrixAt(i, this.m4);
      // The blank letter, faint and grey until it is forged.
      this.field.set(
        i,
        plan.letters[i]?.glyph ?? '',
        this.slot.x,
        this.slot.y,
        this.slot.z + 0.14,
        SLOT_SIZE,
        this.ctx.color('fade'),
        0.7,
      );
    }
    for (let i = this.slots; i < MAX_SLOTS; i++) this.field.hide(i);
    this.plates.instanceMatrix.needsUpdate = true;
    this.field.commit();
    this.place();
  }

  /** Puts the people where they stand. */
  private place(): void {
    this.apprentice.root.position.set(0.2, 0, ANVIL_Z + 2.2);
    this.apprentice.root.rotation.y = Math.PI;
    this.smith.root.position.set(1.9, 0, ANVIL_Z - 0.2);
    this.smith.root.rotation.y = -Math.PI / 2;
    this.ezra.root.position.set(-3.6, 0, ANVIL_Z + 1.6);
    this.ezra.root.rotation.y = Math.atan2(3.4, -1.4);
    this.dyo.root.position.set(1.7, 0, ANVIL_Z + 2.6);
    this.dyo.face(0, ANVIL_Z);
    this.ctx.rig.cut();
  }

  onKey(ev: TypedKey): void {
    const { typing, audio } = this.ctx;
    if (!ev.correct) {
      // A slip is soft: the fire jumps, a blink of grey, and on with the number.
      this.heat = flared(this.heat);
      this.text.miss();
      this.feedback.wrong();
      audio.play('error');
      this.hearTier(typing.tier);
      return;
    }
    if (ev.kind !== 'char') return;
    if (ev.expected === ' ') {
      // The space between numbers is a right key too: it stokes the fire like a digit (the
      // furnace model in plan.ts counts every key, so a steady pace holds the band).
      this.heat = stoked(this.heat);
      audio.play('space');
      return;
    }
    this.started = true;
    this.heat = stoked(this.heat);
    const at = this.text.letterPosition(ev.index, this.v);
    this.text.hit(ev.index);
    this.feedback.correct(at.x, at.y, at.z, LETTER_SIZE, typing.tier);
    this.apprentice.play('write');
    this.smith.play('write');
    this.smithT = 0.35;
    audio.play('key', typing.combo, ev.expected);
    this.hearTier(typing.tier);
    this.lettersDone += 1;
    // A shower of sparks off the anvil for every right key.
    this.ctx.vfx.burst(this.sparks, this.anvilTop.x, this.anvilTop.y, this.anvilTop.z, 0, 1, 0);
    this.ctx.audio.playAt('impact', this.anvilTop.x, this.anvilTop.y, this.anvilTop.z, 0.2);
  }

  /** The music builds with the combo tier; a new tier rings a chime. */
  private hearTier(tier: number): void {
    if (tier > this.heardTier) {
      this.ctx.audio.play('tier', tier);
      this.dyo.cheer(2 + tier);
      this.ctx.vfx.burst(
        this.fountain,
        this.anvilTop.x,
        this.anvilTop.y + 0.6,
        this.anvilTop.z,
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
    const i = this.wordsDone;
    this.wordsDone += 1;
    const total = plan.numbers.length;
    // The letter comes out of the fire as it is right now.
    const temper = temperOf(this.heat);
    this.tempers.push(temper);
    if (i < this.slots) {
      this.flying = i;
      this.flyT = 0;
      slotPosition(i, this.slots, this.slot);
      this.flyFrom.copy(this.anvilTop);
      const glyph = plan.letters[i]?.glyph ?? '';
      this.field.set(
        i,
        glyph,
        this.flyFrom.x,
        this.flyFrom.y + 0.6,
        this.flyFrom.z,
        SLOT_SIZE,
        temperColor(temper),
        temper === 'good' ? 2.4 : 1.3,
      );
      this.field.commit();
    }
    vfx.burst(this.fountain, this.anvilTop.x, this.anvilTop.y + 0.4, this.anvilTop.z, 0, 1, 0);
    vfx.shockwave(this.anvilTop.x, 1.5, this.anvilTop.z, 3.2, temperColor(temper), 0.6, true, 1.4);
    if (temper === 'good') this.onMoment?.('bright');
    // Color spreads out from the anvil, farther as the run goes on.
    const radius = 7 + (CAVE_R * 1.5 * this.wordsDone) / Math.max(1, total);
    vfx.restore(this.anvilTop.x, 1, this.anvilTop.z, radius, 1.4);
    const a = this.text.anchor;
    this.feedback.word(a.x, a.y, a.z, perfect);
    audio.play('restore');
    audio.play(perfect ? 'perfect' : 'word');
    if (perfect && this.ctx.typing.tier >= 2) this.smith.play('cheer');

    const lit = lampsLit(this.wordsDone, total);
    const before = lampsLit(this.wordsDone - 1, total);
    if (lit > before && this.wordsDone < total) {
      const lamp = this.lamps[lit - 1];
      if (lamp)
        vfx.burst(this.fountain, lamp.position.x, lamp.position.y, lamp.position.z, 0, 1, 0);
      this.onMoment?.('lamp');
    }
    if (this.wordsDone < total) this.chapter = this.chapterNow();
  }

  private chapterNow(): ChapterId {
    const plan = this.plan;
    if (!plan) return 'stoke';
    for (const c of plan.chapters) if (this.wordsDone < c.to) return c.id;
    return plan.chapters.at(-1)?.id ?? 'quench';
  }

  /** The run is over. A whole run restores the cave; a failed trial leaves it as it is. */
  finale(failed: boolean): void {
    if (this.finished || this.finaleT >= 0) return;
    if (failed) {
      this.smith.play('stagger');
      return;
    }
    const { vfx, materials, audio } = this.ctx;
    this.finished = true;
    this.finaleT = 0;
    this.chapter = 'finale';
    materials.restoreAll(1, 2.8);
    vfx.shockwave(0, 0.3, ANVIL_Z, 90, this.gold, 2.4);
    vfx.burst(this.fountain, this.anvilTop.x, this.anvilTop.y + 0.6, this.anvilTop.z, 0, 1, 0);
    this.heat = 0.62;
    audio.play('success');
    audio.intensity(1);
    this.apprentice.play('cheer');
    this.smith.play('cheer');
    this.ezra.play('cheer');
    this.dyo.cheer(6);
    this.ctx.rig.pushIn(0.35, 0.4);
  }

  update(dt: number): void {
    this.time += dt;
    const { vfx } = this.ctx;
    this.dyoRest -= dt;

    // The fire cools while the player is working, never before the first key and never after.
    if (this.started && !this.finished && this.plan) {
      this.heat = cooled(this.heat, dt, this.plan.level);
    }
    this.heatShown = damp(this.heatShown, this.heat, 9, dt);
    const h = this.heatShown;

    // The needle, the bulb, the mouth and the light all follow the temperature.
    this.needle.position.y = 0.5 + h * GAUGE_H;
    const temper = temperOf(h);
    this.col
      .setHex(TINT.ember)
      .lerp(this.cFire, smoothstep(0.1, 0.5, h))
      .lerp(this.cHot, smoothstep(0.5, 0.8, h))
      .lerp(this.cWhite, smoothstep(0.85, 1, h));
    (this.fire.material as Material & { color: Color }).color
      .copy(this.col)
      .multiplyScalar(0.9 + h);
    (this.bulb.material as Material & { color: Color }).color
      .copy(this.col)
      .multiplyScalar(0.9 + h);
    this.fireLight.color.copy(this.col);
    this.fireLight.intensity = 2 + h * 16 + Math.sin(this.time * 17) * h * 1;

    // Reb Ezra's and Dyo's remarks about a fire left too low or too high for a while.
    if (this.started && !this.finished) {
      this.coldFor = temper === 'cold' ? this.coldFor + dt : 0;
      this.hotFor = temper === 'hot' ? this.hotFor + dt : 0;
      if (this.coldFor > 4 && !this.warned.cold) {
        this.warned.cold = true;
        this.onMoment?.('cold');
      }
      if (this.hotFor > 3 && !this.warned.hot) {
        this.warned.hot = true;
        this.onMoment?.('hot');
      }
    }

    // The letter in flight, from the anvil to its place on the rack.
    if (this.flyT < 1 && this.flying >= 0) {
      this.flyT = Math.min(1, this.flyT + dt / FLY_SECONDS);
      const e = this.flyT * this.flyT * (3 - 2 * this.flyT);
      slotPosition(this.flying, this.slots, this.slot);
      const x = this.flyFrom.x + (this.slot.x - this.flyFrom.x) * e;
      const y =
        this.flyFrom.y +
        0.6 +
        (this.slot.y - this.flyFrom.y - 0.6) * e +
        Math.sin(Math.PI * e) * 1.6;
      const z = this.flyFrom.z + (this.slot.z + 0.14 - this.flyFrom.z) * e;
      this.field.move(this.flying, x, y, z);
      if (this.flyT >= 1) {
        const t = this.tempers[this.flying] ?? 'good';
        vfx.burst(this.sparks, this.slot.x, this.slot.y, this.slot.z + 0.2, 0, 0, 1);
        vfx.shockwave(
          this.slot.x,
          this.slot.y,
          this.slot.z + 0.2,
          1.8,
          temperColor(t),
          0.5,
          true,
          1.2,
        );
        this.ctx.audio.playAt('impact', this.slot.x, this.slot.y, this.slot.z, 0.25);
      }
    }
    this.field.commit();

    // Lamps swell as they light.
    for (let k = 0; k < SECTIONS; k++) {
      const want = k < this.lampsOn ? 1 : 0;
      this.lampShown[k] = damp(this.lampShown[k] as number, want, 4, dt);
      const lamp = this.lamps[k];
      if (lamp)
        lamp.scale.setScalar(
          Math.max(0.001, 0.9 * easeOutBack(Math.min(1, this.lampShown[k] as number))),
        );
    }

    this.apprentice.update(dt);
    this.smith.update(dt);
    this.ezra.update(dt);
    this.dyo.update(dt);
    this.smithT -= dt;

    // Ink flows from the quill while the apprentice writes.
    if (this.apprentice.anim.action === 'write') {
      if (!this.quillTrail) this.quillTrail = vfx.trail(this.gold, 0.14, 0.7, 2.4);
      this.apprentice.quillTip.getWorldPosition(this.v);
      this.quillTrail.emit(this.v.x, this.v.y, this.v.z);
    } else if (this.quillTrail) {
      this.quillTrail.stop();
      this.quillTrail = null;
    }

    // Embers rise from the furnace, smoke up the chimney, steam off the barrel.
    if ((this.emberTimer -= dt) <= 0) {
      this.emberTimer = this.finished ? 0.06 : 0.22 - h * 0.14;
      vfx.burst(this.embers, FURNACE_X + 0.6, 2.2, FURNACE_Z + 1.2, 0, 1, 0);
      vfx.burst(this.smoke, FURNACE_X, 9.5, FURNACE_Z - 0.3, 0, 1, 0);
      if (this.smithT > 0) vfx.burst(this.steam, 2.6, 1.5, ANVIL_Z + 0.3, 0, 1, 0);
    }
    if (this.finaleT >= 0) {
      const before = this.finaleT;
      this.finaleT += dt;
      if (before < 0.7 && this.finaleT >= 0.7)
        vfx.burst(this.fountain, -3, 1.6, ANVIL_Z - 1, 0, 1, 0);
      if (before < 1.4 && this.finaleT >= 1.4)
        vfx.burst(this.fountain, 3, 1.6, ANVIL_Z - 1, 0, 1, 0);
    }
  }

  frame(dt: number): void {
    const { rig, typing } = this.ctx;

    // The camera rides behind the apprentice, a little higher once the cave is restored.
    const t = this.camTarget.position;
    t.x = damp(t.x, 0, 3, dt);
    t.y = damp(t.y, this.finished ? 2.4 : 1.7, 2, dt);
    t.z = damp(t.z, ANVIL_Z + 0.4, 3, dt);
    this.orbit = damp(this.orbit, this.finished ? 0.5 : 0, 0.6, dt);
    // The follow camera looks toward +z by default; half a turn puts it behind the apprentice.
    rig.orbit = Math.PI + this.orbit + Math.sin(this.time * 0.17) * 0.025;

    // The beacon ring rests on the rack slot of the letter being forged.
    if (!this.finished && this.plan && this.wordsDone < this.slots) {
      slotPosition(this.wordsDone, this.slots, this.slot);
      this.beacon.visible = true;
      this.beacon.position.set(this.slot.x, this.slot.y, this.slot.z + 0.2);
      this.beacon.scale.setScalar(1 + Math.sin(this.time * 4) * 0.06);
    } else {
      this.beacon.visible = false;
    }

    // The banner floats above the anvil, between the smith and the apprentice.
    const a = this.text.anchor;
    a.x = damp(a.x, 0, 3, dt);
    a.y = damp(a.y, 3.5, 3, dt);
    a.z = damp(a.z, ANVIL_Z - 0.6, 3, dt);

    // The number to type: a new one rises when the driver moves on. Once the run is over the
    // banner goes, so no stale number is left hanging over the anvil.
    this.text.root.visible = !this.finished;
    if (typing.letters !== this.shownLetters) {
      this.shownLetters = typing.letters;
      const n = typing.letters.length;
      const end = n > 0 && typing.letters[n - 1] === ' ' ? n - 1 : n;
      this.text.setWord(typing.letters.slice(0, end), false);
    }
    this.text.frame(dt, typing.states);
    this.feedback.frame(dt);
  }

  dispose(): void {
    this.quillTrail?.stop();
    this.quillTrail = null;
    if (this.ctx) {
      for (const c of [this.apprentice, this.smith, this.ezra]) {
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
