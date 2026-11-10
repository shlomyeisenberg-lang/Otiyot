// Display components: Panel, Key-cap chip, Status, Stat tile, Progress bar, Rank badge.

import { h, type Child } from '../dom';
import { icon, type IconName } from '../icons';

export interface PanelOptions {
  title?: string;
  /** Large panels get the deckled (hand-cut) top edge. */
  deckled?: boolean;
  inset?: boolean;
  class?: string;
}

export function panel(o: PanelOptions = {}, ...children: Child[]): HTMLElement {
  const cls = ['panel'];
  if (o.deckled) cls.push('panel--deckled');
  if (o.inset) cls.push('panel--inset');
  if (o.class) cls.push(o.class);
  const el = h('section', { class: cls.join(' ') });
  if (o.title) el.append(h('h2', { class: 'panel__title', text: o.title }));
  el.append(...children.filter((c): c is Node | string => Boolean(c)));
  return el;
}

export type KeycapTone = 'plain' | 'gold' | 'next' | 'ok' | 'err' | 'fade';
export type KeycapSize = 'sm' | 'md' | 'lg';

/** A single key, as a chip. Purely visual: give the parent an accessible label. */
export function keycap(
  char: string,
  tone: KeycapTone = 'plain',
  size: KeycapSize = 'md',
): HTMLElement {
  const cls = ['keycap'];
  if (tone !== 'plain') cls.push(`keycap--${tone}`);
  if (size !== 'md') cls.push(`keycap--${size}`);
  return h('kbd', { class: cls.join(' '), text: char });
}

export type Tone = 'neutral' | 'ok' | 'warn' | 'err' | 'gold';

const TONE_ICON: Record<Tone, IconName> = {
  neutral: 'info',
  ok: 'check',
  warn: 'alert',
  err: 'cross',
  gold: 'quill',
};

export function toneIcon(tone: Tone): SVGElement {
  return icon(TONE_ICON[tone]);
}

/** Status is always color + icon + word (DESIGN, Accessibility). */
export function status(word: string, tone: Tone = 'neutral'): HTMLElement {
  const cls = tone === 'neutral' ? 'status' : `status status--${tone}`;
  return h('span', { class: cls }, toneIcon(tone), h('span', { text: word }));
}

export interface StatOptions {
  label: string;
  value: string | number;
  unit?: string;
  gold?: boolean;
}

export function statTile(o: StatOptions): HTMLElement {
  const value = h('span', { class: 'stat__value', text: String(o.value) });
  if (o.unit) value.append(h('span', { class: 'stat__unit', text: o.unit }));
  return h(
    'div',
    { class: o.gold ? 'stat stat--gold' : 'stat', role: 'group', 'aria-label': o.label },
    h('span', { class: 'stat__label', text: o.label }),
    value,
  );
}

export interface ProgressHandle {
  el: HTMLElement;
  set(value: number): void;
}

/** `value` and `max` in the same unit; the percentage is shown as a word-and-number, not color alone. */
export function progressBar(label: string, value: number, max = 100): ProgressHandle {
  const fill = h('div', { class: 'progress__fill' });
  const pct = h('span');
  const track = h(
    'div',
    {
      class: 'progress__track',
      role: 'progressbar',
      'aria-label': label,
      'aria-valuemin': 0,
      'aria-valuemax': max,
    },
    fill,
  );
  const el = h(
    'div',
    { class: 'progress' },
    h('div', { class: 'progress__head' }, h('span', { text: label }), pct),
    track,
  );
  const set = (v: number): void => {
    const clamped = Math.min(max, Math.max(0, v));
    const p = max > 0 ? Math.round((clamped / max) * 100) : 0;
    fill.style.inlineSize = `${p}%`;
    pct.textContent = `${p}%`;
    track.setAttribute('aria-valuenow', String(clamped));
  };
  set(value);
  return { el, set };
}

export type Rank = 'S' | 'A' | 'B' | 'C';

/** Scene rank, stamped like a seal. `label` is read by screen readers ("Rank S"). */
export function rankBadge(rank: Rank, label: string): HTMLElement {
  return h('span', { class: `rank rank--${rank}`, role: 'img', 'aria-label': label, text: rank });
}
