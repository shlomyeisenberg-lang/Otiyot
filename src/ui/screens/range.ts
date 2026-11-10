// The test range screen (#/range): hosts the engine and the range scene, with buttons for every
// effect, camera mode, animation and quality preset, and the performance overlay. Reached by
// address only; it is a tool for building scenes, not part of the game's menus.
// The 3D code is loaded on demand, so the menus never pay for it.

import { learnedWordSource, nextContinueText } from '../../learn';
import type { Engine, QualityChoice, QualityName, SceneManager, TextStyle } from '../../engine';
import type { WordSource } from '../../game/typing';
import type { RangeDemo, RangeScene } from '../../scenes/range';
import type { AppContext, Screen } from '../app';
import { button, keycap, status } from '../components';
import { h } from '../dom';
import type { MessageKey } from '../i18n';
import { GUIDE_MODES } from '../keyboardGuide';
import { PlayController, type RunEnd } from '../play';
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
const STYLES: readonly TextStyle[] = ['carved', 'banner', 'hologram'];
const MODES = ['lesson', 'words'] as const;
type RunMode = (typeof MODES)[number];

/** What the page exposes for the smoke test (and for a curious developer's console). */
interface RangeProbe {
  ready: boolean;
  failed: boolean;
  stats: Engine['stats'] | null;
  restored: number;
  word: string;
  /** Words finished in this run, and whether the lesson is over. */
  words: number;
  ended: boolean;
  mode: RunMode;
  combo: number;
  /** The key the finger guide is showing, and the Shift to hold with it. */
  nextKey: string | null;
  nextShift: string | null;
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
    words: 0,
    ended: false,
    mode: 'lesson',
    combo: 0,
    nextKey: null,
    nextShift: null,
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
  let mode: RunMode = 'lesson';
  let rngNext: () => number = Math.random;
  const play = new PlayController(t, ctx.profile.layout, settings, settings.keyboardGuide);
  const done = h('div', { class: 'range__done', hidden: true, role: 'status' });
  view.append(play.hud.el, done);

  const sync = (): void => {
    const d = play.current;
    probe.word = d?.word ?? '';
    probe.words = d?.wordsDone ?? 0;
    probe.ended = d?.ended ?? false;
    probe.combo = d?.combo ?? 0;
    const next = d?.guide() ?? null;
    probe.nextKey = next?.code ?? null;
    probe.nextShift = next?.shift ?? null;
    probe.mode = mode;
    probe.restored = scene?.restoredStage ?? 0;
    live.textContent = probe.word ? t.t('range.typeWord', { word: probe.word }) : '';
  };

  /** Text for a run: the learner's current lesson, or endless words from learned letters. */
  const startRun = (): void => {
    done.hidden = true;
    // Words to type use only the letters this player has already learned (ARCHITECTURE 8).
    const words = learnedWordSource(ctx.profile, { rng: rngNext, minLength: 3, maxLength: 7 });
    let source: WordSource = words;
    let once = false;
    if (mode === 'lesson') {
      const lesson = nextContinueText(ctx.profile, { rng: rngNext });
      if (lesson) {
        source = { next: () => lesson };
        once = true;
      }
    }
    play.begin(source, once ? 'once' : 'endless', ctx.profile.layout);
    sync();
  };

  const showDone = (end: RunEnd): void => {
    const m = end.metrics;
    done.replaceChildren(
      h('h2', { class: 'range__done-title', text: t.t('range.done.title') }),
      h('p', {
        class: 'range__done-body',
        text: t.t('range.done.body', {
          wpm: Math.round(m.netWpm),
          accuracy: m.accuracy,
          combo: end.bestCombo,
        }),
      }),
      h('p', { class: 'range__done-again', text: t.t('range.done.again') }),
    );
    done.hidden = false;
  };
  play.onEnd = (end) => {
    sync();
    showDone(end);
  };
  play.onJudged = () => sync();
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
      'range.text',
      ...MODES.map((m) =>
        pick('mode', m, t.t(`range.mode.${m}`), () => {
          mode = m;
          mark('mode', m);
          startRun();
        }),
      ),
      ...STYLES.map((st) =>
        pick('style', st, t.t(`range.textStyle.${st}`), () => {
          scene?.setTextStyle(st);
          mark('style', st);
        }),
      ),
      ...GUIDE_MODES.map((g) =>
        pick('guide', g, t.t(`guide.mode.${g}`), () => {
          play.setGuideMode(g);
          ctx.saves.update((p) => (p.settings.keyboardGuide = g));
          mark('guide', g);
        }),
      ),
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
  mark('mode', mode);
  mark('style', 'banner');
  mark('guide', settings.keyboardGuide);
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
    manager = new eng.SceneManager(engine, wipe, {
      theme,
      colorblind: settings.colorblind,
      hud: play.hud,
      typing: play.view,
    });
    play.target = manager;
    scene = new rangeMod.RangeScene();
    scene.onAnimation = (name) => mark('anim', name);

    const layout = ctx.profile.layout;
    const rng = new eng.Rng(2026);
    rngNext = () => rng.next();
    startRun();
    const text = learnedWordSource(ctx.profile, { rng: rngNext, minLength: 3, maxLength: 7 });

    const stats = engine.stats;
    probe.stats = stats;
    let lastPerf = performance.now();
    let perfRaf = 0;
    const tickPerf = (now: number): void => {
      play.frame(now);
      perf.update(stats, (now - lastPerf) / 1000);
      lastPerf = now;
      perfRaf = requestAnimationFrame(tickPerf);
    };
    cleanup = () => {
      cancelAnimationFrame(perfRaf);
      play.dispose();
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
      if (play.current?.ended) {
        if (ev.key !== 'Enter') return false;
        startRun();
        return true;
      }
      // Number keys show the effects, unless the text itself asks for a digit.
      const demo = DEMO_KEYS.indexOf(ev.key as (typeof DEMO_KEYS)[number]);
      const wantsDigit = /\d/.test(play.current?.guide()?.char ?? '');
      if (demo >= 0 && !wantsDigit) {
        runDemo(DEMO_ORDER[demo] as RangeDemo);
        return true;
      }
      if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') {
        setCamera(camera + (ev.key === 'ArrowRight' ? 1 : -1));
        return true;
      }
      if (ev.key === 'Enter' || ev.key === 'Tab') return false;
      // Judged by the typing driver; the scene and the HUD react.
      const used = play.key(ev, performance.now());
      if (used) sync();
      return used;
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
