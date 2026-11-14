// Records (T37): the ghost boards of this profile and of this device, plus sharing a ghost as a
// file with a friend. Every number comes from src/game/ghosts (unit-tested); this only draws it.
// A ghost file holds finish times and numbers only, never any typed text.

import {
  addToBoard,
  boardKeys,
  deviceBoard,
  exportGhost,
  GhostImportError,
  kindOfBoard,
  parseGhost,
} from '../../game/ghosts';
import type { GhostRecord } from '../../save/schema';
import type { AppContext } from '../app';
import { button } from '../components';
import { h } from '../dom';
import type { I18n, MessageKey } from '../i18n';

let lastBoard = '';

/** "Jaffa Line · Standard · Steady": the plain name of a board. */
export function boardName(t: I18n, key: string): string {
  const kind = kindOfBoard(key);
  if (!kind) return key;
  const detail = key.slice(key.indexOf('|') + 1);
  const parts = detail.split(':');
  const name = (k: string): string => {
    const id = `${k}` as MessageKey;
    const text = t.t(id);
    return text === id ? k : text;
  };
  let tail: string[];
  if (kind === 'rail') {
    tail = [name(`range.level.${parts[0]}`), name(`range.difficulty.${parts[1]}`)];
  } else if (kind === 'daily') {
    tail = [parts[2] ?? ''];
  } else {
    // mode:timeattack:<region>:<level>:<difficulty>
    tail = [
      name(`region.${parts[2]}`),
      name(`range.level.${parts[3]}`),
      name(`range.difficulty.${parts[4]}`),
    ];
  }
  return [t.t(`ghost.kind.${kind}` as MessageKey), ...tail.filter((x) => x !== '')].join(' · ');
}

function save(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function recordsPanel(ctx: AppContext): HTMLElement {
  const t = ctx.i18n;
  const root = h('div', { class: 'stats__stack records', 'data-testid': 'records' });

  const lineText = (r: GhostRecord, who: string): string =>
    t.t('ghost.lineLabel', {
      name: who,
      score: r.score,
      wpm: r.wpm,
      accuracy: Math.round(r.accuracy),
    });

  const table = (
    lines: readonly (GhostRecord & { profile?: string })[],
    key: string,
    withExport: boolean,
  ): HTMLElement => {
    const body = h('tbody');
    lines.forEach((r, i) => {
      const who = r.profile ?? r.name;
      const row = h(
        'tr',
        { 'aria-label': lineText(r, who) },
        h('td', { class: 'stats__num', text: String(i + 1) }),
        h('td', { text: r.imported ? `${who} (${t.t('ghost.imported')})` : who }),
        h('td', { class: 'stats__num', text: String(r.score) }),
        h('td', { class: 'stats__num', text: String(r.wpm) }),
        h('td', { class: 'stats__num', text: `${Math.round(r.accuracy)}%` }),
      );
      if (withExport) {
        const b = button({
          label: t.t('ghost.export'),
          small: true,
          onClick: () => {
            save(`otiyot-ghost-${r.wpm}wpm.json`, exportGhost(key, r));
            ctx.toast.show(t.t('ghost.exportDone'));
          },
        });
        b.dataset.action = 'export';
        row.append(h('td', {}, b));
      }
      body.append(row);
    });
    return h(
      'div',
      { class: 'stats__scroll' },
      h(
        'table',
        { class: 'stats__table' },
        h(
          'thead',
          {},
          h(
            'tr',
            {},
            h('th', { scope: 'col', text: '#' }),
            h('th', { scope: 'col', text: t.t('stats.colKind') }),
            h('th', { scope: 'col', text: t.t('ghost.score') }),
            h('th', { scope: 'col', text: t.t('stats.wpm') }),
            h('th', { scope: 'col', text: t.t('stats.colAccuracy') }),
            ...(withExport ? [h('td')] : []),
          ),
        ),
        body,
      ),
    );
  };

  const importInput = h('input', {
    type: 'file',
    accept: '.json,application/json',
    class: 'sr-only',
    'aria-label': t.t('ghost.import'),
  }) as HTMLInputElement;
  importInput.dataset.action = 'import';
  importInput.addEventListener('change', () => {
    const file = importInput.files?.[0];
    if (!file) return;
    void file.text().then((text) => {
      try {
        const { key, record } = parseGhost(text);
        ctx.saves.update((p) => {
          addToBoard(p, key, record);
        });
        void ctx.saves.flush();
        lastBoard = key;
        ctx.toast.show(t.t('ghost.importDone'));
      } catch (e) {
        if (!(e instanceof GhostImportError)) throw e;
        ctx.toast.show(t.t('ghost.importBad'));
      }
      importInput.value = '';
      draw();
    });
  });
  const importBtn = button({ label: t.t('ghost.import'), onClick: () => importInput.click() });

  function draw(): void {
    const p = ctx.profile;
    const keys = boardKeys(p);
    const key = keys.includes(lastBoard) ? lastBoard : (keys[0] ?? '');
    const children: HTMLElement[] = [h('p', { class: 'page__note', text: t.t('ghost.intro') })];
    if (keys.length === 0) {
      children.push(h('p', { class: 'page__note stats__empty', text: t.t('ghost.empty') }));
    } else {
      const select = h('select', { class: 'field__input', 'aria-label': t.t('ghost.board') });
      for (const k of keys) {
        const o = h('option', { value: k, text: boardName(t, k) }) as HTMLOptionElement;
        o.selected = k === key;
        select.append(o);
      }
      select.addEventListener('change', () => {
        lastBoard = (select as HTMLSelectElement).value;
        draw();
      });
      children.push(
        h('label', { class: 'field' }, h('span', { text: t.t('ghost.board') }), select),
        h('h3', { class: 'stats__heading', text: t.t('ghost.mine') }),
        table(p.ghosts[key] ?? [], key, true),
        h('h3', { class: 'stats__heading', text: t.t('ghost.device') }),
        table(deviceBoard(ctx.saves.save, key), key, false),
      );
    }
    children.push(h('div', { class: 'page__actions' }, importBtn, importInput));
    root.replaceChildren(...children);
  }
  draw();
  return root;
}
