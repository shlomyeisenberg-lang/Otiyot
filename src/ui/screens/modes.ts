// The modes screen (#/modes, T31): where the hub's practice slate leads. Four ways to play beyond
// the story: Practice (targeted drills on a clean screen), Time Attack, Survival, and the Daily
// Challenge (one seed per date, best kept locally). Time Attack and Survival run on any open
// region as the setting, with optional challenge modifiers (no lookahead, mirror, fog, sudden
// layout). Every word comes from the letters the player has learned. Each finished run is written
// to the profile's history (statistics only, never the text) and feeds the adaptive engine.

import type { TypedKey } from '../../core';
import { modeTheme } from '../../audio/themes';
import { DIFFICULTIES, type DifficultyId } from '../../game/difficulty';
import { LEVELS, levelWordSource, type LevelId } from '../../game/levels';
import {
  bestScoreOf,
  dailyPlan,
  dailyRules,
  dailyScore,
  dateKey,
  GRIP_MAX,
  hasLetters,
  learnedOnly,
  MODE_DIFFICULTIES,
  MODE_IDS,
  MODIFIER_IDS,
  ModeRun,
  modeHistoryKey,
  modeScore,
  openLevels,
  PRACTICE_KINDS,
  practiceText,
  rulesFor,
  seededRng,
  SETTING_REGIONS,
  suddenAfter,
  trackLessons,
  viewOf,
  withModifiers,
  type DailyPlan,
  type ModeId,
  type ModifierId,
  type PracticeKind,
  type RuleKind,
  type RuleSet,
  type RunOutcome,
} from '../../game/modes';
import { regionStatuses, type RegionId } from '../../game/regions';
import {
  addToBoard,
  bestGhost,
  boardKey,
  ghostProgress,
  GhostRecorder,
  makeRecord,
} from '../../game/ghosts';
import { rankOf } from '../../game/results';
import { knownKeysOf, recordKeystroke } from '../../learn';
import type { AppContext, Screen } from '../app';
import {
  button,
  choiceCard,
  choiceGroup,
  field,
  keycap,
  rankBadge,
  select,
  statTile,
  status,
  toggle,
} from '../components';
import { h } from '../dom';
import { earnedRow } from '../earned';
import { bankLesson, perksOf, type RunGain } from '../../game/progression';
import type { MessageKey } from '../i18n';
import { PlayController, type RunEnd } from '../play';
import { wantLesson } from '../playable';
import { frame } from './frame';

type View = 'lobby' | 'run' | 'done';

interface ModesProbe {
  view: View;
  mode: ModeId;
  word: string;
  nextKey: string | null;
  nextShift: string | null;
  words: number;
  goal: number;
  grip: number | null;
  timeLeft: number | null;
  mods: string;
  region: string;
  guide: string;
  ended: boolean;
  outcome: string | null;
  score: number;
  saved: number;
  empty: boolean;
  /** Words the ghost has finished now (-1 with no ghost), its score, and the place this run took. */
  ghostWords: number;
  ghostScore: number | null;
  board: { place: number; newBest: boolean } | null;
  /** Test hook: moves the run's clock forward by this many seconds. */
  step: (seconds: number) => void;
}

declare global {
  interface Window {
    __otiyotModes?: ModesProbe;
  }
}

/** The choices kept while the player is on this screen's lobby (and back from a run). */
interface Choices {
  mode: ModeId;
  kind: PracticeKind;
  minutes: number;
  lessonId: string;
  custom: string;
  region: RegionId;
  level: LevelId;
  difficulty: DifficultyId;
  mods: Set<ModifierId>;
}

const MINUTES = [2, 5, 10] as const;
let remembered: Choices | null = null;

export function modesScreen(ctx: AppContext): Screen {
  const t = ctx.i18n;
  const name = (key: string): string => t.t(key as MessageKey);
  const probe: ModesProbe = {
    view: 'lobby',
    mode: 'practice',
    word: '',
    nextKey: null,
    nextShift: null,
    words: 0,
    goal: 0,
    grip: null,
    timeLeft: null,
    mods: '',
    region: '',
    guide: 'keys',
    ended: false,
    outcome: null,
    score: 0,
    saved: 0,
    empty: false,
    ghostWords: -1,
    ghostScore: null,
    board: null,
    step: () => {},
  };
  window.__otiyotModes = probe;

  const settings = ctx.profile.settings;
  const play = new PlayController(
    t,
    ctx.profile.layout,
    settings,
    settings.keyboardGuide,
    perksOf(ctx.profile),
  );
  const root = h('section', {
    class: 'modes',
    'data-testid': 'modes',
    'aria-label': t.t('modes.label'),
  });
  let view: View = 'lobby';
  let raf = 0;
  let disposed = false;

  // ---- what is open -------------------------------------------------------------------------

  const openRegions = (): RegionId[] =>
    regionStatuses(ctx.profile)
      .filter((s) => s.open && SETTING_REGIONS.includes(s.id))
      .map((s) => s.id);
  const levels = (): LevelId[] => openLevels(ctx.profile);

  const lessonsList = trackLessons(ctx.profile);
  const startChoices = (): Choices => {
    const regions = openRegions();
    const first = lessonsList[0]?.id ?? '';
    return {
      mode: 'practice',
      kind: 'weak',
      minutes: 2,
      lessonId: first,
      custom: '',
      region: regions[0] ?? 'meadow',
      level: levels()[0] ?? 'easy',
      difficulty: ctx.profile.settings.difficulty,
      mods: new Set(),
    };
  };
  const choices: Choices = remembered ?? startChoices();
  // Keep what is remembered inside what is open now (the player may have switched tracks).
  if (!openRegions().includes(choices.region)) choices.region = openRegions()[0] ?? 'meadow';
  if (!levels().includes(choices.level)) choices.level = levels()[0] ?? 'easy';
  if (!lessonsList.some((l) => l.id === choices.lessonId)) {
    choices.lessonId = lessonsList[0]?.id ?? '';
  }
  probe.mode = choices.mode;

  const today = (): string => dateKey(new Date());
  const todaysPlan = (): DailyPlan => dailyPlan(today(), openRegions(), levels());

  // ---- the lobby ----------------------------------------------------------------------------

  const notice = h('p', { class: 'modes__notice', role: 'status', 'aria-live': 'polite' });
  const optionsHost = h('div', { class: 'modes__options' });
  const startBtn = button({ label: t.t('modes.start'), variant: 'primary' });
  const cards: HTMLButtonElement[] = [];

  function ruleLine(rules: RuleSet): string {
    if (rules.kind === 'timeattack') {
      return rules.seconds > 0
        ? t.t('modes.rule.timeattack.clock', { n: rules.seconds })
        : t.t('modes.rule.timeattack.quota', { n: rules.goalWords });
    }
    return rules.drainPerSec > 0
      ? t.t('modes.rule.survival.grip', { n: rules.goalWords })
      : t.t('modes.rule.survival.calm', { n: rules.goalWords });
  }

  function modifierRows(): HTMLElement {
    const rows = MODIFIER_IDS.map((id) => {
      const sw = toggle({
        checked: choices.mods.has(id),
        onText: t.t('modes.on'),
        offText: t.t('modes.off'),
        onChange: (on) => {
          if (on) choices.mods.add(id);
          else choices.mods.delete(id);
        },
      });
      sw.el.setAttribute('data-mod', id);
      return field({ label: name(`modes.mod.${id}`), hint: name(`modes.mod.${id}.body`) }, sw.el);
    });
    return h(
      'div',
      { class: 'modes__group', role: 'group', 'aria-label': t.t('modes.mods') },
      h('h3', { class: 'modes__group-title', text: t.t('modes.mods') }),
      ...rows,
    );
  }

  function settingRows(): HTMLElement[] {
    const regions = openRegions();
    const lv = levels();
    const sceneSel = select(
      regions.map((r) => ({ value: r, label: name(`region.${r}`) })),
      choices.region,
      (v) => (choices.region = v),
    );
    sceneSel.setAttribute('data-field', 'region');
    const levelSel = select(
      lv.map((l) => ({ value: l, label: name(`range.level.${l}`) })),
      choices.level,
      (v) => {
        choices.level = v;
        paintRule();
      },
    );
    levelSel.setAttribute('data-field', 'level');
    const diffSel = select(
      MODE_DIFFICULTIES.map((d) => ({ value: d, label: name(`range.difficulty.${d}`) })),
      choices.difficulty,
      (v) => {
        choices.difficulty = v;
        paintRule();
      },
    );
    diffSel.setAttribute('data-field', 'difficulty');
    return [
      field(
        { label: t.t('modes.setting'), hint: name(`region.${choices.region}.place`) },
        sceneSel,
      ),
      field({ label: t.t('modes.level') }, levelSel),
      field({ label: t.t('modes.difficulty') }, diffSel),
    ];
  }

  const ruleEl = h('p', { class: 'modes__rule' });
  function paintRule(): void {
    if (choices.mode === 'timeattack' || choices.mode === 'survival') {
      ruleEl.textContent = ruleLine(rulesFor(choices.mode, choices.level, choices.difficulty));
    }
  }

  function practiceRows(): HTMLElement[] {
    const kindSel = select(
      PRACTICE_KINDS.map((k) => ({ value: k, label: name(`modes.practice.kind.${k}`) })),
      choices.kind,
      (v) => {
        choices.kind = v;
        paintOptions();
      },
    );
    kindSel.setAttribute('data-field', 'kind');
    const rows: HTMLElement[] = [field({ label: t.t('modes.practice.kind') }, kindSel)];
    if (choices.kind === 'lesson') {
      const lessonSel = select(
        lessonsList.map((l) => ({ value: l.id, label: l.title })),
        choices.lessonId,
        (v) => (choices.lessonId = v),
      );
      lessonSel.setAttribute('data-field', 'lesson');
      rows.push(field({ label: t.t('modes.practice.lesson') }, lessonSel));
    } else if (choices.kind === 'custom') {
      const area = h('textarea', {
        class: 'input modes__custom',
        rows: '3',
        dir: 'auto',
        'data-field': 'custom',
        'aria-label': t.t('modes.practice.custom'),
      });
      area.value = choices.custom;
      area.addEventListener('input', () => (choices.custom = area.value));
      rows.push(
        field(
          { label: t.t('modes.practice.custom'), hint: t.t('modes.practice.customHint') },
          area,
        ),
      );
    } else {
      const minSel = select(
        MINUTES.map((m) => ({ value: String(m), label: t.t('modes.practice.minutesN', { n: m }) })),
        String(choices.minutes),
        (v) => (choices.minutes = Number(v)),
      );
      minSel.setAttribute('data-field', 'minutes');
      rows.push(field({ label: t.t('modes.practice.minutes') }, minSel));
    }
    return rows;
  }

  function dailyRows(): HTMLElement[] {
    const plan = todaysPlan();
    const rules = dailyRules(plan);
    const best = bestScoreOf(ctx.profile.history, `mode:daily:${plan.date}`);
    const mods = plan.modifiers.map((m) => name(`modes.mod.${m}`));
    return [
      h(
        'div',
        { class: 'modes__daily', 'data-testid': 'modes-daily' },
        h('p', { class: 'modes__daily-date', text: t.t('modes.daily.today', { date: plan.date }) }),
        h('p', {
          class: 'modes__daily-plan',
          text: t.t('modes.daily.plan', {
            region: name(`region.${plan.region}`),
            level: name(`range.level.${plan.level}`),
            rule: `${name(`modes.rule.${plan.kind}`)} · ${t.t('modes.rule.daily', { n: rules.goalWords })}`,
          }),
        }),
        h('p', { class: 'modes__daily-mods' }, ...mods.map((m) => status(m, 'gold'))),
        h('p', {
          class: 'modes__daily-best',
          text: best > 0 ? t.t('modes.daily.best', { n: best }) : t.t('modes.daily.none'),
        }),
      ),
    ];
  }

  function paintOptions(): void {
    const parts: HTMLElement[] = [];
    if (choices.mode === 'practice') {
      parts.push(...practiceRows());
    } else if (choices.mode === 'daily') {
      parts.push(...dailyRows());
    } else {
      parts.push(...settingRows(), ruleEl, modifierRows());
      paintRule();
    }
    optionsHost.replaceChildren(...parts);
    notice.textContent = '';
    probe.mode = choices.mode;
  }

  function paintCards(): void {
    cards.forEach((c, i) => {
      const on = MODE_IDS[i] === choices.mode;
      c.setAttribute('aria-checked', String(on));
      c.tabIndex = on ? 0 : -1;
    });
  }

  MODE_IDS.forEach((id) => {
    const card = choiceCard({
      id,
      kicker: '',
      title: name(`modes.mode.${id}`),
      body: name(`modes.mode.${id}.body`),
      checked: id === choices.mode,
      pickedText: t.t('common.chosen'),
      onPick: () => {
        choices.mode = id;
        paintCards();
        paintOptions();
      },
    });
    cards.push(card);
  });

  const lessonsBtn = button({
    label: t.t('modes.lessons'),
    onClick: () => {
      wantLesson(null);
      ctx.go('lesson');
    },
  });

  function lobby(): HTMLElement {
    const enough = hasLetters(ctx.profile);
    startBtn.disabled = !enough;
    paintCards();
    paintOptions();
    if (!enough) notice.textContent = t.t('modes.noLetters');
    return frame(
      { title: t.t('modes.title'), lead: t.t('modes.lead'), kicker: t.t('modes.kicker') },
      choiceGroup(t.t('modes.pick'), cards),
      optionsHost,
      notice,
      h(
        'div',
        { class: 'modes__actions' },
        startBtn,
        h(
          'span',
          { class: 'modes__aside' },
          h('span', { text: t.t('modes.lessonsBody') }),
          lessonsBtn,
        ),
      ),
    );
  }

  // ---- a run --------------------------------------------------------------------------------

  const titleEl = h('h1', { class: 'modes__run-title' });
  const subEl = h('p', { class: 'modes__run-sub' });
  const modsEl = h('p', { class: 'modes__run-mods' });
  const meterLabel = h('span', { class: 'modes__meter-label' });
  const meterFill = h('span', { class: 'modes__meter-fill' });
  const meterEl = h(
    'div',
    { class: 'modes__meter', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100' },
    meterFill,
  );
  const ghostEl = h('p', { class: 'modes__run-sub modes__ghost', hidden: true });
  const meterWrap = h('div', { class: 'modes__meter-wrap' }, meterLabel, meterEl, ghostEl);
  const head = h('header', { class: 'modes__run-head' }, titleEl, subEl, modsEl, meterWrap);
  const done = h('div', { class: 'modes__done', hidden: true, role: 'dialog' });
  const runView = h('div', { class: 'modes__run', hidden: true }, head, play.hud.el);
  const lobbyView = h('div', { class: 'modes__lobby' });
  root.append(lobbyView, runView, done);

  let rule: RuleSet | null = null;
  let run: ModeRun | null = null;
  let kindOfRun: ModeId = 'practice';
  let historyKey = '';
  let mods: ModifierId[] = [];
  let keys: TypedKey[] = [];
  let started = false;
  let last = 0;
  let finishedRun = false;
  let suddenAt = -1;
  let suddenDone = false;
  let focusLine = '';
  // T37: the finish time of every word (never any text) and the best earlier run to race.
  const recorder = new GhostRecorder();
  let ghostMs = 0;
  let ghostMarks: readonly number[] = [];
  let ghostKey = '';

  const clock = (): number => performance.now();

  function setMeter(): void {
    if (!run) {
      meterWrap.hidden = true;
      return;
    }
    const s = run.state;
    meterWrap.hidden = false;
    let pct: number;
    if (s.grip !== null) {
      meterLabel.textContent = t.t('modes.grip');
      pct = (s.grip / GRIP_MAX) * 100;
      if (run.rules.goalWords > 0) {
        subEl.textContent = t.t('modes.wordsOf', { n: s.words, goal: run.rules.goalWords });
      }
      meterEl.dataset.low = String(pct < 25);
    } else if (s.timeLeftMs !== null) {
      meterLabel.textContent = `${t.t('modes.timeLeft')}: ${Math.ceil(s.timeLeftMs / 1000)}`;
      pct = (s.timeLeftMs / ((run.rules.seconds || 1) * 1000)) * 100;
      subEl.textContent = t.t('modes.words', { n: s.words });
    } else {
      meterLabel.textContent = t.t('modes.words', { n: s.words });
      pct = run.rules.goalWords > 0 ? (s.words / run.rules.goalWords) * 100 : 0;
      subEl.textContent = t.t('modes.wordsOf', { n: s.words, goal: run.rules.goalWords });
    }
    meterFill.style.inlineSize = `${Math.max(0, Math.min(100, pct))}%`;
    meterEl.setAttribute('aria-valuenow', String(Math.round(pct)));
    probe.ghostWords = ghostMarks.length > 0 ? ghostProgress(ghostMarks, ghostMs) : -1;
    if (ghostMarks.length > 0) {
      ghostEl.hidden = false;
      ghostEl.textContent = `${t.t('ghost.ghostBar')}: ${t.t('modes.words', { n: Math.floor(probe.ghostWords) })}`;
    } else {
      ghostEl.hidden = true;
    }
    probe.words = s.words;
    probe.grip = s.grip === null ? null : Math.round(s.grip);
    probe.timeLeft = s.timeLeftMs === null ? null : Math.round(s.timeLeftMs);
  }

  function sync(): void {
    const d = play.current;
    probe.word = d?.word ?? '';
    const g = d?.guide() ?? null;
    probe.nextKey = g?.code ?? null;
    probe.nextShift = g?.shift ?? null;
    probe.ended = finishedRun || (d?.ended ?? false);
  }

  function show(v: View): void {
    view = v;
    probe.view = v;
    lobbyView.hidden = v !== 'lobby';
    runView.hidden = v === 'lobby';
    done.hidden = v !== 'done';
    root.dataset.view = v;
  }

  function toLobby(): void {
    play.halt();
    run = null;
    rule = null;
    finishedRun = true;
    lobbyView.replaceChildren(lobby());
    root.classList.remove('modes--fog');
    show('lobby');
    ctx.audio.music('study');
    probe.ended = false;
    probe.outcome = null;
    startBtn.focus();
  }

  function begin(): void {
    notice.textContent = '';
    const profile = ctx.profile;
    const known = knownKeysOf(profile);
    const language = profile.layout;
    remembered = { ...choices, mods: new Set(choices.mods) };
    kindOfRun = choices.mode;
    keys = [];
    started = false;
    finishedRun = false;
    suddenDone = false;
    suddenAt = -1;
    focusLine = '';
    probe.score = 0;
    probe.outcome = null;
    probe.empty = false;
    probe.board = null;
    probe.ghostScore = null;
    recorder.reset();
    ghostMs = 0;
    ghostMarks = [];
    ghostKey = '';
    probe.guide = settings.keyboardGuide;
    play.setGuideMode(settings.keyboardGuide);
    done.hidden = true;

    if (kindOfRun === 'practice') {
      const rng = seededRng((Date.now() ^ 0x9e3779b9) >>> 0);
      const plan = {
        kind: choices.kind,
        minutes: choices.minutes,
        lessonId: choices.lessonId,
        custom: choices.custom,
      };
      const text = practiceText(profile, plan, Date.now(), rng);
      const clean = learnedOnly(text.text, known);
      if (clean === '') {
        probe.empty = true;
        notice.textContent = t.t('modes.practice.empty');
        return;
      }
      rule = null;
      run = null;
      mods = [];
      historyKey = modeHistoryKey('practice', choices.kind);
      titleEl.textContent = t.t('modes.mode.practice');
      subEl.textContent = name(`modes.practice.kind.${choices.kind}`);
      focusLine = text.fallback
        ? t.t('modes.practice.fallback')
        : text.focus.length > 0
          ? t.t('modes.practice.focus', { keys: text.focus.join(' ') })
          : '';
      modsEl.replaceChildren(...(focusLine ? [h('span', { text: focusLine })] : []));
      root.classList.remove('modes--fog');
      play.begin({ next: () => clean }, 'once', language, { hardcore: false });
      probe.region = '';
      probe.mods = '';
      probe.goal = 0;
      show('run');
      setMeter();
      sync();
      return;
    }

    // Time Attack, Survival and the Daily Challenge.
    let region: RegionId;
    let level: LevelId;
    let difficulty: DifficultyId;
    let kind: RuleKind;
    let rng: () => number;
    if (kindOfRun === 'daily') {
      const plan = todaysPlan();
      rule = dailyRules(plan);
      region = plan.region;
      level = plan.level;
      difficulty = plan.difficulty;
      kind = plan.kind;
      mods = [...plan.modifiers];
      rng = seededRng(plan.seed);
      historyKey = modeHistoryKey('daily', plan.date);
      suddenAt = mods.includes('sudden') ? suddenAfter(seededRng(plan.seed ^ 0x5bd1e995)) : -1;
    } else {
      kind = kindOfRun === 'survival' ? 'survival' : 'timeattack';
      region = choices.region;
      level = choices.level;
      difficulty = choices.difficulty;
      rule = rulesFor(kind, level, difficulty);
      mods = MODIFIER_IDS.filter((m) => choices.mods.has(m));
      rng = seededRng((Date.now() ^ 0x85ebca6b) >>> 0);
      historyKey = modeHistoryKey(kindOfRun, `${region}:${level}`, difficulty);
      suddenAt = mods.includes('sudden') ? suddenAfter(rng) : -1;
    }
    const diff = DIFFICULTIES[difficulty];
    const source = withModifiers(
      levelWordSource(profile, LEVELS[level], diff, rng),
      mods,
      known,
      language,
    );
    run = new ModeRun(rule);
    if (kindOfRun === 'timeattack' || kindOfRun === 'daily') {
      ghostKey = boardKey(kindOfRun, historyKey);
      const rival = bestGhost(ctx.profile, ghostKey);
      ghostMarks = rival?.marks ?? [];
      probe.ghostScore = rival?.score ?? null;
    }
    const view2 = viewOf(mods);
    root.classList.toggle('modes--fog', view2.fog);
    titleEl.textContent =
      kindOfRun === 'daily'
        ? `${t.t('modes.mode.daily')} · ${name(`modes.rule.${kind}`)}`
        : name(`modes.mode.${kindOfRun}`);
    subEl.textContent = `${name(`region.${region}`)} · ${name(`range.level.${level}`)} · ${name(`range.difficulty.${difficulty}`)}`;
    modsEl.replaceChildren(...mods.map((m) => status(name(`modes.mod.${m}`), 'gold')));
    probe.region = region;
    probe.mods = mods.join(',');
    // T34: Practice keeps the desk's quiet tune; the other runs play their setting's own theme.
    ctx.audio.music(modeTheme(kindOfRun, region));
    probe.goal = rule.goalWords;
    play.begin(source, 'endless', language, {
      hardcore: diff.failOnError,
      hideLookahead: view2.hideLookahead,
    });
    last = clock();
    show('run');
    setMeter();
    sync();
  }

  play.onJudged = (k) => {
    keys.push(k);
    if (run && !finishedRun) {
      started = true;
      recorder.key(ghostMs);
      run.key(k.correct);
    }
    sync();
  };

  play.onWord = (w) => {
    if (run && !finishedRun) {
      run.word(w.perfect);
      recorder.word(ghostMs);
      if (!suddenDone && suddenAt >= 0 && run.state.words >= suddenAt) {
        suddenDone = true;
        play.setGuideMode('off');
        probe.guide = 'off';
        play.hud.announce(t.t('modes.suddenCall'));
      }
      setMeter();
    }
  };

  play.onEnd = (end) => {
    // Practice finishing its text, or Sofer's Trial failing on a wrong key.
    if (finishedRun) return;
    finish(end, run?.state.outcome ?? (end.failed ? 'failed' : null));
  };

  function finishIfEnded(): void {
    if (!run || finishedRun) return;
    const s = run.state;
    if (!s.ended || s.outcome === null) return;
    const d = play.current;
    if (!d) return;
    const end: RunEnd = {
      metrics: d.metrics(clock()),
      bestCombo: d.bestCombo,
      words: d.wordsDone,
      failed: s.outcome === 'failed' || s.outcome === 'tired',
    };
    finish(end, s.outcome);
  }

  function finish(end: RunEnd, outcome: RunOutcome | null): void {
    if (finishedRun) return;
    finishedRun = true;
    play.halt();
    const m = end.metrics;
    const now = Date.now();
    const fresh = kindOfRun !== 'practice';
    const prefix = kindOfRun === 'daily' ? historyKey : `mode:${kindOfRun}:`;
    const before = fresh ? bestScoreOf(ctx.profile.history, prefix) : 0;
    let gain: RunGain | null = null;
    const okRun =
      outcome === null || outcome === 'time' || outcome === 'quota' || outcome === 'crossed';
    ctx.saves.update((p) => {
      gain = bankLesson(p, m.keystrokes, m.accuracy, okRun);
      // Every key feeds the adaptive engine; only statistics are kept, never the text.
      let prev: string | undefined;
      let at = 0;
      for (const k of keys) {
        const ms = Math.max(0, k.at - at);
        at = k.at;
        const r = recordKeystroke(
          p,
          { expected: k.expected, typed: k.typed, ms: prev === undefined ? 0 : ms, prev },
          now,
        );
        p.keys = r.keys;
        p.srs = r.srs;
        prev = k.expected;
      }
      if (ghostKey !== '' && okRun) {
        probe.board = addToBoard(
          p,
          ghostKey,
          makeRecord(
            {
              score:
                kindOfRun === 'daily'
                  ? dailyScore(Math.round(m.netWpm), m.accuracy)
                  : modeScore(m.keystrokes, m.accuracy),
              wpm: Math.round(m.netWpm),
              accuracy: m.accuracy,
              durationMs: m.elapsedMs,
              marks: recorder.trace(),
            },
            p.name,
            now,
          ),
        );
      }
      p.history.push({
        at: now,
        track: p.track,
        mode: historyKey,
        wpm: Math.round(m.netWpm),
        accuracy: m.accuracy,
        durationMs: m.elapsedMs,
        chars: m.keystrokes,
      });
    });
    void ctx.saves.flush();
    probe.saved += 1;
    const score =
      kindOfRun === 'daily'
        ? dailyScore(Math.round(m.netWpm), m.accuracy)
        : kindOfRun === 'practice'
          ? 0
          : modeScore(m.keystrokes, m.accuracy);
    probe.score = score;
    probe.outcome = outcome ?? 'practice';
    probe.ended = true;
    const ok =
      outcome === null || outcome === 'time' || outcome === 'quota' || outcome === 'crossed';
    ctx.audio.play(ok ? 'success' : 'ui-error');
    setMeter();
    showDone(end, outcome, score, score > before && before > 0, gain);
  }

  function showDone(
    end: RunEnd,
    outcome: RunOutcome | null,
    score: number,
    newBest: boolean,
    gain: RunGain | null = null,
  ): void {
    const m = end.metrics;
    const ok =
      outcome === null || outcome === 'time' || outcome === 'quota' || outcome === 'crossed';
    const key = (outcome ?? 'practice') as string;
    const body: HTMLElement[] = [
      h('p', { class: 'modes__verdict' }, status(name(`modes.out.${key}`), ok ? 'ok' : 'warn')),
    ];
    if (kindOfRun !== 'practice') {
      const diffId = rule?.difficulty.id ?? 'steady';
      const rank = rankOf(
        m.accuracy,
        m.netWpm,
        DIFFICULTIES[diffId],
        outcome === 'failed' || outcome === 'tired',
      );
      body.push(h('div', { class: 'modes__rank' }, rankBadge(rank, t.t('rank.label', { rank }))));
    }
    const tiles = [
      statTile({ label: t.t('hud.accuracy'), value: m.accuracy, unit: '%', gold: ok }),
      statTile({ label: t.t('hud.wpm'), value: Math.round(m.netWpm) }),
      statTile({ label: t.t('hud.combo'), value: end.bestCombo }),
    ];
    if (kindOfRun !== 'practice') {
      tiles.push(statTile({ label: t.t('modes.score'), value: score, gold: true }));
    } else {
      tiles.push(statTile({ label: t.t('modes.words', { n: end.words }), value: end.words }));
    }
    body.push(h('div', { class: 'modes__stats' }, ...tiles));
    if (gain) body.push(earnedRow(t, gain, gain));
    if (newBest) body.push(h('p', { class: 'modes__newbest', text: t.t('modes.newBest') }));
    if (probe.board && probe.board.place > 0) {
      body.push(
        h('p', {
          class: 'modes__newbest',
          text: probe.board.newBest
            ? t.t('ghost.newBest')
            : t.t('ghost.place', { place: probe.board.place }),
        }),
      );
    }
    const again = button({ label: t.t('modes.again'), variant: 'primary', onClick: begin });
    again.append(keycap('Enter', 'plain', 'sm'));
    const lobbyBtn = button({ label: t.t('modes.lobby'), onClick: toLobby });
    const home = button({ label: t.t('modes.home'), onClick: () => ctx.go('hub') });
    done.replaceChildren(
      h('h2', { class: 'modes__done-title', text: titleEl.textContent ?? '' }),
      ...body,
      h('div', { class: 'modes__actions modes__actions--end' }, again, lobbyBtn, home),
    );
    show('done');
    again.focus();
  }

  const tick = (now: number): void => {
    if (disposed) return;
    raf = requestAnimationFrame(tick);
    if (view !== 'run') return;
    play.frame(now);
    if (run && started && !finishedRun) {
      ghostMs += now - last;
      run.tick(now - last);
      setMeter();
      finishIfEnded();
    }
    last = now;
  };
  raf = requestAnimationFrame(tick);

  probe.step = (seconds: number): void => {
    if (!run || finishedRun) return;
    started = true;
    ghostMs += seconds * 1000;
    run.tick(seconds * 1000);
    setMeter();
    finishIfEnded();
  };

  startBtn.addEventListener('click', begin);
  lobbyView.replaceChildren(lobby());
  show('lobby');
  ctx.audio.music('study');

  return {
    el: root,
    full: true,
    onKey(ev) {
      if (view !== 'run' || finishedRun) return false;
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return false;
      if (ev.key === 'Enter' || ev.key === 'Tab') return false;
      const used = play.key(ev, performance.now());
      if (used) {
        sync();
        finishIfEnded();
      }
      return used;
    },
    onEscape() {
      if (view === 'lobby') return false;
      toLobby();
      return true;
    },
    focus() {
      startBtn.focus();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      play.dispose();
    },
  };
}
