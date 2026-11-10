// The scene contract (ARCHITECTURE section 2) and the SceneManager that loads, runs and unloads
// scenes behind an ink wipe. A scene is self-contained: it builds everything inside the root
// group it is given, registers what it creates with the tracker, and never touches the keyboard
// or the save file.

import { Group, Vector3 } from 'three';
import type { LayoutId, TypedKey } from '../core';
import type { CameraRig } from './camera';
import { Tracker, type GpuCounts } from './disposal';
import type { Engine } from './engine';
import type { Atmosphere } from './lighting';
import type { FixedLoop } from './loop';
import type { MaterialKit } from './materials';
import type { ColorToken, ThemeName } from './palette';
import { colorNumber } from './palette';
import type { PostFx } from './postfx';
import type { QualityPreset } from './quality';
import type { InkWipe } from './transition';
import type { VfxKit } from './vfx';
import type { WorldLetterState } from './worldText';

export type { TypedKey };

/** Words to type, chosen by the lesson track and the adaptive engine. */
export interface TextSource {
  /** The next word or short line. Never empty. */
  next(): string;
}

/** One run of a scene. */
export interface RunConfig {
  text: TextSource;
  layout: LayoutId;
  /** 0 (gentle) .. 1 (hard), from the adaptive engine. */
  difficulty: number;
  /** Same seed, same run: daily challenges and ghosts depend on it. */
  seed: number;
}

/**
 * Sound, as a scene sees it. The audio engine (T10) supplies the real one; until a host passes
 * one in, scenes get `SILENT_AUDIO` and simply make no sound.
 */
export interface AudioPort {
  /**
   * A one-shot sound by name ('key', 'error', 'space', 'word', 'restore', 'impact', ...; the
   * full list is SFX_NAMES in src/audio/sfx.ts). For 'key', `pitch` is the combo (the click climbs
   * the music's scale with it) and `variant` the character typed (each key has its own click).
   */
  play(sound: string, pitch?: number, variant?: string): void;
  /** The same, coming from a point in the world (pans and fades with distance from the camera). */
  playAt(sound: string, x: number, y: number, z: number, pitch?: number): void;
  /** The scene's music theme ('title', 'hub', 'meadow', 'cliffs', 'boss'), or null for silence. */
  music(theme: string | null): void;
  /** 0..1: how many music layers are in (follows the combo; see tierIntensity). Bar-synced. */
  intensity(level: number): void;
  /** Jumps the music to a section or boss phase ('phase1', 'phase2', 'phase3') on the next bar. */
  section(name: string): void;
  /** A looping place sound ('wind', 'birds', 'water', 'fire', 'crickets', 'hum'), optionally at a point. */
  ambience(id: string, x?: number, y?: number, z?: number): AmbienceHandle;
  /** Stops every ambience (the scene manager calls this when a scene unloads). */
  clearAmbience(): void;
  /** Where the ears are: position and facing direction (the scene manager follows the camera). */
  listen(x: number, y: number, z: number, fx: number, fy: number, fz: number): void;
}

/** A running ambience: move it, or stop it. */
export interface AmbienceHandle {
  move(x: number, y: number, z: number): void;
  stop(): void;
}

/**
 * The heads-up display, as a scene sees it. The HUD (T09) supplies the real one; until a host
 * passes one in, scenes get `NO_HUD`.
 */
export interface HudPort {
  /** The line being typed and how far the player is in it. */
  line(text: string, position: number): void;
  /** A named readout ('combo', 'accuracy', 'wpm', 'lives', ...). */
  set(readout: string, value: number): void;
  /** A short message across the screen ("Restored!"). */
  announce(text: string): void;
}

/**
 * The word being typed, as a scene sees it. The host's typing driver (src/game/typing.ts, T09)
 * judges every key; the scene only reads this to draw the word in its world, and is told about
 * each judged key (`onKey`) and each finished word (`onWord`).
 */
export interface TypingView {
  /** The word to type, without the space that ends it. */
  readonly word: string;
  /** Letters of the word plus that space. */
  readonly letters: readonly string[];
  /** How each of `letters` looks right now. */
  readonly states: readonly WorldLetterState[];
  /** Index into `letters` of the letter to type. */
  readonly position: number;
  /** The word after this one ('' at the end of a lesson). */
  readonly lookahead: string;
  readonly combo: number;
  /** Combo tier 0..4 (ink, techelet, silver, gold, light). */
  readonly tier: number;
  readonly layout: LayoutId;
}

export const NO_TYPING: TypingView = {
  word: '',
  letters: [],
  states: [],
  position: 0,
  lookahead: '',
  combo: 0,
  tier: 0,
  layout: 'he',
};

export const SILENT_AUDIO: AudioPort = {
  play() {},
  playAt() {},
  music() {},
  intensity() {},
  section() {},
  ambience: () => ({ move() {}, stop() {} }),
  clearAmbience() {},
  listen() {},
};
export const NO_HUD: HudPort = { line() {}, set() {}, announce() {} };

export interface SceneContext {
  /** Everything the scene builds goes under this group. */
  readonly root: Group;
  /** Register every geometry, material and texture here; the manager frees them on unload. */
  readonly tracker: Tracker;
  readonly engine: Engine;
  readonly materials: MaterialKit;
  readonly atmosphere: Atmosphere;
  readonly rig: CameraRig;
  readonly vfx: VfxKit;
  readonly post: PostFx;
  readonly loop: FixedLoop;
  readonly quality: QualityPreset;
  readonly audio: AudioPort;
  readonly hud: HudPort;
  /** The word being typed and its letter states (NO_TYPING when the host types nothing). */
  readonly typing: TypingView;
  readonly theme: ThemeName;
  /** A UI color token as a 0xRRGGBB number, honoring the colorblind palette. */
  color(token: ColorToken): number;
}

export interface GameScene {
  /** 'meadow', 'cliffs', ... */
  readonly id: string;
  /** Build geometry, lights and the music theme. */
  load(ctx: SceneContext): Promise<void>;
  /** Begin a run: text source, difficulty, seed. */
  start(run: RunConfig): void;
  /** One fixed logic step. Must not allocate. */
  update(dt: number): void;
  /** A key press, already judged by the typing core. */
  onKey(ev: TypedKey): void;
  /** Optional: a word was finished (after its last key reached `onKey`). */
  onWord?(word: string, perfect: boolean): void;
  /** Free everything the tracker does not know about (and stop anything still running). */
  dispose(): void;
  /** Optional: once per drawn frame with real time, for things that must not freeze in hit-stop. */
  frame?(dt: number): void;
  /** Optional: the quality preset changed while the scene is running. */
  onQuality?(preset: QualityPreset): void;
}

export interface SceneHost {
  theme: ThemeName;
  colorblind: boolean;
  audio?: AudioPort;
  hud?: HudPort;
  typing?: TypingView;
}

export class SceneManager {
  current: GameScene | null = null;
  /** GPU objects left behind by the last unloaded scene. Always 0 when scenes are clean. */
  lastLeak = 0;

  private root: Group | null = null;
  private tracker: Tracker | null = null;
  private baseline: GpuCounts | null = null;
  private busy = false;
  private readonly ears = new Vector3();
  private get audio(): AudioPort {
    return this.host.audio ?? SILENT_AUDIO;
  }

  constructor(
    private readonly engine: Engine,
    private readonly wipe: InkWipe,
    private readonly host: SceneHost,
  ) {
    engine.onUpdate = (dt) => this.current?.update(dt);
    engine.onFrame = (dt) => {
      this.current?.frame?.(dt);
      // The ears follow the camera, so positional sounds pan and fade as it moves.
      const cam = engine.camera;
      cam.getWorldDirection(this.ears);
      this.audio.listen(
        cam.position.x,
        cam.position.y,
        cam.position.z,
        this.ears.x,
        this.ears.y,
        this.ears.z,
      );
    };
    engine.onQuality = (preset) => {
      // A new preset means new buffers and shadow maps: measure the engine afresh next time.
      this.baseline = null;
      this.current?.onQuality?.(preset);
    };
  }

  /** Covers the screen with ink, swaps scenes, starts the run and reveals it. */
  async go(scene: GameScene, run: RunConfig): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      await this.wipe.cover();
      this.unload();
      const e = this.engine;
      if (!this.baseline) {
        // Draw the empty world once, so what the engine itself holds is not counted as a leak.
        e.renderOnce();
        this.baseline = e.gpuCounts();
      }
      const root = new Group();
      const tracker = new Tracker();
      this.root = root;
      this.tracker = tracker;
      e.scene.add(root);
      const host = this.host;
      const ctx: SceneContext = {
        root,
        tracker,
        engine: e,
        materials: e.materials,
        atmosphere: e.atmosphere,
        rig: e.rig,
        vfx: e.vfx,
        post: e.post,
        loop: e.loop,
        quality: e.preset,
        audio: host.audio ?? SILENT_AUDIO,
        hud: host.hud ?? NO_HUD,
        typing: host.typing ?? NO_TYPING,
        theme: host.theme,
        color: (token) => colorNumber(host.theme, token, host.colorblind),
      };
      await scene.load(ctx);
      e.loop.reset();
      scene.start(run);
      this.current = scene;
      e.rig.cut();
      e.start();
      await this.wipe.reveal();
    } finally {
      this.busy = false;
    }
  }

  onKey(ev: TypedKey): void {
    this.current?.onKey(ev);
  }

  onWord(word: string, perfect: boolean): void {
    this.current?.onWord?.(word, perfect);
  }

  /** Unloads the current scene and checks that it left nothing behind. */
  unload(): void {
    const e = this.engine;
    if (this.current) {
      this.current.dispose();
      this.current = null;
    }
    this.tracker?.dispose();
    this.tracker = null;
    if (this.root) {
      e.scene.remove(this.root);
      this.root = null;
    }
    this.audio.clearAmbience();
    e.materials.clearSweeps();
    e.materials.restoreAll(0, 0);
    e.post.setGrade();
    e.atmosphere.groundAt = () => 0;
    e.rig.colliders = [];
    if (this.baseline) {
      e.renderOnce();
      const now = e.gpuCounts();
      // Shader programs are a cache the renderer shares between scenes (and keeps a few of its
      // own), so a scene is judged on what it owns: geometries and textures.
      this.lastLeak = Math.max(
        0,
        now.geometries + now.textures - this.baseline.geometries - this.baseline.textures,
      );
      if (this.lastLeak > 0 && import.meta.env.DEV) {
        console.warn(`Scene left ${this.lastLeak} GPU objects behind`, now, this.baseline);
      }
    }
  }

  dispose(): void {
    this.unload();
    this.engine.onUpdate = null;
    this.engine.onFrame = null;
    this.engine.onQuality = null;
  }
}
