// The Lantern Caves (T25): the first region of Act Three.
//
// Under the hills lie the old chalk caves where the scribes once hid their lamps. The Fading has
// crept in and filled them with shadows. The apprentice goes in with one brass lantern (Dyo
// floats at his shoulder), along a winding tunnel of white chalk banded with dark flint, past
// stalactites and old niches, toward the Hall of Lamps under the hill.
//
// Every chamber of the caves is one passage of words, and every right letter is a careful step
// forward. The lantern is the heart of it: every right letter feeds its flame, every clean streak
// makes it flare (the shadows at the edge of its light flinch and shrink back), and every stumble
// dims it (the shadows creep one step in). Its light is what reaches the walls: bright, it lights
// the chalk far ahead and the next words can be read on a chalk tablet down the tunnel; dim, only
// a small warm circle around the apprentice and the word in hand. On every difficulty but Calm the
// flame burns down slowly while the passage is open; if it goes out the shadows touch the
// apprentice (the screen is told through `onOut` and drops the streak), and the lantern is struck
// alight again. At the end of every chamber an old clay lamp waits on a shelf in the wall: it is
// lit from the lantern, the chalk around it turns warm white and gold, and the lantern is topped
// up. The last chamber opens into the Hall of Lamps: at the end every hanging lamp of the hall
// lights at once, the spring in its middle shines, and the shadows melt away.
//
// Tense, not horror: the shadows are soft ink-smoke with two pale, sleepy eyes; they never strike,
// they only gather and touch. The typing is judged by the host (PlayController); this scene only
// reacts, and learns the shape of the run from `begin`.

import {
  BackSide,
  DoubleSide,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  type MeshBasicMaterial,
  type MeshLambertMaterial,
  Object3D,
  Points,
  PointsMaterial,
  PointLight,
  Quaternion,
  RingGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  burstStyle,
  Character,
  damp,
  Rng,
  smoothstep,
  WorldText,
  type AmbienceHandle,
  type BurstStyle,
  type GameScene,
  type SceneContext,
  type ScenePalette,
  type TypedKey,
  type WorldLetterState,
} from '../../engine';
import { tierIntensity } from '../../audio/composer';
import { Dyo } from '../../game/dyo';
import { TypingFeedback } from '../../game/feedback';
import { DARK, HALL, LIT, TINT } from './palette';
import {
  chamberChars,
  colorShare,
  Lantern,
  lampsLit,
  lookaheadAt,
  LOOK_DIM,
  shadowReach,
  walkAim,
  wordsAhead,
  type CavesPlan,
  type ChapterId,
} from './plan';

export interface CavesSetup {
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
export type CavesEvent = 'creep' | 'flare' | 'dim' | 'out' | 'lamp';

/** The most chambers a run can have (the last always opens into the Hall). */
const MAX_CHAMBERS = 5;
/** Length of the tunnel the chambers share, and of the Hall at its end. */
const RUN_LEN = 150;
const HALL_LEN = 36;
const TUNNEL_START = -14;
const TUNNEL_END = RUN_LEN + HALL_LEN + 8;
/** Rings and sides of the tunnel's mesh. */
const RING_STEP = 0.9;
const SIDES = 30;
/** The tunnel's radius, and how much the Hall swells it. */
const TUNNEL_R = 3.3;
const HALL_SWELL = 11.5;
/** Where the spring lies in the Hall, and how wide it is. */
const SPRING_Z = RUN_LEN + HALL_LEN * 0.55;
const SPRING_R = 4.2;
const HALL_LAMPS = 20;
const STALACTITES = 140;
/** The shadows that gather at the edge of the light. */
const SHADOWS = 9;
/** Dust drifting in the lantern's light, in a box around it. */
const DUST = 260;
const DUST_BOX = 9;
const LETTER_SIZE = 0.5;
const AHEAD_SIZE = 0.46;
const AHEAD_CAP = 40;
/** Seconds the shadows hold on after touching the apprentice. */
const TOUCH_S = 1.1;

/** The tunnel's line under the hill: x for a given z (straight through the Hall). */
export function pathX(z: number): number {
  const zz = Math.min(z, RUN_LEN);
  return Math.sin(zz * 0.04) * 3.2 + Math.sin(zz * 0.017 + 1.2) * 2.4 - 2.2;
}

function pathYaw(z: number): number {
  return Math.atan2(pathX(z + 0.5) - pathX(z - 0.5), 1);
}

/** How wide the tunnel is at z, around its ring (`a`, 0 = right, PI/2 = the ceiling). */
export function tunnelR(z: number, a: number): number {
  let r = TUNNEL_R + 0.35 * Math.sin(z * 0.3 + a * 3) + 0.25 * Math.sin(a * 7 + z * 0.11);
  r += 0.4 * Math.sin(z * 0.07 + 2) + 0.3 * Math.sin(z * 0.023);
  const k = (z - RUN_LEN) / HALL_LEN;
  if (k > 0 && k < 1) r += HALL_SWELL * Math.pow(Math.sin(Math.PI * k), 0.6);
  // The mouth of the caves is a little wider.
  r += smoothstep(-2, TUNNEL_START, z) * 1.2;
  return r;
}

/** The floor of the caves: almost flat, with a little rubble and wear. */
export function floorAt(x: number, z: number): number {
  return 0.05 * Math.sin(x * 2 + z * 1.3) + 0.06 * Math.sin(z * 0.7 + x * 0.3);
}

/** A point on the tunnel's wall at (z, a): writes x and y into `out` (its z is z). */
function wallPoint(z: number, a: number, out: Vector3): Vector3 {
  const r = tunnelR(z, a);
  const x = pathX(z) + Math.cos(a) * r * 1.15;
  const y = Math.max(r * 0.5 + Math.sin(a) * r * 0.85, floorAt(x, z));
  return out.set(x, y, z);
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
  if (g.getAttribute('normal')) g.deleteAttribute('normal');
  g.computeVertexNormals();
  return g;
}

function merged(parts: BufferGeometry[]): BufferGeometry {
  const out = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  return out ?? new BufferGeometry();
}

/** A clay lamp on a stone shelf in the wall, at the end of a chamber. */
interface Niche {
  readonly root: Group;
  readonly flame: Mesh;
  lit: number;
  want: number;
}

/** One shadow: soft ink-smoke, two pale eyes. */
interface Shade {
  readonly root: Group;
  readonly eyes: Group;
  /** Its place around the apprentice: an angle from straight ahead, and a little more distance. */
  angle: number;
  extra: number;
  phase: number;
  blink: number;
}

export class CavesScene implements GameScene {
  readonly id = 'caves';
  /** Told when something worth a line happens. */
  onMoment: ((moment: CavesEvent) => void) | null = null;
  /** Told when the light goes out and the shadows touch the apprentice (never on Calm). */
  onOut: (() => void) | null = null;

  private ctx!: SceneContext;
  private readonly rng = new Rng(2525);
  private plan: CavesPlan | null = null;
  private apprentice!: Character;
  private dyo!: Dyo;
  private text!: WorldText;
  private ahead!: WorldText;
  private tablet!: Mesh;
  private readonly aheadStates: WorldLetterState[] = [];
  private aheadKey = -1;
  private aheadN = -1;
  private feedback!: TypingFeedback;
  private shownLetters: readonly string[] | null = null;
  private air: AmbienceHandle | null = null;

  // The lantern.
  private readonly lantern = new Lantern();
  private lanternRoot!: Group;
  private glassMat!: MeshBasicMaterial;
  private flameMesh!: Mesh;
  private lanternLight!: PointLight;
  private shownLight = 0.7;
  private flareT = 0;
  private flicker = 0;

  // The walk.
  private chamber = 0;
  private chamberLen = RUN_LEN / 3;
  private typedHere = 0;
  private walk = 0;
  private walkShown = 0;
  private leadZ = 0;
  private leadSpeed = 0;
  private readonly eye = new Object3D();
  private yaw = 0;

  // The caves.
  private readonly niches: Niche[] = [];
  private lampLight!: PointLight;
  private hallLights: PointLight[] = [];
  private hallFlames!: InstancedMesh;
  private hallFlameMat!: MeshBasicMaterial;
  private springMat!: MeshLambertMaterial;

  // The shadows.
  private readonly shades: Shade[] = [];
  private shadeMat!: MeshLambertMaterial;
  private hazeMat!: MeshBasicMaterial;
  private eyeMat!: MeshBasicMaterial;
  private reachShown = 6;
  private lunge = 0;
  private recoil = 0;
  private touchT = 0;
  private shadeFade = 1;

  // Dust in the light.
  private dust!: Points;
  private dustMat!: PointsMaterial;
  private readonly dustBase = new Float32Array(DUST * 3);

  // The sky (the dark of the caves).
  private readonly palette: ScenePalette = {
    ...DARK.light,
    sunFrom: [0, 1, 0],
    fade: 0,
    ink: 0,
  };
  private readonly ca = new Color();
  private readonly cb = new Color();
  private lastLit = -1;
  private lastHall = -1;
  private litShown = 0;
  private hallShown = 0;

  // The run.
  private wordsDone = 0;
  private chapter: ChapterId | 'finale' = 'mouth';
  private finished = false;
  private heardTier = 0;
  private time = 0;
  private finaleT = -1;
  private saidCreep = false;
  private saidFlare = false;
  private saidDim = false;
  private saidOut = false;

  private gold = 0;
  private techelet = 0;
  private paper = 0;
  private inkDark = 0;
  private puff!: BurstStyle;
  private smoke!: BurstStyle;
  private goldDust!: BurstStyle;
  private sparks!: BurstStyle;
  private splash!: BurstStyle;
  private fountain!: BurstStyle;

  private readonly v = new Vector3();
  private readonly w = new Vector3();
  private readonly m4 = new Matrix4();
  private readonly q = new Quaternion();
  private readonly s = new Vector3();
  private readonly up = new Vector3(0, 1, 0);

  constructor(private readonly setup: CavesSetup) {}

  // ---- probes (the screen and the smoke test read these) -------------------------------------

  /** How full the lantern is now (0 out .. 1 blazing). */
  get light(): number {
    return this.finished ? 1 : this.lantern.light;
  }

  /** How near the shadows stand now (world units from the apprentice). */
  get reach(): number {
    return shadowReach(this.light);
  }

  /** Right letters in a row, as the lantern counts them. */
  get streak(): number {
    return this.lantern.streak;
  }

  /** Times the shadows were pushed back by a clean streak. */
  get flares(): number {
    return this.lantern.flares;
  }

  /** Times the light went out. */
  get outs(): number {
    return this.lantern.outs;
  }

  /** Words after the one in hand that the lantern lets one read now. */
  get aheadWords(): number {
    if (!this.plan || this.finished) return 0;
    return lookaheadAt(this.lantern.light, this.plan.level);
  }

  /** Niche lamps lit (the Hall counts as the last). */
  get lamps(): number {
    return this.plan ? lampsLit(this.plan, this.wordsDone) : 0;
  }

  /** 0..1 along the current chamber. */
  get walkAt(): number {
    return this.walkShown;
  }

  get restored(): boolean {
    return this.finished;
  }

  get view(): ChapterId | 'finale' {
    return this.chapter;
  }

  // ---- loading ------------------------------------------------------------------------------

  async load(ctx: SceneContext): Promise<void> {
    this.ctx = ctx;
    this.gold = ctx.color('gold');
    this.techelet = ctx.color('techelet');
    this.paper = ctx.theme === 'light' ? ctx.color('surface') : ctx.color('ink');
    this.inkDark = ctx.theme === 'light' ? ctx.color('ink') : ctx.color('bg');

    ctx.audio.music('caves');
    ctx.audio.intensity(0);
    this.air = ctx.audio.ambience('cave');

    this.palette.fade = ctx.color('fade');
    this.palette.ink = this.gold;
    this.lastLit = -1;
    this.applySky(0, 0);
    ctx.atmosphere.groundAt = floorAt;
    ctx.atmosphere.setShadowRange(18);
    ctx.rig.groundAt = floorAt;
    ctx.post.setGrade(
      ctx.theme === 'dark'
        ? { exposure: 1.15, saturation: 0.98, vignette: 0.62, godRays: 0.4, bloom: 1.35 }
        : { exposure: 1.1, saturation: 1, vignette: 0.55, godRays: 0.4, bloom: 1.25 },
    );

    this.puff = burstStyle({
      count: 4,
      color: TINT.chalkShade,
      color2: TINT.chalk,
      intensity: 0.7,
      speed: [0.4, 1.2],
      spread: 0.7,
      life: [0.4, 0.8],
      size: [0.05, 0.12],
      gravity: 0.6,
    });
    this.smoke = burstStyle({
      count: 26,
      color: TINT.shadow,
      color2: TINT.shadowEdge,
      intensity: 0.8,
      speed: [1, 3.5],
      spread: 1,
      life: [0.6, 1.3],
      size: [0.18, 0.4],
      gravity: -0.4,
      radius: 0.8,
    });
    this.goldDust = burstStyle({
      count: 60,
      color: TINT.goldDust,
      color2: TINT.gold,
      intensity: 2.6,
      speed: [1, 4.5],
      spread: 1,
      life: [1, 2.2],
      size: [0.05, 0.14],
      gravity: -0.3,
      radius: 1.6,
    });
    this.sparks = burstStyle({
      count: 14,
      color: TINT.flame,
      color2: TINT.flameCore,
      intensity: 2.4,
      speed: [1.2, 3.5],
      spread: 1,
      life: [0.3, 0.7],
      size: [0.03, 0.08],
      gravity: -0.8,
    });
    this.splash = burstStyle({
      count: 40,
      color: TINT.waterShine,
      color2: TINT.water,
      intensity: 2,
      speed: [2, 5],
      spread: 0.5,
      life: [0.6, 1.2],
      size: [0.06, 0.14],
      gravity: 6,
    });
    this.fountain = burstStyle({
      count: 90,
      color: TINT.gold,
      color2: TINT.flameCore,
      intensity: 3,
      speed: [3, 8],
      spread: 0.8,
      life: [1.2, 2.4],
      size: [0.06, 0.18],
      gravity: 1.5,
    });

    this.buildTunnel();
    this.buildStalactites();
    this.buildNiches();
    this.buildHall();
    this.buildApprentice();
    this.buildShadows();
    this.buildDust();
    this.buildTablet();

    // The word to type: on a parchment banner ahead of the apprentice. The words after it are
    // written on a chalk tablet down the tunnel, as far as the lantern lets one read.
    const colors = {
      ink: this.inkDark,
      paper: this.paper,
      stone: ctx.color('fade'),
      gold: this.gold,
      techelet: this.techelet,
      err: ctx.color('err-fg'),
    };
    this.text = new WorldText({
      atlas: ctx.engine.atlas,
      materials: ctx.materials,
      billboard: ctx.vfx.billboard,
      colors,
      style: 'banner',
      size: LETTER_SIZE,
    });
    ctx.root.add(this.text.root);
    this.ahead = new WorldText({
      atlas: ctx.engine.atlas,
      materials: ctx.materials,
      billboard: ctx.vfx.billboard,
      colors,
      style: 'carved',
      size: AHEAD_SIZE,
      capacity: AHEAD_CAP,
    });
    for (let i = 0; i < AHEAD_CAP; i++) this.aheadStates.push('todo');
    ctx.root.add(this.ahead.root);
    this.feedback = new TypingFeedback(ctx, {
      gold: this.gold,
      ink: this.inkDark,
      techelet: this.techelet,
    });

    this.place();
  }

  /** The camera of a run: a little behind the apprentice and over his shoulder. */
  private follow(): void {
    this.ctx.rig.follow(this.eye, {
      distance: 6.2,
      height: 2.1,
      lookHeight: 1.6,
      turnWith: 1,
      stiffness: 2.4,
    });
  }

  /** Blends the dark of the caves toward the warm lit caves (0..1), then the Hall (0..1). */
  private applySky(k: number, h: number): void {
    if (Math.abs(k - this.lastLit) < 0.004 && Math.abs(h - this.lastHall) < 0.004) return;
    this.lastLit = k;
    this.lastHall = h;
    const a = DARK[this.ctx.theme];
    const b = LIT[this.ctx.theme];
    const c = HALL[this.ctx.theme];
    const p = this.palette;
    const mix = (x: number, y: number, z: number): number =>
      this.ca.setHex(x).lerp(this.cb.setHex(y), k).lerp(this.cb.setHex(z), h).getHex();
    const num = (x: number, y: number, z: number): number => {
      const ab = x + (y - x) * k;
      return ab + (z - ab) * h;
    };
    p.skyTop = mix(a.skyTop, b.skyTop, c.skyTop);
    p.skyHorizon = mix(a.skyHorizon, b.skyHorizon, c.skyHorizon);
    p.sun = mix(a.sun, b.sun, c.sun);
    p.sunIntensity = num(a.sunIntensity, b.sunIntensity, c.sunIntensity);
    const sf = p.sunFrom as [number, number, number];
    sf[0] = a.sunFrom[0] + (c.sunFrom[0] - a.sunFrom[0]) * h;
    sf[1] = a.sunFrom[1] + (c.sunFrom[1] - a.sunFrom[1]) * h;
    sf[2] = a.sunFrom[2] + (c.sunFrom[2] - a.sunFrom[2]) * h;
    p.fillSky = mix(a.fillSky, b.fillSky, c.fillSky);
    p.fillGround = mix(a.fillGround, b.fillGround, c.fillGround);
    p.fillIntensity = num(a.fillIntensity, b.fillIntensity, c.fillIntensity);
    p.fog = mix(a.fog, b.fog, c.fog);
    p.fogDensity = num(a.fogDensity, b.fogDensity, c.fogDensity);
    p.fogBase = a.fogBase;
    p.fogFalloff = num(a.fogFalloff, b.fogFalloff, c.fogFalloff);
    p.inscatter = num(a.inscatter, b.inscatter, c.inscatter);
    this.ctx.atmosphere.setPalette(p);
  }

  /** The tunnel: one winding tube of chalk banded with flint, swelling into the Hall at its end. */
  private buildTunnel(): void {
    const { materials: kit, tracker, root } = this.ctx;
    const r = this.rng;
    const rings = Math.ceil((TUNNEL_END - TUNNEL_START) / RING_STEP) + 1;
    const pos = new Float32Array(rings * SIDES * 3);
    const col = new Float32Array(rings * SIDES * 3);
    const a = new Color();
    const b = new Color();
    for (let j = 0; j < rings; j++) {
      const z = TUNNEL_START + j * RING_STEP;
      for (let i = 0; i < SIDES; i++) {
        // The seam of the tube runs along the floor, under the apprentice's feet.
        const ang = -Math.PI / 2 + (i / SIDES) * Math.PI * 2;
        wallPoint(z, ang, this.v);
        const o = (j * SIDES + i) * 3;
        pos[o] = this.v.x;
        pos[o + 1] = this.v.y;
        pos[o + 2] = this.v.z;
        const y = this.v.y;
        // Chalk, with bands of dark flint, ochre stains and a worn, darker floor.
        a.setHex(TINT.chalk).lerp(b.setHex(TINT.chalkShade), r.next() * 0.35);
        const band = Math.abs(Math.sin(y * 1.6 + Math.sin(z * 0.06) * 1.5 + 0.4));
        a.lerp(b.setHex(TINT.flint), smoothstep(0.93, 0.99, band) * 0.85);
        a.lerp(
          b.setHex(TINT.ochre),
          smoothstep(0.55, 1, Math.sin(z * 0.13 + ang * 2) * Math.sin(y * 0.7 + z * 0.05)) * 0.5,
        );
        a.lerp(b.setHex(TINT.chalkWarm), smoothstep(2, 6, y) * 0.25);
        if (y < 0.25) a.lerp(b.setHex(r.next() < 0.3 ? TINT.floorDark : TINT.floor), 0.85);
        col[o] = a.r;
        col[o + 1] = a.g;
        col[o + 2] = a.b;
      }
    }
    const idx: number[] = [];
    for (let j = 0; j < rings - 1; j++) {
      for (let i = 0; i < SIDES; i++) {
        const i2 = (i + 1) % SIDES;
        const p0 = j * SIDES + i;
        const p1 = j * SIDES + i2;
        const p2 = (j + 1) * SIDES + i;
        const p3 = (j + 1) * SIDES + i2;
        // Wound so the faces look inward.
        idx.push(p0, p2, p1, p1, p2, p3);
      }
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    geo.setAttribute('color', new BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const tunnel = new Mesh(
      tracker.track(geo),
      tracker.track(kit.surface({ vertexColors: true, side: DoubleSide })),
    );
    tunnel.receiveShadow = true;
    tunnel.frustumCulled = false;
    root.add(tunnel);
    // The far end of the Hall: a wall of chalk closing the tube.
    const capZ = TUNNEL_END - 0.5;
    const cap = new Mesh(
      tracker.track(painted(new CircleGeometry(TUNNEL_R * 2.2, 16), TINT.chalkShade)),
      tracker.track(kit.surface({ vertexColors: true, side: BackSide })),
    );
    cap.position.set(pathX(capZ), TUNNEL_R * 0.6, capZ);
    root.add(cap);

    // Rubble along the floor: chalk lumps and flint nodules (one draw call).
    const rubbleGeo = tracker.track(
      merged([
        painted(new DodecahedronGeometry(0.35, 0).scale(1.3, 0.7, 1), TINT.chalkShade),
        painted(new DodecahedronGeometry(0.2, 0).translate(0.4, -0.05, 0.2), TINT.flint),
      ]),
    );
    const rubble = new InstancedMesh(
      rubbleGeo,
      tracker.track(kit.surface({ vertexColors: true })),
      70,
    );
    for (let k = 0; k < 70; k++) {
      const z = r.range(TUNNEL_START + 4, RUN_LEN + HALL_LEN - 4);
      const side = r.next() < 0.5 ? -1 : 1;
      const wide = tunnelR(z, side < 0 ? Math.PI : 0) * 1.15;
      const x = pathX(z) + side * r.range(1.6, Math.max(1.8, wide * 0.8));
      const sz = r.range(0.5, 1.5);
      this.v.set(x, floorAt(x, z) + 0.05, z);
      this.q.setFromAxisAngle(this.up, r.range(0, Math.PI * 2));
      this.s.set(sz, sz, sz);
      rubble.setMatrixAt(k, this.m4.compose(this.v, this.q, this.s));
    }
    rubble.instanceMatrix.needsUpdate = true;
    kit.caster(rubble, false);
    root.add(rubble);
  }

  /** Stalactites hanging from the roof, a few stalagmites rising to meet them (one draw call). */
  private buildStalactites(): void {
    const { materials: kit, tracker, root } = this.ctx;
    const r = this.rng;
    const geo = tracker.track(
      merged([
        painted(new ConeGeometry(0.22, 1.4, 6).rotateX(Math.PI).translate(0, -0.7, 0), TINT.chalk),
        painted(
          new ConeGeometry(0.12, 0.8, 5).rotateX(Math.PI).translate(0.22, -0.4, 0.05),
          TINT.chalkWarm,
        ),
      ]),
    );
    const mesh = new InstancedMesh(
      geo,
      tracker.track(kit.surface({ vertexColors: true })),
      STALACTITES,
    );
    for (let k = 0; k < STALACTITES; k++) {
      const z = r.range(TUNNEL_START + 2, TUNNEL_END - 4);
      const hall = z > RUN_LEN + 4 && z < RUN_LEN + HALL_LEN - 4;
      const ang = Math.PI / 2 + r.signed() * (hall ? 0.9 : 0.75);
      wallPoint(z, ang, this.v);
      this.v.y += 0.15;
      const sz = r.range(0.4, 1) * (hall ? 2.4 : 1);
      this.q.setFromAxisAngle(this.up, r.range(0, Math.PI * 2));
      this.s.set(sz, sz * r.range(0.8, 1.6), sz);
      mesh.setMatrixAt(k, this.m4.compose(this.v, this.q, this.s));
    }
    mesh.instanceMatrix.needsUpdate = true;
    kit.caster(mesh, false);
    mesh.frustumCulled = false;
    root.add(mesh);
  }

  /** A clay oil lamp: a round body, a spout, a little handle. */
  private lampGeometry(): BufferGeometry {
    return merged([
      painted(new SphereGeometry(0.2, 10, 6).scale(1, 0.5, 1.2), TINT.clay),
      painted(
        new CylinderGeometry(0.05, 0.08, 0.22, 6).rotateX(Math.PI / 2).translate(0, 0.02, 0.26),
        TINT.clayDark,
      ),
      painted(
        new TorusGeometry(0.07, 0.025, 4, 8).rotateY(Math.PI / 2).translate(0, 0.04, -0.24),
        TINT.clayDark,
      ),
    ]);
  }

  /** The lamps in their niches (one for every chamber but the last). */
  private buildNiches(): void {
    const { materials: kit, tracker, root } = this.ctx;
    const shelfGeo = tracker.track(
      merged([
        painted(new BoxGeometry(1.2, 0.18, 0.7), TINT.chalkShade),
        painted(new BoxGeometry(0.9, 0.12, 0.5).translate(0, -0.15, -0.05), TINT.flint),
        painted(new DodecahedronGeometry(0.18, 0).translate(-0.4, 0.15, -0.1), TINT.chalk),
      ]),
    );
    const lampGeo = tracker.track(this.lampGeometry());
    const flameGeo = tracker.track(new SphereGeometry(0.12, 8, 6).scale(0.7, 1.6, 0.7));
    const mat = tracker.track(kit.surface({ vertexColors: true }));
    for (let k = 0; k < MAX_CHAMBERS - 1; k++) {
      const g = new Group();
      const shelf = new Mesh(shelfGeo, mat);
      g.add(shelf);
      const lamp = new Mesh(lampGeo, mat);
      lamp.position.y = 0.18;
      g.add(lamp);
      const flame = new Mesh(flameGeo, tracker.track(kit.ink(TINT.flame, 2.6)));
      flame.position.set(0, 0.3, 0.3);
      flame.scale.setScalar(0.001);
      g.add(flame);
      root.add(g);
      this.niches.push({ root: g, flame, lit: 0, want: 0 });
    }
    // The light of the newest lamp lit (the older ones glow on without a light of their own).
    this.lampLight = new PointLight(TINT.flame, 0, 16, 1.4);
    root.add(this.lampLight);
  }

  /** The Hall of Lamps: chalk pillars, a ring of hanging lamps, and a spring in the middle. */
  private buildHall(): void {
    const { materials: kit, tracker, root } = this.ctx;
    const r = this.rng;
    const cx = pathX(SPRING_Z);
    // The spring: a pool of still blue water with a rim of pale stones.
    this.springMat = tracker.track(
      kit.surface({ color: TINT.waterDeep, emissive: TINT.water, emissiveIntensity: 0.1 }),
    );
    const pool = new Mesh(
      tracker.track(new CircleGeometry(SPRING_R, 36).rotateX(-Math.PI / 2)),
      this.springMat,
    );
    pool.position.set(cx, 0.1, SPRING_Z);
    pool.receiveShadow = true;
    root.add(pool);
    const rimParts: BufferGeometry[] = [
      painted(
        new RingGeometry(SPRING_R - 0.1, SPRING_R + 0.9, 36, 1).rotateX(-Math.PI / 2),
        TINT.floorDark,
      ),
    ];
    for (let k = 0; k < 22; k++) {
      const ang = (k / 22) * Math.PI * 2 + r.signed() * 0.1;
      rimParts.push(
        painted(
          new DodecahedronGeometry(r.range(0.25, 0.45), 0)
            .scale(1.3, 0.6, 1)
            .translate(Math.cos(ang) * (SPRING_R + 0.5), 0.1, Math.sin(ang) * (SPRING_R + 0.5)),
          k % 3 === 0 ? TINT.chalkShade : TINT.chalk,
        ),
      );
    }
    const rim = new Mesh(
      tracker.track(merged(rimParts)),
      tracker.track(kit.surface({ vertexColors: true })),
    );
    rim.position.set(cx, 0.06, SPRING_Z);
    root.add(rim);

    // Pillars of chalk where stalactite met stalagmite, around the Hall (one mesh).
    const pillars: BufferGeometry[] = [];
    for (let k = 0; k < 8; k++) {
      const ang = (k / 8) * Math.PI * 2 + 0.2;
      const rad = 10.5 + r.range(-1, 1);
      const x = Math.cos(ang) * rad;
      const z = Math.sin(ang) * rad * 1.15;
      if (z < -8 && Math.abs(x) < 4) continue;
      const hgt = 16;
      pillars.push(
        painted(new CylinderGeometry(0.5, 1.4, hgt / 2, 8).translate(x, hgt / 4, z), TINT.chalk),
        painted(
          new CylinderGeometry(1.5, 0.5, hgt / 2, 8).translate(x, (hgt * 3) / 4, z),
          TINT.chalkWarm,
        ),
        painted(
          new TorusGeometry(0.62, 0.12, 5, 10).rotateX(Math.PI / 2).translate(x, hgt / 2, z),
          TINT.flint,
        ),
      );
    }
    const pillarMesh = new Mesh(
      tracker.track(merged(pillars)),
      tracker.track(kit.surface({ vertexColors: true })),
    );
    pillarMesh.position.set(cx, 0, SPRING_Z);
    kit.caster(pillarMesh, false);
    root.add(pillarMesh);

    // A ring of clay lamps hanging on chains over the spring, dark until the finale.
    const lampGeo = tracker.track(
      merged([
        this.lampGeometry(),
        painted(new CylinderGeometry(0.012, 0.012, 3, 3).translate(0, 1.55, 0), TINT.brassDark),
        painted(
          new TorusGeometry(0.22, 0.03, 4, 10).rotateX(Math.PI / 2).translate(0, 0.08, 0),
          TINT.brass,
        ),
      ]),
    );
    const lamps = new InstancedMesh(
      lampGeo,
      tracker.track(kit.surface({ vertexColors: true })),
      HALL_LAMPS,
    );
    this.hallFlameMat = tracker.track(kit.ink(TINT.flame, 0.001));
    this.hallFlames = new InstancedMesh(
      tracker.track(new SphereGeometry(0.075, 8, 6).scale(0.7, 1.7, 0.7)),
      this.hallFlameMat,
      HALL_LAMPS,
    );
    for (let k = 0; k < HALL_LAMPS; k++) {
      const ring = k % 2 === 0 ? 7.5 : 5.2;
      const ang = (k / HALL_LAMPS) * Math.PI * 2;
      const x = cx + Math.cos(ang) * ring;
      const z = SPRING_Z + Math.sin(ang) * ring * 1.1;
      const y = k % 2 === 0 ? 5.2 : 6.8;
      this.v.set(x, y, z);
      this.q.setFromAxisAngle(this.up, ang);
      this.s.set(1.3, 1.3, 1.3);
      lamps.setMatrixAt(k, this.m4.compose(this.v, this.q, this.s));
      this.v.set(x + Math.sin(ang) * 0.42, y + 0.12, z + Math.cos(ang) * 0.42);
      this.hallFlames.setMatrixAt(k, this.m4.compose(this.v, this.q, this.s));
    }
    lamps.instanceMatrix.needsUpdate = true;
    this.hallFlames.instanceMatrix.needsUpdate = true;
    this.hallFlames.visible = false;
    kit.caster(lamps, false);
    root.add(lamps);
    root.add(this.hallFlames);
    for (const [dx, dz] of [
      [-4, -2],
      [4, 3],
    ] as const) {
      const l = new PointLight(TINT.hallLight, 0, 40, 1.2);
      l.position.set(cx + dx, 6.5, SPRING_Z + dz);
      root.add(l);
      this.hallLights.push(l);
    }
  }

  /** The apprentice with his lantern, and Dyo at his shoulder. */
  private buildApprentice(): void {
    const { materials: kit, tracker, root } = this.ctx;
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
      height: 0.94,
      seed: 6,
    });
    root.add(this.apprentice.root);

    // The lantern: a brass cage with a glowing glass, a cap, a ring to hold it by.
    this.lanternRoot = new Group();
    const frame = new Mesh(
      tracker.track(
        merged([
          painted(new CylinderGeometry(0.17, 0.2, 0.06, 8).translate(0, -0.2, 0), TINT.brassDark),
          painted(new ConeGeometry(0.2, 0.18, 8).translate(0, 0.25, 0), TINT.brass),
          painted(new CylinderGeometry(0.17, 0.17, 0.04, 8).translate(0, 0.15, 0), TINT.brassDark),
          painted(new TorusGeometry(0.08, 0.018, 4, 10).translate(0, 0.4, 0), TINT.brass),
          painted(new BoxGeometry(0.025, 0.36, 0.025).translate(0.15, -0.02, 0.0), TINT.brassDark),
          painted(new BoxGeometry(0.025, 0.36, 0.025).translate(-0.15, -0.02, 0.0), TINT.brassDark),
          painted(new BoxGeometry(0.025, 0.36, 0.025).translate(0, -0.02, 0.15), TINT.brassDark),
          painted(new BoxGeometry(0.025, 0.36, 0.025).translate(0, -0.02, -0.15), TINT.brassDark),
        ]),
      ),
      tracker.track(kit.surface({ vertexColors: true, restore: false })),
    );
    this.lanternRoot.add(frame);
    this.glassMat = tracker.track(kit.ink(TINT.lantern, 1.6));
    this.glassMat.transparent = true;
    this.glassMat.opacity = 0.55;
    this.glassMat.depthWrite = false;
    const glass = new Mesh(
      tracker.track(new CylinderGeometry(0.14, 0.15, 0.34, 10)),
      this.glassMat,
    );
    glass.position.y = -0.02;
    this.lanternRoot.add(glass);
    this.flameMesh = new Mesh(
      tracker.track(new SphereGeometry(0.05, 8, 6).scale(0.8, 1.8, 0.8)),
      tracker.track(kit.ink(TINT.flameCore, 3.2)),
    );
    this.lanternRoot.add(this.flameMesh);
    this.lanternLight = new PointLight(TINT.lanternLight, 0, 20, 1.6);
    this.lanternLight.position.y = 0.05;
    this.lanternRoot.add(this.lanternLight);
    root.add(this.lanternRoot);

    this.dyo = new Dyo(kit, {
      body: TINT.dyo,
      shine: TINT.dyoShine,
      eye: TINT.dyoEye,
      pupil: TINT.ink,
    });
    this.dyo.root.scale.setScalar(0.38);
    root.add(this.dyo.root);
    root.add(this.eye);
  }

  /** The shadows: soft ink-smoke figures with pale eyes, waiting at the edge of the light. */
  private buildShadows(): void {
    const { materials: kit, tracker, root } = this.ctx;
    const r = this.rng;
    const bodyGeo = tracker.track(
      merged([
        new SphereGeometry(0.55, 12, 9).scale(1, 1.25, 0.85).translate(0, 1.25, 0),
        new ConeGeometry(0.55, 1.3, 10, 1, true).rotateX(Math.PI).translate(0, 0.45, 0),
        new SphereGeometry(0.22, 8, 6).scale(0.8, 1.4, 0.8).translate(-0.58, 1.05, 0.1),
        new SphereGeometry(0.22, 8, 6).scale(0.8, 1.4, 0.8).translate(0.58, 1.05, 0.1),
      ]),
    );
    this.shadeMat = tracker.track(
      kit.surface({
        color: TINT.shadow,
        emissive: TINT.shadowEdge,
        emissiveIntensity: 1.1,
        restore: false,
        transparent: true,
        opacity: 0.82,
      }),
    );
    const hazeGeo = tracker.track(new SphereGeometry(1, 12, 9).scale(0.95, 1.35, 0.85));
    this.hazeMat = tracker.track(kit.ink(TINT.shadowEdge, 1, BackSide));
    this.hazeMat.transparent = true;
    this.hazeMat.opacity = 0.28;
    this.hazeMat.depthWrite = false;
    const eyeGeo = tracker.track(new SphereGeometry(0.075, 8, 6).scale(1.3, 0.75, 0.6));
    this.eyeMat = tracker.track(kit.ink(TINT.shadowEye, 1.1));
    this.eyeMat.transparent = true;
    for (let k = 0; k < SHADOWS; k++) {
      const g = new Group();
      const body = new Mesh(bodyGeo, this.shadeMat);
      g.add(body);
      const haze = new Mesh(hazeGeo, this.hazeMat);
      haze.position.y = 1.1;
      haze.renderOrder = 2;
      g.add(haze);
      const eyes = new Group();
      for (const x of [-0.17, 0.17]) {
        const e = new Mesh(eyeGeo, this.eyeMat);
        e.position.set(x, 0, 0);
        eyes.add(e);
      }
      eyes.position.set(0, 1.42, 0.44);
      g.add(eyes);
      const scale = r.range(0.72, 1);
      g.scale.setScalar(scale);
      root.add(g);
      // Spread around the apprentice, more in front and to the sides than behind.
      const angle = (k / (SHADOWS - 1) - 0.5) * 3.1 + r.signed() * 0.12;
      this.shades.push({
        root: g,
        eyes,
        angle,
        extra: r.range(0, 1.6),
        phase: r.range(0, Math.PI * 2),
        blink: r.range(1, 5),
      });
    }
  }

  /** The chalk tablet down the tunnel that carries the words ahead. */
  private buildTablet(): void {
    const { materials: kit, tracker, root } = this.ctx;
    this.tablet = new Mesh(
      tracker.track(
        merged([
          painted(new BoxGeometry(1.5, 1.7, 0.3).translate(0, 0.85, 0), TINT.chalk),
          painted(new BoxGeometry(1.7, 0.16, 0.42).translate(0, 1.76, 0), TINT.chalkShade),
          painted(new BoxGeometry(1.2, 0.08, 0.32).translate(0, 0.35, 0.02), TINT.flint),
          painted(
            new DodecahedronGeometry(0.45, 0).scale(1.7, 0.45, 1).translate(0, 0.1, 0),
            TINT.chalkShade,
          ),
        ]),
      ),
      tracker.track(kit.surface({ vertexColors: true })),
    );
    root.add(this.tablet);
  }

  /** Dust floating in the lantern's light. */
  private buildDust(): void {
    const { tracker, root } = this.ctx;
    const r = this.rng;
    for (let i = 0; i < DUST; i++) {
      this.dustBase[i * 3] = r.next() * DUST_BOX;
      this.dustBase[i * 3 + 1] = r.next() * DUST_BOX * 0.5;
      this.dustBase[i * 3 + 2] = r.next() * DUST_BOX;
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(new Float32Array(DUST * 3), 3));
    this.dustMat = tracker.track(
      new PointsMaterial({
        color: TINT.dust,
        size: 0.035,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      }),
    );
    this.dust = new Points(tracker.track(geo), this.dustMat);
    this.dust.frustumCulled = false;
    root.add(this.dust);
  }

  // ---- a run --------------------------------------------------------------------------------

  start(): void {
    this.reset();
  }

  /** Forgets everything: the grey dark caves, the apprentice back at the mouth. */
  private reset(): void {
    const { materials } = this.ctx;
    materials.clearSweeps();
    materials.restoreAll(0, 0);
    this.wordsDone = 0;
    this.chamber = 0;
    this.typedHere = 0;
    this.walk = 0;
    this.walkShown = 0;
    this.leadZ = 0;
    this.leadSpeed = 0;
    this.finished = false;
    this.finaleT = -1;
    this.heardTier = 0;
    this.shownLetters = null;
    this.aheadKey = -1;
    this.aheadN = -1;
    this.lantern.reset(0, true);
    this.shownLight = this.lantern.light;
    this.reachShown = shadowReach(this.lantern.light);
    this.lunge = 0;
    this.recoil = 0;
    this.touchT = 0;
    this.flareT = 0;
    this.shadeFade = 1;
    this.litShown = 0;
    this.hallShown = 0;
    this.saidCreep = false;
    this.saidFlare = false;
    this.saidDim = false;
    this.saidOut = false;
    for (const n of this.niches) {
      n.lit = 0;
      n.want = 0;
      n.flame.scale.setScalar(0.001);
    }
    this.lampLight.intensity = 0;
    for (const l of this.hallLights) l.intensity = 0;
    this.hallFlames.visible = false;
    this.hallFlameMat.color.setHex(TINT.flame).multiplyScalar(0.001);
    this.springMat.emissiveIntensity = 0.1;
    this.lastLit = -1;
    this.applySky(0, 0);
    this.ctx.audio.intensity(0);
  }

  /** A new run with this plan (the screen calls it before the first key, and for every retry). */
  begin(plan: CavesPlan): void {
    this.reset();
    this.plan = plan;
    this.chapter = plan.chapters[0]?.id ?? 'mouth';
    this.lantern.reset(plan.burn, !plan.timers);
    this.shownLight = this.lantern.light;
    this.reachShown = shadowReach(this.lantern.light);
    const n = Math.max(1, Math.min(MAX_CHAMBERS, plan.chambers.length));
    this.chamberLen = RUN_LEN / n;
    // A lamp at the end of every chamber but the last, on alternate walls.
    for (let k = 0; k < this.niches.length; k++) {
      const niche = this.niches[k] as Niche;
      niche.root.visible = k < n - 1;
      const z = this.chamberLen * (k + 1) - 0.5;
      const side = k % 2 === 0 ? 1 : -1;
      wallPoint(z, side > 0 ? 0.25 : Math.PI - 0.25, this.v);
      const x = this.v.x - side * 0.55;
      niche.root.position.set(x, this.v.y, z);
      niche.root.rotation.y = pathYaw(z) + (side > 0 ? -Math.PI / 2 : Math.PI / 2);
    }
    this.place();
  }

  /** Puts the apprentice and the camera where a run starts. */
  private place(): void {
    this.leadZ = 0;
    this.pose(0);
    this.follow();
    this.ctx.rig.cut();
  }

  onKey(ev: TypedKey): void {
    const { typing, audio, vfx } = this.ctx;
    const plan = this.plan;
    if (!plan || this.finished) return;
    if (!ev.correct) {
      // A stumble dims the lantern, and the shadows creep one step closer.
      this.text.miss();
      this.feedback.wrong();
      audio.play('error');
      const e = this.lantern.key(false, plan.slip);
      if (e === 'out') this.goneOut();
      else this.creep();
      this.hearTier(typing.tier);
      return;
    }
    if (ev.kind !== 'char') return;
    // Every right letter is a careful step, and feeds the flame.
    this.typedHere += 1;
    const c = plan.chambers[this.chamber];
    if (c)
      this.walk = Math.max(this.walk, walkAim(this.typedHere, chamberChars(plan, this.chamber)));
    if (this.lantern.key(true, plan.slip) === 'flare') this.flare();
    const app = this.apprentice.root.position;
    vfx.burst(this.puff, app.x, app.y + 0.05, app.z, 0, 1, 0);
    if (ev.expected === ' ') {
      audio.play('space');
      return;
    }
    const at = this.text.letterPosition(ev.index, this.v);
    this.text.hit(ev.index);
    this.feedback.correct(at.x, at.y, at.z, this.text.size, typing.tier);
    audio.play('key', typing.combo, ev.expected);
    this.hearTier(typing.tier);
  }

  /** The music builds with the combo tier; a new tier rings a chime. */
  private hearTier(tier: number): void {
    if (tier > this.heardTier) {
      this.feedback.tierUp(tier);
      this.ctx.audio.play('tier', tier);
      this.dyo.cheer(2 + tier);
    }
    this.heardTier = tier;
    this.ctx.audio.intensity(tierIntensity(tier));
  }

  /** A clean streak: the lantern flares and the shadows flinch back. */
  private flare(): void {
    const { vfx, audio } = this.ctx;
    this.flareT = 1;
    this.recoil = 1;
    const p = this.lanternRoot.position;
    vfx.burst(this.sparks, p.x, p.y, p.z, 0, 1, 0);
    vfx.shockwave(p.x, p.y - 1, p.z, 5, this.gold, 0.4, false, 1);
    audio.playAt('flare', p.x, p.y, p.z);
    for (const s of this.shades) {
      const sp = s.root.position;
      if (s.root.visible) vfx.burst(this.smoke, sp.x, sp.y + 1.2, sp.z, 0, 1, 0);
    }
    if (!this.saidFlare) {
      this.saidFlare = true;
      this.onMoment?.('flare');
    }
  }

  /** A stumble: the flame gutters and the shadows creep in. */
  private creep(): void {
    this.lunge = 1;
    this.ctx.audio.play('creep');
    if (!this.saidCreep) {
      this.saidCreep = true;
      this.onMoment?.('creep');
    }
  }

  /** The light went out: the shadows touch the apprentice, and he strikes it alight again. */
  private goneOut(): void {
    const { vfx, audio } = this.ctx;
    this.touchT = TOUCH_S;
    this.lunge = 1;
    const p = this.apprentice.root.position;
    vfx.burst(this.smoke, p.x, p.y + 1, p.z, 0, 1, 0);
    vfx.impact(0.45, TINT.shadowEdge);
    audio.play('creep');
    audio.playAt('impact', p.x, p.y, p.z);
    this.ctx.rig.shake(0.3);
    this.apprentice.play('stagger');
    this.onOut?.();
    if (!this.saidOut) {
      this.saidOut = true;
      this.onMoment?.('out');
    }
  }

  onWord(_word: string, perfect: boolean): void {
    const plan = this.plan;
    if (!plan) return;
    const c = plan.chambers[this.chamber];
    if (!c) return;
    const { audio } = this.ctx;
    this.wordsDone += 1;
    const a = this.text.anchor;
    this.feedback.word(a.x, a.y, a.z, perfect);
    audio.play(perfect ? 'perfect' : 'word');
    if (perfect) this.lantern.perfect();
    this.sweep(1.4);
    if (this.wordsDone >= c.to) {
      this.chamberDone(c.index);
      if (this.wordsDone < plan.words.length) {
        this.chamber = Math.min(plan.chambers.length - 1, this.chamber + 1);
        this.typedHere = 0;
        this.walk = 0;
        this.lantern.chamber(plan.burn);
      }
      this.chapter = this.chapterNow();
    }
  }

  /** A chamber is done: its lamp is lit from the lantern (the last one opens into the Hall). */
  private chamberDone(index: number): void {
    const { vfx, audio } = this.ctx;
    const plan = this.plan;
    this.walk = 1;
    this.sweep(2.4);
    this.apprentice.play('cheer');
    this.dyo.cheer(3);
    const niche = this.niches[index];
    if (plan && index < plan.chambers.length - 1 && niche) {
      niche.want = 1;
      this.lantern.topUp();
      const p = niche.root.position;
      vfx.burst(this.sparks, p.x, p.y + 0.4, p.z, 0, 1, 0);
      vfx.burst(this.goldDust, p.x, p.y + 0.4, p.z, 0, 1, 0);
      vfx.shockwave(p.x, p.y, p.z, 4, this.gold, 0.5, false, 1.2);
      vfx.restore(p.x, p.y, p.z, 9, 2);
      audio.playAt('lamp', p.x, p.y, p.z);
      this.lampLight.position.set(p.x, p.y + 0.8, p.z);
      this.lampLight.intensity = 0;
      this.onMoment?.('lamp');
    }
  }

  /** Color spreads from the mouth of the caves out past the apprentice, a little more every time. */
  private sweep(seconds: number): void {
    const total = this.plan?.words.length ?? 1;
    const share = colorShare(this.wordsDone, total);
    this.ctx.vfx.restore(0, 0, 0, Math.max(14, this.leadZ + 10 + share * 8), seconds);
  }

  private chapterNow(): ChapterId {
    const plan = this.plan;
    if (!plan) return 'mouth';
    for (const c of plan.chapters) if (this.wordsDone < c.to) return c.id;
    return plan.chapters.at(-1)?.id ?? 'hall';
  }

  /** The run is over. A whole run lights the Hall of Lamps; a failed trial leaves the dark. */
  finale(failed: boolean): void {
    if (this.finished || this.finaleT >= 0) return;
    if (failed) {
      this.ctx.rig.shake(0.4);
      this.ctx.audio.play('impact');
      return;
    }
    const { vfx, materials, audio } = this.ctx;
    this.finished = true;
    this.finaleT = 0;
    this.chapter = 'finale';
    materials.restoreAll(1, 3.2);
    vfx.restore(0, 0, 0, 900, 3.2);
    audio.play('lamp');
    audio.play('success');
    audio.intensity(1);
    this.apprentice.play('cheer');
    this.dyo.cheer(6);
    this.hallFlames.visible = true;
    const sx = pathX(SPRING_Z);
    vfx.burst(this.fountain, sx, 0.5, SPRING_Z, 0, 1, 0);
    this.ctx.rig.pushIn(0.25, 0.6);
    // Pull back and look over the Hall: the lamps, the pillars, the spring, the apprentice.
    this.ctx.rig.fixed(this.v.set(sx + 2, 5, RUN_LEN + 2), this.w.set(sx, 2.6, SPRING_Z + 3));
  }

  update(dt: number): void {
    this.time += dt;
    const { vfx, audio } = this.ctx;
    const plan = this.plan;

    // --- The lantern burns down while a passage is open (never on Calm).
    if (plan && !this.finished) {
      if (this.lantern.step(dt) === 'out') this.goneOut();
      if (!this.saidDim && plan.timers && this.lantern.light < LOOK_DIM) {
        this.saidDim = true;
        this.onMoment?.('dim');
      }
    }
    const light = this.light;
    this.shownLight = damp(this.shownLight, light, 5, dt);
    this.flareT = Math.max(0, this.flareT - dt * 1.6);
    this.lunge = Math.max(0, this.lunge - dt * 1.8);
    this.recoil = Math.max(0, this.recoil - dt * 1.3);
    this.touchT = Math.max(0, this.touchT - dt);
    // Where the shadows stand: at the edge of the light, in on a stumble, all the way when it is out.
    const want = this.touchT > 0 ? 0.7 : shadowReach(this.shownLight);
    this.reachShown = damp(this.reachShown, want, this.touchT > 0 ? 9 : 2.5, dt);

    // --- The sky: warmer with every lamp lit, the Hall at the end.
    const total = plan?.words.length ?? 0;
    const lit = this.finished ? 1 : colorShare(this.wordsDone, total) * 0.55;
    this.litShown = damp(this.litShown, lit, 1.2, dt);
    this.hallShown = damp(this.hallShown, this.finished ? 1 : 0, 0.7, dt);
    this.applySky(this.litShown, this.hallShown);

    // --- The walk: careful steps after the typing.
    this.walkShown = damp(this.walkShown, this.walk, 2.2, dt);
    const was = this.leadZ;
    if (this.finished) {
      // At the end he walks into the Hall, up to the edge of the spring.
      const stop = SPRING_Z - SPRING_R - 1.6;
      this.leadZ = Math.min(stop, this.leadZ + dt * 1.8);
    } else {
      const base = this.chamber * this.chamberLen;
      this.leadZ = Math.max(this.leadZ, base + this.walkShown * this.chamberLen);
    }
    const sp = dt > 0 ? (this.leadZ - was) / dt : 0;
    this.leadSpeed = damp(this.leadSpeed, sp, 6, dt);
    this.pose(dt);

    // --- The lamps in their niches catch, one after another.
    for (const n of this.niches) {
      if (!n.root.visible) continue;
      n.lit = damp(n.lit, n.want, 3, dt);
      const f = n.lit * (0.9 + Math.sin(this.time * 11 + n.root.position.z) * 0.1);
      n.flame.scale.setScalar(Math.max(0.001, f));
    }
    if (this.lampLight.intensity < 1e-3 && this.lamps === 0) this.lampLight.intensity = 0;
    else {
      const target = (this.ctx.theme === 'dark' ? 14 : 10) * (this.finished ? 0.5 : 1);
      this.lampLight.intensity = damp(this.lampLight.intensity, this.lamps > 0 ? target : 0, 2, dt);
    }

    // --- The finale: every lamp in the Hall catches, the spring shines.
    if (this.finaleT >= 0) {
      const before = this.finaleT;
      this.finaleT += dt;
      const k = Math.min(1, this.finaleT / 2.5);
      this.hallFlameMat.color.setHex(TINT.flame).multiplyScalar(0.001 + k * 2);
      const fl = 0.9 + Math.sin(this.time * 9) * 0.1;
      for (const l of this.hallLights) l.intensity = k * (this.ctx.theme === 'dark' ? 70 : 55) * fl;
      this.springMat.emissiveIntensity = 0.1 + k * (0.55 + Math.sin(this.time * 2) * 0.08);
      const sx = pathX(SPRING_Z);
      if (before < 1.2 && this.finaleT >= 1.2) {
        vfx.burst(this.splash, sx - 1.5, 0.3, SPRING_Z + 1, 0, 1, 0);
        vfx.burst(this.goldDust, sx, 5.5, SPRING_Z, 0, 1, 0);
      }
      if (before < 2.4 && this.finaleT >= 2.4) {
        vfx.burst(this.fountain, sx + 1.5, 0.4, SPRING_Z - 1, 0, 1, 0);
        audio.play('tier', 4);
      }
    }

    // --- The shadows melt away at the end.
    this.shadeFade = damp(this.shadeFade, this.finished ? 0 : 1, 1.4, dt);
    this.shadeMat.opacity = 0.82 * this.shadeFade;
    this.hazeMat.opacity = 0.28 * this.shadeFade;
    this.poseShadows(dt);

    if (this.air) this.air.move(this.lanternRoot.position.x, 2, this.lanternRoot.position.z + 6);
  }

  /** Puts the apprentice, his lantern, Dyo and the camera's eye along the tunnel. */
  private pose(dt: number): void {
    const app = this.apprentice.root;
    const z = this.leadZ;
    const yaw = pathYaw(z);
    const ax = pathX(z) + 0.3;
    app.position.set(ax, floorAt(ax, z), z);
    this.yaw = this.finished && this.finaleT > 2.8 ? damp(this.yaw, yaw - 0.6, 1.2, dt) : yaw;
    app.rotation.y = this.yaw;
    this.apprentice.speed = Math.max(0, this.leadSpeed);
    this.apprentice.update(dt);

    // The lantern, held out in front at the right, swinging a little as he walks.
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    const rx = Math.cos(this.yaw);
    const rz = -Math.sin(this.yaw);
    const swing = Math.sin(this.time * 5.5) * Math.min(1, this.leadSpeed) * 0.05;
    const raise = this.flareT * 0.35 + (this.finished ? 0.4 : 0);
    this.lanternRoot.position.set(
      app.position.x + fx * 0.5 + rx * 0.38,
      app.position.y + 1.18 + raise,
      app.position.z + fz * 0.5 + rz * 0.38,
    );
    this.lanternRoot.rotation.z = swing;
    this.lanternRoot.rotation.y = this.yaw;

    // Its light: wide and warm when full, a small guttering circle when low.
    this.flicker = Math.sin(this.time * 17) * 0.04 + Math.sin(this.time * 7.3) * 0.05;
    const l = Math.max(0.05, this.shownLight);
    const boost = 1 + this.flareT * 0.8;
    const base = this.ctx.theme === 'dark' ? 20 : 17;
    this.lanternLight.intensity = base * (0.25 + 0.75 * l) * (1 + this.flicker * (1.6 - l)) * boost;
    this.lanternLight.distance = 6 + 18 * l + this.flareT * 6;
    this.glassMat.color.setHex(TINT.lantern).multiplyScalar(0.6 + 1.4 * l * boost);
    this.flameMesh.scale.set(0.6 + l * 0.6, 0.5 + l * 0.9 + this.flicker, 0.6 + l * 0.6);

    // Dyo floats at the apprentice's left shoulder, close to the light.
    this.dyo.root.position.set(
      app.position.x - rx * 0.55 + fx * 0.15,
      app.position.y + 1.95 + Math.sin(this.time * 2.1) * 0.06,
      app.position.z - rz * 0.55 + fz * 0.15,
    );
    this.dyo.update(dt);

    // The camera's eye: on the apprentice, turned with the tunnel.
    const ez = z - 0.5;
    this.eye.position.set(pathX(ez), floorAt(pathX(ez), ez), ez);
    this.eye.rotation.y = pathYaw(z + 3);
  }

  /** The shadows at the edge of the light: swaying, blinking, creeping in and flinching back. */
  private poseShadows(dt: number): void {
    const app = this.apprentice.root.position;
    const yaw = this.yaw;
    const visible = this.shadeFade > 0.02;
    for (let k = 0; k < this.shades.length; k++) {
      const s = this.shades[k] as Shade;
      s.root.visible = visible;
      if (!visible) continue;
      s.phase += dt;
      const a = yaw + s.angle + Math.sin(s.phase * 0.4) * 0.12;
      const dist =
        this.reachShown +
        s.extra * (0.4 + this.shownLight) -
        this.lunge * 0.9 +
        this.recoil * 1.6 +
        (1 - this.shadeFade) * 6;
      let x = app.x + Math.sin(a) * Math.max(0.6, dist);
      let z = app.z + Math.cos(a) * Math.max(0.6, dist);
      // Never inside the walls: keep within the tunnel's width (the Hall is wide).
      const half = tunnelR(z, x > pathX(z) ? 0 : Math.PI) * 1.15 - 0.7;
      const dx = x - pathX(z);
      if (Math.abs(dx) > half) x = pathX(z) + Math.sign(dx) * half;
      if (z < TUNNEL_START + 1) z = TUNNEL_START + 1;
      const bob = Math.sin(s.phase * 1.7) * 0.12;
      s.root.position.set(x, floorAt(x, z) + 0.1 + bob, z);
      s.root.rotation.y = Math.atan2(app.x - x, app.z - z);
      s.root.rotation.z = Math.sin(s.phase * 1.1) * 0.06;
      // Squashed back on a flare, leaning in on a stumble.
      const sq = 1 - this.recoil * 0.25 + this.lunge * 0.08;
      s.root.scale.y = (0.8 + (k % 3) * 0.12) * sq;
      s.root.rotation.x = this.lunge * 0.25 - this.recoil * 0.3;
      // Slow, sleepy blinks.
      s.blink -= dt;
      if (s.blink < -0.14) s.blink = 2 + ((k * 1.7 + s.phase) % 4);
      s.eyes.scale.y = s.blink < 0 ? 0.1 : 1;
    }
    this.eyeMat.opacity = 0.85 * this.shadeFade * (0.75 + 0.25 * (1 - this.shownLight));
  }

  frame(dt: number): void {
    const { typing } = this.ctx;
    const app = this.apprentice.root.position;
    this.dyo.face(app.x, app.z + 6);
    const yaw = this.yaw;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);

    // The word: on a banner ahead of the apprentice, high enough (T34) that it never hides his
    // head and lantern from the camera behind him.
    const a = this.text.anchor;
    a.set(app.x + fx * 3.3, app.y + 2.95, app.z + fz * 3.3);
    if (typing.letters !== this.shownLetters) {
      this.shownLetters = typing.letters;
      const n = typing.letters.length;
      const end = n > 0 && typing.letters[n - 1] === ' ' ? n - 1 : n;
      this.text.setWord(
        this.finished ? [] : typing.letters.slice(0, end),
        /[֐-׿]/.test(typing.word),
      );
    }
    this.text.root.visible = !this.finished;
    this.text.frame(dt, typing.states);

    // The words ahead: written on a chalk tablet down the tunnel, as far as the light reaches.
    const plan = this.plan;
    const key = this.finished || !plan ? -2 : this.wordsDone;
    const n = this.aheadCount();
    if (key !== this.aheadKey || n !== this.aheadN) {
      this.aheadKey = key;
      this.aheadN = n;
      const words = plan && key >= 0 ? wordsAhead(plan, key, this.lantern.light) : [];
      const line = words.join(' ');
      this.ahead.setWord([...line].slice(0, AHEAD_CAP), /[֐-׿]/.test(line));
      this.ahead.root.visible = words.length > 0;
    }
    const dist = 8 + 4 * this.shownLight;
    const tz = this.leadZ + dist;
    const tx = pathX(tz) + 2.1;
    this.tablet.position.set(tx, floorAt(tx, tz), tz);
    this.tablet.rotation.y = pathYaw(tz) - 0.25;
    this.tablet.visible = !this.finished && n > 0;
    this.ahead.anchor.set(tx, this.tablet.position.y + 2.15, tz);
    if (this.finished) this.ahead.root.visible = false;
    this.ahead.frame(dt, this.aheadStates);
    this.feedback.frame(dt);

    // Dust drifting in the lantern's light.
    const c = this.lanternRoot.position;
    const pos = this.dust.geometry.getAttribute('position') as BufferAttribute;
    const arr = pos.array as Float32Array;
    const t = this.time;
    for (let i = 0; i < DUST; i++) {
      const o = i * 3;
      const bx = (this.dustBase[o] as number) + Math.sin(t * 0.3 + i) * 0.4;
      const by = (this.dustBase[o + 1] as number) - t * 0.08;
      const bz = (this.dustBase[o + 2] as number) + Math.cos(t * 0.23 + i * 1.3) * 0.4;
      arr[o] = c.x + (((bx % DUST_BOX) + DUST_BOX) % DUST_BOX) - DUST_BOX / 2;
      arr[o + 1] = c.y - 1.5 + (((by % (DUST_BOX * 0.5)) + DUST_BOX * 0.5) % (DUST_BOX * 0.5));
      arr[o + 2] = c.z + (((bz % DUST_BOX) + DUST_BOX) % DUST_BOX) - DUST_BOX / 2;
    }
    pos.needsUpdate = true;
    this.dustMat.opacity = 0.08 + this.shownLight * 0.3;
  }

  private aheadCount(): number {
    return this.plan && !this.finished ? lookaheadAt(this.lantern.light, this.plan.level) : 0;
  }

  dispose(): void {
    this.air?.stop();
    this.air = null;
    if (this.ctx) {
      this.ctx.atmosphere.groundAt = () => 0;
      this.ctx.rig.groundAt = () => -Infinity;
    }
    this.apprentice?.dispose();
    this.dyo?.dispose();
    this.text?.dispose();
    this.ahead?.dispose();
    this.feedback?.dispose();
    this.shownLetters = null;
    this.onMoment = null;
    this.onOut = null;
    this.plan = null;
    this.hallLights = [];
  }
}
