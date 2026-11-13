// PlayController: the host side of typing in a scene. It owns the typing driver, the HUD, the
// keyboard guide and the hint coach, turns keyboard events into judged keys, and hands every
// judged key and finished word to the scene manager, so scenes only react (ARCHITECTURE 2:
// "a scene never reads the keyboard"). Every screen that runs a scene uses it.

import { resolveTypedChar, type Finger, type LayoutId, type Metrics, type TypedKey } from '../core';
import type { ComboPolicy } from '../game/combo';
import type { Targeting } from '../game/combat';
import type { TypingView } from '../engine/scene';
import { HintCoach, type CoachTip } from '../game/hints';
import {
  TypingDriver,
  type DriverOptions,
  type LetterState,
  type WordResult,
  type WordSource,
} from '../game/typing';
import type { Settings } from '../save';
import { Hud } from './hud';
import type { I18n, MessageKey } from './i18n';
import { KeyboardGuide, type GuideMode } from './keyboardGuide';

/** What the controller forwards to (the SceneManager, or a test double). */
export interface PlayTarget {
  onKey(ev: TypedKey): void;
  onWord(word: string, perfect: boolean): void;
}

export interface RunEnd {
  metrics: Metrics;
  bestCombo: number;
  words: number;
  failed: boolean;
}

const FINGER_KEY: Readonly<Record<Finger, MessageKey>> = {
  lp: 'finger.lp',
  lr: 'finger.lr',
  lm: 'finger.lm',
  li: 'finger.li',
  ri: 'finger.ri',
  rm: 'finger.rm',
  rr: 'finger.rr',
  rp: 'finger.rp',
  th: 'finger.th',
};

/** Per-run choices that differ from the profile's settings (difficulty, combat). */
export interface RunOptions {
  /** Overrides settings.hardcore (Sofer's Trial fails on the first error). */
  hardcore?: boolean;
  /** Soft combo breaks and Steady Hand. */
  combo?: ComboPolicy;
  /** Combat: the first letter typed picks the enemy to lock onto. */
  targeting?: Targeting;
  /** Challenge modifier: the dimmed next word is not shown. */
  hideLookahead?: boolean;
}

const STATS_EVERY_MS = 250;
const NO_LETTERS: readonly string[] = [];
const NO_STATES: readonly LetterState[] = [];

export class PlayController {
  readonly hud: Hud;
  readonly guide: KeyboardGuide;
  /** A stable view of the word being typed, for SceneContext.typing. */
  readonly view: TypingView;

  target: PlayTarget | null = null;
  /** Told about every judged key (sound, probes, ...). */
  onJudged: ((key: TypedKey) => void) | null = null;
  onWord: ((w: WordResult) => void) | null = null;
  onEnd: ((end: RunEnd) => void) | null = null;

  private driver: TypingDriver | null = null;
  private targeting: Targeting | null = null;
  private hideAhead = false;
  private coach = new HintCoach();
  private lastStats = -Infinity;

  constructor(
    private readonly i18n: I18n,
    private layout: LayoutId,
    private readonly settings: Pick<Settings, 'backspace' | 'hardcore' | 'niqqud'>,
    guideMode: GuideMode = 'keys',
  ) {
    const t = i18n;
    this.hud = new Hud({
      combo: t.t('hud.combo'),
      wpm: t.t('hud.wpm'),
      accuracy: t.t('hud.accuracy'),
      strip: t.t('hud.strip'),
      space: t.t('hud.space'),
    });
    this.guide = new KeyboardGuide(layout, {
      title: t.t('guide.title'),
      fingerName: (f) => t.t(FINGER_KEY[f]),
      next: (char, finger) => t.t('guide.next', { key: char, finger }),
      fix: t.t('guide.fix'),
      space: t.t('guide.space'),
    });
    this.guide.mode = guideMode;
    this.hud.dock(this.guide.el);
    const d = (): TypingDriver | null => this.driver;
    const layoutNow = (): LayoutId => this.layout;
    this.view = {
      get word() {
        return d()?.word ?? '';
      },
      get letters() {
        return d()?.letters ?? NO_LETTERS;
      },
      get states() {
        return d()?.states ?? NO_STATES;
      },
      get position() {
        return d()?.position ?? 0;
      },
      get lookahead() {
        return d()?.lookahead ?? '';
      },
      get combo() {
        return d()?.combo ?? 0;
      },
      get tier() {
        return d()?.tier ?? 0;
      },
      get layout() {
        return layoutNow();
      },
    };
  }

  get running(): boolean {
    return this.driver !== null && !this.driver.ended;
  }

  get current(): TypingDriver | null {
    return this.driver;
  }

  /** Starts a run: a whole lesson ('once') or endless words from the source. */
  begin(
    source: WordSource,
    mode: DriverOptions['mode'],
    layout: LayoutId = this.layout,
    run: RunOptions = {},
  ): void {
    this.layout = layout;
    this.guide.setLayout(layout);
    this.coach = new HintCoach();
    this.targeting = run.targeting ?? null;
    this.hideAhead = run.hideLookahead ?? false;
    this.driver = new TypingDriver(source, {
      layout,
      mode,
      backspace: this.settings.backspace,
      hardcore: run.hardcore ?? this.settings.hardcore,
      niqqud: this.settings.niqqud,
      combo: run.combo,
    });
    this.autoTarget();
    this.hud.setCombo(0);
    this.hud.setStats(0, 100);
    this.hud.setProgress(mode === 'once' ? 0 : -1);
    this.showWord();
  }

  /** A keyboard event. Returns true when it was typing (the caller then prevents the default). */
  key(ev: KeyboardEvent, now: number): boolean {
    const d = this.driver;
    if (!d || d.ended || ev.ctrlKey || ev.metaKey || ev.altKey) return false;
    if (ev.key === 'Backspace') {
      d.press({ code: 'Backspace', key: 'Backspace', shift: false }, now);
      this.guide.press('Backspace', true);
      this.hud.setStates(d.states);
      this.guide.show(d.guide());
      return true;
    }
    const input = { code: ev.code, key: ev.key, shift: ev.shiftKey };
    // Combat: before the first letter of a word, that letter picks the enemy to lock onto.
    if (this.targeting && d.atWordStart && ev.key.length === 1) {
      const ch = resolveTypedChar(input, d.letters[0] ?? '', this.layout, null).char;
      const pick = ch && ch !== ' ' ? this.targeting.pick(ch) : null;
      if (pick && pick.word !== d.word) {
        d.retarget(pick.word, pick.lookahead);
        this.showWord();
      }
    }
    const r = d.press(input, now);
    if (!r.key) {
      // Blocked until the mistake is fixed: a nudge toward Backspace, nothing else.
      if (d.mustFix && ev.key.length === 1) {
        this.hud.stumble();
        this.guide.press(ev.code, false);
      }
      return ev.key.length === 1;
    }
    const k = r.key;
    this.guide.press(k.pressed.code, k.correct);
    if (!k.correct) this.hud.stumble();
    this.target?.onKey(k);
    this.onJudged?.(k);
    if (!k.correct) {
      const tip = this.coach.afterMistake(d.keys, now);
      if (tip) this.hud.tip(this.tipText(tip));
    }
    this.hud.setCombo(d.combo);
    if (r.word) {
      this.target?.onWord(r.word.word, r.word.perfect);
      this.onWord?.(r.word);
      if (d.mode === 'once') this.hud.setProgress(d.progress);
    }
    if (r.ended) {
      this.hud.setStates(d.states);
      this.guide.show(null);
      this.hud.setStats(d.wpm(now), d.accuracy());
      this.onEnd?.({
        metrics: d.metrics(now),
        bestCombo: d.bestCombo,
        words: d.wordsDone,
        failed: d.failed,
      });
      return true;
    }
    if (r.word) {
      this.autoTarget();
      this.showWord();
    } else {
      this.hud.setStates(d.states);
      this.guide.show(d.guide());
    }
    this.frame(now, true);
    return true;
  }

  /** Call every animation frame: keeps WPM and accuracy fresh a few times a second. */
  frame(now: number, force = false): void {
    const d = this.driver;
    if (!d || (!force && now - this.lastStats < STATS_EVERY_MS)) return;
    this.lastStats = now;
    this.hud.setStats(d.wpm(now), d.accuracy());
  }

  /**
   * Combat: the field changed (an enemy appeared or left). Before the first letter of a word,
   * make sure the word belongs to an enemy that is there, else take the nearest one.
   */
  retarget(): void {
    if (this.autoTarget()) this.showWord();
  }

  /** Sets the streak from outside (a Blot reached the scribe). */
  setCombo(combo: number): void {
    const d = this.driver;
    if (!d) return;
    d.setCombo(combo);
    this.hud.setCombo(d.combo);
  }

  /**
   * Ends an endless run from outside (the Ladder: the climber fell or rested). No more keys are
   * judged, the word strip empties and the finger guide rests. `onEnd` is not called.
   */
  halt(): void {
    const d = this.driver;
    if (!d || d.ended) return;
    d.ended = true;
    this.hud.setWord([], [], '');
    this.guide.show(null);
  }

  setGuideMode(mode: GuideMode): void {
    this.guide.mode = mode;
  }

  dispose(): void {
    this.hud.dispose();
    this.driver = null;
    this.target = null;
    this.onJudged = null;
    this.onWord = null;
    this.onEnd = null;
    this.targeting = null;
  }

  private autoTarget(): boolean {
    const d = this.driver;
    const tg = this.targeting;
    if (!d || !tg || d.ended || !d.atWordStart) return false;
    const want = tg.auto(d.word);
    if (!want) return false;
    if (want.word === d.word && want.lookahead === d.lookahead) return false;
    return d.retarget(want.word, want.lookahead);
  }

  private showWord(): void {
    const d = this.driver;
    if (!d) return;
    this.hud.setWord(d.letters, d.states, this.hideAhead ? '' : d.lookahead);
    this.guide.show(d.guide());
  }

  private tipText(tip: CoachTip): string {
    if (tip.kind === 'home-row-drift') {
      return this.i18n.t(this.layout === 'he' ? 'tip.homeRowHe' : 'tip.homeRowEn');
    }
    return this.i18n.t('tip.wrongFinger', { finger: this.i18n.t(FINGER_KEY[tip.finger]) });
  }
}
