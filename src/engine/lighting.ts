// Atmosphere: the sky, the one hero light, soft fill, fog and shadows of a scene. A scene hands
// over a small palette and gets all of it, at whatever quality the machine runs:
//   low    → blob shadows (soft dark discs under registered objects)
//   medium → one sun shadow map that follows the action
//   high+  → three cascaded sun shadow maps (sharp near the camera, soft far away)

import { CSM } from 'three/addons/csm/CSM.js';
import {
  CircleGeometry,
  Color,
  DirectionalLight,
  DynamicDrawUsage,
  HemisphereLight,
  InstancedMesh,
  Matrix4,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  type Material,
  type Object3D,
  type PerspectiveCamera,
  type Scene,
  type WebGLRenderer,
} from 'three';
import type { MaterialKit } from './materials';
import { FX_LAYER } from './postfx';
import type { QualityPreset, ShadowMode } from './quality';

/** The small palette every scene defines in its own folder (DESIGN: "Color tokens"). */
export interface ScenePalette {
  skyTop: number;
  skyHorizon: number;
  /** The hero light. */
  sun: number;
  sunIntensity: number;
  /** Direction the sun shines FROM (any length). */
  sunFrom: readonly [number, number, number];
  /** Fill light from the sky and bounced from the ground. */
  fillSky: number;
  fillGround: number;
  fillIntensity: number;
  fog: number;
  /** 0.004 is a clear day, 0.03 is thick. */
  fogDensity: number;
  /** Height of the fog floor and how fast the mist thins above it. */
  fogBase: number;
  fogFalloff: number;
  /** 0..1: how strongly fog facing the sun takes its color. */
  inscatter: number;
  /** The grey of forgotten things and the gold of the restoring wavefront (theme tokens). */
  fade: number;
  ink: number;
}

const MAX_BLOBS = 32;
const SUN_DISTANCE = 380;

interface BlobCaster {
  obj: Object3D;
  radius: number;
}

export class Atmosphere {
  readonly sunDir = new Vector3(0.4, 0.8, 0.4).normalize();
  /** The visible sun (also the source of the god rays). */
  readonly sunDisc: Mesh<CircleGeometry, ShaderMaterial>;
  /** Ground height under a point, for blob shadows. Scenes with hills replace it. */
  groundAt: (x: number, z: number) => number = () => 0;

  private readonly sky: Mesh<SphereGeometry, ShaderMaterial>;
  private readonly hemi = new HemisphereLight(0xffffff, 0x888888, 1);
  private readonly sun = new DirectionalLight(0xffffff, 1);
  private readonly blobs: InstancedMesh<PlaneGeometry, ShaderMaterial>;
  private readonly casters: BlobCaster[] = [];
  private csm: CSM | null = null;
  private mode: ShadowMode = 'blob';
  private mapSize = 1024;
  private shadowRange = 26;
  private sunIntensity = 1;
  private readonly focus = new Vector3();
  private readonly tmp = new Vector3();
  private readonly mat = new Matrix4();
  private readonly hooks = new WeakMap<Material, Material['onBeforeCompile']>();

  constructor(
    private readonly scene: Scene,
    private readonly camera: PerspectiveCamera,
    private readonly renderer: WebGLRenderer,
    private readonly materials: MaterialKit,
  ) {
    this.sky = new Mesh(new SphereGeometry(1, 20, 12), materials.sky(0x88aadd, 0xddeeff));
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -10;
    this.sky.matrixAutoUpdate = false;

    this.sunDisc = new Mesh(
      new CircleGeometry(1, 24),
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        fog: false,
        toneMapped: false,
        uniforms: { uColor: { value: new Color(0xffffff) } },
        vertexShader: /* glsl */ `
          varying vec2 vP;
          void main() {
            vP = position.xy;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          varying vec2 vP;
          void main() {
            // A bright core melting into a soft halo: no hard edge to betray the low-poly disc.
            float r = length(vP);
            float a = smoothstep(1.0, 0.0, r);
            gl_FragColor = vec4(uColor * (0.25 + 0.75 * smoothstep(0.55, 0.2, r)), a * a);
          }`,
      }),
    );
    this.sunDisc.frustumCulled = false;
    this.sunDisc.renderOrder = -9;

    this.blobs = new InstancedMesh(
      new PlaneGeometry(2, 2).rotateX(-Math.PI / 2),
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv * 2.0 - 1.0;
            gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            float a = smoothstep(1.0, 0.15, length(vUv)) * 0.42;
            gl_FragColor = vec4(0.03, 0.02, 0.05, a);
          }`,
      }),
      MAX_BLOBS,
    );
    this.blobs.instanceMatrix.setUsage(DynamicDrawUsage);
    this.blobs.frustumCulled = false;
    this.blobs.count = 0;
    this.blobs.renderOrder = 1;

    for (const o of [this.sky, this.sunDisc, this.blobs]) o.layers.set(FX_LAYER);
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.04;
    scene.add(this.sky, this.sunDisc, this.hemi, this.sun, this.sun.target, this.blobs);
  }

  /** Applies a scene's palette: sky, lights, fog and the restoration colors. */
  setPalette(p: ScenePalette): void {
    const u = this.materials.uniforms;
    this.sunDir.set(p.sunFrom[0], p.sunFrom[1], p.sunFrom[2]).normalize();
    u.uSunDir.value.copy(this.sunDir);
    u.uSunColor.value.setHex(p.sun);
    u.uFogColor.value.setHex(p.fog);
    u.uFogParams.value.set(p.fogDensity, p.fogBase, p.fogFalloff, p.inscatter);
    u.uFadeColor.value.setHex(p.fade);
    u.uInkColor.value.setHex(p.ink);
    (this.sky.material.uniforms.uTop as { value: { setHex(h: number): void } }).value.setHex(
      p.skyTop,
    );
    (this.sky.material.uniforms.uHorizon as { value: { setHex(h: number): void } }).value.setHex(
      p.skyHorizon,
    );
    this.hemi.color.setHex(p.fillSky);
    this.hemi.groundColor.setHex(p.fillGround);
    this.hemi.intensity = p.fillIntensity;
    this.sun.color.setHex(p.sun);
    this.sunIntensity = p.sunIntensity;
    // Brighter than white, so the bloom and the god rays have something to hold on to.
    (this.sunDisc.material.uniforms.uColor as { value: Color }).value
      .setHex(p.sun)
      .multiplyScalar(6);
    this.applyLights();
  }

  /** How far around the action the single shadow map reaches (medium quality). */
  setShadowRange(range: number): void {
    this.shadowRange = range;
    this.fitSingle();
  }

  /** Follows `obj` with a blob shadow on low quality (real shadows need no registration). */
  addBlob(obj: Object3D, radius: number): void {
    if (this.casters.length < MAX_BLOBS) this.casters.push({ obj, radius });
  }

  removeBlob(obj: Object3D): void {
    const i = this.casters.findIndex((c) => c.obj === obj);
    if (i >= 0) this.casters.splice(i, 1);
  }

  /** Switches shadow technique for a quality preset. */
  setQuality(q: QualityPreset): void {
    this.teardownCsm();
    this.mode = q.shadows;
    this.mapSize = q.shadowMapSize;
    this.renderer.shadowMap.enabled = q.shadows !== 'blob';
    this.sun.castShadow = q.shadows === 'single';
    if (q.shadows === 'single') {
      this.sun.shadow.mapSize.set(q.shadowMapSize, q.shadowMapSize);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
      this.fitSingle();
    } else {
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    if (q.shadows === 'cascaded') this.setupCsm();
    this.blobs.visible = q.shadows === 'blob';
    this.applyLights();
  }

  private fitSingle(): void {
    const cam = this.sun.shadow.camera;
    const r = this.shadowRange;
    cam.left = -r;
    cam.right = r;
    cam.top = r;
    cam.bottom = -r;
    cam.near = 1;
    cam.far = 160;
    cam.updateProjectionMatrix();
  }

  private applyLights(): void {
    // With cascades the CSM's own lights replace the sun.
    this.sun.intensity = this.csm ? 0 : this.sunIntensity;
    this.sun.visible = !this.csm;
    if (this.csm) {
      for (const l of this.csm.lights) {
        l.color.copy(this.sun.color);
        l.intensity = this.sunIntensity;
        l.shadow.normalBias = 0.14;
      }
      this.csm.lightDirection.copy(this.sunDir).negate();
    }
  }

  private setupCsm(): void {
    this.csm = new CSM({
      camera: this.camera,
      parent: this.scene,
      cascades: 3,
      maxFar: 95,
      mode: 'practical',
      shadowMapSize: this.mapSize,
      shadowBias: -0.0012,
      lightDirection: this.sunDir.clone().negate(),
      lightIntensity: this.sunIntensity,
      lightMargin: 60,
      lightFar: 400,
    });
    this.csm.fade = true;
    for (const m of this.materials.lit) this.attachCsm(m);
    this.materials.onCreate = (m) => this.attachCsm(m);
  }

  private attachCsm(m: Material): void {
    if (!this.csm) return;
    const mine = m.onBeforeCompile;
    this.hooks.set(m, mine);
    this.csm.setupMaterial(m);
    const csmHook = m.onBeforeCompile;
    m.onBeforeCompile = (shader, renderer) => {
      csmHook.call(m, shader, renderer);
      mine.call(m, shader, renderer);
    };
    m.needsUpdate = true;
  }

  private teardownCsm(): void {
    if (!this.csm) return;
    this.materials.onCreate = null;
    this.csm.dispose();
    for (const m of this.materials.lit) {
      const mine = this.hooks.get(m);
      if (mine) m.onBeforeCompile = mine;
      m.needsUpdate = true;
    }
    for (const l of this.csm.lights) l.dispose();
    this.csm.remove();
    this.csm = null;
  }

  /**
   * Shows every object the atmosphere owns (or puts them back), so one warm-up frame uploads
   * them all and they are never mistaken for something a scene left behind.
   */
  warm(on: boolean): void {
    this.blobs.visible = on || this.mode === 'blob';
  }

  /** Call when the camera's projection changes (resize, field of view). */
  onCameraChange(): void {
    this.csm?.updateFrustums();
  }

  /** Per frame: keeps the sky, the sun and the shadows around the action at `focus`. */
  update(focus: Vector3): void {
    this.focus.copy(focus);
    const cam = this.camera;
    this.sunDisc.position.copy(cam.position).addScaledVector(this.sunDir, SUN_DISTANCE);
    this.sunDisc.scale.setScalar(SUN_DISTANCE * 0.075);
    this.sunDisc.quaternion.copy(cam.quaternion);

    if (this.mode === 'single') {
      // Snap the shadow box to whole texels so shadow edges do not swim as the camera moves.
      const texel = (this.shadowRange * 2) / this.mapSize;
      this.tmp.copy(focus);
      this.tmp.x = Math.round(this.tmp.x / texel) * texel;
      this.tmp.z = Math.round(this.tmp.z / texel) * texel;
      this.sun.target.position.copy(this.tmp);
      this.sun.position.copy(this.tmp).addScaledVector(this.sunDir, 70);
    } else if (this.mode === 'cascaded') {
      this.csm?.update();
    } else {
      let n = 0;
      for (let i = 0; i < this.casters.length; i++) {
        const c = this.casters[i] as BlobCaster;
        if (!c.obj.visible) continue;
        c.obj.getWorldPosition(this.tmp);
        const ground = this.groundAt(this.tmp.x, this.tmp.z);
        // The higher the object, the wider and fainter its shadow.
        const lift = Math.max(0, this.tmp.y - ground);
        const s = c.radius * (1 + lift * 0.18);
        this.mat.makeScale(s, 1, s);
        this.mat.setPosition(this.tmp.x, ground + 0.02, this.tmp.z);
        this.blobs.setMatrixAt(n++, this.mat);
      }
      this.blobs.count = n;
      this.blobs.instanceMatrix.needsUpdate = true;
    }
  }

  dispose(): void {
    this.teardownCsm();
    this.scene.remove(this.sky, this.sunDisc, this.hemi, this.sun, this.sun.target, this.blobs);
    this.sky.geometry.dispose();
    this.sky.material.dispose();
    this.sunDisc.geometry.dispose();
    this.sunDisc.material.dispose();
    this.blobs.geometry.dispose();
    this.blobs.material.dispose();
    this.blobs.dispose();
    this.sun.dispose();
    this.hemi.dispose();
    this.casters.length = 0;
  }
}
