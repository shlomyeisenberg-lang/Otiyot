// The Silent Arena screen (#/arena, opened from the hub's map once the Cliffs are restored): the
// fight with the Great Blot, the first boss and the end of Act One. Hosts the engine and the
// Arena scene, plans the fight from learned letters only, runs the fight's state (BossFight:
// attacks, parries, weak points, phases), carries the streak from phase to phase, keeps a
// checkpoint at each new phase on Calm, Steady and Swift, plays the cinematic transitions with
// a phase card, and ends with the victory cutscene and a results card. The 3D code is loaded on
// demand, so the menus never pay for it.

import { knownKeysOf } from '../../learn';
import { ComboRules, dropTiers } from '../../game/combo';
import { DIFFICULTIES, DIFFICULTY_IDS, type DifficultyId } from '../../game/difficulty';
import { LEVEL_IDS, LEVELS, levelWordSource, levelsFor, type LevelId } from '../../game/levels';
import {
  BossFight,
  checkpointFlag,
  checkpointOf,
  clearCheckpoints,
  keepsCheckpoints,
  mergeMetrics,
  type BossEvent,
  type BossPlan,
} from '../../game/boss';
import type { BossDef } from '../../game/boss';
import { recordRegionRank, regionMode, regionStatuses, type RegionId } from '../../game/regions';
import { rewardsOf, type RunRank, type RunRewards } from '../../game/results';
import type { Metrics } from '../../core';
import type { Engine, GameScene, SceneManager } from '../../engine';
import type { Profile } from '../../save';
import type { BossLookId } from '../../scenes/arena/palette';
import { GREAT_BLOT, planGreatBlot, type BlotInput } from '../../scenes/arena/plan';
import {
  ACT_TWO,
  apprenticeLook,
  type ApprenticeLook,
  arenaLine,
  BLOT_VICTORY,
  CAST,
  CutscenePlayer,
  type ArenaMoment,
  type Beat,
  type Cutscene,
  type Line,
} from '../../story';
import type { AppContext, Route, Screen } from '../app';
import { button, dialogueBox, rankBadge, statTile, status } from '../components';
import { h } from '../dom';
import type { MessageKey } from '../i18n';
import { PlayController, type RunEnd } from '../play';
import { resolveTheme } from '../theme';

/** How long a line stays up, and how long a small remark waits after a phase's line. */
const LINE_MS = 7000;
const MAJOR_HOLD_MS = 3500;
/** The pause on the last word before the victory cutscene, and before a failed trial's card. */
const VICTORY_DELAY_MS = 1300;
const FAILED_DELAY_MS = 1200;
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];

/** A moment worth a line: the arena's shared ones, or a boss's own ('special': its trick). */
export type BossMoment = ArenaMoment | 'special';

/**
 * One boss fight in the Silent Arena, as the screen needs it (T26). The Great Blot is one; the
 * three trials (src/ui/screens/trials.ts) are the others. The screen is the same for all of them.
 */
/**
 * What the boss screen needs from the 3D scene a fight is staged in: the Silent Arena, or the
 * Blank Scroll (T27). The scene only reacts; the screen runs the fight.
 */
export interface BossStage extends GameScene {
  /** Called first in every fixed step (the screen runs the fight's clock and the cutscene). */
  onStep: ((dt: number) => void) | null;
  onTransitionEnd: (() => void) | null;
  readonly restored: boolean;
  readonly blotBroken: boolean;
  watch(fight: BossFight): void;
  land(): void;
  parry(weak: boolean): void;
  heal(amount: number): void;
  stagger(): void;
  transition(to: number): void;
  victory(): void;
  failed(): void;
  shotFor(name: string): void;
  cue(name: string): void;
}

/** Credits typed by the player after the ending (T27). */
export interface BossCredits {
  /** The words to type, from the player's learned letters; one credit line appears per word. */
  plan(o: BlotInput): string[];
  /** The credit lines, in order (already translated). */
  lines(): string[];
  title: string;
  hint: string;
}

export interface BossConfig {
  /** The boss's id (its checkpoints are kept under it). */
  key: string;
  /** Who stands on the stage. */
  look: BossLookId | 'scroll';
  /** The scene the fight is staged in (default: the Silent Arena with `look`). Loaded on demand. */
  stage?: () => Promise<(look: ApprenticeLook) => BossStage>;
  /** The name on the health bar in a phase (default: `name`). */
  nameAt?(phase: number): string;
  /** The line that opens a phase (default: the `line` of the phase's id). */
  phaseLine?(phase: number): Line | null;
  /** A line for a weak point struck clean at word `word` of `phase` (said once per speaker). */
  weakLine?(plan: BossPlan, phase: number, word: number): Line | null;
  /** Announced when the word now up is a weak point (who calls it). */
  call?(plan: BossPlan, phase: number, word: number): string | null;
  /** The moment named when a slip gives health back (default 'special': the Golem's trick). */
  healMoment?: BossMoment;
  /** After the victory cutscene the credits are typed (T27). */
  credits?: BossCredits;
  /** The loading line (default: the arena's). */
  loading?: string;
  def: BossDef;
  plan(o: BlotInput): BossPlan;
  /** The region whose levels are suggested; history entries are written under `mode`. */
  region: RegionId;
  mode(level: LevelId, difficulty: DifficultyId): string;
  /** History entries of this boss start with this (its last difficulty is offered again). */
  modePrefix: string;
  testid: string;
  /** Texts (already translated): the boss's name, a phase's name and how to fight it. */
  name: string;
  phaseName(i: number): string;
  phaseHow(i: number): string;
  line(moment: BossMoment, n: number): Line;
  victory: Cutscene;
  /** The card at the end of the victory cutscene. */
  card(): { kicker: string; title: string };
  /** Was this boss beaten before? */
  beaten(p: Profile): boolean;
  /** Records a win (inside a save update). Returns the note for the results card, or null. */
  win(p: Profile, rank: RunRank): string | null;
  /** Where to go after the fight, and the button's labels (plain, and with "(Enter)"). */
  home: { route: Route; label: string; labelEnter: string };
}

/** The Great Blot (T16), as a boss config. */
function blotConfig(ctx: AppContext): BossConfig {
  const t = ctx.i18n;
  const lang = ctx.profile.settings.uiLanguage;
  const id = (i: number): string => GREAT_BLOT.phases[i]?.id ?? 'p1';
  return {
    key: GREAT_BLOT.id,
    look: 'blot',
    def: GREAT_BLOT,
    plan: planGreatBlot,
    region: 'blot',
    mode: (level, difficulty) => regionMode('blot', level, difficulty),
    modePrefix: `scene:${GREAT_BLOT.id}:`,
    testid: 'arena',
    name: t.t('arena.boss'),
    phaseName: (i) => t.t(`arena.phase.${id(i)}` as MessageKey),
    phaseHow: (i) => t.t(`arena.phase.how.${id(i)}` as MessageKey),
    line: (m, n) => arenaLine(m === 'special' ? 'parry' : m, n),
    victory: BLOT_VICTORY,
    card: () => ({ kicker: t.t('arena.victory'), title: ACT_TWO[lang] }),
    beaten: (p) => (p.story.ranks[GREAT_BLOT.id] ?? 0) > 0,
    win: (p, rank) => {
      const first = (p.story.ranks[GREAT_BLOT.id] ?? 0) === 0;
      recordRegionRank(p, 'blot', rank);
      p.story.flags.act2 = true;
      return first ? t.t('arena.results.restored') : null;
    },
    home: {
      route: 'hub',
      label: t.t('arena.results.home'),
      labelEnter: t.t('arena.results.homeEnter'),
    },
  };
}

interface ArenaProbe {
  ready: boolean;
  failed: boolean;
  stats: Engine['stats'] | null;
  /** The phase (0..3), how many, and the fight's state. */
  phase: number;
  phases: number;
  state: 'fight' | 'transition' | 'victory' | 'failed' | 'idle';
  /** 1 = the Blot is whole, 0 = undone. */
  health: number;
  /** 0..1: how far the attack has wound up. */
  windup: number;
  weak: boolean;
  word: string;
  /** Words finished in this phase, and words in it. */
  words: number;
  total: number;
  /** Which boss (its id) and look. */
  boss: string;
  look: BossLookId | 'scroll';
  /** Health the boss won back from slips, whether it rests, where its tide is. */
  healed: number;
  resting: boolean;
  tide: number;
  /** The text of each phase, and the keys the player has learned. */
  texts: string[];
  keys: string;
  landed: number;
  parried: number;
  checkpoint: number;
  level: LevelId;
  difficulty: DifficultyId;
  levels: LevelId[];
  line: string;
  nextKey: string | null;
  nextShift: string | null;
  /** The victory cutscene: playing, its beat, a line waiting for Enter. */
  cutscene: { playing: boolean; beat: string; waiting: boolean; done: boolean };
  restored: boolean;
  blotBroken: boolean;
  results: (RunRewards & { accuracy: number; wpm: number; failed: boolean }) | null;
  leaked: number | null;
  sceneLeak: number;
  /** The typed credits (T27): on, words typed, words in all, lines shown. */
  credits: { on: boolean; typed: number; total: number; lines: number; done: boolean };
  step: (seconds: number) => void;
}

declare global {
  interface Window {
    __otiyotArena?: ArenaProbe;
  }
}

export function arenaScreen(ctx: AppContext): Screen {
  return bossScreen(ctx, blotConfig(ctx));
}

/** A boss fight in the Silent Arena: the Great Blot or one of the trials. */
export function bossScreen(ctx: AppContext, cfg: BossConfig): Screen {
  const t = ctx.i18n;
  const profile = ctx.profile;
  const settings = profile.settings;
  const layout = profile.layout;
  const lang = settings.uiLanguage;
  const bossId = cfg.key;
  const DEF = cfg.def;

  // --- What this player may play, and what he played last time.
  const own = profile.history.filter((e) => e.mode.startsWith(cfg.modePrefix));
  const lastDifficulty = own.at(-1)?.mode.split(':')[3] ?? '';
  let difficulty: DifficultyId = (DIFFICULTY_IDS as readonly string[]).includes(lastDifficulty)
    ? (lastDifficulty as DifficultyId)
    : 'calm';
  let openLevels: LevelId[] = levelsFor(profile);
  const statusNow = (): LevelId =>
    regionStatuses(ctx.profile).find((s) => s.id === cfg.region)?.suggested ?? 'easy';
  let suggested: LevelId = statusNow();
  let level: LevelId = openLevels.includes(suggested) ? suggested : 'easy';
  const restoredBefore = cfg.beaten(profile);

  // --- The page.
  const view = h('div', { class: 'meadow__view' });
  const loading = h('p', { class: 'meadow__loading', text: cfg.loading ?? t.t('arena.loading') });
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

  // The Blot's health: an erased-to-restored bar under its name, notched at each phase.
  const bossFill = h('span', { class: 'arena__fill' });
  const bossTrack = h('div', { class: 'arena__track', 'aria-hidden': 'true' }, bossFill);
  const bossPhase = h('span', { class: 'arena__phase' });
  const bossName = h('span', { class: 'arena__name', text: cfg.name });
  const nameNow = (): string => (fight && cfg.nameAt ? cfg.nameAt(fight.phase) : cfg.name);
  const boss = h(
    'div',
    { class: 'arena__boss', role: 'meter', 'aria-valuemin': '0', 'aria-valuemax': '100' },
    h('div', { class: 'arena__boss-head' }, bossName, bossPhase),
    bossTrack,
  );
  boss.hidden = true;

  // The phase card shown during a transition, and the act card after the victory.
  const cardKicker = h('span', { class: 'arena__card-kicker' });
  const cardTitle = h('span', { class: 'cutscene__card-title' });
  const cardHow = h('span', { class: 'arena__card-how' });
  const card = h(
    'div',
    { class: 'cutscene__card arena__card', 'aria-hidden': 'true' },
    h('div', { class: 'arena__card-inner' }, cardKicker, cardTitle, cardHow),
  );
  card.hidden = true;
  const barTop = h('div', { class: 'cutscene__bar cutscene__bar--top' });
  const barBottom = h('div', { class: 'cutscene__bar cutscene__bar--bottom' });

  const options = h('div', {
    class: 'meadow__options',
    role: 'dialog',
    'aria-label': t.t('arena.options'),
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
  // The victory cutscene's own dialogue box (at the bottom, between the letterbox bars).
  const story = dialogueBox({
    speaker: '',
    text: '',
    nextHint: t.t('common.continue'),
    nextKey: 'Enter',
    onNext: () => advanceStory(),
  });
  story.el.classList.add('cutscene__dialogue', 'arena__story');
  story.el.hidden = true;
  story.el.addEventListener('click', () => advanceStory());
  const skip = button({
    label: t.t('arena.skip'),
    small: true,
    variant: 'quiet',
    onClick: () => skipStory(),
  });
  const skipWrap = h('div', { class: 'cutscene__skip' }, skip);
  skipWrap.hidden = true;
  // The typed credits (T27): one line appears for every word typed.
  const creditsList = h('ol', { class: 'credits__list' });
  const creditsEl = h(
    'div',
    { class: 'credits', 'data-testid': 'credits', role: 'region', hidden: true },
    h('p', { class: 'credits__title', text: cfg.credits?.title ?? '' }),
    creditsList,
    h('p', { class: 'credits__hint', text: cfg.credits?.hint ?? '' }),
  );

  const el = h(
    'section',
    {
      class: 'meadow arena',
      'data-testid': cfg.testid,
      'data-boss': cfg.look,
      'aria-label': cfg.name,
    },
    view,
    barTop,
    barBottom,
    card,
    boss,
    top,
    speech.el,
    story.el,
    skipWrap,
    creditsEl,
    options,
    loading,
    live,
  );

  const probe: ArenaProbe = {
    ready: false,
    failed: false,
    stats: null,
    phase: 0,
    phases: DEF.phases.length,
    boss: bossId,
    look: cfg.look,
    healed: 0,
    resting: false,
    tide: 0,
    state: 'idle',
    health: 1,
    windup: 0,
    weak: false,
    word: '',
    words: 0,
    total: 0,
    texts: [],
    keys: '',
    landed: 0,
    parried: 0,
    checkpoint: 0,
    level,
    difficulty,
    levels: openLevels,
    line: '',
    nextKey: null,
    nextShift: null,
    cutscene: { playing: false, beat: '', waiting: false, done: false },
    restored: false,
    blotBroken: false,
    results: null,
    leaked: null,
    sceneLeak: 0,
    credits: { on: false, typed: 0, total: 0, lines: 0, done: false },
    step: (seconds) => engine?.simulate(seconds),
  };
  Object.defineProperties(probe, {
    phase: { get: () => fight?.phase ?? 0, enumerable: true },
    state: { get: () => fight?.state ?? 'idle', enumerable: true },
    health: { get: () => fight?.health ?? 1, enumerable: true },
    windup: { get: () => fight?.windup ?? 0, enumerable: true },
    weak: { get: () => fight?.weakNow ?? false, enumerable: true },
    landed: { get: () => fight?.landed ?? 0, enumerable: true },
    parried: { get: () => fight?.parried ?? 0, enumerable: true },
    restored: { get: () => scene?.restored ?? false, enumerable: true },
    blotBroken: { get: () => scene?.blotBroken ?? false, enumerable: true },
    healed: { get: () => fight?.healedTotal ?? 0, enumerable: true },
    resting: { get: () => fight?.resting ?? false, enumerable: true },
    tide: { get: () => fight?.tideNow ?? 0, enumerable: true },
    // The scene itself, for smoke tests (not enumerable: the probe stays serializable).
    scene: { get: () => scene, enumerable: false },
  });
  window.__otiyotArena = probe;

  let engine: Engine | null = null;
  let manager: SceneManager | null = null;
  let scene: BossStage | null = null;
  let disposed = false;
  let cleanup: (() => void) | null = null;
  let rngNext: () => number = Math.random;
  let plan: BossPlan | null = null;
  let fight: BossFight | null = null;
  let parts: Metrics[] = [];
  let wordsAll = 0;
  let perfectWords = 0;
  let bestCombo = 0;
  let carry = 0;
  let over = false;
  let firstRestore = false;
  let slipSaid = false;
  let comboSaid = false;
  let landSaid = false;
  let parrySaid = false;
  let staggerSaid = false;
  let specialSaid = false;
  let winNote: string | null = null;
  let resultsTimer = 0;
  let victoryTimer = 0;
  let lineTimer = 0;
  let cardTimer = 0;
  let lastMajor = -Infinity;
  let lineCount = 0;
  let player: CutscenePlayer | null = null;
  let creditsOn = false;
  let creditsTimer = 0;
  const weakSaid = new Set<string>();

  const play = new PlayController(t, layout, settings, settings.keyboardGuide);
  view.append(play.hud.el, results);

  // --- Lines from Reb Ezra and Dyo. A small remark never talks over a phase's line.
  function say(moment: BossMoment, minor = false): void {
    if (player) return;
    const now = performance.now();
    if (minor && now - lastMajor < MAJOR_HOLD_MS) return;
    if (!minor) lastMajor = now;
    sayLine(cfg.line(moment, lineCount++), moment);
  }
  function sayLine(line: Line, moment: string): void {
    if (player) return;
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

  let lastHealth = -1;
  let lastPhaseShown = -1;
  const sync = (): void => {
    const d = play.current;
    const f = fight;
    probe.word = d?.word ?? '';
    probe.words = d?.wordsDone ?? 0;
    probe.total = d?.totalWords ?? 0;
    const next = d && !d.ended ? d.guide() : null;
    const typingNow = creditsOn || f?.state === 'fight';
    probe.nextKey = typingNow ? (next?.code ?? null) : null;
    probe.nextShift = typingNow ? (next?.shift ?? null) : null;
    const phase = f?.phase ?? 0;
    chipTitle.textContent = f?.state === 'victory' ? cfg.card().kicker : cfg.phaseName(phase);
    chipCount.textContent = `${t.t('arena.phase', { n: phase + 1, total: DEF.phases.length })} · ${t.t('arena.word', { n: Math.min(probe.words + 1, Math.max(1, probe.total)), total: probe.total })}`;
    const share = probe.total > 0 ? probe.words / probe.total : 0;
    (bar.firstElementChild as HTMLElement).style.inlineSize = `${Math.round(share * 100)}%`;
    optionsButton.textContent = t.t('range.results.sub', {
      difficulty: t.t(`range.difficulty.${difficulty}` as MessageKey),
      level: t.t(`range.level.${level}` as MessageKey),
    });
    live.textContent =
      probe.word && (creditsOn || (!over && f?.state === 'fight'))
        ? t.t('range.typeWord', { word: probe.word })
        : '';
    syncBoss();
  };

  /** The health bar: drawn only when it changes (every animation frame calls this). */
  function syncBoss(): void {
    const f = fight;
    if (!f) return;
    const health = f.health;
    if (health !== lastHealth) {
      lastHealth = health;
      const restored = Math.round((1 - health) * 100);
      bossFill.style.inlineSize = `${restored}%`;
      boss.setAttribute('aria-valuenow', String(100 - restored));
      boss.setAttribute('aria-label', t.t('arena.health', { name: nameNow(), n: 100 - restored }));
    }
    if (f.phase !== lastPhaseShown) {
      lastPhaseShown = f.phase;
      bossName.textContent = nameNow();
      lastHealth = -1;
      bossPhase.textContent = `${ROMAN[f.phase] ?? ''} · ${cfg.phaseName(f.phase)}`;
      bossTrack.querySelectorAll('.arena__notch').forEach((n) => n.remove());
      f.notches.forEach((at, i) => {
        const n = h('span', { class: 'arena__notch' });
        n.style.insetInlineStart = `${Math.round(at * 1000) / 10}%`;
        n.dataset.passed = String(i < f.phase);
        bossTrack.append(n);
      });
    }
    boss.dataset.weak = String(f.weakNow);
    boss.dataset.windup = f.windup > 0.66 ? 'high' : 'low';
    boss.dataset.resting = String(f.resting);
  }

  // --- The fight.

  /** A new fight: plans the text, starts at the checkpoint when there is one. */
  const startRun = (fromCheckpoint = true): void => {
    if (!scene) return;
    window.clearTimeout(resultsTimer);
    window.clearTimeout(victoryTimer);
    window.clearTimeout(cardTimer);
    window.clearTimeout(creditsTimer);
    endStory(false);
    creditsOn = false;
    creditsEl.hidden = true;
    weakSaid.clear();
    results.hidden = true;
    options.hidden = true;
    card.hidden = true;
    optionsButton.setAttribute('aria-expanded', 'false');
    const d = DIFFICULTIES[difficulty];
    const keys = knownKeysOf(ctx.profile);
    const words = levelWordSource(ctx.profile, LEVELS[level], d, rngNext);
    plan = cfg.plan({ layout, keys, level, words, rng: rngNext });
    const from =
      fromCheckpoint && keepsCheckpoints(difficulty)
        ? checkpointOf(ctx.profile.story.flags, bossId, plan.phases.length)
        : 0;
    if (!fromCheckpoint) {
      ctx.saves.update((p) => clearCheckpoints(p.story.flags, bossId));
    }
    fight = new BossFight(plan, d, from);
    parts = [];
    wordsAll = 0;
    perfectWords = 0;
    bestCombo = 0;
    carry = 0;
    over = false;
    slipSaid = false;
    comboSaid = false;
    landSaid = false;
    parrySaid = false;
    staggerSaid = false;
    specialSaid = false;
    lastHealth = -1;
    lastPhaseShown = -1;
    probe.results = null;
    probe.level = level;
    probe.difficulty = difficulty;
    probe.texts = plan.phases.map((p) => p.text);
    probe.keys = [...keys].join('');
    probe.checkpoint = from;
    probe.cutscene = { playing: false, beat: '', waiting: false, done: false };
    probe.credits = { on: false, typed: 0, total: 0, lines: 0, done: false };
    scene.watch(fight);
    boss.hidden = false;
    top.hidden = false;
    beginPhase();
    if (from > 0) {
      play.hud.announce(t.t('arena.checkpoint', { n: ROMAN[from] ?? from + 1 }));
      say('checkpoint');
    }
  };

  /** Hands the current phase's text to the typing driver; the streak carries over. */
  function beginPhase(): void {
    const f = fight;
    const d = DIFFICULTIES[difficulty];
    if (!f) return;
    const text = f.current.text;
    play.begin({ next: () => text }, 'once', layout, {
      hardcore: d.failOnError ? true : undefined,
      combo: new ComboRules({ errorTiers: d.errorTiers }),
    });
    if (carry > 0) play.setCombo(carry);
    announceCall();
    sync();
  }

  /** The word now up is a weak point: say who calls it (the Keeper's fight, T27). */
  function announceCall(): void {
    const f = fight;
    if (!f || !plan || !cfg.call || !f.weakNow) return;
    const text = cfg.call(plan, f.phase, f.word);
    if (text) play.hud.announce(text);
  }

  /** A weak point struck clean: its caller's line, once for each speaker. */
  function sayWeak(): boolean {
    const f = fight;
    if (!f || !plan || !cfg.weakLine) return false;
    const line = cfg.weakLine(plan, f.phase, f.word - 1);
    if (!line || weakSaid.has(line.who)) return !!line;
    weakSaid.add(line.who);
    sayLine(line, 'stagger');
    return true;
  }

  const handle = (e: BossEvent): void => {
    if (!scene) return;
    switch (e.kind) {
      case 'land': {
        scene.land();
        const now = play.current?.combo ?? 0;
        play.setCombo(dropTiers(now, DIFFICULTIES[difficulty].smudgeTiers));
        if (!landSaid) {
          landSaid = true;
          say('land', true);
        }
        sync();
        break;
      }
      case 'parry':
        scene.parry(e.weak);
        if (e.weak) {
          play.hud.announce(t.t('arena.weak'));
          if (sayWeak()) break;
          if (!staggerSaid) {
            staggerSaid = true;
            say('stagger', true);
          }
        } else if (!parrySaid) {
          parrySaid = true;
          say('parry', true);
        }
        break;
      case 'stagger':
        scene.stagger();
        play.hud.announce(t.t('arena.weak'));
        if (sayWeak()) break;
        if (!staggerSaid) {
          staggerSaid = true;
          say('stagger', true);
        }
        break;
      default:
        break;
    }
  };

  /** A phase is typed to its end: the cinematic, then the next phase (or the victory). */
  const phaseOver = (end: RunEnd): void => {
    const f = fight;
    if (!f || !scene || over) return;
    parts.push(end.metrics);
    wordsAll += end.words;
    bestCombo = Math.max(bestCombo, end.bestCombo);
    if (end.failed) {
      f.fail();
      finish(true);
      return;
    }
    if (f.state === 'victory') {
      finish(false);
      return;
    }
    // Transition: the streak waits for the next phase; a checkpoint is kept on gentler fights.
    carry = play.current?.combo ?? 0;
    const next = f.phase + 1;
    scene.transition(next);
    if (keepsCheckpoints(difficulty)) {
      ctx.saves.update((p) => {
        p.story.flags[checkpointFlag(bossId, next)] = true;
      });
      void ctx.saves.flush();
    }
    hideLine();
    showCard(
      t.t('arena.phase', { n: next + 1, total: DEF.phases.length }),
      cfg.phaseName(next),
      cfg.phaseHow(next),
    );
    sync();
  };

  function showCard(kicker: string, title: string, how: string): void {
    cardKicker.textContent = kicker;
    cardTitle.textContent = title;
    cardHow.textContent = how;
    // Restart the card's animation.
    card.hidden = true;
    void card.offsetWidth;
    card.hidden = false;
    live.textContent = `${kicker}: ${title}. ${how}`;
    window.clearTimeout(cardTimer);
    cardTimer = window.setTimeout(() => {
      card.hidden = true;
    }, 2900);
  }

  const afterTransition = (): void => {
    const f = fight;
    if (!f || f.state !== 'transition') return;
    f.nextPhase();
    beginPhase();
    const opening = cfg.phaseLine?.(f.phase);
    if (opening) sayLine(opening, f.def.id);
    else say(f.def.id as ArenaMoment);
  };

  /** The fight is over: saved at once, then the victory cutscene (or the failed card). */
  const finish = (failed: boolean): void => {
    if (over || !plan) return;
    over = true;
    const m = mergeMetrics(parts);
    const accuracy = m.accuracy;
    const wpm = Math.round(m.netWpm);
    const r = rewardsOf(
      {
        accuracy,
        wpm,
        bestCombo,
        words: wordsAll,
        perfect: perfectWords,
        broken: fight?.parried ?? 0,
        smudges: fight?.landed ?? 0,
        failed,
      },
      DIFFICULTIES[difficulty],
      level,
    );
    probe.results = { ...r, accuracy, wpm, failed };
    firstRestore = !failed && !cfg.beaten(ctx.profile);
    winNote = null;
    ctx.saves.update((p) => {
      p.history.push({
        at: Date.now(),
        track: p.track,
        mode: cfg.mode(level, difficulty),
        wpm,
        accuracy,
        durationMs: Math.round(m.elapsedMs),
        chars: m.keystrokes,
      });
      if (!failed) {
        winNote = cfg.win(p, r.rank);
        clearCheckpoints(p.story.flags, bossId);
      }
    });
    void ctx.saves.flush();
    openLevels = levelsFor(ctx.profile);
    suggested = statusNow();
    probe.levels = openLevels;
    hideLine();
    if (failed) {
      scene?.failed();
      say('failed');
      resultsTimer = window.setTimeout(showResults, FAILED_DELAY_MS);
    } else {
      scene?.victory();
      victoryTimer = window.setTimeout(startStory, VICTORY_DELAY_MS);
    }
    sync();
  };

  // --- The victory cutscene.

  function startStory(): void {
    if (disposed || !scene) return;
    hideLine();
    top.hidden = true;
    boss.hidden = true;
    play.hud.el.hidden = true;
    el.dataset.cinema = 'true';
    skipWrap.hidden = false;
    probe.cutscene = { playing: true, beat: '', waiting: false, done: false };
    player = new CutscenePlayer(cfg.victory, {
      lang,
      speed: settings.textSpeed,
      listener: {
        beat: (b) => onBeat(b),
        end: () => endStory(true),
      },
    });
    player.start();
  }

  function onBeat(b: Beat): void {
    probe.cutscene.beat = b.id;
    if (b.shot) scene?.shotFor(b.shot);
    if (b.cue) scene?.cue(b.cue);
    if (b.cue === 'card') {
      const c = cfg.card();
      showCard(c.kicker, c.title, '');
    }
    if (b.say) {
      const who = CAST[b.say.who];
      const line = b.say.text[lang];
      story.setLine(who.name[lang], line, undefined, who.portrait);
      story.reveal(0);
      story.setWaiting(false);
      story.el.hidden = false;
      live.textContent = `${who.name[lang]}: ${line}`;
    } else {
      story.el.hidden = true;
    }
  }

  function advanceStory(): void {
    if (!player || player.done) return;
    if (player.advance() === 'next') ctx.audio.play('ui-move');
  }

  function skipStory(): void {
    if (!player || player.done) return;
    player.skip();
  }

  /** The cutscene ended (played or skipped): make sure the arena is restored, then the card. */
  function endStory(show: boolean): void {
    const was = player;
    player = null;
    story.el.hidden = true;
    skipWrap.hidden = true;
    delete el.dataset.cinema;
    play.hud.el.hidden = false;
    probe.cutscene.playing = false;
    if (!was) return;
    probe.cutscene.done = true;
    if (scene && !scene.restored) {
      scene.cue('shatter');
      scene.cue('restore');
    }
    scene?.shotFor('wide');
    if (show) {
      card.hidden = true;
      window.clearTimeout(resultsTimer);
      if (cfg.credits && scene) startCredits(cfg.credits);
      else resultsTimer = window.setTimeout(showResults, 400);
    }
  }

  // --- The typed credits (T27): every word typed writes one line of them.

  function startCredits(c: BossCredits): void {
    if (!scene) return;
    const keys = knownKeysOf(ctx.profile);
    const words = c.plan({
      layout,
      keys,
      level,
      words: levelWordSource(ctx.profile, LEVELS[level], DIFFICULTIES.calm, rngNext),
      rng: rngNext,
    });
    const lines = c.lines();
    creditsList.replaceChildren(
      ...lines.map((text) => {
        const li = h('li', { class: 'credits__line', text });
        li.dataset.shown = 'false';
        return li;
      }),
    );
    creditsOn = true;
    creditsEl.hidden = false;
    top.hidden = true;
    boss.hidden = true;
    probe.credits = { on: true, typed: 0, total: words.length, lines: 0, done: false };
    probe.texts = [...probe.texts, words.join(' ')];
    scene.cue('credits');
    const text = words.join(' ');
    play.begin({ next: () => text }, 'once', layout, {});
    sync();
  }

  /** A credit word is typed: the next line appears (the last word shows whatever is left). */
  function creditWord(): void {
    const c = probe.credits;
    c.typed += 1;
    const items = creditsList.children;
    const upTo = c.typed >= c.total ? items.length : Math.min(items.length, c.typed);
    for (let i = c.lines; i < upTo; i++) (items[i] as HTMLElement).dataset.shown = 'true';
    c.lines = upTo;
    const last = items[upTo - 1];
    if (last) live.textContent = last.textContent ?? '';
  }

  /** The credits are written (or skipped): the results card. */
  function endCredits(): void {
    if (!creditsOn) return;
    creditsOn = false;
    probe.credits.on = false;
    probe.credits.done = true;
    for (const li of creditsList.children) (li as HTMLElement).dataset.shown = 'true';
    scene?.cue('credits-end');
    sync();
    window.clearTimeout(creditsTimer);
    creditsTimer = window.setTimeout(() => {
      creditsEl.hidden = true;
      showResults();
    }, 1600);
  }

  /** Runs inside the scene's fixed step: the fight's clock and the cutscene. */
  const step = (dt: number): void => {
    if (player) {
      player.update(dt);
      return;
    }
    const f = fight;
    if (!f || over || f.state !== 'fight' || !options.hidden) return;
    handle(f.update(dt));
    // The Keeper's eraser, named once (T27).
    if (!specialSaid && f.erasing && f.erasedShare > 0.04) {
      specialSaid = true;
      say('special', true);
    }
    // A trial's own trick, named once: the Storm Hawk's rest, the Long Tide's high water.
    if (!specialSaid && f.parried > 0) {
      const storm = cfg.look === 'storm' && f.resting;
      const tide = cfg.look === 'tide' && f.tideNow > 0.92 && DIFFICULTIES[difficulty].timers;
      if (storm || tide) {
        specialSaid = true;
        say('special', true);
      }
    }
  };

  // --- Level and difficulty: the same choices in the options panel and on the results card.
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
        'arena.options.level',
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
        'arena.options.difficulty',
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
    h('h2', { class: 'meadow__options-title', text: t.t('arena.options') }),
    chooser(),
    h('p', { class: 'range__results-note', text: t.t('arena.options.timers') }),
    h(
      'div',
      { class: 'range__results-actions' },
      button({
        label: t.t('arena.options.restart'),
        variant: 'primary',
        onClick: () => startRun(false),
      }),
    ),
  );
  mark();
  function toggleOptions(): void {
    if (!probe.ready || player) return;
    options.hidden = !options.hidden;
    optionsButton.setAttribute('aria-expanded', String(!options.hidden));
    mark();
  }

  /** The results card: rank, numbers, what the fight earned, and where to go next. */
  function showResults(): void {
    const r = probe.results;
    if (!r || disposed) return;
    hideLine();
    top.hidden = false;
    const title = r.failed
      ? t.t('range.results.failed')
      : t.t(`range.results.title.${r.rank}` as MessageKey);
    const again = button({
      label: t.t(firstRestore ? 'arena.results.againPlain' : 'arena.results.again'),
      variant: firstRestore ? 'quiet' : 'primary',
      onClick: () => startRun(false),
    });
    again.dataset.action = 'again';
    const home = button({
      label: firstRestore ? cfg.home.labelEnter : cfg.home.label,
      variant: firstRestore ? 'primary' : 'quiet',
      onClick: () => ctx.go(cfg.home.route),
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
      winNote ? status(winNote, 'gold') : '',
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
        statTile({ label: t.t('range.results.combo'), value: bestCombo }),
        statTile({ label: t.t('arena.results.parried'), value: fight?.parried ?? 0 }),
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
    if (creditsOn) {
      creditWord();
      sync();
      return;
    }
    if (w.perfect) perfectWords += 1;
    const f = fight;
    if (!f) return;
    handle(f.wordDone(w.perfect));
    announceCall();
    sync();
  };
  play.onJudged = (key) => {
    if (creditsOn) {
      sync();
      return;
    }
    const f = fight;
    if (!key.correct) {
      // The Glass Golem: a slip mends a crack.
      const healed = f?.slip() ?? 0;
      if (healed > 0) {
        scene?.heal(healed);
        if (cfg.healMoment ? !slipSaid : !specialSaid) {
          if (!cfg.healMoment) specialSaid = true;
          slipSaid = true;
          say(cfg.healMoment ?? 'special', true);
        }
      }
      if (!slipSaid && !DIFFICULTIES[difficulty].failOnError) {
        slipSaid = true;
        say('slip', true);
      }
    } else {
      if (key.kind === 'char') f?.letter();
      if (!comboSaid && (play.current?.combo ?? 0) >= 15) {
        comboSaid = true;
        say('combo', true);
      }
    }
    sync();
  };
  play.onEnd = (end) => (creditsOn ? endCredits() : phaseOver(end));

  const fail = (key: MessageKey): void => {
    probe.failed = true;
    loading.replaceChildren(status(t.t(key), 'warn'));
    loading.hidden = false;
  };

  const boot = async (): Promise<void> => {
    const look = cfg.look;
    const [eng, make] = await Promise.all([
      import('../../engine'),
      cfg.stage
        ? cfg.stage()
        : import('../../scenes/arena').then(
            (m) =>
              (l: ApprenticeLook): BossStage =>
                new m.ArenaScene({ look: l, boss: look === 'scroll' ? 'blot' : look }),
          ),
    ]);
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
    const rng = new eng.Rng((Date.now() % 100000) + 16);
    rngNext = () => rng.next();
    scene = make(apprenticeLook(profile.avatar));
    scene.onStep = step;
    scene.onTransitionEnd = afterTransition;

    probe.stats = engine.stats;
    let raf = 0;
    const tick = (now: number): void => {
      play.frame(now);
      syncBoss();
      if (player?.line) {
        story.reveal(player.shown);
        story.setWaiting(player.waiting);
      }
      probe.cutscene.waiting = player?.waiting ?? false;
      raf = requestAnimationFrame(tick);
    };
    cleanup = () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(resultsTimer);
      window.clearTimeout(victoryTimer);
      window.clearTimeout(lineTimer);
      window.clearTimeout(cardTimer);
      window.clearTimeout(creditsTimer);
      player = null;
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
        text: { next: () => fight?.current.text ?? ' ' },
        layout,
        difficulty: 0,
        seed: 16,
      });
    } catch {
      fail('range.failed');
      return;
    }
    if (disposed) return;
    loading.hidden = true;
    probe.ready = true;
    startRun(true);
    raf = requestAnimationFrame(tick);
    if (probe.checkpoint === 0) {
      say(restoredBefore ? 'returning' : 'arrive');
      window.setTimeout(() => {
        if (disposed || fight?.phase !== 0 || over) return;
        const opening = cfg.phaseLine?.(0);
        if (opening) sayLine(opening, fight.def.id);
        else say('p1');
      }, MAJOR_HOLD_MS + 2500);
    }

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
      if (player) {
        if (ev.key === 'Enter' || ev.key === ' ') {
          advanceStory();
          return true;
        }
        return ev.key.length === 1;
      }
      if (creditsOn) {
        if (ev.key === 'Tab') return false;
        const typed = play.key(ev, performance.now());
        if (typed) sync();
        return typed;
      }
      if (over) {
        // During the victory and the celebration every key waits; on the card Enter leads on.
        if (results.hidden) return true;
        if (ev.key !== 'Enter') return false;
        if (firstRestore) ctx.go(cfg.home.route);
        else startRun(false);
        return true;
      }
      if (!options.hidden) return false;
      if (ev.key === 'Enter') {
        if (speech.el.hidden) return false;
        hideLine();
        return true;
      }
      if (ev.key === 'Tab') return false;
      // Between phases the quill rests: keys wait for the next phase.
      if (fight?.state !== 'fight') return ev.key.length === 1;
      const used = play.key(ev, performance.now());
      if (used) sync();
      return used;
    },
    onEscape() {
      if (player) {
        skipStory();
        return true;
      }
      if (creditsOn) {
        endCredits();
        return true;
      }
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
