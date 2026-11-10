// The two pickers, shared by the standalone screens and the new-player steps.

import { charForKey, type LayoutId } from '../../core';
import { getTrack } from '../../learn';
import type { Track } from '../../save';
import { choiceCard, choiceGroup, keyboardMap, keycap } from '../components';
import { h } from '../dom';
import { assignHotkeys, matchHotkey } from '../hotkeys';
import type { I18n } from '../i18n';
import { icon } from '../icons';

export interface Picker<T> {
  el: HTMLElement;
  /** Picks by hotkey. Returns true when the key was used. */
  onKey(ev: KeyboardEvent): boolean;
  focus(): void;
  value(): T;
}

function picker<T>(
  label: string,
  values: readonly T[],
  cards: readonly HTMLButtonElement[],
  hotkeys: ReturnType<typeof assignHotkeys>,
  initial: T,
  onPick: (value: T) => void,
): Picker<T> {
  let current = initial;
  const paint = (): void => {
    cards.forEach((c, i) => {
      const on = values[i] === current;
      c.setAttribute('aria-checked', String(on));
      c.tabIndex = on ? 0 : -1;
    });
  };
  const pick = (i: number, focus: boolean): void => {
    const v = values[i];
    if (v === undefined) return;
    const changed = v !== current;
    current = v;
    paint();
    if (focus) cards[i]?.focus();
    if (changed) onPick(v);
  };
  cards.forEach((c, i) => c.addEventListener('click', () => pick(i, false)));
  paint();
  return {
    el: choiceGroup(label, cards),
    onKey(ev) {
      const i = matchHotkey(ev, hotkeys);
      if (i < 0) return false;
      pick(i, true);
      return true;
    },
    focus() {
      cards[values.indexOf(current)]?.focus({ preventScroll: true });
    },
    value: () => current,
  };
}

/** The first keys a track teaches, drawn from the real lesson order: singly, or in pairs. */
function trackDemo(track: Track, layout: LayoutId): HTMLElement {
  const codes = getTrack(track).keyOrder(layout).slice(0, 4);
  const chars = codes.map((c) => charForKey(layout, c, false) ?? '');
  const el = h('span', { class: 'choice__steps', 'aria-hidden': 'true' });
  const size = track === 1 ? 1 : 2;
  for (let i = 0; i < chars.length; i += size) {
    if (i > 0) el.append(h('span', { class: 'choice__sep' }, icon('next', true)));
    const group = h('span', { class: 'choice__group' });
    for (const ch of chars.slice(i, i + size)) group.append(keycap(ch, 'plain', 'lg'));
    el.append(group);
  }
  return el;
}

export function trackPicker(
  t: I18n,
  layout: LayoutId,
  initial: Track,
  onPick: (track: Track) => void,
): Picker<Track> {
  const values: readonly Track[] = [1, 2];
  const titles = [t.t('track.name1'), t.t('track.name2')];
  const hotkeys = assignHotkeys(titles);
  const cards = values.map((track, i) =>
    choiceCard({
      id: `track-${track}`,
      kicker: t.t(track === 1 ? 'track.kicker1' : 'track.kicker2'),
      title: titles[i] ?? '',
      body: t.t(track === 1 ? 'track.body1' : 'track.body2'),
      points:
        track === 1
          ? [t.t('track.p1a'), t.t('track.p1b'), t.t('track.p1c')]
          : [t.t('track.p2a'), t.t('track.p2b'), t.t('track.p2c')],
      demo: trackDemo(track, layout),
      demoLabel: t.t('track.demo'),
      checked: track === initial,
      hotkey: hotkeys[i]?.char,
      pickedText: t.t('common.chosen'),
      onPick: () => undefined,
    }),
  );
  return picker(t.t('track.title'), values, cards, hotkeys, initial, onPick);
}

export function layoutPicker(
  t: I18n,
  initial: LayoutId,
  onPick: (layout: LayoutId) => void,
): Picker<LayoutId> {
  const values: readonly LayoutId[] = ['he', 'en'];
  const titles = [t.t('layout.nameHe'), t.t('layout.nameEn')];
  const hotkeys = assignHotkeys(titles);
  const cards = values.map((layout, i) =>
    choiceCard({
      id: `layout-${layout}`,
      kicker: t.t(layout === 'he' ? 'layout.kickerHe' : 'layout.kickerEn'),
      title: titles[i] ?? '',
      body: t.t(layout === 'he' ? 'layout.bodyHe' : 'layout.bodyEn'),
      demo: keyboardMap({
        layout,
        label: t.t(layout === 'he' ? 'layout.mapHe' : 'layout.mapEn'),
        home: true,
        lettersOnly: true,
        small: true,
      }),
      demoLabel: t.t('layout.demo'),
      checked: layout === initial,
      hotkey: hotkeys[i]?.char,
      pickedText: t.t('common.chosen'),
      onPick: () => undefined,
    }),
  );
  return picker(t.t('layout.title'), values, cards, hotkeys, initial, onPick);
}
