// /styleguide (development only): every token and component in light, dark, RTL and LTR.
// main.ts loads this file only in dev, so it never ships in the website or plugin build.

import { COLOR_TOKENS } from '../../engine/palette';
import type { AppContext, Screen } from '../app';
import {
  button,
  choiceCard,
  dialogueBox,
  field,
  keyboardMap,
  keycap,
  lineChart,
  menu,
  openModal,
  panel,
  progressBar,
  rankBadge,
  select,
  slider,
  statTile,
  status,
  tabs,
  toggle,
  type Rank,
} from '../components';
import { h } from '../dom';
import { dirOf, LANGS, translate, type Lang, type MessageKey, type Vars } from '../i18n';
import { openPauseMenu } from './pause';

const SIZES = [12, 14, 16, 20, 28, 40, 64] as const;
const HEAT: Readonly<Record<string, number>> = {
  KeyQ: 0.7,
  KeyP: 0.9,
  KeyZ: 0.5,
  KeyB: 0.35,
  KeyY: 0.6,
  Slash: 0.8,
  KeyT: 0.2,
  Comma: 0.3,
};
const SPEEDS = [18, 21, 20, 25, 27, 26, 31, 34, 38, 41];

function section(title: string, ...children: (Node | string)[]): HTMLElement {
  return h(
    'section',
    { class: 'sg__section' },
    h('h3', { class: 'sg__h', text: title }),
    ...children,
  );
}

function row(...children: (Node | string)[]): HTMLElement {
  return h('div', { class: 'sg__row' }, ...children);
}

function swatches(): HTMLElement {
  const grid = h('div', { class: 'sg__swatches' });
  for (const token of COLOR_TOKENS) {
    grid.append(
      h(
        'div',
        { class: 'sg__swatch' },
        h('span', { class: 'sg__chip', style: `background:var(--${token})` }),
        h('code', { text: `--${token}` }),
      ),
    );
  }
  return grid;
}

function specimen(ctx: AppContext, lang: Lang): HTMLElement {
  const t = (key: MessageKey, vars?: Vars): string => translate(lang, key, vars);
  const noop = (): void => undefined;

  const type = h('div', { class: 'sg__type' });
  for (const size of [...SIZES].reverse()) {
    type.append(
      h(
        'div',
        { class: 'sg__type-row' },
        h('code', { text: String(size) }),
        h('span', {
          style: `font-size:var(--fs-${size});font-family:var(${size >= 28 ? '--font-display' : '--font-ui'});line-height:1.15`,
          text: size >= 28 ? t('sg.display') : t('sg.body'),
        }),
      ),
    );
  }
  type.append(
    h(
      'div',
      { class: 'sg__type-row' },
      h('code', { text: 'typing' }),
      h('span', { class: 'u-typing', lang, text: t('sg.typing') }),
    ),
  );

  const disabled = button({ label: t('sg.disabled'), icon: 'lock', disabled: true });
  const tg = toggle({
    checked: true,
    onText: t('common.on'),
    offText: t('common.off'),
    onChange: noop,
  });
  const sl = slider({
    min: 0,
    max: 100,
    step: 5,
    value: 70,
    format: (v) => `${v}%`,
    onChange: noop,
  });
  const ranks: Rank[] = ['S', 'A', 'B', 'C'];
  const sample = lang === 'he' ? ['ש', 'ד', 'ג', 'כ', 'ע'] : ['a', 's', 'd', 'f', 'g'];
  const list = menu(
    [
      { id: 'a', label: t('menu.players'), hint: t('menu.settingsHint'), onChoose: noop },
      {
        id: 'b',
        label: t('menu.track'),
        chosen: true,
        end: status(t('common.chosen'), 'gold'),
        onChoose: noop,
      },
      {
        id: 'c',
        label: t('menu.journey'),
        disabled: true,
        end: status(t('common.soon')),
        onChoose: noop,
      },
    ],
    { label: t('sg.menu') },
  );

  return h(
    'div',
    { class: 'sg__body' },
    section(t('sg.colors'), swatches()),
    section(t('sg.type'), type),
    section(
      t('sg.buttons'),
      row(
        button({ label: t('sg.primary'), variant: 'primary', icon: 'quill' }),
        button({ label: t('sg.default') }),
        button({ label: t('sg.quiet'), variant: 'quiet', icon: 'back', flipIcon: true }),
        button({ label: t('sg.danger'), variant: 'danger', icon: 'trash' }),
        disabled,
      ),
    ),
    section(
      t('sg.keys'),
      row(
        keycap(sample[0] ?? '', 'plain', 'lg'),
        keycap(sample[1] ?? '', 'gold', 'lg'),
        keycap(sample[2] ?? '', 'next', 'lg'),
        keycap(sample[3] ?? '', 'ok', 'lg'),
        keycap(sample[4] ?? '', 'err', 'lg'),
        keycap('?', 'fade', 'lg'),
        keycap('Enter', 'plain', 'sm'),
      ),
    ),
    section(
      t('sg.statuses'),
      row(
        status(t('status.correct'), 'ok'),
        status(t('status.caution'), 'warn'),
        status(t('status.wrong'), 'err'),
        status(t('status.restored'), 'gold'),
        status(t('status.forgotten')),
      ),
    ),
    section(
      t('sg.fields'),
      panel(
        {},
        field(
          { label: t('settings.reducedMotion'), hint: t('settings.reducedMotionHint') },
          tg.el,
          tg.state,
        ),
        field({ label: t('settings.music') }, sl.el, sl.value),
        field(
          { label: t('settings.theme') },
          select(
            (['auto', 'light', 'dark'] as const).map((v) => ({ value: v, label: t(`theme.${v}`) })),
            'auto',
            noop,
          ),
        ),
      ),
    ),
    section(
      t('sg.tabs'),
      tabs(
        [
          {
            id: 'one',
            label: t('sg.tabOne'),
            content: () => h('p', { text: t('sg.chartSummary') }),
          },
          { id: 'two', label: t('sg.tabTwo'), content: () => h('p', { text: t('sg.body') }) },
          {
            id: 'three',
            label: t('sg.tabThree'),
            content: () => h('p', { text: t('sg.heatLabel') }),
          },
        ],
        t('sg.tabs'),
      ).el,
    ),
    section(
      t('sg.stats'),
      row(
        statTile({ label: t('sg.wpm'), value: 41, unit: t('sg.wpmUnit') }),
        statTile({ label: t('sg.accuracy'), value: '96%' }),
        statTile({ label: t('sg.combo'), value: 128, gold: true }),
      ),
      progressBar(t('sg.progress'), 62).el,
      row(...ranks.map((r) => rankBadge(r, t('rank.label', { rank: r })))),
    ),
    section(
      t('sg.dialogue'),
      dialogueBox({
        speaker: t('sg.speaker'),
        text: t('sg.line'),
        sub: t('sg.caption'),
        nextHint: t('common.continue'),
      }).el,
    ),
    section(
      t('sg.heatmap'),
      keyboardMap({
        layout: lang,
        label: t('sg.heatLabel'),
        heat: HEAT,
        legend: { low: t('sg.heatLow'), high: t('sg.heatHigh') },
        small: true,
      }),
    ),
    section(
      t('sg.chart'),
      lineChart({
        title: t('sg.chartTitle'),
        points: SPEEDS,
        unit: t('sg.wpmUnit'),
        summary: t('sg.chartSummary'),
      }),
    ),
    section(
      t('sg.cards'),
      choiceCard({
        id: 'demo',
        kicker: t('track.kicker1'),
        title: t('track.name1'),
        body: t('track.body1'),
        points: [t('track.p1a'), t('track.p1b')],
        checked: true,
        hotkey: lang === 'he' ? 'א' : 'l',
        pickedText: t('common.chosen'),
        onPick: noop,
      }),
    ),
    section(t('sg.menu'), list.el),
    section(
      t('sg.toastModal'),
      row(
        button({
          label: t('sg.showToast'),
          onClick: () => ctx.toast.show(t('sg.toastText'), 'ok'),
        }),
        button({
          label: t('sg.showModal'),
          onClick: () =>
            openModal({
              title: t('sg.showModal'),
              body: t('sg.modalBody'),
              actions: [
                { label: t('common.cancel'), variant: 'quiet' },
                { label: t('common.continue'), variant: 'primary' },
              ],
            }),
        }),
        button({
          label: t('sg.showPause'),
          onClick: () => openPauseMenu(ctx, { onResume: noop, onRestart: noop, onQuit: noop }),
        }),
      ),
    ),
    section(
      t('sg.variants'),
      h(
        'div',
        { class: 'sg__row', 'data-palette': 'cb' },
        status(t('status.correct'), 'ok'),
        status(t('status.wrong'), 'err'),
        keycap(sample[3] ?? '', 'ok'),
        keycap(sample[4] ?? '', 'err'),
      ),
    ),
  );
}

export function styleguideScreen(ctx: AppContext): Screen {
  const t = ctx.i18n;
  const grid = h('div', { class: 'sg__grid' });
  for (const theme of ['light', 'dark'] as const) {
    for (const lang of LANGS) {
      grid.append(
        h(
          'article',
          { class: 'sg__frame', 'data-theme': theme, dir: dirOf(lang), lang },
          h('h2', {
            class: 'sg__title',
            text: t.t('sg.frame', { theme: t.t(`theme.${theme}`), dir: dirOf(lang).toUpperCase() }),
          }),
          specimen(ctx, lang),
        ),
      );
    }
  }
  const el = h(
    'div',
    { class: 'sg' },
    h(
      'header',
      { class: 'page__head' },
      h('h1', { class: 'page__title', text: t.t('sg.title') }),
      h('p', { class: 'page__lead', text: t.t('sg.lead') }),
    ),
    grid,
  );
  return { el, wide: true };
}
