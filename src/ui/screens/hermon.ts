// The Wings over Hermon screen (#/hermon, opened from the hub's map): hosts the engine and the
// Hermon scene, lays out the run (one hailstone per word), drops the streak when a stone strikes
// the eagle, lets Reb Ezra and Dyo speak at the right moments, and ends with a results card: rank,
// stones caught in the air, strikes, what was earned, and the way back to the house. On Calm no
// stone ever lands.
// The 3D code is loaded on demand, so the menus never pay for it.

import { ComboRules, dropTiers } from '../../game/combo';
import { DIFFICULTIES, DIFFICULTY_IDS, type DifficultyId } from '../../game/difficulty';
import { LEVEL_IDS, LEVELS, levelWordSource, levelsFor, type LevelId } from '../../game/levels';
import { knownKeysOf } from '../../learn';
import { recordRegionRank, regionMode, regionStatuses } from '../../game/regions';
import { rewardsOf, type RunRewards } from '../../game/results';
import type { Engine, SceneManager } from '../../engine';
import type { HermonScene } from '../../scenes/hermon';
import {
  chapterAt,
  chapterStartsAt,
  planHermon,
  SECTIONS,
  type ChapterId,
  type HermonPlan,
} from '../../scenes/hermon/plan';
import { apprenticeLook, CAST, hermonLine, type HermonMoment } from '../../story';
import type { AppContext, Screen } from '../app';
import { button, dialogueBox, rankBadge, statTile, status } from '../components';
import { h } from '../dom';
import type { MessageKey } from '../i18n';
import { PlayController, type RunEnd } from '../play';
import { resolveTheme } from '../theme';

/** How long a line stays up, and how long a small remark waits after a chapter's line. */
const LINE_MS = 8000;
const MAJOR_HOLD_MS = 3500;
/** The celebration before the results card (shorter when a trial failed). */
const RESULTS_DELAY_MS = 3200;
const FAILED_DELAY_MS = 1100;

/** What the page exposes for the smoke test (and for a curious developer's console). */
interface HermonProbe {
  ready: boolean;
  failed: boolean;
  stats: Engine['stats'] | null;
  word: string;
  /** Words finished and words in the run. */
  words: number;
  total: number;
  chapter: ChapterId | 'finale';
  /** Height of the falling stone (1 = out of the cloud, 0 = it lands). */
  stone: number;
  /** Stones that struck the eagle, and stones caught in the air (finished before a strike). */
  strikes: number;
  caught: number;
  /** 0..1: how readable the next word is (lightning shows it), and how wild the storm is. */
  reveal: number;
  storm: number;
  /** Distance flown up the valley. */
  flown: number;
  /** False on Calm: no stone ever lands. */
  timers: boolean;
  level: LevelId;
  difficulty: DifficultyId;
  levels: LevelId[];
  ended: boolean;
  /** The whole text of the run, and the keys the player has learned. */
  text: string;
  keys: string;
  /** Breaks in the clouds (of 3). */
  breaks: number;
  restored: boolean;
  line: string;
  nextKey: string | null;
  nextShift: string | null;
  results: (RunRewards & { accuracy: number; wpm: number; failed: boolean }) | null;
  /** GPU objects still held after the screen was closed; null while it is open. */
  leaked: number | null;
  sceneLeak: number;
  /** Runs the world forward without waiting for the clock (tests). */
  step: (seconds: number) => void;
}

declare global {
  interface Window {
    __otiyotHermon?: HermonProbe;
  }
}

export function hermonScreen(ctx: AppContext): Screen {
  const t = ctx.i18n;
  const profile = ctx.profile;
  const settings = profile.settings;
  const layout = profile.layout;
  const lang = settings.uiLanguage;

  // --- What this player may play, and what he played last time.
  const own = profile.history.filter((e) => e.mode.startsWith('scene:hermon:'));
  const lastDifficulty = own.at(-1)?.mode.split(':')[3] ?? '';
  let difficulty: DifficultyId = (DIFFICULTY_IDS as readonly string[]).includes(lastDifficulty)
    ? (lastDifficulty as DifficultyId)
    : 'calm';
  let openLevels: LevelId[] = levelsFor(profile);
  const statusNow = (): LevelId =>
    regionStatuses(ctx.profile).find((s) => s.id === 'hermon')?.suggested ?? 'easy';
  let suggested: LevelId = statusNow();
  let level: LevelId = openLevels.includes(suggested) ? suggested : 'easy';
  const restoredBefore = (profile.story.ranks.hermon ?? 0) > 0;

  const view = h('div', { class: 'meadow__view' });
  const loading = h('p', { class: 'meadow__loading', text: t.t('hermon.loading') });
  const live = h('p', { class: 'sr-only', role: 'status', 'aria-live': 'polite' });
  const chipTitle = h('span', { class: 'meadow__chapter' });
  const chipCount = h('span', { class: 'meadow__count' });
  const bar = h('span', { class: 'meadow__bar', 'aria-hidden': 'true' }, h('span', {}));
  const chip = h('div', { class: 'meadow__chip' }, chipTitle, chipCount, bar);
  const optionsButton = button({
    label: '',
    small: true,
    variant: 'quiet',
    onClick: () => toggleOptions(),
  });
  optionsButton.classList.add('meadow__pill');
  optionsButton.setAttribute('aria-expanded', 'false');
  const top = h('div', { class: 'meadow__top' }, chip, optionsButton);
  const options = h('div', {
    class: 'meadow__options',
    role: 'dialog',
    'aria-label': t.t('hermon.options'),
    hidden: true,
  });
  const results = h('div', {
    class: 'range__results meadow__results',
    hidden: true,
    role: 'dialog',
  });
  const speech = dialogueBox({
    speaker: '',
    text: '',
    nextHint: t.t('hub.lineHide'),
    nextKey: 'Enter',
    onNext: () => hideLine(),
  });
  speech.el.classList.add('meadow__speech');
  speech.el.hidden = true;
  speech.el.addEventListener('click', () => hideLine());
  const el = h(
    'section',
    { class: 'meadow hermon', 'data-testid': 'hermon', 'aria-label': t.t('region.hermon') },
    view,
    top,
    speech.el,
    options,
    loading,
    live,
  );

  const probe: HermonProbe = {
    ready: false,
    failed: false,
    stats: null,
    word: '',
    words: 0,
    total: 0,
    chapter: 'gathering',
    stone: 1,
    strikes: 0,
    caught: 0,
    reveal: 0,
    storm: 1,
    flown: 0,
    timers: false,
    level,
    difficulty,
    levels: openLevels,
    ended: false,
    text: '',
    keys: '',
    breaks: 0,
    restored: false,
    line: '',
    nextKey: null,
    nextShift: null,
    results: null,
    leaked: null,
    sceneLeak: 0,
    step: (seconds) => engine?.simulate(seconds),
  };
  // What the sky shows is read live from the scene, so a test that steps the world sees it.
  Object.defineProperties(probe, {
    breaks: { get: () => scene?.breaksOn ?? 0, enumerable: true },
    stone: { get: () => scene?.stoneHeight ?? 1, enumerable: true },
    strikes: { get: () => scene?.strikesTotal ?? 0, enumerable: true },
    caught: { get: () => scene?.stonesCaught ?? 0, enumerable: true },
    reveal: { get: () => scene?.reveal ?? 0, enumerable: true },
    storm: { get: () => scene?.stormNow ?? 1, enumerable: true },
    flown: { get: () => scene?.flown ?? 0, enumerable: true },
    restored: { get: () => scene?.restored ?? false, enumerable: true },
  });
  window.__otiyotHermon = probe;

  let engine: Engine | null = null;
  let manager: SceneManager | null = null;
  let scene: HermonScene | null = null;
  let disposed = false;
  let cleanup: (() => void) | null = null;
  let rngNext: () => number = Math.random;
  let plan: HermonPlan | null = null;
  let wordsDone = 0;
  let perfectWords = 0;
  let slipSaid = false;
  let comboSaid = false;
  let firstKey = false;
  let over = false;
  let firstRestore = false;
  let resultsTimer = 0;
  let lineTimer = 0;
  let lastMajor = -Infinity;
  let lineCount = 0;

  const play = new PlayController(t, layout, settings, settings.keyboardGuide);
  view.append(play.hud.el, results);

  // --- Lines from Reb Ezra and Dyo. A small remark never talks over a chapter's line.
  function say(moment: HermonMoment, minor = false): void {
    const now = performance.now();
    if (minor && now - lastMajor < MAJOR_HOLD_MS) return;
    if (!minor) lastMajor = now;
    const line = hermonLine(moment, lineCount++);
    const who = CAST[line.who];
    const text = line.text[lang];
    speech.setLine(who.name[lang], text, undefined, who.portrait);
    speech.reveal(text.length);
    speech.setWaiting(false);
    speech.el.hidden = false;
    probe.line = `${line.who}:${moment}`;
    window.clearTimeout(lineTimer);
    lineTimer = window.setTimeout(hideLine, LINE_MS);
  }
  function hideLine(): void {
    window.clearTimeout(lineTimer);
    speech.el.hidden = true;
  }

  const chapterNow = (): ChapterId | 'finale' =>
    over && !probe.results?.failed ? 'finale' : plan ? chapterAt(plan, wordsDone) : 'gathering';

  const sync = (): void => {
    const d = play.current;
    const chapter = chapterNow();
    probe.word = d?.word ?? '';
    probe.words = wordsDone;
    probe.total = plan?.stones.length ?? 0;
    probe.chapter = chapter;
    probe.ended = d?.ended ?? false;
    const next = d?.guide() ?? null;
    probe.nextKey = next?.code ?? null;
    probe.nextShift = next?.shift ?? null;
    chipTitle.textContent = t.t(`hermon.chapter.${chapter}` as MessageKey);
    chipCount.textContent =
      chapter === 'finale'
        ? t.t('hermon.breaksOpen', { n: probe.breaks, total: SECTIONS })
        : `${t.t('meadow.progress', { n: Math.min(wordsDone + 1, probe.total), total: probe.total })} · ${t.t('hermon.caught', { n: probe.caught })}`;
    const share = probe.total > 0 ? wordsDone / probe.total : 0;
    (bar.firstElementChild as HTMLElement).style.inlineSize = `${Math.round(share * 100)}%`;
    optionsButton.textContent = t.t('range.results.sub', {
      difficulty: t.t(`range.difficulty.${difficulty}` as MessageKey),
      level: t.t(`range.level.${level}` as MessageKey),
    });
    live.textContent = probe.word && !over ? t.t('range.typeWord', { word: probe.word }) : '';
  };

  /** A new run: lays out the text, resets the line, and hands the text to the typing driver. */
  const startRun = (): void => {
    if (!scene) return;
    window.clearTimeout(resultsTimer);
    results.hidden = true;
    options.hidden = true;
    optionsButton.setAttribute('aria-expanded', 'false');
    const d = DIFFICULTIES[difficulty];
    const keys = knownKeysOf(ctx.profile);
    const words = levelWordSource(ctx.profile, LEVELS[level], d, rngNext);
    plan = planHermon({ keys, level: LEVELS[level], difficulty: d, words });
    if (plan.stones.length === 0) {
      // No word to type yet: the map keeps Hermon shut, but never leave a blank screen.
      ctx.toast.show(t.t('range.failed'));
      ctx.go('hub');
      return;
    }
    wordsDone = 0;
    perfectWords = 0;
    slipSaid = false;
    comboSaid = false;
    firstKey = false;
    over = false;
    probe.results = null;
    probe.level = level;
    probe.difficulty = difficulty;
    probe.text = plan.text;
    probe.keys = [...keys].join('');
    probe.timers = plan.timers;
    scene.begin(plan);
    const text = plan.text;
    play.begin({ next: () => text }, 'once', layout, {
      hardcore: d.failOnError ? true : undefined,
      combo: new ComboRules({ errorTiers: d.errorTiers }),
    });
    sync();
  };

  const finish = (end: RunEnd): void => {
    if (!plan || over) return;
    over = true;
    const failed = end.failed;
    const m = end.metrics;
    const accuracy = m.accuracy;
    const wpm = Math.round(m.netWpm);
    const r = rewardsOf(
      {
        accuracy,
        wpm,
        bestCombo: end.bestCombo,
        words: end.words,
        perfect: perfectWords,
        broken: end.words,
        smudges: scene?.strikesTotal ?? 0,
        failed,
      },
      DIFFICULTIES[difficulty],
      level,
    );
    probe.results = { ...r, accuracy, wpm, failed };
    firstRestore = !failed && (ctx.profile.story.ranks.hermon ?? 0) === 0;
    // Saved at once, so leaving during the celebration loses nothing.
    ctx.saves.update((p) => {
      p.history.push({
        at: Date.now(),
        track: p.track,
        mode: regionMode('hermon', level, difficulty),
        wpm,
        accuracy,
        durationMs: Math.round(m.elapsedMs),
        chars: m.keystrokes,
      });
      if (!failed) recordRegionRank(p, 'hermon', r.rank);
    });
    void ctx.saves.flush();
    openLevels = levelsFor(ctx.profile);
    suggested = statusNow();
    probe.levels = openLevels;
    scene?.finale(failed);
    say(failed ? 'failed' : 'done');
    if (!failed) play.hud.announce(t.t('hermon.restored'));
    sync();
    resultsTimer = window.setTimeout(showResults, failed ? FAILED_DELAY_MS : RESULTS_DELAY_MS);
  };

  // --- Level and difficulty: the same choices in the options panel and on the
  // results card.
  const picks = new Map<string, HTMLButtonElement[]>();
  const mark = (): void => {
    for (const [key, list] of picks) {
      const [set, value] = key.split(':');
      const on = set === 'level' ? value === level : value === difficulty;
      for (const b of list) {
        b.setAttribute('aria-pressed', String(on));
        if (set === 'level') {
          b.setAttribute('aria-disabled', String(!openLevels.includes(value as LevelId)));
          b.dataset.suggested = String(value === suggested);
          b.title = value === suggested ? t.t('range.level.suggested') : '';
        }
      }
    }
  };
  const pick = (key: string, label: string, onClick: () => void): HTMLElement => {
    const b = button({ label, small: true, variant: 'quiet', onClick });
    b.dataset.pick = key;
    picks.set(key, [...(picks.get(key) ?? []), b]);
    return b;
  };
  const row = (title: MessageKey, ...items: HTMLElement[]): HTMLElement =>
    h(
      'div',
      { class: 'meadow__group', role: 'group', 'aria-label': t.t(title) },
      h('h3', { class: 'meadow__label', text: t.t(title) }),
      h('div', { class: 'range__row meadow__row' }, ...items),
    );
  const chooser = (): HTMLElement =>
    h(
      'div',
      { class: 'meadow__chooser' },
      row(
        'hermon.options.level',
        ...LEVEL_IDS.map((id) =>
          pick(`level:${id}`, t.t(`range.level.${id}` as MessageKey), () => {
            if (!openLevels.includes(id)) {
              ctx.toast.show(t.t('range.level.locked', { n: LEVELS[id].needsLetters }));
              return;
            }
            level = id;
            mark();
            sync();
          }),
        ),
      ),
      row(
        'hermon.options.difficulty',
        ...DIFFICULTY_IDS.map((id) =>
          pick(`difficulty:${id}`, t.t(`range.difficulty.${id}` as MessageKey), () => {
            difficulty = id;
            mark();
            sync();
          }),
        ),
      ),
    );
  options.append(
    h('h2', { class: 'meadow__options-title', text: t.t('hermon.options') }),
    chooser(),
    h('p', { class: 'range__results-note', text: t.t('hermon.options.noTimers') }),
    h(
      'div',
      { class: 'range__results-actions' },
      button({
        label: t.t('hermon.options.restart'),
        variant: 'primary',
        onClick: () => startRun(),
      }),
    ),
  );
  mark();
  function toggleOptions(): void {
    if (!probe.ready) return;
    options.hidden = !options.hidden;
    optionsButton.setAttribute('aria-expanded', String(!options.hidden));
    mark();
  }

  /** The results card: rank, numbers, what the run earned, and where to go next. */
  function showResults(): void {
    const r = probe.results;
    if (!r || disposed) return;
    hideLine();
    const title = r.failed
      ? t.t('range.results.failed')
      : t.t(`range.results.title.${r.rank}` as MessageKey);
    const again = button({
      label: t.t(firstRestore ? 'hermon.results.againPlain' : 'hermon.results.again'),
      variant: firstRestore ? 'quiet' : 'primary',
      onClick: () => startRun(),
    });
    again.dataset.action = 'again';
    const home = button({
      label: t.t(firstRestore ? 'hermon.results.homeEnter' : 'hermon.results.home'),
      variant: firstRestore ? 'primary' : 'quiet',
      onClick: () => ctx.go('hub'),
    });
    home.dataset.action = 'home';
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
      firstRestore ? status(t.t('hermon.results.restored'), 'gold') : '',
      h(
        'div',
        { class: 'range__results-stats' },
        statTile({
          label: t.t('range.results.accuracy'),
          value: r.accuracy,
          unit: '%',
          gold: r.accuracy >= 98,
        }),
        statTile({ label: t.t('hud.wpm'), value: r.wpm }),
        statTile({ label: t.t('range.results.combo'), value: play.current?.bestCombo ?? 0 }),
        statTile({
          label: t.t('hermon.results.caught'),
          value: `${scene?.stonesCaught ?? 0}/${plan?.stones.length ?? 0}`,
          gold: (plan?.stones.length ?? 0) > 0 && scene?.stonesCaught === plan?.stones.length,
        }),
        statTile({
          label: t.t('hermon.results.strikes'),
          value: scene?.strikesTotal ?? 0,
          gold: plan?.timers === true && (scene?.strikesTotal ?? 0) === 0,
        }),
      ),
      h(
        'div',
        { class: 'range__results-earned' },
        statTile({ label: t.t('range.results.xp'), value: `+${r.xp}`, gold: true }),
        statTile({ label: t.t('range.results.glyphs'), value: `+${r.glyphs}`, gold: true }),
        statTile({ label: t.t('range.results.ink'), value: `+${r.ink}`, gold: true }),
      ),
      suggested !== level
        ? h('p', {
            class: 'range__results-note',
            text: t.t('range.results.suggest', {
              level: t.t(`range.level.${suggested}` as MessageKey),
            }),
          })
        : '',
      chooser(),
      h('div', { class: 'range__results-actions meadow__actions' }, home, again),
    );
    // The chooser on an old card is gone: forget its buttons.
    for (const [key, list] of picks) {
      picks.set(
        key,
        list.filter((b) => b.isConnected),
      );
    }
    mark();
    results.hidden = false;
    sync();
  }

  play.onWord = (w) => {
    wordsDone = w.count;
    if (w.perfect) perfectWords += 1;
    if (!plan || wordsDone >= plan.stones.length) return;
    const started = chapterStartsAt(plan, wordsDone);
    if (started === 'heart' || started === 'summit') {
      say(started);
      play.hud.announce(t.t(`hermon.chapter.${started}` as MessageKey));
    }
  };
  play.onJudged = (key) => {
    if (!key.correct) {
      if (!slipSaid && !DIFFICULTIES[difficulty].failOnError) {
        slipSaid = true;
        say('slip', true);
      }
    } else if (!firstKey) {
      firstKey = true;
      // The first letter is down: now the chapter's own line.
      const first = plan?.chapters[0]?.id;
      if (first) say(first);
    } else if (!comboSaid && (play.current?.combo ?? 0) >= 10) {
      comboSaid = true;
      say('combo', true);
    }
    sync();
  };
  play.onEnd = (end) => finish(end);

  const fail = (key: MessageKey): void => {
    probe.failed = true;
    loading.replaceChildren(status(t.t(key), 'warn'));
    loading.hidden = false;
  };

  const boot = async (): Promise<void> => {
    const [eng, mod] = await Promise.all([import('../../engine'), import('../../scenes/hermon')]);
    if (disposed) return;
    const auto = ctx.saves.save.meta.autoQuality;
    try {
      engine = await eng.Engine.create(view, {
        quality: eng.resolveQuality(settings.quality, auto),
        reducedMotion: settings.reducedMotion,
      });
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
    view.append(wipe.el);
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
    const rng = new eng.Rng((Date.now() % 100000) + 7);
    rngNext = () => rng.next();
    scene = new mod.HermonScene({
      look: apprenticeLook(profile.avatar),
    });
    scene.onMoment = (moment) => {
      say(moment, true);
      sync();
    };
    // A stone landed on the eagle: the streak drops by the difficulty's smudge tiers.
    scene.onStrike = () => {
      const c = play.current?.combo ?? 0;
      play.setCombo(dropTiers(c, DIFFICULTIES[difficulty].smudgeTiers));
      sync();
    };

    probe.stats = engine.stats;
    let raf = 0;
    const tick = (now: number): void => {
      play.frame(now);
      raf = requestAnimationFrame(tick);
    };
    cleanup = () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(resultsTimer);
      window.clearTimeout(lineTimer);
      play.dispose();
      manager?.dispose();
      probe.sceneLeak = manager?.lastLeak ?? 0;
      wipe.dispose();
      const left = engine?.dispose();
      probe.leaked = left ? left.geometries + left.textures + left.programs : 0;
      probe.stats = null;
    };

    try {
      await manager.go(scene, {
        text: { next: () => plan?.text ?? ' ' },
        layout,
        difficulty: 0,
        seed: 21,
      });
    } catch {
      fail('range.failed');
      return;
    }
    if (disposed) return;
    loading.hidden = true;
    probe.ready = true;
    startRun();
    raf = requestAnimationFrame(tick);
    say(restoredBefore ? 'returning' : 'arrive');

    // First 3D screen on this device: measure, remember, and switch to the preset that fits.
    if (settings.quality === 'auto' && auto === null) {
      const picked = await engine.benchmark();
      if (disposed) return;
      ctx.saves.save.meta.autoQuality = picked;
      ctx.saves.changed();
      engine.setQuality(picked);
    }
  };

  void boot().catch(() => fail('range.failed'));

  return {
    el,
    full: true,
    ownsMusic: true,
    onKey(ev) {
      if (!scene || !manager || !probe.ready || ev.ctrlKey || ev.metaKey || ev.altKey) return false;
      if (over) {
        // During the celebration every key waits; on the card Enter takes the main road.
        if (results.hidden) return true;
        if (ev.key !== 'Enter') return false;
        if (firstRestore) ctx.go('hub');
        else startRun();
        return true;
      }
      if (!options.hidden) return false;
      if (ev.key === 'Enter') {
        if (speech.el.hidden) return false;
        hideLine();
        return true;
      }
      if (ev.key === 'Tab') return false;
      // Judged by the typing driver; the scene and the HUD react.
      const used = play.key(ev, performance.now());
      if (used) sync();
      return used;
    },
    onEscape() {
      if (!options.hidden) {
        toggleOptions();
        return true;
      }
      return false;
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
