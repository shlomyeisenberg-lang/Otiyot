// The UI shell: top bar, screen switching by location hash, one keyboard listener, theme and
// language. Screens are plain factories (src/ui/screens); the shell owns nothing game-specific.

import { AudioEngine } from '../audio';
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
import { hubScreen } from './screens/hub';
import { cliffsScreen } from './screens/cliffs';
import { forgeScreen } from './screens/forge';
import { shukScreen } from './screens/shuk';
import { railScreen } from './screens/rail';
import { genizaScreen } from './screens/geniza';
import { hermonScreen } from './screens/hermon';
import { stationScreen } from './screens/station';
import { atbashScreen } from './screens/atbash';
import { midbarScreen } from './screens/midbar';
import { cavesScreen } from './screens/caves';
import { arenaScreen } from './screens/arena';
import { scrollScreen } from './screens/scroll';
import { arcadeScreen } from './screens/arcade';
import { ladderScreen } from './screens/ladder';
import { trialScreen, trialsScreen } from './screens/trials';
import { meadowScreen } from './screens/meadow';
import { chapterScreen } from './screens/chapter';
import { introScreen } from './screens/intro';
import { lessonScreen } from './screens/lesson';
import { modesScreen } from './screens/modes';
import { mainMenuScreen } from './screens/mainMenu';
import { openPauseMenu } from './screens/pause';
import { playersScreen } from './screens/players';
import { rangeScreen } from './screens/range';
import { settingsScreen } from './screens/settings';
import { soundScreen } from './screens/sound';
import { titleScreen } from './screens/title';
import { trackScreen } from './screens/track';
import { statsScreen } from './screens/stats';
import { journalScreen } from './screens/journal';
import { shopScreen } from './screens/shop';
import { wizardScreen } from './screens/wizard';
import { actsAsEscape, BreakTimer, reminderKeys } from './health';
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

declare global {
  interface Window {
    __otiyotHealth?: (seconds: number) => void;
  }
}

/** Seconds between looks at the break timer. */
const HEALTH_TICK_S = 5;

/** Menus: drone, harp and melody, no drums. */
const MENU_INTENSITY = 0.3;

function volumesOf(s: Settings): { music: number; sfx: number; voice: number; ui: number } {
  return { music: s.musicVolume, sfx: s.sfxVolume, voice: s.voiceVolume, ui: s.uiVolume };
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
  private readonly audio: AudioEngine;
  /** True while the player moves with the keyboard (focus changes then tick softly). */
  private keyboardNav = false;
  private readonly breaks = new BreakTimer(0);
  private reminders = 0;

  constructor(o: ShellOptions) {
    this.root = o.root;
    this.saves = o.saves;
    this.win = o.win ?? window;
    this.needsWelcome = o.loaded.source === 'fresh' && !o.loaded.legacyImported;
    this.screens = {
      title: (ctx) => titleScreen(ctx, this.needsWelcome),
      intro: introScreen,
      chapter: chapterScreen,
      hub: hubScreen,
      lesson: lessonScreen,
      modes: modesScreen,
      meadow: meadowScreen,
      cliffs: cliffsScreen,
      forge: forgeScreen,
      shuk: shukScreen,
      rail: railScreen,
      geniza: genizaScreen,
      hermon: hermonScreen,
      station: stationScreen,
      atbash: atbashScreen,
      midbar: midbarScreen,
      caves: cavesScreen,
      arena: arenaScreen,
      trials: trialsScreen,
      trial: trialScreen,
      scroll: scrollScreen,
      ladder: ladderScreen,
      arcade: arcadeScreen,
      menu: mainMenuScreen,
      welcome: (ctx) => wizardScreen(ctx, 'welcome', () => (this.needsWelcome = false)),
      players: playersScreen,
      'players/new': (ctx) => wizardScreen(ctx, 'new'),
      track: trackScreen,
      layout: layoutScreen,
      settings: settingsScreen,
      stats: statsScreen,
      journal: journalScreen,
      shop: shopScreen,
      pause: mainMenuScreen,
      range: rangeScreen,
      sound: soundScreen,
      ...o.extraScreens,
    };
    const saves = this.saves;
    this.audio = new AudioEngine({
      volumes: volumesOf(saves.activeProfile.settings),
      doc: this.win.document,
    });
    this.ctx = {
      saves,
      audio: this.audio,
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
    // The player's own pause key becomes Escape before anything else sees it.
    this.win.document.addEventListener('keydown', (ev) => this.rebindMenuKey(ev), true);
    this.win.setInterval(() => this.healthTick(HEALTH_TICK_S), HEALTH_TICK_S * 1000);
    // For the browser test: lets it "play" for a while without waiting.
    this.win.__otiyotHealth = (seconds: number) => this.healthTick(seconds);
    this.listenForSound();
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
    this.audio.setVolumes(volumesOf(settings));
    this.win.document.title = this.i18n.t('app.name');
  }

  /**
   * Sound may only start after the player does something, so the first key press or click wakes
   * the audio. Menus answer clicks and keyboard moves with soft sounds of their own.
   */
  private listenForSound(): void {
    const doc = this.win.document;
    const wake = (): void => this.audio.unlock();
    doc.addEventListener(
      'keydown',
      () => {
        wake();
        this.keyboardNav = true;
      },
      true,
    );
    doc.addEventListener(
      'pointerdown',
      () => {
        wake();
        this.keyboardNav = false;
      },
      true,
    );
    this.root.addEventListener('click', (ev) => {
      const el = (ev.target as HTMLElement | null)?.closest?.(
        'button, [role="tab"], [role="radio"], [role="switch"], a[href]',
      );
      if (!el || el.hasAttribute('disabled')) return;
      const role = el.getAttribute('role');
      this.audio.play(role === 'switch' || role === 'radio' ? 'ui-toggle' : 'ui-click');
    });
    this.root.addEventListener('focusin', (ev) => {
      if (!this.keyboardNav) return;
      const el = ev.target as HTMLElement | null;
      if (
        el?.matches?.(
          'button, [role="tab"], [role="radio"], [role="switch"], a[href], select, input',
        )
      ) {
        this.audio.play('ui-move');
      }
    });
  }

  private go(route: Route): void {
    const hash = `#/${route}`;
    if (this.win.location.hash === hash) this.render();
    else this.win.location.hash = hash;
  }

  private back(): void {
    const parent = PARENT[this.route];
    if (parent) {
      this.audio.play('ui-back');
      this.go(parent);
    }
  }

  private render(): void {
    let route = parseRoute(this.win.location.hash);
    if (this.needsWelcome && route === 'menu') route = 'welcome';
    if (!this.screens[route]) route = 'menu';
    this.route = route;
    this.applySettings();
    this.renderBar();
    const factory = this.screens[route] ?? mainMenuScreen;
    this.screen?.dispose?.();
    const screen = factory(this.ctx);
    this.screen = screen;
    this.stage.className = screen.full
      ? 'stage stage--full'
      : screen.wide
        ? 'stage stage--wide'
        : 'stage';
    this.stage.dataset.route = route;
    this.stage.replaceChildren(screen.el);
    // Menus play the title theme softly; 3D screens choose their own music.
    if (!screen.full && !screen.ownsMusic) {
      this.audio.music('title');
      this.audio.intensity(MENU_INTENSITY);
    }
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

  private rebindMenuKey(ev: KeyboardEvent): void {
    if (!actsAsEscape(ev.code, this.saves.activeProfile.settings.menuKey)) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    if (ev.repeat) return;
    const target = ev.target ?? this.win.document;
    target.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        code: 'Escape',
        bubbles: true,
        cancelable: true,
      }),
    );
  }

  /** Adds play time and, when it is due, Dyo's gentle break reminder (never during the story). */
  private healthTick(seconds: number): void {
    const settings = this.saves.activeProfile.settings;
    this.breaks.setMinutes(settings.breakMinutes);
    const quiet = this.route === 'title' || this.route === 'welcome' || this.route === 'intro';
    if (quiet || this.win.document.visibilityState === 'hidden') return;
    if (!this.breaks.tick(seconds)) return;
    const keys = reminderKeys(settings.postureTips, this.reminders++);
    const tip = keys.tip ? ` ${this.i18n.t(keys.tip)}` : '';
    this.toast.show(`${this.i18n.t(keys.title)}${tip}`, 'gold', 12000);
  }

  private onKey(ev: KeyboardEvent): void {
    if (ev.defaultPrevented || topModal()) return;
    const target = ev.target;
    const inControl =
      isTextEntry(target) ||
      target instanceof HTMLSelectElement ||
      target instanceof HTMLInputElement;
    if (ev.key === 'Escape') {
      if (this.screen?.onEscape?.()) {
        ev.preventDefault();
        return;
      }
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
