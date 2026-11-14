// The Long Midbar (T24): the eighth region of Act Two.
//
// Far to the south the old caravan road crosses the Midbar to the oasis of the scribes. The
// Fading has greyed the sand and stirred up the storms. The apprentice leads a little caravan of
// three camels (Dyo rides on the first one's hump) from well to
// well along a road of stone markers.
//
// Every stage of the road is two sentences. In the first the sky is clear: every right letter is
// a step of the caravan, and the next words stand carved on a marker stone ahead of it. In the
// second a sandstorm rolls in from the side: the air turns to blowing sand, the sight closes in,
// the marker stone with the next words goes into the sand (on Standard and Hard only the word in
// hand can be read), and every word brings a gust, a wall of sand rolling in over the dunes.
// Finishing the word walks the caravan through it, and the wall falls apart into gold dust. When
// the storm sentence is done the storm blows itself out at a well: the camels drink and the color
// comes back around it. The last stage ends at the oasis: the palms turn green, the pool shines,
// the camels kneel to drink and the sky clears into a golden evening.
//
// On Calm a gust rolls in a little way and waits. On the other difficulties a gust that reaches
// the caravan buffets it (the streak drops; the screen is told through `onBuffet`): the camels
// kneel for a moment, and the gust rolls back to come again, slower. The typing is judged by the
// host (PlayController); this scene only reacts, and learns the shape of the run from `begin`.

import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  DodecahedronGeometry,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  type MeshLambertMaterial,
  Object3D,
  PlaneGeometry,
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
import { CLEAR, FADED, STORM, TINT } from './palette';
import {
  colorShare,
  Gust,
  March,
  marchAim,
  sightAt,
  stageChars,
  steadyPercent,
  wellsReached,
  wordsAhead,
  type ChapterId,
  type Leg,
  type MidbarPlan,
} from './plan';

export interface MidbarSetup {
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
export type MidbarEvent = 'storm' | 'gust' | 'buffet' | 'steady' | 'well';

/** The most stages a run can have (the last one always ends at the oasis). */
const MAX_STAGES = 5;
/** Length of one stage of the road. */
const STAGE_LEN = 44;
/** Where the camels walk behind the apprentice, and how far apart. */
const CAMEL_GAP = 3.4;
const CAMEL_FIRST = 2.8;
const CAMELS = 3;
/** Where a gust rises (to the side of the road) and where it reaches the caravan. */
const GUST_FAR = 36;
const GUST_NEAR = 2.2;
/** Seconds after a storm sentence begins before its first gust comes on its own. */
const STORM_GRACE = 3;
/** Seconds the camels kneel when a gust buffets them. */
const KNEEL_S = 1.3;
const LETTER_SIZE = 0.6;
const AHEAD_SIZE = 0.62;
const AHEAD_CAP = 48;
/** Sand blowing through the air, in a box that rides with the camera. */
const SAND = 1600;
const SAND_W = 56;
const SAND_H = 14;
/** Marker cairns along the road, palms at the oasis. */
const MARKER_STEP = 7.5;
const MARKERS = Math.ceil((STAGE_LEN * MAX_STAGES + 30) / MARKER_STEP);
const OASIS_PALMS = 9;
/** The pool lies this far past the end of the road. */
const POOL_AHEAD = 9;
const POOL_R = 5.2;
/** The camera looks at the caravan from behind and a little to the side. */
const CAM_YAW = -0.42;

/** The road's line across the desert: x for a given z. */
export function roadX(z: number): number {
  return Math.sin(z * 0.021) * 7 + Math.sin(z * 0.0083 + 1) * 4 - 3.4;
}

/** The road's heading (yaw) at z. */
function roadYaw(z: number): number {
  const dx = roadX(z + 0.5) - roadX(z - 0.5);
  return Math.atan2(dx, 1);
}

/** The height of the sand: dunes everywhere, flat along the road and around the oasis basins. */
export function dunes(x: number, z: number): number {
  const d = Math.abs(x - roadX(z));
  let h =
    2.2 * Math.sin(x * 0.045 + z * 0.012) +
    1.6 * Math.sin(z * 0.05 - x * 0.02 + 1.3) +
    0.6 * Math.sin(x * 0.13 + z * 0.07);
  // Wind-cut crests.
  h += Math.abs(Math.sin(x * 0.03 - z * 0.025)) * 3.2 - 1.4;
  h *= smoothstep(4.5, 15, d);
  // Big dunes far off on either side.
  h += smoothstep(26, 80, d) * (7 + 5 * Math.sin(z * 0.02 + x * 0.013));
  // Small ripples on the road itself.
  return h + Math.sin(x * 1.3 + z * 0.4) * 0.03;
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

/** One camel: a body that sways, a head that nods, four legs that pace (same side together). */
interface Camel {
  readonly root: Group;
  readonly body: Group;
  readonly head: Group;
  readonly legs: Group[];
  phase: number;
  kneel: number;
  drink: number;
  /** Where it walks along the road (z) and how fast. */
  z: number;
  speed: number;
}

/** A well beside the road at the end of a stage. */
interface Well {
  readonly root: Group;
  readonly water: MeshLambertMaterial;
  readonly bucket: Mesh;
  readonly palm: Group;
  shine: number;
}

export class MidbarScene implements GameScene {
  readonly id = 'midbar';
  /** Told when something worth a line happens. */
  onMoment: ((moment: MidbarEvent) => void) | null = null;
  /** Told when a gust buffets the caravan (only on difficulties with timers). */
  onBuffet: (() => void) | null = null;

  private ctx!: SceneContext;
  private readonly rng = new Rng(2424);
  private plan: MidbarPlan | null = null;
  private apprentice!: Character;
  private dyo!: Dyo;
  private text!: WorldText;
  private ahead!: WorldText;
  private aheadPost!: Mesh;
  private readonly aheadStates: WorldLetterState[] = [];
  private aheadKey = -1;
  private feedback!: TypingFeedback;
  private shownLetters: readonly string[] | null = null;
  private wind: AmbienceHandle | null = null;
  private sandLoop: AmbienceHandle | null = null;

  // The caravan.
  private readonly camels: Camel[] = [];
  private camelMat!: MeshLambertMaterial;
  private rope!: LineSegments;
  private readonly march = new March();
  private baseZ = 0;
  private endZ = STAGE_LEN;
  private leadZ = 0;
  private leadSpeed = 0;
  private typedInStage = 0;
  private kneelT = 0;
  private readonly eye = new Object3D();
  private yaw = 0;

  // The road, the wells and the oasis.
  private markers!: InstancedMesh;
  private readonly wellList: Well[] = [];
  private readonly palms: Group[] = [];
  private oasis!: Group;
  private poolMat!: MeshLambertMaterial;
  private fire!: PointLight;

  // The storm.
  private readonly gust = new Gust();
  private shownGust = 1;
  private wall!: Group;
  private wallMats: MeshBasicMaterial[] = [];
  private wallFade = 0;
  private wallBreak = 0;
  private storm = 0;
  private sand!: Points;
  private sandMat!: PointsMaterial;
  private readonly sandBase = new Float32Array(SAND * 3);
  private dustT = 0;
  private hitThis = false;

  // The sky.
  private readonly palette: ScenePalette = {
    ...FADED.light,
    sunFrom: [0, 1, 0],
    fade: 0,
    ink: 0,
  };
  private readonly ca = new Color();
  private readonly cb = new Color();
  private lastClear = -1;
  private lastStorm = -1;
  private clearShown = 0;

  // The run.
  private wordsDone = 0;
  private buffets = 0;
  private steady = 0;
  private gustsDone = 0;
  private leg = 0;
  private chapter: ChapterId | 'finale' = 'dunes';
  private finished = false;
  private heardTier = 0;
  private time = 0;
  private legT = 0;
  private finaleT = -1;
  private saidStorm = false;
  private saidGust = false;
  private saidBuffet = false;
  private saidSteady = false;

  private gold = 0;
  private techelet = 0;
  private paper = 0;
  private inkDark = 0;
  private puff!: BurstStyle;
  private dust!: BurstStyle;
  private goldDust!: BurstStyle;
  private sparks!: BurstStyle;
  private splash!: BurstStyle;
  private fountain!: BurstStyle;

  private readonly v = new Vector3();
  private readonly w = new Vector3();
  private readonly u = new Vector3();
  private readonly m4 = new Matrix4();
  private readonly q = new Quaternion();
  private readonly s = new Vector3();
  private readonly up = new Vector3(0, 1, 0);

  constructor(private readonly setup: MidbarSetup) {}

  // ---- probes (the screen and the smoke test read these) -------------------------------------

  /** Where the current gust is (1 = far off, 0 = at the caravan); 1 on a clear sentence. */
  get gustDistance(): number {
    return this.legKind === 'storm' ? this.gust.distance : 1;
  }

  /** Gusts that buffeted the caravan, over the whole run. */
  get buffetsTotal(): number {
    return this.buffets;
  }

  /** Gusts walked through before they ever buffeted the caravan. */
  get gustsSteady(): number {
    return this.steady;
  }

  /** Gusts walked through cleanly, as a percent of the gusts passed so far. */
  get steadyShare(): number {
    return steadyPercent(this.steady, this.gustsDone);
  }

  /** How thick the storm is now (0 clear .. 1 thickest). */
  get stormNow(): number {
    return this.storm;
  }

  /** How far one can see now. */
  get sight(): number {
    return sightAt(this.storm);
  }

  /** Wells reached (the oasis counts as the last). */
  get wells(): number {
    return this.plan ? wellsReached(this.plan, this.wordsDone) : 0;
  }

  /** The kind of sentence being typed now. */
  get legKind(): 'trek' | 'storm' | 'done' {
    if (this.finished || !this.plan) return 'done';
    return this.plan.legs[this.leg]?.kind ?? 'done';
  }

  /** 0..1 along the current stage. */
  get marchAt(): number {
    return this.march.at;
  }

  /** Distance walked from the start of the road. */
  get travelled(): number {
    return this.leadZ;
  }

  get restored(): boolean {
    return this.finished;
  }

  /** The chapter the run is in. */
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

    ctx.audio.music('midbar');
    ctx.audio.intensity(0);
    this.wind = ctx.audio.ambience('wind');

    this.palette.fade = ctx.color('fade');
    this.palette.ink = this.gold;
    this.lastClear = -1;
    this.applySky(0, 0);
    ctx.atmosphere.groundAt = dunes;
    ctx.atmosphere.setShadowRange(26);
    ctx.rig.groundAt = dunes;
    ctx.post.setGrade(
      ctx.theme === 'dark'
        ? { exposure: 1.2, saturation: 1.08, vignette: 0.5, godRays: 0.85, bloom: 1.2 }
        : { exposure: 1.06, saturation: 1.1, vignette: 0.38, godRays: 0.85, bloom: 1.1 },
    );

    this.puff = burstStyle({
      count: 5,
      color: TINT.sandAir,
      color2: TINT.sandCrest,
      intensity: 0.9,
      speed: [0.6, 1.6],
      spread: 0.7,
      life: [0.4, 0.9],
      size: [0.08, 0.18],
      gravity: 0.6,
    });
    this.dust = burstStyle({
      count: 34,
      color: TINT.sandAir,
      color2: TINT.sandDeep,
      intensity: 0.9,
      speed: [2, 6],
      spread: 0.8,
      life: [0.8, 1.6],
      size: [0.2, 0.5],
      gravity: 0.4,
      radius: 1.6,
    });
    this.goldDust = burstStyle({
      count: 70,
      color: TINT.goldDust,
      color2: TINT.gold,
      intensity: 2.6,
      speed: [1, 5],
      spread: 1,
      life: [1.2, 2.4],
      size: [0.06, 0.16],
      gravity: -0.3,
      radius: 2.4,
    });
    this.sparks = burstStyle({
      count: 12,
      color: TINT.gold,
      color2: TINT.goldDust,
      intensity: 2.2,
      speed: [1.5, 4],
      spread: 1,
      life: [0.3, 0.6],
      size: [0.04, 0.09],
      gravity: 1,
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
      color2: TINT.waterShine,
      intensity: 3,
      speed: [3, 9],
      spread: 0.7,
      life: [1.2, 2.4],
      size: [0.08, 0.2],
      gravity: 2.5,
    });

    this.buildLand();
    this.buildRoad();
    this.buildWells();
    this.buildOasis();
    this.buildCaravan();
    this.buildStorm();

    // The word to type: on a parchment banner ahead of the apprentice. The words after it stand
    // carved on a marker stone farther down the road, while the air is clear enough to read them.
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
      materials: kit,
      billboard: ctx.vfx.billboard,
      colors,
      style: 'banner',
      size: LETTER_SIZE,
    });
    root.add(this.text.root);
    this.ahead = new WorldText({
      atlas: ctx.engine.atlas,
      materials: kit,
      billboard: ctx.vfx.billboard,
      colors,
      style: 'carved',
      size: AHEAD_SIZE,
      capacity: AHEAD_CAP,
    });
    for (let i = 0; i < AHEAD_CAP; i++) this.aheadStates.push('todo');
    root.add(this.ahead.root);
    this.feedback = new TypingFeedback(ctx, {
      gold: this.gold,
      ink: this.inkDark,
      techelet: this.techelet,
    });

    this.place();
  }

  /** The camera of a run: behind the caravan and a little to its side. */
  private follow(): void {
    this.ctx.rig.follow(this.eye, {
      distance: 13,
      height: 5.6,
      lookHeight: 1.9,
      turnWith: 1,
      stiffness: 2.2,
    });
  }

  /**
   * Blends the sky from faded (0) to clear (1), then lays the storm over it (0..1). Cheap: only
   * when either changed.
   */
  private applySky(k: number, st: number): void {
    if (Math.abs(k - this.lastClear) < 0.004 && Math.abs(st - this.lastStorm) < 0.004) return;
    this.lastClear = k;
    this.lastStorm = st;
    const a = FADED[this.ctx.theme];
    const b = CLEAR[this.ctx.theme];
    const c = STORM[this.ctx.theme];
    const p = this.palette;
    // The storm closes in fast at first, then slowly (like the sight).
    const s = 1 - (1 - st) * (1 - st);
    const mix = (x: number, y: number, z: number): number =>
      this.ca.setHex(x).lerp(this.cb.setHex(y), k).lerp(this.cb.setHex(z), s).getHex();
    const num = (x: number, y: number, z: number): number => {
      const ab = x + (y - x) * k;
      return ab + (z - ab) * s;
    };
    p.skyTop = mix(a.skyTop, b.skyTop, c.skyTop);
    p.skyHorizon = mix(a.skyHorizon, b.skyHorizon, c.skyHorizon);
    p.sun = mix(a.sun, b.sun, c.sun);
    p.sunIntensity = num(a.sunIntensity, b.sunIntensity, c.sunIntensity);
    const sf = p.sunFrom as [number, number, number];
    sf[0] = a.sunFrom[0] + (b.sunFrom[0] - a.sunFrom[0]) * k;
    sf[1] = a.sunFrom[1] + (b.sunFrom[1] - a.sunFrom[1]) * k;
    sf[2] = a.sunFrom[2] + (b.sunFrom[2] - a.sunFrom[2]) * k;
    p.fillSky = mix(a.fillSky, b.fillSky, c.fillSky);
    p.fillGround = mix(a.fillGround, b.fillGround, c.fillGround);
    p.fillIntensity = num(a.fillIntensity, b.fillIntensity, c.fillIntensity);
    p.fog = mix(a.fog, b.fog, c.fog);
    // Fog density follows the sight: thick sand, short sight.
    const clearDensity = a.fogDensity + (b.fogDensity - a.fogDensity) * k;
    p.fogDensity = clearDensity + (c.fogDensity - clearDensity) * s;
    p.fogBase = a.fogBase;
    p.fogFalloff = a.fogFalloff + (c.fogFalloff - a.fogFalloff) * s;
    p.inscatter = num(a.inscatter, b.inscatter, c.inscatter);
    this.ctx.atmosphere.setPalette(p);
  }

  /** The dunes: one sheet of sand, colored by crest and hollow, with the road worn into it. */
  private buildLand(): void {
    const { materials: kit, tracker, root } = this.ctx;
    const r = this.rng;
    const land = new PlaneGeometry(300, 400, 120, 160).rotateX(-Math.PI / 2).translate(0, 0, 150);
    const pos = land.getAttribute('position');
    const colors = new Float32Array(pos.count * 3);
    const a = new Color();
    const b = new Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = dunes(x, z);
      pos.setY(i, h);
      // Crests catch the light, hollows are deeper and redder; the slope from the neighbours.
      const slope = Math.abs(dunes(x + 0.8, z) - h) + Math.abs(dunes(x, z + 0.8) - h);
      a.setHex(TINT.sand).lerp(b.setHex(TINT.sandDeep), smoothstep(0, -2.5, h) * 0.7);
      a.lerp(
        b.setHex(TINT.sandCrest),
        smoothstep(2, 7, h) * 0.6 + smoothstep(0.6, 1.4, slope) * 0.3,
      );
      a.lerp(b.setHex(TINT.sandDeep), r.next() * 0.12);
      // The road: a trodden band of darker sand.
      const d = Math.abs(x - roadX(z));
      a.lerp(b.setHex(TINT.road), (1 - smoothstep(1.2, 3.2, d + r.signed() * 0.5)) * 0.75);
      colors[i * 3] = a.r;
      colors[i * 3 + 1] = a.g;
      colors[i * 3 + 2] = a.b;
    }
    land.setAttribute('color', new BufferAttribute(colors, 3));
    land.computeVertexNormals();
    const mesh = new Mesh(tracker.track(land), tracker.track(kit.surface({ vertexColors: true })));
    mesh.receiveShadow = true;
    root.add(mesh);

    // Rocks: red sandstone outcrops scattered over the dunes (one draw call).
    const rockGeo = tracker.track(
      merged([
        painted(new DodecahedronGeometry(1, 0).scale(1.4, 0.9, 1.1), TINT.rock),
        painted(new DodecahedronGeometry(0.7, 0).translate(1.2, -0.2, 0.4), TINT.rockDark),
      ]),
    );
    const rocks = new InstancedMesh(
      rockGeo,
      tracker.track(kit.surface({ vertexColors: true })),
      40,
    );
    for (let k = 0; k < 40; k++) {
      const z = r.range(-20, 330);
      const side = r.next() < 0.5 ? -1 : 1;
      const x = roadX(z) + side * r.range(7, 60);
      const sz = r.range(0.6, 2.2);
      this.v.set(x, dunes(x, z) - 0.3 * sz, z);
      this.q.setFromAxisAngle(this.up, r.range(0, Math.PI * 2));
      this.s.set(sz, sz * r.range(0.7, 1.3), sz);
      rocks.setMatrixAt(k, this.m4.compose(this.v, this.q, this.s));
    }
    rocks.instanceMatrix.needsUpdate = true;
    kit.caster(rocks, false);
    rocks.receiveShadow = true;
    root.add(rocks);
  }

  /** Stone cairns along the road (one draw call), and the marker post for the words ahead. */
  private buildRoad(): void {
    const { materials: kit, tracker, root } = this.ctx;
    const r = this.rng;
    const cairn = tracker.track(
      merged([
        painted(
          new DodecahedronGeometry(0.42, 0).scale(1.2, 0.7, 1).translate(0, 0.25, 0),
          TINT.stone,
        ),
        painted(
          new DodecahedronGeometry(0.32, 0).scale(1, 0.75, 1).translate(0.05, 0.68, 0),
          TINT.stoneDark,
        ),
        painted(new DodecahedronGeometry(0.22, 0).translate(-0.02, 1.0, 0.03), TINT.stone),
      ]),
    );
    this.markers = new InstancedMesh(
      cairn,
      tracker.track(kit.surface({ vertexColors: true })),
      MARKERS,
    );
    for (let k = 0; k < MARKERS; k++) {
      const z = 6 + k * MARKER_STEP;
      const side = k % 2 === 0 ? -1 : 1;
      const x = roadX(z) + side * r.range(2.6, 3.2);
      this.v.set(x, dunes(x, z) - 0.05, z);
      this.q.setFromAxisAngle(this.up, r.range(0, Math.PI * 2));
      const sz = r.range(0.85, 1.2);
      this.s.set(sz, sz, sz);
      this.markers.setMatrixAt(k, this.m4.compose(this.v, this.q, this.s));
    }
    this.markers.instanceMatrix.needsUpdate = true;
    kit.caster(this.markers, true);
    root.add(this.markers);

    // The marker stone that carries the words ahead: a tall standing stone with a capstone.
    this.aheadPost = new Mesh(
      tracker.track(
        merged([
          painted(new BoxGeometry(0.5, 2.2, 0.36).translate(0, 1.1, 0), TINT.stone),
          painted(new BoxGeometry(0.7, 0.18, 0.5).translate(0, 2.25, 0), TINT.stoneDark),
          painted(
            new DodecahedronGeometry(0.5, 0).scale(1.3, 0.5, 1).translate(0, 0.1, 0),
            TINT.stoneDark,
          ),
        ]),
      ),
      tracker.track(kit.surface({ vertexColors: true })),
    );
    kit.caster(this.aheadPost, true);
    root.add(this.aheadPost);
  }

  /** A date palm: a ringed, gently bent trunk and a crown of drooping fronds with dates. */
  private palmGeometry(): BufferGeometry {
    const parts: BufferGeometry[] = [];
    const segs = 7;
    for (let i = 0; i < segs; i++) {
      const y = i * 0.72;
      const bend = (i / segs) ** 2 * 0.7;
      parts.push(
        painted(
          new CylinderGeometry(0.2 - i * 0.012, 0.25 - i * 0.012, 0.74, 7).translate(
            bend,
            y + 0.37,
            0,
          ),
          i % 2 === 0 ? TINT.trunk : TINT.trunkDark,
        ),
      );
    }
    const top = new Vector3(0.7, segs * 0.72, 0);
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2;
      const len = 2.4 + (k % 3) * 0.3;
      // A tapered leaf, flat, from the crown outward; the tip droops, then it turns around.
      const frond = new ConeGeometry(0.3, len, 4)
        .rotateX(Math.PI / 2)
        .scale(1, 0.18, 1)
        .translate(0, 0, len / 2);
      frond.rotateX(0.45 + (k % 2) * 0.3);
      frond.rotateY(a);
      frond.translate(top.x, top.y, top.z);
      parts.push(painted(frond, k % 2 === 0 ? TINT.frond : TINT.frondLight));
    }
    parts.push(
      painted(
        new DodecahedronGeometry(0.28, 0).translate(top.x + 0.1, top.y - 0.35, 0.15),
        TINT.date,
      ),
      painted(
        new DodecahedronGeometry(0.22, 0).translate(top.x - 0.2, top.y - 0.3, -0.12),
        TINT.date,
      ),
    );
    return merged(parts);
  }

  /** Wells beside the road (one for every stage but the last), each with a palm and water. */
  private buildWells(): void {
    const { materials: kit, tracker, root } = this.ctx;
    const stoneMat = tracker.track(kit.surface({ vertexColors: true }));
    const wellGeo = tracker.track(
      merged([
        painted(
          new CylinderGeometry(1.25, 1.35, 0.8, 14, 1, true).translate(0, 0.4, 0),
          TINT.wellStone,
        ),
        painted(
          new TorusGeometry(1.28, 0.18, 6, 16).rotateX(Math.PI / 2).translate(0, 0.82, 0),
          TINT.wellDark,
        ),
        painted(new CylinderGeometry(0.1, 0.12, 2.4, 6).translate(-1.15, 1.2, 0), TINT.wood),
        painted(new CylinderGeometry(0.1, 0.12, 2.4, 6).translate(1.15, 1.2, 0), TINT.wood),
        painted(
          new CylinderGeometry(0.08, 0.08, 2.6, 6).rotateZ(Math.PI / 2).translate(0, 2.3, 0),
          TINT.wood,
        ),
        painted(new CylinderGeometry(0.02, 0.02, 1.2, 4).translate(0.2, 1.7, 0), TINT.stoneDark),
      ]),
    );
    const bucketGeo = tracker.track(
      merged([
        painted(new CylinderGeometry(0.2, 0.16, 0.3, 8), TINT.wood),
        painted(
          new TorusGeometry(0.2, 0.025, 4, 10).rotateX(Math.PI / 2).translate(0, 0.15, 0),
          TINT.brass,
        ),
      ]),
    );
    const palmGeo = tracker.track(this.palmGeometry());
    const palmMat = tracker.track(kit.surface({ vertexColors: true }));
    const waterGeo = tracker.track(new CircleGeometry(1.15, 16).rotateX(-Math.PI / 2));
    for (let k = 0; k < MAX_STAGES - 1; k++) {
      const g = new Group();
      const well = new Mesh(wellGeo, stoneMat);
      kit.caster(well, true);
      well.receiveShadow = true;
      g.add(well);
      const water = tracker.track(
        kit.surface({ color: TINT.waterDeep, emissive: TINT.water, emissiveIntensity: 0.1 }),
      );
      const disc = new Mesh(waterGeo, water);
      disc.position.y = 0.55;
      g.add(disc);
      const bucket = new Mesh(bucketGeo, stoneMat);
      bucket.position.set(0.2, 1.0, 0);
      g.add(bucket);
      const palm = new Group();
      const trunk = new Mesh(palmGeo, palmMat);
      kit.caster(trunk, true);
      palm.add(trunk);
      palm.position.set(2.6, 0, 1.2);
      palm.scale.setScalar(0.85);
      g.add(palm);
      root.add(g);
      this.wellList.push({ root: g, water, bucket, palm, shine: 0 });
    }
    this.palmGeo = palmGeo;
    this.palmMat = palmMat;
  }

  private palmGeo!: BufferGeometry;
  private palmMat!: MeshLambertMaterial;

  /** The oasis at the end of the road: a pool ringed with reeds, date palms and two tents. */
  private buildOasis(): void {
    const { materials: kit, tracker, root } = this.ctx;
    const r = this.rng;
    const g = new Group();
    this.oasis = g;
    this.poolMat = tracker.track(
      kit.surface({ color: TINT.waterDeep, emissive: TINT.water, emissiveIntensity: 0.15 }),
    );
    const pool = new Mesh(
      tracker.track(new CircleGeometry(POOL_R, 40).rotateX(-Math.PI / 2)),
      this.poolMat,
    );
    pool.position.y = 0.08;
    pool.receiveShadow = true;
    g.add(pool);
    const bank = new Mesh(
      tracker.track(
        painted(
          new RingGeometry(POOL_R - 0.1, POOL_R + 1.4, 40, 1).rotateX(-Math.PI / 2),
          TINT.sandDeep,
        ),
      ),
      tracker.track(kit.surface({ vertexColors: true })),
    );
    bank.position.y = 0.06;
    bank.receiveShadow = true;
    g.add(bank);
    // Reeds around the water (one mesh).
    const reeds: BufferGeometry[] = [];
    for (let k = 0; k < 46; k++) {
      const a = r.range(0, Math.PI * 2);
      const rad = POOL_R + r.range(-0.2, 0.9);
      const hgt = r.range(0.6, 1.5);
      reeds.push(
        painted(
          new ConeGeometry(0.06, hgt, 3)
            .translate(0, hgt / 2, 0)
            .rotateZ(r.signed() * 0.2)
            .translate(Math.cos(a) * rad, 0, Math.sin(a) * rad),
          k % 3 === 0 ? TINT.frondLight : TINT.reed,
        ),
      );
    }
    g.add(
      new Mesh(tracker.track(merged(reeds)), tracker.track(kit.surface({ vertexColors: true }))),
    );
    // Two striped tents of the scribes' camp (one mesh).
    const tents: BufferGeometry[] = [];
    for (const [x, z, rot] of [
      [-POOL_R - 5, 2.5, 0.4],
      [POOL_R + 5.5, 4, -0.5],
    ] as const) {
      const body = new CylinderGeometry(0.01, 2.4, 2.6, 6).translate(0, 1.3, 0);
      body.rotateY(rot).translate(x, 0, z);
      tents.push(painted(body, TINT.tent));
      const stripe = new CylinderGeometry(1.25, 1.6, 0.4, 6).translate(0, 1.0, 0);
      stripe.rotateY(rot).translate(x, 0, z);
      tents.push(painted(stripe, TINT.tentStripe));
      tents.push(painted(new CylinderGeometry(0.05, 0.05, 3.2, 4).translate(x, 1.6, z), TINT.wood));
    }
    const tentMesh = new Mesh(
      tracker.track(merged(tents)),
      tracker.track(kit.surface({ vertexColors: true })),
    );
    kit.caster(tentMesh, true);
    g.add(tentMesh);
    // Date palms around the water.
    for (let k = 0; k < OASIS_PALMS; k++) {
      const a = (k / OASIS_PALMS) * Math.PI * 2 + r.signed() * 0.25;
      const rad = POOL_R + r.range(1.8, 4.5);
      const palm = new Group();
      const m = new Mesh(this.palmGeo, this.palmMat);
      kit.caster(m, k % 2 === 0);
      palm.add(m);
      palm.position.set(Math.cos(a) * rad, 0, Math.sin(a) * rad);
      palm.rotation.y = r.range(0, Math.PI * 2);
      palm.scale.setScalar(r.range(0.9, 1.25));
      g.add(palm);
      this.palms.push(palm);
    }
    // A small fire by the tents (it shows best at dusk).
    this.fire = new PointLight(0xffa050, 0, 14, 1.6);
    this.fire.position.set(-POOL_R - 3, 0.8, 0);
    g.add(this.fire);
    root.add(g);
  }

  /** One camel, built of simple shapes, with a saddle rug in its own color. */
  private camel(rug: number, legGeo: BufferGeometry, seed: number): Camel {
    const { materials: kit, tracker } = this.ctx;
    const mat = this.camelMat;
    const root = new Group();
    const body = new Group();
    root.add(body);
    const torso = new Mesh(
      tracker.track(
        merged([
          painted(
            new SphereGeometry(1, 12, 8).scale(0.56, 0.58, 1.05).translate(0, 1.8, 0),
            TINT.camel,
          ),
          painted(
            new SphereGeometry(1, 10, 6).scale(0.46, 0.2, 0.86).translate(0, 1.42, 0),
            TINT.camelBelly,
          ),
          painted(
            new SphereGeometry(1, 10, 8).scale(0.42, 0.48, 0.5).translate(0, 2.3, -0.05),
            TINT.camel,
          ),
          // The neck, rising forward from the chest.
          painted(
            new CylinderGeometry(0.17, 0.26, 1.25, 8).rotateX(0.75).translate(0, 2.2, 1.18),
            TINT.camel,
          ),
          // Saddle rug over the hump, hanging down both sides, with a stripe and tassels.
          painted(
            new SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, 1.3)
              .scale(0.5, 0.5, 0.58)
              .translate(0, 2.28, -0.05),
            rug,
          ),
          painted(new BoxGeometry(1.18, 0.62, 0.95).translate(0, 1.92, -0.05), rug),
          painted(new BoxGeometry(1.2, 0.08, 0.97).translate(0, 1.66, -0.05), TINT.rugStripe),
          painted(new BoxGeometry(0.12, 0.2, 0.12).translate(-0.6, 1.52, 0.35), TINT.rugSaffron),
          painted(new BoxGeometry(0.12, 0.2, 0.12).translate(0.6, 1.52, 0.35), TINT.rugSaffron),
          painted(new BoxGeometry(0.12, 0.2, 0.12).translate(-0.6, 1.52, -0.45), TINT.rugSaffron),
          painted(new BoxGeometry(0.12, 0.2, 0.12).translate(0.6, 1.52, -0.45), TINT.rugSaffron),
          // Saddlebags.
          painted(new BoxGeometry(0.28, 0.5, 0.6).translate(-0.72, 1.85, -0.5), TINT.bag),
          painted(new BoxGeometry(0.28, 0.5, 0.6).translate(0.72, 1.85, -0.5), TINT.bag),
          // The tail.
          painted(
            new CylinderGeometry(0.05, 0.03, 0.7, 5).rotateX(-0.3).translate(0, 1.6, -1.15),
            TINT.camelDark,
          ),
        ]),
      ),
      mat,
    );
    kit.caster(torso, true);
    body.add(torso);
    const head = new Group();
    head.position.set(0, 2.72, 1.62);
    const headMesh = new Mesh(
      tracker.track(
        merged([
          painted(new BoxGeometry(0.3, 0.3, 0.42).translate(0, 0, 0.08), TINT.camel),
          painted(new BoxGeometry(0.24, 0.22, 0.34).translate(0, -0.06, 0.4), TINT.camelBelly),
          painted(new BoxGeometry(0.06, 0.12, 0.06).translate(-0.12, 0.2, -0.06), TINT.camelDark),
          painted(new BoxGeometry(0.06, 0.12, 0.06).translate(0.12, 0.2, -0.06), TINT.camelDark),
          painted(new BoxGeometry(0.05, 0.05, 0.05).translate(-0.155, 0.06, 0.16), TINT.hoof),
          painted(new BoxGeometry(0.05, 0.05, 0.05).translate(0.155, 0.06, 0.16), TINT.hoof),
          // A brass bell under the chin, and a red halter.
          painted(new ConeGeometry(0.1, 0.18, 6).translate(0, -0.36, 0.0), TINT.brass),
          painted(
            new TorusGeometry(0.19, 0.03, 4, 10).rotateY(Math.PI / 2).translate(0, -0.04, 0.32),
            TINT.rugRed,
          ),
        ]),
      ),
      mat,
    );
    kit.caster(headMesh, false);
    head.add(headMesh);
    body.add(head);
    const legs: Group[] = [];
    for (const [x, z] of [
      [-0.3, 0.62],
      [0.3, 0.62],
      [-0.3, -0.66],
      [0.3, -0.66],
    ] as const) {
      const hip = new Group();
      hip.position.set(x, 1.58, z);
      const leg = new Mesh(legGeo, mat);
      kit.caster(leg, false);
      hip.add(leg);
      body.add(hip);
      legs.push(hip);
    }
    this.ctx.root.add(root);
    return { root, body, head, legs, phase: seed, kneel: 0, drink: 0, z: 0, speed: 0 };
  }

  /** The apprentice, three camels, Dyo on the first one, and the rope between them. */
  private buildCaravan(): void {
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
      seed: 5,
    });
    root.add(this.apprentice.root);

    this.camelMat = tracker.track(kit.surface({ vertexColors: true }));
    const legGeo = tracker.track(
      merged([
        painted(new CylinderGeometry(0.12, 0.09, 0.82, 6).translate(0, -0.4, 0), TINT.camel),
        painted(new SphereGeometry(0.1, 6, 4).translate(0, -0.82, 0), TINT.camelDark),
        painted(new CylinderGeometry(0.08, 0.065, 0.72, 6).translate(0, -1.18, 0), TINT.camel),
        painted(new CylinderGeometry(0.12, 0.13, 0.08, 7).translate(0, -1.55, 0.02), TINT.hoof),
      ]),
    );
    const rugs = [TINT.rugRed, TINT.rugIndigo, TINT.rugSaffron];
    for (let k = 0; k < CAMELS; k++) {
      this.camels.push(this.camel(rugs[k] as number, legGeo, k * 1.7));
    }

    this.dyo = new Dyo(kit, {
      body: TINT.dyo,
      shine: TINT.dyoShine,
      eye: TINT.dyoEye,
      pupil: TINT.ink,
    });
    this.dyo.root.scale.setScalar(0.45);
    root.add(this.dyo.root);

    // The lead rope: from the apprentice's hand to the first camel, and camel to camel.
    const ropeGeo = new BufferGeometry();
    ropeGeo.setAttribute('position', new Float32BufferAttribute(new Float32Array(CAMELS * 6), 3));
    this.rope = new LineSegments(
      tracker.track(ropeGeo),
      tracker.track(new LineBasicMaterial({ color: TINT.bag })),
    );
    this.rope.frustumCulled = false;
    root.add(this.rope);
    root.add(this.eye);
  }

  /** The sandstorm: sand blowing through the air, and the wall of sand each gust brings. */
  private buildStorm(): void {
    const { tracker, root } = this.ctx;
    const r = this.rng;
    // A wall of sand: three curved sheets, billowing, thick at the foot and thinning upward
    // into a ragged top and at the ends. Tinted like the storm's own air, so it reads as the
    // storm coming on (and does not glow) in either theme.
    this.wall = new Group();
    const air = STORM[this.ctx.theme].fog;
    for (let layer = 0; layer < 3; layer++) {
      const geo = new PlaneGeometry(40, 12, 28, 8);
      const pos = geo.getAttribute('position');
      const col = new Float32Array(pos.count * 4);
      const shade = 0.74 - layer * 0.1;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i) + 6;
        const edge = 1 - Math.abs(x) / 20;
        // A ragged top: billows of different heights along the wall.
        const top =
          12 * (0.55 + 0.25 * Math.sin(x * 0.37 + layer * 1.7) + 0.2 * Math.sin(x * 0.91 + 2));
        const billow =
          Math.sin(x * 0.45 + y * 0.35 + layer) * 0.9 + Math.sin(y * 0.8 + x * 0.2) * 0.5;
        // Bulging toward the caravan in the middle, the top rolling forward over the foot.
        const z = Math.cos((x / 20) * (Math.PI / 2)) * 3.5 + (y / 12) * 3 + billow - layer * 1.8;
        pos.setXYZ(i, x, y * (0.8 + layer * 0.15), z);
        col[i * 4] = shade;
        col[i * 4 + 1] = shade * 0.97;
        col[i * 4 + 2] = shade * 0.92;
        col[i * 4 + 3] = Math.pow(Math.max(0, 1 - y / top), 0.9) * Math.pow(Math.max(0, edge), 0.6);
      }
      geo.setAttribute('color', new BufferAttribute(col, 4));
      const mat = tracker.track(
        new MeshBasicMaterial({
          color: air,
          vertexColors: true,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          side: DoubleSide,
        }),
      );
      this.wallMats.push(mat);
      const sheet = new Mesh(tracker.track(geo), mat);
      sheet.renderOrder = 2;
      this.wall.add(sheet);
    }
    this.wall.visible = false;
    root.add(this.wall);

    // Blowing sand: points in a box that rides with the camera (wrapped as they blow past).
    for (let i = 0; i < SAND; i++) {
      this.sandBase[i * 3] = r.next() * SAND_W;
      this.sandBase[i * 3 + 1] = r.next() * SAND_H;
      this.sandBase[i * 3 + 2] = r.next() * SAND_W;
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(new Float32Array(SAND * 3), 3));
    this.sandMat = tracker.track(
      new PointsMaterial({
        color: STORM[this.ctx.theme].skyHorizon,
        size: 0.09,
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
      }),
    );
    this.sand = new Points(tracker.track(geo), this.sandMat);
    this.sand.frustumCulled = false;
    root.add(this.sand);
  }

  // ---- a run --------------------------------------------------------------------------------

  start(): void {
    this.reset();
  }

  /** Forgets everything: the grey desert, the caravan back at the start of the road. */
  private reset(): void {
    const { materials } = this.ctx;
    materials.clearSweeps();
    materials.restoreAll(0, 0);
    this.wordsDone = 0;
    this.buffets = 0;
    this.steady = 0;
    this.gustsDone = 0;
    this.leg = 0;
    this.typedInStage = 0;
    this.legT = 0;
    this.kneelT = 0;
    this.hitThis = false;
    this.finished = false;
    this.finaleT = -1;
    this.heardTier = 0;
    this.shownLetters = null;
    this.aheadKey = -1;
    this.gust.reset();
    this.march.reset();
    this.baseZ = 0;
    this.endZ = STAGE_LEN;
    this.leadZ = 0;
    this.leadSpeed = 0;
    this.shownGust = 1;
    this.wallFade = 0;
    this.wallBreak = 0;
    this.storm = 0;
    this.clearShown = 0;
    this.saidStorm = false;
    this.saidGust = false;
    this.saidBuffet = false;
    this.saidSteady = false;
    this.wall.visible = false;
    for (const c of this.camels) {
      c.kneel = 0;
      c.drink = 0;
    }
    for (const w of this.wellList) w.shine = 0;
    this.poolMat.emissiveIntensity = 0.15;
    this.fire.intensity = 0;
    this.stopSand();
    this.lastClear = -1;
    this.applySky(0, 0);
    this.ctx.audio.intensity(0);
  }

  /** A new run with this plan (the screen calls it before the first key, and for every retry). */
  begin(plan: MidbarPlan): void {
    this.reset();
    this.plan = plan;
    this.chapter = plan.chapters[0]?.id ?? 'dunes';
    const n = Math.max(1, Math.min(MAX_STAGES, plan.stages));
    // Wells at the end of every stage but the last; the oasis where the road ends.
    for (let k = 0; k < this.wellList.length; k++) {
      const w = this.wellList[k] as Well;
      w.root.visible = k < n - 1;
      const z = STAGE_LEN * (k + 1) + 1.2;
      const x = roadX(z) + 3.8;
      w.root.position.set(x, dunes(x, z) - 0.1, z);
      w.root.rotation.y = roadYaw(z);
    }
    const end = STAGE_LEN * n;
    const pz = end + POOL_AHEAD;
    const px = roadX(pz);
    this.oasis.position.set(px, dunes(px, pz) - 0.05, pz);
    for (const p of this.palms) {
      const wx = px + p.position.x;
      const wz = pz + p.position.z;
      p.position.y = dunes(wx, wz) - this.oasis.position.y - 0.1;
    }
    this.markers.count = Math.max(1, Math.floor((end - 6 + 1) / MARKER_STEP) + 1);
    this.endZ = this.stageEnd(0);
    this.place();
  }

  /** Where stage `k` ends (the caravan stops there, by its well or at the oasis). */
  private stageEnd(k: number): number {
    return STAGE_LEN * (k + 1);
  }

  /** Puts the caravan and the camera where a run starts. */
  private place(): void {
    this.leadZ = 0;
    this.pose(0);
    this.follow();
    this.ctx.rig.cut();
  }

  onKey(ev: TypedKey): void {
    const { typing, audio, vfx } = this.ctx;
    const kind = this.legKind;
    if (kind === 'storm') this.gust.release();
    if (!ev.correct) {
      // A slip is soft: the letter stumbles, a little sand blows up.
      this.text.miss();
      this.feedback.wrong();
      audio.play('error');
      this.hearTier(typing.tier);
      return;
    }
    if (ev.kind !== 'char') return;
    // Every right letter is a step of the caravan.
    this.typedInStage += 1;
    const plan = this.plan;
    const leg = plan?.legs[this.leg];
    if (plan && leg) this.march.push(marchAim(this.typedInStage, stageChars(plan, leg.stage)));
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

  /** The music builds with the combo tier; a new tier rings a chime and the bells. */
  private hearTier(tier: number): void {
    if (tier > this.heardTier) {
      this.ctx.audio.play('tier', tier);
      this.ctx.audio.play('camel-bell');
      this.dyo.cheer(2 + tier);
    }
    this.heardTier = tier;
    this.ctx.audio.intensity(tierIntensity(tier));
  }

  onWord(_word: string, perfect: boolean): void {
    const plan = this.plan;
    if (!plan) return;
    const leg = plan.legs[this.leg];
    if (!leg) return;
    const { audio } = this.ctx;
    this.wordsDone += 1;
    const a = this.text.anchor;
    this.feedback.word(a.x, a.y, a.z, perfect);
    audio.play(perfect ? 'perfect' : 'word');
    if (leg.kind === 'storm') this.breakGust(perfect);
    this.sweep(1.4);

    if (this.wordsDone >= leg.to) {
      if (leg.kind === 'trek') this.stormRises();
      else this.arrive(leg);
      this.leg = Math.min(plan.legs.length - 1, this.leg + 1);
      this.legT = 0;
      const next = plan.legs[this.leg];
      if (this.wordsDone < plan.words.length && next) {
        if (next.stage !== leg.stage) {
          // A new stage of the road: the caravan sets off from where it stands.
          this.baseZ = this.leadZ;
          this.endZ = this.stageEnd(next.stage);
          this.march.reset();
          this.typedInStage = 0;
        }
        if (next.kind === 'storm') this.startGust(true);
      }
      this.chapter = this.chapterNow();
    } else if (leg.kind === 'storm') {
      this.startGust(false);
    }
  }

  /** The clear sentence is done: a sandstorm rolls in from the side. */
  private stormRises(): void {
    const { audio } = this.ctx;
    audio.play('gust');
    if (!this.sandLoop) this.sandLoop = audio.ambience('sand');
    if (!this.saidStorm) {
      this.saidStorm = true;
      this.onMoment?.('storm');
    }
  }

  private stopSand(): void {
    this.sandLoop?.stop();
    this.sandLoop = null;
  }

  /** The next gust of this storm sentence comes (the first one waits a moment). */
  private startGust(first: boolean): void {
    const plan = this.plan;
    if (!plan) return;
    this.gust.start(plan.gust[this.wordsDone] ?? null);
    if (first) this.gust.released = false;
    else this.gust.release();
    this.hitThis = false;
    this.shownGust = 1.15;
    this.wallFade = 0;
    this.wallBreak = 0;
    this.wall.visible = true;
    if (first && !this.saidGust) {
      this.saidGust = true;
      // Said a little later, so it does not talk over the storm's own line.
      this.gustLineT = 2.5;
    }
  }

  private gustLineT = -1;

  /** The word is done: the caravan walks through the gust and its sand falls as gold dust. */
  private breakGust(perfect: boolean): void {
    const { vfx, audio } = this.ctx;
    this.gustsDone += 1;
    const clean = !this.hitThis;
    if (clean) this.steady += 1;
    this.hitThis = false;
    this.wallBreak = 1;
    const p = this.wall.position;
    vfx.burst(this.goldDust, p.x, p.y + 2.5, p.z, 0, 1, 0);
    vfx.burst(this.dust, p.x, p.y + 1, p.z, 0, 1, 0);
    vfx.shockwave(
      p.x,
      p.y + 0.4,
      p.z,
      perfect ? 6 : 4.5,
      perfect ? this.gold : TINT.sandCrest,
      0.5,
      false,
      1.4,
    );
    vfx.impact(perfect ? 0.32 : 0.22, TINT.gold);
    audio.playAt('whoosh', p.x, p.y, p.z);
    if (clean && !this.saidSteady && this.plan?.timers) {
      this.saidSteady = true;
      this.onMoment?.('steady');
    }
  }

  /** The storm sentence is done: the storm blows itself out, at a well (or at the oasis). */
  private arrive(leg: Leg): void {
    const { vfx, audio } = this.ctx;
    const plan = this.plan;
    this.march.push(1);
    this.wall.visible = false;
    this.stopSand();
    this.sweep(2.4);
    audio.play('restore');
    audio.play('camel-bell');
    this.apprentice.play('cheer');
    this.dyo.cheer(3);
    const w = this.wellList[leg.stage];
    if (plan && leg.stage < plan.stages - 1 && w) {
      w.shine = 1;
      const p = w.root.position;
      vfx.burst(this.splash, p.x, p.y + 0.8, p.z, 0, 1, 0);
      vfx.shockwave(p.x, p.y + 0.6, p.z, 4, this.gold, 0.5, false, 1.2);
      audio.playAt('success', p.x, p.y, p.z);
      this.onMoment?.('well');
    }
  }

  /** Color spreads from the start of the road out past the caravan, a little more every time. */
  private sweep(seconds: number): void {
    const plan = this.plan;
    const total = plan?.words.length ?? 1;
    const share = colorShare(this.wordsDone, total);
    this.ctx.vfx.restore(0, 0, 0, Math.max(26, this.leadZ + 20 + share * 22), seconds);
  }

  private chapterNow(): ChapterId {
    const plan = this.plan;
    if (!plan) return 'dunes';
    for (const c of plan.chapters) if (this.wordsDone < c.to) return c.id;
    return plan.chapters.at(-1)?.id ?? 'oasis';
  }

  /** The run is over. A whole run reaches the oasis; a failed trial leaves the storm blowing. */
  finale(failed: boolean): void {
    if (this.finished || this.finaleT >= 0) return;
    if (failed) {
      this.ctx.rig.shake(0.5);
      this.ctx.audio.play('impact');
      return;
    }
    const { vfx, materials, audio } = this.ctx;
    this.finished = true;
    this.finaleT = 0;
    this.chapter = 'finale';
    this.wall.visible = false;
    this.stopSand();
    materials.restoreAll(1, 3.2);
    vfx.restore(0, 0, 0, 900, 3.2);
    const o = this.oasis.position;
    vfx.burst(this.fountain, o.x, o.y + 0.5, o.z, 0, 1, 0);
    audio.play('success');
    audio.intensity(1);
    this.apprentice.play('cheer');
    this.dyo.cheer(6);
    this.ctx.rig.pushIn(0.25, 0.6);
    // Pull back and look over the oasis: the caravan at the water, the palms, the evening sky.
    const back = roadYaw(o.z);
    this.ctx.rig.fixed(
      this.v.set(o.x - Math.sin(back) * 21 + 6, o.y + 9.5, o.z - Math.cos(back) * 21),
      this.w.set(o.x, o.y + 1, o.z + 1),
    );
  }

  update(dt: number): void {
    this.time += dt;
    const { vfx, audio } = this.ctx;
    const plan = this.plan;
    const total = plan?.words.length ?? 0;
    const kind = this.legKind;
    this.legT += dt;

    // --- The gusts of the storm.
    if (plan && kind === 'storm') {
      if (!this.gust.released && this.legT > STORM_GRACE) this.gust.release();
      if (this.gust.step(dt) === 'buffeted') this.buffet();
    }
    this.shownGust = damp(this.shownGust, this.gust.distance, this.gust.hits > 0 ? 5 : 8, dt);
    if (this.gustLineT >= 0) {
      this.gustLineT -= dt;
      if (this.gustLineT < 0) this.onMoment?.('gust');
    }

    // --- The weather: the storm thickens during a storm sentence and blows out after it.
    const want = !this.finished && kind === 'storm' ? 1 : 0;
    this.storm = damp(this.storm, want, want > this.storm ? 0.9 : 0.55, dt);
    const clear = this.finished ? 1 : colorShare(this.wordsDone, total) * 0.75;
    this.clearShown = damp(this.clearShown, clear, this.finished ? 0.7 : 1.2, dt);
    this.applySky(this.clearShown, this.storm);

    // --- The march: the caravan walks after the typing (and stands while the camels kneel).
    this.kneelT = Math.max(0, this.kneelT - dt);
    if (this.kneelT <= 0) this.march.step(dt);
    const was = this.leadZ;
    if (this.finished) {
      // At the end the caravan walks up to the edge of the water.
      const stop = this.oasis.position.z - POOL_R - 2.2;
      this.leadZ = Math.min(stop, this.leadZ + dt * 2.2);
    } else {
      this.leadZ = this.baseZ + this.march.at * (this.endZ - this.baseZ);
    }
    const sp = dt > 0 ? (this.leadZ - was) / dt : 0;
    this.leadSpeed = damp(this.leadSpeed, sp, 6, dt);
    this.pose(dt);

    // --- The wall of sand: rolls in from the side with its gust, falls apart when it is beaten.
    if (this.wall.visible) {
      const yaw = roadYaw(this.leadZ);
      // The gusts come from the caravan's left, the side the camera looks across.
      const rx = -Math.cos(yaw);
      const rz = Math.sin(yaw);
      const d = GUST_NEAR + (GUST_FAR - GUST_NEAR) * Math.max(0, Math.min(1.3, this.shownGust));
      const lead = this.apprentice.root.position;
      const x = lead.x + rx * d + Math.sin(yaw) * 2;
      const z = lead.z + rz * d + Math.cos(yaw) * 2;
      this.wall.position.set(x, dunes(x, z) - 0.5, z);
      this.wall.rotation.y = yaw + Math.PI / 2;
      this.wallFade = Math.min(1, this.wallFade + dt * 1.2);
      this.wallBreak = Math.max(0, this.wallBreak - dt * 1.6);
      const near = 1 - Math.min(1, this.shownGust);
      const k = this.wallFade * (1 - this.wallBreak) * (0.45 + near * 0.55);
      for (let i = 0; i < this.wallMats.length; i++) {
        (this.wallMats[i] as MeshBasicMaterial).opacity = k * (i === 0 ? 0.85 : 0.6);
      }
      const roll = 1 + Math.sin(this.time * 2.3) * 0.04 + near * 0.15;
      this.wall.scale.set(1, roll, 1);
      // Sand boils up at its foot.
      this.dustT -= dt;
      if (this.dustT <= 0 && this.wallBreak <= 0) {
        this.dustT = 0.22;
        vfx.burst(
          this.dust,
          x + (this.rng.next() - 0.5) * 18 * rz,
          this.wall.position.y + 0.6,
          z - (this.rng.next() - 0.5) * 18 * rx,
          -rx,
          0.6,
          -rz,
        );
      }
    }

    // --- Wells shine once reached; the oasis pool glitters at the end.
    for (const w of this.wellList) {
      if (!w.root.visible) continue;
      w.water.emissiveIntensity =
        0.1 + w.shine * (0.5 + Math.sin(this.time * 2 + w.root.position.z) * 0.12);
      w.bucket.position.y =
        1.0 - w.shine * 0.25 + Math.sin(this.time * 1.4 + w.root.position.z) * 0.03;
    }
    for (let i = 0; i < this.palms.length; i++) {
      const p = this.palms[i] as Group;
      p.rotation.z = Math.sin(this.time * 0.8 + i) * 0.02 * (1 + this.storm * 3);
    }
    for (const w of this.wellList)
      w.palm.rotation.z =
        Math.sin(this.time * 0.9 + w.root.position.z) * 0.02 * (1 + this.storm * 4);
    if (this.finaleT >= 0) {
      const before = this.finaleT;
      this.finaleT += dt;
      const o = this.oasis.position;
      this.poolMat.emissiveIntensity =
        0.15 + Math.min(1, this.finaleT / 2) * (0.45 + Math.sin(this.time * 2.2) * 0.08);
      this.fire.intensity =
        Math.min(1, this.finaleT / 3) *
        (this.ctx.theme === 'dark' ? 30 : 10) *
        (0.85 + Math.sin(this.time * 13) * 0.15);
      if (before < 1.2 && this.finaleT >= 1.2)
        vfx.burst(this.fountain, o.x - 2, o.y + 0.5, o.z + 1, 0, 1, 0);
      if (before < 2.2 && this.finaleT >= 2.2) {
        vfx.burst(this.fountain, o.x + 2, o.y + 0.5, o.z - 1, 0, 1, 0);
        audio.play('tier', 4);
        audio.play('camel-bell');
      }
    }

    if (this.wind)
      this.wind.move(this.apprentice.root.position.x, 2, this.apprentice.root.position.z);
  }

  /** Puts the apprentice, the camels, Dyo and the rope along the road. */
  private pose(dt: number): void {
    const app = this.apprentice.root;
    const z = this.leadZ;
    const yaw = roadYaw(z);
    const ax = roadX(z) - 0.35;
    app.position.set(ax, dunes(ax, z), z);
    if (this.finished && this.finaleT > 2.5) {
      // At the water he turns back to look at his caravan.
      this.yaw = damp(this.yaw, yaw + Math.PI * 0.7, 1.5, dt);
    } else {
      this.yaw = yaw;
    }
    app.rotation.y = this.yaw;
    this.apprentice.speed = Math.max(0, this.leadSpeed);
    this.apprentice.update(dt);

    const walk = Math.min(1, Math.max(0, this.leadSpeed) / 1.1);
    const kneel = this.kneelT > 0 ? 1 : 0;
    for (let k = 0; k < this.camels.length; k++) {
      const c = this.camels[k] as Camel;
      c.z = z - CAMEL_FIRST - k * CAMEL_GAP;
      const cx = roadX(c.z);
      const cyaw = roadYaw(c.z);
      c.root.position.set(cx, dunes(cx, c.z), c.z);
      c.root.rotation.y = cyaw;
      c.phase += dt * Math.max(0, this.leadSpeed) * 2.1;
      const drinkWant = this.finished && this.finaleT > 1.5 ? 1 : 0;
      c.drink = damp(c.drink, drinkWant, 1.2, dt);
      c.kneel = damp(c.kneel, Math.max(kneel, c.drink * 0.75), kneel ? 6 : 2, dt);
      const bob = Math.abs(Math.sin(c.phase)) * 0.06 * walk;
      c.body.position.y = -c.kneel * 0.95 + bob;
      c.body.rotation.x = c.kneel * 0.06;
      c.body.rotation.z = Math.sin(c.phase) * 0.035 * walk;
      for (let i = 0; i < 4; i++) {
        const leg = c.legs[i] as Group;
        const right = i % 2 === 1;
        const front = i < 2;
        const swing = Math.sin(c.phase + (right ? Math.PI : 0)) * 0.42 * walk;
        leg.rotation.x = swing + c.kneel * (front ? 1.4 : -1.3);
        // A folded leg tucks in under the body.
        leg.scale.y = 1 - c.kneel * 0.4;
      }
      c.head.rotation.x =
        Math.sin(c.phase * 2) * 0.07 * walk + c.drink * 1.0 + c.kneel * 0.15 - 0.05;
    }

    // Dyo rides on the first camel's hump.
    const lead = this.camels[0] as Camel;
    const lp = lead.root.position;
    const lyaw = lead.root.rotation.y;
    this.dyo.root.position.set(
      lp.x - Math.sin(lyaw) * 0.05,
      lp.y + lead.body.position.y + 2.92,
      lp.z - Math.cos(lyaw) * 0.05,
    );
    this.dyo.update(dt);

    // The rope: hand to the first camel's halter, then tail to halter down the line.
    const arr = this.rope.geometry.getAttribute('position') as BufferAttribute;
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    arr.setXYZ(
      0,
      app.position.x + Math.cos(this.yaw) * 0.32 - fx * 0.1,
      app.position.y + 0.95,
      app.position.z - Math.sin(this.yaw) * 0.32 - fz * 0.1,
    );
    for (let k = 0; k < this.camels.length; k++) {
      const c = this.camels[k] as Camel;
      const cy = c.root.rotation.y;
      const sx = Math.sin(cy);
      const sz = Math.cos(cy);
      const p = c.root.position;
      const headY = p.y + c.body.position.y + 2.55 - c.drink * 0.6;
      arr.setXYZ(k * 2 + 1, p.x + sx * 1.9, headY, p.z + sz * 1.9);
      if (k + 1 < this.camels.length) {
        arr.setXYZ(k * 2 + 2, p.x - sx * 1.2, p.y + c.body.position.y + 1.55, p.z - sz * 1.2);
      }
    }
    arr.needsUpdate = true;
    // The rope is drawn as pairs: (0,1) (2,3) (4,5); point 5 is the last camel's halter.
    this.rope.geometry.setDrawRange(0, this.camels.length * 2);

    // The camera's eye: the middle of the caravan, turned a little so we see it from the side.
    const mz = z - 3.5;
    this.eye.position.set(roadX(mz), dunes(roadX(mz), mz), mz);
    this.eye.rotation.y = roadYaw(mz) + CAM_YAW;
  }

  /** A gust reached the caravan before its word was done. */
  private buffet(): void {
    const { vfx, audio } = this.ctx;
    this.buffets += 1;
    this.hitThis = true;
    this.kneelT = KNEEL_S;
    const p = this.apprentice.root.position;
    vfx.burst(this.dust, p.x, p.y + 1.2, p.z, 0, 1, 0);
    vfx.impact(0.5, TINT.sandAir);
    audio.play('gust');
    audio.playAt('impact', p.x, p.y, p.z);
    this.ctx.rig.shake(0.35);
    this.apprentice.play('stagger');
    this.onBuffet?.();
    if (!this.saidBuffet) {
      this.saidBuffet = true;
      this.onMoment?.('buffet');
    }
  }

  frame(dt: number): void {
    const { typing } = this.ctx;
    const app = this.apprentice.root.position;
    this.dyo.face(app.x, app.z + 6);
    const yaw = roadYaw(this.leadZ);
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);

    // The word: on a banner ahead of the apprentice.
    const a = this.text.anchor;
    a.set(app.x + fx * 3.4, app.y + 2.5, app.z + fz * 3.4);
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

    // The words ahead: carved on the marker stone down the road, as far as the sand lets one see.
    const plan = this.plan;
    const key = this.finished || !plan ? -2 : this.wordsDone;
    if (key !== this.aheadKey) {
      this.aheadKey = key;
      const words = plan && key >= 0 ? wordsAhead(plan, key) : [];
      const line = words.join(' ');
      this.ahead.setWord([...line].slice(0, AHEAD_CAP), /[֐-׿]/.test(line));
      this.ahead.root.visible = words.length > 0;
    }
    const dist = Math.min(13, Math.max(7, sightAt(this.storm) * 0.62));
    const px = app.x + fx * dist - Math.cos(yaw) * 1.8;
    const pz = app.z + fz * dist + Math.sin(yaw) * 1.8;
    this.aheadPost.position.set(px, dunes(px, pz), pz);
    this.aheadPost.rotation.y = yaw - 0.4;
    this.aheadPost.visible = !this.finished;
    this.ahead.anchor.set(px, this.aheadPost.position.y + 3.1, pz);
    if (this.finished) this.ahead.root.visible = false;
    this.ahead.frame(dt, this.aheadStates);
    this.feedback.frame(dt);

    // Blowing sand around the camera: thick in a storm, a few grains always.
    const cam = this.ctx.engine.camera.position;
    const pos = this.sand.geometry.getAttribute('position') as BufferAttribute;
    const arr = pos.array as Float32Array;
    const t = this.time;
    const blow = 7 + this.storm * 16;
    for (let i = 0; i < SAND; i++) {
      const o = i * 3;
      const bx = (this.sandBase[o] as number) - t * blow;
      const by = (this.sandBase[o + 1] as number) + Math.sin(t * 1.7 + i) * 0.4;
      const bz = (this.sandBase[o + 2] as number) + t * 2;
      arr[o] = cam.x + (((bx % SAND_W) + SAND_W) % SAND_W) - SAND_W / 2;
      arr[o + 1] = cam.y - 3 + (((by % SAND_H) + SAND_H) % SAND_H);
      arr[o + 2] = cam.z + (((bz % SAND_W) + SAND_W) % SAND_W) - SAND_W / 2;
    }
    pos.needsUpdate = true;
    this.sandMat.opacity = 0.1 + this.storm * 0.75;
    this.sandMat.size = 0.05 + this.storm * 0.04;
  }

  dispose(): void {
    this.wind?.stop();
    this.wind = null;
    this.stopSand();
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
    this.onBuffet = null;
    this.plan = null;
  }
}
