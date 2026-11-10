// Letters as physical things (DESIGN: "Letters are physical things in the world").
// LetterAtlas draws every glyph once into one texture; LetterField shows up to N letters in one
// draw call, each with its own place, size, color and glow. The VFX kit breaks letters into
// fragments using the same atlas.

import {
  CanvasTexture,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  Vector3,
  type IUniform,
} from 'three';
import { FOG_GLSL, type MaterialKit } from './materials';
import { colorNumber } from './palette';
import { FX_LAYER } from './postfx';

export const HEBREW_LETTERS = 'אבגדהוזחטיכךלמםנןסעפףצץקרשת';
const LATIN = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const OTHER = '0123456789.,;:!?\'"-()/';
export const DEFAULT_GLYPHS = HEBREW_LETTERS + LATIN + OTHER;

const CELL = 100;
const GRID = 10;
const DISPLAY_FONT = '"Frank Ruhl Libre", "Noto Sans Hebrew", serif';

export class LetterAtlas {
  readonly texture: CanvasTexture;
  /** u, v, width, height of each glyph's cell in texture space. */
  private readonly rects = new Map<string, readonly [number, number, number, number]>();
  private readonly fallback: readonly [number, number, number, number] = [0, 0, 0, 0];

  private constructor(glyphs: string, doc: Document) {
    const size = CELL * GRID;
    const canvas = doc.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const g = canvas.getContext('2d');
    const chars = Array.from(new Set(Array.from(glyphs))).slice(0, GRID * GRID);
    if (g) {
      g.clearRect(0, 0, size, size);
      g.font = `700 ${Math.round(CELL * 0.72)}px ${DISPLAY_FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      // Pure white: the shader gives each letter its color.
      g.fillStyle = 'white';
      chars.forEach((ch, i) => {
        const cx = (i % GRID) * CELL + CELL / 2;
        const cy = Math.floor(i / GRID) * CELL + CELL / 2;
        g.fillText(ch, cx, cy + CELL * 0.04);
      });
    }
    chars.forEach((ch, i) => {
      const col = i % GRID;
      const row = Math.floor(i / GRID);
      this.rects.set(ch, [col / GRID, 1 - (row + 1) / GRID, 1 / GRID, 1 / GRID]);
    });
    this.texture = new CanvasTexture(canvas);
    this.texture.minFilter = LinearMipmapLinearFilter;
    this.texture.magFilter = LinearFilter;
    this.texture.anisotropy = 4;
  }

  /** Waits for the display font (bundled, no network), then draws the atlas. */
  static async create(glyphs = DEFAULT_GLYPHS, doc: Document = document): Promise<LetterAtlas> {
    try {
      await doc.fonts.load(`700 72px ${DISPLAY_FONT}`, 'אa');
    } catch {
      // A missing font only means a plainer letter shape; the game still runs.
    }
    return new LetterAtlas(glyphs, doc);
  }

  rect(ch: string): readonly [number, number, number, number] {
    return this.rects.get(ch) ?? this.fallback;
  }

  has(ch: string): boolean {
    return this.rects.has(ch);
  }

  dispose(): void {
    this.texture.dispose();
  }
}

/** Shared by the letter field and the fragments: which way "right" and "up" are on screen. */
export interface Billboard {
  uRight: IUniform<Vector3>;
  uUp: IUniform<Vector3>;
}

const FIELD_VERT = /* glsl */ `
attribute vec3 aPos;
attribute vec4 aRect;
attribute vec4 aLook; // rgb color, a size
uniform vec3 uRight;
uniform vec3 uUp;
varying vec2 vUv;
varying vec3 vColor;
varying vec3 vWorld;
void main() {
  vUv = aRect.xy + uv * aRect.zw;
  vColor = aLook.rgb;
  vWorld = aPos + (uRight * position.x + uUp * position.y) * aLook.a;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;

const FIELD_FRAG = /* glsl */ `
uniform sampler2D uAtlas;
uniform vec3 uOutline;
varying vec2 vUv;
varying vec3 vColor;
varying vec3 vWorld;
${FOG_GLSL}
void main() {
  float a = texture2D(uAtlas, vUv).a;
  // A dark rim keeps the text readable against any sky (DESIGN: "The text is the hero").
  const float o = ${(0.028 / GRID).toFixed(5)};
  float rim = max(
    max(texture2D(uAtlas, vUv + vec2(o, 0.0)).a, texture2D(uAtlas, vUv - vec2(o, 0.0)).a),
    max(texture2D(uAtlas, vUv + vec2(0.0, o)).a, texture2D(uAtlas, vUv - vec2(0.0, o)).a)
  );
  rim = max(
    rim,
    max(
      max(texture2D(uAtlas, vUv + vec2(o, o) * 0.7).a, texture2D(uAtlas, vUv - vec2(o, o) * 0.7).a),
      max(texture2D(uAtlas, vUv + vec2(o, -o) * 0.7).a, texture2D(uAtlas, vUv - vec2(o, -o) * 0.7).a)
    )
  );
  float alpha = max(a, rim * 0.85);
  if (alpha < 0.02) discard;
  vec3 col = mix(uOutline, vColor, a);
  gl_FragColor = vec4(otiFog(col, vWorld), alpha);
}`;

/** Up to `capacity` letters in one draw call. Letters face the camera unless a plane is set. */
export class LetterField {
  readonly mesh: Mesh<InstancedBufferGeometry, ShaderMaterial>;
  private readonly pos: InstancedBufferAttribute;
  private readonly rect: InstancedBufferAttribute;
  private readonly look: InstancedBufferAttribute;
  private readonly color = new Color();
  private dirty = false;

  constructor(
    private readonly atlas: LetterAtlas,
    kit: MaterialKit,
    billboard: Billboard,
    readonly capacity: number,
    /** Color of the thin rim around each letter (dark ink by default). */
    outline = colorNumber('dark', 'bg'),
  ) {
    const quad = new PlaneGeometry(1, 1);
    const geo = new InstancedBufferGeometry();
    geo.index = quad.index;
    geo.setAttribute('position', quad.getAttribute('position'));
    geo.setAttribute('uv', quad.getAttribute('uv'));
    this.pos = new InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    this.rect = new InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
    this.look = new InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
    for (const a of [this.pos, this.rect, this.look]) a.setUsage(DynamicDrawUsage);
    geo.setAttribute('aPos', this.pos);
    geo.setAttribute('aRect', this.rect);
    geo.setAttribute('aLook', this.look);
    geo.instanceCount = capacity;
    const u = kit.uniforms;
    this.mesh = new Mesh(
      geo,
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        defines: { OTI_FOG: 1 },
        uniforms: {
          uAtlas: { value: atlas.texture },
          uOutline: { value: new Color(outline) },
          uRight: billboard.uRight,
          uUp: billboard.uUp,
          uFogColor: u.uFogColor,
          uFogParams: u.uFogParams,
          uSunDir: u.uSunDir,
          uSunColor: u.uSunColor,
        },
        vertexShader: FIELD_VERT,
        fragmentShader: FIELD_FRAG,
      }),
    );
    this.mesh.frustumCulled = false;
    this.mesh.layers.set(FX_LAYER);
    this.mesh.renderOrder = 5;
  }

  /** Shows letter `i`. `intensity` above 1 makes it glow (gold ink blooms). */
  set(
    i: number,
    ch: string,
    x: number,
    y: number,
    z: number,
    size: number,
    color: number,
    intensity = 1,
  ): void {
    if (i < 0 || i >= this.capacity) return;
    const r = this.atlas.rect(ch);
    this.pos.setXYZ(i, x, y, z);
    this.rect.setXYZW(i, r[0], r[1], r[2], r[3]);
    this.color.setHex(color).multiplyScalar(intensity);
    this.look.setXYZW(i, this.color.r, this.color.g, this.color.b, size);
    this.dirty = true;
  }

  move(i: number, x: number, y: number, z: number): void {
    this.pos.setXYZ(i, x, y, z);
    this.dirty = true;
  }

  tint(i: number, color: number, intensity = 1): void {
    this.color.setHex(color).multiplyScalar(intensity);
    this.look.setXYZ(i, this.color.r, this.color.g, this.color.b);
    this.dirty = true;
  }

  hide(i: number): void {
    this.look.setW(i, 0);
    this.dirty = true;
  }

  /** Uploads changes. Call once per frame after moving letters. */
  commit(): void {
    if (!this.dirty) return;
    this.pos.needsUpdate = true;
    this.rect.needsUpdate = true;
    this.look.needsUpdate = true;
    this.dirty = false;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
