// Atbash City (T23): the seventh region of Act Two.
//
// A rainy neon street of code-breakers. The Fading has scrambled every sign into atbash (the
// alphabet turned backward) and put the neon out; the street is wet grey concrete under a flat
// grey sky, and steel vault gates stand shut across it, one after another. Grey patrol drones of
// the Fading sweep the rain with their searchlights.
//
// Every gate is two legs. In the CIPHER the gate's sign shows the code in atbash, magenta and
// scrambled; every right letter flips one neon letter back to its true face in gold, and every
// finished word lights more signs along the street. In the SEQUENCE the vault door's tumbler
// plays two codes in a pattern and the apprentice types it back; each word turns a ring of the
// lock. When both are done the bolts give way, the great round door rolls aside, the drone of
// that gate turns into a little gold lantern, and the apprentice runs on through the rain to the
// next gate. The last gate is the great vault: at the end every sign in the city comes on, the
// cloud is lit from below in magenta and teal, the moon breaks through, and the lanterns rise.
//
// While a leg is typed its patrol drone is out on its round, down the street and back. On Calm it
// circles far off and never comes back. On the other difficulties a drone that comes back before
// the leg is done finds the apprentice in its light: spotted (the streak drops; the screen is told
// through `onSpotted`), and it goes round again, slower. The typing is judged by the host
// (PlayController); this scene only reacts, and learns the shape of the run from `begin(plan)`.

import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  type MeshLambertMaterial,
  Object3D,
  PlaneGeometry,
  PointLight,
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
import { GREY, NEON, NEON_COLORS, TINT } from './palette';
import {
  colorShare,
  neonFace,
  Patrol,
  SIGNS,
  signsLit,
  type AtbashPlan,
  type ChapterId,
  type Leg,
} from './plan';

export interface AtbashSetup {
  /** The apprentice's robe (the profile's avatar). */
  look: { robe: number; hem: number; trim: number; headwear: 'cap' | 'hat' | 'turban' };
}

/** Things the screen may want to say something about. */
export type AtbashEvent = 'decoded' | 'patrol' | 'spotted' | 'unseen' | 'opened';

/** The most gates a run can have (the last one is always the great vault). */
const MAX_GATES = 5;
/** Where gate k stands along the street, and how far apart they are. */
const FIRST_GATE = 16;
const GATE_GAP = 22;
/** Where the apprentice stands before a gate. */
const STAND = 10;
/** Half the width of the road, and where the house fronts stand. */
const ROAD = 5;
const FRONT = 8.6;
const STREET_END = FIRST_GATE + GATE_GAP * MAX_GATES + 30;
const SIGN_LETTER = 0.62;
/** Running speed between gates (units a second). */
const RUN = 5.2;
/** Seconds after a leg begins before its drone leaves on its own (the first key sends it too). */
const GRACE = 3;
/** Rain streaks (scaled by the quality preset) and the box they fall in around the camera. */
const RAIN = 1400;
const RAIN_W = 34;
const RAIN_H = 22;
const RAIN_D = 44;
const RAIN_SPEED = 26;
/** Windows on the house fronts (most of them; some stay dark). */
const MAX_WINDOWS = 900;
/** Lanterns the drones become, and how many can be in the air. */
const LANTERNS = MAX_GATES;

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

/** Where gate k stands along the street. */
export function gateZ(k: number): number {
  return FIRST_GATE + GATE_GAP * k;
}

/** One gate's moving parts. */
interface Gate {
  readonly root: Group;
  readonly z: number;
  /** The round door: it rolls aside when the gate opens. */
  readonly door: Group;
  /** The tumbler rings on the door's face, outermost first. */
  readonly rings: Mesh[];
  readonly ringMat: MeshBasicMaterial;
  readonly lamp: MeshBasicMaterial;
  /** The frame of the cipher sign over the door. */
  readonly frameMat: MeshBasicMaterial;
  open: number;
  openTarget: number;
  /** Part of this run's street (hidden gates stay hidden even while they sink). */
  shown: boolean;
  turned: number;
  turnTarget: number;
  vault: boolean;
}

/** One sign on a house front. */
interface Sign {
  x: number;
  y: number;
  z: number;
  color: Color;
  /** Seconds since it came on (it flickers into life); -1 while dead. */
  on: number;
}

export class AtbashScene implements GameScene {
  readonly id = 'atbash';
  /** Told when something worth a line happens. */
  onMoment: ((moment: AtbashEvent) => void) | null = null;
  /** Told when a patrol finds the apprentice (only on difficulties with timers). */
  onSpotted: (() => void) | null = null;

  private ctx!: SceneContext;
  private readonly rng = new Rng(2323);
  private plan: AtbashPlan | null = null;
  private apprentice!: Character;
  private dyo!: Dyo;
  private umbrella!: Group;
  private sign!: WorldText;
  private feedback!: TypingFeedback;
  private shownLetters: readonly string[] | null = null;
  private signWord = '';
  private signTyped = -1;
  private signCipher = true;
  private rain: AmbienceHandle | null = null;

  // The street and the city.
  private readonly gates: Gate[] = [];
  private signs: Sign[] = [];
  private signMesh!: InstancedMesh;
  private glowMesh!: InstancedMesh;
  private windows!: InstancedMesh;
  private windowMat!: MeshBasicMaterial;
  private windowCount = 0;
  private skylineMat!: MeshBasicMaterial;
  private moonMat!: MeshBasicMaterial;
  private moonGlowMat!: MeshBasicMaterial;
  private cloudMat!: MeshBasicMaterial;
  private signsShown = 0;
  private signsDrawn = -1;
  private litNow = 0;

  // The rain.
  private readonly rainRoot = new Group();
  private rainA!: LineSegments;
  private rainB!: LineSegments;
  private rainMat!: LineBasicMaterial;
  private splashT = 0;

  // The patrol.
  private readonly patrol = new Patrol();
  private drone!: Group;
  private droneBody!: MeshLambertMaterial;
  private eyeMat!: MeshBasicMaterial;
  private coneMat!: MeshBasicMaterial;
  private spotMat!: MeshBasicMaterial;
  private cone!: Mesh;
  private spot!: Mesh;
  private rotors: Mesh[] = [];
  private droneLight!: PointLight;
  private warnMat!: MeshBasicMaterial;
  private warn!: Mesh;
  private shownAway = 1;
  private side = 1;
  private spottedThis = false;
  private saidPatrol = false;
  private saidSpotted = false;
  private saidUnseen = false;
  private saidDecoded = false;
  private readonly lanterns: Mesh[] = [];
  private readonly lanternT = new Float32Array(LANTERNS);
  private lanternMat!: MeshBasicMaterial;
  private lanternLight!: PointLight;

  // The run.
  private wordsDone = 0;
  private spotted = 0;
  private unseen = 0;
  private opened = 0;
  private leg = 0;
  private legT = 0;
  private typedInWord = 0;
  private standZ = 0;
  private walkZ = 0;
  private chapter: ChapterId | 'finale' = 'market';
  private finished = false;
  private heardTier = 0;
  private time = 0;
  private finaleT = -1;
  private clearShown = 0;
  private readonly palette: ScenePalette = {
    ...GREY.light,
    sunFrom: [0, 1, 0],
    fade: 0,
    ink: 0,
  };
  private readonly ca = new Color();
  private readonly cb = new Color();
  private lastSky = -1;

  private gold = 0;
  private techelet = 0;
  private paper = 0;
  private inkDark = 0;
  private sparks!: BurstStyle;
  private dust!: BurstStyle;
  private splash!: BurstStyle;
  private bolts!: BurstStyle;
  private fountain!: BurstStyle;
  private neonPop!: BurstStyle;

  private readonly v = new Vector3();
  private readonly w = new Vector3();
  private readonly dummy = new Object3D();
  private readonly c = new Color();

  constructor(private readonly setup: AtbashSetup) {}

  // ---- probes (the screen and the smoke test read these) -------------------------------------

  /** Where the patrol is (1 = far end of its round, 0 = back overhead). */
  get patrolAway(): number {
    return this.finished ? 1 : this.patrol.away;
  }

  /** Times a patrol found the apprentice, over the whole run. */
  get spottedTotal(): number {
    return this.spotted;
  }

  /** Legs finished before their patrol ever came back. */
  get legsUnseen(): number {
    return this.unseen;
  }

  /** Gates opened so far. */
  get gatesOpened(): number {
    return this.opened;
  }

  /** Signs lit in the street right now. */
  get signsOn(): number {
    return this.finished ? SIGNS : this.litNow;
  }

  /** The kind of leg being typed now. */
  get legKind(): 'cipher' | 'sequence' | 'done' {
    if (this.finished || !this.plan) return 'done';
    return this.plan.legs[this.leg]?.kind ?? 'done';
  }

  /** How far up the street the apprentice has come. */
  get travelled(): number {
    return this.apprentice?.root.position.z ?? 0;
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
    const { materials: kit, root } = ctx;
    this.gold = ctx.color('gold');
    this.techelet = ctx.color('techelet');
    this.paper = ctx.theme === 'light' ? ctx.color('surface') : ctx.color('ink');
    this.inkDark = ctx.theme === 'light' ? ctx.color('ink') : ctx.color('bg');

    ctx.audio.music('atbash');
    ctx.audio.intensity(0);
    this.rain = ctx.audio.ambience('rain');

    this.palette.fade = ctx.color('fade');
    this.palette.ink = this.gold;
    this.lastSky = -1;
    this.applySky(0);
    ctx.atmosphere.setShadowRange(22);
    ctx.post.setGrade(
      ctx.theme === 'dark'
        ? { exposure: 1.15, saturation: 1.15, vignette: 0.62, godRays: 0.35, bloom: 1.5 }
        : { exposure: 1.1, saturation: 1.12, vignette: 0.55, godRays: 0.4, bloom: 1.4 },
    );

    this.sparks = burstStyle({
      count: 12,
      color: TINT.spark,
      color2: TINT.gold,
      intensity: 2.4,
      speed: [2, 5],
      spread: 1,
      life: [0.2, 0.5],
      size: [0.04, 0.09],
      gravity: 4,
    });
    this.dust = burstStyle({
      count: 50,
      color: TINT.goldDust,
      color2: TINT.gold,
      intensity: 2.6,
      speed: [1, 4],
      spread: 1,
      life: [1, 2],
      size: [0.06, 0.14],
      gravity: -0.6,
      radius: 0.8,
    });
    this.splash = burstStyle({
      count: 4,
      color: TINT.splash,
      color2: TINT.rain,
      intensity: 1.2,
      speed: [0.8, 1.8],
      spread: 0.5,
      life: [0.15, 0.3],
      size: [0.02, 0.05],
      gravity: 9,
    });
    this.bolts = burstStyle({
      count: 30,
      color: TINT.brass,
      color2: TINT.spark,
      intensity: 2.2,
      speed: [3, 8],
      spread: 0.9,
      life: [0.4, 0.9],
      size: [0.05, 0.12],
      gravity: 8,
    });
    this.fountain = burstStyle({
      count: 80,
      color: TINT.gold,
      color2: NEON_COLORS[0] as number,
      intensity: 3,
      speed: [4, 10],
      spread: 0.8,
      life: [1.2, 2.4],
      size: [0.08, 0.2],
      gravity: 3,
    });
    this.neonPop = burstStyle({
      count: 10,
      color: NEON_COLORS[1] as number,
      color2: TINT.spark,
      intensity: 2.6,
      speed: [1, 3],
      spread: 1,
      life: [0.3, 0.7],
      size: [0.04, 0.08],
      gravity: 5,
    });

    this.buildSky();
    this.buildStreet();
    this.buildHouses();
    this.buildSigns();
    this.buildGates();
    this.buildRain();
    this.buildDrone();
    this.buildApprentice();

    // The word to type, as a neon sign hanging in the rain ahead of the apprentice: in a cipher
    // it shows the code in atbash, magenta, and every right letter flips back to its true face
    // in gold; in a sequence it shows the code plainly.
    this.sign = new WorldText({
      atlas: ctx.engine.atlas,
      materials: kit,
      billboard: ctx.vfx.billboard,
      colors: {
        ink: this.inkDark,
        paper: NEON_COLORS[0] as number,
        stone: TINT.steelDark,
        gold: this.gold,
        techelet: NEON_COLORS[1] as number,
        err: ctx.color('err-fg'),
      },
      style: 'hologram',
      size: SIGN_LETTER,
    });
    root.add(this.sign.root);
    this.feedback = new TypingFeedback(ctx, {
      gold: this.gold,
      ink: this.inkDark,
      techelet: this.techelet,
    });

    this.place();
  }

  /** The camera of a run: behind the apprentice, a little above, looking up the street. */
  private follow(): void {
    this.ctx.rig.follow(this.apprentice.root, {
      distance: 10.5,
      height: 4.4,
      lookHeight: 3.1,
      turnWith: 1,
      stiffness: 3.2,
    });
  }

  /** Blends the sky from scrambled grey (0) to decoded neon night (1). */
  private applySky(k: number): void {
    if (Math.abs(k - this.lastSky) < 0.004) return;
    this.lastSky = k;
    const a = GREY[this.ctx.theme];
    const b = NEON[this.ctx.theme];
    const p = this.palette;
    const mix = (x: number, y: number): number =>
      this.ca.setHex(x).lerp(this.cb.setHex(y), k).getHex();
    p.skyTop = mix(a.skyTop, b.skyTop);
    p.skyHorizon = mix(a.skyHorizon, b.skyHorizon);
    p.sun = mix(a.sun, b.sun);
    p.sunIntensity = a.sunIntensity + (b.sunIntensity - a.sunIntensity) * k;
    const sf = p.sunFrom as [number, number, number];
    sf[0] = a.sunFrom[0];
    sf[1] = a.sunFrom[1];
    sf[2] = a.sunFrom[2];
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

  /** The far skyline, the cloud lid lit from below, and the moon behind it. */
  private buildSky(): void {
    const { tracker, root, materials: kit } = this.ctx;
    const r = this.rng;
    // Far towers: dark blocks on every side, with a scatter of lit windows painted in.
    const parts: BufferGeometry[] = [];
    for (let i = 0; i < 70; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const x = side * r.range(26, 90);
      const z = r.range(-30, STREET_END + 60);
      const w = r.range(6, 14);
      const d = r.range(6, 14);
      const h = r.range(18, 70);
      parts.push(
        painted(
          new BoxGeometry(w, h, d).translate(x, h / 2 - 1, z),
          r.next() < 0.5 ? TINT.concreteDark : TINT.roof,
        ),
      );
      // An antenna on the tallest ones.
      if (h > 50) {
        parts.push(
          painted(new CylinderGeometry(0.15, 0.25, 8, 5).translate(x, h + 3, z), TINT.iron),
        );
      }
    }
    // Far end of the street: the great vault's tower, wide and stepped, with a crown.
    const vz = STREET_END + 30;
    for (const [w, h, y0] of [
      [26, 30, 0],
      [18, 20, 30],
      [11, 16, 50],
      [6, 10, 66],
    ] as const) {
      parts.push(painted(new BoxGeometry(w, h, w).translate(0, y0 + h / 2 - 1, vz), TINT.steel));
    }
    const towers = new Mesh(
      tracker.track(merged(parts)),
      tracker.track(kit.surface({ vertexColors: true })),
    );
    kit.caster(towers, false);
    root.add(towers);

    // The skyline's own glow: tiny lit windows far away (one points cloud, lit as the city wakes).
    const n = 700;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const side = r.next() < 0.5 ? -1 : 1;
      pos[i * 3] = side * r.range(24, 84);
      pos[i * 3 + 1] = r.range(2, 60);
      pos[i * 3 + 2] = r.range(-30, STREET_END + 60);
      this.c.setHex((NEON_COLORS[i % NEON_COLORS.length] as number) & 0xffffff);
      if (i % 3 !== 0) this.c.setHex(TINT.window);
      col[i * 3] = this.c.r;
      col[i * 3 + 1] = this.c.g;
      col[i * 3 + 2] = this.c.b;
    }
    this.skylineMat = tracker.track(
      new MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    );
    // Small quads for the far windows, so they read at any distance.
    const quads: BufferGeometry[] = [];
    for (let i = 0; i < n; i++) {
      const q = new PlaneGeometry(0.9, 1.2);
      const x = pos[i * 3] as number;
      q.rotateY(x > 0 ? -Math.PI / 2 : Math.PI / 2);
      q.translate(x - Math.sign(x) * 7.2, pos[i * 3 + 1] as number, pos[i * 3 + 2] as number);
      const qc = new Float32Array(q.getAttribute('position').count * 3);
      for (let k = 0; k < qc.length; k += 3) {
        qc[k] = col[i * 3] as number;
        qc[k + 1] = col[i * 3 + 1] as number;
        qc[k + 2] = col[i * 3 + 2] as number;
      }
      q.setAttribute('color', new BufferAttribute(qc, 3));
      q.deleteAttribute('uv');
      q.deleteAttribute('normal');
      quads.push(q);
    }
    const far = new Mesh(tracker.track(merged(quads)), this.skylineMat);
    far.frustumCulled = false;
    root.add(far);

    // The cloud lid: a huge dim plane over the city, lit magenta from below as the signs return.
    this.cloudMat = tracker.track(
      new MeshBasicMaterial({
        color: NEON_COLORS[0] as number,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: AdditiveBlending,
        side: DoubleSide,
      }),
    );
    const cloud = new Mesh(
      tracker.track(new CircleGeometry(220, 40).rotateX(Math.PI / 2)),
      this.cloudMat,
    );
    cloud.position.set(0, 90, STREET_END * 0.5);
    root.add(cloud);

    // The moon, behind the cloud until the end.
    this.moonMat = tracker.track(
      new MeshBasicMaterial({ color: 0xf4f0ff, transparent: true, opacity: 0.1, fog: false }),
    );
    this.moonGlowMat = tracker.track(
      new MeshBasicMaterial({
        color: 0xb8c0ff,
        transparent: true,
        opacity: 0.05,
        depthWrite: false,
        blending: AdditiveBlending,
        fog: false,
      }),
    );
    const moon = new Mesh(tracker.track(new CircleGeometry(9, 32)), this.moonMat);
    const halo = new Mesh(tracker.track(new CircleGeometry(26, 32)), this.moonGlowMat);
    moon.position.set(-60, 120, STREET_END + 160);
    halo.position.copy(moon.position).add(this.v.set(0, 0, 1));
    moon.lookAt(0, 0, 0);
    halo.lookAt(0, 0, 0);
    root.add(moon, halo);
  }

  /** The wet street: black asphalt, kerbs, pavements, painted dashes and puddles. */
  private buildStreet(): void {
    const { tracker, root, materials: kit } = this.ctx;
    const r = this.rng;
    const len = STREET_END + 40;
    const parts: BufferGeometry[] = [
      painted(new BoxGeometry(ROAD * 2, 0.2, len).translate(0, -0.1, len / 2 - 20), TINT.asphalt),
    ];
    for (const s of [-1, 1]) {
      parts.push(
        painted(
          new BoxGeometry(FRONT - ROAD, 0.36, len).translate(
            s * (ROAD + (FRONT - ROAD) / 2),
            0,
            len / 2 - 20,
          ),
          TINT.concrete,
        ),
        painted(
          new BoxGeometry(0.3, 0.4, len).translate(s * (ROAD + 0.15), 0.02, len / 2 - 20),
          TINT.kerb,
        ),
      );
      // Street lamps along the kerb (dark iron; their glow comes with the city).
      for (let z = -10; z < STREET_END; z += 14) {
        parts.push(
          painted(
            new CylinderGeometry(0.09, 0.13, 5.6, 6).translate(s * (ROAD + 0.6), 2.8, z),
            TINT.iron,
          ),
          painted(new BoxGeometry(1.4, 0.12, 0.12).translate(s * (ROAD + 0.1), 5.5, z), TINT.iron),
        );
      }
    }
    for (let z = -16; z < STREET_END; z += 5) {
      parts.push(painted(new BoxGeometry(0.18, 0.02, 2.2).translate(0, 0.01, z), TINT.stripe));
    }
    const street = new Mesh(
      tracker.track(merged(parts)),
      tracker.track(kit.surface({ vertexColors: true })),
    );
    kit.caster(street, true);
    root.add(street);

    // Puddles: dark glossy patches; the neon is mirrored in them (see buildSigns).
    const pud: BufferGeometry[] = [];
    for (let i = 0; i < 40; i++) {
      const g = new CircleGeometry(1, 14).rotateX(-Math.PI / 2);
      g.scale(r.range(0.8, 2), 1, r.range(1.2, 3));
      g.translate(r.range(-ROAD + 1, ROAD - 1), 0.015, r.range(-10, STREET_END));
      pud.push(painted(g, TINT.puddle));
    }
    const puddles = new Mesh(
      tracker.track(merged(pud)),
      tracker.track(kit.surface({ vertexColors: true, lift: 0.1 })),
    );
    root.add(puddles);
  }

  /** House fronts down both sides: concrete and brick, awnings, iron stairs, water tanks. */
  private buildHouses(): void {
    const { tracker, root, materials: kit } = this.ctx;
    const r = this.rng;
    const parts: BufferGeometry[] = [];
    const win: number[] = [];
    for (const s of [-1, 1]) {
      let z = -24;
      while (z < STREET_END + 10) {
        const w = r.range(5, 9);
        const h = r.range(9, 24);
        const d = 10;
        const cz = z + w / 2;
        const x = s * (FRONT + d / 2);
        const brick = r.next() < 0.4;
        parts.push(
          painted(
            new BoxGeometry(d, h, w - 0.2).translate(x, h / 2, cz),
            brick ? TINT.brick : TINT.concrete,
          ),
        );
        // A cornice and a roof edge.
        parts.push(
          painted(
            new BoxGeometry(d + 0.6, 0.4, w).translate(x - s * 0.3, h, cz),
            TINT.concreteDark,
          ),
        );
        // An awning over the shop at street level.
        const awning = r.next() < 0.5 ? TINT.awning : TINT.awningB;
        parts.push(
          painted(
            new BoxGeometry(1.6, 0.14, w * 0.7)
              .rotateZ(s * 0.28)
              .translate(s * (FRONT - 0.75), 3.3, cz),
            awning,
          ),
        );
        // A shop window below it (dark).
        parts.push(
          painted(
            new BoxGeometry(0.1, 2, w * 0.6).translate(s * (FRONT - 0.04), 1.4, cz),
            TINT.windowDark,
          ),
        );
        // Iron fire stairs on some.
        if (r.next() < 0.45) {
          for (let y = 5; y < h - 2; y += 3) {
            parts.push(
              painted(
                new BoxGeometry(1.1, 0.1, w * 0.45).translate(s * (FRONT - 0.55), y, cz + w * 0.12),
                TINT.iron,
              ),
              painted(
                new BoxGeometry(0.06, 1, w * 0.45).translate(
                  s * (FRONT - 1.08),
                  y + 0.5,
                  cz + w * 0.12,
                ),
                TINT.iron,
              ),
            );
          }
        }
        // A water tank on the roof.
        if (r.next() < 0.35) {
          parts.push(
            painted(new CylinderGeometry(1, 1, 1.8, 10).translate(x, h + 1.6, cz), TINT.roof),
            painted(new ConeGeometry(1.1, 0.7, 10).translate(x, h + 2.85, cz), TINT.iron),
          );
        }
        // Windows: rows over the shop, some always dark.
        for (let y = 5.2; y < h - 1.2; y += 2.6) {
          for (let wz = z + 1.1; wz < z + w - 0.9; wz += 1.7) {
            if (win.length / 4 >= MAX_WINDOWS) break;
            win.push(s * (FRONT - 0.02), y, wz, r.next());
          }
        }
        z += w;
      }
    }
    const houses = new Mesh(
      tracker.track(merged(parts)),
      tracker.track(kit.surface({ vertexColors: true })),
    );
    kit.caster(houses, true);
    root.add(houses);

    // The windows: one instanced quad each, warm or cool, lit as the street comes back.
    this.windowMat = tracker.track(new MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
    const n = win.length / 4;
    this.windows = new InstancedMesh(
      tracker.track(new PlaneGeometry(0.8, 1.3)),
      this.windowMat,
      Math.max(1, n),
    );
    // Lit windows go first in the list, in the order they come on (nearest the start first).
    const order: number[] = [];
    for (let i = 0; i < n; i++) order.push(i);
    order.sort((a, b) => (win[a * 4 + 2] as number) - (win[b * 4 + 2] as number));
    let k = 0;
    for (const i of order) {
      const x = win[i * 4] as number;
      this.dummy.position.set(x, win[i * 4 + 1] as number, win[i * 4 + 2] as number);
      this.dummy.rotation.set(0, x > 0 ? -Math.PI / 2 : Math.PI / 2, 0);
      this.dummy.updateMatrix();
      this.windows.setMatrixAt(k, this.dummy.matrix);
      const roll = win[i * 4 + 3] as number;
      this.c.setHex(roll < 0.65 ? TINT.window : TINT.windowCool).multiplyScalar(1.1);
      this.windows.setColorAt(k, this.c);
      k++;
    }
    this.windowCount = n;
    this.windows.count = 0;
    if (this.windows.instanceColor) this.windows.instanceColor.needsUpdate = true;
    root.add(this.windows);
  }

  /** The neon signs on the house fronts, and their glow mirrored in the wet street. */
  private buildSigns(): void {
    const { tracker, root } = this.ctx;
    const r = this.rng;
    const shapes: Sign[] = [];
    for (let i = 0; i < SIGNS; i++) {
      const s = i % 2 === 0 ? -1 : 1;
      const z = -6 + (i / SIGNS) * (gateZ(MAX_GATES - 1) + 6) + r.range(-2, 2);
      shapes.push({
        x: s * (FRONT - 0.5),
        y: r.range(4.2, 9.5),
        z,
        color: new Color(NEON_COLORS[r.int(NEON_COLORS.length)] as number),
        on: -1,
      });
    }
    // In the order they come back on: nearest the start first.
    shapes.sort((a, b) => a.z - b.z);
    this.signs = shapes;
    // A sign: a glowing tube frame with two bars inside (a word in neon, too far to read).
    const geo = merged([
      new BoxGeometry(0.12, 1.6, 0.12).translate(0, 0, -1.3),
      new BoxGeometry(0.12, 1.6, 0.12).translate(0, 0, 1.3),
      new BoxGeometry(0.12, 0.12, 2.72).translate(0, 0.8, 0),
      new BoxGeometry(0.12, 0.12, 2.72).translate(0, -0.8, 0),
      new BoxGeometry(0.1, 0.22, 1.9).translate(0, 0.28, 0),
      new BoxGeometry(0.1, 0.22, 1.3).translate(0, -0.28, -0.3),
    ]);
    const mat = tracker.track(new MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
    this.signMesh = new InstancedMesh(tracker.track(geo), mat, SIGNS);
    const glowMat = tracker.track(
      new MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    );
    this.glowMesh = new InstancedMesh(
      tracker.track(new CircleGeometry(1, 20).rotateX(-Math.PI / 2)),
      glowMat,
      SIGNS,
    );
    for (let i = 0; i < SIGNS; i++) {
      const s = this.signs[i] as Sign;
      this.dummy.position.set(s.x, s.y, s.z);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.set(1, 1, 1);
      this.dummy.updateMatrix();
      this.signMesh.setMatrixAt(i, this.dummy.matrix);
      // Its reflection: a long smear on the wet road, from the kerb toward the middle.
      this.dummy.position.set(s.x * 0.7, 0.03, s.z - 0.6);
      this.dummy.scale.set(0.9, 1, 2.6);
      this.dummy.updateMatrix();
      this.glowMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.signMesh.frustumCulled = false;
    this.glowMesh.frustumCulled = false;
    root.add(this.signMesh, this.glowMesh);
    this.paintSigns(0, true);
  }

  /** Colors the signs: the first `lit` in neon (flickering as they come on), the rest dead. */
  private paintSigns(lit: number, force = false): void {
    const n = Math.round(lit);
    if (!force && n === this.signsDrawn && !this.anyFlicker) return;
    this.signsDrawn = n;
    let flicker = false;
    for (let i = 0; i < SIGNS; i++) {
      const s = this.signs[i] as Sign;
      let k = 0;
      if (i < n) {
        if (s.on < 0) s.on = 0;
        // A new sign stutters on for a moment.
        k = s.on < 0.7 ? (Math.sin(s.on * 60 + i) > -0.2 ? 1 : 0.15) : 1;
        if (s.on < 0.7) flicker = true;
      } else {
        s.on = -1;
      }
      if (k > 0) this.c.copy(s.color).multiplyScalar(1.4 * k + 0.1);
      else this.c.setHex(TINT.dead).multiplyScalar(0.5);
      this.signMesh.setColorAt(i, this.c);
      if (k > 0) this.c.copy(s.color).multiplyScalar(0.55 * k);
      else this.c.setRGB(0, 0, 0);
      this.glowMesh.setColorAt(i, this.c);
    }
    this.anyFlicker = flicker;
    if (this.signMesh.instanceColor) this.signMesh.instanceColor.needsUpdate = true;
    if (this.glowMesh.instanceColor) this.glowMesh.instanceColor.needsUpdate = true;
  }

  private anyFlicker = false;

  /** The vault gates: a steel wall across the street, a round door, its tumbler and its sign. */
  private buildGates(): void {
    const { tracker, root, materials: kit } = this.ctx;
    const wallMat = tracker.track(kit.surface({ vertexColors: true }));
    const doorMat = tracker.track(kit.surface({ vertexColors: true, lift: 0.12 }));
    const wallGeo = (vault: boolean): BufferGeometry => {
      const h = vault ? 12 : 9;
      const parts: BufferGeometry[] = [];
      // Two piers and the lintel, with the round opening between them (the door fills it).
      for (const s of [-1, 1]) {
        parts.push(
          painted(
            new BoxGeometry(FRONT - 3.4, h, 1.4).translate(s * (3.4 + (FRONT - 3.4) / 2), h / 2, 0),
            TINT.steel,
          ),
          painted(
            new BoxGeometry(0.5, h + 0.4, 1.7).translate(s * 3.3, (h + 0.4) / 2, 0),
            TINT.steelDark,
          ),
        );
        // Rivets down each pier.
        for (let y = 1; y < h; y += 1.2) {
          parts.push(
            painted(new SphereGeometry(0.11, 6, 4).translate(s * 4.4, y, -0.72), TINT.brass),
          );
        }
      }
      parts.push(
        painted(
          new BoxGeometry(6.8, h - 6.6, 1.4).translate(0, 6.6 + (h - 6.6) / 2, 0),
          TINT.steel,
        ),
        painted(new BoxGeometry(FRONT * 2 + 0.6, 0.5, 1.9).translate(0, h, 0), TINT.steelDark),
        // The round frame the door sits in.
        painted(new TorusGeometry(3.15, 0.28, 8, 36).translate(0, 3.3, -0.72), TINT.brassDark),
      );
      // The sign's backing over the door.
      parts.push(
        painted(
          new BoxGeometry(vault ? 9 : 7.4, 1.9, 0.3).translate(0, h - 1.6, -0.86),
          TINT.steelDark,
        ),
      );
      if (vault) {
        // The great vault: two towers of steel with brass crowns.
        for (const s of [-1, 1]) {
          parts.push(
            painted(
              new BoxGeometry(2.6, 18, 2.6).translate(s * (FRONT - 1.3), 9, 0.2),
              TINT.steelDark,
            ),
            painted(
              new ConeGeometry(1.9, 2.4, 4)
                .rotateY(Math.PI / 4)
                .translate(s * (FRONT - 1.3), 19.2, 0.2),
              TINT.brass,
            ),
          );
        }
      }
      return tracker.track(merged(parts));
    };
    const doorGeo = tracker.track(
      merged([
        painted(new CylinderGeometry(3, 3, 0.7, 36).rotateX(Math.PI / 2), TINT.steel),
        painted(new CylinderGeometry(2.4, 2.4, 0.8, 36).rotateX(Math.PI / 2), TINT.steelDark),
        // Bolts round the rim.
        ...Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2;
          return painted(
            new CylinderGeometry(0.16, 0.16, 0.9, 8)
              .rotateX(Math.PI / 2)
              .translate(Math.cos(a) * 2.7, Math.sin(a) * 2.7, 0),
            TINT.brass,
          );
        }),
        // The hub of the wheel.
        painted(new CylinderGeometry(0.5, 0.5, 1.1, 14).rotateX(Math.PI / 2), TINT.brass),
      ]),
    );
    const wall = wallGeo(false);
    const vaultWall = wallGeo(true);
    const ringGeos = [2.2, 1.65, 1.1].map((rad) =>
      tracker.track(new TorusGeometry(rad, 0.09, 6, 40)),
    );
    const notchGeo = tracker.track(new BoxGeometry(0.22, 0.42, 0.14));
    for (let k = 0; k < MAX_GATES; k++) {
      const vault = k === MAX_GATES - 1;
      const g = new Group();
      const w = new Mesh(vault ? vaultWall : wall, wallMat);
      kit.caster(w, true);
      g.add(w);
      const door = new Group();
      const dm = new Mesh(doorGeo, doorMat);
      kit.caster(dm, true);
      door.add(dm);
      door.position.set(0, 3.3, -0.4);
      const ringMat = tracker.track(new MeshBasicMaterial({ color: TINT.ring, toneMapped: false }));
      const rings: Mesh[] = [];
      for (const rg of ringGeos) {
        const ring = new Mesh(rg, ringMat);
        const notch = new Mesh(notchGeo, ringMat);
        notch.position.set(0, rg.parameters.radius + 0.02, 0);
        ring.add(notch);
        ring.position.z = -0.46;
        door.add(ring);
        rings.push(ring);
      }
      g.add(door);
      const lamp = tracker.track(new MeshBasicMaterial({ color: TINT.eye, toneMapped: false }));
      const lampMesh = new Mesh(tracker.track(new SphereGeometry(0.22, 10, 8)), lamp);
      lampMesh.position.set(0, 6.95, -0.8);
      g.add(lampMesh);
      const frameMat = tracker.track(
        new MeshBasicMaterial({ color: TINT.dead, toneMapped: false }),
      );
      const sw = vault ? 9.2 : 7.6;
      const h = vault ? 12 : 9;
      const frame = new Mesh(
        tracker.track(
          merged([
            new BoxGeometry(sw, 0.12, 0.1).translate(0, 1.0, 0),
            new BoxGeometry(sw, 0.12, 0.1).translate(0, -1.0, 0),
            new BoxGeometry(0.12, 2.1, 0.1).translate(-sw / 2, 0, 0),
            new BoxGeometry(0.12, 2.1, 0.1).translate(sw / 2, 0, 0),
          ]),
        ),
        frameMat,
      );
      frame.position.set(0, h - 1.6, -1.05);
      g.add(frame);
      g.position.set(0, 0, gateZ(k));
      g.visible = false;
      root.add(g);
      this.gates.push({
        root: g,
        z: gateZ(k),
        door,
        rings,
        ringMat,
        lamp,
        frameMat,
        open: 0,
        openTarget: 0,
        shown: false,
        turned: 0,
        turnTarget: 0,
        vault,
      });
    }
  }

  /** Rain: streaks in a box that rides with the camera, falling in two stacked copies. */
  private buildRain(): void {
    const { tracker, root, quality } = this.ctx;
    const r = this.rng;
    const n = Math.max(200, Math.round(RAIN * Math.min(1, quality.particles)));
    const pos = new Float32Array(n * 6);
    for (let i = 0; i < n; i++) {
      const x = r.range(-RAIN_W / 2, RAIN_W / 2);
      const y = r.range(0, RAIN_H);
      const z = r.range(-RAIN_D * 0.25, RAIN_D * 0.75);
      const len = r.range(0.5, 0.9);
      pos[i * 6] = x;
      pos[i * 6 + 1] = y;
      pos[i * 6 + 2] = z;
      pos[i * 6 + 3] = x + 0.04;
      pos[i * 6 + 4] = y + len;
      pos[i * 6 + 5] = z + 0.08;
    }
    const geo = tracker.track(new BufferGeometry());
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    this.rainMat = tracker.track(
      new LineBasicMaterial({
        color: TINT.rain,
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    );
    this.rainA = new LineSegments(geo, this.rainMat);
    this.rainB = new LineSegments(geo, this.rainMat);
    this.rainA.frustumCulled = false;
    this.rainB.frustumCulled = false;
    this.rainRoot.add(this.rainA, this.rainB);
    root.add(this.rainRoot);
  }

  /** The patrol drone, the lanterns the drones become, and the warning ring on the street. */
  private buildDrone(): void {
    const { tracker, root, materials: kit } = this.ctx;
    this.drone = new Group();
    this.droneBody = tracker.track(
      kit.surface({
        vertexColors: true,
        emissive: TINT.lantern,
        emissiveIntensity: 0,
        restore: false,
      }),
    );
    const body = new Mesh(
      tracker.track(
        merged([
          painted(
            new SphereGeometry(0.7, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.45, 1),
            TINT.drone,
          ),
          painted(new CylinderGeometry(0.72, 0.6, 0.3, 16).translate(0, -0.12, 0), TINT.droneDark),
          ...[0, 1, 2, 3].map((i) => {
            const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
            return painted(
              new BoxGeometry(1.1, 0.08, 0.14)
                .translate(0.55, 0, 0)
                .rotateY(a)
                .translate(Math.cos(a) * 0.4, 0, -Math.sin(a) * 0.4),
              TINT.droneDark,
            );
          }),
        ]),
      ),
      this.droneBody,
    );
    kit.caster(body, false);
    this.drone.add(body);
    const rotorMat = tracker.track(
      new MeshBasicMaterial({
        color: 0xc8ccd8,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      }),
    );
    const rotorGeo = tracker.track(new RingGeometry(0.05, 0.42, 16).rotateX(-Math.PI / 2));
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const rotor = new Mesh(rotorGeo, rotorMat);
      rotor.position.set(Math.cos(a) * 1.35, 0.08, -Math.sin(a) * 1.35);
      this.drone.add(rotor);
      this.rotors.push(rotor);
    }
    this.eyeMat = tracker.track(new MeshBasicMaterial({ color: TINT.eye, toneMapped: false }));
    const eye = new Mesh(tracker.track(new SphereGeometry(0.2, 10, 8)), this.eyeMat);
    eye.position.set(0, -0.3, 0);
    this.drone.add(eye);
    // The searchlight: a long soft cone pointed down, and the bright spot it throws on the street.
    this.coneMat = tracker.track(
      new MeshBasicMaterial({
        color: TINT.light,
        transparent: true,
        opacity: 0.1,
        depthWrite: false,
        blending: AdditiveBlending,
        side: DoubleSide,
      }),
    );
    this.cone = new Mesh(
      tracker.track(new ConeGeometry(2.2, 1, 24, 1, true).translate(0, -0.5, 0)),
      this.coneMat,
    );
    this.cone.renderOrder = 3;
    root.add(this.cone);
    this.spotMat = tracker.track(
      new MeshBasicMaterial({
        color: TINT.light,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    );
    this.spot = new Mesh(
      tracker.track(new CircleGeometry(2.2, 28).rotateX(-Math.PI / 2)),
      this.spotMat,
    );
    root.add(this.spot);
    this.droneLight = new PointLight(TINT.light, 0, 14, 1.6);
    root.add(this.droneLight);
    root.add(this.drone);

    // A ring round the apprentice's feet that warms to red as the patrol comes back.
    this.warnMat = tracker.track(
      new MeshBasicMaterial({
        color: TINT.eye,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    );
    this.warn = new Mesh(
      tracker.track(new RingGeometry(1.1, 1.35, 40).rotateX(-Math.PI / 2)),
      this.warnMat,
    );
    root.add(this.warn);

    // The lanterns: gold paper globes that rise out of the drones as the gates open.
    this.lanternMat = tracker.track(
      new MeshBasicMaterial({ color: TINT.lantern, toneMapped: false }),
    );
    const lg = tracker.track(new SphereGeometry(0.4, 12, 8).scale(1, 1.25, 1));
    for (let i = 0; i < LANTERNS; i++) {
      const l = new Mesh(lg, this.lanternMat);
      l.visible = false;
      root.add(l);
      this.lanterns.push(l);
    }
    this.lanternLight = new PointLight(TINT.lantern, 0, 16, 1.5);
    root.add(this.lanternLight);
  }

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
      height: 0.92,
      seed: 6,
    });
    root.add(this.apprentice.root);

    this.dyo = new Dyo(kit, {
      body: TINT.dyo,
      shine: TINT.dyoShine,
      eye: TINT.dyoEye,
      pupil: TINT.ink,
    });
    this.dyo.root.scale.setScalar(0.5);
    // Dyo's little umbrella: a magenta canopy on a stick (it never greys: it is his).
    this.umbrella = new Group();
    const umat = tracker.track(
      kit.surface({
        color: TINT.umbrella,
        emissive: TINT.umbrella,
        emissiveIntensity: 0.3,
        restore: false,
        side: DoubleSide,
      }),
    );
    const canopy = new Mesh(tracker.track(new ConeGeometry(0.85, 0.4, 8, 1, true)), umat);
    canopy.position.y = 2.05;
    const stick = new Mesh(tracker.track(new CylinderGeometry(0.04, 0.04, 1.5, 5)), umat);
    stick.position.y = 1.3;
    this.umbrella.add(canopy, stick);
    this.dyo.root.add(this.umbrella);
    root.add(this.dyo.root);
  }

  // ---- a run --------------------------------------------------------------------------------

  start(): void {
    this.reset();
  }

  /** Forgets everything: the grey street, dead neon, every gate shut, back at the corner. */
  private reset(): void {
    const { materials } = this.ctx;
    materials.clearSweeps();
    materials.restoreAll(0, 0);
    this.wordsDone = 0;
    this.spotted = 0;
    this.unseen = 0;
    this.opened = 0;
    this.leg = 0;
    this.legT = 0;
    this.typedInWord = 0;
    this.spottedThis = false;
    this.finished = false;
    this.finaleT = -1;
    this.heardTier = 0;
    this.shownLetters = null;
    this.signWord = '';
    this.signTyped = -1;
    this.patrol.reset();
    this.shownAway = 1;
    this.saidPatrol = false;
    this.saidSpotted = false;
    this.saidUnseen = false;
    this.saidDecoded = false;
    this.signsShown = 0;
    this.litNow = 0;
    this.clearShown = 0;
    this.paintSigns(0, true);
    this.windows.count = 0;
    this.droneBody.emissiveIntensity = 0;
    this.eyeMat.color.setHex(TINT.eye);
    for (const g of this.gates) {
      g.open = 0;
      g.openTarget = 0;
      g.turned = 0;
      g.turnTarget = 0;
      g.door.rotation.z = 0;
      g.root.position.y = 0;
      for (const ring of g.rings) ring.rotation.z = 0;
      g.ringMat.color.setHex(TINT.ring);
      g.lamp.color.setHex(TINT.eye);
      g.frameMat.color.setHex(TINT.dead);
    }
    for (let i = 0; i < LANTERNS; i++) {
      (this.lanterns[i] as Mesh).visible = false;
      this.lanternT[i] = -1;
    }
    this.lanternLight.intensity = 0;
    this.lastSky = -1;
    this.applySky(0);
    this.ctx.audio.intensity(0);
  }

  /** A new run with this plan (the screen calls it before the first key, and for every retry). */
  begin(plan: AtbashPlan): void {
    this.reset();
    this.plan = plan;
    this.chapter = plan.chapters[0]?.id ?? 'market';
    // Lay the street out for this run: gates one after another, the great vault last.
    const n = Math.max(1, Math.min(MAX_GATES, plan.gates));
    for (let k = 0; k < MAX_GATES; k++) {
      const g = this.gates[k] as Gate;
      g.shown = k < n - 1 || k === MAX_GATES - 1;
      g.root.visible = g.shown;
    }
    // The great vault stands where the run's last gate is.
    const vault = this.gates[MAX_GATES - 1] as Gate;
    vault.root.position.z = gateZ(n - 1);
    this.side = 1;
    this.startLeg();
    this.place();
  }

  /** The gate of a leg (the great vault for the run's last gate). */
  private gateOf(leg: Leg | undefined): Gate {
    const vault = this.gates[MAX_GATES - 1] as Gate;
    if (!leg || !this.plan) return vault;
    return leg.gate >= this.plan.gates - 1
      ? vault
      : ((this.gates[leg.gate] as Gate | undefined) ?? vault);
  }

  /** Where the gate of a leg stands along the street. */
  private gateAt(leg: Leg | undefined): number {
    return this.gateOf(leg).root.position.z;
  }

  /** Puts the apprentice and the camera where a run starts (at the corner, before gate one). */
  private place(): void {
    const leg = this.plan?.legs[0];
    this.standZ = this.gateAt(leg) - STAND;
    this.walkZ = this.standZ - 6;
    this.apprentice.root.position.set(0, 0, this.walkZ);
    this.apprentice.root.rotation.set(0, 0, 0);
    this.follow();
    this.ctx.rig.cut();
  }

  /** A leg begins: its drone waits far down the street, ready to leave. */
  private startLeg(): void {
    const leg = this.plan?.legs[this.leg];
    if (!leg) return;
    this.patrol.start(leg.patrol);
    this.shownAway = 1;
    this.spottedThis = false;
    this.legT = 0;
    this.side = -this.side;
    this.signCipher = leg.kind === 'cipher';
    this.signWord = '';
    this.signTyped = -1;
    const g = this.gateOf(leg);
    g.lamp.color.setHex(leg.kind === 'cipher' ? TINT.eye : (NEON_COLORS[2] as number));
  }

  /** Sends the drone out on its round (the first key of a leg, or the grace running out). */
  private release(): void {
    if (this.patrol.released || this.finished) return;
    this.patrol.release();
    if (this.plan?.timers) {
      const p = this.drone.position;
      this.ctx.audio.playAt('scan', p.x, p.y, p.z);
      if (!this.saidPatrol) {
        this.saidPatrol = true;
        this.onMoment?.('patrol');
      }
    }
  }

  onKey(ev: TypedKey): void {
    const { typing, audio, vfx } = this.ctx;
    this.release();
    if (!ev.correct) {
      this.sign.miss();
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
    this.typedInWord = ev.index + 1;
    const at = this.sign.letterPosition(ev.index, this.v);
    this.sign.hit(ev.index);
    this.feedback.correct(at.x, at.y, at.z, this.sign.size, typing.tier);
    audio.play('key', typing.combo, ev.expected);
    // The neon letter on the sign flips back to its true face with a little pop of light.
    if (this.signCipher) {
      vfx.burst(this.neonPop, at.x, at.y, at.z, 0, 0, -1);
    } else {
      // A tumbler click: the ring for this word steps round a little.
      const g = this.gateOf(this.plan?.legs[this.leg]);
      g.turnTarget += 0.12;
    }
    this.hearTier(typing.tier);
  }

  /** The music builds with the combo tier; a new tier rings a chime. */
  private hearTier(tier: number): void {
    if (tier > this.heardTier) {
      this.ctx.audio.play('tier', tier);
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
    this.typedInWord = 0;
    const a = this.sign.anchor;
    this.feedback.word(a.x, a.y, a.z, perfect);
    audio.play(perfect ? 'perfect' : 'word');
    const g = this.gateOf(leg);
    if (leg.kind === 'sequence') {
      // A ring of the lock turns home and lights.
      g.turnTarget = Math.ceil(g.turnTarget) + 1;
      audio.play('ui-click');
    }
    // The whole city lifts a little toward its colors with every word; each open gate brings
    // its street all the way back (see open()).
    this.ctx.materials.restoreAll(colorShare(this.wordsDone, plan.words.length) * 0.4, 1.2);

    if (this.wordsDone >= leg.to) {
      if (!this.spottedThis) this.unseen += 1;
      if (leg.kind === 'cipher') this.decoded(leg);
      else this.open(leg);
      const wasUnseen = !this.spottedThis && plan.timers;
      this.leg = Math.min(plan.legs.length - 1, this.leg + 1);
      if (this.wordsDone < plan.words.length) {
        this.startLeg();
        const next = plan.legs[this.leg];
        if (leg.kind === 'sequence' && next) this.standZ = this.gateAt(next) - STAND;
        if (wasUnseen && !this.saidUnseen && leg.kind === 'sequence') {
          this.saidUnseen = true;
          this.onMoment?.('unseen');
        }
      }
      this.chapter = this.chapterNow();
    }
  }

  /** The cipher is broken: the sign's frame lights and the drone of this leg goes home. */
  private decoded(leg: Leg): void {
    const { vfx, audio } = this.ctx;
    const g = this.gateOf(leg);
    g.frameMat.color.setHex(NEON_COLORS[1] as number);
    const s = this.sign.anchor;
    vfx.shockwave(s.x, s.y, s.z, 3, NEON_COLORS[1] as number, 0.5, false, 1.2);
    vfx.burst(this.dust, s.x, s.y, s.z, 0, 0, -1);
    audio.play('restore');
    this.dyo.cheer(3);
    if (!this.saidDecoded) {
      this.saidDecoded = true;
      this.onMoment?.('decoded');
    }
  }

  /** The sequence is done: the bolts give way, the door rolls aside, the drone becomes a lantern. */
  private open(leg: Leg): void {
    const { vfx, audio } = this.ctx;
    const g = this.gateOf(leg);
    this.opened += 1;
    g.openTarget = 1;
    g.ringMat.color.setHex(this.gold);
    g.lamp.color.setHex(NEON_COLORS[3] as number);
    const z = g.root.position.z;
    vfx.burst(this.bolts, 0, 3.3, z - 1, 0, 0.4, -1);
    vfx.shockwave(0, 3.3, z - 1, 5, this.gold, 0.6, false, 1.4);
    vfx.impact(0.35, this.gold);
    audio.playAt('unlock', 0, 3.3, z);
    this.ctx.rig.shake(0.2);
    this.apprentice.play('cheer');
    this.dyo.cheer(4);
    // The street up to this gate comes back.
    // One sweep from the corner out past this gate: it covers every earlier one, so none is lost.
    vfx.restore(0, 0, -20, z + 30, 2.2);
    // The drone turns into a gold lantern and floats up.
    const i = Math.min(LANTERNS - 1, this.opened - 1);
    const l = this.lanterns[i] as Mesh;
    l.position.copy(this.drone.position);
    l.visible = true;
    this.lanternT[i] = 0;
    vfx.burst(this.dust, l.position.x, l.position.y, l.position.z, 0, 1, 0);
    if (this.plan && this.wordsDone < this.plan.words.length) this.onMoment?.('opened');
  }

  private chapterNow(): ChapterId {
    const plan = this.plan;
    if (!plan) return 'market';
    for (const c of plan.chapters) if (this.wordsDone < c.to) return c.id;
    return plan.chapters.at(-1)?.id ?? 'vault';
  }

  /** The run is over. A whole run lights the city; a failed trial leaves the street as it is. */
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
    materials.restoreAll(1, 3);
    vfx.restore(0, 0, 0, 600, 3);
    for (const g of this.gates) {
      g.openTarget = 1;
      g.ringMat.color.setHex(this.gold);
      g.frameMat.color.setHex(NEON_COLORS[1] as number);
      g.lamp.color.setHex(NEON_COLORS[3] as number);
    }
    const vz = this.gateAt(this.plan?.legs.at(-1));
    vfx.burst(this.fountain, 0, 8, vz + 2, 0, 1, 0);
    audio.play('success');
    audio.intensity(1);
    this.apprentice.play('cheer');
    this.dyo.cheer(6);
    this.ctx.rig.pushIn(0.25, 0.6);
    // Pull back and look up the street: the whole skyline lit, the lanterns rising.
    const p = this.apprentice.root.position;
    this.ctx.rig.fixed(this.v.set(2.5, 2.2, p.z - 9), this.w.set(0, 8, p.z + 30));
  }

  update(dt: number): void {
    this.time += dt;
    const { vfx } = this.ctx;
    const plan = this.plan;
    const total = plan?.words.length ?? 0;
    const app = this.apprentice.root;
    const leg = plan?.legs[this.leg];
    this.legT += dt;

    // --- The apprentice runs up to the next gate, then stands and works.
    // He waits for a gate on the way to sink far enough before he runs through it.
    let goal = this.standZ;
    for (const g of this.gates) {
      const gz = g.root.position.z;
      if (g.shown && g.open < 0.7 && gz > this.walkZ && gz - STAND < goal) goal = gz - STAND;
    }
    const toGo = goal - this.walkZ;
    const step = Math.min(Math.max(0, toGo), RUN * dt);
    this.walkZ += step;
    const running = this.standZ - this.walkZ > 0.05;
    this.apprentice.speed = step > 0.001 ? RUN : 0;
    const lift = this.finished ? Math.min(1, Math.max(0, this.finaleT / 2.5)) : 0;
    app.position.set(Math.sin(this.time * 0.6) * 0.05, 0, this.walkZ + lift * 2);
    app.rotation.y = damp(app.rotation.y, 0, 4, dt);
    this.apprentice.update(dt);

    // --- The patrol: out on its round while a leg is typed (it waits while the apprentice runs).
    if (plan && leg && !this.finished) {
      if (!this.patrol.released && !running && this.legT > GRACE) this.release();
      if (!running && this.patrol.step(dt) === 'spotted') this.spottedNow();
    }
    this.shownAway = damp(this.shownAway, this.finished ? 1.4 : this.patrol.away, 4, dt);
    this.placeDrone(dt);

    // Dyo rides beside the apprentice under his umbrella.
    this.dyo.root.position.set(
      app.position.x - 1.05,
      app.position.y + 1.7 + Math.sin(this.time * 1.6) * 0.06,
      app.position.z - 0.2,
    );
    this.umbrella.rotation.z = Math.sin(this.time * 1.1) * 0.08;
    this.dyo.update(dt);

    // --- The gates: doors roll aside, tumbler rings turn.
    for (const g of this.gates) {
      if (!g.shown) continue;
      g.open = damp(g.open, g.openTarget, 2.2, dt);
      g.turned = damp(g.turned, g.turnTarget, 5, dt);
      // The wheel spins the bolts back first; then the whole gate sinks into the street.
      const spin = Math.min(1, g.open / 0.35);
      const sink = Math.max(0, (g.open - 0.3) / 0.7);
      g.door.rotation.z = -spin * spin * 2.6;
      g.root.position.y = -sink * sink * (g.vault ? 13 : 10);
      g.root.visible = g.shown && sink < 0.995;
      const r0 = g.rings[0];
      const r1 = g.rings[1];
      const r2 = g.rings[2];
      if (r0) r0.rotation.z = g.turned * 0.9;
      if (r1) r1.rotation.z = -g.turned * 1.3;
      if (r2) r2.rotation.z = g.turned * 1.9;
    }

    // --- The lanterns rise over the roofs.
    let brightest = 0;
    for (let i = 0; i < LANTERNS; i++) {
      const t = this.lanternT[i] as number;
      if (t < 0) continue;
      const l = this.lanterns[i] as Mesh;
      this.lanternT[i] = t + dt;
      l.position.y += dt * (0.9 + Math.min(1, t * 0.4));
      l.position.x += Math.sin(this.time * 0.8 + i) * dt * 0.4;
      if (l.position.y > 40) {
        l.visible = false;
        this.lanternT[i] = -1;
      } else {
        brightest = Math.max(brightest, 1 - l.position.y / 40);
        if (brightest === 1 - l.position.y / 40) this.lanternLight.position.copy(l.position);
      }
    }
    this.lanternLight.intensity = brightest * 22;

    // --- The city wakes: signs, windows, the sky.
    const lit = this.finished ? SIGNS : signsLit(this.wordsDone, total);
    this.signsShown = damp(this.signsShown, lit, 2.5, dt);
    this.litNow = Math.round(this.signsShown);
    for (const s of this.signs) if (s.on >= 0) s.on += dt;
    this.paintSigns(this.signsShown);
    const share = this.finished ? 1 : colorShare(this.wordsDone, total);
    this.windows.count = Math.round(this.windowCount * Math.min(1, 0.04 + share * 0.86));
    const clear = this.finished ? 1 : share * 0.7;
    this.clearShown = damp(this.clearShown, clear, this.finished ? 0.8 : 1.2, dt);
    this.applySky(this.clearShown);
    this.skylineMat.opacity = 0.1 + this.clearShown * 0.9;
    this.cloudMat.opacity = this.clearShown * 0.07;
    this.moonMat.opacity = 0.1 + Math.max(0, this.clearShown - 0.6) * 2.2;
    this.moonGlowMat.opacity = 0.04 + Math.max(0, this.clearShown - 0.6) * 0.4;
    this.rainMat.opacity = 0.34 - this.clearShown * 0.12;
    this.rainMat.color
      .setHex(TINT.rain)
      .lerp(this.c.setHex(NEON_COLORS[4] as number), this.clearShown * 0.35);

    // Splashes on the street ahead of the apprentice.
    this.splashT -= dt;
    if (this.splashT <= 0) {
      this.splashT = 0.07;
      const r = this.rng;
      vfx.burst(this.splash, r.range(-ROAD, ROAD), 0.05, app.position.z + r.range(-2, 16), 0, 1, 0);
    }

    // --- The finale: lanterns go up from every gate, fireworks over the vault.
    if (this.finaleT >= 0) {
      const was = this.finaleT;
      this.finaleT += dt;
      const vz = this.gateAt(this.plan?.legs.at(-1));
      if (was < 0.8 && this.finaleT >= 0.8) vfx.burst(this.fountain, -4, 10, vz, 0, 1, 0);
      if (was < 1.6 && this.finaleT >= 1.6) {
        vfx.burst(this.fountain, 4, 12, vz, 0, 1, 0);
        this.ctx.audio.play('tier', 4);
      }
      if (was < 2.4 && this.finaleT >= 2.4) vfx.burst(this.fountain, 0, 16, vz + 4, 0, 1, 0);
    }

    if (this.rain) this.rain.move(app.position.x, app.position.y + 3, app.position.z);
  }

  /** The drone flies its round: down one side of the street and back along the other. */
  private placeDrone(dt: number): void {
    const a = Math.max(0, this.shownAway);
    const z0 = this.apprentice.root.position.z;
    const d = this.drone.position;
    const back = 1 - Math.min(1, a);
    // Out along one side, far up the street, and home along the other.
    d.set(
      this.side * Math.sin(Math.min(1, a) * Math.PI) * 4.2,
      4.8 + Math.min(1.4, a) * 4.5 + Math.sin(this.time * 2.1) * 0.15,
      z0 + 1.2 + a * 34,
    );
    this.drone.rotation.y += dt * 0.6;
    for (const r of this.rotors) r.rotation.y += dt * 40;
    const gold = this.finished;
    this.droneBody.emissiveIntensity = damp(this.droneBody.emissiveIntensity, gold ? 1 : 0, 2, dt);
    this.eyeMat.color.setHex(gold ? TINT.lantern : TINT.eye);
    // The searchlight hangs straight down to the street.
    const h = d.y;
    this.cone.position.set(d.x, d.y - 0.3, d.z);
    this.cone.scale.set(1, Math.max(0.1, h - 0.3), 1);
    this.spot.position.set(d.x, 0.04, d.z);
    const timers = this.plan?.timers ?? false;
    const on = this.finished ? 0 : 1;
    this.coneMat.opacity = on * (0.06 + back * 0.08);
    this.spotMat.opacity = on * (0.22 + back * 0.3);
    this.droneLight.position.set(d.x, 1.5, d.z);
    this.droneLight.intensity = on * (6 + back * 14);
    // The warning ring: only when a patrol can find him at all.
    const near = timers && !this.finished && this.patrol.released ? Math.max(0, 1 - a / 0.35) : 0;
    const app = this.apprentice.root.position;
    this.warn.position.set(app.x, 0.05, app.z);
    this.warnMat.opacity = near * (0.45 + Math.max(0, Math.sin(this.time * 12)) * 0.4);
  }

  /** A patrol came back before the leg was done: its light finds the apprentice. */
  private spottedNow(): void {
    const { vfx, audio } = this.ctx;
    this.spotted += 1;
    this.spottedThis = true;
    const p = this.apprentice.root.position;
    vfx.flash(TINT.light, 0.35, 0.3);
    vfx.shockwave(p.x, 0.1, p.z, 3, TINT.eye, 0.5, true, 1.2);
    audio.play('scan');
    audio.play('impact-small');
    this.ctx.rig.shake(0.25);
    this.apprentice.play('stagger');
    this.onSpotted?.();
    if (!this.saidSpotted) {
      this.saidSpotted = true;
      this.onMoment?.('spotted');
    }
  }

  frame(dt: number): void {
    const { typing } = this.ctx;
    const cam = this.ctx.engine.camera.position;
    // The rain rides with the camera and falls through two stacked boxes.
    const fall = (this.time * RAIN_SPEED) % RAIN_H;
    this.rainRoot.position.set(cam.x, 0, cam.z - RAIN_D * 0.15);
    this.rainA.position.y = -fall + RAIN_H * 0.1;
    this.rainB.position.y = -fall + RAIN_H * 1.1;
    const app = this.apprentice.root.position;
    this.dyo.face(app.x, app.z + 10);

    // The word to type: a neon sign in the rain, a little ahead of the apprentice and over him.
    const sa = this.sign.anchor;
    sa.set(app.x, app.y + 2.4, app.z + 3.6);
    this.sign.size = damp(this.sign.size, SIGN_LETTER, 6, dt);
    const word = this.finished ? '' : typing.word;
    const typed = this.signCipher ? this.typedInWord : 99;
    if (word !== this.signWord || typed !== this.signTyped) {
      const fresh = word !== this.signWord;
      this.signWord = word;
      this.signTyped = typed;
      this.sign.setWord(neonFace(word, typed), /[֐-׿]/.test(word));
      // The letter that just flipped pops (setWord starts every letter fresh).
      if (!fresh && this.signCipher && typed > 0) this.sign.hit(typed - 1);
    }
    this.sign.root.visible = !this.finished && word.length > 0;
    this.sign.frame(dt, typing.states);
    this.feedback.frame(dt);
  }

  dispose(): void {
    this.rain?.stop();
    this.rain = null;
    this.apprentice?.dispose();
    this.dyo?.dispose();
    this.sign?.dispose();
    this.feedback?.dispose();
    this.shownLetters = null;
    this.onMoment = null;
    this.onSpotted = null;
    this.plan = null;
  }
}
