// The title screen (T12): the 3D title (gold letters fall onto a blank parchment and spell the
// name) with the first choices beneath it. Any key or click while the letters fall jumps to the
// finished picture. Without 3D, the same choices sit under the painted wordmark.

import type { TitleScene } from '../../scenes/title';
import { HUB, type AppContext, type Screen } from '../app';
import { menu, panel, type MenuItem } from '../components';
import { h } from '../dom';
import type { Stage3d } from '../stage3d';
import { keysHint } from './frame';

/** The title animates once per visit; coming back to it later shows the finished picture. */
let shownOnce = false;

interface TitleProbe {
  ready: boolean;
  landed: number;
  failed: boolean;
  leaked: number | null;
}

declare global {
  interface Window {
    __otiyotTitle?: TitleProbe;
  }
}

export function titleScreen(ctx: AppContext, fresh: boolean): Screen {
  const t = ctx.i18n;
  const p = ctx.profile;
  const introSeen = p.story.flags.intro === true;
  const probe: TitleProbe = { ready: false, landed: 0, failed: false, leaked: null };
  window.__otiyotTitle = probe;

  const items: MenuItem[] = [];
  if (fresh) {
    items.push({
      id: 'begin',
      label: t.t('title.begin'),
      hint: t.t('title.beginHint'),
      onChoose: () => ctx.go('welcome'),
    });
  } else if (!introSeen) {
    items.push(
      {
        id: 'begin',
        label: t.t('title.begin'),
        hint: t.t('title.beginHint'),
        onChoose: () => ctx.go('intro'),
      },
      {
        id: 'continue',
        label: t.t('title.menu'),
        hint: t.t('title.menuHint', { name: p.name }),
        onChoose: () => ctx.go(HUB),
      },
    );
  } else {
    items.push(
      {
        id: 'continue',
        label: t.t('title.continue'),
        hint: t.t('title.continueHint', { name: p.name }),
        onChoose: () => ctx.go(HUB),
      },
      {
        id: 'replay',
        label: t.t('title.replay'),
        hint: t.t('title.replayHint'),
        onChoose: () => ctx.go('intro'),
      },
    );
  }
  if (!fresh) {
    items.push({
      id: 'players',
      label: t.t('menu.players'),
      hint: t.t('menu.playersHint', { name: p.name }),
      onChoose: () => ctx.go('players'),
    });
  }
  items.push({
    id: 'settings',
    label: t.t('menu.settings'),
    hint: t.t('menu.settingsHint'),
    onChoose: () => ctx.go('settings'),
  });
  const list = menu(items, { label: t.t('title.menuLabel'), compact: true });

  const view = h('div', { class: 'titlescreen__view' });
  const heading = h('h1', { class: 'sr-only', text: t.t('app.name') });
  const painted = h(
    'header',
    { class: 'title titlescreen__mark', hidden: true },
    h('p', { class: 'title__mark', lang: 'he', dir: 'rtl', 'aria-hidden': 'true', text: 'אותיות' }),
    h('p', { class: 'title__latin', lang: 'en', 'aria-hidden': 'true', text: 'OTIYOT' }),
  );
  const press = h('p', { class: 'titlescreen__press', text: t.t('title.press') });
  const sheet = panel(
    { deckled: true, class: 'titlescreen__panel' },
    h('p', { class: 'title__tagline', text: t.t('app.tagline') }),
    list.el,
    keysHint(t.t('common.keysHint')),
  );
  sheet.hidden = true;
  const el = h(
    'section',
    { class: 'titlescreen', 'data-testid': 'title' },
    view,
    heading,
    painted,
    h('div', { class: 'titlescreen__front' }, press, sheet),
  );

  let scene: TitleScene | null = null;
  let stage: Stage3d | null = null;
  let disposed = false;
  let ready = false;
  /** A key came before the scene was loaded: finish as soon as it is. */
  let hurried = shownOnce;

  const showMenu = (): void => {
    if (ready || disposed) return;
    ready = true;
    shownOnce = true;
    probe.ready = true;
    press.hidden = true;
    sheet.hidden = false;
    el.dataset.ready = 'true';
    list.focus();
  };

  /** Skips the falling letters: everything lands at once and the menu appears. */
  const hurry = (): void => {
    if (ready) return;
    hurried = true;
    if (scene) scene.finish();
  };

  const boot = async (): Promise<void> => {
    const [{ TitleScene }, { mountScene }] = await Promise.all([
      import('../../scenes/title'),
      import('../stage3d'),
    ]);
    if (disposed) return;
    const s = new TitleScene(p.settings.reducedMotion);
    s.onReady = () => {
      probe.landed = s.landed;
      showMenu();
    };
    try {
      stage = await mountScene(ctx, view, s, 5779);
    } catch {
      probe.failed = true;
      painted.hidden = false;
      el.dataset.flat = 'true';
      ctx.audio.music('title');
      ctx.audio.intensity(0.3);
      showMenu();
      return;
    }
    if (disposed) {
      stage.dispose();
      return;
    }
    scene = s;
    if (hurried) s.finish();
  };
  void boot();

  el.addEventListener('pointerdown', () => hurry());

  return {
    el,
    full: true,
    ownsMusic: true,
    onKey(ev) {
      if (!ready) {
        if (ev.ctrlKey || ev.metaKey || ev.altKey || ev.key === 'Tab') return false;
        hurry();
        return true;
      }
      return list.onKey(ev);
    },
    focus() {
      if (ready) list.focus();
      else el.focus?.();
    },
    dispose() {
      disposed = true;
      probe.leaked = stage ? stage.dispose() : 0;
      stage = null;
      scene = null;
    },
  };
}
