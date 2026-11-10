/** Builds the placeholder boot screen. Replaced by the real title in a later task. */
export function renderBoot(root: HTMLElement, doc: Document = document): void {
  const title = doc.createElement('h1');
  title.className = 'boot-title';
  title.textContent = 'Otiyot';
  const sub = doc.createElement('p');
  sub.className = 'boot-sub';
  sub.textContent = 'אותיות';
  root.replaceChildren(title, sub);
}

/** True when running inside the Otzaria host (it injects a global `Otzaria`). */
export function isOtzaria(g: object = globalThis): boolean {
  return 'Otzaria' in g;
}
