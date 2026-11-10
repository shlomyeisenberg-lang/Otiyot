// Choice cards: the track picker card and the layout picker card are both built from this.

import { h, type Child } from '../dom';
import { keycap, status } from './display';

export interface ChoiceOptions {
  id: string;
  kicker: string;
  title: string;
  body: string;
  points?: readonly string[];
  /** A small demonstration (keys, a mini keyboard). */
  demo?: Child;
  demoLabel?: string;
  checked: boolean;
  /** The letter that picks this card from the keyboard. */
  hotkey?: string;
  /** The word on the "this is your choice" chip, e.g. "Chosen". */
  pickedText: string;
  onPick: () => void;
}

/** One option in a radio group. The whole card is the button. */
export function choiceCard(o: ChoiceOptions): HTMLButtonElement {
  const el = h(
    'button',
    {
      class: 'choice',
      type: 'button',
      role: 'radio',
      'aria-checked': String(o.checked),
      'data-id': o.id,
      'aria-keyshortcuts': o.hotkey ? o.hotkey.toUpperCase() : undefined,
    },
    h('span', { class: 'choice__picked' }, status(o.pickedText, 'gold')),
    h(
      'span',
      { class: 'choice__head' },
      o.hotkey ? keycap(o.hotkey.toUpperCase(), 'gold') : null,
      h(
        'span',
        {},
        h('span', { class: 'choice__kicker', text: o.kicker }),
        h('span', { class: 'choice__title', text: o.title }),
      ),
    ),
    h('span', { class: 'choice__body', text: o.body }),
  );
  if (o.demo) {
    const demo = h('span', { class: 'choice__demo' });
    if (o.demoLabel) demo.append(h('span', { class: 'choice__demo-label', text: o.demoLabel }));
    demo.append(o.demo);
    el.append(demo);
  }
  if (o.points && o.points.length > 0) {
    el.append(
      h(
        'span',
        { class: 'choice__points' },
        ...o.points.map((p) => h('span', { class: 'choice__point', text: p })),
      ),
    );
  }
  el.addEventListener('click', o.onPick);
  return el;
}

/** Wraps cards in a radio group with arrow-key movement between them. */
export function choiceGroup(label: string, cards: readonly HTMLButtonElement[]): HTMLElement {
  const el = h('div', { class: 'card-grid', role: 'radiogroup', 'aria-label': label }, ...cards);
  el.addEventListener('keydown', (ev) => {
    const cur = cards.indexOf(document.activeElement as HTMLButtonElement);
    if (cur < 0) return;
    const rtl = getComputedStyle(el).direction === 'rtl';
    let step = 0;
    if (ev.key === 'ArrowDown' || ev.key === (rtl ? 'ArrowLeft' : 'ArrowRight')) step = 1;
    else if (ev.key === 'ArrowUp' || ev.key === (rtl ? 'ArrowRight' : 'ArrowLeft')) step = -1;
    if (step === 0) return;
    ev.preventDefault();
    ev.stopPropagation();
    cards[(cur + step + cards.length) % cards.length]?.focus();
  });
  return el;
}
