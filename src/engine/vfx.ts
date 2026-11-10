// The VFX kit: pooled, GPU-animated effects. Spawning writes a few numbers into a ring buffer;
// after that the graphics card moves everything, so `update()` does almost nothing and allocates
// nothing. One draw call per effect type, however many are alive.
//   particles (glow and ink) · ink trails · letter fragments · shockwaves · restoration sweep ·
//   screen flash and the combined "impact".

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  NormalBlending,
  PlaneGeometry,
  Points,
  ShaderMaterial,
  Vector3,
  type Blending,
  type IUniform,
  type Object3D,
  type PerspectiveCamera,
} from 'three';
import type { CameraRig } from './camera';
import type { LetterAtlas, Billboard } from './letters';
import type { FixedLoop } from './loop';
import type { MaterialKit } from './materials';
import { Rng } from './motion';
import type { PostFx } from './postfx';
import { scaledCount, type QualityPreset } from './quality';

/** How a burst of particles looks. Make these once (module constants), not per call. */
export interface BurstStyle {
  count: number;
  /** Start speed range, units per second. */
  speed: readonly [number, number];
  /** 0 = straight along the direction, 1 = every direction. */
  spread: number;
  life: readonly [number, number];
  size: readonly [number, number];
  /** Downward pull; negative floats upward. */
  gravity: number;
  color: Color;
  /** Particles pick a color between `color` and `color2`. */
  color2: Color;
  /** Random offset of the start point. */
  radius: number;
}

export function burstStyle(o: {
  count: number;
  speed?: readonly [number, number];
  spread?: number;
  life?: readonly [number, number];
  size?: readonly [number, number];
  gravity?: number;
  color: number;
  color2?: number;
  /** Brightness; above 1 blooms. */
  intensity?: number;
  radius?: number;
}): BurstStyle {
  const k = o.intensity ?? 1;
  return {
    count: o.count,
    speed: o.speed ?? [1, 4],
    spread: o.spread ?? 1,
    life: o.life ?? [0.5, 1.1],
    size: o.size ?? [0.08, 0.2],
    gravity: o.gravity ?? 3,
    color: new Color(o.color).multiplyScalar(k),
    color2: new Color(o.color2 ?? o.color).multiplyScalar(k),
    radius: o.radius ?? 0,
  };
}

const PARTICLE_VERT = /* glsl */ `
attribute vec3 aVel;
attribute vec2 aTime; // birth, life
attribute vec2 aLook; // size, gravity
attribute vec3 aColor;
uniform float uTime;
uniform float uScale;
uniform vec4 uFogParams;
varying vec4 vColor;
void main() {
  float age = uTime - aTime.x;
  float t = age / aTime.y;
  if (t < 0.0 || t >= 1.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    return;
  }
  // Closed-form motion with air drag: no per-frame work on the CPU.
  const float drag = 1.8;
  vec3 p = position + aVel * (1.0 - exp(-drag * age)) / drag;
  p.y -= 0.5 * aLook.y * age * age;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aLook.x * sqrt(1.0 - t) * uScale / max(0.1, -mv.z);
  float fog = uFogParams.x * length(mv.xyz);
  float a = smoothstep(0.0, 0.08, t) * (1.0 - t * t) * exp(-fog * fog);
  vColor = vec4(aColor, a);
}`;

const PARTICLE_FRAG = /* glsl */ `
varying vec4 vColor;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.12, d) * vColor.a;
  #ifdef ADDITIVE
    gl_FragColor = vec4(vColor.rgb * a, 1.0);
  #else
    gl_FragColor = vec4(vColor.rgb, a);
  #endif
}`;

class ParticlePool {
  readonly points: Points<BufferGeometry, ShaderMaterial>;
  private readonly pos: BufferAttribute;
  private readonly vel: BufferAttribute;
  private readonly time: BufferAttribute;
  private readonly look: BufferAttribute;
  private readonly col: BufferAttribute;
  private head = 0;
  private dirty = false;

  constructor(
    private readonly capacity: number,
    blending: Blending,
    uTime: IUniform<number>,
    uScale: IUniform<number>,
    uFogParams: IUniform,
  ) {
    const geo = new BufferGeometry();
    this.pos = new BufferAttribute(new Float32Array(capacity * 3), 3);
    this.vel = new BufferAttribute(new Float32Array(capacity * 3), 3);
    this.time = new BufferAttribute(new Float32Array(capacity * 2).fill(-1e6), 2);
    this.look = new BufferAttribute(new Float32Array(capacity * 2), 2);
    this.col = new BufferAttribute(new Float32Array(capacity * 3), 3);
    for (const a of [this.pos, this.vel, this.time, this.look, this.col]) {
      a.setUsage(DynamicDrawUsage);
    }
    // Life 1 with a birth long ago: every slot starts dead.
    for (let i = 0; i < capacity; i++) this.time.setXY(i, -1e6, 1);
    geo.setAttribute('position', this.pos);
    geo.setAttribute('aVel', this.vel);
    geo.setAttribute('aTime', this.time);
    geo.setAttribute('aLook', this.look);
    geo.setAttribute('aColor', this.col);
    this.points = new Points(
      geo,
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending,
        defines: blending === AdditiveBlending ? { ADDITIVE: 1 } : {},
        uniforms: { uTime, uScale, uFogParams },
        vertexShader: PARTICLE_VERT,
        fragmentShader: PARTICLE_FRAG,
      }),
    );
    this.points.frustumCulled = false;
    this.points.renderOrder = blending === AdditiveBlending ? 8 : 7;
  }

  spawn(
    now: number,
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    life: number,
    size: number,
    gravity: number,
    r: number,
    g: number,
    b: number,
  ): void {
    const i = this.head;
    this.head = (i + 1) % this.capacity;
    this.pos.setXYZ(i, x, y, z);
    this.vel.setXYZ(i, vx, vy, vz);
    this.time.setXY(i, now, life);
    this.look.setXY(i, size, gravity);
    this.col.setXYZ(i, r, g, b);
    this.dirty = true;
  }

  commit(): void {
    if (!this.dirty) return;
    this.pos.needsUpdate = true;
    this.vel.needsUpdate = true;
    this.time.needsUpdate = true;
    this.look.needsUpdate = true;
    this.col.needsUpdate = true;
    this.dirty = false;
  }

  dispose(): void {
    this.points.geometry.dispose();
    this.points.material.dispose();
  }
}

// ---------------------------------------------------------------------------------------------
// Ink trails: ribbons that follow a moving point and dry out behind it.

const TRAILS = 8;
const TRAIL_POINTS = 40;

/** A handle to one ribbon. Call `emit` every frame while drawing, then `stop`. */
export class Trail {
  active = false;
  /** Still accepting points. */
  drawing = false;
  width = 0.2;
  life = 0.8;
  readonly color = new Color();
  readonly px = new Float32Array(TRAIL_POINTS);
  readonly py = new Float32Array(TRAIL_POINTS);
  readonly pz = new Float32Array(TRAIL_POINTS);
  readonly born = new Float32Array(TRAIL_POINTS);
  count = 0;
  head = 0;

  constructor(private readonly clock: IUniform<number>) {}

  /** Moves the pen to a new point. */
  emit(x: number, y: number, z: number): void {
    if (!this.drawing) return;
    const now = this.clock.value;
    if (this.count > 0) {
      const last = (this.head + TRAIL_POINTS - 1) % TRAIL_POINTS;
      const dx = x - (this.px[last] as number);
      const dy = y - (this.py[last] as number);
      const dz = z - (this.pz[last] as number);
      // Close to the last point: just drag it along instead of adding another.
      if (dx * dx + dy * dy + dz * dz < 0.02 && this.count > 1) {
        this.px[last] = x;
        this.py[last] = y;
        this.pz[last] = z;
        this.born[last] = now;
        return;
      }
    }
    this.px[this.head] = x;
    this.py[this.head] = y;
    this.pz[this.head] = z;
    this.born[this.head] = now;
    this.head = (this.head + 1) % TRAIL_POINTS;
    if (this.count < TRAIL_POINTS) this.count += 1;
  }

  /** Lifts the pen: the ribbon dries out and its slot is reused. */
  stop(): void {
    this.drawing = false;
  }
}

class TrailMesh {
  readonly mesh: Mesh<BufferGeometry, ShaderMaterial>;
  readonly trails: Trail[] = [];
  private readonly pos: BufferAttribute;
  private readonly col: BufferAttribute;
  private readonly side = new Vector3();
  private readonly tan = new Vector3();
  private readonly toCam = new Vector3();

  constructor(clock: IUniform<number>) {
    const verts = TRAILS * TRAIL_POINTS * 2;
    const geo = new BufferGeometry();
    this.pos = new BufferAttribute(new Float32Array(verts * 3), 3);
    this.col = new BufferAttribute(new Float32Array(verts * 4), 4);
    this.pos.setUsage(DynamicDrawUsage);
    this.col.setUsage(DynamicDrawUsage);
    geo.setAttribute('position', this.pos);
    geo.setAttribute('aColor', this.col);
    const index: number[] = [];
    for (let t = 0; t < TRAILS; t++) {
      const base = t * TRAIL_POINTS * 2;
      for (let i = 0; i < TRAIL_POINTS - 1; i++) {
        const a = base + i * 2;
        index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
      this.trails.push(new Trail(clock));
    }
    geo.setIndex(index);
    this.mesh = new Mesh(
      geo,
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        vertexShader: /* glsl */ `
          attribute vec4 aColor;
          varying vec4 vColor;
          void main() {
            vColor = aColor;
            gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          varying vec4 vColor;
          void main() { gl_FragColor = vColor; }`,
      }),
    );
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
  }

  acquire(color: number, intensity: number, width: number, life: number): Trail {
    let t = this.trails.find((x) => !x.active);
    if (!t) {
      // All in use: take over the one that has been drying longest.
      t = this.trails.find((x) => !x.drawing) ?? (this.trails[0] as Trail);
    }
    t.active = true;
    t.drawing = true;
    t.count = 0;
    t.head = 0;
    t.width = width;
    t.life = life;
    t.color.setHex(color).multiplyScalar(intensity);
    return t;
  }

  update(now: number, camPos: Vector3): void {
    let any = false;
    for (let ti = 0; ti < TRAILS; ti++) {
      const t = this.trails[ti] as Trail;
      const base = ti * TRAIL_POINTS * 2;
      if (!t.active) continue;
      any = true;
      let alive = 0;
      const n = t.count;
      const first = (t.head + TRAIL_POINTS - n) % TRAIL_POINTS;
      for (let i = 0; i < TRAIL_POINTS; i++) {
        // Unused points collapse onto the newest one (zero-area triangles draw nothing).
        const k = i < n ? i : n - 1;
        const v = base + i * 2;
        if (n < 2) {
          this.pos.setXYZ(v, 0, -1e4, 0);
          this.pos.setXYZ(v + 1, 0, -1e4, 0);
          continue;
        }
        const p = (first + k) % TRAIL_POINTS;
        const q = (first + Math.min(n - 1, k + 1)) % TRAIL_POINTS;
        const o = (first + Math.max(0, k - 1)) % TRAIL_POINTS;
        const x = t.px[p] as number;
        const y = t.py[p] as number;
        const z = t.pz[p] as number;
        this.tan.set(
          (t.px[q] as number) - (t.px[o] as number),
          (t.py[q] as number) - (t.py[o] as number),
          (t.pz[q] as number) - (t.pz[o] as number),
        );
        this.toCam.set(camPos.x - x, camPos.y - y, camPos.z - z);
        this.side.crossVectors(this.tan, this.toCam);
        const len = this.side.length();
        if (len > 1e-6) this.side.divideScalar(len);
        const age = (now - (t.born[p] as number)) / t.life;
        const a = age >= 1 ? 0 : 1 - age;
        if (a > 0) alive += 1;
        // A brush stroke: thin where it starts, full in the middle, tapering at the pen.
        const along = n > 1 ? k / (n - 1) : 0;
        const w = t.width * 0.5 * Math.sin(Math.PI * Math.min(1, 0.15 + along * 0.85)) * (0.4 + 0.6 * a);
        this.pos.setXYZ(v, x + this.side.x * w, y + this.side.y * w, z + this.side.z * w);
        this.pos.setXYZ(v + 1, x - this.side.x * w, y - this.side.y * w, z - this.side.z * w);
        this.col.setXYZW(v, t.color.r, t.color.g, t.color.b, a);
        this.col.setXYZW(v + 1, t.color.r, t.color.g, t.color.b, a);
      }
      if (!t.drawing && alive === 0) {
        t.active = false;
        for (let i = 0; i < TRAIL_POINTS * 2; i++) this.pos.setXYZ(base + i, 0, -1e4, 0);
      }
    }
    if (any) {
      this.pos.needsUpdate = true;
      this.col.needsUpdate = true;
    }
    this.mesh.visible = any;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}

// ---------------------------------------------------------------------------------------------
// Letter fragments: a letter breaks into pieces of itself, which tumble and fall.

const FRAGMENT_VERT = /* glsl */ `
attribute vec3 aStart;
attribute vec3 aVel;
attribute vec4 aSpin; // axis, speed
attribute vec2 aTime; // birth, life
attribute vec4 aRect;
attribute vec4 aLook; // rgb, size
attribute vec2 aPart; // width and height of this piece as a share of the letter
uniform float uTime;
uniform vec3 uRight;
uniform vec3 uUp;
varying vec2 vUv;
varying vec4 vColor;
void main() {
  float age = uTime - aTime.x;
  float t = age / aTime.y;
  if (t < 0.0 || t >= 1.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  vUv = aRect.xy + uv * aRect.zw;
  vec3 local = (uRight * position.x * aPart.x + uUp * position.y * aPart.y) * aLook.a;
  // Rodrigues rotation about the piece's own axis.
  float ang = aSpin.w * age;
  vec3 k = aSpin.xyz;
  local = local * cos(ang) + cross(k, local) * sin(ang) + k * dot(k, local) * (1.0 - cos(ang));
  vec3 p = aStart + aVel * (1.0 - exp(-1.2 * age)) / 1.2 + local * (1.0 - t * t * 0.6);
  p.y -= 4.5 * age * age;
  vColor = vec4(aLook.rgb, 1.0 - smoothstep(0.65, 1.0, t));
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;

const FRAGMENT_FRAG = /* glsl */ `
uniform sampler2D uAtlas;
varying vec2 vUv;
varying vec4 vColor;
void main() {
  float a = texture2D(uAtlas, vUv).a * vColor.a;
  if (a < 0.03) discard;
  gl_FragColor = vec4(vColor.rgb, a);
}`;

class FragmentPool {
  readonly mesh: Mesh<InstancedBufferGeometry, ShaderMaterial>;
  private readonly attrs: InstancedBufferAttribute[];
  private readonly start: InstancedBufferAttribute;
  private readonly vel: InstancedBufferAttribute;
  private readonly spin: InstancedBufferAttribute;
  private readonly time: InstancedBufferAttribute;
  private readonly rect: InstancedBufferAttribute;
  private readonly look: InstancedBufferAttribute;
  private readonly part: InstancedBufferAttribute;
  private head = 0;
  private dirty = false;

  constructor(
    private readonly capacity: number,
    atlas: LetterAtlas,
    uTime: IUniform<number>,
    bb: Billboard,
  ) {
    const quad = new PlaneGeometry(1, 1);
    const geo = new InstancedBufferGeometry();
    geo.index = quad.index;
    geo.setAttribute('position', quad.getAttribute('position'));
    geo.setAttribute('uv', quad.getAttribute('uv'));
    const make = (size: number): InstancedBufferAttribute => {
      const a = new InstancedBufferAttribute(new Float32Array(capacity * size), size);
      a.setUsage(DynamicDrawUsage);
      return a;
    };
    this.start = make(3);
    this.vel = make(3);
    this.spin = make(4);
    this.time = make(2);
    this.rect = make(4);
    this.look = make(4);
    this.part = make(2);
    for (let i = 0; i < capacity; i++) this.time.setXY(i, -1e6, 1);
    this.attrs = [this.start, this.vel, this.spin, this.time, this.rect, this.look, this.part];
    geo.setAttribute('aStart', this.start);
    geo.setAttribute('aVel', this.vel);
    geo.setAttribute('aSpin', this.spin);
    geo.setAttribute('aTime', this.time);
    geo.setAttribute('aRect', this.rect);
    geo.setAttribute('aLook', this.look);
    geo.setAttribute('aPart', this.part);
    geo.instanceCount = capacity;
    this.mesh = new Mesh(
      geo,
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        uniforms: { uAtlas: { value: atlas.texture }, uTime, uRight: bb.uRight, uUp: bb.uUp },
        vertexShader: FRAGMENT_VERT,
        fragmentShader: FRAGMENT_FRAG,
      }),
    );
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 9;
  }

  spawn(
    now: number,
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    ax: number,
    ay: number,
    az: number,
    spin: number,
    life: number,
    u: number,
    v: number,
    w: number,
    h: number,
    partW: number,
    partH: number,
    size: number,
    c: Color,
  ): void {
    const i = this.head;
    this.head = (i + 1) % this.capacity;
    this.start.setXYZ(i, x, y, z);
    this.vel.setXYZ(i, vx, vy, vz);
    this.spin.setXYZW(i, ax, ay, az, spin);
    this.time.setXY(i, now, life);
    this.rect.setXYZW(i, u, v, w, h);
    this.look.setXYZW(i, c.r, c.g, c.b, size);
    this.part.setXY(i, partW, partH);
    this.dirty = true;
  }

  commit(): void {
    if (!this.dirty) return;
    for (const a of this.attrs) a.needsUpdate = true;
    this.dirty = false;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}

// ---------------------------------------------------------------------------------------------
// Shockwaves: rings of ink that race outward along the ground (or face the camera).

const WAVES = 12;

const WAVE_VERT = /* glsl */ `
attribute vec4 aPlace; // center xyz, max radius
attribute vec3 aTime;  // birth, life, flat (1) or facing the camera (0)
attribute vec3 aColor;
uniform float uTime;
uniform vec3 uRight;
uniform vec3 uUp;
varying vec2 vUv;
varying vec4 vColor;
void main() {
  float t = (uTime - aTime.x) / aTime.y;
  if (t < 0.0 || t >= 1.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  float e = 1.0 - pow(1.0 - t, 3.0);
  float r = aPlace.w * e;
  vec3 a = mix(uRight, vec3(1.0, 0.0, 0.0), aTime.z);
  vec3 b = mix(uUp, vec3(0.0, 0.0, 1.0), aTime.z);
  vec3 p = aPlace.xyz + (a * position.x + b * position.y) * r * 2.0;
  vUv = uv * 2.0 - 1.0;
  vColor = vec4(aColor, (1.0 - t) * (1.0 - t));
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;

const WAVE_FRAG = /* glsl */ `
varying vec2 vUv;
varying vec4 vColor;
void main() {
  float d = length(vUv);
  // A bright leading edge with a soft wake behind it.
  float ring = smoothstep(0.62, 0.93, d) * (1.0 - smoothstep(0.93, 1.0, d));
  float a = (ring + smoothstep(0.2, 0.9, d) * (1.0 - step(0.93, d)) * 0.12) * vColor.a;
  gl_FragColor = vec4(vColor.rgb * a, 1.0);
}`;

class WavePool {
  readonly mesh: Mesh<InstancedBufferGeometry, ShaderMaterial>;
  private readonly place: InstancedBufferAttribute;
  private readonly time: InstancedBufferAttribute;
  private readonly col: InstancedBufferAttribute;
  private head = 0;
  private dirty = false;

  constructor(uTime: IUniform<number>, bb: Billboard) {
    const quad = new PlaneGeometry(1, 1);
    const geo = new InstancedBufferGeometry();
    geo.index = quad.index;
    geo.setAttribute('position', quad.getAttribute('position'));
    geo.setAttribute('uv', quad.getAttribute('uv'));
    this.place = new InstancedBufferAttribute(new Float32Array(WAVES * 4), 4);
    this.time = new InstancedBufferAttribute(new Float32Array(WAVES * 3), 3);
    this.col = new InstancedBufferAttribute(new Float32Array(WAVES * 3), 3);
    for (let i = 0; i < WAVES; i++) this.time.setXYZ(i, -1e6, 1, 1);
    for (const a of [this.place, this.time, this.col]) a.setUsage(DynamicDrawUsage);
    geo.setAttribute('aPlace', this.place);
    geo.setAttribute('aTime', this.time);
    geo.setAttribute('aColor', this.col);
    geo.instanceCount = WAVES;
    this.mesh = new Mesh(
      geo,
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        blending: AdditiveBlending,
        uniforms: { uTime, uRight: bb.uRight, uUp: bb.uUp },
        vertexShader: WAVE_VERT,
        fragmentShader: WAVE_FRAG,
      }),
    );
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
  }

  spawn(
    now: number,
    x: number,
    y: number,
    z: number,
    radius: number,
    seconds: number,
    flat: boolean,
    c: Color,
  ): void {
    const i = this.head;
    this.head = (i + 1) % WAVES;
    this.place.setXYZW(i, x, y, z, radius);
    this.time.setXYZ(i, now, seconds, flat ? 1 : 0);
    this.col.setXYZ(i, c.r, c.g, c.b);
    this.dirty = true;
  }

  commit(): void {
    if (!this.dirty) return;
    this.place.needsUpdate = true;
    this.time.needsUpdate = true;
    this.col.needsUpdate = true;
    this.dirty = false;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}

// ---------------------------------------------------------------------------------------------

export interface VfxDeps {
  root: Object3D;
  camera: PerspectiveCamera;
  materials: MaterialKit;
  post: PostFx;
  rig: CameraRig;
  loop: FixedLoop;
  atlas: LetterAtlas;
}

export class VfxKit {
  /** Camera-facing basis, shared with letter fields. */
  readonly billboard: Billboard = {
    uRight: { value: new Vector3(1, 0, 0) },
    uUp: { value: new Vector3(0, 1, 0) },
  };
  /** 0..1 from settings: reduce motion turns hit-stop off with the shake. */
  hitStopScale = 1;

  private readonly uScale: IUniform<number> = { value: 600 };
  private glow: ParticlePool;
  private ink: ParticlePool;
  private fragments: FragmentPool;
  private readonly waves: WavePool;
  private readonly trails: TrailMesh;
  private preset: QualityPreset;
  private readonly rng = new Rng(7);
  private readonly c = new Color();
  private readonly dir = new Vector3();
  private readonly inkColor = new Color();

  constructor(
    private readonly d: VfxDeps,
    preset: QualityPreset,
  ) {
    this.preset = preset;
    const u = d.materials.uniforms;
    this.glow = new ParticlePool(preset.maxParticles, AdditiveBlending, u.uTime, this.uScale, u.uFogParams);
    this.ink = new ParticlePool(preset.maxParticles >> 1, NormalBlending, u.uTime, this.uScale, u.uFogParams);
    this.fragments = new FragmentPool(preset.maxFragments, d.atlas, u.uTime, this.billboard);
    this.waves = new WavePool(u.uTime, this.billboard);
    this.trails = new TrailMesh(u.uTime);
    d.root.add(this.glow.points, this.ink.points, this.fragments.mesh, this.waves.mesh, this.trails.mesh);
  }

  /** Rebuilds the pools at a new size when the quality preset changes. */
  setQuality(preset: QualityPreset): void {
    if (preset.maxParticles === this.preset.maxParticles) {
      this.preset = preset;
      return;
    }
    const u = this.d.materials.uniforms;
    this.d.root.remove(this.glow.points, this.ink.points, this.fragments.mesh);
    this.glow.dispose();
    this.ink.dispose();
    this.fragments.dispose();
    this.preset = preset;
    this.glow = new ParticlePool(preset.maxParticles, AdditiveBlending, u.uTime, this.uScale, u.uFogParams);
    this.ink = new ParticlePool(preset.maxParticles >> 1, NormalBlending, u.uTime, this.uScale, u.uFogParams);
    this.fragments = new FragmentPool(preset.maxFragments, this.d.atlas, u.uTime, this.billboard);
    this.d.root.add(this.glow.points, this.ink.points, this.fragments.mesh);
  }

  /** Point sprites are sized in pixels: tell the kit the drawing height and the lens. */
  setViewport(heightPx: number, fovDeg: number): void {
    this.uScale.value = heightPx / (2 * Math.tan((fovDeg * Math.PI) / 360));
  }

  private get now(): number {
    return this.d.materials.uniforms.uTime.value;
  }

  /**
   * A burst of particles at a point, thrown along (dx, dy, dz). `ink` particles are opaque
   * droplets; the default glows and blooms. The count follows the quality preset.
   */
  burst(style: BurstStyle, x: number, y: number, z: number, dx = 0, dy = 1, dz = 0, ink = false): void {
    const pool = ink ? this.ink : this.glow;
    const n = scaledCount(this.preset, style.count);
    const r = this.rng;
    const now = this.now;
    for (let i = 0; i < n; i++) {
      // A random direction, pulled toward the burst direction by (1 - spread).
      this.dir.set(r.signed(), r.signed(), r.signed());
      if (this.dir.lengthSq() < 1e-4) this.dir.set(0, 1, 0);
      this.dir.normalize().multiplyScalar(style.spread);
      this.dir.x += dx * (1 - style.spread * 0.5);
      this.dir.y += dy * (1 - style.spread * 0.5);
      this.dir.z += dz * (1 - style.spread * 0.5);
      this.dir.normalize().multiplyScalar(r.range(style.speed[0], style.speed[1]));
      this.c.copy(style.color).lerp(style.color2, r.next());
      pool.spawn(
        now,
        x + r.signed() * style.radius,
        y + r.signed() * style.radius,
        z + r.signed() * style.radius,
        this.dir.x,
        this.dir.y,
        this.dir.z,
        r.range(style.life[0], style.life[1]),
        r.range(style.size[0], style.size[1]),
        style.gravity,
        this.c.r,
        this.c.g,
        this.c.b,
      );
    }
  }

  /** Starts an ink ribbon. Keep the handle, `emit` points while it moves, then `stop`. */
  trail(color: number, width = 0.22, life = 0.9, intensity = 1): Trail {
    return this.trails.acquire(color, intensity, width, life);
  }

  /**
   * Breaks the letter `ch` (standing at x, y, z, `size` tall, facing the camera) into pieces of
   * itself. `force` is how hard they fly; (dx, dy, dz) pushes them one way.
   */
  shatter(
    ch: string,
    x: number,
    y: number,
    z: number,
    size: number,
    color: number,
    intensity = 1,
    force = 3,
    dx = 0,
    dy = 0,
    dz = 0,
  ): void {
    const rect = this.d.atlas.rect(ch);
    if (rect[2] === 0) return;
    const cols = this.preset.particles < 0.6 ? 2 : 3;
    const rows = 3;
    const right = this.billboard.uRight.value;
    const up = this.billboard.uUp.value;
    const r = this.rng;
    const now = this.now;
    this.c.setHex(color).multiplyScalar(intensity);
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        // Where this piece sits inside the letter, -0.5..0.5.
        const ox = (cx + 0.5) / cols - 0.5;
        const oy = (cy + 0.5) / rows - 0.5;
        const px = x + (right.x * ox + up.x * oy) * size;
        const py = y + (right.y * ox + up.y * oy) * size;
        const pz = z + (right.z * ox + up.z * oy) * size;
        const out = force * r.range(0.6, 1.3);
        this.dir.set(r.signed(), r.signed(), r.signed()).normalize();
        this.fragments.spawn(
          now,
          px,
          py,
          pz,
          (right.x * ox + up.x * oy) * out * 2.4 + dx * force + r.signed() * 0.6,
          (right.y * ox + up.y * oy) * out * 2.4 + dy * force + r.range(1.2, 3.2),
          (right.z * ox + up.z * oy) * out * 2.4 + dz * force + r.signed() * 0.6,
          this.dir.x,
          this.dir.y,
          this.dir.z,
          r.range(3, 9) * (r.next() < 0.5 ? -1 : 1),
          r.range(0.8, 1.4),
          rect[0] + (cx / cols) * rect[2],
          rect[1] + (cy / rows) * rect[3],
          rect[2] / cols,
          rect[3] / rows,
          1 / cols,
          1 / rows,
          size,
          this.c,
        );
      }
    }
  }

  /** A ring racing outward. `flat` lies on the ground; otherwise it faces the camera. */
  shockwave(x: number, y: number, z: number, radius: number, color: number, seconds = 0.7, flat = true, intensity = 1.6): void {
    this.c.setHex(color).multiplyScalar(intensity);
    this.waves.spawn(this.now, x, y, z, radius, seconds, flat, this.c);
  }

  /**
   * The signature effect: color returns to the world from a point. Starts the sweep in every
   * world material and sends a gold ring along the ground with it.
   */
  restore(x: number, y: number, z: number, radius: number, seconds = 1.6): void {
    this.d.materials.sweep(x, y, z, radius, seconds);
    this.inkColor.copy(this.d.materials.uniforms.uInkColor.value);
    this.waves.spawn(this.now, x, y + 0.06, z, radius, seconds * 1.05, true, this.inkColor.multiplyScalar(1.4));
  }

  /** A soft full-screen flash (scaled by the player's flash setting). */
  flash(color: number, strength = 0.3, seconds = 0.25): void {
    this.d.post.flash(color, strength, seconds);
  }

  /**
   * Everything that makes a hit land, scaled by `strength` 0..1: a beat of hit-stop, camera
   * shake, the chromatic pulse and a touch of flash.
   */
  impact(strength: number, flashColor = 0xffffff): void {
    const s = strength < 0 ? 0 : strength > 1 ? 1 : strength;
    if (this.hitStopScale > 0) this.d.loop.hitStop((0.035 + 0.075 * s) * this.hitStopScale, 0.05);
    this.d.rig.shake(0.25 + 0.55 * s);
    this.d.post.pulseChroma(0.35 + 0.65 * s);
    if (s > 0.3) this.d.post.flash(flashColor, 0.1 + 0.18 * s, 0.18);
  }

  /** Per frame (real time): camera basis, trails and buffer uploads. */
  update(): void {
    const e = this.d.camera.matrixWorld.elements;
    this.billboard.uRight.value.set(e[0] as number, e[1] as number, e[2] as number);
    this.billboard.uUp.value.set(e[4] as number, e[5] as number, e[6] as number);
    this.trails.update(this.now, this.d.camera.position);
    this.glow.commit();
    this.ink.commit();
    this.fragments.commit();
    this.waves.commit();
  }

  dispose(): void {
    this.d.root.remove(this.glow.points, this.ink.points, this.fragments.mesh, this.waves.mesh, this.trails.mesh);
    this.glow.dispose();
    this.ink.dispose();
    this.fragments.dispose();
    this.waves.dispose();
    this.trails.dispose();
  }
}
