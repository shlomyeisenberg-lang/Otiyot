// What every screen is given, and what every screen must be.

import type { AudioEngine } from '../audio';
import type { Profile, SaveManager, Settings } from '../save';
import type { ToastHost } from './components';
import type { I18n, Lang } from './i18n';

export type Route =
  | 'title'
  | 'intro'
  | 'hub'
  | 'lesson'
  | 'meadow'
  | 'cliffs'
  | 'forge'
  | 'shuk'
  | 'rail'
  | 'geniza'
  | 'hermon'
  | 'station'
  | 'atbash'
  | 'midbar'
  | 'caves'
  | 'arena'
  | 'trials'
  | 'trial'
  | 'menu'
  | 'welcome'
  | 'players'
  | 'players/new'
  | 'track'
  | 'layout'
  | 'settings'
  | 'pause'
  | 'styleguide'
  | 'range'
  | 'sound';

export interface AppContext {
  readonly saves: SaveManager;
  readonly i18n: I18n;
  readonly toast: ToastHost;
  /** The one audio engine: music, effects, menu sounds (silent until the first key or click). */
  readonly audio: AudioEngine;
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
  /** The screen picks its own music (otherwise menus play the title theme softly). */
  ownsMusic?: boolean;
  /** Fills the whole area under the top bar (3D views). */
  full?: boolean;
  /** Esc pressed: return true when the screen used it (the intro skips) instead of going back. */
  onEscape?(): boolean;
  /** Called when the screen is replaced: stop loops, free what was created. */
  dispose?(): void;
}

export type ScreenFactory = (ctx: AppContext) => Screen;

/** Where Esc / Back leads from each route (`null`: nowhere, this is the root). */
export const PARENT: Readonly<Record<Route, Route | null>> = {
  title: null,
  intro: null,
  hub: 'menu',
  lesson: 'hub',
  meadow: 'hub',
  cliffs: 'hub',
  forge: 'hub',
  shuk: 'hub',
  rail: 'hub',
  geniza: 'hub',
  hermon: 'hub',
  station: 'hub',
  atbash: 'hub',
  midbar: 'hub',
  caves: 'hub',
  arena: 'hub',
  trials: 'hub',
  trial: 'trials',
  menu: null,
  welcome: null,
  players: 'menu',
  'players/new': 'players',
  track: 'menu',
  layout: 'menu',
  settings: 'menu',
  pause: 'menu',
  styleguide: 'menu',
  range: 'menu',
  sound: 'settings',
};

const ROUTES = Object.keys(PARENT) as Route[];

/** Where the story hands over when the intro ends and where "Continue" leads: the House of the Scribe. */
export const HUB: Route = 'hub';

/**
 * Reads a route from a location hash such as `#/players/new`. No hash (a fresh launch) opens the
 * title; unknown hashes go to the menu.
 */
export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#\/?/, '').replace(/\/$/, '');
  if (path === '') return 'title';
  return ROUTES.find((r) => r === path) ?? 'menu';
}
