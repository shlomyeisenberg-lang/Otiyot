// The test range screen (#/range): hosts the engine and the range scene, with buttons for every
// effect, camera mode, animation and quality preset, and the performance overlay. Reached by
// address only; it is a tool for building scenes, not part of the game's menus.
// The 3D code is loaded on demand, so the menus never pay for it.

import { TypingSession } from '../../core';
import { learnedWordSource } from '../../learn';
import type { Engine, QualityChoice, QualityName, SceneManager } from '../../engine';
import type { RangeDemo, RangeScene } from '../../scenes/range';
import type { AppContext, Screen } from '../app';
import { button, keycap, status } from '../components';
import { h } from '../dom';
import type { MessageKey } from '../i18n';
import { resolveTheme } from '../theme';

const DEMO_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'] as const;
const DEMO_ORDER: readonly RangeDemo[] = [
  'sweep',
  'shockwave',
  'sparks',
  'ink',
  'trail',
  'shatter',
  'flash',
  'impact',
  'pushIn',
  'forget',
];
const CAMERAS = ['follow', 'rail', 'cockpit'] as const;
const ANIMS = ['write', 'hit', 'stagger', 'fall', 'cheer'] as const;
const QUALITIES: readonly QualityChoice[] = ['auto', 'low', 'medium', 'high', 'ultra'];

/** What the page exposes for the smoke test (and for a curious developer's console). */
interface RangeProbe {
  ready: boolean;
  failed: boolean;
  stats: Engine['stats'] | null;
  restored: number;
  word: string;
  /** GPU objects still held after the screen was closed; null while it is open. */
  leaked: number | null;
  /** What exactly was left, for debugging a leak. */
  left: { geometries: number; textures: number; programs: number } | null;
  sceneLeak: number;
  /** Runs the world forward without waiting for the clock (tests). */
  step: (seconds: number) => void;
}

declare global {
  interface Window {
    __otiyotRange?: RangeProbe;
  }
}

export function rangeScreen(ctx: AppContext): Screen {
  const t = ctx.i18n;
  const settings = ctx.profile.settings;
  const view = h('div', { class: 'range__view' });
  const hint = h('p', { class: 'range__hint', text: t.t('range.loading') });
  const live = h('p', { class: 'range__live', role: 'status', 'aria-live': 'polite' });
  const panel = h('aside', { class: 'range__panel', 'aria-label': t.t('range.title') });
  const el = h('section', { class: 'range', 'data-testid': 'range' }, view, panel, live);

  const probe: RangeProbe = {
    ready: false,
    failed: false,
    stats: null,
    restored: 0,
    word: '',
    leaked: null,
    left: null,
    sceneLeak: 0,
    step: (seconds) => engine?.simulate(seconds),
  };
  window.__otiyotRange = probe;

  let engine: Engine | null = null;
  let manager: SceneManager | null = null;
  let scene: RangeScene | null = null;
  let disposed = false;
  let camera = 0;
  let choice: QualityChoice = settings.quality;
  let cleanup: (() => void) | null = null;
  const pressed = new Map<string, HTMLButtonElement>();

  const group = (title: MessageKey, ...items: HTMLElement[]): HTMLElement =>
    h(
      'div',
      { class: 'range__group', role: 'group', 'aria-label': t.t(title) },
      h('h2', { class: 'range__label', text: t.t(title) }),
      h('div', { class: 'range__row' }, ...items),
    );

  const mark = (set: string, value: string): void => {
    for (const [key, b] of pressed) {
      if (key.startsWith(`${set}:`))
        b.setAttribute('aria-pressed', String(key === `${set}:${value}`));
    }
  };

  const pick = (set: string, value: string, label: string, onClick: () => void): HTMLElement => {
    const b = button({ label, small: true, variant: 'quiet', onClick });
    b.dataset.pick = `${set}:${value}`;
    b.setAttribute('aria-pressed', 'false');
    pressed.set(`${set}:${value}`, b);
    return b;
  };

  const runDemo = (name: RangeDemo): void => {
    scene?.demo(name);
    probe.restored = scene?.restoredStage ?? 0;
  };

  const setCamera = (i: number): void => {
    camera = (i + CAMERAS.length) % CAMERAS.length;
    const mode = CAMERAS[camera] as (typeof CAMERAS)[number];
    scene?.setCamera(mode);
    mark('camera', mode);
  };

  const setQuality = (q: QualityChoice): void => {
    choice = q;
    ctx.saves.update((p) => (p.settings.quality = q));
    const auto = ctx.saves.save.meta.autoQuality;
    engine?.setQuality(q === 'auto' ? (auto ?? 'medium') : q);
    mark('quality', q);
  };

  panel.append(
    h(
      'header',
      { class: 'range__head' },
      h('h1', { class: 'range__title', text: t.t('range.title') }),
      hint,
    ),
    group(
      'range.effects',
      ...DEMO_ORDER.map((name, i) => {
        const b = button({
          label: t.t(`range.demo.${name}`),
          small: true,
          variant: 'quiet',
          onClick: () => runDemo(name),
        });
        b.dataset.demo = name;
        b.prepend(keycap(DEMO_KEYS[i] as string, 'plain', 'sm'));
        return b;
      }),
    ),
    group(
      'range.camera',
      ...CAMERAS.map((mode, i) =>
        pick('camera', mode, t.t(`range.camera.${mode}`), () => setCamera(i)),
      ),
    ),
    group(
      'range.animations',
      ...ANIMS.map((name) =>
        pick('anim', name, t.t(`range.anim.${name}`), () => scene?.playAnimation(name)),
      ),
    ),
    group(
      'range.quality',
      ...QUALITIES.map((q) => pick('quality', q, t.t(`range.quality.${q}`), () => setQuality(q))),
    ),
  );
  mark('camera', 'follow');
  mark('quality', choice);

  const fail = (key: MessageKey): void => {
    probe.failed = true;
    hint.replaceChildren(status(t.t(key), 'warn'));
  };

  const boot = async (): Promise<void> => {
    const [eng, rangeMod] = await Promise.all([
      import('../../engine'),
      import('../../scenes/range'),
    ]);
    if (disposed) return;
    const auto = ctx.saves.save.meta.autoQuality;
    const quality: QualityName = eng.resolveQuality(choice, auto);
    try {
      engine = await eng.Engine.create(view, { quality, reducedMotion: settings.reducedMotion });
    } catch (err) {
      fail(err instanceof eng.NoWebGLError ? 'range.noWebgl' : 'range.failed');
      return;
    }
    if (disposed) {
      engine.dispose();
      return;
    }
    const wipe = new eng.InkWipe();
    wipe.reducedMotion = settings.reducedMotion;
    const perf = new eng.PerfOverlay({
      fps: t.t('range.perf.fps'),
      frame: t.t('range.perf.frame'),
      draws: t.t('range.perf.draws'),
      triangles: t.t('range.perf.triangles'),
      memory: t.t('range.perf.memory'),
      quality: t.t('range.perf.quality'),
    });
    view.append(wipe.el, perf.el);
    const theme = resolveTheme(
      settings.theme,
      window.matchMedia?.('(prefers-color-scheme: dark)').matches === true,
    );
    manager = new eng.SceneManager(engine, wipe, { theme, colorblind: settings.colorblind });
    scene = new rangeMod.RangeScene();
    scene.onWord = (w) => {
      probe.word = w;
      probe.restored = scene?.restoredStage ?? 0;
      live.textContent = t.t('range.typeWord', { word: w });
    };
    scene.onAnimation = (name) => mark('anim', name);

    // Words to type use only the letters this player has already learned (ARCHITECTURE 8).
    const layout = ctx.profile.layout;
    const rng = new eng.Rng(2026);
    const text = learnedWordSource(ctx.profile, {
      rng: () => rng.next(),
      minLength: 3,
      maxLength: 7,
    });

    const stats = engine.stats;
    probe.stats = stats;
    let lastPerf = performance.now();
    let perfRaf = 0;
    const tickPerf = (now: number): void => {
      perf.update(stats, (now - lastPerf) / 1000);
      lastPerf = now;
      perfRaf = requestAnimationFrame(tickPerf);
    };
    cleanup = () => {
      cancelAnimationFrame(perfRaf);
      manager?.dispose();
      probe.sceneLeak = manager?.lastLeak ?? 0;
      wipe.dispose();
      const left = engine?.dispose();
      probe.left = left ?? null;
      probe.leaked = left ? left.geometries + left.textures + left.programs : 0;
      probe.stats = null;
    };

    try {
      await manager.go(scene, { text, layout, difficulty: 0.5, seed: 2026 });
    } catch {
      fail('range.failed');
      return;
    }
    if (disposed) return;
    perfRaf = requestAnimationFrame(tickPerf);
    hint.textContent = t.t('range.hint');
    probe.ready = true;

    // First run on this device: measure, remember, and switch to the preset that fits.
    if (choice === 'auto' && auto === null) {
      const picked = await engine.benchmark();
      if (disposed) return;
      ctx.saves.save.meta.autoQuality = picked;
      ctx.saves.changed();
      if (choice === 'auto') engine.setQuality(picked);
      ctx.toast.show(t.t('range.benchmarked', { quality: t.t(`range.quality.${picked}`) }));
    }
  };

  void boot().catch(() => fail('range.failed'));

  return {
    el,
    full: true,
    onKey(ev) {
      if (!scene || !manager || ev.ctrlKey || ev.metaKey || ev.altKey) return false;
      const demo = DEMO_KEYS.indexOf(ev.key as (typeof DEMO_KEYS)[number]);
      if (demo >= 0) {
        runDemo(DEMO_ORDER[demo] as RangeDemo);
        return true;
      }
      if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') {
        setCamera(camera + (ev.key === 'ArrowRight' ? 1 : -1));
        return true;
      }
      if (ev.key === 'Enter' || ev.key === 'Tab' || ev.key === ' ') return false;
      const expected = scene.expected;
      if (!expected) return false;
      // Judged by the typing core, one letter at a time: a wrong key is simply tried again.
      const judged = new TypingSession(expected, { layout: ctx.profile.layout }).press(
        { code: ev.code, key: ev.key, shift: ev.shiftKey },
        performance.now(),
      );
      if (!judged) return false;
      manager.onKey(judged);
      probe.restored = scene.restoredStage;
      return true;
    },
    focus() {
      el.focus?.();
    },
    dispose() {
      disposed = true;
      cleanup?.();
      cleanup = null;
      engine = null;
      manager = null;
      scene = null;
    },
  };
}
