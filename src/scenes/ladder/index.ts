// The Ladder (T28): endless free play.
//
// A tower of letters rising out of a sea of clouds, with no top. Its walls are courses of
// parchment and sandstone tiles, each tile carved with one of the letters the player has learned
// (a few of them shine gold), and a cedar stair winds round it, half a turn for every floor. The
// apprentice climbs it with Dyo flying at his shoulder; every right letter is a step up. Every
// fifth floor a stone landing rings the tower with blue-and-gold pennants: the grip is refilled
// there and the player may rest and bank his height.
//
// Every floor is a small challenge from another region: a gale off Hermon (wind streaks race past
// and the grip tires faster), a cloud bank like the Caves' dark (the tower drowns in mist and the
// next word cannot be read ahead), glass rungs like the Scroll (crystal steps that ring on a
// slip), long words like the Rail (the rungs glow amber), or a swarm of Blots from the Arena
// clinging to the steps, one knocked off with every word. The grip (src/scenes/ladder/plan.ts)
// tires on every difficulty but Calm; the first time it gives out Dyo swoops in and catches the
// apprentice, the second time he drops softly into the clouds and the climb ends.
//
// The world starts grey (the faded morning mist); every word sweeps color back around the climber
// and every floor brings more of it for good, until the sky is clear blue over a peach horizon.
// Higher still the sun sinks gold, the sky turns violet and the first stars come out. The tower is
// endless: three segments of tower and stair leapfrog each other as the climber rises, and the
// clouds he passes wrap around. Nothing is allocated per frame.
//
// The typing is judged by the host (PlayController); this scene only reacts, and learns the shape
// of the climb from `begin`.

import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Mesh,
  type MeshLambertMaterial,
  Object3D,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Quaternion,
  RingGeometry,
  SphereGeometry,
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
  type QualityPreset,
  type SceneContext,
  type ScenePalette,
  type TypedKey,
  type WorldLetterState,
} from '../../engine';
import { tierIntensity } from '../../audio/composer';
import { Dyo } from '../../game/dyo';
import { TypingFeedback } from '../../game/feedback';
import { DAY, DUSK, FADED, TINT } from './palette';
import { colorAt, Grip, LANDING_EVERY, type Climb, type Floor, type FloorKind } from './plan';

export interface LadderSetup {
  /** The apprentice's robe (the profile's avatar). */
  look: { robe: number; hem: number; trim: number; headwear: 'cap' | 'hat' | 'turban' };
  /** Letters to carve on the tower's tiles (the player's learned letters). */
  letters: string;
}

/** Things the screen may want to say something about. */
export type LadderEvent = 'tighten' | 'slip' | Exclude<FloorKind, 'steps'> | 'landing' | 'high';

/** Height of one floor, and steps in it (half a turn round the tower). */
export const FLOOR_H = 4.5;
const STEPS_PER_FLOOR = 14;
/** Floors in one segment of tower (two full turns of the stair). */
const SEG_FLOORS = 4;
const SEG_H = SEG_FLOORS * FLOOR_H;
/** The tower's radius, the stair's middle line, and its width. */
const TOWER_R = 2.7;
const STAIR_R = 4.15;
const STAIR_W = 2.2;
/** Tile courses: their height, and tiles per course. */
const COURSE_H = 0.9;
const TILES = 13;
/** Clouds the climber passes, and how far above and below him they wrap. */
const CLOUDS = 80;
const CLOUD_BAND = 30;
const SEA = 46;
const SEA_Y = -5;
const STARS = 360;
const WIND = 140;
const BLOTS = 7;
const LETTER_SIZE = 0.48;
const AHEAD_SIZE = 0.42;
const AHEAD_CAP = 36;
/** Letters that never go on a tile (no holy Name can ever be spelled by chance). */
const NOT_CARVED = /[אהויל]/;
const FALL_S = 2.6;

/** Where the stair is at `s` floors up (0 = the first landing): angle round the tower and height. */
export function stairAngle(s: number): number {
  return s * Math.PI;
}
export function stairY(s: number): number {
  return s * FLOOR_H;
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
  if (g.getAttribute('normal')) g.deleteAttribute('normal');
  g.computeVertexNormals();
  return g;
}

function merged(parts: BufferGeometry[]): BufferGeometry {
  const out = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  return out ?? new BufferGeometry();
}

/** One segment slot of the endless tower: tiles, carved letters, gold letters and the stair. */
interface Slot {
  readonly tiles: Mesh;
  readonly ink: Mesh;
  readonly gold: Mesh;
  readonly stair: Mesh;
  seg: number;
}

interface Blot {
  readonly root: Group;
  /** Gone: falling away with a little spin. */
  fall: number;
  on: boolean;
}

export class LadderScene implements GameScene {
  readonly id = 'ladder';
  /** Told when something worth a line happens. */
  onMoment: ((moment: LadderEvent) => void) | null = null;
  /** The grip gave out and Dyo caught the climber (the screen drops the streak). */
  onCaught: (() => void) | null = null;
  /** The grip gave out for good: the climb is over. */
  onFall: (() => void) | null = null;
  /** A floor was climbed (`clean`: without a single slip). */
  onFloor: ((floor: Floor, clean: boolean) => void) | null = null;

  private ctx!: SceneContext;
  private readonly rng = new Rng(2828);
  private climb: Climb | null = null;
  private apprentice!: Character;
  private dyo!: Dyo;
  private text!: WorldText;
  private ahead!: WorldText;
  private readonly aheadStates: WorldLetterState[] = [];
  private aheadKey = -1;
  private feedback!: TypingFeedback;
  private shownLetters: readonly string[] | null = null;
  private wind: AmbienceHandle | null = null;

  // The climb.
  private readonly grip = new Grip();
  private floorIx = 0;
  private typedHere = 0;
  private slipsHere = 0;
  private wordsDone = 0;
  private wordsOnFloor = 0;
  private aim = 0;
  private s = 0;
  private speed = 0;
  private heardTier = 0;
  private time = 0;
  private over = false;
  private resting = false;
  private fallT = -1;
  private catchT = 0;
  private restT = -1;
  private saidHigh = false;
  private readonly said = new Set<LadderEvent>();

  // The tower.
  private readonly slots: Slot[] = [];
  private readonly tileGeo: BufferGeometry[] = [];
  private readonly inkGeo: BufferGeometry[] = [];
  private readonly goldGeo: BufferGeometry[] = [];
  private stairGeo!: BufferGeometry;
  private shownSeg = -99;
  private readonly landings: Group[] = [];
  private shownLanding = -99;
  private overlay!: InstancedMesh;
  private overlayMat!: MeshLambertMaterial;
  private overlayFloor = -1;
  private overlayOn = 0;
  private readonly blots: Blot[] = [];
  private blotsLeft = 0;

  // The sky.
  private clouds!: InstancedMesh;
  private readonly cloudPos = new Float32Array(CLOUDS * 4);
  private stars!: Points;
  private starMat!: PointsMaterial;
  private windPts!: Points;
  private windMat!: PointsMaterial;
  private readonly windBase = new Float32Array(WIND * 3);
  private gale = 0;
  private murk = 0;
  private readonly palette: ScenePalette = {
    ...FADED.light,
    sunFrom: [0.6, 0.55, 0.4],
    fade: 0,
    ink: 0,
  };
  private readonly ca = new Color();
  private readonly cb = new Color();
  private last = [-1, -1, -1];
  private color = 0;
  private colorShown = 0;
  private dusk = 0;

  private gold = 0;
  private techelet = 0;
  private paper = 0;
  private inkDark = 0;
  private dust!: BurstStyle;
  private goldDust!: BurstStyle;
  private ink!: BurstStyle;
  private shards!: BurstStyle;
  private fountain!: BurstStyle;
  private puff!: BurstStyle;

  private readonly eye = new Object3D();
  private readonly v = new Vector3();
  private readonly camPos = new Vector3();
  private readonly camLook = new Vector3();
  private readonly q = new Quaternion();
  private readonly up = new Vector3(0, 1, 0);
  private readonly dummy = new Object3D();

  constructor(private readonly setup: LadderSetup) {}

  // ---- probes (the screen and the smoke test read these) -------------------------------------

  /** How firm the grip is (0 .. 1). */
  get gripNow(): number {
    return this.grip.value;
  }
  get catches(): number {
    return this.grip.catches;
  }
  get slips(): number {
    return this.grip.slips;
  }
  get tightens(): number {
    return this.grip.tightens;
  }
  get fallen(): boolean {
    return this.grip.fallen;
  }
  /** Floors climbed to the top. */
  get floorsDone(): number {
    return this.floorIx;
  }
  /** The floor being climbed now. */
  get floor(): Floor | null {
    return this.climb?.floors[this.floorIx] ?? null;
  }
  /** How far up the stair the climber stands, in floors. */
  get height(): number {
    return this.s;
  }
  /** How much color the world has (0 grey .. 1). */
  get restoredShare(): number {
    return this.colorShown;
  }
  /** Words after the one in hand that can be read now. */
  get aheadWords(): number {
    const f = this.floor;
    if (!this.climb || !f || this.over) return 0;
    return this.climb.lookahead(f);
  }
  get blotsOn(): number {
    return this.blotsLeft;
  }
  get finished(): boolean {
    return this.over;
  }

  // ---- loading ------------------------------------------------------------------------------

  async load(ctx: SceneContext): Promise<void> {
    this.ctx = ctx;
    this.gold = ctx.color('gold');
    this.techelet = ctx.color('techelet');
    this.paper = ctx.theme === 'light' ? ctx.color('surface') : ctx.color('ink');
    this.inkDark = ctx.theme === 'light' ? ctx.color('ink') : ctx.color('bg');

    ctx.audio.music('ladder');
    ctx.audio.intensity(0);
    this.wind = ctx.audio.ambience('wind');

    this.palette.fade = ctx.color('fade');
    this.palette.ink = this.gold;
    this.applySky(0, 0, 0, 0);
    ctx.atmosphere.setShadowRange(16);
    ctx.post.setGrade(
      ctx.theme === 'dark'
        ? { exposure: 1.05, saturation: 1.05, vignette: 0.42, godRays: 0.7, bloom: 1.15 }
        : { exposure: 1.05, saturation: 1.08, vignette: 0.36, godRays: 0.75, bloom: 1.05 },
    );

    this.dust = burstStyle({
      count: 4,
      color: TINT.cedar,
      color2: TINT.rope,
      intensity: 0.8,
      speed: [0.4, 1.1],
      spread: 0.8,
      life: [0.3, 0.6],
      size: [0.04, 0.09],
      gravity: 3,
    });
    this.goldDust = burstStyle({
      count: 60,
      color: TINT.goldDust,
      color2: TINT.gold,
      intensity: 2.6,
      speed: [1.2, 4.5],
      spread: 1,
      life: [1, 2.2],
      size: [0.05, 0.14],
      gravity: -0.4,
      radius: 1.4,
    });
    this.ink = burstStyle({
      count: 22,
      color: TINT.blot,
      color2: 0x4a3c6a,
      intensity: 0.9,
      speed: [1.5, 4],
      spread: 1,
      life: [0.5, 1],
      size: [0.08, 0.2],
      gravity: 5,
    });
    this.shards = burstStyle({
      count: 16,
      color: TINT.glass,
      color2: TINT.glassGlow,
      intensity: 2,
      speed: [1.5, 4],
      spread: 1,
      life: [0.4, 0.8],
      size: [0.04, 0.1],
      gravity: 7,
    });
    this.fountain = burstStyle({
      count: 90,
      color: TINT.gold,
      color2: TINT.techelet,
      intensity: 3,
      speed: [3, 8],
      spread: 0.9,
      life: [1.2, 2.4],
      size: [0.06, 0.18],
      gravity: 1.2,
    });
    this.puff = burstStyle({
      count: 30,
      color: TINT.cloud,
      color2: TINT.cloudShade,
      intensity: 1.1,
      speed: [1, 3],
      spread: 1,
      life: [0.8, 1.6],
      size: [0.3, 0.7],
      gravity: -0.2,
      radius: 1.2,
    });

    this.buildTower();
    this.buildLandings();
    this.buildOverlay();
    this.buildBlots();
    this.buildClouds();
    this.buildStars();
    this.buildWind();
    this.buildClimber();

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
    // The words ahead are carved on the tower's wall a little further up the stair.
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
    this.onQuality(ctx.quality);
    this.place();
  }

  onQuality(preset: QualityPreset): void {
    this.apprentice?.shadowDetail(preset.shadows === 'cascaded');
  }

  /** Blends the faded mist → the clear day (k) → the dusk high up (d), with a cloud bank (m). */
  private applySky(k: number, d: number, m: number, base: number): void {
    const l = this.last;
    if (
      Math.abs(k - (l[0] as number)) < 0.004 &&
      Math.abs(d - (l[1] as number)) < 0.004 &&
      Math.abs(m - (l[2] as number)) < 0.004 &&
      Math.abs(base - this.palette.fogBase) < 0.5
    )
      return;
    l[0] = k;
    l[1] = d;
    l[2] = m;
    const a = FADED[this.ctx.theme];
    const b = DAY[this.ctx.theme];
    const c = DUSK[this.ctx.theme];
    const p = this.palette;
    const mix = (x: number, y: number, z: number): number =>
      this.ca.setHex(x).lerp(this.cb.setHex(y), k).lerp(this.cb.setHex(z), d).getHex();
    const num = (x: number, y: number, z: number): number => {
      const ab = x + (y - x) * k;
      return ab + (z - ab) * d;
    };
    p.skyTop = mix(a.skyTop, b.skyTop, c.skyTop);
    p.skyHorizon = mix(a.skyHorizon, b.skyHorizon, c.skyHorizon);
    p.sun = mix(a.sun, b.sun, c.sun);
    p.sunIntensity = num(a.sunIntensity, b.sunIntensity, c.sunIntensity) * (1 - m * 0.5);
    const sf = p.sunFrom as [number, number, number];
    sf[0] = a.sunFrom[0] + (c.sunFrom[0] - a.sunFrom[0]) * d;
    sf[1] = a.sunFrom[1] + (c.sunFrom[1] - a.sunFrom[1]) * d;
    sf[2] = a.sunFrom[2] + (c.sunFrom[2] - a.sunFrom[2]) * d;
    p.fillSky = mix(a.fillSky, b.fillSky, c.fillSky);
    p.fillGround = mix(a.fillGround, b.fillGround, c.fillGround);
    p.fillIntensity = num(a.fillIntensity, b.fillIntensity, c.fillIntensity);
    p.fog = this.ca
      .setHex(mix(a.fog, b.fog, c.fog))
      .lerp(this.cb.setHex(TINT.cloud), m * 0.7)
      .getHex();
    // A cloud bank swallows the tower: the fog thickens around the climber.
    p.fogDensity = num(a.fogDensity, b.fogDensity, c.fogDensity) + m * 0.075;
    p.fogBase = base;
    p.fogFalloff = num(a.fogFalloff, b.fogFalloff, c.fogFalloff) * (1 - m * 0.8);
    p.inscatter = num(a.inscatter, b.inscatter, c.inscatter);
    this.ctx.atmosphere.setPalette(p);
  }

  // ---- building ------------------------------------------------------------------------------

  /** Tiles of one segment, their carved letters (ink and a few gold), for one of two variants. */
  private buildSegment(variant: number): void {
    const { tracker, engine } = this.ctx;
    const r = new Rng(91 + variant * 37);
    const letters = [...this.setup.letters].filter((c) => /\p{L}/u.test(c) && !NOT_CARVED.test(c));
    if (letters.length === 0) letters.push('ב', 'ג', 'ד');
    const atlas = engine.atlas;
    const tiles: BufferGeometry[] = [];
    const ink: BufferGeometry[] = [];
    const gold: BufferGeometry[] = [];
    const courses = Math.round(SEG_H / COURSE_H);
    const arc = (Math.PI * 2) / TILES;
    const tileW = TOWER_R * arc * 0.92;
    const colors = [TINT.parchment, TINT.parchment, TINT.sandstone, TINT.parchment, TINT.sandstone];
    const accents = [TINT.terracotta, TINT.techelet, TINT.olive, TINT.rose];
    for (let c = 0; c < courses; c++) {
      const y = c * COURSE_H + COURSE_H / 2;
      const accent = r.next() < 0.18 ? accents[r.int(accents.length)] : null;
      const off = (c % 2) * arc * 0.5;
      for (let t = 0; t < TILES; t++) {
        const a = t * arc + off + r.signed() * 0.02;
        const out = 0.05 + r.next() * 0.12;
        const hex = accent ?? (colors[r.int(colors.length)] as number);
        const box = new BoxGeometry(tileW, COURSE_H * 0.9, 0.5);
        box.rotateY(Math.PI / 2 - a);
        const R = TOWER_R + out - 0.25;
        box.translate(Math.cos(a) * R, y, Math.sin(a) * R);
        tiles.push(painted(box, hex));
        // The tile's letter, on a quad just in front of its outer face.
        if (r.next() < 0.75) {
          const ch = letters[r.int(letters.length)] as string;
          const [u, v, w, h] = atlas.rect(ch);
          const quad = new PlaneGeometry(COURSE_H * 0.62, COURSE_H * 0.62);
          const uv = quad.getAttribute('uv') as BufferAttribute;
          for (let i = 0; i < uv.count; i++) uv.setXY(i, u + uv.getX(i) * w, v + uv.getY(i) * h);
          quad.rotateY(Math.PI / 2 - a);
          const Rq = TOWER_R + out + 0.012;
          quad.translate(Math.cos(a) * Rq, y, Math.sin(a) * Rq);
          (r.next() < 0.08 ? gold : ink).push(quad);
        }
      }
    }
    // A mortar core inside the tiles, so no sky shows through.
    tiles.push(
      painted(
        new CylinderGeometry(TOWER_R - 0.2, TOWER_R - 0.2, SEG_H, TILES, 1, true).translate(
          0,
          SEG_H / 2,
          0,
        ),
        TINT.mortar,
      ),
    );
    this.tileGeo.push(tracker.track(merged(tiles)));
    const keepUv = (parts: BufferGeometry[]): BufferGeometry => {
      if (parts.length === 0) parts.push(new PlaneGeometry(0.001, 0.001));
      const out = mergeGeometries(parts, false) ?? new BufferGeometry();
      for (const p of parts) p.dispose();
      return out;
    };
    this.inkGeo.push(tracker.track(keepUv(ink)));
    this.goldGeo.push(tracker.track(keepUv(gold)));
  }

  /** The cedar stair of one segment: planks, brass-capped posts on the outer edge. */
  private buildStair(): void {
    const parts: BufferGeometry[] = [];
    const n = SEG_FLOORS * STEPS_PER_FLOOR;
    const da = Math.PI / STEPS_PER_FLOOR;
    for (let k = 0; k < n; k++) {
      const s = k / STEPS_PER_FLOOR;
      const a = stairAngle(s);
      const y = stairY(s);
      const plank = new BoxGeometry(STAIR_W, 0.2, STAIR_R * da * 1.04);
      plank.translate(0, -0.1, 0);
      plank.rotateY(-a);
      plank.translate(Math.cos(a) * STAIR_R, y, Math.sin(a) * STAIR_R);
      parts.push(painted(plank, k % 2 === 0 ? TINT.cedar : TINT.cedarDark));
      // A bracket under every plank, into the tower.
      const br = new BoxGeometry(STAIR_W * 0.7, 0.35, 0.12).translate(-0.2, -0.35, 0);
      br.rotateY(-a);
      br.translate(Math.cos(a) * (STAIR_R - 0.2), y, Math.sin(a) * (STAIR_R - 0.2));
      parts.push(painted(br, TINT.cedarDark));
      if (k % 2 === 0) {
        const R = STAIR_R + STAIR_W / 2 - 0.08;
        const post = new CylinderGeometry(0.05, 0.06, 1.05, 6).translate(0, 0.52, 0);
        post.translate(Math.cos(a) * R, y, Math.sin(a) * R);
        parts.push(painted(post, TINT.cedarDark));
        const cap = new SphereGeometry(0.09, 6, 4).translate(0, 1.07, 0);
        cap.translate(Math.cos(a) * R, y, Math.sin(a) * R);
        parts.push(painted(cap, TINT.brass));
        // The rope rail to the next post.
        const a2 = stairAngle((k + 2) / STEPS_PER_FLOOR);
        const y2 = stairY((k + 2) / STEPS_PER_FLOOR);
        const x1 = Math.cos(a) * R;
        const z1 = Math.sin(a) * R;
        const x2 = Math.cos(a2) * R;
        const z2 = Math.sin(a2) * R;
        const len = Math.hypot(x2 - x1, y2 - y, z2 - z1);
        const rope = new CylinderGeometry(0.025, 0.025, len, 4);
        this.v.set(x2 - x1, y2 - y, z2 - z1).normalize();
        this.q.setFromUnitVectors(this.up, this.v);
        rope.applyQuaternion(this.q);
        rope.translate((x1 + x2) / 2, (y + y2) / 2 + 0.95, (z1 + z2) / 2);
        parts.push(painted(rope, TINT.rope));
      }
    }
    this.stairGeo = this.ctx.tracker.track(merged(parts));
  }

  private buildTower(): void {
    const { materials: kit, tracker, root, engine } = this.ctx;
    this.buildSegment(0);
    this.buildSegment(1);
    this.buildStair();
    const tileMat = tracker.track(kit.surface({ vertexColors: true }));
    const stairMat = tracker.track(kit.surface({ vertexColors: true }));
    const inkMat = tracker.track(kit.ink(TINT.tileInk, 1));
    const goldMat = tracker.track(kit.ink(TINT.gold, 2.4));
    for (const m of [inkMat, goldMat]) {
      m.map = engine.atlas.texture;
      m.transparent = true;
      m.alphaTest = 0.35;
      m.depthWrite = false;
      m.polygonOffset = true;
      m.polygonOffsetFactor = -2;
    }
    for (let i = 0; i < 3; i++) {
      const tiles = kit.caster(new Mesh(this.tileGeo[0] as BufferGeometry, tileMat));
      tiles.receiveShadow = true;
      const ink = new Mesh(this.inkGeo[0] as BufferGeometry, inkMat);
      const gold = new Mesh(this.goldGeo[0] as BufferGeometry, goldMat);
      const stair = kit.caster(new Mesh(this.stairGeo, stairMat));
      stair.receiveShadow = true;
      for (const m of [tiles, ink, gold, stair]) {
        m.frustumCulled = false;
        root.add(m);
      }
      this.slots.push({ tiles, ink, gold, stair, seg: -99 });
    }
  }

  /** Two stone landings that ring the tower at every fifth floor, with pennants. */
  private buildLandings(): void {
    const { materials: kit, tracker, root } = this.ctx;
    const outer = STAIR_R + STAIR_W / 2 + 0.6;
    const parts: BufferGeometry[] = [
      painted(new RingGeometry(TOWER_R - 0.1, outer, 40, 1).rotateX(-Math.PI / 2), TINT.landing),
      painted(
        new CylinderGeometry(outer, outer - 0.3, 0.45, 40, 1, true).translate(0, -0.22, 0),
        TINT.landingEdge,
      ),
      painted(
        new RingGeometry(outer - 0.35, outer - 0.15, 40, 1)
          .rotateX(-Math.PI / 2)
          .translate(0, 0.01, 0),
        TINT.pennantGold,
      ),
    ];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      const x = Math.cos(a) * (outer - 0.3);
      const z = Math.sin(a) * (outer - 0.3);
      parts.push(
        painted(new CylinderGeometry(0.05, 0.07, 1.9, 6).translate(x, 0.95, z), TINT.cedarDark),
      );
      parts.push(painted(new SphereGeometry(0.09, 6, 4).translate(x, 1.92, z), TINT.brass));
      const flag = new ConeGeometry(0.28, 0.75, 3).rotateZ(-Math.PI / 2).scale(1, 1, 0.12);
      flag
        .rotateY(-a + Math.PI / 2)
        .translate(
          x + Math.cos(a + Math.PI / 2) * 0.36,
          1.62,
          z + Math.sin(a + Math.PI / 2) * 0.36,
        );
      parts.push(painted(flag, i % 2 === 0 ? TINT.pennant : TINT.pennantGold));
    }
    const geo = tracker.track(merged(parts));
    const mat = tracker.track(kit.surface({ vertexColors: true }));
    for (let i = 0; i < 2; i++) {
      const g = new Group();
      const m = kit.caster(new Mesh(geo, mat));
      m.receiveShadow = true;
      g.add(m);
      root.add(g);
      this.landings.push(g);
    }
  }

  /** Crystal or amber planks laid over the floor being climbed (glass and long floors). */
  private buildOverlay(): void {
    const { materials: kit, tracker, root } = this.ctx;
    const da = Math.PI / STEPS_PER_FLOOR;
    this.overlayMat = tracker.track(
      kit.surface({
        color: TINT.glass,
        emissive: TINT.glassGlow,
        emissiveIntensity: 0.9,
        restore: false,
        transparent: true,
        opacity: 0,
      }),
    );
    this.overlay = new InstancedMesh(
      tracker.track(new BoxGeometry(STAIR_W * 1.04, 0.08, STAIR_R * da * 1.0)),
      this.overlayMat,
      STEPS_PER_FLOOR,
    );
    this.overlay.frustumCulled = false;
    this.overlay.visible = false;
    root.add(this.overlay);
  }

  /** Ink Blots that cling to the rungs of a swarm floor. */
  private buildBlots(): void {
    const { materials: kit, tracker, root } = this.ctx;
    const body = tracker.track(new SphereGeometry(0.34, 12, 9).scale(1, 0.8, 1));
    const mat = tracker.track(
      kit.surface({
        color: TINT.blot,
        emissive: 0x2a2048,
        emissiveIntensity: 0.6,
        restore: false,
        flat: false,
      }),
    );
    const eyeGeo = tracker.track(new SphereGeometry(0.06, 8, 6));
    const eyeMat = tracker.track(kit.ink(TINT.blotEye, 1.2));
    for (let i = 0; i < BLOTS; i++) {
      const g = new Group();
      g.add(new Mesh(body, mat));
      for (const x of [-0.12, 0.12]) {
        const e = new Mesh(eyeGeo, eyeMat);
        e.position.set(x, 0.1, 0.28);
        g.add(e);
      }
      g.visible = false;
      root.add(g);
      this.blots.push({ root: g, fall: 0, on: false });
    }
  }

  private buildClouds(): void {
    const { materials: kit, tracker, root } = this.ctx;
    const geo = tracker.track(new IcosahedronGeometry(1, 2));
    const mat = tracker.track(kit.surface({ restore: false, lift: 0.7, flat: false }));
    this.clouds = new InstancedMesh(geo, mat, CLOUDS);
    const r = this.rng;
    const c = new Color();
    for (let i = 0; i < CLOUDS; i++) {
      const o = i * 4;
      const a = r.range(0, Math.PI * 2);
      const d = r.range(17, 44);
      this.cloudPos[o] = Math.cos(a) * d;
      this.cloudPos[o + 1] = r.range(-CLOUD_BAND, CLOUD_BAND);
      this.cloudPos[o + 2] = Math.sin(a) * d;
      this.cloudPos[o + 3] = r.range(1.3, 3.2);
      this.clouds.setColorAt(i, c.setHex(r.next() < 0.5 ? TINT.cloud : TINT.cloudShade));
    }
    if (this.clouds.instanceColor) this.clouds.instanceColor.needsUpdate = true;
    this.clouds.frustumCulled = false;
    kit.caster(this.clouds, false);
    root.add(this.clouds);

    // The sea of clouds the tower rises out of.
    const sea = new InstancedMesh(geo, mat, SEA);
    for (let i = 0; i < SEA; i++) {
      const a = (i / SEA) * Math.PI * 2 * 3 + r.range(0, 0.4);
      const d = 6 + (i / SEA) * 70 + r.range(0, 8);
      const big = r.range(4, 9) * (1 + d / 50);
      this.dummy.position.set(Math.cos(a) * d, SEA_Y + r.signed() * 1.2, Math.sin(a) * d);
      this.dummy.scale.set(big, big * 0.38, big * r.range(0.7, 1));
      this.dummy.rotation.set(0, r.range(0, 3), 0);
      this.dummy.updateMatrix();
      sea.setMatrixAt(i, this.dummy.matrix);
      sea.setColorAt(i, c.setHex(i % 3 === 0 ? TINT.cloudShade : TINT.cloud));
    }
    sea.instanceMatrix.needsUpdate = true;
    if (sea.instanceColor) sea.instanceColor.needsUpdate = true;
    sea.computeBoundingSphere();
    kit.caster(sea, false);
    root.add(sea);
  }

  private buildStars(): void {
    const { tracker, root } = this.ctx;
    const pos = new Float32Array(STARS * 3);
    const r = this.rng;
    for (let i = 0; i < STARS; i++) {
      const a = r.range(0, Math.PI * 2);
      const el = r.range(0.12, 1.4);
      const d = 220;
      pos[i * 3] = Math.cos(a) * Math.cos(el) * d;
      pos[i * 3 + 1] = Math.sin(el) * d;
      pos[i * 3 + 2] = Math.sin(a) * Math.cos(el) * d;
    }
    const g = tracker.track(new BufferGeometry());
    g.setAttribute('position', new Float32BufferAttribute(pos, 3));
    this.starMat = tracker.track(
      new PointsMaterial({
        color: TINT.star,
        size: 1.6,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        fog: false,
      }),
    );
    this.stars = new Points(g, this.starMat);
    this.stars.frustumCulled = false;
    this.stars.visible = false;
    root.add(this.stars);
  }

  private buildWind(): void {
    const { tracker, root } = this.ctx;
    const r = this.rng;
    for (let i = 0; i < WIND; i++) {
      this.windBase[i * 3] = r.range(0, Math.PI * 2);
      this.windBase[i * 3 + 1] = r.range(-5, 7);
      this.windBase[i * 3 + 2] = r.range(TOWER_R + 0.6, TOWER_R + 9);
    }
    const g = tracker.track(new BufferGeometry());
    g.setAttribute('position', new Float32BufferAttribute(new Float32Array(WIND * 3), 3));
    this.windMat = tracker.track(
      new PointsMaterial({
        color: TINT.wind,
        size: 0.12,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    this.windPts = new Points(g, this.windMat);
    this.windPts.frustumCulled = false;
    this.windPts.visible = false;
    root.add(this.windPts);
  }

  private buildClimber(): void {
    const { materials: kit, root } = this.ctx;
    const l = this.setup.look;
    this.apprentice = new Character(kit, {
      robe: l.robe,
      hem: l.hem,
      trim: l.trim,
      skin: TINT.skin,
      ink: TINT.ink,
      headwear: l.headwear,
      height: 0.94,
      seed: 8,
    });
    root.add(this.apprentice.root);
    this.dyo = new Dyo(kit, {
      body: TINT.dyo,
      shine: TINT.dyoShine,
      eye: TINT.dyoEye,
      pupil: TINT.ink,
    });
    this.dyo.root.scale.setScalar(0.4);
    root.add(this.dyo.root);
    root.add(this.eye);
  }

  // ---- a climb ----------------------------------------------------------------------------------

  start(): void {
    this.reset();
  }

  private reset(): void {
    const { materials } = this.ctx;
    materials.clearSweeps();
    materials.restoreAll(0, 0);
    this.floorIx = 0;
    this.typedHere = 0;
    this.slipsHere = 0;
    this.wordsDone = 0;
    this.wordsOnFloor = 0;
    this.aim = 0;
    this.s = 0;
    this.speed = 0;
    this.heardTier = 0;
    this.over = false;
    this.resting = false;
    this.fallT = -1;
    this.restT = -1;
    this.catchT = 0;
    this.saidHigh = false;
    this.said.clear();
    this.shownLetters = null;
    this.aheadKey = -1;
    this.grip.reset(true);
    this.color = 0;
    this.colorShown = 0;
    this.dusk = 0;
    this.gale = 0;
    this.murk = 0;
    this.overlayFloor = -1;
    this.overlayOn = 0;
    this.blotsLeft = 0;
    for (const b of this.blots) {
      b.on = false;
      b.root.visible = false;
    }
    this.last[0] = -1;
    this.applySky(0, 0, 0, SEA_Y - 1);
    this.apprentice.root.rotation.x = 0;
    this.ctx.audio.intensity(0);
  }

  /** A new climb (the screen calls it before the first key, and for every retry). */
  begin(climb: Climb): void {
    this.reset();
    this.climb = climb;
    this.grip.reset(!climb.timers);
    this.enterFloor();
    this.place();
  }

  private place(): void {
    this.pose(0);
    this.aimCamera();
    this.ctx.rig.cut();
  }

  /** The floor being climbed changed: its tiring rate, overlay planks and Blots. */
  private enterFloor(): void {
    const climb = this.climb;
    if (!climb) return;
    climb.ensure((climb.floors[this.floorIx]?.from ?? climb.words.length) + 1);
    const f = climb.floors[this.floorIx];
    if (!f) return;
    this.grip.floor(climb.tire(f));
    this.typedHere = 0;
    this.slipsHere = 0;
    this.wordsOnFloor = 0;
    // The Blots of a swarm floor sit on the rungs ahead, one for every word.
    const n = f.kind === 'swarm' ? Math.min(BLOTS, f.to - f.from) : 0;
    this.blotsLeft = n;
    for (let i = 0; i < BLOTS; i++) {
      const b = this.blots[i] as Blot;
      b.on = i < n;
      b.fall = 0;
      b.root.visible = b.on;
      if (!b.on) continue;
      const s = this.floorIx + (i + 1.2) / (n + 1);
      const a = stairAngle(s);
      const R = STAIR_R + (i % 2 === 0 ? 0.45 : -0.35);
      b.root.position.set(Math.cos(a) * R, stairY(s) + 0.3, Math.sin(a) * R);
      b.root.rotation.set(0, -a + Math.PI, 0);
      b.root.scale.setScalar(0.85 + (i % 3) * 0.12);
    }
    // Crystal or amber planks over this floor's own rungs.
    if (f.kind === 'glass' || f.kind === 'long') {
      this.overlayMat.color.setHex(f.kind === 'glass' ? TINT.glass : TINT.amber);
      this.overlayMat.emissive.setHex(f.kind === 'glass' ? TINT.glassGlow : TINT.amber);
      if (this.overlayFloor !== this.floorIx) {
        this.overlayFloor = this.floorIx;
        for (let k = 0; k < STEPS_PER_FLOOR; k++) {
          const s = this.floorIx + k / STEPS_PER_FLOOR;
          const a = stairAngle(s);
          this.dummy.position.set(Math.cos(a) * STAIR_R, stairY(s) + 0.045, Math.sin(a) * STAIR_R);
          this.dummy.rotation.set(0, -a, 0);
          this.dummy.scale.set(1, 1, 1);
          this.dummy.updateMatrix();
          this.overlay.setMatrixAt(k, this.dummy.matrix);
        }
        this.overlay.instanceMatrix.needsUpdate = true;
      }
    }
    if (this.floorIx > 0 && f.kind !== 'steps' && !this.said.has(f.kind)) {
      this.said.add(f.kind);
      this.onMoment?.(f.kind);
    }
    if (f.kind === 'gale') this.ctx.audio.play('gust');
    if (f.kind === 'lantern') {
      const p = this.apprentice.root.position;
      this.ctx.vfx.burst(this.puff, p.x, p.y + 2, p.z, 0, 1, 0);
    }
  }

  onKey(ev: TypedKey): void {
    const { typing, audio } = this.ctx;
    const climb = this.climb;
    const f = this.floor;
    if (!climb || !f || this.over) return;
    if (!ev.correct) {
      this.text.miss();
      this.feedback.wrong();
      audio.play('error');
      this.slipsHere += 1;
      const e = this.grip.key(false, climb.slip(f));
      const p = this.apprentice.root.position;
      if (f.kind === 'glass') {
        this.ctx.vfx.burst(this.shards, p.x, p.y + 0.05, p.z, 0, 1, 0);
        audio.play('shatter');
      }
      this.ctx.rig.shake(0.12);
      if (e === 'caught') this.caught();
      else if (e === 'fall') this.fall();
      else if (!this.said.has('slip')) {
        this.said.add('slip');
        this.onMoment?.('slip');
      }
      this.hearTier(typing.tier);
      return;
    }
    if (ev.kind !== 'char') return;
    this.typedHere += 1;
    const chars = climb.floorChars(this.floorIx);
    this.aim = Math.max(this.aim, this.floorIx + Math.min(1, this.typedHere / chars));
    if (this.grip.key(true, climb.slip(f)) === 'tighten') this.tighten();
    const p = this.apprentice.root.position;
    this.ctx.vfx.burst(this.dust, p.x, p.y + 0.05, p.z, 0, 1, 0);
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

  private hearTier(tier: number): void {
    if (tier > this.heardTier) {
      this.ctx.audio.play('tier', tier);
      this.dyo.cheer(2 + tier);
    }
    this.heardTier = tier;
    this.ctx.audio.intensity(tierIntensity(tier));
  }

  private tighten(): void {
    const p = this.apprentice.root.position;
    this.ctx.vfx.shockwave(p.x, p.y + 1, p.z, 2.4, this.gold, 0.4, false, 1);
    this.ctx.audio.playAt('flare', p.x, p.y, p.z);
    if (!this.said.has('tighten')) {
      this.said.add('tighten');
      this.onMoment?.('tighten');
    }
  }

  /** The grip gave out: Dyo swoops in and holds on. */
  private caught(): void {
    const { vfx, audio } = this.ctx;
    const p = this.apprentice.root.position;
    this.catchT = 1.2;
    this.apprentice.play('stagger');
    this.dyo.cheer(5);
    vfx.burst(this.goldDust, p.x, p.y + 1.6, p.z, 0, 1, 0);
    vfx.impact(0.35, TINT.cloud);
    audio.play('whoosh');
    this.onCaught?.();
  }

  /** The grip gave out for good: a soft drop into the clouds. */
  private fall(): void {
    if (this.over) return;
    const { vfx, audio } = this.ctx;
    this.over = true;
    this.fallT = 0;
    this.apprentice.play('fall');
    const p = this.apprentice.root.position;
    vfx.burst(this.puff, p.x, p.y + 1, p.z, 0, 1, 0);
    vfx.impact(0.5, TINT.cloud);
    audio.play('whoosh');
    audio.intensity(0.2);
    this.onFall?.();
  }

  onWord(_word: string, perfect: boolean): void {
    const climb = this.climb;
    const f = this.floor;
    if (!climb || !f || this.over) return;
    const { audio, vfx } = this.ctx;
    this.wordsDone += 1;
    this.wordsOnFloor += 1;
    const a = this.text.anchor;
    this.feedback.word(a.x, a.y, a.z, perfect);
    audio.play(perfect ? 'perfect' : 'word');
    if (perfect) this.grip.perfect();
    // Color sweeps back around the climber with every word.
    const p = this.apprentice.root.position;
    vfx.restore(p.x, p.y, p.z, 9 + this.color * 8, 1.4);
    // A swarm floor: the nearest Blot is knocked off.
    if (this.blotsLeft > 0) {
      for (const b of this.blots) {
        if (!b.on || b.fall > 0) continue;
        b.fall = 0.001;
        this.blotsLeft -= 1;
        const bp = b.root.position;
        vfx.burst(this.ink, bp.x, bp.y, bp.z, 0, 1, 0);
        audio.playAt('impact-small', bp.x, bp.y, bp.z);
        break;
      }
    }
    if (this.wordsDone >= f.to) this.floorDone(f);
  }

  /** The top of a floor: points, color for good, and maybe a landing. */
  private floorDone(f: Floor): void {
    const { vfx, audio, materials } = this.ctx;
    const clean = this.slipsHere === 0;
    this.aim = f.number;
    this.floorIx += 1;
    this.color = colorAt(this.floorIx);
    materials.restoreAll(this.color, 2);
    const p = this.apprentice.root.position;
    if (f.landing) {
      this.grip.landing();
      audio.play('unlock');
      audio.section(this.floorIx >= LANDING_EVERY * 2 ? 'C' : 'B');
      vfx.burst(this.goldDust, p.x, p.y + 1, p.z, 0, 1, 0);
      vfx.restore(p.x, p.y, p.z, 30, 2.4);
      this.apprentice.play('cheer');
      this.dyo.cheer(4);
      this.onMoment?.('landing');
    } else {
      vfx.shockwave(p.x, p.y + 0.1, p.z, 3, clean ? this.gold : this.techelet, 0.6, true, 1.2);
      audio.play('restore');
    }
    if (!this.saidHigh && this.floorIx >= 12) {
      this.saidHigh = true;
      this.onMoment?.('high');
    }
    this.onFloor?.(f, clean);
    this.enterFloor();
  }

  /** The player rests on the stair and banks his height: the whole tower takes its color. */
  rest(): void {
    if (this.over) return;
    const { vfx, materials, audio } = this.ctx;
    this.over = true;
    this.resting = true;
    this.restT = 0;
    materials.restoreAll(1, 3);
    this.color = 1;
    const p = this.apprentice.root.position;
    vfx.restore(p.x, p.y, p.z, 300, 3);
    vfx.burst(this.fountain, p.x, p.y + 1, p.z, 0, 1, 0);
    audio.play('success');
    audio.intensity(1);
    this.apprentice.play('cheer');
    this.dyo.cheer(6);
    this.ctx.rig.pushIn(0.25, 0.6);
  }

  /** The Sofer's Trial ended the climb at a slip: the same soft drop. */
  stop(): void {
    this.fall();
  }

  update(dt: number): void {
    this.time += dt;
    const climb = this.climb;
    const f = this.floor;
    if (climb && f && !this.over) {
      const e = this.grip.step(dt);
      if (e === 'caught') this.caught();
      else if (e === 'fall') this.fall();
    }
    this.catchT = Math.max(0, this.catchT - dt);

    // --- The weather of the floor: a gale, a cloud bank, or neither.
    const kind = f?.kind ?? 'steps';
    this.gale = damp(this.gale, !this.over && kind === 'gale' ? 1 : 0, 1.5, dt);
    this.murk = damp(this.murk, !this.over && kind === 'lantern' ? 1 : 0, 1.2, dt);
    const showOverlay = !this.over && (kind === 'glass' || kind === 'long') ? 1 : 0;
    this.overlayOn = damp(this.overlayOn, showOverlay, 3, dt);
    this.overlay.visible = this.overlayOn > 0.01;
    this.overlayMat.opacity = this.overlayOn * (kind === 'glass' ? 0.55 : 0.4);
    this.overlayMat.emissiveIntensity = 0.6 + 0.3 * Math.sin(this.time * 3);

    // --- The sky: color for good with every floor, dusk higher up.
    this.colorShown = damp(this.colorShown, this.color, 1, dt);
    const duskWant = Math.max(0, Math.min(1, (this.s - 14) / 22));
    this.dusk = damp(this.dusk, duskWant, 0.6, dt);
    this.applySky(this.colorShown, this.dusk, this.murk, stairY(this.s) - 12);

    // --- The climb: steps up after the typing, or the drop into the clouds.
    const was = this.s;
    if (this.fallT < 0) {
      this.s = damp(this.s, this.aim, 3.2, dt);
    }
    const sp = dt > 0 ? ((this.s - was) * STAIR_R * Math.PI) / dt : 0;
    this.speed = damp(this.speed, sp, 6, dt);
    if (this.fallT >= 0) this.fallT += dt;
    if (this.restT >= 0) this.restT += dt;
    this.pose(dt);
    this.segments();
    this.poseLandings();
    this.poseBlots(dt);
    this.aimCamera();
    if (this.wind) {
      const p = this.apprentice.root.position;
      this.wind.move(p.x * 1.5, p.y + 2, p.z * 1.5);
    }
  }

  /** Places the apprentice on the stair (or tumbling into the clouds), and Dyo beside him. */
  private pose(dt: number): void {
    const app = this.apprentice.root;
    const a = stairAngle(this.s);
    const R = STAIR_R - 0.15;
    let y = stairY(this.s);
    if (this.fallT >= 0) {
      // A soft fall: an arc outward and down into the cloud sea, turning slowly.
      const t = this.fallT;
      const out = Math.min(1, t / FALL_S);
      const RR = R + out * 6;
      y = stairY(this.s) - t * t * 4.5;
      y = Math.max(SEA_Y + 1, y);
      app.position.set(Math.cos(a) * RR, y, Math.sin(a) * RR);
      app.rotation.x = Math.min(1.2, t * 0.8);
    } else {
      // A little sway in a gale; a jolt when Dyo catches him.
      const sway =
        this.gale * Math.sin(this.time * 4.3) * 0.12 +
        this.catchT * Math.sin(this.time * 30) * 0.08;
      app.position.set(Math.cos(a) * (R + sway), y, Math.sin(a) * (R + sway));
      app.rotation.x = damp(app.rotation.x, 0, 4, dt);
    }
    // Facing up the stair (the tangent), turned to the camera when resting.
    const yaw = Math.atan2(-Math.sin(a), Math.cos(a));
    app.rotation.y = this.restT > 1 ? damp(app.rotation.y, yaw - 1.2, 1.5, dt) : yaw;
    app.rotation.z = this.gale * Math.sin(this.time * 3.1) * 0.05;
    this.apprentice.speed = this.over ? 0 : Math.max(0, this.speed);
    this.apprentice.update(dt);

    // Dyo flies at the outer shoulder; when catching, he holds on just above.
    const oa = a + 0.1;
    const dr = this.catchT > 0 ? 0.25 : 1.05;
    this.dyo.root.position.set(
      Math.cos(oa) * (R + dr),
      app.position.y + 1.9 + Math.sin(this.time * 2.3) * 0.08 + (this.catchT > 0 ? 0.1 : 0),
      Math.sin(oa) * (R + dr),
    );
    this.dyo.update(dt);
    this.eye.position.copy(app.position);
  }

  /** Leapfrogs the three tower segments so the tower never ends. */
  private segments(): void {
    const y = stairY(this.s);
    const seg = Math.floor(y / SEG_H);
    if (seg === this.shownSeg) return;
    this.shownSeg = seg;
    for (let k = seg - 1; k <= seg + 1; k++) {
      const slot = this.slots[((k % 3) + 3) % 3] as Slot;
      if (slot.seg === k) continue;
      slot.seg = k;
      const variant = ((k % 2) + 2) % 2;
      slot.tiles.geometry = this.tileGeo[variant] as BufferGeometry;
      slot.ink.geometry = this.inkGeo[variant] as BufferGeometry;
      slot.gold.geometry = this.goldGeo[variant] as BufferGeometry;
      const by = k * SEG_H;
      slot.tiles.position.y = by;
      slot.ink.position.y = by;
      slot.gold.position.y = by;
      slot.stair.position.y = by;
    }
  }

  /** The landing below the climber and the next one above. */
  private poseLandings(): void {
    const below = Math.floor(this.s / LANDING_EVERY) * LANDING_EVERY;
    if (below === this.shownLanding) return;
    this.shownLanding = below;
    (this.landings[0] as Group).position.y = stairY(below) - 0.02;
    (this.landings[1] as Group).position.y = stairY(below + LANDING_EVERY) - 0.02;
    (this.landings[0] as Group).rotation.y = -stairAngle(below);
    (this.landings[1] as Group).rotation.y = -stairAngle(below + LANDING_EVERY);
  }

  private poseBlots(dt: number): void {
    for (const b of this.blots) {
      if (!b.on) continue;
      if (b.fall > 0) {
        b.fall += dt;
        b.root.position.y -= dt * (2 + b.fall * 9);
        b.root.rotation.z += dt * 6;
        b.root.scale.multiplyScalar(Math.max(0.9, 1 - dt * 1.5));
        if (b.fall > 1.4) {
          b.on = false;
          b.root.visible = false;
        }
      } else {
        // Wobbling, glaring at the climber.
        b.root.scale.y = (0.85 + 0.08 * Math.sin(this.time * 5 + b.root.position.y)) * 1;
      }
    }
  }

  /** The camera: outside the stair, a little behind and above the climber, looking up the tower. */
  private aimCamera(): void {
    const app = this.apprentice.root.position;
    const a = stairAngle(this.s);
    if (this.restT >= 0) {
      // Resting: pull back and look at the whole lit tower, the climber on it, the sky.
      const k = Math.min(1, this.restT / 3);
      const ca = a - 0.5 - k * 0.4;
      const R = 12 + k * 10;
      this.camPos.set(Math.cos(ca) * R, app.y + 2 + k * 5, Math.sin(ca) * R);
      this.camLook.set(app.x * 0.4, app.y + 2.5 + k * 3, app.z * 0.4);
    } else if (this.fallT >= 0) {
      // Falling: watch him drop softly into the clouds from the stair.
      const ca = a - 0.6;
      this.camPos.set(Math.cos(ca) * 13, stairY(this.s) + 3, Math.sin(ca) * 13);
      this.camLook.copy(app);
    } else {
      // Far enough out to see the climber, the stair ahead and the sky; he stands above the
      // word strip and the keyboard at the bottom of the screen.
      const ca = a - 0.34;
      const R = 15.5 - this.murk * 3;
      this.camPos.set(Math.cos(ca) * R, app.y + 3.2, Math.sin(ca) * R);
      const la = a + 0.18;
      this.camLook.set(Math.cos(la) * STAIR_R * 0.85, app.y - 0.9, Math.sin(la) * STAIR_R * 0.85);
    }
    this.ctx.rig.fixed(this.camPos, this.camLook);
  }

  frame(dt: number): void {
    const { typing } = this.ctx;
    const app = this.apprentice.root.position;
    const a = stairAngle(this.s);
    this.dyo.face(this.camPos.x, this.camPos.z);

    // The word: on a banner over the stair, just ahead of the climber.
    const wa = a + 0.3;
    this.text.anchor.set(
      Math.cos(wa) * (STAIR_R + 1.3),
      app.y + 2.5,
      Math.sin(wa) * (STAIR_R + 1.3),
    );
    if (typing.letters !== this.shownLetters) {
      this.shownLetters = typing.letters;
      const n = typing.letters.length;
      const end = n > 0 && typing.letters[n - 1] === ' ' ? n - 1 : n;
      this.text.setWord(this.over ? [] : typing.letters.slice(0, end), /[֐-׿]/.test(typing.word));
    }
    this.text.root.visible = !this.over;
    this.text.frame(dt, typing.states);

    // The words ahead: carved on the tower wall further up, unless the cloud or the fog hides them.
    const climb = this.climb;
    const n = this.aheadWords;
    const key = this.over || !climb ? -2 : this.wordsDone * 8 + n;
    if (key !== this.aheadKey) {
      this.aheadKey = key;
      let line = '';
      if (climb && n > 0) {
        climb.ensure(this.wordsDone + n);
        for (let i = 1; i <= n; i++) {
          const w = climb.words[this.wordsDone + i];
          if (w) line = line ? `${line} ${w}` : w;
        }
      }
      this.ahead.setWord([...line].slice(0, AHEAD_CAP), /[֐-׿]/.test(line));
      this.ahead.root.visible = line.length > 0;
    }
    const aa = a + 0.95;
    this.ahead.anchor.set(
      Math.cos(aa) * (TOWER_R + 0.6),
      stairY(this.s + 0.35) + 1.9,
      Math.sin(aa) * (TOWER_R + 0.6),
    );
    if (this.over) this.ahead.root.visible = false;
    this.ahead.frame(dt, this.aheadStates);
    this.feedback.frame(dt);

    // Clouds drift slowly round the tower; the ones far below wrap round to above.
    const cy = app.y;
    const drift = dt * 0.03;
    const cs = Math.cos(drift);
    const sn = Math.sin(drift);
    for (let i = 0; i < CLOUDS; i++) {
      const o = i * 4;
      const x = this.cloudPos[o] as number;
      const z = this.cloudPos[o + 2] as number;
      this.cloudPos[o] = x * cs - z * sn;
      this.cloudPos[o + 2] = x * sn + z * cs;
      let y = this.cloudPos[o + 1] as number;
      if (y < cy - CLOUD_BAND) y += CLOUD_BAND * 2;
      else if (y > cy + CLOUD_BAND) y -= CLOUD_BAND * 2;
      this.cloudPos[o + 1] = y;
      const big = this.cloudPos[o + 3] as number;
      // In a cloud bank, the clouds gather close round the climber.
      const pull = 1 - this.murk * 0.3;
      this.dummy.position.set(
        (this.cloudPos[o] as number) * pull,
        y,
        (this.cloudPos[o + 2] as number) * pull,
      );
      this.dummy.scale.set(big * 1.6, big * 0.6, big);
      this.dummy.rotation.set(0, i, 0);
      this.dummy.updateMatrix();
      this.clouds.setMatrixAt(i, this.dummy.matrix);
    }
    this.clouds.instanceMatrix.needsUpdate = true;

    // Stars come out high up.
    this.starMat.opacity = Math.max(0, this.dusk - 0.35) * 1.3;
    this.stars.visible = this.starMat.opacity > 0.01;
    this.stars.position.set(app.x, app.y, app.z);

    // Wind streaks race round the tower in a gale.
    this.windMat.opacity = this.gale * 0.6;
    this.windPts.visible = this.gale > 0.02;
    if (this.windPts.visible) {
      const pos = this.windPts.geometry.getAttribute('position') as BufferAttribute;
      const arr = pos.array as Float32Array;
      for (let i = 0; i < WIND; i++) {
        const o = i * 3;
        const ang = (this.windBase[o] as number) - this.time * (1.4 + (i % 5) * 0.25);
        const r = this.windBase[o + 2] as number;
        arr[o] = Math.cos(ang) * r;
        arr[o + 1] = app.y + (this.windBase[o + 1] as number) + Math.sin(this.time * 2 + i) * 0.3;
        arr[o + 2] = Math.sin(ang) * r;
      }
      pos.needsUpdate = true;
    }
  }

  dispose(): void {
    this.wind?.stop();
    this.wind = null;
    this.apprentice?.dispose();
    this.dyo?.dispose();
    this.text?.dispose();
    this.ahead?.dispose();
    this.feedback?.dispose();
    this.shownLetters = null;
    this.onMoment = null;
    this.onCaught = null;
    this.onFall = null;
    this.onFloor = null;
    this.climb = null;
    this.slots.length = 0;
    this.landings.length = 0;
    this.blots.length = 0;
  }
}
