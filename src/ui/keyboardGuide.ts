// The keyboard guide docked under the play view: a tilted 3D keyboard (CSS 3D transforms, so the
// glyphs stay crisp and every color comes from the tokens) in the active layout, keys coded by
// finger color, the next key raised and glowing in techelet, the Shift to hold glowing with it,
// a press animation on every key, and optional hands under it with the finger to use lifted.
// The keyboard is physical, so it is always laid out left to right, even in Hebrew.

import { KEYBOARD_ROWS, KEYS, charForKey, type Finger, type LayoutId } from '../core';
import type { GuideKey } from '../game/typing';
import { h, s } from './dom';

export type GuideMode = 'keys' | 'hands' | 'off';
export const GUIDE_MODES: readonly GuideMode[] = ['keys', 'hands', 'off'];

/** Keys drawn for the look of a real keyboard; they are never asked for. */
const EXTRA_START: Readonly<Record<number, string>> = { 1: 'Tab', 2: 'CapsLock' };
const EXTRA_END: Readonly<Record<number, string>> = { 0: 'Backspace', 2: 'Enter' };
const LABEL: Readonly<Record<string, string>> = {
  Backspace: '⌫',
  Tab: '⇥',
  CapsLock: '⇪',
  Enter: '⏎',
  ShiftLeft: '⇧',
  ShiftRight: '⇧',
  Space: '',
};
const FINGER_OF_EXTRA: Readonly<Record<string, Finger>> = {
  Backspace: 'rp',
  Tab: 'lp',
  CapsLock: 'lp',
  Enter: 'rp',
};
/** Finger -> the token family it is painted with. */
const FAMILY: Readonly<Record<Finger, string>> = {
  lp: 'pinky',
  rp: 'pinky',
  lr: 'ring',
  rr: 'ring',
  lm: 'middle',
  rm: 'middle',
  li: 'index',
  ri: 'index',
  th: 'thumb',
};
const ROW_NAMES = ['number', 'top', 'home', 'bottom', 'space'] as const;

export interface GuideLabels {
  /** Accessible name of the whole keyboard. */
  title: string;
  /** "Next: {key} with {finger}" — filled by the caller. */
  fingerName(f: Finger): string;
  next(char: string, finger: string): string;
  fix: string;
  space: string;
}

function fingerOf(code: string): Finger {
  return KEYS[code]?.finger ?? FINGER_OF_EXTRA[code] ?? 'th';
}

export class KeyboardGuide {
  readonly el: HTMLElement;
  private readonly deck: HTMLElement;
  private readonly caption: HTMLElement;
  private readonly hands: SVGElement;
  private readonly keys = new Map<string, HTMLElement>();
  private readonly fingers = new Map<Finger, SVGElement[]>();
  private lit: HTMLElement[] = [];
  private litFinger: Finger | null = null;
  private layout: LayoutId;
  private modeValue: GuideMode = 'keys';

  constructor(
    layout: LayoutId,
    private readonly labels: GuideLabels,
  ) {
    this.layout = layout;
    this.deck = h('div', { class: 'kg__deck', dir: 'ltr' });
    this.caption = h('p', { class: 'kg__caption', 'aria-live': 'off' });
    this.hands = this.buildHands();
    this.el = h(
      'div',
      { class: 'kg', role: 'img', 'aria-label': labels.title, 'data-mode': 'keys' },
      h('div', { class: 'kg__stage' }, this.deck),
      this.hands,
      this.caption,
    );
    this.build();
  }

  get mode(): GuideMode {
    return this.modeValue;
  }

  set mode(m: GuideMode) {
    this.modeValue = m;
    this.el.dataset.mode = m;
  }

  setLayout(layout: LayoutId): void {
    if (layout === this.layout) return;
    this.layout = layout;
    this.build();
  }

  /** Raise and light the next key (and the Shift to hold), lift the finger to use. */
  show(next: GuideKey | null): void {
    for (const k of this.lit) k.classList.remove('is-next', 'is-shift', 'is-fix');
    this.lit = [];
    if (this.litFinger) {
      for (const f of this.fingers.get(this.litFinger) ?? []) f.classList.remove('is-active');
      this.litFinger = null;
    }
    if (!next) {
      this.caption.textContent = '';
      return;
    }
    const key = this.keys.get(next.code);
    if (key) {
      key.classList.add('is-next');
      if (next.fix) key.classList.add('is-fix');
      this.lit.push(key);
    }
    if (next.shift) {
      const sh = this.keys.get(next.shift);
      if (sh) {
        sh.classList.add('is-shift');
        this.lit.push(sh);
      }
    }
    this.litFinger = next.finger;
    for (const f of this.fingers.get(next.finger) ?? []) f.classList.add('is-active');
    this.el.dataset.finger = FAMILY[next.finger];
    const name = this.labels.fingerName(next.finger);
    const what = next.fix ? this.labels.fix : next.char === ' ' ? this.labels.space : next.char;
    this.caption.textContent = this.labels.next(what, name);
  }

  /** The press animation: the key the player hit dips; colored by whether it was right. */
  press(code: string, correct: boolean): void {
    const key = this.keys.get(code);
    if (!key) return;
    key.classList.remove('is-down', 'is-ok', 'is-err');
    // Restart the animation even when the same key is pressed twice in a row.
    void key.offsetWidth;
    key.classList.add('is-down', correct ? 'is-ok' : 'is-err');
  }

  private build(): void {
    this.keys.clear();
    this.lit = [];
    this.deck.replaceChildren();
    const other: LayoutId = this.layout === 'he' ? 'en' : 'he';
    KEYBOARD_ROWS.forEach((codes, r) => {
      const row = h('div', { class: `kg__row kg__row--${ROW_NAMES[r] ?? 'space'}` });
      const all = [
        ...(EXTRA_START[r] ? [EXTRA_START[r]] : []),
        ...codes,
        ...(EXTRA_END[r] ? [EXTRA_END[r]] : []),
      ];
      for (const code of all) {
        const finger = fingerOf(code);
        const special = code in LABEL;
        const main = special ? (LABEL[code] ?? '') : (charForKey(this.layout, code, false) ?? '');
        const alt = special ? '' : (charForKey(other, code, false) ?? '');
        const cls = ['kg__key', `kg__key--${FAMILY[finger]}`];
        if (special) cls.push('kg__key--wide', `kg__key--${code.toLowerCase()}`);
        if (KEYS[code]?.home) cls.push('kg__key--home');
        if (code === 'KeyF' || code === 'KeyJ') cls.push('kg__key--bump');
        const key = h(
          'span',
          { class: cls.join(' '), 'data-code': code },
          h('span', { class: 'kg__cap' }, h('span', { class: 'kg__main', text: main })),
        );
        if (alt && alt !== main && alt.toLowerCase() !== main.toLowerCase()) {
          key.firstElementChild?.append(h('span', { class: 'kg__alt', text: alt.toUpperCase() }));
        }
        key.addEventListener('animationend', () =>
          key.classList.remove('is-down', 'is-ok', 'is-err'),
        );
        this.keys.set(code, key);
        row.append(key);
      }
      this.deck.append(row);
    });
  }

  /** Two simple hands, palms down; each finger is painted in its own color. */
  private buildHands(): SVGElement {
    const svg = s('svg', {
      class: 'kg__hands',
      viewBox: '0 0 420 120',
      'aria-hidden': 'true',
      focusable: 'false',
    });
    // x, length per finger, left hand from the little finger to the thumb.
    const left: [Finger, number, number][] = [
      ['lp', 30, 46],
      ['lr', 58, 62],
      ['lm', 86, 70],
      ['li', 114, 62],
    ];
    const hand = (side: 'left' | 'right'): SVGElement => {
      const g = s('g', { class: `kg__hand kg__hand--${side}` });
      const mirror = side === 'right';
      const tx = (x: number): number => (mirror ? 420 - x : x);
      for (const [f0, x, len] of left) {
        const f = (
          mirror ? ({ lp: 'rp', lr: 'rr', lm: 'rm', li: 'ri' } as const)[f0 as 'lp'] : f0
        ) as Finger;
        const el = s('rect', {
          class: `kg__finger kg__finger--${FAMILY[f]}`,
          x: tx(x) - 11,
          y: 70 - len,
          width: 22,
          height: len + 8,
          rx: 11,
        });
        this.addFinger(f, el);
        g.append(el);
      }
      const thumb = s('rect', {
        class: 'kg__finger kg__finger--thumb',
        x: mirror ? tx(150) - 40 : 150,
        y: 80,
        width: 40,
        height: 20,
        rx: 10,
        transform: `rotate(${mirror ? 24 : -24} ${tx(160)} 90)`,
      });
      this.addFinger('th', thumb);
      g.append(thumb);
      // The palm is drawn last, over the base of each finger, so the fingers grow out of it.
      g.append(
        s('path', {
          class: 'kg__palm',
          d: mirror
            ? 'M 404 76 Q 404 118 352 118 L 300 118 Q 262 118 262 84 L 262 70 Q 262 60 404 62 Z'
            : 'M 16 76 Q 16 118 68 118 L 120 118 Q 158 118 158 84 L 158 70 Q 158 60 16 62 Z',
        }),
      );
      return g;
    };
    svg.append(hand('left'), hand('right'));
    return svg;
  }

  private addFinger(f: Finger, el: SVGElement): void {
    const list = this.fingers.get(f) ?? [];
    list.push(el);
    this.fingers.set(f, list);
  }
}
