/** True when running inside the Otzaria host (it injects a global `Otzaria`). */
export function isOtzaria(g: object = globalThis): boolean {
  return 'Otzaria' in g;
}
