// Hosts one 3D scene inside a screen (the title and the intro): makes the engine and the ink
// wipe, loads the scene, and frees everything when the screen goes. The 3D code is loaded on
// demand, so menus never pay for it. Throws NoWebGLError when the device cannot draw 3D; the
// screen then shows its plain fallback.

import type { Engine, GameScene, SceneManager } from '../engine';
import type { AppContext } from './app';
import { resolveTheme } from './theme';

export interface Stage3d {
  engine: Engine;
  manager: SceneManager;
  /** Frees the scene, the wipe and the engine. Returns the GPU objects still held (0 when clean). */
  dispose(): number;
}

export async function mountScene(
  ctx: AppContext,
  view: HTMLElement,
  scene: GameScene,
  seed = 1,
): Promise<Stage3d> {
  const eng = await import('../engine');
  const settings = ctx.profile.settings;
  const quality = eng.resolveQuality(settings.quality, ctx.saves.save.meta.autoQuality);
  const engine = await eng.Engine.create(view, {
    quality,
    reducedMotion: settings.reducedMotion,
  });
  const wipe = new eng.InkWipe();
  wipe.reducedMotion = settings.reducedMotion;
  view.append(wipe.el);
  const theme = resolveTheme(
    settings.theme,
    window.matchMedia?.('(prefers-color-scheme: dark)').matches === true,
  );
  const manager = new eng.SceneManager(engine, wipe, {
    theme,
    colorblind: settings.colorblind,
    audio: ctx.audio,
  });
  let done = false;
  const dispose = (): number => {
    if (done) return 0;
    done = true;
    manager.dispose();
    wipe.dispose();
    const left = engine.dispose();
    return left.geometries + left.textures + left.programs;
  };
  try {
    await manager.go(scene, {
      text: { next: () => ' ' },
      layout: ctx.profile.layout,
      difficulty: 0,
      seed,
    });
  } catch (err) {
    dispose();
    throw err;
  }
  return { engine, manager, dispose };
}

/** True when the error means "this device cannot draw 3D" rather than a bug. */
export async function isNoWebgl(err: unknown): Promise<boolean> {
  const eng = await import('../engine');
  return err instanceof eng.NoWebGLError;
}
