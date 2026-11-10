// The centered parchment column every menu screen sits in.

import { panel } from '../components';
import { h, type Child } from '../dom';

export interface FrameOptions {
  title: string;
  lead?: string;
  /** Small line above the title (e.g. "Step 2 of 3"). */
  kicker?: string;
}

export function frame(o: FrameOptions, ...children: Child[]): HTMLElement {
  const head = h('header', { class: 'page__head' });
  if (o.kicker) head.append(h('p', { class: 'page__kicker', text: o.kicker }));
  head.append(h('h1', { class: 'page__title', text: o.title }));
  if (o.lead) head.append(h('p', { class: 'page__lead', text: o.lead }));
  return h(
    'div',
    { class: 'page' },
    panel({ deckled: true, class: 'page__sheet' }, head, ...children),
  );
}

/** The hint line under a menu: how to use the keyboard. */
export function keysHint(text: string): HTMLElement {
  return h('p', { class: 'page__keys', text });
}
