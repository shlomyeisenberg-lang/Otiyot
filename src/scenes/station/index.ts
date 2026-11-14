// The Star Station (T22): the sixth region of Act Two.
//
// High above the land floats the old observatory where the stars are counted. The Fading has
// dimmed the stars and broken the station apart: its modules hang dark and silent, far from one
// another, and grey debris tumbles around them. The apprentice comes up in a thruster pack with a
// glass helmet, and Dyo floats beside him in a little bubble of his own.
//
// Every module is two sentences. In the first (the drift) every right letter fires the thrusters
// and the apprentice floats along an arc to the module's hatch; when the sentence is done he
// docks, the windows light and the solar panels open like wings. In the second (the turret) he
// takes the module's turret: one rock of debris per word drifts in at the hull, each carrying its
// word, and finishing the word fires a beam that breaks it into gold dust. Every word lights more
// stars. The last module is the observatory itself: at the end its dome opens, the telescope
// turns up, the constellations are drawn across the sky and the land below has its colors back.
//
// On Calm a rock stops a little way out and waits. On the other difficulties a rock that reaches
// the hull strikes (the streak drops; the screen is told through `onStrike`) and bounces back out
// to come in again, slower. The typing is judged by the host (PlayController); this scene only
// reacts, and learns the shape of the run from `begin(plan)`.

import {
  AdditiveBlending,
  BackSide,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  type MeshLambertMaterial,
  PointLight,
  Points,
  PointsMaterial,
  Quaternion,
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
  WorldText,
  type AmbienceHandle,
  type BurstStyle,
  type GameScene,
  type SceneContext,
  type ScenePalette,
  type TypedKey,
} from '../../engine';
import { tierIntensity } from '../../audio/composer';
import { Dyo } from '../../game/dyo';
import { TypingFeedback } from '../../game/feedback';
import { CLEAR, DIM, TINT } from './palette';
import {
  clearPercent,
  colorShare,
  Drift,
  driftAim,
  legChars,
  modulesOnline,
  Rock,
  STARS,
  starsLit,
  type ChapterId,
  type Leg,
  type StationPlan,
} from './plan';

export interface StationSetup {
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
export type StationEvent = 'dock' | 'debris' | 'strike' | 'cleared' | 'online';

/** The most modules a run can have (the last one is always the observatory). */
const MAX_MODULES = 4;
/** Hull radius of a module and of the observatory. */
const MODULE_R = 2.6;
const DOME_R = 4.2;
/** Where a rock is, along its line, when it is far out and when it touches the hull. */
const ROCK_FAR = 34;
const ROCK_NEAR = 2.4;
const LETTER_SIZE = 0.62;
const ROCK_LETTER = 1.05;
const DEBRIS = 70;
/** The sky rides with the camera (it is infinitely far away), inside the camera's far plane. */
const STAR_R = 520;
const PLANET_R = 300;
const PLANET = new Vector3(0, -372, 160);
/** Seconds after a turret sentence begins before its first rock comes in on its own. */
const TURRET_GRACE = 3;
/** Four constellations, each a few stars (azimuth, elevation in degrees) and the lines between. */
const CONSTELLATIONS: readonly { stars: readonly [number, number][]; lines: readonly number[] }[] =
  [
    // The Scroll: a long line with a curl at each end.
    {
      stars: [
        [-38, 22],
        [-33, 26],
        [-26, 27],
        [-19, 25],
        [-13, 27],
        [-8, 31],
      ],
      lines: [0, 1, 1, 2, 2, 3, 3, 4, 4, 5],
    },
    // The Lamp: a bowl with a flame over it.
    {
      stars: [
        [-6, 12],
        [0, 9],
        [6, 12],
        [0, 14],
        [0, 19],
        [1, 23],
      ],
      lines: [0, 1, 1, 2, 2, 3, 3, 0, 3, 4, 4, 5],
    },
    // The Quill: a long shaft and its feather.
    {
      stars: [
        [12, 14],
        [17, 20],
        [22, 26],
        [27, 32],
        [24, 34],
        [30, 30],
      ],
      lines: [0, 1, 1, 2, 2, 3, 3, 4, 3, 5],
    },
    // The Ladder: two rails and three rungs.
    {
      stars: [
        [33, 12],
        [39, 12],
        [34, 18],
        [40, 18],
        [35, 24],
        [41, 24],
      ],
      lines: [0, 2, 2, 4, 1, 3, 3, 5, 0, 1, 2, 3, 4, 5],
    },
  ];

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

/** A point on the sky sphere from azimuth (0 = straight ahead, +z) and elevation, in degrees. */
function skyPoint(az: number, el: number, r: number, out: Vector3): Vector3 {
  const a = (az * Math.PI) / 180;
  const e = (el * Math.PI) / 180;
  return out.set(Math.sin(a) * Math.cos(e) * r, Math.sin(e) * r, Math.cos(a) * Math.cos(e) * r);
}

/** Centre of module `k` (the observatory sits wherever the last module of the run is). */
export function moduleCenter(k: number, out: Vector3): Vector3 {
  const side = k % 2 === 0 ? -1 : 1;
  return out.set(side * 6.5, k % 2 === 0 ? -1.5 : 2.5, 38 + 40 * k);
}

/** One module's moving parts. */
interface Module {
  readonly root: Group;
  readonly center: Vector3;
  readonly hatch: Vector3;
  /** The direction the debris comes from, toward the hatch. */
  readonly from: Vector3;
  readonly windows: MeshLambertMaterial;
  readonly beacon: MeshLambertMaterial;
  readonly panels: Group[];
  readonly turret: Group;
  readonly barrel: Group;
  glow: number;
  glowTarget: number;
  open: number;
  openTarget: number;
  observatory: boolean;
}

export class StationScene implements GameScene {
  readonly id = 'station';
  /** Told when something worth a line happens. */
  onMoment: ((moment: StationEvent) => void) | null = null;
  /** Told when a rock strikes the hull (only on difficulties with timers). */
  onStrike: (() => void) | null = null;

  private ctx!: SceneContext;
  private readonly rng = new Rng(2210);
  private plan: StationPlan | null = null;
  private apprentice!: Character;
  private dyo!: Dyo;
  private text!: WorldText;
  private feedback!: TypingFeedback;
  private shownLetters: readonly string[] | null = null;
  private hum: AmbienceHandle | null = null;

  // The apprentice and his pack.
  private readonly pack = new Group();
  private readonly flames: Mesh[] = [];
  private flameMat!: MeshBasicMaterial;
  private helmetMat!: MeshBasicMaterial;
  private lamp!: PointLight;
  private thrust = 0;
  private readonly drift = new Drift();
  private readonly p0 = new Vector3();
  private readonly p1 = new Vector3();
  private readonly pc = new Vector3();
  private readonly face = new Vector3(0, 0, 1);
  private yaw = 0;
  private typedInLeg = 0;

  // The station.
  private readonly modules: Module[] = [];
  private observatory!: Module;
  private domeL!: Group;
  private domeR!: Group;
  private scope!: Group;
  private ring!: Group;
  private shuttle!: Group;

  // The debris.
  private readonly rock = new Rock();
  private readonly rocks: Mesh[] = [];
  private rockMat!: MeshLambertMaterial;
  private rockDimMat!: MeshLambertMaterial;
  private cur = 0;
  private shownD = 1;
  private lane = 0;
  private laneShown = 0;
  private nextLane = 0;
  private struckThis = false;
  private legT = 0;
  private debris!: InstancedMesh;
  private readonly debrisBase = new Float32Array(DEBRIS * 7);
  private beam!: Mesh;
  private beamMat!: MeshBasicMaterial;
  private beamT = 0;
  private flashLight!: PointLight;

  // The sky (it rides with the camera).
  private readonly sky = new Group();
  private litStars!: Points;
  private dimMat!: PointsMaterial;
  private litMat!: PointsMaterial;
  private brightMat!: PointsMaterial;
  private lineMat!: LineBasicMaterial;
  private lines!: LineSegments;
  private nebulae: MeshBasicMaterial[] = [];
  private rimMat!: MeshBasicMaterial;
  private sunMat!: MeshBasicMaterial;
  private starsShown = 0;
  private drawnLines = 0;
  private linesShown = 0;
  private clearShown = 0;
  private readonly palette: ScenePalette = { ...DIM.light, sunFrom: [0, 1, 0], fade: 0, ink: 0 };
  private readonly ca = new Color();
  private readonly cb = new Color();
  private lastSky = -1;

  // The run.
  private wordsDone = 0;
  private strikes = 0;
  private cleared = 0;
  private docked = 0;
  private leg = 0;
  private chapter: ChapterId | 'finale' = 'outer';
  private finished = false;
  private heardTier = 0;
  private time = 0;
  private finaleT = -1;
  private saidDebris = false;
  private saidStrike = false;
  private saidCleared = false;

  private gold = 0;
  private techelet = 0;
  private paper = 0;
  private inkDark = 0;
  private puff!: BurstStyle;
  private bigPuff!: BurstStyle;
  private shards!: BurstStyle;
  private dust!: BurstStyle;
  private sparks!: BurstStyle;
  private fountain!: BurstStyle;

  private readonly v = new Vector3();
  private readonly w = new Vector3();
  private readonly u = new Vector3();
  private readonly m4 = new Matrix4();
  private readonly q = new Quaternion();
  private readonly s = new Vector3();
  private readonly up = new Vector3(0, 1, 0);

  constructor(private readonly setup: StationSetup) {}

  // ---- probes (the screen and the smoke test read these) -------------------------------------

  /** Where the current rock is (1 = far out, 0 = at the hull); 1 on a drift sentence. */
  get rockDistance(): number {
    return this.legKind === 'turret' ? this.rock.distance : 1;
  }

  /** Rocks that struck the hull, over the whole run. */
  get strikesTotal(): number {
    return this.strikes;
  }

  /** Rocks broken before they ever struck. */
  get rocksCleared(): number {
    return this.cleared;
  }

  /** Rocks broken cleanly, as a percent of the rocks broken so far. */
  get clearShare(): number {
    return clearPercent(this.cleared, this.rocksBroken);
  }

  private rocksBroken = 0;

  /** Stars lit in the sky right now. */
  get stars(): number {
    return this.finished ? STARS : starsLit(this.wordsDone, this.plan?.words.length ?? 0);
  }

  /** Modules docked, and modules back online (docked and defended). */
  get modulesDocked(): number {
    return this.docked;
  }

  get modulesUp(): number {
    return this.plan ? modulesOnline(this.plan, this.wordsDone) : 0;
  }

  /** The kind of sentence being typed now. */
  get legKind(): 'drift' | 'turret' | 'done' {
    if (this.finished || !this.plan) return 'done';
    return this.plan.legs[this.leg]?.kind ?? 'done';
  }

  /** 0..1 along the current drift. */
  get driftAt(): number {
    return this.drift.at;
  }

  /** Distance the apprentice has come from the shuttle. */
  get travelled(): number {
    return this.apprentice?.root.position.z ?? 0;
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

    ctx.audio.music('station');
    ctx.audio.intensity(0);
    this.hum = ctx.audio.ambience('hum');

    this.palette.fade = ctx.color('fade');
    this.palette.ink = this.gold;
    this.lastSky = -1;
    this.applySky(0);
    ctx.atmosphere.groundAt = () => -400;
    ctx.atmosphere.setShadowRange(18);
    ctx.post.setGrade(
      ctx.theme === 'dark'
        ? { exposure: 1.2, saturation: 1.12, vignette: 0.6, godRays: 0.7, bloom: 1.35 }
        : { exposure: 1.12, saturation: 1.1, vignette: 0.55, godRays: 0.8, bloom: 1.3 },
    );

    this.puff = burstStyle({
      count: 6,
      color: TINT.flame,
      color2: TINT.flameCore,
      intensity: 1.8,
      speed: [1.5, 3.5],
      spread: 0.25,
      life: [0.25, 0.6],
      size: [0.05, 0.12],
      gravity: 0,
    });
    this.bigPuff = burstStyle({
      count: 26,
      color: TINT.flame,
      color2: TINT.flameCore,
      intensity: 2.2,
      speed: [2, 6],
      spread: 0.35,
      life: [0.4, 0.9],
      size: [0.06, 0.16],
      gravity: 0,
    });
    this.shards = burstStyle({
      count: 36,
      color: TINT.rock,
      color2: TINT.scrap,
      intensity: 1,
      speed: [2, 8],
      spread: 1,
      life: [0.8, 1.6],
      size: [0.08, 0.22],
      gravity: 0,
    });
    this.dust = burstStyle({
      count: 60,
      color: TINT.goldDust,
      color2: TINT.gold,
      intensity: 2.8,
      speed: [1, 5],
      spread: 1,
      life: [1.2, 2.4],
      size: [0.06, 0.16],
      gravity: -0.4,
      radius: 0.6,
    });
    this.sparks = burstStyle({
      count: 14,
      color: TINT.spark,
      color2: TINT.gold,
      intensity: 2.4,
      speed: [2, 6],
      spread: 1,
      life: [0.2, 0.5],
      size: [0.04, 0.09],
      gravity: 0,
    });
    this.fountain = burstStyle({
      count: 80,
      color: TINT.gold,
      color2: TINT.starBlue,
      intensity: 3,
      speed: [3, 9],
      spread: 0.9,
      life: [1.2, 2.4],
      size: [0.08, 0.2],
      gravity: -0.5,
    });

    this.buildSky();
    this.buildPlanet();
    this.buildStation();
    this.buildDebris();
    this.buildApprentice();

    this.flashLight = new PointLight(TINT.beam, 0, 40, 1.4);
    root.add(this.flashLight);

    // The word to type: on a parchment strip ahead of the apprentice while he drifts, and on the
    // rock itself at the turret.
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

    this.place();
  }

  /** The camera of a run: behind the apprentice and a little above him. */
  private follow(): void {
    this.ctx.rig.follow(this.apprentice.root, {
      distance: 6.4,
      height: 2.5,
      lookHeight: 1.8,
      turnWith: 1,
      stiffness: 2.4,
    });
  }

  /** Blends the sky from dimmed (0) to clear (1). Cheap: only when it changed. */
  private applySky(k: number): void {
    if (Math.abs(k - this.lastSky) < 0.004) return;
    this.lastSky = k;
    const a = DIM[this.ctx.theme];
    const b = CLEAR[this.ctx.theme];
    const p = this.palette;
    const mix = (x: number, y: number): number =>
      this.ca.setHex(x).lerp(this.cb.setHex(y), k).getHex();
    p.skyTop = mix(a.skyTop, b.skyTop);
    p.skyHorizon = mix(a.skyHorizon, b.skyHorizon);
    p.sun = mix(a.sun, b.sun);
    p.sunIntensity = a.sunIntensity + (b.sunIntensity - a.sunIntensity) * k;
    const sf = p.sunFrom as [number, number, number];
    sf[0] = a.sunFrom[0] + (b.sunFrom[0] - a.sunFrom[0]) * k;
    sf[1] = a.sunFrom[1] + (b.sunFrom[1] - a.sunFrom[1]) * k;
    sf[2] = a.sunFrom[2] + (b.sunFrom[2] - a.sunFrom[2]) * k;
    p.fillSky = mix(a.fillSky, b.fillSky);
    p.fillGround = mix(a.fillGround, b.fillGround);
    p.fillIntensity = a.fillIntensity + (b.fillIntensity - a.fillIntensity) * k;
    p.fog = mix(a.fog, b.fog);
    p.fogDensity = a.fogDensity + (b.fogDensity - a.fogDensity) * k;
    p.fogBase = a.fogBase;
    p.fogFalloff = a.fogFalloff;
    p.inscatter = a.inscatter + (b.inscatter - a.inscatter) * k;
    this.ctx.atmosphere.setPalette(p);
  }

  /** Stars (dim ones, lit ones, the constellations), the nebulae and the sun. */
  private buildSky(): void {
    const { tracker } = this.ctx;
    const r = this.rng;
    const pos = new Float32Array(STARS * 3);
    const col = new Float32Array(STARS * 3);
    const c = new Color();
    for (let i = 0; i < STARS; i++) {
      // Every direction, a little thicker in a band across the sky (the galaxy).
      const az = r.range(-180, 180);
      const band = r.next() < 0.45;
      const el = band
        ? Math.sin(((az + 30) * Math.PI) / 180) * 18 + r.range(-7, 7)
        : r.range(-70, 85);
      skyPoint(az, el, STAR_R, this.v);
      pos[i * 3] = this.v.x;
      pos[i * 3 + 1] = this.v.y;
      pos[i * 3 + 2] = this.v.z;
      const pick = r.next();
      c.setHex(pick < 0.6 ? TINT.star : pick < 0.85 ? TINT.starBlue : TINT.starGold);
      c.multiplyScalar(0.6 + r.next() * 0.6);
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    const geo = tracker.track(new BufferGeometry());
    geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new Float32BufferAttribute(col, 3));
    this.dimMat = tracker.track(
      new PointsMaterial({
        color: TINT.starDim,
        size: 1.3,
        sizeAttenuation: false,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
        fog: false,
      }),
    );
    this.litMat = tracker.track(
      new PointsMaterial({
        vertexColors: true,
        size: 2.4,
        sizeAttenuation: false,
        transparent: true,
        opacity: 1,
        depthWrite: false,
        fog: false,
        blending: AdditiveBlending,
      }),
    );
    const dim = new Points(geo, this.dimMat);
    this.litStars = new Points(geo, this.litMat);
    dim.frustumCulled = false;
    this.litStars.frustumCulled = false;
    this.litStars.geometry.setDrawRange(0, 0);
    this.sky.add(dim, this.litStars);

    // The constellations: bright stars and the lines between them (drawn as modules come back).
    const cs: number[] = [];
    const ls: number[] = [];
    for (const k of CONSTELLATIONS) {
      for (const [az, el] of k.stars) {
        skyPoint(az, el, STAR_R * 0.95, this.v);
        cs.push(this.v.x, this.v.y, this.v.z);
      }
      for (const idx of k.lines) {
        const [az, el] = k.stars[idx] as [number, number];
        skyPoint(az, el, STAR_R * 0.95, this.v);
        ls.push(this.v.x, this.v.y, this.v.z);
      }
    }
    const cg = tracker.track(new BufferGeometry());
    cg.setAttribute('position', new Float32BufferAttribute(cs, 3));
    this.brightMat = tracker.track(
      new PointsMaterial({
        color: TINT.starGold,
        size: 5,
        sizeAttenuation: false,
        transparent: true,
        opacity: 0.25,
        depthWrite: false,
        fog: false,
        blending: AdditiveBlending,
      }),
    );
    const bright = new Points(cg, this.brightMat);
    bright.frustumCulled = false;
    const lg = tracker.track(new BufferGeometry());
    lg.setAttribute('position', new Float32BufferAttribute(ls, 3));
    this.lineMat = tracker.track(
      new LineBasicMaterial({
        color: TINT.line,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
        fog: false,
        blending: AdditiveBlending,
      }),
    );
    this.lines = new LineSegments(lg, this.lineMat);
    this.lines.frustumCulled = false;
    this.lines.geometry.setDrawRange(0, 0);
    this.sky.add(bright, this.lines);

    // Nebulae: soft clouds of colored light far away, glowing up as the stars come back.
    const glowDisc = (inner: number, outer: number): BufferGeometry => {
      const g = new CircleGeometry(1, 40, 0, Math.PI * 2);
      const p = g.getAttribute('position');
      const colors = new Float32Array(p.count * 3);
      const a = new Color(inner);
      const b = new Color(outer);
      for (let i = 0; i < p.count; i++) {
        const d = Math.min(1, Math.hypot(p.getX(i), p.getY(i)));
        const k = Math.pow(1 - d, 1.6);
        c.copy(b).lerp(a, k).multiplyScalar(k);
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
      }
      g.setAttribute('color', new BufferAttribute(colors, 3));
      g.deleteAttribute('uv');
      return tracker.track(g);
    };
    const neb: [number, number, number, number, number, number][] = [
      [-30, 18, 380, 1.4, TINT.nebulaA, TINT.nebulaB],
      [25, 30, 300, 0.9, TINT.nebulaB, TINT.nebulaA],
      [8, 5, 420, 2.2, TINT.nebulaC, TINT.nebulaA],
      [-70, 40, 260, 0.6, TINT.nebulaC, TINT.nebulaB],
      [60, 8, 340, 1.8, TINT.nebulaA, TINT.nebulaC],
    ];
    for (const [az, el, size, squash, a, b] of neb) {
      const mat = tracker.track(
        new MeshBasicMaterial({
          vertexColors: true,
          transparent: true,
          opacity: 0.12,
          blending: AdditiveBlending,
          depthWrite: false,
          fog: false,
        }),
      );
      const m = new Mesh(glowDisc(a, b), mat);
      skyPoint(az, el, STAR_R * 0.9, m.position);
      m.lookAt(0, 0, 0);
      m.scale.set(size * squash, size, 1);
      m.rotation.z += az * 0.01;
      this.nebulae.push(mat);
      this.sky.add(m);
    }

    // The sun: a white disc with a wide soft glow.
    this.sunMat = tracker.track(
      new MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        blending: AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
    );
    const sun = new Mesh(glowDisc(0xffffff, TINT.sunGlow), this.sunMat);
    const sf = CLEAR.light.sunFrom;
    sun.position
      .set(sf[0], sf[1], sf[2])
      .normalize()
      .multiplyScalar(STAR_R * 0.85);
    sun.lookAt(0, 0, 0);
    sun.scale.setScalar(70);
    const core = new Mesh(tracker.track(new CircleGeometry(9, 24)), this.sunMat);
    core.position.copy(sun.position).multiplyScalar(0.99);
    core.lookAt(0, 0, 0);
    this.sky.add(sun, core);
  }

  /** The land far below: a great curve of sea, coast and cloud, with a thin blue rim of air. */
  private buildPlanet(): void {
    const { materials: kit, tracker, root } = this.ctx;
    const g = new SphereGeometry(PLANET_R, 96, 64).toNonIndexed();
    const pos = g.getAttribute('position');
    const colors = new Float32Array(pos.count * 3);
    const c = new Color();
    const d = new Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) / PLANET_R;
      const y = pos.getY(i) / PLANET_R;
      const z = pos.getZ(i) / PLANET_R;
      const n =
        Math.sin(x * 7 + z * 3) * 0.5 +
        Math.sin(z * 9 - y * 4 + 1.3) * 0.35 +
        Math.sin(x * 17 + y * 13) * 0.15;
      const cloud = Math.sin(x * 23 + z * 11 + y * 5) * Math.sin(z * 19 - x * 7);
      if (n > 0.25) c.setHex(TINT.land).lerp(d.setHex(TINT.landDry), Math.min(1, (n - 0.25) * 1.4));
      else c.setHex(TINT.sea).lerp(d.setHex(TINT.seaDeep), Math.min(1, (0.25 - n) * 1.2));
      if (cloud > 0.45) c.lerp(d.setHex(TINT.cloud), Math.min(0.85, (cloud - 0.45) * 3));
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new BufferAttribute(colors, 3));
    g.deleteAttribute('uv');
    g.computeVertexNormals();
    const planetMat = tracker.track(kit.surface({ vertexColors: true, lift: 0.1 }));
    const planet = new Mesh(tracker.track(g), planetMat);
    planet.position.copy(PLANET);
    planet.rotation.set(0.4, 0.2, 0.1);
    planet.renderOrder = -11;
    planetMat.depthWrite = false;
    this.sky.add(planet);
    this.rimMat = tracker.track(
      new MeshBasicMaterial({
        color: TINT.rim,
        transparent: true,
        opacity: 0.12,
        side: BackSide,
        blending: AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
    );
    const rim = new Mesh(tracker.track(new SphereGeometry(PLANET_R * 1.035, 64, 32)), this.rimMat);
    rim.position.copy(PLANET);
    this.sky.add(rim);
    root.add(this.sky);
    // The sky is drawn first, behind everything, and never hides the station.
    this.sky.traverse((o) => {
      if (o.renderOrder === 0) o.renderOrder = -10;
      o.frustumCulled = false;
    });
  }

  /** The modules, the observatory, the great ring in the distance and the shuttle at the start. */
  private buildStation(): void {
    const { materials: kit, tracker, root } = this.ctx;
    const hullMat = tracker.track(kit.surface({ vertexColors: true }));

    // One module: a white hull with brass ribs, end caps, a dish and stubs of the broken truss.
    const body = (len: number, rad: number): BufferGeometry => {
      const parts: BufferGeometry[] = [
        painted(new CylinderGeometry(rad, rad, len, 20, 1).rotateX(Math.PI / 2), TINT.hull),
        painted(
          new SphereGeometry(rad, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2)
            .rotateX(Math.PI / 2)
            .scale(1, 1, 0.5)
            .translate(0, 0, len / 2),
          TINT.hullShade,
        ),
        painted(
          new SphereGeometry(rad, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2)
            .rotateX(-Math.PI / 2)
            .scale(1, 1, 0.5)
            .translate(0, 0, -len / 2),
          TINT.hullShade,
        ),
      ];
      for (let k = 0; k < 5; k++) {
        const z = -len / 2 + 0.6 + (k * (len - 1.2)) / 4;
        parts.push(
          painted(new TorusGeometry(rad + 0.04, 0.12, 6, 28).translate(0, 0, z), TINT.rib),
        );
      }
      // The hatch collar on top, near the front.
      parts.push(
        painted(
          new CylinderGeometry(0.8, 0.95, 0.5, 14).translate(0, rad + 0.1, -len * 0.28),
          TINT.ribDark,
        ),
      );
      // Truss stubs, front and back, broken off.
      for (const s of [-1, 1]) {
        const z0 = s * (len / 2 + rad * 0.5);
        for (const [x, y] of [
          [0.5, 0.5],
          [-0.5, 0.5],
          [0.5, -0.5],
          [-0.5, -0.5],
        ] as const) {
          parts.push(
            painted(new BoxGeometry(0.12, 0.12, 3.2).translate(x, y, z0 + s * 1.4), TINT.truss),
          );
        }
        for (let k = 0; k < 3; k++) {
          parts.push(
            painted(new BoxGeometry(1.1, 1.1, 0.1).translate(0, 0, z0 + s * (0.4 + k)), TINT.truss),
          );
        }
      }
      // A dish on the side.
      parts.push(
        painted(
          new SphereGeometry(0.9, 14, 6, 0, Math.PI * 2, 0, Math.PI / 3)
            .rotateZ(-Math.PI / 2)
            .translate(-rad - 0.7, 0.4, len * 0.2),
          TINT.dish,
        ),
        painted(
          new CylinderGeometry(0.06, 0.06, 0.9)
            .rotateZ(Math.PI / 2)
            .translate(-rad - 0.3, 0.4, len * 0.2),
          TINT.truss,
        ),
      );
      return tracker.track(merged(parts));
    };
    const windowsGeo = (len: number, rad: number): BufferGeometry => {
      const parts: BufferGeometry[] = [];
      for (let k = 0; k < 6; k++) {
        for (const side of [-1, 1]) {
          const a = side * 0.9;
          const z = -len / 2 + 1.2 + (k * (len - 2.4)) / 5;
          parts.push(
            new BoxGeometry(0.06, 0.32, 0.5)
              .translate(rad + 0.01, 0, 0)
              .rotateZ(a)
              .translate(0, 0, z),
          );
        }
      }
      const g = mergeGeometries(parts, false) ?? new BufferGeometry();
      for (const p of parts) p.dispose();
      return tracker.track(g);
    };
    // A solar wing: a frame of gold with blue cells, on a pivot so it can fold away.
    const wingGeo = tracker.track(
      (() => {
        const parts: BufferGeometry[] = [
          painted(new BoxGeometry(0.14, 0.14, 0.14).translate(0.07, 0, 0), TINT.truss),
          painted(new BoxGeometry(7, 0.05, 2.6).translate(4.3, 0, 0), TINT.panelFrame),
        ];
        for (let i = 0; i < 6; i++) {
          for (let j = 0; j < 2; j++) {
            parts.push(
              painted(
                new BoxGeometry(1.02, 0.08, 1.15).translate(
                  1.35 + i * 1.18,
                  0.01,
                  -0.62 + j * 1.24,
                ),
                (i + j) % 2 === 0 ? TINT.panel : TINT.panelLine,
              ),
            );
          }
        }
        return merged(parts);
      })(),
    );
    const turretBase = tracker.track(
      merged([
        painted(new CylinderGeometry(0.55, 0.7, 0.45, 12).translate(0, 0.22, 0), TINT.ribDark),
        painted(new SphereGeometry(0.5, 12, 8).translate(0, 0.55, 0), TINT.hull),
      ]),
    );
    const barrelGeo = tracker.track(
      merged([
        painted(
          new CylinderGeometry(0.13, 0.17, 1.5, 10).rotateX(Math.PI / 2).translate(0, 0, 0.75),
          TINT.truss,
        ),
        painted(
          new CylinderGeometry(0.2, 0.2, 0.25, 10).rotateX(Math.PI / 2).translate(0, 0, 1.45),
          TINT.rib,
        ),
      ]),
    );
    const beaconGeo = tracker.track(new SphereGeometry(0.16, 8, 6));

    const make = (len: number, rad: number, observatory: boolean): Module => {
      const g = new Group();
      const hull = new Mesh(body(len, rad), hullMat);
      kit.caster(hull, true);
      hull.receiveShadow = true;
      g.add(hull);
      const windows = tracker.track(
        kit.surface({
          color: TINT.window,
          emissive: TINT.window,
          emissiveIntensity: 0,
          restore: false,
          lift: 0.05,
        }),
      );
      g.add(new Mesh(windowsGeo(len, rad), windows));
      const panels: Group[] = [];
      for (const side of [-1, 1]) {
        const pivot = new Group();
        pivot.position.set(side * rad, 0, len * 0.08);
        const wing = new Mesh(wingGeo, hullMat);
        wing.scale.x = side;
        kit.caster(wing, false);
        pivot.add(wing);
        g.add(pivot);
        panels.push(pivot);
      }
      const turret = new Group();
      turret.position.set(1.2, rad - 0.05, -len * 0.28 + 0.6);
      const base = new Mesh(turretBase, hullMat);
      kit.caster(base, false);
      turret.add(base);
      const barrel = new Group();
      barrel.position.set(0, 0.6, 0);
      barrel.add(new Mesh(barrelGeo, hullMat));
      turret.add(barrel);
      g.add(turret);
      const beacon = tracker.track(
        kit.surface({
          color: TINT.beacon,
          emissive: TINT.beacon,
          emissiveIntensity: 1.2,
          restore: false,
        }),
      );
      for (const s of [-1, 1]) {
        const b = new Mesh(beaconGeo, beacon);
        b.position.set(0, s * (rad + 0.1), len / 2 + rad * 0.3);
        g.add(b);
      }
      root.add(g);
      return {
        root: g,
        center: new Vector3(),
        hatch: new Vector3(),
        from: new Vector3(),
        windows,
        beacon,
        panels,
        turret,
        barrel,
        glow: 0,
        glowTarget: 0,
        open: 0,
        openTarget: 0,
        observatory,
      };
    };
    for (let k = 0; k < MAX_MODULES - 1; k++) this.modules.push(make(9, MODULE_R, false));
    this.observatory = make(13, DOME_R, true);

    // The observatory's dome: two shells that part, and the telescope inside.
    const shell = (side: number): Group => {
      const pivot = new Group();
      const geo = tracker.track(
        merged([
          painted(
            new SphereGeometry(3.4, 24, 12, side < 0 ? Math.PI : 0, Math.PI, 0, Math.PI / 2),
            TINT.dome,
          ),
          painted(
            new TorusGeometry(3.42, 0.09, 6, 24, Math.PI)
              .rotateX(Math.PI / 2)
              .rotateY(side < 0 ? Math.PI : 0),
            TINT.rib,
          ),
        ]),
      );
      const m = new Mesh(geo, hullMat);
      kit.caster(m, true);
      // Each shell hinges on its outer edge, so it swings outward and down as it opens.
      m.position.z = -side * 3.4;
      pivot.add(m);
      pivot.position.set(0, DOME_R - 0.2, 2.2 + side * 3.4);
      this.observatory.root.add(pivot);
      return pivot;
    };
    // SphereGeometry phi runs around y; the two halves meet along the z axis.
    this.domeL = shell(1);
    this.domeR = shell(-1);
    const inside = new Mesh(
      tracker.track(
        painted(
          new CylinderGeometry(3.3, 3.3, 0.2, 24).translate(0, DOME_R - 0.2, 2.2),
          TINT.domeInside,
        ),
      ),
      hullMat,
    );
    this.observatory.root.add(inside);
    this.scope = new Group();
    this.scope.position.set(0, DOME_R + 0.4, 2.2);
    const tube = new Mesh(
      tracker.track(
        merged([
          painted(new CylinderGeometry(0.55, 0.75, 4.2, 16).translate(0, 1.6, 0), TINT.scope),
          painted(new CylinderGeometry(0.62, 0.62, 0.3, 16).translate(0, 3.6, 0), TINT.scopeDark),
          painted(
            new TorusGeometry(0.7, 0.08, 6, 16).rotateX(Math.PI / 2).translate(0, 0.6, 0),
            TINT.rib,
          ),
          painted(new BoxGeometry(1.4, 0.5, 1.4).translate(0, -0.4, 0), TINT.scopeDark),
        ]),
      ),
      hullMat,
    );
    kit.caster(tube, false);
    this.scope.add(tube);
    this.scope.rotation.x = 1.25;
    this.observatory.root.add(this.scope);

    // The great ring in the distance, turning slowly: the old heart of the station.
    this.ring = new Group();
    const ringGeo = tracker.track(
      merged([
        painted(new TorusGeometry(46, 3.2, 10, 72), TINT.hull),
        painted(new TorusGeometry(46, 3.5, 4, 72).scale(1, 1, 0.25), TINT.rib),
        painted(new CylinderGeometry(6, 6, 9, 16).rotateX(Math.PI / 2), TINT.hullShade),
        ...[0, 1, 2, 3, 4, 5].map((k) =>
          painted(
            new BoxGeometry(0.9, 44, 0.9).translate(0, 23, 0).rotateZ((k * Math.PI) / 3),
            TINT.truss,
          ),
        ),
      ]),
    );
    const ringMesh = new Mesh(ringGeo, hullMat);
    this.ring.add(ringMesh);
    this.ring.position.set(-120, 30, 170);
    this.ring.rotation.y = 0.9;
    root.add(this.ring);

    // The shuttle the apprentice came up in, at the start.
    this.shuttle = new Group();
    const shuttle = new Mesh(
      tracker.track(
        merged([
          painted(new CylinderGeometry(1.4, 1.8, 5, 12).rotateX(Math.PI / 2), TINT.hull),
          painted(
            new ConeGeometry(1.4, 2.4, 12).rotateX(Math.PI / 2).translate(0, 0, 3.7),
            TINT.hullShade,
          ),
          painted(new BoxGeometry(5.5, 0.18, 2).translate(0, -0.4, -1.2), TINT.rib),
          painted(
            new CylinderGeometry(0.9, 1.1, 0.8, 10).rotateX(Math.PI / 2).translate(0, 0, -2.9),
            TINT.truss,
          ),
        ]),
      ),
      hullMat,
    );
    kit.caster(shuttle, true);
    this.shuttle.add(shuttle);
    this.shuttle.position.set(0.5, -2.6, -2.5);
    this.shuttle.rotation.set(0.05, 0.3, 0.1);
    root.add(this.shuttle);
  }

  /** The rocks that come at the turret, and the debris field that tumbles around the station. */
  private buildDebris(): void {
    const { materials: kit, tracker, root } = this.ctx;
    const rockGeo = (seed: number, detail: number): BufferGeometry => {
      const g = new IcosahedronGeometry(1, detail).toNonIndexed();
      const p = g.getAttribute('position');
      const colors = new Float32Array(p.count * 3);
      const c = new Color();
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i);
        const y = p.getY(i);
        const z = p.getZ(i);
        const k = 1 + Math.sin(x * 4 + seed) * 0.16 + Math.sin(y * 5 + z * 3 + seed) * 0.12;
        p.setXYZ(i, x * k * 1.1, y * k * 0.85, z * k);
        c.setHex(Math.sin(x * 6 + y * 4 + seed) > 0.3 ? TINT.rockDark : TINT.rock);
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
      }
      g.setAttribute('color', new BufferAttribute(colors, 3));
      g.deleteAttribute('uv');
      g.computeVertexNormals();
      return g;
    };
    this.rockMat = tracker.track(
      kit.surface({ vertexColors: true, emissive: TINT.beacon, emissiveIntensity: 0, lift: 0.25 }),
    );
    this.rockDimMat = tracker.track(kit.surface({ vertexColors: true, lift: 0.05 }));
    const geo = tracker.track(
      merged([
        rockGeo(1.3, 1),
        painted(new BoxGeometry(1.1, 0.08, 0.7).rotateZ(0.5).translate(0.6, 0.7, 0.2), TINT.scrap),
        painted(new BoxGeometry(0.1, 0.1, 1.6).rotateY(0.7).translate(-0.5, 0.4, 0.4), TINT.truss),
      ]),
    );
    for (let k = 0; k < 2; k++) {
      const m = new Mesh(geo, k === 0 ? this.rockMat : this.rockDimMat);
      m.visible = false;
      kit.caster(m, true);
      root.add(m);
      this.rocks.push(m);
    }

    // The debris field: pieces of rock and scrap all along the way, tumbling slowly.
    this.debris = new InstancedMesh(
      tracker.track(rockGeo(4.1, 0)),
      tracker.track(kit.surface({ vertexColors: true })),
      DEBRIS,
    );
    const r = this.rng;
    for (let k = 0; k < DEBRIS; k++) {
      const o = k * 7;
      const z = r.range(-20, 200);
      const side = r.next() < 0.5 ? -1 : 1;
      this.debrisBase[o] = side * r.range(10, 60);
      this.debrisBase[o + 1] = r.range(-25, 30);
      this.debrisBase[o + 2] = z;
      this.debrisBase[o + 3] = r.range(0.3, 1.6);
      this.debrisBase[o + 4] = r.range(-0.4, 0.4);
      this.debrisBase[o + 5] = r.range(-0.4, 0.4);
      this.debrisBase[o + 6] = r.range(0, 6.28);
    }
    this.debris.frustumCulled = false;
    root.add(this.debris);

    // The turret's beam: one thin glowing rod, stretched from the muzzle to the rock.
    this.beamMat = tracker.track(
      new MeshBasicMaterial({
        color: TINT.beam,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
    );
    this.beam = new Mesh(
      tracker.track(new CylinderGeometry(0.07, 0.11, 1, 8, 1, true).translate(0, 0.5, 0)),
      this.beamMat,
    );
    this.beam.visible = false;
    root.add(this.beam);
  }

  /** The apprentice in his thruster pack and glass helmet, and Dyo in his bubble. */
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
      height: 0.92,
      seed: 4,
    });
    const packMat = tracker.track(kit.surface({ vertexColors: true, restore: false, lift: 0.2 }));
    const pack = new Mesh(
      tracker.track(
        merged([
          painted(new BoxGeometry(0.62, 0.72, 0.32).translate(0, 0, 0), TINT.pack),
          painted(new BoxGeometry(0.66, 0.08, 0.36).translate(0, 0.2, 0), TINT.packTrim),
          painted(new CylinderGeometry(0.1, 0.13, 0.3, 8).translate(-0.2, -0.48, 0), TINT.packTrim),
          painted(new CylinderGeometry(0.1, 0.13, 0.3, 8).translate(0.2, -0.48, 0), TINT.packTrim),
        ]),
      ),
      packMat,
    );
    kit.caster(pack, false);
    this.pack.add(pack);
    this.pack.position.set(0, 1.0, -0.3);
    this.pack.rotation.x = -0.1;
    this.flameMat = tracker.track(
      new MeshBasicMaterial({
        color: TINT.flame,
        transparent: true,
        opacity: 0.85,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    );
    const flameGeo = tracker.track(
      new ConeGeometry(0.11, 1, 8, 1, true).rotateX(Math.PI).translate(0, -0.5, 0),
    );
    for (const x of [-0.2, 0.2]) {
      const f = new Mesh(flameGeo, this.flameMat);
      f.position.set(x, -0.62, 0);
      f.rotation.x = -0.35;
      this.pack.add(f);
      this.flames.push(f);
    }
    this.apprentice.root.add(this.pack);
    // The glass helmet: a faint shell around the head, brighter at its edge.
    this.helmetMat = tracker.track(
      new MeshBasicMaterial({
        color: TINT.helmet,
        transparent: true,
        opacity: 0.16,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    );
    const helmet = new Mesh(tracker.track(new SphereGeometry(0.34, 18, 12)), this.helmetMat);
    helmet.position.set(0, 1.5, 0.02);
    this.apprentice.root.add(helmet);
    this.lamp = new PointLight(TINT.window, 6, 9, 1.6);
    this.lamp.position.set(0, 2.2, 1.6);
    this.apprentice.root.add(this.lamp);
    root.add(this.apprentice.root);

    this.dyo = new Dyo(kit, {
      body: TINT.dyo,
      shine: TINT.dyoShine,
      eye: TINT.dyoEye,
      pupil: TINT.ink,
    });
    this.dyo.root.scale.setScalar(0.5);
    const bubble = new Mesh(tracker.track(new SphereGeometry(0.75, 16, 10)), this.helmetMat);
    bubble.position.set(0, 0.55, 0);
    this.dyo.root.add(bubble);
    root.add(this.dyo.root);
  }

  // ---- a run --------------------------------------------------------------------------------

  start(): void {
    this.reset();
  }

  /** Forgets everything: the dark station, the dim stars, the apprentice back at the shuttle. */
  private reset(): void {
    const { materials } = this.ctx;
    materials.clearSweeps();
    materials.restoreAll(0, 0);
    this.wordsDone = 0;
    this.strikes = 0;
    this.cleared = 0;
    this.rocksBroken = 0;
    this.docked = 0;
    this.leg = 0;
    this.typedInLeg = 0;
    this.legT = 0;
    this.struckThis = false;
    this.finished = false;
    this.finaleT = -1;
    this.heardTier = 0;
    this.shownLetters = null;
    this.rock.reset();
    this.drift.reset();
    this.shownD = 1;
    this.thrust = 0;
    this.beamT = 0;
    this.beam.visible = false;
    this.starsShown = 0;
    this.drawnLines = 0;
    this.linesShown = 0;
    this.clearShown = 0;
    this.saidDebris = false;
    this.saidStrike = false;
    this.saidCleared = false;
    for (const m of [...this.modules, this.observatory]) {
      m.glow = 0;
      m.glowTarget = 0;
      m.open = 0;
      m.openTarget = 0;
      m.windows.emissiveIntensity = 0;
      m.beacon.color.setHex(TINT.beacon);
      m.beacon.emissive.setHex(TINT.beacon);
    }
    this.domeL.rotation.x = 0;
    this.domeR.rotation.x = 0;
    this.scope.rotation.x = 1.25;
    for (const r of this.rocks) r.visible = false;
    this.lastSky = -1;
    this.applySky(0);
    this.ctx.audio.intensity(0);
  }

  /** A new run with this plan (the screen calls it before the first key, and for every retry). */
  begin(plan: StationPlan): void {
    this.reset();
    this.plan = plan;
    this.chapter = plan.chapters[0]?.id ?? 'outer';
    // Lay the station out for this run: modules in a line, the observatory last.
    const n = Math.max(1, Math.min(MAX_MODULES, plan.modules));
    for (let k = 0; k < MAX_MODULES - 1; k++) {
      const m = this.modules[k] as Module;
      m.root.visible = k < n - 1;
      if (m.root.visible) this.layout(m, k);
    }
    this.layout(this.observatory, n - 1);
    this.cur = 0;
    this.lane = this.pickLane(0);
    this.laneShown = this.lane;
    this.nextLane = this.pickLane(this.lane);
    this.place();
  }

  /** Puts a module at slot `k`: its hull, hatch, the way its debris comes in. */
  private layout(m: Module, k: number): void {
    moduleCenter(k, m.center);
    const len = m.observatory ? 13 : 9;
    const rad = m.observatory ? DOME_R : MODULE_R;
    m.root.position.copy(m.center);
    m.root.rotation.set(0, 0, k % 2 === 0 ? 0.08 : -0.08);
    m.hatch.set(m.center.x, m.center.y + rad + 0.35, m.center.z - len * 0.28);
    const side = k % 2 === 0 ? 1 : -1;
    // At the observatory the debris comes from the side, so the dome stays out of the way.
    if (m.observatory) m.from.set(-side, 0.02, 0.35).normalize();
    else m.from.set(side * 0.38, 0.02, 1).normalize();
    for (const p of m.panels) p.rotation.x = 0;
    m.turret.position.x = m.observatory ? 1.6 : 1.2;
  }

  /** The module of a leg. */
  private moduleOf(leg: Leg | undefined): Module {
    if (!leg || !this.plan) return this.observatory;
    return leg.module >= this.plan.modules - 1
      ? this.observatory
      : ((this.modules[leg.module] as Module | undefined) ?? this.observatory);
  }

  /** A lane on the other side of the last one, so two rocks never come in on the same line. */
  private pickLane(from: number): number {
    const side = from > 0 ? -1 : from < 0 ? 1 : this.rng.next() < 0.5 ? -1 : 1;
    return side * this.rng.range(1.2, 3.2);
  }

  /** Puts the apprentice and the camera where a run starts (by the shuttle). */
  private place(): void {
    this.p0.set(0, 0, 0);
    this.legPath();
    this.apprentice.root.position.copy(this.p0);
    this.apprentice.root.rotation.set(0, 0, 0);
    this.yaw = Math.atan2(this.p1.x - this.p0.x, this.p1.z - this.p0.z);
    this.apprentice.root.rotation.y = this.yaw;
    this.follow();
    this.ctx.rig.cut();
  }

  /** The arc of the current drift: from the last hatch (or the shuttle) up and over to the next. */
  private legPath(): void {
    const plan = this.plan;
    const leg = plan?.legs[this.leg];
    if (!plan || !leg) return;
    const to = this.moduleOf(leg);
    if (leg.module === 0) this.p0.set(0, 0, 0);
    else this.p0.copy(this.moduleOf(plan.legs[this.leg - 1]).hatch);
    this.p1.copy(to.hatch);
    // The control point: above the midpoint, swung out to the side.
    this.pc.addVectors(this.p0, this.p1).multiplyScalar(0.5);
    this.pc.y += 7;
    this.pc.x += (this.p1.x - this.p0.x) * -0.6;
  }

  /** A point on the drift's arc at 0..1. */
  private arc(t: number, out: Vector3): Vector3 {
    const a = 1 - t;
    return out
      .copy(this.p0)
      .multiplyScalar(a * a)
      .addScaledVector(this.pc, 2 * a * t)
      .addScaledVector(this.p1, t * t);
  }

  /** Where the current rock is at distance `d` (world space). */
  private rockAt(d: number, lane: number, out: Vector3): Vector3 {
    const m = this.moduleOf(this.plan?.legs[this.leg]);
    const k = Math.max(0, d);
    const dist = ROCK_NEAR + (ROCK_FAR - ROCK_NEAR) * Math.min(1.3, k);
    // Sideways (in the plane across the line) by the lane, more the farther out it is.
    this.u.crossVectors(m.from, this.up).normalize();
    return out
      .copy(m.hatch)
      .addScaledVector(m.from, dist)
      .addScaledVector(this.u, lane * Math.min(1, k * 1.3))
      .add(this.w.set(0, -1 + k * 0.7, 0));
  }

  onKey(ev: TypedKey): void {
    const { typing, audio, vfx } = this.ctx;
    const kind = this.legKind;
    if (kind === 'turret') this.rock.release();
    if (!ev.correct) {
      // A slip is soft: the letter stumbles, the thruster coughs.
      this.text.miss();
      this.feedback.wrong();
      audio.play('error');
      this.hearTier(typing.tier);
      return;
    }
    if (ev.kind !== 'char') return;
    if (kind === 'drift') {
      // Every right letter is a push of the thrusters.
      this.typedInLeg += 1;
      const plan = this.plan;
      const leg = plan?.legs[this.leg];
      if (plan && leg) this.drift.push(driftAim(this.typedInLeg, legChars(plan, leg)));
      this.thrust = 1;
      this.pack.getWorldPosition(this.v);
      this.u.set(0, -0.4, -1).applyQuaternion(this.apprentice.root.quaternion);
      vfx.burst(this.puff, this.v.x, this.v.y - 0.4, this.v.z, this.u.x, this.u.y, this.u.z);
    }
    if (ev.expected === ' ') {
      audio.play('space');
      return;
    }
    const at = this.text.letterPosition(ev.index, this.v);
    this.text.hit(ev.index);
    this.feedback.correct(at.x, at.y, at.z, this.text.size, typing.tier);
    audio.play('key', typing.combo, ev.expected);
    if (kind === 'turret') {
      // The turret tracks the rock and its scanner sparks on every right letter.
      const r = this.rocks[this.cur];
      if (r) vfx.burst(this.sparks, r.position.x, r.position.y, r.position.z, 0, 1, 0);
    }
    this.hearTier(typing.tier);
  }

  /** The music builds with the combo tier; a new tier rings a chime and a great push. */
  private hearTier(tier: number): void {
    if (tier > this.heardTier) {
      this.ctx.audio.play('tier', tier);
      this.dyo.cheer(2 + tier);
      this.thrust = 1.6;
    }
    this.heardTier = tier;
    this.ctx.audio.intensity(tierIntensity(tier));
  }

  onWord(_word: string, perfect: boolean): void {
    const plan = this.plan;
    if (!plan) return;
    const leg = plan.legs[this.leg];
    if (!leg) return;
    const { vfx, audio } = this.ctx;
    const total = plan.words.length;
    this.wordsDone += 1;
    const a = this.text.anchor;
    this.feedback.word(a.x, a.y, a.z, perfect);
    audio.play(perfect ? 'perfect' : 'word');

    if (leg.kind === 'drift') {
      // A big push at the end of every word.
      this.thrust = 1.8;
      audio.play('thrust');
      this.pack.getWorldPosition(this.v);
      this.u.set(0, -0.4, -1).applyQuaternion(this.apprentice.root.quaternion);
      vfx.burst(this.bigPuff, this.v.x, this.v.y - 0.4, this.v.z, this.u.x, this.u.y, this.u.z);
    } else {
      this.breakRock(perfect);
    }

    if (this.wordsDone >= leg.to) {
      if (leg.kind === 'drift') this.dock(leg);
      else this.online(leg);
      this.leg = Math.min(plan.legs.length - 1, this.leg + 1);
      this.typedInLeg = 0;
      this.legT = 0;
      const next = plan.legs[this.leg];
      if (this.wordsDone < total && next) {
        if (next.kind === 'drift') {
          this.drift.reset();
          this.legPath();
          for (const r of this.rocks) r.visible = false;
        } else {
          this.startRock(true);
        }
      }
      this.chapter = this.chapterNow();
    } else if (leg.kind === 'turret') {
      this.startRock(false);
    }
  }

  /** The turret fires: a beam to the rock, and the rock bursts into gold dust. */
  private breakRock(perfect: boolean): void {
    const { vfx, audio } = this.ctx;
    const rock = this.rocks[this.cur];
    const m = this.moduleOf(this.plan?.legs[this.leg]);
    this.rocksBroken += 1;
    const clean = !this.struckThis;
    if (clean) this.cleared += 1;
    this.struckThis = false;
    if (!rock) return;
    const p = rock.position;
    m.barrel.getWorldPosition(this.v);
    this.u.subVectors(p, this.v);
    const len = this.u.length();
    this.beam.position.copy(this.v);
    this.beam.quaternion.setFromUnitVectors(this.up, this.u.normalize());
    this.beam.scale.set(1, len, 1);
    this.beam.visible = true;
    this.beamT = 0.25;
    this.flashLight.position.copy(p);
    audio.play('laser');
    audio.playAt('shatter', p.x, p.y, p.z);
    vfx.burst(this.shards, p.x, p.y, p.z, 0, 0, 1);
    vfx.burst(this.dust, p.x, p.y, p.z, 0, 1, 0);
    vfx.shockwave(
      p.x,
      p.y,
      p.z,
      perfect ? 5 : 3.5,
      perfect ? this.gold : TINT.beam,
      0.5,
      false,
      1.4,
    );
    vfx.impact(perfect ? 0.4 : 0.28, TINT.beam);
    rock.visible = false;
    if (clean && !this.saidCleared && this.plan?.timers) {
      this.saidCleared = true;
      this.onMoment?.('cleared');
    }
  }

  /** The next rock of this turret sentence comes in (the first one waits a moment). */
  private startRock(first: boolean): void {
    const plan = this.plan;
    if (!plan) return;
    const leg = plan.legs[this.leg];
    if (!leg || leg.kind !== 'turret') return;
    if (!first) {
      this.cur = 1 - this.cur;
      this.lane = this.nextLane;
      this.laneShown = this.nextLane * 1.8;
      this.nextLane = this.pickLane(this.lane);
    }
    this.rock.start(plan.approach[this.wordsDone] ?? null);
    if (first) {
      this.rock.released = false;
      this.shownD = 1.3;
    } else {
      this.rock.release();
      this.shownD = 1.25;
    }
    this.struckThis = false;
    const now = this.rocks[this.cur];
    if (now) {
      now.visible = true;
      now.material = this.rockMat;
      now.scale.setScalar(1);
    }
    const after = this.rocks[1 - this.cur];
    if (after) {
      after.visible = this.wordsDone + 1 < leg.to;
      after.material = this.rockDimMat;
    }
    if (first && !this.saidDebris) {
      this.saidDebris = true;
      this.onMoment?.('debris');
    }
  }

  /** The drift is done: the apprentice docks; the module wakes. */
  private dock(leg: Leg): void {
    const { vfx, audio } = this.ctx;
    const m = this.moduleOf(leg);
    this.docked += 1;
    m.glowTarget = 0.6;
    m.openTarget = 1;
    m.beacon.color.setHex(TINT.beaconGreen);
    m.beacon.emissive.setHex(TINT.beaconGreen);
    this.drift.push(1);
    this.thrust = 0;
    this.sweep();
    const h = m.hatch;
    vfx.shockwave(h.x, h.y, h.z, 3, this.gold, 0.5, false, 1.2);
    vfx.burst(this.sparks, h.x, h.y, h.z, 0, 1, 0);
    audio.play('restore');
    audio.playAt('impact-small', h.x, h.y, h.z);
    this.apprentice.play('cheer');
    this.dyo.cheer(3);
    this.onMoment?.('dock');
  }

  /** The turret sentence is done: the module is back online; a constellation is drawn. */
  private online(leg: Leg): void {
    const { audio } = this.ctx;
    const m = this.moduleOf(leg);
    m.glowTarget = 1.5;
    this.drawnLines = Math.min(CONSTELLATIONS.length, this.drawnLines + 1);
    this.sweep();
    audio.play('success');
    this.dyo.cheer(4);
    for (const r of this.rocks) r.visible = false;
    if (this.plan && this.wordsDone < this.plan.words.length) this.onMoment?.('online');
  }

  /** Color spreads from the shuttle out to the farthest module reached, a little more every time. */
  private sweep(): void {
    const plan = this.plan;
    const total = plan?.words.length ?? 1;
    const share = colorShare(this.wordsDone, total);
    const p = this.apprentice.root.position;
    this.ctx.vfx.restore(0, 0, 0, Math.max(30, p.z + 26 + share * 30), 2);
  }

  private chapterNow(): ChapterId {
    const plan = this.plan;
    if (!plan) return 'outer';
    for (const c of plan.chapters) if (this.wordsDone < c.to) return c.id;
    return plan.chapters.at(-1)?.id ?? 'observatory';
  }

  /** The run is over. A whole run opens the dome; a failed trial leaves the station as it is. */
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
    materials.restoreAll(1, 3.2);
    vfx.restore(0, 0, 0, 900, 3.2);
    const o = this.observatory;
    o.glowTarget = 1.8;
    o.openTarget = 1;
    this.drawnLines = CONSTELLATIONS.length;
    vfx.burst(this.fountain, o.hatch.x, o.hatch.y + 3, o.hatch.z + 3, 0, 1, 0.2);
    audio.play('success');
    audio.intensity(1);
    this.apprentice.play('cheer');
    this.dyo.cheer(6);
    this.ctx.rig.pushIn(0.25, 0.6);
    // Pull back and look up: the dome opening below, the counted sky above.
    const h = o.hatch;
    this.ctx.rig.fixed(
      this.v.set(h.x - 7, h.y + 2.5, h.z - 12),
      this.w.set(h.x, h.y + 6, h.z + 16),
    );
    for (const r of this.rocks) r.visible = false;
  }

  update(dt: number): void {
    this.time += dt;
    const { vfx, audio } = this.ctx;
    const plan = this.plan;
    const total = plan?.words.length ?? 0;
    const app = this.apprentice.root;
    const leg = plan?.legs[this.leg];
    const kind = this.legKind;
    this.legT += dt;

    // --- The debris at the turret.
    if (plan && kind === 'turret') {
      if (!this.rock.released && this.legT > TURRET_GRACE) this.rock.release();
      if (this.rock.step(dt) === 'struck') this.strike();
    }
    this.shownD = damp(this.shownD, this.rock.distance, this.rock.strikes > 0 ? 5 : 10, dt);

    // --- The apprentice: drifting along the arc, or at the turret by the hatch.
    this.drift.step(dt);
    this.thrust = Math.max(0, this.thrust - dt * 2.5);
    const bob = Math.sin(this.time * 0.9) * 0.08;
    if (kind === 'drift' && leg) {
      this.arc(this.drift.at, this.v);
      app.position.set(this.v.x, this.v.y + bob, this.v.z);
      // Face along the arc (a little ahead of where he is).
      this.arc(Math.min(1, this.drift.at + 0.05), this.w);
      this.face.subVectors(this.w, this.v);
      if (this.face.lengthSq() < 1e-6) this.face.subVectors(this.p1, this.p0);
    } else {
      const m = this.moduleOf(leg ?? plan?.legs.at(-1));
      // At the end he floats up over the dome to watch it open.
      const t = this.finished ? Math.min(1, Math.max(0, this.finaleT / 3.5)) : 0;
      const lift = t * t * (3 - 2 * t);
      app.position.set(m.hatch.x, m.hatch.y + bob + lift * 3.2, m.hatch.z + lift * 1.5);
      if (this.finished) this.face.set(0.1, 0, 1);
      else this.face.copy(m.from);
    }
    const want = Math.atan2(this.face.x, this.face.z);
    let d = want - this.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.yaw += d * Math.min(1, dt * 2.5);
    app.rotation.y = this.yaw;
    // Weightless: a slow roll, a lean forward while the thrusters burn.
    app.rotation.z = Math.sin(this.time * 0.5) * 0.06;
    app.rotation.x = damp(app.rotation.x, kind === 'drift' ? 0.18 + this.thrust * 0.12 : 0, 2, dt);
    for (const f of this.flames) {
      const k = 0.15 + this.thrust * 0.6 + Math.sin(this.time * 40 + f.position.x * 9) * 0.05;
      f.scale.set(1, k, 1);
    }
    this.flameMat.opacity = 0.35 + Math.min(1, this.thrust) * 0.55;
    this.apprentice.update(dt);

    // Dyo floats beside him in his bubble.
    this.u.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    this.dyo.root.position.set(
      app.position.x + this.u.x * 1.15,
      app.position.y + 1.5 + Math.sin(this.time * 1.3 + 1) * 0.15,
      app.position.z + this.u.z * 1.15,
    );
    this.dyo.root.rotation.z = Math.sin(this.time * 0.7) * 0.2;
    this.dyo.update(dt);

    // --- The rocks.
    const cur = this.rocks[this.cur];
    if (cur && cur.visible) {
      this.laneShown = damp(this.laneShown, this.lane, 2.2, dt);
      this.rockAt(this.shownD, this.laneShown, cur.position);
      cur.rotation.x += dt * 0.5;
      cur.rotation.y += dt * 0.7;
      const near = 1 - Math.min(1, this.shownD);
      cur.scale.setScalar(1 + near * 0.2);
      this.rockMat.emissiveIntensity =
        0.04 + near * 0.16 + Math.max(0, Math.sin(this.time * 6)) * near * 0.24;
      const m = this.moduleOf(leg);
      m.barrel.lookAt(cur.position);
    }
    const next = this.rocks[1 - this.cur];
    if (next && next.visible) {
      this.rockAt(1.3, this.nextLane * 1.8, next.position);
      next.rotation.y += dt * 0.3;
    }
    this.beamT = Math.max(0, this.beamT - dt);
    this.beamMat.opacity = Math.min(1, this.beamT * 6);
    if (this.beamT <= 0) this.beam.visible = false;
    this.flashLight.intensity = this.beamT * 320;

    // --- The debris field tumbles.
    for (let k = 0; k < DEBRIS; k++) {
      const o = k * 7;
      const spin = (this.debrisBase[o + 6] as number) + this.time * 0.2;
      this.v.set(
        (this.debrisBase[o] as number) + Math.sin(this.time * 0.05 + k) * 1.5,
        (this.debrisBase[o + 1] as number) + Math.sin(this.time * 0.07 + k * 2) * 1.2,
        this.debrisBase[o + 2] as number,
      );
      this.w.set(this.debrisBase[o + 4] as number, 1, this.debrisBase[o + 5] as number).normalize();
      this.q.setFromAxisAngle(this.w, spin);
      const sz = this.debrisBase[o + 3] as number;
      this.s.set(sz, sz, sz);
      this.debris.setMatrixAt(k, this.m4.compose(this.v, this.q, this.s));
    }
    this.debris.instanceMatrix.needsUpdate = true;

    // --- The modules: windows warm up, solar wings unfold, the ring turns.
    for (const m of this.modules) this.wake(m, dt);
    this.wake(this.observatory, dt);
    this.ring.rotation.z += dt * 0.05;
    this.shuttle.rotation.z = 0.1 + Math.sin(this.time * 0.3) * 0.03;

    // --- The sky: stars come back word by word, the nebulae glow, the constellations are drawn.
    const lit = this.finished ? STARS : starsLit(this.wordsDone, total);
    this.starsShown = damp(this.starsShown, lit, 1.6, dt);
    this.litStars.geometry.setDrawRange(0, Math.round(this.starsShown));
    const clear = this.finished ? 1 : colorShare(this.wordsDone, total) * 0.7;
    this.clearShown = damp(this.clearShown, clear, this.finished ? 0.7 : 1, dt);
    this.applySky(this.clearShown);
    for (const n of this.nebulae) n.opacity = 0.1 + this.clearShown * 0.45;
    this.rimMat.opacity = 0.1 + this.clearShown * 0.25;
    this.dimMat.opacity = 0.4 - this.clearShown * 0.25;
    this.brightMat.opacity = 0.3 + (this.drawnLines / CONSTELLATIONS.length) * 0.7;
    this.linesShown = damp(this.linesShown, this.drawnLines, 1.2, dt);
    let segs = 0;
    const whole = Math.floor(this.linesShown);
    for (let k = 0; k < CONSTELLATIONS.length; k++) {
      const c = CONSTELLATIONS[k] as (typeof CONSTELLATIONS)[number];
      const n = c.lines.length;
      if (k < whole) segs += n;
      else if (k === whole) segs += Math.floor((n * (this.linesShown - whole)) / 2) * 2;
    }
    this.lines.geometry.setDrawRange(0, segs);
    this.lineMat.opacity = 0.55 + Math.sin(this.time * 1.4) * 0.1 + this.clearShown * 0.35;
    this.sunMat.opacity = 0.55 + this.clearShown * 0.45;

    // --- The finale: the dome parts, the telescope turns up to the stars.
    if (this.finaleT >= 0) {
      const was = this.finaleT;
      this.finaleT += dt;
      const o = this.observatory.hatch;
      if (was < 1 && this.finaleT >= 1)
        vfx.burst(this.fountain, o.x - 3, o.y + 4, o.z + 4, 0, 1, 0);
      if (was < 1.8 && this.finaleT >= 1.8) {
        vfx.burst(this.fountain, o.x + 3, o.y + 5, o.z + 5, 0, 1, 0);
        audio.play('tier', 4);
      }
    }
    const open = this.finished ? Math.min(1, Math.max(0, (this.finaleT - 0.3) / 2.2)) : 0;
    const ease = open * open * (3 - 2 * open);
    this.domeL.rotation.x = ease * 1.45;
    this.domeR.rotation.x = -ease * 1.45;
    this.scope.rotation.x = 1.25 - ease * 0.85;

    if (this.hum) this.hum.move(app.position.x, app.position.y, app.position.z);
  }

  /** A module wakes: its windows warm up and its solar wings unfold. */
  private wake(m: Module, dt: number): void {
    m.glow = damp(m.glow, m.glowTarget, 1.5, dt);
    m.open = damp(m.open, m.openTarget, 1.1, dt);
    m.windows.emissiveIntensity = m.glow * (0.9 + Math.sin(this.time * 2 + m.center.z) * 0.05);
    const fold = 1 - m.open;
    const l = m.panels[0];
    const r = m.panels[1];
    if (l) {
      l.rotation.z = fold * 1.35;
      l.scale.x = 0.25 + m.open * 0.75;
    }
    if (r) {
      r.rotation.z = -fold * 1.35;
      r.scale.x = 0.25 + m.open * 0.75;
    }
    m.beacon.emissiveIntensity = 0.6 + Math.max(0, Math.sin(this.time * 3 + m.center.z)) * 1.4;
  }

  /** A rock reached the hull before its word was done. */
  private strike(): void {
    const { vfx, audio } = this.ctx;
    this.strikes += 1;
    this.struckThis = true;
    const rock = this.rocks[this.cur];
    const p = rock ? rock.position : this.apprentice.root.position;
    vfx.burst(this.shards, p.x, p.y, p.z, 0, 1, 0);
    vfx.burst(this.sparks, p.x, p.y, p.z, 0, 1, -1);
    vfx.impact(0.55, TINT.scrap);
    audio.playAt('impact', p.x, p.y, p.z);
    this.ctx.rig.shake(0.35);
    this.apprentice.play('stagger');
    this.onStrike?.();
    if (!this.saidStrike) {
      this.saidStrike = true;
      this.onMoment?.('strike');
    }
  }

  frame(dt: number): void {
    const { typing } = this.ctx;
    this.sky.position.copy(this.ctx.engine.camera.position);
    // Dyo looks at the apprentice.
    const app = this.apprentice.root.position;
    this.dyo.face(app.x, app.z);

    // The word: on the rock at the turret, or ahead of the apprentice while he drifts.
    const a = this.text.anchor;
    const cur = this.rocks[this.cur];
    if (this.legKind === 'turret' && cur && cur.visible) {
      a.set(cur.position.x, cur.position.y + 1.7, cur.position.z);
      this.text.size = damp(this.text.size, ROCK_LETTER, 6, dt);
    } else {
      this.u.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      a.set(app.x + this.u.x * 3.6, app.y + 2.3, app.z + this.u.z * 3.6);
      this.text.size = damp(this.text.size, LETTER_SIZE, 6, dt);
    }
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
    this.feedback.frame(dt);
  }

  dispose(): void {
    this.hum?.stop();
    this.hum = null;
    if (this.ctx) this.ctx.atmosphere.groundAt = () => 0;
    this.apprentice?.dispose();
    this.dyo?.dispose();
    this.text?.dispose();
    this.feedback?.dispose();
    this.shownLetters = null;
    this.onMoment = null;
    this.onStrike = null;
    this.plan = null;
  }
}
