// The Ladder screen (#/ladder, opened from the hub's map): endless free play. Hosts the engine and
// the Ladder scene, lays out the climb floor by floor (src/scenes/ladder/plan.ts), feeds the typing
// driver word after word for as long as the player climbs, keeps the score, hides the next word on
// the paper strip on a cloud floor (and always, with the fog modifier), drops the streak when Dyo
// has to catch the climber, lets Reb Ezra and Dyo speak at the right moments, and ends when the
// grip gives out for good (a soft drop into the clouds) or when the player rests and banks his
// height. The results card shows the rank, the height and the score, what was earned, and the
// profile's high-score table with the new row marked. On Calm the grip never gives out: the
// player rests whenever he likes (Escape opens the panel with "Rest here").

import { ComboRules, dropTiers } from '../../game/combo';
import { DIFFICULTIES, DIFFICULTY_IDS, type DifficultyId } from '../../game/difficulty';
import {
  LEVEL_IDS,
  LEVELS,
  levelWordSource,
  levelsFor,
  wordLengths,
  type LevelId,
} from '../../game/levels';
import { knownKeysOf, learnedWordSource, weakCharacters } from '../../learn';
import { regionMode, regionStatuses } from '../../game/regions';
import { rewardsOf, type RunRewards, type RunStats } from '../../game/results';
import { bankRun, dressedLook, perksOf, type RunGain } from '../../game/progression';
import type { Engine, SceneManager } from '../../engine';
import type { LadderScene } from '../../scenes/ladder';
import {
  activeModifiers,
  addScore,
  Climb,
  climbSource,
  floorPoints,
  MODIFIERS,
  wordPoints,
  type FloorKind,
  type LadderScore,
  type ModifierId,
} from '../../scenes/ladder/plan';
import { CAST, ladderLine, type LadderMoment } from '../../story';
import type { AppContext, Screen } from '../app';
import { button, dialogueBox, rankBadge, statTile, status } from '../components';
import { h } from '../dom';
import { earnedRow } from '../earned';
import type { MessageKey } from '../i18n';
import { PlayController, type RunEnd } from '../play';
import { resolveTheme } from '../theme';

const LINE_MS = 7000;
const MAJOR_HOLD_MS = 3000;
/** The pause before the results card (the drop into the clouds, or the view from the stair). */
const RESULTS_DELAY_MS = 2600;

type EndReason = 'fall' | 'rest';

interface LadderProbe {
  ready: boolean;
  failed: boolean;
  stats: Engine['stats'] | null;
  word: string;
  /** Words finished. */
  words: number;
  /** Floors climbed, and the one being climbed (1-based) with its challenge. */
  floors: number;
  floor: number;
  kind: FloorKind | '';
  grip: number;
  catches: number;
  slips: number;
  score: number;
  best: number;
  /** Words after the current one that can be read now. */
  ahead: number;
  veiled: boolean;
  blots: number;
  restoredShare: number;
  timers: boolean;
  mods: ModifierId[];
  multiplier: number;
  level: LevelId;
  difficulty: DifficultyId;
  levels: LevelId[];
  ended: boolean;
  reason: EndReason | null;
  /** The first words of the climb (for the learned-letters check). */
  text: string;
  keys: string;
  line: string;
  nextKey: string | null;
  nextShift: string | null;
  results:
    | (RunRewards & { accuracy: number; wpm: number; score: number; floors: number; place: number })
    | null;
  leaked: number | null;
  sceneLeak: number;
  step: (seconds: number) => void;
}

declare global {
  interface Window {
    __otiyotLadder?: LadderProbe;
  }
}

export function ladderScreen(ctx: AppContext): Screen {
  const t = ctx.i18n;
  const profile = ctx.profile;
  const settings = profile.settings;
  const layout = profile.layout;
  const lang = settings.uiLanguage;

  const own = profile.history.filter((e) => e.mode.startsWith('scene:ladder:'));
  const lastDifficulty = own.at(-1)?.mode.split(':')[3] ?? '';
  let difficulty: DifficultyId = (DIFFICULTY_IDS as readonly string[]).includes(lastDifficulty)
    ? (lastDifficulty as DifficultyId)
    : 'calm';
  let openLevels: LevelId[] = levelsFor(profile);
  const statusNow = (): LevelId =>
    regionStatuses(ctx.profile).find((s) => s.id === 'ladder')?.suggested ?? 'easy';
  let suggested: LevelId = statusNow();
  let level: LevelId = openLevels.includes(suggested) ? suggested : 'easy';
  let mods: ModifierId[] = [];
  const climbedBefore = profile.ladder.length > 0;

  const view = h('div', { class: 'meadow__view' });
  const loading = h('p', { class: 'meadow__loading', text: t.t('ladder.loading') });
  const live = h('p', { class: 'sr-only', role: 'status', 'aria-live': 'polite' });
  const chipTitle = h('span', { class: 'meadow__chapter' });
  const chipCount = h('span', { class: 'meadow__count' });
  const bar = h(
    'span',
    { class: 'meadow__bar ladder__grip', 'aria-hidden': 'true' },
    h('span', {}),
  );
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
    'aria-label': t.t('ladder.options'),
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
    { class: 'meadow ladder', 'data-testid': 'ladder', 'aria-label': t.t('region.ladder') },
    view,
    top,
    speech.el,
    options,
    loading,
    live,
  );

  const probe: LadderProbe = {
    ready: false,
    failed: false,
    stats: null,
    word: '',
    words: 0,
    floors: 0,
    floor: 1,
    kind: '',
    grip: 1,
    catches: 1,
    slips: 0,
    score: 0,
    best: profile.ladder[0]?.score ?? 0,
    ahead: 0,
    veiled: false,
    blots: 0,
    restoredShare: 0,
    timers: false,
    mods,
    multiplier: 1,
    level,
    difficulty,
    levels: openLevels,
    ended: false,
    reason: null,
    text: '',
    keys: '',
    line: '',
    nextKey: null,
    nextShift: null,
    results: null,
    leaked: null,
    sceneLeak: 0,
    step: (seconds) => engine?.simulate(seconds),
  };
  Object.defineProperties(probe, {
    grip: { get: () => scene?.gripNow ?? 1, enumerable: true },
    catches: { get: () => scene?.catches ?? 0, enumerable: true },
    slips: { get: () => scene?.slips ?? 0, enumerable: true },
    floors: { get: () => scene?.floorsDone ?? 0, enumerable: true },
    floor: { get: () => scene?.floor?.number ?? 1, enumerable: true },
    kind: { get: () => scene?.floor?.kind ?? '', enumerable: true },
    blots: { get: () => scene?.blotsOn ?? 0, enumerable: true },
    restoredShare: { get: () => scene?.restoredShare ?? 0, enumerable: true },
    ahead: { get: () => (over ? 0 : (scene?.aheadWords ?? 0)), enumerable: true },
    veiled: { get: () => !over && probe.ready && (scene?.aheadWords ?? 1) === 0, enumerable: true },
  });
  window.__otiyotLadder = probe;

  let engine: Engine | null = null;
  let manager: SceneManager | null = null;
  let scene: LadderScene | null = null;
  let disposed = false;
  let cleanup: (() => void) | null = null;
  let rngNext: () => number = Math.random;
  let climb: Climb | null = null;
  let score = 0;
  let perfectWords = 0;
  let cleanFloors = 0;
  let slipSaid = false;
  let comboSaid = false;
  let over = false;
  let resultsTimer = 0;
  let lineTimer = 0;
  let lastMajor = -Infinity;
  let lineCount = 0;
  let place = -1;

  /** What the last run put into the profile (T33): levels, gifts, a hidden letter. */
  let gain: RunGain | null = null;
  const play = new PlayController(
    t,
    layout,
    settings,
    settings.keyboardGuide,
    perksOf(ctx.profile),
  );
  view.append(play.hud.el, results);

  function say(moment: LadderMoment, minor = false): void {
    const now = performance.now();
    if (minor && now - lastMajor < MAJOR_HOLD_MS) return;
    if (!minor) lastMajor = now;
    const line = ladderLine(moment, lineCount++);
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

  const num = (n: number): string => Math.round(n).toLocaleString(lang);
  let veilShown = false;
  let gripShown = -1;

  const sync = (): void => {
    const d = play.current;
    probe.word = d?.word ?? '';
    probe.score = score;
    probe.ended = over;
    const next = over ? null : (d?.guide() ?? null);
    probe.nextKey = next?.code ?? null;
    probe.nextShift = next?.shift ?? null;
    const f = scene?.floor ?? null;
    chipTitle.textContent = over
      ? t.t(probe.reason === 'rest' ? 'ladder.chip.rest' : 'ladder.chip.fall', {
          n: num(probe.floors),
        })
      : t.t('ladder.chip.floor', {
          n: num(f?.number ?? 1),
          kind: t.t(`ladder.kind.${f?.kind ?? 'steps'}` as MessageKey),
        });
    chipCount.textContent = `${t.t('ladder.score', { n: num(score) })} · ${t.t('ladder.best', { n: num(Math.max(probe.best, score)) })}`;
    syncGrip();
    syncVeil();
    optionsButton.textContent = t.t('range.results.sub', {
      difficulty: t.t(`range.difficulty.${difficulty}` as MessageKey),
      level: t.t(`range.level.${level}` as MessageKey),
    });
    live.textContent = probe.word && !over ? t.t('range.typeWord', { word: probe.word }) : '';
  };
  /** The bar under the chip is the grip; it turns warning-red when the hands are tiring. */
  const syncGrip = (): void => {
    const g = Math.round(probe.grip * 50) / 50;
    if (g === gripShown) return;
    gripShown = g;
    (bar.firstElementChild as HTMLElement).style.inlineSize = `${Math.round(g * 100)}%`;
    bar.dataset.low = String(probe.timers && g < 0.3);
    bar.title = t.t('ladder.grip');
  };
  const syncVeil = (): void => {
    const veiled = probe.veiled;
    if (veiled === veilShown) return;
    veilShown = veiled;
    if (veiled) play.hud.el.dataset.veil = 'dark';
    else delete play.hud.el.dataset.veil;
  };

  /** A new climb: lays out the first floors and hands the endless text to the typing driver. */
  const startRun = (): void => {
    if (!scene) return;
    window.clearTimeout(resultsTimer);
    results.hidden = true;
    options.hidden = true;
    optionsButton.setAttribute('aria-expanded', 'false');
    const d = DIFFICULTIES[difficulty];
    const keys = knownKeysOf(ctx.profile);
    const words = levelWordSource(ctx.profile, LEVELS[level], d, rngNext);
    const [, max] = wordLengths(LEVELS[level], d);
    const longWords = learnedWordSource(ctx.profile, {
      rng: rngNext,
      minLength: Math.min(max, LEVELS[level].maxLength),
      maxLength: Math.min(9, max + 2),
    });
    const weak = weakCharacters(ctx.profile, keys, 4).map((w) => w.ch);
    climb = new Climb({
      keys,
      level: LEVELS[level],
      difficulty: d,
      mods,
      words,
      longWords,
      weak,
      rng: rngNext,
    });
    if (!climb.ensure(12)) {
      ctx.toast.show(t.t('range.failed'));
      ctx.go('hub');
      return;
    }
    score = 0;
    perfectWords = 0;
    cleanFloors = 0;
    slipSaid = false;
    comboSaid = false;
    over = false;
    place = -1;
    gripShown = -1;
    probe.results = null;
    probe.reason = null;
    probe.level = level;
    probe.difficulty = difficulty;
    probe.timers = d.timers;
    probe.mods = [...climb.mods];
    probe.multiplier = climb.multiplier;
    probe.text = climb.words.slice(0, 12).join(' ');
    probe.keys = [...keys].join('');
    scene.begin(climb);
    play.begin(climbSource(climb), 'endless', layout, {
      hardcore: d.failOnError ? true : undefined,
      combo: new ComboRules({ errorTiers: d.errorTiers }),
    });
    sync();
  };

  /** The climb is over: banked, saved, and the card after a pause. */
  const finish = (reason: EndReason): void => {
    if (!climb || over) return;
    over = true;
    probe.reason = reason;
    const d = play.current;
    const m = d?.metrics(performance.now());
    play.halt();
    const accuracy = m?.accuracy ?? 100;
    const wpm = Math.round(m?.netWpm ?? 0);
    const floors = scene?.floorsDone ?? 0;
    const runStats: RunStats = {
      accuracy,
      wpm,
      bestCombo: d?.bestCombo ?? 0,
      words: d?.wordsDone ?? 0,
      perfect: perfectWords,
      broken: cleanFloors,
      smudges: scene?.slips ?? 0,
      failed: false,
    };
    const r = rewardsOf(runStats, DIFFICULTIES[difficulty], level);
    const entry: LadderScore = {
      at: Date.now(),
      score,
      floors,
      accuracy,
      wpm,
      difficulty,
      level,
      mods: [...climb.mods],
    };
    ctx.saves.update((p) => {
      gain = bankRun(p, {
        region: 'ladder',
        stats: runStats,
        rewards: r,
        difficulty: difficulty,
        level: level,
      });
      if ((m?.keystrokes ?? 0) > 0)
        p.history.push({
          at: entry.at,
          track: p.track,
          mode: regionMode('ladder', level, difficulty),
          wpm,
          accuracy,
          durationMs: Math.round(m?.elapsedMs ?? 0),
          chars: m?.keystrokes ?? 0,
        });
      const added = addScore(p.ladder, entry);
      p.ladder = added.table;
      place = added.place;
    });
    void ctx.saves.flush();
    probe.results = { ...r, accuracy, wpm, score, floors, place };
    openLevels = levelsFor(ctx.profile);
    suggested = statusNow();
    probe.levels = openLevels;
    if (reason === 'rest') scene?.rest();
    const record = place === 0 && score > 0;
    say(record ? 'record' : reason);
    if (record) play.hud.announce(t.t('ladder.record'));
    sync();
    resultsTimer = window.setTimeout(showResults, RESULTS_DELAY_MS);
  };

  // --- Level, difficulty and modifiers: the same choices in the panel and on the card.
  const picks = new Map<string, HTMLButtonElement[]>();
  const mark = (): void => {
    const timers = DIFFICULTIES[difficulty].timers;
    for (const [key, list] of picks) {
      const [set, value] = key.split(':');
      const on =
        set === 'level'
          ? value === level
          : set === 'mod'
            ? mods.includes(value as ModifierId)
            : value === difficulty;
      for (const b of list) {
        b.setAttribute('aria-pressed', String(on));
        if (set === 'level') {
          b.setAttribute('aria-disabled', String(!openLevels.includes(value as LevelId)));
          b.dataset.suggested = String(value === suggested);
          b.title = value === suggested ? t.t('range.level.suggested') : '';
        }
        if (set === 'mod') {
          const counts =
            activeModifiers([value as ModifierId], DIFFICULTIES[difficulty]).length > 0;
          b.setAttribute('aria-disabled', String(!counts));
          b.title = counts ? t.t(`ladder.mod.${value}.tip` as MessageKey) : t.t('ladder.mod.calm');
        }
      }
    }
    void timers;
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
        'ladder.options.level',
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
        'ladder.options.difficulty',
        ...DIFFICULTY_IDS.map((id) =>
          pick(`difficulty:${id}`, t.t(`range.difficulty.${id}` as MessageKey), () => {
            difficulty = id;
            mark();
            sync();
          }),
        ),
      ),
      row(
        'ladder.options.mods',
        ...MODIFIERS.map((id) =>
          pick(`mod:${id}`, t.t(`ladder.mod.${id}` as MessageKey), () => {
            mods = mods.includes(id) ? mods.filter((m) => m !== id) : [...mods, id];
            mark();
          }),
        ),
      ),
    );
  const restButton = button({
    label: t.t('ladder.options.rest'),
    variant: 'primary',
    onClick: () => {
      options.hidden = true;
      optionsButton.setAttribute('aria-expanded', 'false');
      finish('rest');
    },
  });
  restButton.dataset.action = 'rest';
  options.append(
    h('h2', { class: 'meadow__options-title', text: t.t('ladder.options') }),
    h('div', { class: 'range__results-actions' }, restButton),
    chooser(),
    h('p', { class: 'range__results-note', text: t.t('ladder.options.howTo') }),
    h(
      'div',
      { class: 'range__results-actions' },
      button({ label: t.t('ladder.options.home'), variant: 'quiet', onClick: () => ctx.go('hub') }),
      button({ label: t.t('ladder.options.restart'), variant: 'quiet', onClick: () => startRun() }),
    ),
  );
  mark();
  function toggleOptions(): void {
    if (!probe.ready) return;
    if (over && !results.hidden) return;
    options.hidden = !options.hidden;
    optionsButton.setAttribute('aria-expanded', String(!options.hidden));
    restButton.hidden = over;
    mark();
  }

  /** The table of the best climbs, the new one marked. */
  const table = (): HTMLElement => {
    const rows = ctx.profile.ladder;
    const head = h(
      'tr',
      {},
      ...(['rank', 'score', 'floors', 'accuracy', 'climb'] as const).map((k) =>
        h('th', { scope: 'col', text: t.t(`ladder.table.${k}` as MessageKey) }),
      ),
    );
    const body = rows.map((r, i) =>
      h(
        'tr',
        { 'data-new': String(i === place), class: i === place ? 'ladder__new' : '' },
        h('td', { text: num(i + 1) }),
        h('td', { text: num(r.score) }),
        h('td', { text: num(r.floors) }),
        h('td', { text: `${num(r.accuracy)}%` }),
        h('td', {
          text: [
            t.t(`range.difficulty.${r.difficulty}` as MessageKey),
            t.t(`range.level.${r.level}` as MessageKey),
            ...r.mods.map((m) => t.t(`ladder.mod.${m}` as MessageKey)),
          ].join(' · '),
        }),
      ),
    );
    return h(
      'div',
      { class: 'ladder__table-wrap' },
      h(
        'table',
        { class: 'ladder__table', 'data-testid': 'ladder-table' },
        h('caption', { text: t.t('ladder.table') }),
        h('thead', {}, head),
        h('tbody', {}, ...body),
      ),
    );
  };

  function showResults(): void {
    const r = probe.results;
    if (!r || disposed) return;
    hideLine();
    const again = button({
      label: t.t('ladder.results.again'),
      variant: 'primary',
      onClick: () => startRun(),
    });
    again.dataset.action = 'again';
    const home = button({
      label: t.t('ladder.results.home'),
      variant: 'quiet',
      onClick: () => ctx.go('hub'),
    });
    home.dataset.action = 'home';
    const title =
      probe.reason === 'rest'
        ? t.t('ladder.results.rest', { n: num(r.floors) })
        : t.t('ladder.results.fall', { n: num(r.floors) });
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
            text: [
              t.t('range.results.sub', {
                difficulty: t.t(`range.difficulty.${difficulty}` as MessageKey),
                level: t.t(`range.level.${level}` as MessageKey),
              }),
              ...(climb?.mods ?? []).map((m) => t.t(`ladder.mod.${m}` as MessageKey)),
            ].join(' · '),
          }),
        ),
      ),
      r.place === 0 && r.score > 0 ? status(t.t('ladder.results.record'), 'gold') : '',
      h(
        'div',
        { class: 'range__results-stats' },
        statTile({ label: t.t('ladder.results.floors'), value: r.floors, gold: r.place === 0 }),
        statTile({ label: t.t('ladder.results.score'), value: num(r.score), gold: r.place >= 0 }),
        statTile({
          label: t.t('range.results.accuracy'),
          value: r.accuracy,
          unit: '%',
          gold: r.accuracy >= 98,
        }),
        statTile({ label: t.t('hud.wpm'), value: r.wpm }),
        statTile({ label: t.t('range.results.combo'), value: play.current?.bestCombo ?? 0 }),
        statTile({
          label: t.t('ladder.results.clean'),
          value: cleanFloors,
          gold: cleanFloors > 0 && cleanFloors === r.floors,
        }),
      ),
      earnedRow(t, r, gain),
      table(),
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
    for (const [key, list] of picks)
      picks.set(
        key,
        list.filter((b) => b.isConnected),
      );
    mark();
    results.hidden = false;
    probe.best = ctx.profile.ladder[0]?.score ?? 0;
    sync();
  }

  play.onWord = (w) => {
    if (!climb || over) return;
    const kind = scene?.floor?.kind ?? 'steps';
    if (w.perfect) perfectWords += 1;
    score += wordPoints(w.word, play.current?.tier ?? 0, kind, climb.multiplier);
    sync();
  };
  play.onJudged = (key) => {
    if (over) return;
    if (!key.correct) {
      if (!slipSaid && !DIFFICULTIES[difficulty].failOnError) slipSaid = true;
    } else if (!comboSaid && (play.current?.combo ?? 0) >= 25) {
      comboSaid = true;
      say('combo', true);
    }
    sync();
  };
  // Only the Sofer's Trial ends the driver itself (the first slip): a soft drop into the clouds.
  play.onEnd = (end: RunEnd) => {
    if (end.failed) scene?.stop();
    if (!over) finish('fall');
  };

  const fail = (key: MessageKey): void => {
    probe.failed = true;
    loading.replaceChildren(status(t.t(key), 'warn'));
    loading.hidden = false;
  };

  const boot = async (): Promise<void> => {
    const [eng, mod] = await Promise.all([import('../../engine'), import('../../scenes/ladder')]);
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
    const rng = new eng.Rng((Date.now() % 100000) + 28);
    rngNext = () => rng.next();
    scene = new mod.LadderScene({
      look: dressedLook(profile),
      letters: [...knownKeysOf(profile)].join(''),
    });
    scene.onMoment = (moment) => {
      if (moment === 'landing') {
        say('landing');
        play.hud.announce(t.t('ladder.landing'));
      } else say(moment, true);
      sync();
    };
    // Dyo caught the climber: the streak drops by the difficulty's smudge tiers.
    scene.onCaught = () => {
      const c = play.current?.combo ?? 0;
      play.setCombo(dropTiers(c, DIFFICULTIES[difficulty].smudgeTiers));
      say('caught');
      play.hud.announce(t.t('ladder.caught'));
      sync();
    };
    scene.onFall = () => finish('fall');
    scene.onFloor = (f, clean) => {
      if (!climb) return;
      if (clean) cleanFloors += 1;
      score += floorPoints(f.number, f.kind, clean, climb.multiplier);
      if (!f.landing) play.hud.announce(t.t('ladder.floorDone', { n: num(f.number) }));
      sync();
    };

    probe.stats = engine.stats;
    let raf = 0;
    const tick = (now: number): void => {
      play.frame(now);
      syncVeil();
      syncGrip();
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
        text: { next: () => climb?.words[0] ?? ' ' },
        layout,
        difficulty: 0,
        seed: 28,
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
    say(climbedBefore ? 'returning' : 'arrive');

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
        if (results.hidden) return true;
        if (ev.key !== 'Enter') return false;
        startRun();
        return true;
      }
      if (!options.hidden) return false;
      if (ev.key === 'Enter') {
        if (speech.el.hidden) return false;
        hideLine();
        return true;
      }
      if (ev.key === 'Tab') return false;
      const used = play.key(ev, performance.now());
      if (used) sync();
      return used;
    },
    onEscape() {
      // Escape opens the panel (with "Rest here"); a second Escape closes it.
      if (!probe.ready || (over && !results.hidden)) return false;
      toggleOptions();
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
