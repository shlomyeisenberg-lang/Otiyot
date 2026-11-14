// The Sunken Geniza (T20): the fourth region of Act Two.
//
// A flooded archive. Long ago the old pages were laid to rest here, and now the hall lies under
// green water: sandstone pillars, shelves of clay jars, weed swaying on the floor and the light
// coming down in shafts from the surface far above. The Fading has greyed it all, and the pages
// lie on stone lecterns along the floor, one word on each. The water moves with a tide, and the
// tide follows the apprentice's own beat (a ring of light around the lectern breathes with it).
// Keys typed at an even beat open a current: the page is carried up whole, in gold, through the
// light to the surface. A sudden rush of keys stirs the silt and clouds the water; that page still
// rises, only slowly. Four shafts of light open as the run goes on, and the last page restores
// the hall. Nothing counts down.
//
// The typing is judged by the host (PlayController); this scene only reacts, and learns the shape
// of the run from `begin(plan)`.

import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
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
  currentAfter,
  liftedWhole,
  pageSteady,
  SECTIONS,
  shaftsOpen,
  siltAfter,
  SILT_PER_BURST,
  steadyPercent,
  Tide,
  type ChapterId,
  type GenizaPlan,
  type PageBeat,
} from './plan';

export interface GenizaSetup {
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
export type GenizaMoment = 'whole' | 'silt' | 'shaft';

const MAX_SLOTS = 16;
/** Distance between lecterns along the hall, and how far to the side they stand. */
const PAGE_GAP = 7.5;
const LECTERN_SIDE = 2.3;
const LETTER_SIZE = 1.0;
const SIGN_SIZE = 0.9;
const SIGN_Y = 3.1;
const PAGE_Y = 1.55;
/** Where the water's surface is, and where lifted pages float. */
const SURFACE_Y = 17;
const DRIFTERS = 44;
const WEEDS = 70;
const UP = new Vector3(0, 1, 0);
/** Lift speed (units per second) of a page carried whole, and of one rising on its own. */
const LIFT_FAST = 4.2;
const LIFT_SLOW = 1.3;

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

/** Where lectern `i` stands (x alternates sides, z goes down the hall). */
function lecternX(i: number): number {
  return i % 2 === 0 ? -LECTERN_SIDE : LECTERN_SIDE;
}
function lecternZ(i: number): number {
  return -(i + 1) * PAGE_GAP;
}

export class GenizaScene implements GameScene {
  readonly id = 'geniza';
  /** Told when something worth a line happens (the first whole page, the silt, a shaft). */
  onMoment: ((moment: GenizaMoment) => void) | null = null;

  private ctx!: SceneContext;
  private readonly rng = new Rng(1947);
  private plan: GenizaPlan | null = null;
  private apprentice!: Character;
  private ezra!: Character;
  private dyo!: Dyo;
  private text!: WorldText;
  private feedback!: TypingFeedback;
  private quillTrail: Trail | null = null;
  private shownLetters: readonly string[] | null = null;

  private lecterns!: InstancedMesh;
  private field!: LetterField;
  private readonly pages: Mesh[] = [];
  private pageMat!: Material;
  private wholeMat!: Material;
  private readonly lift = new Float32Array(MAX_SLOTS);
  private readonly whole = new Uint8Array(MAX_SLOTS);
  private readonly lamp: Mesh[] = [];
  private matOff!: Material;
  private matOn!: Material;
  private readonly lampOn = new Float32Array(MAX_SLOTS);
  private ring!: Mesh;
  private ringMat!: MeshBasicMaterial;
  private readonly shafts: Mesh[] = [];
  private readonly shaftMats: MeshBasicMaterial[] = [];
  private readonly shaftShown = new Float32Array(SECTIONS);
  private drifters!: InstancedMesh;
  private readonly drift = new Float32Array(DRIFTERS * 4);
  private weeds!: InstancedMesh;
  private readonly weedBase = new Float32Array(WEEDS * 3);
  private glow!: PointLight;
  private slots = 0;

  // The tide.
  private readonly tide = new Tide();
  private readonly beat: PageBeat = { steadiness: 1, bursts: 0 };
  private current = 0;
  private currentShown = 0;
  private silt = 0;
  private siltShown = 0;
  private wholePages = 0;
  private steadySum = 0;
  private burstsTotal = 0;
  private slipped = false;
  private tidePhase = 0;
  private fogBase = 0;
  private saidWhole = false;
  private saidSilt = false;

  private wordsDone = 0;
  private walk = 0;
  private chapter: ChapterId | 'finale' = 'shallows';
  private finished = false;
  private heardTier = 0;
  private time = 0;
  private finaleT = -1;
  private bubbleTimer = 0;
  private streamTimer = 0;
  private spoken = false;

  private readonly camTarget = new Object3D();
  private orbit = 0;
  private gold = 0;
  private techelet = 0;
  private paper = 0;
  private inkDark = 0;
  private sparks!: BurstStyle;
  private fountain!: BurstStyle;
  private bubbles!: BurstStyle;
  private siltCloud!: BurstStyle;
  private stream!: BurstStyle;

  private readonly v = new Vector3();
  private readonly w = new Vector3();
  private readonly m4 = new Matrix4();
  private readonly q = new Quaternion();
  private readonly q2 = new Quaternion();
  private readonly s = new Vector3();
  private readonly axis = new Vector3(1, 0, 0);

  constructor(private readonly setup: GenizaSetup) {}

  // ---- probes (the screen and the smoke test read these) -------------------------------------

  /** The current in the water (0..1). */
  get currentNow(): number {
    return this.current;
  }

  /** Silt stirred up in the water (0..1). */
  get siltNow(): number {
    return this.silt;
  }

  /** The tide's beat, in ms between keys. */
  get tideMs(): number {
    return this.tide.period;
  }

  /** Pages carried up whole on the current. */
  get pagesWhole(): number {
    return this.wholePages;
  }

  /** Pages lifted off their lecterns (whole or not). */
  get pagesLifted(): number {
    return Math.min(this.wordsDone, this.slots);
  }

  /** Average steadiness of the pages so far, in percent. */
  get steadiness(): number {
    return steadyPercent(this.steadySum, this.wordsDone);
  }

  /** Keys typed in a rush, over the whole run. */
  get bursts(): number {
    return this.burstsTotal;
  }

  /** Shafts of light open over the hall (0..SECTIONS). */
  get shaftsOn(): number {
    return this.finished ? SECTIONS : shaftsOpen(this.wordsDone, this.plan?.pages.length ?? 0);
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

    // Sound: the geniza theme (its layers follow the combo tier).
    ctx.audio.music('geniza');
    ctx.audio.intensity(0);

    const sky = SKY[ctx.theme];
    ctx.atmosphere.setPalette({ ...sky, fade: ctx.color('fade'), ink: this.gold });
    this.fogBase = kit.uniforms.uFogParams.value.x;
    ctx.atmosphere.groundAt = () => 0;
    ctx.atmosphere.setShadowRange(36);
    ctx.post.setGrade(
      ctx.theme === 'dark'
        ? { exposure: 1.3, saturation: 1.1, vignette: 0.6, godRays: 0.8 }
        : { exposure: 1.08, saturation: 1.15, vignette: 0.5, godRays: 0.9 },
    );
    ctx.rig.groundAt = () => 0;

    this.sparks = burstStyle({
      count: 12,
      color: TINT.whole,
      color2: TINT.current,
      intensity: 2.6,
      speed: [1.5, 4],
      spread: 0.9,
      life: [0.4, 0.9],
      size: [0.04, 0.09],
      gravity: -1.5,
    });
    this.fountain = burstStyle({
      count: 70,
      color: TINT.whole,
      color2: TINT.current,
      intensity: 2.8,
      speed: [2, 6],
      spread: 0.6,
      life: [1.2, 2.4],
      size: [0.06, 0.16],
      gravity: -2,
    });
    this.bubbles = burstStyle({
      count: 3,
      color: TINT.bubble,
      intensity: 1.4,
      speed: [0.6, 1.4],
      spread: 0.3,
      life: [1.6, 2.6],
      size: [0.05, 0.14],
      gravity: -2.2,
    });
    this.siltCloud = burstStyle({
      count: 16,
      color: TINT.silt,
      color2: TINT.sandDark,
      intensity: 0.8,
      speed: [0.6, 2.2],
      spread: 1,
      life: [1.4, 2.6],
      size: [0.18, 0.42],
      gravity: 0.25,
    });
    this.stream = burstStyle({
      count: 3,
      color: TINT.current,
      color2: TINT.whole,
      intensity: 1.8,
      speed: [2.4, 4.2],
      spread: 0.18,
      life: [1, 1.8],
      size: [0.05, 0.11],
      gravity: -1,
    });

    this.buildHall();
    this.buildWater();
    this.buildLecterns();
    this.buildShafts();

    this.glow = new PointLight(TINT.current, 0, 18, 1.5);
    root.add(this.glow);

    // --- The people: the apprentice walking the floor, Reb Ezra at the entrance, Dyo.
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

    // --- The word to type, on a parchment banner over the lectern.
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

    // --- Camera: behind and above the apprentice, looking down the hall.
    root.add(this.camTarget);
    ctx.rig.follow(this.camTarget, {
      distance: 13,
      height: 6.4,
      lookHeight: 1.8,
      stiffness: 2.2,
    });
    this.onQuality(ctx.quality);
    this.place();
  }

  /** The hall: a sand floor, two rows of pillars, shelves of clay jars, weed and coral. */
  private buildHall(): void {
    const { materials: kit, tracker, root } = this.ctx;
    const r = this.rng;
    const len = MAX_SLOTS * PAGE_GAP + 30;
    const floor = new PlaneGeometry(60, len + 40, 40, 90).rotateX(-Math.PI / 2);
    floor.translate(0, 0, -len / 2 + 14);
    const pos = floor.getAttribute('position');
    const colors = new Float32Array(pos.count * 3);
    const a = new Color();
    const b = new Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      // Sand ripples, and stone flags showing through down the middle of the hall.
      const ripple = Math.sin(x * 0.9 + Math.sin(z * 0.3) * 1.5) * 0.5 + 0.5;
      a.setHex(TINT.sand).lerp(b.setHex(TINT.sandDark), ripple * 0.45);
      if (Math.abs(x) < 4.5) {
        const flag = (Math.floor(x * 0.6 + 10) + Math.floor(z * 0.6 + 400)) % 2 === 0;
        a.lerp(b.setHex(flag ? TINT.stone : TINT.stoneDark), 0.55);
      }
      a.multiplyScalar(0.9 + r.next() * 0.18);
      colors[i * 3] = a.r;
      colors[i * 3 + 1] = a.g;
      colors[i * 3 + 2] = a.b;
      pos.setY(i, Math.abs(x) > 5 ? ripple * 0.08 : 0);
    }
    floor.setAttribute('color', new BufferAttribute(colors, 3));
    floor.computeVertexNormals();
    const ground = new Mesh(
      tracker.track(floor),
      tracker.track(kit.surface({ vertexColors: true })),
    );
    ground.receiveShadow = true;
    root.add(ground);

    const stone: BufferGeometry[] = [];
    const wood: BufferGeometry[] = [];
    const clay: BufferGeometry[] = [];
    // Pillars down both sides, a lintel across each pair, a fallen one here and there.
    for (let z = 6; z > -len; z -= PAGE_GAP) {
      for (const x of [-8.5, 8.5]) {
        const fallen = r.next() < 0.12;
        if (fallen) {
          const col = new CylinderGeometry(0.7, 0.75, 6, 10).rotateZ(Math.PI / 2);
          col.rotateY(r.range(-0.6, 0.6));
          col.translate(x * 1.1, 0.7, z + r.range(-2, 2));
          stone.push(painted(col, TINT.stoneDark));
          continue;
        }
        const col = new CylinderGeometry(0.6, 0.72, 11, 10);
        col.translate(x, 5.5, z);
        stone.push(painted(col, TINT.stone));
        const cap = new BoxGeometry(1.8, 0.5, 1.8);
        cap.translate(x, 11.2, z);
        stone.push(painted(cap, TINT.stoneDark));
        const base = new BoxGeometry(1.7, 0.4, 1.7);
        base.translate(x, 0.2, z);
        stone.push(painted(base, TINT.stoneDark));
      }
      if (r.next() < 0.7) {
        const beam = new BoxGeometry(18.6, 0.8, 1.2);
        beam.translate(0, 11.8, z);
        stone.push(painted(beam, TINT.stone));
      }
    }
    // Shelves along the walls, each loaded with clay jars (the geniza's old storage).
    for (let z = 2; z > -len; z -= 5) {
      for (const x of [-12.5, 12.5]) {
        for (let level = 0; level < 3; level++) {
          const y = 0.9 + level * 2.2;
          const board = new BoxGeometry(1.6, 0.18, 4.6);
          board.translate(x, y, z);
          wood.push(painted(board, TINT.shelf));
          for (let k = -1; k <= 1; k++) {
            if (r.next() < 0.25) continue;
            const h = r.range(0.9, 1.4);
            const jar = new CylinderGeometry(0.32, 0.42, h, 9);
            jar.translate(x + r.range(-0.2, 0.2), y + 0.09 + h / 2, z + k * 1.4);
            clay.push(painted(jar, r.next() < 0.5 ? TINT.jar : TINT.jarDark));
            const lid = new SphereGeometry(0.3, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2);
            lid.translate(x, y + 0.09 + h, z + k * 1.4);
            clay.push(painted(lid, TINT.jarDark));
          }
        }
        for (const dz of [-2.2, 2.2]) {
          const post = new BoxGeometry(0.2, 6.8, 0.2);
          post.translate(x, 3.4, z + dz);
          wood.push(painted(post, TINT.shelf));
        }
      }
    }
    // Coral knots and rocks on the floor between the pillars and the shelves.
    for (let k = 0; k < 40; k++) {
      const side = r.next() < 0.5 ? -1 : 1;
      const x = side * r.range(5.5, 11);
      const z = r.range(-len, 8);
      const rock = new SphereGeometry(r.range(0.3, 0.8), 7, 5);
      rock.scale(1.2, 0.6, 1);
      rock.translate(x, 0.1, z);
      stone.push(painted(rock, r.next() < 0.6 ? TINT.stoneDark : TINT.coral));
    }
    for (const [parts, cast] of [
      [stone, true],
      [wood, true],
      [clay, false],
    ] as const) {
      if (parts.length === 0) continue;
      const mesh = new Mesh(merged(parts), tracker.track(kit.surface({ vertexColors: true })));
      tracker.track(mesh.geometry);
      kit.caster(mesh, cast);
      root.add(mesh);
    }

    // Weed: tall thin blades that sway with the water (instanced, moved every frame).
    this.weeds = new InstancedMesh(
      tracker.track(painted(new ConeGeometry(0.1, 1.9, 4).translate(0, 0.95, 0), TINT.weed)),
      tracker.track(kit.surface({ vertexColors: true })),
      WEEDS,
    );
    for (let k = 0; k < WEEDS; k++) {
      const side = r.next() < 0.5 ? -1 : 1;
      this.weedBase[k * 3] = side * r.range(5, 11.5);
      this.weedBase[k * 3 + 1] = r.range(-len, 8);
      this.weedBase[k * 3 + 2] = r.range(0.6, 1.5);
    }
    root.add(this.weeds);
  }

  /** The water: its surface far above, and loose pages drifting in it. */
  private buildWater(): void {
    const { materials: kit, tracker, root } = this.ctx;
    const r = this.rng;
    const len = MAX_SLOTS * PAGE_GAP + 30;
    const surface = new Mesh(
      tracker.track(new PlaneGeometry(80, len + 60, 1, 1).rotateX(Math.PI / 2)),
      tracker.track(kit.ink(TINT.surface, 0.55)),
    );
    surface.position.set(0, SURFACE_Y + 1.5, -len / 2 + 14);
    root.add(surface);

    // Loose pages in the water: x, y, z and a phase each.
    this.drifters = new InstancedMesh(
      tracker.track(new PlaneGeometry(0.7, 0.9)),
      tracker.track(kit.surface({ color: TINT.page, side: 2 })),
      DRIFTERS,
    );
    for (let k = 0; k < DRIFTERS; k++) {
      this.drift[k * 4] = r.range(-9, 9);
      this.drift[k * 4 + 1] = r.range(2, 13);
      this.drift[k * 4 + 2] = r.range(-len, 10);
      this.drift[k * 4 + 3] = r.range(0, Math.PI * 2);
    }
    kit.caster(this.drifters, false);
    root.add(this.drifters);
  }

  /** A stone lectern for every page, a page on each, a little lamp and a letter over it. */
  private buildLecterns(): void {
    const { materials: kit, tracker, root } = this.ctx;
    const lectern = merged([
      painted(new BoxGeometry(1.2, 0.3, 1.2).translate(0, 0.15, 0), TINT.stoneDark),
      painted(new CylinderGeometry(0.28, 0.36, 1.1, 8).translate(0, 0.85, 0), TINT.stone),
      painted(new BoxGeometry(1.4, 0.16, 1.1).rotateX(-0.45).translate(0, 1.45, 0), TINT.stone),
    ]);
    this.lecterns = new InstancedMesh(
      tracker.track(lectern),
      tracker.track(kit.surface({ vertexColors: true })),
      MAX_SLOTS,
    );
    this.lecterns.count = 0;
    kit.caster(this.lecterns, true);
    root.add(this.lecterns);

    this.field = tracker.track(
      new LetterField(this.ctx.engine.atlas, kit, this.ctx.vfx.billboard, MAX_SLOTS),
    );
    root.add(this.field.mesh);
    for (let i = 0; i < MAX_SLOTS; i++) this.field.hide(i);
    this.field.commit();

    this.pageMat = tracker.track(kit.surface({ color: TINT.page, side: 2 }));
    this.wholeMat = tracker.track(kit.ink(TINT.whole, 1.8));
    const pageGeo = tracker.track(new BoxGeometry(1.1, 0.03, 0.85));
    this.matOff = tracker.track(kit.ink(TINT.lampOff, 0.35));
    this.matOn = tracker.track(kit.ink(TINT.lamp, 2.4));
    const lampGeo = tracker.track(new SphereGeometry(0.16, 10, 8));
    for (let i = 0; i < MAX_SLOTS; i++) {
      const page = new Mesh(pageGeo, this.pageMat);
      page.visible = false;
      root.add(page);
      this.pages.push(page);
      const lamp = new Mesh(lampGeo, this.matOff);
      lamp.visible = false;
      root.add(lamp);
      this.lamp.push(lamp);
    }

    // The tide ring: lies on the floor around the open lectern and breathes with the beat.
    this.ringMat = tracker.track(
      new MeshBasicMaterial({
        color: TINT.current,
        transparent: true,
        opacity: 0.6,
        blending: AdditiveBlending,
        depthWrite: false,
        fog: false,
        toneMapped: false,
      }),
    );
    this.ring = new Mesh(tracker.track(new TorusGeometry(1.25, 0.06, 6, 40)), this.ringMat);
    this.ring.rotation.x = Math.PI / 2;
    this.ring.visible = false;
    root.add(this.ring);
  }

  /** Four great shafts of light down from the surface, one per quarter of the run; closed at first. */
  private buildShafts(): void {
    const { tracker, root } = this.ctx;
    const geo = tracker.track(
      new CylinderGeometry(1.6, 3.4, SURFACE_Y + 2, 20, 1, true).translate(
        0,
        (SURFACE_Y + 2) / 2,
        0,
      ),
    );
    for (let k = 0; k < SECTIONS; k++) {
      const mat = tracker.track(
        new MeshBasicMaterial({
          color: TINT.shaft,
          transparent: true,
          opacity: 0,
          blending: AdditiveBlending,
          depthWrite: false,
          fog: false,
          side: 2,
        }),
      );
      const shaft = new Mesh(geo, mat);
      shaft.visible = false;
      shaft.renderOrder = 2;
      root.add(shaft);
      this.shafts.push(shaft);
      this.shaftMats.push(mat);
    }
  }

  onQuality(preset: QualityPreset): void {
    const full = preset.shadows === 'cascaded';
    this.apprentice?.shadowDetail(full);
    this.ezra?.shadowDetail(full);
  }

  // ---- a run --------------------------------------------------------------------------------

  start(): void {
    this.reset();
  }

  /** Forgets everything: grey hall, pages on their lecterns, still water. */
  private reset(): void {
    const { materials } = this.ctx;
    materials.clearSweeps();
    materials.restoreAll(0, 0);
    this.wordsDone = 0;
    this.walk = 0;
    this.finished = false;
    this.finaleT = -1;
    this.heardTier = 0;
    this.shownLetters = null;
    this.tide.reset();
    this.current = 0;
    this.currentShown = 0;
    this.silt = 0;
    this.siltShown = 0;
    this.wholePages = 0;
    this.steadySum = 0;
    this.burstsTotal = 0;
    this.slipped = false;
    this.tidePhase = 0;
    this.saidWhole = false;
    this.saidSilt = false;
    this.spoken = false;
    this.lift.fill(0);
    this.whole.fill(0);
    this.lampOn.fill(0);
    this.shaftShown.fill(0);
    for (const m of this.lamp) m.material = this.matOff;
    for (const p of this.pages) p.material = this.pageMat;
    this.orbit = 0;
    this.ctx.audio.intensity(0);
  }

  /** A new run with this plan (the screen calls it before the first key, and for every retry). */
  begin(plan: GenizaPlan): void {
    this.reset();
    this.plan = plan;
    this.chapter = plan.chapters[0]?.id ?? 'shallows';
    this.slots = Math.min(MAX_SLOTS, plan.pages.length);
    this.lecterns.count = this.slots;
    for (let i = 0; i < this.slots; i++) {
      const x = lecternX(i);
      const z = lecternZ(i);
      // Each lectern faces the middle of the hall.
      this.q.setFromAxisAngle(UP, x < 0 ? -Math.PI / 2 : Math.PI / 2);
      this.s.set(1, 1, 1);
      this.v.set(x, 0, z);
      this.m4.compose(this.v, this.q, this.s);
      this.lecterns.setMatrixAt(i, this.m4);
      const word = plan.pages[i]?.word ?? '';
      this.field.set(i, [...word][0] ?? '', x, SIGN_Y, z, SIGN_SIZE, this.ctx.color('fade'), 0.7);
      const page = this.pages[i];
      if (page) {
        page.visible = true;
        page.position.set(x, PAGE_Y, z);
        page.rotation.set(0, x < 0 ? -Math.PI / 2 : Math.PI / 2, 0);
        page.rotateX(-0.45);
      }
      const lamp = this.lamp[i];
      if (lamp) {
        lamp.visible = true;
        lamp.position.set(x, 2.15, z);
      }
    }
    for (let i = this.slots; i < MAX_SLOTS; i++) {
      this.field.hide(i);
      const page = this.pages[i];
      if (page) page.visible = false;
      const lamp = this.lamp[i];
      if (lamp) lamp.visible = false;
    }
    this.lecterns.instanceMatrix.needsUpdate = true;
    this.field.commit();
    // The shafts stand along the hall, one per quarter of this run.
    for (let k = 0; k < SECTIONS; k++) {
      const shaft = this.shafts[k];
      if (!shaft) continue;
      const at = Math.max(0, Math.round(((k + 1) * this.slots) / SECTIONS) - 1);
      shaft.position.set(k % 2 === 0 ? 4.8 : -4.8, 0, lecternZ(at) - 2);
      shaft.visible = false;
      const mat = this.shaftMats[k];
      if (mat) mat.opacity = 0;
    }
    this.place();
  }

  /** Puts the people and the camera where a run starts. */
  private place(): void {
    this.apprentice.root.position.set(0, 0, 3);
    this.apprentice.root.rotation.y = Math.PI;
    this.ezra.root.position.set(-3.2, 0, 6.5);
    this.ezra.root.rotation.y = Math.PI * 0.8;
    this.dyo.root.position.set(1.2, 1.4, 2.6);
    this.camTarget.position.set(0, 1.2, 1);
    this.ctx.rig.orbit = Math.PI;
    this.ctx.rig.cut();
  }

  onKey(ev: TypedKey): void {
    const { typing, audio, vfx } = this.ctx;
    if (!ev.correct) {
      // A slip is soft: a blink of grey, the page is no longer clean, and on with the word.
      this.slipped = true;
      this.text.miss();
      this.feedback.wrong();
      audio.play('error');
      this.hearTier(typing.tier);
      return;
    }
    if (ev.kind !== 'char') return;
    // Every key is judged against the tide.
    const beat = this.tide.key(ev.ms);
    this.tidePhase = 0;
    if (beat === 'burst') {
      this.burstsTotal += 1;
      // A rush of keys stirs the silt at the apprentice's feet.
      const a = this.apprentice.root.position;
      vfx.burst(this.siltCloud, a.x, 0.4, a.z - 1, 0, 1, 0);
      if (!this.saidSilt && this.silt + this.tide.bursts * SILT_PER_BURST >= 0.3) {
        this.saidSilt = true;
        this.onMoment?.('silt');
      }
    }
    if (ev.expected === ' ') {
      audio.play('space');
      return;
    }
    const at = this.text.letterPosition(ev.index, this.v);
    this.text.hit(ev.index);
    this.feedback.correct(at.x, at.y, at.z, LETTER_SIZE, typing.tier);
    this.apprentice.play('write');
    audio.play('key', typing.combo, ev.expected);
    if (beat === 'steady') vfx.burst(this.sparks, at.x, at.y, at.z, 0, 1, 0);
    this.hearTier(typing.tier);
    if (!this.spoken) this.spoken = true;
  }

  /** The music builds with the combo tier; a new tier rings a chime and a rush of light. */
  private hearTier(tier: number): void {
    if (tier > this.heardTier) {
      this.ctx.audio.play('tier', tier);
      this.dyo.cheer(2 + tier);
      const a = this.apprentice.root.position;
      this.ctx.vfx.burst(this.fountain, a.x, 2.5, a.z, 0, 1, 0);
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
    const total = plan.pages.length;
    const clean = perfect && !this.slipped;
    this.slipped = false;
    this.tide.endPage(this.beat);
    const steady = pageSteady(this.beat, clean);
    this.steadySum += this.beat.steadiness;
    this.current = currentAfter(this.current, steady);
    this.silt = siltAfter(this.silt, this.beat.bursts, steady);
    const whole = liftedWhole(this.current);

    if (i < this.slots) {
      const x = lecternX(i);
      const z = lecternZ(i);
      // The page rises: whole and gold on a current, slowly and plain without one.
      this.whole[i] = whole ? 1 : 0;
      this.lift[i] = 0.001;
      const page = this.pages[i];
      if (page && whole) page.material = this.wholeMat;
      const lamp = this.lamp[i];
      if (lamp) lamp.material = this.matOn;
      this.field.set(
        i,
        [...(plan.pages[i]?.word ?? '')][0] ?? '',
        x,
        SIGN_Y,
        z,
        SIGN_SIZE,
        whole ? TINT.whole : TINT.lamp,
        whole ? 3 : 2.2,
      );
      this.field.commit();
      vfx.shockwave(x, 0.4, z, whole ? 5 : 3, whole ? TINT.current : TINT.lamp, 0.6, true, 1.4);
      vfx.burst(this.fountain, x, PAGE_Y + 0.4, z, 0, 1, 0);
      // Color comes back around the lectern, farther as the run goes on.
      const radius = 9 + (34 * this.wordsDone) / Math.max(1, total);
      vfx.restore(x, 1, z, radius, 1.6);
      audio.playAt('impact', x, 1.5, z, 0.3);
      if (whole) {
        this.wholePages += 1;
        if (!this.saidWhole) {
          this.saidWhole = true;
          this.apprentice.play('cheer');
          this.onMoment?.('whole');
        }
      }
    }
    const a = this.text.anchor;
    this.feedback.word(a.x, a.y, a.z, perfect);
    audio.play('restore');
    audio.play(perfect ? 'perfect' : 'word');

    const open = shaftsOpen(this.wordsDone, total);
    const before = shaftsOpen(this.wordsDone - 1, total);
    if (open > before && this.wordsDone < total) {
      const shaft = this.shafts[open - 1];
      if (shaft) vfx.burst(this.fountain, shaft.position.x, 1, shaft.position.z, 0, 1, 0);
      this.onMoment?.('shaft');
    }
    if (this.wordsDone < total) this.chapter = this.chapterNow();
  }

  private chapterNow(): ChapterId {
    const plan = this.plan;
    if (!plan) return 'shallows';
    for (const c of plan.chapters) if (this.wordsDone < c.to) return c.id;
    return plan.chapters.at(-1)?.id ?? 'vault';
  }

  /** The run is over. A whole run restores the hall; a failed trial leaves it as it is. */
  finale(failed: boolean): void {
    if (this.finished || this.finaleT >= 0) return;
    if (failed) {
      this.ezra.play('stagger');
      return;
    }
    const { vfx, materials, audio } = this.ctx;
    this.finished = true;
    this.finaleT = 0;
    this.chapter = 'finale';
    materials.restoreAll(1, 2.8);
    const a = this.apprentice.root.position;
    vfx.shockwave(a.x, 0.3, a.z, 90, this.gold, 2.4);
    vfx.burst(this.fountain, a.x, 3, a.z, 0, 1, 0);
    audio.play('success');
    audio.intensity(1);
    this.apprentice.play('cheer');
    this.dyo.cheer(6);
    this.ezra.play('cheer');
    this.ctx.rig.pushIn(0.35, 0.4);
    for (const lamp of this.lamp) lamp.material = this.matOn;
    this.silt = 0;
    this.current = Math.max(this.current, 0.6);
  }

  update(dt: number): void {
    this.time += dt;
    const { vfx, materials } = this.ctx;
    const total = this.plan?.pages.length ?? 0;
    this.currentShown = damp(this.currentShown, this.current, 3, dt);
    // Silt shows a little ahead of the verdict: bursts on this page cloud the water at once.
    const siltWant = this.finished ? 0 : Math.min(1, this.silt + this.tide.bursts * SILT_PER_BURST);
    this.siltShown = damp(this.siltShown, siltWant, 1.6, dt);
    materials.uniforms.uFogParams.value.x = this.fogBase * (1 + this.siltShown * 1.6);

    // The apprentice walks along the hall to the open lectern.
    const target = this.finished ? Math.max(0, total - 1) : Math.min(this.wordsDone, total - 1);
    const goZ = total > 0 ? lecternZ(Math.max(0, target)) + 2.6 : 3;
    const app = this.apprentice.root;
    const before = app.position.z;
    app.position.z = damp(app.position.z, goZ, 1.6, dt);
    app.position.x = damp(app.position.x, total > 0 ? lecternX(target) * 0.25 : 0, 1.6, dt);
    this.walk = Math.abs(app.position.z - before) / Math.max(dt, 1e-4);
    this.apprentice.speed = this.walk > 0.2 ? this.walk : 0;
    app.rotation.y = Math.PI;

    // Dyo bobs at his shoulder; Ezra stays by the entrance.
    this.dyo.root.position.set(
      app.position.x + 1.1 + Math.sin(this.time * 0.9) * 0.3,
      1.6 + Math.sin(this.time * 1.7) * 0.25,
      app.position.z - 0.6,
    );

    // Pages rising: whole ones fast and straight, others slowly with a wobble, to the surface.
    for (let i = 0; i < this.slots; i++) {
      const page = this.pages[i];
      const t = this.lift[i] as number;
      if (!page || t <= 0) continue;
      const fast = this.whole[i] === 1 || this.finished;
      const rise = (fast ? LIFT_FAST : LIFT_SLOW) * dt;
      const y = Math.min(SURFACE_Y, page.position.y + rise);
      page.position.y = y;
      page.position.x = lecternX(i) + Math.sin(this.time * 1.4 + i) * (fast ? 0.15 : 0.5);
      page.rotation.x = Math.sin(this.time * 1.1 + i * 0.7) * 0.6;
      page.rotation.z = Math.cos(this.time * 0.8 + i) * 0.4;
      this.lift[i] = t + dt;
    }
    // In the finale every page still on its lectern rises too.
    if (this.finished) {
      for (let i = 0; i < this.slots; i++) if ((this.lift[i] as number) <= 0) this.lift[i] = 0.001;
    }

    // Lamps on the lecterns swell as they light.
    for (let i = 0; i < this.slots; i++) {
      const lamp = this.lamp[i];
      if (!lamp) continue;
      const on = this.finished || i < this.wordsDone;
      this.lampOn[i] = damp(this.lampOn[i] as number, on ? 1 : 0, 5, dt);
      lamp.scale.setScalar(0.8 + (this.lampOn[i] as number) * 0.7);
    }
    // Shafts of light open, quarter by quarter.
    const shafts = this.shaftsOn;
    for (let k = 0; k < SECTIONS; k++) {
      const want = k < shafts ? 1 : 0;
      this.shaftShown[k] = damp(this.shaftShown[k] as number, want, 2, dt);
      const shown = this.shaftShown[k] as number;
      const shaft = this.shafts[k];
      const mat = this.shaftMats[k];
      if (!shaft || !mat) continue;
      shaft.visible = shown > 0.01;
      mat.opacity = shown * (0.085 + Math.sin(this.time * 0.7 + k) * 0.02);
      shaft.scale.set(
        easeOutBack(Math.min(1, shown)) * 0.9 + 0.1,
        1,
        easeOutBack(Math.min(1, shown)) * 0.9 + 0.1,
      );
    }

    // Weed sways with the water; the current makes it lean down the hall.
    const sway = 0.15 + this.currentShown * 0.35;
    for (let k = 0; k < WEEDS; k++) {
      const x = this.weedBase[k * 3] as number;
      const z = this.weedBase[k * 3 + 1] as number;
      const h = this.weedBase[k * 3 + 2] as number;
      this.q.setFromAxisAngle(this.axis, -sway + Math.sin(this.time * 1.3 + x + z * 0.3) * 0.2);
      this.v.set(x, 0, z);
      this.s.set(1, h, 1);
      this.m4.compose(this.v, this.q, this.s);
      this.weeds.setMatrixAt(k, this.m4);
    }
    this.weeds.instanceMatrix.needsUpdate = true;

    // Loose pages drift and turn, faster down the hall on a current.
    const flow = 0.25 + this.currentShown * 1.6;
    for (let k = 0; k < DRIFTERS; k++) {
      const o = k * 4;
      const ph = this.drift[o + 3] as number;
      let z = (this.drift[o + 2] as number) - flow * dt;
      if (z < -MAX_SLOTS * PAGE_GAP - 30) z += MAX_SLOTS * PAGE_GAP + 40;
      this.drift[o + 2] = z;
      this.v.set(
        (this.drift[o] as number) + Math.sin(this.time * 0.5 + ph) * 0.8,
        (this.drift[o + 1] as number) + Math.sin(this.time * 0.8 + ph * 2) * 0.6,
        z,
      );
      this.q.setFromAxisAngle(UP, this.time * 0.4 + ph);
      this.q2.setFromAxisAngle(this.axis, Math.sin(this.time + ph) * 0.9);
      this.q.multiply(this.q2);
      this.s.set(1, 1, 1);
      this.m4.compose(this.v, this.q, this.s);
      this.drifters.setMatrixAt(k, this.m4);
    }
    this.drifters.instanceMatrix.needsUpdate = true;

    this.apprentice.update(dt);
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

    // Bubbles rise from the apprentice now and then.
    if ((this.bubbleTimer -= dt) <= 0) {
      this.bubbleTimer = 0.7 + Math.sin(this.time * 3.1) * 0.25;
      vfx.burst(this.bubbles, app.position.x, 1.9, app.position.z, 0, 1, 0);
    }
    // The current shows as a stream of light rising from the open lectern.
    const open = Math.min(this.wordsDone, Math.max(0, this.slots - 1));
    if (this.currentShown > 0.05 && (this.streamTimer -= dt) <= 0) {
      this.streamTimer = 0.5 - this.currentShown * 0.38;
      vfx.burst(this.stream, lecternX(open), 0.4, lecternZ(open), 0, 1, 0);
    }
    this.glow.position.set(lecternX(open) * 0.6, 3, lecternZ(open) + 1);
    this.glow.intensity = this.finished ? 8 : 1.5 + this.currentShown * 7;

    if (this.finaleT >= 0) {
      const was = this.finaleT;
      this.finaleT += dt;
      if (was < 0.7 && this.finaleT >= 0.7)
        vfx.burst(this.fountain, app.position.x - 4, 3, app.position.z - 5, 0, 1, 0);
      if (was < 1.4 && this.finaleT >= 1.4)
        vfx.burst(this.fountain, app.position.x + 4, 3, app.position.z - 5, 0, 1, 0);
    }
  }

  frame(dt: number): void {
    const { rig, typing } = this.ctx;
    const app = this.apprentice.root.position;
    const total = this.plan?.pages.length ?? 0;
    const open = Math.min(this.wordsDone, Math.max(0, total - 1));

    // The camera floats behind the apprentice, swaying a little with the water.
    const t = this.camTarget.position;
    t.x = damp(t.x, app.x * 0.6, 3, dt);
    t.y = damp(t.y, this.finished ? 3.4 : 1.6, 2, dt);
    t.z = damp(t.z, app.z - 2, 3, dt);
    this.orbit = damp(this.orbit, this.finished ? 0.45 : 0, 0.6, dt);
    rig.orbit = Math.PI + Math.sin(this.time * 0.35) * 0.06 + this.orbit;

    // The tide ring breathes on the beat around the open lectern.
    this.tidePhase += (dt * 1000) / this.tide.period;
    if (!this.finished && this.plan && this.wordsDone < this.slots) {
      this.ring.visible = true;
      this.ring.position.set(lecternX(open), 0.08, lecternZ(open));
      const pulse = 1 - (this.tidePhase % 1);
      this.ring.scale.setScalar(1 + pulse * 0.35);
      this.ringMat.opacity = 0.25 + pulse * 0.55 * (1 - this.siltShown * 0.6);
    } else {
      this.ring.visible = false;
    }

    // The banner floats over the open lectern.
    const a = this.text.anchor;
    const lx = total > 0 ? lecternX(open) * 0.5 : 0;
    const lz = total > 0 ? lecternZ(open) : -PAGE_GAP;
    a.x = damp(a.x, lx, 5, dt);
    a.y = damp(a.y, 4.6 + Math.sin(this.time * 1.2) * 0.08, 3, dt);
    a.z = damp(a.z, lz, 5, dt);

    // The word to type: a new one rises when the apprentice moves on.
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
      this.ctx.materials.uniforms.uFogParams.value.x = this.fogBase;
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
    this.onMoment = null;
    this.plan = null;
  }
}
