// Applies the display settings to <html> as data attributes; tokens.css does the rest.

import type { Settings, ThemeChoice } from '../save';

export type ResolvedTheme = 'light' | 'dark';

export type DisplaySettings = Pick<
  Settings,
  'theme' | 'colorblind' | 'highContrast' | 'largeText' | 'dyslexiaFont' | 'reducedMotion'
>;

/** 'auto' follows the device. */
export function resolveTheme(choice: ThemeChoice, systemDark: boolean): ResolvedTheme {
  if (choice === 'auto') return systemDark ? 'dark' : 'light';
  return choice;
}

/** The next choice when the player presses the theme button: auto -> light -> dark -> auto. */
export function nextTheme(choice: ThemeChoice): ThemeChoice {
  return choice === 'auto' ? 'light' : choice === 'light' ? 'dark' : 'auto';
}

/** The data attributes for a set of display settings (`undefined` = attribute absent). */
export function themeAttributes(
  d: DisplaySettings,
  systemDark: boolean,
): Record<string, string | undefined> {
  return {
    'data-theme': resolveTheme(d.theme, systemDark),
    'data-palette': d.colorblind ? 'cb' : undefined,
    'data-contrast': d.highContrast ? 'high' : undefined,
    'data-text': d.largeText ? 'large' : undefined,
    'data-font': d.dyslexiaFont ? 'dyslexia' : undefined,
    'data-motion': d.reducedMotion ? 'reduce' : undefined,
  };
}

export function systemPrefersDark(win: Window = window): boolean {
  return (
    typeof win.matchMedia === 'function' && win.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

export function applyTheme(
  d: DisplaySettings,
  root: HTMLElement = document.documentElement,
  systemDark: boolean = systemPrefersDark(),
): void {
  for (const [name, value] of Object.entries(themeAttributes(d, systemDark))) {
    if (value === undefined) root.removeAttribute(name);
    else root.setAttribute(name, value);
  }
}
