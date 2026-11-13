// The journal (T32): the people the apprentice has met, the places of the Land of Letters, and
// the typing tips Reb Ezra writes down. Entries open as the story and the course advance
// (src/game/journal); the words come from src/story/journal and the region names in the locale
// files. Locked entries say what opens them.

import { journalCounts, journalOf, REGIONS, type PersonEntry, type PlaceEntry } from '../../game';
import { CAST, PEOPLE_NOTES, TIPS } from '../../story';
import type { AppContext, Screen } from '../app';
import { button, panel, status, tabs } from '../components';
import { h } from '../dom';
import type { MessageKey } from '../i18n';
import { frame } from './frame';

let lastTab = 'people';

export function journalScreen(ctx: AppContext): Screen {
  const t = ctx.i18n;
  const lang = t.lang;
  const journal = journalOf(ctx.profile);
  const counts = journalCounts(journal);
  const regionName = (id: string): string => t.t(`region.${id}` as MessageKey);

  const card = (
    testid: string,
    open: boolean,
    title: string,
    body: string,
    hint: string,
  ): HTMLElement =>
    h(
      'li',
      { class: open ? 'jr jr--open' : 'jr jr--locked', 'data-entry': testid },
      panel(
        {},
        h(
          'div',
          { class: 'jr__head' },
          h('h3', { class: 'jr__name', text: open ? title : t.t('journal.locked') }),
          open ? status(t.t('journal.open'), 'ok') : status(t.t('stats.locked')),
        ),
        h('p', { class: 'jr__body', text: open ? body : hint }),
      ),
    );

  const personHint = (e: PersonEntry): string =>
    e.need.kind === 'intro'
      ? t.t('journal.hintIntro')
      : t.t('journal.hintRegion', { region: regionName(e.need.region) });

  const placeHint = (e: PlaceEntry): string => {
    const gate = REGIONS.find((r) => r.id === e.id)?.after;
    return gate && !journal.places.find((x) => x.id === gate)?.restored
      ? t.t('journal.hintRegion', { region: regionName(gate) })
      : t.t('journal.hintCourse');
  };

  const list = (...items: HTMLElement[]): HTMLElement => h('ul', { class: 'jr__list' }, ...items);

  const people = (): HTMLElement =>
    list(
      ...journal.people.map((e) =>
        card(
          `person-${e.id}`,
          e.open,
          CAST[e.id].name[lang],
          PEOPLE_NOTES[e.id][lang],
          personHint(e),
        ),
      ),
    );

  const places = (): HTMLElement =>
    list(
      ...journal.places.map((e) =>
        card(
          `place-${e.id}`,
          e.open,
          regionName(e.id),
          t.t(`region.${e.id}.place` as MessageKey) +
            (e.restored ? ` ${t.t('journal.restored')}` : ''),
          placeHint(e),
        ),
      ),
    );

  const tips = (): HTMLElement =>
    list(
      ...journal.tips.map((e, i) => {
        const tip = TIPS[i];
        return card(
          `tip-${e.id}`,
          e.open,
          t.t('journal.tipNumber', { number: i + 1 }),
          tip ? tip.text[lang] : '',
          t.t('journal.hintLevel', { level: e.level }),
        );
      }),
    );

  const tb = tabs(
    [
      { id: 'people', label: t.t('journal.tabPeople'), content: people },
      { id: 'places', label: t.t('journal.tabPlaces'), content: places },
      { id: 'tips', label: t.t('journal.tabTips'), content: tips },
    ],
    t.t('journal.tabs'),
    lastTab,
  );
  tb.el.addEventListener('click', (ev) => {
    const id = (ev.target as HTMLElement).closest<HTMLElement>('[data-tab]')?.dataset.tab;
    if (id) lastTab = id;
  });

  const el = frame(
    {
      title: t.t('journal.title'),
      lead: t.t('journal.lead', { open: counts.open, total: counts.total }),
    },
    tb.el,
    h(
      'div',
      { class: 'page__actions' },
      button({ label: t.t('stats.title'), onClick: () => ctx.go('stats') }),
    ),
  );
  el.dataset.testid = 'journal';
  return {
    el,
    wide: true,
    focus: () =>
      el
        .querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')
        ?.focus({ preventScroll: true }),
  };
}
