// The House of the Scribe (T13): the game's home and its menu. A stone house in the Jerusalem
// hills, cut away so the room shows (the desk, the shelves, the lectern, the Game Room door),
// a courtyard with an olive tree, a well and the practice slate, and over the low wall a
// terraced valley and the far ridges where every region of the Land of Letters keeps a beacon.
// The apprentice walks from station to station when the player types a station's door word.
// The day turns slowly from dawn to night; the courtyard and the land gain color as regions are
// restored, and a beacon lights for each one. Reb Ezra writes at his desk, Dyo hops after the
// apprentice, and Naftali leans on the wall once the Jaffa Line is won.

import {
  Color,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  Float32BufferAttribute,
  BufferGeometry,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
  OctahedronGeometry,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  CatmullRomCurve3,
  BoxGeometry,
} from 'three';
import {
  burstStyle,
  Character,
  LetterField,
  Rng,
  smoothstep,
  WorldText,
  type BurstStyle,
  type GameScene,
  type QualityPreset,
  type RunConfig,
  type SceneContext,
  type ScenePalette,
  type TypedKey,
  type WorldLetterState,
} from '../../engine';
import { Dyo } from '../../game/dyo';
import type { ApprenticeLook } from '../../story';
import { archWall, paintBy, Parts } from './build';
import { BEACON_SPOTS, EDGE_Z, heightAt, landGeometry } from './land';
import { DAY, TINT } from './palette';

export const STATION_IDS = [
  'desk',
  'practice',
  'trophies',
  'shop',
  'journal',
  'gameRoom',
  'settings',
] as const;
export type StationId = (typeof STATION_IDS)[number];

interface StationPlace {
  /** Where the door word hangs. */
  banner: readonly [number, number, number];
  /** Where the apprentice stands to use it, and what he faces. */
  spot: readonly [number, number];
  face: readonly [number, number];
}

export const STATIONS: Readonly<Record<StationId, StationPlace>> = {
  desk: { banner: [-4.6, 2.45, -0.9], spot: [-5, -0.35], face: [-5, -1.8] },
  practice: { banner: [2.4, 2.75, -4.1], spot: [2.4, -2.7], face: [2.4, -4.0] },
  trophies: { banner: [-2.9, 3.05, -4.3], spot: [-2.9, -3.4], face: [-2.9, -5] },
  shop: { banner: [-7.1, 3.05, -4.3], spot: [-7.1, -3.4], face: [-7.1, -5] },
  journal: { banner: [-7.7, 2.6, 1.9], spot: [-6.5, 2.5], face: [-7.7, 1.9] },
  gameRoom: { banner: [-8.4, 3.05, -1.4], spot: [-7.9, -1.4], face: [-9.2, -1.4] },
  settings: { banner: [6.6, 2.1, 1.8], spot: [6.6, 3.0], face: [6.6, 1.8] },
};

/** Where the apprentice waits when nothing is chosen: in the courtyard by the arches. */
const HOME: readonly [number, number] = [0.9, 1.3];
/** The middle of the open arch between the room and the courtyard. */
const ARCH: readonly [number, number] = [-1, 1.0];
const WALK_SPEED = 2.6;
const BANNER_SIZE = 0.5;

export type BeaconState = 'restored' | 'open' | 'locked';

export interface HubSetup {
  look: ApprenticeLook;
  /** Hour of the day to start at (local time, 0..24). */
  hour: number;
  /** Real minutes for one whole day in the hub. */
  dayMinutes: number;
  /** 0..1: share of the land restored before this visit, and now. */
  restoredBefore: number;
  restored: number;
  /** One per region (REGION_IDS order). */
  beacons: readonly BeaconState[];
  /** Regions restored since the last visit (indexes): their beacons light up with a sweep. */
  fresh: readonly number[];
  /** Naftali drops by once the Jaffa Line is won. */
  naftali: boolean;
  /** Letters the player has learned: chalked on the practice slate. */
  slate: string;
  /** The word on the Game Room's sign ("soon"), in the player's language. */
  soon: string;
  rtl: boolean;
}

export interface HubProbe {
  at: StationId | null;
  walking: boolean;
  hour: number;
  restored: number;
  litBeacons: number;
}

const ORDER = STATION_IDS;

export class HubScene implements GameScene {
  readonly id = 'hub';
  readonly probe: HubProbe = { at: null, walking: false, hour: 0, restored: 0, litBeacons: 0 };
  /** The apprentice reached a station. */
  onArrive: ((id: StationId) => void) | null = null;

  private ctx!: SceneContext;
  private readonly rng = new Rng(5786);
  private apprentice!: Character;
  private ezra!: Character;
  private naftali: Character | null = null;
  private dyo!: Dyo;
  private readonly banners: WorldText[] = [];
  private readonly words: string[][] = [];
  private readonly states: WorldLetterState[][] = [];
  private readonly sizes: number[] = [];
  private typed = '';
  private signs!: LetterField;
  private signCount = 0;
  private flames!: InstancedMesh;
  private medals!: InstancedMesh;
  private readonly beaconPos: Vector3[] = [];
  private readonly beaconLight: number[] = [];
  private readonly beaconWant: number[] = [];
  private interiorMat!: MeshLambertMaterial;
  private glowMat!: MeshLambertMaterial;
  private starMat!: PointsMaterial;

  // Walking.
  private readonly path: Vector3[] = [new Vector3(), new Vector3(), new Vector3(), new Vector3()];
  private pathLen = 0;
  private pathAt = 0;
  private target: StationId | null = null;
  private at: StationId | null = null;
  private yaw = Math.PI;
  private dyoWait = 0.6;
  private ezraWrite = 3;
  private ezraYaw = 0;
  private naftaliCheer = 9;

  // Time and light.
  private hour = 12;
  private time = 0;
  private paletteIn = 0;
  private readonly sky: ScenePalette;
  private readonly sun: [number, number, number] = [0, 1, 0];
  private night = 0;
  private part = '';
  private amb: { stop(): void } | null = null;
  private celebrateIn = -1;
  private freshLeft: number[] = [];

  // Camera.
  private readonly camPos = new Vector3();
  private readonly camLook = new Vector3();
  private readonly wantPos = new Vector3();
  private readonly wantLook = new Vector3();
  private readonly v = new Vector3();
  private readonly v2 = new Vector3();
  private readonly m4 = new Matrix4();
  private readonly q = new Quaternion();
  private readonly s3 = new Vector3();
  private readonly col = new Color();
  private readonly ca = new Color();
  private readonly cb = new Color();

  private sparks!: BurstStyle;
  private fireflies!: BurstStyle;
  private motes!: BurstStyle;
  private beaconBurst!: BurstStyle;
  private dust!: BurstStyle;

  constructor(private readonly setup: HubSetup) {
    this.hour = setup.hour;
    const first = DAY[0] as (typeof DAY)[number];
    this.sky = { ...first.sky, sunFrom: this.sun, fade: 0, ink: 0 };
    // At most three beacons light one by one (sweeps are few); any others are simply lit.
    this.freshLeft = setup.fresh.slice(-3);
  }

  async load(ctx: SceneContext): Promise<void> {
    this.ctx = ctx;
    const { root, materials: kit } = ctx;
    this.sky.fade = ctx.color('fade');
    this.sky.ink = ctx.color('gold');
    ctx.atmosphere.groundAt = (x, z) => heightAt(x, z);
    ctx.atmosphere.setShadowRange(16);
    ctx.post.setGrade({
      exposure: 1.08,
      bloom: 1.15,
      bloomThreshold: 0.9,
      vignette: 0.5,
      godRays: 0.4,
      saturation: 1.06,
      shadowTint: 0xd8dcff,
      lightTint: 0xfff2dc,
    });
    // The land shows what was restored before this visit; new restorations sweep in after.
    kit.restoreAll(this.restoreLevel(this.setup.restoredBefore), 0);
    // Color around the house (restored in the intro) reaches farther with every region.
    kit.sweep(0, 0, -2, homeRadius(this.setup.restoredBefore), 0.05);
    ctx.audio.music('hub');
    ctx.audio.intensity(0.3 + 0.5 * this.setup.restored);
    ctx.audio.ambience('fire', -5, 1.2, -1.8);
    ctx.audio.ambience('wind', 4, 2, -8);

    const gold = ctx.color('gold');
    this.sparks = burstStyle({
      count: 26,
      color: gold,
      color2: 0xfff2c0,
      intensity: 3,
      speed: [1.2, 4],
      life: [0.4, 0.9],
      size: [0.04, 0.11],
      gravity: 3,
    });
    this.fireflies = burstStyle({
      count: 1,
      color: TINT.firefly,
      color2: gold,
      intensity: 2.6,
      speed: [0.05, 0.3],
      life: [2.5, 4.5],
      size: [0.04, 0.08],
      gravity: -0.04,
      radius: 3.5,
    });
    this.motes = burstStyle({
      count: 1,
      color: 0xfff0c8,
      intensity: 1.3,
      speed: [0.02, 0.12],
      life: [3, 5],
      size: [0.02, 0.04],
      gravity: -0.01,
      radius: 2.2,
    });
    this.beaconBurst = burstStyle({
      count: 60,
      color: gold,
      color2: 0xfff2c0,
      intensity: 3.4,
      speed: [3, 9],
      spread: 0.5,
      life: [1, 2],
      size: [0.3, 0.7],
      gravity: 3,
    });
    this.dust = burstStyle({
      count: 10,
      color: ctx.color('fade'),
      intensity: 1,
      speed: [0.3, 1],
      life: [0.5, 1],
      size: [0.04, 0.09],
      gravity: 1,
    });

    this.buildLand();
    this.buildHouse();
    this.buildCourtyard();
    this.buildBeacons();
    this.buildSigns();

    // --- The people.
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
      seed: 2,
    });
    this.apprentice.root.position.set(HOME[0], 0, HOME[1]);
    this.yaw = Math.atan2(-1 - HOME[0], -1 - HOME[1]);
    this.apprentice.root.rotation.y = this.yaw;
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
      seed: 6,
    });
    this.ezra.root.position.set(-5, 0, -2.75);
    root.add(this.apprentice.root, this.ezra.root);
    ctx.atmosphere.addBlob(this.apprentice.root, 0.5);
    ctx.atmosphere.addBlob(this.ezra.root, 0.55);
    if (this.setup.naftali) {
      const n = new Character(kit, {
        robe: TINT.naftaliRobe,
        hem: TINT.naftaliHem,
        trim: TINT.naftaliTrim,
        skin: TINT.skin,
        ink: TINT.ink,
        headwear: 'cap',
        height: 0.97,
        seed: 11,
      });
      n.root.position.set(7.4, 0, -3.9);
      n.root.rotation.y = -2.3;
      root.add(n.root);
      ctx.atmosphere.addBlob(n.root, 0.5);
      this.naftali = n;
    }
    this.dyo = new Dyo(kit, {
      body: TINT.dyo,
      shine: TINT.dyoShine,
      eye: TINT.dyoEye,
      pupil: TINT.ink,
    });
    this.dyo.root.scale.setScalar(0.62);
    this.dyo.root.position.set(HOME[0] + 0.85, 0, HOME[1] + 0.4);
    root.add(this.dyo.root);
    ctx.atmosphere.addBlob(this.dyo.root, 0.25);

    // --- The door words, one banner per station.
    const colors = {
      ink: TINT.ink,
      paper: TINT.parchment,
      stone: TINT.stone,
      gold,
      techelet: ctx.color('techelet'),
      err: ctx.color('err-fg'),
    };
    for (const id of ORDER) {
      const wt = new WorldText({
        atlas: ctx.engine.atlas,
        materials: kit,
        billboard: ctx.vfx.billboard,
        colors,
        style: 'banner',
        size: BANNER_SIZE,
        capacity: 8,
      });
      const [x, y, z] = STATIONS[id].banner;
      wt.anchor.set(x, y, z);
      root.add(wt.root);
      this.banners.push(wt);
      this.words.push([]);
      this.states.push([]);
      this.sizes.push(BANNER_SIZE);
    }

    this.updateSky(0);
    this.onQuality(ctx.quality);
  }

  onQuality(preset: QualityPreset): void {
    const full = preset.shadows === 'cascaded';
    this.apprentice?.shadowDetail(full);
    this.ezra?.shadowDetail(full);
    this.naftali?.shadowDetail(full);
  }

  start(run: RunConfig): void {
    void run;
    this.placeCamera(1);
    this.ctx.rig.cut();
    if (this.freshLeft.length > 0) this.celebrateIn = 1.4;
    else this.ctx.materials.restoreAll(this.restoreLevel(this.setup.restored), 0);
  }

  /** The door word of each station, in STATION_IDS order. */
  setDoors(words: readonly string[]): void {
    words.forEach((w, i) => {
      const letters = Array.from(w);
      this.words[i] = letters;
      this.states[i] = letters.map(() => 'todo' as WorldLetterState);
      this.banners[i]?.setWord(letters, this.setup.rtl);
    });
  }

  /** The letters typed so far toward a door word. */
  setTyped(typed: string): void {
    const before = this.typed.length;
    this.typed = typed;
    if (typed.length > before) {
      // Every banner that still matches pops its new letter.
      this.words.forEach((w, i) => {
        if (w.join('').startsWith(typed)) this.banners[i]?.hit(typed.length - 1);
      });
    }
  }

  /** A key no door continues: every banner still in play stumbles. */
  miss(): void {
    this.words.forEach((w, i) => {
      if (w.join('').startsWith(this.typed)) this.banners[i]?.miss();
    });
  }

  /** The door word of a station was typed: walk there. */
  walkTo(id: StationId): void {
    const i = ORDER.indexOf(id);
    const wt = this.banners[i];
    if (wt) {
      const a = wt.anchor;
      this.ctx.vfx.burst(this.sparks, a.x, a.y, a.z);
      this.ctx.vfx.shockwave(a.x, a.y, a.z, 1.2, this.ctx.color('gold'), 0.5, false);
    }
    this.ctx.audio.play('word');
    this.target = id;
    this.at = null;
    this.planPath(STATIONS[id].spot);
    this.dyo.hop(
      STATIONS[id].spot[0] + 0.7,
      0,
      STATIONS[id].spot[1] + 0.5,
      0.7,
      0.55,
      STATIONS[id].face[0],
      STATIONS[id].face[1],
    );
    this.dyoWait = 1.2;
  }

  /** Back to the courtyard (a station's panel was closed with nothing chosen). */
  goHome(): void {
    this.target = null;
    this.at = null;
    this.planPath(HOME);
  }

  /** Where a station's banner is, for labels drawn over the canvas. */
  bannerAnchor(i: number): Vector3 | null {
    return this.banners[i]?.anchor ?? null;
  }

  update(dt: number): void {
    this.time += dt;
    this.hour = (this.hour + (dt * 24) / Math.max(0.5, this.setup.dayMinutes * 60)) % 24;
    this.walk(dt);

    // Reb Ezra writes at his desk, and looks up when the apprentice comes to it.
    this.ezraWrite -= dt;
    if (this.ezraWrite <= 0) {
      this.ezra.play('write');
      this.ezraWrite = 5 + this.rng.next() * 5;
    }
    const near = this.at === 'desk' || this.target === 'desk';
    const p = this.apprentice.root.position;
    const ez = this.ezra.root.position;
    const wantEzra = near ? Math.atan2(p.x - ez.x, p.z - ez.z) : 0;
    this.ezraYaw += angleDelta(this.ezraYaw, wantEzra) * Math.min(1, dt * 3);
    this.ezra.root.rotation.y = this.ezraYaw;
    this.ezra.update(dt);
    this.apprentice.update(dt);

    if (this.naftali) {
      this.naftaliCheer -= dt;
      if (this.naftaliCheer <= 0) {
        this.naftali.play('cheer');
        this.naftaliCheer = 10 + this.rng.next() * 8;
      }
      this.naftali.update(dt);
    }

    // Dyo keeps close: when the apprentice settles, he hops to his side; now and then he hops
    // about on his own.
    this.dyoWait -= dt;
    if (this.dyoWait <= 0 && this.pathLen === 0) {
      const side = this.rng.next() < 0.5 ? -1 : 1;
      const r = 0.75 + this.rng.next() * 0.35;
      const a = this.yaw + (side * Math.PI) / 2.4;
      this.dyo.hop(p.x + Math.sin(a) * r, 0, p.z + Math.cos(a) * r, 0.5, 0.45, p.x, p.z);
      this.dyoWait = 4 + this.rng.next() * 5;
      if (this.rng.next() < 0.25) this.dyo.cheer(2);
    }
    this.dyo.update(dt);

    // Fireflies over the courtyard at night; dust in the sunlight inside by day.
    const vfx = this.ctx.vfx;
    if (this.rng.next() < dt * 4 * this.night) vfx.burst(this.fireflies, 3, 1.2, -1);
    if (this.rng.next() < dt * 2.5 * (1 - this.night)) vfx.burst(this.motes, -5, 1.8, -1.5);

    // New restorations: the beacon lights, and color sweeps out over the land.
    if (this.celebrateIn >= 0) {
      this.celebrateIn -= dt;
      if (this.celebrateIn < 0) this.celebrateNext();
    }

    this.probe.hour = this.hour;
    this.probe.walking = this.pathLen > 0;
    this.probe.at = this.at;
  }

  frame(dt: number): void {
    this.paletteIn -= dt;
    if (this.paletteIn <= 0) {
      this.updateSky(dt);
      this.paletteIn = 0.12;
    }
    this.placeCamera(dt);

    // Banners: letters typed so far turn gold, the next one glows; the others shrink back.
    const typed = this.typed;
    for (let i = 0; i < this.banners.length; i++) {
      const w = this.words[i] as string[];
      const st = this.states[i] as WorldLetterState[];
      let match = typed.length <= w.length;
      for (let k = 0; k < typed.length && match; k++) if (w[k] !== typed[k]) match = false;
      for (let k = 0; k < w.length; k++) {
        st[k] = !match ? 'todo' : k < typed.length ? 'ok' : k === typed.length ? 'next' : 'todo';
      }
      const want = match ? BANNER_SIZE * (typed.length > 0 ? 1.12 : 1) : BANNER_SIZE * 0.72;
      const s =
        (this.sizes[i] as number) + (want - (this.sizes[i] as number)) * Math.min(1, dt * 10);
      this.sizes[i] = s;
      const wt = this.banners[i] as WorldText;
      wt.size = s;
      wt.frame(dt, st);
    }

    // Beacons breathe; a restored one burns gold, an open one glows blue, a locked one is ash.
    for (let i = 0; i < this.beaconPos.length; i++) {
      const lit = this.beaconLight[i] as number;
      const want = this.beaconWant[i] as number;
      this.beaconLight[i] = lit + (want - lit) * Math.min(1, dt * 1.5);
      const b = this.beaconPos[i] as Vector3;
      const k = this.beaconLight[i] as number;
      const flick = 1 + Math.sin(this.time * 7 + i * 1.9) * 0.08 * k;
      const s = (0.55 + 0.9 * k) * flick;
      this.s3.set(s, s * (1.3 + 0.2 * Math.sin(this.time * 5 + i)), s);
      this.m4.compose(this.v.set(b.x, b.y + 4.6 + s * 0.6, b.z), this.q, this.s3);
      this.flames.setMatrixAt(i, this.m4);
    }
    this.flames.instanceMatrix.needsUpdate = true;
  }

  onKey(ev: TypedKey): void {
    void ev;
  }

  dispose(): void {
    this.amb?.stop();
    this.amb = null;
    for (const c of [this.apprentice, this.ezra, this.naftali]) {
      if (!c) continue;
      this.ctx.atmosphere.removeBlob(c.root);
      c.dispose();
    }
    if (this.dyo) {
      this.ctx.atmosphere.removeBlob(this.dyo.root);
      this.dyo.dispose();
    }
    for (const b of this.banners) b.dispose();
    this.banners.length = 0;
    this.onArrive = null;
  }

  // ---- walking -------------------------------------------------------------------------------

  /** A path that never walks through a wall or the desk: via the arch, and along the room. */
  private planPath(to: readonly [number, number]): void {
    const p = this.apprentice.root.position;
    let n = 0;
    const push = (x: number, z: number): void => {
      (this.path[n] as Vector3).set(x, 0, z);
      n += 1;
    };
    const inside = (x: number): boolean => x < -1;
    // From the back of the room, step out in front of the desk first.
    if (inside(p.x) && p.z < -2.5) push(p.x, -0.2);
    if (inside(p.x) !== inside(to[0])) push(ARCH[0], ARCH[1]);
    if (inside(to[0]) && to[1] < -2.5) push(to[0], -0.2);
    push(to[0], to[1]);
    this.pathLen = n;
    this.pathAt = 0;
  }

  private walk(dt: number): void {
    const ap = this.apprentice;
    const p = ap.root.position;
    if (this.pathLen > 0) {
      const goal = this.path[this.pathAt] as Vector3;
      this.v.set(goal.x - p.x, 0, goal.z - p.z);
      const dist = this.v.length();
      const step = WALK_SPEED * dt;
      if (dist <= step) {
        p.x = goal.x;
        p.z = goal.z;
        this.pathAt += 1;
        if (this.pathAt >= this.pathLen) {
          this.pathLen = 0;
          ap.speed = 0;
          if (this.target) {
            const f = STATIONS[this.target].face;
            this.yaw = Math.atan2(f[0] - p.x, f[1] - p.z);
            this.at = this.target;
            this.target = null;
            this.dyoWait = 0.3;
            this.ctx.audio.play('ui-open');
            this.onArrive?.(this.at);
          } else {
            this.yaw = Math.atan2(-1 - p.x, -1 - p.z);
          }
        }
      } else {
        p.x += (this.v.x / dist) * step;
        p.z += (this.v.z / dist) * step;
        this.yaw = Math.atan2(this.v.x, this.v.z);
        ap.speed = WALK_SPEED;
      }
    }
    ap.root.rotation.y += angleDelta(ap.root.rotation.y, this.yaw) * Math.min(1, dt * 8);
  }

  // ---- camera --------------------------------------------------------------------------------

  private placeCamera(dt: number): void {
    const aspect = this.ctx.engine.camera.aspect || 1.6;
    // A wide view of the house, the courtyard and the valley; a phone steps back.
    const back = Math.min(1.9, Math.max(1, 1.55 / aspect));
    this.wantLook.set(-0.8, 2.2, -4.2);
    this.wantPos.set(1.4, 8.4, 12.4);
    // Lean toward the apprentice while he walks or stands at a station.
    const p = this.apprentice.root.position;
    const focus = this.pathLen > 0 || this.at ? 0.38 : 0.12;
    this.v.set(p.x, 1.2, p.z).sub(this.wantLook).multiplyScalar(focus);
    this.wantLook.add(this.v);
    this.wantPos.addScaledVector(this.v, 0.75);
    if (this.at) this.wantPos.lerp(this.wantLook, 0.12);
    // A slow breath, so the picture is never quite still.
    this.wantPos.x += Math.sin(this.time * 0.13) * 0.25;
    this.wantPos.y += Math.sin(this.time * 0.17) * 0.12;
    if (back > 1) this.wantPos.sub(this.wantLook).multiplyScalar(back).add(this.wantLook);
    const k = dt >= 1 ? 1 : Math.min(1, dt * 2.2);
    this.camPos.lerp(this.wantPos, k);
    this.camLook.lerp(this.wantLook, k);
    this.ctx.rig.fixed(this.camPos, this.camLook);
  }

  // ---- time of day ---------------------------------------------------------------------------

  private updateSky(dt: number): void {
    void dt;
    const h = this.hour;
    let a = DAY[DAY.length - 1] as (typeof DAY)[number];
    let b = DAY[0] as (typeof DAY)[number];
    let span = 24 - a.hour;
    let into = h >= a.hour ? h - a.hour : h + 24 - a.hour;
    for (let i = 0; i < DAY.length - 1; i++) {
      const x = DAY[i] as (typeof DAY)[number];
      const y = DAY[i + 1] as (typeof DAY)[number];
      if (h >= x.hour && h < y.hour) {
        a = x;
        b = y;
        span = y.hour - x.hour;
        into = h - x.hour;
        break;
      }
    }
    const t = smoothstep(0, 1, into / span);
    const sa = a.sky;
    const sb = b.sky;
    const s = this.sky;
    const mix = (x: number, y: number): number =>
      this.ca.setHex(x).lerp(this.cb.setHex(y), t).getHex();
    s.skyTop = mix(sa.skyTop, sb.skyTop);
    s.skyHorizon = mix(sa.skyHorizon, sb.skyHorizon);
    s.sun = mix(sa.sun, sb.sun);
    s.fillSky = mix(sa.fillSky, sb.fillSky);
    s.fillGround = mix(sa.fillGround, sb.fillGround);
    s.fog = mix(sa.fog, sb.fog);
    const num = (x: number, y: number): number => x + (y - x) * t;
    s.sunIntensity = num(sa.sunIntensity, sb.sunIntensity);
    s.fillIntensity = num(sa.fillIntensity, sb.fillIntensity);
    s.fogDensity = num(sa.fogDensity, sb.fogDensity);
    s.fogBase = num(sa.fogBase, sb.fogBase);
    s.fogFalloff = num(sa.fogFalloff, sb.fogFalloff);
    s.inscatter = num(sa.inscatter, sb.inscatter);
    this.sun[0] = num(sa.sunFrom[0], sb.sunFrom[0]);
    this.sun[1] = num(sa.sunFrom[1], sb.sunFrom[1]);
    this.sun[2] = num(sa.sunFrom[2], sb.sunFrom[2]);
    this.ctx.atmosphere.setPalette(s);
    const warm = num(a.warm, b.warm);
    this.night = num(a.stars, b.stars);
    // The lamps carry the room at night: a warm glow on every surface inside.
    this.interiorMat.emissiveIntensity = 0.03 + 0.16 * warm;
    this.glowMat.emissiveIntensity = 0.7 + 1.4 * warm;
    this.starMat.opacity = 0.9 * this.night;
    // Birds by day, crickets by night.
    const part = this.night > 0.5 ? 'crickets' : 'birds';
    if (part !== this.part) {
      this.part = part;
      this.amb?.stop();
      this.amb = this.ctx.audio.ambience(part, 4, 1, -6);
    }
  }

  private restoreLevel(share: number): number {
    // Beyond the circle of color around the house, the land comes back slowly, all at once.
    return 0.15 + 0.85 * share;
  }

  private celebrateNext(): void {
    const i = this.freshLeft.shift();
    const { vfx, audio, materials, rig } = this.ctx;
    if (i === undefined) {
      // Last of all, the circle of color around the house rolls out to its new edge.
      materials.restoreAll(this.restoreLevel(this.setup.restored), 2.5);
      vfx.restore(0, 0, -2, homeRadius(this.setup.restored), 4);
      audio.play('restore');
      this.probe.restored = this.setup.restored;
      return;
    }
    const b = this.beaconPos[i];
    if (b) {
      this.beaconWant[i] = 1;
      vfx.burst(this.beaconBurst, b.x, b.y + 5, b.z);
      vfx.restore(b.x, b.y, b.z, 70, 3.2);
      audio.play('restore');
      audio.play('perfect');
      rig.shake(0.05);
      this.dyo.cheer(4);
      this.apprentice.play('cheer');
    }
    // The whole land brightens with each one; the next beacon follows shortly.
    const done = this.setup.fresh.length - this.freshLeft.length;
    const share =
      this.setup.restoredBefore +
      ((this.setup.restored - this.setup.restoredBefore) * done) / this.setup.fresh.length;
    materials.restoreAll(this.restoreLevel(share), 2.4);
    this.celebrateIn = 2.2;
    this.probe.restored = share;
  }

  // ---- building ------------------------------------------------------------------------------

  private buildLand(): void {
    const { materials: kit, tracker, root } = this.ctx;
    const land = new Mesh(
      tracker.track(landGeometry()),
      tracker.track(kit.surface({ vertexColors: true })),
    );
    land.receiveShadow = true;
    root.add(land);

    // Olive trees on the terraces and cypresses on the edges: one merged mesh.
    const r = this.rng;
    const trees = new Parts();
    for (let i = 0; i < 150; i++) {
      const x = r.range(-110, 110);
      const z = r.range(-120, EDGE_Z - 1.5);
      const d = EDGE_Z - z;
      if (d > 16 && d < 26 && r.next() < 0.5) continue;
      const y = heightAt(x, z);
      const far = 1 + d * 0.012;
      if (r.next() < 0.7) {
        trees.add(
          new CylinderGeometry(0.12 * far, 0.18 * far, 0.9 * far, 5),
          TINT.trunk,
          x,
          y + 0.4 * far,
          z,
        );
        trees.add(
          new IcosahedronGeometry(0.85 * far, 0),
          r.next() < 0.5 ? TINT.olive : TINT.oliveDark,
          x,
          y + 1.35 * far,
          z,
          TINT.oliveDark,
        );
      } else {
        const hgt = r.range(3.2, 5) * far;
        trees.add(
          new ConeGeometry(0.55 * far, hgt, 6),
          TINT.cypressLight,
          x,
          y + hgt / 2,
          z,
          TINT.cypress,
        );
      }
    }
    // A hillside village of pale stone houses on a far ridge.
    for (let i = 0; i < 26; i++) {
      const x = 62 + r.range(-14, 14);
      const z = -104 + r.range(-10, 10);
      const w = r.range(1.4, 2.6);
      const hgt = r.range(1.2, 2.2);
      trees.box(
        w,
        hgt,
        w * r.range(0.8, 1.2),
        TINT.wall,
        x,
        heightAt(x, z) + hgt / 2 - 0.2,
        z,
        TINT.wallDark,
      );
    }
    const g = trees.merge();
    if (g) {
      const m = new Mesh(tracker.track(g), tracker.track(kit.surface({ vertexColors: true })));
      kit.caster(m);
      root.add(m);
    }

    // Stars: one draw call, faded in at night.
    const n = 380;
    const stars = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const az = r.range(0, Math.PI * 2);
      const el = Math.asin(r.range(0.1, 1));
      stars[i * 3] = Math.cos(az) * Math.cos(el) * 280;
      stars[i * 3 + 1] = Math.sin(el) * 280;
      stars[i * 3 + 2] = Math.sin(az) * Math.cos(el) * 280;
    }
    const sg = new BufferGeometry();
    sg.setAttribute('position', new Float32BufferAttribute(stars, 3));
    this.starMat = tracker.track(
      new PointsMaterial({
        color: TINT.star,
        size: 1.6,
        sizeAttenuation: false,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        fog: false,
      }),
    );
    root.add(new Points(tracker.track(sg), this.starMat));
  }

  /** The house: floor, walls with arches, beams, and everything inside. Never greyed. */
  private buildHouse(): void {
    const { materials: kit, tracker, root } = this.ctx;
    const p = new Parts();
    // Floor: limestone flags in two tones.
    const floor = new PlaneGeometry(8.4, 8.4, 8, 8).rotateX(-Math.PI / 2).toNonIndexed();
    floor.deleteAttribute('uv');
    paintBy(floor, (x, _y, z, out) => {
      const odd = (Math.floor(x + 10.2) + Math.floor(z + 10.2)) % 2 === 0;
      out.setHex(odd ? TINT.floor : TINT.floorDark);
    });
    floor.translate(-5, 0.02, -0.8);
    p.list.push(floor);
    // A plinth under the house, so it sits on the hill.
    p.box(8.8, 0.4, 8.8, TINT.stone, -5, -0.19, -0.8, TINT.wallDark);
    // Back wall with a lamp niche; side wall with the Game Room's doorway; the arcade.
    const back = archWall(8.8, 3.6, 0.5, [[-0.4, 0.7, 1.7]]);
    p.add(back, TINT.wall, -5, 0, -5.05, TINT.wallDark);
    const side = archWall(8.8, 3.6, 0.5, [[-0.6, 1.5, 1.9]]);
    p.add(side, TINT.wall, -9.15, 0, -0.8, TINT.wallDark, Math.PI / 2);
    const arcade = archWall(8.8, 3.6, 0.45, [
      [-2.0, 2.4, 1.9],
      [1.4, 2.6, 1.9],
    ]);
    p.add(arcade, TINT.wall, -0.95, 0, -0.8, TINT.wallDark, Math.PI / 2);
    // Wall caps and roof beams (the room is cut away so the camera sees in).
    p.box(9.2, 0.25, 0.7, TINT.cap, -5, 3.72, -5.05);
    p.box(0.7, 0.25, 9.2, TINT.cap, -9.15, 3.72, -0.8);
    p.box(0.65, 0.25, 9.2, TINT.cap, -0.95, 3.72, -0.8);
    // The rug.
    p.box(3.6, 0.03, 2.4, TINT.rugBorder, -5, 0.04, 0.9);
    p.box(3.2, 0.035, 2.0, TINT.rug, -5, 0.045, 0.9);
    p.box(1.4, 0.04, 0.6, TINT.rugGold, -5, 0.05, 0.9);
    // The desk: a slanted writing board, an inkwell, scrolls and a lamp.
    p.box(2.4, 0.12, 1.1, TINT.wood, -5, 0.92, -1.75, TINT.woodDark);
    for (const [x, z] of [
      [-6.1, -2.2],
      [-3.9, -2.2],
      [-6.1, -1.3],
      [-3.9, -1.3],
    ] as const) {
      p.box(0.12, 0.9, 0.12, TINT.woodDark, x, 0.45, z);
    }
    const board = new BoxGeometry(1.1, 0.05, 0.7).rotateX(-0.35);
    p.add(board, TINT.parchment, -5.1, 1.12, -1.75);
    for (const [x, z, rot] of [
      [-4.0, -1.5, 0.3],
      [-4.2, -1.9, -0.2],
    ] as const) {
      const scroll = new CylinderGeometry(0.06, 0.06, 0.7, 7).rotateZ(Math.PI / 2).rotateY(rot);
      p.add(scroll, TINT.parchment, x, 1.05, z);
    }
    p.add(new CylinderGeometry(0.08, 0.1, 0.14, 8), TINT.ink, -5.9, 1.05, -1.55);
    p.add(new CylinderGeometry(0.1, 0.14, 0.08, 8), TINT.brass, -6.3, 1.02, -2.0);
    // A stool for Reb Ezra.
    p.add(new CylinderGeometry(0.28, 0.24, 0.5, 8), TINT.woodDark, -5, 0.25, -2.95);
    // Shelves: the shop's jars of ink on the left, the trophy shelf on the right.
    for (const x of [-7.1, -2.9]) {
      p.box(2.2, 2.6, 0.45, TINT.woodDark, x, 1.32, -4.55, TINT.wood);
      for (const y of [0.55, 1.2, 1.85, 2.5]) p.box(2.1, 0.06, 0.48, TINT.woodLight, x, y, -4.4);
    }
    const inks = [0x1f5fa8, 0x9b2f24, 0x2f6b3a, 0xb8862b, 0x5a3a7a, 0x14100c];
    for (let row = 0; row < 3; row++) {
      for (let k = 0; k < 6; k++) {
        const x = -7.95 + k * 0.33;
        const y = 0.58 + row * 0.65;
        p.add(
          new CylinderGeometry(0.11, 0.12, 0.3, 8),
          inks[(k + row) % 6] as number,
          x,
          y + 0.15,
          -4.4,
        );
        p.add(new CylinderGeometry(0.06, 0.06, 0.06, 6), TINT.brass, x, y + 0.33, -4.4);
      }
    }
    // Quills in a pot on the top shelf.
    p.add(new CylinderGeometry(0.14, 0.12, 0.3, 8), TINT.pot, -6.5, 2.68, -4.4);
    for (let k = 0; k < 4; k++) {
      const q = new ConeGeometry(0.05, 0.7, 4).rotateZ((k - 1.5) * 0.18);
      p.add(q, TINT.parchment, -6.5 + (k - 1.5) * 0.05, 3.05, -4.4);
    }
    // The lectern with the journal, open.
    p.box(0.18, 1.0, 0.18, TINT.woodDark, -7.7, 0.5, 1.9);
    p.box(0.7, 0.06, 0.7, TINT.woodDark, -7.7, 0.03, 1.9);
    const top = new BoxGeometry(0.9, 0.06, 0.7).rotateZ(-0.4);
    p.add(top, TINT.wood, -7.7, 1.08, 1.9);
    const pageL = new BoxGeometry(0.4, 0.03, 0.58).rotateZ(-0.32);
    p.add(pageL, TINT.parchment, -7.88, 1.18, 1.9);
    const pageR = new BoxGeometry(0.4, 0.03, 0.58).rotateZ(-0.48);
    p.add(pageR, TINT.parchment, -7.52, 1.04, 1.9);
    // The Game Room door: a cedar door in the side wall's arch, with a sign on a cord.
    p.box(0.12, 2.6, 1.4, TINT.wood, -8.88, 1.3, -1.4, TINT.woodDark);
    p.box(0.14, 0.12, 1.5, TINT.brass, -8.86, 1.15, -1.4);
    p.box(0.06, 0.62, 1.1, TINT.woodLight, -8.78, 1.62, -1.4, TINT.wood);
    // A chest of scrolls by the door and a water jar.
    p.box(1.0, 0.6, 0.6, TINT.wood, -8.3, 0.3, -3.8, TINT.woodDark);
    p.add(new SphereGeometry(0.3, 8, 6), TINT.pot, -1.6, 0.32, -4.4, 0x7a3a22);
    const merged = p.merge();
    if (merged) {
      this.interiorMat = tracker.track(
        kit.surface({
          vertexColors: true,
          restore: false,
          emissive: TINT.lamp,
          emissiveIntensity: 0.05,
        }),
      );
      const m = new Mesh(tracker.track(merged), this.interiorMat);
      kit.caster(m);
      m.receiveShadow = true;
      root.add(m);
    }

    // Things that give light: the desk lamp, the niche lamp, the lanterns. One mesh.
    const glow = new Parts();
    glow.add(new SphereGeometry(0.09, 8, 6), TINT.lamp, -6.3, 1.16, -2.0);
    glow.add(new ConeGeometry(0.07, 0.2, 6), TINT.lamp, -6.3, 1.3, -2.0);
    glow.add(new SphereGeometry(0.11, 8, 6), TINT.lamp, -5.4, 2.0, -4.95);
    for (const [x, z] of [
      [1.0, -4.9],
      [4.0, -4.9],
      [7.0, -4.9],
      [8.9, -2],
      [8.9, 1],
    ] as const) {
      glow.add(new BoxGeometry(0.18, 0.26, 0.18), TINT.window, x, 2.7, z);
    }
    const gm = glow.merge();
    if (gm) {
      this.glowMat = tracker.track(
        kit.surface({
          vertexColors: true,
          restore: false,
          emissive: TINT.lamp,
          emissiveIntensity: 1.2,
        }),
      );
      root.add(new Mesh(tracker.track(gm), this.glowMat));
    }

    // The trophy shelf: one medallion per region; gold once restored, grey until then.
    const medal = tracker.track(new CylinderGeometry(0.13, 0.13, 0.04, 14).rotateX(Math.PI / 2));
    const n = this.setup.beacons.length;
    this.medals = new InstancedMesh(medal, tracker.track(kit.ink(0xffffff, 1)), n);
    const gold = this.ctx.color('gold');
    const fade = this.ctx.color('fade');
    for (let i = 0; i < n; i++) {
      const row = i < 7 ? 0 : 1;
      const k = i % 7;
      this.m4.makeTranslation(-3.84 + k * 0.31, 1.47 + row * 0.65, -4.3);
      this.medals.setMatrixAt(i, this.m4);
      const on = this.setup.beacons[i] === 'restored';
      this.col.setHex(on ? gold : fade).multiplyScalar(on ? 2.2 : 0.55);
      this.medals.setColorAt(i, this.col);
    }
    root.add(this.medals);
  }

  /** The courtyard: flagstones, the low wall over the valley, the olive tree, the well, the pots. */
  private buildCourtyard(): void {
    const { materials: kit, tracker, root } = this.ctx;
    const r = this.rng;
    const p = new Parts();
    const ground = new PlaneGeometry(10.6, 9.2, 14, 12).rotateX(-Math.PI / 2).toNonIndexed();
    ground.deleteAttribute('uv');
    paintBy(ground, (x, _y, z, out) => {
      const n = Math.sin(x * 3.1 + z * 1.7) * Math.sin(z * 2.3 - x);
      out.setHex(TINT.flag).lerp(this.ca.setHex(TINT.flagDark), 0.5 + 0.5 * n);
    });
    ground.translate(4.3, 0.015, -0.6);
    p.list.push(ground);
    // The low wall along the valley edge and the side, with a stone cap.
    p.box(10.6, 0.95, 0.45, TINT.stone, 4.3, 0.47, -5.05, TINT.wallDark);
    p.box(10.8, 0.12, 0.6, TINT.cap, 4.3, 1.0, -5.05);
    p.box(0.45, 0.95, 9.2, TINT.stone, 9.45, 0.47, -0.6, TINT.wallDark);
    p.box(0.6, 0.12, 9.4, TINT.cap, 9.45, 1.0, -0.6);
    // A pergola over the far corner, where the lanterns hang.
    for (const [x, z] of [
      [0.6, -4.7],
      [3.6, -4.7],
      [6.6, -4.7],
      [9.0, -4.7],
      [9.0, -1.8],
      [9.0, 1.2],
    ] as const) {
      p.box(0.2, 3.1, 0.2, TINT.woodDark, x, 1.55, z);
    }
    p.box(8.6, 0.16, 0.2, TINT.wood, 4.8, 3.1, -4.7);
    p.box(0.2, 0.16, 6.2, TINT.wood, 9.0, 3.1, -1.6);
    for (let k = 0; k < 7; k++) p.box(0.12, 0.12, 2.4, TINT.wood, 1.2 + k * 1.3, 3.2, -3.6);
    // The olive tree: a twisted trunk and a crown of grey-green leaves.
    p.add(new CylinderGeometry(0.22, 0.38, 1.6, 7).rotateZ(0.12), TINT.trunk, 5.0, 0.8, -2.8);
    p.add(new CylinderGeometry(0.14, 0.2, 1.2, 6).rotateZ(-0.6), TINT.trunk, 5.4, 1.8, -2.8);
    for (const [x, y, z, s] of [
      [5.0, 2.6, -2.8, 1.25],
      [6.0, 2.4, -2.5, 0.9],
      [4.2, 2.3, -3.0, 0.85],
      [5.4, 3.1, -3.2, 0.8],
      [4.8, 2.9, -2.1, 0.75],
    ] as const) {
      p.add(new DodecahedronGeometry(s, 0), TINT.olive, x, y, z, TINT.oliveDark);
    }
    // The well, with its frame and bucket.
    p.add(new CylinderGeometry(0.85, 0.95, 0.85, 12), TINT.well, 7.3, 0.42, -1.1, TINT.stone);
    p.add(new CylinderGeometry(0.66, 0.66, 0.05, 12), TINT.water, 7.3, 0.72, -1.1);
    p.box(0.12, 1.7, 0.12, TINT.woodDark, 6.55, 1.25, -1.1);
    p.box(0.12, 1.7, 0.12, TINT.woodDark, 8.05, 1.25, -1.1);
    p.box(1.7, 0.12, 0.12, TINT.wood, 7.3, 2.05, -1.1);
    p.add(new CylinderGeometry(0.16, 0.12, 0.24, 8), TINT.woodDark, 7.3, 1.45, -1.1);
    // The practice corner: a slate on an easel, and a low bench.
    for (const dx of [-0.55, 0.55]) {
      p.add(new BoxGeometry(0.08, 2.2, 0.08).rotateX(0.18), TINT.wood, 2.4 + dx, 1.05, -4.0);
    }
    p.add(new BoxGeometry(0.08, 2.0, 0.08).rotateX(-0.35), TINT.wood, 2.4, 0.95, -4.45);
    p.add(new BoxGeometry(1.5, 1.0, 0.06).rotateX(0.18), TINT.woodDark, 2.4, 1.55, -3.98);
    p.add(new BoxGeometry(1.35, 0.86, 0.07).rotateX(0.18), TINT.slate, 2.4, 1.55, -3.96);
    p.box(1.6, 0.12, 0.5, TINT.wood, 2.4, 0.42, -4.6);
    // The scribe's tool chest (settings), brass-bound, lid ajar.
    p.box(1.3, 0.62, 0.75, TINT.wood, 6.6, 0.31, 1.8, TINT.woodDark);
    p.box(1.34, 0.08, 0.79, TINT.brass, 6.6, 0.42, 1.8);
    p.add(new BoxGeometry(1.32, 0.1, 0.77).rotateX(-0.5), TINT.woodLight, 6.6, 0.76, 1.6);
    p.add(new TorusGeometry(0.1, 0.025, 5, 10), TINT.brass, 6.6, 0.3, 2.19);
    // Clay pots of anemones along the walls.
    const pots: [number, number][] = [
      [1.3, 2.8],
      [3.0, 3.2],
      [8.7, 2.8],
      [8.7, -3.6],
      [0.0, -4.3],
    ];
    for (const [x, z] of pots) {
      p.add(new CylinderGeometry(0.32, 0.22, 0.5, 9), TINT.pot, x, 0.25, z, 0x7a3a22);
      p.add(new SphereGeometry(0.32, 7, 4), TINT.leaf, x, 0.55, z);
    }
    // Two cypresses by the far wall.
    for (const [x, z, s] of [
      [10.6, -4.2, 1.15],
      [10.8, 2.6, 0.95],
    ] as const) {
      p.add(new ConeGeometry(0.6 * s, 5.4 * s, 7), TINT.cypressLight, x, 2.7 * s, z, TINT.cypress);
    }
    const merged = p.merge();
    if (merged) {
      const m = new Mesh(tracker.track(merged), tracker.track(kit.surface({ vertexColors: true })));
      kit.caster(m);
      m.receiveShadow = true;
      root.add(m);
    }

    // Anemones in the pots: red, white and purple, grey until the land is restored.
    const flower = tracker.track(new IcosahedronGeometry(0.075, 0));
    const per = 7;
    const fl = new InstancedMesh(
      flower,
      tracker.track(kit.surface({ color: 0xffffff, emissive: 0x200808, emissiveIntensity: 0.4 })),
      pots.length * per,
    );
    const hues = [TINT.anemone, TINT.anemone, 0xf4f0f8, 0x8a4ab0];
    let n = 0;
    for (const [x, z] of pots) {
      for (let k = 0; k < per; k++) {
        const a = (k / per) * Math.PI * 2 + r.next();
        const rr = r.range(0.05, 0.25);
        this.m4.makeTranslation(
          x + Math.cos(a) * rr,
          0.75 + r.range(0, 0.12),
          z + Math.sin(a) * rr,
        );
        fl.setMatrixAt(n, this.m4);
        fl.setColorAt(n, this.col.setHex(hues[k % hues.length] as number));
        n += 1;
      }
    }
    root.add(fl);
  }

  /** A beacon for every region on the far hills, joined by a winding road. */
  private buildBeacons(): void {
    const { materials: kit, tracker, root } = this.ctx;
    const p = new Parts();
    const pts: Vector3[] = [new Vector3(2, heightAt(2, EDGE_Z - 1) + 0.1, EDGE_Z - 1)];
    BEACON_SPOTS.forEach(([x, z], i) => {
      const y = heightAt(x, z);
      const pos = new Vector3(x, y, z);
      this.beaconPos.push(pos);
      const state = this.setup.beacons[i] ?? 'locked';
      // Fresh restorations start dark and light up in the celebration.
      const fresh = this.setup.fresh.includes(i);
      const want = state === 'restored' ? 1 : state === 'open' ? 0.35 : 0;
      this.beaconWant.push(want);
      this.beaconLight.push(fresh ? 0 : want);
      if (fresh) this.beaconWant[i] = 0;
      const ladder = i === BEACON_SPOTS.length - 1;
      if (ladder) {
        // The Ladder: a thin tower of stacked letter blocks reaching into the clouds.
        for (let k = 0; k < 9; k++) {
          p.box(
            2.6 - k * 0.18,
            1.6,
            2.6 - k * 0.18,
            TINT.wall,
            x,
            y + 0.8 + k * 1.6,
            z,
            TINT.wallDark,
            k * 0.4,
          );
        }
        pos.y += 10;
      } else {
        p.add(new CylinderGeometry(0.9, 1.4, 4, 7), TINT.stone, x, y + 2, z, TINT.wallDark);
        p.add(new CylinderGeometry(1.2, 1.0, 0.5, 7), TINT.cap, x, y + 4.15, z);
      }
      if (!ladder && i < BEACON_SPOTS.length - 1) pts.push(new Vector3(x, y + 0.12, z));
    });
    // The road: a pale ribbon that follows the ground from the courtyard to the last beacon.
    const curve = new CatmullRomCurve3(pts, false, 'centripetal');
    const steps = 420;
    const road = new Float32Array(steps * 18);
    const up = new Vector3(0, 1, 0);
    const a = new Vector3();
    const b = new Vector3();
    const side = new Vector3();
    for (let s = 0; s < steps; s++) {
      curve.getPoint(s / steps, a);
      curve.getPoint((s + 1) / steps, b);
      side.subVectors(b, a).cross(up).setY(0).normalize().multiplyScalar(0.9);
      const ya = heightAt(a.x, a.z) + 0.15;
      const yb = heightAt(b.x, b.z) + 0.15;
      const o = s * 18;
      road.set(
        [
          a.x - side.x,
          ya,
          a.z - side.z,
          b.x - side.x,
          yb,
          b.z - side.z,
          a.x + side.x,
          ya,
          a.z + side.z,
          a.x + side.x,
          ya,
          a.z + side.z,
          b.x - side.x,
          yb,
          b.z - side.z,
          b.x + side.x,
          yb,
          b.z + side.z,
        ],
        o,
      );
    }
    const rg = new BufferGeometry();
    rg.setAttribute('position', new Float32BufferAttribute(road, 3));
    rg.computeVertexNormals();
    paintBy(rg, (_x, _y, _z, out) => out.setHex(TINT.flag));
    p.list.push(rg);
    const merged = p.merge();
    if (merged) {
      const m = new Mesh(tracker.track(merged), tracker.track(kit.surface({ vertexColors: true })));
      root.add(m);
    }

    // Flames: gold when restored, a blue ember when open, ash when locked.
    const flame = tracker.track(new OctahedronGeometry(1, 0));
    this.flames = new InstancedMesh(
      flame,
      tracker.track(kit.ink(0xffffff, 1)),
      this.beaconPos.length,
    );
    const gold = this.ctx.color('gold');
    const tech = this.ctx.color('techelet');
    const fade = this.ctx.color('fade');
    this.beaconPos.forEach((_, i) => {
      const st = this.setup.beacons[i] ?? 'locked';
      const fresh = this.setup.fresh.includes(i);
      if (st === 'restored') this.col.setHex(gold).multiplyScalar(fresh ? 3 : 2.6);
      else if (st === 'open') this.col.setHex(tech).multiplyScalar(1.8);
      else this.col.setHex(fade).multiplyScalar(0.5);
      this.flames.setColorAt(i, this.col);
      this.m4.identity();
      this.flames.setMatrixAt(i, this.m4);
    });
    this.flames.frustumCulled = false;
    root.add(this.flames);
    this.probe.litBeacons = this.setup.beacons.filter((b) => b === 'restored').length;
    this.probe.restored =
      this.setup.fresh.length > 0 ? this.setup.restoredBefore : this.setup.restored;
  }

  /** The "soon" sign on the Game Room door and the learned letters chalked on the slate. */
  private buildSigns(): void {
    const { tracker, root, materials: kit } = this.ctx;
    const soon = Array.from(this.setup.soon);
    const slate = Array.from(this.setup.slate).slice(0, 18);
    this.signs = tracker.track(
      new LetterField(
        this.ctx.engine.atlas,
        kit,
        this.ctx.vfx.billboard,
        soon.length + slate.length,
      ),
    );
    root.add(this.signs.mesh);
    const paper = this.ctx.color('surface');
    let n = 0;
    const rtl = this.setup.rtl;
    soon.forEach((ch, i) => {
      const k = (i - (soon.length - 1) / 2) * 0.17 * (rtl ? 1 : -1);
      this.signs.set(n++, ch, -8.72, 1.64, -1.4 + k, 0.2, TINT.ink, 1);
    });
    // Chalk: the letters this player already knows, in rows on the slate.
    slate.forEach((ch, i) => {
      const row = Math.floor(i / 6);
      const col = i % 6;
      const x = 2.4 + (rtl ? 1 : -1) * (0.45 - col * 0.18);
      this.signs.set(n++, ch, x, 1.82 - row * 0.24, -3.86 + row * 0.04, 0.17, paper, 1.15);
    });
    this.signCount = n;
    this.signs.commit();
  }
}

/** How far the color around the house reaches for a restored share of the land. */
function homeRadius(share: number): number {
  return 22 + 240 * share;
}

function angleDelta(from: number, to: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  else if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
