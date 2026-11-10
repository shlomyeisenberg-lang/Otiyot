// Disposal tracking. Three.js never frees GPU memory by itself: every geometry, material,
// texture and render target must be disposed by hand. A Tracker remembers everything a scene or
// a kit creates and frees it all in one call, so "every scene disposes what it creates" is a
// habit and not a hunt.

import type { Object3D } from 'three';

export interface Disposable {
  dispose(): void;
}

function isDisposable(v: unknown): v is Disposable {
  return typeof v === 'object' && v !== null && typeof (v as Disposable).dispose === 'function';
}

/** The parts of a Three.js object that hold GPU memory. */
interface Renderable {
  geometry?: unknown;
  material?: unknown;
}

export class Tracker {
  private readonly items = new Set<Disposable>();

  /** Remembers one resource and returns it, so it can wrap a constructor call. */
  track<T extends Disposable>(item: T): T {
    this.items.add(item);
    return item;
  }

  /**
   * Remembers every geometry, material and texture under `root` (walks the whole subtree) and
   * returns the root.
   */
  trackObject<T extends Object3D>(root: T): T {
    root.traverse((obj) => {
      const r = obj as Renderable;
      if (isDisposable(r.geometry)) this.items.add(r.geometry);
      const mats = Array.isArray(r.material) ? r.material : [r.material];
      for (const m of mats) {
        if (!isDisposable(m)) continue;
        this.items.add(m);
        for (const value of Object.values(m)) {
          if (isTexture(value)) this.items.add(value);
        }
      }
      // InstancedMesh, SkinnedMesh and friends hold extra buffers and have their own dispose().
      if (isDisposable(obj)) this.items.add(obj);
    });
    return root;
  }

  get size(): number {
    return this.items.size;
  }

  /** Frees everything tracked. Safe to call twice. */
  dispose(): void {
    for (const item of this.items) item.dispose();
    this.items.clear();
  }
}

function isTexture(v: unknown): v is Disposable {
  return isDisposable(v) && (v as { isTexture?: boolean }).isTexture === true;
}

/** What the renderer still holds. All zero after a clean shutdown. */
export interface GpuCounts {
  geometries: number;
  textures: number;
  programs: number;
}

export function leaked(c: GpuCounts): number {
  return c.geometries + c.textures + c.programs;
}
