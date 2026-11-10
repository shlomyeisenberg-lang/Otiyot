// Quality presets (ARCHITECTURE section 7) and the rule that picks one from the first-run
// benchmark. Pure data and logic: no DOM, no Three.js.

export const QUALITY_NAMES = ['low', 'medium', 'high', 'ultra'] as const;
export type QualityName = (typeof QUALITY_NAMES)[number];
/** What a player can choose: a fixed preset, or 'auto' (use the benchmark's pick). */
export type QualityChoice = 'auto' | QualityName;

export type ShadowMode = 'blob' | 'single' | 'cascaded';

export interface QualityPreset {
  name: QualityName;
  /** Upper limit on device pixel ratio. */
  pixelRatio: number;
  /** MSAA samples on the main buffer (0 = off). */
  msaa: number;
  shadows: ShadowMode;
  shadowMapSize: number;
  bloom: boolean;
  /** Bloom is computed on a blurred mip chain; fewer levels is cheaper and tighter. */
  bloomLevels: number;
  godRays: boolean;
  godRaySamples: number;
  ssao: boolean;
  chromaticAberration: boolean;
  /** Multiplier on every particle count a scene asks for. */
  particles: number;
  /** Pool sizes for the VFX kit. */
  maxParticles: number;
  maxFragments: number;
  /** Fog: 0 = distance only, 1 = + height falloff, 2 = + sun in-scatter. */
  fog: 0 | 1 | 2;
}

export const QUALITY: Readonly<Record<QualityName, QualityPreset>> = {
  low: {
    name: 'low',
    pixelRatio: 1,
    msaa: 0,
    shadows: 'blob',
    shadowMapSize: 0,
    bloom: true,
    bloomLevels: 4,
    godRays: false,
    godRaySamples: 0,
    ssao: false,
    chromaticAberration: false,
    particles: 0.4,
    maxParticles: 1024,
    maxFragments: 128,
    fog: 0,
  },
  medium: {
    name: 'medium',
    pixelRatio: 1.25,
    msaa: 2,
    shadows: 'single',
    shadowMapSize: 1024,
    bloom: true,
    bloomLevels: 5,
    godRays: true,
    godRaySamples: 24,
    ssao: false,
    chromaticAberration: true,
    particles: 0.7,
    maxParticles: 2048,
    maxFragments: 256,
    fog: 1,
  },
  high: {
    name: 'high',
    pixelRatio: 1.5,
    msaa: 4,
    shadows: 'cascaded',
    shadowMapSize: 1024,
    bloom: true,
    bloomLevels: 6,
    godRays: true,
    godRaySamples: 40,
    ssao: true,
    chromaticAberration: true,
    particles: 1,
    maxParticles: 4096,
    maxFragments: 384,
    fog: 2,
  },
  ultra: {
    name: 'ultra',
    pixelRatio: 2,
    msaa: 4,
    shadows: 'cascaded',
    shadowMapSize: 2048,
    bloom: true,
    bloomLevels: 7,
    godRays: true,
    godRaySamples: 60,
    ssao: true,
    chromaticAberration: true,
    particles: 1.5,
    maxParticles: 8192,
    maxFragments: 512,
    fog: 2,
  },
};

export function isQualityName(v: unknown): v is QualityName {
  return typeof v === 'string' && (QUALITY_NAMES as readonly string[]).includes(v);
}

/** The preset to run with: the player's fixed choice, else the benchmark's pick, else medium. */
export function resolveQuality(choice: QualityChoice, auto: QualityName | null): QualityName {
  return choice === 'auto' ? (auto ?? 'medium') : choice;
}

/** Benchmark length and warm-up (the first frames compile shaders and are not counted). */
export const BENCHMARK_SECONDS = 2;
export const BENCHMARK_WARMUP = 0.4;

/** Median of the frame times, in ms. Ignores zero and absurd samples. */
export function medianFrameMs(samples: readonly number[]): number {
  const ok = samples.filter((ms) => ms > 0.5 && ms < 1000).sort((a, b) => a - b);
  if (ok.length === 0) return Number.POSITIVE_INFINITY;
  const mid = ok.length >> 1;
  return ok.length % 2 ? (ok[mid] as number) : ((ok[mid - 1] as number) + (ok[mid] as number)) / 2;
}

/**
 * Picks a preset from frame times measured while running the **medium** preset.
 * A browser never draws faster than the screen, so "fast" means "holds the refresh rate with
 * room to spare", and that room is judged from how steady the frames are.
 *  - cannot hold ~50 fps on medium                  → low
 *  - holds 60 fps on medium, but not steadily       → medium
 *  - steady 60 fps (95% of frames under 18.5 ms)    → high
 *  - steady 100+ fps on a fast screen               → ultra
 */
export function pickPreset(samples: readonly number[]): QualityName {
  const median = medianFrameMs(samples);
  if (!Number.isFinite(median)) return 'medium';
  if (median > 20) return 'low';
  const ok = samples.filter((ms) => ms > 0.5 && ms < 1000).sort((a, b) => a - b);
  const p95 = ok[Math.min(ok.length - 1, Math.floor(ok.length * 0.95))] as number;
  if (median <= 10 && p95 <= 12.5) return 'ultra';
  if (median <= 17.2 && p95 <= 18.5) return 'high';
  return 'medium';
}

/** Scene budgets on medium (ARCHITECTURE section 7). */
export const BUDGET = { drawCalls: 150, triangles: 300_000 } as const;

/** A particle count scaled by the preset, never below one. */
export function scaledCount(preset: QualityPreset, count: number): number {
  return Math.max(1, Math.round(count * preset.particles));
}
