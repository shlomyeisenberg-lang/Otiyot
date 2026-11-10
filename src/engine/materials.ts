// World materials. Every surface in a scene is made here so that three things work everywhere
// without a scene thinking about them:
//   1. the color-restoration sweep (un-restored things are grey `--fade`; color spreads outward
//      from the typed word with a gold-ink wavefront),
//   2. height fog with sun in-scatter (the cheap "volumetric" look),
//   3. flat-shaded low-poly lighting that is cheap on integrated graphics.
// All materials made by one MaterialKit share one set of uniforms, so a sweep or a fog change
// costs nothing per material.

import {
  BackSide,
  Color,
  DoubleSide,
  MeshBasicMaterial,
  MeshLambertMaterial,
  ShaderMaterial,
  Vector3,
  Vector4,
  type IUniform,
  type Material,
  type Side,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import { clamp01, easeOut } from './motion';

export const MAX_SWEEPS = 6;

/** Uniforms shared by every world material, particle and sky of one engine. */
export interface WorldUniforms {
  uTime: IUniform<number>;
  uFogColor: IUniform<Color>;
  /** x density, y base height, z height falloff, w sun in-scatter strength */
  uFogParams: IUniform<Vector4>;
  uSunDir: IUniform<Vector3>;
  uSunColor: IUniform<Color>;
  /** xyz center, w radius of each sweep */
  uSweep: IUniform<Vector4[]>;
  /** Wavefront glow of each sweep, 1 → 0 as it finishes. */
  uSweepGlow: IUniform<number[]>;
  /** 0 = whole world forgotten, 1 = whole world restored. */
  uRestored: IUniform<number>;
  uFadeColor: IUniform<Color>;
  uInkColor: IUniform<Color>;
}

/** GLSL shared by world materials, particles and letters. Needs `cameraPosition`. */
export const FOG_GLSL = /* glsl */ `
uniform vec3 uFogColor;
uniform vec4 uFogParams;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
vec3 otiFog(vec3 col, vec3 wp) {
  vec3 v = wp - cameraPosition;
  float dist = length(v);
  float d = uFogParams.x * dist;
  float f = 1.0 - exp(-d * d);
  vec3 fogCol = uFogColor;
  #if OTI_FOG >= 1
    // Low-lying mist: thick near the fog floor, thinning with height.
    float h = exp(-uFogParams.z * max(0.0, wp.y - uFogParams.y));
    float mist = (1.0 - exp(-dist * uFogParams.x * 2.2)) * h * 0.55;
    f = max(f * mix(0.55, 1.0, h), mist);
  #endif
  #if OTI_FOG >= 2
    // Fog facing the sun glows with its color.
    float s = pow(max(dot(v / max(dist, 1e-4), uSunDir), 0.0), 6.0);
    fogCol = mix(fogCol, uSunColor, s * uFogParams.w);
  #endif
  return mix(col, fogCol, clamp(f, 0.0, 1.0));
}
`;

const SWEEP_GLSL = /* glsl */ `
uniform vec4 uSweep[${MAX_SWEEPS}];
uniform float uSweepGlow[${MAX_SWEEPS}];
uniform float uRestored;
uniform vec3 uFadeColor;
uniform vec3 uInkColor;
float otiHash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
vec3 otiRestore(vec3 col, vec3 wp) {
  float rest = uRestored;
  float glow = 0.0;
  // A torn-paper edge: the wavefront wobbles with a little world-space noise.
  float wob = (otiHash(floor(wp * 2.5)) - 0.5) * 0.7;
  for (int i = 0; i < ${MAX_SWEEPS}; i++) {
    float r = uSweep[i].w;
    if (r <= 0.0) continue;
    float d = distance(wp, uSweep[i].xyz) + wob;
    rest = max(rest, 1.0 - smoothstep(r - 0.5, r, d));
    float front = smoothstep(r - 1.6, r - 0.1, d) * (1.0 - smoothstep(r - 0.1, r + 0.25, d));
    glow = max(glow, front * uSweepGlow[i]);
  }
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  vec3 grey = uFadeColor * (0.25 + 1.5 * l);
  return mix(grey, col, rest) + uInkColor * glow * 2.6;
}
`;

export interface WorldMaterialOptions {
  color?: number;
  /** Per-vertex colors (soft gradients baked into the geometry). */
  vertexColors?: boolean;
  /** Glow, in the material's own color space; values above 1 bloom. */
  emissive?: number;
  emissiveIntensity?: number;
  /** Takes part in the grey → color sweep. Characters and gold ink do not. Default true. */
  restore?: boolean;
  flat?: boolean;
  side?: Side;
  transparent?: boolean;
  opacity?: number;
}

export class MaterialKit {
  readonly uniforms: WorldUniforms;
  private fogLevel: 0 | 1 | 2;
  private readonly sweepStart: number[] = [];
  private readonly sweepDur: number[] = [];
  private readonly sweepMax: number[] = [];
  private nextSweep = 0;
  private restoredTarget = 0;
  private restoredRate = 0;
  /** Every lit surface material alive (cascaded shadows must be wired into each one). */
  readonly lit = new Set<Material>();
  private readonly patched = new Set<Material>();
  /** Called for each new lit material (set by the Atmosphere while cascades are on). */
  onCreate: ((m: Material) => void) | null = null;

  constructor(fogLevel: 0 | 1 | 2) {
    this.fogLevel = fogLevel;
    const sweeps: Vector4[] = [];
    const glows: number[] = [];
    for (let i = 0; i < MAX_SWEEPS; i++) {
      sweeps.push(new Vector4(0, 0, 0, 0));
      glows.push(0);
      this.sweepStart.push(-1);
      this.sweepDur.push(1);
      this.sweepMax.push(0);
    }
    this.uniforms = {
      uTime: { value: 0 },
      uFogColor: { value: new Color(0xffffff) },
      uFogParams: { value: new Vector4(0.01, 0, 0.2, 0.5) },
      uSunDir: { value: new Vector3(0, 1, 0) },
      uSunColor: { value: new Color(0xffffff) },
      uSweep: { value: sweeps },
      uSweepGlow: { value: glows },
      uRestored: { value: 0 },
      uFadeColor: { value: new Color(0x888888) },
      uInkColor: { value: new Color(0xffcc55) },
    };
  }

  /** Fog detail follows the quality preset; every material made by this kit is updated. */
  setFogLevel(level: 0 | 1 | 2): void {
    this.fogLevel = level;
    for (const m of this.patched) {
      if (m.defines) m.defines.OTI_FOG = level;
      m.needsUpdate = true;
    }
  }

  /** The standard surface: flat-shaded Lambert with the sweep and the fog. */
  surface(o: WorldMaterialOptions = {}): MeshLambertMaterial {
    const m = new MeshLambertMaterial({
      color: o.color ?? 0xffffff,
      vertexColors: o.vertexColors ?? false,
      flatShading: o.flat ?? true,
      side: o.side ?? 0,
      transparent: o.transparent ?? false,
      opacity: o.opacity ?? 1,
      emissive: o.emissive ?? 0x000000,
      emissiveIntensity: o.emissiveIntensity ?? 1,
      fog: false,
    });
    this.patch(m, o.restore ?? true);
    this.lit.add(m);
    m.addEventListener('dispose', () => this.lit.delete(m));
    this.onCreate?.(m);
    return m;
  }

  /** Gold ink: unlit, brighter than white so the bloom catches it. */
  ink(color: number, intensity = 2.2, side: Side = DoubleSide): MeshBasicMaterial {
    const m = new MeshBasicMaterial({ color, side, fog: false, toneMapped: false });
    m.color.multiplyScalar(intensity);
    return this.patch(m, false);
  }

  /** The sky dome: a vertical gradient that meets the fog at the horizon, with a soft sun. */
  sky(top: number, horizon: number): ShaderMaterial {
    const u = this.uniforms;
    return new ShaderMaterial({
      side: BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
      uniforms: {
        uTop: { value: new Color(top) },
        uHorizon: { value: new Color(horizon) },
        uSunDir: u.uSunDir,
        uSunColor: u.uSunColor,
        uRestored: u.uRestored,
        uFadeColor: u.uFadeColor,
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          vec4 p = projectionMatrix * viewMatrix * vec4(position + cameraPosition, 1.0);
          gl_Position = p.xyww;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uTop;
        uniform vec3 uHorizon;
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        uniform float uRestored;
        uniform vec3 uFadeColor;
        varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          float t = pow(clamp(d.y, 0.0, 1.0), 0.55);
          vec3 col = mix(uHorizon, uTop, t);
          float s = max(dot(d, uSunDir), 0.0);
          col += uSunColor * (pow(s, 24.0) * 0.35 + pow(s, 4.0) * 0.12);
          // Below the horizon the sky sinks into the haze.
          col = mix(col, uHorizon * 0.92, smoothstep(0.0, -0.25, d.y));
          // The sky itself is a little washed out until the land is restored.
          float l = dot(col, vec3(0.299, 0.587, 0.114));
          col = mix(mix(vec3(l), uFadeColor * (0.4 + l), 0.35), col, 0.45 + 0.55 * uRestored);
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
  }

  /** Adds the sweep and the fog to a built-in material. */
  patch<T extends Material>(m: T, restore: boolean): T {
    const u = this.uniforms;
    m.defines = { ...(m.defines ?? {}), OTI_FOG: this.fogLevel };
    if (restore) m.defines.OTI_RESTORE = 1;
    const prior = m.onBeforeCompile.bind(m);
    m.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms, renderer) => {
      prior(shader, renderer);
      Object.assign(shader.uniforms, u);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vOtiWorld;')
        .replace(
          '#include <project_vertex>',
          /* glsl */ `#include <project_vertex>
          vec4 otiWp = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            otiWp = instanceMatrix * otiWp;
          #endif
          vOtiWorld = (modelMatrix * otiWp).xyz;`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>\nvarying vec3 vOtiWorld;\n${FOG_GLSL}\n#ifdef OTI_RESTORE\n${SWEEP_GLSL}\n#endif`,
        )
        .replace(
          '#include <opaque_fragment>',
          /* glsl */ `#include <opaque_fragment>
          #ifdef OTI_RESTORE
            gl_FragColor.rgb = otiRestore(gl_FragColor.rgb, vOtiWorld);
          #endif
          gl_FragColor.rgb = otiFog(gl_FragColor.rgb, vOtiWorld);`,
        );
    };
    const key = `oti:${m.type}:${restore ? 1 : 0}`;
    m.customProgramCacheKey = () => key;
    this.patched.add(m);
    m.addEventListener('dispose', () => this.patched.delete(m));
    return m;
  }

  /**
   * Starts a restoration sweep: color spreads from `center` to `radius` over `seconds`.
   * Sweeps stay where they end; when all slots are used the oldest is replaced.
   */
  sweep(x: number, y: number, z: number, radius: number, seconds = 1.6): void {
    const i = this.nextSweep;
    this.nextSweep = (i + 1) % MAX_SWEEPS;
    (this.uniforms.uSweep.value[i] as Vector4).set(x, y, z, 0.001);
    this.sweepStart[i] = this.uniforms.uTime.value;
    this.sweepDur[i] = Math.max(0.05, seconds);
    this.sweepMax[i] = radius;
  }

  /** Restores (1) or forgets (0) the whole world over `seconds`. */
  restoreAll(target: number, seconds = 1.5): void {
    this.restoredTarget = clamp01(target);
    this.restoredRate = seconds <= 0 ? Infinity : 1 / seconds;
    if (seconds <= 0) this.uniforms.uRestored.value = this.restoredTarget;
  }

  /** Removes every sweep at once. */
  clearSweeps(): void {
    for (let i = 0; i < MAX_SWEEPS; i++) {
      (this.uniforms.uSweep.value[i] as Vector4).w = 0;
      this.uniforms.uSweepGlow.value[i] = 0;
      this.sweepStart[i] = -1;
    }
  }

  update(dt: number): void {
    const u = this.uniforms;
    u.uTime.value += dt;
    const now = u.uTime.value;
    for (let i = 0; i < MAX_SWEEPS; i++) {
      const start = this.sweepStart[i] as number;
      if (start < 0) continue;
      const t = (now - start) / (this.sweepDur[i] as number);
      (u.uSweep.value[i] as Vector4).w = (this.sweepMax[i] as number) * easeOut(t);
      // The wavefront burns bright while moving and cools just after it stops.
      u.uSweepGlow.value[i] = t < 1 ? 1 : Math.max(0, 1 - (t - 1) * 2.5);
      if (t > 1.4) this.sweepStart[i] = -1;
    }
    const r = u.uRestored.value;
    if (r !== this.restoredTarget) {
      const step = this.restoredRate * dt;
      u.uRestored.value =
        Math.abs(this.restoredTarget - r) <= step
          ? this.restoredTarget
          : r + Math.sign(this.restoredTarget - r) * step;
    }
  }
}
