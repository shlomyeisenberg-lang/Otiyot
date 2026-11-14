// The Engine: one renderer, one fixed-step loop, and every kit a scene needs, wired together.
// A host (a screen) creates it inside an element, hands it to a SceneManager, and disposes it
// when leaving. After dispose the renderer must hold nothing (see `gpuCounts`).

import { PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import { CameraRig } from './camera';
import type { GpuCounts } from './disposal';
import { LetterAtlas } from './letters';
import { Atmosphere } from './lighting';
import { FixedLoop } from './loop';
import { MaterialKit } from './materials';
import { FX_LAYER, PostFx } from './postfx';
import {
  BENCHMARK_SECONDS,
  BENCHMARK_WARMUP,
  pickPreset,
  QUALITY,
  type QualityName,
  type QualityPreset,
} from './quality';
import { VfxKit } from './vfx';

function clampUnit(v: number): number {
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1;
}

export interface EngineOptions {
  quality: QualityName;
  /** Reduce motion: no shake, flashes, push-ins or hit-stop (fades stay). */
  reducedMotion?: boolean;
  /** How much camera shake the player wants, 0..1 (default 1). */
  shake?: number;
  /** How much screen flash the player wants, 0..1 (default 1). */
  flash?: number;
}

export interface FrameStats {
  fps: number;
  frameMs: number;
  /** Everything drawn in the last frame, including shadow and post-processing passes. */
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  programs: number;
  quality: QualityName;
}

/** Thrown when the browser cannot give us WebGL 2 (very old machine, or graphics turned off). */
export class NoWebGLError extends Error {
  constructor() {
    super('WebGL 2 is not available');
    this.name = 'NoWebGLError';
  }
}

export class Engine {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(50, 16 / 9, 0.3, 600);
  readonly loop = new FixedLoop();
  readonly materials: MaterialKit;
  readonly atmosphere: Atmosphere;
  readonly post: PostFx;
  readonly rig: CameraRig;
  readonly vfx: VfxKit;
  readonly stats: FrameStats;
  preset: QualityPreset;

  /** One fixed logic step (scaled by hit-stop). Set by the SceneManager. */
  onUpdate: ((dt: number) => void) | null = null;
  /** Once per drawn frame, before the camera moves, with real time. */
  onFrame: ((dt: number) => void) | null = null;
  /** Called after quality changes so a scene can rebuild what depends on it. */
  onQuality: ((preset: QualityPreset) => void) | null = null;

  private raf = 0;
  private last = 0;
  private running = false;
  private disposed = false;
  private readonly observer: ResizeObserver;
  private samples: number[] | null = null;
  private readonly handlers = {
    update: (dt: number): void => {
      this.materials.update(dt);
      this.onUpdate?.(dt);
    },
    frame: (dt: number): void => this.frame(dt),
  };

  private constructor(
    private readonly host: HTMLElement,
    readonly atlas: LetterAtlas,
    o: EngineOptions,
  ) {
    try {
      this.renderer = new WebGLRenderer({
        antialias: false,
        stencil: false,
        depth: false,
        powerPreference: 'high-performance',
      });
    } catch {
      throw new NoWebGLError();
    }
    if (!this.renderer.capabilities.isWebGL2) {
      this.renderer.dispose();
      throw new NoWebGLError();
    }
    this.preset = QUALITY[o.quality];
    this.renderer.info.autoReset = false;
    this.renderer.domElement.className = 'engine__canvas';
    host.append(this.renderer.domElement);

    this.camera.layers.enable(FX_LAYER);
    this.materials = new MaterialKit(this.preset.fog);
    this.atmosphere = new Atmosphere(this.scene, this.camera, this.renderer, this.materials);
    this.post = new PostFx(this.renderer);
    this.rig = new CameraRig(this.camera);
    this.vfx = new VfxKit(
      {
        root: this.scene,
        camera: this.camera,
        materials: this.materials,
        post: this.post,
        rig: this.rig,
        loop: this.loop,
        atlas,
      },
      this.preset,
    );
    this.stats = {
      fps: 0,
      frameMs: 0,
      drawCalls: 0,
      triangles: 0,
      geometries: 0,
      textures: 0,
      programs: 0,
      quality: this.preset.name,
    };
    this.setReducedMotion(o.reducedMotion === true, o.shake, o.flash);
    this.atmosphere.setQuality(this.preset);
    this.post.build(this.scene, this.camera, this.atmosphere.sunDisc, this.preset);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
    this.resize();
  }

  /** Builds the engine inside `host`. Throws NoWebGLError when 3D is not available. */
  static async create(host: HTMLElement, o: EngineOptions): Promise<Engine> {
    const atlas = await LetterAtlas.create();
    try {
      return new Engine(host, atlas, o);
    } catch (err) {
      atlas.dispose();
      throw err;
    }
  }

  /** Reduce motion turns everything off; the shake and flash sliders (0..1) scale the rest. */
  setReducedMotion(reduced: boolean, shake = 1, flash = 1): void {
    const k = reduced ? 0 : 1;
    this.rig.shakeScale = k * clampUnit(shake);
    this.rig.pushScale = k;
    this.post.flashScale = k * clampUnit(flash);
    this.post.chromaScale = k;
    this.vfx.hitStopScale = k;
  }

  /** Switches preset while running: rebuilds post FX, shadows and effect pools. */
  setQuality(name: QualityName): void {
    if (name === this.preset.name || this.disposed) return;
    this.preset = QUALITY[name];
    this.stats.quality = name;
    this.materials.setFogLevel(this.preset.fog);
    this.atmosphere.setQuality(this.preset);
    this.vfx.setQuality(this.preset);
    this.post.build(this.scene, this.camera, this.atmosphere.sunDisc, this.preset);
    this.onQuality?.(this.preset);
    this.resize();
  }

  private resize(): void {
    if (this.disposed) return;
    const w = Math.max(1, this.host.clientWidth);
    const h = Math.max(1, this.host.clientHeight);
    const pr = Math.min(window.devicePixelRatio || 1, this.preset.pixelRatio);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.post.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.vfx.setViewport(h * pr, this.camera.fov);
    this.atmosphere.onCameraChange();
  }

  start(): void {
    if (this.running || this.disposed) return;
    this.running = true;
    this.last = performance.now();
    const tick = (now: number): void => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(tick);
      const ms = now - this.last;
      this.last = now;
      this.samples?.push(ms);
      const s = this.stats;
      s.frameMs = s.frameMs === 0 ? ms : s.frameMs + (ms - s.frameMs) * 0.08;
      s.fps = s.frameMs > 0 ? 1000 / s.frameMs : 0;
      this.loop.advance(ms / 1000, this.handlers);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  /**
   * Runs the world forward by `seconds` in fixed steps, then draws once. For tests and tools:
   * the same steps the loop would take, without waiting for the clock.
   */
  simulate(seconds: number): void {
    if (this.disposed) return;
    const steps = Math.round(seconds / this.loop.step);
    for (let i = 0; i < steps; i++) {
      this.handlers.update(this.loop.step);
      this.onFrame?.(this.loop.step);
      this.rig.update(this.loop.step);
    }
    this.frame(0);
  }

  /** Draws one frame right now (used before measuring what the engine itself holds). */
  renderOnce(): void {
    if (this.disposed) return;
    this.atmosphere.warm(true);
    this.frame(0);
    this.atmosphere.warm(false);
  }

  private frame(dt: number): void {
    this.onFrame?.(dt);
    this.rig.update(dt);
    this.atmosphere.update(this.rig.focus);
    this.vfx.update();
    this.post.update(dt);
    const info = this.renderer.info;
    info.reset();
    this.post.render(dt);
    const s = this.stats;
    s.drawCalls = info.render.calls;
    s.triangles = info.render.triangles;
    s.geometries = info.memory.geometries;
    s.textures = info.memory.textures;
    s.programs = info.programs?.length ?? 0;
  }

  /**
   * The first-run benchmark: watches the frame times of whatever is on screen for two seconds
   * (after a short warm-up for shader compilation) and recommends a preset. Run it on medium.
   */
  benchmark(): Promise<QualityName> {
    return new Promise((resolve) => {
      const warm = window.setTimeout(() => {
        this.samples = [];
      }, BENCHMARK_WARMUP * 1000);
      window.setTimeout(
        () => {
          window.clearTimeout(warm);
          const samples = this.samples ?? [];
          this.samples = null;
          resolve(this.disposed ? 'medium' : pickPreset(samples));
        },
        (BENCHMARK_WARMUP + BENCHMARK_SECONDS) * 1000,
      );
    });
  }

  /** What the renderer holds right now. */
  gpuCounts(): GpuCounts {
    const info = this.renderer.info;
    return {
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      programs: info.programs?.length ?? 0,
    };
  }

  /** Frees everything. Returns what was still held after cleaning up (all zeros when clean). */
  dispose(): GpuCounts {
    if (this.disposed) return { geometries: 0, textures: 0, programs: 0 };
    this.stop();
    this.disposed = true;
    this.observer.disconnect();
    this.onUpdate = null;
    this.onFrame = null;
    this.onQuality = null;
    this.vfx.dispose();
    this.atmosphere.dispose();
    this.post.dispose();
    this.materials.dispose();
    this.atlas.dispose();
    this.renderer.renderLists.dispose();
    // The renderer keeps a few shaders of its own (shadow depth) until it is disposed itself.
    this.renderer.dispose();
    const left = this.gpuCounts();
    this.renderer.domElement.remove();
    return left;
  }
}
