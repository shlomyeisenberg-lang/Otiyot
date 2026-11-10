// The UI shell: top bar, screen switching by location hash, one keyboard listener, theme and
// language. Screens are plain factories (src/ui/screens); the shell owns nothing game-specific.

import type { LoadResult, SaveManager, Settings } from '../save';
import {
  parseRoute,
  PARENT,
  type AppContext,
  type Route,
  type Screen,
  type ScreenFactory,
} from './app';
import { button, toastHost, topModal } from './components';
import { h, isTextEntry, s } from './dom';
import { bdi, I18n, otherLang, type Lang } from './i18n';
import { icon, type IconName } from './icons';
import { layoutScreen } from './screens/layout';
import { mainMenuScreen } from './screens/mainMenu';
import { openPauseMenu } from './screens/pause';
import { playersScreen } from './screens/players';
import { settingsScreen } from './screens/settings';
import { trackScreen } from './screens/track';
import { wizardScreen } from './screens/wizard';
import { applyTheme, nextTheme } from './theme';

const THEME_ICON: Record<Settings['theme'], IconName> = {
  auto: 'auto',
  light: 'sun',
  dark: 'moon',
};

/** The filter that gives large panels their hand-cut top edge. Referenced by components.css. */
function deckleFilter(): SVGElement {
  const svg = s('svg', { width: 0, height: 0, 'aria-hidden': 'true', style: 'position:absolute' });
  svg.append(
    s(
      'filter',
      { id: 'otiyot-deckle', x: '-2%', y: '-60%', width: '104%', height: '220%' },
      s('feTurbulence', {
        type: 'fractalNoise',
        baseFrequency: '0.09 0.035',
        numOctaves: 3,
        seed: 7,
      }),
      s('feDisplacementMap', {
        in: 'SourceGraphic',
        scale: 9,
        xChannelSelector: 'R',
        yChannelSelector: 'G',
      }),
    ),
  );
  return svg;
}

export interface ShellOptions {
  root: HTMLElement;
  saves: SaveManager;
  /** Result of the first load; a fresh save starts with the welcome steps. */
  loaded: LoadResult;
  /** Extra screens (the dev-only styleguide). */
  extraScreens?: Partial<Record<Route, ScreenFactory>>;
  win?: Window;
}

export class Shell {
  private readonly root: HTMLElement;
  private readonly saves: SaveManager;
  private readonly win: Window;
  private readonly i18n = new I18n();
  private readonly toast = toastHost();
  private readonly bar = h('header', { class: 'topbar' });
  private readonly stage = h('main', { class: 'stage', id: 'stage', tabindex: -1 });
  private readonly screens: Partial<Record<Route, ScreenFactory>>;
  private readonly ctx: AppContext;
  private screen: Screen | null = null;
  private route: Route = 'menu';
  private needsWelcome: boolean;

  constructor(o: ShellOptions) {
    this.root = o.root;
    this.saves = o.saves;
    this.win = o.win ?? window;
    this.needsWelcome = o.loaded.source === 'fresh' && !o.loaded.legacyImported;
    this.screens = {
      menu: mainMenuScreen,
      welcome: (ctx) => wizardScreen(ctx, 'welcome', () => (this.needsWelcome = false)),
      players: playersScreen,
      'players/new': (ctx) => wizardScreen(ctx, 'new'),
      track: trackScreen,
      layout: layoutScreen,
      settings: settingsScreen,
      pause: mainMenuScreen,
      ...o.extraScreens,
    };
    const saves = this.saves;
    this.ctx = {
      saves,
      i18n: this.i18n,
      toast: this.toast,
      get profile() {
        return saves.activeProfile;
      },
      go: (route) => this.go(route),
      back: () => this.back(),
      refresh: () => this.render(),
      setLanguage: (lang) => this.ctx.updateSettings({ uiLanguage: lang }),
      updateSettings: (patch) => {
        saves.update((p) => Object.assign(p.settings, patch));
        this.applySettings();
        if (patch.uiLanguage !== undefined) this.render();
        else this.renderBar();
      },
    };
  }

  /** Mounts the shell and starts listening. */
  start(): void {
    const skip = h('a', { class: 'skip', href: '#stage' });
    this.root.replaceChildren(skip, deckleFilter(), this.bar, this.stage, this.toast.el);
    skip.addEventListener('click', (ev) => {
      ev.preventDefault();
      this.stage.focus();
    });
    this.applySettings();
    this.win.addEventListener('hashchange', () => this.render());
    this.win.document.addEventListener('keydown', (ev) => this.onKey(ev));
    this.win
      .matchMedia?.('(prefers-color-scheme: dark)')
      .addEventListener?.('change', () => this.applySettings());
    this.render();
  }

  private applySettings(): void {
    const settings = this.saves.activeProfile.settings;
    const html = this.win.document.documentElement;
    this.i18n.setLang(settings.uiLanguage, html);
    applyTheme(settings, html);
    this.win.document.title = this.i18n.t('app.name');
  }

  private go(route: Route): void {
    const hash = `#/${route}`;
    if (this.win.location.hash === hash) this.render();
    else this.win.location.hash = hash;
  }

  private back(): void {
    const parent = PARENT[this.route];
    if (parent) this.go(parent);
  }

  private render(): void {
    let route = parseRoute(this.win.location.hash);
    if (this.needsWelcome && route === 'menu') route = 'welcome';
    if (!this.screens[route]) route = 'menu';
    this.route = route;
    this.applySettings();
    this.renderBar();
    const factory = this.screens[route] ?? mainMenuScreen;
    const screen = factory(this.ctx);
    this.screen = screen;
    this.stage.className = screen.wide ? 'stage stage--wide' : 'stage';
    this.stage.dataset.route = route;
    this.stage.replaceChildren(screen.el);
    this.win.scrollTo(0, 0);
    screen.focus?.();
    if (route === 'pause') {
      openPauseMenu(this.ctx, {
        onResume: () => this.go('menu'),
        onQuit: () => this.go('menu'),
      });
    }
  }

  private renderBar(): void {
    const t = this.i18n;
    const settings = this.saves.activeProfile.settings;
    const start = h('div', { class: 'topbar__side' });
    if (PARENT[this.route]) {
      start.append(
        button({
          label: t.t('common.back'),
          variant: 'quiet',
          icon: 'back',
          flipIcon: true,
          small: true,
          onClick: () => this.back(),
        }),
      );
    }
    const end = h('div', { class: 'topbar__side' });
    if (this.route !== 'welcome') {
      const who = h(
        'span',
        { class: 'topbar__who' },
        icon('user'),
        bdi(this.saves.activeProfile.name),
      );
      end.append(who);
    }
    const other: Lang = otherLang(t.lang);
    const langBtn = h(
      'button',
      {
        class: 'btn btn--quiet btn--small',
        type: 'button',
        lang: other,
        'data-action': 'language',
        'aria-label': t.t('lang.switchTo', { lang: t.t(`lang.${other}`) }),
      },
      icon('globe'),
      h('span', { text: t.t(`lang.${other}`) }),
    );
    langBtn.addEventListener('click', () => this.ctx.setLanguage(other));
    const themeBtn = button({
      label: t.t('theme.button', { theme: t.t(`theme.${settings.theme}`) }),
      variant: 'quiet',
      icon: THEME_ICON[settings.theme],
      small: true,
      iconOnly: true,
      onClick: () => this.ctx.updateSettings({ theme: nextTheme(settings.theme) }),
    });
    themeBtn.dataset.action = 'theme';
    end.append(langBtn, themeBtn);
    this.bar.replaceChildren(start, end);
    const skip = this.root.querySelector('.skip');
    if (skip) skip.textContent = t.t('app.skip');
  }

  private onKey(ev: KeyboardEvent): void {
    if (ev.defaultPrevented || topModal()) return;
    const target = ev.target;
    const inControl =
      isTextEntry(target) ||
      target instanceof HTMLSelectElement ||
      target instanceof HTMLInputElement;
    if (ev.key === 'Escape') {
      if (PARENT[this.route]) {
        ev.preventDefault();
        this.back();
      }
      return;
    }
    if (inControl && ev.key !== 'Enter') return;
    if (this.screen?.onKey?.(ev)) ev.preventDefault();
  }
}
