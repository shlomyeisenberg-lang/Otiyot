// The Jaffa Line (T19): the third region of Act Two.
//
// A clockwork railway at dawn, from the coast up to the hills. The Fading has taken the color out
// of the land and put the signal lamps out, and Naftali's rose-and-cream train runs on the next
// track, side by side with the apprentice's. Every stretch of track is one word on the banner.
// Typing moves the train, and clean words build boost: boosted steam, a hot headlamp and a faster
// train. After every third stretch comes a bend, and a train with boost in hand is carried through
// it and gains on Naftali; one without boost slows into the curve and loses ground. The race is
// won with a lead at the end. Whatever the race, the run is always finished: nothing counts down,
// and the last stretch brings the whole line back to color.
//
// The typing is judged by the host (PlayController); this scene only reacts, and learns the shape
// of the run from `begin(plan)`.

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
  bendCarried,
  boostAfter,
  lampsLit,
  leadAfter,
  raceWon,
  rivalAtFinish,
  SECTIONS,
  type ChapterId,
  type RailPlan,
} from './plan';
import { buildTrack, pointAt, STRETCH_LENGTH, type Track, type TrackPoint } from './track';

export interface RailSetup {
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
export type RailMoment = 'bend' | 'skid' | 'lamp';

const MAX_SLOTS = 16;
const SIGN_SIZE = 1.0;
const LETTER_SIZE = 1.05;
const SIGN_Y = 3.6;
/** How far ahead of the apprentice's car the word banner floats (it used to sit behind the camera). */
const BANNER_AHEAD = 12;
/** How far to the side the rival's track runs, and where the signals stand. */
const RIVAL_SIDE = 4.6;
const SIGNAL_SIDE = -3.4;
const UP = new Vector3(0, 1, 0);
/** How many steam puffs per second at no boost and at full boost. */
const PUFF_RATE = [3, 14] as const;

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

/** One clockwork train: a locomotive and an open car, the wheels kept apart so they can turn. */
interface Train {
  root: Object3D;
  wheels: Mesh[];
  lamp: Mesh;
  /** Where the steam leaves the chimney, in the train's own space. */
  chimney: Vector3;
}

export class RailScene implements GameScene {
  readonly id = 'rail';
  /** Told when something worth a line happens (the first bend, a lamp lit). */
  onMoment: ((moment: RailMoment) => void) | null = null;

  private ctx!: SceneContext;
  private readonly rng = new Rng(1913);
  private plan: RailPlan | null = null;
  private track!: Track;
  private apprentice!: Character;
  private naftali!: Character;
  private ezra!: Character;
  private dyo!: Dyo;
  private text!: WorldText;
  private feedback!: TypingFeedback;
  private quillTrail: Trail | null = null;
  private shownLetters: readonly string[] | null = null;

  private mine!: Train;
  private rival!: Train;
  private sleepers!: InstancedMesh;
  private plates!: InstancedMesh;
  private field!: LetterField;
  private beacon!: Mesh;
  private matOff!: Material;
  private matOn!: Material;
  private readonly signalLamp: Mesh[] = [];
  private readonly lampOn = new Float32Array(MAX_SLOTS);
  private headLight!: PointLight;
  private readonly bigLamps: Mesh[] = [];
  private readonly bigShown = new Float32Array(SECTIONS);
  private slots = 0;

  // The race.
  private boost = 0;
  private boostShown = 0;
  private lead = 0;
  private bendsCarried = 0;
  private bendsTaken = 0;
  private slipped = false;
  private partial = 0;
  private letters = 1;
  /** Distance along the track of each train, as shown. */
  private sMine = 0;
  private sRival = 0;
  /** When each stretch was finished, in milliseconds since the first key: the ghost of this run. */
  private ghost: number[] = [];
  private runStart = -1;

  private wordsDone = 0;
  private chapter: ChapterId | 'finale' = 'coast';
  private finished = false;
  private heardTier = 0;
  private time = 0;
  private finaleT = -1;
  private puffTimer = 0;
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
  private steam!: BurstStyle;

  private readonly v = new Vector3();
  private readonly w = new Vector3();
  private readonly m4 = new Matrix4();
  private readonly q = new Quaternion();
  private readonly s = new Vector3();
  private readonly pt: TrackPoint = { x: 0, z: 0, heading: 0 };

  constructor(private readonly setup: RailSetup) {}

  // ---- probes (the screen and the smoke test read these) -------------------------------------

  /** Boost in hand (0..1). */
  get boostNow(): number {
    return this.boost;
  }

  /** The lead over Naftali, in stretches (negative: he is ahead). */
  get leadNow(): number {
    return this.lead;
  }

  get bendsWon(): number {
    return this.bendsCarried;
  }

  get bendsPassed(): number {
    return this.bendsTaken;
  }

  /** True when the run ends (or would end) with the apprentice in front. */
  get ahead(): boolean {
    return raceWon(this.lead);
  }

  /** Station lamps lit along the line (0..SECTIONS). */
  get lampsOn(): number {
    return this.finished ? SECTIONS : lampsLit(this.wordsDone, this.plan?.stretches.length ?? 0);
  }

  /** Signals whose stretch is closed (their lamp is lit). */
  get signalsOpen(): number {
    return Math.min(this.wordsDone, this.slots);
  }

  get restored(): boolean {
    return this.finished;
  }

  /** The chapter the camera is showing. */
  get view(): ChapterId | 'finale' {
    return this.chapter;
  }

  /** Data of this run for a later ghost: when each stretch was finished (ms since the first key). */
  get ghostTrace(): readonly number[] {
    return this.ghost;
  }

  // ---- loading ------------------------------------------------------------------------------

  async load(ctx: SceneContext): Promise<void> {
    this.ctx = ctx;
    const { materials: kit, root } = ctx;
    this.gold = ctx.color('gold');
    this.techelet = ctx.color('techelet');
    this.paper = ctx.theme === 'light' ? ctx.color('surface') : ctx.color('ink');
    this.inkDark = ctx.theme === 'light' ? ctx.color('ink') : ctx.color('bg');

    // Sound: the rail theme (its layers follow the combo tier).
    ctx.audio.music('rail');
    ctx.audio.intensity(0);

    ctx.atmosphere.setPalette({ ...SKY[ctx.theme], fade: ctx.color('fade'), ink: this.gold });
    ctx.atmosphere.groundAt = () => 0;
    ctx.atmosphere.setShadowRange(40);
    ctx.post.setGrade(
      ctx.theme === 'dark'
        ? { exposure: 1.25, saturation: 1.15, vignette: 0.55, godRays: 0.5 }
        : { exposure: 1.05, saturation: 1.2, vignette: 0.4, godRays: 0.6 },
    );
    ctx.rig.groundAt = () => 0;

    this.sparks = burstStyle({
      count: 14,
      color: TINT.spark,
      color2: TINT.boost,
      intensity: 3,
      speed: [2, 6],
      spread: 0.9,
      life: [0.3, 0.8],
      size: [0.04, 0.1],
      gravity: 6,
    });
    this.fountain = burstStyle({
      count: 80,
      color: TINT.lamp,
      color2: TINT.boost,
      intensity: 3,
      speed: [4, 10],
      spread: 0.5,
      life: [1, 2],
      size: [0.07, 0.18],
      gravity: 5,
    });
    this.steam = burstStyle({
      count: 2,
      color: TINT.steam,
      intensity: 1.3,
      speed: [0.6, 1.6],
      spread: 0.35,
      life: [0.9, 1.8],
      size: [0.25, 0.5],
      gravity: -0.6,
    });

    this.track = buildTrack(16);
    this.buildLand();
    this.buildTrackBed();
    this.buildScenery();
    this.buildSignals();
    this.buildStationLamps();
    this.mine = this.buildTrain(TINT.steel, TINT.brass);
    this.rival = this.buildTrain(TINT.rival, TINT.cream);
    root.add(this.mine.root, this.rival.root);

    this.headLight = new PointLight(TINT.lamp, 0, 26, 1.5);
    root.add(this.headLight);

    // --- The people: the apprentice on his car, Naftali on his, Reb Ezra at the start, Dyo.
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
    this.naftali = new Character(kit, {
      robe: TINT.naftaliRobe,
      hem: TINT.naftaliHem,
      trim: TINT.naftaliTrim,
      skin: TINT.skin,
      ink: TINT.ink,
      headwear: 'cap',
      beard: TINT.naftaliBeard,
      quill: false,
      height: 0.98,
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
    // The apprentice and Dyo ride the open car of their train; Naftali rides his.
    this.apprentice.root.position.set(0, 0.5, 4.9);
    this.apprentice.root.rotation.y = Math.PI;
    this.dyo.root.position.set(0.8, 0.5, 5.6);
    this.naftali.root.position.set(0, 0.5, 4.9);
    this.naftali.root.rotation.y = Math.PI;
    this.mine.root.add(this.apprentice.root, this.dyo.root);
    this.rival.root.add(this.naftali.root);
    root.add(this.ezra.root);
    ctx.atmosphere.addBlob(this.apprentice.root, 0.5);
    ctx.atmosphere.addBlob(this.naftali.root, 0.5);
    ctx.atmosphere.addBlob(this.ezra.root, 0.55);
    ctx.atmosphere.addBlob(this.dyo.root, 0.25);

    // --- The word to type, on a parchment banner ahead of the train.
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

    // --- Camera: behind the apprentice's car, looking up the line past both trains.
    root.add(this.camTarget);
    ctx.rig.follow(this.camTarget, {
      distance: 16,
      height: 6.6,
      lookHeight: 0.6,
      stiffness: 2.6,
    });
    this.onQuality(ctx.quality);
    this.place();
  }

  /** Ground: sand at the coast, olive-green plain, dry gold hills; and the sea to the west. */
  private buildLand(): void {
    const { materials: kit, tracker, root } = this.ctx;
    const r = this.rng;
    const len = this.track.length;
    const land = new PlaneGeometry(260, len + 260, 130, 90).rotateX(-Math.PI / 2);
    land.translate(20, 0, -len / 2 + 40);
    const pos = land.getAttribute('position');
    const colors = new Float32Array(pos.count * 3);
    const a = new Color();
    const b = new Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const along = Math.max(0, Math.min(1, -z / len));
      // Sand first, then grass, then dry hill gold toward the end of the line.
      a.setHex(TINT.sand).lerp(b.setHex(TINT.grassA), Math.min(1, along * 3));
      a.lerp(b.setHex(TINT.hillA), Math.max(0, along * 1.6 - 0.8));
      a.lerp(b.setHex(TINT.grassB), (Math.sin(x * 0.21) * Math.sin(z * 0.17) + 1) * 0.12);
      a.multiplyScalar(0.88 + r.next() * 0.22);
      colors[i * 3] = a.r;
      colors[i * 3 + 1] = a.g;
      colors[i * 3 + 2] = a.b;
    }
    land.setAttribute('color', new BufferAttribute(colors, 3));
    land.computeVertexNormals();
    const floor = new Mesh(tracker.track(land), tracker.track(kit.surface({ vertexColors: true })));
    floor.receiveShadow = true;
    root.add(floor);

    // The sea, off the west side of the coast.
    const sea = new Mesh(
      tracker.track(new PlaneGeometry(260, 300).rotateX(-Math.PI / 2)),
      tracker.track(kit.surface({ color: 0x4f86a8 })),
    );
    sea.position.set(-150, 0.05, 20);
    root.add(sea);

    // The sun, just over the hills ahead and to the right.
    const sun = new Mesh(
      tracker.track(new SphereGeometry(7, 20, 12)),
      tracker.track(kit.ink(0xffe2b0, 1.4)),
    );
    sun.position.set(110, 26, -len - 70);
    root.add(sun);
  }

  /** Two tracks (the apprentice's and Naftali's): ballast, sleepers and rails. */
  private buildTrackBed(): void {
    const { materials: kit, tracker, root } = this.ctx;
    const pts = this.track.points;
    const sides = [0, RIVAL_SIDE];
    const bed: BufferGeometry[] = [];
    const rails: BufferGeometry[] = [];
    const step = 2;
    for (const side of sides) {
      for (let i = 0; i + step < pts.length; i += step) {
        const a = pts[i] as TrackPoint;
        const b = pts[i + step] as TrackPoint;
        const mx = (a.x + b.x) / 2;
        const mz = (a.z + b.z) / 2;
        const h = (a.heading + b.heading) / 2;
        const nx = Math.cos(h);
        const nz = Math.sin(h);
        const cx = mx + nx * side;
        const cz = mz + nz * side;
        const base = new BoxGeometry(2.4, 0.2, step + 0.15);
        base.rotateY(-h);
        base.translate(cx, 0.1, cz);
        bed.push(painted(base, TINT.ballast));
        for (const o of [-0.72, 0.72]) {
          const rail = new BoxGeometry(0.1, 0.14, step + 0.1);
          rail.rotateY(-h);
          rail.translate(cx + nx * o, 0.27, cz + nz * o);
          rails.push(painted(rail, TINT.rail));
        }
      }
    }
    const ballast = new Mesh(merged(bed), tracker.track(kit.surface({ vertexColors: true })));
    tracker.track(ballast.geometry);
    ballast.receiveShadow = true;
    root.add(ballast);
    const steel = new Mesh(merged(rails), tracker.track(kit.surface({ vertexColors: true })));
    tracker.track(steel.geometry);
    root.add(steel);

    // Sleepers: one instanced mesh, every metre and a half on both tracks.
    const sleeperGeo = tracker.track(new BoxGeometry(2.1, 0.1, 0.28));
    const per = Math.floor(pts.length / 1.5);
    this.sleepers = new InstancedMesh(
      sleeperGeo,
      tracker.track(kit.surface({ color: TINT.sleeper })),
      per * 2,
    );
    let n = 0;
    for (const side of sides) {
      for (let k = 0; k < per; k++) {
        const p = pointAt(this.track, k * 1.5 - 24, this.pt);
        this.q.setFromAxisAngle(UP, -p.heading);
        this.v.set(p.x + Math.cos(p.heading) * side, 0.24, p.z + Math.sin(p.heading) * side);
        this.s.set(1, 1, 1);
        this.m4.compose(this.v, this.q, this.s);
        this.sleepers.setMatrixAt(n++, this.m4);
      }
    }
    this.sleepers.instanceMatrix.needsUpdate = true;
    kit.caster(this.sleepers, false);
    root.add(this.sleepers);
  }

  /** Hills, olive groves and telegraph poles along the line. */
  private buildScenery(): void {
    const { materials: kit, tracker, root } = this.ctx;
    const r = this.rng;
    const len = this.track.length;
    const hills: BufferGeometry[] = [];
    const trees: BufferGeometry[] = [];
    const poles: BufferGeometry[] = [];
    for (let k = 0; k < 46; k++) {
      const s = r.range(-20, len + 60);
      const p = pointAt(this.track, s, this.pt);
      const side = r.next() < 0.5 ? -1 : 1;
      // Higher, bigger hills the farther the line has climbed.
      const climb = Math.max(0, Math.min(1, s / len));
      const radius = r.range(9, 18) * (0.7 + climb * 0.9);
      // Always clear of the track and of the camera that rides beside it.
      const dist = radius * 1.3 + r.range(16, 46);
      const hill = new SphereGeometry(radius, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      hill.scale(1.3, r.range(0.5, 0.9) * (0.6 + climb), 1);
      hill.translate(p.x + side * dist, 0, p.z);
      hills.push(painted(hill, r.next() < 0.5 ? TINT.hillA : TINT.hillB));
    }
    for (let k = 0; k < 120; k++) {
      const s = r.range(-20, len + 30);
      const p = pointAt(this.track, s, this.pt);
      const side = r.next() < 0.5 ? -1 : 1;
      const dist = r.range(7, 26);
      const x = p.x + side * dist;
      const z = p.z + r.range(-4, 4);
      const trunk = new CylinderGeometry(0.15, 0.25, 1.6, 6);
      trunk.translate(x, 0.8, z);
      trees.push(painted(trunk, TINT.trunk));
      const crown = new SphereGeometry(r.range(0.9, 1.5), 8, 6);
      crown.scale(1.2, 0.8, 1.2);
      crown.translate(x, 2.1, z);
      trees.push(painted(crown, TINT.olive));
    }
    for (let s = -20; s < len + 30; s += 14) {
      const p = pointAt(this.track, s, this.pt);
      const x = p.x + Math.cos(p.heading) * -2.6;
      const z = p.z + Math.sin(p.heading) * -2.6;
      const pole = new CylinderGeometry(0.07, 0.09, 4.2, 6);
      pole.translate(x, 2.1, z);
      poles.push(painted(pole, TINT.trunk));
      const arm = new BoxGeometry(1.4, 0.08, 0.1);
      arm.rotateY(-p.heading);
      arm.translate(x, 3.9, z);
      poles.push(painted(arm, TINT.trunk));
    }
    for (const parts of [hills, trees, poles]) {
      const mesh = new Mesh(merged(parts), tracker.track(kit.surface({ vertexColors: true })));
      tracker.track(mesh.geometry);
      kit.caster(mesh, parts !== hills);
      root.add(mesh);
    }
  }

  /** A signal post with a station board at the end of every stretch; the lamps start cold. */
  private buildSignals(): void {
    const { materials: kit, tracker, root } = this.ctx;
    this.plates = new InstancedMesh(
      tracker.track(new BoxGeometry(1.4, 1.4, 0.14)),
      tracker.track(kit.surface({ color: TINT.steelDark })),
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

    this.matOff = tracker.track(kit.ink(TINT.lampOff, 0.35));
    this.matOn = tracker.track(kit.ink(TINT.lamp, 2.4));
    const geo = tracker.track(new SphereGeometry(0.28, 10, 8));
    for (let i = 0; i < MAX_SLOTS; i++) {
      const m = new Mesh(geo, this.matOff);
      m.visible = false;
      root.add(m);
      this.signalLamp.push(m);
    }
    const posts = new InstancedMesh(
      tracker.track(new CylinderGeometry(0.09, 0.11, 3.1, 6)),
      tracker.track(kit.surface({ color: TINT.steelDark })),
      MAX_SLOTS,
    );
    posts.name = 'posts';
    posts.count = 0;
    root.add(posts);
    this.beacon = new Mesh(
      tracker.track(new TorusGeometry(0.85, 0.05, 6, 28)),
      tracker.track(kit.ink(this.gold, 1.6)),
    );
    this.beacon.visible = false;
    root.add(this.beacon);
  }

  /** Four tall station lamps beside the line, one per quarter of the run. */
  private buildStationLamps(): void {
    const { materials: kit, tracker, root } = this.ctx;
    const mat = tracker.track(kit.ink(TINT.lamp, 2.2));
    const geo = tracker.track(new SphereGeometry(0.6, 14, 10));
    const pole = tracker.track(new CylinderGeometry(0.08, 0.1, 7, 6));
    const poleMat = tracker.track(kit.surface({ color: TINT.wire }));
    for (let k = 0; k < SECTIONS; k++) {
      const s = ((k + 1) / SECTIONS) * this.track.length - 3;
      const p = pointAt(this.track, s, this.pt);
      const x = p.x + Math.cos(p.heading) * (RIVAL_SIDE + 4.2);
      const z = p.z + Math.sin(p.heading) * (RIVAL_SIDE + 4.2);
      const lamp = new Mesh(geo, mat);
      lamp.position.set(x, 7.4, z);
      lamp.scale.setScalar(0.001);
      root.add(lamp);
      this.bigLamps.push(lamp);
      const c = new Mesh(pole, poleMat);
      c.position.set(x, 3.5, z);
      root.add(c);
    }
  }

  /** A locomotive and an open car for the player to stand in; wheels are separate meshes. */
  private buildTrain(body: number, trim: number): Train {
    const { materials: kit, tracker } = this.ctx;
    const parts: BufferGeometry[] = [];
    const add = (geo: BufferGeometry, x: number, y: number, z: number, hex: number): void => {
      geo.translate(x, y, z);
      parts.push(painted(geo, hex));
    };
    // Locomotive (nose toward -z): frame, boiler, dome, chimney, cab, cowcatcher.
    add(new BoxGeometry(2.3, 0.45, 6.4), 0, 0.85, -0.6, TINT.steelDark);
    const boiler = new CylinderGeometry(0.85, 0.85, 3.6, 14).rotateX(Math.PI / 2);
    add(boiler, 0, 1.85, -1.6, body);
    add(new TorusGeometry(0.86, 0.07, 6, 16), 0, 1.85, -3.4, trim);
    add(new SphereGeometry(0.4, 10, 8), 0, 2.75, -1.2, trim);
    add(new CylinderGeometry(0.22, 0.34, 1.1, 8), 0, 3.0, -3.0, TINT.coal);
    add(new CylinderGeometry(0.4, 0.22, 0.25, 8), 0, 3.65, -3.0, trim);
    add(new BoxGeometry(2.1, 2.1, 1.7), 0, 2.2, 1.0, body);
    add(new BoxGeometry(2.4, 0.18, 2.0), 0, 3.35, 1.0, TINT.steelDark);
    add(
      new ConeGeometry(1.0, 1.0, 4).rotateX(-Math.PI / 2).rotateY(Math.PI / 4),
      0,
      0.7,
      -4.0,
      trim,
    );
    // Open car behind it: floor, low rails, a hitch.
    add(new BoxGeometry(2.4, 0.3, 4.4), 0, 0.85, 5.2, TINT.steelDark);
    add(new BoxGeometry(0.1, 0.5, 4.4), -1.15, 1.25, 5.2, body);
    add(new BoxGeometry(0.1, 0.5, 4.4), 1.15, 1.25, 5.2, body);
    add(new BoxGeometry(2.4, 0.5, 0.1), 0, 1.25, 7.35, body);
    add(new BoxGeometry(0.2, 0.2, 1.2), 0, 0.9, 2.6, TINT.coal);
    const hull = new Mesh(merged(parts), tracker.track(kit.surface({ vertexColors: true })));
    tracker.track(hull.geometry);
    kit.caster(hull, true);
    const root = new Object3D();
    root.add(hull);

    // Wheels: a rim and a cross-spoke, turning about the axle.
    const wheelGeo = merged([
      painted(new CylinderGeometry(0.55, 0.55, 0.14, 14).rotateZ(Math.PI / 2), TINT.steelDark),
      painted(new BoxGeometry(0.2, 1.0, 0.1), trim),
      painted(new BoxGeometry(0.2, 0.1, 1.0), trim),
    ]);
    tracker.track(wheelGeo);
    const wheelMat = tracker.track(kit.surface({ vertexColors: true }));
    const wheels: Mesh[] = [];
    for (const z of [-2.4, -0.9, 0.4, 4.0, 6.4]) {
      for (const x of [-1.2, 1.2]) {
        const wheel = new Mesh(wheelGeo, wheelMat);
        wheel.position.set(x, 0.58, z);
        root.add(wheel);
        wheels.push(wheel);
      }
    }
    const lamp = new Mesh(
      tracker.track(new SphereGeometry(0.3, 10, 8)),
      tracker.track(kit.ink(TINT.lamp, 1.2)),
    );
    lamp.position.set(0, 1.9, -3.55);
    root.add(lamp);
    return { root, wheels, lamp, chimney: new Vector3(0, 3.9, -3.0) };
  }

  onQuality(preset: QualityPreset): void {
    const full = preset.shadows === 'cascaded';
    this.apprentice?.shadowDetail(full);
    this.naftali?.shadowDetail(full);
    this.ezra?.shadowDetail(full);
  }

  // ---- a run --------------------------------------------------------------------------------

  start(): void {
    this.reset();
  }

  /** Forgets everything: grey line, cold lamps, trains side by side at the start. */
  private reset(): void {
    const { materials } = this.ctx;
    materials.clearSweeps();
    materials.restoreAll(0, 0);
    this.wordsDone = 0;
    this.finished = false;
    this.finaleT = -1;
    this.heardTier = 0;
    this.shownLetters = null;
    this.boost = 0;
    this.boostShown = 0;
    this.lead = 0;
    this.bendsCarried = 0;
    this.bendsTaken = 0;
    this.slipped = false;
    this.partial = 0;
    this.letters = 1;
    this.sMine = 0;
    this.sRival = 0;
    this.ghost = [];
    this.runStart = -1;
    this.spoken = false;
    this.lampOn.fill(0);
    this.bigShown.fill(0);
    for (const m of this.signalLamp) m.material = this.matOff;
    this.beacon.visible = false;
    this.orbit = 0;
    this.ctx.audio.intensity(0);
  }

  /** A new run with this plan (the screen calls it before the first key, and for every retry). */
  begin(plan: RailPlan): void {
    this.reset();
    this.plan = plan;
    this.chapter = plan.chapters[0]?.id ?? 'coast';
    this.slots = Math.min(MAX_SLOTS, plan.stretches.length);
    // The track is long enough for exactly this run.
    this.track = buildTrack(plan.stretches.length);
    this.plates.count = this.slots;
    const posts = this.ctx.root.getObjectByName('posts') as InstancedMesh | undefined;
    if (posts) posts.count = this.slots;
    for (let i = 0; i < this.slots; i++) {
      const p = pointAt(this.track, (i + 1) * STRETCH_LENGTH, this.pt);
      const nx = Math.cos(p.heading);
      const nz = Math.sin(p.heading);
      const x = p.x + nx * SIGNAL_SIDE;
      const z = p.z + nz * SIGNAL_SIDE;
      this.q.setFromAxisAngle(UP, -p.heading);
      this.s.set(1, 1, 1);
      this.v.set(x, SIGN_Y, z);
      this.m4.compose(this.v, this.q, this.s);
      this.plates.setMatrixAt(i, this.m4);
      this.v.set(x, 1.55, z);
      this.m4.compose(this.v, this.q, this.s);
      posts?.setMatrixAt(i, this.m4);
      const word = plan.stretches[i]?.word ?? '';
      this.field.set(
        i,
        [...word][0] ?? '',
        x + Math.sin(p.heading) * 0.1,
        SIGN_Y,
        z - Math.cos(p.heading) * 0.1,
        SIGN_SIZE,
        this.ctx.color('fade'),
        0.7,
      );
      const lamp = this.signalLamp[i];
      if (lamp) {
        lamp.visible = true;
        lamp.position.set(x, SIGN_Y - 1.1, z);
      }
    }
    for (let i = this.slots; i < MAX_SLOTS; i++) {
      this.field.hide(i);
      const lamp = this.signalLamp[i];
      if (lamp) lamp.visible = false;
    }
    this.plates.instanceMatrix.needsUpdate = true;
    if (posts) posts.instanceMatrix.needsUpdate = true;
    this.field.commit();
    this.place();
  }

  /** Puts the trains, the people and the camera where a run starts. */
  private place(): void {
    if (!this.track) return;
    this.poseTrain(this.mine, 0, 0);
    this.poseTrain(this.rival, 0, RIVAL_SIDE);
    pointAt(this.track, 0, this.pt);
    this.ezra.root.position.set(this.pt.x - 6.5, 0, this.pt.z + 2);
    this.ezra.root.rotation.y = Math.atan2(5.5, -3);
    this.dyoRest = 0;
    this.camTarget.position.set(this.pt.x, 1.4, this.pt.z + 2);
    this.ctx.rig.orbit = Math.PI;
    this.ctx.rig.cut();
  }

  /** Stands a train at distance `s` along the track, `side` metres to the right of it. */
  private poseTrain(train: Train, s: number, side: number): TrackPoint {
    const p = pointAt(this.track, s, this.pt);
    train.root.position.set(
      p.x + Math.cos(p.heading) * side,
      0.2,
      p.z + Math.sin(p.heading) * side,
    );
    train.root.rotation.y = -p.heading;
    return p;
  }

  onKey(ev: TypedKey): void {
    const { typing, audio } = this.ctx;
    if (this.runStart < 0) this.runStart = performance.now();
    if (!ev.correct) {
      // A slip is soft: a blink of grey, the boost is no longer clean, and on with the stretch.
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
    // Every letter right moves the train on a little: typing is the throttle.
    this.partial = Math.min(0.95, this.partial + 1 / this.letters);
    this.hearTier(typing.tier);
    if (!this.spoken && this.partial > 0.3) {
      this.spoken = true;
      this.ctx.vfx.burst(this.sparks, at.x, at.y, at.z, 0, 1, 0);
    }
  }

  /** The music builds with the combo tier; a new tier rings a chime and a burst of boost. */
  private hearTier(tier: number): void {
    if (tier > this.heardTier) {
      this.ctx.audio.play('tier', tier);
      this.dyo.cheer(2 + tier);
      this.mine.root.getWorldPosition(this.w);
      this.ctx.vfx.burst(this.fountain, this.w.x, this.w.y + 3, this.w.z, 0, 1, 0);
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
    this.partial = 0;
    const total = plan.stretches.length;
    const stretch = plan.stretches[i];
    const clean = perfect && !this.slipped;
    this.slipped = false;
    this.boost = boostAfter(this.boost, clean);
    const bend = stretch?.bend ?? false;
    const carried = bendCarried(this.boost);
    this.lead = leadAfter(this.lead, clean, bend, carried);
    if (this.runStart >= 0) this.ghost.push(Math.round(performance.now() - this.runStart));

    if (i < this.slots) {
      // The signal opens: its board turns gold and its lamp lights.
      const p = pointAt(this.track, (i + 1) * STRETCH_LENGTH, this.pt);
      const x = p.x + Math.cos(p.heading) * SIGNAL_SIDE;
      const z = p.z + Math.sin(p.heading) * SIGNAL_SIDE;
      this.field.set(
        i,
        [...(stretch?.word ?? '')][0] ?? '',
        x + Math.sin(p.heading) * 0.1,
        SIGN_Y,
        z - Math.cos(p.heading) * 0.1,
        SIGN_SIZE,
        clean ? TINT.boost : TINT.lamp,
        clean ? 3 : 2.2,
      );
      this.field.commit();
      const lamp = this.signalLamp[i];
      if (lamp) lamp.material = this.matOn;
      vfx.shockwave(x, 1.4, z, clean ? 5 : 3, clean ? TINT.boost : TINT.lamp, 0.6, true, 1.4);
      vfx.burst(this.fountain, x, 2.4, z, 0, 1, 0);
      // Color spreads out from the signal, farther as the run goes on.
      const radius = 10 + (40 * this.wordsDone) / Math.max(1, total);
      vfx.restore(x, 1, z, radius, 1.4);
      audio.playAt('impact', x, 1.5, z, 0.3);
    }

    if (bend) {
      this.bendsTaken += 1;
      this.mine.root.getWorldPosition(this.w);
      if (carried) {
        // Carried through at speed: sparks off the rail, Naftali is left behind.
        this.bendsCarried += 1;
        vfx.shockwave(this.w.x, 0.6, this.w.z, 7, TINT.boost, 0.7, true, 1.6);
        vfx.burst(this.sparks, this.w.x, 0.6, this.w.z, 0, 1, 0);
        this.naftali.play('stagger');
        this.apprentice.play('cheer');
        this.onMoment?.('bend');
      } else {
        // Too slow into the curve: the wheels squeal and Naftali pulls ahead.
        vfx.burst(this.sparks, this.w.x, 0.5, this.w.z, 0, 1, 0);
        this.naftali.play('cheer');
        this.onMoment?.('skid');
      }
    }
    const a = this.text.anchor;
    this.feedback.word(a.x, a.y, a.z, perfect);
    audio.play('restore');
    audio.play(perfect ? 'perfect' : 'word');

    const lit = lampsLit(this.wordsDone, total);
    const before = lampsLit(this.wordsDone - 1, total);
    if (lit > before && this.wordsDone < total) {
      const lamp = this.bigLamps[lit - 1];
      if (lamp)
        vfx.burst(this.fountain, lamp.position.x, lamp.position.y, lamp.position.z, 0, 1, 0);
      this.onMoment?.('lamp');
    }
    if (this.wordsDone < total) this.chapter = this.chapterNow();
  }

  private chapterNow(): ChapterId {
    const plan = this.plan;
    if (!plan) return 'coast';
    for (const c of plan.chapters) if (this.wordsDone < c.to) return c.id;
    return plan.chapters.at(-1)?.id ?? 'hills';
  }

  /** The run is over. A whole run restores the line; a failed trial leaves it as it is. */
  finale(failed: boolean): void {
    if (this.finished || this.finaleT >= 0) return;
    if (failed) {
      this.naftali.play('cheer');
      return;
    }
    const { vfx, materials, audio } = this.ctx;
    this.finished = true;
    this.finaleT = 0;
    this.chapter = 'finale';
    materials.restoreAll(1, 2.8);
    this.mine.root.getWorldPosition(this.w);
    vfx.shockwave(this.w.x, 0.3, this.w.z, 110, this.gold, 2.4);
    vfx.burst(this.fountain, this.w.x, 3, this.w.z, 0, 1, 0);
    audio.play('success');
    audio.intensity(1);
    this.apprentice.play('cheer');
    this.dyo.cheer(6);
    this.naftali.play(raceWon(this.lead) ? 'stagger' : 'cheer');
    this.ctx.rig.pushIn(0.35, 0.4);
    for (const lamp of this.signalLamp) lamp.material = this.matOn;
  }

  update(dt: number): void {
    this.time += dt;
    const { vfx } = this.ctx;
    this.dyoRest -= dt;
    const total = this.plan?.stretches.length ?? 0;

    // The trains: the apprentice's follows the typing, Naftali's keeps pace less the lead.
    const run = this.finished ? total + 1.2 : this.wordsDone + this.partial;
    const goMine = run * STRETCH_LENGTH;
    // At the finish the winner is in front (Naftali used to stop behind even when he won).
    const goRival =
      (this.finished ? rivalAtFinish(total, this.lead) : run - this.lead) * STRETCH_LENGTH;
    const prevMine = this.sMine;
    const prevRival = this.sRival;
    const speed = 3.2 + this.boostShown * 2.4;
    this.sMine = damp(this.sMine, goMine, this.finished ? 0.8 : speed, dt);
    this.sRival = damp(this.sRival, goRival, this.finished ? 0.7 : 2.6, dt);
    const dMine = this.sMine - prevMine;
    const dRival = this.sRival - prevRival;
    this.boostShown = damp(this.boostShown, this.boost, 4, dt);
    const pm = this.poseTrain(this.mine, this.sMine, 0);
    this.poseTrain(this.rival, this.sRival, RIVAL_SIDE);
    // Wheels turn with the distance covered; a little lean into the bend.
    for (const wheel of this.mine.wheels) wheel.rotation.x -= dMine / 0.55;
    for (const wheel of this.rival.wheels) wheel.rotation.x -= dRival / 0.55;
    const lampGlow = 1.2 + this.boostShown * 2.4;
    (this.mine.lamp.material as Material & { opacity?: number }).opacity = 1;
    this.mine.lamp.scale.setScalar(0.9 + this.boostShown * 0.9 + Math.sin(this.time * 9) * 0.04);
    this.headLight.intensity = (this.finished ? 5 : lampGlow * 2) * 2;
    this.mine.lamp.getWorldPosition(this.w);
    this.headLight.position.set(this.w.x, this.w.y + 0.8, this.w.z);

    // Signal lamps swell as they light.
    for (let i = 0; i < this.slots; i++) {
      const lamp = this.signalLamp[i];
      if (!lamp) continue;
      const open = this.finished || i < this.wordsDone;
      this.lampOn[i] = damp(this.lampOn[i] as number, open ? 1 : 0, 5, dt);
      lamp.scale.setScalar(0.8 + (this.lampOn[i] as number) * 0.5);
    }
    // Big station lamps swell as they light.
    for (let k = 0; k < SECTIONS; k++) {
      const want = k < this.lampsOn ? 1 : 0;
      this.bigShown[k] = damp(this.bigShown[k] as number, want, 4, dt);
      const lamp = this.bigLamps[k];
      if (lamp) {
        lamp.scale.setScalar(
          Math.max(0.001, 1.2 * easeOutBack(Math.min(1, this.bigShown[k] as number))),
        );
      }
    }

    this.apprentice.update(dt);
    this.naftali.update(dt);
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

    // Steam from both chimneys, thicker the more boost the apprentice has in hand.
    const rate = PUFF_RATE[0] + (PUFF_RATE[1] - PUFF_RATE[0]) * this.boostShown;
    if ((this.puffTimer -= dt) <= 0) {
      this.puffTimer = 1 / rate;
      this.v.copy(this.mine.chimney);
      this.mine.root.localToWorld(this.v);
      vfx.burst(this.steam, this.v.x, this.v.y, this.v.z, 0, 1, 0);
      this.v.copy(this.rival.chimney);
      this.rival.root.localToWorld(this.v);
      vfx.burst(this.steam, this.v.x, this.v.y, this.v.z, 0, 1, 0);
    }
    if (this.finaleT >= 0) {
      const before = this.finaleT;
      this.finaleT += dt;
      if (before < 0.7 && this.finaleT >= 0.7)
        vfx.burst(this.fountain, pm.x - 5, 3, pm.z - 6, 0, 1, 0);
      if (before < 1.4 && this.finaleT >= 1.4)
        vfx.burst(this.fountain, pm.x + 5, 3, pm.z - 6, 0, 1, 0);
    }
  }

  frame(dt: number): void {
    const { rig, typing } = this.ctx;
    const p = pointAt(this.track, this.sMine - 1, this.pt);

    // The camera rides behind the apprentice's car, turning with the line.
    const t = this.camTarget.position;
    t.x = damp(t.x, p.x + Math.cos(p.heading) * 2.2, 5, dt);
    t.y = damp(t.y, this.finished ? 2.6 : 1.8, 2, dt);
    t.z = damp(t.z, p.z + Math.sin(p.heading) * 2.2, 5, dt);
    this.orbit = damp(this.orbit, this.finished ? 0.3 : 0, 0.6, dt);
    rig.orbit = Math.PI - p.heading + this.orbit;

    // The beacon ring rests on the board of the open signal.
    if (!this.finished && this.plan && this.wordsDone < this.slots) {
      const b = pointAt(this.track, (this.wordsDone + 1) * STRETCH_LENGTH, this.pt);
      this.beacon.visible = true;
      this.beacon.position.set(
        b.x + Math.cos(b.heading) * SIGNAL_SIDE + Math.sin(b.heading) * 0.2,
        SIGN_Y,
        b.z + Math.sin(b.heading) * SIGNAL_SIDE - Math.cos(b.heading) * 0.2,
      );
      this.beacon.rotation.y = -b.heading;
      this.beacon.scale.setScalar(1 + Math.sin(this.time * 4) * 0.06);
    } else {
      this.beacon.visible = false;
    }

    // The banner floats over the line, ahead of the train.
    const ahead = pointAt(this.track, this.sMine + BANNER_AHEAD, this.pt);
    const a = this.text.anchor;
    a.x = damp(a.x, ahead.x, 6, dt);
    a.y = damp(a.y, 5.2, 3, dt);
    a.z = damp(a.z, ahead.z, 6, dt);

    // The word to type: a new one rises when the driver moves on. Hebrew reads right to left,
    // and once the line is restored the banner goes.
    this.text.root.visible = !this.finished;
    if (typing.letters !== this.shownLetters) {
      this.shownLetters = typing.letters;
      const n = typing.letters.length;
      const end = n > 0 && typing.letters[n - 1] === ' ' ? n - 1 : n;
      this.letters = Math.max(1, end);
      this.text.setWord(typing.letters.slice(0, end), /[\u0590-\u05ff]/.test(typing.word));
    }
    this.text.frame(dt, typing.states);
    this.feedback.frame(dt);
  }

  dispose(): void {
    this.quillTrail?.stop();
    this.quillTrail = null;
    if (this.ctx) {
      for (const c of [this.apprentice, this.naftali, this.ezra]) {
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
