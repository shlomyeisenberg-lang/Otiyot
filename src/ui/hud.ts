// The in-play heads-up display, drawn over the 3D view (DESIGN "Layout: In play"):
//   top centre   the combo meter: grows with the streak and changes material at each tier
//                (ink, techelet, silver, gold, light);
//   top corner   WPM and accuracy, small;
//   lower third  the paper strip: the word to type letter by letter (waiting, next, right,
//                fixed, wrong), the next word dimmed after it, and the lesson's progress;
//   above it     gentle tips (wrong finger, hands drifting off the home row), rare and kind.
// Every word is isolated with its own direction, so Hebrew reads right to left, English left
// to right, and a Latin word inside a Hebrew lesson keeps its own order.
// It also implements the scene-facing HudPort (line / set / announce).

import type { LetterState } from '../game/typing';
import { comboProgress, comboTier } from '../game/typing';
import type { HudPort } from '../engine/scene';
import { h } from './dom';
import { textDir } from './i18n';

export interface HudLabels {
  combo: string;
  wpm: string;
  accuracy: string;
  /** Accessible name of the strip ("Word to type"). */
  strip: string;
  /** Read out for the space at the end of a word. */
  space: string;
}

/** Below this the combo meter stays hidden: a streak of two is not news. */
const COMBO_SHOWN = 3;

export class Hud implements HudPort {
  readonly el: HTMLElement;
  private readonly combo: HTMLElement;
  private readonly comboValue: HTMLElement;
  private readonly wpmValue: HTMLElement;
  private readonly accValue: HTMLElement;
  private readonly strip: HTMLElement;
  private readonly word: HTMLElement;
  private readonly ahead: HTMLElement;
  private readonly bar: HTMLElement;
  private readonly lineEl: HTMLElement;
  private readonly bottom: HTMLElement;
  private readonly tips: HTMLElement;
  private readonly calls: HTMLElement;
  private spans: HTMLElement[] = [];
  private shownCombo = -1;
  private tipTimer = 0;

  constructor(private readonly labels: HudLabels) {
    this.comboValue = h('span', { class: 'hud-combo__value', text: '0' });
    this.combo = h(
      'div',
      { class: 'hud-combo', 'data-tier': '0', 'aria-hidden': 'true' },
      h('span', { class: 'hud-combo__ring' }),
      this.comboValue,
      h('span', { class: 'hud-combo__label', text: labels.combo }),
    );
    this.wpmValue = h('span', { class: 'hud-stat__value', text: '0' });
    this.accValue = h('span', { class: 'hud-stat__value', text: '100' });
    const stats = h(
      'div',
      { class: 'hud-stats' },
      h(
        'span',
        { class: 'hud-stat' },
        this.wpmValue,
        h('span', { class: 'hud-stat__label', text: labels.wpm }),
      ),
      h(
        'span',
        { class: 'hud-stat' },
        this.accValue,
        h('span', { class: 'hud-stat__label', text: `% ${labels.accuracy}` }),
      ),
    );
    this.word = h('span', { class: 'hud-word' });
    this.ahead = h('span', { class: 'hud-ahead' });
    this.bar = h('span', { class: 'hud-strip__bar' });
    this.lineEl = h('div', { class: 'hud-strip__line' }, this.word, this.ahead);
    this.strip = h(
      'div',
      { class: 'hud-strip', role: 'group', 'aria-label': labels.strip },
      this.lineEl,
      h('span', { class: 'hud-strip__progress', 'aria-hidden': 'true' }, this.bar),
    );
    this.tips = h('div', { class: 'hud-tips', role: 'status', 'aria-live': 'polite' });
    this.calls = h('div', { class: 'hud-calls', 'aria-hidden': 'true' });
    this.bottom = h('div', { class: 'hud-bottom' }, this.tips, this.strip);
    this.el = h(
      'div',
      { class: 'hud', 'data-testid': 'hud' },
      h('div', { class: 'hud-top' }, this.combo, stats),
      this.calls,
      this.bottom,
    );
  }

  /** Docks an element (the keyboard guide) under the strip. */
  dock(el: HTMLElement): void {
    this.bottom.append(el);
  }

  /** A new word (and the one after it). `letters` includes the space that ends the word. */
  setWord(letters: readonly string[], states: readonly LetterState[], lookahead: string): void {
    const word = letters.join('').trimEnd();
    this.word.dir = textDir(word) ?? 'auto';
    this.word.lang = this.word.dir === 'rtl' ? 'he' : 'en';
    // The next word follows in reading order: to the left of a Hebrew word, right of English.
    this.lineEl.dir = this.word.dir;
    this.spans = letters.map((g) => {
      const space = g === ' ';
      return h('span', {
        class: space ? 'hud-l hud-l--space' : 'hud-l',
        text: space ? '' : g,
        'aria-label': space ? this.labels.space : undefined,
      });
    });
    this.word.replaceChildren(...this.spans);
    this.ahead.textContent = lookahead;
    this.ahead.dir = textDir(lookahead) ?? 'auto';
    this.word.classList.remove('is-in');
    void this.word.offsetWidth;
    this.word.classList.add('is-in');
    this.setStates(states);
  }

  /** Letter states changed (after every key). */
  setStates(states: readonly LetterState[]): void {
    for (let i = 0; i < this.spans.length; i++) {
      const sp = this.spans[i] as HTMLElement;
      const st = states[i] ?? 'todo';
      if (sp.dataset.state !== st) sp.dataset.state = st;
    }
  }

  /** The wrong-key stumble: the strip shakes for a moment (never blocks). */
  stumble(): void {
    this.strip.classList.remove('is-stumble');
    void this.strip.offsetWidth;
    this.strip.classList.add('is-stumble');
  }

  setCombo(combo: number): void {
    if (combo === this.shownCombo) return;
    const grew = combo > this.shownCombo;
    this.shownCombo = combo;
    const tier = comboTier(combo);
    const before = Number(this.combo.dataset.tier ?? '0');
    this.combo.dataset.tier = String(tier);
    this.combo.classList.toggle('is-shown', combo >= COMBO_SHOWN);
    this.comboValue.textContent = String(combo);
    this.combo.style.setProperty('--p', comboProgress(combo).toFixed(3));
    // Grows with the streak, up to about a third bigger.
    this.combo.style.setProperty('--grow', (1 + Math.min(combo, 120) / 360).toFixed(3));
    if (grew && combo >= COMBO_SHOWN) {
      this.combo.classList.remove('is-bump');
      void this.combo.offsetWidth;
      this.combo.classList.add('is-bump');
    }
    // A new tier (T34): the ring flares in its new material, the same moment the 3D halo bursts.
    if (grew && tier > before && tier > 0) {
      this.combo.classList.remove('is-tierup');
      void this.combo.offsetWidth;
      this.combo.classList.add('is-tierup');
    }
  }

  setStats(wpm: number, accuracy: number): void {
    const w = String(Math.round(wpm));
    const a = accuracy >= 100 ? '100' : accuracy.toFixed(1);
    if (this.wpmValue.textContent !== w) this.wpmValue.textContent = w;
    if (this.accValue.textContent !== a) this.accValue.textContent = a;
  }

  /** 0..1 through the lesson; hidden when negative (endless practice). */
  setProgress(p: number): void {
    this.strip.classList.toggle('has-progress', p >= 0);
    this.bar.style.setProperty('--p', Math.max(0, p).toFixed(3));
  }

  /** A gentle tip above the strip for a few seconds. */
  tip(text: string): void {
    window.clearTimeout(this.tipTimer);
    this.tips.replaceChildren(h('p', { class: 'hud-tip', text }));
    this.tipTimer = window.setTimeout(() => this.tips.replaceChildren(), 5200);
  }

  // --- HudPort (what scenes may call) ---------------------------------------------------

  line(text: string, position: number): void {
    const letters = [...text];
    this.setWord(
      letters,
      letters.map((_, i) => (i < position ? 'ok' : i === position ? 'next' : 'todo')),
      '',
    );
  }

  set(readout: string, value: number): void {
    if (readout === 'combo') this.setCombo(value);
    else if (readout === 'wpm') this.setStats(value, Number(this.accValue.textContent));
    else if (readout === 'accuracy') this.setStats(Number(this.wpmValue.textContent), value);
  }

  /** A word rises in gold across the middle of the screen and fades. */
  announce(text: string): void {
    const el = h('span', { class: 'hud-call', text, dir: textDir(text) ?? 'auto' });
    el.addEventListener('animationend', () => el.remove());
    this.calls.append(el);
    while (this.calls.childElementCount > 3) this.calls.firstElementChild?.remove();
  }

  dispose(): void {
    window.clearTimeout(this.tipTimer);
    this.el.remove();
  }
}
