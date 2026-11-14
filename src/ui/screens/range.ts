// The test range screen (#/range): hosts the engine and the range scene, with buttons for every
// effect, camera mode, animation and quality preset, and the performance overlay. Reached by
// address only; it is a tool for building scenes, not part of the game's menus.
// The 3D code is loaded on demand, so the menus never pay for it.

import { learnedWordSource, nextContinueText } from '../../learn';
import { WaveFight, type CombatListener } from '../../game/combat';
import { ComboRules, dropTiers } from '../../game/combo';
import { DIFFICULTIES, DIFFICULTY_IDS, type DifficultyId } from '../../game/difficulty';
import {
  LEVEL_IDS,
  LEVELS,
  levelWordSource,
  levelsFor,
  suggestLevel,
  type LevelId,
} from '../../game/levels';
import { rewardsOf, type RunRewards, type RunStats } from '../../game/results';
import { bankRun, perksOf, type RunGain } from '../../game/progression';
import type { Engine, QualityChoice, QualityName, SceneManager, TextStyle } from '../../engine';
import type { WordSource } from '../../game/typing';
import type { RangeDemo, RangeScene } from '../../scenes/range';
import type { AppContext, Screen } from '../app';
import { button, keycap, rankBadge, statTile, status } from '../components';
import { h } from '../dom';
import { earnedRow } from '../earned';
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
const MODES = ['lesson', 'words', 'fight'] as const;
/** Seconds of celebration between the last broken shield and the results. */
const RESULTS_DELAY_MS = 1600;
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
  /** The wave fight, while one runs. */
  fight: {
    wave: number;
    waves: number;
    onField: number;
    broken: number;
    smudges: number;
    total: number;
    done: boolean;
    difficulty: DifficultyId;
    level: LevelId;
  } | null;
  /** The results of the last fight. */
  results: (RunRewards & { accuracy: number; wpm: number; failed: boolean }) | null;
  /** The level the range suggests now, and the levels open to this player. */
  suggested: LevelId;
  levels: LevelId[];
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
    fight: null,
    results: null,
    suggested: 'easy',
    levels: ['easy'],
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
  /** What the last run put into the profile (T33): levels, gifts, a hidden letter. */
  let gain: RunGain | null = null;
  const play = new PlayController(
    t,
    ctx.profile.layout,
    settings,
    settings.keyboardGuide,
    perksOf(ctx.profile),
  );
  const done = h('div', { class: 'range__done', hidden: true, role: 'status' });
  const results = h('div', { class: 'range__results', hidden: true, role: 'dialog' });
  view.append(play.hud.el, done, results);

  // Wave fights: difficulty and level are the player's to choose; the level is suggested from
  // recent fights and only levels the course has opened can be picked.
  let difficulty: DifficultyId = 'steady';
  const recentFights = (): { accuracy: number; wpm: number }[] =>
    ctx.profile.history.filter((e) => e.mode.startsWith('fight:')).slice(-6);
  const lastLevel = (): LevelId => {
    const last = ctx.profile.history.filter((e) => e.mode.startsWith('fight:')).at(-1);
    const id = last?.mode.split(':')[1];
    return (LEVEL_IDS as readonly string[]).includes(id ?? '') ? (id as LevelId) : 'easy';
  };
  let openLevels: LevelId[] = levelsFor(ctx.profile);
  let suggested: LevelId = suggestLevel(recentFights(), lastLevel(), openLevels);
  let level: LevelId = suggested;
  let fight: WaveFight | null = null;
  let fightOver = false;
  let resultsTimer = 0;
  probe.levels = openLevels;
  probe.suggested = suggested;

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
    probe.fight = fight
      ? {
          wave: fight.wave,
          waves: fight.waves,
          onField: fight.onField,
          broken: fight.broken,
          smudges: fight.smudges,
          total: fight.total,
          done: fight.done,
          difficulty,
          level,
        }
      : null;
    live.textContent = probe.word ? t.t('range.typeWord', { word: probe.word }) : '';
  };

  /** Text for a run: the learner's current lesson, or endless words from learned letters. */
  const startRun = (): void => {
    done.hidden = true;
    results.hidden = true;
    window.clearTimeout(resultsTimer);
    if (mode === 'fight') {
      startFight();
      return;
    }
    if (fight) {
      fight = null;
      scene?.stopFight();
    }
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

  /** A wave fight: Blots with word shields, on the chosen difficulty and level. */
  const startFight = (): void => {
    if (!scene) return;
    const d = DIFFICULTIES[difficulty];
    const lv = LEVELS[level];
    fightOver = false;
    const seed = Math.floor(rngNext() * 0x7fffffff);
    // Shield words use only the letters this player has already learned (ARCHITECTURE 8).
    const words = levelWordSource(ctx.profile, lv, d, rngNext);
    const f = new WaveFight({ level: lv, difficulty: d, seed, words });
    fight = f;
    const rules = new ComboRules({ errorTiers: d.errorTiers });
    const relay: CombatListener = {
      spawn: () => {
        play.retarget();
        sync();
      },
      broken: () => sync(),
      smudge: () => {
        const c = play.current?.combo ?? 0;
        play.setCombo(dropTiers(c, d.smudgeTiers));
        play.hud.stumble();
        sync();
      },
      wave: (i, total) => {
        play.hud.announce(t.t('range.fight.wave', { n: i + 1, total }));
        sync();
      },
      cleared: () => {
        fightOver = true;
        scene?.celebrate();
        play.hud.announce(t.t('range.fight.cleared'));
        sync();
        resultsTimer = window.setTimeout(() => finishFight(false), RESULTS_DELAY_MS);
      },
    };
    scene.startFight(f, relay);
    play.begin({ next: () => f.auto('')?.word ?? words.next() }, 'endless', ctx.profile.layout, {
      hardcore: d.failOnError ? true : undefined,
      combo: rules,
      targeting: f,
    });
    sync();
  };

  /** The results card: rank, numbers, and what the fight earned. */
  const finishFight = (failed: boolean): void => {
    const d = play.current;
    if (!fight || !d) return;
    fightOver = true;
    const now = performance.now();
    const m = d.metrics(now);
    const accuracy = Math.round(d.accuracy() * 10) / 10;
    const wpm = Math.round(m.netWpm);
    const runStats: RunStats = {
      accuracy,
      wpm,
      bestCombo: d.bestCombo,
      words: d.wordsDone,
      perfect: fight.perfect,
      broken: fight.broken,
      smudges: fight.smudges,
      failed,
    };
    const r = rewardsOf(runStats, DIFFICULTIES[difficulty], level);
    probe.results = { ...r, accuracy, wpm, failed };
    // Statistics only (never typed text): they feed the level suggestion.
    ctx.saves.update((p) => {
      gain = bankRun(p, {
        region: '',
        stats: runStats,
        rewards: r,
        difficulty: difficulty,
        level: level,
      });
      p.history.push({
        at: Date.now(),
        track: p.track,
        mode: `fight:${level}:${difficulty}`,
        wpm,
        accuracy,
        durationMs: Math.round(m.elapsedMs),
        chars: d.keys.length,
      });
    });
    openLevels = levelsFor(ctx.profile);
    suggested = suggestLevel(recentFights(), level, openLevels);
    probe.levels = openLevels;
    probe.suggested = suggested;
    markLevels();
    const title = failed
      ? t.t('range.results.failed')
      : t.t(`range.results.title.${r.rank}` as MessageKey);
    results.replaceChildren(
      h(
        'div',
        { class: 'range__results-head' },
        rankBadge(r.rank, t.t('range.results.rank', { rank: r.rank })),
        h(
          'div',
          {},
          h('h2', { class: 'range__results-title', text: title }),
          h('p', {
            class: 'range__results-sub',
            text: t.t('range.results.sub', {
              difficulty: t.t(`range.difficulty.${difficulty}` as MessageKey),
              level: t.t(`range.level.${level}` as MessageKey),
            }),
          }),
        ),
      ),
      h(
        'div',
        { class: 'range__results-stats' },
        statTile({
          label: t.t('range.results.accuracy'),
          value: accuracy,
          unit: '%',
          gold: accuracy >= 98,
        }),
        statTile({ label: t.t('hud.wpm'), value: wpm }),
        statTile({ label: t.t('range.results.combo'), value: d.bestCombo }),
        statTile({
          label: t.t('range.results.shields'),
          value: t.t('range.results.ofTotal', { n: fight.broken, total: fight.total }),
        }),
      ),
      earnedRow(t, r, gain),
      fight.smudges > 0
        ? h('p', {
            class: 'range__results-note',
            text: t.t('range.results.smudges', { n: fight.smudges }),
          })
        : '',
      suggested !== level
        ? h('p', {
            class: 'range__results-note',
            text: t.t('range.results.suggest', {
              level: t.t(`range.level.${suggested}` as MessageKey),
            }),
          })
        : '',
      h(
        'div',
        { class: 'range__results-actions' },
        button({
          label: t.t('range.results.again'),
          variant: 'primary',
          onClick: () => startRun(),
        }),
      ),
    );
    results.hidden = false;
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
    if (fight) finishFight(end.failed);
    else showDone(end);
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
      'range.fight',
      ...DIFFICULTY_IDS.map((id) =>
        pick('difficulty', id, t.t(`range.difficulty.${id}` as MessageKey), () => {
          difficulty = id;
          mark('difficulty', id);
          chooseFight();
        }),
      ),
      ...LEVEL_IDS.map((id) =>
        pick('level', id, t.t(`range.level.${id}` as MessageKey), () => {
          if (!openLevels.includes(id)) {
            ctx.toast.show(t.t('range.level.locked', { n: LEVELS[id].needsLetters }));
            return;
          }
          level = id;
          mark('level', id);
          chooseFight();
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
  /** Picking a difficulty or level starts a fight with it. */
  function chooseFight(): void {
    mode = 'fight';
    mark('mode', 'fight');
    startRun();
  }
  /** Locked levels look locked; the suggested one carries a small star. */
  function markLevels(): void {
    for (const id of LEVEL_IDS) {
      const b = pressed.get(`level:${id}`);
      if (!b) continue;
      b.setAttribute('aria-disabled', String(!openLevels.includes(id)));
      b.dataset.suggested = String(id === suggested);
      b.title = id === suggested ? t.t('range.level.suggested') : '';
    }
  }
  markLevels();
  mark('difficulty', difficulty);
  mark('level', level);
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
      audio: ctx.audio,
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
      if (play.current?.ended || (fight && fightOver)) {
        if (ev.key !== 'Enter') return !play.current?.ended;
        // During the celebration before the results, Enter waits too.
        if (fight && results.hidden) return true;
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
