import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COLOR_TOKENS, COLORBLIND, colorNumber, PALETTE } from '../../src/engine/palette';
import { parseRoute, PARENT } from '../../src/ui/app';
import { chartPoints } from '../../src/ui/components/data';
import { nextTheme, resolveTheme, themeAttributes } from '../../src/ui/theme';

const css = readFileSync(new URL('../../src/ui/styles/tokens.css', import.meta.url), 'utf8');

/** The declarations of the first rule whose selector list is exactly `selector`. */
function block(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  expect(start, selector).toBeGreaterThanOrEqual(0);
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    out[m[1] as string] = (m[2] as string).toLowerCase();
  }
  return out;
}

describe('design tokens', () => {
  it('tokens.css and the 3D palette agree on every color, light and dark', () => {
    const light = block(":root,\n[data-theme='light']");
    const dark = block("[data-theme='dark']");
    for (const token of COLOR_TOKENS) {
      expect(light[token], `light ${token}`).toBe(PALETTE.light[token]);
      expect(dark[token], `dark ${token}`).toBe(PALETTE.dark[token]);
    }
  });

  it('matches the table in docs/DESIGN.md', () => {
    const design = readFileSync(new URL('../../docs/DESIGN.md', import.meta.url), 'utf8');
    const rows = design.split('\n').filter((l) => l.startsWith('| `--'));
    const hexes = (cell: string): string[] =>
      (cell.match(/#[0-9A-Fa-f]{6}/g) ?? []).map((x) => x.toLowerCase());
    let checked = 0;
    for (const row of rows) {
      const cells = row.split('|').map((c) => c.trim());
      const names = (cells[1] ?? '').match(/--[\w-]+/g) ?? [];
      const light = hexes(cells[2] ?? '');
      const dark = hexes(cells[3] ?? '');
      names.forEach((name, i) => {
        const token = name.slice(2) as (typeof COLOR_TOKENS)[number];
        expect(PALETTE.light[token], name).toBe(light[i]);
        expect(PALETTE.dark[token], name).toBe(dark[i]);
        checked += 1;
      });
    }
    expect(checked).toBe(COLOR_TOKENS.length);
  });

  it('colorblind palettes replace green/red and match the stylesheet', () => {
    expect(block("[data-palette='cb']")).toEqual(COLORBLIND.light);
    expect(block("[data-theme='dark'][data-palette='cb']")).toEqual(COLORBLIND.dark);
    expect(colorNumber('light', 'gold')).toBe(0xb8862b);
    expect(colorNumber('dark', 'ok-fg', true)).toBe(0x5fa4e8);
    expect(colorNumber('dark', 'gold', true)).toBe(0xe0b354);
  });

  it('no stylesheet other than tokens.css writes a raw color', () => {
    for (const file of ['base.css', 'components.css', 'screens.css', 'engine.css', 'hud.css']) {
      const text = readFileSync(new URL(`../../src/ui/styles/${file}`, import.meta.url), 'utf8');
      expect(text.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/g) ?? [], file).toEqual([]);
    }
  });
});

describe('theme', () => {
  const base = {
    theme: 'auto',
    colorblind: false,
    highContrast: false,
    largeText: false,
    dyslexiaFont: false,
    reducedMotion: false,
  } as const;

  it('auto follows the device, explicit choices win', () => {
    expect(resolveTheme('auto', true)).toBe('dark');
    expect(resolveTheme('auto', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('cycles auto, light, dark', () => {
    expect([nextTheme('auto'), nextTheme('light'), nextTheme('dark')]).toEqual([
      'light',
      'dark',
      'auto',
    ]);
  });

  it('turns settings into data attributes, leaving off what is off', () => {
    expect(themeAttributes(base, false)).toEqual({
      'data-theme': 'light',
      'data-palette': undefined,
      'data-contrast': undefined,
      'data-text': undefined,
      'data-font': undefined,
      'data-motion': undefined,
    });
    expect(
      themeAttributes(
        {
          theme: 'dark',
          colorblind: true,
          highContrast: true,
          largeText: true,
          dyslexiaFont: true,
          reducedMotion: true,
        },
        false,
      ),
    ).toEqual({
      'data-theme': 'dark',
      'data-palette': 'cb',
      'data-contrast': 'high',
      'data-text': 'large',
      'data-font': 'dyslexia',
      'data-motion': 'reduce',
    });
  });
});

describe('routes and chart maths', () => {
  it('reads routes from the hash and sends unknown ones to the menu', () => {
    expect(parseRoute('')).toBe('menu');
    expect(parseRoute('#/players/new')).toBe('players/new');
    expect(parseRoute('#/settings/')).toBe('settings');
    expect(parseRoute('#track')).toBe('track');
    expect(parseRoute('#/nope')).toBe('menu');
    expect(PARENT['players/new']).toBe('players');
    expect(PARENT.menu).toBeNull();
  });

  it('maps chart values into the drawing area', () => {
    expect(chartPoints([])).toEqual([]);
    const pts = chartPoints([10, 20, 15]);
    expect(pts).toHaveLength(3);
    expect(pts[0]?.x).toBeLessThan(pts[2]?.x ?? 0);
    // higher value = higher on screen = smaller y
    expect(pts[1]?.y).toBeLessThan(pts[0]?.y ?? 0);
    // a flat line does not divide by zero
    expect(chartPoints([5, 5]).every((p) => Number.isFinite(p.y))).toBe(true);
    expect(chartPoints([7])).toHaveLength(1);
  });
});
