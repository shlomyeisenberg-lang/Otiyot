// Loads a screen's code the first time it is opened, so the first page the player sees stays
// small. The shell gets a Screen at once (an empty holder); when the code arrives the real screen
// is built inside it and everything the shell asks of a screen is passed on.

import type { AppContext, Screen, ScreenFactory } from './app';

export interface LazyTraits {
  /** What the shell must know before the code arrives (it sets the stage layout from these). */
  full?: boolean;
  wide?: boolean;
  ownsMusic?: boolean;
}

export function lazyScreen(
  load: () => Promise<ScreenFactory>,
  traits: LazyTraits = {},
): ScreenFactory {
  return (ctx: AppContext): Screen => {
    // `display: contents` keeps the holder out of the layout, so the real screen sits exactly
    // where it would have without it.
    const holder = document.createElement('div');
    holder.style.display = 'contents';
    let real: Screen | null = null;
    let gone = false;
    let wantFocus = false;
    const screen: Screen = {
      el: holder,
      full: traits.full,
      wide: traits.wide,
      ownsMusic: traits.ownsMusic,
      onKey: (ev) => real?.onKey?.(ev) ?? false,
      onEscape: () => real?.onEscape?.() ?? false,
      focus: () => {
        wantFocus = true;
        real?.focus?.();
      },
      dispose: () => {
        gone = true;
        real?.dispose?.();
      },
    };
    void load().then((factory) => {
      if (gone) return;
      real = factory(ctx);
      holder.append(real.el);
      if (wantFocus) real.focus?.();
    });
    return screen;
  };
}
