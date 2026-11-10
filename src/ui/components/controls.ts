// Controls: Button, Toggle, Slider, Select, Tabs, text input. Each returns a plain element (or a
// small handle) and never reaches for global state.

import { h, nextId } from '../dom';
import { icon, type IconName } from '../icons';

export type ButtonVariant = 'default' | 'primary' | 'quiet' | 'danger';

export interface ButtonOptions {
  label: string;
  variant?: ButtonVariant;
  icon?: IconName;
  /** Mirror the icon in RTL (arrows). */
  flipIcon?: boolean;
  small?: boolean;
  /** Icon-only: the label becomes the accessible name. */
  iconOnly?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

export function button(o: ButtonOptions): HTMLButtonElement {
  const cls = ['btn'];
  if (o.variant && o.variant !== 'default') cls.push(`btn--${o.variant}`);
  if (o.small) cls.push('btn--small');
  if (o.iconOnly) cls.push('btn--icon');
  const b = h('button', { class: cls.join(' '), type: 'button' });
  if (o.icon) b.append(icon(o.icon, o.flipIcon));
  if (o.iconOnly) {
    b.setAttribute('aria-label', o.label);
    b.title = o.label;
  } else {
    b.append(h('span', { text: o.label }));
  }
  if (o.disabled) b.disabled = true;
  if (o.onClick) b.addEventListener('click', o.onClick);
  return b;
}

export interface FieldOptions {
  label: string;
  hint?: string;
}

/** A settings row: label and hint on one side, the control on the other. */
export function field(o: FieldOptions, control: HTMLElement, ...extra: HTMLElement[]): HTMLElement {
  const id = control.id || nextId('f');
  control.id = id;
  const label = h('label', { class: 'field__label', for: id, text: o.label });
  const text = h('div', { class: 'field__text' }, label);
  if (o.hint) {
    const hint = h('span', { class: 'field__hint', id: `${id}-hint`, text: o.hint });
    control.setAttribute('aria-describedby', hint.id);
    text.append(hint);
  }
  return h(
    'div',
    { class: 'field' },
    text,
    h('div', { class: 'field__control' }, ...extra, control),
  );
}

export interface ToggleOptions {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Words for the two states, shown beside the switch (status is never color alone). */
  onText: string;
  offText: string;
}

export interface ToggleHandle {
  el: HTMLButtonElement;
  state: HTMLElement;
  set(checked: boolean): void;
}

export function toggle(o: ToggleOptions): ToggleHandle {
  const el = h('button', { class: 'toggle', type: 'button', role: 'switch' });
  const state = h('span', { class: 'toggle__state', 'aria-hidden': 'true' });
  const set = (checked: boolean): void => {
    el.setAttribute('aria-checked', String(checked));
    state.textContent = checked ? o.onText : o.offText;
  };
  set(o.checked);
  el.addEventListener('click', () => {
    const next = el.getAttribute('aria-checked') !== 'true';
    set(next);
    o.onChange(next);
  });
  return { el, state, set };
}

export interface SliderOptions {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
}

export interface SliderHandle {
  el: HTMLInputElement;
  value: HTMLElement;
}

export function slider(o: SliderOptions): SliderHandle {
  const el = h('input', {
    class: 'slider',
    type: 'range',
    min: o.min,
    max: o.max,
    step: o.step,
  });
  el.value = String(o.value);
  const value = h('span', { class: 'slider__value', 'aria-hidden': 'true' });
  const paint = (): void => {
    const v = Number(el.value);
    const pct = ((v - o.min) / (o.max - o.min)) * 100;
    el.style.setProperty('--fill', `${pct}%`);
    const text = o.format ? o.format(v) : String(v);
    value.textContent = text;
    el.setAttribute('aria-valuetext', text);
  };
  paint();
  el.addEventListener('input', () => {
    paint();
    o.onChange(Number(el.value));
  });
  return { el, value };
}

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

export function select<T extends string>(
  options: readonly SelectOption<T>[],
  value: T,
  onChange: (value: T) => void,
): HTMLSelectElement {
  const el = h('select', { class: 'select' });
  for (const o of options) {
    const opt = h('option', { value: o.value, text: o.label });
    opt.selected = o.value === value;
    el.append(opt);
  }
  el.addEventListener('change', () => {
    const picked = options.find((o) => o.value === el.value);
    if (picked) onChange(picked.value);
  });
  return el;
}

export interface TabSpec {
  id: string;
  label: string;
  /** Built the first time the tab is opened. */
  content: () => HTMLElement;
}

export interface TabsHandle {
  el: HTMLElement;
  select(id: string): void;
}

/** Tabs with the standard keyboard pattern: arrows move, Home/End jump. Arrows follow the page direction. */
export function tabs(specs: readonly TabSpec[], label: string, initial?: string): TabsHandle {
  const list = h('div', { class: 'tabs__list', role: 'tablist', 'aria-label': label });
  const panels = h('div');
  const el = h('div', { class: 'tabs' }, list, panels);
  const built = new Map<string, HTMLElement>();
  const buttons = specs.map((spec) => {
    const b = h('button', {
      class: 'tabs__tab',
      type: 'button',
      role: 'tab',
      id: nextId('tab'),
      'data-tab': spec.id,
      text: spec.label,
    });
    list.append(b);
    return b;
  });

  const selectTab = (id: string, focus = false): void => {
    specs.forEach((spec, i) => {
      const b = buttons[i] as HTMLButtonElement;
      const on = spec.id === id;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
      if (on) {
        let panel = built.get(spec.id);
        if (!panel) {
          panel = h(
            'div',
            { class: 'tabs__panel', role: 'tabpanel', 'aria-labelledby': b.id },
            spec.content(),
          );
          built.set(spec.id, panel);
        }
        panels.replaceChildren(panel);
        if (focus) b.focus();
      }
    });
  };

  list.addEventListener('click', (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLElement>('[data-tab]');
    if (b?.dataset.tab) selectTab(b.dataset.tab);
  });
  list.addEventListener('keydown', (ev) => {
    const cur = buttons.findIndex((b) => b.getAttribute('aria-selected') === 'true');
    const rtl = getComputedStyle(list).direction === 'rtl';
    const fwd = rtl ? 'ArrowLeft' : 'ArrowRight';
    const back = rtl ? 'ArrowRight' : 'ArrowLeft';
    let next = -1;
    if (ev.key === fwd) next = (cur + 1) % specs.length;
    else if (ev.key === back) next = (cur - 1 + specs.length) % specs.length;
    else if (ev.key === 'Home') next = 0;
    else if (ev.key === 'End') next = specs.length - 1;
    const spec = specs[next];
    if (spec) {
      ev.preventDefault();
      ev.stopPropagation();
      selectTab(spec.id, true);
    }
  });

  const first = specs.find((x) => x.id === initial) ?? specs[0];
  if (first) selectTab(first.id);
  return { el, select: (id) => selectTab(id) };
}
