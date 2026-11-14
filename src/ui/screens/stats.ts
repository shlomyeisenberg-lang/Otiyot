// Statistics dashboard (T32): speed and accuracy over time, keys mastered, the keyboard heatmap,
// error patterns, time played, session history, both lesson tracks and the achievements. Every
// number comes from src/game/stats (unit-tested); this screen only draws it.

import {
  achievementsOf,
  activityOf,
  errorPatterns,
  keyHeat,
  keysMastered,
  sessionRows,
  splitDuration,
  summarizeHistory,
  trackSummary,
  trendSeries,
  type SessionRow,
} from '../../game';
import type { LayoutId } from '../../core';
import type { AppContext, Screen } from '../app';
import {
  button,
  keyboardMap,
  keycap,
  lineChart,
  panel,
  progressBar,
  statTile,
  status,
  tabs,
} from '../components';
import { h } from '../dom';
import type { I18n, MessageKey } from '../i18n';
import { frame } from './frame';
import { layoutName, trackName } from './names';

let lastTab = 'overview';

/** "2 h 5 min", "35 min" or "0 min". */
export function durationText(t: I18n, ms: number): string {
  const { hours, minutes } = splitDuration(ms);
  return hours > 0
    ? t.t('stats.hoursMinutes', { hours, minutes })
    : t.t('stats.minutes', { minutes });
}

function dateText(t: I18n, at: number): string {
  return new Date(at).toLocaleDateString(t.lang === 'he' ? 'he-IL' : 'en-GB', {
    day: 'numeric',
    month: 'short',
  });
}

function empty(text: string): HTMLElement {
  return h('p', { class: 'page__note stats__empty', text });
}

function section(title: string, ...children: (HTMLElement | null)[]): HTMLElement {
  return h(
    'section',
    { class: 'stats__section' },
    h('h2', { class: 'stats__heading', text: title }),
    ...children,
  );
}

export function statsScreen(ctx: AppContext): Screen {
  const t = ctx.i18n;
  const p = ctx.profile;
  const now = Date.now();
  const tz = new Date(now).getTimezoneOffset();

  const overview = (): HTMLElement => {
    const sum = summarizeHistory(p.history);
    const act = activityOf(p.history, now, tz);
    const km = keysMastered(p);
    if (sum.sessions === 0) return empty(t.t('stats.none'));
    const tiles = h(
      'div',
      { class: 'stats__tiles' },
      statTile({ label: t.t('stats.sessions'), value: sum.sessions }),
      statTile({ label: t.t('stats.timePlayed'), value: durationText(t, sum.totalMs) }),
      statTile({ label: t.t('stats.avgWpm'), value: sum.avgWpm, unit: t.t('stats.wpm') }),
      statTile({
        label: t.t('stats.bestWpm'),
        value: sum.bestWpm,
        unit: t.t('stats.wpm'),
        gold: true,
      }),
      statTile({ label: t.t('stats.avgAccuracy'), value: sum.avgAccuracy, unit: '%' }),
      statTile({
        label: t.t('stats.keysMastered'),
        value: `${km.mastered}/${km.known}`,
      }),
      statTile({ label: t.t('stats.activeDays'), value: act.days }),
      statTile({ label: t.t('stats.streak'), value: act.streak, unit: t.t('stats.days') }),
    );
    const trend = trendSeries(p.history, 30);
    const wpm = trend.wpm;
    const acc = trend.accuracy;
    const charts =
      wpm.length < 2
        ? empty(t.t('stats.needTwo'))
        : h(
            'div',
            { class: 'stats__charts' },
            lineChart({
              title: t.t('stats.wpmOverTime'),
              points: wpm,
              unit: t.t('stats.wpm'),
              summary: t.t('stats.wpmSummary', {
                first: wpm[0] ?? 0,
                last: wpm[wpm.length - 1] ?? 0,
                count: wpm.length,
              }),
            }),
            lineChart({
              title: t.t('stats.accuracyTrend'),
              points: acc,
              unit: '%',
              summary: t.t('stats.accuracySummary', {
                first: acc[0] ?? 0,
                last: acc[acc.length - 1] ?? 0,
                count: acc.length,
              }),
            }),
          );
    return h('div', { class: 'stats__stack' }, tiles, charts);
  };

  const keys = (): HTMLElement => {
    const km = keysMastered(p);
    const layout: LayoutId = p.layout;
    const heat = keyHeat(p, layout);
    const errors = errorPatterns(p, 6);
    const hasHeat = Object.keys(heat).length > 0;
    const map = keyboardMap({
      layout,
      label: t.t('stats.heatLabel', { layout: layoutName(t, layout) }),
      heat,
      lettersOnly: true,
      legend: { low: t.t('stats.heatLow'), high: t.t('stats.heatHigh') },
    });
    const list =
      errors.length === 0
        ? empty(t.t('stats.noErrors'))
        : h(
            'ul',
            { class: 'stats__errors' },
            ...errors.map((e) =>
              h(
                'li',
                { class: 'stats__error' },
                h(
                  'span',
                  { class: 'stats__pair', 'aria-hidden': 'true' },
                  keycap(e.expected, 'ok', 'sm'),
                  h('span', { class: 'stats__arrow', text: '→' }),
                  keycap(e.typed, 'err', 'sm'),
                ),
                h('span', {
                  class: 'stats__count',
                  'aria-hidden': 'true',
                  text: t.t('stats.times', { count: e.count }),
                }),
                h('span', {
                  class: 'sr-only',
                  text: t.t('stats.errorRead', {
                    expected: e.expected,
                    typed: e.typed,
                    count: e.count,
                  }),
                }),
              ),
            ),
          );
    return h(
      'div',
      { class: 'stats__stack' },
      progressBar(t.t('stats.keysMasteredBar'), km.mastered, Math.max(1, km.known)).el,
      section(t.t('stats.heatmap'), hasHeat ? map : empty(t.t('stats.noKeys'))),
      section(t.t('stats.errors'), list),
    );
  };

  const lessons = (): HTMLElement => {
    const layout = p.layout;
    const blocks = ([1, 2] as const).map((track) => {
      const s = trackSummary(p, track, layout);
      return section(
        trackName(t, track) + (track === p.track ? ` · ${t.t('stats.current')}` : ''),
        progressBar(
          t.t('stats.lessonsDone', { done: s.done, total: s.total }),
          s.done,
          Math.max(1, s.total),
        ).el,
        h(
          'ul',
          { class: 'stats__levels' },
          ...s.levels.map((lv) =>
            h(
              'li',
              { class: 'stats__level' },
              h('span', { class: 'stats__level-name', text: lv.name }),
              h('span', {
                class: 'stats__level-done',
                text: `${lv.done}/${lv.total}`,
              }),
              h('span', {
                class: 'stats__level-stars',
                text: t.t('stats.starsCount', { count: lv.stars }),
              }),
            ),
          ),
        ),
      );
    });
    return h(
      'div',
      { class: 'stats__stack' },
      empty(t.t('stats.layoutNote', { layout: layoutName(t, layout) })),
      ...blocks,
    );
  };

  const kindLabel = (row: SessionRow): string => t.t(`stats.kind.${row.kind}` as MessageKey);

  const history = (): HTMLElement => {
    const rows = sessionRows(p.history, 15);
    if (rows.length === 0) return empty(t.t('stats.none'));
    const body = h('tbody');
    for (const r of rows) {
      body.append(
        h(
          'tr',
          {},
          h('td', { text: dateText(t, r.at) }),
          h('td', { text: kindLabel(r) }),
          h('td', { class: 'stats__num', text: String(r.wpm) }),
          h('td', { class: 'stats__num', text: `${r.accuracy}%` }),
          h('td', { class: 'stats__num', text: durationText(t, r.durationMs) }),
        ),
      );
    }
    return h(
      'div',
      { class: 'stats__scroll' },
      h(
        'table',
        { class: 'stats__table' },
        h('caption', { class: 'sr-only', text: t.t('stats.historyCaption') }),
        h(
          'thead',
          {},
          h(
            'tr',
            {},
            h('th', { scope: 'col', text: t.t('stats.colDate') }),
            h('th', { scope: 'col', text: t.t('stats.colKind') }),
            h('th', { scope: 'col', text: t.t('stats.wpm') }),
            h('th', { scope: 'col', text: t.t('stats.colAccuracy') }),
            h('th', { scope: 'col', text: t.t('stats.colTime') }),
          ),
        ),
        body,
      ),
    );
  };

  const achievements = (): HTMLElement => {
    const list = achievementsOf(p, { now, tzOffsetMin: tz });
    const earned = list.filter((a) => a.earned).length;
    return h(
      'div',
      { class: 'stats__stack' },
      h('p', {
        class: 'page__note',
        text: t.t('stats.achievementsCount', { earned, total: list.length }),
      }),
      h(
        'ul',
        { class: 'stats__achievements' },
        ...list.map((a) =>
          h(
            'li',
            { class: a.earned ? 'ach ach--earned' : 'ach', 'data-ach': a.id },
            panel(
              {},
              h(
                'div',
                { class: 'ach__head' },
                h('h3', { class: 'ach__name', text: t.t(`ach.${a.id}` as MessageKey) }),
                a.earned
                  ? status(t.t('stats.earned'), 'gold')
                  : status(t.t('stats.locked'), 'neutral'),
              ),
              h('p', { class: 'ach__desc', text: t.t(`ach.${a.id}.desc` as MessageKey) }),
              a.earned
                ? null
                : progressBar(t.t(`ach.${a.id}` as MessageKey), a.progress, a.goal).el,
            ),
          ),
        ),
      ),
    );
  };

  const tb = tabs(
    [
      { id: 'overview', label: t.t('stats.tabOverview'), content: overview },
      { id: 'keys', label: t.t('stats.tabKeys'), content: keys },
      { id: 'lessons', label: t.t('stats.tabLessons'), content: lessons },
      { id: 'history', label: t.t('stats.tabHistory'), content: history },
      { id: 'achievements', label: t.t('stats.tabAchievements'), content: achievements },
    ],
    t.t('stats.tabs'),
    lastTab,
  );
  tb.el.addEventListener('click', (ev) => {
    const id = (ev.target as HTMLElement).closest<HTMLElement>('[data-tab]')?.dataset.tab;
    if (id) lastTab = id;
  });

  const el = frame(
    { title: t.t('stats.title'), lead: t.t('stats.lead', { name: p.name }) },
    tb.el,
    h(
      'div',
      { class: 'page__actions' },
      button({ label: t.t('journal.title'), onClick: () => ctx.go('journal') }),
    ),
  );
  el.dataset.testid = 'stats';
  return {
    el,
    wide: true,
    focus: () =>
      el
        .querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')
        ?.focus({ preventScroll: true }),
  };
}
