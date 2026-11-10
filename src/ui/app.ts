// What every screen is given, and what every screen must be.

import type { Profile, SaveManager, Settings } from '../save';
import type { ToastHost } from './components';
import type { I18n, Lang } from './i18n';

export type Route =
  | 'menu'
  | 'welcome'
  | 'players'
  | 'players/new'
  | 'track'
  | 'layout'
  | 'settings'
  | 'pause'
  | 'styleguide';

export interface AppContext {
  readonly saves: SaveManager;
  readonly i18n: I18n;
  readonly toast: ToastHost;
  readonly profile: Profile;
  go(route: Route): void;
  back(): void;
  /** Rebuilds the current screen (after the language or the active player changes). */
  refresh(): void;
  setLanguage(lang: Lang): void;
  /** Changes settings on the active player, saves, and re-applies theme and language. */
  updateSettings(patch: Partial<Settings>): void;
}

export interface Screen {
  el: HTMLElement;
  /** Key presses that are not inside a text box. Return true when the key was used. */
  onKey?(ev: KeyboardEvent): boolean;
  /** Put the keyboard focus where the player expects it. */
  focus?(): void;
  /** Wider column (cards side by side). */
  wide?: boolean;
}

export type ScreenFactory = (ctx: AppContext) => Screen;

/** Where Esc / Back leads from each route (`null`: nowhere, this is the root). */
export const PARENT: Readonly<Record<Route, Route | null>> = {
  menu: null,
  welcome: null,
  players: 'menu',
  'players/new': 'players',
  track: 'menu',
  layout: 'menu',
  settings: 'menu',
  pause: 'menu',
  styleguide: 'menu',
};

const ROUTES = Object.keys(PARENT) as Route[];

/** Reads a route from a location hash such as `#/players/new`. Unknown hashes go to the menu. */
export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#\/?/, '').replace(/\/$/, '');
  return ROUTES.find((r) => r === path) ?? 'menu';
}
