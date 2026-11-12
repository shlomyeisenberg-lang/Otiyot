// The Silent Arena and the Great Blot (T16): the first boss, the end of Act One.
//
// An old stone theatre under a white sky. Everything the Fading took from the Meadow and the
// Cliffs has gathered on its stage into one great living blot of ink with two pale eyes. The
// scribe stands at the front of the orchestra; Reb Ezra and Dyo watch from the side. The fight
// has four phases (the plan and the pure state live in plan.ts and src/game/boss.ts):
//
//   I   Spatter  — globs of ink arc up from the Blot and hang over the scribe; each word bursts
//                  one in the air. A shrinking red ring on the floor is the telegraph.
//   II  Tendrils — an arm of ink reaches across the stage while a sentence is typed; the
//                  sentence's last word cuts it.
//   III Flood    — a ring of ink closes in from the edge of the stage; every right letter holds
//                  it back, every stretch of the passage pushes it out again.
//   IV  Mirror   — the world turns inside out: an ink sky over pale stone, the Blot itself goes
//                  white, and mirror shards circle the scribe while it gives the words back.
//
// Every word fires a gold bolt from the quill into the Blot; it shrinks as its health falls. A
// gold seal on its front marks a weak point; struck clean, the Blot reels. Between phases: a
// hit-stop, a camera push-in on the Blot, a palette shift and the next music section. The
// victory is staged as a cutscene by the screen (`cue` and `shot`): the Blot breaks into a
// rain of gold letters and color rolls out over the theatre.
//
// The typing is judged by the host; this scene only reacts. It reads the fight (BossFight) the
// screen gives it in `watch`, and is told about lands, parries, staggers and transitions.

import {
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  BoxGeometry,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
  OctahedronGeometry,
  PlaneGeometry,
  Quaternion,
  RingGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
  type Material,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  burstStyle,
  Character,
  damp,
  easeInOut,
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
import {
  lightsFor,
  LOOKS,
  TINT,
  type ArenaLight,
  type BossLook,
  type BossLookId,
  type Sky,
} from './palette';

export interface ArenaSetup {
  /** The apprentice's robe (the profile's avatar). */
  look: { robe: number; hem: number; trim: number; headwear: 'cap' | 'hat' | 'turban' };
  /** Who stands on the stage (T26): the Great Blot (default) or one of the three trials. */
  boss?: BossLookId;
}

// --- The lay of the theatre.
const ORCHESTRA = 15;
const BLOT_Z = -6;
const BLOT_R = 4.3;
const SCRIBE_X = -4.6;
const SCRIBE_Z = 7.6;
/** Where Reb Ezra and Dyo watch from: the right side of the orchestra. */
const EZRA_X = 9.6;
const EZRA_Z = 4.2;
/** The Blot turns to face the scribe. */
const FACE_SCRIBE = Math.atan2(SCRIBE_X, SCRIBE_Z - BLOT_Z);
const LETTER_SIZE = 1.05;
/** Where the word hangs: over the Blot's head, a little toward the scribe. */
const TEXT_X = -0.4;
const TEXT_Y = 9.6;
const TEXT_Z = 1.5;
const TIERS = 13;
const TIER_RISE = 0.72;
const TIER_DEPTH = 1.55;
const CAVEA_IN = 17;
const CAVEA_ARC = Math.PI * 1.18;
const TOP_COLUMNS = 26;
const TENDRIL = 26;
const CREST = 44;
const SHARDS = 8;
const BOLTS = 4;
const BOLT_SECONDS = 0.26;
const OLIVES = 34;
const CYPRESSES = 14;
const LETTERS_RAIN = 14;
const UP = new Vector3(0, 1, 0);

/** Height of the land: the paved orchestra, the stage, then hills all round. */
function ground(x: number, z: number): number {
  const r = Math.hypot(x, z);
  if (r < ORCHESTRA) return 0;
  const hills =
    smoothstep(46, 90, r) * (9 + 5 * Math.sin(x * 0.045 + 1.3) + 4 * Math.sin(z * 0.06 - 0.4));
  const lip = smoothstep(ORCHESTRA, ORCHESTRA + 2, r) * 0.15;
  return lip + hills + 0.5 * Math.sin(x * 0.21) * Math.sin(z * 0.17) * smoothstep(20, 40, r);
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

/** Collects instances while the scene is built; one draw call when done. */
class Batch {
  private readonly mats: Matrix4[] = [];
  private readonly cols: number[] = [];
  add(p: Vector3, q: Quaternion, s: Vector3, color = 0xffffff): void {
    this.mats.push(new Matrix4().compose(p, q, s));
    this.cols.push(color);
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

/** A camera framing: where it stands and where it looks. */
interface Shot {
  pos: Vector3;
  look: Vector3;
}

const SHOTS: Readonly<Record<string, Shot>> = {
  fight: { pos: new Vector3(6.5, 9.4, 24), look: new Vector3(-1.4, 2.6, -5) },
  boss: { pos: new Vector3(0.8, 3.9, 5.2), look: new Vector3(0, 3.2, BLOT_Z) },
  burst: { pos: new Vector3(3.2, 3.2, 15.5), look: new Vector3(0, 3.4, BLOT_Z) },
  wide: { pos: new Vector3(0, 24, 34), look: new Vector3(0, 0, -6) },
  ezra: { pos: new Vector3(-2.4, 2.7, 13.6), look: new Vector3(-3.5, 1.4, 7.2) },
  road: { pos: new Vector3(0, 7.5, 21), look: new Vector3(0, 13, -70) },
};

/** Grades for each light (DESIGN: the picture follows the story). */
const GRADES: Readonly<Record<ArenaLight, Parameters<SceneContext['post']['setGrade']>[0]>> = {
  p1: { saturation: 0.95, contrast: 1.05, vignette: 0.38, godRays: 0.4 },
  p2: { saturation: 0.95, contrast: 1.1, vignette: 0.46, shadowTint: 0xe6defa, godRays: 0.35 },
  p3: { saturation: 1, contrast: 1.14, vignette: 0.52, shadowTint: 0xd6e2ff, godRays: 0.55 },
  p4: {
    saturation: 0.85,
    contrast: 1.2,
    vignette: 0.56,
    shadowTint: 0xc8ccff,
    lightTint: 0xf4f8ff,
    bloom: 1.45,
    godRays: 0.8,
    exposure: 1.08,
  },
  restored: { saturation: 1.14, contrast: 1.06, vignette: 0.34, godRays: 0.95, exposure: 1.03 },
};

/** The trials' grades (T26): the Storm Hawk's charged dusk, the Golem's cold glare, the sea. */
const TRIAL_GRADES: Readonly<
  Record<Exclude<BossLookId, 'blot'>, readonly Parameters<SceneContext['post']['setGrade']>[0][]>
> = {
  storm: [
    { saturation: 0.9, contrast: 1.12, vignette: 0.44, shadowTint: 0xd8dcff, godRays: 0.45 },
    { saturation: 0.92, contrast: 1.18, vignette: 0.5, shadowTint: 0xc8d0ff, godRays: 0.6 },
    {
      saturation: 1,
      contrast: 1.24,
      vignette: 0.58,
      shadowTint: 0xc0c4ff,
      bloom: 1.4,
      godRays: 0.85,
    },
  ],
  glass: [
    {
      saturation: 0.9,
      contrast: 1.04,
      vignette: 0.34,
      lightTint: 0xf4fcff,
      bloom: 1.2,
      godRays: 0.5,
    },
    {
      saturation: 0.95,
      contrast: 1.08,
      vignette: 0.4,
      shadowTint: 0xd8f0ff,
      bloom: 1.3,
      godRays: 0.6,
    },
    {
      saturation: 1.02,
      contrast: 1.14,
      vignette: 0.48,
      shadowTint: 0xc4e4ff,
      bloom: 1.45,
      godRays: 0.8,
    },
  ],
  tide: [
    { saturation: 0.95, contrast: 1.04, vignette: 0.38, shadowTint: 0xd8f0e8, godRays: 0.45 },
    { saturation: 1, contrast: 1.1, vignette: 0.46, shadowTint: 0xc8e8e0, godRays: 0.55 },
    { saturation: 1.05, contrast: 1.16, vignette: 0.54, shadowTint: 0xb8e0d8, godRays: 0.75 },
  ],
};

const LIGHT_OF: readonly ArenaLight[] = ['p1', 'p2', 'p3', 'p4'];
/** Seconds between the Storm Hawk's flashes of lightning over the theatre (at random). */
const STORM_FLASH: readonly [number, number] = [3.5, 7];

export class ArenaScene implements GameScene {
  readonly id = 'arena';
  /** Called first in every fixed step (the screen runs the fight's clock and the cutscene). */
  onStep: ((dt: number) => void) | null = null;
  /** A phase transition has finished playing. */
  onTransitionEnd: (() => void) | null = null;

  private ctx!: SceneContext;
  private readonly rng = new Rng(1616);
  private fight: BossFight | null = null;
  private plan: BossPlan | null = null;
  private apprentice!: Character;
  private ezra!: Character;
  private dyo!: Dyo;
  private text!: WorldText;
  private feedback!: TypingFeedback;
  private quillTrail: Trail | null = null;
  private shownLetters: readonly string[] | null = null;

  // The Great Blot.
  private blot!: Group;
  private blotMesh!: Mesh;
  private blotMat!: MeshLambertMaterial;
  private blotDirs!: Float32Array;
  private blotPos!: BufferAttribute;
  private blotNormal!: BufferAttribute;
  private readonly eyes: Mesh[] = [];
  private readonly pupils: Mesh[] = [];
  private readonly brows: Mesh[] = [];
  private seal!: Mesh;
  private blotSize = 1;
  private flinch = 0;
  private flinchV = 0;
  private reel = 0;
  private blotGone = false;
  private shake = 0;

  // Attacks.
  private attack: AttackKind = 'spatter';
  private shown = 0;
  private landT = -1;
  private snapT = -1;
  private glob!: Mesh;
  private pool!: Mesh;
  private dripTimer = 0;
  private ring!: Mesh;
  private tendril!: InstancedMesh;
  private tide!: Mesh;
  private crest!: InstancedMesh;
  private shards!: InstancedMesh;
  private tideScale = 13;
  private shardSpin = 0;

  // Bolts from the quill to the Blot.
  private readonly bolts: Mesh[] = [];
  private readonly boltT = new Float32Array(BOLTS).fill(-1);
  private readonly boltFrom: Vector3[] = [];
  private readonly boltTrail: (Trail | null)[] = [];
  private nextBolt = 0;

  // Camera, light and the phase look.
  private readonly camPos = new Vector3();
  private readonly camLook = new Vector3();
  private shot: Shot = SHOTS.fight as Shot;
  private shotRate = 2;
  private push = 0;
  private roll = 0;
  private rollT = -1;
  private light: ArenaLight = 'p1';
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
  private mirror = 0;
  private mirrorWant = 0;

  // The run.
  private phase = 0;
  private transT = -1;
  private transTo = 0;
  private heardTier = 0;
  private time = 0;
  private won = false;
  private restoredAll = false;
  private gatherT = -1;
  private rainT = -1;
  private rained = 0;

  private gold = 0;
  private techelet = 0;
  private paper = 0;
  private inkDark = 0;
  private errColor = 0;
  private sparks!: BurstStyle;
  private chips!: BurstStyle;
  private splash!: BurstStyle;
  private fountain!: BurstStyle;
  private foam!: BurstStyle;
  private glass!: BurstStyle;
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

  private readonly lookId: BossLookId;
  private readonly look: BossLook;
  /** The Golem's glow when a slip mends a crack (1 → 0). */
  private healGlow = 0;
  private flashTimer = 4;
  private wingT = 0;
  /** The trials' own parts on the body: the Hawk's wings, the Golem's crown, the Tide's tail. */
  private readonly parts: Mesh[] = [];

  constructor(private readonly setup: ArenaSetup) {
    this.lookId = setup.boss ?? 'blot';
    this.look = LOOKS[this.lookId];
  }

  /** Which boss stands on the stage. */
  get bossShown(): BossLookId {
    return this.lookId;
  }

  private sky(light: ArenaLight): Sky {
    return lightsFor(this.lookId, this.ctx.theme)[light];
  }

  private grade(light: ArenaLight): Parameters<SceneContext['post']['setGrade']>[0] {
    if (this.lookId === 'blot' || light === 'restored') return GRADES[light];
    const set = TRIAL_GRADES[this.lookId];
    return set[Math.min(set.length - 1, LIGHT_OF.indexOf(light))] ?? GRADES[light];
  }

  // ---- probes (the screen and the smoke test read these) -------------------------------------

  /** The phase the arena is showing (0..3). */
  get phaseShown(): number {
    return this.phase;
  }

  /** 0..1: the attack as drawn (follows the fight's windup). */
  get attackShown(): number {
    return this.shown;
  }

  /** True while a phase transition is playing. */
  get transitioning(): boolean {
    return this.transT >= 0;
  }

  /** True once the victory restored the theatre. */
  get restored(): boolean {
    return this.restoredAll;
  }

  /** True once the Blot has burst. */
  get blotBroken(): boolean {
    return this.blotGone;
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

    // Sound: the boss theme, its layers following the streak, and a thin wind over the stones.
    ctx.audio.music('boss');
    ctx.audio.section('phase1');
    ctx.audio.intensity(0);
    ctx.audio.ambience('wind');

    this.palFrom = this.sky('p1');
    this.palTo = this.palFrom;
    this.applyPalette(1);
    ctx.atmosphere.groundAt = ground;
    ctx.atmosphere.setShadowRange(30);
    ctx.post.setGrade(this.grade('p1'));
    ctx.rig.groundAt = ground;

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
    this.chips = burstStyle({
      count: 6,
      color: this.look.body,
      color2: this.look.sheen,
      speed: [1.5, 4],
      spread: 0.7,
      life: [0.5, 1.1],
      size: [0.08, 0.22],
      gravity: 7,
      radius: 0.3,
    });
    this.splash = burstStyle({
      count: 34,
      color: this.look.glob,
      color2: this.look.sheen,
      speed: [2.5, 8],
      spread: 0.9,
      life: [0.6, 1.4],
      size: [0.12, 0.34],
      gravity: 9,
      radius: 0.5,
    });
    this.fountain = burstStyle({
      count: 120,
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
    this.glass = burstStyle({
      count: 26,
      color: this.look.shard,
      color2: this.gold,
      intensity: 2.6,
      speed: [2, 6],
      spread: 1,
      life: [0.5, 1.2],
      size: [0.06, 0.18],
      gravity: 4,
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

    this.buildGround();
    this.buildTheatre();
    this.buildHills();
    this.buildBlot();
    this.buildAttacks();

    // --- The people. The scribe at the front of the orchestra; Reb Ezra and Dyo at the side.
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

    // --- The word to type, on a parchment banner high between the scribe and the Blot.
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
    this.text.anchor.set(TEXT_X, TEXT_Y, TEXT_Z);
    this.feedback = new TypingFeedback(ctx, {
      gold: this.gold,
      ink: this.inkDark,
      techelet: this.techelet,
    });

    this.onQuality(ctx.quality);
    this.placePeople();
    this.frameShot('fight', true);
  }

  private buildGround(): void {
    const { materials: kit, tracker, root } = this.ctx;
    const r = this.rng;
    const land = new PlaneGeometry(260, 260, 150, 150).rotateX(-Math.PI / 2);
    const pos = land.getAttribute('position');
    const colors = new Float32Array(pos.count * 3);
    const a = new Color();
    const b = new Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = ground(x, z);
      pos.setY(i, h);
      const d = Math.hypot(x, z);
      if (d < ORCHESTRA + 0.6) {
        a.setHex(TINT.pavingDark);
      } else {
        a.setHex(TINT.hill).lerp(b.setHex(TINT.hillGreen), smoothstep(40, 80, d) * 0.7);
        a.lerp(b.setHex(TINT.stoneDark), (1 - smoothstep(ORCHESTRA, 24, d)) * 0.5);
      }
      a.lerp(b.setHex(TINT.stoneShade), r.next() * 0.08);
      colors[i * 3] = a.r;
      colors[i * 3 + 1] = a.g;
      colors[i * 3 + 2] = a.b;
    }
    land.setAttribute('color', new BufferAttribute(colors, 3));
    land.computeVertexNormals();
    const mesh = new Mesh(tracker.track(land), tracker.track(kit.surface({ vertexColors: true })));
    mesh.receiveShadow = true;
    root.add(mesh);

    // The orchestra: limestone paving in rings of slabs, a rosette at the centre.
    const rings: BufferGeometry[] = [];
    const RINGS = 9;
    for (let k = 0; k < RINGS; k++) {
      const inner = k === 0 ? 0 : 0.6 + k * 1.6;
      const outer = 0.6 + (k + 1) * 1.6;
      const slabs = 10 + k * 6;
      for (let j = 0; j < slabs; j++) {
        const geo = new RingGeometry(
          inner,
          outer - 0.07,
          3,
          1,
          (j / slabs) * Math.PI * 2,
          (Math.PI * 2) / slabs - 0.012,
        );
        geo.rotateX(-Math.PI / 2);
        const tone = (k + j) % 3 === 0 ? TINT.paving : k % 2 ? TINT.stone : TINT.stoneLight;
        rings.push(
          painted(
            geo,
            a
              .setHex(tone)
              .lerp(b.setHex(TINT.stoneShade), r.next() * 0.12)
              .getHex(),
          ),
        );
      }
    }
    const floor = new Mesh(
      tracker.track(merged(rings)),
      tracker.track(kit.surface({ vertexColors: true, flat: true })),
    );
    floor.position.y = 0.02;
    floor.receiveShadow = true;
    root.add(floor);
  }

  /** The cavea (tiers of seats in a great arc behind the Blot), its colonnade, and the gates. */
  private buildTheatre(): void {
    const { materials: kit, tracker, root } = this.ctx;
    const r = this.rng;
    const p = this.v;
    const q = this.q;
    const s = this.s;
    // Seats: one stair-stepped profile turned on a lathe through the arc behind the stage.
    const profile: Vector2[] = [new Vector2(CAVEA_IN - 0.4, -0.2)];
    for (let i = 0; i < TIERS; i++) {
      const rIn = CAVEA_IN + i * TIER_DEPTH;
      profile.push(new Vector2(rIn, i * TIER_RISE), new Vector2(rIn, (i + 1) * TIER_RISE));
    }
    const rTop = CAVEA_IN + TIERS * TIER_DEPTH;
    profile.push(new Vector2(rTop + 3, TIERS * TIER_RISE), new Vector2(rTop + 3.2, -0.5));
    const lathe = new LatheGeometry(profile, 64, Math.PI - CAVEA_ARC / 2, CAVEA_ARC);
    const seats = lathe.toNonIndexed();
    lathe.dispose();
    const sp = seats.getAttribute('position');
    const sc = new Float32Array(sp.count * 3);
    const a = new Color();
    const b = new Color();
    for (let i = 0; i < sp.count; i += 3) {
      // One color per triangle: tiers alternate pale and warm stone, risers darker.
      let y = 0;
      let rad = 0;
      let vy = 0;
      for (let k = 0; k < 3; k++) {
        y += sp.getY(i + k) / 3;
        rad += Math.hypot(sp.getX(i + k), sp.getZ(i + k)) / 3;
        vy = Math.max(vy, Math.abs(sp.getY(i + k) - y));
      }
      const tier = Math.floor(Math.max(0, rad - CAVEA_IN) / TIER_DEPTH);
      a.setHex(tier % 2 ? TINT.stone : TINT.stoneLight);
      // Risers (vertical faces) sit in shade.
      const ny = Math.abs(sp.getY(i) - sp.getY(i + 1)) + Math.abs(sp.getY(i) - sp.getY(i + 2));
      if (ny > 0.2) a.lerp(b.setHex(TINT.stoneDark), 0.55);
      a.lerp(b.setHex(TINT.stoneShade), r.next() * 0.12);
      for (let k = 0; k < 3; k++) {
        sc[(i + k) * 3] = a.r;
        sc[(i + k) * 3 + 1] = a.g;
        sc[(i + k) * 3 + 2] = a.b;
      }
    }
    seats.setAttribute('color', new BufferAttribute(sc, 3));
    if (seats.getAttribute('uv')) seats.deleteAttribute('uv');
    seats.computeVertexNormals();
    const cavea = new Mesh(
      tracker.track(seats),
      tracker.track(kit.surface({ vertexColors: true, side: DoubleSide, flat: true })),
    );
    cavea.receiveShadow = true;
    kit.caster(cavea, true);
    root.add(cavea);

    // A colonnade along the top of the seats; time has broken some of the columns.
    const shaft = painted(new CylinderGeometry(0.42, 0.5, 1, 10).translate(0, 0.5, 0), TINT.column);
    const cols = new Batch();
    const caps = new Batch();
    const topY = TIERS * TIER_RISE;
    for (let i = 0; i < TOP_COLUMNS; i++) {
      const ang = Math.PI - CAVEA_ARC / 2 + (i + 0.5) * (CAVEA_ARC / TOP_COLUMNS);
      const rr = rTop + 1.5;
      p.set(Math.sin(ang) * rr, topY, Math.cos(ang) * rr);
      q.identity();
      const broken = r.next() < 0.3;
      const height = broken ? r.range(1.2, 3.4) : 5.2;
      s.set(1, height, 1);
      cols.add(p, q, s, r.next() < 0.5 ? TINT.column : TINT.stoneLight);
      if (!broken) {
        p.y = topY + height;
        s.set(1, 1, 1);
        q.setFromAxisAngle(UP, -ang);
        caps.add(p, q, s);
      }
    }
    const colMesh = cols.build(shaft, kit.surface({ vertexColors: true }));
    kit.caster(colMesh, true);
    tracker.track(colMesh.geometry);
    tracker.track(colMesh.material as Material);
    root.add(tracker.track(colMesh));
    const capGeo = painted(new BoxGeometry(1.5, 0.36, 1.5).translate(0, 0.18, 0), TINT.stoneLight);
    const capMesh = caps.build(capGeo, kit.surface({ vertexColors: true }));
    kit.caster(capMesh, true);
    tracker.track(capMesh.geometry);
    tracker.track(capMesh.material as Material);
    root.add(tracker.track(capMesh));

    // The two gates (parodoi) at the sides of the stage, framing the fight; and a low stage
    // front behind the scribe.
    const pylon = merged([
      painted(new BoxGeometry(2.2, 7.5, 2.2).translate(0, 3.75, 0), TINT.stone),
      painted(new BoxGeometry(2.8, 0.6, 2.8).translate(0, 7.8, 0), TINT.stoneLight),
      painted(new BoxGeometry(2.6, 0.5, 2.6).translate(0, 0.25, 0), TINT.stoneDark),
    ]);
    const gates = new Batch();
    for (const x of [-19.5, -15.5, 15.5, 19.5]) {
      p.set(x, 0, 4.5);
      q.identity();
      s.set(1, 1, 1);
      gates.add(p, q, s);
    }
    const gateMesh = gates.build(pylon, kit.surface({ vertexColors: true }));
    kit.caster(gateMesh, true);
    tracker.track(gateMesh.geometry);
    tracker.track(gateMesh.material as Material);
    root.add(tracker.track(gateMesh));
    const lintel = merged([
      painted(new BoxGeometry(6.8, 1, 2.4).translate(-17.5, 8.6, 4.5), TINT.stoneLight),
      painted(new BoxGeometry(6.8, 1, 2.4).translate(17.5, 8.6, 4.5), TINT.stoneLight),
      painted(new BoxGeometry(30, 1.1, 1.2).translate(0, 0.55, ORCHESTRA + 1.6), TINT.stoneDark),
    ]);
    const lintels = new Mesh(
      tracker.track(lintel),
      tracker.track(kit.surface({ vertexColors: true })),
    );
    kit.caster(lintels, true);
    root.add(lintels);
  }

  /** Olive trees and cypresses on the hills round the theatre. */
  private buildHills(): void {
    const { materials: kit, tracker, root } = this.ctx;
    const r = this.rng;
    const p = this.v;
    const q = this.q;
    const s = this.s;
    const olive = merged([
      painted(new CylinderGeometry(0.16, 0.26, 2, 5).translate(0, 1, 0), 0x6b5440),
      painted(
        new IcosahedronGeometry(1.5, 0).scale(1.2, 0.8, 1.2).translate(0, 2.6, 0),
        TINT.olive,
      ),
      painted(new IcosahedronGeometry(1, 0).translate(0.7, 3.1, 0.3), TINT.oliveDark),
    ]);
    const olives = new Batch();
    for (let i = 0; i < OLIVES; i++) {
      const a = r.range(0, Math.PI * 2);
      const d = r.range(44, 95);
      const x = Math.sin(a) * d;
      const z = Math.cos(a) * d;
      p.set(x, ground(x, z) - 0.1, z);
      q.setFromAxisAngle(UP, r.range(0, 6));
      s.setScalar(r.range(0.9, 1.6));
      olives.add(p, q, s);
    }
    const om = olives.build(olive, kit.surface({ vertexColors: true }));
    kit.caster(om, true);
    tracker.track(om.geometry);
    tracker.track(om.material as Material);
    root.add(tracker.track(om));
    const cone = painted(new ConeGeometry(0.9, 6, 7).translate(0, 3, 0), TINT.oliveDark);
    const cyp = new Batch();
    for (let i = 0; i < CYPRESSES; i++) {
      const a = Math.PI + r.range(-1.4, 1.4);
      const d = r.range(48, 70);
      const x = Math.sin(a) * d;
      const z = Math.cos(a) * d;
      p.set(x, ground(x, z) - 0.2, z);
      q.identity();
      s.set(1, r.range(0.9, 1.5), 1);
      cyp.add(p, q, s);
    }
    const cm = cyp.build(cone, kit.surface({ vertexColors: true }));
    kit.caster(cm, true);
    tracker.track(cm.geometry);
    tracker.track(cm.material as Material);
    root.add(tracker.track(cm));
  }

  /** The Great Blot: a living drop of ink, two pale eyes, brows that show its mood, a seal. */
  private buildBlot(): void {
    const { materials: kit, tracker, root } = this.ctx;
    this.blot = new Group();
    this.blot.position.set(0, BLOT_R * 0.7, BLOT_Z);
    const L = this.look;
    // Cut glass has big facets; ink and cloud and sea are finely rolled.
    const geo = new IcosahedronGeometry(1, L.facets ? 3 : 9);
    const dirs = geo.getAttribute('position');
    this.blotDirs = new Float32Array(dirs.array as ArrayLike<number>);
    geo.deleteAttribute('uv');
    this.blotPos = geo.getAttribute('position') as BufferAttribute;
    this.blotNormal = geo.getAttribute('normal') as BufferAttribute;
    this.blotMat = kit.surface({
      color: L.body,
      restore: false,
      emissive: L.sheen,
      emissiveIntensity: L.emissive,
      flat: true,
    });
    this.blotMesh = new Mesh(tracker.track(geo), tracker.track(this.blotMat));
    this.blotMesh.frustumCulled = false;
    kit.caster(this.blotMesh, true);
    this.blot.add(this.blotMesh);

    const eyeGeo = tracker.track(new SphereGeometry(1, 16, 12));
    const eyeMat = tracker.track(kit.ink(L.eye, 1.5));
    const pupilMat = tracker.track(kit.surface({ color: L.pupil, restore: false }));
    const browGeo = tracker.track(new BoxGeometry(0.62, 0.11, 0.12));
    const browMat = tracker.track(kit.surface({ color: L.body, restore: false }));
    for (const side of [-1, 1]) {
      const eye = new Mesh(eyeGeo, eyeMat);
      eye.scale.set(0.2, 0.26, 0.1);
      eye.position.set(side * 0.3, 0.26, 0.93);
      const pupil = new Mesh(eyeGeo, pupilMat);
      pupil.scale.set(0.09, 0.12, 0.06);
      pupil.position.set(side * 0.3, 0.24, 1.0);
      const brow = new Mesh(browGeo, browMat);
      brow.position.set(side * 0.3, 0.55, 0.92);
      this.eyes.push(eye);
      this.pupils.push(pupil);
      this.brows.push(brow);
      this.blot.add(eye, pupil, brow);
    }
    this.buildParts();
    this.seal = new Mesh(
      tracker.track(new TorusGeometry(0.2, 0.035, 6, 24)),
      tracker.track(kit.ink(this.gold, 2.6)),
    );
    this.seal.position.set(0, -0.12, 1.06);
    this.seal.visible = false;
    this.blot.add(this.seal);
    this.blot.scale.setScalar(BLOT_R);
    root.add(this.blot);
    // The pool of ink the Blot sits in, staining the paving round it.
    this.pool = new Mesh(
      tracker.track(new IcosahedronGeometry(1, 2).scale(1, 0.04, 1)),
      tracker.track(
        kit.surface({
          color: L.tide,
          restore: false,
          emissive: L.sheen,
          emissiveIntensity: 0.15,
        }),
      ),
    );
    this.pool.position.set(0, 0.03, BLOT_Z);
    root.add(this.pool);
    this.ctx.atmosphere.addBlob(this.blot, BLOT_R * 0.9);
  }

  /** The trials' own parts (T26), children of the body so they follow its size and squash. */
  private buildParts(): void {
    const { materials: kit, tracker } = this.ctx;
    const L = this.look;
    if (this.lookId === 'storm') {
      // Two wings of storm cloud, edged in lightning, that beat faster as the fight goes on.
      const geo = tracker.track(new ConeGeometry(0.55, 1.9, 4, 1).scale(1, 1, 0.22));
      const mat = tracker.track(
        kit.surface({
          color: L.body,
          restore: false,
          emissive: L.sheen,
          emissiveIntensity: 0.5,
          flat: true,
        }),
      );
      for (const side of [-1, 1]) {
        const w = new Mesh(geo, mat);
        w.position.set(side * 0.95, 0.1, -0.15);
        w.userData.side = side;
        kit.caster(w, true);
        this.parts.push(w);
        this.blot.add(w);
      }
    } else if (this.lookId === 'glass') {
      // A crown of crystal points that glints.
      const geo = tracker.track(new OctahedronGeometry(1, 0).scale(0.16, 0.42, 0.16));
      const mat = tracker.track(kit.ink(L.shard, 1.5));
      const n = 7;
      for (let i = 0; i < n; i++) {
        const a = (i / (n - 1) - 0.5) * 2.2;
        const c = new Mesh(geo, mat);
        c.position.set(Math.sin(a) * 0.55, 0.88 - Math.abs(a) * 0.12, Math.cos(a) * 0.1 - 0.15);
        c.rotation.z = -a * 0.45;
        c.scale.setScalar(1 - Math.abs(a) * 0.25);
        this.parts.push(c);
        this.blot.add(c);
      }
    } else if (this.lookId === 'tide') {
      // A great tail fin behind, swaying with the swell.
      const geo = tracker.track(new ConeGeometry(0.7, 1.3, 3, 1).scale(1.6, 1, 0.18));
      const mat = tracker.track(
        kit.surface({
          color: L.body,
          restore: false,
          emissive: L.sheen,
          emissiveIntensity: 0.25,
          flat: true,
        }),
      );
      const fin = new Mesh(geo, mat);
      fin.position.set(0, 0.25, -1.2);
      fin.rotation.x = -Math.PI / 2 - 0.5;
      kit.caster(fin, true);
      this.parts.push(fin);
      this.blot.add(fin);
    }
  }

  /** Moves the trials' parts (no allocations). */
  private moveParts(resting: boolean, dt: number): void {
    const t = this.time;
    if (this.lookId === 'storm') {
      const beat = resting ? 2 : 5 + this.phase * 1.6 + this.shown * 4;
      this.wingT += beat * dt;
      const flap = Math.sin(this.wingT * Math.PI) * (resting ? 0.15 : 0.4);
      for (const w of this.parts) {
        const side = w.userData.side as number;
        w.rotation.z = side * (Math.PI / 2 + 0.25 + flap);
        w.rotation.y = side * 0.35;
      }
    } else if (this.lookId === 'glass') {
      for (let i = 0; i < this.parts.length; i++) {
        const c = this.parts[i] as Mesh;
        c.rotation.y = t * 0.6 + i;
        const glint = 1 + this.healGlow * 0.4 + Math.max(0, Math.sin(t * 2.3 + i * 1.7)) * 0.08;
        c.scale.y = (1 - Math.abs(i / (this.parts.length - 1) - 0.5) * 0.5) * glint;
      }
    } else if (this.lookId === 'tide') {
      const fin = this.parts[0];
      if (fin) {
        const swell = 1 + (this.fight?.tideNow ?? 0) * 0.6;
        fin.rotation.z = Math.sin(t * 1.4) * 0.35 * swell;
        fin.rotation.x = -Math.PI / 2 - 0.5 + Math.sin(t * 1.1) * 0.15 * swell;
      }
    }
  }

  private buildAttacks(): void {
    const { materials: kit, tracker, root } = this.ctx;
    const inkMat = tracker.track(
      kit.surface({
        color: this.look.glob,
        restore: false,
        emissive: this.look.sheen,
        emissiveIntensity: this.lookId === 'blot' ? 0.3 : 0.4,
      }),
    );
    // Spatter: one glob in the air at a time, and the ring on the floor that says where it lands.
    this.glob = new Mesh(tracker.track(new IcosahedronGeometry(1.05, 2)), inkMat);
    this.glob.visible = false;
    kit.caster(this.glob, true);
    root.add(this.glob);
    this.ring = new Mesh(
      tracker.track(new TorusGeometry(1, 0.06, 6, 40).rotateX(Math.PI / 2)),
      tracker.track(kit.ink(this.errColor, 1.6)),
    );
    this.ring.visible = false;
    root.add(this.ring);
    // Tendrils: a chain of ink beads.
    this.tendril = new InstancedMesh(tracker.track(new IcosahedronGeometry(1, 1)), inkMat, TENDRIL);
    this.tendril.count = 0;
    this.tendril.frustumCulled = false;
    kit.caster(this.tendril, true);
    root.add(tracker.track(this.tendril));
    // Flood: a flat ring of ink round the scribe (scaled: inner radius = scale) and its crest.
    this.tide = new Mesh(
      tracker.track(new RingGeometry(1, 34, 72, 1).rotateX(-Math.PI / 2)),
      tracker.track(
        kit.surface({
          color: this.look.tide,
          restore: false,
          emissive: this.look.sheen,
          emissiveIntensity: this.lookId === 'tide' ? 0.35 : 0.18,
          side: DoubleSide,
        }),
      ),
    );
    this.tide.visible = false;
    this.tide.receiveShadow = true;
    root.add(this.tide);
    this.crest = new InstancedMesh(tracker.track(new IcosahedronGeometry(1, 1)), inkMat, CREST);
    this.crest.count = 0;
    this.crest.frustumCulled = false;
    root.add(tracker.track(this.crest));
    // Mirror: shards of glass that circle the scribe.
    this.shards = new InstancedMesh(
      tracker.track(new OctahedronGeometry(1, 0).scale(0.28, 1.15, 0.06)),
      tracker.track(kit.ink(this.look.shard, 1.7)),
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
      this.boltTrail.push(null);
      root.add(b);
    }
  }

  onQuality(preset: QualityPreset): void {
    const full = preset.shadows === 'cascaded';
    this.apprentice?.shadowDetail(full);
    this.ezra?.shadowDetail(full);
  }

  private placePeople(): void {
    this.apprentice.root.position.set(SCRIBE_X, 0, SCRIBE_Z);
    this.apprentice.root.rotation.y = Math.PI + Math.atan2(SCRIBE_X, SCRIBE_Z - BLOT_Z);
    this.ezra.root.position.set(EZRA_X, 0, EZRA_Z);
    this.ezra.root.rotation.y = Math.atan2(-EZRA_X, -EZRA_Z - 2);
    this.dyo.root.position.set(EZRA_X - 1.3, 0, EZRA_Z + 1.1);
    this.dyo.face(0, BLOT_Z);
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
    this.blotGone = false;
    this.blot.visible = true;
    this.transT = -1;
    this.gatherT = -1;
    this.rainT = -1;
    this.rained = 0;
    this.landT = -1;
    this.snapT = -1;
    this.shown = 0;
    this.flinch = 0;
    this.flinchV = 0;
    this.reel = 0;
    this.heardTier = 0;
    this.shownLetters = null;
    this.rollT = -1;
    this.roll = 0;
    this.ctx.audio.intensity(0);
    for (let i = 0; i < BOLTS; i++) {
      this.boltT[i] = -1;
      (this.bolts[i] as Mesh).visible = false;
      this.boltTrail[i]?.stop();
      this.boltTrail[i] = null;
    }
    this.placePeople();
  }

  /** A new fight (or the same one from a checkpoint): the scene follows `fight`. */
  watch(fight: BossFight): void {
    this.reset();
    this.fight = fight;
    this.plan = fight.plan;
    this.setPhaseLook(fight.phase, true);
    this.frameShot('fight', true);
    this.ctx.audio.section(fight.def.music);
  }

  /** The look of phase `i`: its light, its grade, the Blot's color, the banner's style. */
  private setPhaseLook(i: number, now: boolean): void {
    const { ctx } = this;
    this.phase = i;
    this.attack = this.plan?.phases[i]?.def.attack ?? 'spatter';
    const light = LIGHT_OF[i] ?? 'p1';
    this.toLight(light, now ? 0 : 1.6);
    ctx.post.setGrade(this.grade(light));
    // The Blot turns to its mirror; a trial turns to its fury color in its last phase.
    const last = i >= (this.plan?.phases.length ?? 4) - 1;
    this.mirrorWant = this.isMirror ? 1 : this.lookId !== 'blot' && last ? 0.65 : 0;
    if (now) this.mirror = this.mirrorWant;
    this.text.setStyle(this.isMirror || this.lookId === 'glass' ? 'hologram' : 'banner');
    this.tideScale = 13;
    // Color has come back as far as the fight has gone (the sweeps of earlier phases).
    if (now && i > 0) {
      for (let k = 1; k <= i; k++) this.ctx.materials.sweep(0, 0, BLOT_Z, 10 + k * 9, 0.05);
    }
  }

  /** The Great Blot's mirror phase (the world turns over); the trials never turn the world. */
  private get isMirror(): boolean {
    return this.attack === 'mirror' && this.lookId === 'blot';
  }

  private toLight(light: ArenaLight, seconds: number): void {
    this.light = light;
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

  private frameShot(name: string, cut = false, rate = 2): void {
    const s = SHOTS[name];
    if (!s) return;
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

  // ---- typing -------------------------------------------------------------------------------

  onKey(ev: TypedKey): void {
    const { typing, audio, vfx } = this.ctx;
    if (!ev.correct) {
      this.text.miss();
      this.feedback.wrong();
      audio.play('error');
      this.hearTier(typing.tier);
      // A slip feeds the Blot: it swells a little.
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
    // Every right letter chips ink off the Blot's front, and the flood draws back a little.
    const b = this.blot.position;
    vfx.burst(
      this.chips,
      b.x + this.rng.signed() * 1.2,
      b.y + this.rng.signed(),
      b.z + this.blotSize * 0.9,
      0,
      0.6,
      1,
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
    this.ctx.audio.intensity(Math.max(0.25, tierIntensity(tier)));
  }

  onWord(_word: string, perfect: boolean): void {
    const a = this.text.anchor;
    this.feedback.word(a.x, a.y, a.z, perfect);
    this.ctx.audio.play(perfect ? 'perfect' : 'word');
    this.fireBolt(perfect);
  }

  /** A bolt of gold ink from the quill into the Blot. */
  private fireBolt(strong: boolean): void {
    const i = this.nextBolt;
    this.nextBolt = (i + 1) % BOLTS;
    this.apprentice.quillTip.getWorldPosition(this.boltFrom[i] as Vector3);
    this.boltT[i] = 0;
    const b = this.bolts[i] as Mesh;
    b.visible = true;
    b.scale.setScalar(strong ? 1.5 : 1);
    this.boltTrail[i]?.stop();
    this.boltTrail[i] = this.ctx.vfx.trail(this.gold, strong ? 0.3 : 0.2, 0.45, 2.6);
    this.ctx.audio.play('whoosh');
  }

  /** Squash the Blot (positive: it is struck and shrinks back; negative: it swells). */
  private kick(amount: number): void {
    this.flinchV += amount * 6;
  }

  // ---- what the fight tells the scene ----------------------------------------------------------

  /** The attack reached the scribe. */
  land(): void {
    const { vfx, audio } = this.ctx;
    this.landT = 0;
    const p = this.apprentice.root.position;
    vfx.burst(this.splash, p.x, p.y + 1.6, p.z, 0, 1, 0, true);
    vfx.shockwave(p.x, 0.05, p.z, 4, this.look.glob, 0.6, true, 1);
    vfx.impact(0.8, this.look.sheen);
    if (this.lookId === 'storm') vfx.flash(0xe8f2ff, 0.35, 0.18);
    audio.playAt('impact', p.x, p.y, p.z, 0.2);
    this.apprentice.play('stagger');
    this.kick(-1.2);
    this.dyo.hop(this.dyo.root.position.x, 0, this.dyo.root.position.z, 0.9, 0.4, 0, SCRIBE_Z);
  }

  /** A group was finished before its attack landed: the attack breaks in gold. */
  parry(weak: boolean): void {
    const { vfx, audio } = this.ctx;
    this.snapT = 0;
    const p = this.v3;
    this.attackPoint(p);
    switch (this.attack) {
      case 'spatter':
        vfx.burst(this.fountain, p.x, p.y, p.z, 0, 1, 0);
        vfx.burst(this.splash, p.x, p.y, p.z, 0, 0.4, 0, true);
        vfx.shockwave(p.x, p.y, p.z, 3.4, this.gold, 0.5, false, 2);
        break;
      case 'tendril':
        for (let i = 0; i < TENDRIL; i += 3) {
          this.tendrilPoint(i / (TENDRIL - 1), this.shown, p);
          vfx.burst(this.foam, p.x, p.y, p.z, 0, 1, 0);
        }
        break;
      case 'flood': {
        const c = this.apprentice.root.position;
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * Math.PI * 2;
          vfx.burst(
            this.foam,
            c.x + Math.sin(a) * this.tideScale,
            0.3,
            c.z + Math.cos(a) * this.tideScale,
            0,
            1,
            0,
          );
        }
        vfx.shockwave(c.x, 0.08, c.z, this.tideScale + 6, this.gold, 0.7, true, 1.8);
        break;
      }
      case 'mirror':
        vfx.burst(this.glass, p.x, p.y, p.z, 0, 1, 0);
        vfx.shockwave(p.x, p.y, p.z, 2.6, this.look.shard, 0.45, false, 2);
        break;
    }
    audio.play('shatter');
    if (this.lookId === 'storm') vfx.flash(0xfff6c8, 0.25, 0.12);
    if (weak) this.stagger();
  }

  /**
   * A slip mended the Glass Golem (T26): shards of light fly back into it, it swells a little
   * and glows. `amount` is the characters of health it won back.
   */
  heal(amount: number): void {
    if (amount <= 0) return;
    const { vfx, audio } = this.ctx;
    const b = this.blot.position;
    this.healGlow = 1;
    this.kick(-0.9);
    vfx.burst(this.glass, b.x, b.y + this.blotSize * 0.4, b.z + this.blotSize * 0.6, 0, 0.5, 1);
    vfx.shockwave(b.x, b.y, b.z, this.blotSize * 1.6, this.look.sheen, 0.4, false, 1.4);
    audio.playAt('whoosh', b.x, b.y, b.z, 0.4);
  }

  /** A weak point struck clean: the Blot reels and the seal bursts. */
  stagger(): void {
    const { vfx, audio } = this.ctx;
    this.reel = 1.4;
    this.kick(2.4);
    const b = this.blot.position;
    vfx.burst(this.fountain, b.x, b.y, b.z + this.blotSize, 0, 0.6, 1);
    vfx.shockwave(b.x, b.y, b.z + this.blotSize, 5, this.gold, 0.6, false, 2.2);
    vfx.impact(0.6, this.gold);
    audio.play('impact');
    this.ezra.play('cheer');
    this.dyo.cheer(3);
  }

  /**
   * The cinematic between phases: hit-stop, a push-in on the Blot, a roar of ink, the light
   * shifting to the next phase's, and the music's next section. Runs on real time (`frame`).
   */
  transition(to: number): void {
    const { vfx, audio, loop } = this.ctx;
    this.transT = 0;
    this.transTo = to;
    this.snapT = 0;
    if (this.motion) loop.hitStop(0.5, 0);
    vfx.flash(0xffffff, 0.55, 0.5);
    const b = this.blot.position;
    vfx.shockwave(b.x, 0.1, b.z, 30, this.gold, 1.4, true, 2.2);
    vfx.burst(this.splash, b.x, b.y + this.blotSize, b.z, 0, 1, 0, true);
    vfx.burst(this.fountain, b.x, b.y, b.z, 0, 1, 0);
    vfx.restore(b.x, 0, b.z, 12 + to * 9, 1.8);
    this.kick(3.5);
    audio.play('impact');
    audio.play('shatter');
    this.apprentice.play('cheer');
    this.dyo.cheer(4);
  }

  /** The last word: the Blot freezes, trembling, before the victory cutscene. */
  victory(): void {
    if (this.won) return;
    this.won = true;
    this.snapT = 0;
    const { vfx, audio, loop } = this.ctx;
    if (this.motion) loop.hitStop(0.7, 0.05);
    vfx.flash(0xffffff, 0.6, 0.6);
    vfx.impact(1, this.gold);
    audio.play('impact');
    this.kick(4);
    this.reel = 3;
  }

  /** Sofer's Trial failed: the Blot swells, the scribe staggers. */
  failed(): void {
    this.kick(-2.5);
    this.apprentice.play('stagger');
    this.ezra.play('stagger');
  }

  /** A camera shot of the victory cutscene. */
  shotFor(name: string): void {
    const near = SHOTS[name] && this.shot === SHOTS[name];
    if (near) return;
    // Far jumps cut; the wide shot and the road glide.
    const glide = name === 'wide' || name === 'road';
    this.frameShot(name, !glide, glide ? 0.9 : 2);
  }

  /** A cue of the victory cutscene. */
  cue(name: string): void {
    const { vfx, audio, materials } = this.ctx;
    switch (name) {
      case 'shatter':
        this.rainT = 0;
        this.rained = 0;
        audio.play('whoosh');
        break;
      case 'restore':
        this.restoredAll = true;
        materials.restoreAll(1, 2.6);
        vfx.restore(0, 0, BLOT_Z, 70, 2.4);
        vfx.shockwave(0, 0.1, BLOT_Z, 60, this.gold, 2.2, true, 2.4);
        this.toLight('restored', 2.4);
        this.ctx.post.setGrade(GRADES.restored);
        this.mirrorWant = 0;
        audio.play('success');
        audio.section(this.plan?.phases[0]?.def.music ?? 'phase1');
        audio.intensity(1);
        this.apprentice.play('cheer');
        break;
      case 'sky':
        for (let k = 0; k < 6; k++) {
          vfx.burst(
            this.fountain,
            this.rng.range(-20, 20),
            this.rng.range(2, 9),
            this.rng.range(-26, -8),
            0,
            1,
            0,
          );
        }
        break;
      case 'gather':
        this.gatherT = 0;
        this.ezra.play('cheer');
        break;
      case 'gate':
        this.apprentice.root.rotation.y = Math.PI;
        this.dyo.cheer(5);
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
    // The Blot's squash spring, and its reel after a weak point.
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
      const inner = 13 - 11.6 * this.shown;
      this.tideScale = damp(this.tideScale, inner, 4, dt);
    }
    // The Blot shrinks as its health falls.
    const health = f ? f.health : 1;
    const size = this.won ? 0.62 : 0.62 + 0.38 * health;
    this.blotSize = damp(this.blotSize, size * BLOT_R, 2.5, dt);
    this.mirror = damp(this.mirror, this.mirrorWant, 1.6, dt);
    this.shardSpin += dt * (0.8 + this.shown * 1.6);

    this.updateBolts(dt);
    this.updateRain(dt);

    if (this.gatherT >= 0) {
      // Reb Ezra and Dyo come down to the scribe.
      this.gatherT = Math.min(1, this.gatherT + dt / 2.2);
      const k = easeInOut(this.gatherT);
      const gx = SCRIBE_X + 2.3;
      const gz = SCRIBE_Z - 0.6;
      this.ezra.root.position.set(EZRA_X + (gx - EZRA_X) * k, 0, EZRA_Z + (gz - EZRA_Z) * k);
      this.ezra.root.rotation.y = Math.atan2(gx - EZRA_X, gz - EZRA_Z);
      if (this.gatherT >= 1) {
        this.gatherT = -1;
        // Turned to the scribe, a little toward the camera.
        this.ezra.root.rotation.y = Math.atan2(-2.3, 2.4);
        this.dyo.hop(SCRIBE_X + 1.2, 0, SCRIBE_Z + 0.9, 0.8, 0.5, SCRIBE_X, SCRIBE_Z + 6);
      }
    }

    this.apprentice.update(dt);
    this.ezra.update(dt);
    this.dyo.update(dt);
  }

  private updateBolts(dt: number): void {
    const { vfx, audio } = this.ctx;
    const b = this.blot.position;
    for (let i = 0; i < BOLTS; i++) {
      const t0 = this.boltT[i] as number;
      if (t0 < 0) continue;
      const t = Math.min(1, t0 + dt / BOLT_SECONDS);
      this.boltT[i] = t;
      const from = this.boltFrom[i] as Vector3;
      const mesh = this.bolts[i] as Mesh;
      // A shallow arc into the Blot's front.
      const tx = b.x + Math.sin(i * 2.1) * 0.8;
      const ty = b.y + 0.2;
      const tz = b.z + this.blotSize * 0.85;
      mesh.position.set(
        from.x + (tx - from.x) * t,
        from.y + (ty - from.y) * t + Math.sin(Math.PI * t) * 1.6,
        from.z + (tz - from.z) * t,
      );
      this.boltTrail[i]?.emit(mesh.position.x, mesh.position.y, mesh.position.z);
      if (t >= 1) {
        this.boltT[i] = -1;
        mesh.visible = false;
        this.boltTrail[i]?.stop();
        this.boltTrail[i] = null;
        vfx.burst(this.sparks, tx, ty, tz, 0, 0.5, 1);
        vfx.burst(this.chips, tx, ty, tz, 0, 0.5, 1, true);
        audio.playAt('impact-small', tx, ty, tz, 0.4);
        this.kick(mesh.scale.x > 1.2 ? 1.4 : 0.8);
      }
    }
  }

  /** The victory: the Blot trembles, then breaks into a rain of gold letters. */
  private updateRain(dt: number): void {
    if (this.rainT < 0) return;
    const { vfx, audio, materials } = this.ctx;
    const before = this.rainT;
    this.rainT += dt;
    const b = this.blot.position;
    if (!this.blotGone) {
      this.shake = Math.min(1, this.rainT / 1.4);
      if (this.rainT >= 1.4) {
        this.blotGone = true;
        this.blot.visible = false;
        vfx.burst(this.fountain, b.x, b.y, b.z, 0, 1, 0);
        vfx.burst(this.fountain, b.x, b.y + 1, b.z, 0, 1, 0);
        vfx.burst(this.splash, b.x, b.y, b.z, 0, 1, 0, true);
        vfx.shockwave(b.x, b.y, b.z, 14, this.gold, 0.8, false, 2.6);
        vfx.shockwave(b.x, 0.1, b.z, 40, this.gold, 1.6, true, 2.2);
        vfx.impact(1, this.gold);
        materials.sweep(b.x, 0, b.z, 26, 1.2);
        audio.play('shatter');
        audio.play('impact');
      }
      return;
    }
    // Gold letters burst from where the Blot was, a few each beat.
    const words = this.plan?.phases[0]?.words ?? [];
    if (this.rained < LETTERS_RAIN && Math.floor(before * 6) !== Math.floor(this.rainT * 6)) {
      const w = words[this.rained % Math.max(1, words.length)] ?? '';
      // charAt, not [...w]: no array is made each beat (no allocations in update()).
      const ch = w.charAt(this.rained % Math.max(1, w.length));
      if (ch) {
        vfx.shatter(
          ch,
          b.x + this.rng.signed() * 3,
          b.y + this.rng.range(0, 3),
          b.z + this.rng.signed() * 2,
          1.6,
          this.gold,
          2.4,
          4,
          0,
          1,
          0.5,
        );
      }
      this.rained += 1;
    }
    if (this.rainT > 6) this.rainT = -1;
  }

  /**
   * How far the Blot's skin reaches in the unit direction (x, y, z): breathing, wobbling,
   * knuckles in Phase II, drips in Phase III, leaning in as an attack winds up. The face (eyes,
   * brows, seal) sits on it too, so the skin never swallows the eyes.
   */
  private skin(x: number, y: number, z: number): number {
    const t = this.time;
    const phase = this.phase;
    const L = this.look;
    const angry = (0.07 + phase * 0.025 + this.shown * 0.05) * L.wobble;
    let r =
      1 +
      angry * Math.sin(3.1 * x + t * 1.7) * Math.sin(2.3 * y - t * 1.1) +
      0.05 * L.wobble * Math.sin(5.3 * z + t * 2.3 + y * 2) +
      this.shake * 0.06 * Math.sin(37 * x + 41 * y + t * 40);
    if (this.lookId !== 'blot') {
      const face =
        smoothstep(0.62, 0.32, Math.abs(x)) * smoothstep(-0.25, 0.05, y) * smoothstep(0.2, 0.6, z);
      if (L.spikes > 0 && y > -0.1) {
        // The Storm Hawk's crest: lightning feathers on the crown and the back, crackling.
        const f = Math.max(0, Math.sin(9 * x + 2 * z) * Math.sin(7 * y + 1.3 + t * 0.6));
        r +=
          L.spikes * (0.22 + this.shown * 0.12 + phase * 0.04) * f * f * f * (1 - face) * (0.4 + y);
      }
      if (L.waves > 0) {
        // The Long Tide's back rolls like a sea, harder at high tide.
        const swell = 1 + (this.fight?.tideNow ?? 0) * 0.5;
        r += L.waves * 0.1 * swell * Math.sin(4 * y + 3 * x - t * 2.2) * (1 - face);
      }
      if (L.facets && this.healGlow > 0) r += 0.04 * this.healGlow * Math.sin(20 * y + t * 30);
      if (z > 0) r += this.shown * 0.25 * z * z;
      return r;
    }
    if (phase === 1) {
      // Knuckles on the shoulders, where the tendrils come from (never on the face).
      const face = smoothstep(0.55, 0.3, Math.abs(x)) * smoothstep(-0.2, 0.1, y);
      r += 0.14 * Math.max(0, Math.sin(6 * x + 4 * y + t)) * Math.max(0, z) * (1 - face);
    }
    if (phase === 2 && y < 0) r += 0.08 * Math.max(0, Math.sin(9 * x + t * 2)) * -y;
    if (z > 0) r += this.shown * (this.attack === 'flood' ? 0.1 : 0.3) * z * z;
    return r;
  }

  /** Writes the Blot's skin into its mesh, with flat normals. */
  private writeBlot(): void {
    const dirs = this.blotDirs;
    const pos = this.blotPos.array as Float32Array;
    const nor = this.blotNormal.array as Float32Array;
    for (let i = 0; i < dirs.length; i += 3) {
      const x = dirs[i] as number;
      const y = dirs[i + 1] as number;
      const z = dirs[i + 2] as number;
      const r = this.skin(x, y, z);
      let px = x * r;
      let py = y * r;
      let pz = z * r;
      // The bottom pools out on the stage.
      if (py < -0.55) {
        const d = -0.55 - py;
        py = -0.55 - d * 0.18;
        px *= 1 + d * 0.6;
        pz *= 1 + d * 0.6;
      }
      pos[i] = px;
      pos[i + 1] = py;
      pos[i + 2] = pz;
    }
    // Flat normals, one per triangle (the low-poly look), worked out in place.
    for (let i = 0; i < pos.length; i += 9) {
      const ax = (pos[i + 3] as number) - (pos[i] as number);
      const ay = (pos[i + 4] as number) - (pos[i + 1] as number);
      const az = (pos[i + 5] as number) - (pos[i + 2] as number);
      const bx = (pos[i + 6] as number) - (pos[i] as number);
      const by = (pos[i + 7] as number) - (pos[i + 1] as number);
      const bz = (pos[i + 8] as number) - (pos[i + 2] as number);
      let nx = ay * bz - az * by;
      let ny = az * bx - ax * bz;
      let nz = ax * by - ay * bx;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;
      for (let k = 0; k < 9; k += 3) {
        nor[i + k] = nx;
        nor[i + k + 1] = ny;
        nor[i + k + 2] = nz;
      }
    }
    this.blotPos.needsUpdate = true;
    this.blotNormal.needsUpdate = true;
  }

  /** Where the current attack is (its glob, tendril tip, the flood's edge in front, a shard). */
  private attackPoint(out: Vector3): Vector3 {
    switch (this.attack) {
      case 'spatter':
        return this.globPoint(this.shown, out);
      case 'tendril':
        return this.tendrilPoint(1, this.shown, out);
      case 'flood': {
        const c = this.apprentice.root.position;
        return out.set(c.x, 0.4, c.z - this.tideScale);
      }
      case 'mirror': {
        const c = this.apprentice.root.position;
        const r = 8.5 - 7 * this.shown;
        return out.set(c.x + Math.sin(this.shardSpin) * r, 2, c.z + Math.cos(this.shardSpin) * r);
      }
    }
  }

  /** The glob's arc from the top of the Blot to over the scribe's head (w 0..1; 1 lands). */
  private globPoint(w: number, out: Vector3): Vector3 {
    const b = this.blot.position;
    const sx = b.x;
    const sy = b.y + this.blotSize * 0.9;
    const sz = b.z + 0.5;
    const ex = SCRIBE_X;
    const ey = w >= 1 ? 1.4 : 3.6;
    const ez = SCRIBE_Z - 0.2;
    const t = Math.min(1, w);
    return out.set(
      sx + (ex - sx) * t + Math.sin(this.time * 2.1) * 0.15 * (1 - t),
      sy + (ey - sy) * t + Math.sin(Math.PI * Math.min(1, t * 1.05)) * 3.2,
      sz + (ez - sz) * t,
    );
  }

  /** A point along the tendril (s 0 at the Blot, 1 at its tip) reaching `w` of the way. */
  private tendrilPoint(s: number, w: number, out: Vector3): Vector3 {
    const b = this.blot.position;
    const bx = b.x + 0.6;
    const by = b.y - this.blotSize * 0.25;
    const bz = b.z + this.blotSize * 0.85;
    const tx = SCRIBE_X;
    const ty = 1.3;
    const tz = SCRIBE_Z - 0.6;
    const k = s * w;
    const sway = Math.sin(k * 7 - this.time * 4) * 1.3 * k * (1 - k) * 2;
    return out.set(
      bx + (tx - bx) * k + sway,
      by + (ty - by) * k + Math.sin(Math.PI * k) * 4.2,
      bz + (tz - bz) * k,
    );
  }

  /** Whether this attack's 3D pieces are shown (a method, so no closure is made each frame). */
  private isAttackVisible(kind: AttackKind, live: boolean): boolean {
    return live && this.attack === kind && !this.won;
  }

  private writeAttacks(): void {
    const w = this.shown;
    const live = this.fight?.state === 'fight' || this.landT >= 0 || this.snapT >= 0;
    // Spatter.
    this.glob.visible = this.isAttackVisible('spatter', live) && w > 0.02;
    this.ring.visible = this.glob.visible;
    if (this.glob.visible) {
      this.globPoint(this.landT >= 0 ? 1 : w, this.glob.position);
      const wob = 1 + Math.sin(this.time * 9) * 0.06;
      this.glob.scale.set(wob, 2 - wob, wob);
      this.glob.rotation.y = this.time * 1.3;
      const c = this.apprentice.root.position;
      // The glob drips as it flies.
      if ((this.dripTimer -= 1 / 60) <= 0) {
        this.dripTimer = 0.09;
        const g = this.glob.position;
        this.ctx.vfx.burst(this.chips, g.x, g.y - 0.6, g.z, 0, -1, 0, true);
      }
      this.ring.position.set(c.x, 0.06, c.z);
      this.ring.scale.setScalar(Math.max(0.5, 2.8 - 2.2 * w));
    }
    // Tendril.
    if (this.isAttackVisible('tendril', live) && w > 0.02) {
      this.tendril.count = TENDRIL;
      for (let i = 0; i < TENDRIL; i++) {
        const s = i / (TENDRIL - 1);
        this.tendrilPoint(s, this.landT >= 0 ? 1 : w, this.v);
        const r = 0.8 - 0.55 * s + Math.sin(this.time * 6 + i) * 0.04;
        this.q.identity();
        this.s.setScalar(r);
        this.m4.compose(this.v, this.q, this.s);
        this.tendril.setMatrixAt(i, this.m4);
      }
      this.tendril.instanceMatrix.needsUpdate = true;
    } else {
      this.tendril.count = 0;
    }
    // Flood.
    const flood = this.isAttackVisible('flood', live);
    this.tide.visible = flood;
    if (flood) {
      const c = this.apprentice.root.position;
      this.tide.position.set(c.x, 0.04 + Math.sin(this.time * 1.4) * 0.02, c.z);
      this.tide.scale.set(this.tideScale, 1, this.tideScale);
      this.crest.count = CREST;
      for (let i = 0; i < CREST; i++) {
        const a = (i / CREST) * Math.PI * 2 + this.time * 0.2;
        const bob = Math.sin(this.time * 3 + i * 1.7) * 0.12;
        this.v.set(
          c.x + Math.sin(a) * this.tideScale,
          0.15 + bob,
          c.z + Math.cos(a) * this.tideScale,
        );
        this.q.identity();
        const high = this.lookId === 'tide' ? 0.35 * (1 + (this.fight?.tideNow ?? 0)) : 0;
        this.s.set(0.55, 0.3 + this.shown * 0.4 + bob + high, 0.55);
        this.m4.compose(this.v, this.q, this.s);
        this.crest.setMatrixAt(i, this.m4);
      }
      this.crest.instanceMatrix.needsUpdate = true;
    } else {
      this.crest.count = 0;
    }
    // Mirror shards.
    if (this.isAttackVisible('mirror', live)) {
      const c = this.apprentice.root.position;
      const r = 8.5 - 7 * (this.landT >= 0 ? 1 : w);
      this.shards.count = SHARDS;
      for (let i = 0; i < SHARDS; i++) {
        const a = this.shardSpin + (i / SHARDS) * Math.PI * 2;
        this.v.set(
          c.x + Math.sin(a) * r,
          2 + Math.sin(this.time * 2 + i) * 0.5,
          c.z + Math.cos(a) * r,
        );
        this.q.setFromAxisAngle(UP, a + Math.PI / 2);
        this.s.setScalar(1 + this.shown * 0.4);
        this.m4.compose(this.v, this.q, this.s);
        this.shards.setMatrixAt(i, this.m4);
      }
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
        this.setPhaseLook(this.transTo, false);
        this.ctx.audio.section(this.plan?.phases[this.transTo]?.def.music ?? 'phase1');
        if (this.isMirror && this.motion) this.rollT = 0;
      }
      if (this.transT >= 3) {
        this.transT = -1;
        this.onTransitionEnd?.();
      }
    }
    // The push-in on the Blot during a transition (reduce motion: none).
    const pushWant =
      this.transT >= 0 && this.motion
        ? smoothstep(0.1, 0.7, this.transT) * (1 - smoothstep(2.1, 2.9, this.transT))
        : 0;
    this.push = damp(this.push, pushWant, 6, dt);
    if (this.palT < 1) {
      this.palT = Math.min(1, this.palT + dt * this.palRate);
      this.applyPalette(this.palT);
    }
    // The mirror's roll: the whole world turns over once.
    if (this.rollT >= 0) {
      this.rollT = Math.min(1, this.rollT + dt / 1.7);
      this.roll = easeInOut(this.rollT) * Math.PI * 2;
      if (this.rollT >= 1) {
        this.rollT = -1;
        this.roll = 0;
      }
    }
    const tilt = this.motion && this.isMirror && !this.won ? Math.sin(this.time * 0.5) * 0.06 : 0;
    rig.camera.up.set(Math.sin(this.roll + tilt), Math.cos(this.roll + tilt), 0);

    // The camera glides to its shot, leaning in with the push.
    const s = this.shot;
    this.camPos.x = damp(this.camPos.x, s.pos.x, this.shotRate, dt);
    this.camPos.y = damp(this.camPos.y, s.pos.y, this.shotRate, dt);
    this.camPos.z = damp(this.camPos.z, s.pos.z, this.shotRate, dt);
    this.camLook.x = damp(this.camLook.x, s.look.x, this.shotRate, dt);
    this.camLook.y = damp(this.camLook.y, s.look.y, this.shotRate, dt);
    this.camLook.z = damp(this.camLook.z, s.look.z, this.shotRate, dt);
    const boss = SHOTS.boss as Shot;
    const sway = this.motion ? Math.sin(this.time * 0.23) * 0.25 : 0;
    this.v.copy(this.camPos).lerp(boss.pos, this.push * 0.85);
    this.v.x += sway;
    this.v2.copy(this.camLook).lerp(boss.look, this.push * 0.85);
    rig.fixed(this.v, this.v2);

    // The Blot: its size, squash, a reel after a weak point, its color in the mirror.
    const squash = Math.max(-0.35, Math.min(0.35, this.flinch * 0.08));
    const sz = this.blotSize;
    const reel = this.reel > 0 ? Math.sin(this.time * 18) * 0.12 * Math.min(1, this.reel) : 0;
    const [stx, sty, stz] = this.look.stretch;
    this.blot.scale.set(
      sz * stx * (1 + squash * 0.6),
      sz * sty * (1 - squash),
      sz * stz * (1 + squash * 0.6),
    );
    // The Storm Hawk hovers over the stage; the others sit in their pool.
    const hover = this.lookId === 'storm' ? 1.6 + Math.sin(this.time * 2.1) * 0.35 : 0;
    this.blot.position.y =
      sz * 0.7 * this.look.stretch[1] * (1 - squash) + Math.sin(this.time * 1.3) * 0.08 + hover;
    this.blot.rotation.z = reel;
    this.pool.visible = !this.blotGone;
    this.pool.scale.set(sz * 1.45 + Math.sin(this.time * 0.8) * 0.15, 1, sz * 1.3);
    this.blot.rotation.y = FACE_SCRIBE + Math.sin(this.time * 0.4) * 0.1;
    this.healGlow = Math.max(0, this.healGlow - dt * 1.4);
    const resting = f?.resting === true;
    this.blotMat.color.setHex(this.look.body).lerp(this.cA.setHex(this.look.turn), this.mirror);
    this.blotMat.emissiveIntensity =
      this.look.emissive +
      (this.reel > 0 ? 0.8 : 0) +
      this.shown * 0.3 +
      this.healGlow * 1.6 -
      (resting ? 0.2 : 0);
    this.writeBlot();
    this.moveParts(resting, dt);
    // Eyes watch the scribe; brows show the mood; they squeeze shut when it reels.
    const ap = this.apprentice.root.position;
    const look = Math.atan2(ap.x - this.blot.position.x, ap.z - this.blot.position.z) * 0.2;
    // Eyes squeeze shut when it reels, and half close while it rests between bursts.
    const blink = this.reel > 0 || Math.sin(this.time * 0.9) > 0.995 ? 0.25 : resting ? 0.55 : 1;
    const brow = this.look.brows[this.phase] ?? 0.1;
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1;
      const eye = this.eyes[i] as Mesh;
      eye.scale.y = 0.26 * blink;
      const pupil = this.pupils[i] as Mesh;
      // Eyes, pupils and brows sit on the skin where it is now.
      const ex = side * 0.3;
      const ez = Math.sqrt(1 - ex * ex - 0.26 * 0.26);
      const er = this.skin(ex, 0.26, ez);
      eye.position.set(ex * er, 0.26 * er, ez * er);
      pupil.position.set(ex * er + look * 0.5, 0.25 * er, ez * er + 0.06);
      (this.brows[i] as Mesh).position.set(ex * er, 0.53 * er, ez * er - 0.02);
      pupil.scale.y = 0.12 * blink;
      (this.brows[i] as Mesh).rotation.z = -side * (brow + this.shown * 0.2);
    }
    // The seal: a weak point is up.
    const weak = !!f && f.weakNow && this.transT < 0;
    this.seal.visible = weak;
    if (weak) {
      const sr = this.skin(0, -0.12, 0.99);
      this.seal.position.set(0, -0.12 * sr, 0.99 * sr + 0.05);
      this.seal.rotation.z = this.time * 2;
      this.seal.scale.setScalar(1 + Math.sin(this.time * 8) * 0.12);
    }

    this.writeAttacks();

    // The Storm Hawk's sky: lightning now and then over the theatre while the fight is on.
    if (this.lookId === 'storm' && f?.state === 'fight' && !this.won) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) {
        this.flashTimer = this.rng.range(STORM_FLASH[0], STORM_FLASH[1]);
        if (this.motion) vfx.flash(0xeef4ff, 0.18 + this.phase * 0.06, 0.14);
        const x = this.rng.range(-26, 26);
        const z = this.rng.range(-40, -14);
        vfx.shockwave(x, ground(x, z) + 0.2, z, 6, this.look.sheen, 0.5, true, 1.5);
        this.ctx.audio.playAt('impact', x, 6, z, 0.12);
      }
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
    // Pale motes drift over the stage (gold ones once it is restored).
    if ((this.moteTimer -= dt) <= 0) {
      this.moteTimer = this.restoredAll ? 0.08 : 0.3;
      vfx.burst(this.motes, 0, 4, 0);
    }

    // The word to type: a new one rises when the driver moves on.
    if (typing.letters !== this.shownLetters) {
      this.shownLetters = typing.letters;
      const n = typing.letters.length;
      const end = n > 0 && typing.letters[n - 1] === ' ' ? n - 1 : n;
      this.text.setWord(this.won ? [] : typing.letters.slice(0, end), /[֐-׿]/.test(typing.word));
    }
    const a = this.text.anchor;
    a.y = damp(a.y, this.transT >= 0 ? 13 : TEXT_Y, 3, dt);
    this.text.root.visible = !this.won;
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
    if (this.ctx) {
      this.ctx.rig.camera.up.set(0, 1, 0);
      this.ctx.atmosphere.removeBlob(this.blot);
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
    this.text?.dispose();
    this.feedback?.dispose();
    this.shownLetters = null;
    this.fight = null;
    this.plan = null;
    this.onStep = null;
    this.onTransitionEnd = null;
  }
}
