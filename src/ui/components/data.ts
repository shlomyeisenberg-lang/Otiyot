// Data components: keyboard map / key heatmap, line chart.

import { charForKey, HOME_ROW_KEYS, KEYBOARD_ROWS, type LayoutId } from '../../core';
import { h, s } from '../dom';

export interface KeyboardMapOptions {
  layout: LayoutId;
  /** Accessible description, e.g. "Hebrew keyboard, home row highlighted". */
  label: string;
  /** Heat per physical key code, 0 (fine) .. 1 (weakest). Turns the map into a heatmap. */
  heat?: Readonly<Record<string, number>>;
  /** Key codes to mark in techelet (e.g. the next keys to learn). */
  mark?: readonly string[];
  /** Highlight the home row in gold. */
  home?: boolean;
  /** Hide the number row (compact previews). */
  lettersOnly?: boolean;
  small?: boolean;
  /** Words for the two ends of the heat scale; shown only with `heat`. */
  legend?: { low: string; high: string };
}

const ROW_NAMES = ['number', 'top', 'home', 'bottom', 'space'] as const;

/**
 * The keyboard, drawn from the same layout tables the typing engine uses. Always laid out
 * left-to-right (a physical keyboard does not mirror in Hebrew).
 */
export function keyboardMap(o: KeyboardMapOptions): HTMLElement {
  const el = h('div', {
    class: o.small ? 'kbd kbd--sm' : 'kbd',
    role: 'img',
    'aria-label': o.label,
  });
  const marked = new Set(o.mark ?? []);
  const home = new Set(o.home ? HOME_ROW_KEYS : []);
  KEYBOARD_ROWS.forEach((codes, r) => {
    const name = ROW_NAMES[r] ?? 'space';
    if (o.lettersOnly && name === 'number') return;
    const row = h('div', { class: `kbd__row kbd__row--${name}`, 'aria-hidden': 'true' });
    for (const code of codes) {
      const cls = ['kbd__key'];
      let text = charForKey(o.layout, code, false) ?? '';
      if (code === 'Space') {
        cls.push('kbd__key--space');
        text = '';
      } else if (code.startsWith('Shift')) {
        cls.push('kbd__key--wide');
        text = '⇧';
      }
      if (marked.has(code)) cls.push('kbd__key--mark');
      else if (home.has(code)) cls.push('kbd__key--home');
      const key = h('span', { class: cls.join(' '), text });
      const heat = o.heat?.[code];
      if (heat !== undefined)
        key.style.setProperty('--heat', String(Math.min(1, Math.max(0, heat))));
      row.append(key);
    }
    el.append(row);
  });
  if (o.heat && o.legend) {
    el.append(
      h(
        'div',
        { class: 'kbd__legend', 'aria-hidden': 'true' },
        h('span', { text: o.legend.low }),
        h('span', { class: 'kbd__scale' }),
        h('span', { text: o.legend.high }),
      ),
    );
  }
  return el;
}

export interface LineChartOptions {
  title: string;
  /** Values in time order (oldest first). */
  points: readonly number[];
  unit?: string;
  /** Read by screen readers in place of the drawing. */
  summary: string;
}

const W = 320;
const H = 120;
const PAD = { top: 26, right: 10, bottom: 8, left: 6 };

/** Maps values to SVG points. Exported for tests. */
export function chartPoints(points: readonly number[]): { x: number; y: number }[] {
  if (points.length === 0) return [];
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  return points.map((v, i) => ({
    x: PAD.left + (points.length === 1 ? iw : (i / (points.length - 1)) * iw),
    y: PAD.top + ih - ((v - min) / span) * ih,
  }));
}

/** A small trend line. Time always runs left to right, in both languages. */
export function lineChart(o: LineChartOptions): HTMLElement {
  const pts = chartPoints(o.points);
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': o.summary });
  for (const f of [0, 0.5, 1]) {
    const y = PAD.top + (H - PAD.top - PAD.bottom) * f;
    svg.append(s('line', { class: 'chart__grid', x1: PAD.left, x2: W - PAD.right, y1: y, y2: y }));
  }
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (first && last) {
    const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`);
    const base = H - PAD.bottom;
    svg.append(
      s('path', {
        class: 'chart__area',
        d: `${path.join(' ')} L${last.x.toFixed(1)} ${base} L${first.x.toFixed(1)} ${base} Z`,
      }),
      s('path', { class: 'chart__line', d: path.join(' ') }),
      s('circle', { class: 'chart__dot', cx: last.x, cy: last.y, r: 4 }),
    );
    const lastValue = o.points[o.points.length - 1] ?? 0;
    const text = s('text', {
      class: 'chart__label',
      x: last.x,
      y: Math.max(12, last.y - 10),
      'text-anchor': 'end',
    });
    text.textContent = `${lastValue}${o.unit ? ` ${o.unit}` : ''}`;
    svg.append(text);
  }
  return h(
    'figure',
    { class: 'chart' },
    h('figcaption', { class: 'chart__title', text: o.title }),
    h('div', { dir: 'ltr' }, svg),
  );
}
