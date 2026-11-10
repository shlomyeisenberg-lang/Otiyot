// Feedback components: Toast, Modal, Dialogue box.

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

export interface DialogueOptions {
  speaker: string;
  text: string;
  /** Subtitle / translation line (captions are always shown). */
  sub?: string;
  /** Words beside the "continue" key, e.g. "Continue". */
  nextHint: string;
  /** The key that continues (default Enter). */
  nextKey?: string;
  onNext?: () => void;
}

export interface DialogueHandle {
  el: HTMLElement;
  setLine(speaker: string, text: string, sub?: string): void;
}

/** A stylised scribe: cap, face, robe. Drawn in code; modest by design (ARCHITECTURE section 8). */
function portrait(): SVGElement {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 72 72');
  svg.setAttribute('aria-hidden', 'true');
  const add = (tag: string, attrs: Record<string, string>): void => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    svg.append(n);
  };
  add('path', { d: 'M10 72c2-20 12-28 26-28s24 8 26 28z', fill: 'currentColor', opacity: '0.85' });
  add('path', { d: 'M30 46l6 9 6-9', fill: 'none', stroke: 'var(--surface)', 'stroke-width': '2' });
  add('circle', {
    cx: '36',
    cy: '29',
    r: '12',
    fill: 'var(--surface)',
    stroke: 'currentColor',
    'stroke-width': '2',
  });
  add('path', {
    d: 'M23.5 25c1-8 6.5-12 12.5-12s11.5 4 12.5 12c-8-3-17-3-25 0z',
    fill: 'currentColor',
  });
  return svg;
}

export function dialogueBox(o: DialogueOptions): DialogueHandle {
  const speaker = h('div', { class: 'dialogue__speaker' });
  const text = h('p', { class: 'dialogue__text' });
  const sub = h('p', { class: 'dialogue__sub' });
  const next = h(
    'div',
    { class: 'dialogue__next' },
    h('span', { text: o.nextHint }),
    keycap(o.nextKey ?? 'Enter', 'gold', 'sm'),
  );
  const body = h('div', {}, speaker, text, sub, next);
  const el = h(
    'div',
    { class: 'dialogue', role: 'group' },
    h('div', { class: 'dialogue__portrait' }, portrait()),
    body,
  );
  const setLine = (who: string, line: string, caption?: string): void => {
    speaker.textContent = who;
    text.textContent = line;
    sub.textContent = caption ?? '';
    sub.hidden = !caption;
    el.setAttribute('aria-label', who);
  };
  setLine(o.speaker, o.text, o.sub);
  if (o.onNext) el.addEventListener('click', o.onNext);
  return { el, setLine };
}
