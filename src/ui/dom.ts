// Tiny DOM helpers. The UI is plain TypeScript + DOM (ARCHITECTURE section 1): no framework.

export type Child = Node | string | null | undefined | false;

export interface Attrs {
  class?: string;
  text?: string;
  /** Any attribute (aria-*, data-*, role, type, ...). `false`/`undefined` leaves it off. */
  [attr: string]: string | number | boolean | undefined;
}

function append(node: Element, children: readonly Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c);
  }
}

/** Creates an element: `h('button', { class: 'btn', type: 'button' }, 'OK')`. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k === 'class') node.className = String(v);
    else if (k === 'text') node.textContent = String(v);
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  append(node, children);
  return node;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Creates an SVG element. */
export function s(
  tag: string,
  attrs: Record<string, string | number> = {},
  ...children: Child[]
): SVGElement {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  append(node, children);
  return node;
}

let uid = 0;
/** A page-unique id for label/control pairs. */
export function nextId(prefix: string): string {
  uid += 1;
  return `${prefix}-${uid}`;
}

/** True when the event target is somewhere the player is typing text. */
export function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLTextAreaElement || target.isContentEditable) return true;
  if (target instanceof HTMLInputElement) {
    return !['range', 'checkbox', 'radio', 'button'].includes(target.type);
  }
  return false;
}
