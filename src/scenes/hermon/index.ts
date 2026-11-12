// Wings over Hermon (T21): the fifth region of Act Two.
//
// A flight on a great eagle up the valley to Mount Hermon, through a thunderstorm. The view is
// the rider's: the eagle's golden nape and hooked beak ahead, its wings beating at the edges of
// the picture, Dyo clinging to the feathers of its neck. The Fading has frozen the words of the
// land into hailstones. They come down out of the clouds one at a time, each carrying one word
// on a strip of parchment; finish the word before the stone reaches the eagle and it bursts into
// gold rain that brings the color back to the valley far below. The next stone waits dark inside
// the cloud, and only a flash of lightning shows its word. As the run goes on the storm breaks:
// the rain thins, the clouds draw apart, and at the end the evening sun comes out over the snow
// of Hermon with a rainbow across the valley.
//
// On Calm a stone stops in the air and waits. On the other difficulties a stone that lands
// strikes the eagle (the streak drops; the screen is told through `onStrike`), and a beat of the
// wings throws it back up to fall again, slower. The typing is judged by the host
// (PlayController); this scene only reacts, and learns the shape of the run from `begin(plan)`.

import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  type MeshLambertMaterial,
  PlaneGeometry,
  PointLight,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  burstStyle,
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
import { CLEAR, RAINBOW, STORM, TINT } from './palette';
import {
  breaksOpen,
  caughtPercent,
  colorShare,
  flashGap,
  Hail,
  revealOf,
  SECTIONS,
  stormAt,
  type ChapterId,
  type HermonPlan,
} from './plan';

export interface HermonSetup {
  /** Nothing about the apprentice shows in the rider's view; kept for the shared scene shape. */
  look: { robe: number; hem: number; trim: number; headwear: 'cap' | 'hat' | 'turban' };
}

/** Things the screen may want to say something about. */
export type HermonEvent = 'lightning' | 'strike' | 'break' | 'caught';

/** How high the eagle flies over the valley floor. */
const ALT = 36;
/** Flight distance per stone. */
const STONE_GAP = 26;
/** Cruising speed, units per second. */
const FLY_SPEED = 5.5;
/** Where a stone is, relative to the eagle, at the top of its fall and when it lands. */
const FALL_H = 13;
const TOP_Z = 27;
const LAND_Z = 5.2;
const LAND_Y = 1.3;
/** Where the next stone waits inside the cloud (as a fall height above 1). */
const NEXT_H = 1.32;
const LETTER_SIZE = 1.25;
const NEXT_SIZE = 1.05;
/** The rider's seat on the eagle (the cockpit camera). */
const SEAT = new Vector3(0, 2.5, -4.9);
const CEILING = 120;
const SCUD = 26;
const RAIN = 520;
const TREES = 150;
const HOUSES = 46;
const HERMON_Z = 560;
const VALLEY_LEN = 760;

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

/** Height of the land at (x, z): a green valley between ridges, rising to Hermon at the end. */
export function landHeight(x: number, z: number): number {
  const ax = Math.abs(x);
  const wall = Math.max(0, ax - 34);
  const ridge = wall * wall * 0.03 + Math.max(0, ax - 60) * 0.9;
  const bumps =
    Math.sin(x * 0.05 + z * 0.021) * 3 +
    Math.sin(z * 0.043 + 1.3) * Math.cos(x * 0.031) * 4 +
    Math.sin(x * 0.17 + z * 0.13) * 0.8;
  const peaks = ax > 50 ? Math.max(0, Math.sin(z * 0.018 + x * 0.01) * 22 + 8) : 0;
  // The valley climbs toward the mountain at its far end.
  const climb = Math.max(0, z - 300) * 0.06;
  return Math.max(-1, ridge + bumps + peaks * Math.min(1, wall / 30) + climb);
}

/** The river's line down the valley. */
function riverX(z: number): number {
  return Math.sin(z * 0.017) * 14 + Math.sin(z * 0.05 + 2) * 4;
}

export class HermonScene implements GameScene {
  readonly id = 'hermon';
  /** Told when something worth a line happens. */
  onMoment: ((moment: HermonEvent) => void) | null = null;
  /** Told when a stone lands on the eagle (only on difficulties with timers). */
  onStrike: (() => void) | null = null;

  private ctx!: SceneContext;
  private readonly rng = new Rng(2814);
  private plan: HermonPlan | null = null;
  private dyo!: Dyo;
  private text!: WorldText;
  private nextText!: WorldText;
  private feedback!: TypingFeedback;
  private shownLetters: readonly string[] | null = null;
  private nextWordShown = -1;
  private wind: AmbienceHandle | null = null;

  // The eagle.
  private readonly eagle = new Group();
  private readonly wingL = new Group();
  private readonly wingR = new Group();
  private readonly tipL = new Group();
  private readonly tipR = new Group();
  private readonly head = new Group();
  private flap = 0;
  private flapPower = 0.4;
  private beat = 0;
  private roll = 0;
  private jolt = 0;
  private speed = FLY_SPEED;

  // The hail.
  private readonly hail = new Hail();
  private readonly stones: Mesh[] = [];
  private iceMat!: MeshLambertMaterial;
  private iceDarkMat!: MeshLambertMaterial;
  /** Which of the two stone meshes is the current one. */
  private cur = 0;
  private shownH = 1;
  private nextShownH = NEXT_H + 0.5;
  private lane = 0;
  private nextLane = 0;
  private broken = 0;
  private struckThis = false;

  // The storm.
  private ceiling!: InstancedMesh;
  private readonly ceilingBase = new Float32Array(CEILING * 4);
  private cloudMat!: MeshLambertMaterial;
  private scud!: InstancedMesh;
  private readonly scudPos = new Float32Array(SCUD * 4);
  private scudMat!: MeshLambertMaterial;
  private rain!: LineSegments;
  private rainMat!: LineBasicMaterial;
  private readonly rainPos = new Float32Array(RAIN * 3);
  private readonly bolts: Mesh[] = [];
  private boltMat!: MeshBasicMaterial;
  private boltT = 0;
  private flashIn = 2;
  private sinceFlash = 99;
  private flashGlow = 0;
  private thunderIn = -1;
  private flashLight!: PointLight;
  private rainbow!: Mesh;
  private rainbowMat!: MeshBasicMaterial;
  private sunLight!: PointLight;
  private storm = 1;
  private stormShown = 1;
  private clearShown = 0;
  private partShown = 0;
  private readonly palette: ScenePalette = { ...STORM.light, sunFrom: [0, 1, 0], fade: 0, ink: 0 };
  private readonly ca = new Color();
  private readonly cb = new Color();
  private lastSky = -1;

  // The run.
  private wordsDone = 0;
  private strikes = 0;
  private caught = 0;
  private chapter: ChapterId | 'finale' = 'gathering';
  private finished = false;
  private heardTier = 0;
  private time = 0;
  private finaleT = -1;
  private saidLightning = false;
  private saidStrike = false;
  private saidCaught = false;
  private released = false;

  private gold = 0;
  private techelet = 0;
  private paper = 0;
  private inkDark = 0;
  private sparks!: BurstStyle;
  private shards!: BurstStyle;
  private goldRain!: BurstStyle;
  private fountain!: BurstStyle;
  private feathers!: BurstStyle;

  private readonly v = new Vector3();
  private readonly w = new Vector3();
  private readonly m4 = new Matrix4();
  private readonly q = new Quaternion();
  private readonly s = new Vector3();

  constructor(private readonly setup: HermonSetup) {}

  // ---- probes (the screen and the smoke test read these) -------------------------------------

  /** Height of the falling stone (1 = just out of the cloud, 0 = it lands). */
  get stoneHeight(): number {
    return this.hail.height;
  }

  /** Stones that struck the eagle, over the whole run. */
  get strikesTotal(): number {
    return this.strikes;
  }

  /** Stones finished before they ever struck. */
  get stonesCaught(): number {
    return this.caught;
  }

  /** Stones caught in the air, as a percent of the stones finished. */
  get caughtShare(): number {
    return caughtPercent(this.caught, this.wordsDone);
  }

  /** 0..1: how readable the next word is now (a flash of lightning shows it). */
  get reveal(): number {
    return this.finished ? 0 : revealOf(this.sinceFlash);
  }

  /** How wild the storm is (0..1). */
  get stormNow(): number {
    return this.storm;
  }

  /** Breaks in the clouds (0..SECTIONS). */
  get breaksOn(): number {
    return this.finished ? SECTIONS : breaksOpen(this.wordsDone, this.plan?.stones.length ?? 0);
  }

  /** Distance flown. */
  get flown(): number {
    return this.eagle.position.z;
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

    ctx.audio.music('hermon');
    ctx.audio.intensity(0);
    this.wind = ctx.audio.ambience('wind');

    this.palette.fade = ctx.color('fade');
    this.palette.ink = this.gold;
    this.lastSky = -1;
    this.applySky(0);
    ctx.atmosphere.groundAt = (x, z) => landHeight(x, z);
    ctx.atmosphere.setShadowRange(24);
    ctx.post.setGrade(
      ctx.theme === 'dark'
        ? { exposure: 1.25, saturation: 1.1, vignette: 0.55, godRays: 0.9, bloom: 1.25 }
        : { exposure: 1.05, saturation: 1.12, vignette: 0.48, godRays: 1, bloom: 1.2 },
    );

    this.sparks = burstStyle({
      count: 10,
      color: TINT.shard,
      color2: TINT.gold,
      intensity: 2.4,
      speed: [1.5, 4],
      spread: 1,
      life: [0.3, 0.7],
      size: [0.04, 0.1],
      gravity: 2,
    });
    this.shards = burstStyle({
      count: 40,
      color: TINT.shard,
      color2: TINT.iceDeep,
      intensity: 1.8,
      speed: [3, 9],
      spread: 1,
      life: [0.5, 1.2],
      size: [0.08, 0.22],
      gravity: 9,
    });
    this.goldRain = burstStyle({
      count: 60,
      color: TINT.goldRain,
      color2: TINT.gold,
      intensity: 2.8,
      speed: [2, 7],
      spread: 0.55,
      life: [1.4, 2.6],
      size: [0.08, 0.2],
      gravity: 7,
      radius: 0.8,
    });
    this.fountain = burstStyle({
      count: 80,
      color: TINT.gold,
      color2: TINT.goldRain,
      intensity: 3,
      speed: [3, 9],
      spread: 0.9,
      life: [1, 2.2],
      size: [0.08, 0.2],
      gravity: 3,
    });
    this.feathers = burstStyle({
      count: 8,
      color: TINT.feather,
      color2: TINT.nape,
      intensity: 0.9,
      speed: [1, 3],
      spread: 1,
      life: [0.8, 1.6],
      size: [0.08, 0.16],
      gravity: 1.5,
    });

    this.buildLand();
    this.buildMountain();
    this.buildStorm();
    this.buildEagle();
    this.buildHail();
    this.buildRainbow();

    this.flashLight = new PointLight(TINT.bolt, 0, 120, 1.2);
    this.sunLight = new PointLight(TINT.gold, 0, 60, 1.5);
    root.add(this.flashLight, this.sunLight);

    // Dyo rides on the eagle's neck, facing the rider.
    this.dyo = new Dyo(kit, {
      body: TINT.dyo,
      shine: TINT.dyoShine,
      eye: TINT.dyoEye,
      pupil: TINT.ink,
    });
    this.dyo.root.scale.setScalar(0.42);
    this.dyo.root.position.set(0.55, 1.42, 1.15);
    this.dyo.root.rotation.y = Math.PI;
    this.eagle.add(this.dyo.root);

    // The word to type, on a parchment strip under the falling stone; the next one inside the
    // cloud, cut in dark ice (only lightning shows it).
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
    this.nextText = new WorldText({
      atlas: ctx.engine.atlas,
      materials: kit,
      billboard: ctx.vfx.billboard,
      colors: { ...colors, stone: TINT.iceDark, paper: TINT.shard },
      style: 'carved',
      size: NEXT_SIZE,
    });
    root.add(this.text.root, this.nextText.root);
    this.nextText.root.visible = false;
    this.feedback = new TypingFeedback(ctx, {
      gold: this.gold,
      ink: this.inkDark,
      techelet: this.techelet,
    });

    // The rider's view.
    ctx.rig.cockpit(this.eagle, { seat: SEAT, sway: 0.6 });
    this.place();
  }

  /** Blends the sky from storm (0) to clear evening (1). Cheap: only when it changed. */
  private applySky(k: number): void {
    if (Math.abs(k - this.lastSky) < 0.004) return;
    this.lastSky = k;
    const a = STORM[this.ctx.theme];
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
    p.fogFalloff = a.fogFalloff + (b.fogFalloff - a.fogFalloff) * k;
    p.inscatter = a.inscatter + (b.inscatter - a.inscatter) * k;
    this.ctx.atmosphere.setPalette(p);
  }

  /** The valley: fields and a river between ridges, orchards, villages of stone houses. */
  private buildLand(): void {
    const { materials: kit, tracker, root } = this.ctx;
    const r = this.rng;
    const geo = new PlaneGeometry(420, VALLEY_LEN, 70, 130).rotateX(-Math.PI / 2);
    geo.translate(0, 0, VALLEY_LEN / 2 - 120);
    const pos = geo.getAttribute('position');
    const colors = new Float32Array(pos.count * 3);
    const a = new Color();
    const b = new Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      let y = landHeight(x, z);
      const river = Math.abs(x - riverX(z));
      if (river < 4) y = Math.min(y, -0.6 + river * 0.1);
      pos.setY(i, y);
      // Fields in strips, darker orchards, bare rock up the ridges and snow on top.
      const field = Math.sin(x * 0.12 + Math.floor(z / 18) * 1.7) > 0.2;
      a.setHex(field ? TINT.grass : TINT.grassDark);
      if (y > 14) a.lerp(b.setHex(TINT.rock), Math.min(1, (y - 14) / 12));
      if (y > 34) a.lerp(b.setHex(TINT.rockDark), Math.min(1, (y - 34) / 10) * 0.6);
      if (y > 52) a.lerp(b.setHex(TINT.snow), Math.min(1, (y - 52) / 8));
      if (river < 3) a.setHex(TINT.river);
      a.multiplyScalar(0.9 + r.next() * 0.16);
      colors[i * 3] = a.r;
      colors[i * 3 + 1] = a.g;
      colors[i * 3 + 2] = a.b;
    }
    geo.setAttribute('color', new BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const ground = new Mesh(tracker.track(geo), tracker.track(kit.surface({ vertexColors: true })));
    ground.receiveShadow = true;
    root.add(ground);

    // Orchards: round-topped trees in the valley.
    const tree = merged([
      painted(new CylinderGeometry(0.25, 0.35, 1.6, 5).translate(0, 0.8, 0), TINT.rockDark),
      painted(new IcosahedronGeometry(1.5, 0).translate(0, 2.4, 0), TINT.orchard),
    ]);
    const trees = new InstancedMesh(
      tracker.track(tree),
      tracker.track(kit.surface({ vertexColors: true })),
      TREES,
    );
    for (let k = 0; k < TREES; k++) {
      const z = r.range(-60, 460);
      const x = riverX(z) + (r.next() < 0.5 ? -1 : 1) * r.range(6, 30);
      const s = r.range(0.8, 1.6);
      this.v.set(x, landHeight(x, z) - 0.2, z);
      this.q.setFromAxisAngle(this.w.set(0, 1, 0), r.range(0, 6.28));
      this.s.set(s, s, s);
      trees.setMatrixAt(k, this.m4.compose(this.v, this.q, this.s));
    }
    kit.caster(trees, false);
    root.add(trees);

    // Villages: little stone houses with red roofs, in clusters along the river.
    const house = merged([
      painted(new BoxGeometry(2.4, 1.8, 2.4).translate(0, 0.9, 0), TINT.wall),
      painted(new ConeGeometry(2, 1.2, 4).rotateY(Math.PI / 4).translate(0, 2.4, 0), TINT.roof),
    ]);
    const houses = new InstancedMesh(
      tracker.track(house),
      tracker.track(kit.surface({ vertexColors: true })),
      HOUSES,
    );
    for (let k = 0; k < HOUSES; k++) {
      const village = Math.floor(k / 6);
      const cz = 30 + village * 62;
      const z = cz + r.range(-8, 8);
      const x = riverX(cz) + (village % 2 === 0 ? 12 : -12) + r.range(-7, 7);
      this.v.set(x, landHeight(x, z) - 0.1, z);
      this.q.setFromAxisAngle(this.w.set(0, 1, 0), r.range(0, 6.28));
      const s = r.range(0.8, 1.3);
      this.s.set(s, s, s);
      houses.setMatrixAt(k, this.m4.compose(this.v, this.q, this.s));
    }
    kit.caster(houses, false);
    root.add(houses);
  }

  /** Mount Hermon at the end of the valley: a broad snowy mountain with lesser peaks. */
  private buildMountain(): void {
    const { materials: kit, tracker, root } = this.ctx;
    const parts: BufferGeometry[] = [];
    const peak = (x: number, z: number, radius: number, height: number, seed: number): void => {
      const g = new ConeGeometry(radius, height, 28, 12).toNonIndexed();
      const pos = g.getAttribute('position');
      const colors = new Float32Array(pos.count * 3);
      const c = new Color();
      const d = new Color();
      for (let i = 0; i < pos.count; i++) {
        const px = pos.getX(i);
        const py = pos.getY(i) + height / 2;
        const pz = pos.getZ(i);
        const ang = Math.atan2(pz, px);
        const rough = 1 + Math.sin(ang * 5 + seed) * 0.08 + Math.sin(ang * 13 + seed * 2) * 0.04;
        const k = py < height - 0.01 ? rough : 1;
        pos.setXYZ(i, px * k + x, py - 4, pz * k + z);
        const h = py / height;
        c.setHex(TINT.rock).lerp(
          d.setHex(TINT.rockDark),
          Math.max(0, Math.sin(ang * 7 + seed)) * 0.4,
        );
        const snowLine = 0.52 + Math.sin(ang * 6 + seed) * 0.06;
        if (h > snowLine) c.lerp(d.setHex(h > snowLine + 0.08 ? TINT.snow : TINT.snowShade), 1);
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
      }
      g.setAttribute('color', new BufferAttribute(colors, 3));
      g.deleteAttribute('uv');
      g.computeVertexNormals();
      parts.push(g);
    };
    peak(0, HERMON_Z, 170, 165, 1);
    peak(-120, HERMON_Z - 40, 110, 110, 2);
    peak(130, HERMON_Z - 20, 120, 120, 3);
    peak(-200, HERMON_Z - 140, 90, 85, 4);
    peak(210, HERMON_Z - 120, 100, 95, 5);
    const mountain = new Mesh(
      tracker.track(merged(parts)),
      tracker.track(kit.surface({ vertexColors: true })),
    );
    kit.caster(mountain, false);
    root.add(mountain);
  }

  /** The storm: a ceiling of cloud, low scud racing past, the rain, and the lightning bolts. */
  private buildStorm(): void {
    const { materials: kit, tracker, root } = this.ctx;
    const r = this.rng;
    this.cloudMat = tracker.track(
      kit.surface({
        color: TINT.cloud,
        emissive: TINT.bolt,
        emissiveIntensity: 0,
        restore: false,
        lift: 0.35,
      }),
    );
    this.ceiling = new InstancedMesh(
      tracker.track(new IcosahedronGeometry(1, 1)),
      this.cloudMat,
      CEILING,
    );
    for (let k = 0; k < CEILING; k++) {
      // x, y, z and a size; puffs over the valley part as the storm breaks.
      this.ceilingBase[k * 4] = r.range(-150, 150);
      this.ceilingBase[k * 4 + 1] = ALT + r.range(19, 34);
      this.ceilingBase[k * 4 + 2] = r.range(-40, 520);
      this.ceilingBase[k * 4 + 3] = r.range(9, 20);
    }
    kit.caster(this.ceiling, false);
    root.add(this.ceiling);

    this.scudMat = tracker.track(
      kit.surface({
        color: TINT.cloudDark,
        emissive: TINT.bolt,
        emissiveIntensity: 0,
        restore: false,
        lift: 0.4,
        transparent: true,
        opacity: 0.85,
      }),
    );
    this.scud = new InstancedMesh(tracker.track(new IcosahedronGeometry(1, 1)), this.scudMat, SCUD);
    for (let k = 0; k < SCUD; k++) this.respawnScud(k, r.range(-10, 140));
    kit.caster(this.scud, false);
    root.add(this.scud);

    // Rain: short streaks around the rider, moved every frame (one draw call).
    const rainGeo = new BufferGeometry();
    rainGeo.setAttribute('position', new BufferAttribute(new Float32Array(RAIN * 6), 3));
    for (let k = 0; k < RAIN; k++) {
      this.rainPos[k * 3] = r.range(-26, 26);
      this.rainPos[k * 3 + 1] = r.range(-18, 26);
      this.rainPos[k * 3 + 2] = r.range(-6, 60);
    }
    this.rainMat = tracker.track(
      new LineBasicMaterial({
        color: TINT.rain,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
        fog: false,
      }),
    );
    this.rain = new LineSegments(tracker.track(rainGeo), this.rainMat);
    this.rain.frustumCulled = false;
    root.add(this.rain);

    // Three lightning bolts (one shows at a time), jagged ribbons with a branch or two.
    this.boltMat = tracker.track(
      new MeshBasicMaterial({
        color: new Color(TINT.bolt).multiplyScalar(3),
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
        fog: false,
        toneMapped: false,
        side: 2,
      }),
    );
    for (let b = 0; b < 3; b++) {
      const parts: BufferGeometry[] = [];
      const ribbon = (x0: number, y0: number, len: number, width: number, steps: number): void => {
        let x = x0;
        let y = y0;
        for (let i = 0; i < steps; i++) {
          const nx = x + r.range(-1, 1) * len * 0.35;
          const ny = y - len;
          const dx = nx - x;
          const dy = ny - y;
          const l = Math.hypot(dx, dy);
          const seg = new PlaneGeometry(width, l);
          seg.rotateZ(Math.atan2(dx, -dy) * -1);
          seg.translate((x + nx) / 2, (y + ny) / 2, 0);
          parts.push(seg);
          if (i > 1 && r.next() < 0.22) ribbon(nx, ny, len * 0.6, width * 0.6, 3);
          x = nx;
          y = ny;
        }
      };
      ribbon(0, 0, 4.5, 0.55, 11);
      const bolt = new Mesh(tracker.track(merged(parts)), this.boltMat);
      bolt.visible = false;
      bolt.renderOrder = 3;
      root.add(bolt);
      this.bolts.push(bolt);
    }
  }

  /** Puts scud cloud `k` ahead of the eagle at `ahead` units. */
  private respawnScud(k: number, ahead: number): void {
    const r = this.rng;
    const side = r.next() < 0.5 ? -1 : 1;
    this.scudPos[k * 4] = side * r.range(9, 46);
    this.scudPos[k * 4 + 1] = r.range(-14, 9);
    this.scudPos[k * 4 + 2] = ahead;
    this.scudPos[k * 4 + 3] = r.range(2.5, 6);
  }

  /** The great eagle: body, golden nape, hooked beak, broad fingered wings that beat. */
  private buildEagle(): void {
    const { materials: kit, tracker, root } = this.ctx;
    const mat = tracker.track(kit.surface({ vertexColors: true, restore: false, lift: 0.22 }));
    const body = merged([
      painted(new SphereGeometry(1, 12, 9).scale(1.25, 0.95, 2.6), TINT.feather),
      painted(
        new SphereGeometry(1, 10, 8).scale(1.05, 0.7, 1.6).translate(0, 0.35, -0.6),
        TINT.featherDark,
      ),
      // The tail, fanned out behind.
      painted(
        new ConeGeometry(1.3, 2.8, 6, 1)
          .rotateX(-Math.PI / 2)
          .scale(1.4, 0.25, 1)
          .translate(0, 0.1, -3.4),
        TINT.featherTip,
      ),
      // The neck, gold toward the head.
      painted(
        new CylinderGeometry(0.62, 0.9, 1.9, 9).rotateX(Math.PI / 2 - 0.5).translate(0, 0.65, 2.1),
        TINT.nape,
      ),
    ]);
    const bodyMesh = new Mesh(tracker.track(body), mat);
    kit.caster(bodyMesh, true);
    this.eagle.add(bodyMesh);

    const headGeo = merged([
      painted(new SphereGeometry(0.72, 10, 8).scale(1, 0.9, 1.15), TINT.napeLight),
      painted(new SphereGeometry(0.5, 8, 6).scale(1.1, 0.7, 1).translate(0, 0.35, -0.2), TINT.nape),
      painted(
        new ConeGeometry(0.28, 0.9, 6).rotateX(Math.PI / 2).translate(0, -0.1, 0.95),
        TINT.beak,
      ),
      painted(
        new ConeGeometry(0.14, 0.4, 5).rotateX(Math.PI * 0.8).translate(0, -0.35, 1.32),
        TINT.beakTip,
      ),
      painted(new SphereGeometry(0.09, 6, 5).translate(0.42, 0.12, 0.45), TINT.eye),
      painted(new SphereGeometry(0.09, 6, 5).translate(-0.42, 0.12, 0.45), TINT.eye),
    ]);
    const headMesh = new Mesh(tracker.track(headGeo), mat);
    this.head.add(headMesh);
    this.head.position.set(0, 1.2, 3.1);
    this.eagle.add(this.head);

    // Each wing: an inner arm and an outer hand with five fingered primaries, on two pivots.
    const inner = (side: number): BufferGeometry =>
      merged([
        painted(new BoxGeometry(4.2, 0.24, 2.3).translate((side * 4.2) / 2, 0, -0.1), TINT.feather),
        painted(
          new BoxGeometry(4.2, 0.1, 0.9).translate((side * 4.2) / 2, -0.12, -1.4),
          TINT.featherDark,
        ),
        painted(new BoxGeometry(3.6, 0.28, 0.7).translate((side * 3.6) / 2, 0.12, 0.85), TINT.nape),
      ]);
    const outer = (side: number): BufferGeometry => {
      const parts = [
        painted(new BoxGeometry(2.4, 0.18, 1.9).translate(side * 1.2, 0, 0), TINT.feather),
      ];
      for (let f = 0; f < 5; f++) {
        const len = 2.6 - f * 0.25;
        const feather = new BoxGeometry(len, 0.08, 0.36).translate((side * len) / 2, 0, 0);
        feather.rotateY(side * (0.1 + f * 0.13));
        feather.translate(side * 2.2, 0, 0.6 - f * 0.42);
        parts.push(painted(feather, TINT.featherTip));
      }
      return merged(parts);
    };
    for (const [wing, tip, side] of [
      [this.wingL, this.tipL, 1],
      [this.wingR, this.tipR, -1],
    ] as const) {
      const a = new Mesh(tracker.track(inner(side)), mat);
      const b = new Mesh(tracker.track(outer(side)), mat);
      kit.caster(a, true);
      kit.caster(b, true);
      wing.add(a);
      tip.add(b);
      tip.position.set(side * 4.1, 0, 0);
      wing.add(tip);
      wing.position.set(side * 0.9, 0.55, 0.3);
      this.eagle.add(wing);
    }
    root.add(this.eagle);
  }

  /** Two hailstones (the current one and the next, inside the cloud). */
  private buildHail(): void {
    const { materials: kit, tracker, root } = this.ctx;
    this.iceMat = tracker.track(
      kit.surface({
        color: TINT.ice,
        emissive: TINT.iceDeep,
        emissiveIntensity: 0.55,
        restore: false,
        lift: 0.3,
      }),
    );
    this.iceDarkMat = tracker.track(
      kit.surface({
        color: TINT.iceDark,
        emissive: TINT.bolt,
        emissiveIntensity: 0,
        restore: false,
        lift: 0.15,
      }),
    );
    const geo = tracker.track(
      merged([
        painted(new IcosahedronGeometry(1, 1), 0xffffff),
        painted(new IcosahedronGeometry(0.5, 0).translate(0.8, 0.3, -0.2), 0xe8f2ff),
        painted(new IcosahedronGeometry(0.45, 0).translate(-0.6, -0.5, 0.3), 0xf0f8ff),
      ]),
    );
    for (let k = 0; k < 2; k++) {
      const stone = new Mesh(geo, k === 0 ? this.iceMat : this.iceDarkMat);
      stone.visible = false;
      kit.caster(stone, true);
      root.add(stone);
      this.stones.push(stone);
    }
  }

  /** The rainbow over the valley once the storm is gone (hidden until then). */
  private buildRainbow(): void {
    const { tracker, root } = this.ctx;
    const g = new TorusGeometry(150, 9, 12, 80, Math.PI);
    const pos = g.getAttribute('position');
    const colors = new Float32Array(pos.count * 3);
    const c = new Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      // Distance from the arc's centre line picks the band, outside (red) to inside (violet).
      const radial = Math.hypot(x, y) - 150;
      const band = Math.max(
        0,
        Math.min(RAINBOW.length - 1, Math.floor(((9 - radial) / 18) * RAINBOW.length)),
      );
      c.setHex(RAINBOW[band] as number);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new BufferAttribute(colors, 3));
    g.scale(1, 1, 0.08);
    this.rainbowMat = tracker.track(
      new MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
    );
    this.rainbow = new Mesh(tracker.track(g), this.rainbowMat);
    this.rainbow.position.set(0, -20, 380);
    this.rainbow.visible = false;
    root.add(this.rainbow);
  }

  // ---- a run --------------------------------------------------------------------------------

  start(): void {
    this.reset();
  }

  /** Forgets everything: the grey valley, the full storm, the eagle back at the start. */
  private reset(): void {
    const { materials } = this.ctx;
    materials.clearSweeps();
    materials.restoreAll(0, 0);
    this.wordsDone = 0;
    this.strikes = 0;
    this.caught = 0;
    this.broken = 0;
    this.struckThis = false;
    this.finished = false;
    this.finaleT = -1;
    this.heardTier = 0;
    this.shownLetters = null;
    this.nextWordShown = -1;
    this.hail.reset();
    this.released = false;
    this.shownH = 1;
    this.nextShownH = NEXT_H + 0.5;
    this.storm = 1;
    this.stormShown = 1;
    this.clearShown = 0;
    this.partShown = 0;
    this.flashIn = 1.2;
    this.sinceFlash = 99;
    this.flashGlow = 0;
    this.thunderIn = -1;
    this.boltT = 0;
    this.saidLightning = false;
    this.saidStrike = false;
    this.saidCaught = false;
    this.speed = FLY_SPEED;
    this.flapPower = 0.4;
    this.jolt = 0;
    this.rainbow.visible = false;
    this.rainbowMat.opacity = 0;
    this.lastSky = -1;
    this.applySky(0);
    this.ctx.audio.intensity(0);
  }

  /** A new run with this plan (the screen calls it before the first key, and for every retry). */
  begin(plan: HermonPlan): void {
    this.reset();
    this.plan = plan;
    this.chapter = plan.chapters[0]?.id ?? 'gathering';
    this.cur = 0;
    this.lane = this.pickLane(0);
    this.nextLane = this.pickLane(this.lane);
    this.hail.start(plan.stones[0]?.fall ?? null);
    for (let k = 0; k < 2; k++) {
      const s = this.stones[k];
      if (!s) continue;
      s.visible = k === 0 || plan.stones.length > 1;
      s.material = k === this.cur ? this.iceMat : this.iceDarkMat;
      s.scale.setScalar(1);
    }
    this.place();
  }

  /** The first key of a run: the hail starts to fall. */
  private release(): void {
    if (this.released) return;
    this.released = true;
    this.hail.release();
  }

  private pickLane(from: number): number {
    const r = this.rng.range(-3.2, 3.2);
    return Math.abs(r - from) < 1.5 ? -r * 0.8 : r;
  }

  /** Puts the eagle and the camera where a run starts. */
  private place(): void {
    this.eagle.position.set(0, ALT, 0);
    this.eagle.rotation.set(0, 0, 0);
    this.ctx.rig.cut();
    for (let k = 0; k < SCUD; k++) this.respawnScud(k, this.rng.range(-10, 140));
  }

  /** Where a stone at fall height `h` in lane `lane` is now (world space). */
  private stoneAt(h: number, lane: number, out: Vector3): Vector3 {
    const e = this.eagle.position;
    const k = Math.max(0, h);
    return out.set(
      e.x + lane * Math.min(1, k * 1.4),
      e.y + LAND_Y + FALL_H * k,
      e.z + LAND_Z + (TOP_Z - LAND_Z) * Math.min(1.25, k),
    );
  }

  onKey(ev: TypedKey): void {
    const { typing, audio, vfx } = this.ctx;
    this.release();
    if (!ev.correct) {
      // A slip is soft: the letter stumbles, the eagle gives a little lurch.
      this.text.miss();
      this.feedback.wrong();
      this.jolt = Math.max(this.jolt, 0.25);
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
    audio.play('key', typing.combo, ev.expected);
    // Every right letter chips the ice: a spray of frost and gold.
    const stone = this.stones[this.cur];
    if (stone)
      vfx.burst(this.sparks, stone.position.x, stone.position.y, stone.position.z, 0, 1, -1);
    this.hearTier(typing.tier);
  }

  /** The music builds with the combo tier; a new tier rings a chime and a great wing beat. */
  private hearTier(tier: number): void {
    if (tier > this.heardTier) {
      this.ctx.audio.play('tier', tier);
      this.dyo.cheer(2 + tier);
      this.beat = 1;
      this.ctx.audio.play('whoosh');
    }
    this.heardTier = tier;
    this.flapPower = 0.4 + tier * 0.12;
    this.ctx.audio.intensity(tierIntensity(tier));
  }

  onWord(_word: string, perfect: boolean): void {
    const plan = this.plan;
    if (!plan) return;
    const { vfx, audio } = this.ctx;
    const total = plan.stones.length;
    this.wordsDone += 1;
    const caught = !this.struckThis;
    if (caught) this.caught += 1;
    this.struckThis = false;
    this.broken += 1;

    // The stone bursts: ice everywhere, and gold rain falling to the valley.
    const stone = this.stones[this.cur];
    if (stone) {
      const p = stone.position;
      vfx.burst(this.shards, p.x, p.y, p.z, 0, 0, -1);
      vfx.burst(this.goldRain, p.x, p.y, p.z, 0, -1, 0.3);
      vfx.shockwave(
        p.x,
        p.y,
        p.z,
        perfect ? 6 : 4,
        perfect ? this.gold : TINT.shard,
        0.5,
        false,
        1.8,
      );
      audio.playAt('shatter', p.x, p.y, p.z);
      vfx.impact(perfect ? 0.45 : 0.3, TINT.goldRain);
    }
    // Color returns to the valley under the eagle, a little farther every stone.
    const e = this.eagle.position;
    const share = colorShare(this.wordsDone, total);
    vfx.restore(0, 0, -40, e.z + 90 + share * 160, 2.2);
    const a = this.text.anchor;
    this.feedback.word(a.x, a.y, a.z, perfect);
    audio.play('restore');
    audio.play(perfect ? 'perfect' : 'word');
    this.beat = 1;
    if (caught && !this.saidCaught && this.plan?.timers) {
      this.saidCaught = true;
      this.onMoment?.('caught');
    }

    // The next stone comes out of the cloud; lightning shows the one after it.
    const before = breaksOpen(this.wordsDone - 1, total);
    const open = breaksOpen(this.wordsDone, total);
    this.storm = stormAt(this.wordsDone, total);
    if (this.wordsDone < total) {
      this.cur = 1 - this.cur;
      this.shownH = this.nextShownH;
      this.lane = this.nextLane;
      this.nextLane = this.pickLane(this.lane);
      this.nextShownH = NEXT_H + 0.6;
      this.hail.start(plan.stones[this.wordsDone]?.fall ?? null);
      const now = this.stones[this.cur];
      if (now) now.material = this.iceMat;
      const after = this.stones[1 - this.cur];
      if (after) {
        after.material = this.iceDarkMat;
        after.visible = this.wordsDone + 1 < total;
      }
      this.lightning(true);
      if (open > before) this.onMoment?.('break');
      this.chapter = this.chapterNow();
    } else {
      for (const s of this.stones) s.visible = false;
    }
  }

  private chapterNow(): ChapterId {
    const plan = this.plan;
    if (!plan) return 'gathering';
    for (const c of plan.chapters) if (this.wordsDone < c.to) return c.id;
    return plan.chapters.at(-1)?.id ?? 'summit';
  }

  /** A flash of lightning: a bolt in the distance, the clouds lit from inside, the next word shown. */
  private lightning(reveal: boolean): void {
    const r = this.rng;
    const bolt = this.bolts[Math.floor(r.next() * this.bolts.length)];
    for (const b of this.bolts) b.visible = false;
    const e = this.eagle.position;
    if (bolt) {
      const side = r.next() < 0.5 ? -1 : 1;
      bolt.position.set(e.x + side * r.range(25, 70), e.y + 26, e.z + r.range(70, 140));
      bolt.scale.setScalar(r.range(1.4, 2.2));
      bolt.visible = true;
      this.flashLight.position.set(
        bolt.position.x * 0.6,
        e.y + 22,
        bolt.position.z * 0.6 + e.z * 0.4,
      );
    }
    this.boltT = 0.32;
    const k = 0.35 + 0.65 * this.ctx.post.flashScale;
    this.flashGlow = (0.6 + this.storm * 0.4) * k;
    this.ctx.vfx.flash(TINT.bolt, 0.16 * this.storm + 0.04, 0.3);
    this.thunderIn = r.range(0.25, 0.8);
    if (reveal) this.sinceFlash = 0;
    if (!this.saidLightning && reveal && this.wordsDone > 0) {
      this.saidLightning = true;
      this.onMoment?.('lightning');
    }
  }

  /** The run is over. A whole run breaks the storm; a failed trial leaves it as it is. */
  finale(failed: boolean): void {
    if (this.finished || this.finaleT >= 0) return;
    if (failed) {
      this.jolt = 1;
      this.ctx.audio.play('impact');
      return;
    }
    const { vfx, materials, audio } = this.ctx;
    this.finished = true;
    this.finaleT = 0;
    this.chapter = 'finale';
    this.storm = 0;
    materials.restoreAll(1, 3.2);
    const e = this.eagle.position;
    vfx.restore(0, 0, -40, 900, 3.2);
    vfx.burst(this.fountain, e.x, e.y + 4, e.z + 12, 0, 1, 0.4);
    audio.play('success');
    audio.intensity(1);
    this.dyo.cheer(6);
    this.beat = 1;
    this.rainbow.visible = true;
    this.ctx.rig.pushIn(0.3, 0.6);
    for (const s of this.stones) s.visible = false;
    this.nextText.root.visible = false;
  }

  update(dt: number): void {
    this.time += dt;
    const { vfx, audio } = this.ctx;
    const plan = this.plan;
    const total = plan?.stones.length ?? 0;
    const e = this.eagle.position;

    // --- The hail.
    if (plan && !this.finished && this.wordsDone < total) {
      const step = this.hail.step(dt);
      if (step === 'struck') this.strike();
    }
    this.shownH = damp(this.shownH, this.hail.height, this.hail.strikes > 0 ? 6 : 14, dt);
    this.nextShownH = damp(this.nextShownH, NEXT_H, 1.4, dt);

    // --- The flight: cruise on, but never fly past the stone that is falling.
    const goal = (this.wordsDone + 0.8) * STONE_GAP;
    const want = this.finished ? FLY_SPEED * 1.6 : e.z < goal ? FLY_SPEED : 0.6;
    this.speed = damp(this.speed, want, 0.8, dt);
    e.z += this.speed * dt;
    const climb = this.finished ? Math.min(14, (this.finaleT + dt) * 4) : 0;
    e.y = damp(e.y, ALT + climb + Math.sin(this.time * 0.6) * 0.5, 1.2, dt);
    e.x = damp(e.x, Math.sin(this.time * 0.13) * 3, 0.5, dt);

    // Wings: a slow, deep beat, harder with the streak; a great beat on a word and a tier.
    this.beat = Math.max(0, this.beat - dt * 1.4);
    const rate = 1.3 + this.flapPower * 0.8 + this.beat * 1.6;
    this.flap += dt * rate * Math.PI;
    const amp = 0.28 + this.flapPower * 0.25 + this.beat * 0.45;
    const stroke = Math.sin(this.flap);
    this.wingL.rotation.z = stroke * amp + 0.05;
    this.wingR.rotation.z = -stroke * amp - 0.05;
    this.tipL.rotation.z = Math.sin(this.flap - 0.7) * amp * 0.6;
    this.tipR.rotation.z = -Math.sin(this.flap - 0.7) * amp * 0.6;
    this.wingL.rotation.y = -0.06 - stroke * 0.06;
    this.wingR.rotation.y = 0.06 + stroke * 0.06;
    this.jolt = Math.max(0, this.jolt - dt * 2.2);
    this.roll = damp(this.roll, Math.sin(this.time * 0.37) * 0.07, 1.5, dt);
    this.eagle.rotation.z = this.roll + Math.sin(this.time * 31) * this.jolt * 0.08;
    this.eagle.rotation.x = -stroke * 0.03 - this.jolt * 0.06 + (this.finished ? -0.12 : 0);
    // The head keeps steady and looks at the stone a little.
    this.head.rotation.y = damp(this.head.rotation.y, -this.lane * 0.05, 2, dt);
    this.head.rotation.x = Math.sin(this.time * 1.1) * 0.03;

    // --- The stones.
    const cur = this.stones[this.cur];
    if (cur && cur.visible) {
      this.stoneAt(this.shownH, this.lane, cur.position);
      cur.rotation.x += dt * 0.6;
      cur.rotation.y += dt * 0.9;
      const near = 1 - Math.min(1, this.shownH);
      cur.scale.setScalar(1 + near * 0.15);
    }
    const next = this.stones[1 - this.cur];
    if (next && next.visible) {
      this.stoneAt(this.nextShownH, this.nextLane, next.position);
      next.rotation.y += dt * 0.4;
    }

    // --- The storm: lightning, rain, cloud, light.
    this.stormShown = damp(this.stormShown, this.storm, 0.7, dt);
    const clear = this.finished ? 1 : colorShare(this.wordsDone, total) * 0.5;
    this.clearShown = damp(this.clearShown, clear, this.finished ? 0.6 : 0.8, dt);
    this.applySky(this.clearShown);
    this.sinceFlash += dt;
    if (!this.finished && (this.flashIn -= dt) <= 0) {
      this.flashIn = flashGap(this.rng.next(), this.stormShown);
      this.lightning(true);
    }
    if (this.thunderIn >= 0 && (this.thunderIn -= dt) < 0) audio.play('thunder');
    this.boltT = Math.max(0, this.boltT - dt);
    const flicker = this.boltT > 0 ? (Math.sin(this.boltT * 90) > -0.3 ? 1 : 0.2) : 0;
    this.boltMat.opacity = Math.min(1, this.boltT * 4) * flicker;
    if (this.boltT <= 0) for (const b of this.bolts) b.visible = false;
    this.flashGlow = Math.max(0, this.flashGlow - dt * 2.6);
    this.flashLight.intensity = this.flashGlow * 900;
    this.cloudMat.emissiveIntensity = this.flashGlow * 0.9;
    this.scudMat.emissiveIntensity = this.flashGlow * 0.7;
    this.iceDarkMat.emissiveIntensity = this.flashGlow * 0.8 + this.reveal * 0.25;
    this.cloudMat.color.setHex(TINT.cloud).lerp(this.ca.setHex(TINT.cloudClear), this.clearShown);
    this.scudMat.color
      .setHex(TINT.cloudDark)
      .lerp(this.ca.setHex(TINT.cloudClear), this.clearShown);
    this.scudMat.opacity = 0.85 * (1 - this.clearShown * 0.6);
    this.rainMat.opacity = 0.5 * this.stormShown;
    this.rain.visible = this.stormShown > 0.03;

    // The clouds part over the valley as the storm breaks.
    const part = this.finished ? 1 : breaksOpen(this.wordsDone, total) / SECTIONS;
    this.partShown = damp(this.partShown, part, 0.5, dt);
    for (let k = 0; k < CEILING; k++) {
      const o = k * 4;
      const bx = this.ceilingBase[o] as number;
      const push = this.partShown * 90 * Math.sign(bx || 1) * Math.max(0, 1 - Math.abs(bx) / 160);
      const size = this.ceilingBase[o + 3] as number;
      this.v.set(
        bx + push + Math.sin(this.time * 0.05 + k) * 3,
        (this.ceilingBase[o + 1] as number) + this.partShown * 18,
        (this.ceilingBase[o + 2] as number) + this.time * 0.6,
      );
      this.q.identity();
      this.s.set(size * 1.6, size * 0.55, size);
      this.ceiling.setMatrixAt(k, this.m4.compose(this.v, this.q, this.s));
    }
    this.ceiling.instanceMatrix.needsUpdate = true;
    // Scud races past the eagle (a sense of speed, even when it glides).
    const rush = this.speed + 6;
    for (let k = 0; k < SCUD; k++) {
      const o = k * 4;
      let z = (this.scudPos[o + 2] as number) - (rush - this.speed) * dt;
      if (z < -14) {
        this.respawnScud(k, 150);
        z = this.scudPos[o + 2] as number;
      }
      this.scudPos[o + 2] = z;
      const size = (this.scudPos[o + 3] as number) * (1 - this.clearShown * 0.5);
      this.v.set(e.x + (this.scudPos[o] as number), e.y + (this.scudPos[o + 1] as number), e.z + z);
      this.q.identity();
      this.s.set(size * 2, size * 0.7, size * 1.3);
      this.scud.setMatrixAt(k, this.m4.compose(this.v, this.q, this.s));
    }
    this.scud.instanceMatrix.needsUpdate = true;

    // Rain streaks fall and stream at the rider.
    if (this.rain.visible) {
      const arr = this.rain.geometry.getAttribute('position').array as Float32Array;
      const fall = 22 * dt;
      const back = (this.speed + 8) * dt;
      for (let k = 0; k < RAIN; k++) {
        const o = k * 3;
        let y = (this.rainPos[o + 1] as number) - fall;
        let z = (this.rainPos[o + 2] as number) - back;
        if (y < -18 || z < -6) {
          y = 26 - ((k * 7.3) % 6);
          z = 60 - ((k * 13.7) % 50);
        }
        this.rainPos[o + 1] = y;
        this.rainPos[o + 2] = z;
        const x = this.rainPos[o] as number;
        const p = k * 6;
        arr[p] = e.x + x;
        arr[p + 1] = e.y + y;
        arr[p + 2] = e.z + z;
        arr[p + 3] = e.x + x;
        arr[p + 4] = e.y + y - 1.1;
        arr[p + 5] = e.z + z - 0.5;
      }
      this.rain.geometry.getAttribute('position').needsUpdate = true;
    }

    // The evening sun, and the rainbow, once the storm is gone.
    this.sunLight.position.set(e.x - 6, e.y + 10, e.z + 18);
    this.sunLight.intensity = this.clearShown * this.clearShown * 30;
    if (this.rainbow.visible) {
      this.rainbowMat.opacity = damp(this.rainbowMat.opacity, 0.5, 0.5, dt);
      this.rainbow.position.z = Math.max(e.z + 200, 380);
    }

    this.dyo.update(dt);
    const sound = this.wind;
    if (sound) sound.move(e.x, e.y, e.z + 4);

    if (this.finaleT >= 0) {
      const was = this.finaleT;
      this.finaleT += dt;
      if (was < 0.8 && this.finaleT >= 0.8)
        vfx.burst(this.fountain, e.x - 6, e.y + 4, e.z + 16, 0, 1, 0);
      if (was < 1.5 && this.finaleT >= 1.5)
        vfx.burst(this.fountain, e.x + 6, e.y + 4, e.z + 16, 0, 1, 0);
    }
  }

  /** A stone landed on the eagle before its word was done. */
  private strike(): void {
    const { vfx, audio } = this.ctx;
    this.strikes += 1;
    this.struckThis = true;
    const stone = this.stones[this.cur];
    const p = stone ? stone.position : this.eagle.position;
    vfx.burst(this.shards, p.x, p.y, p.z, 0, 1, 0);
    vfx.burst(this.feathers, p.x, p.y - 0.5, p.z - 1, 0, 1, -1);
    vfx.impact(0.6, TINT.shard);
    audio.playAt('impact', p.x, p.y, p.z);
    this.jolt = 1;
    this.beat = 1;
    this.dyo.face(this.dyo.root.position.x, this.dyo.root.position.z + 10);
    this.onStrike?.();
    if (!this.saidStrike) {
      this.saidStrike = true;
      this.onMoment?.('strike');
    }
  }

  frame(dt: number): void {
    const { typing } = this.ctx;
    // Dyo looks back at the rider, except just after a strike.
    if (this.jolt <= 0.05) this.dyo.face(this.dyo.root.position.x, this.dyo.root.position.z - 10);

    // The word hangs on its strip just under the falling stone.
    const cur = this.stones[this.cur];
    const a = this.text.anchor;
    if (cur && cur.visible) {
      a.set(cur.position.x, cur.position.y - 1.75, cur.position.z - 0.4);
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
    this.text.frame(dt, typing.states);

    // The next word, cut in the dark ice inside the cloud; only lightning shows it.
    const plan = this.plan;
    const nextIndex = this.wordsDone + 1;
    const nextWord = plan && !this.finished ? plan.stones[nextIndex]?.word : undefined;
    const reveal = this.reveal;
    const next = this.stones[1 - this.cur];
    if (nextWord && next && reveal > 0.02) {
      if (this.nextWordShown !== nextIndex) {
        this.nextWordShown = nextIndex;
        this.nextText.setWord([...nextWord], /[֐-׿]/.test(nextWord));
      }
      this.nextText.root.visible = true;
      this.nextText.size = NEXT_SIZE * (0.75 + 0.25 * reveal);
      const b = this.nextText.anchor;
      b.set(next.position.x, next.position.y - 1.6, next.position.z - 0.3);
      this.nextText.frame(dt, NO_STATES);
    } else {
      this.nextText.root.visible = false;
    }
    this.feedback.frame(dt);
  }

  dispose(): void {
    this.wind?.stop();
    this.wind = null;
    if (this.ctx) this.ctx.atmosphere.groundAt = () => 0;
    this.dyo?.dispose();
    this.text?.dispose();
    this.nextText?.dispose();
    this.feedback?.dispose();
    this.shownLetters = null;
    this.onMoment = null;
    this.onStrike = null;
    this.plan = null;
  }
}

const NO_STATES: readonly never[] = [];
