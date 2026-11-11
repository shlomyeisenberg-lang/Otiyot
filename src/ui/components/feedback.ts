// Feedback components: Toast, Modal, Dialogue box.

import type { PortraitKind } from '../../story/cast';
import { h, type Child } from '../dom';
import { button, type ButtonVariant } from './controls';
import { keycap, panel, toneIcon, type Tone } from './display';

// ---------- Toast ----------

export interface ToastHost {
  el: HTMLElement;
  show(message: string, tone?: Tone, ms?: number): void;
}

/** One host per page. Toasts are announced politely to screen readers and fade on their own. */
export function toastHost(): ToastHost {
  const el = h('div', { class: 'toast-host', role: 'status', 'aria-live': 'polite' });
  const show = (message: string, tone: Tone = 'gold', ms = 3200): void => {
    const cls = tone === 'neutral' || tone === 'gold' ? 'toast' : `toast toast--${tone}`;
    const t = h('div', { class: cls }, toneIcon(tone), h('span', { text: message }));
    el.append(t);
    while (el.children.length > 3) el.firstElementChild?.remove();
    setTimeout(() => {
      t.classList.add('toast--leaving');
      setTimeout(() => t.remove(), 260);
    }, ms);
  };
  return { el, show };
}

// ---------- Modal ----------

export interface ModalAction {
  label: string;
  variant?: ButtonVariant;
  /** Return false to keep the modal open. */
  onClick?: () => boolean | void;
}

export interface ModalOptions {
  title: string;
  body?: Child;
  actions?: readonly ModalAction[];
  /** Called when the modal closes for any reason (Esc, backdrop, an action). */
  onClose?: () => void;
  /** Extra keys (for a menu inside the modal). Return true when the key was used. */
  onKey?: (ev: KeyboardEvent) => boolean;
  /** Esc and backdrop clicks close it (default true). */
  dismissable?: boolean;
}

export interface ModalHandle {
  el: HTMLElement;
  close(): void;
}

const stack: ModalHandle[] = [];

/** The modal on top, if any. While one is open the shell leaves the keyboard to it. */
export function topModal(): ModalHandle | undefined {
  return stack[stack.length - 1];
}

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])',
    ),
  );
}

export function openModal(o: ModalOptions, host: HTMLElement = document.body): ModalHandle {
  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const title = h('h2', { class: 'modal__title', text: o.title });
  const sheet = panel({ deckled: true, class: 'modal__sheet' }, title);
  if (o.body) sheet.append(h('div', { class: 'modal__body' }, o.body));
  const el = h('div', { class: 'modal' }, sheet);
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-label', o.title);
  sheet.tabIndex = -1;

  let open = true;
  const handle: ModalHandle = {
    el,
    close(): void {
      if (!open) return;
      open = false;
      const i = stack.indexOf(handle);
      if (i >= 0) stack.splice(i, 1);
      el.remove();
      opener?.focus();
      o.onClose?.();
    },
  };

  if (o.actions && o.actions.length > 0) {
    const row = h('div', { class: 'modal__actions' });
    for (const a of o.actions) {
      row.append(
        button({
          label: a.label,
          variant: a.variant,
          onClick: () => {
            if (a.onClick?.() !== false) handle.close();
          },
        }),
      );
    }
    sheet.append(row);
  }

  const dismissable = o.dismissable !== false;
  el.addEventListener('mousedown', (ev) => {
    if (ev.target === el && dismissable) handle.close();
  });
  el.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && dismissable) {
      ev.preventDefault();
      ev.stopPropagation();
      handle.close();
      return;
    }
    if (ev.key === 'Tab') {
      const f = focusables(sheet);
      const first = f[0];
      const last = f[f.length - 1];
      if (!first || !last) return;
      if (ev.shiftKey && document.activeElement === first) {
        ev.preventDefault();
        last.focus();
      } else if (!ev.shiftKey && document.activeElement === last) {
        ev.preventDefault();
        first.focus();
      }
      return;
    }
    if (o.onKey?.(ev)) {
      ev.preventDefault();
      ev.stopPropagation();
    }
  });

  host.append(el);
  stack.push(handle);
  (focusables(sheet)[0] ?? sheet).focus();
  return handle;
}

// ---------- Dialogue box ----------

/** Who is in the portrait frame. All people are men (ARCHITECTURE section 8); Dyo is ink. */
export type { PortraitKind };

export interface DialogueOptions {
  speaker: string;
  text: string;
  /** Subtitle / translation line (captions are always shown). */
  sub?: string;
  /** Words beside the "continue" key, e.g. "Continue". */
  nextHint: string;
  /** The key that continues (default Enter). */
  nextKey?: string;
  /** The face in the frame (default: the apprentice). */
  portrait?: PortraitKind;
  onNext?: () => void;
}

export interface DialogueHandle {
  el: HTMLElement;
  setLine(speaker: string, text: string, sub?: string, portrait?: PortraitKind): void;
  /**
   * Shows only the first `count` letters of the line (the rest keeps its place, invisible, so the
   * box never jumps while a line types itself out). Screen readers get the whole line at once.
   */
  reveal(count: number): void;
  /** The line is all there and waits for the player: the continue key pulses. */
  setWaiting(waiting: boolean): void;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Portraits drawn in code, in the theme's own colors; modest by design (ARCHITECTURE section 8). */
function portrait(kind: PortraitKind): SVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 72 72');
  svg.setAttribute('aria-hidden', 'true');
  const add = (tag: string, attrs: Record<string, string>): void => {
    const n = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    svg.append(n);
  };
  const robe = (): void =>
    add('path', {
      d: 'M10 72c2-20 12-28 26-28s24 8 26 28z',
      fill: 'currentColor',
      opacity: '0.85',
    });
  const face = (cy = '29'): void =>
    add('circle', {
      cx: '36',
      cy,
      r: '12',
      fill: 'var(--surface)',
      stroke: 'currentColor',
      'stroke-width': '2',
    });
  switch (kind) {
    case 'elder':
      // Reb Ezra: a wide black hat and a long white beard.
      robe();
      face('30');
      add('path', {
        d: 'M25 34c1 12 5 20 11 22 6-2 10-10 11-22-3 4-7 5-11 5s-8-1-11-5z',
        fill: 'var(--surface)',
        stroke: 'currentColor',
        'stroke-width': '1.6',
      });
      add('ellipse', { cx: '36', cy: '20', rx: '20', ry: '3.6', fill: 'var(--ink)' });
      add('path', { d: 'M26 20c0-7 4-11 10-11s10 4 10 11z', fill: 'var(--ink)' });
      add('path', { d: 'M31 29h3M38 29h3', stroke: 'var(--ink)', 'stroke-width': '1.6' });
      break;
    case 'drop':
      // Dyo: a drop of ink with big worried eyes.
      add('path', {
        d: 'M36 8c9 14 20 25 20 38a20 20 0 0 1-40 0c0-13 11-24 20-38z',
        fill: 'var(--techelet)',
        stroke: 'var(--ink)',
        'stroke-width': '2',
      });
      add('ellipse', { cx: '28', cy: '44', rx: '6', ry: '7', fill: 'var(--surface)' });
      add('ellipse', { cx: '44', cy: '44', rx: '6', ry: '7', fill: 'var(--surface)' });
      add('circle', { cx: '29.5', cy: '45.5', r: '3', fill: 'var(--ink)' });
      add('circle', { cx: '45.5', cy: '45.5', r: '3', fill: 'var(--ink)' });
      add('path', {
        d: 'M31 57q5 3 10 0',
        fill: 'none',
        stroke: 'var(--surface)',
        'stroke-width': '2',
        'stroke-linecap': 'round',
      });
      add('path', {
        d: 'M24 26q3-7 7-11',
        fill: 'none',
        stroke: 'var(--surface)',
        'stroke-width': '2.5',
        'stroke-linecap': 'round',
        opacity: '0.7',
      });
      break;
    case 'scroll':
      // The narrator: an open scroll and a quill.
      add('rect', {
        x: '14',
        y: '20',
        width: '44',
        height: '34',
        rx: '2',
        fill: 'var(--surface)',
        stroke: 'currentColor',
        'stroke-width': '2',
      });
      add('rect', { x: '10', y: '17', width: '8', height: '40', rx: '4', fill: 'currentColor' });
      add('rect', { x: '54', y: '17', width: '8', height: '40', rx: '4', fill: 'currentColor' });
      add('path', {
        d: 'M24 30h24M24 37h24M24 44h16',
        stroke: 'var(--ink-soft)',
        'stroke-width': '2',
      });
      add('path', {
        d: 'M44 50l18-36c2 4 1 10-4 16z',
        fill: 'var(--gold)',
        stroke: 'currentColor',
        'stroke-width': '1.4',
      });
      break;
    case 'keeper':
      // The Keeper: a deep hood, tired eyes.
      robe();
      add('path', { d: 'M18 46c0-22 8-34 18-34s18 12 18 34z', fill: 'currentColor' });
      face('32');
      add('path', { d: 'M30 32h4M38 32h4', stroke: 'var(--ink)', 'stroke-width': '1.6' });
      break;
    case 'courier':
      // Naftali: a scarf flying behind, a short cap.
      robe();
      add('path', { d: 'M24 44l-14 6 4-8z', fill: 'var(--gold)' });
      face();
      add('path', { d: 'M24 26c1-8 6-12 12-12s11 4 12 12z', fill: 'currentColor' });
      break;
    default:
      // The apprentice (and anyone unnamed): cap, face, robe.
      robe();
      add('path', {
        d: 'M30 46l6 9 6-9',
        fill: 'none',
        stroke: 'var(--surface)',
        'stroke-width': '2',
      });
      face();
      add('path', {
        d: 'M23.5 25c1-8 6.5-12 12.5-12s11.5 4 12.5 12c-8-3-17-3-25 0z',
        fill: 'currentColor',
      });
  }
  return svg;
}

export function dialogueBox(o: DialogueOptions): DialogueHandle {
  const speaker = h('div', { class: 'dialogue__speaker' });
  const shown = h('span', { class: 'dialogue__shown', 'aria-hidden': 'true' });
  const rest = h('span', { class: 'dialogue__rest', 'aria-hidden': 'true' });
  const spoken = h('span', { class: 'sr-only' });
  const text = h('p', { class: 'dialogue__text' }, shown, rest, spoken);
  const sub = h('p', { class: 'dialogue__sub' });
  const next = h(
    'div',
    { class: 'dialogue__next' },
    h('span', { text: o.nextHint }),
    keycap(o.nextKey ?? 'Enter', 'gold', 'sm'),
  );
  const body = h('div', {}, speaker, text, sub, next);
  const frameEl = h('div', { class: 'dialogue__portrait' });
  const el = h('div', { class: 'dialogue', role: 'group' }, frameEl, body);
  let chars: string[] = [];
  let kindNow: PortraitKind | null = null;
  const reveal = (count: number): void => {
    const n = Math.max(0, Math.min(chars.length, count));
    shown.textContent = chars.slice(0, n).join('');
    rest.textContent = chars.slice(n).join('');
  };
  const setLine = (
    who: string,
    line: string,
    caption?: string,
    kind: PortraitKind = 'apprentice',
  ): void => {
    speaker.textContent = who;
    chars = Array.from(line);
    spoken.textContent = line;
    reveal(chars.length);
    sub.textContent = caption ?? '';
    sub.hidden = !caption;
    el.setAttribute('aria-label', who);
    if (kind !== kindNow) {
      kindNow = kind;
      frameEl.dataset.kind = kind;
      frameEl.replaceChildren(portrait(kind));
    }
  };
  setLine(o.speaker, o.text, o.sub, o.portrait);
  if (o.onNext) el.addEventListener('click', o.onNext);
  return {
    el,
    setLine,
    reveal,
    setWaiting: (waiting) => {
      el.dataset.waiting = String(waiting);
    },
  };
}
