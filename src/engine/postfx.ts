// The post-processing chain (ARCHITECTURE section 1): bloom on gold ink, cheap screen-space god
// rays, SSAO on high+, then a finishing pass with the chromatic-aberration hit pulse, tone
// mapping, color grading, screen flash and vignette. Effects are merged into as few full-screen
// passes as possible: one on low, two otherwise.

import {
  BlendFunction,
  BloomEffect,
  ChromaticAberrationEffect,
  Effect,
  EffectComposer,
  EffectPass,
  GodRaysEffect,
  NormalPass,
  Pass,
  RenderPass,
  SSAOEffect,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
} from 'postprocessing';
import {
  Color,
  HalfFloatType,
  Uniform,
  Vector2,
  Vector4,
  type Camera,
  type Mesh,
  type Scene,
  type WebGLRenderer,
} from 'three';
import { clamp01, damp } from './motion';
import type { QualityPreset } from './quality';

const GRADE_FRAGMENT = /* glsl */ `
uniform float saturation;
uniform float contrast;
uniform vec3 shadowTint;
uniform vec3 lightTint;
uniform vec4 flash;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = inputColor.rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, saturation);
  c = (c - 0.5) * contrast + 0.5;
  c *= mix(shadowTint, lightTint, smoothstep(0.0, 0.7, l));
  c = mix(c, flash.rgb, flash.a);
  outputColor = vec4(max(c, 0.0), inputColor.a);
}`;

/** The look of a scene after rendering. Every field is optional; defaults are the house style. */
export interface Grade {
  saturation?: number;
  contrast?: number;
  /** Multiplied into the dark and the bright parts of the picture (a gentle split tone). */
  shadowTint?: number;
  lightTint?: number;
  bloom?: number;
  bloomThreshold?: number;
  vignette?: number;
  godRays?: number;
  exposure?: number;
}

const DEFAULT_GRADE: Required<Grade> = {
  saturation: 1.08,
  contrast: 1.06,
  shadowTint: 0xf2f0ff,
  lightTint: 0xfff6e6,
  bloom: 1.1,
  bloomThreshold: 0.92,
  vignette: 0.42,
  godRays: 0.55,
  exposure: 1,
};

/**
 * Layer of everything that is light rather than matter: sky, sun, particles, letters, trails.
 * The main camera sees it; the SSAO normal pass must not, or effects would cast fake occlusion.
 */
export const FX_LAYER = 1;

/** A pass that only runs a callback between two other passes. */
class CallPass extends Pass {
  constructor(private readonly fn: () => void) {
    super('CallPass');
    this.needsSwap = false;
  }

  override render(): void {
    this.fn();
  }
}

class GradeEffect extends Effect {
  constructor() {
    super('GradeEffect', GRADE_FRAGMENT, {
      blendFunction: BlendFunction.SET,
      uniforms: new Map<string, Uniform>([
        ['saturation', new Uniform(1)],
        ['contrast', new Uniform(1)],
        ['shadowTint', new Uniform(new Color(0xffffff))],
        ['lightTint', new Uniform(new Color(0xffffff))],
        ['flash', new Uniform(new Vector4(1, 1, 1, 0))],
      ]),
    });
  }

  uniform<T>(name: string): Uniform<T> {
    return this.uniforms.get(name) as Uniform<T>;
  }
}

export class PostFx {
  /** 0..1 multipliers from the player's settings (reduce motion sets both to 0). */
  flashScale = 1;
  /** Multiplies the graded saturation; 1 = as graded. Brief effects (the error flicker) use it. */
  private satScale = 1;
  chromaScale = 1;

  private composer: EffectComposer | null = null;
  private bloom: BloomEffect | null = null;
  private godRays: GodRaysEffect | null = null;
  private chroma: ChromaticAberrationEffect | null = null;
  private vignette: VignetteEffect | null = null;
  private tone: ToneMappingEffect | null = null;
  private gradeFx: GradeEffect | null = null;
  private normalPass: NormalPass | null = null;
  private grade: Required<Grade> = { ...DEFAULT_GRADE };
  private readonly chromaOffset = new Vector2(0, 0);
  private chromaAmount = 0;
  private flashAmount = 0;
  private flashRate = 6;
  private readonly flashColor = new Color(0xffffff);

  constructor(private readonly renderer: WebGLRenderer) {}

  /** Builds (or rebuilds, when quality changes) the whole chain. */
  build(scene: Scene, camera: Camera, sun: Mesh | null, q: QualityPreset): void {
    this.dispose();
    const composer = new EffectComposer(this.renderer, {
      frameBufferType: HalfFloatType,
      multisampling: q.msaa,
    });
    composer.addPass(new RenderPass(scene, camera));

    const world: Effect[] = [];
    if (q.ssao) {
      this.normalPass = new NormalPass(scene, camera);
      composer.addPass(new CallPass(() => camera.layers.disable(FX_LAYER)));
      composer.addPass(this.normalPass);
      composer.addPass(new CallPass(() => camera.layers.enable(FX_LAYER)));
      world.push(
        new SSAOEffect(camera, this.normalPass.texture, {
          blendFunction: BlendFunction.MULTIPLY,
          samples: 9,
          rings: 5,
          radius: 0.09,
          intensity: 1.6,
          bias: 0.03,
          luminanceInfluence: 0.6,
          resolutionScale: 0.5,
          worldDistanceThreshold: 60,
          worldDistanceFalloff: 20,
          worldProximityThreshold: 0.6,
          worldProximityFalloff: 0.2,
        }),
      );
    }
    if (q.godRays && sun) {
      this.godRays = new GodRaysEffect(camera, sun, {
        samples: q.godRaySamples,
        density: 0.94,
        decay: 0.93,
        weight: 0.35,
        exposure: this.grade.godRays,
        clampMax: 1,
        resolutionScale: 0.4,
        blur: true,
      });
      world.push(this.godRays);
    }
    if (q.bloom) {
      this.bloom = new BloomEffect({
        mipmapBlur: true,
        levels: q.bloomLevels,
        radius: 0.72,
        luminanceThreshold: this.grade.bloomThreshold,
        luminanceSmoothing: 0.18,
        intensity: this.grade.bloom,
      });
      world.push(this.bloom);
    }

    this.tone = new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL });
    this.gradeFx = new GradeEffect();
    this.vignette = new VignetteEffect({ offset: 0.32, darkness: this.grade.vignette });
    const finish: Effect[] = [this.tone, this.gradeFx, this.vignette];

    if (q.chromaticAberration) {
      // The aberration re-samples the picture, so it must read a buffer that already holds the
      // bloom and rays: it gets the finishing pass to itself and the world effects go first.
      this.chroma = new ChromaticAberrationEffect({
        offset: this.chromaOffset,
        radialModulation: true,
        modulationOffset: 0.18,
      });
      if (world.length > 0) composer.addPass(new EffectPass(camera, ...world));
      composer.addPass(new EffectPass(camera, this.chroma, ...finish));
    } else {
      composer.addPass(new EffectPass(camera, ...world, ...finish));
    }
    this.composer = composer;
    this.applyGrade();
  }

  setSize(width: number, height: number): void {
    this.composer?.setSize(width, height, false);
  }

  /** Sets the scene's look. Fields left out return to the house defaults. */
  setGrade(grade: Grade = {}): void {
    this.grade = { ...DEFAULT_GRADE, ...grade };
    this.applyGrade();
  }

  private applyGrade(): void {
    const g = this.grade;
    if (this.gradeFx) {
      this.gradeFx.uniform<number>('saturation').value = g.saturation * this.satScale;
      this.gradeFx.uniform<number>('contrast').value = g.contrast;
      this.gradeFx.uniform<Color>('shadowTint').value.setHex(g.shadowTint);
      this.gradeFx.uniform<Color>('lightTint').value.setHex(g.lightTint).multiplyScalar(g.exposure);
    }
    if (this.bloom) {
      this.bloom.intensity = g.bloom;
      this.bloom.luminanceMaterial.threshold = g.bloomThreshold;
    }
    if (this.vignette) this.vignette.darkness = g.vignette;
    if (this.godRays) this.godRays.godRaysMaterial.exposure = g.godRays;
  }

  /** Drains (k < 1) or restores (k = 1) color for a moment without changing the grade. */
  setSaturationScale(k: number): void {
    if (k === this.satScale) return;
    this.satScale = k;
    if (this.gradeFx) this.gradeFx.uniform<number>('saturation').value = this.grade.saturation * k;
  }

  /** The hit pulse: colors split toward the screen edges for a moment. `strength` 0..1. */
  pulseChroma(strength = 1): void {
    this.chromaAmount = Math.max(this.chromaAmount, clamp01(strength) * this.chromaScale);
  }

  /** A soft full-screen flash that fades over `seconds`. `strength` 0..1 is the peak opacity. */
  flash(color: number, strength = 0.35, seconds = 0.25): void {
    const s = clamp01(strength) * this.flashScale;
    if (s <= this.flashAmount) return;
    this.flashColor.setHex(color);
    this.flashAmount = s;
    this.flashRate = s / Math.max(0.02, seconds);
  }

  /** Per frame, with real (unscaled) time so pulses keep moving during hit-stop. */
  update(dt: number): void {
    if (this.chromaAmount > 0) {
      this.chromaAmount = damp(this.chromaAmount, 0, 9, dt);
      if (this.chromaAmount < 0.002) this.chromaAmount = 0;
    }
    this.chromaOffset.set(this.chromaAmount * 0.012, this.chromaAmount * 0.006);
    if (this.flashAmount > 0) {
      this.flashAmount = Math.max(0, this.flashAmount - this.flashRate * dt);
    }
    if (this.gradeFx) {
      const f = this.gradeFx.uniform<Vector4>('flash').value;
      f.set(this.flashColor.r, this.flashColor.g, this.flashColor.b, this.flashAmount);
    }
  }

  render(dt: number): void {
    this.composer?.render(dt);
  }

  dispose(): void {
    // The normal pass never frees the material it draws normals with: do it for it.
    const np = this.normalPass as unknown as {
      renderPass?: { overrideMaterial: { dispose(): void } | null };
    } | null;
    if (np?.renderPass) {
      np.renderPass.overrideMaterial?.dispose();
      np.renderPass.overrideMaterial = null;
    }
    this.composer?.dispose();
    this.composer = null;
    this.bloom = null;
    this.godRays = null;
    this.chroma = null;
    this.vignette = null;
    this.tone = null;
    this.gradeFx = null;
    this.normalPass = null;
  }
}
