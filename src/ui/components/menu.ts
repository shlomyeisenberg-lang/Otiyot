// Menu: big choices, each picked by click, by arrows + Enter, or by typing its highlighted letter.

import { h } from '../dom';
import { assignHotkeys, matchHotkey, splitLabel, type Hotkey } from '../hotkeys';
import { bdi } from '../i18n';
import { keycap } from './display';

export interface MenuItem {
  id: string;
  label: string;
  hint?: string;
  /** A node shown at the far end (a status chip, the current value...). */
  end?: Node;
  /** Shown faded and cannot be chosen (something not built or not unlocked yet). */
  disabled?: boolean;
  /** Marks the current choice in a list. */
  chosen?: boolean;
  /** The label is user text in an unknown script (a player's name): isolate it. */
  foreign?: boolean;
  onChoose: () => void;
}

export interface MenuOptions {
  /** Accessible name of the menu. */
  label: string;
  compact?: boolean;
  /** Letters that must not be used as hotkeys here. */
  reserved?: readonly string[];
}

export interface MenuHandle {
  el: HTMLElement;
  /** Feed key presses here. Returns true when the key was used. */
  onKey(ev: KeyboardEvent): boolean;
  focus(): void;
  hotkeys: readonly (Hotkey | null)[];
}

export function menu(items: readonly MenuItem[], o: MenuOptions): MenuHandle {
  const hotkeys = assignHotkeys(
    items.map((it) => (it.disabled ? '' : it.label)),
    o.reserved,
  );
  const el = h('ul', {
    class: o.compact ? 'menu menu--compact' : 'menu',
    role: 'menu',
    'aria-label': o.label,
  });
  const buttons: HTMLButtonElement[] = [];

  items.forEach((it, i) => {
    const hk = hotkeys[i] ?? null;
    const [before, hot, after] = splitLabel(it.label, hk);
    const label = h('span', { class: 'menu__label' });
    if (it.foreign) {
      const iso = bdi('');
      iso.append(before, hot ? h('span', { class: 'hot', text: hot }) : '', after);
      label.append(iso);
    } else {
      label.append(before, hot ? h('span', { class: 'hot', text: hot }) : '', after);
    }
    const text = h('span', {}, label);
    if (it.hint) text.append(h('span', { class: 'menu__hint', text: it.hint }));
    const cap = keycap(hk ? hk.char.toUpperCase() : '·', it.disabled ? 'fade' : 'gold');
    cap.setAttribute('aria-hidden', 'true');
    const b = h(
      'button',
      {
        class: it.chosen ? 'menu__item menu__item--chosen' : 'menu__item',
        type: 'button',
        role: 'menuitem',
        'data-id': it.id,
        'aria-disabled': it.disabled ? 'true' : undefined,
        'aria-keyshortcuts': hk ? hk.char.toUpperCase() : undefined,
        'aria-current': it.chosen ? 'true' : undefined,
        style: `--i:${i}`,
      },
      cap,
      text,
      h('span', { class: 'menu__end' }, it.end ?? null),
    );
    b.addEventListener('click', () => {
      if (!it.disabled) it.onChoose();
    });
    buttons.push(b);
    el.append(h('li', { role: 'none' }, b));
  });

  const move = (from: number, step: 1 | -1): void => {
    const n = buttons.length;
    for (let k = 1; k <= n; k += 1) {
      const idx = (from + step * k + n * k) % n;
      const b = buttons[idx];
      if (b) {
        b.focus();
        return;
      }
    }
  };

  const onKey = (ev: KeyboardEvent): boolean => {
    const cur = buttons.indexOf(document.activeElement as HTMLButtonElement);
    switch (ev.key) {
      case 'ArrowDown':
        move(cur, 1);
        return true;
      case 'ArrowUp':
        move(cur < 0 ? 0 : cur, -1);
        return true;
      case 'Home':
        buttons[0]?.focus();
        return true;
      case 'End':
        buttons[buttons.length - 1]?.focus();
        return true;
      default: {
        const i = matchHotkey(ev, hotkeys);
        const it = items[i];
        if (!it || it.disabled) return false;
        buttons[i]?.focus();
        it.onChoose();
        return true;
      }
    }
  };

  const focus = (): void => {
    const start = items.findIndex((it) => it.chosen && !it.disabled);
    const firstEnabled = items.findIndex((it) => !it.disabled);
    buttons[start >= 0 ? start : Math.max(0, firstEnabled)]?.focus({ preventScroll: true });
  };

  return { el, onKey, focus, hotkeys };
}
