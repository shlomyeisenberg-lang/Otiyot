// Main menu: the wordmark, a greeting, and the big typed-or-clicked choices.

import type { AppContext, Screen } from '../app';
import { menu, panel, type MenuItem } from '../components';
import { h } from '../dom';
import { keysHint } from './frame';
import { layoutName, trackName } from './names';

/** Loose letters drifting behind the menu: grey and forgotten until the scribe restores them. */
function driftingLetters(): HTMLElement {
  const el = h('div', { class: 'drift', 'aria-hidden': 'true' });
  ['א', 'ב', 'ג', 'ש', 'ת', 'ל', 'מ', 'ק'].forEach((ch, i) => {
    el.append(h('span', { class: `drift__letter drift__letter--${i}`, text: ch }));
  });
  return el;
}

export function mainMenuScreen(ctx: AppContext): Screen {
  const t = ctx.i18n;
  const p = ctx.profile;
  const now = (value: string): string => t.t('common.now', { value });

  const items: MenuItem[] = [
    {
      id: 'journey',
      label: t.t('menu.journey'),
      hint: t.t('menu.journeyHint'),
      onChoose: () => ctx.go('hub'),
    },
    {
      id: 'players',
      label: t.t('menu.players'),
      hint: t.t('menu.playersHint', { name: p.name }),
      onChoose: () => ctx.go('players'),
    },
    {
      id: 'track',
      label: t.t('menu.track'),
      hint: now(trackName(t, p.track)),
      onChoose: () => ctx.go('track'),
    },
    {
      id: 'layout',
      label: t.t('menu.layout'),
      hint: now(layoutName(t, p.layout)),
      onChoose: () => ctx.go('layout'),
    },
    {
      id: 'stats',
      label: t.t('menu.stats'),
      hint: t.t('menu.statsHint'),
      onChoose: () => ctx.go('stats'),
    },
    {
      id: 'settings',
      label: t.t('menu.settings'),
      hint: t.t('menu.settingsHint'),
      onChoose: () => ctx.go('settings'),
    },
  ];
  if (import.meta.env.DEV) {
    items.push({
      id: 'styleguide',
      label: t.t('menu.styleguide'),
      hint: t.t('menu.styleguideHint'),
      onChoose: () => ctx.go('styleguide'),
    });
  }
  const list = menu(items, { label: t.t('menu.title') });

  const el = h(
    'div',
    { class: 'page page--title' },
    driftingLetters(),
    h(
      'header',
      { class: 'title' },
      h(
        'h1',
        { class: 'title__mark', lang: 'he', dir: 'rtl', 'aria-label': t.t('app.name') },
        'אותיות',
      ),
      h('p', { class: 'title__latin', lang: 'en', 'aria-hidden': 'true', text: 'OTIYOT' }),
      h('p', { class: 'title__tagline', text: t.t('app.tagline') }),
    ),
    panel(
      { deckled: true, class: 'page__sheet' },
      h('p', { class: 'title__greeting', text: t.t('menu.greeting', { name: p.name }) }),
      list.el,
      keysHint(t.t('common.keysHint')),
    ),
  );

  return { el, onKey: list.onKey, focus: list.focus };
}
